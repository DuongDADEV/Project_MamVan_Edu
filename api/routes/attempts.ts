/**
 * Router nhóm B — bài làm / trạng thái / XP / bài tập giao.
 * Mount tại /api (đường dẫn đầy đủ dạng /api/...).
 *
 * - GET/PUT /student-states/:studentId, POST /student-states/:studentId/check-in
 * - POST /attempts, GET /attempts/:id
 * - POST/GET /assignments, GET/PATCH/DELETE /assignments/:id
 * - GET /student-assignments, POST /topics/:id/complete
 *
 * LUẬT XP: client KHÔNG BAO GIỜ ghi trực tiếp total_xp/xp_week/xp_today/
 * xp_logs — PUT student-states lọc bỏ 4 trường này (whitelist trong
 * _shared.filterStateInput); mọi tổng XP trả về đều lấy từ getTotals().
 * Chấm tự động + XP nộp bài giữ đúng submitAssignmentAttempt gốc
 * (biRepository): AUTO + có đáp án + không phải essay mới chấm tự động;
 * XP nộp bài = assignments.xp_reward, không phụ thuộc đúng/sai, chỉ trả
 * lần nộp ĐẦU cho mỗi bài (giữ hành vi client cũ, chống farm XP);
 * key submission:<attemptId> chỉ chống retry trùng attempt.
 * POST /quiz-completions: XP bài quiz nội dung (BTVN trong chủ đề) —
 * giữ đúng App cũ (QuizRunner chấm local, trả totalScore, 1 lần/quiz).
 */
import { Router } from 'express';
import { query, execute, withTransaction, parseJson, toMySQLDatetime } from '../_lib/mysql';
import type { Db } from '../_lib/mysql';
import { requireAuth, requireRole, httpErr } from '../_lib/auth';
import type { AuthedRequest } from '../_lib/auth';
import {
  awardCheckIn,
  awardSubmission,
  awardTopicCompletion,
  awardQuizCompletion,
  getTotals,
} from '../_lib/xp';
import { teacherClassIds } from '../_lib/scope';
import {
  db,
  vnToday,
  bodyOf,
  checkKeyLen,
  rejectSentinel,
  toNum,
  genId,
  isAdmin,
  isTeacher,
  isStudent,
  canAccessStudent,
  findStudent,
  mapStateRow,
  filterStateInput,
  normalizeQType,
  normText,
  gradeFillBlanks,
  passageLeaksAnswer,
  AUTO_Q_TYPES,
  ah,
} from './_shared';

export const attemptsRouter = Router();
attemptsRouter.use(requireAuth);

/** Đọc state (tạo dòng trắng nếu chưa có) + tổng XP từ getTotals. */
async function readState(conn: Db, studentId: string): Promise<any> {
  const rows = await conn.query<any>(
    'SELECT * FROM `student_states` WHERE `student_id` = ? LIMIT 1',
    [studentId]
  );
  const state = rows[0]
    ? mapStateRow(rows[0], parseJson)
    : {
        student_id: studentId,
        xp_today: 0,
        xp_week: 0,
        total_xp: 0,
        active_seconds_today: 0,
        consecutive_days: 0,
        last_attendance_date: null,
        completed_steps: [],
        topic_mastery: {},
        unlocked_badge_ids: [],
        xp_logs: [],
        preferences: {},
        attendance_days_this_week: 0,
        attendance_history: [],
        question_results: [],
        flagged_topic_ids: [],
        current_progress: {},
        updated_at: null,
      };
  try {
    const totals: any = await getTotals(conn, studentId);
    if (totals) {
      state.total_xp = totals.totalXp ?? state.total_xp;
      state.xp_week = totals.xpWeek ?? state.xp_week;
      state.xp_today = totals.xpToday ?? state.xp_today;
    }
  } catch {
    // getTotals lỗi thì vẫn trả state DB (không chặn đường đọc).
  }
  return state;
}

// ---------------------------------------------------------------- states
/** List state (GĐ3 tích hợp — client getAllStates cần; teacher chỉ lớp mình). */
attemptsRouter.get('/student-states', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  if (isStudent(caller)) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const classFilter = typeof req.query.class_id === 'string' ? req.query.class_id : '';
  if (classFilter && !rejectSentinel(res, classFilter)) return;
  let studentIds: string[];
  if (isAdmin(caller)) {
    const rows = await query<any>(
      classFilter
        ? 'SELECT `id` FROM `students` WHERE `class_id` = ?'
        : 'SELECT `id` FROM `students`',
      classFilter ? [classFilter] : []
    );
    studentIds = rows.map((r: any) => r.id);
  } else {
    if (!caller.teacherId) {
      res.json({ states: [] });
      return;
    }
    const classIds = await teacherClassIds(db, caller.teacherId);
    if (classFilter && !classIds.includes(classFilter)) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
    const target = classFilter ? [classFilter] : classIds;
    if (!target.length) {
      res.json({ states: [] });
      return;
    }
    const rows = await query<any>(
      `SELECT \`id\` FROM \`students\` WHERE \`class_id\` IN (${target.map(() => '?').join(',')})`,
      target
    );
    studentIds = rows.map((r: any) => r.id);
  }
  const states = [];
  for (const sid of studentIds) states.push(await readState(db, sid));
  res.json({ states });
});

attemptsRouter.get('/student-states/:studentId', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const studentId = req.params.studentId;
  if (!checkKeyLen(res, studentId) || !rejectSentinel(res, studentId)) return;
  if (!(await canAccessStudent(db, caller, studentId))) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  if (!(await findStudent(db, studentId))) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  res.json(await readState(db, studentId));
});

