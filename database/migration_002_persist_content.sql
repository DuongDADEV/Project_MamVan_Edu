-- Migration 002: lưu video / lý thuyết / quiz / điểm danh vào Supabase (không chỉ localStorage)

-- 1. Bổ sung cột còn thiếu cho student_states (điểm danh, lịch sử làm bài...)
ALTER TABLE public.student_states
  ADD COLUMN IF NOT EXISTS attendance_days_this_week integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS question_results jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS flagged_topic_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_progress jsonb DEFAULT '{}'::jsonb;

-- 2. Bảng nội dung học tập: mỗi dòng lưu cả đối tượng trong payload (jsonb)
CREATE TABLE IF NOT EXISTS public.video_lessons (
  id text PRIMARY KEY,
  topic_id text,
  status text NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.theory_lessons (LIKE public.video_lessons INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.quizzes (LIKE public.video_lessons INCLUDING ALL);

ALTER TABLE public.video_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theory_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_video_lessons" ON public.video_lessons;
DROP POLICY IF EXISTS "allow_all_theory_lessons" ON public.theory_lessons;
DROP POLICY IF EXISTS "allow_all_quizzes" ON public.quizzes;
CREATE POLICY "allow_all_video_lessons" ON public.video_lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_theory_lessons" ON public.theory_lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_quizzes" ON public.quizzes FOR ALL USING (true) WITH CHECK (true);

-- 3. Storage bucket chứa file video / ảnh bìa
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('lesson-media', 'lesson-media', true, 524288000)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 524288000;

DROP POLICY IF EXISTS "lesson_media_read" ON storage.objects;
DROP POLICY IF EXISTS "lesson_media_write" ON storage.objects;
CREATE POLICY "lesson_media_read" ON storage.objects FOR SELECT USING (bucket_id = 'lesson-media');
CREATE POLICY "lesson_media_write" ON storage.objects FOR ALL USING (bucket_id = 'lesson-media') WITH CHECK (bucket_id = 'lesson-media');

NOTIFY pgrst, 'reload schema';
