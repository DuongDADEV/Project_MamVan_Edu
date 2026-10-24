/**
 * Dashboard Tổng quan — cài đặt đúng công thức DAX của file Power BI
 * "Dashboard_MamVan__1.pbix" (trang "Tổng quan") trên dữ liệu thật của app.
 *
 * NGUỒN CÔNG THỨC (bóc từ DataModel của file pbix bằng pbixray, KHÔNG đoán
 * từ ảnh chụp):
 * - HS_dang_nhap_7_ngay (student_sessions): DISTINCTCOUNT(student_id) với
 *   login_date trong [MAX(login_date) - 6, MAX(login_date)]; MAX lấy với
 *   REMOVEFILTERS(dim_date) + REMOVEFILTERS(student_sessions) — tức bộ lọc
 *   khoảng ngày KHÔNG áp lên KPI này, chỉ bộ lọc lớp vẫn áp.
 * - Ty_le_nop_bai (assignment_targets): DIVIDE(DISTINCTCOUNT(target_id với
 *   submission_status = "SUBMITTED"), DISTINCTCOUNT(target_id)). Targets không
 *   có đường liên hệ tới dim_date nên bộ lọc ngày thực tế không đổi KPI này.
 * - Cau_tra_loi_cho_cham (attempt_answers): DISTINCTCOUNT(answer_id với
 *   grading_status = "PENDING"). Visual interaction của pbix đặt NoFilter từ
 *   bộ lọc ngày sang KPI này — ngày KHÔNG áp.
 * - Ty_le_diem_dat (attempt_answers): DIVIDE(SUM(score_awarded với GRADED),
 *   SUM(max_score với GRADED)) — tỉ lệ theo ĐIỂM, không phải theo số câu.
 *   Bộ lọc ngày áp qua attempts.submitted_date (mặc định theo quan hệ).
 * - Lan_dang_nhap_gan_nhat: MAX(login_at) với REMOVEFILTERS(dim_date).
 * - So_bai_chua_nop: COUNTROWS(targets với NOT_SUBMITTED).
 * - Ty_le_dat_diem_ca_nhan: cùng công thức điểm-trọng số, theo từng HS,
 *   có áp bộ lọc ngày qua attempts.submitted_date.
 * - Gợi ý theo dõi (students): SWITCH(TRUE(), chưa có login → "Chưa có dữ
 *   liệu đăng nhập"; vắng >= 7 ngày VÀ còn bài chưa nộp → "Ít hoạt động và
 *   còn bài chưa nộp"; vắng >= 7 ngày → "Cần kiểm tra hoạt động"; còn bài
 *   chưa nộp → "Còn bài chưa nộp"; còn lại → "Chưa cần ưu tiên").
 * - Flow_Name: VIDEO_FLOW → "Luồng Video"; THEORY_FLOW → "Luồng Lý thuyết
 *   chi tiết"; còn lại giữ nguyên flow_type.
 * - Step_Label: VIDEO_FLOW 1..5 → "01 · Video", "02 · Lý thuyết trọng tâm",
 *   "03 · Bài luyện tập", "04 · Bài kiểm tra 1", "05 · Bài kiểm tra 2";
 *   THEORY_FLOW 1..3 → "01 · Lý thuyết chi tiết", "02 · Bài luyện tập",
 *   "03 · Bài kiểm tra"; còn lại "Khác".
 * - Mức tư duy hiển thị (questions): NHAN_BIET → "1. Nhận biết";
 *   THONG_HIEU → "2. Thông hiểu"; PHAN_TICH → "3. Phân tích";
 *   VAN_DUNG → "4. Vận dụng"; còn lại "Chưa xác định". Cột app tương ứng
 *   là questions.level (cùng miền giá trị).
 * - Ty_le_hoan_thanh_luong: DIVIDE(COUNTROWS(progress với COMPLETED),
 *   COUNTROWS(progress), 0) theo Step_Label.
 * - HS_dang_nhap_theo_ngay: DISTINCTCOUNT(student_id) theo login_date.
 *
 * PHẠM VI ÁP BỘ LỌC (theo visualInteractions + quan hệ của file pbix):
 * - Lớp học: áp cho MỌI visual (qua students → các bảng fact).
 * - Khoảng ngày: áp cho biểu đồ đường (login_date), KPI Tỷ lệ điểm đạt,
 *   biểu đồ mức tư duy và cột Tỷ lệ đạt điểm cá nhân (qua submitted_date);
 *   KHÔNG áp cho KPI Hoạt động 7 ngày, KPI Câu trả lời chờ chấm, bảng bài
 *   được giao, số bài chưa nộp, hoạt động gần nhất và gợi ý theo dõi.
 * - Theo luồng: từ 25/10 KHÔNG còn áp cho visual nào — panel luồng cũ đã
 *   thay bằng bảng chủ đề tính từ states (không theo luồng, không theo ngày).
 *
 * TIẾN ĐỘ THEO CHỦ ĐỀ (từ 25/10, thay biểu đồ luồng): bảng tính từ states
 * của học sinh trong phạm vi lớp qua isTopicFullyComplete — đúng định nghĩa
 * hoàn thành chủ đề của app. Bảng student_activity_progress tồn tại từ
 * migration_013 với hàng hoàn thành hoạt động quiz backfill từ attempt_answers,
 * nhưng bảng chủ đề KHÔNG đọc bảng đó (chưa có writer trực tiếp nên dữ liệu
 * sẽ cũ ngay); bảng progress để dành cho bước ghi trực tiếp sau này.
 */

