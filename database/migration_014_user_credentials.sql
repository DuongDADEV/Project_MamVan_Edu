-- ============================================================
-- Migration 014 — Bảng ai_settings (cấu hình AI, KHÔNG chứa key)
-- ------------------------------------------------------------
-- LƯU Ý (25/10, sau quyết định "giải quyết giả mạo localStorage ở
-- tầng dữ liệu"): plan ban đầu của file này (bảng user_credentials +
-- hash scrypt tự quản) đã BỊ THAY bằng Supabase Auth + RLS thật
-- (migration 015 + script tạo auth users). Lý do: tự quản 2 kho mật
-- khẩu song song chỉ thêm chỗ lệch nhau; Supabase Auth đã hash sẵn
-- (bcrypt) và cấp JWT mà DB tự verify chữ ký — đó mới là cách chặn
-- giả mạo ở tầng dữ liệu. Phần user_credentials vì vậy KHÔNG tạo nữa.
-- File này chỉ còn bảng ai_settings: tên model/cấu hình AI, chỉ đọc/
-- ghi qua route serverless bằng service role (RLS bật, không policy).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
-- Không tạo policy: chỉ route serverless (service role) đọc/ghi.
