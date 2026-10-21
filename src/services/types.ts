/**
 * Định nghĩa hợp đồng (Interface Contract) cho toàn bộ Repository.
 * Độc lập hoàn toàn với localStorage hay Supabase.
 * Mọi hàm đều là async (trả về Promise) để sẵn sàng cắm Supabase.
 */

export type {
  Role,
  StudentProfile,
  StudentState,
  Topic,
  VideoLesson,
  TheoryLesson,
  Quiz,
  Question,
  QuestionResult,
  EssaySubmission,
  RewardItem,
  RewardRequest,
  RewardStatus,
  SkillLevel,
  Difficulty,
  QuestionType,
  QuizKind,
  RubricCriterion,
  VideoFocusPoint,
  TheoryBlock,
  TheoryBlockType,
  RubricTemplate,
  GradedSampleEssay,
  AIGradingConfig,
} from '../types.ts';

import type {
  Role,
  StudentProfile,
  StudentState,
  Topic,
  VideoLesson,
  TheoryLesson,
  Quiz,
  Question,
  QuestionResult,
  EssaySubmission,
  RewardItem,
  RewardRequest,
  RewardStatus,
  SkillLevel,
  RubricTemplate,
  GradedSampleEssay,
  AIGradingConfig,
} from '../types.ts';

// ========================
// 1. NGƯỜI DÙNG & PHÂN QUYỀN
// ========================

