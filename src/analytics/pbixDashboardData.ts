/**
 * Nạp hàng dữ liệu thô cho dashboard Tổng quan (pbix) từ API VPS (GĐ3).
 *
 * Thay toàn bộ truy vấn Supabase cũ bằng GET /api/dashboard/*:
 * - /api/dashboard/sessions → phiên đăng nhập
 * - /api/dashboard/assignments-progress → lượt giao + bài được giao
 * - /api/dashboard/attempts → lượt làm bài (+ đáp án nếu server nhúng kèm)
 * Endpoint /api/dashboard/overview là KPI tổng hợp của server — màn
 * PbixOverviewSection tự tính lại KPI từ hàng thô bằng đúng công thức DAX
 * (pbixDashboard.ts) nên file này không cần gọi overview.
 *
 * Học sinh/lớp lấy từ props cổng GV (đã lọc theo giáo viên); không còn
 * bước resolve id Supabase qua username nữa — id app chính là id server.
 * Lỗi API → trả {...EMPTY, loaded: false} để banner lỗi thật hiện (như
 * hành vi cũ khi Supabase chưa sẵn sàng); KHÔNG fallback lặng sang mock
 * hay số liệu bịa — mọi mảng đều rỗng và loaded=false báo rõ chưa có dữ
 * liệu. Chưa có học sinh trong phạm vi → dashboard trống đã tải xong
 * (loaded: true), như cũ.
 *
 * Giới hạn ghi nhận (cần server bổ sung nếu muốn đủ như cũ):
 * - answers/questionLevels: chỉ có khi /api/dashboard/attempts nhúng kèm
 *   đáp án + mức tư duy câu hỏi; nếu không, 2 trường này rỗng và biểu đồ
 *   mức tư duy + tỉ lệ điểm đạt theo câu sẽ trống (không bịa).
 * - activities: không có endpoint dashboard nào trả learning_activities
 *   nên luôn [] (bảng tiến độ theo luồng cũ không còn nguồn).
 * - progress: luôn [] / progressAvailable: false như cũ (chưa có writer
 *   trực tiếp cho student_activity_progress).
 */
import { apiFetch } from '../services/api/http.ts';
import type { ClassItem, StudentAccount } from '../services/types.ts';
import type {
  PbixActivity,
  PbixAnswer,
  PbixAssignment,
  PbixAttempt,
  PbixProgress,
  PbixSession,
  PbixStudent,
  PbixTarget,
} from './pbixDashboard.ts';

export interface PbixRawData {
  students: PbixStudent[];
  sessions: PbixSession[];
  targets: PbixTarget[];
  assignments: PbixAssignment[];
  attempts: PbixAttempt[];
  answers: PbixAnswer[];
  questionLevels: Record<string, string>;
  activities: PbixActivity[];
  /** Luôn [] cho tới khi app có bảng student_activity_progress thật. */
  progress: PbixProgress[];
  progressAvailable: false;
  /** app class id → server class id (GĐ3: id app chính là id server). */
  classMap: Record<string, string>;
  /** true khi API đã nạp xong (false = lỗi, UI hiện banner lỗi thật). */
  loaded: boolean;
}

const EMPTY: PbixRawData = {
  students: [],
  sessions: [],
  targets: [],
  assignments: [],
  attempts: [],
  answers: [],
  questionLevels: {},
  activities: [],
  progress: [],
  progressAvailable: false,
  classMap: {},
  loaded: false,
};

function unwrapList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray((data as any).data)) return (data as any).data;
    if (Array.isArray((data as any).rows)) return (data as any).rows;
    if (Array.isArray((data as any).items)) return (data as any).items;
    if (Array.isArray((data as any).sessions)) return (data as any).sessions;
    if (Array.isArray((data as any).attempts)) return (data as any).attempts;
    if (Array.isArray((data as any).assignments)) return (data as any).assignments;
  }
  return [];
}

/** Ép điểm về number: MySQL DECIMAL trả về dạng chuỗi ("10.00") nên cộng
    trực tiếp sẽ nối chuỗi ("010.00" + "10.00" = "010.0010.00" → NaN khi so
    sánh) làm KPI Tỷ lệ điểm đạt và biểu đồ mức tư duy trống rỗng dù đã có
    câu chấm xong. null/NaN giữ nguyên null để compute coi là 0/mất điểm
    theo đúng nghĩa của nó. */
