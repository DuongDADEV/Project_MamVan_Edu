import { useSyncExternalStore } from 'react';
import type {
  AssistantChart,
  AssistantToolRun,
} from '../../../services/ai/analyticsAssistant.ts';
import { isSupabaseReady } from '../../../services/supabase/client.ts';
import {
  deleteAssistantChatHistory,
  fetchAssistantChatHistory,
  pruneAssistantChatHistory,
  upsertAssistantChatMessages,
} from './assistantChatRepository.ts';
import {
  CHAT_HISTORY_MAX,
  capChatHistory,
  mergeChatHistories,
  normalizeChatHistory,
  stampLegacyBeforeServer,
} from './assistantChatSync.ts';

export interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  toolRuns?: AssistantToolRun[];
  chart?: AssistantChart;
  followups?: string[];
  isError?: boolean;
  /**
   * Danh tính cross-device của tin (uuid do client sinh khi gửi;
   * tin legacy trước đợt 4 được gán id legacy xác định khi đồng
   * bộ lần đầu — xem assistantChatSync.ts). Server dedupe theo
   * cặp (teacher_id, client_id) nên 2 trình duyệt append đồng
   * thời không ghi đè nhau.
   */
  clientId?: string;
  /** Thời điểm gửi (ms epoch) — tin legacy trước đợt 4 không có. */
  createdAt?: number;
}

interface ChatState {
  messages: ChatMsg[];
  busy: boolean;
}

/**
 * Kho hội thoại DÙNG CHUNG của Trợ lý phân tích: tab trong mục Phân tích và
 * bong bóng chat nổi đọc/ghi cùng một lịch sử này nên hai nơi luôn đồng nhất.
 *
 * ĐỢT 4 (26/10) — đồng bộ lên database (bảng assistant_chat_messages):
 * server là nguồn thật duy nhất khi đọc thành công; localStorage chỉ còn
 * là cache hiển thị tức thời + fallback khi lỗi/mất mạng, đúng luật
 * server-thật đợt 3. Hành vi cũ giữ nguyên: tối đa 80 tin, nút xóa 2
 * chạm (không window.confirm), tab + bong bóng dùng chung một kho.
 */
const STORAGE_KEY = 'mam_van_assistant_chat_v1';
const MAX_STORED = 80;
// Tin gửi thất bại (mất mạng) chờ đẩy lại ở lần đồng bộ sau —
// kèm teacherId để đổi giáo viên không đẩy nhầm sang người khác.
const OUTBOX_KEY = 'mam_van_assistant_chat_outbox_v1';
// Đánh dấu giáo viên đã đồng bộ lần đầu trên trình duyệt này.
const SYNCED_PREFIX = 'mam_van_assistant_chat_synced_v1:';
// Giáo viên của cache local hiện tại — đổi giáo viên thì cache cũ
// KHÔNG được gộp sang người mới (xem runSync).
const TEACHER_KEY = 'mam_van_assistant_chat_teacher_v1';

interface OutboxItem {
  teacherId: string;
  msg: ChatMsg;
}

function loadMessages(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.filter((m) => m && typeof m.text === 'string');
      }
    }
  } catch {
    /* dữ liệu hỏng → bắt đầu trống */
  }
  return [];
}

function loadOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.filter(
          (it) => it && typeof it.teacherId === 'string' && it.msg?.clientId
        );
      }
    }
  } catch {
    /* bỏ qua */
  }
  return [];
}

function saveOutbox(items: OutboxItem[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-MAX_STORED)));
  } catch {
    /* quota đầy: bỏ qua, tin vẫn còn trong cache chính */
  }
}

function newClientId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* rơi xuống fallback */
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let state: ChatState = { messages: loadMessages(), busy: false };
let seq = state.messages.reduce((mx, m) => Math.max(mx, m.id || 0), 0) + 1;
const listeners = new Set<() => void>();

/** Giáo viên đang đồng bộ trong phiên này (null = chỉ local). */
let syncTeacherId: string | null = null;
/** clientId các tin gửi trong phiên này — để lần đồng bộ đầu không
 *  làm mất tin gửi trước khi đồng bộ chạy xong. */