export interface TeacherProfile {
  id: string;
  name: string;
  username: string;
  // Khớp schema DB: teachers.role IN ('teacher','admin') — tài khoản Admin
  // thật cũng là một dòng trong bảng teachers (migration_006).
  role: 'teacher' | 'admin';
  email?: string;
  subject: string;
  school: string;
  classIds: string[];
  avatarUrl?: string;
  phone?: string;
  password?: string;
  status?: 'active' | 'locked' | 'trial';
  trialDays?: number;
  trialExpiresAt?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminProfile {
  id: string;
  name: string;
  username: string;
  role: 'admin';
  email?: string;
  avatarUrl?: string;
}

export type UserProfile = StudentProfile | TeacherProfile | AdminProfile;

export interface AuthSession {
  user: UserProfile;
  role: Role;
  token?: string;
  signedInAt: number;
}

export interface AuthRepository {
  signIn(role: Role, username: string, password: string): Promise<{
    success: boolean;
    session?: AuthSession;
    error?: string;
    isLocked?: boolean;
  }>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
}

export interface CreateTeacherInput {
  name: string;
  username?: string;
  password?: string;
  email?: string;
  phone?: string;
  school?: string;
  subject?: string;
  status?: 'active' | 'locked' | 'trial';
  trialDays?: number;
  notes?: string;
}

export interface TeacherRepository {
  getTeachers(): Promise<TeacherProfile[]>;
  getTeacherById(id: string): Promise<TeacherProfile | null>;
  createTeacher(data: CreateTeacherInput): Promise<TeacherProfile>;
  updateTeacher(id: string, data: Partial<TeacherProfile>): Promise<TeacherProfile>;
  deleteTeacher(id: string): Promise<void>;
  toggleLockTeacher(id: string, locked?: boolean): Promise<TeacherProfile>;
}

// ========================
// 2. LỚP HỌC
// ========================

export interface ClassItem {
  id: string; // UUID hoặc mã định danh lớp
  name: string; // VD: 7A2, 7A3
  grade: string; // Lớp 7
  schoolYear: string; // VD: 2026-2027
  teacherId: string; // gv001
  description?: string;
  studentCount: number;
  active7DaysCount: number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ClassRepository {
  getClasses(teacherId?: string): Promise<ClassItem[]>;
  getClassById(id: string): Promise<ClassItem | null>;
  createClass(data: Omit<ClassItem, 'id' | 'created_at' | 'updated_at' | 'studentCount' | 'active7DaysCount'>): Promise<ClassItem>;
  updateClass(id: string, data: Partial<ClassItem>): Promise<ClassItem>;
  archiveClass(id: string): Promise<void>;
}

// ========================
// 3. HỌC SINH & TÀI KHOẢN
// ========================

export interface StudentAccount {
  id: string; // UUID hoặc hs001
  name: string; // Họ và tên
  username: string; // Tên đăng nhập không dấu (vd: anhnm27)
  // KHÔNG lưu mật khẩu thô ở production! Dùng Supabase Auth. Trong mock lưu demo phục vụ đăng nhập.
  password_hash?: string;
  class_id: string;
  student_code?: string; // Mã học sinh trường cấp
  dob?: string; // Ngày sinh (YYYY-MM-DD)
  status: 'active' | 'locked';
  has_logged_in: boolean;
  last_active_at?: string | number | null;
  isDemoSeed?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreateStudentInput {
  name: string;
  class_id: string;
  student_code?: string;
  dob?: string;
  custom_username?: string;
  custom_password?: string;
}

export interface StudentCredentialVoucher {
  id: string;
  name: string;
  username: string;
  initialPassword: string; // Chỉ xuất hiện một lần tại màn cấp phiếu
  class_id: string;
  className?: string;
  student_code?: string;
}

export interface StudentRepository {
  getStudents(filter?: { classId?: string; search?: string; status?: 'active' | 'locked' | 'all' }): Promise<StudentAccount[]>;
  getStudentById(id: string): Promise<StudentAccount | null>;
  createStudent(data: CreateStudentInput, teacherActorId: string): Promise<{ student: StudentAccount; credential: StudentCredentialVoucher }>;
  createStudentsBatch(
    data: CreateStudentInput[],
    teacherActorId: string
  ): Promise<{ students: StudentAccount[]; credentials: StudentCredentialVoucher[] }>;
  updateStudent(id: string, data: Partial<StudentAccount>, teacherActorId: string): Promise<StudentAccount>;
  deleteStudent(id: string, teacherActorId: string): Promise<void>; // Xóa mềm
  resetPassword(id: string, teacherActorId: string, customNewPassword?: string): Promise<{ credential: StudentCredentialVoucher }>;
  toggleLock(id: string, isLocked: boolean, teacherActorId: string): Promise<StudentAccount>;
  changeClass(id: string, newClassId: string, teacherActorId: string): Promise<StudentAccount>;
}

// ========================
// 4. NỘI DUNG HỌC TẬP
// ========================

export interface ContentMetadata {
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  status: 'draft' | 'published' | 'archived';
  class_ids: string[]; // Gán cho lớp nào (['all'] hoặc ['class_7a2'])
  version: number;
  has_unpublished_edits?: boolean;
  published_at?: string;
}

export type TopicWithMeta = Topic & ContentMetadata;
export type VideoLessonWithMeta = VideoLesson & ContentMetadata;
export type TheoryLessonWithMeta = TheoryLesson & ContentMetadata;

export interface ContentRepository {
  getTopics(classId?: string, onlyPublished?: boolean): Promise<TopicWithMeta[]>;
  getTopicById(id: string): Promise<TopicWithMeta | null>;
  getVideoLessons(classId?: string, onlyPublished?: boolean): Promise<VideoLessonWithMeta[]>;
  getVideoLessonById(id: string): Promise<VideoLessonWithMeta | null>;
  getTheoryLessons(classId?: string, onlyPublished?: boolean): Promise<TheoryLessonWithMeta[]>;
  getTheoryLessonById(id: string): Promise<TheoryLessonWithMeta | null>;
  saveTopic(topic: Partial<TopicWithMeta>): Promise<TopicWithMeta>;
  saveVideoLesson(video: Partial<VideoLessonWithMeta>): Promise<VideoLessonWithMeta>;
  saveTheoryLesson(theory: Partial<TheoryLessonWithMeta>): Promise<TheoryLessonWithMeta>;
  deleteTopic(id: string, teacherActorId: string): Promise<void>;
  deleteVideoLesson(id: string, teacherActorId: string): Promise<void>;
  deleteTheoryLesson(id: string, teacherActorId: string): Promise<void>;
  reorderTopics(topicIds: string[]): Promise<void>;
  reorderTopicVideos(topicId: string, videoIds: string[]): Promise<void>;
  publishContent(
    type: 'topic' | 'video' | 'theory',
    id: string,
    options: { classIds: string[]; notifyStudent?: boolean },
    teacherActorId: string
  ): Promise<void>;
  unpublishContent(type: 'topic' | 'video' | 'theory', id: string, teacherActorId: string): Promise<void>;
  archiveContent(type: 'topic' | 'video' | 'theory', id: string, teacherActorId: string): Promise<void>;
  duplicateContent(type: 'topic' | 'video' | 'theory', id: string, teacherActorId: string): Promise<any>;
}

// ========================
// 5. BÀI TẬP & CÂU HỎI
// ========================

export type QuizWithMeta = Quiz & ContentMetadata;
export type QuestionWithMeta = Question & ContentMetadata;

export interface QuizRepository {
  getQuizzes(classId?: string, onlyPublished?: boolean): Promise<QuizWithMeta[]>;
  getQuizById(id: string): Promise<QuizWithMeta | null>;
  getQuestions(topicId?: string): Promise<Record<string, QuestionWithMeta>>;
  getQuestionById(id: string): Promise<QuestionWithMeta | null>;
  saveQuiz(quiz: Partial<QuizWithMeta>): Promise<QuizWithMeta>;
  saveQuestion(question: Partial<QuestionWithMeta>): Promise<QuestionWithMeta>;
  deleteQuiz(id: string, teacherActorId: string): Promise<void>;
  deleteQuestion(id: string, teacherActorId: string): Promise<void>;
  publishQuiz(
    id: string,
    options: { classIds: string[]; notifyStudent?: boolean },
    teacherActorId: string
  ): Promise<QuizWithMeta>;
  unpublishQuiz(id: string, teacherActorId: string): Promise<QuizWithMeta>;
  archiveQuiz(id: string, teacherActorId: string): Promise<QuizWithMeta>;
  duplicateQuiz(id: string, teacherActorId: string): Promise<QuizWithMeta>;
  hasStudentAttempts(quizId: string): Promise<boolean>;
}

// ========================
// 6. TIẾN ĐỘ, XP & LÀM BÀI (ATTEMPT)
// ========================

export interface AttemptRepository {
  getStudentState(studentId: string): Promise<StudentState>;
  saveStudentState(studentId: string, state: StudentState, sourceId?: string): Promise<void>;
  recordQuestionResult(studentId: string, result: QuestionResult): Promise<void>;
  recordAttendance(studentId: string, dateStr: string): Promise<void>;
  getAllStates(): Promise<Record<string, StudentState>>;
}

// ========================
// 7. BÀI TẬP VIẾT ĐOẠN VĂN (ESSAY)
// ========================

export interface EssayRepository {
  getSubmissions(filter?: {
    classId?: string;
    status?: 'PENDING_TEACHER' | 'AI_SUGGESTED' | 'GRADED' | 'ALL';
    studentId?: string;
    quizId?: string;
  }): Promise<EssaySubmission[]>;
  getSubmissionById(id: string): Promise<EssaySubmission | null>;
  createSubmission(submission: Omit<EssaySubmission, 'id' | 'submittedAt'>): Promise<EssaySubmission>;
  saveSubmissionDraft(
    id: string,
    draft: {
      rubricScores?: { criterionName: string; score: number; maxScore: number }[];
      teacherFeedback?: string;
    }
  ): Promise<EssaySubmission>;
  gradeSubmission(
    id: string,
    grading: {
      teacherFeedback: string;
      rubricScores: { criterionName: string; score: number; maxScore: number }[];
      totalScore: number;
      finalRatio: number;
      ai_vs_teacher_diff?: number;
    },
    teacherActorId: string
  ): Promise<EssaySubmission>;
  // Huấn luyện & Cấu hình AI
  getRubricTemplates(): Promise<RubricTemplate[]>;
  saveRubricTemplate(template: Partial<RubricTemplate>): Promise<RubricTemplate>;
  deleteRubricTemplate(id: string): Promise<void>;
  getGradedSamples(): Promise<GradedSampleEssay[]>;
  saveGradedSample(sample: Partial<GradedSampleEssay>): Promise<GradedSampleEssay>;
  deleteGradedSample(id: string): Promise<void>;
  getGradingConfig(): Promise<AIGradingConfig>;
  saveGradingConfig(config: Partial<AIGradingConfig>): Promise<AIGradingConfig>;
  getAIAccuracyMetrics(): Promise<{
    averageDiff: number;
    highDiffRatio: number;
    weeklyTrends: { week: string; diff: number; total: number }[];
    diffByCriterion: { name: string; diff: number }[];
  }>;
}

// ========================
// 8. PHẦN THƯỞNG (REWARDS)
// ========================

export interface EnrichedRewardRequest extends RewardRequest {
  studentId: string;
  studentName?: string;
  className?: string;
  classId?: string;
  xpWeekActual?: number;
  attendanceDaysActual?: number;
  isEligible?: boolean;
  reward?: RewardItem;
}

export interface RewardRepository {
  getRewards(): Promise<RewardItem[]>;
  saveReward(reward: Partial<RewardItem>): Promise<RewardItem>;
  deleteReward(id: string): Promise<void>;
  getRequests(filter?: { classId?: string; studentId?: string; status?: RewardStatus }): Promise<EnrichedRewardRequest[]>;
  createRequest(studentId: string, rewardId: string): Promise<RewardRequest>;
  updateRequestStatus(
    requestId: string,
    status: RewardStatus,
    reason?: string,
    teacherActorId?: string
  ): Promise<RewardRequest>;
  batchUpdateStatus(
    requestIds: string[],
    status: RewardStatus,
    reason?: string,
    teacherActorId?: string
  ): Promise<void>;
}

// ========================
// 9. CÀI ĐẶT HỆ THỐNG (SETTINGS)
// ========================

export interface SystemSettings {
  schoolInfo: {
    schoolName: string;
    academicYear: string;
    semester: string;
    classNameDefault: string;
  };
  mastery: {
    thresholdNeedsReview: number;
    thresholdProgressing: number;
    minQuestionsRequired: number;
    weightDecayFactor: number;
  };
  xp: {
    dailyCapUnder45Min: number;
    dailyCapTotal: number;
    weeklyCap: number;
    attendanceDailyXp: number;
    videoWatchXp: number;
    videoSummaryReadXp: number;
    videoPracticeXp: number;
    videoQuickTestXp: number;
    videoMasteryCheckXp: number;
    theoryReadXp: number;
    theoryPracticeXp: number;
    theoryTestXp: number;
    homeworkCompletedXp: number;
    reviewWeakAreaXp: number;
  };
  time: {
    idleLimitMinutes: number;
    breakReminderMinutes: number;
    minTheoryReadSeconds: number;
    minSummaryReadSeconds: number;
    essayReviewEstimatedHours: number;
  };
  notifications: {
    notifyPendingEssays: boolean;
    notifyPendingRewards: boolean;
    notifyInactiveStudents: boolean;
  };
}

export interface SettingRepository {
  getSettings(): Promise<SystemSettings>;
  updateSettings(settings: Partial<SystemSettings>, actorId?: string): Promise<SystemSettings>;
  resetGroup(group: 'general' | 'mastery' | 'xp' | 'time' | 'notifications'): Promise<SystemSettings>;
  resetAll(): Promise<SystemSettings>;
}

// ========================
// 10. NHẬT KÝ HOẠT ĐỘNG (AUDIT LOGS)
// ========================

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: Role;
  action: string; // VD: CREATE_STUDENT, RESET_PASSWORD, LOCK_STUDENT, PUBLISH_CONTENT, GRADE_ESSAY, REWARD_APPROVED, UPDATE_SETTINGS
  target_type: 'student' | 'class' | 'content' | 'quiz' | 'essay' | 'reward' | 'setting' | 'teacher';
  target_id: string;
  target_name: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface AuditRepository {
  log(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<void>;
  getLogs(filter?: {
    actorId?: string;
    targetType?: string;
    action?: string;
    search?: string;
    limit?: number;
  }): Promise<AuditLog[]>;
}
