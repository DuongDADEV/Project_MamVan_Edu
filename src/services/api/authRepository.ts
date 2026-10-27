/**
 * Auth repository GĐ3 — gọi API VPS thay Supabase Auth.
 *
 * Giữ nguyên:
 * - localStorage key 'mam_van_auth_session' và shape session object
 *   (user + role + signedInAt, xem types.ts AuthSession) để UI khác đọc
 *   key này không vỡ. session.token (nếu có) mang access token hiện tại.
 * - Semantics getSession tự chữa lệch như cũ: server trả phiên dựng lại
 *   từ profile thật thì dùng phiên đó; 401 → null + clear; lỗi mạng →
 *   GIỮ phiên cũ, không đăng xuất oan.
 * - signOut: POST /api/auth/sign-out, lỗi cũng clear token local.
 * - Thông báo lỗi đăng nhập chung theo role (không lộ user có tồn tại
 *   hay không), trừ trường hợp khóa tài khoản (isLocked).
 */
import {
  ApiError,
  apiFetch,
  apiPost,
  clearTokens,
  getAccessToken,
  setTokens,
} from './http.ts';
import type { AuthRepository, AuthSession, Role } from '../types.ts';
import { syncEventBus } from '../mock/eventBus.ts';

export const SESSION_STORAGE_KEY = 'mam_van_auth_session';

// Các key cache nội dung/dữ liệu học tập dọn khi đăng xuất — giữ đúng
// danh sách bản Supabase cũ dọn, để tài khoản khác đăng nhập trên cùng
// trình duyệt không thấy sót lại dữ liệu tài khoản trước.
const SIGNOUT_CACHE_KEYS = [
  'mam_van_topics',
  'mam_van_videos',
  'mam_van_theories',
  'mam_van_quizzes',
  'mam_van_questions',
  'mam_van_student_states',
  'mam_van_essay_submissions',
  'mam_van_reward_requests',
];

function readLocalSession(): AuthSession | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function storeSession(session: AuthSession): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* bỏ qua lỗi storage */
  }
}

function clearLocalSession(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* bỏ qua */
  }
}

/** Chuẩn hóa session server trả về: đủ user/role/signedInAt, token đồng bộ
 *  với access token đang lưu (nếu có). Server là nguồn thật cho user. */
function normalizeSession(raw: any, fallbackRole?: Role): AuthSession | null {
  if (!raw || typeof raw !== 'object' || !raw.user) return null;
  const token = getAccessToken() || raw.token || undefined;
  return {
    user: raw.user,
    role: raw.role || fallbackRole || 'teacher',
    token,
    signedInAt: typeof raw.signedInAt === 'number' ? raw.signedInAt : Date.now(),
  };
}

function genericSignInError(role: Role): string {
  if (role === 'admin') return 'Tên đăng nhập hoặc mật khẩu Quản trị viên chưa chính xác';
  if (role === 'teacher') return 'Tên đăng nhập hoặc mật khẩu giáo viên chưa chính xác';
  return 'Mật khẩu chưa chính xác. Nếu quên mật khẩu, em hãy nhờ Thầy/Cô cấp lại nhé!';
}

function lockedSignInError(role: Role): string {
  if (role === 'admin') return 'Tài khoản Quản trị viên đã bị khóa. Vui lòng liên hệ hỗ trợ kỹ thuật!';
  if (role === 'teacher') return 'Tài khoản giáo viên đã bị khóa. Vui lòng liên hệ quản trị viên!';
  return 'Tài khoản của em đang tạm khóa. Vui lòng liên hệ Thầy/Cô phụ trách để mở khóa nhé!';
}

function isLockedError(err: any): boolean {
  if (!err) return false;
  if (err.code === 'LOCKED' || err.code === 'ACCOUNT_LOCKED') return true;
  return /locked|bị khóa|tạm khóa/i.test(String(err.message || ''));
}

