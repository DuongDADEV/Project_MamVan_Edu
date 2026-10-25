import { getAdminClient } from './supabase.ts';

/**
 * Nguồn key cho chuỗi AI (đợt 25/10 — ô nhập key ở màn admin).
 * Thứ tự ưu tiên: key admin nhập trong màn "Cấu hình Mầm AI" (lưu
 * vào ai_settings key 'ai_keys', chỉ service role đọc được) rồi mới
 * tới biến môi trường Vercel (GEMINI_API_KEY / GROQ_API_KEY /
 * OPENROUTER_API_KEY). Route admin KHÔNG BAO GIỜ trả giá trị key
 * về trình duyệt — chỉ trả "đã cấu hình" + nguồn ('db' | 'env').
 */

export type LegId = 'gemini' | 'groq' | 'openrouter';
export const LEG_IDS: LegId[] = ['gemini', 'groq', 'openrouter'];

const ENV_KEY: Record<LegId, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/** Key đã lưu trong ai_settings (không có thì {}). */
export async function loadStoredKeys(): Promise<Partial<Record<LegId, string>>> {
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from('ai_settings')
      .select('value')
      .eq('key', 'ai_keys')
      .maybeSingle();
    const v = (data as any)?.value;
    if (v && typeof v === 'object') {
      const out: Partial<Record<LegId, string>> = {};
      for (const leg of LEG_IDS) {
        if (typeof v[leg] === 'string' && v[leg]) out[leg] = v[leg];
      }
      return out;
    }
  } catch {
    // Bảng chưa có hoặc chưa lưu key — coi như không có.
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