attemptsRouter.put('/student-states/:studentId', ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const studentId = req.params.studentId;
  if (!checkKeyLen(res, studentId) || !rejectSentinel(res, studentId)) return;
  if (!(await canAccessStudent(db, caller, studentId))) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  if (!(await findStudent(db, studentId))) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  // LỌC XP: filterStateInput chỉ giữ cột phi-XP (xem _shared).
  const cols = filterStateInput(bodyOf(req));
  const fields = Object.keys(cols);
  if (fields.length) {
    const sets = fields.map((c) => `\`${c}\` = ?`).join(', ');
    const vals = fields.map((c) => cols[c]);
    await execute(
      `INSERT INTO \`student_states\` (\`student_id\`, ${fields.map((c) => `\`${c}\``).join(', ')}) ` +
        `VALUES (?, ${fields.map(() => '?').join(', ')}) ` +
        `ON DUPLICATE KEY UPDATE ${sets}`,
      [studentId, ...vals, ...vals]
    );
  } else {
    // Không có trường hợp lệ vẫn đảm bảo dòng state tồn tại.
    await execute(
      'INSERT IGNORE INTO `student_states` (`student_id`) VALUES (?)',
      [studentId]
    );
  }
  res.json(await readState(db, studentId));
}));

attemptsRouter.post(
  '/student-states/:studentId/check-in',
  requireRole('student'),
  async (req: AuthedRequest, res) => {
    const caller = req.caller!;
    const studentId = req.params.studentId;
    if (!checkKeyLen(res, studentId) || !rejectSentinel(res, studentId)) return;
    // Học sinh chỉ điểm danh cho chính mình.
    if (caller.studentId !== studentId) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
    if (!(await findStudent(db, studentId))) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    const today = vnToday();
    const out = await withTransaction(async (tx: Db) => {
      const rows = await tx.query<any>(
        'SELECT `last_attendance_date` FROM `student_states` WHERE `student_id` = ? LIMIT 1',
        [studentId]
      );
      const rawLast = rows[0]?.last_attendance_date;
      // mysql2 trả TIMESTAMP/DATE dạng Date (hoặc chuỗi DATETIME):
      // so sánh thô với 'YYYY-MM-DD' luôn sai → alreadyCheckedIn
      // không bao giờ true (bug GĐ4 2026-10-27: XP thì không cộng
      // trùng nhờ khóa xp_logs, nhưng cờ already thì sai).
      const lastStr =
        rawLast instanceof Date
          ? rawLast.toISOString().slice(0, 10)
          : String(rawLast || '').slice(0, 10);
      const already = !!rawLast && lastStr === today;
      // awardCheckIn tự chống cộng trùng theo ngày (khóa xp_logs
      // `checkin:<ngày>`) và tự cập nhật last_attendance_date,
      // attendance_days_this_week (reset khi sang tuần rồi +1),
      // attendance_history — route KHÔNG ghi đè lại các trường này
      // (ghi đè từ dòng đọc trước award sẽ phá reset tuần của xp.ts).
      const awarded: any = await awardCheckIn(tx, studentId, today);
      // Huy hiệu streak (luật App gốc): 3 ngày -> badge_streak_3,
      // 5 ngày -> badge_streak_full — chỉ xp.ts không lo phần này.
      const post = await tx.query<any>(
        'SELECT `attendance_days_this_week`, `unlocked_badge_ids` FROM `student_states` WHERE `student_id` = ? LIMIT 1',
        [studentId]
      );
      const nextDays = post[0]?.attendance_days_this_week ?? 0;
      const badges: string[] = parseJson(post[0]?.unlocked_badge_ids, []);
      let changed = false;
      if (nextDays >= 3 && !badges.includes('badge_streak_3')) {
        badges.push('badge_streak_3');
        changed = true;
      }
      if (nextDays >= 5 && !badges.includes('badge_streak_full')) {
        badges.push('badge_streak_full');
        changed = true;
      }
      if (changed) {
        await tx.execute(
          'UPDATE `student_states` SET `unlocked_badge_ids` = ? WHERE `student_id` = ?',
          [JSON.stringify(badges), studentId]
        );
      }
      return {
        checkedIn: awarded.awarded > 0,
        alreadyCheckedIn: !!already && awarded.awarded === 0,
        attendanceDays: nextDays,
        totals: { totalXp: awarded.totalXp, xpWeek: awarded.xpWeek, xpToday: awarded.xpToday },
      };
    });
    res.json({
      checkedIn: out.checkedIn,
      alreadyCheckedIn: out.alreadyCheckedIn,
      attendanceDays: out.attendanceDays,
      totalXp: (out.totals as any)?.totalXp,
      xpWeek: (out.totals as any)?.xpWeek,
      xpToday: (out.totals as any)?.xpToday,
    });
  }
);

// ---------------------------------------------------------------- attempts
attemptsRouter.post('/attempts', requireRole('student'), ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const body = bodyOf(req);
  // student_id ÉP từ JWT, bỏ qua giá trị client gửi.
  const studentId = caller.studentId;
  if (!studentId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const assignmentId = body.assignment_id || body.assignmentId || null;
  const activityId = body.learning_activity_id || body.learningActivityId || null;
  // CHECK attempts_exactly_one_source: đúng 1 nguồn.
  if ((!assignmentId) === (!activityId)) {
    httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  if (assignmentId && (!checkKeyLen(res, assignmentId) || !rejectSentinel(res, assignmentId))) return;
  if (activityId && (!checkKeyLen(res, activityId) || !rejectSentinel(res, activityId))) return;
  const responses = body.responses || {};
  if (typeof responses !== 'object' || Array.isArray(responses)) {
    httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  const startedAt = typeof body.started_at === 'string' ? body.started_at : body.startedAt || null;
  const student = await findStudent(db, studentId);
  if (!student) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }

  // Câu hỏi của nguồn + XP bài (assignment) — giữ đúng submitAssignmentAttempt.
  let qIds: string[] = [];
  let xpReward = 0;
  if (assignmentId) {
    const asgRows = await query<any>(
      'SELECT `id`, `xp_reward`, `published_at`, `target_class_id` FROM `assignments` WHERE `id` = ? LIMIT 1',
      [assignmentId]
    );
    const asg = asgRows[0];
    if (!asg || !asg.published_at) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    // Chỉ nộp bài đã giao cho em (có target) hoặc giao cho cả lớp em.
    const tgtRows = await query<any>(
      'SELECT `target_id` FROM `assignment_targets` WHERE `assignment_id` = ? AND `student_id` = ? LIMIT 1',
      [assignmentId, studentId]
    );
    if (!tgtRows.length && asg.target_class_id !== student.class_id) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
    xpReward = toNum(asg.xp_reward, 0);
    const links = await query<any>(
      'SELECT `question_id` FROM `assignment_questions` WHERE `assignment_id` = ? ORDER BY `position` ASC',
      [assignmentId]
    );
    qIds = links.map((r: any) => r.question_id);
  } else {
    const actRows = await query<any>(
      'SELECT `id` FROM `learning_activities` WHERE `id` = ? LIMIT 1',
      [activityId]
    );
    if (!actRows.length) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    const links = await query<any>(
      'SELECT `question_id` FROM `activity_questions` WHERE `activity_id` = ? ORDER BY `position` ASC',
      [activityId]
    );
    qIds = links.map((r: any) => r.question_id);
  }

  const result = await withTransaction(async (tx: Db) => {
    const qRows = qIds.length
      ? await tx.query<any>(
          'SELECT `id`, `type`, `correct_answer`, `max_score`, `payload`, `grading_method`, `topic_id`, `level` ' +
            'FROM `questions` WHERE `id` IN (' + qIds.map(() => '?').join(',') + ')',
          qIds
        )
      : [];
    const qMap = new Map(qRows.map((q: any) => [q.id, q]));
    const countRows = await tx.query<any>(
      'SELECT COUNT(*) AS c FROM `attempts` WHERE ' +
        (assignmentId ? '`assignment_id` = ?' : '`learning_activity_id` = ?') +
        ' AND `student_id` = ?',
      [assignmentId || activityId, studentId]
    );
    const attemptId = genId('att_');
    const nowIso = new Date().toISOString();
    const totalSeconds = startedAt
      ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
      : 0;
    let autoScore = 0;
    let maxTotal = 0;
    let pendingCount = 0;
    let gradedCount = 0;
    const answerRows: any[] = [];
    const pendingAnswerIds: string[] = [];
    const qResults: any[] = [];
    for (const qid of qIds) {
      const q: any = qMap.get(qid);
      if (!q) continue;
      const payload: any = parseJson<any>(q.payload, {});
      const max = q.max_score ?? (typeof payload.points === 'number' ? payload.points : 10);
      maxTotal += max;
      const resp = responses[qid] || {};
      const qtype = normalizeQType(q.type || payload.type);
      const responseJson =
        qtype === 'single_choice' || qtype === 'multiple_choice'
          ? { selected: qtype === 'single_choice' ? (resp.selected || [])[0] || null : resp.selected || [] }
          : qtype === 'fill_in_blank' && Array.isArray((resp as any).blanks)
            ? { blanks: (resp as any).blanks }
            : { text: resp.text || '' };
      const key = q.correct_answer != null ? parseJson(q.correct_answer, q.correct_answer) : payload.answer ?? null;
      // Luật chấm (chủ dự án 28/10): chỉ tự luận mới cần cô giáo chấm; câu
      // có đáp án sẵn thì tự chấm theo đáp án. grading_method NULL (câu tạo
      // từ trình soạn không gửi trường này) được hiểu là AUTO với câu không
      // phải tự luận; chỉ khi đặt tường minh TEACHER mới chờ chấm tay.
      const method = q.grading_method || 'AUTO';
      const isAuto = method === 'AUTO' && key != null && qtype !== 'essay';
      let isCorrect: boolean | null = null;
      let score: number | null = null;
      let ratio = 0;
      let gStatus = 'PENDING_TEACHER_REVIEW';
      if (isAuto) {
        // Điền trống chấm RIÊNG (28/10): từng ô, điểm từng phần, so sánh
        // thoáng (không dấu/dấu câu); câu cũ gửi 1 chuỗi text thì coi như
        // 1 ô. Câu không có đáp án nào để chấm thì chờ cô giáo chấm thay
        // vì chấm 0 oan.
        let handled = false;
        if (qtype === 'single_choice') {
          isCorrect = normText((resp.selected || [])[0] || '') === normText(String(key));
        } else if (qtype === 'multiple_choice') {
          const mine = new Set<string>((resp.selected || []).map((s: string) => normText(s)));
          const keys = new Set((Array.isArray(key) ? key : [key]).map((s: any) => normText(String(s))));
          isCorrect = mine.size === keys.size && [...mine].every((s) => keys.has(s));
        } else if (qtype === 'fill_in_blank') {
          handled = true;
          const student = Array.isArray((resp as any).blanks)
            ? (resp as any).blanks
            : resp.text != null && resp.text !== ''
              ? [resp.text]
              : [];
          const g = gradeFillBlanks(key, student);
          if (g.gradeable === 0) {
            pendingCount += 1;
          } else {
            isCorrect = g.isCorrect;
            ratio = g.scoreRatio;
            score = g.scoreRatio * max;
            autoScore += score;
            gStatus = 'GRADED';
            gradedCount += 1;
          }
        } else {
          const accepted = (Array.isArray(key) ? key : [key]).map((s: any) => normText(String(s)));
          isCorrect = accepted.includes(normText(resp.text || ''));
        }
        if (!handled) {
          score = isCorrect ? max : 0;
          ratio = isCorrect ? 1 : 0;
          autoScore += score ?? 0;
          gStatus = 'GRADED';
          gradedCount += 1;
        }
      } else {
        pendingCount += 1;
      }
      const ansId = genId('ans_');
      if (gStatus === 'PENDING_TEACHER_REVIEW') pendingAnswerIds.push(ansId);
      answerRows.push({
        answer_id: ansId,
        attempt_id: attemptId,
        question_id: qid,
        response_json: JSON.stringify(responseJson),
        is_correct: isCorrect == null ? null : isCorrect ? 1 : 0,
        score_awarded: score,
        max_score: max,
        grading_status: gStatus,
        grading_method: q.grading_method || (qtype === 'essay' ? 'TEACHER' : 'AUTO'),
      });
      qResults.push({
        questionId: qid,
        level: q.level || 'VAN_DUNG',
        isCorrect: gStatus === 'GRADED' ? !!isCorrect : score != null ? score / max >= 1 : false,
        scoreRatio: gStatus === 'GRADED' ? ratio : 0,
        timestamp: Date.now(),
        topicId: q.topic_id || null,
      });
    }
    const gradingStatus = pendingCount === 0 ? 'GRADED' : gradedCount === 0 ? 'PENDING_TEACHER_REVIEW' : 'PARTIALLY_GRADED';
    await tx.execute(
      'INSERT INTO `attempts` (`attempt_id`, `student_id`, `assignment_id`, `learning_activity_id`, `attempt_no`, `status`, ' +
        '`started_at`, `submitted_at`, `submitted_date`, `total_time_seconds`, `score_awarded`, `max_score`, `grading_status`, `grading_mode`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?)',
      [
        attemptId,
        studentId,
        assignmentId || null,
        activityId || null,
        toNum(countRows[0]?.c, 0) + 1,
        'SUBMITTED',
        toMySQLDatetime(startedAt),
        vnToday(),
        totalSeconds,
        gradedCount > 0 ? autoScore : null,
        maxTotal,
        gradingStatus,
        pendingCount === 0 ? 'AUTO' : gradedCount === 0 ? 'TEACHER' : 'MIXED',
      ]
    );
    for (const a of answerRows) {
      await tx.execute(
        'INSERT INTO `attempt_answers` (`answer_id`, `attempt_id`, `question_id`, `response_json`, `is_correct`, `score_awarded`, `max_score`, `grading_status`, `grading_method`) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [a.answer_id, a.attempt_id, a.question_id, a.response_json, a.is_correct, a.score_awarded, a.max_score, a.grading_status, a.grading_method]
      );
    }
    for (const aid of pendingAnswerIds) {
      await tx.execute(
        'INSERT INTO `answer_reviews` (`review_id`, `answer_id`, `reviewer_id`, `review_status`) VALUES (?, ?, NULL, ?)',
        [genId('rev_'), aid, 'PENDING']
      );
    }
    if (assignmentId) {
      const tgt = await tx.query<any>(
        'SELECT `target_id`, `first_submitted_at` FROM `assignment_targets` WHERE `assignment_id` = ? AND `student_id` = ? LIMIT 1',
        [assignmentId, studentId]
      );
      if (tgt[0]) {
        await tx.execute(
          'UPDATE `assignment_targets` SET `submission_status` = ?, `first_submitted_at` = ? WHERE `target_id` = ?',
          ['SUBMITTED', tgt[0].first_submitted_at || toMySQLDatetime(nowIso), tgt[0].target_id]
        );
      }
    }
    // Ghi kết quả câu hỏi vào state (phục vụ mastery + kiểm tra hoàn thành
    // chủ đề) — XP thì KHÔNG ghi tay, chỉ qua awardSubmission dưới đây.
    const stRows = await tx.query<any>(
      'SELECT `question_results` FROM `student_states` WHERE `student_id` = ? LIMIT 1',
      [studentId]
    );
    const curResults: any[] = parseJson(stRows[0]?.question_results, []);
    await tx.execute(
      'INSERT INTO `student_states` (`student_id`, `question_results`) VALUES (?, ?) ' +
        'ON DUPLICATE KEY UPDATE `question_results` = VALUES(`question_results`)',
      [studentId, JSON.stringify([...qResults, ...curResults])]
    );
    // XP nộp bài: không phụ thuộc đúng/sai; GIỮ HÀNH VI CLIENT CŨ —
    // chỉ trả lần nộp ĐẦU cho mỗi bài (key assignment:<id>:submitted),
    // làm lại không trả thêm (chống farm XP). countRows đếm attempt
    // TRƯỚC khi insert nên = 0 đúng khi đây là lần đầu. Key
    // submission:<attemptId> của xp.ts chỉ chống retry trùng attempt.
    const priorCount = toNum(countRows[0]?.c, 0);
    if (assignmentId && xpReward > 0 && priorCount === 0) {
      await awardSubmission(tx, studentId, attemptId, xpReward);
    }
    const totals: any = await getTotals(tx, studentId);
    return {
      attemptId,
      autoScore,
      maxScore: maxTotal,
      pendingCount,
      gradedCount,
      totals,
    };
  });
  res.status(201).json({
    attemptId: result.attemptId,
    autoScore: result.autoScore,
    maxScore: result.maxScore,
    pendingCount: result.pendingCount,
    gradedCount: result.gradedCount,
    totalXp: (result.totals as any)?.totalXp,
    xpWeek: (result.totals as any)?.xpWeek,
    xpToday: (result.totals as any)?.xpToday,
  });
}));

/**
 * XP bài quiz nội dung (GĐ3 tích hợp — khôi phục hành vi App cũ mà
 * POST /attempts không phủ được vì CHECK attempts_exactly_one_source
 * chỉ cho assignment/activity, không có nguồn quiz).
 * - Học sinh chỉ nộp cho chính mình; quiz phải published, topic phải
 *   published và đúng lớp (class_ids chứa lớp em hoặc 'all').
 * - XP = điểm bài làm (earned, QuizRunner chấm local như cũ) — server
 *   CHẶN TRÊN bằng tổng max_score các câu của quiz trong DB (chống
 *   client khai điểm vô hạn); floor về số nguyên như awardXP cũ.
 * - Chỉ trả 1 lần/quiz (key quiz:<id>); điểm 0 không tiêu khóa (đúng
 *   App cũ: xpEarned = 0 thì không gọi awardXP, làm lại vẫn được trả).
 * - Đồng thời ghi bước quiz_completed:<id> vào completed_steps để
 *   /topics/:id/complete và dải luồng nhận biết (merge, không ghi đè).
 */
attemptsRouter.post('/quiz-completions', requireRole('student'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const studentId = caller.studentId;
  if (!studentId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const body = bodyOf(req);
  const quizId = body.quizId || body.quiz_id;
  if (!quizId || !checkKeyLen(res, quizId) || !rejectSentinel(res, quizId)) {
    if (!quizId) httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  const student = await findStudent(db, studentId);
  if (!student) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  const qRows = await query<any>(
    'SELECT `id`, `topic_id`, `status`, `payload`, `deleted_at` FROM `quizzes` WHERE `id` = ? LIMIT 1',
    [quizId]
  );
  const quiz = qRows[0];
  if (!quiz || quiz.deleted_at) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (quiz.status !== 'published') {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const qPayload: any = parseJson<any>(quiz.payload, {});
  const topicId = quiz.topic_id || qPayload.topicId || '';
  const tRows = topicId
    ? await query<any>('SELECT `id`, `status`, `video_payload`, `deleted_at` FROM `topics` WHERE `id` = ? LIMIT 1', [topicId])
    : [];
  const topic = tRows[0];
  if (!topic || topic.deleted_at || topic.status !== 'published') {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const tPayload: any = parseJson<any>(topic.video_payload, {});
  const classIds: string[] = Array.isArray(tPayload.class_ids) ? tPayload.class_ids : ['all'];
  if (!classIds.includes('all') && !classIds.includes(student.class_id)) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  // Chặn trên điểm: tổng max_score câu hỏi của quiz (mặc định 10/câu).
  const qIds: string[] = Array.isArray(qPayload.questionIds) ? qPayload.questionIds : [];
  let cap = qIds.length * 10;
  if (qIds.length) {
    const qq = await query<any>(
      `SELECT \`max_score\` FROM \`questions\` WHERE \`id\` IN (${qIds.map(() => '?').join(',')})`,
      qIds
    );
    if (qq.length) {
      cap = 0;
      for (const r of qq) cap += toNum(r.max_score, 10);
      if (cap <= 0) cap = qIds.length * 10;
    }
  }
  const earned = Math.max(0, Math.min(toNum(body.earned, 0), cap));
  const out: any = await withTransaction(async (tx: Db) => {
    const awarded: any = await awardQuizCompletion(tx, studentId, quizId, earned);
    const cur = await tx.query<any>(
      'SELECT `completed_steps` FROM `student_states` WHERE `student_id` = ? LIMIT 1',
      [studentId]
    );
    const curSteps: string[] = parseJson(cur[0]?.completed_steps, []);
    const marker = `quiz_completed:${quizId}`;
    if (!curSteps.includes(marker)) {
      await tx.execute(
        'INSERT INTO `student_states` (`student_id`, `completed_steps`) VALUES (?, ?) ' +
          'ON DUPLICATE KEY UPDATE `completed_steps` = VALUES(`completed_steps`)',
        [studentId, JSON.stringify([...curSteps, marker])]
      );
    }
    return awarded;
  });
  res.status(201).json({ awarded: out.awarded > 0, awardedXp: out.awarded, totalXp: out.totalXp });
});

