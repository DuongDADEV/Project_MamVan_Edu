-- Migration 010: XP thưởng cho bài tập & đánh giá (mô hình XP theo chủ đề &
-- bài kiểm tra, chủ dự án duyệt 22/10/2026). Học sinh nộp bài là nhận xp_reward
-- (một lần), không xét đúng sai. Mặc định 0 = chưa cấu hình.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS xp_reward integer NOT NULL DEFAULT 0;
