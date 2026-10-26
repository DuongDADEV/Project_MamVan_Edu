-- ============================================================
-- MAM VAN - GRANT TEMPLATE (chuan bi cho thay doi Supabase 30/10/2026)
-- ============================================================
-- Tu 30/10/2026, Supabase KHONG con tu dong cap quyen Data API cho bang MOI
-- trong schema "public" (thong bao "Final notice" gui 20/10/2026).
-- Bang cu GIU NGUYEN quyen hien tai - file nay chi can khi:
--   (a) tao bang public MOI sau 30/10/2026, hoac
--   (b) chay lai toan bo schema.sql (db reset / dung lai project / preview branch)
-- Thieu GRANT thi supabase-js/PostgREST tra loi "permission denied" du RLS
-- policy da co. App Mam Van truy cap bang anon key tu trinh duyet nen can
-- cap cho ca anon + authenticated (+ service_role cho script quan tri).
--
-- Cach dung cho bang moi: copy khoi duoi, thay <ten_bang>, chay CUNG luc
-- voi lenh CREATE TABLE trong cung 1 migration, kem RLS + policy nhu
-- migration_002 da lam.

-- === MAU CHO 1 BANG MOI ===
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.<ten_bang> TO anon;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.<ten_bang> TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.<ten_bang> TO service_role;
-- ALTER TABLE public.<ten_bang> ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow_all_<ten_bang>" ON public.<ten_bang>
--   FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- KHOI FULL: cap quyen cho toan bo 12 bang public hien co cua du an
-- (chi chay khi dung lai schema tu dau sau 30/10/2026; chay lai tren
-- project dang song cung vo hai vi GRANT la idempotent)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.teachers,
  public.classes,
  public.students,
  public.student_states,
  public.topics,
  public.questions,
  public.essay_submissions,
  public.reward_requests,
  public.system_settings,
  public.video_lessons,
  public.theory_lessons,
  public.quizzes
TO anon, authenticated, service_role;
