import {
  verifyUserToken,
  readBearer,
  isAdminUser,
} from '../_lib/supabase.ts';
import { resolveKeys } from '../_lib/aiKeys.ts';

/**
 * POST /api/admin/gemini-models — liệt kê model mà key Gemini hiệu dụng
 * (DB trước, env fallback) nhìn thấy qua ListModels. Chỉ JWT admin.
 * Trả về tên model + phương thức hỗ trợ, KHÔNG trả key. Lưu ý: ListModels
 * từng liệt kê cả tên đã bị Google khai tử (gọi thật thì 404) nên con số
 * này là "key nhìn thấy", không phải "model nào cũng gọi được".
 */
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
  try {
    const models: any[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 5; page++) {
      const url =
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100' +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
      const r = await fetch(url, {
        headers: { 'X-goog-api-key': apiKey },
        signal: AbortSignal.timeout(30000),
      });
      const json: any = await r.json().catch(() => null);
      if (!r.ok) {
        res.status(200).json({
          ok: false,
          error: 'LIST_FAILED',
          status: r.status,
          message: String(json?.error?.message || `HTTP ${r.status}`).slice(0, 200),
        });
        return;
      }
      for (const m of json?.models || []) {
        models.push({
          name: String(m?.name || '').replace(/^models\//, ''),
          displayName: m?.displayName || null,
          methods: Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [],
        });
      }
      pageToken = json?.nextPageToken;
      if (!pageToken) break;
    }
    const generatable = models.filter((m) => m.methods.includes('generateContent'));
    res.status(200).json({
      ok: true,
      total: models.length,
      generateContentCount: generatable.length,
      models,
    });
  } catch (e: any) {
    res.status(200).json({ ok: false, error: 'NETWORK', message: String(e?.message || e).slice(0, 200) });
  }
}
