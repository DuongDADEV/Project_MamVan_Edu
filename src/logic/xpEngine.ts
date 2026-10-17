import { XP_CONFIG, getEffectiveXpConfig } from '../config.ts';
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
 * Xác định trần XP hiện hành dựa trên số phút học tích cực trong ngày
 */
export function getCurrentDailyXpCap(activeMinutesToday: number): number {
  const cfg = getEffectiveXpConfig();
  if (activeMinutesToday >= cfg.DAILY_ACTIVE_MINUTES_LIMIT) {
    // Quá 90 phút: không cộng thêm
    return cfg.DAILY_CAP_TOTAL;
  }
  if (activeMinutesToday >= 45) {
    // 45 - 90 phút: tổng trần là 150 (hoặc cấu hình)
    return cfg.DAILY_CAP_TOTAL;
  }
  // 0 - 45 phút: trần là 130 (hoặc cấu hình)
  return cfg.DAILY_CAP_UNDER_45_MIN;
}

/**
 * Tính toán và cộng XP theo hành động học tập
 */
export function awardXP(
  state: StudentState,
  actionKey: string,
  rawXp: number,
  actionName: string,
  forceAllowRepeat = false
): XPCalculationResult {
  // Lật ngày/tuần: bộ đếm hôm nay/tuần này chỉ còn hiệu lực nếu mốc khớp hiện tại.
  // (App cũng lật khi nạp state; ở đây lật phòng thủ để phiên mở qua nửa đêm vẫn đúng.)
  const todayStr = getLocalTodayStr();
  const weekKey = getWeekKey();
  const baseXpToday = state.lastXpResetDate === todayStr ? state.xpToday : 0;
  const baseXpWeek = state.xpWeekKey === weekKey ? state.xpWeek : 0;
  // "Lần đầu" cho mục đích TRẢ XP xét theo xpAwardedSteps (state cũ chưa có
  // trường này thì dùng completedSteps như trước)
  const awardedSteps = state.xpAwardedSteps ?? state.completedSteps;
  const isFirstTime = !awardedSteps.includes(actionKey);

  // Quy tắc 1: Mỗi mục chỉ cộng XP lần đầu hoàn thành
  if (!isFirstTime && !forceAllowRepeat) {
    return {
      stepKey: actionKey,
      isFirstTime: false,
      rawXp,
      actualXp: 0,
      reason: `Bạn đã hoàn thành mục này trước đó. Luyện tập thêm rất tốt nhưng không cộng thêm XP để tránh áp lực điểm số.`,
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

  const activeMinutes = Math.floor((state.lastXpResetDate === todayStr ? state.activeSecondsToday : 0) / 60);
  const cfg = getEffectiveXpConfig();

  // Kiểm tra nếu học quá 90 phút trong ngày
  if (activeMinutes >= cfg.DAILY_ACTIVE_MINUTES_LIMIT) {
    const log: XPLogEntry = {
      id: 'xp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      actionName,
      rawXp,
      actualXp: 0,
      reason: 'Học quá 90 phút tích cực hôm nay',
      cappedNotice: 'Hôm nay bạn đã học rất chăm chỉ rồi! Hệ thống tạm dừng cộng XP để bạn nghỉ ngơi, nhưng bài học vẫn được ghi nhận trọn vẹn vào Cây và Năng lực nhé!',
    };

    return {
      stepKey: actionKey,
      isFirstTime: true,
      rawXp,
      actualXp: 0,
      reason: 'Đạt trần 90 phút học trong ngày',
      cappedNotice: log.cappedNotice,
      updatedState: {
        xpToday: baseXpToday,
        xpWeek: baseXpWeek,
        totalXp: state.totalXp,
        // Tiến độ học VẪN được ghi nhận (Cây/Năng lực tính bình thường) nhưng
        // bước chưa vào xpAwardedSteps — hôm sau làm lại sẽ được trả XP 1 lần.
        completedSteps: state.completedSteps.includes(actionKey)
          ? state.completedSteps
          : [...state.completedSteps, actionKey],
        xpAwardedSteps: awardedSteps,
        xpLogs: [log, ...state.xpLogs].slice(0, 50),
        lastXpResetDate: todayStr,
        xpWeekKey: weekKey,
      },
    };
  }

  // Tính trần ngày
  const dailyCap = getCurrentDailyXpCap(activeMinutes);
  const remainingDaily = Math.max(0, dailyCap - baseXpToday);

  // Tính trần tuần
  const remainingWeekly = Math.max(0, cfg.WEEKLY_XP_CAP - baseXpWeek);

  // XP thực nhận bị chặn bởi trần ngày và trần tuần
  let actualXp = Math.min(rawXp, remainingDaily, remainingWeekly);
  if (actualXp < 0) actualXp = 0;

  let cappedNotice: string | undefined;
  if (actualXp < rawXp) {
    if (remainingDaily <= 0) {
      cappedNotice = `Bạn đã đạt trần ${dailyCap} XP của hôm nay! Việc học vẫn được tính vào Cây lớn và Năng lực, mai chúng mình tích thêm XP nhé.`;
    } else if (remainingWeekly <= 0) {
      cappedNotice = `Tuyệt vời! Bạn đã đạt trần tuần ${cfg.WEEKLY_XP_CAP} XP để đổi quà. Nghỉ ngơi hoặc tiếp tục nuôi Cây Văn nhé!`;
    } else {
      cappedNotice = `Nhận ${actualXp}/${rawXp} XP do chạm giới hạn trần (${dailyCap} XP ngày).`;
    }
  }

  const log: XPLogEntry = {
    id: 'xp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
    actionName,
    rawXp,
    actualXp,
    reason: actionName,
    cappedNotice,
  };

  const newCompletedSteps = state.completedSteps.includes(actionKey)
    ? state.completedSteps
    : [...state.completedSteps, actionKey];
  // Chỉ đánh dấu "đã trả XP" khi thực sự trả > 0; chạm trần (0 XP) thì lần sau
  // làm lại vẫn được trả đúng một lần
  const newAwardedSteps =
    actualXp > 0 && !awardedSteps.includes(actionKey)
      ? [...awardedSteps, actionKey]
      : awardedSteps;

  return {
    stepKey: actionKey,
    isFirstTime,
    rawXp,
    actualXp,
    reason: `Hoàn thành: ${actionName}`,
    cappedNotice,
    updatedState: {
      xpToday: baseXpToday + actualXp,
      xpWeek: baseXpWeek + actualXp,
      totalXp: state.totalXp + actualXp,
      completedSteps: newCompletedSteps,
      xpAwardedSteps: newAwardedSteps,
      xpLogs: [log, ...state.xpLogs].slice(0, 50),
      lastXpResetDate: todayStr,
      xpWeekKey: weekKey,
    },
  };
}
