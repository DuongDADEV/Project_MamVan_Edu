import { QuestionResult, StudentState } from '../types.ts';
import { TopicWithMeta, QuizWithMeta, QuestionWithMeta } from '../services/types.ts';
import { deriveFlowItems } from './flowOrder.ts';

/**
 * Đánh giá hoàn thành TOÀN BỘ chủ đề theo mô hình XP mới (chủ dự án duyệt
 * 22/10/2026). Một chủ đề được tính hoàn thành khi MỌI mục trong luồng học
 * đều xong:
 *  - Video: đã hoàn thành trọn luồng video (video_flow_completed:<id>);
 *  - Lý thuyết: đã hoàn thành trọn luồng lý thuyết (theory_flow_completed:<id>);
 *  - Bài tập/Bài kiểm tra: làm ĐÚNG HẾT phần chấm tự động — với mỗi câu
 *    trắc nghiệm/điền từ của bài, học sinh có ít nhất một lượt làm đúng trọn
 *    vẹn. Câu tự luận KHÔNG chặn điều kiện (phải chờ giáo viên chấm tay).
 * Chủ đề rỗng (không có mục nào) không bao giờ được tính hoàn thành.
 */

const AUTO_TYPES = new Set(['single', 'multiple', 'multi', 'fill', 'fill_in', 'fill_in_blank', 'single_choice', 'multiple_choice']);

export function getTopicQuizIds(topic: TopicWithMeta, quizzes: QuizWithMeta[]): string[] {
  return quizzes.filter((q) => (q as any).topicId === topic.id).map((q) => q.id);
}

export function isQuizAllCorrect(
  quiz: QuizWithMeta,
  questions: Record<string, QuestionWithMeta>,
  results: QuestionResult[]
): boolean {
  const qIds: string[] = (quiz as any).questionIds || [];
  const autoIds = qIds.filter((qid) => {
    const q: any = questions[qid];
    if (!q) return false;
    return AUTO_TYPES.has(String(q.type || 'single'));
  });
  if (autoIds.length === 0) {
    // Bài chỉ có tự luận (hoặc không có câu): coi như đạt khi đã làm bài —
    // lượt làm được ghi qua quiz_completed hoặc có kết quả nộp.
    return results.some((r) => qIds.includes(r.questionId));
  }
  return autoIds.every((qid) =>
    results.some((r) => r.questionId === qid && (r.isCorrect || (r.scoreRatio ?? 0) >= 1))
  );
}

export function isTopicFullyComplete(
  topic: TopicWithMeta,
  quizzes: QuizWithMeta[],
  questions: Record<string, QuestionWithMeta>,
  completedSteps: string[],
  results: QuestionResult[]
): boolean {
  const { done, total } = countTopicFlowDone(topic, quizzes, questions, completedSteps, results);
  return total > 0 && done === total;
}

// Số mục luồng đã xong / tổng số mục — cùng vị ngữ với
// isTopicFullyComplete, để thanh tiến độ của học sinh và bảng hoàn thành
// của giáo viên không còn lệch nhau (28/10: thanh cũ chỉ đếm video_watch
// nên học sinh xem đủ video đã hiện 100% dù chưa xong lý thuyết/bài tập).
export function countTopicFlowDone(
  topic: { id: string; flowOrder?: string[]; videoIds?: string[]; theoryId?: string },
  quizzes: QuizWithMeta[],
  questions: Record<string, QuestionWithMeta>,
  completedSteps: string[],
  results: QuestionResult[]
): { done: number; total: number } {
  const quizIds = getTopicQuizIds(topic as TopicWithMeta, quizzes);
  const theoryIds = topic.theoryId ? [topic.theoryId] : [];
  const items = deriveFlowItems(topic.flowOrder, topic.videoIds || [], theoryIds, quizIds);
  const steps = new Set(completedSteps || []);
  let done = 0;
  for (const item of items) {
    if (item.type === 'video') {
      if (steps.has(`video_flow_completed:${item.id}`)) done++;
    } else if (item.type === 'theory') {
      if (steps.has(`theory_flow_completed:${item.id}`)) done++;
    } else {
      const quiz = quizzes.find((q) => q.id === item.id);
      if (quiz && isQuizAllCorrect(quiz, questions, results)) done++;
    }
  }
  return { done, total: items.length };
}

/**
 * GĐ3: trao quỹ XP chủ đề KHÔNG còn tính ở client (xpEngine.ts đã xóa).
 * Màn App gọi POST /api/topics/:id/complete khi vị ngữ thuần dưới đây
 * báo chủ đề đã hoàn thành toàn bộ; server tự kiểm tra đã trao quỹ hay
 * chưa và trả { awarded, totalXp }. File này chỉ còn giữ các vị ngữ
 * thuần (đọc completedSteps/questionResults, không ghi XP) — pbixDashboard
 * cũng dùng isTopicFullyComplete để tính bảng tiến độ chủ đề.
 */
