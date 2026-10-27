import { StudentState } from '../types.ts';

/**
 * Chuỗi ngày YYYY-MM-DD theo GIỜ ĐỊA PHƯƠNG của thiết bị.
 * TUYỆT ĐỐI không dùng toISOString() (đó là giờ UTC — ngày mới sẽ bắt đầu
 * lúc 07:00 sáng giờ Việt Nam, làm sai luật "1 lần/ngày" của điểm danh/XP).
 */
export function getLocalTodayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Khóa tuần = ngày thứ Hai của tuần chứa `d` (giờ địa phương), dạng YYYY-MM-DD. */
export function getWeekKey(d: Date = new Date()): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (monday.getDay() + 6) % 7; // 0 = thứ Hai
  monday.setDate(monday.getDate() - dow);
  return getLocalTodayStr(monday);
}

/**
 * Lật bộ đếm sang ngày/tuần mới khi cần:
 * - Sang ngày mới: xpToday = 0, activeSecondsToday = 0.
 * - Sang tuần mới: xpWeek = 0, attendanceDaysThisWeek = 0, exemptDaysUsedThisWeek = 0.
 * State cũ (chưa có mốc) được suy mốc từ lastAttendanceDate để không xóa nhầm
 * bộ đếm của ngày đang hoạt động. Trả về chính object cũ nếu không đổi gì.
 */
export function rolloverStudentState(state: StudentState): StudentState {
  const today = getLocalTodayStr();
  const weekKey = getWeekKey();
  let next = state;

  const dayMarker = state.lastXpResetDate ?? (state.lastAttendanceDate || today);
  if (dayMarker !== today) {
    next = { ...next, xpToday: 0, activeSecondsToday: 0, lastXpResetDate: today };
  } else if (state.lastXpResetDate !== today) {
    next = { ...next, lastXpResetDate: today };
  }

  const weekMarker = state.xpWeekKey ?? (state.lastAttendanceDate && state.lastAttendanceDate >= weekKey ? weekKey : 'legacy-week');
  if (weekMarker !== weekKey) {
    next = { ...next, xpWeek: 0, attendanceDaysThisWeek: 0, exemptDaysUsedThisWeek: 0, xpWeekKey: weekKey };
  } else if (state.xpWeekKey !== weekKey) {
    next = { ...next, xpWeekKey: weekKey };
  }

  return next;
}

/**
 * Số bước HỌC thật đã hoàn thành — không tính các khóa điểm danh
 * (`attendance:<ngày>`) vốn cũng nằm trong completedSteps.
 */
export function countLearningSteps(completedSteps: string[]): number {
  return completedSteps.filter((s) => !s.startsWith('attendance:')).length;
}

/**
 * Ghi nhận một bước học đã hoàn thành (tiến độ học, tính hoàn thành chủ
 * đề…) mà KHÔNG chạm tới bất kỳ trường XP nào (xpToday/xpWeek/totalXp/
 * xpLogs/xpAwardedSteps) — GĐ3: XP chỉ do server tính và trả về, client
 * không tự cộng, không tự lật bộ đếm XP. Trả về đúng phần state cần hợp
 * nhất (chỉ completedSteps).
 */
export function markStepCompleted(
  state: StudentState,
  stepKey: string
): { completedSteps: string[] } {
  return {
    completedSteps: (state.completedSteps || []).includes(stepKey)
      ? state.completedSteps
      : [...(state.completedSteps || []), stepKey],
  };
}
