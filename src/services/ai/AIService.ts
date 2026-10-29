/**
 * LỚP TRỪU TƯỢNG AI (AIService)
 * Điểm giao tiếp duy nhất cho toàn bộ các tính năng AI trong Mầm Văn:
 * - Sinh kiến thức trọng tâm từ video/văn bản
 * - Sinh lý thuyết chi tiết theo khối
 * - Sinh bộ câu hỏi theo 4 mức năng lực chuẩn GDPT 2018
 * - Gợi ý chấm bài viết đoạn văn theo Rubric
 * - Hỏi đáp / Trò chuyện với tài liệu nguồn (Mầm AI Studio style)
 */

import { Question, KeyPoint, TheoryBlock, SkillLevel, QuestionType, Difficulty } from '../../types.ts';

export interface AISource {
  id: string;
  title: string;
  type: 'text' | 'file' | 'transcript';
  content: string;
  wordCount: number;
  isEnabled: boolean;
  fileName?: string;
  createdAt: string;
}

export interface AIKeySummaryOptions {
  focusTopic?: string;
  maxPoints?: number; // Mặc định 3-5 ý
  includeExamples?: boolean;
}

export interface AITheoryOptions {
  topicTitle?: string;
  depth?: 'summary' | 'detailed';
  includeExamples?: boolean;
}

export interface AIQuestionsOptions {
  topicTitle?: string;
  quizType?: string;
  totalQuestions?: number;
  count?: number;
  typeCounts?: {
    single?: number;
    multi?: number;
    fill?: number;
    essay?: number;
    multiple_choice?: number;
    multiple_select?: number;
    fill_blank?: number;
  };
  skillLevels?: Record<string, number>;
  skillLevelsRatio?: {
    recognize?: number;
    comprehend?: number;
    analyze?: number;
    apply?: number;
  };
  difficulty?: Difficulty;
}

export interface AIRubricCriterion {
  id?: string;
  name: string;
  description: string;
  weight?: number; // 0..100 (%)
  maxScore?: number;
}

export interface AIEssayGradingOptions {
  // 29/10: đề bài học sinh phải làm — AI chấm đúng yêu cầu, không chung chung.
  assignmentPrompt?: string;
  tone?: 'encouraging' | 'neutral' | 'strict';
  strictness?: number; // 1 (nhẹ tay) -> 5 (rất khắt khe)
  mentionGoodPointsFirst?: boolean;
  praiseStrengthsFirst?: boolean;
  commentLength?: 'short' | 'medium' | 'detailed';
  feedbackLength?: 'short' | 'medium' | 'detailed';
}

export interface AIEssayGradingResult {
  rubricScores: {
    criterionId?: string;
    criterionName: string;
    suggestedScore: number; // Thang điểm theo trọng số hoặc thang 10
    maxScore: number;
    reason: string;
    comment: string;
  }[];
  totalScore: number; // 0..10
  overallComment: string;
  confidenceScore?: number; // 0..1
}

export interface AIChatCitation {
  sourceId: string;
  sourceTitle: string;
  snippet: string;
}

export interface AIChatResponse {
  reply: string;
  citations: AIChatCitation[];
}

export interface AIExtractedSource {
  title: string;
  content: string;
  wordCount: number;
  type: 'video' | 'website' | 'document';
  url: string;
}

export interface AIService {
  /** Tóm tắt kiến thức trọng tâm sau video/văn bản */
  generateKeySummary(sources: AISource[], options?: AIKeySummaryOptions): Promise<KeyPoint[]>;

  /** Sinh lý thuyết chi tiết theo khối kèm ví dụ minh họa */
  generateTheory(sources: AISource[], options?: AITheoryOptions): Promise<TheoryBlock[]>;

  /** Sinh bộ câu hỏi theo các dạng và 4 mức năng lực */
  generateQuestions(sources: AISource[], options?: AIQuestionsOptions): Promise<Question[]>;

  /** Gợi ý chấm bài viết đoạn văn theo Rubric và phong cách giáo viên */
  suggestEssayGrade(
    essayText: string,
    rubric: AIRubricCriterion[],
    sampleEssays?: any[],
    options?: AIEssayGradingOptions
  ): Promise<AIEssayGradingResult>;

  /** Hỏi đáp với tài liệu nguồn (có trích dẫn nguồn) */
  chatWithSources(
    sources: AISource[],
    message: string,
    history?: { role: 'user' | 'assistant'; text: string }[]
  ): Promise<AIChatResponse>;

  /** Trích xuất nội dung, phụ đề, bài giảng từ link video YouTube hoặc website */
  extractContentFromUrl(url: string): Promise<AIExtractedSource>;
}

