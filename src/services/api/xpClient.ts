/**
 * Gọi API server cho các đường XP (GĐ3) — thay toàn bộ logic cộng/trừ XP
 * phía client (logic/xpEngine.ts đã xóa).
 *
 * - Điểm danh: POST /api/student-states/:id/check-in → tổng XP mới.
 * - Nộp bài độc lập: POST /api/attempts → attempt + tổng XP mới (đường
 *   này nằm ở biClient.submitAssignmentAttempt; màn App chỉ nhận totalXp
 *   server trả qua onSubmitted).
 * - Hoàn thành chủ đề: POST /api/topics/:id/complete → { awarded, totalXp }
 *   (server tự kiểm tra đã hoàn thành toàn bộ + đã trao quỹ hay chưa;
 *   gọi lặp là idempotent — awarded = false nếu đã trao).
 * - Hoàn thành quiz nội dung: POST /api/quiz-completions → { awarded,
 *   awardedXp, totalXp } (server kiểm tra quiz published + đúng lớp,
 *   chặn trên điểm bằng tổng max_score câu hỏi, chỉ trả 1 lần/quiz).
 *
 * UI chỉ hiển thị tổng XP do server trả, không tự tính. Mọi hàm ném lỗi
 * khi API lỗi — caller quyết định toast, không tự cộng XP bù.
 */
import { apiFetch } from './http.ts';

export interface CheckInResult {
  /** Tổng XP mới của học sinh sau điểm danh (server tính). */
  totalXp: number;
  /** XP hôm nay / XP tuần server trả (để client đồng bộ, không tự tính). */
  xpToday?: number;
  xpWeek?: number;
  /** true nếu lần gọi này điểm danh thành công (false = hôm nay đã điểm danh). */
  checkedIn: boolean;
  /** true nếu hôm nay đã điểm danh từ trước (server chống cộng trùng theo ngày). */
  alreadyCheckedIn: boolean;
  /** Số ngày điểm danh trong tuần server ghi nhận (nếu server trả). */
  attendanceDays?: number;
}

export interface TopicCompleteResult {
  /** true nếu lần gọi này trao quỹ XP chủ đề (false = đã trao trước đó hoặc chưa đủ điều kiện). */
  awarded: boolean;
  /** true nếu server xác nhận chủ đề đã hoàn thành toàn bộ theo state server. */
  complete: boolean;
  /** Tổng XP mới của học sinh. */
  totalXp: number;
  /** XP hôm nay / XP tuần server trả (để client đồng bộ, không tự tính). */
  xpToday?: number;
  xpWeek?: number;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function unwrap(data: any): any {
  if (data && typeof data === 'object' && !Array.isArray(data) && data.data && typeof data.data === 'object') {
    return data.data;
  }
  return data;
}

export async function checkInStudent(studentId: string): Promise<CheckInResult> {
  const raw = unwrap(await apiFetch(`/api/student-states/${encodeURIComponent(studentId)}/check-in`, {
    method: 'POST',
  }));
  const totalXp = num(raw?.totalXp ?? raw?.total_xp);
  if (totalXp === undefined) {
    throw new Error('Máy chủ điểm danh không trả về tổng XP mới.');
  }
  return {
    totalXp,
    checkedIn: raw?.checkedIn === true,
    alreadyCheckedIn: raw?.alreadyCheckedIn === true,
    attendanceDays: num(raw?.attendanceDays),
    xpToday: num(raw?.xpToday ?? raw?.xp_today),
    xpWeek: num(raw?.xpWeek ?? raw?.xp_week),
  };
}

export interface QuizCompleteResult {
  /** 29/10: luôn false — server không còn trao XP từng bài quiz. */
  awarded: boolean;
  /** 29/10: luôn 0 — XP chỉ cộng ở quỹ chủ đề. Giữ field cho ổn định shape. */
  awardedXp: number;
  /** Tổng XP mới của học sinh. */
  totalXp: number;
  /** XP hôm nay / XP tuần server trả (để client đồng bộ, không tự tính). */
  xpToday?: number;
  xpWeek?: number;
}

export async function completeQuizOnServer(quizId: string, earned: number): Promise<QuizCompleteResult> {
  const raw = unwrap(
    await apiFetch('/api/quiz-completions', {
      method: 'POST',
      body: JSON.stringify({ quizId, earned }),
    })
  );
  const totalXp = num(raw?.totalXp ?? raw?.total_xp);
  if (totalXp === undefined) {
    throw new Error('Máy chủ hoàn thành quiz không trả về tổng XP mới.');
  }
  return {
    awarded: raw?.awarded === true,
    awardedXp: num(raw?.awardedXp) ?? 0,
    totalXp,
    xpToday: num(raw?.xpToday ?? raw?.xp_today),
    xpWeek: num(raw?.xpWeek ?? raw?.xp_week),
  };
}

export async function completeTopicOnServer(topicId: string): Promise<TopicCompleteResult> {
  const raw = unwrap(
    await apiFetch(`/api/topics/${encodeURIComponent(topicId)}/complete`, { method: 'POST' })
  );
  const totalXp = num(raw?.totalXp ?? raw?.total_xp);
  if (totalXp === undefined) {
    throw new Error('Máy chủ hoàn thành chủ đề không trả về tổng XP mới.');
  }
  return {
    awarded: raw?.awarded === true,
    complete: raw?.complete === true,
    totalXp,
    xpToday: num(raw?.xpToday ?? raw?.xp_today),
    xpWeek: num(raw?.xpWeek ?? raw?.xp_week),
  };
}