attemptsRouter.get('/attempts/:id', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const attemptId = req.params.id;
  if (!checkKeyLen(res, attemptId)) return;
  const rows = await query<any>(
    'SELECT * FROM `attempts` WHERE `attempt_id` = ? LIMIT 1',
    [attemptId]
  );
  const att = rows[0];
  if (!att) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isStudent(caller)) {
    if (caller.studentId !== att.student_id) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
  } else if (isTeacher(caller)) {
    if (!(await canAccessStudent(db, caller, att.student_id))) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
  }
  const answers = await query<any>(
    'SELECT * FROM `attempt_answers` WHERE `attempt_id` = ?',
    [attemptId]
  );
  res.json({
    ...att,
    answers: answers.map((a: any) => ({ ...a, response_json: parseJson(a.response_json, null) })),
  });
});

// ---------------------------------------------------------------- assignments
async function assignmentEditShape(conn: Db, id: string): Promise<any | null> {
  const rows = await conn.query<any>('SELECT * FROM `assignments` WHERE `id` = ? LIMIT 1', [id]);
  const a = rows[0];
  if (!a) return null;
  const aqs = await conn.query<any>(
    'SELECT `question_id` FROM `assignment_questions` WHERE `assignment_id` = ? ORDER BY `position` ASC',
    [id]
  );
  const targets = await conn.query<any>(
    'SELECT `student_id` FROM `assignment_targets` WHERE `assignment_id` = ?',
    [id]
  );
  return {
    id: a.id,
    title: a.title,
    activityType: a.activity_type,
    displayLocation: a.display_location,
    classId: a.target_class_id,
    dueAt: a.due_at,
    isTimed: !!a.is_timed,
    timeLimitMinutes: a.time_limit_minutes,
    xpReward: a.xp_reward ?? 0,
    published: !!a.published_at,
    publishedAt: a.published_at,
    questionIds: aqs.map((r: any) => r.question_id),
    studentIds: targets.map((r: any) => r.student_id),
    createdAt: a.created_at,
  };
}

