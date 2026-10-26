/**
 * XUẤT KHẨU AISERVICE INSTANCE VÀ CÁC KIỂU DỮ LIỆU
 * Đợt 25/10: AI chạy qua proxy của admin (/api/ai/chat) — giáo viên
 * không nhập key nữa, key và model do admin quản lý. Mock chỉ còn là
 * dự phòng khi proxy lỗi (UI bắt buộc kiểm tra getLastAiFallback để
 * cảnh báo, không gắn nhãn "Sinh bởi AI" cho nội dung dự phòng).
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
import { MockAIService } from './MockAIService.ts';
import { GeminiAIService } from './GeminiAIService.ts';
import { Question, KeyPoint, TheoryBlock } from '../../types.ts';

const STORAGE_API_KEY = 'mamvan_gemini_api_key';
const STORAGE_MODEL_KEY = 'mamvan_gemini_model';

// LEGACY (đợt 25/10): key giáo viên không còn dùng — key nằm ở admin/proxy.
// Giữ lại các hàm này để không vỡ import cũ; màn hình nhập key đã xóa.

export const getGeminiApiKey = (): string => {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_API_KEY);
  if (stored && stored.trim()) return stored.trim();
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) return envKey.trim();
  return '';
};

export const setGeminiApiKey = (key: string): void => {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    localStorage.setItem(STORAGE_API_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_API_KEY);
  }
};

export const getGeminiModel = (): string => {
  if (typeof window === 'undefined') return 'gemini-flash-latest';
  return localStorage.getItem(STORAGE_MODEL_KEY) || 'gemini-flash-latest';
};

export const setGeminiModel = (model: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_MODEL_KEY, model);
};

export const testGeminiApiKey = async (
  key: string,
  model?: string
): Promise<{ success: boolean; message: string; latencyMs: number; workingModel?: string }> => {
  return GeminiAIService.testConnection(key, model || getGeminiModel());
};

/**
 * SmartAIService: Gọi Gemini AI thật khi có API Key, báo rõ ràng khi chưa cấu hình
 */
// Sổ ghi nhận lần gần nhất Gemini lỗi và hệ thống phải dùng bản dự phòng (Mock).
// UI BẮT BUỘC kiểm tra sau mỗi lần sinh nội dung để cảnh báo giáo viên —
// không được lặng lẽ gắn nhãn "Sinh bởi Gemini AI" cho nội dung dự phòng.
export interface AiFallbackInfo {
  method: string;
  reason: string;
  at: number;
}
let lastAiFallback: AiFallbackInfo | null = null;
export const getLastAiFallback = (): AiFallbackInfo | null => lastAiFallback;
export const clearLastAiFallback = (): void => {
  lastAiFallback = null;
};
const noteAiFallback = (method: string, err: any): void => {
  lastAiFallback = {
    method,
    reason: err?.message || String(err || 'Không rõ lỗi'),
    at: Date.now(),
  };
};

class SmartAIService implements AIService {
  private mock = new MockAIService();

  private getGeminiService(): GeminiAIService {
    // Đợt 25/10: AI luôn chạy qua proxy admin — không còn cổng key nữa.
    return new GeminiAIService();
  }

  async generateKeySummary(sources: AISource[], options?: AIKeySummaryOptions): Promise<KeyPoint[]> {
    const gemini = this.getGeminiService();
    if (gemini) {
      try {
        return await gemini.generateKeySummary(sources, options);
      } catch (err: any) {
        console.warn('GeminiAIService lỗi generateKeySummary, tự động dùng bộ sinh dự phòng chuẩn GDPT 2018:', err);
        noteAiFallback('generateKeySummary', err);
        return this.mock.generateKeySummary(sources, options);
      }
    }
    // Nếu chưa có API Key: dùng Mock kèm thông báo
    return this.mock.generateKeySummary(sources, options);
  }

  async generateTheory(sources: AISource[], options?: AITheoryOptions): Promise<TheoryBlock[]> {
    const gemini = this.getGeminiService();
    if (gemini) {
      try {
        return await gemini.generateTheory(sources, options);
      } catch (err: any) {
        console.warn('GeminiAIService lỗi generateTheory, tự động dùng bộ sinh dự phòng chuẩn GDPT 2018:', err);
        noteAiFallback('generateTheory', err);
        return this.mock.generateTheory(sources, options);
      }
    }
    return this.mock.generateTheory(sources, options);
  }

  async generateQuestions(sources: AISource[], options?: AIQuestionsOptions): Promise<Question[]> {
    const gemini = this.getGeminiService();
    if (gemini) {
      try {
        return await gemini.generateQuestions(sources, options);
      } catch (err: any) {
        console.warn('Gemini generateQuestions lỗi, tự động dùng bộ sinh câu hỏi sư phạm:', err);
        noteAiFallback('generateQuestions', err);
        return this.mock.generateQuestions(sources, options);
      }
    }
    // Nếu chưa có API Key: dùng Mock chuẩn để đảm bảo trải nghiệm không bị chặn
    return this.mock.generateQuestions(sources, options);
  }

  async suggestEssayGrade(
    essayText: string,
    rubric: AIRubricCriterion[],
    sampleEssays?: any[],
    options?: AIEssayGradingOptions
  ): Promise<AIEssayGradingResult> {
    // Đợt QA 26/10, blocker 5: đường chấm bài KHÔNG được trả điểm mock im
    // lặng. Trước đây Gemini lỗi → rơi xuống mock.suggestEssayGrade (điểm
    // công thức, confidenceScore 0.92 bịa) mà giáo viên không biết. Nay: lỗi
    // thì ném rõ — caller phải hiện lỗi cho người dùng (xem AiTrainingStudio;
    // đường auto-gợi ý khi nộp bài đã bắt lỗi và giữ trạng thái chờ chấm).
    const gemini = this.getGeminiService();
    if (gemini) {
      return await gemini.suggestEssayGrade(essayText, rubric, sampleEssays, options);
    }
    throw new Error('Chưa cấu hình dịch vụ AI — không thể chấm tự luận. Vui lòng thử lại sau, đừng dùng điểm ước lượng.');
  }

  async chatWithSources(
    sources: AISource[],
    message: string,
    history?: { role: 'user' | 'assistant'; text: string }[]
  ): Promise<AIChatResponse> {
    const gemini = this.getGeminiService();
    try {
      return await gemini.chatWithSources(sources, message, history);
    } catch (err: any) {
      console.error('AI proxy chat error:', err);
      return {
        reply: `⚠️ Lỗi khi kết nối AI (${err.message || 'Lỗi mạng'}).\n\nVui lòng thử lại sau ít phút.`,
        citations: [],
      };
    }
  }

  async extractContentFromUrl(url: string): Promise<AIExtractedSource> {
    // Đợt QA 26/10, blocker 5: đường trích xuất KHÔNG được trả nội dung mock
    // im lặng. Lỗi thì ném rõ để caller báo người dùng.
    const gemini = this.getGeminiService();
    if (gemini) {
      return await gemini.extractContentFromUrl(url);
    }
    throw new Error('Chưa cấu hình dịch vụ AI — không trích xuất được nội dung từ liên kết.');
  }
}

export const aiService: AIService = new SmartAIService();

export { MockAIService, GeminiAIService };
export * from './AIService.ts';

