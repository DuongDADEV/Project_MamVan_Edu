-- Migration 011: xóa mềm cho chủ đề. Trước đây deleteTopic xóa cứng dòng trên
-- Supabase nhưng các trình duyệt khác (hoặc chính bộ đệm payload của máy này)
-- còn giữ chủ đề trong bộ đệm và cơ chế "chủ đề chỉ có ở máy này -> tự đẩy
-- lên" của getTopics sẽ đẩy hồi sinh nó. Nay xóa = đóng dấu deleted_at;
-- getTopics loại các dòng đã đóng dấu khỏi mọi thiết bị và không hồi sinh.
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
