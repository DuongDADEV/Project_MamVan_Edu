/**
 * Router nhóm B — dashboard & BI, CHỈ ĐỌC. Mount tại /api.
 * - GET /dashboard/overview?from=&to=
 * - GET /dashboard/sessions
 * - GET /dashboard/assignments-progress
 * - GET /dashboard/attempts
 * Teacher lọc theo classIds mình, admin tất cả, student KHÔNG gọi (403).
 *
 * Công thức port đúng từ pbixDashboard.computePbixDashboard +
 * biRepository (không tự nghĩ công thức mới), trừ 1 điểm lệch đã ghi
 * rõ dưới đây:
 * - KPI 1 Hoạt động 7 ngày: neo = MAX login_date, đếm học sinh distinct
 *   có login_date trong [neo-6, neo] (REMOVEFILTERS ngày — không chịu
 *   lọc from/to).
 * - KPI 2 Tỷ lệ nộp bài: targets SUBMITTED / tổng targets (không lọc ngày).
 * - KPI 4 Tỷ lệ điểm đạt: tổng điểm / tổng điểm tối đa của câu GRADED,
 *   CÓ lọc ngày qua submitted_at quy về ngày VN (submitted_date).
 * - KPI 3 Chờ chấm — LỆCH CÓ LÝ DO: công thức pbix gốc đếm
 *   attempt_answers.grading_status = 'PENDING', nhưng submit gốc ghi
 *   'PENDING_TEACHER_REVIEW' nên đếm literal luôn ≈ 0. Server này đếm
 *   phiếu answer_reviews PENDING của học sinh trong phạm vi — đúng
 *   hàng đợi chấm thật mà giáo viên nhìn thấy (cùng nguồn với
 *   /reviews/pending). Xem báo cáo.
 * - getSessionsSummary: activePrev7 = distinct trong [neo-13, neo-7],
 *   perDay = số phiên 14 ngày gần nhất tính từ neo.
 * - getAssignmentsProgress: chỉ bài ĐÃ xuất bản của giáo viên, targets
 *   lọc theo học sinh trong phạm vi, bestScore = điểm cao nhất.
 * - getAttemptsWithAnswers: tối đa 200 lượt, submitted_at giảm dần.
 */
import { Router } from 'express';
import { query, parseJson } from '../_lib/mysql';
import { requireAuth, requireRole } from '../_lib/auth';
import type { AuthedRequest } from '../_lib/auth';
import { teacherClassIds } from '../_lib/scope';
import { db, shiftDate, renderResponse, isTeacher, ah, toDateKey } from './_shared';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireRole('teacher', 'admin'));

async function scopedStudents(caller: any, classFilter?: string): Promise<string[] | null> {
  if (!isTeacher(caller)) {
    // Admin: tất cả, hoặc lọc theo ?class_id= nếu gửi.
    if (classFilter) {
      const rows = await query<any>('SELECT `id` FROM `students` WHERE `class_id` = ?', [classFilter]);
      return rows.map((r: any) => r.id);
    }
    return null;
  }
  const classIds = await teacherClassIds(db, caller.teacherId!);
  if (classFilter && !classIds.includes(classFilter)) return [];
  const wanted = classFilter ? [classFilter] : classIds;
  if (!wanted.length) return [];
  const rows = await query<any>(
    `SELECT \`id\` FROM \`students\` WHERE \`class_id\` IN (${wanted.map(() => '?').join(',')})`,
    wanted
  );
  return rows.map((r: any) => r.id);
}

function inList(ids: string[]): string {
  return ids.map(() => '?').join(',');
}

