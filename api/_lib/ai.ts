/**
 * Provider chain for the teacher assistant + content generation.
 *
 * The browser keeps talking the Gemini generateContent dialect
 * (contents / systemInstruction / functionDeclarations, and it reads
 * candidates[0].content.parts with functionCall / text). The proxy
 * translates that dialect to OpenAI chat completions for the Groq and
 * OpenRouter legs and translates the answer back, so the browser tool
 * loop does not change at all.
 *
 * Failover rule: one attempt per leg, in admin-configured order.
 * No retries on the same leg (no hammering, the lesson from the
 * 2026-10-25 quota saga). A leg failure moves to the next leg; only
 * when every leg fails does the proxy answer with an error.
 */

export type GeminiPart = { text?: string; functionCall?: { name: string; args: any } };
export type GeminiContent = { role: string; parts: GeminiPart[] };

export type TokenUsage = {
  prompt: number;
  completion: number;
  total: number;
};

export type LegOutcome = {
  leg: string;
  model: string;
  ok: boolean;
  status?: number;
  message?: string;
  latencyMs: number;
  usage?: TokenUsage;
};

export type LegConfig = { leg: 'gemini' | 'groq' | 'openrouter'; model: string };

export const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-3.8-flash',
  groq: 'openai/gpt-oss-120b',
  openrouter: 'google/gemma-4-31b-it:free',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

function geminiRoleToOpenAI(role: string): 'user' | 'assistant' | 'system' {
  if (role === 'model') return 'assistant';
  if (role === 'function') return 'user';
  return 'user';
}

/** Chuyển schema kiểu Gemini (type VIẾT HOA: OBJECT/STRING/...) sang JSON
 * Schema chuẩn (type thường: object/string/...) mà các leg OpenAI-dialect
 * (Groq, OpenRouter) bắt buộc — Groq validate parameters theo metaschema
 * nên type viết hoa bị 400 "not valid against metaschema", khiến cả
 * chuỗi fallback sập khi Gemini không gánh được. Đệ quy mọi nhánh
 * (properties/items/...) và mọi dạng type (string hoặc mảng string). */
export function convertGeminiSchema(s: any): any {
  if (Array.isArray(s)) return s.map(convertGeminiSchema);
  if (s && typeof s === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(s)) {
      if (k === 'type' && typeof v === 'string') out[k] = v.toLowerCase();
      else if (k === 'type' && Array.isArray(v)) out[k] = v.map((t: any) => (typeof t === 'string' ? t.toLowerCase() : t));
      else out[k] = convertGeminiSchema(v);
    }
    return out;
  }
  return s;
}

/**
 * Convert Gemini contents + function declarations to OpenAI messages +
 * tools. Function-response turns (role 'function') become user messages
 * carrying the tool results, because OpenAI has no 'function' role —
 * tool results travel as role 'tool' messages paired with the preceding
 * assistant tool_calls, which we rebuild from the model turn.
 */
export function geminiToOpenAI(
  contents: GeminiContent[],
  systemPrompt: string,
  functionDeclarations: any[] | undefined
): { messages: any[]; tools: any[] | undefined } {
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  let pendingToolCalls: any[] = [];
  for (const content of contents) {
    const role = content.role;
    if (role === 'model') {
      const toolCalls: any[] = [];
      const texts: string[] = [];
      for (const part of content.parts || []) {
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${part.functionCall.name}_${toolCalls.length}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          });
        } else if (typeof part.text === 'string') {
          texts.push(part.text);
        }
      }
      const msg: any = { role: 'assistant', content: texts.join('') || null };
      if (toolCalls.length) msg.tool_calls = toolCalls;
      messages.push(msg);
      pendingToolCalls = toolCalls;
    } else if (role === 'function') {
      for (const part of content.parts || []) {
        const fr: any = (part as any).functionResponse;
        if (!fr) continue;
        const match = pendingToolCalls.find(
          (t) => t.function.name === fr.name
        );
        messages.push({
          role: 'tool',
          tool_call_id: match ? match.id : `call_${fr.name}_0`,
          content: JSON.stringify(fr.response?.result ?? fr.response ?? {}),
        });
      }
      pendingToolCalls = [];
    } else {
      const text = (content.parts || [])
        .map((p) => (typeof p.text === 'string' ? p.text : ''))
        .join('');
      messages.push({ role: 'user', content: text });
    }
  }
