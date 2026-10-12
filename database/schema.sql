-- ==============================================================================
-- DỰ ÁN MẦM VĂN 7 - HỆ THỐNG CƠ SỞ DỮ LIỆU CHUẨN TỐI ƯU (CORE SUPABASE SCHEMA)
-- Tác giả: Vũ Xuân Toàn (Tech Lead) & Thành Dương (Product Owner)
-- Chuẩn hóa: 9 bảng cốt lõi (Không thừa, đúng & đủ cho toàn bộ nghiệp vụ)
-- ==============================================================================

-- Kích hoạt extension sinh UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. BẢNG TEACHERS (Tài khoản & Hồ sơ Giáo viên / Admin)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '123456',
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
    school VARCHAR(150) DEFAULT 'THCS Giấy & Mực',
    subject VARCHAR(100) DEFAULT 'Ngữ văn 7',
    gemini_api_key TEXT,
    status VARCHAR(20) DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'locked')),
    trial_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. BẢNG CLASSES (Quản lý Lớp học của giáo viên)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL, -- vd: Lớp 7A2
    grade VARCHAR(20) DEFAULT 'Lớp 7',
    school_year VARCHAR(20) DEFAULT '2026-2027',
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. BẢNG STUDENTS (Hồ sơ học sinh & Tài khoản cấp phát)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '123456',
    student_code VARCHAR(50), -- Mã HS (vd: HS7A2-01)
    dob DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'locked')),
    has_logged_in BOOLEAN DEFAULT FALSE,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. BẢNG STUDENT_STATES (Tiến độ học tập, Điểm XP, Streak & Cây Tri Thức)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS student_states (
    student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    xp_today INT DEFAULT 0,
    xp_week INT DEFAULT 0,
    total_xp INT DEFAULT 0,
    active_seconds_today INT DEFAULT 0,
    consecutive_days INT DEFAULT 0,
    last_attendance_date DATE,
    completed_steps JSONB DEFAULT '[]'::jsonb,
    topic_mastery JSONB DEFAULT '{}'::jsonb, -- Tỷ lệ % Mastery để đổi màu lá Cây: Xanh lá, Xanh lam, Vàng cam, Xám
    unlocked_badge_ids JSONB DEFAULT '[]'::jsonb,
    xp_logs JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{"sound": true, "animations": true}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. BẢNG TOPICS (Cây Chủ đề & Bài giảng - Mỗi chủ đề tương ứng 1 lá Cây)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS topics (
    id VARCHAR(100) PRIMARY KEY,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL, -- Thơ ca, Tiếng Việt, Văn xuôi, Tập làm văn
    order_index INT DEFAULT 0,
    video_payload JSONB, -- Video URL, thời lượng, các điểm dừng trọng tâm
    theory_payload JSONB, -- Khối nội dung lý thuyết toàn diện
    status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. BẢNG QUESTIONS (Ngân hàng câu hỏi trung tâm & Đề kiểm tra)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(100) PRIMARY KEY,
    topic_id VARCHAR(100) REFERENCES topics(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'fill_in_blank', 'essay')),
    level VARCHAR(30) NOT NULL, -- Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao
    prompt TEXT NOT NULL,
    options JSONB, -- Các lựa chọn A, B, C, D
    correct_answer JSONB,
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. BẢNG ESSAY_SUBMISSIONS (Bài viết tự luận & Hàng đợi chấm theo 4 tiêu chí)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS essay_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id VARCHAR(100) NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    word_count INT NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'PENDING_TEACHER' CHECK (status IN ('PENDING_TEACHER', 'AI_SUGGESTED', 'GRADED')),
    ai_suggested_scores JSONB,
    ai_suggested_feedback TEXT,
    rubric_scores JSONB, -- Điểm 4 tiêu chí cố định: Nội dung (4đ), Bố cục (2đ), Dùng từ (2đ), Sáng tạo (2đ)
    total_score NUMERIC(4, 2), -- Tổng điểm /10
    teacher_feedback TEXT,
    graded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. BẢNG REWARD_REQUESTS (Yêu cầu mở Rương Quà Bí Mật Tuần)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS reward_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    chest_type VARCHAR(30) NOT NULL CHECK (chest_type IN ('hat', 'la', 'hoa', 'vang')),
    xp_week_snapshot INT NOT NULL,
    gift_name VARCHAR(200),
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. BẢNG SYSTEM_SETTINGS (Cấu hình sư phạm, Ngưỡng trần XP ngày/tuần)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    daily_xp_cap_under_45 INT DEFAULT 130,
    daily_xp_cap_max INT DEFAULT 150,
    weekly_xp_cap INT DEFAULT 900,
    xp_rules JSONB DEFAULT '{
        "attendance": 2,
        "video_watch": 5,
        "theory_read": 10,
        "quick_test": 8,
        "mastery_check": 8,
        "homework": 20
    }'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- CHỈ MỤC TỐI ƯU HÓA TRUY VẤN (INDEXES)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_username ON students(username);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_essay_status ON essay_submissions(status);