async function sessionsSummary(studentIds: string[] | null): Promise<any> {
  const empty = { sessions: [], activeLast7: 0, activePrev7: 0, anchorDate: null, perDay: [] };
  const where = studentIds ? `WHERE \`student_id\` IN (${inList(studentIds)})` : '';
  const params = studentIds || [];
  const rows = await query<any>(
    `SELECT ss.*, s.\`name\` AS student_name FROM \`student_sessions\` ss LEFT JOIN \`students\` s ON s.\`id\` = ss.\`student_id\` ${where} ORDER BY ss.\`login_at\` DESC`,
    params
  );
  const sessions = rows.map((s: any) => ({
    id: s.session_id,
    studentId: s.student_id,
    studentName: s.student_name || 'Học sinh',
    loginAt: s.login_at,
    logoutAt: s.logout_at,
    // login_date là DATE → mysql2 trả Date object: chuẩn hóa về
    // 'YYYY-MM-DD' ngay đây, không để Date lọt xuống shiftDate/so
    // sánh chuỗi (đã crash process ở GĐ4).
    loginDate: toDateKey(s.login_date) || null,
    durationMinutes: s.session_duration_minutes,
    deviceType: s.device_type,
    status: s.session_status,
  }));
  const dates = sessions.map((s: any) => s.loginDate).filter(Boolean) as string[];
  if (!dates.length) return { ...empty, sessions };
  const anchor = dates.slice().sort().slice(-1)[0];
  const inWin = (d: string, from: string, to: string) => d >= from && d <= to;
  const last7 = new Set(
    sessions.filter((s: any) => s.loginDate && inWin(s.loginDate, shiftDate(anchor, -6), anchor)).map((s: any) => s.studentId)
  );
  const prev7 = new Set(
    sessions
      .filter((s: any) => s.loginDate && inWin(s.loginDate, shiftDate(anchor, -13), shiftDate(anchor, -7)))
      .map((s: any) => s.studentId)
  );
  const perDay: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = shiftDate(anchor, -i);
    perDay.push({ date: d, count: sessions.filter((s: any) => s.loginDate === d).length });
  }
  return { sessions, activeLast7: last7.size, activePrev7: prev7.size, anchorDate: anchor, perDay };
}

async function assignmentsProgress(caller: any, studentIds: string[] | null): Promise<any[]> {
  const teacherId = isTeacher(caller) ? caller.teacherId : null;
  const asgs = teacherId
    ? await query<any>(
        'SELECT * FROM `assignments` WHERE `teacher_id` = ? AND `published_at` IS NOT NULL ORDER BY `published_at` ASC',
        [teacherId]
      )
    : await query<any>(
        'SELECT * FROM `assignments` WHERE `published_at` IS NOT NULL ORDER BY `published_at` ASC'
      );
  if (!asgs.length) return [];
  const asgIds = asgs.map((a: any) => a.id);
  const targets = await query<any>(
    `SELECT * FROM \`assignment_targets\` WHERE \`assignment_id\` IN (${inList(asgIds)})`,
    asgIds
  );
  const aqs = await query<any>(
    `SELECT \`assignment_id\` FROM \`assignment_questions\` WHERE \`assignment_id\` IN (${inList(asgIds)})`,
    asgIds
  );
  const atts = await query<any>(
    `SELECT \`assignment_id\`, \`student_id\`, \`score_awarded\`, \`max_score\` FROM \`attempts\` WHERE \`assignment_id\` IN (${inList(asgIds)})`,
    asgIds
  );
  const names = new Map<string, string>();
  const stRows = await query<any>('SELECT `id`, `name` FROM `students`');
  for (const s of stRows) names.set(s.id, s.name);
  const qCount = new Map<string, number>();
  for (const r of aqs) qCount.set(r.assignment_id, (qCount.get(r.assignment_id) || 0) + 1);
  const attByKey = new Map<string, { count: number; best: number | null; max: number | null }>();
  for (const a of atts) {
    const k = a.assignment_id + '|' + a.student_id;
    const cur = attByKey.get(k) || { count: 0, best: null, max: null };
    cur.count += 1;
    if (a.score_awarded != null && (cur.best == null || a.score_awarded > cur.best)) {
      cur.best = a.score_awarded;
      cur.max = a.max_score;
    }
    attByKey.set(k, cur);
  }
  return asgs.map((a: any) => {
    const tlist = targets
      .filter((t: any) => t.assignment_id === a.id && (studentIds === null || studentIds.includes(t.student_id)))
      .map((t: any) => {
        const att = attByKey.get(a.id + '|' + t.student_id);
        return {
          id: t.target_id,
          studentId: t.student_id,
          studentName: names.get(t.student_id) || 'Học sinh',
          status: t.submission_status,
          assignedAt: t.assigned_at,
          dueAt: t.due_at,
          firstSubmittedAt: t.first_submitted_at,
          attemptsCount: att?.count || 0,
          bestScore: att?.best ?? null,
          maxScore: att?.max ?? null,
        };
      })
      .sort((x: any, y: any) => x.studentName.localeCompare(y.studentName, 'vi'));
    return {
      id: a.id,
      title: a.title,
      activityType: a.activity_type,
      displayLocation: a.display_location,
      publishedAt: a.published_at,
      dueAt: a.due_at,
      isTimed: !!a.is_timed,
      timeLimitMinutes: a.time_limit_minutes,
      xpReward: a.xp_reward ?? 0,
      questionCount: qCount.get(a.id) || 0,
      targets: tlist,
      submittedCount: tlist.filter((t: any) => t.status === 'SUBMITTED').length,
    };
  });
}

