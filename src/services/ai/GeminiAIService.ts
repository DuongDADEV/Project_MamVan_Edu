/**
 * HIỆN THỰC HÓA GOOGLE GEMINI AI STUDIO (GeminiAIService)
 * 
 * Gọi trực tiếp REST API của Google Generative Language:
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
 * 
 * Tự động thử nghiệm các model (thế hệ mới 3.x -> flash-latest -> pro-preview
 * cuối chuỗi cho project có thanh toán; các model 2.x/1.x đã khai tử đã cắt
 * khỏi mọi chuỗi từ 25/10 vì luôn 404 với key mới)
 * RAG Grounding 100% bám sát ngữ liệu nguồn theo chuẩn Mầm AI Studio
 */

import {
  AIService,
  AISource,
  AIKeySummaryOptions,
  AITheoryOptions,
  AIQuestionsOptions,
  AIRubricCriterion,
  AIEssayGradingOptions,
  AIEssayGradingResult,
  AIChatResponse,
  AIExtractedSource,
} from './AIService.ts';
import { Question, KeyPoint, TheoryBlock } from '../../types.ts';
import { callAiProxyText } from './proxyClient.ts';
import {
  filterValidQuestions,
  missingTypeCounts,
  type TypeCounts,
} from '../../logic/validateAiQuestions.ts';

/**
 * Các tên model Google đã khai tử với key/project mới (luôn 404 — đã xác
 * nhận bằng Network thật 25/10). Mọi chuỗi gọi đều lọc bỏ các tên này để
 * khỏi tốn call lãng phí; giá trị model đã lưu của người dùng KHÔNG bị đổi,
 * chỉ bị bỏ qua trong chuỗi nếu nó là tên chết.
 */
export const DEAD_GEMINI_MODELS: ReadonlySet<string> = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
]);

/**
 * Quét mọi giá trị JSON cân bằng trong văn bản (mảng hoặc đối tượng), tôn
 * trọng chuỗi và ký tự thoát — để lấy được JSON thật ngay cả khi AI viết
 * thêm chữ trước/sau JSON, kể cả khi chữ thừa chứa ] hoặc }.
 * Trả về theo thứ tự xuất hiện (giá trị ngoài cùng trước).
 */
function extractBalancedJsonValues(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let s = 0; s < text.length; s++) {
    const ch = text[s];
    if (ch !== '{' && ch !== '[') continue;
    const close = ch === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = s; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === ch) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          const v = text.slice(s, i + 1);
          if (!seen.has(v)) {
            seen.add(v);
            out.push(v);
          }
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Trích JSON từ phản hồi AI, chịu được các dạng hỏng thường gặp:
 * - JSON thuần; JSON trong code fence (thử MỌI khối fence, không chỉ khối
 *   đầu — AI có lúc rào ví dụ trước rồi mới rào JSON thật);
 * - JSON kèm chữ thừa trước/sau (lỗi "non-whitespace character after
 *   JSON" ngày 28/10: cách cũ lấy từ [ đầu tới ] cuối nên chữ thừa chứa
 *   ] hoặc } là gãy, rơi thẳng xuống bản dự phòng mẫu).
 * Thử lần lượt từng ứng viên, cái nào parse được thì lấy; tất cả đều hỏng
 * mới ném lỗi kèm mảnh đầu phản hồi. Lọc câu hỏi ở tầng trên vẫn loại
 * ứng viên parse được nhưng không phải câu hỏi, nên lấy nhầm không lọt
 * được vào nháp.
 */