attemptsRouter.post('/assignments', requireRole('teacher', 'admin'), ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const body = bodyOf(req);
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Bài kiểm tra mới';
  const classId = body.classId || body.target_class_id || body.class_id || null;
  if (classId && (!checkKeyLen(res, classId) || !rejectSentinel(res, classId))) return;
  const teacherId = isTeacher(caller) ? caller.teacherId : body.teacher_id || body.teacherId || caller.teacherId || null;
  if (isTeacher(caller)) {
    if (!teacherId) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
    if (classId) {
      const classIds = await teacherClassIds(db, teacherId);
      if (!classIds.includes(classId)) {
        httpErr(res, 403, 'CLASS_NOT_OWNED');
        return;
      }
    }
  }
  const questionIds: string[] = Array.isArray(body.questionIds) ? body.questionIds : Array.isArray(body.question_ids) ? body.question_ids : [];
  const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds : Array.isArray(body.student_ids) ? body.student_ids : [];
  for (const qid of questionIds) if (!checkKeyLen(res, qid)) return;
  for (const sid of studentIds) if (!checkKeyLen(res, sid) || !rejectSentinel(res, sid)) return;
  if (isTeacher(caller)) {
    // Đối tượng giao phải thuộc lớp mình.
    for (const sid of studentIds) {
      if (!(await canAccessStudent(db, caller, sid))) {
        httpErr(res, 403, 'CLASS_NOT_OWNED');
        return;
      }
    }
  }
  const id = typeof body.id === 'string' && body.id ? body.id : genId('asg_');
  if (!checkKeyLen(res, id)) return;
  const dueAt = toMySQLDatetime(body.dueAt || body.due_at || null);
  const isTimed = !!body.isTimed;
  const publish = body.publish === true;
  await withTransaction(async (tx: Db) => {
    await tx.execute(
      'INSERT INTO `assignments` (`id`, `title`, `activity_type`, `display_location`, `target_class_id`, `teacher_id`, `published_at`, `due_at`, `is_timed`, `time_limit_minutes`, `xp_reward`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        title,
        body.activityType || body.activity_type || 'ASSIGNMENT',
        body.displayLocation || body.display_location || 'HOMEWORK',
        classId,
        teacherId,
        publish ? toMySQLDatetime(new Date()) : null,
        dueAt,
        isTimed ? 1 : 0,
        isTimed ? toNum(body.timeLimitMinutes ?? body.time_limit_minutes, null as any) || null : null,
        Math.max(0, Math.floor(toNum(body.xpReward ?? body.xp_reward, 0))),
      ]
    );
    for (let i = 0; i < questionIds.length; i++) {
      await tx.execute(
        'INSERT INTO `assignment_questions` (`assignment_id`, `question_id`, `position`) VALUES (?, ?, ?)',
        [id, questionIds[i], i + 1]
      );
    }
    for (const sid of studentIds) {
      await tx.execute(
        'INSERT INTO `assignment_targets` (`target_id`, `assignment_id`, `student_id`, `assigned_at`, `due_at`, `submission_status`) VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?)',
        [genId('tgt_') + sid.slice(0, 4), id, sid, dueAt, 'NOT_SUBMITTED']
      );
    }
  });
  const created = await assignmentEditShape(db, id);
  res.status(201).json(created);
}));

