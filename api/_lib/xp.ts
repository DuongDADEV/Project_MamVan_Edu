import {
  isTxDb,
  parseJson,
  toJson,
  withTransaction,
  type Db,
} from './mysql.ts';

/**
 * GĐ3 — SERVER XP ENGINE. Quyết đã duyệt: XP tính ở server, client
 * không còn tự ghi số XP (đường PUT student-states của route khác
 * KHÔNG được ghi đè các cột xp_* — chỉ engine này mới cộng/trừ XP).
 *
 * Luật port từ code hiện tại (không đổi luật, chỉ đổi nơi tính):
 *  - Điểm danh: 1 lần/ngày VN, +XP theo cấu hình (xem attendanceXp()).
 *    Nguồn client cũ: getEffectiveXpConfig().ATTENDANCE_DAILY_XP
 *    (localStorage teacher + fallback XP_CONFIG.ATTENDANCE_DAILY_XP = 2).
 *    Server không đọc được localStorage nên đọc hàng 'default' của
 *    system_settings.xp_rules (DDL default: {"attendance": 2, ...} —
 *    trùng giá trị config hiện tại nên hành vi không đổi); thiếu hàng
 *    hoặc thiếu key → fallback 2. CHÚ Ý: các key còn lại của xp_rules
 *    (homework/video_watch/theory_read/...) là giá trị per-action
 *    LEGACY, đã bị mô hình XP 22/10 bãi bỏ — engine KHÔNG dùng chúng.
 *  - Nộp bài: trả đúng số XP route truyền vào (xp_reward của bài /
 *    quiz), không phụ thuộc đúng/sai — đúng App.tsx ("nộp bài là nhận
 *    đúng số XP đã cấu hình trên bài"). Idempotency theo attemptId.
 *  - Hoàn thành chủ đề: chỉ cộng 1 lần, số XP = quỹ topic.xpReward
 *    mà route truyền vào (topicCompletion.tryAwardTopicCompletion).
 *  - Đổi quà: trừ vào TỔNG XP vĩnh viễn (không trừ xp_today/xp_week),
 *    kiểm đủ điểm trong transaction, thiếu → throw Error('INSUFFICIENT_XP').
 *    Bị từ chối → hoàn 100% (refundGift).
 *
 * TRUNG THỰC VỀ COMPLETION (ghi rõ cho route worker): server cộng XP
 * hoàn thành chủ đề dựa trên SỰ KIỆN client báo ("bước đã xong") +
 * kiểm tra quyền sở hữu (bài/chủ đề thuộc giáo viên của học sinh) +
 * chống cộng trùng bằng key. Server KHÔNG thể xác minh tuyệt đối việc
 * xem video/đọc lý thuyết — vốn là tự báo cáo ngay cả ở client cũ
 * (completedSteps cũng do client ghi). Điều server khóa được là: số
 * XP không còn do client tự khai.
 *
 * IDEMPOTENCY: key nằm trong student_states.xp_logs (entry có thêm
 * trường `key`, client cũ đọc xpLogs sẽ bỏ qua trường thừa này):
 *   checkin:<YYYY-MM-DD VN> (map từ key client `attendance:<ngày>`)
 *   submission:<attemptId>   (client cũ: quiz:<id>:completed /
 *     assignment:<id>:submitted — server key theo attemptId, xem chú
 *     thích ở awardSubmission về khác biệt này)
 *   topic:<topicId>          (client cũ: topic:<id>:complete)
 *   gift:deduct:<requestId> / gift:refund:<requestId> (tách 2 chiều:
 *     nếu trừ và hoàn dùng chung 1 key thì hoàn sẽ bị chặn vì trùng
 *     key với lần trừ — bắt buộc tách hậu tố).
 * Kiểm tra key + ghi log + cộng điểm chạy trong CÙNG transaction,
 * trên dòng student_states đã SELECT ... FOR UPDATE, nên 2 request
 * song song không thể cộng trùng.
 *
 * xp_logs PHÍA SERVER KHÔNG CẮT 50 như client (client slice(0, 50)
 * để hiển thị): cắt log sẽ xóa key cũ và mở lại cửa cộng trùng cho
 * topic/attempt cũ. Log server giữ toàn bộ; mỗi entry ~150 byte nên
 * tăng trưởng không đáng kể với quy mô lớp học.
 *
 * NGÀY VN: tính bằng JS (Date.now() + 7h → YYYY-MM-DD), KHÔNG dùng
 * CONVERT_TZ vì MySQL VPS có thể thiếu bảng múi giờ. Timestamp trong
 * xp_logs là epoch ms UTC (như client); ngày VN của 1 entry suy ra
 * bằng vnTodayStr(new Date(timestamp)).
 *
 * CỘNG ĐIỂM: total_xp luôn tăng bằng UPDATE ... SET total_xp =
 * total_xp + ? (không đọc-sửa-ghi). xp_logs là JSON nên bắt buộc
 * đọc-sửa-ghi, nhưng an toàn vì dòng đã bị khóa FOR UPDATE trong
 * cùng transaction. xp_today/xp_week được reset (về 0) khi sang
 * ngày/tuần mới TRƯỚC khi cộng, theo cùng luật rollover của client
 * (rolloverStudentState): mốc là ngày VN của entry xp_logs mới nhất
 * (fallback last_attendance_date khi chưa có log nào).
 */

