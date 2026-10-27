import { Router } from 'express';
import { query, execute, parseDbJson } from '../_lib/mysql';
import { requireAuth, requireRole } from '../_lib/auth';
import { DEFAULT_MODELS } from '../_lib/ai';
import { keysStatus, loadStoredKeys, resolveKeys, workersAiAccountIdStatus } from '../_lib/aiKeys';

/**
 * GET / POST /api/admin/ai-settings — cấu hình AI của admin (GĐ3:
 * MySQL + JWT mới, KHÔNG còn Supabase). Mount router tại
 * /api/admin/ai-settings, route GET '/' + POST '/'.
 * Chỉ role admin. GET trả { models, order, enabled, keysConfigured,
 * keySource, workersaiAccountId, workersaiAccountIdSource, usage,
 * openrouter } (merge với mặc định; KHÔNG trả giá trị key).
 * POST nhận { models?, order?, enabled?, keys? } — chỉ upsert phần
 * gửi lên; khác bản gốc ở 1 điểm an toàn: models/enabled được
 * MERGE với giá trị đã lưu phía server (bản gốc thay cả object
 * models bằng đúng các nấc gửi lên, nên POST thiếu nấc sẽ xóa nấc
 * đó nếu client chưa merge — xem báo cáo). Model trống = giữ nguyên;
 * key trống = giữ nguyên key đã lưu.
 * Usage: tổng hợp từ bảng ai_usage. OpenRouter limit: gọi
 * https://openrouter.ai/api/v1/auth/key bằng key hiệu lực (DB trước,
 * env sau).
 */
const router = Router();
router.use(requireAuth, requireRole('admin'));

const LEGS = ['gemini', 'groq', 'openrouter', 'workersai'];

async function loadUsage(): Promise<any[]> {
  try {
    const rows = await query<any>(
      'SELECT `leg`, `model`, `total_tokens`, `created_at` FROM `ai_usage` ORDER BY `created_at` DESC LIMIT 5000'
    );
    const agg = new Map<string, any>();
    for (const row of rows) {
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

async function loadSettingValue(key: string): Promise<any | null> {
  try {
    const rows = await query<any>('SELECT `value` FROM `ai_settings` WHERE `key` = ? LIMIT 1', [key]);
    if (!rows[0]) return null;
    const v = rows[0].value;
    return parseDbJson(v);
  } catch {
    return null;
  }
}

async function upsertSetting(key: string, value: any): Promise<void> {
  await execute(
    'INSERT INTO `ai_settings` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, JSON.stringify(value)]
  );
}

router.get('/', async (_req, res) => {
  const out: any = {
    models: { ...DEFAULT_MODELS },
    order: [...LEGS],
    enabled: { gemini: true, groq: true, openrouter: true, workersai: true } as Record<string, boolean>,
    keysConfigured: { gemini: false, groq: false, openrouter: false, workersai: false },
    keySource: { gemini: null, groq: null, openrouter: null, workersai: null },
    usage: [] as any[],
    openrouter: null as any,
  };
  const models = await loadSettingValue('models');
  if (models && typeof models === 'object') {
    for (const leg of LEGS) {
      if (typeof (models as any)[leg] === 'string' && (models as any)[leg]) {
        out.models[leg] = (models as any)[leg];
      }
    }
  }
  const chain = await loadSettingValue('ai_chain');
  if (chain && Array.isArray((chain as any)?.order)) {
    const o = (chain as any).order.filter((l: string) => LEGS.includes(l));
    if (o.length) out.order = o;
  }
  const enabled = await loadSettingValue('ai_enabled');
  if (enabled && typeof enabled === 'object') {
    for (const leg of LEGS) {
      if (typeof (enabled as any)[leg] === 'boolean') {
        out.enabled[leg] = (enabled as any)[leg];
      }
    }
  }
  try {
    const acct = await workersAiAccountIdStatus();
    out.workersaiAccountId = acct.value || null;
    out.workersaiAccountIdSource = acct.source;
  } catch {
    out.workersaiAccountId = null;
    out.workersaiAccountIdSource = null;
  }
  try {
    const ks = await keysStatus();
    out.keysConfigured = ks.configured;
    out.keySource = ks.source;
  } catch {
    // Không xác định được key — để mặc định false.
  }
  out.usage = await loadUsage();
  out.openrouter = await loadOpenRouterLimit();
  res.status(200).json(out);
});

router.post('/', async (req, res) => {
  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    body = {};
  }
  const upserts: { key: string; value: any }[] = [];
  if (body.models && typeof body.models === 'object') {
    // MERGE phía server (khác bản gốc: bản gốc thay cả object).
    const cur = (await loadSettingValue('models')) || {};
    const models: Record<string, string> = { ...(typeof cur === 'object' ? cur : {}) };
    for (const leg of LEGS) {
      const m = body.models[leg];
      if (typeof m === 'string' && m.trim()) models[leg] = m.trim();
    }
    upserts.push({ key: 'models', value: models });
  }
  if (Array.isArray(body.order)) {
    const o = body.order.filter((l: string) => LEGS.includes(l));
    if (o.length) upserts.push({ key: 'ai_chain', value: { order: o } });
  }
  if (body.enabled && typeof body.enabled === 'object') {
    const cur = (await loadSettingValue('ai_enabled')) || {};
    const enabled: Record<string, boolean> = { ...(typeof cur === 'object' ? cur : {}) };
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
  if (typeof body.workersaiAccountId === 'string' && body.workersaiAccountId.trim()) {
    upserts.push({ key: 'workersai_account_id', value: body.workersaiAccountId.trim() });
  }
  try {
    for (const row of upserts) {
      await upsertSetting(row.key, row.value);
    }
  } catch (e: any) {
    res.status(500).json({ error: 'SAVE_FAILED', detail: String(e?.message || e).slice(0, 200) });
    return;
  }
  res.status(200).json({ ok: true, saved: upserts.map((u) => u.key) });
});

export default router;