async function attemptsWithAnswers(studentIds: string[] | null): Promise<any[]> {
  const where = studentIds ? `WHERE \`student_id\` IN (${inList(studentIds)})` : '';
  const params = studentIds || [];
  const atts = await query<any>(
    `SELECT * FROM \`attempts\` ${where} ORDER BY \`submitted_at\` DESC LIMIT 200`,
    params
  );
  if (!atts.length) return [];
  const attIds = atts.map((a: any) => a.attempt_id);
  const asgIds = [...new Set(atts.map((a: any): string => a.assignment_id).filter(Boolean))] as string[];
  const actIds = [...new Set(atts.map((a: any): string => a.learning_activity_id).filter(Boolean))] as string[];
  const answers = await query<any>(
    `SELECT * FROM \`attempt_answers\` WHERE \`attempt_id\` IN (${inList(attIds)})`,
    attIds
  );
  const asgs = asgIds.length
    ? await query<any>(`SELECT \`id\`, \`title\` FROM \`assignments\` WHERE \`id\` IN (${inList(asgIds)})`, asgIds)
    : [];
  const acts = actIds.length
    ? await query<any>(`SELECT \`id\`, \`title\` FROM \`learning_activities\` WHERE \`id\` IN (${inList(actIds)})`, actIds)
    : [];
  const qIds = [...new Set(answers.map((a: any): string => a.question_id))] as string[];
  const qs = qIds.length
    ? await query<any>(`SELECT \`id\`, \`prompt\`, \`type\` FROM \`questions\` WHERE \`id\` IN (${inList(qIds)})`, qIds)
    : [];
  const stRows = await query<any>('SELECT `id`, `name` FROM `students`');
  const names = new Map(stRows.map((s: any) => [s.id, s.name]));
  const qMap = new Map(qs.map((q: any) => [q.id, q]));
  const asgMap = new Map(asgs.map((a: any) => [a.id, a.title]));
  const actMap = new Map(acts.map((a: any) => [a.id, a.title]));
  const ansByAtt = new Map<string, any[]>();
  for (const a of answers) {
    const q: any = qMap.get(a.question_id);
    const list = ansByAtt.get(a.attempt_id) || [];
    list.push({
      id: a.answer_id,
      questionId: a.question_id,
      prompt: q?.prompt || a.question_id,
      questionType: q?.type || '',
      responseText: renderResponse(a.response_json, parseJson),
      isCorrect: a.is_correct,
      score: a.score_awarded,
      maxScore: a.max_score,
      gradingStatus: a.grading_status,
      gradingMethod: a.grading_method,
      responseTimeSeconds: a.response_time_seconds,
    });
    ansByAtt.set(a.attempt_id, list);
  }
  return atts.map((a: any) => ({
    id: a.attempt_id,
    studentId: a.student_id,
    studentName: names.get(a.student_id) || 'Học sinh',
    sourceType: a.assignment_id ? 'assignment' : 'activity',
    sourceTitle: a.assignment_id
      ? asgMap.get(a.assignment_id) || a.assignment_id
      : actMap.get(a.learning_activity_id) || a.learning_activity_id,
    attemptNo: a.attempt_no,
    status: a.status,
    submittedAt: a.submitted_at,
    score: a.score_awarded,
    maxScore: a.max_score,
    gradingStatus: a.grading_status,
    gradingMode: a.grading_mode,
    answers: ansByAtt.get(a.attempt_id) || [],
  }));
}

