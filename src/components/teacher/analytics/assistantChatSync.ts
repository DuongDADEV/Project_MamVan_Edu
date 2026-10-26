// Hàm thuần cho đồng bộ lịch sử chat trợ lý (đợt 4, 26/10):
// lịch sử chat trước đây chỉ ở localStorage nên đổi trình duyệt
// là mất. Từ đợt này server (bảng assistant_chat_messages) là
// nguồn thật duy nhất khi đọc thành công; local chỉ còn là
// fallback khi lỗi/mất mạng — đúng luật server-thật đợt 3.
//
// Module này KHÔNG chạm localStorage hay Supabase để test được
// thuần logic (xem scripts/test_assistant_chat_sync.ts).
import type { ChatMsg } from './assistantChatStore.ts';
import type {
  AssistantChart,
  AssistantToolRun,
} from '../../../services/ai/analyticsAssistant.ts';

/** Số tin tối đa giữ lại — khớp MAX_STORED trong store. */
export const CHAT_HISTORY_MAX = 80;

/**
 * Hàng tin phía server (dạng đã map từ DB, chưa có id số local).
 * id số chỉ là React key trong phiên — store gán lại 1..N khi
 * nạp từ server, còn client_id mới là danh tính cross-device.
 */
export interface ServerChatMsg {
  clientId: string;
  role: 'user' | 'assistant';
  text: string;
  toolRuns?: AssistantToolRun[];
  chart?: AssistantChart;
  followups?: string[];
  isError?: boolean;
  createdAt: number;
}

// FNV-1a 32-bit — đủ để gán id legacy xác định, không cần crypto.
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Gán clientId cho tin chưa có (tin legacy trước deploy).
 * Xác định theo (vị trí, role, text) nên cùng một mảng local
 * luôn cho cùng một bộ id — 2 trình duyệt có mảng legacy khác
 * nhau (vị trí khác nhau) sẽ không tự sập trùng nhau, trừ khi
 * 2 mảng legacy giống hệt nhau từng tin (khi đó gộp 1 là đúng).
 */
export function normalizeChatHistory(msgs: ChatMsg[]): ChatMsg[] {
  return msgs.map((m, i) => {
    if (m.clientId) return m;
    return {
      ...m,
      clientId: `legacy-${i}-${fnv1a(`${m.role}\n${m.text}`)}`,
    };
  });
}

/** Giữ tối đa CHAT_HISTORY_MAX tin mới nhất (theo thứ tự mảng). */
export function capChatHistory(msgs: ChatMsg[]): ChatMsg[] {
  return msgs.length > CHAT_HISTORY_MAX
    ? msgs.slice(msgs.length - CHAT_HISTORY_MAX)
    : msgs;
}

/**
 * Gộp lịch sử server + local thành một danh sách duy nhất:
 * - Tin đã có trên server giữ nguyên thứ tự server.
 * - Tin chỉ-có-ở-local (chưa đồng bộ) nối thêm cuối, theo thứ
 *   tự local — đây là đường đẩy lịch sử cũ lên server ở lần
 *   đồng bộ đầu tiên, và cũng là đường cứu tin gửi khi mất mạng
 *   (qua outbox) ở các lần sau.
 * - Trùng clientId chỉ giữ 1 (bản server thắng khi xung đột).
 * - Kết quả luôn cap 80 — NHƯNG đợt 4b: cap KHÔNG BAO GIỜ
 *   cắt dòng server để chừa chỗ cho tin local. Lần first-sync
 *   của đợt 4 cắt đúng dòng server có trước (server 2 dòng +
 *   legacy 115 dòng → cap giữ 80 cuối, 2 dòng server rớt khỏi
 *   danh sách, rồi prune xóa chúng khỏi DB vì legacy mang
 *   created_at giờ sync nên xếp mới hơn). Luật mới: server
 *   < 80 thì giữ toàn bộ server + tin local mới nhất vừa đủ
 *   80 (phần cắt là legacy cũ nhất); server đã ≥ 80 thì giữ
 *   tin local mới nhất + dòng server mới nhất vừa đủ 80
 *   (chỉ cắt khỏi DANH SÁCH hiển thị, không xóa DB).
 */