import { isTopicFullyComplete } from '../logic/topicCompletion.ts';
import {
  TopicWithMeta,
  QuizWithMeta,
  QuestionWithMeta,
} from '../services/types.ts';
import { Question, StudentState } from '../types.ts';

// ---------- Hàng dữ liệu thô (do pbixDashboardData.ts nạp từ Supabase) ----------

export interface PbixStudent {
  /** id Supabase của bảng students (khóa nối các bảng fact). */
  supaId: string;
  /** id trong props của cổng GV (UUID hoặc hs001) — để đối chiếu, không dùng nối. */
  appId: string;
  name: string;
  /** class_id Supabase của học sinh. */
  supaClassId: string;
  /** class_id trong props (để fallback khi không resolve được lớp Supabase). */
  appClassId: string;
}

export interface PbixSession {
  studentId: string;
  /** ISO datetime của login_at. */
  loginAt: string;
  /** login_date dạng YYYY-MM-DD (lấy trực tiếp từ cột login_date). */
  loginDate: string;
}

export interface PbixTarget {
  assignmentId: string;
  studentId: string;
  submissionStatus: string;
}

export interface PbixAssignment {
  id: string;
  title: string;
}

export interface PbixAttempt {
  attemptId: string;
  studentId: string;
  /** ISO datetime của submitted_at, có thể null (chưa nộp). */
  submittedAt: string | null;
}

export interface PbixAnswer {
  answerId: string;
  attemptId: string;
  questionId: string;
  score: number | null;
  maxScore: number | null;
  gradingStatus: string;
}

export interface PbixActivity {
  id: string;
  flowType: string;
  sequenceNo: number;
}

export interface PbixProgress {
  studentId: string;
  activityId: string;
  progressStatus: string;
}

// ---------- Bộ lọc ----------

export interface PbixDateFlowFilters {
  /** YYYY-MM-DD hoặc null = không giới hạn. */
  dateFrom: string | null;
  dateTo: string | null;
  /** flow_type đang chọn, hoặc null = tất cả các luồng. */
  flow: string | null;
}

// ---------- Kết quả tính toán ----------

export interface PbixStudentRow {
  studentId: string;
  name: string;
  /** ISO datetime login gần nhất, null = chưa từng đăng nhập. */
  lastLoginAt: string | null;
  unsubmitted: number;
  /** Tỉ lệ điểm cá nhân theo điểm-trọng số, null = chưa có câu đã chấm trong phạm vi. */
  personalRate: number | null;
  suggestion: string;
}

export interface PbixAssignmentRow {
  assignmentId: string;
  title: string;
  assigned: number;
  submitted: number;
  unsubmitted: number;
  /** Tỉ lệ nộp theo bài, 0 khi chưa giao cho ai trong phạm vi. */
  rate: number;
}

