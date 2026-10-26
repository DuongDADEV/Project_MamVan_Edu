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
