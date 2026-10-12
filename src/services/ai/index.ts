/**
 * XUẤT KHẨU AISERVICE INSTANCE VÀ CÁC KIỂU DỮ LIỆU
 * Tự động chuyển đổi thông minh:
 * - Khi người dùng đã nhập Google AI Studio API Key: Gọi Gemini AI thật 100%
 * - Khi chưa có API Key: Báo rõ ràng cần nhập API Key để kích hoạt AI thật, tránh trả lời mặc định gây hiểu lầm
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
import { MockAIService } from './MockAIService.ts';
import { GeminiAIService } from './GeminiAIService.ts';
import { Question, KeyPoint, TheoryBlock } from '../../types.ts';

const STORAGE_API_KEY = 'mamvan_gemini_api_key';
const STORAGE_MODEL_KEY = 'mamvan_gemini_model';

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
  if (typeof window === 'undefined') return 'gemini-2.5-flash';
  return localStorage.getItem(STORAGE_MODEL_KEY) || 'gemini-2.5-flash';
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
class SmartAIService implements AIService {
  private mock = new MockAIService();

  private getGeminiService(): GeminiAIService | null {
    const key = getGeminiApiKey();
    if (key && key.trim().length > 5) {
      return new GeminiAIService(key, getGeminiModel());
    }
    return null;
  }

  async generateKeySummary(sources: AISource[], options?: AIKeySummaryOptions): Promise<KeyPoint[]> {
    const gemini = this.getGeminiService();
    if (gemini) {
      try {
        return await gemini.generateKeySummary(sources, options);
      } catch (err: any) {
        console.error('GeminiAIService lỗi:', err);
        throw new Error(`Google AI Studio lỗi: ${err.message || 'Không thể sinh ý trọng tâm'}`);
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
        console.error('GeminiAIService lỗi:', err);
        throw new Error(`Google AI Studio lỗi: ${err.message || 'Không thể sinh lý thuyết'}`);
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
        console.error('Gemini generateQuestions lỗi:', err);
        throw new Error(`Google AI Studio lỗi sinh câu hỏi: ${err.message || 'Không thể sinh câu hỏi'}`);
      }
    }
    // Nếu chưa có API Key, ném lỗi rõ ràng để UI hiển thị nút nhập Key thay vì trả về mock ngầm
    throw new Error('Chưa cấu hình Google AI Studio API Key! Vui lòng nhập API Key để kích hoạt AI thật sinh câu hỏi.');
  }

  async suggestEssayGrade(
    essayText: string,
    rubric: AIRubricCriterion[],
    sampleEssays?: any[],
    options?: AIEssayGradingOptions
  ): Promise<AIEssayGradingResult> {
    const gemini = this.getGeminiService();
    if (gemini) {
      try {
        return await gemini.suggestEssayGrade(essayText, rubric, sampleEssays, options);
      } catch (err: any) {
        console.error('GeminiAIService lỗi:', err);
      }
    }
    return this.mock.suggestEssayGrade(essayText, rubric, sampleEssays, options);
  }

  async chatWithSources(
    sources: AISource[],
    message: string,
    history?: { role: 'user' | 'assistant'; text: string }[]
  ): Promise<AIChatResponse> {
    const gemini = this.getGeminiService();
    if (gemini) {
      try {
        return await gemini.chatWithSources(sources, message, history);
      } catch (err: any) {
        console.error('Gemini live chat error:', err);
        return {
          reply: `⚠️ Lỗi khi kết nối Google AI Studio (${err.message || 'Lỗi mạng'}).\n\nVui lòng kiểm tra lại API Key hoặc đổi mô hình (Model) trong phần cài đặt API Key.`,
          citations: [],
        };
      }
    }

    // Khi CHƯA có API key:
    return {
      reply: `⚠️ **Chưa kích hoạt Google AI Studio API Key!**\n\nĐể AI hoạt động **thật 100% giống như NotebookLM** (đọc hiểu, đối chiếu ngữ liệu, trích dẫn từng câu thơ và trả lời theo ngữ cảnh), thầy/cô vui lòng bấm vào nút **"🔑 Cấu hình API Key"** ở thanh trên cùng để dán API Key của Google AI Studio (miễn phí tại \`aistudio.google.com\`).`,
      citations: [],
    };
  }

  async extractContentFromUrl(url: string): Promise<AIExtractedSource> {
    const gemini = this.getGeminiService();
    if (gemini) {
      try {
        return await gemini.extractContentFromUrl(url);
      } catch (err: any) {
        console.error('Gemini extractContentFromUrl error:', err);
      }
    }
    return this.mock.extractContentFromUrl(url);
  }
}

export const aiService: AIService = new SmartAIService();

export { MockAIService, GeminiAIService };
export * from './AIService.ts';

