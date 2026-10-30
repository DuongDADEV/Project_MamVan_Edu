/**
 * Mô hình dữ liệu TypeScript cho Nền tảng học Ngữ văn 7 "Vở Mực"
 */

export type Role = 'student' | 'teacher' | 'parent' | 'admin';

export type SkillLevel = 'NHAN_BIET' | 'THONG_HIEU' | 'PHAN_TICH' | 'VAN_DUNG';

export type QuestionType = 'single' | 'multi' | 'fill' | 'essay';

export type Difficulty = 'DE' | 'TB' | 'KHO';

export type MascotMood = 'happy' | 'cheer' | 'thinking' | 'sleepy' | 'proud' | 'waiting';

export type ThemeId = 'creative_edtech' | 'mam_van_nature' | 'paper_ink' | 'lotus_bamboo' | 'kraft_amber' | 'autumn_sky';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  description: string;
  palette: {
    primaryTitle: string;
    accentAction: string;
    backgroundPage: string;
    backgroundCard: string;
    borderColor: string;
    successSage: string;
  };
}

export type { ClassItem } from './services/types.ts';

export interface RubricCriterion {
  id?: string;
  name: string;
  description: string;
  maxScore?: number;
  maxPoints?: number;
  weight?: number;
}

export interface Question {
  id: string;
  type: QuestionType;
  level: SkillLevel;
  difficulty: Difficulty;
  prompt: string;
  passage?: string; // Ngữ liệu/đoạn trích ngắn đính kèm đề bài
  imageUrl?: string; // Hình ảnh minh họa câu hỏi
  options?: string[]; // Cho single và multi
  answer?: string | string[]; // Single: "A", Multi: ["A", "C"], Fill: ["chữ 1", "chữ 2"]
  fillBlanksCount?: number; // Số ô trống cần điền
  explanation: string;
  rubric?: RubricCriterion[]; // Cho essay
  sampleEssay?: string; // Đoạn văn gợi ý tham khảo sau khi chấm
  topicId: string;
  subtopic?: string;
  points?: number; // Điểm của câu (mặc định 10)
  allowPartialCredit?: boolean; // Tùy chọn chấm điểm từng phần cho chọn nhiều đáp án
  enableAiGrading?: boolean; // Bật AI gợi ý chấm cho essay
  minWords?: number; // Số từ tối thiểu cho essay
  maxWords?: number; // Số từ tối đa cho essay
  aiSourceSnippet?: string; // Đoạn trích từ nguồn tham chiếu khi sinh bởi AI
  isAiGenerated?: boolean; // Cờ đánh dấu sinh bởi AI (cần giáo viên duyệt)
  isTeacherReviewed?: boolean; // Giáo viên đã duyệt nội dung do AI sinh
}

export type QuizKind = 'practice' | 'quick' | 'mastery' | 'reading' | 'final' | 'homework';

// Các loại quiz nội dung được tính là "Kiểm tra" — làm 1 lần, lần sau chỉ xem
// lại (không tính điểm mới, không cộng XP). BTVN (homework) và các loại còn
// lại không giới hạn số lần làm. Dùng chung cho màn Bài tập và điểm chặn ở App.
export const TEST_QUIZ_KINDS: QuizKind[] = ['quick', 'mastery', 'final'];

export interface Quiz {
  id: string;
  title: string;
  kind: QuizKind;
  topicId: string;
  timeLimitMinutes?: number; // Không giới hạn nếu undefined
  questionIds: string[];
  xp: number;
  targetSkillLevels?: SkillLevel[];
  shuffleQuestions?: boolean; // Đảo thứ tự câu
  shuffleOptions?: boolean; // Đảo thứ tự đáp án
  dueDate?: string; // Hạn nộp cho BTVN
  assignedTo?: 'all' | 'custom'; // Giao cho cả lớp hoặc từng học sinh
  assignedStudentIds?: string[]; // Danh sách học sinh được giao cụ thể
  relatedVideoId?: string; // Video gắn kèm
}

