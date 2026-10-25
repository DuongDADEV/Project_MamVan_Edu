-- ============================================================
-- Migration 015 — Supabase Auth + RLS theo vai trò (THẬT)
-- ------------------------------------------------------------
-- Bối cảnh: RLS hiện bật trên 24 bảng nhưng mọi policy đều là
-- allow-all (USING true) — tức là không chặn gì. Phiên đăng nhập
-- hiện là JSON tự tạo trong localStorage, DB tin bất kỳ ai có anon
-- key. Từ đợt này:
--  1. Thêm cột auth_user_id cho teachers + students (nối sang
--     auth.users; route 1 lần /api/admin/migrate-auth sẽ tạo auth
--     users và điền cột này).
--  2. Xóa toàn bộ policy allow-all cũ, thay bằng policy theo vai trò:
--     - admin (JWT app_metadata.role = 'admin'): toàn quyền mọi bảng.
--     - teacher: chỉ dữ liệu của mình / lớp mình.
--     - student: chỉ dòng của mình / nội dung của giáo viên lớp mình.
--     - anon: KHÔNG policy nào → không đọc/ghi được gì.
--  3. Các hàm helper SECURITY DEFINER (chạy với quyền postgres =
--     chủ bảng nên bypass RLS, tránh đệ quy policy).
--
-- LƯU Ý: chạy file này sẽ KHÓA app cũ ngay (app cũ dùng anon key +
-- session JSON, không có JWT) — vì vậy file này chỉ deploy CÙNG
-- đợt với frontend đăng nhập Supabase Auth + route migrate-auth.
-- Thứ tự deploy: (1) deploy code mới, (2) bấm migrate-auth ngay,
-- (3) test đăng nhập 3 vai trò. Rollback: redeploy bản prod trước.
-- ============================================================

-- ---------- 1. Cột nối sang auth.users ----------
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------- 2. Hàm helper (SECURITY DEFINER) ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.my_teacher_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_student_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.students WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_class_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT class_id FROM public.students WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.teacher_of_class(p_class_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT teacher_id FROM public.classes WHERE id = p_class_id LIMIT 1;
$$;

-- ---------- 3. Xóa toàn bộ policy cũ trên mọi bảng public ----------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------- 4. Policy admin (toàn quyền mọi bảng) ----------
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format(
      'CREATE POLICY "admin_all" ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );
  END LOOP;
END $$;

-- ---------- 5. Policy teacher / student theo từng bảng ----------
-- teachers: teacher xem/sửa dòng của mình (WITH CHECK chặn đổi role
-- thành admin); student xem giáo viên của lớp mình (hiển thị tên).
CREATE POLICY "teacher_own" ON public.teachers FOR SELECT
  USING (id = public.my_teacher_id());
CREATE POLICY "teacher_own_update" ON public.teachers FOR UPDATE
  USING (id = public.my_teacher_id())
  WITH CHECK (id = public.my_teacher_id() AND role = 'teacher');
CREATE POLICY "student_class_teacher" ON public.teachers FOR SELECT
  USING (id = public.teacher_of_class(public.my_class_id()));

-- students: teacher quản lý học sinh lớp mình; student xem/sửa dòng mình
-- (WITH CHECK chặn chuyển lớp / đổi id).
CREATE POLICY "teacher_class_students" ON public.students FOR ALL
  USING (class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id()))
  WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id()));
CREATE POLICY "student_own" ON public.students FOR SELECT
  USING (id = public.my_student_id());
CREATE POLICY "student_own_update" ON public.students FOR UPDATE
  USING (id = public.my_student_id())
  WITH CHECK (id = public.my_student_id() AND class_id = public.my_class_id());

-- classes: teacher toàn quyền lớp mình; student xem lớp mình.
CREATE POLICY "teacher_own_classes" ON public.classes FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_own_class" ON public.classes FOR SELECT
  USING (id = public.my_class_id());

-- Nội dung của giáo viên (topics, questions, quizzes, video_lessons,
-- theory_lessons, learning_activities): teacher toàn quyền của mình;
-- student xem nội dung của giáo viên lớp mình (lọc published do app lo).
CREATE POLICY "teacher_own_topics" ON public.topics FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_class_topics" ON public.topics FOR SELECT
  USING (teacher_id = public.teacher_of_class(public.my_class_id()));

