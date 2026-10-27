import { Router } from 'express';
import { query, execute, parseDbJson } from '../_lib/mysql';
import { requireAuth, requireRole } from '../_lib/auth';
import type { AuthedRequest } from '../_lib/auth';
import { tryChain, allLegsBadRequest, DEFAULT_MODELS } from '../_lib/ai';
import type { LegConfig } from '../_lib/ai';
import { resolveKeys, loadWorkersAiAccountId } from '../_lib/aiKeys';

/**
 * POST /api/ai/chat — proxy AI cho giáo viên/admin (GĐ3: MySQL + JWT mới,
 * KHÔNG còn Supabase). Mount router tại /api/ai/chat, route POST '/'.
 * - requireAuth -> 401 khi không JWT; requireRole teacher/admin ->
 *   học sinh 403 (giữ blocker 7 đợt QA 26/10).
 * - Giới hạn đầu vào: contents ≤ 50 phần, systemInstruction ≤ 20.000 ký
 *   tự, tools JSON ≤ 50.000 ký tự.
 * - Chuỗi failover từ ai_settings MySQL (models + thứ tự + bật/tắt);
 *   mặc định Gemini -> Groq -> OpenRouter -> Workers AI.
 * - Key: DB trước (ai_settings 'ai_keys'), env VPS fallback.
 * - Ghi ai_usage vào MySQL; lỗi ghi log không làm hỏng trả lời.
 * - Ngân sách: 12s/nấc, tổng 50s (giữ nguyên).
 */
const router = Router();
router.use(requireAuth, requireRole('teacher', 'admin'));

function scrub(text: string): string {
  return String(text || '')
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, '[key]')
    .replace(/gsk_[A-Za-z0-9]+/g, '[key]')
    .replace(/AIza[A-Za-z0-9_-]+/g, '[key]')
    .replace(/AQ\.[A-Za-z0-9_-]+/g, '[key]')
    .replace(/cfut_[A-Za-z0-9_-]+/g, '[key]')
    .slice(0, 200);
}

type AiSettings = {
  order?: string[];
  enabled?: Record<string, boolean>;
  models?: Record<string, string>;
};

async function loadSettings(): Promise<AiSettings> {
  try {
    const rows = await query<any>('SELECT `key`, `value` FROM `ai_settings`');
    const out: AiSettings = {};
    for (const row of rows) {
      const v = parseDbJson(row.value);
      if (row.key === 'ai_chain') out.order = (v as any)?.order;
      if (row.key === 'ai_enabled') out.enabled = v as any;
      if (row.key === 'models') out.models = v as any;
    }
    return out;
  } catch {
    return {};
  }
}

router.post('/', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    body = {};
  }
  const contents = body.contents;
  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json({ error: { kind: 'BAD_REQUEST', message: 'contents rỗng' } });
    return;
  }
  const systemInstruction =
    typeof body.systemInstruction === 'string'
      ? body.systemInstruction
      : body.systemInstruction?.parts?.map((p: any) => p.text || '').join('') || '';
  if (contents.length > 50 || systemInstruction.length > 20000) {
    res.status(413).json({ error: { kind: 'PAYLOAD_TOO_LARGE', message: 'contents hoặc systemInstruction vượt giới hạn' } });
    return;
  }
  if (body.tools && JSON.stringify(body.tools).length > 50000) {
    res.status(413).json({ error: { kind: 'PAYLOAD_TOO_LARGE', message: 'tools vượt giới hạn' } });
    return;
  }

  const settings = await loadSettings();
  const order = (settings.order || ['gemini', 'groq', 'openrouter', 'workersai']).filter((l) =>
    ['gemini', 'groq', 'openrouter', 'workersai'].includes(l)
  );
  const enabled = settings.enabled || {};
  const models = settings.models || {};
  const workersAiAccountId = await loadWorkersAiAccountId();
  const legs: LegConfig[] = order
    .filter((l) => enabled[l] !== false)
    .filter((l) => l !== 'workersai' || !!workersAiAccountId)
    .map((l) => ({
      leg: l as 'gemini' | 'groq' | 'openrouter' | 'workersai',
      model: models[l] || DEFAULT_MODELS[l],
      baseUrl:
        l === 'workersai' && workersAiAccountId
          ? `https://api.cloudflare.com/client/v4/accounts/${workersAiAccountId}/ai/v1`
          : undefined,
    }));
  const keys = await resolveKeys();

  const result = await tryChain(
    { contents, systemInstruction, tools: body.tools },
    legs,
    keys,
    12000,
    50000
  );

  if (result.parts) {
    // Ghi log token (không để lỗi ghi log làm hỏng câu trả lời).
    try {
      const u = result.usage || { prompt: 0, completion: 0, total: 0 };
      await execute(
        'INSERT INTO `ai_usage` (`leg`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `user_id`) VALUES (?, ?, ?, ?, ?, ?)',
        [result.servedBy, result.legModel, u.prompt, u.completion, u.total, caller.userId || null]
      );
    } catch {
      // Bỏ qua — thống kê thiếu 1 dòng còn hơn chat lỗi.
    }
    res.status(200).json({
      candidates: [
        {
          content: { role: 'model', parts: result.parts },
          finishReason: 'STOP',
        },
      ],
      servedBy: result.servedBy,
      legModel: result.legModel,
    });
    return;
  }

  const legsOut = result.outcomes.map((o) => ({
    leg: o.leg,
    model: o.model,
    status: o.status,
    message: scrub(o.message || ''),
  }));
  if (allLegsBadRequest(result.outcomes)) {
    res.status(400).json({ error: { kind: 'BAD_REQUEST', legs: legsOut } });
    return;
  }
  res.status(502).json({ error: { kind: 'PROVIDER_ERROR', legs: legsOut } });
});

export default router;
