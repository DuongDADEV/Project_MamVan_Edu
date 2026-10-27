/**
 * BI + bài tập độc lập qua API VPS (GĐ3) — thay biRepository.ts
 * (Supabase trực tiếp) cho các hàm màn hình đang dùng.
 *
 * - Đọc BI CHỈ qua GET /api/dashboard/* (sessions, assignments-progress,
 *   attempts). KHÔNG fallback lặng sang mock khi API lỗi: lỗi ném ApiError
 *   để caller hiện lỗi rõ (luật server-thật 26/10).
 * - Ghi BI qua endpoint tương ứng: POST/PATCH/DELETE /api/assignments,
 *   POST /api/attempts (nộp bài), POST /api/reviews/:answerId/grade (chấm).
 * - Tên hàm + chữ ký giữ nguyên như biRepository cũ để tích hợp vào
 *   services/index.ts không vỡ import màn hình.
 * - Server suy phạm vi giáo viên từ JWT; studentIds/teacherId trong chữ ký
 *   chỉ còn để lọc phía client cho đúng ngữ nghĩa cũ (server đã lọc rồi
 *   thì lọc thêm cũng không sai).
 * - getTopicFlows không có trong file này: không endpoint dashboard nào
 *   trả cây learning_activities, và không màn hình nào còn gọi nó (chỉ
 *   biRepository cũ định nghĩa).
 */
import { apiFetch } from './http.ts';

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
  xpReward: number;
  questionCount: number;
  targets: BiTarget[];
  submittedCount: number;
}

export interface BiAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  /** Đề câu hỏi — server /api/dashboard/attempts trả field `prompt` (giữ tên cũ để màn hình cũ không vỡ). */
  prompt: string;
  questionPrompt: string;
  questionType: string;
  responseText: string;
  isCorrect: boolean | null;
  score: number | null;
  maxScore: number | null;
  gradingStatus: string | null;
  gradingMethod: string | null;
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
  studentId: string;
  questionId: string;
  studentName: string;
  sourceTitle: string;
  questionPrompt: string;
  questionType: string;
  responseText: string;
  maxScore: number | null;
  rubricText: string | null;
  createdAt: string | null;
  scoreAwarded?: number | null;
  feedback?: string | null;
  reviewedAt?: string | null;
}

export interface CreateAssignmentInput {
  teacherId: string;
  classId: string | null;
  title: string;
  questionIds: string[];
  studentIds: string[];
  dueAt: string | null;
  isTimed: boolean;
  timeLimitMinutes: number | null;
}

export interface TeacherAssignmentSummary {
  id: string;
  title: string;
  published: boolean;
  dueAt: string | null;
  isTimed: boolean;
  timeLimitMinutes: number | null;
  xpReward: number;
  questionCount: number;
  targetCount: number;
  submittedCount: number;
  createdAt: string | null;
}

export interface AssignmentForEdit {
  id: string;
  title: string;
  classId: string | null;
  dueAt: string | null;
  isTimed: boolean;
  timeLimitMinutes: number | null;
  xpReward: number;
  published: boolean;
  questionIds: string[];
  studentIds: string[];
}

export interface UpdateAssignmentInput {
  title: string;
  classId: string | null;
  dueAt: string | null;
  isTimed: boolean;
  timeLimitMinutes: number | null;
  xpReward: number;
  questionIds: string[];
  studentIds: string[];
  publish: boolean;
}

export interface AssignmentDetailQuestion {
  id: string;
  prompt: string;
  passage: string | null;
  type: string;
  options: string[];
  points: number;
}

export interface AssignmentDetail {
  id: string;
  title: string;
  isTimed: boolean;
  timeLimitMinutes: number | null;
  xpReward: number;
  dueAt: string | null;
  questions: AssignmentDetailQuestion[];
}

export interface SubmitResult {
  attemptId: string;
  autoScore: number;
  maxScore: number;
  pendingCount: number;
  gradedCount: number;
  /** Tổng XP mới của học sinh sau nộp bài (server tính, nếu server trả). */
  totalXp?: number;
}

/** Bóc envelope { data | rows | items } hoặc giữ nguyên. */
function unwrap(data: any): any {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray((data as any).data)) return (data as any).data;
    if (Array.isArray((data as any).rows)) return (data as any).rows;
    if (Array.isArray((data as any).items)) return (data as any).items;
    if ((data as any).data && typeof (data as any).data === 'object') return (data as any).data;
  }
  return data;
}