export function mergeChatHistories(
  server: ChatMsg[],
  local: ChatMsg[]
): ChatMsg[] {
  const seen = new Set<string>();
  const serverRows: ChatMsg[] = [];
  for (const m of server) {
    const key = m.clientId ?? '';
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    serverRows.push(m);
  }
  const localOnly: ChatMsg[] = [];
  for (const m of normalizeChatHistory(local)) {
    const key = m.clientId ?? '';
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    localOnly.push(m);
  }
  if (serverRows.length + localOnly.length <= CHAT_HISTORY_MAX) {
    return [...serverRows, ...localOnly];
  }
  if (serverRows.length < CHAT_HISTORY_MAX) {
    return [
      ...serverRows,
      ...localOnly.slice(-(CHAT_HISTORY_MAX - serverRows.length)),
    ];
  }
  // Server một mình đã ≥ cap (tạm thời, do prune chưa chạy):
  // giữ tin local mới nhất + dòng server mới nhất vừa đủ 80.
  const tail = localOnly.slice(-CHAT_HISTORY_MAX);
  return [...serverRows.slice(-(CHAT_HISTORY_MAX - tail.length)), ...tail];
}

/**
 * Gán createdAt cho tin legacy chưa có timestamp (đợt 4b):
 * tin legacy ra đời TRƯỚC tính năng đồng bộ nên chắc chắn cũ
 * hơn mọi dòng đã có trên server — xếp chúng ngay trước dòng
 * server sớm nhất, giữ nguyên thứ tự mảng (mỗi tin lệch nhau
 * 1ms). Không có dòng server nào thì lấy giờ hiện tại làm mốc
 * (thứ tự mảng vẫn giữ). Tin đã có createdAt giữ nguyên.
 * Nhờ vậy prune oldest-first (created_at rồi seq) sẽ cắt
 * legacy cũ nhất trước, không bao giờ cắt dòng server có trước
 * để chừa chỗ cho legacy — lỗi đợt 4 là legacy mang created_at
 * giờ sync (mới nhất) nên prune cắt dòng server trước.
 */
export function stampLegacyBeforeServer(
  msgs: ChatMsg[],
  earliestServerAt?: number
): ChatMsg[] {
  const base =
    earliestServerAt != null && Number.isFinite(earliestServerAt)
      ? earliestServerAt
      : Date.now();
  const unstamped = msgs.filter((m) => m.createdAt == null).length;
  let i = 0;
  return msgs.map((m) =>
    m.createdAt != null
      ? m
      : { ...m, createdAt: base - (unstamped - i++) }
  );
}

/** Map tin local sang hàng insert DB (bỏ id số — DB tự sinh). */
export function toServerInsert(
  m: ChatMsg,
  teacherId: string
): Record<string, unknown> {
  return {
    teacher_id: teacherId,
    client_id: m.clientId ?? '',
    role: m.role,
    text: m.text,
    tool_runs: m.toolRuns ?? [],
    chart: m.chart ?? null,
    followups: m.followups ?? [],
    is_error: m.isError ?? false,
    ...(m.createdAt ? { created_at: new Date(m.createdAt).toISOString() } : {}),
  };
}

/** Map hàng DB sang tin local (id số = 0, store gán lại khi nạp). */
export function fromServerRow(row: {
  client_id: string;
  role: string;
  text: string;
  tool_runs?: unknown;
  chart?: unknown;
  followups?: unknown;
  is_error?: boolean;
  created_at?: string;
}): ChatMsg {
  return {
    id: 0,
    clientId: row.client_id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    text: typeof row.text === 'string' ? row.text : '',
    toolRuns: Array.isArray(row.tool_runs)
      ? (row.tool_runs as AssistantToolRun[])
      : undefined,
    chart: (row.chart ?? undefined) as AssistantChart | undefined,
    followups: Array.isArray(row.followups)
      ? (row.followups as string[])
      : undefined,
    isError: row.is_error ?? false,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
  };
}