attemptsRouter.get('/assignments', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const teacherId = isTeacher(caller) ? caller.teacherId : (req.query.teacher_id as string) || null;
  const rows = teacherId
    ? await query<any>(
        'SELECT * FROM `assignments` WHERE `teacher_id` = ? ORDER BY `created_at` ASC',
        [teacherId]
      )
    : await query<any>('SELECT * FROM `assignments` ORDER BY `created_at` ASC');
  if (!rows.length) {
    res.json([]);
    return;
  }
  const ids = rows.map((a: any) => a.id);
  const inList = ids.map(() => '?').join(',');
  const aqs = await query<any>(
    `SELECT \`assignment_id\` FROM \`assignment_questions\` WHERE \`assignment_id\` IN (${inList})`,
    ids
  );
  const targets = await query<any>(
    `SELECT \`assignment_id\`, \`submission_status\` FROM \`assignment_targets\` WHERE \`assignment_id\` IN (${inList})`,
    ids
  );
  const qCount = new Map<string, number>();
  for (const r of aqs) qCount.set(r.assignment_id, (qCount.get(r.assignment_id) || 0) + 1);
  const tCount = new Map<string, number>();
  const sCount = new Map<string, number>();
  for (const t of targets) {
    tCount.set(t.assignment_id, (tCount.get(t.assignment_id) || 0) + 1);
    if (t.submission_status === 'SUBMITTED') sCount.set(t.assignment_id, (sCount.get(t.assignment_id) || 0) + 1);
  }
  res.json(
    rows.map((a: any) => ({
      id: a.id,
      title: a.title,
      published: !!a.published_at,
      dueAt: a.due_at,
      isTimed: !!a.is_timed,
      timeLimitMinutes: a.time_limit_minutes,
      xpReward: a.xp_reward ?? 0,
      questionCount: qCount.get(a.id) || 0,
      targetCount: tCount.get(a.id) || 0,
      submittedCount: sCount.get(a.id) || 0,
      createdAt: a.created_at,
    }))
  );
});

