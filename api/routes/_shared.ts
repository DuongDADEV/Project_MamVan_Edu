/**
 * Helper dùng chung cho các router nhóm B (GĐ3, VPS-only, MySQL).
 *
 * QUY ƯỚC LIB (xem báo cáo bàn giao — các lib này do worker khác tạo,
 * chưa tồn tại lúc viết file này nên tsc sẽ báo CHỜ TÍCH HỢP):
 * - mysql: query<T>(sql, params?) -> T[]; execute(sql, params?) ->
 *   { affectedRows, insertId }; withTransaction<T>(fn) với fn(db: Db);
 *   Db = { query, execute } (cùng chữ ký, chạy trên 1 connection);
 *   parseJson(v, fallback) — JSON MySQL có thể về dạng object hoặc string.
 * - auth: requireAuth (gắn req.caller), requireRole(...roles),
 *   httpErr(res, status, code) -> gửi { error: code };
 *   Caller = { userId, role: 'admin'|'teacher'|'student',
 *   teacherId?, profileId?, studentId?, classId?, classIds? }
 *   (userId = users.id; teacherId = teachers.id; studentId =
 *   students.id; AuthedRequest.caller là optional theo kiểu lib).
 * - scope (tham số đầu luôn là Db): isSentinelId(id),
 *   teacherClassIds(db, teacherId), classTeacherId(db, classId),
 *   topicTeacherId(db, topicId), studentClassId(db, studentId),
 *   studentTeacherId(db, studentId). Các hàm scope THROW
 *   Error('SENTINEL_ID') khi đầu vào là sentinel — route đã chặn
 *   sentinel trước bằng rejectSentinel().
 * - xp (tham số đầu luôn là Db): awardCheckIn(db, studentId, vnDate)
 *   -> AwardResult { awarded, totalXp, xpWeek, xpToday };
 *   awardSubmission(db, studentId, attemptId, amount);
 *   awardTopicCompletion(db, studentId, topicId, amount);
 *   deductForGift(db, studentId, amount, requestId);
 *   refundGift(db, studentId, amount, requestId);
 *   getTotals(db, studentId) -> { totalXp, xpWeek, xpToday }.
 *   (deduct/refund lấy requestId làm khóa idempotency, KHÔNG phải
 *   chuỗi mô tả — truyền sai sẽ làm lần trừ/hoàn thứ 2 thành no-op.)
 *
 * File này KHÔNG phải router — chỉ gom helper để 5 router khỏi lặp lại.
 * Mọi router đều tự kiểm tra phạm vi bằng SQL/scope-lib, không trông
 * chờ client lọc (luật 26/10: gv mới không được thấy dữ liệu gv cũ).
 */
import type { Response } from 'express';
import { query, execute } from '../_lib/mysql';
import type { Db } from '../_lib/mysql';
import { httpErr } from '../_lib/auth';
import type { Caller } from '../_lib/auth';
import {
  isSentinelId,
  teacherClassIds,
  studentClassId,
  studentTeacherId,
} from '../_lib/scope';

/** Db dùng cho các query ngoài transaction (query/execute module-level). */
export const db: Db = { query, execute };

/** Ngày Việt Nam (UTC+7) dạng YYYY-MM-DD, tính bằng JS (không CONVERT_TZ). */
export function vnToday(): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Chuẩn hóa giá trị ngày từ mysql2 về khóa 'YYYY-MM-DD'.
 *  mysql2 trả cột DATE/TIMESTAMP dạng Date object (pool timezone
 *  '+00:00' nên DATE nửa đêm UTC = đúng ngày đã lưu); chuỗi thì
 *  cắt 10 ký tự đầu. Dùng ở mọi chỗ so sánh/ngày-tháng bằng chuỗi
 *  (bug GĐ4 2026-10-27: sessionsSummary nhận Date, shiftDate nối
 *  thêm 'T00:00:00Z' → Invalid Date → toISOString() throw →
 *  crash process, Caddy 502). */
export function toDateKey(v: unknown): string {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    return v.toISOString().slice(0, 10);
  }
  if (v == null) return '';
  return String(v).slice(0, 10);
}

