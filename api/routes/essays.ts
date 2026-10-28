/**
 * Router nhóm B — bài văn / chấm bài / phiếu review.
 * Mount tại /api.
 *
 * - GET/POST /essays, GET /essays/:id, PATCH /essays/:id/draft,
 *   POST /essays/:id/grade
 * - GET /reviews/pending, GET /reviews/graded, GET /reviews/:answerId,
 *   POST /reviews/:answerId/grade
 *
 * Giữ đúng gradeSubmission gốc (2 nhánh):
 * - bài nộp thường: essay_submissions -> GRADED + ghi question_result
 *   vào student_states (mastery) trong 1 transaction;
 * - phiếu gộp 'review:<reviewId>': answer_reviews + attempt_answers +
 *   attempts (tính lại tổng, gradePendingAnswer) + question_result.
 * Điểm phiếu quy về thang 10 ở hàng đợi, điểm gốc theo maxScore riêng
 * của câu (answerScore = totalScore/10 * maxScore, làm tròn 2 số lẻ).
 * Nháp chấm của PHIẾU (review:) gốc chỉ lưu localStorage trình duyệt
 * (không có cột nháp trên DB) nên server KHÔNG ghi đè cột chấm thật:
 * PATCH draft cho review: trả kèm teacherDraft + persisted:false (TODO:
 * cần bảng/cột nháp riêng nếu muốn đồng bộ nháp phiếu qua server).
 *
 * KHÔNG CÓ endpoint rubric/sample/config/accuracy: các method đó của
 * Essay repo ủy quyền thẳng sang mock repo (local, không query bảng
 * nào) — xem báo cáo. Không bịa endpoint cho dữ liệu chỉ ở local.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query, withTransaction, parseJson } from '../_lib/mysql';
import type { Db } from '../_lib/mysql';
import { requireAuth, requireRole, httpErr } from '../_lib/auth';
import type { AuthedRequest } from '../_lib/auth';
import { teacherClassIds } from '../_lib/scope';
import {
  db,
  bodyOf,
  checkKeyLen,
  rejectSentinel,
  toNum,
  isAdmin,
  isTeacher,
  isStudent,
  canAccessStudent,
  findStudent,
  renderResponse,
  ah,
} from './_shared';

export const essaysRouter = Router();
essaysRouter.use(requireAuth);

// ---------------------------------------------------------------- helpers
type Scope = { studentIds: string[] | null; classIds: string[] | null };

async function teacherScope(conn: Db, caller: any): Promise<Scope> {
  if (isAdmin(caller)) return { studentIds: null, classIds: null };
  if (isTeacher(caller) && caller.teacherId) {
    const classIds = await teacherClassIds(conn, caller.teacherId);
    if (!classIds.length) return { studentIds: [], classIds: [] };
    const students = await conn.query<any>(
      `SELECT \`id\` FROM \`students\` WHERE \`class_id\` IN (${classIds.map(() => '?').join(',')})`,
      classIds
    );
    return { studentIds: students.map((s: any) => s.id), classIds };
  }
  if (isStudent(caller) && caller.studentId) {
    return { studentIds: [caller.studentId], classIds: caller.classId ? [caller.classId] : null };
  }
  return { studentIds: [], classIds: [] };
}

async function questionInfo(conn: Db, questionIds: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const uniq = [...new Set(questionIds.filter(Boolean))];
  if (!uniq.length) return map;
  const rows = await conn.query<any>(
    `SELECT \`id\`, \`prompt\`, \`level\`, \`topic_id\` FROM \`questions\` WHERE \`id\` IN (${uniq.map(() => '?').join(',')})`,
    uniq
  );
  for (const r of rows) map.set(r.id, r);
  return map;
}

function mapEssayRow(e: any, qInfo?: any, studentName?: string, className?: string): any {
  const rubric: any = parseJson<any>(e.rubric_scores, null);
  const aiScores: any = parseJson<any>(e.ai_suggested_scores, null);
  const submittedAt = e.created_at ? new Date(e.created_at).getTime() : Date.now();
  return {
    id: e.id,
    questionId: e.question_id || 'q_essay_01',
    quizId: e.question_id || 'q_essay_01',
    studentId: e.student_id,
    studentName: studentName || 'Học sinh',
    classId: e.class_id,
    className: className || 'Không rõ lớp',
    promptTitle: qInfo?.prompt || 'Bài viết tự luận',
    quizTitle: 'Bài tập làm văn',
    prompt: qInfo?.prompt || '',
    content: e.content,
    wordCount: e.word_count ?? (e.content ? e.content.trim().split(/\s+/).length : 0),
    submittedAt,
    status: e.status,
    teacherFeedback: e.teacher_feedback || undefined,
    rubricScores: Array.isArray(rubric) ? rubric : undefined,
    totalScore: e.total_score != null ? Number(e.total_score) : undefined,
    finalRatio: e.total_score != null ? Number(e.total_score) / 10 : undefined,
    aiSuggestion: aiScores
      ? {
          rubricScores: aiScores,
          overallComment: e.ai_suggested_feedback || '',
          suggestedTotalScore: Array.isArray(aiScores)
            ? aiScores.reduce((s: number, c: any) => s + (c.score || 0), 0)
            : undefined,
          suggestedAt: e.created_at,
        }
      : undefined,
    skillLevel: qInfo?.level || 'VAN_DUNG',
    hoursWaiting: Math.max(0, Math.floor((Date.now() - submittedAt) / 3600000)),
  };
}

/** Phiếu review -> item hàng đợi chấm (dạng 'review:<reviewId>'). */
function mapReviewItem(r: any, content: string): any {
  const maxScore = r.max_score && r.max_score > 0 ? r.max_score : 10;
  const graded = r.review_status === 'GRADED';
  const ratio = graded && r.score_awarded != null ? Number(r.score_awarded) / maxScore : undefined;
  const submittedAt = r.review_created_at ? new Date(r.review_created_at).getTime() : Date.now();
  return {
    id: `review:${r.review_id}`,
    reviewId: r.review_id,
    answerId: r.answer_id,
    attemptId: r.attempt_id,
    questionId: r.question_id,
    studentId: r.student_id,
    studentName: r.student_name || 'Học sinh',
    classId: r.class_id || '',
    className: r.class_name || 'Không rõ lớp',
    promptTitle: r.question_prompt || 'Bài viết tự luận',
    quizTitle: r.source_title || 'Bài tập làm văn',
    questionPrompt: r.question_prompt || '',
    content,
    wordCount: content.trim() ? content.trim().split(/\s+/).length : 0,
    submittedAt,
    status: graded ? 'GRADED' : 'PENDING_TEACHER',
    teacherFeedback: graded ? r.feedback || undefined : undefined,
    totalScore: ratio != null ? Math.round(ratio * 1000) / 100 : undefined,
    finalRatio: ratio,
    hoursWaiting: graded ? 0 : Math.max(0, Math.floor((Date.now() - submittedAt) / 3600000)),
  };
}

