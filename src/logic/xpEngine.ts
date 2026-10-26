import { StudentState, XPLogEntry } from '../types.ts';
import { getLocalTodayStr, getWeekKey } from './studentStateUtils.ts';

export interface XPCalculationResult {
  stepKey: string;
  isFirstTime: boolean;
  rawXp: number;
  actualXp: number;
  reason: string;
  cappedNotice?: string;
  updatedState: {
    xpToday: number;
    xpWeek: number;
    totalXp: number;
    completedSteps: string[];
    xpAwardedSteps: string[];
    xpLogs: XPLogEntry[];
    lastXpResetDate?: string;
    xpWeekKey?: string;
  };
}

/**
 * Bộ khóa XP chuẩn (mô hình XP mới — chủ dự án duyệt 22/10/2026):
 * XP chỉ còn 3 nguồn — điểm danh ngày, hoàn thành toàn bộ chủ đề (quỹ XP của
 * chủ đề), và nộp bài kiểm tra/bài được giao (XP cấu hình trên từng bài).
 * KHÔNG còn trần ngày/tuần và KHÔNG còn cộng XP theo từng hành động lẻ.
 */
export const XP_KEYS = {
  attendance: (dateStr: string) => `attendance:${dateStr}`,
  topicComplete: (topicId: string) => `topic:${topicId}:complete`,
  assignmentSubmitted: (assignmentId: string) => `assignment:${assignmentId}:submitted`,
  quizCompleted: (quizId: string) => `quiz:${quizId}:completed`,
};

/**
 * Cộng XP cho một hành động có khóa duy nhất. Mỗi khóa chỉ được trả XP đúng
 * một lần (trừ khi forceAllowRepeat — dùng cho điểm danh theo ngày, khóa đã
 * chứa ngày nên thực tế cũng không trùng). Không áp bất kỳ trần nào.
 */
export function awardXP(
  state: StudentState,
  actionKey: string,
  rawXp: number,
  actionName: string,
  forceAllowRepeat = false
): XPCalculationResult {
  // Lật ngày/tuần: bộ đếm hôm nay/tuần này chỉ còn hiệu lực nếu mốc khớp hiện tại.
  const todayStr = getLocalTodayStr();
  const weekKey = getWeekKey();
  const baseXpToday = state.lastXpResetDate === todayStr ? state.xpToday : 0;
  const baseXpWeek = state.xpWeekKey === weekKey ? state.xpWeek : 0;
  const awardedSteps = state.xpAwardedSteps ?? state.completedSteps;
  const isFirstTime = !awardedSteps.includes(actionKey);

  // Mỗi khóa chỉ cộng XP lần đầu hoàn thành
  if (!isFirstTime && !forceAllowRepeat) {
    return {
      stepKey: actionKey,
      isFirstTime: false,
      rawXp,
      actualXp: 0,
      reason: 'Mục này đã được nhận XP trước đó.',
      updatedState: {
        xpToday: baseXpToday,
        xpWeek: baseXpWeek,
        totalXp: state.totalXp,
        completedSteps: state.completedSteps,
        xpAwardedSteps: awardedSteps,
        xpLogs: state.xpLogs,
        lastXpResetDate: todayStr,
        xpWeekKey: weekKey,
      },
    };
  }

  const amount = Math.max(0, Math.floor(rawXp || 0));
  const log: XPLogEntry = {
    id: 'xp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
    actionName,
    rawXp: amount,
    actualXp: amount,
    reason: actionName,
  };

  const newCompletedSteps = state.completedSteps.includes(actionKey)
    ? state.completedSteps
    : [...state.completedSteps, actionKey];
  const newAwardedSteps =
    amount > 0 && !awardedSteps.includes(actionKey)
      ? [...awardedSteps, actionKey]
      : awardedSteps;

  return {
    stepKey: actionKey,
    isFirstTime,
    rawXp: amount,
    actualXp: amount,
    reason: `Hoàn thành: ${actionName}`,
    updatedState: {
      xpToday: baseXpToday + amount,
      xpWeek: baseXpWeek + amount,
      totalXp: state.totalXp + amount,
      completedSteps: newCompletedSteps,
      xpAwardedSteps: newAwardedSteps,
      xpLogs: amount > 0 ? [log, ...state.xpLogs].slice(0, 50) : state.xpLogs,
      lastXpResetDate: todayStr,
      xpWeekKey: weekKey,
    },
  };
}

/**
 * Ghi nhận một bước học đã hoàn thành (để tính hoàn thành chủ đề, cây học
 * tập…) mà KHÔNG cộng XP — thay cho các điểm cộng XP lẻ trước đây ở luồng
 * Video/Lý thuyết. Trả về phần state cần hợp nhất vào StudentState.
 */
export function recordStepCompletion(
  state: StudentState,
  stepKey: string
): XPCalculationResult['updatedState'] {
  const todayStr = getLocalTodayStr();
  const weekKey = getWeekKey();
  const baseXpToday = state.lastXpResetDate === todayStr ? state.xpToday : 0;
  const baseXpWeek = state.xpWeekKey === weekKey ? state.xpWeek : 0;
  return {
    xpToday: baseXpToday,
    xpWeek: baseXpWeek,
    totalXp: state.totalXp,
    completedSteps: state.completedSteps.includes(stepKey)
      ? state.completedSteps
      : [...state.completedSteps, stepKey],
    xpAwardedSteps: state.xpAwardedSteps ?? state.completedSteps,
    xpLogs: state.xpLogs,
    lastXpResetDate: todayStr,
    xpWeekKey: weekKey,
  };
}