export class ApiAuthRepository implements AuthRepository {
  async signIn(
    role: Role,
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    session?: AuthSession;
    error?: string;
    isLocked?: boolean;
  }> {
    const uClean = username.trim().toLowerCase();
    const pClean = password.trim();
    try {
      const json: any = await apiPost('/api/auth/sign-in', {
        role,
        username: uClean,
        password: pClean,
      });
      // Server trả { session } (khảo sát §2.1); chấp nhận session nằm
      // trực tiếp ở root nếu server trả phẳng.
      const rawSession = json?.session || json;
      const session = normalizeSession(rawSession, role);
      if (!session) {
        return {
          success: false,
          error:
            role === 'student'
              ? 'Tài khoản chưa được liên kết hồ sơ. Vui lòng liên hệ Thầy/Cô phụ trách nhé!'
              : 'Tài khoản chưa được liên kết hồ sơ. Vui lòng liên hệ quản trị viên!',
        };
      }
      // Token: ưu tiên field riêng của response, rồi session.token.
      const access =
        json?.accessToken || json?.access_token || rawSession?.token || rawSession?.accessToken;
      const refresh = json?.refreshToken || json?.refresh_token || rawSession?.refreshToken;
      if (access) setTokens(access, refresh);
      const stored: AuthSession = { ...session, token: getAccessToken() || session.token };
      storeSession(stored);
      syncEventBus.emit('auth', stored, 'api-auth');
      if (role === 'student') {
        syncEventBus.emit('student', { studentId: stored.user.id }, 'api-auth');
      }
      return { success: true, session: stored };
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (isLockedError(err)) {
          return { success: false, isLocked: true, error: lockedSignInError(role) };
        }
        // Mọi lỗi xác thực khác: thông báo chung theo role, không lộ
        // user có tồn tại hay không (giữ đúng mapAuthError cũ).
        return { success: false, error: genericSignInError(role) };
      }
      // Lỗi mạng / ngoại lệ khác: giữ thông báo mất mạng như bản cũ.
      console.error('[ApiAuth] Ngoại lệ khi đăng nhập:', err);
      return {
        success: false,
        error: 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại!',
      };
    }
  }

  async signOut(): Promise<void> {
    try {
      await apiPost('/api/auth/sign-out', {});
    } catch {
      /* Lỗi cũng clear token local bên dưới (JWT stateless, server không
         cần store; nếu dùng refresh token thì server thu hồi khi gọi được). */
    }
    clearTokens();
    if (typeof window !== 'undefined') {
      clearLocalSession();
      try {
        SIGNOUT_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
        Object.keys(localStorage)
          .filter((k) => k.startsWith('mam_van_system_settings'))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* bỏ qua lỗi dọn dẹp */
      }
    }
    syncEventBus.emit('auth', null, 'api-auth');
  }

  async getSession(): Promise<AuthSession | null> {
    if (typeof window === 'undefined') return null;
    const local = readLocalSession();
    if (!local) return null;
    try {
      const json: any = await apiFetch('/api/auth/me');
      const rawSession = json?.session || json;
      const serverSession = normalizeSession(rawSession, local.role);
      if (!serverSession) {
        // Không xác minh được (response lạ) → giữ phiên cũ, tránh đăng
        // xuất oan — đúng nhánh catch của bản cũ.
        return local;
      }
      if (serverSession.user.id !== local.user.id) {
        // Tự chữa lệch: hồ sơ thật khác hồ sơ trong phiên local (đổi tài
        // khoản mà phiên local chưa kịp đổi) → dựng lại từ hồ sơ thật.
        const rebuilt: AuthSession = {
          ...serverSession,
          token: getAccessToken() || serverSession.token,
        };
        storeSession(rebuilt);
        return rebuilt;
      }
      // Hồ sơ khớp: giữ phiên local như bản cũ (không ghi đè classIds/
      // trường UI đang dùng bằng bản server nếu server thiếu trường).
      // Chỉ đồng bộ token nếu access token đã xoay.
      const token = getAccessToken();
      if (token && local.token !== token) {
        const synced: AuthSession = { ...local, token };
        storeSession(synced);
        return synced;
      }
      return local;
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        // JWT mất/hết hạn thật → xóa phiên local, trả null.
        clearTokens();
        clearLocalSession();
        return null;
      }
      // Mất mạng / lỗi khác → GIỮ phiên cũ, không đăng xuất oan.
      return local;
    }
  }
}

export const apiAuthRepo = new ApiAuthRepository();
