/**
 * Repository lịch sử chat trợ lý qua API VPS (GĐ3) — thay
 * assistantChatRepository.ts (Supabase trực tiếp, bảng
 * assistant_chat_messages).
 *
 * Cùng 4 hàm, cùng chữ ký để assistantChatStore dùng lại không đổi:
 * - fetchAssistantChatHistory(teacherId): GET /api/chat/history
 * - upsertAssistantChatMessages(teacherId, msgs): POST /api/chat/messages
 *   (upsert batch theo (teacher_id, client_id), trùng là no-op)
 * - deleteAssistantChatHistory(teacherId): DELETE /api/chat/history
 * - pruneAssistantChatHistory(teacherId, keep): POST /api/chat/prune
 *
 * Luật client GIỮ NGUYÊN (teacherScope.ts, không sửa file đó):
 * - isOwnChatCache strict: store chỉ gộp/hiện cache local khi localStorage
 *   đã ghi nhận ĐÚNG giáo viên đó; null hoặc người khác → bỏ hẳn, không
 *   hiển thị, không upload (luật này sống ở store, client này chỉ gọi API).
 * - Tin chat tạo mới luôn có text (kể cả rỗng — khảo sát §5: cột text
 *   không còn default '' trên MySQL nên không được insert thiếu trường).
 * - teacher_id không gửi từ client — server ép từ JWT; teacherId trong
 *   chữ ký chỉ còn để store đối chiếu phạm vi, không đưa vào body.
 * - Mọi hàm ném lỗi khi API lỗi (store bắt và rơi về localStorage fallback
 *   như cũ — đúng luật server-thật: local chỉ là fallback khi lỗi).
 */
import { apiFetch } from './http.ts';
import type { ChatMsg } from '../../components/teacher/analytics/assistantChatStore.ts';
import {
  CHAT_HISTORY_MAX,
  fromServerRow,
  toServerInsert,
} from '../../components/teacher/analytics/assistantChatSync.ts';

function unwrap(data: any): any {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray((data as any).data)) return (data as any).data;
    if (Array.isArray((data as any).messages)) return (data as any).messages;
    if (Array.isArray((data as any).history)) return (data as any).history;
    if ((data as any).data && typeof (data as any).data === 'object') return (data as any).data;
  }
  return data;
}

/** Đọc toàn bộ lịch sử của giáo viên, xếp theo thời gian gửi. */
export async function fetchAssistantChatHistory(
  _teacherId: string
): Promise<ChatMsg[]> {
  const rows = unwrap(await apiFetch('/api/chat/history'));
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row: any) => {
    // Server có thể trả row DB (snake_case) hoặc tin app-shape đã map.
    if (row && typeof row === 'object' && 'client_id' in row) return fromServerRow(row);
    return {
      id: 0,
      clientId: row.clientId ?? row.client_id ?? '',
      role: row.role === 'assistant' ? 'assistant' : 'user',
      text: typeof row.text === 'string' ? row.text : '',
      toolRuns: row.toolRuns ?? row.tool_runs,
      chart: row.chart ?? undefined,
      followups: row.followups ?? undefined,
      isError: row.isError ?? row.is_error ?? false,
      createdAt: row.createdAt ?? (row.created_at ? new Date(row.created_at).getTime() : undefined),
    } as ChatMsg;
  });
}

/**
 * Chèn (hoặc cập nhật nếu trùng) các tin theo cặp (teacher_id, client_id).
 * Server ép teacher_id từ JWT nên body chỉ mang danh sách tin (đã bỏ
 * teacher_id khỏi toServerInsert) + text luôn có (kể cả rỗng).
 */
export async function upsertAssistantChatMessages(
  _teacherId: string,
  msgs: ChatMsg[]
): Promise<void> {
  const rows = msgs
    .filter((m) => m.clientId)
    .map((m) => {
      const row = toServerInsert(m, '');
      delete (row as any).teacher_id;
      // Khảo sát §5: text không còn default '' — luôn gửi, kể cả rỗng.
      if (typeof row.text !== 'string') row.text = '';
      return row;
    });
  if (rows.length === 0) return;
  await apiFetch('/api/chat/messages', { method: 'POST', body: JSON.stringify({ messages: rows }) });
}

/** Xóa toàn bộ lịch sử của giáo viên (nút xóa 2 chạm). */
export async function deleteAssistantChatHistory(
  _teacherId: string
): Promise<void> {
  await apiFetch('/api/chat/history', { method: 'DELETE' });
}

/**
 * Giữ tối đa keep tin mới nhất: server xóa các dòng cũ nhất vượt cap
 * (xếp theo created_at rồi seq).
 */
export async function pruneAssistantChatHistory(
  _teacherId: string,
  keep: number = CHAT_HISTORY_MAX
): Promise<void> {
  await apiFetch('/api/chat/prune', { method: 'POST', body: JSON.stringify({ keep }) });
}
