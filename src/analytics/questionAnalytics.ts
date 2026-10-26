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

  // Gom toàn bộ QuestionResult từ tất cả học sinh. LƯU Ý TRUNG THỰC SỐ LIỆU:
  // QuestionResult KHÔNG lưu thời gian làm từng câu và KHÔNG lưu đáp án học
  // sinh đã chọn — hai chỉ số đó không suy ra được từ dữ liệu thật nên không
  // tính (trước đây bị gán cứng 140/45 giây theo mức và hệ số 0,65 cho đáp án
  // nhiễu; đã gỡ hẳn).
  const questionMap: Record<string, { attempts: number; correct: number }> = {};

  Object.values(allStates).forEach((st) => {
    const qList = filterQuestionResults(st.questionResults || [], filter, dateRange);
    qList.forEach((r) => {
      if (!questionMap[r.questionId]) {
        questionMap[r.questionId] = { attempts: 0, correct: 0 };
      }
      questionMap[r.questionId].attempts++;
      if (r.isCorrect) questionMap[r.questionId].correct++;
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
    const stat = questionMap[qId] || { attempts: 0, correct: 0 };
    const attempts = stat.attempts;
    const accuracyRate = attempts > 0 ? Math.round((stat.correct / attempts) * 100) : 0;
    // Không có dữ liệu thời gian làm bài thật theo từng câu -> 0 (không suy đoán)
    const avgTimeSeconds = 0;

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

    // Phân tích đáp án nhiễu: KHÔNG tính — dữ liệu làm bài không lưu đáp án
    // học sinh đã chọn nên không đếm thật được; để trống để giao diện ẩn khối
    // này thay vì gán một đáp án sai bất kỳ với tỉ lệ phần trăm suy đoán.
    const mostChosenDistractor = undefined;

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