/** Đọc phiếu review (kèm câu trả lời + lượt làm + học sinh + lớp). */
async function fetchReviews(
  conn: Db,
  studentIds: string[] | null,
  status: 'PENDING' | 'GRADED',
  includeResponseText: boolean
): Promise<any[]> {
  // Lọc theo học sinh ở bộ nhớ qua attMap như getReviewsByStatus gốc
  // (reviews không có student_id trực tiếp).
  const atts = studentIds
    ? studentIds.length
      ? await conn.query<any>(
          `SELECT \`attempt_id\`, \`student_id\`, \`assignment_id\`, \`learning_activity_id\` FROM \`attempts\` WHERE \`student_id\` IN (${studentIds.map(() => '?').join(',')})`,
          studentIds
        )
      : []
    : await conn.query<any>(
        'SELECT `attempt_id`, `student_id`, `assignment_id`, `learning_activity_id` FROM `attempts`'
      );
  if (!atts.length) return [];
  const attMap = new Map(atts.map((a: any) => [a.attempt_id, a]));
  const reviews = await conn.query<any>(
    'SELECT * FROM `answer_reviews` WHERE `review_status` = ? ORDER BY `created_at` ASC',
    [status]
  );
  if (!reviews.length) return [];
  const ansIds = reviews.map((r: any) => r.answer_id);
  const answers = await conn.query<any>(
    includeResponseText
      ? `SELECT * FROM \`attempt_answers\` WHERE \`answer_id\` IN (${ansIds.map(() => '?').join(',')})`
      : 'SELECT `answer_id`, `attempt_id`, `question_id`, `is_correct`, `score_awarded`, `max_score`, `grading_status`, `grading_method`, `response_time_seconds` ' +
        `FROM \`attempt_answers\` WHERE \`answer_id\` IN (${ansIds.map(() => '?').join(',')})`,
    ansIds
  );
  const ansMap = new Map(answers.map((a: any) => [a.answer_id, a]));
  const qIds = [...new Set(answers.map((a: any): string => a.question_id))] as string[];
  const qMap = await questionInfo(conn, qIds);
  const stIds = [...new Set(atts.map((a: any): string => a.student_id))] as string[];
  const stRows = stIds.length
    ? await conn.query<any>(
        `SELECT \`id\`, \`name\`, \`class_id\` FROM \`students\` WHERE \`id\` IN (${stIds.map(() => '?').join(',')})`,
        stIds
      )
    : [];
  const stMap = new Map(stRows.map((s: any) => [s.id, s]));
  const clRows = await conn.query<any>('SELECT `id`, `name` FROM `classes`');
  const clMap = new Map(clRows.map((c: any) => [c.id, c.name]));
  const asgIds = [...new Set(atts.map((a: any) => a.assignment_id).filter(Boolean))];
  const actIds = [...new Set(atts.map((a: any) => a.learning_activity_id).filter(Boolean))];
  const asgRows = asgIds.length
    ? await conn.query<any>(`SELECT \`id\`, \`title\` FROM \`assignments\` WHERE \`id\` IN (${asgIds.map(() => '?').join(',')})`, asgIds)
    : [];
  const actRows = actIds.length
    ? await conn.query<any>(`SELECT \`id\`, \`title\` FROM \`learning_activities\` WHERE \`id\` IN (${actIds.map(() => '?').join(',')})`, actIds)
    : [];
  const asgMap = new Map(asgRows.map((a: any) => [a.id, a.title]));
  const actMap = new Map(actRows.map((a: any) => [a.id, a.title]));
  const out: any[] = [];
  for (const r of reviews) {
    const ans: any = ansMap.get(r.answer_id);
    if (!ans) continue;
    const att: any = attMap.get(ans.attempt_id);
    if (!att) continue; // không thuộc phạm vi học sinh này
    const st: any = stMap.get(att.student_id);
    const q: any = qMap.get(ans.question_id);
    out.push(
      mapReviewItem(
        {
          review_id: r.review_id,
          answer_id: r.answer_id,
          attempt_id: ans.attempt_id,
          question_id: ans.question_id,
          student_id: att.student_id,
          student_name: st?.name,
          class_id: st?.class_id,
          class_name: st?.class_id ? clMap.get(st.class_id) : undefined,
          question_prompt: q?.prompt || ans.question_id,
          source_title: att.assignment_id
            ? asgMap.get(att.assignment_id) || att.assignment_id
            : actMap.get(att.learning_activity_id) || att.learning_activity_id,
          max_score: ans.max_score,
          review_status: r.review_status,
          score_awarded: r.score_awarded,
          feedback: r.feedback,
          review_created_at: r.created_at,
        },
        includeResponseText ? renderResponse(ans.response_json, parseJson) : ''
      )
    );
  }
  return out;
}

