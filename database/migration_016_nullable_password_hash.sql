-- ============================================================
-- Migration 016 — password_hash thành nullable
-- ------------------------------------------------------------
-- Route /api/admin/migrate-auth NULL cột password_hash sau khi link
-- auth_user_id (xóa mật khẩu plaintext khỏi DB), nhưng cột này đang
-- NOT NULL nên mọi UPDATE đều vi phạm constraint và route báo failed
-- dù auth user đã tạo xong (phát hiện 25/10 sau lần migrate đầu:
-- 3 auth user đã có trong auth.users nhưng auth_user_id vẫn NULL).
-- Sau migration này cột chỉ còn là di tích (login không đọc nó nữa).
-- ============================================================

ALTER TABLE public.teachers ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN password_hash DROP NOT NULL;
