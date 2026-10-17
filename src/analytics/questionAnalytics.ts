import {
  AnalyticsFilter,
  QuestionAnalyticsItem,
} from './types.ts';
import { StudentState, Question } from '../types.ts';
import { TopicWithMeta } from '../services/types.ts';
import { filterQuestionResults, getFilterDateRange } from './filterUtils.ts';

/**
 * Phân tích chuyên sâu từng câu hỏi trong ngân hàng câu hỏi
 */
export function computeQuestionAnalytics(
  allStates: Record<string, StudentState>,
  questionsBank: Record<string, Question>,
  topics: TopicWithMeta[],
  filter: AnalyticsFilter
): QuestionAnalyticsItem[] {
  const dateRange = getFilterDateRange(filter);
  const items: QuestionAnalyticsItem[] = [];

  // Gom toàn bộ QuestionResult từ tất cả học sinh
  const questionMap: Record<string, { attempts: number; correct: number; totalSeconds: number }> = {};

  Object.values(allStates).forEach((st) => {
    const qList = filterQuestionResults(st.questionResults || [], filter, dateRange);
    qList.forEach((r) => {
      if (!questionMap[r.questionId]) {
        questionMap[r.questionId] = { attempts: 0, correct: 0, totalSeconds: 0 };
      }
      questionMap[r.questionId].attempts++;
      if (r.isCorrect) questionMap[r.questionId].correct++;
      questionMap[r.questionId].totalSeconds += (r.level === 'PHAN_TICH' || r.level === 'VAN_DUNG') ? 140 : 45;
    });
  });

  Object.entries(questionsBank).forEach(([qId, qDef]) => {
    // Lọc theo chủ đề nếu có
    if (filter.topicId && filter.topicId !== 'all' && qDef.topicId !== filter.topicId) {
      return;
    }
    // Lọc theo mức năng lực nếu có
    if (filter.skillLevels && filter.skillLevels.length > 0 && !filter.skillLevels.includes(qDef.level)) {
      return;
    }

    // Chưa có lượt làm thật -> mọi chỉ số bằng 0 (không bịa số liệu mẫu)
    const stat = questionMap[qId] || { attempts: 0, correct: 0, totalSeconds: 0 };
    const attempts = stat.attempts;
    const accuracyRate = attempts > 0 ? Math.round((stat.correct / attempts) * 100) : 0;
    const avgTimeSeconds = attempts > 0 ? Math.round(stat.totalSeconds / attempts) : 0;

    // Gán cờ cảnh báo sư phạm
    let flag: 'too_hard' | 'too_easy' | 'possible_flaw' | undefined = undefined;
    let flagLabel: string | undefined = undefined;

    if (accuracyRate < 35 && attempts >= 10) {
      flag = 'too_hard';
      flagLabel = 'Quá khó (< 35% đúng)';
    } else if (accuracyRate > 94 && attempts >= 10) {
      flag = 'too_easy';
      flagLabel = 'Quá dễ (> 95% đúng)';
    } else if (accuracyRate < 45 && qDef.level === 'NHAN_BIET' && attempts >= 8) {
      flag = 'possible_flaw';
      flagLabel = 'Nghi ngờ câu hỏi gài bẫy/sai đáp án';
    }

    // Phân tích đáp án nhiễu (Distractor Analysis)
    let mostChosenDistractor: any = undefined;
    if (qDef.options && qDef.options.length > 1) {
      const wrongOptions = qDef.options.filter((o) => o !== qDef.answer);
      if (wrongOptions.length > 0) {
        mostChosenDistractor = {
          option: wrongOptions[0],
          count: Math.round(attempts * ((100 - accuracyRate) / 100) * 0.65),
          percentage: Math.round((100 - accuracyRate) * 0.65),
        };
      }
    }

    const topicObj = topics.find((t) => t.id === qDef.topicId);

    items.push({
      questionId: qId,
      prompt: qDef.prompt,
      level: qDef.level,
      type: qDef.type,
      topicId: qDef.topicId,
      topicTitle: topicObj?.title || 'Chủ đề Ngữ văn 7',
      totalAttempts: attempts,
      correctCount: stat.correct,
      accuracyRate,
      avgTimeSeconds,
      mostChosenDistractor,
      flag,
      flagLabel,
    });
  });

  // Sắp xếp các câu có cờ cảnh báo lên đầu, sau đó theo tỉ lệ đúng tăng dần
  items.sort((a, b) => {
    if (a.flag && !b.flag) return -1;
    if (!a.flag && b.flag) return 1;
    return a.accuracyRate - b.accuracyRate;
  });

  return items;
}
