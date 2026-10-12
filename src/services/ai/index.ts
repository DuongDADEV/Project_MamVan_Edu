/**
 * XUẤT KHẨU AISERVICE INSTANCE VÀ CÁC KIỂU DỮ LIỆU
 * Tự động chuyển đổi thông minh:
 * - Khi người dùng đã nhập Google AI Studio API Key: Gọi Gemini API thật (GeminiAIService)
 * - Khi chưa có API Key hoặc bị lỗi mạng: Tự động dùng MockAIService giả lập chất lượng cao
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
  return localStorage.getItem(STORAGE_API_KEY) || '';
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
): Promise<{ success: boolean; message: string; latencyMs: number }> => {
  return GeminiAIService.testConnection(key, model || getGeminiModel());
};

/**
 * SmartAIService: Tự động gọi Gemini thật khi có API Key, fallback sang Mock
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
      } catch (err) {
        console.warn('GeminiAIService lỗi, tự động chuyển về MockAIService:', err);
      }
    }
    return this.mock.generateKeySummary(sources, options);
  }

  async generateTheory(sources: AISource[], options?: AITheoryOptions): Promise<TheoryBlock[]> {
    const gemini = this.getGeminiService();
    if (gemini) {
      try {
        return await gemini.generateTheory(sources, options);
      } catch (err) {
        console.warn('GeminiAIService lỗi, tự động chuyển về MockAIService:', err);
      }
    }
    return this.mock.generateTheory(sources, options);
  }

  async generateQuestions(sources: AISource[], options?: AIQuestionsOptions): Promise<Question[]> {
    const gemini = this.getGeminiService();
    if (gemini) {
      try {
        return await gemini.generateQuestions(sources, options);
      } catch (err) {
        console.warn('GeminiAIService lỗi, tự động chuyển về MockAIService:', err);
      }
    }
    return this.mock.generateQuestions(sources, options);
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
      } catch (err) {
        console.warn('GeminiAIService lỗi, tự động chuyển về MockAIService:', err);
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
      } catch (err) {
        console.warn('GeminiAIService lỗi, tự động chuyển về MockAIService:', err);
      }
    }
    return this.mock.chatWithSources(sources, message, history);
  }
}

export const aiService: AIService = new SmartAIService();

export { MockAIService, GeminiAIService };
export * from './AIService.ts';
