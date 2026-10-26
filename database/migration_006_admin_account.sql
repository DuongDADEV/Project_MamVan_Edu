-- ============================================================
-- Migration 006 — Tài khoản Quản trị viên (Admin) THẬT trong database
-- ------------------------------------------------------------
-- Bối cảnh: trước đây đăng nhập Admin là thông tin GHI CỨNG trong
-- mã nguồn (supabaseRepositories.ts + mockRepositories.ts) — repo
-- đang công khai nên bất kỳ ai cũng đọc được. Từ đợt này, Admin là
-- một tài khoản thật trong bảng teachers với role = 'admin'
-- (bảng teachers vốn đã thiết kế role IN ('teacher','admin')),
-- đăng nhập tra cứu DB như giáo viên.
--
-- CÁCH CHẠY: dán toàn bộ file vào Supabase SQL Editor và Run.
--   >>> TRƯỚC KHI RUN: thay <<MAT_KHAU_ADMIN>> ở dòng VALUES bên
--       dưới bằng mật khẩu Admin muốn đặt (giữ nguyên dấu nháy đơn).
-- Chạy độc lập với migration 003/004/005. Idempotent: chạy lại sẽ
-- cập nhật mật khẩu + kích hoạt lại tài khoản admin theo nội dung file.
-- ============================================================

INSERT INTO public.teachers (username, password_hash, name, email, role, status, trial_expires_at)
VALUES ('admin', '<<MAT_KHAU_ADMIN>>', 'Quản trị viên Hệ thống', 'admin@mamvan.edu.vn', 'admin', 'active', NULL)
ON CONFLICT (username) DO UPDATE
SET password_hash    = EXCLUDED.password_hash,
    name             = EXCLUDED.name,
    email            = EXCLUDED.email,
    role             = 'admin',
    status           = 'active',
    trial_expires_at = NULL;

-- Kiểm chứng: phải trả về đúng 1 dòng role='admin', status='active'
SELECT id, username, name, email, role, status
FROM public.teachers
WHERE role = 'admin';
