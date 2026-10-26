import { getAdminClient, verifyUserToken, readBearer } from '../_lib/supabase.ts';
import { tryChain, allLegsBadRequest, DEFAULT_MODELS, LegConfig } from '../_lib/ai.ts';
import { resolveKeys, loadWorkersAiAccountId } from '../_lib/aiKeys.ts';

/**
 * POST /api/ai/chat — proxy AI cho giáo viên/admin.
 * - Bắt buộc JWT Supabase Auth (Bearer). Verify qua Auth API getUser
 *   (không xử lý signing secret). Không có JWT hợp lệ → 401.
 * - Đợt QA 26/10, blocker 7: chỉ role teacher/admin được gọi (học sinh →
 *   403). Đã grep: không tính năng học sinh nào gọi route này qua
 *   proxyClient (chỉ trợ lý phân tích + Studio của giáo viên).
 * - Giới hạn đầu vào (blocker 7): contents ≤ 50 phần, systemInstruction
 *   ≤ 20.000 ký tự, tools JSON ≤ 50.000 ký tự — chặn request khổng lồ
 *   đốt token/quota trước khi vào chain.
 * - Body theo dialect Gemini generateContent: { contents,
 *   systemInstruction?, tools? }. Trả về đúng shape đó để vòng lặp
 *   tool của trình duyệt không phải sửa.
 * - Chuỗi failover do admin cấu hình trong ai_settings (models + thứ
 *   tự + bật/tắt từng nấc); mặc định Gemini → Groq → OpenRouter →
 *   Workers AI (nấc cuối).
 * - Key chỉ nằm trong Vercel env, không bao giờ trả về client.
 * - Key: ưu tiên key admin nhập ở màn "Cấu hình Mầm AI" (ai_settings
 *   'ai_keys', chỉ service role đọc), fallback biến môi trường Vercel.
 *   Không bao giờ trả giá trị key về client.
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
  // Đợt QA 26/10, blocker 7: học sinh không được dùng proxy AI (trợ lý phân
  // tích + Studio đều là tính năng giáo viên; không caller học sinh nào).
  if (user.role !== 'teacher' && user.role !== 'admin') {
    res.status(403).json({ error: 'FORBIDDEN_ROLE' });
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
  // Đợt QA 26/10, blocker 7: giới hạn đầu vào trước khi vào chain.
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

  // Đợt QA 26/10, blocker 4: 12s/nấc + ngân sách tổng 50s — 4 nấc xấu nhất
  // 48s + overhead vẫn dưới maxDuration 60s của Vercel (plan Hobby), thay vì
  // 25s/nấc × 4 ≈ 100s bị Vercel cắt giữa chừng.
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
      const admin = getAdminClient();
      await admin.from('ai_usage').insert({
        leg: result.servedBy,
        model: result.legModel,
        prompt_tokens: u.prompt,
        completion_tokens: u.completion,
        total_tokens: u.total,
        user_id: user.id || null,
      });
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
}
