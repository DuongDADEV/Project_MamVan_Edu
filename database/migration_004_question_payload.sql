-- Migration 004: Lưu toàn bộ đối tượng câu hỏi vào cột payload (jsonb) của bảng questions.
-- Lý do: bảng questions chỉ có các cột cơ bản (prompt/options/correct_answer/explanation...)
-- nên các trường như passage (ngữ liệu), allowPartialCredit, points, status, class_ids,
-- isTeacherReviewed... bị mất mỗi khi đồng bộ qua Supabase. Cột payload giữ bản đầy đủ
-- giống cách migration_002 đã làm cho video/theory/quiz.
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor.
-- (Nếu chưa chạy migration này, app vẫn hoạt động với dữ liệu cột cơ bản như trước.)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS payload jsonb;