export interface VideoFocusPoint {
  title: string;
  content: string;
  example?: string;
}

export type KeyPoint = VideoFocusPoint;

export interface VideoLesson {
  id: string;
  topicId: string;
  title: string;
  durationSec: number;
  sampleUrl?: string;
  thumbnailUrl?: string;
  subtopics: string[];
  summaryPoints: VideoFocusPoint[];
  practiceQuizId: string;
  quickTestId: string;
  masteryCheckId: string;
  description?: string;
}

export type TheoryBlockType = 'heading' | 'paragraph' | 'list' | 'example' | 'takeaway' | 'image';

export interface TheoryBlock {
  id: string;
  type: TheoryBlockType;
  level?: 2 | 3;
  content?: string;
  items?: string[];
  exampleText?: string;
  exampleAnalysis?: string;
  takeawayText?: string;
  imageUrl?: string;
  caption?: string;
}

export interface TheorySection {
  id: string;
  title: string;
  body: string[];
  example?: {
    text: string;
    analysis: string;
  };
  svgDiagramType?: 'so_sanh' | 'tu_lay' | 'tho_bon_nam' | 'doan_van';
  takeaway: string;
}

export interface TheoryLesson {
  id: string;
  topicId: string;
  title: string;
  minReadSeconds: number;
  kind?: 'summary_post_video' | 'general_topic'; // Tóm tắt sau video vs Lý thuyết chung chi tiết
  sections: TheorySection[];
  blocks?: TheoryBlock[]; // Danh sách khối trong trình soạn thảo khối
  practiceQuizId: string;
  testQuizId: string;
  test2QuizId?: string;
}

export type MasteryStatus = 'NEEDS_REVIEW' | 'PROGRESSING' | 'SOLID' | 'INSUFFICIENT_DATA';

export interface Topic {
  id: string;
  title: string;
  shortDesc: string;
  tag: string;
  videoIds: string[];
  theoryId: string;
  colorScheme: string;
  /** Thứ tự luồng học hỗn hợp trong chủ đề: các khóa "video:<id>" | "theory:<id>" | "quiz:<id>". */
  flowOrder?: string[];
  /** Quỹ XP giáo viên đặt cho chủ đề: học sinh nhận đủ một lần khi hoàn
      thành TOÀN BỘ chủ đề (xem 100% video, xong lý thuyết, đúng hết bài tập). */
  xpReward?: number;
}

export interface QuestionResult {
  questionId: string;
  level: SkillLevel;
  isCorrect: boolean;
  scoreRatio: number; // 0..1 (cho partial score / essay rubric)
  timestamp: number;
  topicId: string;
}

export interface EssaySubmission {
  id: string;
  questionId: string;
  studentId: string;
  submittedAt: number;
  content: string;
  wordCount: number;
  status: 'PENDING_TEACHER' | 'AI_SUGGESTED' | 'GRADED';
  quizId?: string;
  answerId?: string; // id đáp án của phiếu review (đường list hoãn tải text — mở chi tiết mới fetch qua getReviewAnswerContent)
  quizTitle?: string;
  classId?: string;
  studentName?: string;
  className?: string;
  questionPrompt?: string;
  promptTitle?: string;
  passage?: string;
  sampleAnswer?: string;
  sampleEssay?: string;
  minWords?: number;
  maxWords?: number;
  rubric?: RubricCriterion[];
  skillLevel?: SkillLevel; // 'PHAN_TICH' | 'VAN_DUNG'
  hoursWaiting?: number;
  teacherFeedback?: string;
  rubricScores?: { criterionName: string; score: number; maxScore: number; reason?: string; comment?: string }[];
  totalScore?: number;
  finalScore?: number;
  finalComment?: string;
  gradedAt?: number;
  finalRatio?: number; // 0..1
  aiSuggestion?: {
    rubricScores: { criterionId?: string; criterionName: string; score: number; maxScore: number; reason: string }[];
    overallComment: string;
    suggestedTotalScore: number;
    suggestedAt: string;
  };
  ai_vs_teacher_diff?: number; // Chênh lệch giữa điểm AI gợi ý và điểm giáo viên chốt
  teacherDraft?: {
    rubricScores?: { criterionName: string; score: number; maxScore: number }[];
    teacherFeedback?: string;
  };
}

