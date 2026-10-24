-- ==============================================================================
-- MIGRATION 012: Bang moc qua giao vien tao (reward_tiers) tren Supabase
-- ==============================================================================
-- Van de: truoc day moc qua giao vien tao chi luu trong localStorage cua
-- trinh duyet (SupabaseRewardRepository uy thac sang mock repo, key
-- mam_van_rewards) nen hoc sinh mo app tren may khac khong bao gio thay
-- moc cua giao vien phu trach lop minh.
--
-- Cach chay: dan toan bo file nay vao Supabase SQL Editor cua project
-- Mam Van roi Run (chay 1 lan). Khong can chay kem migration nao khac.
--
-- Kiem tra sau khi chay: vao Table Editor -> bang reward_tiers phai ton
-- tai (luc dau rong la dung). Sau do giao vien tao 1 moc moi trong app,
-- tai lai trang: moc phai hien ca tren trinh duyet khac / may khac khi
-- dang nhap bang tai khoan hoc sinh thuoc lop cua giao vien do.
--
-- AN TOAN THU TU TRIEN KHAI (doc ky):
-- - Code web da deploy TRUOC khi chay SQL nay van chay binh thuong: neu
--   bang chua ton tai, code fallback ve moc local cu, app khong vo.
-- - Moc local cu KHONG tu bay sang Supabase: sau khi chay SQL, giao vien
--   tao lai moc 1 lan tren Supabase (may nao cung duoc), tu do hoc sinh
--   moi may deu thay. Moc local cu tren tung may se khong con hien nua
--   khi code doc duoc bang Supabase (code doc Supabase truoc, chi fallback
--   ve local khi bang chua co / loi doc).
-- - RLS allow_all theo DUNG mau migration_002/005 dang chay tot tren
--   production: chi de het bao Security Advisor, CHUA phai khoa that.
--   Khoa that theo vai tro (chi giao vien tao/sua moc cua minh) can vong
--   rieng sau, kem Supabase Auth - khong nam trong migration nay.
-- - File idempotent: chay lai nhieu lan khong loi.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.reward_tiers (
  id text PRIMARY KEY,
  teacher_id text,
  required_xp integer NOT NULL,
  xp_cost integer NOT NULL,
  required_attendance_days integer NOT NULL DEFAULT 4,
  tier_key text NOT NULL,
  teaser_description text NOT NULL DEFAULT 'Món quà bí mật thú vị',
  secret_name text NOT NULL DEFAULT 'Món quà bí mật',
  secret_description text NOT NULL DEFAULT 'Chi tiết quà tặng dành cho học sinh chăm chỉ.',
  is_physical boolean NOT NULL DEFAULT false,
  name text,
  description text,
  stock integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Phong truong hop bang da ton tai tu lan chay do dang truoc do:
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS teacher_id text;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS required_xp integer;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS xp_cost integer;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS required_attendance_days integer;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS tier_key text;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS teaser_description text;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS secret_name text;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS secret_description text;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS is_physical boolean;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS stock integer;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- RLS + policy allow_all (mau migration_002/005; xem luu y khoa that o tren).
ALTER TABLE public.reward_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_reward_tiers" ON public.reward_tiers;
CREATE POLICY "allow_all_reward_tiers" ON public.reward_tiers FOR ALL USING (true) WITH CHECK (true);