async function essayList(conn: Db, caller: any, q: any): Promise<any[]> {
  const scope = await teacherScope(conn, caller);
  if (scope.studentIds && scope.studentIds.length === 0) return [];
  const where: string[] = [];
  const params: any[] = [];
  if (scope.studentIds) {
    where.push(`e.\`student_id\` IN (${scope.studentIds.map(() => '?').join(',')})`);
    params.push(...scope.studentIds);
  }
  if (q.studentId) {
    where.push('e.`student_id` = ?');
    params.push(q.studentId);
  }
  if (q.classId && q.classId !== 'all') {
    where.push('e.`class_id` = ?');
    params.push(q.classId);
  }
  if (q.status && q.status !== 'ALL') {
    if (q.status === 'PENDING_TEACHER') {
      where.push("e.`status` IN ('PENDING_TEACHER', 'AI_SUGGESTED')");
    } else {
      where.push('e.`status` = ?');
      params.push(q.status);
    }
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await conn.query<any>(
    `SELECT e.*, s.\`name\` AS student_name, c.\`name\` AS class_name FROM \`essay_submissions\` e ` +
      'LEFT JOIN `students` s ON s.`id` = e.`student_id` LEFT JOIN `classes` c ON c.`id` = e.`class_id` ' +
      `${whereSql} ORDER BY e.\`created_at\` DESC`,
    params
  );
  const qMap = await questionInfo(conn, rows.map((r: any) => r.question_id));
  let merged = rows.map((r: any) => mapEssayRow(r, qMap.get(r.question_id), r.student_name, r.class_name));
  if (q.quizId) {
    merged = merged.filter((e: any) => e.quizId === q.quizId || e.questionId === q.quizId);
  }
  // Gộp phiếu chấm (mặc định như gốc; includeReviews=false thì bỏ qua).
  if (q.includeReviews !== 'false') {
    const includeText = q.includeReviewText !== 'false';
    const wantPending = q.status !== 'GRADED';
    const wantGraded = q.status !== 'PENDING_TEACHER' && q.status !== 'AI_SUGGESTED';
    const revs: any[] = [];
    if (wantPending) revs.push(...(await fetchReviews(conn, scope.studentIds, 'PENDING', includeText)));
    if (wantGraded) revs.push(...(await fetchReviews(conn, scope.studentIds, 'GRADED', includeText)));
    let filtered = revs;
    if (q.classId && q.classId !== 'all') {
      filtered = filtered.filter((r: any) => r.classId === q.classId);
    }
    if (q.studentId) {
      filtered = filtered.filter((r: any) => r.studentId === q.studentId);
    }
    merged = [...merged, ...filtered].sort((a: any, b: any) => b.submittedAt - a.submittedAt);
  }
  return merged;
}

/** Ghi question_result mastery vào state (như gradeSubmission gốc). */
async function appendQuestionResult(
  tx: Db,
  studentId: string,
  result: any
): Promise<void> {
  const rows = await tx.query<any>(
    'SELECT `question_results` FROM `student_states` WHERE `student_id` = ? LIMIT 1',
    [studentId]
  );
  const cur: any[] = parseJson(rows[0]?.question_results, []);
  await tx.execute(
    'INSERT INTO `student_states` (`student_id`, `question_results`) VALUES (?, ?) ' +
      'ON DUPLICATE KEY UPDATE `question_results` = VALUES(`question_results`)',
    [studentId, JSON.stringify([result, ...cur])]
  );
}

// ---------------------------------------------------------------- essays
essaysRouter.get('/essays', ah(async (req: AuthedRequest, res) => {
  res.json(await essayList(db, req.caller!, req.query));
}));

essaysRouter.post('/essays', ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const body = bodyOf(req);
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) {
    httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  let studentId: string;
  if (isStudent(caller)) {
    studentId = caller.studentId!;
  } else {
    studentId = body.studentId || body.student_id;
    if (!studentId || !checkKeyLen(res, studentId) || !rejectSentinel(res, studentId)) {
      if (!studentId) httpErr(res, 400, 'BAD_INPUT');
      return;
    }
    if (isTeacher(caller) && !(await canAccessStudent(db, caller, studentId))) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
  }
  const student = await findStudent(db, studentId);
  if (!student) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  const questionId = body.questionId || body.question_id || 'q_essay_01';
  if (typeof questionId === 'string' && questionId.length > 100) {
    httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  // essay_submissions.id là CHAR(36) — dùng UUID thật.
  const uuid = randomUUID();
  await query(
    'INSERT INTO `essay_submissions` (`id`, `question_id`, `student_id`, `class_id`, `content`, `word_count`, `status`, `ai_suggested_scores`, `ai_suggested_feedback`) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      uuid,
      questionId,
      studentId,
      student.class_id,
      content,
      toNum(body.wordCount ?? body.word_count, content.split(/\s+/).length),
      body.status || 'PENDING_TEACHER',
      body.aiSuggestion?.rubricScores ? JSON.stringify(body.aiSuggestion.rubricScores) : null,
      body.aiSuggestion?.overallComment || null,
    ]
  );
  const rows = await query<any>('SELECT * FROM `essay_submissions` WHERE `id` = ? LIMIT 1', [uuid]);
  const qMap = await questionInfo(db, [questionId]);
  res.status(201).json(mapEssayRow(rows[0], qMap.get(questionId), student.name, undefined));
}));