CREATE POLICY "teacher_own_questions" ON public.questions FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_class_questions" ON public.questions FOR SELECT
  USING (teacher_id = public.teacher_of_class(public.my_class_id()));

CREATE POLICY "teacher_own_quizzes" ON public.quizzes FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_class_quizzes" ON public.quizzes FOR SELECT
  USING (teacher_id = public.teacher_of_class(public.my_class_id()));

CREATE POLICY "teacher_own_video" ON public.video_lessons FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_class_video" ON public.video_lessons FOR SELECT
  USING (teacher_id = public.teacher_of_class(public.my_class_id()));

CREATE POLICY "teacher_own_theory" ON public.theory_lessons FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_class_theory" ON public.theory_lessons FOR SELECT
  USING (teacher_id = public.teacher_of_class(public.my_class_id()));

CREATE POLICY "teacher_own_activities" ON public.learning_activities FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_class_activities" ON public.learning_activities FOR SELECT
  USING (teacher_id = public.teacher_of_class(public.my_class_id()));

-- assignments: teacher toàn quyền của mình; student xem bài của giáo
-- viên lớp mình (đích danh qua assignment_targets vẫn chặn ở dưới).
CREATE POLICY "teacher_own_assignments" ON public.assignments FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_class_assignments" ON public.assignments FOR SELECT
  USING (teacher_id = public.teacher_of_class(public.my_class_id()));

CREATE POLICY "teacher_assignment_targets" ON public.assignment_targets FOR ALL
  USING (assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = public.my_teacher_id()))
  WITH CHECK (assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = public.my_teacher_id()));
CREATE POLICY "student_own_targets" ON public.assignment_targets FOR SELECT
  USING (student_id = public.my_student_id());

CREATE POLICY "teacher_assignment_questions" ON public.assignment_questions FOR ALL
  USING (assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = public.my_teacher_id()))
  WITH CHECK (assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = public.my_teacher_id()));
CREATE POLICY "student_assignment_questions" ON public.assignment_questions FOR SELECT
  USING (assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = public.teacher_of_class(public.my_class_id())));

CREATE POLICY "teacher_activity_questions" ON public.activity_questions FOR ALL
  USING (activity_id IN (SELECT id FROM public.learning_activities WHERE teacher_id = public.my_teacher_id()))
  WITH CHECK (activity_id IN (SELECT id FROM public.learning_activities WHERE teacher_id = public.my_teacher_id()));
CREATE POLICY "student_activity_questions" ON public.activity_questions FOR SELECT
  USING (activity_id IN (SELECT id FROM public.learning_activities WHERE teacher_id = public.teacher_of_class(public.my_class_id())));

-- attempts / attempt_answers: student làm/xem bài của mình; teacher xem
-- và chấm bài của học sinh lớp mình (qua assignment hoặc activity).
CREATE POLICY "teacher_attempts" ON public.attempts FOR ALL
  USING (
    assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = public.my_teacher_id())
    OR learning_activity_id IN (SELECT id FROM public.learning_activities WHERE teacher_id = public.my_teacher_id())
    OR student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id()))
  )
  WITH CHECK (
    assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = public.my_teacher_id())
    OR learning_activity_id IN (SELECT id FROM public.learning_activities WHERE teacher_id = public.my_teacher_id())
    OR student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id()))
  );
CREATE POLICY "student_own_attempts" ON public.attempts FOR ALL
  USING (student_id = public.my_student_id())
  WITH CHECK (student_id = public.my_student_id());

CREATE POLICY "teacher_attempt_answers" ON public.attempt_answers FOR ALL
  USING (attempt_id IN (SELECT attempt_id FROM public.attempts WHERE student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id()))))
  WITH CHECK (attempt_id IN (SELECT attempt_id FROM public.attempts WHERE student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id()))));
CREATE POLICY "student_own_answers" ON public.attempt_answers FOR ALL
  USING (attempt_id IN (SELECT attempt_id FROM public.attempts WHERE student_id = public.my_student_id()))
  WITH CHECK (attempt_id IN (SELECT attempt_id FROM public.attempts WHERE student_id = public.my_student_id()));