export function toPbixNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchPbixDashboardRows(opts: {
  teacherId?: string;
  appStudents: StudentAccount[];
  appClasses: ClassItem[];
}): Promise<PbixRawData> {
  // Chưa có học sinh trong phạm vi KHÔNG phải lỗi kết nối: vẫn là
  // dashboard trống đã tải xong (26/10: tài khoản mới từng bị banner
  // "Chưa kết nối được" dọa nhầm).
  if (opts.appStudents.length === 0) return { ...EMPTY, loaded: true };
  try {
    const students: PbixStudent[] = opts.appStudents.map((app) => ({
      supaId: app.id,
      appId: app.id,
      name: app.name,
      supaClassId: app.class_id ?? '',
      appClassId: app.class_id ?? '',
    }));
    const classMap: Record<string, string> = {};
    for (const c of opts.appClasses) classMap[c.id] = c.id;
    const studentIds = new Set(students.map((s) => s.supaId));

    const [sessionsRaw, progressRaw, attemptsRaw] = await Promise.all([
      apiFetch('/api/dashboard/sessions'),
      apiFetch('/api/dashboard/assignments-progress'),
      apiFetch('/api/dashboard/attempts'),
    ]);

    const sessions: PbixSession[] = unwrapList(sessionsRaw)
      .map((r: any) => ({
        studentId: r.studentId ?? r.student_id ?? '',
        loginAt: r.loginAt ?? r.login_at ?? '',
        loginDate: r.loginDate ?? r.login_date ?? '',
      }))
      .filter((s) => studentIds.has(s.studentId));

    // assignments-progress: hoặc mảng bài kèm targets[], hoặc shape gom
    // { assignments, targets }.
    let assignments: PbixAssignment[] = [];
    let targets: PbixTarget[] = [];
    const progressData: any =
      progressRaw && typeof progressRaw === 'object' && !Array.isArray(progressRaw)
        ? progressRaw
        : null;
    if (progressData && Array.isArray(progressData.assignments)) {
      assignments = progressData.assignments.map((a: any) => ({
        id: a.id ?? a.assignment_id ?? '',
        title: a.title ?? '',
      }));
      const rawTargets = Array.isArray(progressData.targets)
        ? progressData.targets
        : progressData.assignments.flatMap((a: any) => (a.targets || []).map((t: any) => ({ ...t, assignmentId: t.assignmentId ?? t.assignment_id ?? a.id })));
      targets = rawTargets
        .map((t: any) => ({
          assignmentId: t.assignmentId ?? t.assignment_id ?? '',
          studentId: t.studentId ?? t.student_id ?? '',
          submissionStatus: t.submissionStatus ?? t.submission_status ?? t.status ?? '',
        }))
        .filter((t: PbixTarget) => studentIds.has(t.studentId));
    } else {
      const rows = unwrapList(progressRaw);
      for (const a of rows) {
        assignments.push({ id: a.id ?? a.assignment_id ?? '', title: a.title ?? '' });
        for (const t of a.targets || []) {
          const target: PbixTarget = {
            assignmentId: t.assignmentId ?? t.assignment_id ?? a.id ?? '',
            studentId: t.studentId ?? t.student_id ?? '',
            submissionStatus: t.submissionStatus ?? t.submission_status ?? t.status ?? '',
          };
          if (studentIds.has(target.studentId)) targets.push(target);
        }
      }
      // Hàng targets phẳng (không kèm bài): suy assignments từ target.
      if (assignments.length === 0 && targets.length === 0) {
        for (const t of rows) {
          if (t.assignmentId || t.assignment_id) {
            targets.push({
              assignmentId: t.assignmentId ?? t.assignment_id ?? '',
              studentId: t.studentId ?? t.student_id ?? '',
              submissionStatus: t.submissionStatus ?? t.submission_status ?? t.status ?? '',
            });
          }
        }
      }
    }

    const attempts: PbixAttempt[] = [];
    const answers: PbixAnswer[] = [];
    const questionLevels: Record<string, string> = {};
    for (const r of unwrapList(attemptsRaw)) {
      const attempt: PbixAttempt = {
        attemptId: r.attemptId ?? r.attempt_id ?? r.id ?? '',
        studentId: r.studentId ?? r.student_id ?? '',
        submittedAt: r.submittedAt ?? r.submitted_at ?? null,
      };
      if (!studentIds.has(attempt.studentId)) continue;
      attempts.push(attempt);
      for (const a of r.answers || []) {
        answers.push({
          answerId: a.answerId ?? a.answer_id ?? a.id ?? '',
          attemptId: a.attemptId ?? a.attempt_id ?? attempt.attemptId,
          questionId: a.questionId ?? a.question_id ?? '',
          score: toPbixNumber(a.score ?? a.score_awarded),
          maxScore: toPbixNumber(a.maxScore ?? a.max_score),
          gradingStatus: a.gradingStatus ?? a.grading_status ?? '',
        });
        const level = a.level ?? a.questionLevel;
        if (a.questionId && level) questionLevels[a.questionId] = level;
      }
      // Server có thể trả riêng map mức tư duy kèm trong hàng attempt.
      if (r.questionLevels && typeof r.questionLevels === 'object') {
        Object.assign(questionLevels, r.questionLevels);
      }
    }

    return {
      students,
      sessions,
      targets,
      assignments,
      attempts,
      answers,
      questionLevels,
      activities: [],
      progress: [],
      progressAvailable: false,
      classMap,
      loaded: true,
    };
  } catch (err) {
    console.warn('[PbixDashboard] Không nạp được dữ liệu BI từ API:', err);
    return EMPTY;
  }
}