attemptsRouter.get('/student-assignments', requireRole('student'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const studentId = caller.studentId;
  if (!studentId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const targets = await query<any>(
    'SELECT * FROM `assignment_targets` WHERE `student_id` = ?',
    [studentId]
  );
  if (!targets.length) {
    res.json([]);
    return;
  }
  const asgIds = [...new Set(targets.map((t: any) => t.assignment_id))];
  const inList = asgIds.map(() => '?').join(',');
  const asgs = await query<any>(
    `SELECT * FROM \`assignments\` WHERE \`id\` IN (${inList})`,
    asgIds
  );
  const atts = await query<any>(
    `SELECT \`assignment_id\`, \`attempt_no\`, \`score_awarded\`, \`max_score\`, \`grading_status\`, \`submitted_at\` FROM \`attempts\` WHERE \`student_id\` = ? AND \`assignment_id\` IN (${inList}) ORDER BY \`submitted_at\` DESC`,
    [studentId, ...asgIds]
  );
  const aqs = await query<any>(
    `SELECT \`assignment_id\` FROM \`assignment_questions\` WHERE \`assignment_id\` IN (${inList})`,
    asgIds
  );
  const qCount = new Map<string, number>();
  for (const r of aqs) qCount.set(r.assignment_id, (qCount.get(r.assignment_id) || 0) + 1);
  const asgMap = new Map(asgs.map((a: any) => [a.id, a]));
  // Học sinh chỉ thấy bài ĐÃ GIAO (có published_at) — bản nháp không lộ.
  res.json(
    targets
      .filter((t: any) => (asgMap.get(t.assignment_id) as any)?.published_at)
      .map((t: any) => {
        const a: any = asgMap.get(t.assignment_id) || {};
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
          attempts: atts.filter((x: any) => x.assignment_id === t.assignment_id),
        };
      })
  );
});

attemptsRouter.get('/assignments/:id', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  if (!checkKeyLen(res, id)) return;
  const rows = await query<any>('SELECT * FROM `assignments` WHERE `id` = ? LIMIT 1', [id]);
  const a = rows[0];
  if (!a) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isStudent(caller)) {
    // Học sinh: chỉ bài đã xuất bản + đã giao cho em (đề bài, KHÔNG đáp án).
    if (!a.published_at) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    const tgt = await query<any>(
      'SELECT `target_id` FROM `assignment_targets` WHERE `assignment_id` = ? AND `student_id` = ? LIMIT 1',
      [id, caller.studentId]
    );
    if (!tgt.length && a.target_class_id !== caller.classId) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
    const links = await query<any>(
      'SELECT `question_id`, `position` FROM `assignment_questions` WHERE `assignment_id` = ? ORDER BY `position` ASC',
      [id]
    );
    const qIds = links.map((r: any) => r.question_id);
    const qs = qIds.length
      ? await query<any>(
          `SELECT \`id\`, \`payload\` FROM \`questions\` WHERE \`id\` IN (${qIds.map(() => '?').join(',')})`,
          qIds
        )
      : [];
    const qMap = new Map(qs.map((q: any) => [q.id, parseJson<any>(q.payload, {})]));
    res.json({
      id: a.id,
      title: a.title,
      isTimed: !!a.is_timed,
      timeLimitMinutes: a.time_limit_minutes,
      xpReward: a.xp_reward ?? 0,
      dueAt: a.due_at,
      questions: qIds.map((qid: string) => {
        const p: any = qMap.get(qid) || {};
        const qType = normalizeQType(p.type);
        // 28/10: đoạn trích của câu điền từ mà chứa đáp án thì học sinh
        // nhìn đoạn trích là thấy đáp án — ẩn đoạn trích (đề bài đã đủ
        // ngữ cảnh với các ô ___). Chỉ áp dụng cho đề giao học sinh;
        // màn duyệt/ngân hàng của giáo viên vẫn giữ đủ đoạn trích.
        let passage = p.passage || null;
        if (qType === 'fill_in_blank' && passage && passageLeaksAnswer(passage, p.answer)) {
          passage = null;
        }
        return {
          id: qid,
          prompt: p.prompt || qid,
          passage,
          type: qType,
          options: Array.isArray(p.options) ? p.options : [],
          points: typeof p.points === 'number' ? p.points : 10,
        };
      }),
    });
    return;
  }
  if (isTeacher(caller)) {
    if (a.teacher_id !== caller.teacherId) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
  }
  res.json(await assignmentEditShape(db, id));
});

attemptsRouter.patch('/assignments/:id', requireRole('teacher', 'admin'), ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  if (!checkKeyLen(res, id)) return;
  const rows = await query<any>('SELECT * FROM `assignments` WHERE `id` = ? LIMIT 1', [id]);
  const a = rows[0];
  if (!a) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isTeacher(caller) && a.teacher_id !== caller.teacherId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const body = bodyOf(req);
  const classId = body.classId ?? body.target_class_id ?? body.class_id ?? a.target_class_id;
  if (isTeacher(caller) && classId && classId !== a.target_class_id) {
    const classIds = await teacherClassIds(db, caller.teacherId!);
    if (!classIds.includes(classId)) {
      httpErr(res, 403, 'CLASS_NOT_OWNED');
      return;
    }
  }
  const nowIso = new Date().toISOString();
  await withTransaction(async (tx: Db) => {
    const dueAt = toMySQLDatetime(body.dueAt ?? body.due_at ?? a.due_at);
    const isTimed = body.isTimed ?? !!a.is_timed;
    // Giữ đúng updateAssignment: publish thì giữ published_at cũ hoặc đặt
    // mới; không publish thì published_at giữ nguyên (không unpublish ở đây).
    const publishedAt = body.publish === true ? a.published_at || toMySQLDatetime(nowIso) : a.published_at;
    await tx.execute(
      'UPDATE `assignments` SET `title` = ?, `target_class_id` = ?, `due_at` = ?, `is_timed` = ?, `time_limit_minutes` = ?, `xp_reward` = ?, `published_at` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?',
      [
        body.title ?? a.title,
        classId,
        dueAt,
        isTimed ? 1 : 0,
        isTimed ? toNum(body.timeLimitMinutes ?? body.time_limit_minutes ?? a.time_limit_minutes, null as any) || null : null,
        Math.max(0, Math.floor(toNum(body.xpReward ?? body.xp_reward ?? a.xp_reward, 0))),
        publishedAt,
        id,
      ]
    );
    const questionIds: string[] | null = Array.isArray(body.questionIds)
      ? body.questionIds
      : Array.isArray(body.question_ids)
        ? body.question_ids
        : null;
    if (questionIds) {
      await tx.execute('DELETE FROM `assignment_questions` WHERE `assignment_id` = ?', [id]);
      for (let i = 0; i < questionIds.length; i++) {
        await tx.execute(
          'INSERT INTO `assignment_questions` (`assignment_id`, `question_id`, `position`) VALUES (?, ?, ?)',
          [id, questionIds[i], i + 1]
        );
      }
    }
    const studentIds: string[] | null = Array.isArray(body.studentIds)
      ? body.studentIds
      : Array.isArray(body.student_ids)
        ? body.student_ids
        : null;
    if (studentIds) {
      const existing = await tx.query<any>(
        'SELECT `target_id`, `student_id` FROM `assignment_targets` WHERE `assignment_id` = ?',
        [id]
      );
      const existingIds = new Set(existing.map((t: any) => t.student_id));
      const wanted = new Set(studentIds);
      for (const sid of studentIds) {
        if (!existingIds.has(sid)) {
          await tx.execute(
            'INSERT INTO `assignment_targets` (`target_id`, `assignment_id`, `student_id`, `assigned_at`, `due_at`, `submission_status`) VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?)',
            [genId('tgt_') + sid.slice(0, 4), id, sid, dueAt, 'NOT_SUBMITTED']
          );
        }
      }
      const extras = existing.filter((t: any) => !wanted.has(t.student_id));
      if (extras.length) {
        // Học sinh đã có lượt làm thì KHÔNG bị gỡ khỏi danh sách giao.
        const attRows = await tx.query<any>(
          `SELECT \`student_id\` FROM \`attempts\` WHERE \`assignment_id\` = ? AND \`student_id\` IN (${extras.map(() => '?').join(',')})`,
          [id, ...extras.map((t: any) => t.student_id)]
        );
        const attempted = new Set(attRows.map((r: any) => r.student_id));
        for (const t of extras) {
          if (!attempted.has(t.student_id)) {
            await tx.execute('DELETE FROM `assignment_targets` WHERE `target_id` = ?', [t.target_id]);
          }
        }
      }
      await tx.execute('UPDATE `assignment_targets` SET `due_at` = ? WHERE `assignment_id` = ?', [dueAt, id]);
    }
  });
  res.json(await assignmentEditShape(db, id));
}));

