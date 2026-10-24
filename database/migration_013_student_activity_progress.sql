-- ==============================================================================
-- MIGRATION 013: Bang tien do buoc hoc (student_activity_progress)
-- ==============================================================================
-- Van de: file Power BI Dashboard_MamVan__1.pbix co bang tien do buoc hoc
-- (student_activity_progress: 160 dong mau) nhung Supabase cua app CHUA
-- BAO GIO co bang nay, nen bieu do "Tien do hoc theo luong" tren tab Tong
-- quan luon trong. Migration nay tao bang that de du lieu tien do co noi
-- luu dung dinh dang pbix.
--
-- Grain (1 dong = 1 hoc sinh x 1 hoat dong): khoa chinh (student_id,
-- activity_id) de backfill chay lai nhieu lan khong trung lap (upsert theo
-- khoa). topic_id du thua de loc theo chu de ma khong can join.
-- progress_status: 'COMPLETED' (hien chi nap hang hoan thanh; cac trang
-- thai khac them sau khi co writer truc tiep).
-- completed_at: lan nop gan nhat cua hoc sinh cho hoat dong do (lay tu
-- attempts.submitted_at); NULL neu khong xac dinh duoc tu du lieu cu.
--
-- BACKFILL DI KEM (25/10, chay 1 lan sau migration, script tam khong
-- commit): chi nap duoc hang hoan thanh HOAT DONG QUIZ (PRACTICE / TEST /
-- TEST_1 / TEST_2) tu attempt_answers — quy tac giong isQuizAllCorrect cua
-- app: moi cau cham tu dong phai co it nhat 1 lan tra loi dung hoan toan
-- (is_correct hoac score_awarded >= max_score voi max_score > 0); cau tu
-- luan khong chan; hoat dong khong co cau cham tu dong thi tinh la xong
-- neu hoc sinh da lam (co cau tra loi). VIDEO / DETAILED_THEORY /
-- KEY_POINTS KHONG co hang backfill vi Supabase khong co tin hieu hoan
-- thanh buoc do (trang thai xem video / doc ly thuyet chi nam trong
-- localStorage states, khong join duoc voi learning_activities) — KHONG
-- bia hang cho cac loai nay.
--
-- LUU Y QUAN TRONG: bang chu de tren tab Tong quan (25/10) KHONG doc bang
-- nay — no tinh truc tiep tu states qua isTopicFullyComplete (dinh nghia
-- hoan thanh chu de cua app) de luon tuoi. Bang nay hien la kho luu tru
-- dung dinh dang pbix, cho buoc ghi truc tiep sau nay (khi app ghi
-- progress moi luc hoc sinh xong buoc, bang moi co du lieu video/ly
-- thuyet that).
--
-- - RLS allow_all theo DUNG mau migration_002/005/012 dang chay tot tren
--   production: chi de het bao Security Advisor, CHUA phai khoa that.
--   Khoa that theo vai tro can vong rieng sau, kem Supabase Auth - khong
--   nam trong migration nay.
-- - File idempotent: chay lai nhieu lan khong loi.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_activity_progress (
  student_id text NOT NULL,
  activity_id text NOT NULL,
  topic_id text,
  progress_status text NOT NULL DEFAULT 'COMPLETED',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, activity_id)
);

-- Phong truong hop bang da ton tai tu lan chay do dang truoc do:
ALTER TABLE public.student_activity_progress ADD COLUMN IF NOT EXISTS topic_id text;
ALTER TABLE public.student_activity_progress ADD COLUMN IF NOT EXISTS progress_status text;
ALTER TABLE public.student_activity_progress ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.student_activity_progress ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.student_activity_progress ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- RLS + policy allow_all (mau migration_002/005/012; xem luu y khoa that o tren).
ALTER TABLE public.student_activity_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_student_activity_progress" ON public.student_activity_progress;
CREATE POLICY "allow_all_student_activity_progress" ON public.student_activity_progress FOR ALL USING (true) WITH CHECK (true);