dashboardRouter.get('/dashboard/overview', ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const classFilter = typeof req.query.class_id === 'string' ? req.query.class_id : undefined;
  const studentIds = await scopedStudents(caller, classFilter);
  if (studentIds && studentIds.length === 0) {
    res.json({
      totalStudents: 0,
      activeLast7: 0,
      activePrev7: 0,
      anchorDate: null,
      submissionRate: null,
      submittedTargets: 0,
      totalTargets: 0,
      pendingReviews: 0,
      passRate: null,
      perDay: [],
    });
    return;
  }
  const from = typeof req.query.from === 'string' ? req.query.from : null;
  const to = typeof req.query.to === 'string' ? req.query.to : null;
  const summary = await sessionsSummary(studentIds);
  // Targets trong phạm vi (không lọc ngày — KPI 2).
  const tgtWhere = studentIds ? `WHERE \`student_id\` IN (${inList(studentIds)})` : '';
  const tgtParams = studentIds || [];
  const targets = await query<any>(`SELECT \`submission_status\` FROM \`assignment_targets\` ${tgtWhere}`, tgtParams);
  const submittedTargets = targets.filter((t: any) => t.submission_status === 'SUBMITTED').length;
  const submissionRate = targets.length > 0 ? submittedTargets / targets.length : null;
  // Chờ chấm: phiếu answer_reviews PENDING (xem lệch công thức ở đầu file).
  const revWhere = studentIds
    ? `WHERE r.\`review_status\` = 'PENDING' AND a.\`student_id\` IN (${inList(studentIds)})`
    : `WHERE r.\`review_status\` = 'PENDING'`;
  const revRows = await query<any>(
    'SELECT COUNT(*) AS c FROM `answer_reviews` r JOIN `attempt_answers` aa ON aa.`answer_id` = r.`answer_id` ' +
      'JOIN `attempts` a ON a.`attempt_id` = aa.`attempt_id` ' +
      revWhere,
    tgtParams
  );
  // Tỷ lệ đạt: câu GRADED, lọc ngày qua submitted_date (ngày VN đã lưu).
  const attWhereParts: string[] = [];
  const attParams: any[] = [];
  if (studentIds) {
    attWhereParts.push(`a.\`student_id\` IN (${inList(studentIds)})`);
    attParams.push(...studentIds);
  }
  if (from) {
    attWhereParts.push('a.`submitted_date` >= ?');
    attParams.push(from);
  }
  if (to) {
    attWhereParts.push('a.`submitted_date` <= ?');
    attParams.push(to);
  }
  const attWhere = attWhereParts.length ? 'WHERE ' + attWhereParts.join(' AND ') : '';
  const graded = await query<any>(
    'SELECT aa.`score_awarded`, aa.`max_score` FROM `attempt_answers` aa JOIN `attempts` a ON a.`attempt_id` = aa.`attempt_id` ' +
      `${attWhere} AND aa.\`grading_status\` = 'GRADED'`,
    attParams
  );
  let scoreSum = 0;
  let maxSum = 0;
  for (const g of graded) {
    scoreSum += Number(g.score_awarded ?? 0);
    maxSum += Number(g.max_score ?? 0);
  }
  const passRate = maxSum > 0 ? scoreSum / maxSum : null;
  res.json({
    totalStudents: studentIds === null ? (await query<any>('SELECT COUNT(*) AS c FROM `students`'))[0]?.c ?? 0 : studentIds.length,
    activeLast7: summary.activeLast7,
    activePrev7: summary.activePrev7,
    anchorDate: summary.anchorDate,
    submissionRate,
    submittedTargets,
    totalTargets: targets.length,
    pendingReviews: Number(revRows[0]?.c ?? 0),
    passRate,
    perDay: summary.perDay,
  });
}));

dashboardRouter.get('/dashboard/sessions', ah(async (req: AuthedRequest, res) => {
  const classFilter = typeof req.query.class_id === 'string' ? req.query.class_id : undefined;
  const studentIds = await scopedStudents(req.caller!, classFilter);
  if (studentIds && studentIds.length === 0) {
    res.json({ sessions: [], activeLast7: 0, activePrev7: 0, anchorDate: null, perDay: [] });
    return;
  }
  res.json(await sessionsSummary(studentIds));
}));

dashboardRouter.get('/dashboard/assignments-progress', ah(async (req: AuthedRequest, res) => {
  const classFilter = typeof req.query.class_id === 'string' ? req.query.class_id : undefined;
  const studentIds = await scopedStudents(req.caller!, classFilter);
  if (studentIds && studentIds.length === 0) {
    res.json([]);
    return;
  }
  res.json(await assignmentsProgress(req.caller!, studentIds));
}));

dashboardRouter.get('/dashboard/attempts', ah(async (req: AuthedRequest, res) => {
  const classFilter = typeof req.query.class_id === 'string' ? req.query.class_id : undefined;
  const studentIds = await scopedStudents(req.caller!, classFilter);
  if (studentIds && studentIds.length === 0) {
    res.json([]);
    return;
  }
  res.json(await attemptsWithAnswers(studentIds));
}));
