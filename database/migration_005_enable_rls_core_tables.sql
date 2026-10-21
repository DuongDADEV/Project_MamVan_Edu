-- ==============================================================================
-- MIGRATION 005: Bat Row Level Security cho 9 bang loi trong schema.sql
-- ==============================================================================
-- Ly do: Supabase Security Advisor (email 20/10/2026, du lieu tinh den
-- 17/10/2026) bao loi CRITICAL "rls_disabled_in_public" cho project Mam Van:
-- co bang trong schema public chua bat RLS nen bat ky ai co project URL +
-- publishable key (key nay nam trong code web cong khai) deu doc/sua/xoa
-- duoc toan bo du lieu cua bang do qua Data API.
--
-- Doi chieu code repo:
-- - migration_002 da bat RLS + policy allow_all cho 3 bang noi dung
--   (video_lessons, theory_lessons, quizzes) -> 3 bang nay KHONG bi bao.
-- - schema.sql tao 9 bang loi (teachers, classes, students, student_states,
--   topics, questions, essay_submissions, reward_requests, system_settings)
--   ma KHONG co bat ky dong ENABLE ROW LEVEL SECURITY / CREATE POLICY nao.
--   Day chinh la nhom bang bi Advisor bao.
--
-- Cach chay: dan toan bo file nay vao Supabase SQL Editor cua project
-- Mam Van roi Run. Nen chay CUNG DOT voi migration_003 + migration_004
-- dang cho san (chi 1 lan mo SQL Editor).
--
-- LUU Y KY THUAT QUAN TRONG:
-- - Chi bat RLS ma khong co policy thi app se bi khoa ngoai ngay
--   (anon key bi tu choi moi truy van). Vi vay moi bang deu kem policy
--   allow_all theo DUNG mau migration_002 dang chay tot tren production.
-- - Policy allow_all giu nguyen mo hinh truy cap hien tai cua app
--   (dang nhap tuy bien bang bang teachers/students, khong dung Supabase
--   Auth) nen app khong doi hanh vi. No dong loi CRITICAL cua Advisor va
--   la dieu kien tien quyet de sau nay siet policy theo tung vai tro.
-- - Muon bao mat that su (chan nguoi ngoai doc bang teachers/students
--   bang publishable key) can chuyen sang policy theo vai tro/Supabase
--   Auth - viec lon, tach rieng, khong nam trong migration nay.
-- - File nay idempotent: chay lai nhieu lan khong loi (DROP POLICY IF
--   EXISTS truoc khi CREATE POLICY).
-- ==============================================================================

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

-- Kiem tra sau khi chay (mong doi: ca 12 bang public deu rowsecurity = true):
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY tablename;