function unwrapList(data: any): any[] {
  const v = unwrap(data);
  if (Array.isArray(v)) return v;
  return [];
}

function pick(row: any, ...keys: string[]): any {
  for (const k of keys) {
    if (row && row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
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

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mapSession(r: any): BiSession {
  return {
    id: str(pick(r, 'id', 'session_id', 'sessionId')),
    studentId: str(pick(r, 'studentId', 'student_id')),
    studentName: str(pick(r, 'studentName', 'student_name'), 'Học sinh'),
    loginAt: pick(r, 'loginAt', 'login_at') ?? null,
    logoutAt: pick(r, 'logoutAt', 'logout_at') ?? null,
    loginDate: pick(r, 'loginDate', 'login_date') ?? null,
    durationMinutes: numOrNull(pick(r, 'durationMinutes', 'session_duration_minutes')),
    deviceType: pick(r, 'deviceType', 'device_type') ?? null,
    status: pick(r, 'status', 'session_status') ?? null,
  };
}

/** Phiên đăng nhập + KPI 7 ngày (tính từ rows server, đúng công thức cũ). */
export async function getSessionsSummary(studentIds: string[]): Promise<BiSessionSummary> {
  const empty: BiSessionSummary = { sessions: [], activeLast7: 0, activePrev7: 0, anchorDate: null, perDay: [] };
  if (!studentIds.length) return empty;
  const raw = await apiFetch('/api/dashboard/sessions');
  const data = unwrap(raw);
  // Server đã trả sẵn summary shape → dùng luôn (lọc sessions theo studentIds).
  if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray((data as any).sessions)) {
    const sessions = (data as any).sessions.map(mapSession).filter((s: BiSession) => studentIds.includes(s.studentId));
    return {
      sessions,
      activeLast7: typeof (data as any).activeLast7 === 'number' ? (data as any).activeLast7 : 0,
      activePrev7: typeof (data as any).activePrev7 === 'number' ? (data as any).activePrev7 : 0,
      anchorDate: (data as any).anchorDate ?? null,
      perDay: Array.isArray((data as any).perDay) ? (data as any).perDay : [],
    };
  }
  const sessions = unwrapList(raw).map(mapSession).filter((s) => studentIds.includes(s.studentId));
  const dates = sessions.map((s) => s.loginDate).filter(Boolean) as string[];
  if (!dates.length) return { ...empty, sessions };
  const anchor = dates.slice().sort().slice(-1)[0];
  const inWin = (d: string, from: string, to: string) => d >= from && d <= to;
  const last7 = new Set(
    sessions.filter((s) => s.loginDate && inWin(s.loginDate, shiftDate(anchor, -6), anchor)).map((s) => s.studentId)
  );
  const prev7 = new Set(
    sessions.filter((s) => s.loginDate && inWin(s.loginDate!, shiftDate(anchor, -13), shiftDate(anchor, -7))).map((s) => s.studentId)
  );
  const perDay: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = shiftDate(anchor, -i);
    perDay.push({ date: d, count: sessions.filter((s) => s.loginDate === d).length });
  }
  return { sessions, activeLast7: last7.size, activePrev7: prev7.size, anchorDate: anchor, perDay };
}

function mapTarget(r: any): BiTarget {
  return {
    id: str(pick(r, 'id', 'target_id', 'targetId')),
    studentId: str(pick(r, 'studentId', 'student_id')),
    studentName: str(pick(r, 'studentName', 'student_name'), 'Học sinh'),
    status: pick(r, 'status', 'submission_status') ?? null,
    assignedAt: pick(r, 'assignedAt', 'assigned_at') ?? null,
    dueAt: pick(r, 'dueAt', 'due_at') ?? null,
    firstSubmittedAt: pick(r, 'firstSubmittedAt', 'first_submitted_at') ?? null,
    attemptsCount: typeof pick(r, 'attemptsCount', 'attempts_count') === 'number' ? pick(r, 'attemptsCount', 'attempts_count') : 0,
    bestScore: numOrNull(pick(r, 'bestScore', 'best_score')),
    maxScore: numOrNull(pick(r, 'maxScore', 'max_score')),
  };
}

function mapBiAssignment(r: any): BiAssignment {
  const targets = Array.isArray(r.targets) ? r.targets.map(mapTarget) : [];
  return {
    id: str(pick(r, 'id', 'assignment_id')),
    title: str(pick(r, 'title')),
    activityType: pick(r, 'activityType', 'activity_type') ?? null,
    displayLocation: pick(r, 'displayLocation', 'display_location') ?? null,
    publishedAt: pick(r, 'publishedAt', 'published_at') ?? null,
    dueAt: pick(r, 'dueAt', 'due_at') ?? null,
    isTimed: !!pick(r, 'isTimed', 'is_timed'),
    timeLimitMinutes: numOrNull(pick(r, 'timeLimitMinutes', 'time_limit_minutes')),
    xpReward: typeof pick(r, 'xpReward', 'xp_reward') === 'number' ? pick(r, 'xpReward', 'xp_reward') : 0,
    questionCount: typeof pick(r, 'questionCount', 'question_count') === 'number' ? pick(r, 'questionCount', 'question_count') : 0,
    targets,
    submittedCount:
      typeof pick(r, 'submittedCount', 'submitted_count') === 'number'
        ? pick(r, 'submittedCount', 'submitted_count')
        : targets.filter((t: BiTarget) => t.status === 'SUBMITTED').length,
  };
}

/** Bài độc lập của giáo viên + tiến độ nộp theo từng học sinh. */
export async function getAssignmentsProgress(
  _teacherId: string,
  studentIds: string[]
): Promise<BiAssignment[]> {
  const raw = await apiFetch('/api/dashboard/assignments-progress');
  const data = unwrap(raw);
  let list: BiAssignment[];
  if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray((data as any).assignments)) {
    // Shape gom: { assignments: [...], targets: [...] } → ghép targets theo assignment.
    const byAsg = new Map<string, any[]>();
    for (const t of (data as any).targets || []) {
      const aid = t.assignment_id ?? t.assignmentId;
      if (!byAsg.has(aid)) byAsg.set(aid, []);
      byAsg.get(aid)!.push(t);
    }
    list = (data as any).assignments.map((a: any) => {
      const withTargets = { ...a, targets: byAsg.get(a.id) || [] };
      return mapBiAssignment(withTargets);
    });
  } else {
    list = unwrapList(raw).map(mapBiAssignment);
  }
  return list.map((a) => ({
    ...a,
    targets: a.targets
      .filter((t) => studentIds.includes(t.studentId))
      .sort((x, y) => x.studentName.localeCompare(y.studentName, 'vi')),
  })).map((a) => ({ ...a, submittedCount: a.targets.filter((t) => t.status === 'SUBMITTED').length }));
}

