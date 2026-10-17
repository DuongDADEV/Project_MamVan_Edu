-- Migration 003: Cho phép reward_requests lưu đủ vòng đời trạng thái của app
-- (trước đây CHECK chỉ có PENDING/APPROVED/REJECTED nên GIVEN/OPENED bị ép thành REJECTED).
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor.
ALTER TABLE reward_requests DROP CONSTRAINT IF EXISTS reward_requests_status_check;
ALTER TABLE reward_requests
  ADD CONSTRAINT reward_requests_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'GIVEN', 'OPENED'));