export function extractJsonFromText<T>(text: string): T {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];
  for (const m of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)) {
    if (m[1] && m[1].trim()) candidates.push(m[1].trim());
  }
  candidates.push(...extractBalancedJsonValues(trimmed));
  // Chọn ứng viên: mảng-các-đối-tượng dài nhất thắng (bộ câu hỏi/lý thuyết
  // thật luôn dài hơn ví dụ rác/mẩu ghi chú AI rào kèm, và khác hẳn mảng
  // con như options vốn là mảng chuỗi); không có mảng-đối-tượng thì lấy
  // giá trị parse được đầu tiên (đối tượng bọc {"questions": [...]} sẽ
  // được gỡ ở tầng trên).
  let firstParsed: unknown = null;
  let hasFirst = false;
  let longestObjectArray: unknown[] | null = null;
  let lastErr: unknown = null;
  for (const c of candidates) {
    try {
      const v = JSON.parse(c) as unknown;
      if (!hasFirst) {
        firstParsed = v;
        hasFirst = true;
      }
      const isObjectArray =
        Array.isArray(v) &&
        v.length > 0 &&
        v.every((el) => el !== null && typeof el === 'object' && !Array.isArray(el));
      if (isObjectArray && (!longestObjectArray || v.length > longestObjectArray.length)) {
        longestObjectArray = v;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  if (longestObjectArray) return longestObjectArray as T;
  if (hasFirst) return firstParsed as T;
  throw new Error(
    `Không thể phân tích dữ liệu JSON từ AI: ${trimmed.slice(0, 100)}... (${lastErr instanceof Error ? lastErr.message : String(lastErr)})`
  );
}

/** AI có lúc bọc mảng câu hỏi trong đối tượng {"questions": [...]} — gỡ bọc về mảng. */
export function normalizeAiQuestionArray(x: unknown): any[] {
  if (Array.isArray(x)) return x;
  const obj = x as { questions?: unknown } | null;
  if (obj && Array.isArray(obj.questions)) return obj.questions;
  return [];
}

export class GeminiAIService implements AIService {
  // Đợt 25/10: service chạy qua proxy admin — không còn key/model riêng.
  // Constructor giữ tham số cũ (không dùng) để không vỡ code khởi tạo cũ.
  constructor(_apiKey?: string, _model?: string) {}

  /**
   * Gọi AI qua proxy của admin (/api/ai/chat): trình duyệt không giữ key,
   * không gọi thẳng Google nữa — failover Gemini → Groq → OpenRouter nằm
   * ở proxy, key nằm trong Vercel env của admin.
   */
  private async callGemini(prompt: string, systemInstruction?: string): Promise<string> {
    return callAiProxyText(prompt, systemInstruction);
  }

  /**
   * Trích xuất khối JSON từ chuỗi phản hồi của Gemini
   */
  private parseJsonFromText<T>(text: string): T {
    return extractJsonFromText<T>(text);
  }

  /**
   * Kiểm tra kết nối API Key và đo độ trễ (latency)
   */
  static async testConnection(
    apiKey: string,
    preferredModel: string = 'gemini-3.8-flash'
  ): Promise<{ success: boolean; message: string; latencyMs: number; workingModel?: string }> {
    const startTime = Date.now();
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      return {
        success: false,
        message: 'API Key không được để trống.',
        latencyMs: 0,
      };
    }

    const modelsToTry = [
      preferredModel,
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-3.1-pro-preview',
    ].filter((m, idx, arr) => !!m && arr.indexOf(m) === idx && !DEAD_GEMINI_MODELS.has(m));

    let lastError = '';
    // Ghi nhận kết quả từng model để thông báo thất bại tự chẩn đoán được
    // (dạng "model: status + mảnh message", vd "gemini-3.8-flash: HTTP 429 ...").
    const attempts: string[] = [];
    const recordAttempt = (model: string, detail: string) => {
      attempts.push(`${model}: ${detail.slice(0, 80)}`);
    };

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': cleanKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: 'Xin chào! Bạn là trợ lý AI Mầm Văn dành cho giáo viên Ngữ văn 7. Hãy trả lời trong 1 câu chào mừng thầy cô và xác nhận kết nối Google AI Studio thành công.',
                  },
                ],
              },
            ],
          }),
        });

        const latencyMs = Date.now() - startTime;

        if (res.ok) {
          const data = await res.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Kết nối thành công!';
          return {
            success: true,
            message: reply,
            latencyMs,
            workingModel: model,
          };
        } else {
          const errJson = await res.json().catch(() => null);
          lastError = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
          recordAttempt(model, `HTTP ${res.status} ${lastError}`);

          // Chỉ dừng ngay khi lỗi xác thực thật (401/403 hoặc message mang dấu
          // hiệu xác thực). Mọi status khác — 400 vì lý do riêng của model,
          // 404, 429, 500, 503 — đều thử model tiếp theo, vì một model lỗi
          // không có nghĩa key sai hay các model còn lại cũng lỗi.
          if (
            res.status === 401 ||
            res.status === 403 ||
            lastError.includes('API_KEY_INVALID') ||
            lastError.includes('UNAUTHENTICATED') ||
            lastError.includes('invalid authentication credentials')
          ) {
            return {
              success: false,
              message: `Khóa API không hợp lệ hoặc chưa được kích hoạt trên Google Cloud: ${lastError}`,
              latencyMs,
            };
          }
        }
      } catch (err: any) {
        lastError = err.message || 'Lỗi mạng';
        recordAttempt(model, lastError);
      }
    }

    return {
      success: false,
      message:
        attempts.length > 0
          ? `Không thể kết nối Google AI Studio. Kết quả từng model: ${attempts.join('; ')}`
          : `Không thể kết nối Google AI Studio: ${lastError}`,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Hỏi đáp và trò chuyện với tài liệu nguồn (Mầm AI Studio)
   */
  async chatWithSources(
    sources: AISource[],
    message: string,
    history?: { role: 'user' | 'assistant'; text: string }[]
  ): Promise<AIChatResponse> {
    const activeSources = sources.filter((s) => s.isEnabled);
    if (activeSources.length === 0) {
      return {
        reply: '⚠️ Hiện tại chưa có nguồn tài liệu nào được bật bên cột trái. Thầy/cô vui lòng tích chọn ít nhất 1 nguồn để AI có căn cứ tra cứu chính xác.',
        citations: [],
      };
    }

    const sourcesText = activeSources
      .map((s, idx) => `[Tài liệu ${idx + 1}: "${s.title}"] (Mã nguồn: ${s.id})\n${s.content}`)
      .join('\n\n');

    const historyText = (history || [])
      .map((h) => `${h.role === 'user' ? 'Thầy/Cô' : 'AI'}: ${h.text}`)
      .join('\n');

    const prompt = `Bạn là trợ lý AI sư phạm Mầm Văn theo chuẩn Mầm AI Studio.
Nhiệm vụ của bạn là đọc và phân tích sâu các tài liệu nguồn dưới đây để trả lời câu hỏi của thầy/cô giáo dạy Ngữ văn 7.

TÀI LIỆU NGUỒN ĐÃ BẬT:
${sourcesText}

LỊCH SỬ HỎI ĐÁP:
${historyText || '(Chưa có)'}

CÂU HỎI MỚI CỦA THẦY/CÔ:
"${message}"

QUY TẮC RAG GROUNDING BẮT BUỘC:
1. Trả lời chi tiết, bám sát từng ý trong các tài liệu nguồn trên. Nêu rõ chi tiết, câu thơ, từ ngữ làm dẫn chứng.
2. Định dạng câu trả lời bằng Markdown đẹp mắt (dùng gạch đầu dòng, **in đậm** ý quan trọng, phân đoạn rõ ràng).
3. Đính kèm trích dẫn (citations) cụ thể: đoạn trích từ tài liệu nào.
4. TUYỆT ĐỐI KHÔNG chèn mã ID kỹ thuật dạng [src_...] hoặc [Tài liệu ...] vào giữa câu chữ trong văn bản trả lời. Hãy viết câu văn tự nhiên, mượt mà. Mọi thông tin trích dẫn nguồn sẽ được đưa riêng vào mảng "citations" trong JSON.

Định dạng trả về: DUY NHẤT một chuỗi JSON theo cấu trúc:
{
  "reply": "Nội dung câu trả lời đầy đủ định dạng Markdown...",
  "citations": [
    {
      "sourceId": "${activeSources[0]?.id}",
      "sourceTitle": "${activeSources[0]?.title}",
      "snippet": "đoạn trích dẫn chứng ngắn trong bài"
    }
  ]
}`;

    const cleanReply = (str: string) =>
      str
        .replace(/\s*\[src_[^\]]+\]/g, '')
        .replace(/\s*\[Tài liệu\s+\d+[^\]]*\]/g, '')
        .replace(/\s*\[id\s*:\s*[^\]]+\]/gi, '')
        .trim();

    const raw = await this.callGemini(prompt);
    try {
      const parsed = this.parseJsonFromText<AIChatResponse>(raw);
      if (parsed && parsed.reply) {
        parsed.reply = cleanReply(parsed.reply);
      }
      return parsed;
    } catch {
      return {
        reply: cleanReply(raw.replace(/^```json/, '').replace(/```$/, '').trim()),
        citations: [
          {
            sourceId: activeSources[0]?.id,
            sourceTitle: activeSources[0]?.title,
            snippet: activeSources[0]?.content.slice(0, 150) + '...',
          },
        ],
      };
    }
  }

  /**
   * Sinh bộ câu hỏi 4 mức năng lực chuẩn GDPT 2018 từ nguồn
   */
  async generateQuestions(sources: AISource[], options?: AIQuestionsOptions): Promise<Question[]> {
    const activeSources = sources.filter((s) => s.isEnabled);
    if (activeSources.length === 0) {
      throw new Error('Vui lòng bật ít nhất 1 nguồn tài liệu bên cột trái để AI sinh câu hỏi.');
    }

    const sourcesText = activeSources
      .map((s, idx) => `[Tài liệu ${idx + 1}: ${s.title}]\n${s.content}`)
      .join('\n\n');

    const tc = options?.typeCounts;
    const typeTotal = tc
      ? (tc.single || 0) + (tc.multi || 0) + (tc.fill || 0) + (tc.essay || 0)
      : 0;
    const count = typeTotal > 0 ? typeTotal : options?.totalQuestions || options?.count || 5;
    const difficulty = options?.difficulty || 'TB';
    const topic = options?.topicTitle || activeSources[0]?.title || 'Ngữ văn 7';
    const typeBreakdown =
      typeTotal > 0
        ? `\nCƠ CẤU LOẠI CÂU HỎI (BẮT BUỘC ĐÚNG SỐ LƯỢNG TỪNG LOẠI):\n- "single" (Chọn 1 đáp án): ĐÚNG ${tc?.single || 0} câu\n- "multi" (Chọn nhiều đáp án): ĐÚNG ${tc?.multi || 0} câu\n- "fill" (Điền vào chỗ trống): ĐÚNG ${tc?.fill || 0} câu\n- "essay" (Tự luận): ĐÚNG ${tc?.essay || 0} câu\nTrường "type" của mỗi câu phải khớp cơ cấu trên; loại nào số lượng 0 thì TUYỆT ĐỐI không sinh câu thuộc loại đó.\n`
        : '';

    const prompt = `Bạn là chuyên gia khảo thí và ra đề Ngữ văn 7 chuẩn GDPT 2018 theo phong cách Mầm AI Studio.
Dựa vào ngữ liệu sau:
${sourcesText}

Chủ đề: "${topic}"

YÊU CẦU ĐẶC BIỆT QUAN TRỌNG VỀ SỐ LƯỢNG (BẮT BUỘC):
- Bạn PHẢI tạo CHÍNH XÁC đúng ${count} câu hỏi riêng biệt trong mảng JSON (BẮT BUỘC có đủ ${count} phần tử).
- TUYỆT ĐỐI KHÔNG ĐƯỢC sinh ít hơn ${count} câu: mảng JSON phải có đủ đúng ${count} phần tử, không được thiếu.
- Khai thác phong phú mọi chi tiết, từ ngữ, câu văn/thơ trong ngữ liệu để mỗi câu hỏi là một khía cạnh riêng biệt.
${typeBreakdown}
Phân bổ theo ma trận 4 mức độ năng lực:
- NHAN_BIET: Nhận biết dấu hiệu thể loại, chi tiết, từ ngữ trong văn bản
- THONG_HIEU: Hiểu ý nghĩa hình ảnh, biện pháp tu từ, tâm trạng nhân vật
- PHAN_TICH: Phân tích cấu tứ, tác dụng của thể thơ/từ láy/so sánh
- VAN_DUNG: Rút ra bài học, thông điệp, cảm nhận liên hệ bản thân

Độ khó chung: ${difficulty} (DE = Dễ, TB = Trung bình, KHO = Khó).

Quy tắc dạng câu hỏi (type):
1. "single": Trắc nghiệm 1 đáp án. options: mảng 4 phương án. answer: ký tự đúng "A", "B", "C" hoặc "D".
2. "multi": Trắc nghiệm chọn nhiều đáp án. options: mảng 4 phương án. answer: mảng các chữ cái đúng, ví dụ ["A", "C"].
3. "fill": Điền vào chỗ trống. prompt PHẢI là câu đầy đủ có ô trống dạng ___ tại đúng vị trí cần điền (mỗi ___ là 1 đáp án, đếm số ___ khớp số đáp án); answer: mảng các từ/cụm cần điền theo đúng thứ tự các ô, ví dụ ["chiều sâu", "cao đẹp"]. TUYỆT ĐỐI không để đáp án lộ trong đề bài hay trong đoạn trích.
4. "essay": Tự luận / Viết đoạn văn ngắn. rubric: mảng các tiêu chí chấm điểm (name, maxScore, description).

Định dạng trả về: DUY NHẤT một mảng JSON thuần túy có đúng ${count} phần tử theo cấu trúc Question[]:
[
  {
    "id": "q_ai_1",
    "type": "single",
    "level": "NHAN_BIET",
    "difficulty": "${difficulty}",
    "topicId": "topic_tho_bon_nam",
    "prompt": "Nội dung câu hỏi...",
    "passage": "Đoạn trích dẫn ngắn từ ngữ liệu (nếu có)...",
    "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
    "answer": "A",
    "explanation": "Lời giải thích sư phạm chi tiết vì sao đúng..."
  }
]`;

    let raw = await this.callGemini(prompt);
    let first: unknown;
    try {
      first = this.parseJsonFromText<unknown>(raw);
    } catch (parseErr) {
      // 28/10: AI có lúc trả JSON kèm chữ thừa (lỗi "non-whitespace
      // character after JSON") — trước đây rơi thẳng xuống bản dự phòng
      // mẫu khiến giáo viên nhận bộ câu không bám ngữ liệu. Thử lại ĐÚNG
      // 1 lần với lệnh chỉ-trả-JSON rồi mới chịu thua (lúc đó SmartAIService
      // mới dùng bản dự phòng và UI cảnh báo rõ như cũ).
      const strict = `${prompt}\n\nYÊU CẦU ĐỊNH DẠNG NGHIÊM NGẶT: chỉ trả về mảng JSON thuần túy, không thêm bất kỳ chữ nào khác trước/sau JSON, không dùng code fence, không giải thích.`;
      raw = await this.callGemini(strict);
      first = this.parseJsonFromText<unknown>(raw);
      void parseErr;
    }
    let valid = filterValidQuestions(normalizeAiQuestionArray(first));
    // 28/10: AI có lúc trả thiếu câu hoặc trả câu thiếu trường (không đề bài,
    // không loại/mức/độ khó) — trước đây những câu đó vẫn vào nháp rồi lúc
    // lưu bị máy chủ đắp mặc định thành câu hỏng. Nay: chỉ giữ câu hợp lệ,
    // và gọi bù ĐÚNG 1 lần cho số còn thiếu (kèm đủ ngữ liệu vì mỗi lần gọi
    // là độc lập, không có lịch sử hội thoại). Vẫn thiếu thì trả số đã có —
    // phía gọi (màn duyệt) phải báo rõ số thiếu, không lặng lẽ trình thiếu
    // như thể đủ.
    const requestedCounts: TypeCounts | undefined = options?.typeCounts
      ? {
          single: options.typeCounts.single || 0,
          multi: options.typeCounts.multi || 0,
          fill: options.typeCounts.fill || 0,
          essay: options.typeCounts.essay || 0,
        }
      : undefined;
    if (valid.length < count) {
      const missing = requestedCounts
        ? missingTypeCounts(requestedCounts, valid)
        : { counts: null as TypeCounts | null, total: count - valid.length };
      if (missing.total > 0) {
        const breakdown = requestedCounts
          ? `\nCƠ CẤU CÒN THIẾU (BẮT BUỘC ĐÚNG TỪNG LOẠI):\n- "single": ${missing.counts!.single} câu\n- "multi": ${missing.counts!.multi} câu\n- "fill": ${missing.counts!.fill} câu\n- "essay": ${missing.counts!.essay} câu\n`
          : '';
        const followup = `Bạn là chuyên gia khảo thí và ra đề Ngữ văn 7 chuẩn GDPT 2018 theo phong cách Mầm AI Studio.\nDựa vào ngữ liệu sau:\n${sourcesText}\n\nChủ đề: "${topic}"\n\nLần trả lời trước của bạn chỉ có ${valid.length}/${count} câu hỏi hợp lệ. Hãy tạo thêm ĐÚNG ${missing.total} câu hỏi riêng biệt nữa (không lặp lại các câu đã có), trả về DUY NHẤT một mảng JSON thuần túy theo đúng cấu trúc Question[] như lần trước (mỗi câu bắt buộc có prompt, type, level, difficulty; trắc nghiệm phải có options và answer; tự luận có rubric; câu fill bắt buộc có ___ trong prompt, đáp án là mảng theo thứ tự các ô).\n${breakdown}Độ khó chung: ${difficulty}.`;
        try {
          const raw2 = await this.callGemini(followup);
          const second = this.parseJsonFromText<unknown>(raw2);
          valid = [...valid, ...filterValidQuestions(normalizeAiQuestionArray(second))];
        } catch {
          // Giữ số câu đã có; phía gọi báo thiếu.
        }
      }
    }
    // Khử trùng theo đề bài (lần gọi bù có thể lặp câu cũ) rồi cắt đúng số đã chọn.
    const seen = new Set<string>();
    const deduped = valid.filter((q) => {
      const key = q.prompt.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return deduped.slice(0, count).map((q, idx) => ({
      ...q,
      id: q.id || `q_ai_${Date.now()}_${idx}`,
      points: q.points || 10,
    }));
  }

  /**
   * Sinh các ý kiến thức trọng tâm từ video/văn bản
   */
  async generateKeySummary(sources: AISource[], options?: AIKeySummaryOptions): Promise<KeyPoint[]> {
    const activeSources = sources.filter((s) => s.isEnabled);
    const sourcesText = activeSources
      .map((s, idx) => `[Tài liệu ${idx + 1}: ${s.title}]\n${s.content}`)
      .join('\n\n');

    const prompt = `Bạn là chuyên gia sư phạm Ngữ văn 7. Dựa vào các tài liệu nguồn sau đây:
${sourcesText}

Chủ đề: "${options?.focusTopic || 'Ngữ văn 7'}"
Yêu cầu: Hãy trích xuất từ 3 đến 5 ý kiến thức trọng tâm bài học theo chuẩn CT GDPT 2018 từ chính ngữ liệu trên.
Mỗi ý gồm:
- title: Tiêu đề ý chính (ngắn gọn, xúc tích)
- content: Nội dung phân tích cô đọng, dễ hiểu cho học sinh lớp 7
- example: Câu thơ/đoạn trích dẫn chứng tiêu biểu từ văn bản nguồn

Định dạng trả về: DUY NHẤT một mảng JSON thuần túy theo cấu trúc:
[
  {
    "title": "...",
    "content": "...",
    "example": "..."
  }
]`;

    const raw = await this.callGemini(prompt);
    return this.parseJsonFromText<KeyPoint[]>(raw);
  }

  /**
   * Sinh khối lý thuyết chi tiết theo chuẩn GDPT 2018
   */
  async generateTheory(sources: AISource[], options?: AITheoryOptions): Promise<TheoryBlock[]> {
    const activeSources = sources.filter((s) => s.isEnabled);
    const sourcesText = activeSources
      .map((s, idx) => `[Tài liệu ${idx + 1}: ${s.title}]\n${s.content}`)
      .join('\n\n');

    const prompt = `Bạn là chuyên gia biên soạn giáo án Ngữ văn 7. Dựa vào tài liệu nguồn sau:
${sourcesText}

Chủ đề: "${options?.topicTitle || 'Ngữ văn 7'}"
Hãy tạo các khối lý thuyết chuẩn sư phạm phân tích trực tiếp từ ngữ liệu trên.
Các loại khối:
- 'heading': Tiêu đề mục (level 2 hoặc 3, content)
- 'paragraph': Đoạn văn giải thích kiến thức trọng tâm (content)
- 'example': Ví dụ phân tích (exampleText: câu thơ trích từ nguồn, exampleAnalysis: phân tích giá trị)
- 'takeaway': Ghi nhớ cốt lõi đóng khung (takeawayText)

Định dạng trả về: DUY NHẤT một mảng JSON thuần túy theo cấu trúc:
[
  {
    "id": "blk_1",
    "type": "heading",
    "level": 2,
    "content": "..."
  },
  {
    "id": "blk_2",
    "type": "paragraph",
    "content": "..."
  },
  {
    "id": "blk_3",
    "type": "example",
    "exampleText": "...",
    "exampleAnalysis": "..."
  },
  {
    "id": "blk_4",
    "type": "takeaway",
    "takeawayText": "..."
  }
]`;

    const raw = await this.callGemini(prompt);
    return this.parseJsonFromText<TheoryBlock[]>(raw);
  }

  /**
   * Gợi ý chấm bài viết đoạn văn theo Rubric
   */
  async suggestEssayGrade(
    essayText: string,
    rubric: AIRubricCriterion[],
    sampleEssays?: any[],
    options?: AIEssayGradingOptions
  ): Promise<AIEssayGradingResult> {
    const rubricPrompt = rubric
      .map(
        (r, idx) =>
          `- Tiêu chí ${idx + 1}: "${r.name}" (Điểm tối đa: ${r.maxScore || 4}đ, Trọng số: ${r.weight || 25}%). Yêu cầu: ${r.description}`
      )
      .join('\n');

    const prompt = `Bạn là giáo viên giàu kinh nghiệm chấm bài Ngữ văn 7.
Hãy chấm bài làm văn của học sinh dưới đây:
"""
${essayText}
"""

Bộ tiêu chí Rubric đánh giá:
${rubricPrompt}

Phong cách nhận xét: ${options?.tone || 'encouraging'} (khích lệ, chỉ ra điểm sáng trước, sau đó góp ý cụ thể).
Độ khắt khe: ${options?.strictness || 3}/5.

Định dạng trả về: DUY NHẤT một đối tượng JSON:
{
  "rubricScores": [
    {
      "criterionName": "...",
      "suggestedScore": 3.5,
      "maxScore": 4,
      "reason": "Lý do cho điểm...",
      "comment": "Lời khuyên cải thiện..."
    }
  ],
  "totalScore": 8.5,
  "overallComment": "Lời nhận xét tổng thể gửi tới học sinh...",
  "confidenceScore": 0.95
}`;

    const raw = await this.callGemini(prompt);
    return this.parseJsonFromText<AIEssayGradingResult>(raw);
  }

  /**
   * Trích xuất lời thoại, phụ đề, nội dung bài giảng từ YouTube hoặc bất kỳ trang web nào
   * Lọc sạch rác giao diện và tối ưu hóa nội dung sư phạm chuẩn Mầm AI Studio
   */
  async extractContentFromUrl(url: string): Promise<AIExtractedSource> {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      throw new Error('Vui lòng cung cấp đường dẫn URL video hoặc bài viết hợp lệ.');
    }

    const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(cleanUrl);
    let title = isYouTube ? 'Video bài giảng YouTube' : 'Tài liệu liên kết';
    let authorName = '';
    let rawText = '';
    let captionsText = '';

    // 1. Nếu là YouTube: Lấy tiêu đề và tên kênh qua noembed
    if (isYouTube) {
      try {
        const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          if (oembedData?.title) {
            title = oembedData.title;
          }
          if (oembedData?.author_name) {
            authorName = oembedData.author_name;
          }
        }
      } catch {
        // bỏ qua nếu oembed thất bại
      }

      // Thử lấy phụ đề tiếng Việt / tiếng Anh từ Google timedtext nếu có videoId
      const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
      const videoId = ytMatch ? ytMatch[1] : null;
      if (videoId) {
        try {
          const ttRes = await fetch(`https://video.google.com/timedtext?lang=vi&v=${videoId}`);
          if (ttRes.ok) {
            const xml = await ttRes.text();
            const matches = xml.matchAll(/<text[^>]*>([^<]+)<\/text>/g);
            const lines = Array.from(matches, (m) => m[1]);
            if (lines.length > 0) {
              captionsText = lines.join(' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
            }
          }
        } catch {
          // bỏ qua nếu không có timedtext
        }
      }
    }

    // 2. Thử lấy nội dung/transcript qua Jina Reader API
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
        headers: { Accept: 'text/plain' },
      });
      if (jinaRes.ok) {
        const text = await jinaRes.text();
        if (text && text.length > 50) {
          rawText = this.cleanScrapedText(text, isYouTube);
        }
      }
    } catch {
      // bỏ qua nếu jina gặp hạn chế
    }

    // Kết hợp thông tin bóc tách
    let combinedContent = '';
    if (captionsText && rawText) {
      combinedContent = `[Phụ đề lời thoại gốc]:\n${captionsText}\n\n[Nội dung mô tả & phân tích]:\n${rawText}`;
    } else if (captionsText) {
      combinedContent = captionsText;
    } else {
      combinedContent = rawText;
    }

    // Luôn lọc lại lần cuối để đảm bảo 100% không còn sót rác
    combinedContent = this.cleanScrapedText(combinedContent, isYouTube);

    // 3. Phân tích và chuẩn hóa bằng Gemini AI
    const prompt = `Bạn là trợ lý AI sư phạm cao cấp của Mầm AI Studio môn Ngữ văn và Khoa học Xã hội.
Nhiệm vụ: Phân tích tư liệu bài giảng/video sau đây và biên soạn thành một bài giảng/tài liệu tri thức hoàn chỉnh, sâu sắc, có cấu trúc sư phạm rõ ràng:
- URL nguồn: ${cleanUrl}
- Loại nguồn: ${isYouTube ? 'Video YouTube' : 'Bài viết Web'}
- Tiêu đề nhận diện: "${title}"
${authorName ? `- Kênh phát hành / Tác giả: "${authorName}"` : ''}
${combinedContent ? `- Ngữ liệu bóc tách từ nguồn:\n"""\n${combinedContent.slice(0, 4000)}\n"""` : ''}

QUY TẮC BẮT BUỘC:
1. TUYỆT ĐỐI BỎ QUA 100% mọi thông tin quảng cáo, sản phẩm mua sắm Shopee/Lazada, đồ chơi mô hình, link tài trợ hay rác giao diện mạng.
2. Biên soạn bài giảng có tính chuyên môn sư phạm cao, có cấu trúc mạch lạc:
   - Phần 1: Giới thiệu tổng quan & Bối cảnh chủ đề.
   - Phần 2: Các nguyên nhân, luận điểm then chốt và cơ sở lý luận/thực tiễn sâu sắc.
   - Phần 3: Phân tích chi tiết và dẫn chứng minh họa tiêu biểu.
   - Phần 4: Tổng kết, ý nghĩa và định hướng bài học/câu hỏi ôn luyện.
3. Định dạng trả về: DUY NHẤT một chuỗi JSON thuần túy (không bọc trong \`\`\`json):
{
  "title": "${title.replace(/"/g, "'")}",
  "content": "Toàn bộ bài giảng bóc tách chi tiết (được định dạng rõ ràng theo các đề mục lớn nhỏ, mạch lạc, sâu sắc)...",
  "summary": "Tóm tắt ngắn gọn 2 câu về nội dung cốt lõi"
}`;

    try {
      const aiRaw = await this.callGemini(prompt);
      const parsed = this.parseJsonFromText<{ title: string; content: string }>(aiRaw);
      const finalTitle = parsed.title || title;
      const finalContent = parsed.content ? this.cleanScrapedText(parsed.content, false) : '';

      if (finalContent && finalContent.length > 100) {
        const wordCount = finalContent.split(/\s+/).filter(Boolean).length;
        return {
          title: finalTitle,
          content: finalContent,
          wordCount,
          type: isYouTube ? 'video' : 'website',
          url: cleanUrl,
        };
      }
    } catch {
      // nếu Gemini lỗi mạng/quota, chuyển xuống xử lý fallback an toàn
    }

    // Fallback thông minh: Nếu có nội dung đã làm sạch chất lượng cao
    if (combinedContent && combinedContent.length > 120) {
      const cleanedFallback = this.cleanScrapedText(combinedContent, isYouTube);
      const formattedContent = `[Tài liệu bóc tách từ ${isYouTube ? 'video' : 'nguồn'}: ${title}]
${authorName ? `- Kênh/Tác giả: ${authorName}\n` : ''}- Nguồn tham khảo: ${cleanUrl}

=== TỔNG HỢP NỘI DUNG VÀ KIẾN THỨC CỐT LÕI ===
${cleanedFallback}`;

      return {
        title,
        content: formattedContent,
        wordCount: formattedContent.split(/\s+/).filter(Boolean).length,
        type: isYouTube ? 'video' : 'website',
        url: cleanUrl,
      };
    }

    // Đợt QA 26/10, blocker 5: KHÔNG còn đoạn văn mẫu bịa sẵn. Trước đây khi
    // không lấy được nội dung thật, hàm vẫn trả một "bài giảng chuẩn mực"
    // viết sẵn (kể cả luận điểm địa chính trị không liên quan) như thể đó là
    // nội dung của liên kết — giáo viên không thể phân biệt thật/giả. Nay:
    // không có nội dung thật thì ném lỗi rõ ràng để caller báo người dùng.
    throw new Error(
      'Không trích xuất được nội dung thật từ liên kết này (trang chặn bóc tách hoặc không có nội dung đọc được). Hãy thử liên kết khác hoặc dán nội dung trực tiếp.'
    );
  }

  /**
   * Bộ lọc làm sạch triệt để mọi rác Shopee, Lazada, quảng cáo, markdown images và liên kết mạng
   */
  private cleanScrapedText(text: string, isYouTube: boolean): string {
    if (!text) return '';

    let cleaned = text;

    // 1. Xóa toàn bộ thẻ markdown image ![*](*)
    cleaned = cleaned.replace(/!\[[^\]]*\]\([^\)]*\)/g, '');
    cleaned = cleaned.replace(/!\[[^\]]*\]/g, '');

    // 2. Xóa các liên kết markdown lồng ảnh [[Image]...](...)
    cleaned = cleaned.replace(/\[\s*\[[^\]]*\]\([^\)]*\)\s*\]\([^\)]*\)/g, '');

    // 3. Xóa các link TMĐT Shopee, Lazada, Tiki, affiliate, tracking
    cleaned = cleaned.replace(/https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:shopee|lazada|tiki|tiktok)[^\s\)\"\'<>]+/gi, '');
    cleaned = cleaned.replace(/\[[^\]]*\]\(https?:\/\/[^\)]*(?:shopee|lazada|tiki|gads_t_sig|cypthertext|srsltid)[^\)]*\)/gi, '');

    // 4. Xóa chuỗi hash token dài bất thường không có nghĩa (base64, cipher token)
    cleaned = cleaned.replace(/\b[a-zA-Z0-9_\-]{32,}\b/g, '');

    // 5. Lọc từng dòng loại bỏ rác giao diện YouTube và sản phẩm
    const lines = cleaned.split('\n');
    const filteredLines: string[] = [];
    let skippingProductBlock = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Bắt đầu hoặc kết thúc khối sản phẩm tagged products
      if (/tagged products below|## Products|Unavailable (?:Shopee|Lazada|View)|Shop (?:Shopee|Lazada)/i.test(line)) {
        skippingProductBlock = true;
        continue;
      }
      if (skippingProductBlock) {
        if (/^###\s+\[@|How this was made|Transcript|In this video|## Video details|## Comments/i.test(line)) {
          skippingProductBlock = false;
        } else {
          continue;
        }
      }

      // Lọc các dòng sản phẩm mô hình, đồ chơi, quần áo rác
      if (
        /Mô hình máy bay|Bộ Khối Xây Dựng|Khối Xây Dựng|Fusilier Scottish|Chiến Tranh Napoleon|Áo Hoodie in 3D|Khởi Động Quân Sự/i.test(
          line
        )
      ) {
        continue;
      }

      // Lọc danh sách video gợi ý trên sidebar YouTube: vd [12:48 Tại sao Mỹ...], [20:02 VIETNAM...]
      if (
        /^\[\d{1,2}:\d{2}\s+[^\]]+\]\(https?:\/\/www\.youtube\.com\/watch\?v=[^\)]+\)/i.test(line) ||
        /^\d{1,2}:\d{2}\s+(?:New|Live|Auto-dubbed)/i.test(line) ||
        /Live Playlist \(\)|Mix \(\d+\+\)/i.test(line)
      ) {
        continue;
      }

      // Lọc các nút và chữ điều hướng YouTube
      if (
        /^(search|search with your voice|home|shorts|subscriptions|you|history|trending|music|gaming|news|sports|podcasts|sign in|skip navigation|about press copyright|contact us creators|advertise developers|terms privacy|policy & safety|tap to unmute|if playback doesn't begin shortly|videos you watch may be added|cancel confirm|an error occurred while retrieving sharing information|watch full video|timeline|transcript|follow along using the transcript|show transcript|how this was made|auto-dubbed|audio tracks for some languages|sort comments|top show featured comments|newest show recent comments|add a comment\.\.\.|reply|\d+\s+replies|hide replies|like|dislike|show less|read more|show more|group facebook|fanpage|contact for business inquiries|account number:|momo:|zalo:)/i.test(
          line
        )
      ) {
        continue;
      }

      // Bỏ qua dòng link rỗng của YouTube
      if (/^\[\]\(https:\/\/www\.youtube\.com/i.test(line)) continue;
      if (/^\[Video \d+\]\(https:\/\/www\.youtube\.com/i.test(line)) continue;
      if (/^Back\s*\[/i.test(line)) continue;

      filteredLines.push(line);
    }

    return filteredLines.join('\n\n').trim();
  }
}
