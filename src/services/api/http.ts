/**
 * HTTP client cho API VPS (GĐ3) — thay Supabase client ở tầng gọi API.
 *
 * - Base URL mặc định '' (gọi tương đối /api, same-origin khi chạy trên
 *   VPS). Dev local override bằng import.meta.env.VITE_API_BASE_URL.
 * - Tự gắn Bearer từ access token đang lưu (xem setTokens).
 * - Gặp 401: thử POST /api/auth/refresh đúng 1 lần rồi thử lại request
 *   gốc. Vẫn 401 (hoặc không có refresh token) thì xóa token và ném
 *   ApiError 401 — auth repo sẽ map thành null session.
 * - Lỗi mạng (fetch ném) thì ném nguyên lỗi, KHÔNG xóa token: mất mạng
 *   không được đăng xuất oan (semantics getSession cũ).
 * - KHÔNG fallback lặng sang mock: mọi lỗi HTTP đều ném ApiError để UI
 *   hiện lỗi rõ (luật server-thật 26/10).
 * - Chỉ lưu 2 token (access + refresh). Không lưu secret nào khác.
 */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const ACCESS_TOKEN_KEY = 'mam_van_access_token';
export const REFRESH_TOKEN_KEY = 'mam_van_refresh_token';

const REFRESH_PATH = '/api/auth/refresh';

function readEnvBase(): string {
  try {
    const v = (import.meta as any)?.env?.VITE_API_BASE_URL;
    return typeof v === 'string' ? v.replace(/\/$/, '') : '';
  } catch {
    return '';
  }
}

export const API_BASE_URL = readEnvBase();

function readToken(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeToken(key: string, value: string | null | undefined): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* bỏ qua lỗi storage */
  }
}

export function getAccessToken(): string | null {
  return readToken(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return readToken(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh?: string | null): void {
  writeToken(ACCESS_TOKEN_KEY, access);
  // refresh === undefined: giữ nguyên refresh token cũ (vd chỉ xoay
  // access token); null/chuỗi rỗng: xóa refresh token.
  if (refresh !== undefined) writeToken(REFRESH_TOKEN_KEY, refresh || null);
}

export function clearTokens(): void {
  writeToken(ACCESS_TOKEN_KEY, null);
  writeToken(REFRESH_TOKEN_KEY, null);
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function errorMessageFromBody(json: any, fallback: string): { message: string; code?: string } {
  if (!json || typeof json !== 'object') return { message: fallback };
  const raw = (json as any).error;
  if (typeof raw === 'string') return { message: raw, code: raw };
  if (raw && typeof raw === 'object') {
    return {
      message: typeof raw.message === 'string' ? raw.message : fallback,
      code: typeof raw.code === 'string' ? raw.code : undefined,
    };
  }
  if (typeof (json as any).message === 'string') return { message: (json as any).message };
  return { message: fallback };
}

async function parseBody(res: Response): Promise<any> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Đọc token mới từ response refresh — chấp nhận nhiều shape để khỏi vỡ
 *  khi server chốt contract: { accessToken, refreshToken } (camel),
 *  { access_token, refresh_token } (snake), hoặc { session: { token } }. */
function extractTokens(json: any): { access?: string; refresh?: string } {
  if (!json || typeof json !== 'object') return {};
  const session = (json as any).session;
  return {
    access:
      (json as any).accessToken ||
      (json as any).access_token ||
      session?.token ||
      session?.accessToken ||
      undefined,
    refresh:
      (json as any).refreshToken ||
      (json as any).refresh_token ||
      session?.refreshToken ||
      session?.refresh_token ||
      undefined,
  };
}

// Single-flight cho refresh: nhiều request cùng 401 chỉ gọi refresh 1 lần.
// Kết quả: 'ok' (đã xoay token), 'rejected' (server từ chối refresh),
// 'network' (mất mạng khi refresh — KHÔNG được kết luận phiên chết),
// 'none' (không có refresh token để thử).
let refreshPromise: Promise<'ok' | 'rejected' | 'network' | 'none'> | null = null;

async function tryRefresh(): Promise<'ok' | 'rejected' | 'network' | 'none'> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return 'none';
    try {
      const res = await fetch(resolveUrl(REFRESH_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await parseBody(res);
      if (!res.ok) return 'rejected';
      const { access, refresh } = extractTokens(json);
      if (!access) return 'rejected';
      setTokens(access, refresh);
      return 'ok';
    } catch {
      // Lỗi mạng khi refresh: không xóa token, để request gốc ném lỗi mạng.
      return 'network';
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function doFetch(path: string, init: RequestInit | undefined, withAuth: boolean): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  if (withAuth) {
    const token = getAccessToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  if (init?.body !== undefined && init?.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(resolveUrl(path), { ...init, headers });
}

/**
 * Gọi API. Trả về body JSON đã parse (hoặc null với 204/body rỗng).
 * Ném ApiError khi HTTP lỗi, ném nguyên lỗi fetch khi mất mạng.
 */
export async function apiFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await doFetch(path, init, true);
  } catch (err) {
    // Lỗi mạng: ném nguyên, KHÔNG xóa token, KHÔNG map thành 401.
    throw err;
  }

  if (res.status === 401 && path !== REFRESH_PATH) {
    const refreshOutcome = await tryRefresh();
    if (refreshOutcome === 'ok') {
      try {
        res = await doFetch(path, init, true);
      } catch (err) {
        throw err;
      }
    } else if (refreshOutcome === 'network') {
      // Mất mạng đúng lúc refresh: không kết luận phiên chết, không xóa
      // token — ném lỗi mạng để tầng gọi giữ phiên cũ.
      throw new Error('Không kết nối được máy chủ khi làm mới phiên. Vui lòng kiểm tra mạng và thử lại.');
    }
    if (res.status === 401) {
      // Server từ chối refresh (hoặc không có refresh token): phiên chết
      // thật — xóa token để auth repo map thành null session.
      clearTokens();
      const json = await parseBody(res);
      const { message, code } = errorMessageFromBody(json, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      throw new ApiError(401, message, code || 'UNAUTHORIZED');
    }
  }

  const json = await parseBody(res);
  if (!res.ok) {
    const { message, code } = errorMessageFromBody(json, `Yêu cầu thất bại (HTTP ${res.status}).`);
    throw new ApiError(res.status, message, code);
  }
  return json as T;
}

/** Tiện ích cho repo: POST JSON qua apiFetch. */
export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
}