essaysRouter.get('/essays/:id', ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  if (id.startsWith('review:')) {
    const reviewId = id.slice('review:'.length);
    if (!checkKeyLen(res, reviewId)) return;
    const scope = await teacherScope(db, caller);
    if (scope.studentIds && scope.studentIds.length === 0) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    const revs = await fetchReviews(db, scope.studentIds, 'PENDING', true);
    const graded = await fetchReviews(db, scope.studentIds, 'GRADED', true);
    const item = [...revs, ...graded].find((r: any) => r.reviewId === reviewId);
    if (!item) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    res.json(item);
    return;
  }
  if (!checkKeyLen(res, id)) return;
  const list = await essayList(db, caller, {});
  const item = list.find((e: any) => e.id === id);
  if (!item) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  res.json(item);
}));

essaysRouter.patch('/essays/:id/draft', ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  const body = bodyOf(req);
  if (id.startsWith('review:')) {
    // Nháp phiếu gốc chỉ ở localStorage — server không ghi đè cột chấm
    // thật; trả lại item kèm nháp, cờ persisted:false (xem đầu file).
    const reviewId = id.slice('review:'.length);
    if (!checkKeyLen(res, reviewId)) return;
    const scope = await teacherScope(db, caller);
    const revs = await fetchReviews(db, scope.studentIds, 'PENDING', true);
    const item = revs.find((r: any) => r.reviewId === reviewId);
    if (!item) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    res.json({
      ...item,
      teacherDraft: {
        rubricScores: body.rubricScores || body.rubric_scores,
        teacherFeedback: body.teacherFeedback ?? body.teacher_feedback,
      },
      persisted: false,
    });
    return;
  }
  if (!checkKeyLen(res, id)) return;
  const rows = await query<any>('SELECT * FROM `essay_submissions` WHERE `id` = ? LIMIT 1', [id]);
  const row = rows[0];
  if (!row) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isStudent(caller) && caller.studentId !== row.student_id) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  if (isTeacher(caller) && !(await canAccessStudent(db, caller, row.student_id))) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const sets: string[] = [];
  const vals: any[] = [];
  if (body.rubricScores || body.rubric_scores) {
    sets.push('`rubric_scores` = ?');
    vals.push(JSON.stringify(body.rubricScores || body.rubric_scores));
  }
  if (body.teacherFeedback !== undefined || body.teacher_feedback !== undefined) {
    sets.push('`teacher_feedback` = ?');
    vals.push(body.teacherFeedback ?? body.teacher_feedback);
  }
  if (sets.length) {
    await query(`UPDATE \`essay_submissions\` SET ${sets.join(', ')} WHERE \`id\` = ?`, [...vals, id]);
  }
  const list = await essayList(db, caller, {});
  res.json(list.find((e: any) => e.id === id) || { id });
}));

