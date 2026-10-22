import {
  AnalyticsFilter,
  DailyActiveTimePoint,
  WeeklyAttendancePoint,
  FunnelStepItem,
  VideoAnalyticsSummary,
} from './types.ts';
import { StudentState } from '../types.ts';
import { StudentAccount } from '../services/types.ts';
import { filterStudents, filterStudentStates, getFilterDateRange } from './filterUtils.ts';
import { countLearningSteps } from '../logic/studentStateUtils.ts';

const ONE_DAY = 86400000;
const ONE_WEEK = 7 * ONE_DAY;

/**
 * Hoạt động học theo ngày (LineChart): số học sinh có điểm danh trong ngày.
 * State chỉ ghi attendanceHistory theo ngày + giây học của NGÀY HIỆN TẠI —
 * không có phút học theo từng ngày trong quá khứ, nên không suy diễn phút
 * từ số học sinh có mặt (trước đây cộng cứng 32 phút/HS là số bịa).
 */
export function computeDailyALT(
  allStates: Record<string, StudentState>,
  allStudents: StudentAccount[],
  filter: AnalyticsFilter
): DailyActiveTimePoint[] {
  const students = filterStudents(allStudents, filter);
  const studentIds = new Set(students.map((s) => s.id));
  const states = filterStudentStates(allStates, studentIds);
  const dateRange = getFilterDateRange(filter);

  const points: DailyActiveTimePoint[] = [];
  const daysCount = Math.min(14, Math.max(7, Math.round((dateRange[1] - dateRange[0]) / ONE_DAY)));

  for (let i = daysCount - 1; i >= 0; i--) {
    const dayTimestamp = dateRange[1] - i * ONE_DAY;
    const dObj = new Date(dayTimestamp);
    const dateLabel = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`;
    const ymd = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;

    let studentActiveCount = 0;

    Object.values(states).forEach((st) => {
      if (st.attendanceHistory?.includes(ymd)) {
        studentActiveCount++;
      }
    });

    points.push({
      dateLabel,
      timestamp: dayTimestamp,
      studentActiveCount,
    });
  }

  return points;
}

/**
 * Chuỗi ngày điểm danh liên tục dài nhất từ attendanceHistory thật
 * (danh sách ngày 'YYYY-MM-DD'). Không có ngày nào -> 0.
 */
export function computeLongestAttendanceStreak(attendanceHistory?: string[]): number {
  const days = Array.from(new Set(attendanceHistory || [])).sort();
  let longest = 0;
  let run = 0;
  let prevMs: number | null = null;
  days.forEach((d) => {
    const t = new Date(d + 'T00:00:00').getTime();
    if (Number.isNaN(t)) return;
    run = prevMs !== null && t - prevMs === ONE_DAY ? run + 1 : 1;
    if (run > longest) longest = run;
    prevMs = t;
  });
  return longest;
}

/**
 * Tỉ lệ điểm danh theo tuần
 */
export function computeWeeklyAttendance(
  allStates: Record<string, StudentState>,
  filter: AnalyticsFilter
): WeeklyAttendancePoint[] {
  // Tính từ attendanceHistory THẬT của học sinh cho 6 tuần gần nhất (thứ Hai -> Chủ nhật):
  // tỉ lệ = số học sinh có ít nhất 1 ngày điểm danh trong tuần / tổng số học sinh.
  // (Khái niệm "chạm trần XP tuần 900" đã bị bãi bỏ cùng mô hình trần XP —
  // không còn đếm ở đây nữa.)
  const states = Object.values(allStates || {});
  const totalStudents = Math.max(1, states.length);
  const points: WeeklyAttendancePoint[] = [];
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  for (let w = 5; w >= 0; w--) {
    const weekStart = new Date(monday);
    weekStart.setDate(weekStart.getDate() - w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const startMs = weekStart.getTime();
    const endMs = weekEnd.getTime();

    let attended = 0;
    states.forEach((st) => {
      const days = (st.attendanceHistory || []).filter((d) => {
        const t = new Date(d + 'T00:00:00').getTime();
        return t >= startMs && t < endMs;
      });
      if (days.length > 0) attended++;
    });

    points.push({
      weekLabel: `Tuần ${6 - w}`,
      attendanceRate: Math.round((attended / totalStudents) * 100),
    });
  }
  return points;
}

/**
 * Phễu học tập (Learning Funnel) đo độ rơi rụng qua các bước — đếm từ
 * completedSteps THẬT của học sinh, không dùng tỉ lệ mẫu.
 */
export function computeLearningFunnel(
  allStates: Record<string, StudentState>,
  studentsCount: number
): FunnelStepItem[] {
  const states = Object.values(allStates || {});
  const base = Math.max(1, studentsCount);
  const countWithPrefix = (prefixes: string[]) =>
    states.filter((st) => (st.completedSteps || []).some((step) => prefixes.some((p) => step.startsWith(p)))).length;

  const defs: { stepKey: string; stepName: string; prefixes: string[] }[] = [
    { stepKey: 'video', stepName: '1. Xem bài giảng Video', prefixes: ['video_watch:'] },
    { stepKey: 'summary', stepName: '2. Đọc Kiến thức trọng tâm', prefixes: ['summary_read:'] },
    { stepKey: 'theory', stepName: '3. Đọc lý thuyết', prefixes: ['theory_understood:'] },
    { stepKey: 'quiz', stepName: '4. Làm bài luyện tập / kiểm tra', prefixes: ['quiz_completed:'] },
    { stepKey: 'mastery_check', stepName: '5. Hoàn thành trọn luồng học', prefixes: ['video_flow_completed:', 'theory_flow_completed:'] },
  ];

  let prevCount: number | null = null;
  return defs.map((d) => {
    const studentCount = countWithPrefix(d.prefixes);
    const percentage = Math.round((studentCount / base) * 100);
    const dropOffPercentage = prevCount === null || prevCount === 0 ? 0 : Math.max(0, Math.round(((prevCount - studentCount) / prevCount) * 100));
    prevCount = studentCount;
    return { stepKey: d.stepKey, stepName: d.stepName, studentCount, percentage, dropOffPercentage };
  });
}

/**
 * Thống kê Video: Tỉ lệ xem >= 80% và đoạn xem lại nhiều
 */
export function computeVideoAnalytics(): VideoAnalyticsSummary {
  // Hệ thống chưa thu thập telemetry xem video theo đoạn — trả 0/danh sách rỗng
  // thay vì số liệu mẫu, để giáo viên không quyết định trên dữ liệu không tồn tại.
  return {
    completionRateOver80: 0,
    averageWatchSeconds: 0,
    rewatchHotspots: [],
  };
}

export interface TopicProgressItem {
  topicId: string;
  topicTitle: string;
  shortTitle: string;
  completionRate: number;
  completedStudentsCount: number;
}

/**
 * Tiến độ hoàn thành theo từng chủ đề của lớp (Horizontal BarChart)
 */
export function computeTopicProgressList(
  allStates: Record<string, StudentState>,
  allStudents: StudentAccount[],
  topics: Array<{ id: string; title: string }>,
  filter: AnalyticsFilter
): TopicProgressItem[] {
  const students = filterStudents(allStudents, filter);
  const studentIds = new Set(students.map((s) => s.id));
  const states = filterStudentStates(allStates, studentIds);
  const total = students.length;

  return topics.map((t) => {
    let completedCount = 0;
    if (total > 0) {
      students.forEach((s) => {
        const st = states[s.id];
        if (st && st.completedSteps && countLearningSteps(st.completedSteps) > 2) {
          completedCount++;
        }
      });
    }

    const rate = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const shortTitle = t.title.length > 18 ? t.title.slice(0, 16) + '...' : t.title;

    return {
      topicId: t.id,
      topicTitle: t.title,
      shortTitle,
      completionRate: rate,
      completedStudentsCount: completedCount,
    };
  });
}
