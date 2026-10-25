import {
  getAdminClient,
  verifyUserToken,
  readBearer,
  isAdminUser,
} from '../_lib/supabase.ts';
import { DEFAULT_MODELS } from '../_lib/ai.ts';

/**
 * GET / POST /api/admin/ai-settings — cấu hình AI của admin.
 * Chỉ JWT có app_metadata.role = 'admin' mới được gọi. Đọc/ghi qua
 * service role vào bảng ai_settings (RLS chặn đọc trực tiếp từ
 * trình duyệt — xem migration 014/015).
 * GET trả về { models, order, enabled } (merge với mặc định).
 * POST nhận { models?, order?, enabled? } — chỉ ghi những gì gửi lên.
 * Model trống = quay về mặc định của nấc đó.
 */
const LEGS = ['gemini', 'groq', 'openrouter'];

export default async function handler(req: any, res: any) {
  const user = await verifyUserToken(readBearer(req));
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  const admin = getAdminClient();

  if (req.method === 'GET') {
    const out = {
      models: { ...DEFAULT_MODELS },
      order: [...LEGS],
      enabled: { gemini: true, groq: true, openrouter: true } as Record<string, boolean>,
    };
    try {
      const { data } = await admin.from('ai_settings').select('key,value');
      for (const row of data || []) {
        if (row.key === 'models' && row.value && typeof row.value === 'object') {
          for (const leg of LEGS) {
            if (typeof (row.value as any)[leg] === 'string' && (row.value as any)[leg]) {
              out.models[leg] = (row.value as any)[leg];
            }
          }
        }
        if (row.key === 'ai_chain' && Array.isArray((row.value as any)?.order)) {
          const o = (row.value as any).order.filter((l: string) => LEGS.includes(l));
          if (o.length) out.order = o;
        }
        if (row.key === 'ai_enabled' && row.value && typeof row.value === 'object') {
          for (const leg of LEGS) {
            if (typeof (row.value as any)[leg] === 'boolean') {
              out.enabled[leg] = (row.value as any)[leg];
            }
          }
        }
      }
    } catch {
      // Bảng chưa có — trả mặc định.
    }
    res.status(200).json(out);
    return;
  }

  if (req.method === 'POST') {
    let body: any = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    } catch {
      body = {};
    }
    const upserts: { key: string; value: any }[] = [];
    if (body.models && typeof body.models === 'object') {
      const models: Record<string, string> = {};
      for (const leg of LEGS) {
        const m = body.models[leg];
        if (typeof m === 'string' && m.trim()) models[leg] = m.trim();
      }
      if (Object.keys(models).length) upserts.push({ key: 'models', value: models });
    }
    if (Array.isArray(body.order)) {
      const o = body.order.filter((l: string) => LEGS.includes(l));
      if (o.length) upserts.push({ key: 'ai_chain', value: { order: o } });
    }
    if (body.enabled && typeof body.enabled === 'object') {
      const enabled: Record<string, boolean> = {};
      for (const leg of LEGS) {
        if (typeof body.enabled[leg] === 'boolean') enabled[leg] = body.enabled[leg];
      }
      if (Object.keys(enabled).length) {
        upserts.push({ key: 'ai_enabled', value: enabled });
      }
    }
    for (const row of upserts) {
      const { error } = await admin
        .from('ai_settings')
        .upsert(row, { onConflict: 'key' });
      if (error) {
        res.status(500).json({ error: 'SAVE_FAILED', detail: error.message });
        return;
      }
    }
    res.status(200).json({ ok: true, saved: upserts.map((u) => u.key) });
    return;
  }

  res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
