-- ============================================================
-- Migration 007 — Tách dữ liệu RIÊNG theo giáo viên (teacher isolation)
-- ------------------------------------------------------------
-- Bối cảnh: trước đây nội dung học liệu (chủ đề, video, lý thuyết,
-- bài kiểm tra, câu hỏi) không gắn chủ sở hữu khi đọc/ghi — mọi
-- giáo viên thấy và dùng chung dữ liệu của nhau. Đợt này bổ sung
-- cột teacher_id cho các bảng nội dung chưa có, và gán nội dung
-- cũ chưa có chủ về giáo viên chính (gv004 — tài khoản active lâu
-- năm, chủ nhiệm lớp 7a1). Tầng ứng dụng (cùng đợt) sẽ: ghi
-- teacher_id khi tạo/sửa, lọc mọi truy vấn đọc theo giáo viên của
-- phiên đăng nhập, gắn cache local theo tài khoản, dọn cache khi
-- đăng xuất. Chạy độc lập với các migration khác; idempotent.
-- ============================================================

ALTER TABLE public.video_lessons  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.theory_lessons ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.quizzes         ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.questions      ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_topics_teacher_id         ON public.topics(teacher_id);
CREATE INDEX IF NOT EXISTS idx_questions_teacher_id      ON public.questions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_video_lessons_teacher_id  ON public.video_lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_theory_lessons_teacher_id ON public.theory_lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_teacher_id        ON public.quizzes(teacher_id);

-- Backfill nội dung chưa có chủ → giáo viên chính gv004
UPDATE public.topics
SET teacher_id = 'd47261be-b00b-452f-93bb-222e844def70'
WHERE teacher_id IS NULL;

UPDATE public.questions q
SET teacher_id = COALESCE((SELECT t.teacher_id FROM public.topics t WHERE t.id = q.topic_id),
                          'd47261be-b00b-452f-93bb-222e844def70')
WHERE q.teacher_id IS NULL;

UPDATE public.video_lessons v
SET teacher_id = COALESCE((SELECT t.teacher_id FROM public.topics t WHERE t.id = v.topic_id),
                          'd47261be-b00b-452f-93bb-222e844def70')
WHERE v.teacher_id IS NULL;

UPDATE public.theory_lessons v
SET teacher_id = COALESCE((SELECT t.teacher_id FROM public.topics t WHERE t.id = v.topic_id),
                          'd47261be-b00b-452f-93bb-222e844def70')
WHERE v.teacher_id IS NULL;

UPDATE public.quizzes v
SET teacher_id = COALESCE((SELECT t.teacher_id FROM public.topics t WHERE t.id = v.topic_id),
                          'd47261be-b00b-452f-93bb-222e844def70')
WHERE v.teacher_id IS NULL;

-- Đồng bộ teacher_id vào payload JSONB (đối tượng nội dung mang theo chủ của nó)
UPDATE public.video_lessons  SET payload = payload || jsonb_build_object('teacher_id', teacher_id) WHERE teacher_id IS NOT NULL;
UPDATE public.theory_lessons SET payload = payload || jsonb_build_object('teacher_id', teacher_id) WHERE teacher_id IS NOT NULL;
UPDATE public.quizzes         SET payload = payload || jsonb_build_object('teacher_id', teacher_id) WHERE teacher_id IS NOT NULL;

-- Kiểm chứng: mọi cột "con_thieu" phải bằng 0
SELECT 'topics' AS bang, count(*) FILTER (WHERE teacher_id IS NULL) AS con_thieu FROM public.topics
UNION ALL SELECT 'questions',     count(*) FILTER (WHERE teacher_id IS NULL) FROM public.questions
UNION ALL SELECT 'video_lessons', count(*) FILTER (WHERE teacher_id IS NULL) FROM public.video_lessons
UNION ALL SELECT 'theory_lessons',count(*) FILTER (WHERE teacher_id IS NULL) FROM public.theory_lessons
UNION ALL SELECT 'quizzes',       count(*) FILTER (WHERE teacher_id IS NULL) FROM public.quizzes;