const tools =
    functionDeclarations && functionDeclarations.length
      ? functionDeclarations.map((d: any) => ({
          type: 'function',
          function: {
            name: d.name,
            description: d.description || '',
            parameters: d.parameters ? convertGeminiSchema(d.parameters) : { type: 'object', properties: {} },
          },
        }))
      : undefined;
  return { messages, tools };
}

/** Convert an OpenAI chat completion back to Gemini-style parts. */
export function openAiToGeminiParts(choice: any): GeminiPart[] {
  const parts: GeminiPart[] = [];
  const msg = choice?.message || {};
  if (typeof msg.content === 'string' && msg.content) {
    parts.push({ text: msg.content });
  }
  for (const tc of msg.tool_calls || []) {
    let args: any = {};
    try {
      args = JSON.parse(tc.function?.arguments || '{}');
    } catch {
      args = {};
    }
    parts.push({ functionCall: { name: tc.function?.name || '', args } });
  }
  return parts;
}

async function fetchJson(
  url: string,
  init: any,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; json: any }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  } catch (err: any) {
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiLeg(
  model: string,
  apiKey: string,
  body: any,
  timeoutMs: number
): Promise<{ parts: GeminiPart[] | null; outcome: LegOutcome }> {
  const started = Date.now();
  const url = `${GEMINI_BASE}/${model}:generateContent`;
  const generationConfig: any = { temperature: 0.2, maxOutputTokens: 4096 };
  if (model.includes('flash')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  // gemini-3.x từ chối role 'function' (400 "Role 'function' is not supported"):
  // functionResponse phải nằm trong content role 'user' (chuẩn mới). Vòng
  // lặp tool của frontend vẫn giữ role 'function' vì leg OpenAI-dialect cần
  // nó để dựng tool message — chỉ đổi ở đây, ngay trước khi gửi Google.
  const geminiBody: any = { ...body };
  if (Array.isArray(body?.contents)) {
    geminiBody.contents = body.contents.map((c: any) =>
      c?.role === 'function' ? { ...c, role: 'user' } : c
    );
  }
  const { ok, status, json } = await fetchJson(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      body: JSON.stringify({ ...geminiBody, generationConfig }),
    },
    timeoutMs
  );
  const latencyMs = Date.now() - started;
  if (!ok) {
    const message = json?.error?.message || `HTTP ${status || 'network'}`;
    return {
      parts: null,
      outcome: { leg: 'gemini', model, ok: false, status, message, latencyMs },
    };
  }
  const parts = (json?.candidates?.[0]?.content?.parts || []) as GeminiPart[];
  const um = json?.usageMetadata || {};
  const usage: TokenUsage = {
    prompt: Number(um.promptTokenCount || 0),
    completion: Number(um.candidatesTokenCount || 0),
    total: Number(um.totalTokenCount || 0),
  };
  return { parts, outcome: { leg: 'gemini', model, ok: true, status, latencyMs, usage } };
}

async function callOpenAiLeg(
  leg: 'groq' | 'openrouter',
  model: string,
  apiKey: string,
  contents: GeminiContent[],
  systemPrompt: string,
  functionDeclarations: any[] | undefined,
  timeoutMs: number
): Promise<{ parts: GeminiPart[] | null; outcome: LegOutcome }> {
  const started = Date.now();
  const base = leg === 'groq' ? GROQ_BASE : OPENROUTER_BASE;
  const { messages, tools } = geminiToOpenAI(contents, systemPrompt, functionDeclarations);
  const headers: any = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (leg === 'openrouter') {
    headers['HTTP-Referer'] = 'https://mamvan.vercel.app';
    headers['X-Title'] = 'Mam Van';
  }
  const { ok, status, json } = await fetchJson(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        tools,
        temperature: 0.2,
        max_tokens: 4096,
      }),
    },
    timeoutMs
  );
  const latencyMs = Date.now() - started;
  if (!ok) {
    const message =
      json?.error?.message || json?.error?.code || `HTTP ${status || 'network'}`;
    return {
      parts: null,
      outcome: { leg, model, ok: false, status, message, latencyMs },
    };
  }
  const choice = json?.choices?.[0];
  const parts = openAiToGeminiParts(choice);
  if (!parts.length) {
    return {
      parts: null,
      outcome: { leg, model, ok: false, status, message: 'EMPTY_RESPONSE', latencyMs },
    };
  }
  const u = json?.usage || {};
  const usage: TokenUsage = {
    prompt: Number(u.prompt_tokens || 0),
    completion: Number(u.completion_tokens || 0),
    total: Number(u.total_tokens || 0),
  };
  return { parts, outcome: { leg, model, ok: true, status, latencyMs, usage } };
}