/** Ngày thứ Hai (YYYY-MM-DD) của tuần chứa `dateStr` (tuần bắt đầu thứ 2). */
export function vnWeekMonday(dateStr: string | Date): string {
  const d = new Date(toDateKey(dateStr) + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // 0 = thứ Hai
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (hoặc Date từ mysql2). */
export function shiftDate(dateStr: string | Date, days: number): string {
  const d = new Date(toDateKey(dateStr) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Body đã parse (express.json() ở app level cho object; phòng khi là string). */
export function bodyOf(req: any): any {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

/** Id/khóa MySQL TEXT->VARCHAR(191): dài hơn 191 ký tự thì 400, không insert. */
export function checkKeyLen(res: Response, value: unknown, label = 'id'): boolean {
  if (typeof value === 'string' && value.length > 191) {
    httpErr(res, 400, 'BAD_INPUT');
    return false;
  }
  return true;
}

/** Sentinel legacy (gv001 / UUID 0...) không bao giờ được lọt vào MySQL. */
export function rejectSentinel(res: Response, value: unknown): boolean {
  if (typeof value === 'string' && isSentinelId(value)) {
    httpErr(res, 400, 'BAD_INPUT');
    return false;
  }
  return true;
}

export function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function genId(prefix: string): string {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

/** Bọc handler async: Express 4 không bắt rejection của handler async —
 *  không bọc thì lỗi DB làm crash cả process (Caddy 502 cho mọi người
 *  tới khi NSSM khởi động lại). Bọc rồi thì lỗi đi qua error handler
 *  cuối của createApp → 500 SERVER_ERROR sạch, process sống. */
export function ah(fn: (req: any, res: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

export function isAdmin(c: Caller): boolean {
  return c.role === 'admin';
}
export function isTeacher(c: Caller): boolean {
  return c.role === 'teacher';
}
export function isStudent(c: Caller): boolean {
  return c.role === 'student';
}

/** Lớp của giáo viên (admin -> null = tất cả). */
export async function ownClassIds(
  conn: Db,
  caller: Caller
): Promise<string[] | null> {
  if (isAdmin(caller)) return null;
  if (isTeacher(caller)) {
    if (!caller.teacherId) return [];
    return teacherClassIds(conn, caller.teacherId);
  }
  return caller.classId ? [caller.classId] : [];
}

/** Giáo viên/admin có quyền trên học sinh này không. */
export async function canAccessStudent(
  conn: Db,
  caller: Caller,
  studentId: string
): Promise<boolean> {
  if (isAdmin(caller)) return true;
  if (isStudent(caller)) return caller.studentId === studentId;
  if (!isTeacher(caller) || !caller.teacherId) return false;
  const classId = await studentClassId(conn, studentId);
  if (!classId) return false;
  const classIds = await teacherClassIds(conn, caller.teacherId);
  return classIds.includes(classId);
}

/** Học sinh có thuộc lớp này không (dùng cho student-assignments...). */
export async function studentClassOf(
  conn: Db,
  studentId: string
): Promise<string | null> {
  return studentClassId(conn, studentId);
}

export async function studentTeacherOf(
  conn: Db,
  studentId: string
): Promise<string | null> {
  return studentTeacherId(conn, studentId);
}

/** Đọc 1 học sinh (id, class_id, name) hoặc null. */
export async function findStudent(
  conn: Db,
  studentId: string
): Promise<{ id: string; class_id: string; name: string } | null> {
  const rows = await conn.query<any>(
    'SELECT `id`, `class_id`, `name` FROM `students` WHERE `id` = ? LIMIT 1',
    [studentId]
  );
  return rows[0] || null;
}

/**
 * Map hàng student_states sang object trả về (JSON đã parse).
 * XP trong object này LUÔN bị ghi đè bằng getTotals() ở nơi gọi —
 * client không bao giờ được ghi trực tiếp total_xp/xp_week/xp_today/xp_logs.
 */
export function mapStateRow(row: any, parseJson: (v: any, fb: any) => any): any {
  if (!row) return null;
  return {
    student_id: row.student_id,
    xp_today: row.xp_today ?? 0,
    xp_week: row.xp_week ?? 0,
    total_xp: row.total_xp ?? 0,
    active_seconds_today: row.active_seconds_today ?? 0,
    consecutive_days: row.consecutive_days ?? 0,
    last_attendance_date: row.last_attendance_date || null,
    completed_steps: parseJson(row.completed_steps, []),
    topic_mastery: parseJson(row.topic_mastery, {}),
    unlocked_badge_ids: parseJson(row.unlocked_badge_ids, []),
    xp_logs: parseJson(row.xp_logs, []),
    preferences: parseJson(row.preferences, {}),
    attendance_days_this_week: row.attendance_days_this_week ?? 0,
    attendance_history: parseJson(row.attendance_history, []),
    question_results: parseJson(row.question_results, []),
    flagged_topic_ids: parseJson(row.flagged_topic_ids, []),
    current_progress: parseJson(row.current_progress, {}),
    updated_at: row.updated_at || null,
  };
}

/**
 * Các cột student_states mà PUT được phép ghi — WHITELIST, không có
 * total_xp/xp_week/xp_today/xp_logs (XP chỉ server tính qua xp.ts).
 * Chấp nhận cả key camelCase (client StudentState) lẫn snake_case.
 */
const STATE_FIELD_MAP: Record<string, string> = {
  activeSecondsToday: 'active_seconds_today',
  active_seconds_today: 'active_seconds_today',
  consecutiveWeeks: 'consecutive_days',
  consecutive_days: 'consecutive_days',
  lastAttendanceDate: 'last_attendance_date',
  last_attendance_date: 'last_attendance_date',
  attendanceDaysThisWeek: 'attendance_days_this_week',
  attendance_days_this_week: 'attendance_days_this_week',
  attendanceHistory: 'attendance_history',
  attendance_history: 'attendance_history',
  completedSteps: 'completed_steps',
  completed_steps: 'completed_steps',
  questionResults: 'question_results',
  question_results: 'question_results',
  flaggedNeedReviewTopicIds: 'flagged_topic_ids',
  flagged_topic_ids: 'flagged_topic_ids',
  unlockedBadgeIds: 'unlocked_badge_ids',
  unlocked_badge_ids: 'unlocked_badge_ids',
  currentProgress: 'current_progress',
  current_progress: 'current_progress',
  topicMastery: 'topic_mastery',
  topic_mastery: 'topic_mastery',
  preferences: 'preferences',
};
const STATE_JSON_COLS = new Set([
  'completed_steps',
  'question_results',
  'flagged_topic_ids',
  'unlocked_badge_ids',
  'current_progress',
  'topic_mastery',
  'preferences',
  'attendance_history',
]);

/** Lọc body PUT student-states về {col: value} — XP fields bị loại bỏ. */
export function filterStateInput(body: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!body || typeof body !== 'object') return out;
  for (const [key, col] of Object.entries(STATE_FIELD_MAP)) {
    if (body[key] === undefined) continue;
    const v = body[key];
    // 2026-10-28: client học sinh mới gửi last_attendance_date = '' khi
    // chưa điểm danh lần nào — MySQL STRICT mode từ chối '' cho cột DATE
    // (Error 1292) và vì handler PUT không có try/catch nên cả process
    // node crash, kéo sập toàn bộ trang học sinh. Coerce '' về NULL.
    if (col === 'last_attendance_date' && v === '') {
      out[col] = null;
      continue;
    }
    out[col] = STATE_JSON_COLS.has(col)
      ? JSON.stringify(v ?? (col === 'current_progress' || col === 'topic_mastery' || col === 'preferences' ? {} : []))
      : v;
  }
  return out;
}

/** Chuẩn hóa loại câu hỏi về hệ tên DB (biRepository.normalizeQType). */
export function normalizeQType(t: string | null | undefined): string {
  switch ((t || '').toString()) {
    case 'single':
    case 'single_choice':
      return 'single_choice';
    case 'multi':
    case 'multiple_choice':
      return 'multiple_choice';
    case 'fill':
    case 'fill_in_blank':
      return 'fill_in_blank';
    default:
      return 'essay';
  }
}

export function normText(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Render response_json thành text hiển thị (biRepository.renderResponse). */
export function renderResponse(responseJson: any, parseJson: (v: any, fb: any) => any): string {
  if (responseJson == null) return '—';
  let r = parseJson(responseJson, responseJson);
  if (r && typeof r === 'object') {
    if (Array.isArray(r.selected)) return 'Chọn: ' + r.selected.join(', ');
    if (typeof r.selected === 'string') return 'Chọn: ' + r.selected;
    if (typeof r.text === 'string') return r.text;
  }
  return String(r);
}

/** Các loại câu chấm tự động (topicCompletion.AUTO_TYPES). */
export const AUTO_Q_TYPES = new Set([
  'single',
  'multiple',
  'multi',
  'fill',
  'fill_in',
  'fill_in_blank',
  'single_choice',
  'multiple_choice',
]);