export interface RubricTemplate {
  id: string;
  title: string;
  category: 'cam_nghi' | 'phan_tich_nhan_vat' | 'tu_tu_so_sanh' | 'nghi_luan_xa_hoi' | 'doc_hieu';
  description: string;
  criteria: { id: string; name: string; description: string; weight: number }[];
  isDefault?: boolean;
  createdAt: string;
}

export interface GradedSampleEssay {
  id: string;
  title: string;
  topicPrompt: string;
  studentContent: string;
  levelGrade: 'poor' | 'average' | 'good' | 'excellent'; // Kém / Trung bình / Khá / Tốt
  totalScore: number; // 0..10
  rubricScores: { criterionName: string; score: number; maxScore: number; comment?: string }[];
  teacherFeedback: string;
  isFromStudentSubmission?: boolean;
  createdAt: string;
}

export interface AIGradingConfig {
  tone: 'encouraging' | 'neutral' | 'strict';
  strictness: number; // 1..5
  mentionGoodPointsFirst?: boolean;
  praiseStrengthsFirst?: boolean;
  commentLength?: 'short' | 'medium' | 'detailed';
  feedbackLength?: 'short' | 'medium' | 'detailed';
  anonymizeStudentData?: boolean;
  maxResponseHoursThreshold?: number; // Mặc định 24h hoặc 48h để cảnh báo màu vàng
}

export interface XPLogEntry {
  id: string;
  timestamp: number;
  actionName: string;
  rawXp: number;
  actualXp: number;
  reason: string;
  cappedNotice?: string;
}

export type ChestTierKey = 'HAT' | 'LA' | 'HOA' | 'VANG';

export interface RewardTierSecret {
  name: string;
  description: string;
}

export interface RewardTier {
  id: string;
  requiredXp: number;
  requiredAttendanceDays: number;
  tierKey: ChestTierKey;
  teaserDescription: string;
  secret: RewardTierSecret;
  xpCost: number; // Mức XP tuần (đồng bộ với requiredXp)
  isPhysical?: boolean;
  name?: string; // Tên dự phòng (không dùng cho học sinh trước khi mở)
  description?: string;
  stock?: number; // Số lượng còn lại (tùy chọn)
  isActive?: boolean; // Bật/tắt hiển thị cho học sinh
  teacherId?: string; // GV tạo mốc (hướng c 24/10); undefined = mốc cũ chưa gắn dấu
}

export type RewardItem = RewardTier;

export type RewardStatus = 'LOCKED' | 'ELIGIBLE' | 'PENDING_APPROVAL' | 'APPROVED' | 'GIVEN' | 'OPENED' | 'REJECTED';

export interface RewardRequest {
  id: string;
  rewardId: string;
  requestedAt: number;
  status: RewardStatus;
  // XP đã TRỪ vào TỔNG XP của tài khoản khi gửi yêu cầu (chốt 18/10/2026:
  // đổi quà trừ XP của acc — XP vĩnh viễn, chỉ giảm khi xin quà).
  // > 0 nghĩa là đang giữ số XP này; khi bị TỪ CHỐI sẽ hoàn lại và đặt về 0.
  // (Mốc mở rương vẫn xét theo XP tuần như thiết kế; chỉ ví chi tiêu là tổng XP.)
  deductedXp?: number;
  rejectReason?: string;
  approvedAt?: number;
  givenAt?: number;
  openedAt?: number;
}

