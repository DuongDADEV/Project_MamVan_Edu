import type { Db } from './mysql.ts';

/**
 * GĐ3 — tra cứu phạm vi sở hữu phía server.
 *
 * NGUYÊN TẮC (khác client teacherScope.ts): server KHÔNG bắt chước
 * hành vi legacy của client — client giữ "gv001 thấy tất" cho chế độ
 * mock, còn server thì KHÔNG BAO GIỜ ghi id sentinel vào MySQL và
 * KHÔNG coi sentinel là giáo viên thật. Mọi helper dưới đây throw
 * Error('SENTINEL_ID') khi đầu vào là id sentinel; route bắt lỗi này
 * và trả 400 (không phải 403/404 — id này không hợp lệ ngay từ đầu).
 */

export const SENTINEL_IDS: ReadonlySet<string> = new Set([
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'gv001',
]);

export function isSentinelId(id: string | null | undefined): boolean {
  return !!id && SENTINEL_IDS.has(id);
}

function assertNotSentinel(id: string | null | undefined): void {
  if (isSentinelId(id)) throw new Error('SENTINEL_ID');
}

/** Các lớp của 1 giáo viên (neo phạm vi: học sinh/bài nộp suy từ đây). */
export async function teacherClassIds(db: Db, teacherId: string): Promise<string[]> {
  assertNotSentinel(teacherId);
  const rows = await db.query<any[]>(
    'SELECT id FROM classes WHERE teacher_id = ?',
    [teacherId]
  );
  return rows.map((r) => r.id);
}

/** Giáo viên sở hữu 1 lớp, hoặc null khi lớp không tồn tại. */
export async function classTeacherId(db: Db, classId: string): Promise<string | null> {
  assertNotSentinel(classId);
  const rows = await db.query<any[]>(
    'SELECT teacher_id FROM classes WHERE id = ? LIMIT 1',
    [classId]
  );
  return rows[0]?.teacher_id ?? null;
}

/** Giáo viên sở hữu 1 chủ đề, hoặc null khi chủ đề không tồn tại. */
export async function topicTeacherId(db: Db, topicId: string): Promise<string | null> {
  assertNotSentinel(topicId);
  const rows = await db.query<any[]>(
    'SELECT teacher_id FROM topics WHERE id = ? LIMIT 1',
    [topicId]
  );
  return rows[0]?.teacher_id ?? null;
}

/** Lớp của 1 học sinh, hoặc null khi học sinh không tồn tại. */
export async function studentClassId(db: Db, studentId: string): Promise<string | null> {
  assertNotSentinel(studentId);
  const rows = await db.query<any[]>(
    'SELECT class_id FROM students WHERE id = ? LIMIT 1',
    [studentId]
  );
  return rows[0]?.class_id ?? null;
}

/** Giáo viên của 1 học sinh (qua students.class_id → classes.teacher_id). */
export async function studentTeacherId(db: Db, studentId: string): Promise<string | null> {
  assertNotSentinel(studentId);
  const rows = await db.query<any[]>(
    `SELECT c.teacher_id AS teacher_id FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
      WHERE s.id = ? LIMIT 1`,
    [studentId]
  );
  return rows[0]?.teacher_id ?? null;
}
