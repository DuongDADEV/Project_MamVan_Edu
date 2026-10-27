import { query, parseDbJson } from './mysql';

/**
 * Nguồn key cho chuỗi AI (GĐ3 — viết lại từ Supabase sang MySQL).
 * Thứ tự ưu tiên: key admin nhập trong màn "Cấu hình Mầm AI" (lưu
 * vào ai_settings key 'ai_keys') rồi mới tới biến môi trường VPS
 * (GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY /
 * WORKERS_AI_API_KEY). Route admin KHÔNG BAO GIỜ trả giá trị key
 * về trình duyệt — chỉ trả "đã cấu hình" + nguồn ('db' | 'env').
 * Lỗi DB -> coi như không có key DB (fallback env), như hành vi cũ
 * khi bảng chưa có.
 */

export type LegId = 'gemini' | 'groq' | 'openrouter' | 'workersai';
export const LEG_IDS: LegId[] = ['gemini', 'groq', 'openrouter', 'workersai'];

const ENV_KEY: Record<LegId, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  workersai: 'WORKERS_AI_API_KEY',
};

/** Đọc 1 key ai_settings (value JSON) hoặc null khi lỗi/không có. */
async function loadSetting(key: string): Promise<any | null> {
  try {
    const rows = await query<any>(
      'SELECT `value` FROM `ai_settings` WHERE `key` = ? LIMIT 1',
      [key]
    );
    if (!rows[0]) return null;
    const v = rows[0].value;
    return parseDbJson(v);
  } catch {
    return null;
  }
}

/** Key đã lưu trong ai_settings (không có thì {}). */
export async function loadStoredKeys(): Promise<Partial<Record<LegId, string>>> {
  const v = await loadSetting('ai_keys');
  if (v && typeof v === 'object') {
    const out: Partial<Record<LegId, string>> = {};
    for (const leg of LEG_IDS) {
      if (typeof v[leg] === 'string' && v[leg]) out[leg] = v[leg];
    }
    return out;
  }
  return {};
}

/** Key hiệu lực cho từng nấc: DB trước, env sau. */
export async function resolveKeys(): Promise<Record<LegId, string>> {
  const stored = await loadStoredKeys();
  const out = {} as Record<LegId, string>;
  for (const leg of LEG_IDS) {
    out[leg] = stored[leg] || process.env[ENV_KEY[leg]] || '';
  }
  return out;
}

/** Account ID Cloudflare cho nấc Workers AI (không phải secret).
 * Nguồn: ai_settings key 'workersai_account_id' (chuỗi, hoặc object
 * { accountId }) rồi mới tới biến môi trường CLOUDFLARE_ACCOUNT_ID. */
export async function loadWorkersAiAccountId(): Promise<string> {
  const s = await workersAiAccountIdStatus();
  return s.value;
}

export async function workersAiAccountIdStatus(): Promise<{
  value: string;
  source: 'db' | 'env' | null;
}> {
  const v = await loadSetting('workersai_account_id');
  if (typeof v === 'string' && v.trim()) return { value: v.trim(), source: 'db' };
  if (v && typeof v === 'object' && typeof v.accountId === 'string' && v.accountId.trim()) {
    return { value: v.accountId.trim(), source: 'db' };
  }
  const env = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  return env ? { value: env, source: 'env' } : { value: '', source: null };
}

/** Trạng thái cấu hình + nguồn key cho màn admin (không lộ giá trị). */
export async function keysStatus(): Promise<{
  configured: Record<LegId, boolean>;
  source: Record<LegId, 'db' | 'env' | null>;
}> {
  const stored = await loadStoredKeys();
  const configured = {} as Record<LegId, boolean>;
  const source = {} as Record<LegId, 'db' | 'env' | null>;
  for (const leg of LEG_IDS) {
    if (stored[leg]) {
      configured[leg] = true;
      source[leg] = 'db';
    } else if (process.env[ENV_KEY[leg]]) {
      configured[leg] = true;
      source[leg] = 'env';
    } else {
      configured[leg] = false;
      source[leg] = null;
    }
  }
  return { configured, source };
}