CREATE INDEX IF NOT EXISTS idx_essay_student ON essay_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_rewards_student ON reward_requests(student_id);

-- ==============================================================================
-- NẠP DỮ LIỆU MẪU BAN ĐẦU (SEED DATA CHUẨN ĐỂ TEST ĐƯỢC NGAY)
-- ==============================================================================

-- 1. Giáo viên mẫu (gv001)
INSERT INTO teachers (id, username, password_hash, name, role, school, subject, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'gv001',
    '123456',
    'Thầy Nguyễn Văn An',
    'teacher',
    'THCS Giấy & Mực',
    'Ngữ văn 7',
    'active'
) ON CONFLICT (username) DO NOTHING;

-- 2. Lớp mẫu (Lớp 7A2)
INSERT INTO classes (id, name, grade, school_year, teacher_id)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    'Lớp 7A2',
    'Lớp 7',
    '2026-2027',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- 3. Học sinh mẫu (hs001 - Nguyễn Minh Anh, hs002 - Trần Gia Bảo)
INSERT INTO students (id, class_id, name, username, password_hash, student_code, status)
VALUES 
(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000010',
    'Nguyễn Minh Anh',
    'hs001',
    '123456',
    'HS7A2-01',
    'active'
),
(
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000010',
    'Trần Gia Bảo',
    'hs002',
    '123456',
    'HS7A2-02',
    'active'
) ON CONFLICT (username) DO NOTHING;

-- 4. Trạng thái học sinh mẫu
INSERT INTO student_states (student_id, xp_today, xp_week, total_xp, active_seconds_today, consecutive_days, topic_mastery)
VALUES
(
    '00000000-0000-0000-0000-000000000101',
    83, 420, 1250, 1800, 4,
    '{"topic_1": 85, "topic_2": 65, "topic_3": 40, "topic_4": 0}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000102',
    46, 260, 680, 1200, 2,
    '{"topic_1": 90, "topic_2": 55, "topic_3": 30, "topic_4": 0}'::jsonb
) ON CONFLICT (student_id) DO NOTHING;

-- 5. 4 Chủ đề chuẩn (Tương ứng 4 lá Cây Tri Thức)
INSERT INTO topics (id, title, category, order_index, status)
VALUES
('topic_1', 'Thơ bốn chữ, năm chữ', 'Thơ ca', 1, 'published'),
('topic_2', 'Từ láy và biện pháp tu từ so sánh', 'Tiếng Việt', 2, 'published'),
('topic_3', 'Truyện ngắn: Đọc hiểu nhân vật', 'Văn xuôi', 3, 'published'),
('topic_4', 'Viết đoạn văn cảm nghĩ', 'Tập làm văn', 4, 'published')
ON CONFLICT (id) DO NOTHING;

-- 6. Cấu hình hệ thống mặc định
INSERT INTO system_settings (id, daily_xp_cap_under_45, daily_xp_cap_max, weekly_xp_cap)
VALUES ('default', 130, 150, 900)
ON CONFLICT (id) DO NOTHING;
