/**
 * Luồng học CẤP CHỦ ĐỀ cho học sinh (26/10): khi cô đăng nhiều bài trong
 * một chủ đề (vd: video, bài tập, lý thuyết, video), học sinh phải thấy ĐỦ
 * các bài và ĐÚNG thứ tự cô đã xếp — thay vì mỗi màn bài học chỉ hiện
 * luồng riêng của 1 bài (trước đây màn video chỉ có Xem video → Trọng tâm
 * → Luyện tập → Hoàn thành nên video thứ 2 vô hình, thứ tự cũng không
 * khớp thứ tự cô đăng).
 *
 * Đường luồng lấy từ flowOrder của chủ đề (xem logic/flowOrder.ts); các
 * mục không còn tồn tại bị bỏ, mục chưa có trong flowOrder được bổ sung
 * cuối theo thứ tự dự phòng video → lý thuyết → bài tập.
 */
import { deriveFlowItems } from './flowOrder.ts';

export type TopicFlowType = 'video' | 'theory' | 'quiz';

export interface TopicFlowItem {
  type: TopicFlowType;
  id: string;
  title: string;
}

const FALLBACK_TITLE: Record<TopicFlowType, string> = {
  video: 'Bài giảng Video',
  theory: 'Bài lý thuyết',
  quiz: 'Bài tập',
};

interface FlowSource {
  id: string;
  title?: string;
  topicId?: string;
}

export function buildTopicFlowPath(args: {
  flowOrder?: string[];
  videos: FlowSource[];
  theories: FlowSource[];
  quizzes: FlowSource[];
}): TopicFlowItem[] {
  const items = deriveFlowItems(
    args.flowOrder,
    args.videos.map((v) => v.id),
    args.theories.map((t) => t.id),
    args.quizzes.map((q) => q.id)
  );
  const byId = new Map<string, FlowSource>();
  for (const v of args.videos) byId.set(`video:${v.id}`, v);
  for (const t of args.theories) byId.set(`theory:${t.id}`, t);
  for (const q of args.quizzes) byId.set(`quiz:${q.id}`, q);
  return items.map((it) => {
    const src = byId.get(`${it.type}:${it.id}`);
    const title = (src?.title || '').trim();
    return { ...it, title: title || FALLBACK_TITLE[it.type] };
  });
}

export function flowIndexOf(
  path: TopicFlowItem[],
  type: TopicFlowType,
  id: string
): number {
  return path.findIndex((it) => it.type === type && it.id === id);
}

export function nextFlowItem(
  path: TopicFlowItem[],
  type: TopicFlowType,
  id: string
): TopicFlowItem | undefined {
  const idx = flowIndexOf(path, type, id);
  return idx >= 0 ? path[idx + 1] : undefined;
}

export function prevFlowItem(
  path: TopicFlowItem[],
  type: TopicFlowType,
  id: string
): TopicFlowItem | undefined {
  const idx = flowIndexOf(path, type, id);
  return idx > 0 ? path[idx - 1] : undefined;
}

/**
 * KHÓA HỌC LẦN LƯỢT (28/10, chủ dự án chốt): học sinh chỉ được mở bài theo
 * đúng thứ tự luồng — bài chưa xong ĐẦU TIÊN là bài đang học (được mở),
 * các bài sau nó bị khóa (xám, không bấm được); bài nào đã xong thì quay
 * lại tự do. "Xong" ở đây là đã hoàn thành lượt học: video/lý thuyết tới
 * bước Hoàn thành, bài tập đã nộp ít nhất 1 lần — KHÔNG đòi làm đúng hết,
 * vì bài kiểm tra 1 lần mà trả lời sai thì không được làm lại, đòi đúng hết
 * sẽ khóa chết cả luồng phía sau.
 */
export function isFlowItemFinished(
  item: { type: TopicFlowType; id: string },
  completedSteps: string[] | undefined
): boolean {
  const steps = new Set(completedSteps || []);
  if (item.type === 'video') return steps.has(`video_flow_completed:${item.id}`);
  if (item.type === 'theory') return steps.has(`theory_flow_completed:${item.id}`);
  return steps.has(`quiz_completed:${item.id}`);
}

/** Vị trí các mục bị khóa trong luồng: mọi mục sau mục chưa xong đầu tiên. */
export function flowLockedIndexes(
  path: Array<{ type: TopicFlowType; id: string }>,
  completedSteps: string[] | undefined
): Set<number> {
  const locked = new Set<number>();
  const firstUnfinished = path.findIndex((it) => !isFlowItemFinished(it, completedSteps));
  if (firstUnfinished === -1) return locked;
  for (let i = firstUnfinished + 1; i < path.length; i++) locked.add(i);
  return locked;
}

/** Mục có nằm trong luồng mà đang bị khóa không (mục ngoài luồng thì không khóa). */
export function isFlowItemLocked(
  path: Array<{ type: TopicFlowType; id: string }>,
  completedSteps: string[] | undefined,
  type: TopicFlowType,
  id: string
): boolean {
  const idx = flowIndexOf(path as TopicFlowItem[], type, id);
  if (idx === -1) return false;
  return flowLockedIndexes(path, completedSteps).has(idx);
}
