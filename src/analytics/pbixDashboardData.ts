/**
 * Nạp hàng dữ liệu thô cho dashboard Tổng quan (pbix) từ Supabase.
 *
 * Phạm vi: CHỈ học sinh thuộc các lớp của giáo viên đang đăng nhập (lấy từ
 * props students/classes của cổng GV — cổng đã lọc theo giáo viên). Học sinh
 * trong props có thể mang id UUID Supabase hoặc username dạng hs001: module
 * resolve sang id Supabase bằng id trực tiếp, rồi fallback theo username.
 *
 * LƯU Ý: bảng student_activity_progress KHÔNG tồn tại trong Supabase nên
 * progress luôn trả về [] (xem ghi chú ĐIỂM HỞ trong pbixDashboard.ts).
 * Module không truy vấn bảng không tồn tại để tránh lỗi.
 */
import { supabase, isSupabaseReady } from '../services/supabase/client.ts';
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
  /** app class id → Supabase class id (để áp bộ lọc lớp lên học sinh). */
  classMap: Record<string, string>;
  /** true khi Supabase sẵn sàng và đã nạp xong (false = degraded, UI hiện trống). */
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchPbixDashboardRows(opts: {
  teacherId?: string;
  appStudents: StudentAccount[];
  appClasses: ClassItem[];
}): Promise<PbixRawData> {
  if (!isSupabaseReady() || opts.appStudents.length === 0) return EMPTY;
  try {
    const appStudents = opts.appStudents;
    const usernames = appStudents.map((s) => s.username).filter(Boolean);
    const uuidIds = appStudents.map((s) => s.id).filter((id) => UUID_RE.test(id));

    // Học sinh Supabase tương ứng (nối bằng id, fallback bằng username).
    const [byUsername, byId, supaClasses] = await Promise.all([
      usernames.length
        ? supabase.from('students').select('id, username, name, class_id').in('username', usernames)
        : Promise.resolve({ data: [] as any[] }),
      uuidIds.length
        ? supabase.from('students').select('id, username, name, class_id').in('id', uuidIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('classes').select('id, name'),
    ]);
    const supaById = new Map<string, any>();
    const supaByUsername = new Map<string, any>();
    for (const row of [...(byId.data ?? []), ...(byUsername.data ?? [])]) {
      supaById.set(row.id, row);
      if (row.username) supaByUsername.set(row.username, row);
    }
    const students: PbixStudent[] = [];
    for (const app of appStudents) {
      const row = supaById.get(app.id) ?? (app.username ? supaByUsername.get(app.username) : undefined);
      if (!row) continue; // Học sinh chưa có dòng Supabase → không có dữ liệu BI nào.
      students.push({
        supaId: row.id,
        appId: app.id,
        name: row.name ?? app.name,
        supaClassId: row.class_id ?? '',
        appClassId: app.class_id ?? '',
      });
    }
    if (students.length === 0) return { ...EMPTY, loaded: true };

    // app class id → Supabase class id: ưu tiên lớp thật của học sinh đã
    // resolve, fallback khớp tên với bảng classes, cuối cùng giữ nguyên id.
    const classMap: Record<string, string> = {};
    const supaClassIds = new Set((supaClasses.data ?? []).map((c: any) => c.id));
    const supaClassByName = new Map((supaClasses.data ?? []).map((c: any) => [c.name, c.id]));
    for (const app of opts.appClasses) {
      const fromStudents = students.find((s) => s.appClassId === app.id)?.supaClassId;
      if (fromStudents) {
        classMap[app.id] = fromStudents;
      } else if (supaClassIds.has(app.id)) {
        classMap[app.id] = app.id;
      } else if (supaClassByName.has(app.name)) {
        classMap[app.id] = supaClassByName.get(app.name)!;
      } else {
        classMap[app.id] = app.id;
      }
    }

    const supaIds = students.map((s) => s.supaId);
    const [sessionsRes, targetsRes, attemptsRes, assignmentsRes, activitiesRes] =
      await Promise.all([
        supabase
          .from('student_sessions')
          .select('student_id, login_at, login_date')
          .in('student_id', supaIds),
        supabase
          .from('assignment_targets')
          .select('assignment_id, student_id, submission_status')
          .in('student_id', supaIds),
        supabase
          .from('attempts')
          .select('attempt_id, student_id, submitted_at')
          .in('student_id', supaIds),
        // Bài được giao: bài đã xuất bản của giáo viên (cùng phạm vi với
        // getAssignmentsProgress của biRepository). Không có teacherId thì
        // lấy theo id bài đã có lượt giao (giữ đúng bảng, mất lọc GV).
        opts.teacherId
          ? supabase
              .from('assignments')
              .select('id, title')
              .eq('teacher_id', opts.teacherId)
              .not('published_at', 'is', null)
          : Promise.resolve({ data: [] as any[] }),
        opts.teacherId
          ? supabase
              .from('learning_activities')
              .select('id, flow_type, sequence_no')
              .eq('teacher_id', opts.teacherId)
          : Promise.resolve({ data: [] as any[] }),
      ]);

    const sessions: PbixSession[] = (sessionsRes.data ?? []).map((r: any) => ({
      studentId: r.student_id,
      loginAt: r.login_at,
      loginDate: r.login_date,
    }));
    const targets: PbixTarget[] = (targetsRes.data ?? []).map((r: any) => ({
      assignmentId: r.assignment_id,
      studentId: r.student_id,
      submissionStatus: r.submission_status,
    }));
    const attempts: PbixAttempt[] = (attemptsRes.data ?? []).map((r: any) => ({
      attemptId: r.attempt_id,
      studentId: r.student_id,
      submittedAt: r.submitted_at ?? null,
    }));

    let assignments: PbixAssignment[] = (assignmentsRes.data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
    }));
    if (!opts.teacherId) {
      // Fallback: tiêu đề bài từ các lượt giao (không lọc GV, vẫn đúng lớp).
      const ids = [...new Set(targets.map((t) => t.assignmentId))];
      if (ids.length > 0) {
        const { data } = await supabase.from('assignments').select('id, title').in('id', ids);
        assignments = (data ?? []).map((r: any) => ({ id: r.id, title: r.title }));
      }
    }

    const attemptIds = attempts.map((a) => a.attemptId);
    const answersRes = attemptIds.length
      ? await supabase
          .from('attempt_answers')
          .select('answer_id, attempt_id, question_id, score_awarded, max_score, grading_status')
          .in('attempt_id', attemptIds)
      : { data: [] as any[] };
    const answers: PbixAnswer[] = (answersRes.data ?? []).map((r: any) => ({
      answerId: r.answer_id,
      attemptId: r.attempt_id,
      questionId: r.question_id,
      score: r.score_awarded ?? null,
      maxScore: r.max_score ?? null,
      gradingStatus: r.grading_status,
    }));

    const questionIds = [...new Set(answers.map((a) => a.questionId))];
    const questionsRes = questionIds.length
      ? await supabase.from('questions').select('id, level').in('id', questionIds)
      : { data: [] as any[] };
    const questionLevels: Record<string, string> = {};
    for (const q of questionsRes.data ?? []) questionLevels[q.id] = q.level ?? '';

    const activities: PbixActivity[] = (activitiesRes.data ?? []).map((r: any) => ({
      id: r.id,
      flowType: r.flow_type,
      sequenceNo: r.sequence_no ?? 0,
    }));

    return {
      students,
      sessions,
      targets,
      assignments,
      attempts,
      answers,
      questionLevels,
      activities,
      progress: [],
      progressAvailable: false,
      classMap,
      loaded: true,
    };
  } catch (err) {
    console.warn('[PbixDashboard] Không nạp được dữ liệu BI:', err);
    return EMPTY;
  }
}
