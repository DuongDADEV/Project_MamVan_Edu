-- ============================================================
-- Migration 008 — Bổ sung mô hình dữ liệu cho dữ liệu giả lập Power BI
-- ------------------------------------------------------------
-- Thêm các bảng mà hệ thống hiện chưa có (luồng học, bài độc lập,
-- giao bài theo từng học sinh, lượt làm bài, câu trả lời, phiếu
-- chấm, phiên đăng nhập, bảng ngày) và các cột còn thiếu ở
-- questions/topics — để nạp trọn vẹn file
-- MamVan_DuLieu_GiaLap_10HocSinh_v3-2.xlsx.
-- Quy ước giữ nguyên của hệ thống: khóa text cho nội dung
-- (topic_..., q01, act_..., asg_...), UUID cho người dùng.
-- Loại câu hỏi giữ ĐÚNG 4 dạng của hệ thống (single_choice /
-- multiple_choice / fill_in_blank / essay) — SHORT_ANSWER trong
-- file Excel được gộp vào essay khi nạp.
-- RLS theo đúng mẫu hiện hành (bật + policy mở cho anon/authenticated,
-- tách dữ liệu theo giáo viên thực thi ở tầng ứng dụng — migration_007).
-- Idempotent: chạy lại không lỗi.
-- ============================================================

-- ---------- Cột bổ sung ----------
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS max_score numeric;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS grading_method varchar(20);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS difficulty varchar(10);
ALTER TABLE public.topics    ADD COLUMN IF NOT EXISTS subject varchar(100);
ALTER TABLE public.topics    ADD COLUMN IF NOT EXISTS grade varchar(50);

-- ---------- Bảng mới ----------
CREATE TABLE IF NOT EXISTS public.learning_activities (
  id text PRIMARY KEY,
  topic_id text REFERENCES public.topics(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  activity_type varchar(40) NOT NULL,
  title varchar(500) NOT NULL,
  flow_type varchar(20),
  sequence_no integer,
  required_for_flow boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_questions (
  activity_id text NOT NULL REFERENCES public.learning_activities(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position integer,
  points_override numeric,
  PRIMARY KEY (activity_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.assignments (
  id text PRIMARY KEY,
  title varchar(500) NOT NULL,
  activity_type varchar(60),
  display_location varchar(60),
  target_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  published_at timestamptz,
  due_at timestamptz,
  is_timed boolean DEFAULT false,
  time_limit_minutes integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assignment_questions (
  assignment_id text NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position integer,
  PRIMARY KEY (assignment_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.assignment_targets (
  target_id text PRIMARY KEY,
  assignment_id text NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assigned_at timestamptz,
  due_at timestamptz,
  submission_status varchar(30),
  first_submitted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.attempts (
  attempt_id text PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id text REFERENCES public.assignments(id) ON DELETE CASCADE,
  learning_activity_id text REFERENCES public.learning_activities(id) ON DELETE CASCADE,
  attempt_no integer,
  status varchar(40),
  submitted_at timestamptz,
  submitted_date date,
  score_awarded numeric,
  max_score numeric,
  grading_status varchar(40),
  grading_mode varchar(40),
  CONSTRAINT attempts_exactly_one_source CHECK ((assignment_id IS NOT NULL) <> (learning_activity_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.attempt_answers (
  answer_id text PRIMARY KEY,
  attempt_id text NOT NULL REFERENCES public.attempts(attempt_id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  response_json jsonb,
  is_correct boolean,
  score_awarded numeric,
  max_score numeric,
  grading_status varchar(40),
  grading_method varchar(20),
  response_time_seconds integer
);

CREATE TABLE IF NOT EXISTS public.answer_reviews (
  review_id text PRIMARY KEY,
  answer_id text NOT NULL REFERENCES public.attempt_answers(answer_id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  score_awarded numeric,
  review_status varchar(30),
  feedback text,
  rubric_scores jsonb,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_sessions (
  session_id text PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  login_at timestamptz,
  logout_at timestamptz,
  login_date date,
  session_duration_minutes integer,
  device_type varchar(30),
  session_status varchar(20)
);

CREATE TABLE IF NOT EXISTS public.dim_date (
  date date PRIMARY KEY,
  year integer,
  month_number integer,
  month_name varchar(20),
  year_month varchar(7),
  week_start date,
  day_of_week varchar(20),
  is_weekend boolean
);

-- ---------- Chỉ mục ----------
CREATE INDEX IF NOT EXISTS idx_attempts_student        ON public.attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_assignment     ON public.attempts(assignment_id);
CREATE INDEX IF NOT EXISTS idx_attempts_activity       ON public.attempts(learning_activity_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON public.attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answer_reviews_answer   ON public.answer_reviews(answer_id);
CREATE INDEX IF NOT EXISTS idx_targets_assignment      ON public.assignment_targets(assignment_id);
CREATE INDEX IF NOT EXISTS idx_targets_student         ON public.assignment_targets(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student        ON public.student_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_login_date     ON public.student_sessions(login_date);
CREATE INDEX IF NOT EXISTS idx_activities_topic        ON public.learning_activities(topic_id);

-- ---------- RLS + quyền (mẫu migration_005) ----------
ALTER TABLE public.learning_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_targets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_date             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all ON public.learning_activities;
CREATE POLICY allow_all ON public.learning_activities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.learning_activities TO anon, authenticated;
DROP POLICY IF EXISTS allow_all ON public.activity_questions;
CREATE POLICY allow_all ON public.activity_questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.activity_questions TO anon, authenticated;
DROP POLICY IF EXISTS allow_all ON public.assignments;
CREATE POLICY allow_all ON public.assignments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.assignments TO anon, authenticated;
DROP POLICY IF EXISTS allow_all ON public.assignment_questions;
CREATE POLICY allow_all ON public.assignment_questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.assignment_questions TO anon, authenticated;
DROP POLICY IF EXISTS allow_all ON public.assignment_targets;
CREATE POLICY allow_all ON public.assignment_targets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.assignment_targets TO anon, authenticated;
DROP POLICY IF EXISTS allow_all ON public.attempts;
CREATE POLICY allow_all ON public.attempts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.attempts TO anon, authenticated;
DROP POLICY IF EXISTS allow_all ON public.attempt_answers;
CREATE POLICY allow_all ON public.attempt_answers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.attempt_answers TO anon, authenticated;
DROP POLICY IF EXISTS allow_all ON public.answer_reviews;
CREATE POLICY allow_all ON public.answer_reviews FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.answer_reviews TO anon, authenticated;
DROP POLICY IF EXISTS allow_all ON public.student_sessions;
CREATE POLICY allow_all ON public.student_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.student_sessions TO anon, authenticated;
DROP POLICY IF EXISTS allow_all ON public.dim_date;
CREATE POLICY allow_all ON public.dim_date FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.dim_date TO anon, authenticated;

-- Kiểm chứng: 10 bảng mới phải hiện đủ
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('learning_activities','activity_questions','assignments',
    'assignment_questions','assignment_targets','attempts','attempt_answers',
    'answer_reviews','student_sessions','dim_date')
ORDER BY table_name;
