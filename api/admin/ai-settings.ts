import {
  getAdminClient,
  verifyUserToken,
  readBearer,
  isAdminUser,
} from '../_lib/supabase.ts';
import { DEFAULT_MODELS } from '../_lib/ai.ts';
import { keysStatus, loadStoredKeys, resolveKeys } from '../_lib/aiKeys.ts';

/**
 * GET / POST /api/admin/ai-settings — cấu hình AI của admin.
 * Chỉ JWT có app_metadata.role = 'admin' mới được gọi. Đọc/ghi qua
 * service role vào bảng ai_settings (RLS chặn đọc trực tiếp từ
 * trình duyệt — xem migration 014/015).
 * GET trả về { models, order, enabled, keysConfigured, keySource,
 * usage, openrouter } (merge với mặc định; KHÔNG trả giá trị key).
 * POST nhận { models?, order?, enabled?, keys? } — chỉ ghi những gì
 * gửi lên. Model trống = giữ nguyên; key trống = giữ nguyên key đã lưu.
 * Usage: tổng hợp từ bảng ai_usage (migration 017). OpenRouter limit:
 * gọi https://openrouter.ai/api/v1/auth/key bằng key hiệu lực (DB
 * trước, env sau); Gemini/Groq không có API xem giới hạn còn lại nên
 * chỉ thống kê đã dùng.
 */
const LEGS = ['gemini', 'groq', 'openrouter'];

async function loadUsage(admin: any): Promise<any[]> {
  try {
    const { data, error } = await admin
      .from('ai_usage')
      .select('leg,model,total_tokens,created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error || !data) return [];
    const agg = new Map<string, any>();
    for (const row of data) {
      const k = `${row.leg}|||${row.model}`;
      const cur = agg.get(k) || {
        leg: row.leg,
        model: row.model,
        calls: 0,
        totalTokens: 0,
        lastAt: null as string | null,
      };
      cur.calls++;
      cur.totalTokens += Number(row.total_tokens || 0);
      if (!cur.lastAt || (row.created_at && row.created_at > cur.lastAt)) {
        cur.lastAt = row.created_at;
      }
      agg.set(k, cur);
    }
    return [...agg.values()].sort((a, b) => b.totalTokens - a.totalTokens);
  } catch {
    return [];
  }
}

async function loadOpenRouterLimit(): Promise<{ used: number; limit: number | null } | null> {
  try {
    const keys = await resolveKeys();
    if (!keys.openrouter) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${keys.openrouter}` },
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const json: any = await res.json();
      const d = json?.data || {};
      return {
        used: Number(d.usage || 0),
        limit: typeof d.limit === 'number' ? d.limit : null,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  const user = await verifyUserToken(readBearer(req));
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  const admin = getAdminClient();

  if (req.method === 'GET') {
    const out: any = {
      models: { ...DEFAULT_MODELS },
      order: [...LEGS],
      enabled: { gemini: true, groq: true, openrouter: true } as Record<string, boolean>,
      keysConfigured: { gemini: false, groq: false, openrouter: false },
      keySource: { gemini: null, groq: null, openrouter: null },
      usage: [] as any[],
      openrouter: null as any,
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
    try {
      const ks = await keysStatus();
      out.keysConfigured = ks.configured;
      out.keySource = ks.source;
    } catch {
      // Không xác định được key — để mặc định false.
    }
    out.usage = await loadUsage(admin);
    out.openrouter = await loadOpenRouterLimit();
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
    if (body.keys && typeof body.keys === 'object') {
      // Key trống = giữ nguyên key đã lưu (không xóa, không lộ lại).
      const stored = await loadStoredKeys();
      let changed = false;
      for (const leg of LEGS) {
        const k = body.keys[leg];
        if (typeof k === 'string' && k.trim()) {
          (stored as any)[leg] = k.trim();
          changed = true;
        }
      }
      if (changed) upserts.push({ key: 'ai_keys', value: stored });
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