-- essay_submissions: student nộp/xem bài mình; teacher xem/chấm bài
-- của lớp mình.
CREATE POLICY "teacher_essays" ON public.essay_submissions FOR ALL
  USING (class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id()))
  WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id()));
CREATE POLICY "student_own_essays" ON public.essay_submissions FOR ALL
  USING (student_id = public.my_student_id())
  WITH CHECK (student_id = public.my_student_id());

-- answer_reviews: teacher tạo/xem/sửa review do mình chấm hoặc của lớp
-- mình; student xem review bài của mình.
CREATE POLICY "teacher_reviews" ON public.answer_reviews FOR ALL
  USING (
    reviewer_id = public.my_teacher_id()
    OR answer_id IN (SELECT a.answer_id FROM public.attempt_answers a JOIN public.attempts t ON t.attempt_id = a.attempt_id WHERE t.student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id())))
  )
  WITH CHECK (reviewer_id = public.my_teacher_id());
CREATE POLICY "student_own_reviews" ON public.answer_reviews FOR SELECT
  USING (answer_id IN (SELECT a.answer_id FROM public.attempt_answers a JOIN public.attempts t ON t.attempt_id = a.attempt_id WHERE t.student_id = public.my_student_id()));

-- reward_requests: student tạo/xem của mình; teacher duyệt của lớp mình.
CREATE POLICY "teacher_reward_requests" ON public.reward_requests FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id())))
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id())));
CREATE POLICY "student_own_requests" ON public.reward_requests FOR ALL
  USING (student_id = public.my_student_id())
  WITH CHECK (student_id = public.my_student_id());

-- reward_tiers: teacher toàn quyền của mình; student xem quà của giáo
-- viên lớp mình.
CREATE POLICY "teacher_own_tiers" ON public.reward_tiers FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_class_tiers" ON public.reward_tiers FOR SELECT
  USING (teacher_id = public.teacher_of_class(public.my_class_id()));

-- student_states / student_sessions / student_activity_progress:
-- student xem/sửa của mình; teacher xem/sửa học sinh lớp mình.
CREATE POLICY "teacher_student_states" ON public.student_states FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id())))
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id())));
CREATE POLICY "student_own_states" ON public.student_states FOR ALL
  USING (student_id = public.my_student_id())
  WITH CHECK (student_id = public.my_student_id());

CREATE POLICY "teacher_student_sessions" ON public.student_sessions FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id())));
CREATE POLICY "student_own_sessions" ON public.student_sessions FOR ALL
  USING (student_id = public.my_student_id())
  WITH CHECK (student_id = public.my_student_id());

CREATE POLICY "teacher_student_progress" ON public.student_activity_progress FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id())))
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = public.my_teacher_id())));
CREATE POLICY "student_own_progress" ON public.student_activity_progress FOR ALL
  USING (student_id = public.my_student_id())
  WITH CHECK (student_id = public.my_student_id());

-- system_settings: teacher toàn quyền của mình; student xem setting của
-- giáo viên lớp mình (quy tắc XP hiển thị cho học sinh).
CREATE POLICY "teacher_own_settings" ON public.system_settings FOR ALL
  USING (teacher_id = public.my_teacher_id())
  WITH CHECK (teacher_id = public.my_teacher_id());
CREATE POLICY "student_class_settings" ON public.system_settings FOR SELECT
  USING (teacher_id = public.teacher_of_class(public.my_class_id()));

-- dim_date: bảng lịch báo cáo, không có chủ sở hữu — mọi tài khoản đã
-- đăng nhập đều được xem, không ai được sửa qua app.
CREATE POLICY "authenticated_dim_date" ON public.dim_date FOR SELECT
  USING (auth.role() = 'authenticated');

-- ai_settings: chỉ route serverless (service role) đọc/ghi → không
-- policy nào cho anon/authenticated (giống bảng credentials cũ).
-- (Bảng này do migration 014 tạo; policy admin_all ở trên đã tạo cho
-- mọi bảng — cần gỡ riêng policy admin_all của ai_settings để tránh
-- JWT admin đọc trực tiếp? Không: admin đọc qua route vẫn cần service
-- role; JWT admin KHÔNG nên đọc/ghi ai_settings trực tiếp từ trình
-- duyệt. Gỡ policy admin_all khỏi ai_settings.)
DROP POLICY IF EXISTS "admin_all" ON public.ai_settings;