function mapAnswer(r: any): BiAnswer {
  const resp = pick(r, 'responseJson', 'response_json');
  return {
    id: str(pick(r, 'id', 'answer_id', 'answerId')),
    attemptId: str(pick(r, 'attemptId', 'attempt_id')),
    questionId: str(pick(r, 'questionId', 'question_id')),
    prompt: str(pick(r, 'prompt', 'questionPrompt', 'question_prompt')),
    questionPrompt: str(pick(r, 'prompt', 'questionPrompt', 'question_prompt')),
    questionType: str(pick(r, 'questionType', 'question_type')),
    responseText: typeof pick(r, 'responseText', 'response_text') === 'string'
      ? pick(r, 'responseText', 'response_text')
      : renderResponse(resp),
    isCorrect: pick(r, 'isCorrect', 'is_correct') ?? null,
    score: numOrNull(pick(r, 'score', 'score_awarded')),
    maxScore: numOrNull(pick(r, 'maxScore', 'max_score')),
    gradingStatus: pick(r, 'gradingStatus', 'grading_status') ?? null,
    gradingMethod: pick(r, 'gradingMethod', 'grading_method') ?? null,
  };
}

function mapAttempt(r: any): BiAttempt {
  const answers = Array.isArray(r.answers) ? r.answers.map(mapAnswer) : [];
  return {
    id: str(pick(r, 'id', 'attempt_id', 'attemptId')),
    studentId: str(pick(r, 'studentId', 'student_id')),
    studentName: str(pick(r, 'studentName', 'student_name'), 'Học sinh'),
    sourceType: pick(r, 'sourceType', 'source_type') === 'activity' ? 'activity' : 'assignment',
    sourceTitle: str(pick(r, 'sourceTitle', 'source_title')),
    attemptNo: numOrNull(pick(r, 'attemptNo', 'attempt_no')),
    status: pick(r, 'status') ?? null,
    submittedAt: pick(r, 'submittedAt', 'submitted_at') ?? null,
    score: numOrNull(pick(r, 'score', 'score_awarded')),
    maxScore: numOrNull(pick(r, 'maxScore', 'max_score')),
    gradingStatus: pick(r, 'gradingStatus', 'grading_status') ?? null,
    gradingMode: pick(r, 'gradingMode', 'grading_mode') ?? null,
    answers,
  };
}

