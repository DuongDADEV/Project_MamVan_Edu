-- ============================================================
-- Migration 017 — bảng ai_usage: thống kê token đã dùng theo model
-- ------------------------------------------------------------
-- Proxy /api/ai/chat ghi 1 dòng mỗi lần 1 nấc trả lời thành công
-- (số token lấy từ usage của provider: Gemini usageMetadata,
-- OpenAI usage). Màn admin đọc bảng này để vẽ biểu đồ token đã
-- dùng theo từng model. RLS bật, KHÔNG tạo policy nào: chỉ
-- service role (proxy + route admin) đọc/ghi; trình duyệt không
-- bao giờ đọc trực tiếp bảng này.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
