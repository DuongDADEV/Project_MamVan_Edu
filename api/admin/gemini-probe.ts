import {
  verifyUserToken,
  readBearer,
  isAdminUser,
} from '../_lib/supabase.ts';
import { resolveKeys } from '../_lib/aiKeys.ts';

/**
 * POST /api/admin/gemini-probe — gọi thử generateContent thật (prompt "hi",
 * maxOutputTokens=1) cho từng model Gemini để biết model nào DÙNG ĐƯỢC.
 * Chỉ JWT admin. Body: { names?: string[] } — không gửi names thì probe
 * toàn bộ model generateContent từ ListModels. Trả về từng model: ok,
 * http status, latency, usage của chính lượt probe (KHÔNG phải số token
 * còn lại — Gemini không có API xem token còn lại; 429 lúc probe nghĩa
 * là model đó hết lượt tại thời điểm đó). Không trả key.
 */
function scrub(text: string): string {
  return String(text || '')
    .replace(/AIza[A-Za-z0-9_-]+/g, '[key]')
    .replace(/AQ\.[A-Za-z0-9_-]+/g, '[key]')
    .slice(0, 200);
}

async function probeOne(apiKey: string, name: string): Promise<any> {
  const started = Date.now();
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(name)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'hi' }] }],
          generationConfig: { maxOutputTokens: 1, temperature: 0 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const json: any = await r.json().catch(() => null);
    const usage = json?.usageMetadata || null;
    return {
      name,
      ok: r.ok,
      status: r.status,
      latencyMs: Date.now() - started,
      message: r.ok ? null : scrub(json?.error?.message || `HTTP ${r.status}`),
      promptTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage?.candidatesTokenCount ?? null,
    };
  } catch (e: any) {
    return {
      name,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      message: scrub(e?.message || 'network'),
      promptTokens: null,
      outputTokens: null,
    };
  }
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
  const keys = await resolveKeys();
  const apiKey = keys.gemini;
  if (!apiKey) {
    res.status(200).json({ ok: false, error: 'GEMINI_KEY_NOT_CONFIGURED' });
    return;
  }
  let names: string[] = Array.isArray((req.body as any)?.names)
    ? (req.body as any).names.filter((n: any) => typeof n === 'string' && n)
    : [];
  if (!names.length) {
    // Không chỉ định → lấy toàn bộ model generateContent từ ListModels.
    try {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',
        { headers: { 'X-goog-api-key': apiKey }, signal: AbortSignal.timeout(30000) }
      );
      const json: any = await r.json().catch(() => null);
      names = (json?.models || [])
        .filter((m: any) => (m?.supportedGenerationMethods || []).includes('generateContent'))
        .map((m: any) => String(m?.name || '').replace(/^models\//, ''))
        .filter(Boolean);
    } catch {
      res.status(200).json({ ok: false, error: 'LIST_FAILED' });
      return;
    }
  }
  // Chạy song song theo đợt 6 để nhanh mà không dồn dập (mỗi model chỉ 1
  // lượt gọi nhỏ, không đáng kể so với hạn mức ngày của từng model).
  const results: any[] = [];
  for (let i = 0; i < names.length; i += 6) {
    const chunk = names.slice(i, i + 6);
    const part = await Promise.all(chunk.map((n) => probeOne(apiKey, n)));
    results.push(...part);
  }
  res.status(200).json({ ok: true, count: results.length, results });
}