const sessionAppended = new Set<string>();

function emit(next: ChatState) {
  state = next;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state.messages.slice(-MAX_STORED))
    );
  } catch {
    /* quota đầy hoặc chế độ riêng tư: bỏ qua, hội thoại vẫn chạy trong phiên */
  }
  listeners.forEach((l) => l());
}

/** Gán lại id số 1..N cho danh sách (id chỉ là React key trong phiên)
 *  rồi hiển thị + ghi đè cache local bằng danh sách đó. */
function applyMessages(msgs: ChatMsg[]) {
  const capped = capChatHistory(msgs);
  const renumbered = capped.map((m, i) => ({ ...m, id: i + 1 }));
  seq = renumbered.length + 1;
  emit({ ...state, messages: renumbered });
}

async function runSync(teacherId: string) {
  try {
    const recordedTeacher = (() => {
      try {
        return localStorage.getItem(TEACHER_KEY);
      } catch {
        return null;
      }
    })();
    const cacheMsgs = loadMessages();
    // Cache của giáo viên khác thì KHÔNG gộp sang người này —
    // lịch sử người cũ vẫn nằm trên server, đăng nhập lại là về.
    const localForMerge =
      recordedTeacher && recordedTeacher !== teacherId ? [] : cacheMsgs;

    // 1. Đẩy nốt tin gửi thất bại trước đây của đúng giáo viên này.
    const outbox = loadOutbox().filter((it) => it.teacherId === teacherId);
    if (outbox.length > 0) {
      await upsertAssistantChatMessages(
        teacherId,
        outbox.map((it) => it.msg)
      );
      saveOutbox(loadOutbox().filter((it) => it.teacherId !== teacherId));
    }

    // 2. Đọc server — lỗi thì giữ nguyên local (fallback), lần
    // mount sau thử lại (syncTeacherId reset ở catch bên dưới).
    const server = await fetchAssistantChatHistory(teacherId);

    // 3. Lần đồng bộ đầu tiên trên trình duyệt này: gộp lịch sử
    // local cũ lên server (không trùng clientId, cap 80). Từ lần
    // sau, server thắng outright — cache cũ không hồi sinh được
    // lịch sử đã xóa ở nơi khác.
    let marker = false;
    try {
      marker = localStorage.getItem(SYNCED_PREFIX + teacherId) === '1';
    } catch {
      marker = false;
    }
    // Tin gửi trong lúc đồng bộ đang chạy: state mới nhất có thể
    // đã hơn cache lúc bắt đầu — gộp thêm để không làm mất chúng.
    const current = normalizeChatHistory(state.messages).filter((m) =>
      sessionAppended.has(m.clientId ?? '')
    );
    let next: ChatMsg[];
    if (!marker) {
      const merged = mergeChatHistories(
        server,
        mergeChatHistories(localForMerge, current)
      );
      const serverIds = new Set(server.map((m) => m.clientId));
      const missing = merged.filter(
        (m) => m.clientId && !serverIds.has(m.clientId)
      );
      if (missing.length > 0) {
        // Đợt 4b: tin legacy chưa có createdAt phải xếp TRƯỚC dòng
        // server sớm nhất (chúng ra đời trước tính năng đồng bộ).
        // Nếu để DB tự gán giờ sync thì prune oldest-first sẽ cắt
        // dòng server có trước — hồi quy đợt 4 (cặp test seq 1–2
        // bị xóa vì legacy mang created_at giờ sync, mới hơn).
        const earliestServerAt = server.reduce(
          (min, m) => (m.createdAt != null ? Math.min(min, m.createdAt) : min),
          Infinity
        );
        const stamped = stampLegacyBeforeServer(
          missing,
          Number.isFinite(earliestServerAt) ? earliestServerAt : undefined
        );
        await upsertAssistantChatMessages(teacherId, stamped);
        try {
          await pruneAssistantChatHistory(teacherId, CHAT_HISTORY_MAX);
        } catch {
          /* prune lỗi: hiển thị vẫn cap 80, lần ghi sau prune lại */
        }
      }
      next = merged;
      try {
        localStorage.setItem(SYNCED_PREFIX + teacherId, '1');
      } catch {
        /* không ghi được marker: lần sau gộp lại (idempotent) */
      }
    } else {
      next = mergeChatHistories(server, current);
      const serverIds = new Set(server.map((m) => m.clientId));
      const missing = next.filter(
        (m) => m.clientId && !serverIds.has(m.clientId)
      );
      if (missing.length > 0) {
        await upsertAssistantChatMessages(teacherId, missing);
      }
    }

    try {
      localStorage.setItem(TEACHER_KEY, teacherId);
    } catch {
      /* bỏ qua */
    }
    applyMessages(next);
    // Tin gửi trong phiên này giờ đã nằm trên server — gỡ khỏi
    // tập để lần đồng bộ sau không gộp lại.
    sessionAppended.clear();
  } catch {
    // Offline / Supabase lỗi: giữ nguyên local, cho phép mount sau
    // thử lại bằng cách gỡ guard.
    syncTeacherId = null;
  }
}