export interface PbixThinkingRow {
  level: string;
  label: string;
  /** Tỉ lệ điểm đạt theo điểm-trọng số của mức tư duy. */
  rate: number;
  /** Số câu trả lời đã chấm thuộc mức (tooltip của biểu đồ pbix). */
  gradedCount: number;
}

export interface PbixDailyRow {
  date: string;
  /** DISTINCTCOUNT học sinh đăng nhập trong ngày. */
  students: number;
}

export interface PbixFlowRow {
  stepLabel: string;
  total: number;
  completed: number;
  rate: number;
}

export interface PbixDashboard {
  /** Ngày neo MAX(login_date) của phạm vi lớp, null = không có phiên nào. */
  anchorDate: string | null;
  /** HS_dang_nhap_7_ngay. */
  activeLast7: number;
  /** Ty_le_nop_bai (0..1), null = không có lượt giao nào. */
  submissionRate: number | null;
  submittedTargets: number;
  totalTargets: number;
  /** Cau_tra_loi_cho_cham. */
  pendingAnswers: number;
  /** Ty_le_diem_dat (0..1), null = không có câu đã chấm trong phạm vi. */
  passRate: number | null;
  gradedScoreSum: number;
  gradedMaxSum: number;
  studentsTable: PbixStudentRow[];
  /** Hàng Total của bảng học sinh (theo cách pbix hiển thị: MAX ngày, SUM bài
   * chưa nộp, tỉ lệ chung, gợi ý của hàng đầu sau sắp xếp). */
  studentsTotal: {
    lastLoginAt: string | null;
    unsubmitted: number;
    overallRate: number | null;
    suggestion: string;
  } | null;
  assignmentsTable: PbixAssignmentRow[];
  assignmentsTotal: {
    assigned: number;
    submitted: number;
    unsubmitted: number;
    rate: number;
  } | null;
  thinkingChart: PbixThinkingRow[];
  dailyChart: PbixDailyRow[];
  flowChart: PbixFlowRow[];
  /** false khi không có dữ liệu tiến độ (bảng student_activity_progress chưa
   * tồn tại) — UI hiện trạng thái trống thay vì biểu đồ. */
  hasProgressData: boolean;
  /** Các luồng thật có trong dữ liệu (để dựng ô chọn Theo luồng). */
  flowOptions: { flowType: string; label: string }[];
  /** Khoảng ngày thật của phiên đăng nhập (để mặc định bộ lọc ngày). */
  sessionDateRange: { min: string; max: string } | null;
}

// ---------- Ánh xạ nhãn theo DAX ----------

export function flowName(flowType: string): string {
  if (flowType === 'VIDEO_FLOW') return 'Luồng Video';
  if (flowType === 'THEORY_FLOW') return 'Luồng Lý thuyết chi tiết';
  return flowType;
}

export function stepLabel(flowType: string, sequenceNo: number): string {
  if (flowType === 'VIDEO_FLOW') {
    if (sequenceNo === 1) return '01 · Video';
    if (sequenceNo === 2) return '02 · Lý thuyết trọng tâm';
    if (sequenceNo === 3) return '03 · Bài luyện tập';
    if (sequenceNo === 4) return '04 · Bài kiểm tra 1';
    if (sequenceNo === 5) return '05 · Bài kiểm tra 2';
  }
  if (flowType === 'THEORY_FLOW') {
    if (sequenceNo === 1) return '01 · Lý thuyết chi tiết';
    if (sequenceNo === 2) return '02 · Bài luyện tập';
    if (sequenceNo === 3) return '03 · Bài kiểm tra';
  }
  return 'Khác';
}

export function thinkingLabel(level: string): string {
  if (level === 'NHAN_BIET') return '1. Nhận biết';
  if (level === 'THONG_HIEU') return '2. Thông hiểu';
  if (level === 'PHAN_TICH') return '3. Phân tích';
  if (level === 'VAN_DUNG') return '4. Vận dụng';
  return 'Chưa xác định';
}

