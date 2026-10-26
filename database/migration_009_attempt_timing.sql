-- migration_009: bổ sung thời gian bắt đầu + thời lượng cho lượt làm bài THẬT trong app.
-- Bảng attempts ở migration_008 (theo mô hình dữ liệu giả lập) chỉ có submitted_at/submitted_date,
-- trong khi luồng học sinh nộp bài thật cần ghi lúc bắt đầu và tổng thời gian làm bài.
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS total_time_seconds integer;