/** Các lượt làm bài kèm chi tiết từng câu. */
export async function getAttemptsWithAnswers(studentIds: string[]): Promise<BiAttempt[]> {
  if (!studentIds.length) return [];
  const rows = unwrapList(await apiFetch('/api/dashboard/attempts'));
  return rows.map(mapAttempt).filter((a) => studentIds.includes(a.studentId));
}

function mapReview(r: any): BiPendingReview {
  const resp = pick(r, 'responseJson', 'response_json');
  return {
    reviewId: str(pick(r, 'reviewId', 'review_id')),
    answerId: str(pick(r, 'answerId', 'answer_id')),
    attemptId: str(pick(r, 'attemptId', 'attempt_id')),
    studentId: str(pick(r, 'studentId', 'student_id')),
    questionId: str(pick(r, 'questionId', 'question_id')),
    studentName: str(pick(r, 'studentName', 'student_name'), 'Học sinh'),
    sourceTitle: str(pick(r, 'sourceTitle', 'source_title')),
    questionPrompt: str(pick(r, 'questionPrompt', 'question_prompt')),
    questionType: str(pick(r, 'questionType', 'question_type')),
    responseText: typeof pick(r, 'responseText', 'response_text') === 'string'
      ? pick(r, 'responseText', 'response_text')
      : renderResponse(resp),
    maxScore: numOrNull(pick(r, 'maxScore', 'max_score')),
    rubricText: pick(r, 'rubricText', 'rubric_text') ?? null,
    createdAt: pick(r, 'createdAt', 'created_at') ?? null,
    scoreAwarded: numOrNull(pick(r, 'scoreAwarded', 'score_awarded')),
    feedback: pick(r, 'feedback') ?? null,
    reviewedAt: pick(r, 'reviewedAt', 'reviewed_at') ?? null,
  };
}

async function getReviewsByStatus(
  studentIds: string[],
  status: 'pending' | 'graded',
  opts?: { includeResponseText?: boolean }
): Promise<BiPendingReview[]> {
  const rows = unwrapList(await apiFetch(`/api/reviews/${status}`));
  let list = rows.map(mapReview);
  if (studentIds.length) list = list.filter((r) => studentIds.includes(r.studentId));
  if (opts?.includeResponseText === false) list = list.map((r) => ({ ...r, responseText: '' }));
  return list;
}

export async function getPendingReviews(
  studentIds: string[],
  opts?: { includeResponseText?: boolean }
): Promise<BiPendingReview[]> {
  return getReviewsByStatus(studentIds, 'pending', opts);
}

export async function getGradedReviews(
  studentIds: string[],
  opts?: { includeResponseText?: boolean }
): Promise<BiPendingReview[]> {
  return getReviewsByStatus(studentIds, 'graded', opts);
}

/** Lấy full bài văn của 1 đáp án khi mở chi tiết chấm. */
export async function getReviewAnswerContent(answerId: string): Promise<string> {
  if (!answerId) return '';
  const data = unwrap(await apiFetch(`/api/reviews/${encodeURIComponent(answerId)}`));
  if (!data || typeof data !== 'object') return '';
  if (typeof (data as any).responseText === 'string') return (data as any).responseText;
  if (typeof (data as any).text === 'string') return (data as any).text;
  return renderResponse((data as any).responseJson ?? (data as any).response_json);
}

