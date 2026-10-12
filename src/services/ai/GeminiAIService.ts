/**
 * HIỆN THỰC HÓA GOOGLE GEMINI AI STUDIO (GeminiAIService)
 * 
 * Gọi trực tiếp REST API của Google Generative Language:
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
 * 
 * Hỗ trợ các model:
 * - gemini-2.5-flash (tối ưu tốc độ & chất lượng)
 * - gemini-1.5-flash
 * - gemini-1.5-pro
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
import { Question, KeyPoint, TheoryBlock, Difficulty, SkillLevel } from '../../types.ts';

export class GeminiAIService implements AIService {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Gọi API Google Gemini với prompt text
   */
  private async callGemini(prompt: string, systemInstruction?: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
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
      throw new Error(`Google AI Studio Error: ${errDetails}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Google AI Studio không trả về nội dung hợp lệ.');
    }

    return text;
  }

  /**
   * Trích xuất khối JSON từ chuỗi phản hồi của Gemini
   */
  private parseJsonFromText<T>(text: string): T {
    // Tìm cặp ngoặc nhọn hoặc vuông
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text];
    const rawJson = jsonMatch[1] || text;
    const cleaned = rawJson.trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Cố gắng tìm substring giữa [ và ] hoặc { và }
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
    model: string = 'gemini-2.5-flash'
  ): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const startTime = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        return {
          success: false,
          message: `Lỗi kết nối Google AI Studio (${res.status}): ${errMsg}`,
          latencyMs,
        };
      }

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Kết nối thành công!';

      return {
        success: true,
        message: reply,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        message: `Lỗi kết nối mạng: ${err.message || 'Không thể gửi yêu cầu tới Google AI Studio.'}`,
        latencyMs,
      };
    }
  }

  /**
   * Sinh các ý kiến thức trọng tâm từ video/văn bản
   */
  async generateKeySummary(sources: AISource[], options?: AIKeySummaryOptions): Promise<KeyPoint[]> {
    const activeSources = sources.filter((s) => s.isEnabled);
    const sourcesText = activeSources.map((s, idx) => `[Tài liệu ${idx + 1}: ${s.title}]\n${s.content}`).join('\n\n');

    const prompt = `Bạn là chuyên gia sư phạm Ngữ văn 7. Dựa vào các tài liệu nguồn sau đây:
${sourcesText}

Chủ đề: "${options?.focusTopic || 'Ngữ văn 7'}"
Yêu cầu: Hãy trích xuất từ 3 đến 5 ý kiến thức trọng tâm bài học theo chuẩn CT GDPT 2018.
Mỗi ý gồm:
- title: Tiêu đề ý chính (ngắn gọn, xúc tích)
- content: Nội dung phân tích cô đọng, dễ hiểu cho học sinh lớp 7
- example: Câu thơ/đoạn trích dẫn chứng tiêu biểu (nếu có)

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
    const sourcesText = activeSources.map((s, idx) => `[Tài liệu ${idx + 1}: ${s.title}]\n${s.content}`).join('\n\n');

    const prompt = `Bạn là chuyên gia biên soạn giáo án Ngữ văn 7. Dựa vào tài liệu nguồn sau:
${sourcesText}

Chủ đề: "${options?.topicTitle || 'Ngữ văn 7'}"
Hãy tạo các khối lý thuyết chuẩn sư phạm.
Các loại khối được phép:
- 'heading': Tiêu đề mục (level 2 hoặc 3, content)
- 'paragraph': Đoạn văn giải thích kiến thức trọng tâm (content)
- 'example': Ví dụ phân tích (exampleText: đoạn trích/câu thơ, exampleAnalysis: phân tích giá trị)
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
   * Sinh bộ câu hỏi 4 mức năng lực chuẩn GDPT 2018
   */
  async generateQuestions(sources: AISource[], options?: AIQuestionsOptions): Promise<Question[]> {
    const activeSources = sources.filter((s) => s.isEnabled);
    const sourcesText = activeSources.map((s, idx) => `[Tài liệu ${idx + 1}: ${s.title}]\n${s.content}`).join('\n\n');

    const count = options?.totalQuestions || options?.count || 5;
    const difficulty = options?.difficulty || 'TB';
    const topic = options?.topicTitle || 'Ngữ văn 7';

    const prompt = `Bạn là chuyên viên khảo thí và ra đề Ngữ văn 7 chuẩn GDPT 2018.
Dựa vào ngữ liệu sau:
${sourcesText}

Chủ đề: "${topic}"
Yêu cầu tạo chính xác ${count} câu hỏi đa dạng (trắc nghiệm 1 đáp án, nhiều đáp án, điền từ, tự luận ngắn).
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
    "difficulty": "DE",
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

Phong cách nhận xét: ${options?.tone || 'encouraging'} (khích lệ, chỉ ra điểm sáng trước, sau đó góp ý cụ thể để em sửa).
Độ khắt khe: ${options?.strictness || 3}/5.

Hãy chấm điểm từng tiêu chí và đưa ra nhận xét chung.
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
   * Hỏi đáp và trò chuyện với tài liệu nguồn (NotebookLM Style)
   */
  async chatWithSources(
    sources: AISource[],
    message: string,
    history?: { role: 'user' | 'assistant'; text: string }[]
  ): Promise<AIChatResponse> {
    const activeSources = sources.filter((s) => s.isEnabled);
    const sourcesText = activeSources
      .map((s, idx) => `[Tài liệu ID: ${s.id} | Tiêu đề: "${s.title}"]\n${s.content}`)
      .join('\n\n');

    const historyText = (history || [])
      .map((h) => `${h.role === 'user' ? 'Thầy/Cô' : 'AI'}: ${h.text}`)
      .join('\n');

    const prompt = `Bạn là trợ lý AI sư phạm Mầm Văn (phong cách NotebookLM).
Nhiệm vụ của bạn là trả lời câu hỏi của thầy/cô giáo dạy Ngữ văn 7 DỰA TRÊN các tài liệu nguồn đã được cung cấp.

Tài liệu nguồn đã bật:
${sourcesText}

Lịch sử trò chuyện:
${historyText || '(Chưa có)'}

Câu hỏi mới của thầy/cô:
"${message}"

Quy tắc:
1. Trả lời chính xác, bám sát các tài liệu nguồn trên.
2. Trích dẫn cụ thể các câu, đoạn văn từ tài liệu nguồn làm căn cứ.
3. Định dạng trả về: DUY NHẤT một đối tượng JSON:
{
  "reply": "Nội dung câu trả lời đầy đủ, thân thiện và giàu tính sư phạm...",
  "citations": [
    {
      "sourceId": "id của tài liệu nguồn",
      "sourceTitle": "tiêu đề tài liệu nguồn",
      "snippet": "đoạn trích dẫn ngắn minh họa trong tài liệu"
    }
  ]
}`;

    const raw = await this.callGemini(prompt);
    return this.parseJsonFromText<AIChatResponse>(raw);
  }
}
