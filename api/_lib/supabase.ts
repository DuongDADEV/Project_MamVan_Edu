import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function getAdminClient() {
  if (!url || !serviceKey) {
    throw new Error('SERVER_NOT_CONFIGURED');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getUserClient() {
  if (!url || !anonKey) {
    throw new Error('SERVER_NOT_CONFIGURED');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type VerifiedUser = {
  id: string;
  email?: string;
  role: string;
};

/**
 * Verify a Supabase Auth JWT by asking the Auth API (getUser). This works
 * for both HS256 and ES256 projects without handling any signing secret.
 * Returns null when the token is missing, expired, or invalid.
 */
export async function verifyUserToken(token: string): Promise<VerifiedUser | null> {
  if (!token) return null;
  try {
    const client = getUserClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    const u: any = data.user;
    return {
      id: u.id,
      email: u.email,
      role: u.app_metadata?.role || u.user_metadata?.role || '',
    };
  } catch {
    return null;
  }
}

export function isAdminUser(u: VerifiedUser | null): boolean {
  return !!u && u.role === 'admin';
}

/**
 * Email tổng hợp cho 1 tài khoản app. Đăng nhập vẫn bằng username;
 * frontend tự ghép email này rồi gọi signInWithPassword. Prefix role
 * để tránh trùng email giữa bảng teachers và students. Route
 * migrate-auth dùng đúng hàm này — đừng đổi format nếu không đổi
 * cả 2 phía (tài khoản đã migrate sẽ không đăng nhập được nữa).
 */
export function synthAuthEmail(role: string, username: string): string {
  return `${role}_${username}@mamvan.internal`.toLowerCase();
}

export function readBearer(req: any): string {
  const h = req?.headers?.authorization || req?.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  return m ? m[1] : '';
}
