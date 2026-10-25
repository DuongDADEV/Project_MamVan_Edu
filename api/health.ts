import { getAdminClient } from './_lib/supabase.ts';
import { DEFAULT_MODELS } from './_lib/ai.ts';

/**
 * GET /api/health — no secrets, no keys in the response.
 * Used by the frontend to (a) prove /api is not swallowed by the SPA
 * rewrite, and (b) show whether the admin configured each AI leg.
 * Model names come from ai_settings when present, else defaults.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const ai: Record<string, { configured: boolean; model: string }> = {
    gemini: {
      configured: !!process.env.GEMINI_API_KEY,
      model: DEFAULT_MODELS.gemini,
    },
    groq: {
      configured: !!process.env.GROQ_API_KEY,
      model: DEFAULT_MODELS.groq,
    },
    openrouter: {
      configured: !!process.env.OPENROUTER_API_KEY,
      model: DEFAULT_MODELS.openrouter,
    },
    workersai: {
      configured: !!process.env.WORKERS_AI_API_KEY,
      model: DEFAULT_MODELS.workersai,
    },
  };
  try {
    const admin = getAdminClient();
    const { data } = await admin.from('ai_settings').select('key,value');
    for (const row of data || []) {
      const v: any = row.value || {};
      if (row.key === 'models' && v && typeof v === 'object') {
        for (const leg of Object.keys(ai)) {
          if (typeof v[leg] === 'string' && v[leg]) ai[leg].model = v[leg];
        }
      }
    }
  } catch {
    // ai_settings table may not exist yet (pre-migration) — defaults stand.
  }
  res.status(200).json({ ok: true, ai });
}
