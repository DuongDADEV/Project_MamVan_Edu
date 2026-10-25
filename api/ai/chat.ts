import { getAdminClient, verifyUserToken, readBearer } from '../_lib/supabase.ts';
import { tryChain, allLegsBadRequest, DEFAULT_MODELS, LegConfig } from '../_lib/ai.ts';

/**
 * POST /api/ai/chat — proxy AI cho giáo viên/học sinh.
 * - Bắt buộc JWT Supabase Auth (Bearer). Verify qua Auth API getUser
 *   (không xử lý signing secret). Không có JWT hợp lệ → 401.
 * - Body theo dialect Gemini generateContent: { contents,
 *   systemInstruction?, tools? }. Trả về đúng shape đó để vòng lặp
 *   tool của trình duyệt không phải sửa.
 * - Chuỗi failover do admin cấu hình trong ai_settings (models + thứ
 *   tự + bật/tắt từng nấc); mặc định Gemini → Groq → OpenRouter.
 * - Key chỉ nằm trong Vercel env, không bao giờ trả về client.
 * - Lỗi: mọi nấc 400 → BAD_REQUEST (trình duyệt hiển thị gợi ý sửa
 *   câu hỏi); ngược lại PROVIDER_ERROR kèm kết quả từng nấc (đã lược
 *   bỏ mọi chuỗi trông giống key).
 */

function scrub(text: string): string {
  return String(text || '')
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, '[key]')
    .replace(/gsk_[A-Za-z0-9]+/g, '[key]')
    .replace(/AIza[A-Za-z0-9_-]+/g, '[key]')
    .replace(/AQ\.[A-Za-z0-9_-]+/g, '[key]')
    .slice(0, 200);
}

type AiSettings = {
  order?: string[];
  enabled?: Record<string, boolean>;
  models?: Record<string, string>;
};

async function loadSettings(): Promise<AiSettings> {
  try {
    const admin = getAdminClient();
    const { data } = await admin.from('ai_settings').select('key,value');
    const out: AiSettings = {};
    for (const row of data || []) {
      if (row.key === 'ai_chain') out.order = (row.value as any)?.order;
      if (row.key === 'ai_enabled') out.enabled = row.value as any;
      if (row.key === 'models') out.models = row.value as any;
    }
    return out;
  } catch {
    return {};
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const user = await verifyUserToken(readBearer(req));
  if (!user) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
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

  const settings = await loadSettings();
  const order = (settings.order || ['gemini', 'groq', 'openrouter']).filter((l) =>
    ['gemini', 'groq', 'openrouter'].includes(l)
  );
  const enabled = settings.enabled || {};
  const models = settings.models || {};
  const legs: LegConfig[] = order
    .filter((l) => enabled[l] !== false)
    .map((l) => ({
      leg: l as 'gemini' | 'groq' | 'openrouter',
      model: models[l] || DEFAULT_MODELS[l],
    }));
  const keys: Record<string, string> = {
    gemini: process.env.GEMINI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
  };

  const result = await tryChain(
    { contents, systemInstruction, tools: body.tools },
    legs,
    keys,
    25000
  );

  if (result.parts) {
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
}
