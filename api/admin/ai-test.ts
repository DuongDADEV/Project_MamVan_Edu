import {
  getAdminClient,
  verifyUserToken,
  readBearer,
  isAdminUser,
} from '../_lib/supabase.ts';
import { testLeg, DEFAULT_MODELS } from '../_lib/ai.ts';
import { resolveKeys } from '../_lib/aiKeys.ts';

/**
 * POST /api/admin/ai-test — admin test từng nấc AI.
 * Chỉ JWT admin. Prompt cực ngắn, timeout 30s/nấc. Trả về kết quả
 * từng nấc (kể cả nấc sau khi 1 nấc đã ok) + latency. Không trả key,
 * thông báo lỗi đã lược bỏ chuỗi giống key.
 */
const LEGS = ['gemini', 'groq', 'openrouter'] as const;

function scrub(text: string): string {
  return String(text || '')
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, '[key]')
    .replace(/gsk_[A-Za-z0-9]+/g, '[key]')
    .replace(/AIza[A-Za-z0-9_-]+/g, '[key]')
    .replace(/AQ\.[A-Za-z0-9_-]+/g, '[key]')
    .slice(0, 200);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const user = await verifyUserToken(readBearer(req));
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  let models: Record<string, string> = { ...DEFAULT_MODELS };
  let order: string[] = [...LEGS];
  try {
    const admin = getAdminClient();
    const { data } = await admin.from('ai_settings').select('key,value');
    for (const row of data || []) {
      if (row.key === 'models' && row.value && typeof row.value === 'object') {
        for (const leg of LEGS) {
          if (typeof (row.value as any)[leg] === 'string' && (row.value as any)[leg]) {
            models[leg] = (row.value as any)[leg];
          }
        }
      }
      if (row.key === 'ai_chain' && Array.isArray((row.value as any)?.order)) {
        const o = (row.value as any).order.filter((l: string) =>
          (LEGS as readonly string[]).includes(l)
        );
        if (o.length) order = o;
      }
    }
  } catch {
    // Bảng chưa có — dùng mặc định.
  }
  const keys = await resolveKeys();
  const legs = [];
  for (const leg of order) {
    const key = (keys as Record<string, string>)[leg];
    if (!key) {
      legs.push({ leg, model: models[leg], configured: false, ok: false });
      continue;
    }
    const outcome = await testLeg(
      leg as 'gemini' | 'groq' | 'openrouter',
      models[leg],
      key
    );
    legs.push({
      leg,
      model: models[leg],
      configured: true,
      ok: outcome.ok,
      status: outcome.status,
      latencyMs: outcome.latencyMs,
      message: outcome.ok ? undefined : scrub(outcome.message || ''),
    });
  }
  res.status(200).json({ ok: true, legs });
}