export interface Badge {
  id: string;
  title: string;
  desc: string;
  category: 'xp' | 'attendance' | 'mastery' | 'progress';
  unlockedAt?: number;
  iconType: 'star_ink' | 'streak_fire' | 'book_sprout' | 'analysis_feather' | 'solid_tree' | 'overcome_mountain';
}

export interface StudentProfile {
  id: string;
  name: string;
  username: string;
  role: 'student';
  grade: string;
  school: string;
  avatarSeed: string;
}

export interface StudentState {
  profile: StudentProfile;
  
  // XP & Thời gian
  xpToday: number;
  xpWeek: number;
  totalXp: number;
  // Mốc lật ngày/tuần cho bộ đếm XP (YYYY-MM-DD giờ địa phương; tuần = ngày thứ Hai)
  lastXpResetDate?: string;
  xpWeekKey?: string;
  activeSecondsToday: number;
  activeSecondsContinuous: number;
  lastActiveTimestamp: number;
  
  // Điểm danh
  lastAttendanceDate: string; // YYYY-MM-DD
  attendanceDaysThisWeek: number;
  attendanceHistory: string[]; // Danh sách YYYY-MM-DD
  consecutiveWeeks: number;
  exemptDaysUsedThisWeek: number;
  
  // Bước học đã hoàn thành lần đầu (Set lưu dạng mảng chuỗi)
  // Ví dụ: 'video_watch:v1', 'summary_read:v1', 'quiz_completed:q1', 'theory_understood:t1'
  completedSteps: string[];
  // Các bước ĐÃ ĐƯỢC TRẢ XP thật (tách khỏi completedSteps = tiến độ học):
  // một bước học lúc chạm trần XP vẫn tính tiến độ nhưng chưa được trả XP,
  // hôm sau làm lại sẽ được trả đúng một lần. State cũ không có trường này
  // thì coi completedSteps là đã trả (giữ nguyên chống farm như trước).
  xpAwardedSteps?: string[];
  
  // Lịch sử trả lời câu hỏi để tính Mastery
  questionResults: QuestionResult[];
  
  // Danh sách chủ đề học sinh tự đánh dấu "Chưa hiểu"
  flaggedNeedReviewTopicIds: string[];
  
  // Bài viết nộp chờ chấm
  essaySubmissions: EssaySubmission[];
  
  // Quà tặng
  rewardRequests: RewardRequest[];
  
  // Huy hiệu
  unlockedBadgeIds: string[];
  
  // Nhật ký XP
  xpLogs: XPLogEntry[];
  
  // Cài đặt cá nhân
  soundEnabled: boolean;
  animationsEnabled: boolean;
  fontSizePreference: 'normal' | 'large' | 'larger';
  // Id các thông báo "có bài mới" học sinh đã xem (đồng bộ theo tài khoản)
  seenNotificationIds?: string[];
  themePreference?: ThemeId;
  
  // Đang học dở (để nút "Học tiếp" dẫn đến đúng chỗ)
  // null = đã xóa con trỏ (xong bài) — khác undefined (giữ giá trị cũ khi PUT).
  currentProgress?: {
    type: 'video' | 'theory' | 'quiz' | 'homework';
    topicId: string;
    itemId: string;
    stepIndex: number;
    // Khóa của bước (ổn định hơn stepIndex khi GV thêm/bớt bài tập liên kết
    // làm thứ tự bước thay đổi — khôi phục ưu tiên theo khóa này)
    stepKey?: string;
    videoSeconds?: number;
  } | null;

  // Giả lập thời gian cho Dev Panel
  devTimeMultiplier: number; // 1, 10, 60
  devDateOffsetDays: number; // +/- ngày

  // Ghi chú sư phạm riêng của giáo viên & nhãn demo seed
  teacherNotes?: string;
  isDemoSeed?: boolean;
}
