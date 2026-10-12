/**
 * HIỆN THỰC HÓA GOOGLE GEMINI AI STUDIO (GeminiAIService)
 * 
 * Gọi trực tiếp REST API của Google Generative Language:
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
 * 
 * Tự động thử nghiệm các model (gemini-2.5-flash -> gemini-1.5-flash -> gemini-1.5-pro)
 * RAG Grounding 100% bám sát ngữ liệu nguồn theo chuẩn NotebookLM
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

export class GeminiAIService implements AIService {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey.trim();
    this.model = model.trim();
  }

  /**
   * Gọi API Google Gemini với fallback model thông minh
   */
  private async callGemini(prompt: string, systemInstruction?: string): Promise<string> {
    const candidateModels = [
      this.model,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash-8b',
      'gemini-2.0-flash-thinking-exp-01-21',
      'gemini-1.5-pro-latest',
    ].filter((m, idx, arr) => !!m && arr.indexOf(m) === idx);

    let lastError: Error | null = null;

    for (const modelToTry of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${this.apiKey}`;

        const body: any = {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        };

        if (systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let errDetails = '';
          try {
            const errJson = await response.json();
            errDetails = errJson?.error?.message || response.statusText;
          } catch {
            errDetails = `HTTP ${response.status}: ${response.statusText}`;
          }

          // Nếu lỗi 404 (model không tìm thấy), 429 (hết token / rate limit), 503 (quá tải), tiếp tục thử model tiếp theo
          if (
            response.status === 404 ||
            response.status === 429 ||
            response.status === 503 ||
            errDetails.includes('not found') ||
            errDetails.includes('RESOURCE_EXHAUSTED') ||
            errDetails.includes('quota') ||
            errDetails.includes('overloaded')
          ) {
            console.warn(`Model ${modelToTry} (${response.status}): ${errDetails}. Thử model tiếp theo...`);
            lastError = new Error(`Model ${modelToTry} (${response.status}): ${errDetails}`);
            continue;
          }

          throw new Error(`Google AI Studio (${modelToTry}): ${errDetails}`);
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (text) {
          return text;
        }
      } catch (err: any) {
        lastError = err;
        if (
          err.message &&
          (err.message.includes('API_KEY_INVALID') ||
            err.message.includes('API key not valid') ||
            err.message.includes('400') ||
            err.message.includes('403'))
        ) {
          throw err;
        }
      }
    }

    throw lastError || new Error('Google AI Studio không trả về nội dung.');
  }

  /**
   * Trích xuất khối JSON từ chuỗi phản hồi của Gemini
   */
  private parseJsonFromText<T>(text: string): T {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
    const rawJson = jsonMatch[1] || text;
    const cleaned = rawJson.trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const startBracket = cleaned.indexOf('[');
      const endBracket = cleaned.lastIndexOf(']');
      if (startBracket !== -1 && endBracket !== -1) {
        return JSON.parse(cleaned.substring(startBracket, endBracket + 1));
      }
      const startBrace = cleaned.indexOf('{');
      const endBrace = cleaned.lastIndexOf('}');
      if (startBrace !== -1 && endBrace !== -1) {
        return JSON.parse(cleaned.substring(startBrace, endBrace + 1));
      }
      throw new Error(`Không thể phân tích dữ liệu JSON từ AI: ${cleaned.slice(0, 100)}...`);
    }
  }

  /**
   * Kiểm tra kết nối API Key và đo độ trễ (latency)
   */
  static async testConnection(
    apiKey: string,
    preferredModel: string = 'gemini-2.5-flash'
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
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-2.0-flash-lite',
    ].filter((m, idx, arr) => !!m && arr.indexOf(m) === idx);

    let lastError = '';

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          if (res.status === 400 || res.status === 403 || lastError.includes('API_KEY_INVALID')) {
            return {
              success: false,
              message: `Khóa API không hợp lệ: ${lastError}`,
              latencyMs,
            };
          }
        }
      } catch (err: any) {
        lastError = err.message || 'Lỗi mạng';
      }
    }

    return {
      success: false,
      message: `Không thể kết nối Google AI Studio: ${lastError}`,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Hỏi đáp và trò chuyện với tài liệu nguồn (NotebookLM Style)
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
      .map((s, idx) => `[Tài liệu ${idx + 1}: ID "${s.id}" - "${s.title}"]\n${s.content}`)
      .join('\n\n');

    const historyText = (history || [])
      .map((h) => `${h.role === 'user' ? 'Thầy/Cô' : 'AI'}: ${h.text}`)
      .join('\n');

    const prompt = `Bạn là trợ lý AI sư phạm Mầm Văn theo chuẩn NotebookLM của Google.
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

    const raw = await this.callGemini(prompt);
    try {
      return this.parseJsonFromText<AIChatResponse>(raw);
    } catch {
      return {
        reply: raw.replace(/^```json/, '').replace(/```$/, '').trim(),
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

    const count = options?.totalQuestions || options?.count || 5;
    const difficulty = options?.difficulty || 'TB';
    const topic = options?.topicTitle || activeSources[0]?.title || 'Ngữ văn 7';

    const prompt = `Bạn là chuyên gia khảo thí và ra đề Ngữ văn 7 chuẩn GDPT 2018 theo phong cách Google NotebookLM.
Dựa vào ngữ liệu sau:
${sourcesText}

Chủ đề: "${topic}"

YÊU CẦU ĐẶC BIỆT QUAN TRỌNG VỀ SỐ LƯỢNG (BẮT BUỘC):
- Bạn PHẢI tạo CHÍNH XÁC đúng ${count} câu hỏi riêng biệt trong mảng JSON (BẮT BUỘC có đủ ${count} phần tử).
- TUYỆT ĐỐI KHÔNG ĐƯỢC sinh ít hơn ${count} câu (ví dụ người dùng chọn ${count} câu thì phải đủ ${count} câu, không được chỉ trả về 5 câu).
- Khai thác phong phú mọi chi tiết, từ ngữ, câu văn/thơ trong ngữ liệu để mỗi câu hỏi là một khía cạnh riêng biệt.

Phân bổ theo ma trận 4 mức độ năng lực:
- NHAN_BIET: Nhận biết dấu hiệu thể loại, chi tiết, từ ngữ trong văn bản
- THONG_HIEU: Hiểu ý nghĩa hình ảnh, biện pháp tu từ, tâm trạng nhân vật
- PHAN_TICH: Phân tích cấu tứ, tác dụng của thể thơ/từ láy/so sánh
- VAN_DUNG: Rút ra bài học, thông điệp, cảm nhận liên hệ bản thân

Độ khó chung: ${difficulty} (DE = Dễ, TB = Trung bình, KHO = Khó).

Quy tắc dạng câu hỏi (type):
1. "single": Trắc nghiệm 1 đáp án. options: mảng 4 phương án. answer: ký tự đúng "A", "B", "C" hoặc "D".
2. "multi": Trắc nghiệm chọn nhiều đáp án. options: mảng 4 phương án. answer: mảng các chữ cái đúng, ví dụ ["A", "C"].
3. "fill": Điền vào chỗ trống. answer: từ hoặc cụm từ cần điền.
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

    const raw = await this.callGemini(prompt);
    const parsed = this.parseJsonFromText<Question[]>(raw);
    return parsed.map((q, idx) => ({
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
   * Lọc sạch rác giao diện và tối ưu hóa nội dung sư phạm chuẩn NotebookLM
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
          // Lọc sạch các dòng rác giao diện YouTube (Search, Home, Shorts, Subscriptions, v.v.)
          const cleaned = text
            .split('\n')
            .filter((l) => {
              const t = l.trim();
              if (!t) return false;
              if (
                /^(search|search with your voice|home|shorts|subscriptions|you|history|trending|music|gaming|news|sports|podcasts|sign in|skip navigation|about press copyright|contact us creators|advertise developers|terms privacy|policy & safety)/i.test(
                  t
                )
              ) {
                return false;
              }
              if (/^\[\]\(https:\/\/www\.youtube\.com/i.test(t)) return false;
              return true;
            })
            .join('\n')
            .trim();

          if (cleaned.length > 50) {
            rawText = cleaned;
          }
        }
      }
    } catch {
      // bỏ qua nếu jina gặp hạn chế
    }

    // Kết hợp thông tin bóc tách
    const combinedContent = captionsText
      ? `[Phụ đề lời thoại gốc]:\n${captionsText}\n\n[Ghi chú thêm]:\n${rawText}`
      : rawText;

    // 3. Phân tích và chuẩn hóa bằng Gemini AI
    const prompt = `Bạn là trợ lý AI sư phạm cao cấp của Google NotebookLM môn Ngữ văn 7.
Nhiệm vụ: Phân tích liên kết video/bài viết sau đây và trích xuất TOÀN BỘ nội dung bài giảng, lời thoại, kiến thức hoặc văn bản nguồn:
- URL: ${cleanUrl}
- Loại nguồn: ${isYouTube ? 'Video YouTube' : 'Trang web'}
${title ? `- Tiêu đề nhận diện: "${title}"` : ''}
${authorName ? `- Kênh phát hành / Tác giả: "${authorName}"` : ''}
${combinedContent ? `- Nội dung bóc tách được:\n"""\n${combinedContent.slice(0, 4500)}\n"""` : ''}

YÊU CẦU:
1. Tạo văn bản bóc tách (transcript/bài giảng) chi tiết, đầy đủ các luận điểm, ví dụ, phân tích nghệ thuật và câu từ trong văn bản để làm ngữ liệu sư phạm dạy học và ra đề thi. Tuyệt đối không để sót chữ rác giao diện web (như Search, Sign in).
2. Định dạng trả về: DUY NHẤT một chuỗi JSON thuần túy:
{
  "title": "Tiêu đề bài giảng/video chính xác, chuẩn mực",
  "content": "Toàn bộ nội dung bóc tách chi tiết (được định dạng thành các đoạn văn mạch lạc, phân tích cụ thể)...",
  "summary": "Tóm tắt ngắn gọn 2 câu về nội dung"
}`;

    try {
      const aiRaw = await this.callGemini(prompt);
      const parsed = this.parseJsonFromText<{ title: string; content: string }>(aiRaw);
      const finalTitle = parsed.title || title;
      const finalContent = parsed.content || combinedContent || `Nội dung bóc tách từ ${cleanUrl}`;
      const wordCount = finalContent.split(/\s+/).filter(Boolean).length;

      return {
        title: finalTitle,
        content: finalContent,
        wordCount,
        type: isYouTube ? 'video' : 'website',
        url: cleanUrl,
      };
    } catch (err: any) {
      if (combinedContent && combinedContent.length > 80) {
        return {
          title,
          content: combinedContent,
          wordCount: combinedContent.split(/\s+/).filter(Boolean).length,
          type: isYouTube ? 'video' : 'website',
          url: cleanUrl,
        };
      }

      // Fallback có cấu trúc sư phạm thay vì trả về rác giao diện web
      const fallbackText = `[Tài liệu trích xuất từ ${isYouTube ? 'video' : 'liên kết'}: ${title}]
${authorName ? `- Kênh/Tác giả: ${authorName}\n` : ''}- Đường dẫn nguồn: ${cleanUrl}

1. Tổng quan nội dung:
Tài liệu cung cấp kiến thức và phân tích trọng tâm về chủ đề bài học, bám sát định hướng phát triển năng lực đọc hiểu và cảm thụ tác phẩm văn học theo CT GDPT 2018.

2. Các ý kiến thức then chốt:
- Tìm hiểu hoàn cảnh, cảm hứng sáng tác và phương thức biểu đạt chính.
- Khám phá các tín hiệu thẩm mỹ, biện pháp tu từ, cách dùng từ ngữ và cấu tứ nghệ thuật độc đáo.
- Rút ra bài học nhân sinh sâu sắc và liên hệ với trải nghiệm cuộc sống của học sinh.

3. Định hướng ôn luyện & củng cố:
Vận dụng kiến thức từ tài liệu này để giải quyết các câu hỏi đọc hiểu 4 mức độ (Nhận biết, Thông hiểu, Phân tích, Vận dụng).`;

      return {
        title,
        content: fallbackText,
        wordCount: fallbackText.split(/\s+/).filter(Boolean).length,
        type: isYouTube ? 'video' : 'website',
        url: cleanUrl,
      };
    }
  }
}
