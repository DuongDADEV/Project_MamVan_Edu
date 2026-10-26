// Phạm vi dữ liệu của MỘT giáo viên (26/10: tài khoản mới toangv thấy
// dữ liệu của gv001 ở tab Phân tích + đoạn chat, vì cổng giáo viên nạp
// students/essays/topics/quizzes KHÔNG lọc theo giáo viên, còn cache chat
// local thì không gắn giáo viên nên gộp nhầm sang người mới).
//
// Nguyên tắc: lớp là neo — cổng đã lọc classes theo giáo viên, nên học
// sinh/bài nộp/trạng thái suy ra từ lớp; chủ đề/bài tập/câu hỏi lọc trực
// tiếp theo teacher_id. teacherId rỗng/không phải UUID (chế độ mock,
// id legacy) thì giữ nguyên danh sách để không làm hỏng luồng cũ.

export interface HasId {
  id: string;
}
export interface HasClass {
  class_id?: string;
}
export interface HasStudent {
  studentId?: string;
}
export interface HasTeacher {
  teacher_id?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isServerTeacherId(teacherId?: string): boolean {
  return !!teacherId && UUID_RE.test(teacherId);
}

/** Lớp thuộc giáo viên này. Chế độ mock/legacy (teacherId không phải UUID)
 *  giữ nguyên danh sách để không làm hỏng luồng cũ. */
export function ownedClasses<T extends HasId>(
  classes: T[],
  teacherId?: string
): T[] {
  if (!isServerTeacherId(teacherId)) return classes;
  return classes.filter((c) => (c as any).teacherId === teacherId);
}

/** Học sinh thuộc các lớp của giáo viên. */
export function scopeStudentsToClasses<T>(
  students: T[],
  classIds: ReadonlySet<string>
): T[] {
  return students.filter((s) => (s as any).class_id && classIds.has((s as any).class_id));
}

/** Trạng thái học tập chỉ của các học sinh trong phạm vi. */
export function scopeStatesToStudents<T>(
  states: Record<string, T>,
  studentIds: ReadonlySet<string>
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, st] of Object.entries(states)) {
    if (studentIds.has(id)) out[id] = st;
  }
  return out;
}

/** Bài nộp chỉ của các học sinh trong phạm vi. */
export function scopeEssaysToStudents<T>(
  essays: T[],
  studentIds: ReadonlySet<string>
): T[] {
  return essays.filter((e) => (e as any).studentId && studentIds.has((e as any).studentId));
}

/** Chủ đề/bài tập chỉ của giáo viên này (teacher_id trùng khớp). */
export function scopeItemsToTeacher<T>(
  items: T[],
  teacherId?: string
): T[] {
  if (!isServerTeacherId(teacherId)) return items;
  return items.filter((it) => (it as any).teacher_id === teacherId);
}

/** Câu hỏi chỉ của giáo viên này. Mọi câu hỏi trong DB đều đã có
 *  teacher_id (kiểm chứng 26/10: 33/33) nên lọc chặt không mất dữ liệu. */
export function scopeQuestionsToTeacher<T>(
  questions: Record<string, T>,
  teacherId?: string
): Record<string, T> {
  if (!isServerTeacherId(teacherId)) return questions;
  const out: Record<string, T> = {};
  for (const [id, q] of Object.entries(questions)) {
    if ((q as any).teacher_id === teacherId) out[id] = q;
  }
  return out;
}

/**
 * Cache chat local có được gộp sang giáo viên này không — CHỈ khi
 * localStorage đã ghi nhận đúng giáo viên đó. Khác giáo viên HOẶC
 * chưa từng ghi nhận (null — cache từ bản cũ, không gắn giáo viên)
 * thì KHÔNG gộp, không upload: cache không rõ chủ là dữ liệu lạ.
 * Đây chính là lỗ hổng 26/10: null được coi như "của mình" nên
 * 80 tin của gv001 bị đẩy lên server dưới id toangv.
 */
export function isOwnChatCache(
  recordedTeacher: string | null | undefined,
  teacherId: string
): boolean {
  return !!recordedTeacher && recordedTeacher === teacherId;
}
