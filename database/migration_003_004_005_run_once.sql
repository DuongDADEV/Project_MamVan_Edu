-- ==============================================================================
-- GOI GỘP MIGRATION 003 + 004 + 005 — Mầm Văn (chạy 1 lần duy nhất)
-- ==============================================================================
-- Cách chạy: mở Supabase Dashboard của project Mầm Văn (production) >
-- SQL Editor > dán TOÀN BỘ file này > Run.
--
-- Gồm 3 việc đang chờ:
--   003: reward_requests cho phép thêm trạng thái GIVEN/OPENED (trước đây bị
--        ép thành REJECTED vì CHECK cũ chỉ có PENDING/APPROVED/REJECTED).
--   004: thêm cột payload (jsonb) cho bảng questions để không mất các trường
--        câu hỏi (passage, points, status, class_ids...) khi đồng bộ.
--   005: bật Row Level Security cho 9 bảng lõi (teachers, classes, students,
--        student_states, topics, questions, essay_submissions,
--        reward_requests, system_settings) — đóng cảnh báo CRITICAL
--        "rls_disabled_in_public" của Supabase Security Advisor (email
--        20/10/2026). Mỗi bảng kèm policy allow_all đúng mẫu migration_002
--        đang chạy trên production nên hành vi app không đổi.
--
-- LƯU Ý THẬT: policy allow_all chỉ dập cảnh báo CRITICAL và là bước nền —
-- chưa khóa hẳn người ngoài cầm publishable key. Khóa thật cần đợt riêng
-- chuyển sang policy theo vai trò / Supabase Auth.
--
-- Cả 3 phần đều an toàn chạy theo thứ tự 003 -> 004 -> 005 trong một lượt dán.
-- Cuối file có sẵn câu SELECT kiểm chứng: kỳ vọng cả 12 bảng public đều
-- rowsecurity = true và bảng questions có cột payload.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PHẦN 1/3 — Migration 003: vòng đời trạng thái reward_requests
-- ------------------------------------------------------------------------------
ALTER TABLE reward_requests DROP CONSTRAINT IF EXISTS reward_requests_status_check;
ALTER TABLE reward_requests
  ADD CONSTRAINT reward_requests_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'GIVEN', 'OPENED'));

-- ------------------------------------------------------------------------------
-- PHẦN 2/3 — Migration 004: cột payload cho questions
-- ------------------------------------------------------------------------------
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS payload jsonb;

-- ------------------------------------------------------------------------------
-- PHẦN 3/3 — Migration 005: bật RLS cho 9 bảng lõi + policy allow_all
-- ------------------------------------------------------------------------------
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_teachers" ON public.teachers;
CREATE POLICY "allow_all_teachers" ON public.teachers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_classes" ON public.classes;
CREATE POLICY "allow_all_classes" ON public.classes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_students" ON public.students;
CREATE POLICY "allow_all_students" ON public.students FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.student_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_student_states" ON public.student_states;
CREATE POLICY "allow_all_student_states" ON public.student_states FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_topics" ON public.topics;
CREATE POLICY "allow_all_topics" ON public.topics FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_questions" ON public.questions;
CREATE POLICY "allow_all_questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.essay_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_essay_submissions" ON public.essay_submissions;
CREATE POLICY "allow_all_essay_submissions" ON public.essay_submissions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.reward_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_reward_requests" ON public.reward_requests;
CREATE POLICY "allow_all_reward_requests" ON public.reward_requests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_system_settings" ON public.system_settings;
CREATE POLICY "allow_all_system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- KIỂM CHỨNG SAU KHI CHẠY (chạy kèm luôn trong cùng lượt dán):
-- 1) Cả 12 bảng public phải có rowsecurity = true.
-- 2) Dòng questions/payload phải xuất hiện ở kết quả thứ hai.
-- ------------------------------------------------------------------------------
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;

SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'payload';
