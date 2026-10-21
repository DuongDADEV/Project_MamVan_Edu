import { QuestionResult, StudentState } from '../types.ts';
import { TopicWithMeta, QuizWithMeta, QuestionWithMeta } from '../services/types.ts';
import { deriveFlowItems } from './flowOrder.ts';
import { awardXP, XP_KEYS } from './xpEngine.ts';

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
  const quizIds = getTopicQuizIds(topic, quizzes);
  const theoryIds = topic.theoryId ? [topic.theoryId] : [];
  const items = deriveFlowItems(topic.flowOrder, topic.videoIds || [], theoryIds, quizIds);
  if (items.length === 0) return false;
  const steps = new Set(completedSteps || []);
  return items.every((item) => {
    if (item.type === 'video') return steps.has(`video_flow_completed:${item.id}`);
    if (item.type === 'theory') return steps.has(`theory_flow_completed:${item.id}`);
    const quiz = quizzes.find((q) => q.id === item.id);
    if (!quiz) return false;
    return isQuizAllCorrect(quiz, questions, results);
  });
}

/**
 * Nếu chủ đề đã hoàn thành toàn bộ và học sinh chưa nhận quỹ XP của chủ đề
 * này, trao XP ngay. Trả về state mới + số XP đã trao; chưa đủ điều kiện thì
 * trả về null.
 */
export function tryAwardTopicCompletion(
  state: StudentState,
  topic: TopicWithMeta,
  quizzes: QuizWithMeta[],
  questions: Record<string, QuestionWithMeta>
): { state: StudentState; awardedXp: number } | null {
  const reward = Math.max(0, Math.floor(topic.xpReward || 0));
  if (reward <= 0) return null;
  const key = XP_KEYS.topicComplete(topic.id);
  const awarded = state.xpAwardedSteps ?? state.completedSteps;
  if (awarded.includes(key)) return null;
  if (
    !isTopicFullyComplete(
      topic,
      quizzes,
      questions,
      state.completedSteps || [],
      state.questionResults || []
    )
  ) {
    return null;
  }
  const res = awardXP(state, key, reward, `Hoàn thành chủ đề: ${topic.title}`);
  if (res.actualXp <= 0) return null;
  return { state: { ...state, ...res.updatedState }, awardedXp: res.actualXp };
}
