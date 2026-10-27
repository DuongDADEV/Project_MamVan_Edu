import { Router } from 'express';
import { query } from './_lib/mysql';
import { DEFAULT_MODELS } from './_lib/ai';
import { keysStatus } from './_lib/aiKeys';

/**
 * GET /api/health — no secrets, no keys in the response (GĐ3: MySQL,
 * KHÔNG còn Supabase). Mount router tại /api/health, route GET '/'.
 * Giữ nguyên shape cũ { ok, ai } và THÊM:
 * - db: { ok, error? } — kiểm tra thật bằng SELECT 1 trên MySQL.
 * - aiSettingsLoaded: true/false — model có đọc được từ ai_settings
 *   không. Lỗi DB thì báo rõ (db.ok=false, aiSettingsLoaded=false)
 *   chứ KHÔNG trả model mặc định một cách lặng lẽ như thể đó là
 *   cấu hình đã lưu (model vẫn là default để shape không vỡ, nhưng
 *   cờ nói rõ nguồn không phải DB).
 * - configured: key hiệu lực (DB hoặc env) có hay không — qua
 *   keysStatus() (chỉ boolean + nguồn, không lộ giá trị key).
 */
const router = Router();

router.get('/', async (_req, res) => {
  let dbOk = false;
  let dbError: string | null = null;
  try {
    await query('SELECT 1');
    dbOk = true;
  } catch (e: any) {
    dbError = String(e?.message || e).slice(0, 200);
  }
  const ai: Record<string, { configured: boolean; model: string }> = {
    gemini: { configured: !!process.env.GEMINI_API_KEY, model: DEFAULT_MODELS.gemini },
    groq: { configured: !!process.env.GROQ_API_KEY, model: DEFAULT_MODELS.groq },
    openrouter: { configured: !!process.env.OPENROUTER_API_KEY, model: DEFAULT_MODELS.openrouter },
    workersai: { configured: !!process.env.WORKERS_AI_API_KEY, model: DEFAULT_MODELS.workersai },
  };
  let aiSettingsLoaded = false;
  if (dbOk) {
    try {
      const rows = await query<any>('SELECT `key`, `value` FROM `ai_settings`');
      aiSettingsLoaded = true;
      for (const row of rows) {
        const v = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        if (row.key === 'models' && v && typeof v === 'object') {
          for (const leg of Object.keys(ai)) {
            if (typeof (v as any)[leg] === 'string' && (v as any)[leg]) ai[leg].model = (v as any)[leg];
          }
        }
      }
    } catch (e: any) {
      // Đọc ai_settings lỗi dù SELECT 1 đã ok: báo rõ, không dùng
      // model mặc định lặng.
      dbOk = false;
      dbError = String(e?.message || e).slice(0, 200);
      aiSettingsLoaded = false;
    }
  }
  try {
    const ks = await keysStatus();
    for (const leg of Object.keys(ai)) {
      ai[leg].configured = !!(ks.configured as any)[leg];
    }
  } catch {
    // Không xác định được key — giữ configured theo env.
  }
  res.status(200).json({
    ok: true,
    ai,
    db: dbOk ? { ok: true } : { ok: false, error: dbError || 'DB_ERROR' },
    aiSettingsLoaded,
  });
});

export default router;
