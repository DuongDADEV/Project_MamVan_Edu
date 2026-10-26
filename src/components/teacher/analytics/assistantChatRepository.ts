// Repository lịch sử chat trợ lý (đợt 4, 26/10): đọc/ghi bảng
// assistant_chat_messages (migration 018) qua Supabase client
// dùng chung. RLS ở tầng DB đã chặn: giáo viên chỉ thấy dòng
// có teacher_id = my_teacher_id(), admin theo policy admin_all,
// anon/student không có policy → không đọc/ghi được.
// Mọi hàm ném lỗi khi Supabase lỗi — store bắt và rơi về
// localStorage fallback (đúng luật server-thật: local chỉ là
// fallback khi lỗi, không gộp/đè lên dữ liệu server).
import { supabase, isSupabaseReady } from '../../../services/supabase/client.ts';
import type { ChatMsg } from './assistantChatStore.ts';
import {
  CHAT_HISTORY_MAX,
  fromServerRow,
  toServerInsert,
} from './assistantChatSync.ts';

const TABLE = 'assistant_chat_messages';

function assertReady(): void {
  if (!isSupabaseReady()) throw new Error('Supabase chưa sẵn sàng');
}

/** Đọc toàn bộ lịch sử của giáo viên, xếp theo thời gian gửi. */
export async function fetchAssistantChatHistory(
  teacherId: string
): Promise<ChatMsg[]> {
  assertReady();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: true })
    .order('seq', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => fromServerRow(row));
}

/**
 * Chèn (hoặc cập nhật nếu trùng) các tin theo cặp
 * (teacher_id, client_id) — chèn trùng là no-op nên 2 trình
 * duyệt append đồng thời không ghi đè nhau, và đồng bộ lại
 * cùng một tin không tạo trùng.
 */
export async function upsertAssistantChatMessages(
  teacherId: string,
  msgs: ChatMsg[]
): Promise<void> {
  assertReady();
  const rows = msgs
    .filter((m) => m.clientId)
    .map((m) => toServerInsert(m, teacherId));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'teacher_id,client_id' });
  if (error) throw new Error(error.message);
}

/** Xóa toàn bộ lịch sử của giáo viên (nút xóa 2 chạm). */
export async function deleteAssistantChatHistory(
  teacherId: string
): Promise<void> {
  assertReady();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('teacher_id', teacherId);
  if (error) throw new Error(error.message);
}

/**
 * Giữ tối đa CHAT_HISTORY_MAX tin mới nhất: xóa các dòng cũ
 * nhất vượt cap (xếp theo created_at rồi seq).
 */
export async function pruneAssistantChatHistory(
  teacherId: string,
  keep: number = CHAT_HISTORY_MAX
): Promise<void> {
  assertReady();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .order('seq', { ascending: false });
  if (error) throw new Error(error.message);
  const excess = (data ?? []).slice(keep);
  if (excess.length === 0) return;
  const { error: delError } = await supabase
    .from(TABLE)
    .delete()
    .in(
      'id',
      excess.map((r) => r.id)
    );
  if (delError) throw new Error(delError.message);
}