export type ChainRequest = {
  contents: GeminiContent[];
  systemInstruction?: string;
  tools?: any[];
};

export type ChainResult = {
  parts: GeminiPart[] | null;
  servedBy: string | null;
  legModel: string | null;
  outcomes: LegOutcome[];
  usage?: TokenUsage;
};

/**
 * Try each configured leg once, in order. `keys` carries only the legs
 * the admin actually configured (missing key => leg skipped silently).
 */
export async function tryChain(
  req: ChainRequest,
  legs: LegConfig[],
  keys: Record<string, string>,
  timeoutPerLegMs = 60000
): Promise<ChainResult> {
  const outcomes: LegOutcome[] = [];
  const systemPrompt = req.systemInstruction || '';
  const functionDeclarations = req.tools?.[0]?.functionDeclarations;
  for (const leg of legs) {
    const key = keys[leg.leg];
    if (!key) continue;
    if (leg.leg === 'gemini') {
      const body: any = {
        contents: req.contents,
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        tools: req.tools,
      };
      const r = await callGeminiLeg(leg.model, key, body, timeoutPerLegMs);
      outcomes.push(r.outcome);
      if (r.parts) {
        return { parts: r.parts, servedBy: 'gemini', legModel: leg.model, outcomes, usage: r.outcome.usage };
      }
    } else {
      const r = await callOpenAiLeg(
        leg.leg,
        leg.model,
        key,
        req.contents,
        systemPrompt,
        functionDeclarations,
        timeoutPerLegMs
      );
      outcomes.push(r.outcome);
      if (r.parts) {
        return { parts: r.parts, servedBy: leg.leg, legModel: leg.model, outcomes, usage: r.outcome.usage };
      }
    }
  }
  return { parts: null, servedBy: null, legModel: null, outcomes };
}

/**
 * Test 1 nấc duy nhất với prompt cực ngắn, dùng cho route admin
 * ai-test (cần kết quả từng nấc, kể cả khi nấc trước đã ok — khác
 * tryChain vốn dừng ở nấc đầu tiên thành công).
 */
export async function testLeg(
  leg: 'gemini' | 'groq' | 'openrouter',
  model: string,
  key: string,
  timeoutMs = 15000
): Promise<LegOutcome> {
  const contents: GeminiContent[] = [
    { role: 'user', parts: [{ text: 'Trả lời đúng một từ: ok' }] },
  ];
  if (leg === 'gemini') {
    const r = await callGeminiLeg(model, key, { contents }, timeoutMs);
    return r.outcome;
  }
  const r = await callOpenAiLeg(leg, model, key, contents, '', undefined, timeoutMs);
  return r.outcome;
}

export function allLegsBadRequest(outcomes: LegOutcome[]): boolean {
  return (
    outcomes.length > 0 && outcomes.every((o) => o.status === 400)
  );
}