essaysRouter.post('/essays/:id/grade', requireRole('teacher', 'admin'), ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  const body = bodyOf(req);
  const totalScore = toNum(body.totalScore ?? body.total_score, NaN);
  if (!Number.isFinite(totalScore) || totalScore < 0 || totalScore > 10) {
    httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  const teacherFeedback = typeof body.teacherFeedback === 'string' ? body.teacherFeedback : body.teacher_feedback || '';
  const rubricScores = body.rubricScores || body.rubric_scores || [];
  const finalRatio = body.finalRatio ?? body.final_ratio ?? totalScore / 10;

  if (id.startsWith('review:')) {
    const reviewId = id.slice('review:'.length);
    if (!checkKeyLen(res, reviewId)) return;
    const graded = await withTransaction(async (tx: Db) => {
      const revRows = await tx.query<any>('SELECT * FROM `answer_reviews` WHERE `review_id` = ? LIMIT 1', [reviewId]);
      const rev = revRows[0];
      if (!rev) return null;
      const ansRows = await tx.query<any>('SELECT * FROM `attempt_answers` WHERE `answer_id` = ? LIMIT 1', [rev.answer_id]);
      const ans = ansRows[0];
      if (!ans) return null;
      const attRows = await tx.query<any>('SELECT `student_id` FROM `attempts` WHERE `attempt_id` = ? LIMIT 1', [ans.attempt_id]);
      const studentId = attRows[0]?.student_id;
      if (!studentId) return null;
      if (isTeacher(caller) && !(await canAccessStudent(tx, caller, studentId))) return 'FORBIDDEN';
      const maxScore = Number(ans.max_score) > 0 ? Number(ans.max_score) : 10;
      const answerScore = Math.round(((totalScore / 10) * maxScore) * 100) / 100;
      // gradePendingAnswer: review + câu trả lời + tổng lượt làm.
      await tx.execute(
        'UPDATE `answer_reviews` SET `score_awarded` = ?, `feedback` = ?, `review_status` = ?, `reviewed_at` = UTC_TIMESTAMP(), `reviewer_id` = ?, `rubric_scores` = ? WHERE `review_id` = ?',
        [answerScore, teacherFeedback || null, 'GRADED', caller.teacherId || null, JSON.stringify(rubricScores), reviewId]
      );
      await tx.execute(
        'UPDATE `attempt_answers` SET `score_awarded` = ?, `grading_status` = ? WHERE `answer_id` = ?',
        [answerScore, 'GRADED', rev.answer_id]
      );
      const allAns = await tx.query<any>(
        'SELECT `score_awarded`, `grading_status` FROM `attempt_answers` WHERE `attempt_id` = ?',
        [ans.attempt_id]
      );
      const total = allAns.reduce((s: number, a: any) => s + Number(a.score_awarded ?? 0), 0);
      const allGraded = allAns.every((a: any) => a.grading_status === 'GRADED');
      await tx.execute(
        'UPDATE `attempts` SET `score_awarded` = ?, `grading_status` = ? WHERE `attempt_id` = ?',
        [total, allGraded ? 'GRADED' : 'PARTIALLY_GRADED', ans.attempt_id]
      );
      // Mastery: ghi question_result (chỉ khi xác định được chủ đề câu hỏi).
      const qRows = await tx.query<any>('SELECT `topic_id`, `level` FROM `questions` WHERE `id` = ? LIMIT 1', [ans.question_id]);
      if (qRows[0]?.topic_id) {
        await appendQuestionResult(tx, studentId, {
          questionId: ans.question_id,
          level: qRows[0].level || 'VAN_DUNG',
          isCorrect: totalScore >= 5,
          scoreRatio: finalRatio,
          timestamp: Date.now(),
          topicId: qRows[0].topic_id,
        });
      }
      return { studentId, reviewId };
    });
    if (graded === null) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    if (graded === 'FORBIDDEN') {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
    const scope = await teacherScope(db, caller);
    const revs = await fetchReviews(db, scope.studentIds, 'GRADED', true);
    res.json(revs.find((r: any) => r.reviewId === reviewId) || { id, status: 'GRADED' });
    return;
  }

  if (!checkKeyLen(res, id)) return;
  const graded = await withTransaction(async (tx: Db) => {
    const rows = await tx.query<any>('SELECT * FROM `essay_submissions` WHERE `id` = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return null;
    if (isTeacher(caller) && !(await canAccessStudent(tx, caller, row.student_id))) return 'FORBIDDEN';
    await tx.execute(
      'UPDATE `essay_submissions` SET `status` = ?, `teacher_feedback` = ?, `rubric_scores` = ?, `total_score` = ?, `graded_at` = UTC_TIMESTAMP() WHERE `id` = ?',
      ['GRADED', teacherFeedback, JSON.stringify(rubricScores), totalScore, id]
    );
    const qRows = await tx.query<any>('SELECT `topic_id`, `level` FROM `questions` WHERE `id` = ? LIMIT 1', [row.question_id]);
    if (qRows[0]?.topic_id) {
      await appendQuestionResult(tx, row.student_id, {
        questionId: row.question_id,
        level: qRows[0].level || 'VAN_DUNG',
        isCorrect: totalScore >= 5,
        scoreRatio: finalRatio,
        timestamp: Date.now(),
        topicId: qRows[0].topic_id,
      });
    }
    return row.student_id;
  });
  if (graded === null) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (graded === 'FORBIDDEN') {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const list = await essayList(db, caller, {});
  res.json(list.find((e: any) => e.id === id) || { id, status: 'GRADED' });
}));

// ---------------------------------------------------------------- reviews
essaysRouter.get('/reviews/pending', requireRole('teacher', 'admin'), ah(async (req: AuthedRequest, res) => {
  const scope = await teacherScope(db, req.caller!);
  if (scope.studentIds && scope.studentIds.length === 0) {
    res.json([]);
    return;
  }
  res.json(await fetchReviews(db, scope.studentIds, 'PENDING', req.query.includeResponseText !== 'false'));
}));

essaysRouter.get('/reviews/graded', requireRole('teacher', 'admin'), ah(async (req: AuthedRequest, res) => {
  const scope = await teacherScope(db, req.caller!);
  if (scope.studentIds && scope.studentIds.length === 0) {
    res.json([]);
    return;
  }
  res.json(await fetchReviews(db, scope.studentIds, 'GRADED', req.query.includeResponseText !== 'false'));
}));

essaysRouter.get('/reviews/:answerId', requireRole('teacher', 'admin'), ah(async (req: AuthedRequest, res) => {
  const answerId = req.params.answerId;
  if (!checkKeyLen(res, answerId)) return;
  const rows = await query<any>(
    'SELECT aa.`response_json`, a.`student_id` FROM `attempt_answers` aa JOIN `attempts` a ON a.`attempt_id` = aa.`attempt_id` WHERE aa.`answer_id` = ? LIMIT 1',
    [answerId]
  );
  const row = rows[0];
  if (!row) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isTeacher(req.caller!) && !(await canAccessStudent(db, req.caller!, row.student_id))) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  res.json({ answerId, content: renderResponse(row.response_json, parseJson) });
}));

essaysRouter.post('/reviews/:answerId/grade', requireRole('teacher', 'admin'), ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const answerId = req.params.answerId;
  if (!checkKeyLen(res, answerId)) return;
  const body = bodyOf(req);
  const score = toNum(body.score ?? body.score_awarded ?? body.scoreAwarded, NaN);
  if (!Number.isFinite(score) || score < 0) {
    httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  const feedback = typeof body.feedback === 'string' ? body.feedback : body.teacherFeedback || '';
  const rubricScores = body.rubricScores || body.rubric_scores;
  const out = await withTransaction(async (tx: Db) => {
    const revRows = await tx.query<any>('SELECT * FROM `answer_reviews` WHERE `answer_id` = ? LIMIT 1', [answerId]);
    const rev = revRows[0];
    if (!rev) return null;
    const ansRows = await tx.query<any>('SELECT * FROM `attempt_answers` WHERE `answer_id` = ? LIMIT 1', [answerId]);
    const ans = ansRows[0];
    if (!ans) return null;
    const attRows = await tx.query<any>('SELECT `student_id` FROM `attempts` WHERE `attempt_id` = ? LIMIT 1', [ans.attempt_id]);
    const studentId = attRows[0]?.student_id;
    if (!studentId) return null;
    if (isTeacher(caller) && !(await canAccessStudent(tx, caller, studentId))) return 'FORBIDDEN';
    await tx.execute(
      'UPDATE `answer_reviews` SET `score_awarded` = ?, `feedback` = ?, `review_status` = ?, `reviewed_at` = UTC_TIMESTAMP(), `reviewer_id` = ?' +
        (rubricScores !== undefined ? ', `rubric_scores` = ?' : '') +
        ' WHERE `review_id` = ?',
      rubricScores !== undefined
        ? [score, feedback || null, 'GRADED', caller.teacherId || null, JSON.stringify(rubricScores), rev.review_id]
        : [score, feedback || null, 'GRADED', caller.teacherId || null, rev.review_id]
    );
    await tx.execute(
      'UPDATE `attempt_answers` SET `score_awarded` = ?, `grading_status` = ? WHERE `answer_id` = ?',
      [score, 'GRADED', answerId]
    );
    const allAns = await tx.query<any>(
      'SELECT `score_awarded`, `grading_status` FROM `attempt_answers` WHERE `attempt_id` = ?',
      [ans.attempt_id]
    );
    const total = allAns.reduce((s: number, a: any) => s + Number(a.score_awarded ?? 0), 0);
    const allGraded = allAns.every((a: any) => a.grading_status === 'GRADED');
    await tx.execute(
      'UPDATE `attempts` SET `score_awarded` = ?, `grading_status` = ? WHERE `attempt_id` = ?',
      [total, allGraded ? 'GRADED' : 'PARTIALLY_GRADED', ans.attempt_id]
    );
    return { reviewId: rev.review_id, attemptId: ans.attempt_id, score, total };
  });
  if (out === null) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (out === 'FORBIDDEN') {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  res.json(out);
}));