export interface XpTotals {
  totalXp: number;
  xpToday: number;
  xpWeek: number;
}

export interface AwardResult extends XpTotals {
  awarded: number;
}

/** XP điểm danh fallback = XP_CONFIG.ATTENDANCE_DAILY_XP trong src/config.ts. */
export const ATTENDANCE_DAILY_XP_FALLBACK = 2;

/** Ngày VN hiện tại (YYYY-MM-DD) = UTC + 7h, tính bằng JS. */
export function vnTodayStr(now: Date = new Date()): string {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 10);
}

/** Khóa tuần = ngày thứ Hai (VN) của tuần chứa ngày VN cho trước. */
export function vnWeekKey(vnDateStr: string): string {
  const d = new Date(`${vnDateStr}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = thứ Hai
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Chạy fn trong transaction của caller nếu db đã là tx, ngược lại tự mở 1 transaction mới. */
async function runInTx<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  if (isTxDb(db)) return fn(db);
  return withTransaction(fn);
}

interface XpLogEntry {
  id: string;
  timestamp: number;
  actionName: string;
  rawXp: number;
  actualXp: number;
  reason: string;
  key?: string;
}

interface StateRow {
  total_xp: number | null;
  xp_today: number | null;
  xp_week: number | null;
  last_attendance_date: string | null;
  attendance_days_this_week: number | null;
  attendance_history: unknown;
  xp_logs: unknown;
}

async function ensureStateRow(tx: Db, studentId: string): Promise<void> {
  await tx.execute('INSERT IGNORE INTO student_states (student_id) VALUES (?)', [studentId]);
}

async function lockStateRow(tx: Db, studentId: string): Promise<StateRow> {
  const rows = await tx.query<StateRow[]>(
    `SELECT total_xp, xp_today, xp_week, last_attendance_date,
            attendance_days_this_week, attendance_history, xp_logs
       FROM student_states WHERE student_id = ? FOR UPDATE`,
    [studentId]
  );
  const row = rows[0];
  if (!row) throw new Error('STUDENT_STATE_NOT_FOUND');
  return row;
}

function readLogs(row: StateRow): XpLogEntry[] {
  const logs = parseJson<unknown>(row.xp_logs, []);
  return Array.isArray(logs) ? (logs as XpLogEntry[]) : [];
}

/** Ngày VN của lần cộng XP gần nhất (theo timestamp log mới nhất), null khi chưa có log. */
function lastAwardVnDate(logs: XpLogEntry[]): string | null {
  let max = 0;
  for (const entry of logs) {
    if (typeof entry?.timestamp === 'number' && entry.timestamp > max) max = entry.timestamp;
  }
  return max > 0 ? vnTodayStr(new Date(max)) : null;
}

function newLogEntry(actionName: string, amount: number, key: string): XpLogEntry {
  return {
    id: `xp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    actionName,
    rawXp: amount,
    actualXp: amount,
    reason: actionName,
    key,
  };
}

interface AwardInput {
  key: string;
  amount: number;
  actionName: string;
  /** Ngày VN của lần cộng này (điểm danh: ngày được truyền vào; còn lại: hôm nay VN). */
  todayVn: string;
  /** Chỉ điểm danh mới có: cập nhật last_attendance_date + lịch sử + số ngày trong tuần. */
  attendanceDateStr?: string;
}

