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
    const candidateModels = [this.model, 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'].filter(
      (m, idx, arr) => arr.indexOf(m) === idx
    );

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

          // Nếu lỗi 404 (model không tìm thấy), thử model tiếp theo
          if (response.status === 404 || errDetails.includes('not found')) {
            lastError = new Error(`Model ${modelToTry} không khả dụng: ${errDetails}`);
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

    const modelsToTry = [preferredModel, 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'].filter(
      (m, idx, arr) => arr.indexOf(m) === idx
    );

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

    const prompt = `Bạn là chuyên gia khảo thí và ra đề Ngữ văn 7 chuẩn GDPT 2018.
Dựa vào ngữ liệu sau:
${sourcesText}

Chủ đề: "${topic}"
Yêu cầu: Hãy tạo đúng ${count} câu hỏi bám sát 100% ngữ liệu được cung cấp ở trên.
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

Định dạng trả về: DUY NHẤT một mảng JSON thuần túy theo cấu trúc Question[]:
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
}