/** Gợi ý theo dõi — đúng thứ tự SWITCH của DAX. */
export function suggestionFor(
  lastLoginDate: string | null,
  todayKey: string,
  unsubmitted: number,
): string {
  if (!lastLoginDate) return 'Chưa có dữ liệu đăng nhập';
  const days = daysBetween(lastLoginDate, todayKey);
  if (days >= 7 && unsubmitted > 0) return 'Ít hoạt động và còn bài chưa nộp';
  if (days >= 7) return 'Cần kiểm tra hoạt động';
  if (unsubmitted > 0) return 'Còn bài chưa nộp';
  return 'Chưa cần ưu tiên';
}

// ---------- Tiện ích ngày (khóa YYYY-MM-DD) ----------

/** Ngày theo múi giờ Asia/Saigon của một ISO datetime (ngày học tập của trường). */
export function saigonDateKey(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Saigon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** YYYY-MM-DD → DD/MM/YYYY (quy ước hiển thị tiếng Việt; pbix gốc dùng M/D/YYYY). */
export function formatVNDate(key: string | null): string {
  if (!key) return '—';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export function formatVNDateTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso);
  // Ngày + giờ đều theo múi giờ Saigon (ngày học tập của trường).
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Saigon',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(t);
  return `${formatVNDate(saigonDateKey(iso))} ${time}`;
}

/** Tỉ lệ phần trăm nguyên (cách pbix hiển thị % không thập phân). */
export function formatWholePercent(rate: number | null): string {
  if (rate === null || rate === undefined) return '—';
  return `${Math.round(rate * 100)}%`;
}