async function awardOnce(tx: Db, studentId: string, input: AwardInput): Promise<AwardResult> {
  await ensureStateRow(tx, studentId);
  const row = await lockStateRow(tx, studentId);
  const logs = readLogs(row);

  if (logs.some((e) => e?.key === input.key)) {
    // Đã trả key này rồi: không cộng lại, trả số dư hiện tại.
    return {
      awarded: 0,
      totalXp: row.total_xp ?? 0,
      xpToday: row.xp_today ?? 0,
      xpWeek: row.xp_week ?? 0,
    };
  }

  // Number() + finite-check: đầu vào lạ (vd chuỗi không phải số do gọi
  // sai thứ tự tham số) thành 0 thay vì NaN làm hỏng UPDATE.
  const amountNum = Number(input.amount);
  const amount = Number.isFinite(amountNum) ? Math.max(0, Math.floor(amountNum)) : 0;
  if (amount <= 0) return { awarded: 0, totalXp: row.total_xp ?? 0, xpToday: row.xp_today ?? 0, xpWeek: row.xp_week ?? 0 };

  // Rollover ngày/tuần: mốc = ngày VN của lần cộng gần nhất (fallback
  // last_attendance_date cho state legacy chưa có log server nào).
  const lastVn = lastAwardVnDate(logs) ?? (row.last_attendance_date ? String(row.last_attendance_date).slice(0, 10) : null);
  const resetDay = lastVn !== input.todayVn;
  const resetWeek = !lastVn || vnWeekKey(lastVn) !== vnWeekKey(input.todayVn);
  if (resetDay) {
    await tx.execute('UPDATE student_states SET xp_today = 0 WHERE student_id = ?', [studentId]);
  }
  if (resetWeek) {
    await tx.execute('UPDATE student_states SET xp_week = 0, attendance_days_this_week = 0 WHERE student_id = ?', [studentId]);
  }

  const nextLogs = [newLogEntry(input.actionName, amount, input.key), ...logs];
  await tx.execute(
    `UPDATE student_states
        SET total_xp = total_xp + ?, xp_today = xp_today + ?, xp_week = xp_week + ?, xp_logs = ?
      WHERE student_id = ?`,
    [amount, amount, amount, toJson(nextLogs), studentId]
  );

  if (input.attendanceDateStr) {
    const history = parseJson<unknown>(row.attendance_history, []);
    const historyArr = Array.isArray(history) ? (history as string[]) : [];
    await tx.execute(
      `UPDATE student_states
          SET last_attendance_date = ?, attendance_days_this_week = attendance_days_this_week + 1,
              attendance_history = ?
        WHERE student_id = ?`,
      [input.attendanceDateStr, toJson([input.attendanceDateStr, ...historyArr]), studentId]
    );
  }

  return {
    awarded: amount,
    totalXp: (row.total_xp ?? 0) + amount,
    xpToday: (resetDay ? 0 : row.xp_today ?? 0) + amount,
    xpWeek: (resetWeek ? 0 : row.xp_week ?? 0) + amount,
  };
}

/**
 * XP điểm danh: ưu tiên system_settings hàng 'default' → xp_rules.attendance;
 * thiếu hàng/key/giá trị không hợp lệ → fallback ATTENDANCE_DAILY_XP_FALLBACK (2).
 * LƯU Ý: chỉ đọc key `attendance` — các key xp_rules còn lại là legacy, xem đầu file.
 */
export async function attendanceXp(tx: Db): Promise<number> {
  try {
    const rows = await tx.query<any[]>(
      'SELECT xp_rules FROM system_settings WHERE id = ? LIMIT 1',
      ['default']
    );
    const rules = parseJson<any>(rows[0]?.xp_rules, null);
    const value = rules ? Number(rules.attendance) : NaN;
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  } catch {
    // Đọc cấu hình lỗi thì dùng fallback, không làm hỏng điểm danh.
  }
  return ATTENDANCE_DAILY_XP_FALLBACK;
}

/**
 * Điểm danh ngày VN vnDateStr (định dạng YYYY-MM-DD; route tự tính bằng
 * vnTodayStr() khi không có ngày truyền vào). Đã điểm danh ngày đó rồi
 * (last_attendance_date trùng hoặc key đã có) → awarded 0, không cộng lại.
 * Đồng thời cập nhật last_attendance_date, attendance_days_this_week
 * (reset về 0 khi sang tuần mới rồi +1) và attendance_history.
 */
