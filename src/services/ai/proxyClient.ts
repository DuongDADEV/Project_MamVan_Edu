/**
 * Client gọi AI qua proxy của admin (đợt 25/10).
 * Trình duyệt KHÔNG giữ key, KHÔNG gọi thẳng Google/Groq/OpenRouter nữa:
 * mọi call đi qua /api/ai/chat cùng origin, kèm JWT Supabase Auth để
 * proxy verify (Auth API getUser). Failover Gemini → Groq → OpenRouter
 * và key đều nằm phía server (Vercel env của admin).
 * Response giữ đúng shape Gemini generateContent để vòng lặp tool của
 * trợ lý không phải sửa: { candidates: [{ content: { parts } }] }.
 */
import { supabase } from '../supabase/client.ts';

export interface ProxyChatError extends Error {
  status?: number;
  kind?: string;
  legs?: any[];
}

export async function callAiProxy(body: {
  contents: any[];
  systemInstruction?: string;
  tools?: any[];
}): Promise<any> {
  const { data: sb } = await supabase.auth.getSession();
  const token = sb?.session?.access_token;
  if (!token) {
    const err: ProxyChatError = new Error(
      'Chưa đăng nhập nên không gọi được AI. Thầy/cô đăng nhập lại giúp em.'
    );
    err.status = 401;
    throw err;
  }
  let res: Response;
  try {
    res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    const err: ProxyChatError = new Error(
      'Không kết nối được máy chủ AI. Thầy/cô kiểm tra mạng rồi thử lại.'
    );
    throw err;
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const kind = json?.error?.kind as string | undefined;
    const err: ProxyChatError = new Error(
      kind === 'BAD_REQUEST'
        ? 'Câu hỏi chưa rõ ràng — thầy/cô nói rõ hơn giúp em nhé.'
        : 'AI đang bận hoặc hết lượt miễn phí, thử lại sau ít phút.'
    );
    err.status = res.status;
    err.kind = kind;
    err.legs = json?.error?.legs;
    throw err;
  }
  return json;
}

/** Call proxy cho các tác vụ sinh nội dung (1 prompt → text). */
export async function callAiProxyText(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const json = await callAiProxy({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction,
  });
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .filter((p: any) => typeof p.text === 'string')
    .map((p: any) => p.text)
    .join('');
  if (!text) throw new Error('AI không trả về nội dung.');
  return text;
}