/** Tỉ lệ phần trăm 1 thập phân (cách pbix hiển thị cột tỉ lệ cá nhân). */
export function formatOneDecimalPercent(rate: number | null): string {
  if (rate === null || rate === undefined) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Làm tròn điểm hiển thị về 1 chữ số thập phân (sửa lỗi cộng số thực ra
 * 180.20000000000002). Chỉ dùng để hiển thị, không đổi công thức tính.
 */
export function formatScore1dp(v: number): string {
  return String(Math.round(v * 10) / 10);
}

// ---------- Tính toán chính ----------

export interface PbixComputeInput {
  students: PbixStudent[];
  sessions: PbixSession[];
  targets: PbixTarget[];
  assignments: PbixAssignment[];
  attempts: PbixAttempt[];
  answers: PbixAnswer[];
  /** questions.id → questions.level. */
  questionLevels: Record<string, string>;
  activities: PbixActivity[];
  progress: PbixProgress[];
  filters: PbixDateFlowFilters;
  /** Ngày hiện tại dạng YYYY-MM-DD (múi giờ Saigon) cho DATEDIFF của DAX. */
  todayKey: string;
}

function inDateRange(dateKey: string, from: string | null, to: string | null): boolean {
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}

export function computePbixDashboard(input: PbixComputeInput): PbixDashboard {
  const { students, sessions, targets, assignments, attempts, answers } = input;
  const { dateFrom, dateTo, flow } = input.filters;
  const scopedIds = new Set(students.map((s) => s.supaId));

  const scopedSessions = sessions.filter((s) => scopedIds.has(s.studentId));
  const scopedTargets = targets.filter((t) => scopedIds.has(t.studentId));
  const scopedAttempts = attempts.filter((a) => scopedIds.has(a.studentId));
  const attemptById = new Map(scopedAttempts.map((a) => [a.attemptId, a]));
  const scopedAnswers = answers.filter((a) => attemptById.has(a.attemptId));
  // Ngày nộp của từng lượt làm (múi giờ Saigon) — đường lọc ngày của pbix.
  const attemptDate = new Map<string, string | null>();
  for (const a of scopedAttempts) {
    attemptDate.set(a.attemptId, a.submittedAt ? saigonDateKey(a.submittedAt) : null);
  }
  const answerInDateRange = (a: PbixAnswer): boolean => {
    const d = attemptDate.get(a.attemptId);
    if (!d) return false;
    return inDateRange(d, dateFrom, dateTo);
  };

  // --- Khoảng ngày thật của phiên (để mặc định bộ lọc) ---
  let sessionDateRange: { min: string; max: string } | null = null;
  for (const s of scopedSessions) {
    if (!sessionDateRange) sessionDateRange = { min: s.loginDate, max: s.loginDate };
    else {
      if (s.loginDate < sessionDateRange.min) sessionDateRange.min = s.loginDate;
      if (s.loginDate > sessionDateRange.max) sessionDateRange.max = s.loginDate;
    }
  }

  // --- KPI 1: Hoạt động 7 ngày (REMOVEFILTERS ngày: neo = MAX login_date) ---
  let anchorDate: string | null = null;
  for (const s of scopedSessions) {
    if (!anchorDate || s.loginDate > anchorDate) anchorDate = s.loginDate;
  }
  let activeLast7 = 0;
  if (anchorDate) {
    const from = addDays(anchorDate, -6);
    const set = new Set<string>();
    for (const s of scopedSessions) {
      if (s.loginDate >= from && s.loginDate <= anchorDate) set.add(s.studentId);
    }
    activeLast7 = set.size;
  }

  // --- KPI 2: Tỷ lệ nộp bài (targets không chịu lọc ngày) ---
  const submittedTargets = scopedTargets.filter(
    (t) => t.submissionStatus === 'SUBMITTED',
  ).length;
  const totalTargets = scopedTargets.length;
  const submissionRate = totalTargets > 0 ? submittedTargets / totalTargets : null;

  // --- KPI 3: Câu trả lời chờ chấm (NoFilter ngày) ---
  const pendingAnswers = new Set(
    scopedAnswers.filter((a) => a.gradingStatus === 'PENDING').map((a) => a.answerId),
  ).size;

  // --- KPI 4: Tỷ lệ điểm đạt (điểm-trọng số, CÓ lọc ngày qua submitted_date) ---
  let gradedScoreSum = 0;
  let gradedMaxSum = 0;
  for (const a of scopedAnswers) {
    if (a.gradingStatus !== 'GRADED') continue;
    if (!answerInDateRange(a)) continue;
    gradedScoreSum += a.score ?? 0;
    gradedMaxSum += a.maxScore ?? 0;
  }
  const passRate = gradedMaxSum > 0 ? gradedScoreSum / gradedMaxSum : null;

  // --- Bảng Học sinh cần quan tâm ---
  const lastLoginByStudent = new Map<string, string>();
  for (const s of scopedSessions) {
    const cur = lastLoginByStudent.get(s.studentId);
    if (!cur || s.loginAt > cur) lastLoginByStudent.set(s.studentId, s.loginAt);
  }
  const unsubmittedByStudent = new Map<string, number>();
  for (const t of scopedTargets) {
    if (t.submissionStatus === 'NOT_SUBMITTED') {
      unsubmittedByStudent.set(t.studentId, (unsubmittedByStudent.get(t.studentId) ?? 0) + 1);
    }
  }
  const gradedByStudent = new Map<string, { score: number; max: number }>();
  for (const a of scopedAnswers) {
    if (a.gradingStatus !== 'GRADED') continue;
    if (!answerInDateRange(a)) continue;
    const att = attemptById.get(a.attemptId)!;
    const cur = gradedByStudent.get(att.studentId) ?? { score: 0, max: 0 };
    cur.score += a.score ?? 0;
    cur.max += a.maxScore ?? 0;
    gradedByStudent.set(att.studentId, cur);
  }
  const studentsTable: PbixStudentRow[] = students.map((st) => {
    const lastLoginAt = lastLoginByStudent.get(st.supaId) ?? null;
    const unsubmitted = unsubmittedByStudent.get(st.supaId) ?? 0;
    const g = gradedByStudent.get(st.supaId);
    const personalRate = g && g.max > 0 ? g.score / g.max : null;
    return {
      studentId: st.supaId,
      name: st.name,
      lastLoginAt,
      unsubmitted,
      personalRate,
      suggestion: suggestionFor(
        lastLoginAt ? saigonDateKey(lastLoginAt) : null,
        input.todayKey,
        unsubmitted,
      ),
    };
  });
  // Sắp xếp pbix: Gợi ý theo dõi giảm dần (chuỗi), rồi tên tăng dần cho ổn định.
  studentsTable.sort((a, b) =>
    b.suggestion.localeCompare(a.suggestion) || a.name.localeCompare(b.name),
  );
  let studentsTotal: PbixDashboard['studentsTotal'] = null;
  if (studentsTable.length > 0) {
    let maxLogin: string | null = null;
    let sumUnsubmitted = 0;
    for (const r of studentsTable) {
      if (r.lastLoginAt && (!maxLogin || r.lastLoginAt > maxLogin)) maxLogin = r.lastLoginAt;
      sumUnsubmitted += r.unsubmitted;
    }
    studentsTotal = {
      lastLoginAt: maxLogin,
      unsubmitted: sumUnsubmitted,
      overallRate: passRate,
      suggestion: studentsTable[0].suggestion,
    };
  }

  // --- Bảng Tiến độ bài được giao (chỉ bài có ≥1 lượt giao trong phạm vi) ---
  const targetsByAssignment = new Map<string, PbixTarget[]>();
  for (const t of scopedTargets) {
    const list = targetsByAssignment.get(t.assignmentId) ?? [];
    list.push(t);
    targetsByAssignment.set(t.assignmentId, list);
  }
  const assignmentById = new Map(assignments.map((a) => [a.id, a]));
  const assignmentsTable: PbixAssignmentRow[] = [];
  for (const [assignmentId, list] of targetsByAssignment) {
    const submitted = list.filter((t) => t.submissionStatus === 'SUBMITTED').length;
    const unsubmitted = list.filter((t) => t.submissionStatus === 'NOT_SUBMITTED').length;
    assignmentsTable.push({
      assignmentId,
      title: assignmentById.get(assignmentId)?.title ?? assignmentId,
      assigned: list.length,
      submitted,
      unsubmitted,
      rate: list.length > 0 ? submitted / list.length : 0,
    });
  }
  // Sắp xếp pbix: Tỷ lệ nộp theo bài giảm dần, rồi tiêu đề tăng dần.
  assignmentsTable.sort((a, b) => b.rate - a.rate || a.title.localeCompare(b.title));
  let assignmentsTotal: PbixDashboard['assignmentsTotal'] = null;
  if (assignmentsTable.length > 0) {
    const assigned = assignmentsTable.reduce((s, r) => s + r.assigned, 0);
    const submitted = assignmentsTable.reduce((s, r) => s + r.submitted, 0);
    const unsubmitted = assignmentsTable.reduce((s, r) => s + r.unsubmitted, 0);
    assignmentsTotal = {
      assigned,
      submitted,
      unsubmitted,
      rate: assigned > 0 ? submitted / assigned : 0,
    };
  }

  // --- Biểu đồ mức tư duy (chỉ mức có ≥1 câu đã chấm trong phạm vi ngày) ---
  const byLevel = new Map<string, { score: number; max: number; count: Set<string> }>();
  for (const a of scopedAnswers) {
    if (a.gradingStatus !== 'GRADED') continue;
    if (!answerInDateRange(a)) continue;
    const level = input.questionLevels[a.questionId] ?? '';
    const cur = byLevel.get(level) ?? { score: 0, max: 0, count: new Set<string>() };
    cur.score += a.score ?? 0;
    cur.max += a.maxScore ?? 0;
    cur.count.add(a.answerId);
    byLevel.set(level, cur);
  }
  const thinkingChart: PbixThinkingRow[] = [...byLevel.entries()]
    .filter(([, v]) => v.max > 0)
    .map(([level, v]) => ({
      level,
      label: thinkingLabel(level),
      rate: v.score / v.max,
      gradedCount: v.count.size,
    }))
    // Sắp xếp theo sortDefinition của pbix: Tỷ lệ điểm đạt giảm dần.
    .sort((a, b) => b.rate - a.rate || a.label.localeCompare(b.label));

  // --- Biểu đồ đường: số học sinh đăng nhập theo ngày (DISTINCTCOUNT) ---
  const perDay = new Map<string, Set<string>>();
  for (const s of scopedSessions) {
    if (!inDateRange(s.loginDate, dateFrom, dateTo)) continue;
    const set = perDay.get(s.loginDate) ?? new Set<string>();
    set.add(s.studentId);
    perDay.set(s.loginDate, set);
  }
  const dailyChart: PbixDailyRow[] = [...perDay.entries()]
    .map(([date, set]) => ({ date, students: set.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // --- Biểu đồ luồng (cần bảng student_activity_progress — chưa có) ---
  const activityById = new Map(input.activities.map((a) => [a.id, a]));
  const flowActivities = flow
    ? input.activities.filter((a) => a.flowType === flow)
    : input.activities;
  const flowActivityIds = new Set(flowActivities.map((a) => a.id));
  const byStep = new Map<string, { total: number; completed: number }>();
  for (const p of input.progress) {
    if (!scopedIds.has(p.studentId)) continue;
    if (!flowActivityIds.has(p.activityId)) continue;
    const act = activityById.get(p.activityId)!;
    const label = stepLabel(act.flowType, act.sequenceNo);
    const cur = byStep.get(label) ?? { total: 0, completed: 0 };
    cur.total += 1;
    if (p.progressStatus === 'COMPLETED') cur.completed += 1;
    byStep.set(label, cur);
  }
  const flowChart: PbixFlowRow[] = [...byStep.entries()]
    .map(([stepLabel, v]) => ({
      stepLabel,
      total: v.total,
      completed: v.completed,
      rate: v.total > 0 ? v.completed / v.total : 0,
    }))
    .sort((a, b) => b.rate - a.rate || a.stepLabel.localeCompare(b.stepLabel));
  const hasProgressData = input.progress.length > 0;

  const flowOptions = [...new Set(input.activities.map((a) => a.flowType))]
    .sort()
    .map((flowType) => ({ flowType, label: flowName(flowType) }));

  return {
    anchorDate,
    activeLast7,
    submissionRate,
    submittedTargets,
    totalTargets,
    pendingAnswers,
    passRate,
    gradedScoreSum,
    gradedMaxSum,
    studentsTable,
    studentsTotal,
    assignmentsTable,
    assignmentsTotal,
    thinkingChart,
    dailyChart,
    flowChart,
    hasProgressData,
    flowOptions,
    sessionDateRange,
  };
}

// ---------- Bảng Tiến độ hoàn thành luồng theo chủ đề (25/10) ----------

/**
 * Một hàng của bảng: số học sinh hoàn thành CHỦ ĐỀ trên tổng số học sinh
 * trong phạm vi lớp đang chọn. "Hoàn thành chủ đề" = đúng định nghĩa
 * isTopicFullyComplete của app (mọi mục luồng đều xong: video xem trọn
 * luồng, lý thuyết học xong, quiz làm đúng hết phần chấm tự động; chủ đề
 * rỗng không bao giờ tính là hoàn thành). Bảng chỉ chịu lọc lớp — trạng
 * thái hoàn thành không gắn ngày nên không chịu lọc ngày, và hoàn thành
 * chủ đề trải mọi luồng nên không chịu lọc luồng.
 */
export interface TopicCompletionRow {
  topicId: string;
  title: string;
  completed: number;
  total: number;
  rate: number;
}

export function computeTopicCompletionTable(
  topics: TopicWithMeta[],
  quizzes: QuizWithMeta[],
  questions: Record<string, Question>,
  states: StudentState[],
): TopicCompletionRow[] {
  const total = states.length;
  const rows = topics.map((topic) => {
    const completed = states.filter((st) =>
      isTopicFullyComplete(
        topic,
        quizzes,
        // isTopicFullyComplete chỉ đọc id/type của câu hỏi; bản ghi Question
        // của portal không mang trường ContentMetadata nên ép kiểu tại đây.
        questions as Record<string, QuestionWithMeta>,
        st.completedSteps ?? [],
        st.questionResults ?? [],
      ),
    ).length;
    return {
      topicId: topic.id,
      title: topic.title,
      completed,
      total,
      rate: total > 0 ? completed / total : 0,
    };
  });
  rows.sort((a, b) => b.rate - a.rate || a.title.localeCompare(b.title));
  return rows;
}