export async function awardCheckIn(db: Db, studentId: string, vnDateStr: string): Promise<AwardResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vnDateStr || '')) throw new Error('BAD_INPUT');
  return runInTx(db, async (tx) => {
    await ensureStateRow(tx, studentId);
    const row = await lockStateRow(tx, studentId);
    const rawLast: unknown = row.last_attendance_date;
    const lastDate = rawLast instanceof Date
      ? rawLast.toISOString().slice(0, 10)
      : rawLast ? String(rawLast).slice(0, 10) : null;
    if (lastDate === vnDateStr) {
      return { awarded: 0, totalXp: row.total_xp ?? 0, xpToday: row.xp_today ?? 0, xpWeek: row.xp_week ?? 0 };
    }
    const amount = await attendanceXp(tx);
    return awardOnce(tx, studentId, {
      key: `checkin:${vnDateStr}`,
      amount,
      actionName: 'Điểm danh hằng ngày',
      todayVn: vnDateStr,
      attendanceDateStr: vnDateStr,
    });
  });
}

/**
 * XP nộp bài: trả đúng amount route truyền vào (không phụ thuộc đúng/sai),
 * idempotency theo attemptId — cùng 1 attempt không bao giờ trả 2 lần
 * (kể cả route bị gọi lại do retry).
 * KHÁC BIỆT CẦN ROUTE WORKER CHỐT (ghi rõ, không giấu): client cũ trả
 * XP 1 lần cho mỗi quiz/assignment (key quiz:<id>:completed /
 * assignment:<id>:submitted), còn server key theo attemptId nên mỗi
 * attempt (làm lại) sẽ được trả lại nếu route gọi hàm này cho mọi lần
 * nộp. Nếu muốn giữ hành vi client cũ (chỉ lần đầu), route phải tự
 * kiểm tra "đã có attempt trước cho cùng quiz/assignment chưa" trước
 * khi gọi — engine không tự chặn vì nó không biết attempt này thuộc
 * bài nào.
 */
export async function awardSubmission(
  db: Db,
  studentId: string,
  attemptId: string,
  amount: number
): Promise<AwardResult> {
  if (!attemptId) throw new Error('BAD_INPUT');
  return runInTx(db, async (tx) =>
    awardOnce(tx, studentId, {
      key: `submission:${attemptId}`,
      amount,
      actionName: 'Nộp bài',
      todayVn: vnTodayStr(),
    })
  );
}

/**
 * XP hoàn thành chủ đề: chỉ cộng 1 lần cho mỗi topicId (key topic:<id>).
 * Route phải tự xác minh đủ điều kiện hoàn thành (mọi mục trong luồng
 * xong — xem topicCompletion.isTopicFullyComplete) + quyền sở hữu
 * trước khi gọi; engine chỉ chống cộng trùng và cộng điểm.
 */
export async function awardTopicCompletion(
  db: Db,
  studentId: string,
  topicId: string,
  amount: number
): Promise<AwardResult> {
  if (!topicId) throw new Error('BAD_INPUT');
  return runInTx(db, async (tx) =>
    awardOnce(tx, studentId, {
      key: `topic:${topicId}`,
      amount,
      actionName: 'Hoàn thành chủ đề',
      todayVn: vnTodayStr(),
    })
  );
}

/**
 * XP hoàn thành 1 bài quiz nội dung (BTVN trong chủ đề): chỉ cộng 1 lần
 * cho mỗi quizId (key quiz:<id>) — giữ đúng hành vi client cũ
 * (xpEngine XP_KEYS.quizCompleted, App trả totalScore của QuizRunner).
 * Route phải tự xác minh quiz published + đúng lớp + quyền sở hữu
 * trước khi gọi; engine chỉ chống cộng trùng và cộng điểm.
 * Số XP = điểm bài làm (totalScore, đã làm tròn 1 lẻ ở client) — hàm
 * floor về số nguyên như awardXP cũ (Math.floor(rawXp)).
 */
export async function awardQuizCompletion(
  db: Db,
  studentId: string,
  quizId: string,
  amount: number
): Promise<AwardResult> {
  if (!quizId) throw new Error('BAD_INPUT');
  return runInTx(db, async (tx) =>
    awardOnce(tx, studentId, {
      key: `quiz:${quizId}`,
      amount,
      actionName: 'Hoàn thành bài quiz',
      todayVn: vnTodayStr(),
    })
  );
}

