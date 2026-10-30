import type {
  QuizWithMeta,
  TheoryLessonWithMeta,
  TopicWithMeta,
  VideoLessonWithMeta,
} from '../services/types.ts';

/**
 * Thông báo "có bài mới" cho học sinh — SUY RA từ chính nội dung đã xuất bản:
 * mỗi lần thầy/cô xuất bản (lại) một bài, mốc published_at của bài được ghi
 * mới, và bài đó trở thành 1 thông báo cho học sinh thuộc lớp được giao.
 * Trạng thái đã đọc lưu trong StudentState (seenNotificationIds) nên đồng bộ
 * theo tài khoản học sinh qua Supabase — em mở máy nào cũng nhất quán.
 * Không cần bảng dữ liệu riêng.
 */
export interface StudentNotification {
  id: string;
  kind: 'video' | 'theory' | 'quiz' | 'topic';
  itemId: string;
  topicId?: string;
  kindLabel: string;
  title: string;
  topicTitle?: string;
  publishedAt: number;
  quizKind?: string;
}

const QUIZ_KIND_LABELS: Record<string, string> = {
  practice: 'Bài luyện tập mới',
  quick: 'Bài kiểm tra mới',
  mastery: 'Bài kiểm tra Mastery mới',
  reading: 'Bài đọc hiểu mới',
  final: 'Bài kiểm tra mới',
  homework: 'Bài tập về nhà mới',
};

const FOURTEEN_DAYS = 14 * 24 * 3600 * 1000;

interface BuildInput {
  videos: VideoLessonWithMeta[];
  theories: TheoryLessonWithMeta[];
  quizzes: QuizWithMeta[];
  topics: TopicWithMeta[];
  classId?: string;
  className?: string;
  now?: number;
}

export function buildStudentNotifications(input: BuildInput): StudentNotification[] {
  const now = input.now ?? Date.now();
  const topicTitleById = new Map(input.topics.map((t) => [t.id, t.title]));

  const targeted = (classIds?: string[]) => {
    if (!classIds || classIds.length === 0) return true;
    if (classIds.includes('all')) return true;
    if (input.classId && classIds.includes(input.classId)) return true;
    if (input.className && classIds.includes(input.className)) return true;
    return false;
  };

  const fresh = (publishedAt?: string) => {
    if (!publishedAt) return 0;
    const ts = Date.parse(publishedAt);
    if (Number.isNaN(ts)) return 0;
    if (ts > now + 5 * 60 * 1000) return 0;
    if (now - ts > FOURTEEN_DAYS) return 0;
    return ts;
  };

  const out: StudentNotification[] = [];

  input.videos.forEach((v) => {
    const ts = fresh(v.published_at);
    if (v.status === 'published' && ts && targeted(v.class_ids)) {
      out.push({
        id: `notif_video_${v.id}_${ts}`,
        kind: 'video',
        itemId: v.id,
        topicId: v.topicId,
        kindLabel: 'Bài giảng video mới',
        title: v.title,
        topicTitle: topicTitleById.get(v.topicId),
        publishedAt: ts,
      });
    }
  });

  input.theories.forEach((th) => {
    const ts = fresh(th.published_at);
    if (th.status === 'published' && ts && targeted(th.class_ids)) {
      out.push({
        id: `notif_theory_${th.id}_${ts}`,
        kind: 'theory',
        itemId: th.id,
        topicId: th.topicId,
        kindLabel: 'Bài lý thuyết mới',
        title: th.title,
        topicTitle: topicTitleById.get(th.topicId),
        publishedAt: ts,
      });
    }
  });

  input.quizzes.forEach((q) => {
    const ts = fresh((q as QuizWithMeta).published_at);
    if (q.status === 'published' && ts && targeted(q.class_ids)) {
      out.push({
        id: `notif_quiz_${q.id}_${ts}`,
        kind: 'quiz',
        itemId: q.id,
        topicId: q.topicId,
        kindLabel: QUIZ_KIND_LABELS[q.kind] || 'Bài tập mới',
        title: q.title,
        topicTitle: topicTitleById.get(q.topicId),
        publishedAt: ts,
        quizKind: q.kind,
      });
    }
  });

  // Gộp theo chủ đề: 1 chủ đề cập nhật = 1 thông báo mang tên chủ đề, thay vì
  // 1 thông báo cho mỗi video/lý thuyết/bài tập trong chủ đề đó (trước đây cô
  // đăng 1 chủ đề gồm video + 2 bài luyện tập là học sinh nhận 3 thông báo).
  // Ngoại lệ: bài tập về nhà (kind homework) là bài giao riêng nên giữ từng cái;
  // mục không rõ chủ đề cũng giữ lẻ. Chủ đề chỉ có 1 mục mới thì giữ nguyên
  // thông báo lẻ để bấm vào mở thẳng mục đó.
  const grouped: StudentNotification[] = [];
  const byTopic = new Map<string, StudentNotification[]>();
  for (const n of out) {
    if ((n.kind === 'quiz' && n.quizKind === 'homework') || !n.topicId || !n.topicTitle) {
      grouped.push(n);
      continue;
    }
    const arr = byTopic.get(n.topicId);
    if (arr) arr.push(n);
    else byTopic.set(n.topicId, [n]);
  }
  for (const [topicId, items] of byTopic) {
    if (items.length === 1) {
      grouped.push(items[0]);
      continue;
    }
    const maxTs = Math.max(...items.map((i) => i.publishedAt));
    grouped.push({
      id: `notif_topic_${topicId}_${maxTs}`,
      kind: 'topic',
      itemId: topicId,
      topicId,
      kindLabel: 'Chủ đề mới cập nhật',
      title: items[0].topicTitle!,
      topicTitle: `${items.length} nội dung mới`,
      publishedAt: maxTs,
    });
  }
  return grouped.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 20);
}

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
