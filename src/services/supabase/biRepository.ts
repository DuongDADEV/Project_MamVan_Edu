import { supabase, isSupabaseReady } from './client.ts';

/**
 * Kho dữ liệu PHÂN TÍCH & TIẾN ĐỘ (các bảng bổ sung ở migration_008):
 * learning_activities, assignments, assignment_targets, attempts,
 * attempt_answers, answer_reviews, student_sessions, dim_date.
 * Mọi hàm đọc đều bị chặn theo phạm vi học sinh/lớp của giáo viên
 * (tách dữ liệu riêng theo giáo viên — migration_007).
 */

export interface BiSession {
  id: string;
  studentId: string;
  studentName: string;
  loginAt: string | null;
  logoutAt: string | null;
  loginDate: string | null;
  durationMinutes: number | null;
  deviceType: string | null;
  status: string | null;
}

export interface BiSessionSummary {
  sessions: BiSession[];
  activeLast7: number;
  activePrev7: number;
  anchorDate: string | null;
  perDay: { date: string; count: number }[];
}

export interface BiTarget {
  id: string;
  studentId: string;
  studentName: string;
  status: string | null;
  assignedAt: string | null;
  dueAt: string | null;
  firstSubmittedAt: string | null;
  attemptsCount: number;
  bestScore: number | null;
  maxScore: number | null;
}

export interface BiAssignment {
  id: string;
  title: string;
  activityType: string | null;
  displayLocation: string | null;
  publishedAt: string | null;
  dueAt: string | null;
  isTimed: boolean;
  timeLimitMinutes: number | null;
  questionCount: number;
  targets: BiTarget[];
  submittedCount: number;
}

export interface BiAnswer {
  id: string;
  questionId: string;
  prompt: string;
  questionType: string;
  responseText: string;
  isCorrect: boolean | null;
  score: number | null;
  maxScore: number | null;
  gradingStatus: string | null;
  gradingMethod: string | null;
  responseTimeSeconds: number | null;
}

export interface BiAttempt {
  id: string;
  studentId: string;
  studentName: string;
  sourceType: 'assignment' | 'activity';
  sourceTitle: string;
  attemptNo: number | null;
  status: string | null;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  gradingStatus: string | null;
  gradingMode: string | null;
  answers: BiAnswer[];
}

export interface BiPendingReview {
  reviewId: string;
  answerId: string;
  attemptId: string;
  studentName: string;
  sourceTitle: string;
  questionPrompt: string;
  questionType: string;
  responseText: string;
  maxScore: number | null;
  rubricText: string | null;
  createdAt: string | null;
}

export interface BiFlowStep {
  id: string;
  title: string;
  activityType: string;
  sequenceNo: number | null;
  required: boolean;
}

export interface BiTopicFlow {
  topicId: string;
  topicTitle: string;
  flows: { flowType: string; steps: BiFlowStep[] }[];
}

async function studentNameMap(studentIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!studentIds.length) return map;
  const { data } = await supabase.from('students').select('id, name').in('id', studentIds);
  for (const s of data || []) map.set(s.id, s.name);
  return map;
}

export function renderResponse(responseJson: any): string {
  if (responseJson == null) return '—';
  let r = responseJson;
  if (typeof r === 'string') {
    try {
      r = JSON.parse(r);
    } catch {
      return r;
    }
  }
  if (r && typeof r === 'object') {
    if (Array.isArray(r.selected)) return 'Chọn: ' + r.selected.join(', ');
    if (typeof r.selected === 'string') return 'Chọn: ' + r.selected;
    if (typeof r.text === 'string') return r.text;
  }
  return String(r);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Phiên đăng nhập của học sinh thuộc giáo viên + KPI 7 ngày (neo theo ngày dữ liệu mới nhất). */
export async function getSessionsSummary(studentIds: string[]): Promise<BiSessionSummary> {
  const empty: BiSessionSummary = { sessions: [], activeLast7: 0, activePrev7: 0, anchorDate: null, perDay: [] };
  if (!isSupabaseReady() || !studentIds.length) return empty;
  const names = await studentNameMap(studentIds);
  const { data, error } = await supabase
    .from('student_sessions')
    .select('*')
    .in('student_id', studentIds)
    .order('login_at', { ascending: false });
  if (error || !data) return empty;
  const sessions: BiSession[] = data.map((s: any) => ({
    id: s.session_id,
    studentId: s.student_id,
    studentName: names.get(s.student_id) || 'Học sinh',
    loginAt: s.login_at,
    logoutAt: s.logout_at,
    loginDate: s.login_date,
    durationMinutes: s.session_duration_minutes,
    deviceType: s.device_type,
    status: s.session_status,
  }));
  const dates = sessions.map((s) => s.loginDate).filter(Boolean) as string[];
  if (!dates.length) return { ...empty, sessions };
  const anchor = dates.slice().sort().slice(-1)[0];
  const inWin = (d: string, from: string, to: string) => d >= from && d <= to;
  const last7 = new Set(
    sessions.filter((s) => s.loginDate && inWin(s.loginDate, shiftDate(anchor, -6), anchor)).map((s) => s.studentId)
  );
  const prev7 = new Set(
    sessions
      .filter((s) => s.loginDate && inWin(s.loginDate!, shiftDate(anchor, -13), shiftDate(anchor, -7)))
      .map((s) => s.studentId)
  );
  const perDay: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = shiftDate(anchor, -i);
    perDay.push({ date: d, count: sessions.filter((s) => s.loginDate === d).length });
  }
  return { sessions, activeLast7: last7.size, activePrev7: prev7.size, anchorDate: anchor, perDay };
}

