-- ============================================================
-- Migration 018 — bảng assistant_chat_messages: lịch sử chat
-- trợ lý phân tích AI đồng bộ cross-device theo giáo viên
-- ------------------------------------------------------------
-- Bối cảnh (26/10, user hỏi "tin nhắn giữa giáo viên với AI
-- vẫn chưa đồng bộ, nó có lưu vào database không"):
-- lịch sử chat trước đây CHỈ nằm ở localStorage khóa
-- mam_van_assistant_chat_v1 (tối đa 80 tin) — đổi trình duyệt
-- hoặc thiết bị là mất lịch sử cũ. Từ đợt này mỗi tin nhắn
-- là 1 dòng DB, giáo viên nào cũng đọc/ghi được lịch sử của
-- chính mình từ mọi trình duyệt (RLS theo my_teacher_id()).
--
-- Thiết kế (khớp pattern repo nhất):
-- - 1 dòng / tin nhắn (không gom JSON theo giáo viên như
--   student_states) để 2 trình duyệt append đồng thời không
--   ghi đè nhau: mỗi tin có client_id duy nhất theo giáo viên,
--   upsert theo UNIQUE (teacher_id, client_id) nên chèn trùng
--   là no-op, không mất tin.
-- - client_id: uuid do client sinh khi gửi (tin cũ trước deploy
--   chưa có client_id sẽ được gán id legacy xác định khi đồng
--   bộ lần đầu — xem assistantChatSync.ts).
-- - created_at: thời điểm gửi (client gửi kèm; tin legacy lấy
--   now() lúc upsert). seq (IDENTITY) chỉ để sắp xếp ổn định
--   khi created_at trùng nhau.
-- - Cap 80 tin mới nhất: client cắt khi đọc + prune khi ghi
--   (không trigger DB — giữ migration thuần DDL + RLS).
-- - RLS: teacher_own_* (pattern migration 015) + admin_all.
--   Không policy cho anon/student → không đọc/ghi được.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.assistant_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  text text NOT NULL DEFAULT '',
  tool_runs jsonb NOT NULL DEFAULT '[]'::jsonb,
  chart jsonb,
  followups jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_error boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  seq bigint GENERATED ALWAYS AS IDENTITY,
  UNIQUE (teacher_id, client_id)
);

CREATE INDEX IF NOT EXISTS assistant_chat_messages_teacher_time_idx
  ON public.assistant_chat_messages (teacher_id, created_at, seq);

ALTER TABLE public.assistant_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_own_assistant_chat" ON public.assistant_chat_messages;
CREATE POLICY "teacher_own_assistant_chat" ON public.assistant_chat_messages FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());

DROP POLICY IF EXISTS "admin_all" ON public.assistant_chat_messages;
CREATE POLICY "admin_all" ON public.assistant_chat_messages FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