/** Chấm 1 câu chờ: server ghi review + điểm câu + tính lại tổng lượt làm. */
export async function gradePendingAnswer(
  review: Pick<BiPendingReview, 'reviewId' | 'answerId' | 'attemptId'>,
  score: number,
  feedback: string,
  _teacherId: string,
  rubricScores?: unknown
): Promise<void> {
  await apiFetch(`/api/reviews/${encodeURIComponent(review.answerId)}/grade`, {
    method: 'POST',
    body: JSON.stringify({
      reviewId: review.reviewId,
      attemptId: review.attemptId,
      score,
      feedback: feedback || null,
      ...(rubricScores !== undefined ? { rubricScores } : {}),
    }),
  });
}

/** Giáo viên tạo bài tập độc lập & giao cho từng học sinh. Trả về id bài. */
export async function createAssignment(input: CreateAssignmentInput): Promise<string> {
  const data = unwrap(
    await apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(input) })
  );
  const id = typeof data === 'string' ? data : (data?.id ?? data?.assignmentId);
  if (!id) throw new Error('Máy chủ tạo bài tập nhưng không trả về id.');
  return id;
}

/** Danh sách bài tập & đánh giá của giáo viên cho cây nội dung. */
export async function getTeacherAssignments(
  _teacherId: string
): Promise<TeacherAssignmentSummary[]> {
  const rows = unwrapList(await apiFetch('/api/assignments'));
  return rows.map((a: any) => ({
    id: str(pick(a, 'id')),
    title: str(pick(a, 'title')),
    published: !!pick(a, 'published', 'published_at'),
    dueAt: pick(a, 'dueAt', 'due_at') ?? null,
    isTimed: !!pick(a, 'isTimed', 'is_timed'),
    timeLimitMinutes: numOrNull(pick(a, 'timeLimitMinutes', 'time_limit_minutes')),
    xpReward: typeof pick(a, 'xpReward', 'xp_reward') === 'number' ? pick(a, 'xpReward', 'xp_reward') : 0,
    questionCount: typeof pick(a, 'questionCount', 'question_count') === 'number' ? pick(a, 'questionCount', 'question_count') : 0,
    targetCount: typeof pick(a, 'targetCount', 'target_count') === 'number' ? pick(a, 'targetCount', 'target_count') : 0,
    submittedCount: typeof pick(a, 'submittedCount', 'submitted_count') === 'number' ? pick(a, 'submittedCount', 'submitted_count') : 0,
    createdAt: pick(a, 'createdAt', 'created_at') ?? null,
  }));
}

/** Tạo ngay một bản nháp bài (chưa giao) rồi soạn trong màn riêng. */
export async function createEmptyAssignment(_teacherId: string): Promise<string> {
  const data = unwrap(
    await apiFetch('/api/assignments', {
      method: 'POST',
      body: JSON.stringify({ title: 'Bài kiểm tra mới', publish: false }),
    })
  );
  const id = typeof data === 'string' ? data : (data?.id ?? data?.assignmentId);
  if (!id) throw new Error('Máy chủ tạo bài tập nhưng không trả về id.');
  return id;
}

/** Đọc toàn bộ nội dung một bài để mở màn soạn. */
export async function getAssignmentForEdit(id: string): Promise<AssignmentForEdit | null> {
  const data = unwrap(await apiFetch(`/api/assignments/${encodeURIComponent(id)}`));
  if (!data || typeof data !== 'object') return null;
  const a: any = data;
  const qIds: string[] = Array.isArray(a.questionIds)
    ? a.questionIds
    : Array.isArray(a.questions)
      ? a.questions.map((q: any) => (typeof q === 'string' ? q : q.id))
      : [];
  const sIds: string[] = Array.isArray(a.studentIds)
    ? a.studentIds
    : Array.isArray(a.targets)
      ? a.targets.map((t: any) => t.studentId ?? t.student_id)
      : [];
  return {
    id: str(a.id),
    title: str(a.title),
    classId: pick(a, 'classId', 'target_class_id', 'targetClassId') ?? null,
    dueAt: pick(a, 'dueAt', 'due_at') ?? null,
    isTimed: !!pick(a, 'isTimed', 'is_timed'),
    timeLimitMinutes: numOrNull(pick(a, 'timeLimitMinutes', 'time_limit_minutes')),
    xpReward: typeof pick(a, 'xpReward', 'xp_reward') === 'number' ? pick(a, 'xpReward', 'xp_reward') : 0,
    published: !!pick(a, 'published', 'published_at'),
    questionIds: qIds,
    studentIds: sIds,
  };
}