/** Bài độc lập của giáo viên + tiến độ nộp theo từng học sinh. */
export async function getAssignmentsProgress(
  teacherId: string,
  studentIds: string[]
): Promise<BiAssignment[]> {
  if (!isSupabaseReady()) return [];
  const names = await studentNameMap(studentIds);
  const { data: asgs } = await supabase
    .from('assignments')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('published_at', { ascending: true });
  if (!asgs?.length) return [];
  const asgIds = asgs.map((a: any) => a.id);
  const [{ data: targets }, { data: aqs }, { data: atts }] = await Promise.all([
    supabase.from('assignment_targets').select('*').in('assignment_id', asgIds),
    supabase.from('assignment_questions').select('assignment_id').in('assignment_id', asgIds),
    supabase
      .from('attempts')
      .select('assignment_id, student_id, score_awarded, max_score')
      .in('assignment_id', asgIds),
  ]);
  const qCount = new Map<string, number>();
  for (const r of aqs || []) qCount.set(r.assignment_id, (qCount.get(r.assignment_id) || 0) + 1);
  const attByKey = new Map<string, { count: number; best: number | null; max: number | null }>();
  for (const a of atts || []) {
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
    const tlist: BiTarget[] = (targets || [])
      .filter((t: any) => t.assignment_id === a.id && studentIds.includes(t.student_id))
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
      .sort((x: BiTarget, y: BiTarget) => x.studentName.localeCompare(y.studentName, 'vi'));
    return {
      id: a.id,
      title: a.title,
      activityType: a.activity_type,
      displayLocation: a.display_location,
      publishedAt: a.published_at,
      dueAt: a.due_at,
      isTimed: !!a.is_timed,
      timeLimitMinutes: a.time_limit_minutes,
      questionCount: qCount.get(a.id) || 0,
      targets: tlist,
      submittedCount: tlist.filter((t) => t.status === 'SUBMITTED').length,
    };
  });
}

