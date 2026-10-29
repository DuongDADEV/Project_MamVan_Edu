import { QuestionResult, StudentState, MasteryStatus } from '../types.ts';
import { TopicWithMeta, QuizWithMeta, QuestionWithMeta } from '../services/types.ts';
import { deriveFlowItems, parseFlowKey } from './flowOrder.ts';

/**
 * Lá cây tri thức theo TIẾN ĐỘ LUỒNG HỌC (29/10, chủ dự án chốt: "ôn 100%
 * rồi sao không đổi màu — đổi màu như ghi chú").
 *
 * Trước đây lá lấy từ độ vững trắc nghiệm (calculateAllMastery) và bị khóa
 * xám "Chưa học" khi chưa đủ 3 câu NHAN_BIET đã làm — nên học sinh xong
 * 100% luồng (đủ video/lý thuyết/bài tập) vẫn thấy lá xám, lệch với thanh
 * tiến độ 100% ở màn Học bài và với chính ghi chú trên cây (≥80% đã hoàn
 * thành). Nay lá dùng đúng phần trăm tiến độ của màn Học bài
 * (countTopicFlowDone): 0% → xám Chưa học, 1–49% → vàng Cần ôn lại,
 * 50–79% → xanh biển Đang học, ≥80% → xanh đậm Đã hoàn thành. Trả đúng
 * shape TopicLeafData của GrowthTree (trường masteryStatus giữ tên cũ để
 * khỏi đổi component, nhưng giá trị nay phản ánh tiến độ luồng).
 */
export function buildTopicLeaf(
  topic: { id: string; title: string; flowOrder?: string[]; videoIds?: string[]; theoryId?: string },
  quizzes: QuizWithMeta[],
  questions: Record<string, QuestionWithMeta>,
  completedSteps: string[],
  results: QuestionResult[]
): { topicId: string; topicTitle: string; masteryStatus: MasteryStatus; percentage: number } {
  const { done, total } = countTopicFlowDone(
    topic as TopicWithMeta,
    quizzes,
    questions,
    completedSteps,
    results
  );
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
  const masteryStatus: MasteryStatus =
    percentage >= 80
      ? 'SOLID'
      : percentage >= 50
        ? 'PROGRESSING'
        : percentage > 0
          ? 'NEEDS_REVIEW'
          : 'INSUFFICIENT_DATA';
  return { topicId: topic.id, topicTitle: topic.title, masteryStatus, percentage };
}

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
// LUẬT 28/10 (chủ dự án): luồng cô xếp (flowOrder) là danh sách chính thức
// của chủ đề — MỌI mục trong đó đều tính, kể cả bài đang nháp. Trước đây
// chỉ video trong videoIds được tính bất kể trạng thái, còn quiz chỉ tính
// khi đã xuất bản và lý thuyết chỉ tính khi là theoryId — nên bài nháp
// "tàng hình" khỏi mẫu số. Bài nháp tính là chưa xong (học sinh chưa mở
// được) cho tới khi xuất bản + hoàn thành. Chủ đề chưa xếp luồng thì giữ
// cách tính cũ (suy ra từ videoIds/theoryId/quiz) để không vỡ chủ đề cũ.
export function countTopicFlowDone(
  topic: { id: string; flowOrder?: string[]; videoIds?: string[]; theoryId?: string },
  quizzes: QuizWithMeta[],
  questions: Record<string, QuestionWithMeta>,
  completedSteps: string[],
  results: QuestionResult[]
): { done: number; total: number } {
  const steps = new Set(completedSteps || []);
  let items: { type: 'video' | 'theory' | 'quiz'; id: string }[];
  const ordered: { type: 'video' | 'theory' | 'quiz'; id: string }[] = [];
  const seen = new Set<string>();
  for (const key of topic.flowOrder || []) {
    const it = parseFlowKey(key);
    if (it && !seen.has(key)) {
      seen.add(key);
      ordered.push(it);
    }
  }
  if (ordered.length > 0) {
    items = ordered;
  } else {
    const quizIds = getTopicQuizIds(topic as TopicWithMeta, quizzes);
    const theoryIds = topic.theoryId ? [topic.theoryId] : [];
    items = deriveFlowItems(topic.flowOrder, topic.videoIds || [], theoryIds, quizIds);
  }
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