attemptsRouter.delete('/assignments/:id', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  if (!checkKeyLen(res, id)) return;
  const rows = await query<any>('SELECT `teacher_id` FROM `assignments` WHERE `id` = ? LIMIT 1', [id]);
  const a = rows[0];
  if (!a) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isTeacher(caller) && a.teacher_id !== caller.teacherId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  // Đúng thứ tự deleteAssignmentCompletely: reviews -> answers -> attempts
  // -> targets -> questions -> assignment (FK đã cascade nhưng vẫn xóa tường minh).
  await withTransaction(async (tx: Db) => {
    const atts = await tx.query<any>('SELECT `attempt_id` FROM `attempts` WHERE `assignment_id` = ?', [id]);
    const attIds = atts.map((r: any) => r.attempt_id);
    if (attIds.length) {
      const inList = attIds.map(() => '?').join(',');
      const answers = await tx.query<any>(
        `SELECT \`answer_id\` FROM \`attempt_answers\` WHERE \`attempt_id\` IN (${inList})`,
        attIds
      );
      const ansIds = answers.map((r: any) => r.answer_id);
      if (ansIds.length) {
        await tx.execute(
          `DELETE FROM \`answer_reviews\` WHERE \`answer_id\` IN (${ansIds.map(() => '?').join(',')})`,
          ansIds
        );
      }
      await tx.execute(`DELETE FROM \`attempt_answers\` WHERE \`attempt_id\` IN (${inList})`, attIds);
      await tx.execute(`DELETE FROM \`attempts\` WHERE \`attempt_id\` IN (${inList})`, attIds);
    }
    await tx.execute('DELETE FROM `assignment_targets` WHERE `assignment_id` = ?', [id]);
    await tx.execute('DELETE FROM `assignment_questions` WHERE `assignment_id` = ?', [id]);
    await tx.execute('DELETE FROM `assignments` WHERE `id` = ?', [id]);
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- topic complete
attemptsRouter.post('/topics/:id/complete', requireRole('student'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const topicId = req.params.id;
  if (!checkKeyLen(res, topicId) || !rejectSentinel(res, topicId)) return;
  const studentId = caller.studentId;
  if (!studentId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const student = await findStudent(db, studentId);
  if (!student) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  const topicRows = await query<any>('SELECT * FROM `topics` WHERE `id` = ? LIMIT 1', [topicId]);
  const topic = topicRows[0];
  if (!topic || topic.deleted_at) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (topic.status !== 'published') {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  // Đúng lớp: video_payload.class_ids chứa lớp em hoặc 'all' (filterContentItems).
  const vPayload: any = parseJson<any>(topic.video_payload, {});
  const classIds: string[] = Array.isArray(vPayload.class_ids) ? vPayload.class_ids : ['all'];
  if (!classIds.includes('all') && !classIds.includes(student.class_id)) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const xpReward = Math.max(0, Math.floor(toNum(vPayload.xpReward ?? vPayload.xp_reward, 0)));
  const videoIds: string[] = Array.isArray(vPayload.videoIds) ? vPayload.videoIds : [];
  const theoryId: string = (parseJson<any>(topic.theory_payload, {}).theoryId as string) || '';
  // Quiz của chủ đề: cột topic_id + fallback topicId trong payload JSON.
  const quizRows = await query<any>(
    'SELECT `id`, `status`, `payload` FROM `quizzes` WHERE `topic_id` = ? AND `deleted_at` IS NULL',
    [topicId]
  );
  const payloadQuizRows = await query<any>(
    'SELECT `id`, `status`, `payload` FROM `quizzes` WHERE `deleted_at` IS NULL AND JSON_EXTRACT(`payload`, "$.topicId") = ?',
    [JSON.stringify(topicId)]
  );
  const quizById = new Map<string, any>();
  for (const q of [...quizRows, ...payloadQuizRows]) quizById.set(q.id, q);
  const quizzes = [...quizById.values()].filter((q: any) => q.status === 'published');
  // LUẬT 29/10 (chủ dự án: "học xong là +XP"): luồng cô xếp (flowOrder) là
  // danh sách chính thức của chủ đề — chỉ tính đúng các mục trong đó.
  // Trước đây route còn bổ sung videoIds/theoryId/quiz ngoài luồng, nên
  // video đã xóa khỏi luồng nhưng còn sót id trong videoIds (vd
  // video_1793170144462 ở chủ đề "từ láy") chặn trao quỹ dù học sinh đã
  // 100% luồng và làm đúng hết — đúng ca Minh An gặp (tổng 3 XP, mất 50 XP).
  // Mục trong luồng được công nhận khi hàng còn tồn tại, chưa soft-delete
  // (quiz thêm điều kiện đã xuất bản, như filter ở trên). Chủ đề chưa xếp
  // luồng (flowOrder rỗng) giữ cách tính cũ (mọi mục hợp lệ).
  const flowOrder: string[] = Array.isArray(vPayload.flowOrder) ? vPayload.flowOrder : [];
  const valid = new Map<string, { type: string; id: string }>();
  for (const id of videoIds) valid.set(`video:${id}`, { type: 'video', id });
  if (theoryId) valid.set(`theory:${theoryId}`, { type: 'theory', id: theoryId });
  for (const q of quizzes) valid.set(`quiz:${q.id}`, { type: 'quiz', id: q.id });
  for (const key of flowOrder) {
    if (valid.has(key) || typeof key !== 'string') continue;
    const [kind, itemId] = key.split(':');
    if (!itemId) continue;
    const table = kind === 'video' ? 'video_lessons' : kind === 'theory' ? 'theory_lessons' : null;
    if (!table) continue;
    const rows = await query<any>(`SELECT \`id\` FROM \`${table}\` WHERE \`id\` = ? AND \`deleted_at\` IS NULL LIMIT 1`, [itemId]);
    if (rows[0]) valid.set(key, { type: kind, id: itemId });
  }
  const flow: { type: string; id: string }[] = [];
  const used = new Set<string>();
  for (const key of flowOrder) {
    const item = valid.get(key);
    if (item && !used.has(key)) {
      flow.push(item);
      used.add(key);
    }
  }
  if (flowOrder.length === 0) {
    for (const [key, item] of valid) {
      if (!used.has(key)) flow.push(item);
    }
  }
  if (flow.length === 0) {
    const totals0: any = await getTotals(db, studentId);
    res.json({ awarded: false, complete: false, totalXp: totals0?.totalXp, reason: 'EMPTY_TOPIC' });
    return;
  }

  const state = await readState(db, studentId);
  const steps = new Set<string>(state.completed_steps || []);
  const completeKey = `topic:${topicId}:complete`;
  if (steps.has(completeKey)) {
    res.json({ awarded: false, complete: true, totalXp: state.total_xp, alreadyAwarded: true });
    return;
  }
  // Câu trả lời đúng từ SERVER: attempt_answers của em (mọi lượt làm).
  const ansRows = await query<any>(
    'SELECT aa.`question_id`, aa.`is_correct`, aa.`score_awarded`, aa.`max_score` FROM `attempt_answers` aa ' +
      'JOIN `attempts` a ON a.`attempt_id` = aa.`attempt_id` WHERE a.`student_id` = ?',
    [studentId]
  );
  const correctByQ = new Set<string>();
  const answeredQ = new Set<string>();
  for (const r of ansRows) {
    answeredQ.add(r.question_id);
    if (r.is_correct === 1 || (r.score_awarded != null && r.max_score > 0 && Number(r.score_awarded) >= Number(r.max_score))) {
      correctByQ.add(r.question_id);
    }
  }
  // question_results trong state (do POST /attempts + chấm bài ghi) là
  // dữ liệu server, dùng làm nguồn phụ cho bài chỉ có tự luận.
  const stateResults: any[] = state.question_results || [];
  const stateCorrectQ = new Set<string>();
  const stateAnsweredQ = new Set<string>();
  for (const r of stateResults) {
    stateAnsweredQ.add(r.questionId);
    if (r.isCorrect || (r.scoreRatio ?? 0) >= 1) stateCorrectQ.add(r.questionId);
  }
  const missing: string[] = [];
  let complete = true;
  for (const item of flow) {
    if (item.type === 'video') {
      if (!steps.has(`video_flow_completed:${item.id}`)) {
        complete = false;
        missing.push(`video:${item.id}`);
      }
      continue;
    }
    if (item.type === 'theory') {
      if (!steps.has(`theory_flow_completed:${item.id}`)) {
        complete = false;
        missing.push(`theory:${item.id}`);
      }
      continue;
    }
    // Quiz: đúng hết câu chấm tự động (topicCompletion.isQuizAllCorrect);
    // câu tự luận KHÔNG chặn. Bài chỉ có tự luận: coi như đạt khi đã làm.
    const quiz = quizzes.find((q: any) => q.id === item.id);
    if (!quiz) {
      complete = false;
      missing.push(`quiz:${item.id}`);
      continue;
    }
    const qPayload: any = parseJson<any>(quiz.payload, {});
    const qIds: string[] = Array.isArray(qPayload.questionIds) ? qPayload.questionIds : [];
    const qRows = qIds.length
      ? await query<any>(
          `SELECT \`id\`, \`type\` FROM \`questions\` WHERE \`id\` IN (${qIds.map(() => '?').join(',')})`,
          qIds
        )
      : [];
    const autoIds = qRows
      .filter((q: any) => AUTO_Q_TYPES.has(String(q.type || '')))
      .map((q: any) => q.id);
    // Câu hỏi không có trong bảng questions: loại khỏi điều kiện auto
    // (không bịa) — nhưng vẫn cần dấu hiệu đã làm nếu bài chỉ có chúng.
    const knownIds = new Set(qRows.map((q: any) => q.id));
    const unknownIds = qIds.filter((id: string) => !knownIds.has(id));
    if (autoIds.length === 0) {
      const done = qIds.some(
        (qid: string) =>
          answeredQ.has(qid) || stateAnsweredQ.has(qid) || steps.has(`quiz_completed:${item.id}`)
      );
      if (!done) {
        complete = false;
        missing.push(`quiz:${item.id}`);
      }
    } else {
      const allCorrect = autoIds.every(
        (qid: string) => correctByQ.has(qid) || stateCorrectQ.has(qid)
      );
      if (!allCorrect) {
        complete = false;
        missing.push(`quiz:${item.id}`);
      }
    }
    void unknownIds;
  }
  if (!complete) {
    res.json({ awarded: false, complete: false, totalXp: state.total_xp, missing });
    return;
  }
  if (xpReward <= 0) {
    // Giữ đúng tryAwardTopicCompletion: quỹ = 0 thì không trao, không ghi bước.
    res.json({ awarded: false, complete: true, totalXp: state.total_xp });
    return;
  }
  // Chống cộng trùng 2 lớp: xp.ts chặn theo khóa xp_logs `topic:<id>`,
  // route ghi thêm bước `topic:<id>:complete` vào completed_steps để
  // lần gọi sau short-circuit (và để khớp khóa client cũ).
  const awarded = await withTransaction(async (tx: Db) => {
    const res2: any = await awardTopicCompletion(tx, studentId, topicId, xpReward);
    const cur = await tx.query<any>(
      'SELECT `completed_steps` FROM `student_states` WHERE `student_id` = ? LIMIT 1',
      [studentId]
    );
    const curSteps: string[] = parseJson(cur[0]?.completed_steps, []);
    if (!curSteps.includes(completeKey)) curSteps.push(completeKey);
    await tx.execute(
      'INSERT INTO `student_states` (`student_id`, `completed_steps`) VALUES (?, ?) ' +
        'ON DUPLICATE KEY UPDATE `completed_steps` = VALUES(`completed_steps`)',
      [studentId, JSON.stringify(curSteps)]
    );
    return { awarded: res2.awarded > 0, totalXp: res2.totalXp };
  });
  res.json({ awarded: awarded.awarded, complete: true, totalXp: awarded.totalXp });
});
