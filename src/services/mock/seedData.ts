import {
  ClassItem,
  StudentAccount,
  TeacherProfile,
  TopicWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  QuizWithMeta,
  QuestionWithMeta,
} from '../types.ts';
import {
  EssaySubmission,
  RewardItem,
  RewardRequest,
  StudentState,
  AIGradingConfig,
} from '../../types.ts';

export const SEED_TEACHERS: TeacherProfile[] = [];
export const SEED_CLASSES: ClassItem[] = [];
export const SEED_STUDENTS: StudentAccount[] = [];

export function getSeedTopics(): TopicWithMeta[] {
  return [];
}

export function getSeedVideos(): VideoLessonWithMeta[] {
  return [];
}

export function getSeedTheories(): TheoryLessonWithMeta[] {
  return [];
}

export function getSeedQuizzes(): QuizWithMeta[] {
  return [];
}

export function getSeedQuestions(): Record<string, QuestionWithMeta> {
  return {};
}

export function getSeedRewards(): RewardItem[] {
  return [];
}

export function getSeedStudentStates(): Record<string, StudentState> {
  return {};
}

// State trắng cho học sinh mới: hồ sơ chỉ mang thông tin THẬT của tài khoản.
// Tên lớp/trường KHÔNG có mặc định bịa — không tra được lớp thật thì để rỗng
// (trước đây mặc định 'Lớp 7A2' + trường cứng khiến hồ sơ học sinh lớp khác
// hiện sai lớp).
export function createFreshStudentState(account: StudentAccount, className = ''): StudentState {
  return {
    profile: {
      id: account.id,
      name: account.name,
      username: account.username,
      role: 'student',
      grade: className,
      school: '',
      avatarSeed: account.username,
    },
    xpToday: 0,
    xpWeek: 0,
    totalXp: 0,
    activeSecondsToday: 0,
    activeSecondsContinuous: 0,
    lastActiveTimestamp: Date.now(),
    lastAttendanceDate: '',
    attendanceDaysThisWeek: 0,
    attendanceHistory: [],
    consecutiveWeeks: 0,
    exemptDaysUsedThisWeek: 0,
    completedSteps: [],
    questionResults: [],
    flaggedNeedReviewTopicIds: [],
    essaySubmissions: [],
    rewardRequests: [],
    unlockedBadgeIds: [],
    xpLogs: [],
    soundEnabled: true,
    animationsEnabled: true,
    fontSizePreference: 'normal',
    themePreference: 'creative_edtech',
    devTimeMultiplier: 1,
    devDateOffsetDays: 0,
  };
}

// ĐÃ GỠ HẲN dữ liệu mẫu của Xưởng chấm AI (rà soát 22/10): bài mẫu chấm sẵn,
// rubric mẫu và nhật ký kiểm toán mẫu từng nằm ở đây dưới tên
// SEED_GRADED_SAMPLES / SEED_RUBRIC_TEMPLATES / SEED_AUDIT_LOGS. Thư viện
// mẫu + rubric nay mặc định RỖNG — chỉ hiện dữ liệu giáo viên tự tạo/lưu.

export const SEED_AI_GRADING_CONFIG: AIGradingConfig = {
  tone: 'encouraging',
  strictness: 3,
  mentionGoodPointsFirst: true,
  commentLength: 'medium',
  maxResponseHoursThreshold: 24,
};