/**
 * Trừ XP đổi quà (lúc tạo yêu cầu): trừ vào total_xp vĩnh viễn, KHÔNG
 * trừ xp_today/xp_week (đúng hành vi client cũ). Thiếu điểm → throw
 * Error('INSUFFICIENT_XP'), không ghi gì. Cùng requestId trừ 2 lần →
 * lần 2 trả deducted 0 (idempotency key gift:deduct:<requestId>).
 */
export async function deductForGift(
  db: Db,
  studentId: string,
  amount: number,
  requestId: string
): Promise<{ totalXp: number; deducted: number }> {
  if (!requestId) throw new Error('BAD_INPUT');
  const costNum = Number(amount);
  const cost = Number.isFinite(costNum) ? Math.max(0, Math.floor(costNum)) : 0;
  return runInTx(db, async (tx) => {
    await ensureStateRow(tx, studentId);
    const row = await lockStateRow(tx, studentId);
    const logs = readLogs(row);
    const key = `gift:deduct:${requestId}`;
    if (logs.some((e) => e?.key === key)) {
      return { totalXp: row.total_xp ?? 0, deducted: 0 };
    }
    if (cost <= 0) return { totalXp: row.total_xp ?? 0, deducted: 0 };
    if ((row.total_xp ?? 0) < cost) throw new Error('INSUFFICIENT_XP');
    const nextLogs = [newLogEntry('Đổi quà', -cost, key), ...logs];
    await tx.execute(
      'UPDATE student_states SET total_xp = total_xp - ?, xp_logs = ? WHERE student_id = ?',
      [cost, toJson(nextLogs), studentId]
    );
    return { totalXp: (row.total_xp ?? 0) - cost, deducted: cost };
  });
}

/**
 * Hoàn 100% XP khi yêu cầu đổi quà bị từ chối (đúng luật diagram +
 * refundIfRejected client cũ: cộng lại đúng deductedXp). Cùng
 * requestId hoàn 2 lần → lần 2 trả refunded 0 (key gift:refund:<id>).
 */
export async function refundGift(
  db: Db,
  studentId: string,
  amount: number,
  requestId: string
): Promise<{ totalXp: number; refunded: number }> {
  if (!requestId) throw new Error('BAD_INPUT');
  const valueNum = Number(amount);
  const value = Number.isFinite(valueNum) ? Math.max(0, Math.floor(valueNum)) : 0;
  return runInTx(db, async (tx) => {
    await ensureStateRow(tx, studentId);
    const row = await lockStateRow(tx, studentId);
    const logs = readLogs(row);
    const key = `gift:refund:${requestId}`;
    if (logs.some((e) => e?.key === key)) {
      return { totalXp: row.total_xp ?? 0, refunded: 0 };
    }
    if (value <= 0) return { totalXp: row.total_xp ?? 0, refunded: 0 };
    const nextLogs = [newLogEntry('Hoàn XP đổi quà', value, key), ...logs];
    await tx.execute(
      'UPDATE student_states SET total_xp = total_xp + ?, xp_logs = ? WHERE student_id = ?',
      [value, toJson(nextLogs), studentId]
    );
    return { totalXp: (row.total_xp ?? 0) + value, refunded: value };
  });
}

/**
 * Tổng XP hiện tại. xpToday/xpWeek được hiệu chỉnh đọc (không ghi):
 * nếu lần cộng gần nhất không phải hôm nay VN (hoặc không phải tuần
 * này) thì trả 0 thay vì số tồn cũ — đúng semantics "hôm nay/tuần này".
 * totalXp không bao giờ reset.
 */
export async function getTotals(db: Db, studentId: string): Promise<XpTotals> {
  const rows = await db.query<StateRow[]>(
    `SELECT total_xp, xp_today, xp_week, last_attendance_date, xp_logs
       FROM student_states WHERE student_id = ? LIMIT 1`,
    [studentId]
  );
  const row = rows[0];
  if (!row) return { totalXp: 0, xpToday: 0, xpWeek: 0 };
  const todayVn = vnTodayStr();
  const logs = readLogs(row);
  const lastVn = lastAwardVnDate(logs) ?? (row.last_attendance_date ? String(row.last_attendance_date).slice(0, 10) : null);
  return {
    totalXp: row.total_xp ?? 0,
    xpToday: lastVn === todayVn ? row.xp_today ?? 0 : 0,
    xpWeek: lastVn && vnWeekKey(lastVn) === vnWeekKey(todayVn) ? row.xp_week ?? 0 : 0,
  };
}