/**
 * Bắt đầu đồng bộ lịch sử của giáo viên với server. Gọi từ
 * AnalyticsAssistantTab (cả tab Phân tích lẫn bong bóng nổi đều
 * render component này nên một chỗ móc là đủ). Lặp gọi với cùng
 * teacherId là no-op; đổi teacherId thì đồng bộ lại cho người mới.
 * Không chặn render: tin local hiện ngay, server về thì thay bằng
 * lịch sử server (lần đầu có gộp local cũ lên).
 */
export function initAssistantChatSync(teacherId?: string) {
  if (!teacherId || !isSupabaseReady()) return;
  if (syncTeacherId === teacherId) return;
  // Đổi giáo viên trong cùng phiên: tin gửi dở của người cũ
  // không thuộc về người mới.
  sessionAppended.clear();
  syncTeacherId = teacherId;
  void runSync(teacherId);
}

export function subscribeAssistantChat(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getAssistantChatState(): ChatState {
  return state;
}

export function useAssistantChat(): ChatState {
  return useSyncExternalStore(
    subscribeAssistantChat,
    getAssistantChatState,
    getAssistantChatState
  );
}

export function appendAssistantMsg(msg: Omit<ChatMsg, 'id'>) {
  const full: ChatMsg = {
    ...msg,
    id: seq++,
    clientId: msg.clientId ?? newClientId(),
    createdAt: msg.createdAt ?? Date.now(),
  };
  if (full.clientId) sessionAppended.add(full.clientId);
  emit({ ...state, messages: [...state.messages, full] });
  // Ghi lên server ngay (fire-and-forget, không chặn khung chat);
  // lỗi thì xếp vào outbox để lần đồng bộ sau đẩy lại.
  if (syncTeacherId && isSupabaseReady()) {
    const tid = syncTeacherId;
    void (async () => {
      try {
        await upsertAssistantChatMessages(tid, [full]);
        if (state.messages.length >= MAX_STORED) {
          await pruneAssistantChatHistory(tid, CHAT_HISTORY_MAX);
        }
      } catch {
        const rest = loadOutbox().filter(
          (it) => !(it.teacherId === tid && it.msg.clientId === full.clientId)
        );
        saveOutbox([...rest, { teacherId: tid, msg: full }]);
      }
    })();
  }
}

export function setAssistantBusy(busy: boolean) {
  if (state.busy !== busy) emit({ ...state, busy });
}

export function clearAssistantChat() {
  emit({ messages: [], busy: false });
  try {
    localStorage.removeItem(OUTBOX_KEY);
  } catch {
    /* bỏ qua */
  }
  // Xóa cả trên server để mọi trình duyệt cùng trống. Lỗi thì
  // server vẫn giữ — lần đồng bộ sau (server thắng) sẽ khôi phục
  // lại lịch sử, người dùng bấm xóa lại là xong.
  if (syncTeacherId && isSupabaseReady()) {
    const tid = syncTeacherId;
    void deleteAssistantChatHistory(tid).catch(() => {});
  }
}