/** Lưu bài (nháp hoặc giao): server thay toàn bộ câu hỏi + đồng bộ đối tượng. */
export async function updateAssignment(id: string, input: UpdateAssignmentInput): Promise<void> {
  await apiFetch(`/api/assignments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Xóa hẳn một bài tập & đánh giá cùng mọi dữ liệu con (server xóa theo thứ tự FK). */
export async function deleteAssignmentCompletely(id: string): Promise<void> {
  await apiFetch(`/api/assignments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Đề bài cho học sinh làm — KHÔNG kèm đáp án đúng. */
export async function getAssignmentDetail(assignmentId: string): Promise<AssignmentDetail | null> {
  const data = unwrap(await apiFetch(`/api/assignments/${encodeURIComponent(assignmentId)}`));
  if (!data || typeof data !== 'object') return null;
  const a: any = data;
  const questions: AssignmentDetailQuestion[] = Array.isArray(a.questions)
    ? a.questions.map((q: any) => ({
        id: str(q.id ?? q.question_id),
        prompt: str(q.prompt),
        passage: q.passage ?? null,
        type: normalizeQType(q.type),
        options: Array.isArray(q.options) ? q.options : [],
        points: typeof q.points === 'number' ? q.points : 10,
      }))
    : [];
  return {
    id: str(a.id),
    title: str(a.title),
    isTimed: !!pick(a, 'isTimed', 'is_timed'),
    timeLimitMinutes: numOrNull(pick(a, 'timeLimitMinutes', 'time_limit_minutes')),
    xpReward: typeof pick(a, 'xpReward', 'xp_reward') === 'number' ? pick(a, 'xpReward', 'xp_reward') : 0,
    dueAt: pick(a, 'dueAt', 'due_at') ?? null,
    questions,
  };
}

/**
 * Học sinh nộp bài: server ghi attempts + attempt_answers, chấm tự động
 * phần có đáp án, tạo phiếu chờ cho phần tự luận, và tính XP server-side.
 * Trả về SubmitResult + totalXp mới (nếu server trả).
 */
export async function submitAssignmentAttempt(input: {
  assignmentId: string;
  studentId: string;
  startedAt: string;
  responses: Record<string, { selected?: string[]; text?: string }>;
}): Promise<SubmitResult> {
  const data = unwrap(
    await apiFetch('/api/attempts', { method: 'POST', body: JSON.stringify(input) })
  );
  if (!data || typeof data !== 'object') throw new Error('Máy chủ nộp bài không trả về kết quả.');
  return {
    attemptId: str(data.attemptId ?? data.attempt_id ?? data.id),
    autoScore: typeof data.autoScore === 'number' ? data.autoScore : 0,
    maxScore: typeof data.maxScore === 'number' ? data.maxScore : 0,
    pendingCount: typeof data.pendingCount === 'number' ? data.pendingCount : 0,
    gradedCount: typeof data.gradedCount === 'number' ? data.gradedCount : 0,
    totalXp: typeof (data.totalXp ?? data.total_xp) === 'number' ? (data.totalXp ?? data.total_xp) : undefined,
  };
}

/** Bài được giao cho học sinh (chỉ bài ĐÃ giao; server lọc theo JWT). */
export async function getStudentAssignments(studentId: string) {
  const rows = unwrapList(await apiFetch('/api/student-assignments'));
  const list = rows.filter((r: any) => {
    const sid = r.studentId ?? r.student_id;
    return !sid || sid === studentId;
  });
  return list.map((r: any) => ({
    targetId: str(pick(r, 'targetId', 'target_id')),
    assignmentId: str(pick(r, 'assignmentId', 'assignment_id')),
    title: str(pick(r, 'title')),
    dueAt: pick(r, 'dueAt', 'due_at') ?? null,
    isTimed: !!pick(r, 'isTimed', 'is_timed'),
    timeLimitMinutes: numOrNull(pick(r, 'timeLimitMinutes', 'time_limit_minutes')),
    questionCount: typeof pick(r, 'questionCount', 'question_count') === 'number' ? pick(r, 'questionCount', 'question_count') : 0,
    status: pick(r, 'status', 'submission_status') ?? null,
    firstSubmittedAt: pick(r, 'firstSubmittedAt', 'first_submitted_at') ?? null,
    attempts: Array.isArray(r.attempts) ? r.attempts : [],
  }));
}