/** Các lượt làm bài (luồng học + bài độc lập) kèm chi tiết từng câu. */
export async function getAttemptsWithAnswers(studentIds: string[]): Promise<BiAttempt[]> {
  if (!isSupabaseReady() || !studentIds.length) return [];
  const names = await studentNameMap(studentIds);
  const { data: atts } = await supabase
    .from('attempts')
    .select('*')
    .in('student_id', studentIds)
    .order('submitted_at', { ascending: false })
    .limit(200);
  if (!atts?.length) return [];
  const attIds = atts.map((a: any) => a.attempt_id);
  const asgIds = [...new Set(atts.map((a: any) => a.assignment_id).filter(Boolean))];
  const actIds = [...new Set(atts.map((a: any) => a.learning_activity_id).filter(Boolean))];
  const [{ data: answers }, { data: asgs }, { data: acts }] = await Promise.all([
    supabase.from('attempt_answers').select('*').in('attempt_id', attIds),
    asgIds.length
      ? supabase.from('assignments').select('id, title').in('id', asgIds)
      : Promise.resolve({ data: [] as any[] }),
    actIds.length
      ? supabase.from('learning_activities').select('id, title').in('id', actIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const qIds = [...new Set((answers || []).map((a: any) => a.question_id))];
  const { data: qs } = qIds.length
    ? await supabase.from('questions').select('id, prompt, type').in('id', qIds)
    : { data: [] as any[] };
  const qMap = new Map((qs || []).map((q: any) => [q.id, q]));
  const asgMap = new Map((asgs || []).map((a: any) => [a.id, a.title]));
  const actMap = new Map((acts || []).map((a: any) => [a.id, a.title]));
  const ansByAtt = new Map<string, BiAnswer[]>();
  for (const a of answers || []) {
    const q = qMap.get(a.question_id);
    const item: BiAnswer = {
      id: a.answer_id,
      questionId: a.question_id,
      prompt: q?.prompt || a.question_id,
      questionType: q?.type || '',
      responseText: renderResponse(a.response_json),
      isCorrect: a.is_correct,
      score: a.score_awarded,
      maxScore: a.max_score,
      gradingStatus: a.grading_status,
      gradingMethod: a.grading_method,
      responseTimeSeconds: a.response_time_seconds,
    };
    const list = ansByAtt.get(a.attempt_id) || [];
    list.push(item);
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

/** Hàng chờ chấm: các phiếu review PENDING của học sinh thuộc giáo viên. */
export async function getPendingReviews(studentIds: string[]): Promise<BiPendingReview[]> {
  if (!isSupabaseReady() || !studentIds.length) return [];
  const names = await studentNameMap(studentIds);
  const { data: atts } = await supabase
    .from('attempts')
    .select('attempt_id, student_id, assignment_id, learning_activity_id')
    .in('student_id', studentIds);
  if (!atts?.length) return [];
  const attMap = new Map((atts || []).map((a: any) => [a.attempt_id, a]));
  const { data: reviews } = await supabase
    .from('answer_reviews')
    .select('*')
    .eq('review_status', 'PENDING')
    .order('created_at', { ascending: true });
  const myReviews = (reviews || []).filter((r: any) => r.answer_id);
  if (!myReviews.length) return [];
  const ansIds = myReviews.map((r: any) => r.answer_id);
  const { data: answers } = await supabase
    .from('attempt_answers')
    .select('*')
    .in('answer_id', ansIds);
  const ansMap = new Map((answers || []).map((a: any) => [a.answer_id, a]));
  const qIds = [...new Set((answers || []).map((a: any) => a.question_id))];
  const { data: qs } = qIds.length
    ? await supabase.from('questions').select('id, prompt, type').in('id', qIds)
    : { data: [] as any[] };
  const qMap = new Map((qs || []).map((q: any) => [q.id, q]));
  const asgIds = [...new Set(atts.map((a: any) => a.assignment_id).filter(Boolean))];
  const actIds = [...new Set(atts.map((a: any) => a.learning_activity_id).filter(Boolean))];
  const [{ data: asgs }, { data: acts }] = await Promise.all([
    asgIds.length
      ? supabase.from('assignments').select('id, title').in('id', asgIds)
      : Promise.resolve({ data: [] as any[] }),
    actIds.length
      ? supabase.from('learning_activities').select('id, title').in('id', actIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const asgMap = new Map((asgs || []).map((a: any) => [a.id, a.title]));
  const actMap = new Map((acts || []).map((a: any) => [a.id, a.title]));

  const out: BiPendingReview[] = [];
  for (const r of myReviews) {
    const ans = ansMap.get(r.answer_id);
    if (!ans) continue;
    const att = attMap.get(ans.attempt_id);
    if (!att) continue; // không thuộc học sinh của giáo viên này
    const q = qMap.get(ans.question_id);
    const rubric =
      r.rubric_scores && typeof r.rubric_scores === 'object'
        ? typeof r.rubric_scores.text === 'string'
          ? r.rubric_scores.text
          : JSON.stringify(r.rubric_scores)
        : null;
    out.push({
      reviewId: r.review_id,
      answerId: r.answer_id,
      attemptId: ans.attempt_id,
      studentName: names.get(att.student_id) || 'Học sinh',
      sourceTitle: att.assignment_id
        ? asgMap.get(att.assignment_id) || att.assignment_id
        : actMap.get(att.learning_activity_id) || att.learning_activity_id,
      questionPrompt: q?.prompt || ans.question_id,
      questionType: q?.type || '',
      responseText: renderResponse(ans.response_json),
      maxScore: ans.max_score,
      rubricText: rubric,
      createdAt: r.created_at,
    });
  }
  return out;
}

/** Chấm 1 câu chờ: ghi review + điểm câu + tính lại tổng của lượt làm. */
export async function gradePendingAnswer(
  review: BiPendingReview,
  score: number,
  feedback: string,
  teacherId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error: e1 } = await supabase
    .from('answer_reviews')
    .update({
      score_awarded: score,
      feedback: feedback || null,
      review_status: 'GRADED',
      reviewed_at: now,
      reviewer_id: teacherId,
    })
    .eq('review_id', review.reviewId);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase
    .from('attempt_answers')
    .update({ score_awarded: score, grading_status: 'GRADED' })
    .eq('answer_id', review.answerId);
  if (e2) throw new Error(e2.message);
  const { data: answers } = await supabase
    .from('attempt_answers')
    .select('score_awarded, grading_status')
    .eq('attempt_id', review.attemptId);
  const list = answers || [];
  const total = list.reduce((s: number, a: any) => s + (a.score_awarded ?? 0), 0);
  const allGraded = list.every((a: any) => a.grading_status === 'GRADED');
  await supabase
    .from('attempts')
    .update({
      score_awarded: total,
      grading_status: allGraded ? 'GRADED' : 'PARTIALLY_GRADED',
    })
    .eq('attempt_id', review.attemptId);
}

/** Cây luồng học (VIDEO_FLOW / THEORY_FLOW) theo từng chủ đề của giáo viên. */
export async function getTopicFlows(teacherId: string): Promise<BiTopicFlow[]> {
  if (!isSupabaseReady()) return [];
  const [{ data: topics }, { data: acts }] = await Promise.all([
    supabase.from('topics').select('id, title').eq('teacher_id', teacherId).order('order_index'),
    supabase
      .from('learning_activities')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('sequence_no', { ascending: true }),
  ]);
  if (!topics?.length) return [];
  return topics.map((t: any) => {
    const mine = (acts || []).filter((a: any) => a.topic_id === t.id);
    const flowTypes = [...new Set(mine.map((a: any) => a.flow_type || 'KHAC'))];
    return {
      topicId: t.id,
      topicTitle: t.title,
      flows: flowTypes.map((ft) => ({
        flowType: ft as string,
        steps: mine
          .filter((a: any) => (a.flow_type || 'KHAC') === ft)
          .map((a: any) => ({
            id: a.id,
            title: a.title,
            activityType: a.activity_type,
            sequenceNo: a.sequence_no,
            required: !!a.required_for_flow,
          })),
      })),
    };
  });
}

/** Phía học sinh: bài độc lập được giao cho em + trạng thái + các lượt đã làm. */
export async function getStudentAssignments(studentId: string) {
  if (!isSupabaseReady()) return [];
  const { data: targets } = await supabase
    .from('assignment_targets')
    .select('*')
    .eq('student_id', studentId);
  if (!targets?.length) return [];
  const asgIds = targets.map((t: any) => t.assignment_id);
  const [{ data: asgs }, { data: atts }, { data: aqs }] = await Promise.all([
    supabase.from('assignments').select('*').in('id', asgIds),
    supabase
      .from('attempts')
      .select('assignment_id, attempt_no, score_awarded, max_score, grading_status, submitted_at')
      .eq('student_id', studentId)
      .in('assignment_id', asgIds)
      .order('submitted_at', { ascending: false }),
    supabase.from('assignment_questions').select('assignment_id').in('assignment_id', asgIds),
  ]);
  const qCount = new Map<string, number>();
  for (const r of aqs || []) qCount.set(r.assignment_id, (qCount.get(r.assignment_id) || 0) + 1);
  const asgMap = new Map((asgs || []).map((a: any) => [a.id, a]));
  return targets.map((t: any) => {
    const a = asgMap.get(t.assignment_id) || {};
    return {
      targetId: t.target_id,
      assignmentId: t.assignment_id,
      title: a.title || t.assignment_id,
      dueAt: t.due_at || a.due_at,
      isTimed: !!a.is_timed,
      timeLimitMinutes: a.time_limit_minutes,
      questionCount: qCount.get(t.assignment_id) || 0,
      status: t.submission_status,
      firstSubmittedAt: t.first_submitted_at,
      attempts: (atts || []).filter((x: any) => x.assignment_id === t.assignment_id),
    };
  });
}
