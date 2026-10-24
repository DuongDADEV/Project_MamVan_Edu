import { SkillLevel, MasteryStatus, QuestionResult, EssaySubmission, StudentState } from '../types.ts';
import { StudentAccount, ClassItem, TopicWithMeta } from '../services/types.ts';

export type TimeRangeOption = '7d' | '30d' | 'this_week' | '6w' | 'custom';

export interface AnalyticsFilter {
  classIds: string[]; // ['all'] hoặc mảng class_id
  timeRange: TimeRangeOption;
  customDateRange?: [number, number]; // [startTimestamp, endTimestamp]
  topicId: string; // 'all' hoặc topic_id cụ thể
  studentIds: string[]; // [] = tất cả
  skillLevels: SkillLevel[]; // [] = cả 4 mức
  activityType: string; // 'all' | 'video' | 'theory' | 'practice' | 'quiz_quick' | 'mastery_check' | 'homework' | 'essay'
}

export type GlobalAnalyticsFilter = AnalyticsFilter;

export interface OverviewMetricsData {
  active7DaysCount: number;
  active7DaysDiffPercent: number | null; // So với 7 ngày trước; null = không có dữ liệu kỳ trước (ẩn huy hiệu, không bịa %)
  completionRatePercent: number; // Trên tổng số bước học thật của các chủ đề trong phạm vi
  completionRateDiffPercent: number | null;
  averageScore: number; // 0..10
  averageScoreDiff: number | null;
  avgActiveMinutes: number; // Phút học tích cực TB/học sinh từ giây hoạt động ghi thật trong state
  avgActiveMinutesDiff: number | null;
  pendingGradingCount: number;
  pendingRewardCount: number;
}

export interface StudentAttentionItem {
  studentId: string;
  studentName: string;
  className: string;
  avatarSeed: string;
  severity: 'high' | 'medium';
  reasonTag: string; // '5 ngày chưa đăng nhập' | 'Mastery Phân tích < 50%' | 'Làm bài quá nhanh điểm thấp' | 'Học tập thất thường'
  reasonDetail: string;
  suggestedAction: string;
  lastActiveText: string;
  weakTopicTitle?: string;
  averageScore?: number;
}

export interface PedagogicalInsight {
  id: string;
  type: 'strength' | 'weakness' | 'trend' | 'recommendation';
  text: string;
  highlightText?: string;
}

export interface ScoreDistributionBucket {
  rangeLabel: string; // '0 - 4.9 (Chưa đạt)', '5.0 - 6.4 (Trung bình)', '6.5 - 7.9 (Khá)', '8.0 - 10 (Giỏi)'
  count: number;
  percentage: number;
  color: string;
  // Danh sách học sinh trong khoảng (24/10 — để trợ lý trả lời được câu hỏi
  // "tên học sinh điểm khá" bằng tên thật thay vì chỉ trả số lượng).
  hocSinh?: { id: string; ten: string; diemTB: number }[];
}

export interface TopicScoreComparison {
  topicId: string;
  topicTitle: string;
  averageScore: number;
  attemptCount: number;
  passRate: number; // 0..100
}

export interface TypeScoreComparison {
  typeKey: string;
  typeName: string;
  averageScore: number;
  totalAttempts: number;
}

export interface WeeklyScoreTrend {
  weekLabel: string; // 'Tuần 1', 'Tuần 2'...
  weekTimestamp: number;
  averageScore: number;
  attemptCount: number;
}

export interface ClassComparisonItem {
  classId: string;
  className: string;
  studentCount: number;
  averageScore: number;
  passRate: number; // % >= 5.0
  activeMinutesPerWeek: number; // Phút học tích cực TB/HS tính từ giây học ghi thật (không chia theo tuần)
  solidMasteryRate: number; // % học sinh đạt Vững
}

export interface StudentRankingRow {
  rank: number;
  studentId: string;
  studentName: string;
  className: string;
  studentCode: string;
  averageScore: number;
  totalAttempts: number;
  masteryStatus: MasteryStatus;
  statusLabel: string;
  activeMinutesTotal: number;
  totalXp: number;
}

export interface RadarMasteryItem {
  level: SkillLevel;
  levelName: string; // 'Nhớ được', 'Hiểu được', 'Phân tích được', 'Vận dụng được'
  classAverage: number; // 0..100%
  targetGoal: number; // 80%
  selectedStudentScore?: number; // 0..100% (nếu chọn học sinh)
}

export interface HeatmapCell {
  studentId: string;
  studentName: string;
  className: string;
  topicId: string;
  topicTitle: string;
  status: MasteryStatus;
  percentage: number;
  statusLabel: string;
  attemptCount: number;
}

export interface WeakSkillRecommendation {
  topicId: string;
  topicTitle: string;
  weakestLevel: SkillLevel;
  levelName: string;
  averagePercentage: number;
  studentWeakCount: number;
  pedagogicalAdvice: string;
}

export interface QuestionAnalyticsItem {
  questionId: string;
  prompt: string;
  level: SkillLevel;
  type: string;
  topicId: string;
  topicTitle: string;
  totalAttempts: number;
  correctCount: number;
  accuracyRate: number; // 0..100%
  avgTimeSeconds: number;
  mostChosenDistractor?: { option: string; count: number; percentage: number };
  flag?: 'too_hard' | 'too_easy' | 'possible_flaw';
  flagLabel?: string;
}

export interface DailyActiveTimePoint {
  dateLabel: string; // '22/09', '23/09'...
  timestamp: number;
  // Số học sinh có điểm danh trong ngày — nguồn thật duy nhất theo ngày mà
  // state ghi được. Hệ thống KHÔNG lưu giây học theo từng ngày nên tuyệt đối
  // không suy diễn "phút học/ngày" từ số ngày điểm danh.
  studentActiveCount: number;
}

export interface WeeklyAttendancePoint {
  weekLabel: string;
  attendanceRate: number; // %
}

export interface FunnelStepItem {
  stepKey: string;
  stepName: string;
  studentCount: number;
  percentage: number; // 100%, 88%, 76%...
  dropOffPercentage: number;
}

export interface VideoAnalyticsSummary {
  completionRateOver80: number; // % học sinh xem >= 80%
  averageWatchSeconds: number;
  rewatchHotspots: { rangeLabel: string; count: number; note: string }[];
}

export interface StudentProfileFullData {
  account: StudentAccount;
  state: StudentState;
  className: string;
  rankInClass: number;
  totalStudentsInClass: number;
  radarScores: RadarMasteryItem[];
  topicMasteryList: {
    topicId: string;
    topicTitle: string;
    status: MasteryStatus;
    percentage: number;
    completedStepCount: number;
  }[];
  attemptHistory: {
    id: string;
    timestamp: number;
    quizTitle: string;
    topicTitle: string;
    score: number;
    maxScore: number;
    isPass: boolean;
    level: SkillLevel;
    questionPrompt: string;
    selectedAnswer?: string;
    correctAnswer?: string;
  }[];
  weeklyActivity: {
    weekLabel: string;
    // Chỉ số ngày điểm danh THẬT trong tuần. Hệ thống không lưu phút học theo
    // tuần nên không kèm trường phút suy diễn.
    daysAttended: number;
  }[];
  teacherNote: string;
}
