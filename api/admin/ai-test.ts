import { Router } from 'express';
import { query, parseDbJson } from '../_lib/mysql';
import { requireAuth, requireRole } from '../_lib/auth';
import { testLeg, DEFAULT_MODELS } from '../_lib/ai';
import { resolveKeys, workersAiAccountIdStatus } from '../_lib/aiKeys';

/**
 * POST /api/admin/ai-test — admin test từng nấc AI (GĐ3: MySQL + JWT
 * mới, KHÔNG còn Supabase). Mount router tại /api/admin/ai-test.
 * Chỉ role admin. Prompt cực ngắn, timeout 12s/nấc. Trả về kết quả
 * từng nấc (kể cả nấc sau khi 1 nấc đã ok) + latency. Không trả key,
 * thông báo lỗi đã lược bỏ chuỗi giống key.
 */
const router = Router();
router.use(requireAuth, requireRole('admin'));

const LEGS = ['gemini', 'groq', 'openrouter', 'workersai'] as const;

function scrub(text: string): string {
  return String(text || '')
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, '[key]')
    .replace(/gsk_[A-Za-z0-9]+/g, '[key]')
    .replace(/AIza[A-Za-z0-9_-]+/g, '[key]')
    .replace(/AQ\.[A-Za-z0-9_-]+/g, '[key]')
    .replace(/cfut_[A-Za-z0-9_-]+/g, '[key]')
    .slice(0, 200);
}

router.post('/', async (_req, res) => {
  let models: Record<string, string> = { ...DEFAULT_MODELS };
  let order: string[] = [...LEGS];
  try {
    const rows = await query<any>('SELECT `key`, `value` FROM `ai_settings`');
    for (const row of rows) {
      const v = parseDbJson(row.value);
      if (row.key === 'models' && v && typeof v === 'object') {
        for (const leg of LEGS) {
          if (typeof (v as any)[leg] === 'string' && (v as any)[leg]) {
            models[leg] = (v as any)[leg];
          }
        }
      }
      if (row.key === 'ai_chain' && Array.isArray((v as any)?.order)) {
        const o = (v as any).order.filter((l: string) =>
          (LEGS as readonly string[]).includes(l)
        );
        if (o.length) order = o;
      }
    }
  } catch {
    // Bảng chưa có — dùng mặc định.
  }
  const keys = await resolveKeys();
  const workersAcct = await workersAiAccountIdStatus();
  const legs = [];
  for (const leg of order) {
    const key = (keys as Record<string, string>)[leg];
    if (!key) {
      legs.push({ leg, model: models[leg], configured: false, ok: false });
      continue;
    }
    if (leg === 'workersai' && !workersAcct.value) {
      legs.push({ leg, model: models[leg], configured: false, ok: false, message: 'Chưa có Account ID Cloudflare' });
      continue;
    }
    const outcome = await testLeg(
      leg as 'gemini' | 'groq' | 'openrouter' | 'workersai',
      models[leg],
      key,
      12000,
      leg === 'workersai' && workersAcct.value
        ? `https://api.cloudflare.com/client/v4/accounts/${workersAcct.value}/ai/v1`
        : undefined
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
});

export default router;
