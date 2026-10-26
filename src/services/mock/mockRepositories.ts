import {
  AuthRepository,
  AuthSession,
  ClassRepository,
  ClassItem,
  StudentRepository,
  StudentAccount,
  CreateStudentInput,
  StudentCredentialVoucher,
  ContentRepository,
  TopicWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  QuizRepository,
  QuizWithMeta,
  QuestionWithMeta,
  AttemptRepository,
  EssayRepository,
  AIAccuracyMetrics,
  RewardRepository,
  EnrichedRewardRequest,
  SystemSettings,
  SettingRepository,
  AuditRepository,
  AuditLog,
  TeacherProfile,
  TeacherRepository,
  CreateTeacherInput,
} from '../types.ts';
import {
  SEED_TEACHERS,
  SEED_CLASSES,
  SEED_STUDENTS,
  getSeedTopics,
  getSeedVideos,
  getSeedTheories,
  getSeedQuizzes,
  getSeedQuestions,
  getSeedRewards,
  getSeedStudentStates,
  createFreshStudentState,
  SEED_AI_GRADING_CONFIG,
} from './seedData.ts';
import {
  generateUsername,
  generateFriendlyPassword,
  generateStudentCode,
  generateUUID,
} from './credentialUtils.ts';
import { syncEventBus } from './eventBus.ts';
import { aiService } from '../ai/index.ts';
import {
  EssaySubmission,
  QuestionResult,
  RewardItem,
  RewardRequest,
  RewardStatus,
  Role,
  StudentState,
  RubricTemplate,
  GradedSampleEssay,
  AIGradingConfig,
  SkillLevel,
} from '../../types.ts';
import { REWARDS_CATALOG } from '../../data/rewards.ts';

export const STORAGE_SCHEMA_VERSION = 'mam_van_v4_real_data';

// Keys lưu trữ localStorage
const STORAGE_KEYS = {
  SCHEMA_VERSION: 'mam_van_schema_version',
  CLASSES: 'mam_van_classes',
  STUDENTS: 'mam_van_students',
  TEACHERS: 'mam_van_teachers',
  TOPICS: 'mam_van_topics',
  VIDEOS: 'mam_van_videos',
  THEORIES: 'mam_van_theories',
  QUIZZES: 'mam_van_quizzes',
  QUESTIONS: 'mam_van_questions',
  REWARDS: 'mam_van_rewards',
  STATES: 'mam_van_student_states',
  ESSAYS: 'mam_van_essay_submissions',
  REQUESTS: 'mam_van_reward_requests',
  AUDIT: 'mam_van_audit_logs',
  SESSION: 'mam_van_auth_session',
  RUBRICS: 'mam_van_rubric_templates',
  SAMPLES: 'mam_van_graded_samples',
  AI_CONFIG: 'mam_van_ai_grading_config',
  SETTINGS: 'mam_van_system_settings',
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  schoolInfo: {
    // Không gieo tên trường/lớp bịa: để trống cho giáo viên tự điền thật.
    schoolName: '',
    academicYear: '2026-2027',
    semester: 'Học kỳ I',
    classNameDefault: '',
  },
  mastery: {
    thresholdNeedsReview: 50,
    thresholdProgressing: 80,
    minQuestionsRequired: 5,
    weightDecayFactor: 0.88,
  },
  xp: {
    // Mô hình XP hiện hành KHÔNG còn trần XP ngày/tuần (đã bãi bỏ 21–22/10)
    // nên defaults không còn các trường trần; chỉ giữ mức XP điểm danh là
    // cấu hình còn hiệu lực ở màn Cài đặt.
    attendanceDailyXp: 2,
    videoWatchXp: 5,
    videoSummaryReadXp: 2,
    videoPracticeXp: 5,
    videoQuickTestXp: 8,
    videoMasteryCheckXp: 8,
    theoryReadXp: 10,
    theoryPracticeXp: 5,
    theoryTestXp: 8,
    homeworkCompletedXp: 20,
    reviewWeakAreaXp: 3,
  },
  time: {
    idleLimitMinutes: 4,
    breakReminderMinutes: 45,
    minTheoryReadSeconds: 25,
    minSummaryReadSeconds: 15,
    essayReviewEstimatedHours: 48,
  },
  notifications: {
    notifyPendingEssays: true,
    notifyPendingRewards: true,
    notifyInactiveStudents: true,
  },
};

// In-memory fallback cho môi trường test/CLI khi không có browser window
const memoryStorage: Record<string, string> = {};

// Helper đọc/ghi an toàn
function readStorage<T>(key: string, defaultVal: T): T {
  try {
    let val: string | null = null;
    if (typeof localStorage !== 'undefined') {
      val = localStorage.getItem(key);
    } else {
      val = memoryStorage[key] || null;
    }
    if (!val) return defaultVal;
    const parsed = JSON.parse(val);
    // Chặn dữ liệu hỏng/lệch kiểu (vd mảng bị ghi đè thành object sau nâng cấp):
    // trả mặc định thay vì để cả app sập ở các .map/.includes phía sau
    if (Array.isArray(defaultVal) && !Array.isArray(parsed)) {
      console.warn(`[Storage] Dữ liệu [${key}] không phải mảng như mong đợi, dùng mặc định.`);
      return defaultVal;
    }
    if (
      defaultVal !== null &&
      typeof defaultVal === 'object' &&
      !Array.isArray(defaultVal) &&
      (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
    ) {
      console.warn(`[Storage] Dữ liệu [${key}] không phải object như mong đợi, dùng mặc định.`);
      return defaultVal;
    }
    return parsed;
  } catch (e) {
    console.error(`Lỗi đọc localStorage [${key}]:`, e);
    return defaultVal;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, serialized);
    } else {
      memoryStorage[key] = serialized;
    }
  } catch (e) {
    console.error(`Lỗi ghi localStorage [${key}]:`, e);
  }
}

// Khởi tạo Storage sạch lần đầu nếu chưa có
export function initSeedDataIfEmpty(): void {
  if (typeof window === 'undefined') return;

  if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
    writeStorage(STORAGE_KEYS.CLASSES, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
    writeStorage(STORAGE_KEYS.STUDENTS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.TEACHERS)) {
    writeStorage(STORAGE_KEYS.TEACHERS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.TOPICS)) {
    writeStorage(STORAGE_KEYS.TOPICS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.VIDEOS)) {
    writeStorage(STORAGE_KEYS.VIDEOS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.THEORIES)) {
    writeStorage(STORAGE_KEYS.THEORIES, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.QUIZZES)) {
    writeStorage(STORAGE_KEYS.QUIZZES, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) {
    writeStorage(STORAGE_KEYS.QUESTIONS, {});
  }
  if (!localStorage.getItem(STORAGE_KEYS.REWARDS)) {
    writeStorage(STORAGE_KEYS.REWARDS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.STATES)) {
    writeStorage(STORAGE_KEYS.STATES, {});
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT)) {
    writeStorage(STORAGE_KEYS.AUDIT, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    writeStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SYSTEM_SETTINGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION)) {
    writeStorage(STORAGE_KEYS.SCHEMA_VERSION, STORAGE_SCHEMA_VERSION);
  }
}

/**
 * Bootstrap kho dữ liệu: kiểm tra STORAGE_SCHEMA_VERSION.
 * Dọn sạch toàn bộ dữ liệu mẫu cũ để làm việc với dữ liệu thật.
 */
export function bootstrapStorage(): { reset: boolean } {
  if (typeof window === 'undefined') return { reset: false };

  const currentVersion = localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
  if (currentVersion !== STORAGE_SCHEMA_VERSION) {
    console.log('[Storage] Chuyển đổi sang schema dữ liệu thật v4, dọn sạch toàn bộ mẫu cũ...');

    // CHỈ xóa dữ liệu mẫu cũ của các bảng đã chuyển sang Supabase (lớp/học sinh/giáo viên/thưởng/log).
    // TUYỆT ĐỐI KHÔNG xóa: topics, videos, theories, quizzes, questions, student_states (điểm danh/XP) và session,
    // vì đây là dữ liệu thật của người dùng — xóa sẽ gây mất dữ liệu sau khi tải lại trang.
    try {
      const protectedKeys = new Set<string>([
        STORAGE_KEYS.SESSION,
        STORAGE_KEYS.TOPICS,
        STORAGE_KEYS.VIDEOS,
        STORAGE_KEYS.THEORIES,
        STORAGE_KEYS.QUIZZES,
        STORAGE_KEYS.QUESTIONS,
        STORAGE_KEYS.STATES,
        STORAGE_KEYS.ESSAYS,
        STORAGE_KEYS.SETTINGS,
        // Dữ liệu chỉ sống ở local (Supabase ủy quyền mock): mất là mất hẳn khi đổi version
        STORAGE_KEYS.RUBRICS,
        STORAGE_KEYS.SAMPLES,
        STORAGE_KEYS.AI_CONFIG,
        STORAGE_KEYS.REWARDS,
        STORAGE_KEYS.REQUESTS,
        STORAGE_KEYS.AUDIT,
        'mam_van_announcements',
        // Lịch sử trò chuyện Trợ lý phân tích: dữ liệu thật của giáo viên,
        // không được dọn khi đổi schema (cùng nguyên tắc các key trên).
        'mam_van_assistant_chat_v1',
      ]);
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('mam_van_') || k.startsWith('vo_muc_'))) {
          if (!protectedKeys.has(k)) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Lỗi khi xóa key cũ:', e);
    }

    writeStorage(STORAGE_KEYS.SCHEMA_VERSION, STORAGE_SCHEMA_VERSION);
    initSeedDataIfEmpty();
    return { reset: true };
  }

  // Đảm bảo không bị thiếu key nếu đã có schema_version
  initSeedDataIfEmpty();
  return { reset: false };
}

// Đặt lại toàn bộ dữ liệu
export function resetAllDemoData(): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('mam_van_') || k.startsWith('vo_muc_'))) {
        if (k !== STORAGE_KEYS.SESSION) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Lỗi khi xóa localStorage:', e);
  }

  writeStorage(STORAGE_KEYS.SCHEMA_VERSION, STORAGE_SCHEMA_VERSION);
  writeStorage(STORAGE_KEYS.CLASSES, []);
  writeStorage(STORAGE_KEYS.STUDENTS, []);
  writeStorage(STORAGE_KEYS.TEACHERS, []);
  writeStorage(STORAGE_KEYS.TOPICS, []);
  writeStorage(STORAGE_KEYS.VIDEOS, []);
  writeStorage(STORAGE_KEYS.THEORIES, []);
  writeStorage(STORAGE_KEYS.QUIZZES, []);
  writeStorage(STORAGE_KEYS.QUESTIONS, {});
  writeStorage(STORAGE_KEYS.REWARDS, []);
  writeStorage(STORAGE_KEYS.STATES, {});
  writeStorage(STORAGE_KEYS.AUDIT, []);
  writeStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SYSTEM_SETTINGS);
  syncEventBus.emit('all', {}, 'reset-all');
}

// ==========================================
// 1. AUDIT REPOSITORY
// ==========================================
export class MockAuditRepository implements AuditRepository {
  async log(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
    const logs = readStorage<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
    const newLog: AuditLog = {
      ...entry,
      id: generateUUID(),
      created_at: new Date().toISOString(),
    };
    logs.unshift(newLog);
    writeStorage(STORAGE_KEYS.AUDIT, logs.slice(0, 300)); // Giữ 300 bản ghi gần nhất
    syncEventBus.emit('audit');
  }

  async getLogs(filter?: {
    actorId?: string;
    targetType?: string;
    action?: string;
    search?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    let logs = readStorage<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
    if (filter?.actorId) {
      logs = logs.filter((l) => l.actor_id === filter.actorId);
    }
    if (filter?.targetType && filter.targetType !== 'all') {
      logs = logs.filter((l) => l.target_type === filter.targetType);
    }
    if (filter?.action && filter.action !== 'all') {
      const act = filter.action.toLowerCase();
      logs = logs.filter((l) => l.action.toLowerCase().includes(act));
    }
    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      logs = logs.filter((l) =>
        l.actor_name.toLowerCase().includes(q) ||
        l.target_name.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.details?.notes && String(l.details.notes).toLowerCase().includes(q)) ||
        (l.details?.reason && String(l.details.reason).toLowerCase().includes(q))
      );
    }
    return logs.slice(0, filter?.limit || 100);
  }
}

export const auditRepo = new MockAuditRepository();

// ==========================================
// 2. AUTH REPOSITORY
// ==========================================
export class MockAuthRepository implements AuthRepository {
  async signIn(role: Role, username: string, password: string): Promise<{
    success: boolean;
    session?: AuthSession;
    error?: string;
    isLocked?: boolean;
  }> {
    const uClean = username.trim().toLowerCase();
    const pClean = password.trim();

    if (role === 'admin') {
      // Admin ở chế độ mock = tài khoản role='admin' trong kho giáo viên local
      // (nếu có). Đã gỡ thông tin đăng nhập ghi cứng khỏi mã nguồn (đợt 21/10) —
      // tài khoản Admin thật nằm trong DB (migration_006_admin_account.sql).
      const teachers = readStorage<TeacherProfile[]>(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
      const matched = teachers.find((t) => t.role === 'admin' && t.username.toLowerCase() === uClean);
      if (!matched) {
        return {
          success: false,
          error: 'Tài khoản Quản trị viên hoặc mật khẩu không chính xác',
        };
      }

      if (matched.status === 'locked') {
        return {
          success: false,
          isLocked: true,
          error: 'Tài khoản Quản trị viên đã bị tạm khóa. Vui lòng liên hệ hỗ trợ!',
        };
      }

      const validPw = !!(matched.password && matched.password === pClean);
      if (!validPw) {
        return {
          success: false,
          error: 'Tài khoản Quản trị viên hoặc mật khẩu không chính xác',
        };
      }

      const session: AuthSession = {
        user: matched,
        role: 'admin',
        signedInAt: Date.now(),
      };
      writeStorage(STORAGE_KEYS.SESSION, session);
      syncEventBus.emit('auth', session, 'auth-service');
      return { success: true, session };
    }

    if (role === 'teacher') {
      const teachers = readStorage<TeacherProfile[]>(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
      const matched = teachers.find((t) => t.username.toLowerCase() === uClean);
      if (!matched) {
        return {
          success: false,
          error: 'Tài khoản giáo viên hoặc mật khẩu không chính xác',
        };
      }

      if (matched.status === 'locked') {
        return {
          success: false,
          isLocked: true,
          error: 'Tài khoản giáo viên đã bị tạm khóa bởi Quản trị viên. Vui lòng liên hệ hỗ trợ!',
        };
      }

      // Mật khẩu giáo viên (mặc định 123456 hoặc mật khẩu riêng)
      const validPw = !!(matched.password && matched.password === pClean);
      if (validPw) {
        const session: AuthSession = {
          user: matched,
          role: 'teacher',
          signedInAt: Date.now(),
        };
        writeStorage(STORAGE_KEYS.SESSION, session);
        syncEventBus.emit('auth', session, 'auth-service');
        return { success: true, session };
      }
      return {
        success: false,
        error: 'Mật khẩu giáo viên chưa chính xác',
      };
    }

    if (role === 'student') {
      const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
      const student = students.find((s) => s.username.toLowerCase() === uClean && !s.deleted_at);

      if (!student) {
        return {
          success: false,
          error: 'Hệ thống chưa nhận diện được tài khoản này, bạn vui lòng kiểm tra lại với thầy/cô phụ trách nhé!',
        };
      }

      if (student.status === 'locked') {
        return {
          success: false,
          isLocked: true,
          error: 'Tài khoản của em đang tạm khóa. Vui lòng liên hệ Thầy/Cô phụ trách để mở khóa nhé!',
        };
      }

      // Kiểm tra mật khẩu (mock)
      const correctPw = student.password_hash || '123456';
      if (pClean !== correctPw) {
        return {
          success: false,
          error: 'Mật khẩu chưa chính xác. Nếu quên mật khẩu, em hãy nhờ Thầy/Cô cấp lại nhé!',
        };
      }

      // Cập nhật trạng thái đăng nhập
      student.has_logged_in = true;
      student.last_active_at = Date.now();
      writeStorage(STORAGE_KEYS.STUDENTS, students);

      // Đảm bảo học sinh có StudentState
      const states = readStorage<Record<string, StudentState>>(STORAGE_KEYS.STATES, {});
      if (!states[student.id]) {
        const classes = readStorage<ClassItem[]>(STORAGE_KEYS.CLASSES, SEED_CLASSES);
        const cls = classes.find((c) => c.id === student.class_id);
        states[student.id] = createFreshStudentState(student, cls ? `Lớp ${cls.name}` : '');
        writeStorage(STORAGE_KEYS.STATES, states);
      }

      const session: AuthSession = {
        user: {
          id: student.id,
          name: student.name,
          username: student.username,
          role: 'student',
          grade: 'Lớp 7',
          school: 'THCS Giấy & Mực',
          avatarSeed: student.username,
        },
        role: 'student',
        signedInAt: Date.now(),
      };
      writeStorage(STORAGE_KEYS.SESSION, session);
      syncEventBus.emit('auth', session, 'auth-service');
      syncEventBus.emit('student', { studentId: student.id }, 'auth-service');
      return { success: true, session };
    }

    return { success: false, error: 'Vai trò này đang được hoàn thiện!' };
  }

  async signOut(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      // TÁCH DỮ LIỆU THEO TÀI KHOẢN: dọn bộ nhớ đệm nội dung/dữ liệu học tập
      // của tài khoản vừa đăng xuất (xem ghi chú tương tự ở SupabaseAuth).
      try {
        [
          STORAGE_KEYS.TOPICS,
          STORAGE_KEYS.VIDEOS,
          STORAGE_KEYS.THEORIES,
          STORAGE_KEYS.QUIZZES,
          STORAGE_KEYS.QUESTIONS,
          STORAGE_KEYS.STATES,
          STORAGE_KEYS.ESSAYS,
          STORAGE_KEYS.REQUESTS,
        ].forEach((k) => localStorage.removeItem(k));
        Object.keys(localStorage)
          .filter((k) => k.startsWith(STORAGE_KEYS.SETTINGS))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* bỏ qua lỗi dọn dẹp */
      }
    }
    syncEventBus.emit('auth', null, 'auth-service');
  }

  async getSession(): Promise<AuthSession | null> {
    return readStorage<AuthSession | null>(STORAGE_KEYS.SESSION, null);
  }
}

export const authRepo = new MockAuthRepository();

// ==========================================
// 3. CLASS REPOSITORY
// ==========================================
export class MockClassRepository implements ClassRepository {
  async getClasses(teacherId?: string): Promise<ClassItem[]> {
    const classes = readStorage<ClassItem[]>(STORAGE_KEYS.CLASSES, SEED_CLASSES);
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);

    // Tính toán sĩ số và học sinh hoạt động 7 ngày qua
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400000;

    const list = classes
      .filter((c) => !c.deleted_at)
      .map((c) => {
        const classStudents = students.filter((s) => s.class_id === c.id && !s.deleted_at);
        const activeCount = classStudents.filter((s) => {
          if (!s.last_active_at) return false;
          const t = typeof s.last_active_at === 'string' ? new Date(s.last_active_at).getTime() : s.last_active_at;
          return t >= sevenDaysAgo;
        }).length;

        return {
          ...c,
          studentCount: classStudents.length,
          active7DaysCount: activeCount,
        };
      });

    if (teacherId) {
      return list.filter((c) => c.teacherId === teacherId);
    }
    return list;
  }

  async getClassById(id: string): Promise<ClassItem | null> {
    const classes = await this.getClasses();
    return classes.find((c) => c.id === id) || null;
  }

  async createClass(
    data: Omit<ClassItem, 'id' | 'created_at' | 'updated_at' | 'studentCount' | 'active7DaysCount'>
  ): Promise<ClassItem> {
    const classes = readStorage<ClassItem[]>(STORAGE_KEYS.CLASSES, SEED_CLASSES);
    const newClass: ClassItem = {
      ...data,
      id: 'class_' + generateUUID(),
      studentCount: 0,
      active7DaysCount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    classes.push(newClass);
    writeStorage(STORAGE_KEYS.CLASSES, classes);

    await auditRepo.log({
      actor_id: data.teacherId || 'gv001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'CREATE_CLASS',
      target_type: 'class',
      target_id: newClass.id,
      target_name: `Lớp ${newClass.name} (${newClass.schoolYear})`,
      details: { grade: newClass.grade },
    });

    syncEventBus.emit('class');
    return newClass;
  }

  async updateClass(id: string, data: Partial<ClassItem>): Promise<ClassItem> {
    const classes = readStorage<ClassItem[]>(STORAGE_KEYS.CLASSES, SEED_CLASSES);
    const idx = classes.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Không tìm thấy lớp học');

    const updated: ClassItem = {
      ...classes[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    classes[idx] = updated;
    writeStorage(STORAGE_KEYS.CLASSES, classes);

    await auditRepo.log({
      actor_id: updated.teacherId || 'gv001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: data.status === 'archived' ? 'ARCHIVE_CLASS' : 'UPDATE_CLASS',
      target_type: 'class',
      target_id: id,
      target_name: `Lớp ${updated.name}`,
      details: data,
    });

    syncEventBus.emit('class');
    return updated;
  }

  async archiveClass(id: string): Promise<void> {
    await this.updateClass(id, { status: 'archived' });
  }
}

export const classRepo = new MockClassRepository();

// ==========================================
// 4. STUDENT REPOSITORY
// ==========================================
export class MockStudentRepository implements StudentRepository {
  async getStudents(filter?: {
    classId?: string;
    search?: string;
    status?: 'active' | 'locked' | 'all';
  }): Promise<StudentAccount[]> {
    let list = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    // Bỏ học sinh đã xóa mềm
    list = list.filter((s) => !s.deleted_at);

    if (filter?.classId && filter.classId !== 'all') {
      list = list.filter((s) => s.class_id === filter.classId);
    }

    if (filter?.status && filter.status !== 'all') {
      list = list.filter((s) => s.status === filter.status);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.username.toLowerCase().includes(q) ||
          (s.student_code && s.student_code.toLowerCase().includes(q))
      );
    }

    return list;
  }

  async getStudentById(id: string): Promise<StudentAccount | null> {
    const list = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    return list.find((s) => s.id === id && !s.deleted_at) || null;
  }

  async createStudent(
    data: CreateStudentInput,
    teacherActorId: string
  ): Promise<{ student: StudentAccount; credential: StudentCredentialVoucher }> {
    const res = await this.createStudentsBatch([data], teacherActorId);
    return {
      student: res.students[0],
      credential: res.credentials[0],
    };
  }

  async createStudentsBatch(
    dataList: CreateStudentInput[],
    teacherActorId: string
  ): Promise<{ students: StudentAccount[]; credentials: StudentCredentialVoucher[] }> {
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    const classes = readStorage<ClassItem[]>(STORAGE_KEYS.CLASSES, SEED_CLASSES);
    const states = readStorage<Record<string, StudentState>>(STORAGE_KEYS.STATES, {});
    const existingUsernames = students.map((s) => s.username.toLowerCase());
    const existingCodes: (string | undefined)[] = students.map((s) => s.student_code);

    const createdStudents: StudentAccount[] = [];
    const credentials: StudentCredentialVoucher[] = [];
    const nowIso = new Date().toISOString();

    for (const item of dataList) {
      const id = generateUUID();
      let username = item.custom_username?.trim().toLowerCase();
      if (!username) {
        username = generateUsername(item.name, existingUsernames);
      } else if (existingUsernames.includes(username)) {
        username = generateUsername(username, existingUsernames);
      }
      existingUsernames.push(username);

      const rawPassword = item.custom_password || generateFriendlyPassword(8);
      const cls = classes.find((c) => c.id === item.class_id);

      const newStudent: StudentAccount = {
        id,
        name: item.name.trim(),
        username,
        // KHÔNG lưu mật khẩu thô ở production. Trong mock lưu phục vụ đăng nhập demo.
        password_hash: rawPassword,
        class_id: item.class_id,
        // Mã HS nhập tay bị trùng (với HS đã có hoặc trong cùng lô) -> cấp mã mới duy nhất,
        // không để hai học sinh mang cùng một mã
        student_code:
          item.student_code?.trim() &&
          !existingCodes.some(
            (c) => c?.toLowerCase() === item.student_code!.trim().toLowerCase()
          )
            ? item.student_code.trim()
            : generateStudentCode(existingCodes),
        dob: item.dob,
        status: 'active',
        has_logged_in: false,
        last_active_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      students.push(newStudent);
      existingCodes.push(newStudent.student_code);
      createdStudents.push(newStudent);

      // Khởi tạo StudentState sạch bắt đầu từ 0
      states[id] = createFreshStudentState(newStudent, cls ? `Lớp ${cls.name}` : 'Lớp 7');

      credentials.push({
        id,
        name: newStudent.name,
        username: newStudent.username,
        initialPassword: rawPassword,
        class_id: newStudent.class_id,
        className: cls?.name || '',
        student_code: newStudent.student_code,
      });

      // Ghi audit
      await auditRepo.log({
        actor_id: teacherActorId,
        actor_name: 'Thầy/Cô',
        actor_role: 'teacher',
        action: 'CREATE_STUDENT',
        target_type: 'student',
        target_id: id,
        target_name: `${newStudent.name} (${newStudent.username})`,
        details: { class_id: newStudent.class_id, student_code: newStudent.student_code },
      });
    }

    writeStorage(STORAGE_KEYS.STUDENTS, students);
    writeStorage(STORAGE_KEYS.STATES, states);
    syncEventBus.emit('student');
    syncEventBus.emit('class');

    return {
      students: createdStudents,
      credentials,
    };
  }

  async updateStudent(id: string, data: Partial<StudentAccount>, teacherActorId: string): Promise<StudentAccount> {
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    const idx = students.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Không tìm thấy học sinh');

    const updated: StudentAccount = {
      ...students[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    students[idx] = updated;
    writeStorage(STORAGE_KEYS.STUDENTS, students);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'UPDATE_STUDENT',
      target_type: 'student',
      target_id: id,
      target_name: updated.name,
      details: data,
    });

    syncEventBus.emit('student');
    return updated;
  }

  async deleteStudent(id: string, teacherActorId: string): Promise<void> {
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    const target = students.find((s) => s.id === id);
    if (!target) return;

    target.deleted_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.STUDENTS, students);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'DELETE_STUDENT',
      target_type: 'student',
      target_id: id,
      target_name: target.name,
      details: { softDelete: true },
    });

    syncEventBus.emit('student');
    syncEventBus.emit('class');
  }

  async resetPassword(
    id: string,
    teacherActorId: string,
    customNewPassword?: string
  ): Promise<{ credential: StudentCredentialVoucher }> {
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    const classes = readStorage<ClassItem[]>(STORAGE_KEYS.CLASSES, SEED_CLASSES);
    const target = students.find((s) => s.id === id);
    if (!target) throw new Error('Không tìm thấy học sinh');

    const newPassword = customNewPassword || generateFriendlyPassword(8);
    // KHÔNG lưu mật khẩu thô ở production.
    target.password_hash = newPassword;
    target.updated_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.STUDENTS, students);

    const cls = classes.find((c) => c.id === target.class_id);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'RESET_PASSWORD',
      target_type: 'student',
      target_id: id,
      target_name: target.name,
    });

    syncEventBus.emit('student');

    return {
      credential: {
        id: target.id,
        name: target.name,
        username: target.username,
        initialPassword: newPassword,
        class_id: target.class_id,
        className: cls?.name || '',
        student_code: target.student_code,
      },
    };
  }

  async toggleLock(id: string, isLocked: boolean, teacherActorId: string): Promise<StudentAccount> {
    const status = isLocked ? 'locked' : 'active';
    const updated = await this.updateStudent(id, { status }, teacherActorId);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: isLocked ? 'LOCK_ACCOUNT' : 'UNLOCK_ACCOUNT',
      target_type: 'student',
      target_id: id,
      target_name: updated.name,
    });

    syncEventBus.emit('student');
    return updated;
  }

  async changeClass(id: string, newClassId: string, teacherActorId: string): Promise<StudentAccount> {
    const updated = await this.updateStudent(id, { class_id: newClassId }, teacherActorId);
    syncEventBus.emit('class');
    return updated;
  }
}

export const studentRepo = new MockStudentRepository();

// ==========================================
// 5. CONTENT REPOSITORY
// ==========================================
export class MockContentRepository implements ContentRepository {
  async getTopics(classId?: string, onlyPublished = true): Promise<TopicWithMeta[]> {
    let topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
    topics = topics.filter((t) => !t.deleted_at);
    if (onlyPublished) {
      topics = topics.filter((t) => t.status === 'published');
    }
    if (classId && classId !== 'all') {
      topics = topics.filter((t) => (t.class_ids || []).includes('all') || (t.class_ids || []).includes(classId));
    }
    return topics;
  }

  async getTopicById(id: string): Promise<TopicWithMeta | null> {
    const topics = await this.getTopics(undefined, false);
    return topics.find((t) => t.id === id) || null;
  }

  async getVideoLessons(classId?: string, onlyPublished = true): Promise<VideoLessonWithMeta[]> {
    let videos = readStorage<VideoLessonWithMeta[]>(STORAGE_KEYS.VIDEOS, getSeedVideos());
    videos = videos.filter((v) => !v.deleted_at);
    if (onlyPublished) {
      videos = videos.filter((v) => v.status === 'published');
    }
    if (classId && classId !== 'all') {
      videos = videos.filter((v) => (v.class_ids || []).includes('all') || (v.class_ids || []).includes(classId));
    }
    return videos;
  }

  async getVideoLessonById(id: string): Promise<VideoLessonWithMeta | null> {
    const videos = await this.getVideoLessons(undefined, false);
    return videos.find((v) => v.id === id) || null;
  }

  async getTheoryLessons(classId?: string, onlyPublished = true): Promise<TheoryLessonWithMeta[]> {
    let theories = readStorage<TheoryLessonWithMeta[]>(STORAGE_KEYS.THEORIES, getSeedTheories());
    theories = theories.filter((t) => !t.deleted_at);
    if (onlyPublished) {
      theories = theories.filter((t) => t.status === 'published');
    }
    if (classId && classId !== 'all') {
      theories = theories.filter((t) => (t.class_ids || []).includes('all') || (t.class_ids || []).includes(classId));
    }
    return theories;
  }

  async getTheoryLessonById(id: string): Promise<TheoryLessonWithMeta | null> {
    const theories = await this.getTheoryLessons(undefined, false);
    return theories.find((t) => t.id === id) || null;
  }

  async saveTopic(topic: Partial<TopicWithMeta>): Promise<TopicWithMeta> {
    const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
    const idx = topics.findIndex((t) => t.id === topic.id);
    const now = new Date().toISOString();
    let saved: TopicWithMeta;
    if (idx >= 0) {
      saved = {
        ...topics[idx],
        ...topic,
        has_unpublished_edits: topics[idx].status === 'published',
        updated_at: now,
      };
      topics[idx] = saved;
    } else {
      saved = {
        id: topic.id || 'topic_' + generateUUID(),
        title: topic.title || '',
        shortDesc: topic.shortDesc || '',
        tag: topic.tag || '',
        videoIds: topic.videoIds || [],
        theoryId: topic.theoryId || '',
        colorScheme: topic.colorScheme || '#2F3E6B',
        created_at: now,
        updated_at: now,
        status: topic.status || 'draft',
        class_ids: topic.class_ids || ['all'],
        version: 1,
        has_unpublished_edits: false,
      };
      topics.push(saved);
    }
    writeStorage(STORAGE_KEYS.TOPICS, topics);
    syncEventBus.emit('content');
    return saved;
  }

  async saveVideoLesson(video: Partial<VideoLessonWithMeta>): Promise<VideoLessonWithMeta> {
    const videos = readStorage<VideoLessonWithMeta[]>(STORAGE_KEYS.VIDEOS, getSeedVideos());
    const idx = videos.findIndex((v) => v.id === video.id);
    const now = new Date().toISOString();
    let saved: VideoLessonWithMeta;
    if (idx >= 0) {
      saved = {
        ...videos[idx],
        ...video,
        has_unpublished_edits: videos[idx].status === 'published',
        updated_at: now,
      };
      videos[idx] = saved;
    } else {
      saved = {
        ...video,
        id: video.id || 'video_' + generateUUID(),
        created_at: now,
        updated_at: now,
        status: video.status || 'draft',
        class_ids: video.class_ids || ['all'],
        version: 1,
        has_unpublished_edits: false,
      } as VideoLessonWithMeta;
      videos.push(saved);
    }
    writeStorage(STORAGE_KEYS.VIDEOS, videos);
    syncEventBus.emit('content');
    return saved;
  }

  async saveTheoryLesson(theory: Partial<TheoryLessonWithMeta>): Promise<TheoryLessonWithMeta> {
    const theories = readStorage<TheoryLessonWithMeta[]>(STORAGE_KEYS.THEORIES, getSeedTheories());
    const idx = theories.findIndex((t) => t.id === theory.id);
    const now = new Date().toISOString();
    let saved: TheoryLessonWithMeta;
    if (idx >= 0) {
      saved = {
        ...theories[idx],
        ...theory,
        has_unpublished_edits: theories[idx].status === 'published',
        updated_at: now,
      };
      theories[idx] = saved;
    } else {
      saved = {
        ...theory,
        id: theory.id || 'theory_' + generateUUID(),
        created_at: now,
        updated_at: now,
        status: theory.status || 'draft',
        class_ids: theory.class_ids || ['all'],
        version: 1,
        has_unpublished_edits: false,
      } as TheoryLessonWithMeta;
      theories.push(saved);
    }
    writeStorage(STORAGE_KEYS.THEORIES, theories);
    syncEventBus.emit('content');
    return saved;
  }

  async deleteTopic(id: string, teacherActorId: string): Promise<void> {
    const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
    const target = topics.find((t) => t.id === id);
    if (!target) return;
    target.deleted_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.TOPICS, topics);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'DELETE_TOPIC',
      target_type: 'content',
      target_id: id,
      target_name: target.title,
    });
    syncEventBus.emit('content');
  }

  async deleteVideoLesson(id: string, teacherActorId: string): Promise<void> {
    const videos = readStorage<VideoLessonWithMeta[]>(STORAGE_KEYS.VIDEOS, getSeedVideos());
    const target = videos.find((v) => v.id === id);
    if (!target) return;
    target.deleted_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.VIDEOS, videos);

    // Xóa id khỏi danh sách videoIds của các chủ đề
    const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
    topics.forEach((t) => {
      t.videoIds = t.videoIds.filter((vId) => vId !== id);
    });
    writeStorage(STORAGE_KEYS.TOPICS, topics);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'DELETE_VIDEO',
      target_type: 'content',
      target_id: id,
      target_name: target.title,
    });
    syncEventBus.emit('content');
  }

  async deleteTheoryLesson(id: string, teacherActorId: string): Promise<void> {
    const theories = readStorage<TheoryLessonWithMeta[]>(STORAGE_KEYS.THEORIES, getSeedTheories());
    const target = theories.find((t) => t.id === id);
    if (!target) return;
    target.deleted_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.THEORIES, theories);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'DELETE_THEORY',
      target_type: 'content',
      target_id: id,
      target_name: target.title,
    });
    syncEventBus.emit('content');
  }

  async reorderTopics(topicIds: string[]): Promise<void> {
    const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
    const map = new Map(topics.map((t) => [t.id, t]));
    const reordered: TopicWithMeta[] = [];
    topicIds.forEach((id) => {
      const item = map.get(id);
      if (item) {
        reordered.push(item);
        map.delete(id);
      }
    });
    // Thêm các topic còn lại chưa có trong danh sách
    map.forEach((t) => reordered.push(t));
    writeStorage(STORAGE_KEYS.TOPICS, reordered);
    syncEventBus.emit('content');
  }

  async reorderTopicVideos(topicId: string, videoIds: string[]): Promise<void> {
    const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
    const target = topics.find((t) => t.id === topicId);
    if (!target) return;
    target.videoIds = videoIds;
    target.updated_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.TOPICS, topics);
    syncEventBus.emit('content');
  }

  async publishContent(
    type: 'topic' | 'video' | 'theory',
    id: string,
    options: { classIds: string[]; notifyStudent?: boolean },
    teacherActorId: string
  ): Promise<void> {
    const now = new Date().toISOString();
    let title = '';

    if (type === 'topic') {
      const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
      const t = topics.find((item) => item.id === id);
      if (t) {
        t.status = 'published';
        t.class_ids = options.classIds;
        t.published_at = now;
        t.has_unpublished_edits = false;
        t.updated_at = now;
        title = t.title;
        writeStorage(STORAGE_KEYS.TOPICS, topics);
      }
    } else if (type === 'video') {
      const videos = readStorage<VideoLessonWithMeta[]>(STORAGE_KEYS.VIDEOS, getSeedVideos());
      const v = videos.find((item) => item.id === id);
      if (v) {
        v.status = 'published';
        v.class_ids = options.classIds;
        v.published_at = now;
        v.has_unpublished_edits = false;
        v.updated_at = now;
        title = v.title;
        writeStorage(STORAGE_KEYS.VIDEOS, videos);
      }
    } else if (type === 'theory') {
      const theories = readStorage<TheoryLessonWithMeta[]>(STORAGE_KEYS.THEORIES, getSeedTheories());
      const th = theories.find((item) => item.id === id);
      if (th) {
        th.status = 'published';
        th.class_ids = options.classIds;
        th.published_at = now;
        th.has_unpublished_edits = false;
        th.updated_at = now;
        title = th.title;
        writeStorage(STORAGE_KEYS.THEORIES, theories);
      }
    }

    if (options.notifyStudent) {
      const annos = readStorage<any[]>('mam_van_announcements', []);
      annos.unshift({
        id: 'anno_' + Date.now(),
        title: `Bài học mới: ${title}`,
        content: `Thầy/cô vừa cập nhật nội dung học mới lên kho học liệu. Các em vào rèn luyện nhé!`,
        type: 'new_content',
        targetClassIds: options.classIds,
        created_at: now,
      });
      writeStorage('mam_van_announcements', annos);
    }

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'PUBLISH_CONTENT',
      target_type: 'content',
      target_id: id,
      target_name: title || id,
      details: { contentType: type, classIds: options.classIds, notified: !!options.notifyStudent },
    });

    syncEventBus.emit('content');
  }

  async unpublishContent(type: 'topic' | 'video' | 'theory', id: string, teacherActorId: string): Promise<void> {
    const now = new Date().toISOString();
    let title = '';

    if (type === 'topic') {
      const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
      const t = topics.find((item) => item.id === id);
      if (t) {
        t.status = 'draft';
        t.updated_at = now;
        title = t.title;
        writeStorage(STORAGE_KEYS.TOPICS, topics);
      }
    } else if (type === 'video') {
      const videos = readStorage<VideoLessonWithMeta[]>(STORAGE_KEYS.VIDEOS, getSeedVideos());
      const v = videos.find((item) => item.id === id);
      if (v) {
        v.status = 'draft';
        v.updated_at = now;
        title = v.title;
        writeStorage(STORAGE_KEYS.VIDEOS, videos);
      }
    } else if (type === 'theory') {
      const theories = readStorage<TheoryLessonWithMeta[]>(STORAGE_KEYS.THEORIES, getSeedTheories());
      const th = theories.find((item) => item.id === id);
      if (th) {
        th.status = 'draft';
        th.updated_at = now;
        title = th.title;
        writeStorage(STORAGE_KEYS.THEORIES, theories);
      }
    }

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'UNPUBLISH_CONTENT',
      target_type: 'content',
      target_id: id,
      target_name: title || id,
      details: { contentType: type },
    });

    syncEventBus.emit('content');
  }

  async archiveContent(type: 'topic' | 'video' | 'theory', id: string, teacherActorId: string): Promise<void> {
    const now = new Date().toISOString();
    let title = '';

    if (type === 'topic') {
      const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
      const t = topics.find((item) => item.id === id);
      if (t) {
        t.status = 'archived';
        t.updated_at = now;
        title = t.title;
        writeStorage(STORAGE_KEYS.TOPICS, topics);
      }
    } else if (type === 'video') {
      const videos = readStorage<VideoLessonWithMeta[]>(STORAGE_KEYS.VIDEOS, getSeedVideos());
      const v = videos.find((item) => item.id === id);
      if (v) {
        v.status = 'archived';
        v.updated_at = now;
        title = v.title;
        writeStorage(STORAGE_KEYS.VIDEOS, videos);
      }
    } else if (type === 'theory') {
      const theories = readStorage<TheoryLessonWithMeta[]>(STORAGE_KEYS.THEORIES, getSeedTheories());
      const th = theories.find((item) => item.id === id);
      if (th) {
        th.status = 'archived';
        th.updated_at = now;
        title = th.title;
        writeStorage(STORAGE_KEYS.THEORIES, theories);
      }
    }

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'ARCHIVE_CONTENT',
      target_type: 'content',
      target_id: id,
      target_name: title || id,
      details: { contentType: type },
    });

    syncEventBus.emit('content');
  }

  async duplicateContent(type: 'topic' | 'video' | 'theory', id: string, teacherActorId: string): Promise<any> {
    const now = new Date().toISOString();

    if (type === 'topic') {
      const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
      const t = topics.find((item) => item.id === id);
      if (!t) throw new Error('Không tìm thấy chủ đề');
      const cloned: TopicWithMeta = {
        ...t,
        id: 'topic_' + generateUUID(),
        title: `${t.title} (Bản sao)`,
        status: 'draft',
        created_at: now,
        updated_at: now,
        version: 1,
        has_unpublished_edits: false,
      };
      topics.push(cloned);
      writeStorage(STORAGE_KEYS.TOPICS, topics);
      syncEventBus.emit('content');
      return cloned;
    } else if (type === 'video') {
      const videos = readStorage<VideoLessonWithMeta[]>(STORAGE_KEYS.VIDEOS, getSeedVideos());
      const v = videos.find((item) => item.id === id);
      if (!v) throw new Error('Không tìm thấy video');
      const cloned: VideoLessonWithMeta = {
        ...v,
        id: 'video_' + generateUUID(),
        title: `${v.title} (Bản sao)`,
        status: 'draft',
        created_at: now,
        updated_at: now,
        version: 1,
        has_unpublished_edits: false,
      };
      videos.push(cloned);
      writeStorage(STORAGE_KEYS.VIDEOS, videos);

      // Thêm vào chủ đề gốc
      const topics = readStorage<TopicWithMeta[]>(STORAGE_KEYS.TOPICS, getSeedTopics());
      const t = topics.find((item) => item.id === v.topicId);
      if (t) {
        t.videoIds.push(cloned.id);
        writeStorage(STORAGE_KEYS.TOPICS, topics);
      }

      syncEventBus.emit('content');
      return cloned;
    } else if (type === 'theory') {
      const theories = readStorage<TheoryLessonWithMeta[]>(STORAGE_KEYS.THEORIES, getSeedTheories());
      const th = theories.find((item) => item.id === id);
      if (!th) throw new Error('Không tìm thấy lý thuyết');
      const cloned: TheoryLessonWithMeta = {
        ...th,
        id: 'theory_' + generateUUID(),
        title: `${th.title} (Bản sao)`,
        status: 'draft',
        created_at: now,
        updated_at: now,
        version: 1,
        has_unpublished_edits: false,
      };
      theories.push(cloned);
      writeStorage(STORAGE_KEYS.THEORIES, theories);
      syncEventBus.emit('content');
      return cloned;
    }
  }
}

export const contentRepo = new MockContentRepository();

// ==========================================
// 6. QUIZ REPOSITORY
// ==========================================
export class MockQuizRepository implements QuizRepository {
  async getQuizzes(classId?: string, onlyPublished = true): Promise<QuizWithMeta[]> {
    let quizzes = readStorage<QuizWithMeta[]>(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
    quizzes = quizzes.filter((q) => !q.deleted_at);
    if (onlyPublished) {
      quizzes = quizzes.filter((q) => q.status === 'published');
    }
    if (classId && classId !== 'all') {
      quizzes = quizzes.filter((q) => (q.class_ids || []).includes('all') || (q.class_ids || []).includes(classId));
    }
    return quizzes;
  }

  async getQuizById(id: string): Promise<QuizWithMeta | null> {
    const quizzes = await this.getQuizzes(undefined, false);
    return quizzes.find((q) => q.id === id) || null;
  }

  async getQuestions(topicId?: string): Promise<Record<string, QuestionWithMeta>> {
    const questions = readStorage<Record<string, QuestionWithMeta>>(STORAGE_KEYS.QUESTIONS, getSeedQuestions());
    if (!topicId) {
      const alive: Record<string, QuestionWithMeta> = {};
      for (const [k, q] of Object.entries(questions)) {
        if (!q.deleted_at) alive[k] = q;
      }
      return alive;
    }
    const filtered: Record<string, QuestionWithMeta> = {};
    for (const [k, q] of Object.entries(questions)) {
      if (q.topicId === topicId && !q.deleted_at) {
        filtered[k] = q;
      }
    }
    return filtered;
  }

  async getQuestionById(id: string): Promise<QuestionWithMeta | null> {
    const questions = readStorage<Record<string, QuestionWithMeta>>(STORAGE_KEYS.QUESTIONS, getSeedQuestions());
    const q = questions[id];
    return q && !q.deleted_at ? q : null;
  }

  async saveQuiz(quiz: Partial<QuizWithMeta>): Promise<QuizWithMeta> {
    const quizzes = readStorage<QuizWithMeta[]>(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
    const idx = quizzes.findIndex((q) => q.id === quiz.id);
    const now = new Date().toISOString();
    let saved: QuizWithMeta;
    if (idx >= 0) {
      saved = {
        ...quizzes[idx],
        ...quiz,
        has_unpublished_edits: quizzes[idx].status === 'published',
        updated_at: now,
      };
      quizzes[idx] = saved;
    } else {
      saved = {
        ...quiz,
        id: quiz.id || 'quiz_' + generateUUID(),
        created_at: now,
        updated_at: now,
        status: quiz.status || 'draft',
        class_ids: quiz.class_ids || ['all'],
        version: 1,
        has_unpublished_edits: false,
      } as QuizWithMeta;
      quizzes.push(saved);
    }
    writeStorage(STORAGE_KEYS.QUIZZES, quizzes);
    syncEventBus.emit('quiz');
    return saved;
  }

  async saveQuestion(question: Partial<QuestionWithMeta>): Promise<QuestionWithMeta> {
    const questions = readStorage<Record<string, QuestionWithMeta>>(STORAGE_KEYS.QUESTIONS, getSeedQuestions());
    const qId = question.id || 'q_' + generateUUID();
    const now = new Date().toISOString();
    const saved: QuestionWithMeta = {
      ...(questions[qId] || {}),
      ...question,
      id: qId,
      created_at: questions[qId]?.created_at || now,
      updated_at: now,
      status: question.status || 'published',
      class_ids: question.class_ids || ['all'],
      version: 1,
    } as QuestionWithMeta;
    questions[qId] = saved;
    writeStorage(STORAGE_KEYS.QUESTIONS, questions);
    syncEventBus.emit('quiz');
    return saved;
  }

  async deleteQuiz(id: string, teacherActorId: string): Promise<void> {
    const quizzes = readStorage<QuizWithMeta[]>(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
    const target = quizzes.find((q) => q.id === id);
    if (!target) return;
    target.deleted_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.QUIZZES, quizzes);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'DELETE_QUIZ',
      target_type: 'quiz',
      target_id: id,
      target_name: target.title,
    });
    syncEventBus.emit('quiz');
  }

  async deleteQuestion(id: string, teacherActorId: string): Promise<void> {
    const questions = readStorage<Record<string, QuestionWithMeta>>(STORAGE_KEYS.QUESTIONS, getSeedQuestions());
    if (!questions[id]) return;
    questions[id].deleted_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.QUESTIONS, questions);

    // Xóa id khỏi các quiz
    const quizzes = readStorage<QuizWithMeta[]>(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
    quizzes.forEach((q) => {
      q.questionIds = q.questionIds.filter((qId) => qId !== id);
    });
    writeStorage(STORAGE_KEYS.QUIZZES, quizzes);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'DELETE_QUESTION',
      target_type: 'quiz',
      target_id: id,
      target_name: questions[id].prompt.slice(0, 30),
    });
    syncEventBus.emit('quiz');
  }

  async hasStudentAttempts(quizId: string): Promise<boolean> {
    const states = readStorage<Record<string, StudentState>>(STORAGE_KEYS.STATES, {});
    const quiz = await this.getQuizById(quizId);
    if (!quiz) return false;

    for (const studentState of Object.values(states)) {
      if (!studentState) continue;
      // Kiểm tra trong completedSteps
      if (
        studentState.completedSteps?.includes(`quiz_completed:${quizId}`) ||
        studentState.completedSteps?.includes(`quiz_done:${quizId}`)
      ) {
        return true;
      }
      // Hoặc trong questionResults
      const match = studentState.questionResults?.some((qr) => (quiz.questionIds || []).includes(qr.questionId));
      if (match) return true;
    }
    return false;
  }

  async publishQuiz(
    id: string,
    options: { classIds: string[]; notifyStudent?: boolean },
    teacherActorId: string
  ): Promise<QuizWithMeta> {
    const quizzes = readStorage<QuizWithMeta[]>(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
    const target = quizzes.find((q) => q.id === id);
    if (!target) throw new Error('Không tìm thấy bài tập/kiểm tra');

    const hasAttempts = await this.hasStudentAttempts(id);
    const now = new Date().toISOString();

    // Nếu đã có học sinh làm bài, tự động tạo version mới
    const nextVersion = hasAttempts ? (target.version || 1) + 1 : (target.version || 1);

    target.status = 'published';
    target.class_ids = options.classIds;
    target.version = nextVersion;
    target.published_at = now;
    target.has_unpublished_edits = false;
    target.updated_at = now;
    writeStorage(STORAGE_KEYS.QUIZZES, quizzes);

    if (options.notifyStudent) {
      const annos = readStorage<any[]>('mam_van_announcements', []);
      annos.unshift({
        id: 'anno_' + Date.now(),
        title: `Bài tập mới: ${target.title}`,
        content: `Thầy/cô vừa giao bài tập mới trên hệ thống. Hạn làm bài và điểm thưởng XP đã sẵn sàng!`,
        type: 'new_quiz',
        targetClassIds: options.classIds,
        created_at: now,
      });
      writeStorage('mam_van_announcements', annos);
    }

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'PUBLISH_QUIZ',
      target_type: 'quiz',
      target_id: id,
      target_name: target.title,
      details: {
        version: nextVersion,
        createdNewVersion: hasAttempts,
        classIds: options.classIds,
        notified: !!options.notifyStudent,
      },
    });

    syncEventBus.emit('quiz');
    return target;
  }

  async unpublishQuiz(id: string, teacherActorId: string): Promise<QuizWithMeta> {
    const quizzes = readStorage<QuizWithMeta[]>(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
    const target = quizzes.find((q) => q.id === id);
    if (!target) throw new Error('Không tìm thấy bài tập/kiểm tra');

    target.status = 'draft';
    target.updated_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.QUIZZES, quizzes);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'UNPUBLISH_QUIZ',
      target_type: 'quiz',
      target_id: id,
      target_name: target.title,
    });

    syncEventBus.emit('quiz');
    return target;
  }

  async archiveQuiz(id: string, teacherActorId: string): Promise<QuizWithMeta> {
    const quizzes = readStorage<QuizWithMeta[]>(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
    const target = quizzes.find((q) => q.id === id);
    if (!target) throw new Error('Không tìm thấy bài tập/kiểm tra');

    target.status = 'archived';
    target.updated_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.QUIZZES, quizzes);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'ARCHIVE_QUIZ',
      target_type: 'quiz',
      target_id: id,
      target_name: target.title,
    });

    syncEventBus.emit('quiz');
    return target;
  }

  async duplicateQuiz(id: string, teacherActorId: string): Promise<QuizWithMeta> {
    const quizzes = readStorage<QuizWithMeta[]>(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
    const questions = readStorage<Record<string, QuestionWithMeta>>(STORAGE_KEYS.QUESTIONS, getSeedQuestions());
    const target = quizzes.find((q) => q.id === id);
    if (!target) throw new Error('Không tìm thấy bài tập/kiểm tra');

    const now = new Date().toISOString();
    // Tạo bản sao độc lập cho từng câu hỏi
    const clonedQuestionIds: string[] = [];
    for (const qId of target.questionIds) {
      const originalQ = questions[qId];
      if (originalQ) {
        const newQId = 'q_' + generateUUID();
        questions[newQId] = {
          ...originalQ,
          id: newQId,
          created_at: now,
          updated_at: now,
          status: 'draft',
        };
        clonedQuestionIds.push(newQId);
      }
    }
    writeStorage(STORAGE_KEYS.QUESTIONS, questions);

    const clonedQuiz: QuizWithMeta = {
      ...target,
      id: 'quiz_' + generateUUID(),
      title: `${target.title} (Bản sao)`,
      questionIds: clonedQuestionIds,
      status: 'draft',
      version: 1,
      has_unpublished_edits: false,
      created_at: now,
      updated_at: now,
    };
    quizzes.push(clonedQuiz);
    writeStorage(STORAGE_KEYS.QUIZZES, quizzes);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'DUPLICATE_QUIZ',
      target_type: 'quiz',
      target_id: clonedQuiz.id,
      target_name: clonedQuiz.title,
    });

    syncEventBus.emit('quiz');
    return clonedQuiz;
  }
}

export const quizRepo = new MockQuizRepository();

// ==========================================
// 7. ATTEMPT REPOSITORY (XP, Tiến độ, Lịch sử)
// ==========================================
export class MockAttemptRepository implements AttemptRepository {
  async getStudentState(studentId: string): Promise<StudentState> {
    const states = readStorage<Record<string, StudentState>>(STORAGE_KEYS.STATES, {});
    if (states[studentId]) {
      return states[studentId];
    }
    try {
      const legacy = localStorage.getItem('vo_muc_student_state_' + studentId);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed && typeof parsed === 'object') {
          states[studentId] = parsed;
          writeStorage(STORAGE_KEYS.STATES, states);
          return parsed;
        }
      }
    } catch {}

    // Tạo state mặc định nếu chưa có
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    const acc = students.find((s) => s.id === studentId);
    const classes = readStorage<ClassItem[]>(STORAGE_KEYS.CLASSES, SEED_CLASSES);
    const cls = acc ? classes.find((c) => c.id === acc.class_id) : undefined;
    const fresh = createFreshStudentState(
      acc || {
        id: studentId,
        name: 'Học sinh',
        username: studentId,
        class_id: 'class_7a2',
        status: 'active',
        has_logged_in: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      cls ? `Lớp ${cls.name}` : ''
    );
    // Chỉ lưu state cho học sinh CÓ tài khoản thật; id lạ (đã xóa/gõ sai) mà
    // cũng lưu sẽ sinh "học sinh ma" làm phồng số liệu của giáo viên
    if (acc) {
      states[studentId] = fresh;
      writeStorage(STORAGE_KEYS.STATES, states);
    }
    return fresh;
  }

  async saveStudentState(studentId: string, state: StudentState, sourceId?: string): Promise<void> {
    const states = readStorage<Record<string, StudentState>>(STORAGE_KEYS.STATES, {});
    states[studentId] = state;
    writeStorage(STORAGE_KEYS.STATES, states);
    try {
      localStorage.setItem('vo_muc_student_state_' + studentId, JSON.stringify(state));
    } catch {}

    // Cập nhật last_active_at ở bảng học sinh
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    const target = students.find((s) => s.id === studentId);
    if (target) {
      target.last_active_at = Date.now();
      writeStorage(STORAGE_KEYS.STUDENTS, students);
    }

    syncEventBus.emit('state', { studentId }, sourceId);
  }

  async recordQuestionResult(studentId: string, result: QuestionResult): Promise<void> {
    const state = await this.getStudentState(studentId);
    const updated: StudentState = {
      ...state,
      questionResults: [result, ...state.questionResults],
    };
    await this.saveStudentState(studentId, updated);
  }

  async recordAttendance(studentId: string, dateStr: string): Promise<void> {
    const state = await this.getStudentState(studentId);
    if (state.lastAttendanceDate === dateStr) return;
    const updated: StudentState = {
      ...state,
      lastAttendanceDate: dateStr,
      attendanceDaysThisWeek: state.attendanceDaysThisWeek + 1,
      attendanceHistory: [dateStr, ...state.attendanceHistory],
    };
    await this.saveStudentState(studentId, updated);
  }

  async getAllStates(): Promise<Record<string, StudentState>> {
    const states = readStorage<Record<string, StudentState>>(STORAGE_KEYS.STATES, {});
    // Quét thêm các state lưu lẻ theo prefix vo_muc_student_state_
    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('vo_muc_student_state_')) {
            const sId = k.replace('vo_muc_student_state_', '');
            if (!states[sId]) {
              const raw = localStorage.getItem(k);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed) states[sId] = parsed;
              }
            }
          }
        }
      } catch {}
    }
    // Không còn gieo state mẫu khi rỗng — rỗng là rỗng (dữ liệu demo đã gỡ).
    return states;
  }
}

export const attemptRepo = new MockAttemptRepository();

// ==========================================
// 8. ESSAY REPOSITORY
// ==========================================
export class MockEssayRepository implements EssayRepository {
  async getSubmissions(filter?: {
    classId?: string;
    status?: 'PENDING_TEACHER' | 'AI_SUGGESTED' | 'GRADED' | 'ALL';
    studentId?: string;
    quizId?: string;
  }): Promise<EssaySubmission[]> {
    const states = await attemptRepo.getAllStates();
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    const independentEssays = readStorage<EssaySubmission[]>(STORAGE_KEYS.ESSAYS, []);

    let allEssays: EssaySubmission[] = [...independentEssays];
    for (const [sId, st] of Object.entries(states)) {
      if (st.essaySubmissions && st.essaySubmissions.length > 0) {
        const student = students.find((s) => s.id === sId);
        const enriched = st.essaySubmissions.map((e) => ({
          ...e,
          studentName: e.studentName || student?.name || st.profile?.name || 'Học sinh',
          className: e.className || st.profile?.grade || '',
          classId: e.classId || student?.class_id || 'class_7a2',
          hoursWaiting: Math.max(0, Math.floor((Date.now() - e.submittedAt) / 3600000)),
        }));
        allEssays = allEssays.concat(enriched);
      }
    }

    // Khử trùng lặp theo id
    const map = new Map<string, EssaySubmission>();
    allEssays.forEach((item) => {
      if (item.id) map.set(item.id, item);
    });
    let result = Array.from(map.values()).filter(
      (e) =>
        e.content &&
        e.content.trim().length > 0 &&
        !e.id?.startsWith('sub_demo') &&
        e.studentName !== 'Trần Minh An'
    );

    if (filter?.studentId) {
      result = result.filter((e) => e.studentId === filter.studentId);
    }

    if (filter?.quizId) {
      result = result.filter((e) => e.quizId === filter.quizId);
    }

    if (filter?.status && filter.status !== 'ALL') {
      if (filter.status === 'PENDING_TEACHER') {
        result = result.filter((e) => e.status === 'PENDING_TEACHER' || e.status === 'AI_SUGGESTED');
      } else {
        result = result.filter((e) => e.status === filter.status);
      }
    }

    if (filter?.classId && filter.classId !== 'all') {
      const classId = filter.classId;
      const allowedStudentIds = new Set(
        students.filter((s) => s.class_id === classId).map((s) => s.id)
      );
      result = result.filter(
        (e) => allowedStudentIds.has(e.studentId) || e.classId === classId || e.className?.toLowerCase().includes(classId.toLowerCase())
      );
    }

    return result.sort((a, b) => b.submittedAt - a.submittedAt);
  }

  async getSubmissionById(id: string): Promise<EssaySubmission | null> {
    const all = await this.getSubmissions();
    return all.find((e) => e.id === id) || null;
  }

  async getReviewAnswerContent(_answerId: string): Promise<string> {
    // Mock không có đường review hoãn text — bài mock đã mang đủ content.
    return '';
  }

  async createSubmission(
    submission: Omit<EssaySubmission, 'id' | 'submittedAt'>
  ): Promise<EssaySubmission> {
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    const student = students.find((s) => s.id === submission.studentId);
    const classes = readStorage<ClassItem[]>(STORAGE_KEYS.CLASSES, SEED_CLASSES);
    const cls = classes.find((c) => c.id === (submission.classId || student?.class_id));

    const newEssay: EssaySubmission = {
      ...submission,
      id: 'sub_' + generateUUID(),
      submittedAt: Date.now(),
      status: 'PENDING_TEACHER',
      studentName: submission.studentName || student?.name || 'Học sinh',
      className: submission.className || cls?.name || '',
      classId: submission.classId || student?.class_id || 'class_7a2',
      hoursWaiting: 0,
    };

    // Tự động gọi suggestEssayGrade để chuẩn bị sẵn gợi ý của AI (học sinh chưa thấy gợi ý này)
    try {
      const defaultRubrics = await this.getRubricTemplates();
      const rubric = defaultRubrics[0]?.criteria || [
        { id: 'c1', name: 'Nội dung ý', description: 'Nội dung', weight: 40 },
        { id: 'c2', name: 'Bố cục & Liên kết', description: 'Bố cục', weight: 20 },
        { id: 'c3', name: 'Dùng từ đặt câu', description: 'Dùng từ', weight: 20 },
        { id: 'c4', name: 'Sáng tạo cảm xúc', description: 'Cảm xúc', weight: 20 },
      ];
      const aiResult = await aiService.suggestEssayGrade(newEssay.content, rubric);
      newEssay.aiSuggestion = {
        rubricScores: aiResult.rubricScores.map((rs) => ({
          criterionId: rs.criterionId,
          criterionName: rs.criterionName,
          score: rs.suggestedScore,
          maxScore: rs.maxScore,
          reason: rs.reason,
        })),
        overallComment: aiResult.overallComment,
        suggestedTotalScore: aiResult.totalScore,
        suggestedAt: new Date().toISOString(),
      };
      newEssay.status = 'AI_SUGGESTED';
    } catch (e) {
      console.warn('Lỗi tự động sinh gợi ý AI cho bài viết:', e);
      newEssay.status = 'PENDING_TEACHER';
    }

    const state = await attemptRepo.getStudentState(submission.studentId);
    state.essaySubmissions = [newEssay, ...(state.essaySubmissions || [])];
    await attemptRepo.saveStudentState(submission.studentId, state);

    // Lưu thêm vào kho độc lập ESSAYS để đảm bảo không thất lạc
    const independent = readStorage<EssaySubmission[]>(STORAGE_KEYS.ESSAYS, []);
    writeStorage(STORAGE_KEYS.ESSAYS, [newEssay, ...independent.filter((item) => item.id !== newEssay.id)]);

    syncEventBus.emit('essay');
    return newEssay;
  }

  async saveSubmissionDraft(
    id: string,
    draft: {
      rubricScores?: { criterionName: string; score: number; maxScore: number }[];
      teacherFeedback?: string;
    }
  ): Promise<EssaySubmission> {
    const states = await attemptRepo.getAllStates();
    let targetEssay: EssaySubmission | null = null;

    for (const [sId, st] of Object.entries(states)) {
      const eIdx = st.essaySubmissions?.findIndex((e) => e.id === id);
      if (eIdx !== undefined && eIdx >= 0) {
        targetEssay = {
          ...st.essaySubmissions[eIdx],
          teacherDraft: draft,
        };
        st.essaySubmissions[eIdx] = targetEssay;
        await attemptRepo.saveStudentState(sId, st);
        break;
      }
    }

    if (!targetEssay) {
      const independent = readStorage<EssaySubmission[]>(STORAGE_KEYS.ESSAYS, []);
      const idx = independent.findIndex((e) => e.id === id);
      if (idx >= 0) {
        targetEssay = {
          ...independent[idx],
          teacherDraft: draft,
        };
        independent[idx] = targetEssay;
        writeStorage(STORAGE_KEYS.ESSAYS, independent);
      }
    }

    if (!targetEssay) throw new Error('Không tìm thấy bài viết');
    syncEventBus.emit('essay');
    return targetEssay;
  }

  async gradeSubmission(
    id: string,
    grading: {
      teacherFeedback: string;
      rubricScores: { criterionName: string; score: number; maxScore: number }[];
      totalScore: number;
      finalRatio: number;
      ai_vs_teacher_diff?: number;
    },
    teacherActorId: string
  ): Promise<EssaySubmission> {
    const states = await attemptRepo.getAllStates();
    let targetEssay: EssaySubmission | null = null;
    let targetStudentId = '';

    for (const [sId, st] of Object.entries(states)) {
      const eIdx = st.essaySubmissions?.findIndex((e) => e.id === id);
      if (eIdx !== undefined && eIdx >= 0) {
        const original = st.essaySubmissions[eIdx];
        const aiScore = original.aiSuggestion?.suggestedTotalScore ?? grading.totalScore;
        const diff =
          grading.ai_vs_teacher_diff !== undefined
            ? grading.ai_vs_teacher_diff
            : Math.round(Math.abs(grading.totalScore - aiScore) * 10) / 10;

        const gradedEssay: EssaySubmission = {
          ...original,
          ...grading,
          finalScore: grading.totalScore,
          finalComment: grading.teacherFeedback,
          gradedAt: Date.now(),
          status: 'GRADED',
          ai_vs_teacher_diff: diff,
        };
        targetEssay = gradedEssay;
        st.essaySubmissions[eIdx] = gradedEssay;
        targetStudentId = sId;

        // Cập nhật Mastery cho học sinh lúc này.
        // Chủ đề phải là chủ đề THẬT của bài tập chứa câu hỏi này (qua quiz chứa nó,
        // hoặc ngân hàng câu hỏi) — trước đây mọi bài đều bị ghi vào chủ đề thơ
        const masteryLevel: SkillLevel = original.skillLevel || 'VAN_DUNG';
        const isPassed = grading.totalScore >= 5;
        const quizzes = readStorage<QuizWithMeta[]>(STORAGE_KEYS.QUIZZES, []);
        const localQuestions = readStorage<Record<string, any>>(STORAGE_KEYS.QUESTIONS, {});
        const essayTopicId =
          quizzes.find((q) => q.id === original.quizId)?.topicId ||
          localQuestions[original.questionId || '']?.topicId;
        if (!st.questionResults) st.questionResults = [];
        if (essayTopicId) {
          st.questionResults.push({
            questionId: original.questionId || id,
            level: masteryLevel,
            isCorrect: isPassed,
            scoreRatio: grading.finalRatio,
            timestamp: Date.now(),
            topicId: essayTopicId,
          });
        } else {
          console.warn('[Essay] Không xác định được chủ đề của bài viết, bỏ qua ghi mastery.');
        }

        await attemptRepo.saveStudentState(sId, st);
        break;
      }
    }

    if (!targetEssay) {
      const independent = readStorage<EssaySubmission[]>(STORAGE_KEYS.ESSAYS, []);
      const idx = independent.findIndex((e) => e.id === id);
      if (idx >= 0) {
        const original = independent[idx];
        const aiScore = original.aiSuggestion?.suggestedTotalScore ?? grading.totalScore;
        const diff =
          grading.ai_vs_teacher_diff !== undefined
            ? grading.ai_vs_teacher_diff
            : Math.round(Math.abs(grading.totalScore - aiScore) * 10) / 10;
        targetEssay = {
          ...original,
          ...grading,
          finalScore: grading.totalScore,
          finalComment: grading.teacherFeedback,
          gradedAt: Date.now(),
          status: 'GRADED',
          ai_vs_teacher_diff: diff,
        };
        independent[idx] = targetEssay;
        writeStorage(STORAGE_KEYS.ESSAYS, independent);
        targetStudentId = original.studentId;
      }
    }

    if (!targetEssay) throw new Error('Không tìm thấy bài viết');

    // Gửi thông báo đến trang chủ học sinh
    const annos = readStorage<any[]>('mam_van_announcements', []);
    annos.unshift({
      id: 'anno_' + Date.now(),
      title: `Bài viết đã được chấm: ${targetEssay.quizTitle || 'Bài làm văn'}`,
      content: `Thầy/cô đã chấm bài viết của em. Điểm: ${grading.totalScore}/10. Hãy xem nhận xét chi tiết nhé!`,
      type: 'essay_graded',
      targetClassIds: ['all'],
      studentId: targetStudentId,
      created_at: new Date().toISOString(),
    });
    writeStorage('mam_van_announcements', annos);

    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'GRADE_ESSAY',
      target_type: 'essay',
      target_id: id,
      target_name: `Bài viết của ${targetStudentId}`,
      details: {
        totalScore: grading.totalScore,
        ai_vs_teacher_diff: targetEssay.ai_vs_teacher_diff,
      },
    });

    syncEventBus.emit('essay');
    syncEventBus.emit('state');
    return targetEssay;
  }

  // ==========================================
  // HUẤN LUYỆN & CẤU HÌNH AI
  // ==========================================
  async getRubricTemplates(): Promise<RubricTemplate[]> {
    // Mặc định RỖNG: chỉ trả rubric giáo viên đã tự tạo/lưu (không còn rubric mẫu gieo sẵn)
    return readStorage<RubricTemplate[]>(STORAGE_KEYS.RUBRICS, []);
  }

  async saveRubricTemplate(template: Partial<RubricTemplate>): Promise<RubricTemplate> {
    const list = await this.getRubricTemplates();
    const id = template.id || 'rubric_' + generateUUID();
    const saved: RubricTemplate = {
      id,
      title: template.title || 'Rubric mới',
      category: template.category || 'cam_nghi',
      description: template.description || '',
      criteria: template.criteria || [],
      isDefault: !!template.isDefault,
      createdAt: template.createdAt || new Date().toISOString(),
    };
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) list[idx] = saved;
    else list.push(saved);
    writeStorage(STORAGE_KEYS.RUBRICS, list);
    syncEventBus.emit('essay');
    return saved;
  }

  async deleteRubricTemplate(id: string): Promise<void> {
    let list = await this.getRubricTemplates();
    list = list.filter((r) => r.id !== id);
    writeStorage(STORAGE_KEYS.RUBRICS, list);
    syncEventBus.emit('essay');
  }

  async getGradedSamples(): Promise<GradedSampleEssay[]> {
    // Mặc định RỖNG: chỉ trả bài mẫu giáo viên đã tự lưu (không còn bài mẫu chấm sẵn gieo sẵn)
    return readStorage<GradedSampleEssay[]>(STORAGE_KEYS.SAMPLES, []);
  }

  async saveGradedSample(sample: Partial<GradedSampleEssay>): Promise<GradedSampleEssay> {
    const list = await this.getGradedSamples();
    const id = sample.id || 'sample_' + generateUUID();
    const saved: GradedSampleEssay = {
      id,
      title: sample.title || 'Bài mẫu mới',
      topicPrompt: sample.topicPrompt || '',
      studentContent: sample.studentContent || '',
      levelGrade: sample.levelGrade || 'good',
      totalScore: sample.totalScore ?? 8,
      rubricScores: sample.rubricScores || [],
      teacherFeedback: sample.teacherFeedback || '',
      isFromStudentSubmission: !!sample.isFromStudentSubmission,
      createdAt: sample.createdAt || new Date().toISOString(),
    };
    const idx = list.findIndex((s) => s.id === id);
    if (idx >= 0) list[idx] = saved;
    else list.push(saved);
    writeStorage(STORAGE_KEYS.SAMPLES, list);
    syncEventBus.emit('essay');
    return saved;
  }

  async deleteGradedSample(id: string): Promise<void> {
    let list = await this.getGradedSamples();
    list = list.filter((s) => s.id !== id);
    writeStorage(STORAGE_KEYS.SAMPLES, list);
    syncEventBus.emit('essay');
  }

  async getGradingConfig(): Promise<AIGradingConfig> {
    return readStorage<AIGradingConfig>(STORAGE_KEYS.AI_CONFIG, SEED_AI_GRADING_CONFIG);
  }

  async saveGradingConfig(config: Partial<AIGradingConfig>): Promise<AIGradingConfig> {
    const current = await this.getGradingConfig();
    const updated = { ...current, ...config };
    writeStorage(STORAGE_KEYS.AI_CONFIG, updated);
    syncEventBus.emit('essay');
    return updated;
  }

  async getAIAccuracyMetrics(): Promise<AIAccuracyMetrics | null> {
    const all = await this.getSubmissions();
    const gradedWithDiff = all.filter((e) => e.status === 'GRADED' && e.ai_vs_teacher_diff !== undefined);

    // Chưa có bài nào vừa có gợi ý AI vừa có điểm chốt của giáo viên -> CHƯA
    // ĐỦ DỮ LIỆU, trả null để giao diện báo rõ (trước đây trả số mẫu bịa:
    // 0.35, xu hướng tuần, diff theo tiêu chí chế sẵn).
    if (gradedWithDiff.length === 0) {
      return null;
    }

    const r2 = (x: number) => Math.round(x * 100) / 100;

    const totalDiff = gradedWithDiff.reduce((acc, curr) => acc + (curr.ai_vs_teacher_diff || 0), 0);
    const avg = r2(totalDiff / gradedWithDiff.length);
    const highCount = gradedWithDiff.filter((e) => (e.ai_vs_teacher_diff || 0) > 1.5).length;
    const highRatio = Math.round((highCount / gradedWithDiff.length) * 100);

    // Xu hướng theo tuần THẬT: gom bài theo tuần (thứ Hai) của thời điểm
    // chốt điểm (gradedAt, thiếu thì dùng submittedAt), tính chênh TB tuần đó.
    const weekMap = new Map<number, { sum: number; total: number }>();
    gradedWithDiff.forEach((e) => {
      const ts = e.gradedAt || e.submittedAt || 0;
      const d = new Date(ts);
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const key = monday.getTime();
      const bucket = weekMap.get(key) || { sum: 0, total: 0 };
      bucket.sum += e.ai_vs_teacher_diff || 0;
      bucket.total += 1;
      weekMap.set(key, bucket);
    });
    const weeklyTrends = Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([key, b]) => {
        const d = new Date(key);
        return {
          week: `Tuần ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          diff: r2(b.sum / b.total),
          total: b.total,
        };
      });

    // Độ chênh theo tiêu chí THẬT: ghép cặp điểm tiêu chí của giáo viên
    // (rubricScores) với điểm tiêu chí AI gợi ý (aiSuggestion.rubricScores)
    // theo đúng tên tiêu chí, lấy trung bình |GV - AI| của từng tiêu chí.
    const critMap = new Map<string, { sum: number; total: number }>();
    gradedWithDiff.forEach((e) => {
      const aiScores = e.aiSuggestion?.rubricScores || [];
      if (aiScores.length === 0) return;
      (e.rubricScores || []).forEach((rs) => {
        const ai = aiScores.find((a) => a.criterionName === rs.criterionName);
        if (!ai) return;
        const bucket = critMap.get(rs.criterionName) || { sum: 0, total: 0 };
        bucket.sum += Math.abs((rs.score || 0) - (ai.score || 0));
        bucket.total += 1;
        critMap.set(rs.criterionName, bucket);
      });
    });
    const diffByCriterion = Array.from(critMap.entries())
      .map(([name, b]) => ({ name, diff: r2(b.sum / b.total) }))
      .sort((a, b) => b.diff - a.diff);

    return {
      averageDiff: avg,
      highDiffRatio: highRatio,
      gradedCount: gradedWithDiff.length,
      weeklyTrends,
      diffByCriterion,
    };
  }
}

export const essayRepo = new MockEssayRepository();

// ==========================================
// 9. REWARD REPOSITORY
// ==========================================
export class MockRewardRepository implements RewardRepository {
  async getRewards(): Promise<RewardItem[]> {
    return readStorage<RewardItem[]>(STORAGE_KEYS.REWARDS, getSeedRewards());
  }

  async saveReward(reward: Partial<RewardItem>): Promise<RewardItem> {
    const rewards = readStorage<RewardItem[]>(STORAGE_KEYS.REWARDS, getSeedRewards());
    let saved: RewardItem;

    if (reward.id) {
      const idx = rewards.findIndex((r) => r.id === reward.id);
      if (idx >= 0) {
        const cur = rewards[idx];
        const xpReq = reward.requiredXp ?? cur.requiredXp;
        const tierKey = reward.tierKey || (xpReq <= 300 ? 'HAT' : xpReq <= 500 ? 'LA' : xpReq <= 700 ? 'HOA' : 'VANG');
        saved = {
          ...cur,
          ...reward,
          requiredXp: xpReq,
          xpCost: xpReq,
          tierKey,
        } as RewardItem;
        rewards[idx] = saved;
      } else {
        const xpReq = reward.requiredXp ?? 280;
        const tierKey = reward.tierKey || (xpReq <= 300 ? 'HAT' : xpReq <= 500 ? 'LA' : xpReq <= 700 ? 'HOA' : 'VANG');
        saved = {
          id: reward.id,
          tierKey,
          requiredXp: xpReq,
          xpCost: xpReq,
          requiredAttendanceDays: reward.requiredAttendanceDays ?? 4,
          teaserDescription: reward.teaserDescription || 'Món quà bí mật thú vị',
          secret: reward.secret || { name: 'Món quà bí mật', description: 'Chi tiết quà tặng dành cho học sinh chăm chỉ.' },
          stock: reward.stock,
          isActive: reward.isActive ?? true,
        };
        rewards.push(saved);
      }
    } else {
      const xpReq = reward.requiredXp ?? 300;
      const tierKey = reward.tierKey || (xpReq <= 300 ? 'HAT' : xpReq <= 500 ? 'LA' : xpReq <= 700 ? 'HOA' : 'VANG');
      saved = {
        id: 'reward_' + generateUUID(),
        tierKey,
        requiredXp: xpReq,
        xpCost: xpReq,
        requiredAttendanceDays: reward.requiredAttendanceDays ?? 4,
        teaserDescription: reward.teaserDescription || 'Món quà bí mật thú vị',
        secret: reward.secret || { name: 'Món quà bí mật', description: 'Chi tiết quà tặng dành cho học sinh chăm chỉ.' },
        stock: reward.stock,
        isActive: reward.isActive ?? true,
      };
      rewards.push(saved);
    }

    writeStorage(STORAGE_KEYS.REWARDS, rewards);
    await auditRepo.log({
      actor_id: 'teacher_001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: reward.id ? 'UPDATE_REWARD_MILESTONE' : 'CREATE_REWARD_MILESTONE',
      target_type: 'reward',
      target_id: saved.id,
      target_name: `Mốc quà: ${saved.teaserDescription.slice(0, 30)}...`,
      details: { requiredXp: saved.requiredXp, requiredAttendanceDays: saved.requiredAttendanceDays },
    });

    syncEventBus.emit('reward');
    return saved;
  }

  async deleteReward(id: string): Promise<void> {
    let rewards = readStorage<RewardItem[]>(STORAGE_KEYS.REWARDS, getSeedRewards());
    const target = rewards.find((r) => r.id === id);
    rewards = rewards.filter((r) => r.id !== id);
    writeStorage(STORAGE_KEYS.REWARDS, rewards);

    await auditRepo.log({
      actor_id: 'teacher_001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'DELETE_REWARD_MILESTONE',
      target_type: 'reward',
      target_id: id,
      target_name: target ? target.teaserDescription.slice(0, 30) : id,
    });

    syncEventBus.emit('reward');
  }

  async getRequests(filter?: {
    classId?: string;
    studentId?: string;
    status?: RewardStatus;
  }): Promise<EnrichedRewardRequest[]> {
    const states = await attemptRepo.getAllStates();
    const students = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, SEED_STUDENTS);
    const classes = readStorage<ClassItem[]>(STORAGE_KEYS.CLASSES, SEED_CLASSES);
    const rewards = await this.getRewards();

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const rewardMap = new Map(rewards.map((r) => [r.id, r]));

    let allReqs: EnrichedRewardRequest[] = [];
    for (const [sId, st] of Object.entries(states)) {
      if (st.rewardRequests && st.rewardRequests.length > 0) {
        const student = studentMap.get(sId);
        const cls = student?.class_id ? classMap.get(student.class_id) : undefined;
        const xpWeekActual = st.xpWeek ?? 0;
        const attendanceDaysActual = st.attendanceDaysThisWeek ?? (st.attendanceHistory ? st.attendanceHistory.length : 0);

        st.rewardRequests.forEach((r) => {
          const reward = rewardMap.get(r.rewardId);
          const reqXp = reward ? (reward.requiredXp || reward.xpCost || 0) : 0;
          const reqDays = reward ? (reward.requiredAttendanceDays || 0) : 0;
          const isEligible = xpWeekActual >= reqXp && attendanceDaysActual >= reqDays;

          allReqs.push({
            ...r,
            studentId: sId,
            studentName: student?.name || sId,
            classId: student?.class_id,
            className: cls?.name || '',
            xpWeekActual,
            attendanceDaysActual,
            isEligible,
            reward,
          });
        });
      }
    }

    if (filter?.studentId) {
      allReqs = allReqs.filter((r) => r.studentId === filter.studentId);
    }

    if (filter?.status) {
      allReqs = allReqs.filter((r) => r.status === filter.status);
    }

    if (filter?.classId && filter.classId !== 'all') {
      allReqs = allReqs.filter((r) => r.classId === filter.classId);
    }

    return allReqs.sort((a, b) => b.requestedAt - a.requestedAt);
  }

  async createRequest(studentId: string, rewardId: string): Promise<RewardRequest> {
    const state = await attemptRepo.getStudentState(studentId);
    const rewards = await this.getRewards();
    const reward =
      rewards.find((r) => r.id === rewardId) ||
      REWARDS_CATALOG.find((r) => r.id === rewardId);

    // Đổi quà TRỪ vào TỔNG XP của tài khoản (XP vĩnh viễn, chỉ giảm khi xin
    // quà): giữ số XP ngay khi gửi yêu cầu để không tiêu hai lần; bị từ chối
    // sẽ hoàn lại. Mốc mở rương vẫn xét theo XP tuần như thiết kế.
    let deductedXp = 0;
    if (reward) {
      if ((state.totalXp || 0) < reward.requiredXp) {
        throw new Error(
          `Chưa đủ XP để xin phần quà này (cần ${reward.requiredXp} XP, hiện có ${state.totalXp || 0} XP)`
        );
      }
      deductedXp = reward.requiredXp;
      state.totalXp = (state.totalXp || 0) - deductedXp;
    }

    const newReq: RewardRequest = {
      id: 'req_' + generateUUID(),
      rewardId,
      requestedAt: Date.now(),
      status: 'PENDING_APPROVAL',
      deductedXp,
    };

    state.rewardRequests = [newReq, ...(state.rewardRequests || [])];
    await attemptRepo.saveStudentState(studentId, state);

    syncEventBus.emit('reward');
    return newReq;
  }

  async updateRequestStatus(
    requestId: string,
    status: RewardStatus,
    reason?: string,
    teacherActorId?: string
  ): Promise<RewardRequest> {
    const states = await attemptRepo.getAllStates();
    let updatedReq: RewardRequest | null = null;
    let targetStudentId = '';

    for (const [sId, st] of Object.entries(states)) {
      const idx = st.rewardRequests?.findIndex((r) => r.id === requestId);
      if (idx !== undefined && idx >= 0) {
        const cur = st.rewardRequests[idx];
        // Chặn chuyển trạng thái ngược/không hợp lệ (vd PENDING -> GIVEN bỏ qua duyệt,
        // OPENED/REJECTED là trạng thái cuối không được hồi sinh)
        const ALLOWED: Record<string, string[]> = {
          PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
          APPROVED: ['GIVEN', 'REJECTED'],
          GIVEN: ['OPENED'],
          OPENED: [],
          REJECTED: [],
        };
        if (cur.status !== status && !(ALLOWED[cur.status] || []).includes(status)) {
          throw new Error(
            `Không thể chuyển yêu cầu quà từ "${cur.status}" sang "${status}"`
          );
        }
        const now = Date.now();
        // Bị TỪ CHỐI -> hoàn lại vào TỔNG XP số đã trừ khi gửi yêu cầu
        let refundedXp = 0;
        if (status === 'REJECTED' && (cur.deductedXp || 0) > 0) {
          refundedXp = cur.deductedXp || 0;
          st.totalXp = (st.totalXp || 0) + refundedXp;
        }
        updatedReq = {
          ...cur,
          status,
          deductedXp: refundedXp > 0 ? 0 : cur.deductedXp,
          rejectReason: reason || cur.rejectReason,
          approvedAt: status === 'APPROVED' ? now : cur.approvedAt,
          givenAt: status === 'GIVEN' ? now : cur.givenAt,
          openedAt: status === 'OPENED' ? now : cur.openedAt,
        };
        st.rewardRequests[idx] = updatedReq;
        targetStudentId = sId;
        await attemptRepo.saveStudentState(sId, st);
        break;
      }
    }

    if (!updatedReq) throw new Error('Không tìm thấy yêu cầu quà tặng');

    if (teacherActorId) {
      const actionName =
        status === 'APPROVED'
          ? 'APPROVE_REWARD'
          : status === 'GIVEN'
          ? 'GIVE_REWARD'
          : status === 'REJECTED'
          ? 'REJECT_REWARD'
          : `REWARD_${status}`;

      await auditRepo.log({
        actor_id: teacherActorId,
        actor_name: 'Thầy/Cô',
        actor_role: 'teacher',
        action: actionName,
        target_type: 'reward',
        target_id: requestId,
        target_name: `Yêu cầu quà tặng (${targetStudentId})`,
        details: reason ? { reason } : undefined,
      });
    }

    syncEventBus.emit('reward');
    return updatedReq;
  }

  async batchUpdateStatus(
    requestIds: string[],
    status: RewardStatus,
    reason?: string,
    teacherActorId?: string
  ): Promise<void> {
    // Xử lý từng yêu cầu độc lập: yêu cầu không hợp lệ bị bỏ qua,
    // các yêu cầu còn lại vẫn được xử lý (không hủy cả lô vì 1 lỗi)
    for (const id of requestIds) {
      try {
        await this.updateRequestStatus(id, status, reason, teacherActorId);
      } catch (err) {
        console.error(`Bỏ qua yêu cầu ${id} khi cập nhật hàng loạt:`, err);
      }
    }
  }
}

export const rewardRepo = new MockRewardRepository();

// ==========================================
// 10. SETTING REPOSITORY
// ==========================================
/**
 * Cài đặt gắn RIÊNG theo giáo viên đang đăng nhập: khóa lưu trữ có hậu tố
 * id giáo viên (trước đây mọi tài khoản trên cùng trình duyệt dùng chung
 * một bản cài đặt). Chưa có bản riêng thì kế thừa bản chung cũ (mặc định).
 */
function settingsStorageKey(): string {
  try {
    const session = readStorage<any>(STORAGE_KEYS.SESSION, null);
    const u = session?.user;
    if (u && u.role === 'teacher' && u.id) {
      return STORAGE_KEYS.SETTINGS + ':' + u.id;
    }
  } catch {
    /* bỏ qua */
  }
  return STORAGE_KEYS.SETTINGS;
}

export class MockSettingRepository implements SettingRepository {
  async getSettings(): Promise<SystemSettings> {
    const key = settingsStorageKey();
    const own = readStorage<SystemSettings | null>(key, null);
    if (own) return own;
    return readStorage<SystemSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SYSTEM_SETTINGS);
  }

  async updateSettings(newSettings: Partial<SystemSettings>, actorId?: string): Promise<SystemSettings> {
    const current = await this.getSettings();
    const updated: SystemSettings = {
      schoolInfo: { ...current.schoolInfo, ...(newSettings.schoolInfo || {}) },
      mastery: { ...current.mastery, ...(newSettings.mastery || {}) },
      xp: { ...current.xp, ...(newSettings.xp || {}) },
      time: { ...current.time, ...(newSettings.time || {}) },
      notifications: { ...current.notifications, ...(newSettings.notifications || {}) },
    };

    // (Đã bỏ kiểm tra ràng buộc trần XP: mô hình XP hiện hành không còn
    // trần ngày/tuần nên không còn các trường đó trong cài đặt.)

    writeStorage(settingsStorageKey(), updated);

    await auditRepo.log({
      actor_id: actorId || 'teacher_001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'UPDATE_SETTINGS',
      target_type: 'setting',
      target_id: 'system_settings',
      target_name: 'Cài đặt hệ thống',
      details: { changedKeys: Object.keys(newSettings) },
    });

    syncEventBus.emit('settings');
    return updated;
  }

  async resetGroup(group: 'general' | 'mastery' | 'xp' | 'time' | 'notifications'): Promise<SystemSettings> {
    const current = await this.getSettings();
    let updated = { ...current };

    if (group === 'general') {
      updated.schoolInfo = { ...DEFAULT_SYSTEM_SETTINGS.schoolInfo };
    } else if (group === 'mastery') {
      updated.mastery = { ...DEFAULT_SYSTEM_SETTINGS.mastery };
    } else if (group === 'xp') {
      updated.xp = { ...DEFAULT_SYSTEM_SETTINGS.xp };
    } else if (group === 'time') {
      updated.time = { ...DEFAULT_SYSTEM_SETTINGS.time };
    } else if (group === 'notifications') {
      updated.notifications = { ...DEFAULT_SYSTEM_SETTINGS.notifications };
    }

    writeStorage(settingsStorageKey(), updated);
    await auditRepo.log({
      actor_id: 'teacher_001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: `RESET_SETTINGS_${group.toUpperCase()}`,
      target_type: 'setting',
      target_id: group,
      target_name: `Khôi phục cài đặt nhóm: ${group}`,
    });

    syncEventBus.emit('settings');
    return updated;
  }

  async resetAll(): Promise<SystemSettings> {
    writeStorage(settingsStorageKey(), DEFAULT_SYSTEM_SETTINGS);
    await auditRepo.log({
      actor_id: 'teacher_001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'RESET_ALL_SETTINGS',
      target_type: 'setting',
      target_id: 'system_settings',
      target_name: 'Khôi phục toàn bộ cài đặt mặc định',
    });
    syncEventBus.emit('settings');
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

export const settingRepo = new MockSettingRepository();

// ==========================================
// 12. TEACHER REPOSITORY (ADMIN QUẢN LÝ GIÁO VIÊN)
// ==========================================
export class MockTeacherRepository implements TeacherRepository {
  async getTeachers(): Promise<TeacherProfile[]> {
    let teachers = readStorage<TeacherProfile[]>(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
    if (!teachers || teachers.length === 0) {
      teachers = SEED_TEACHERS;
      writeStorage(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
    }
    return teachers.map((t) => ({
      ...t,
      status: t.status || 'active',
      role: 'teacher' as const,
      created_at: t.created_at || '2026-09-01T08:00:00.000Z',
    }));
  }

  async getTeacherById(id: string): Promise<TeacherProfile | null> {
    const list = await this.getTeachers();
    return list.find((t) => t.id === id) || null;
  }

  async createTeacher(data: CreateTeacherInput): Promise<TeacherProfile> {
    const teachers = readStorage<TeacherProfile[]>(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);

    // Tự sinh username nếu chưa có
    let username = data.username?.trim().toLowerCase();
    if (!username) {
      const count = teachers.length + 1;
      username = `gv${String(count).padStart(3, '0')}`;
      while (teachers.some((t) => t.username.toLowerCase() === username)) {
        username = `gv${Math.floor(100 + Math.random() * 900)}`;
      }
    } else {
      if (teachers.some((t) => t.username.toLowerCase() === username)) {
        throw new Error(`Tên đăng nhập "${username}" đã tồn tại trên hệ thống.`);
      }
    }

    const now = new Date().toISOString();
    const trialDays = data.trialDays || 3;
    const trialExpiresAt = data.status === 'trial'
      ? new Date(Date.now() + trialDays * 86400000).toISOString()
      : undefined;

    const newTeacher: TeacherProfile = {
      id: generateUUID(),
      name: data.name.trim(),
      username,
      password: data.password?.trim() || '123456',
      role: 'teacher',
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      school: data.school?.trim() || 'THCS Giấy & Mực',
      subject: data.subject?.trim() || 'Ngữ văn 7',
      classIds: [],
      status: data.status || 'active',
      trialDays: data.status === 'trial' ? trialDays : undefined,
      trialExpiresAt,
      notes: data.notes?.trim() || undefined,
      created_at: now,
      updated_at: now,
    };

    teachers.unshift(newTeacher);
    writeStorage(STORAGE_KEYS.TEACHERS, teachers);

    await auditRepo.log({
      actor_id: 'admin_001',
      actor_name: 'Quản trị viên',
      actor_role: 'admin',
      action: 'CREATE_TEACHER',
      target_type: 'teacher',
      target_id: newTeacher.id,
      target_name: `Tạo tài khoản giáo viên: ${newTeacher.name} (${newTeacher.username})`,
      details: { status: newTeacher.status, trialDays },
    });

    syncEventBus.emit('teacher', newTeacher, 'teacher-create');
    return newTeacher;
  }

  async updateTeacher(id: string, data: Partial<TeacherProfile>): Promise<TeacherProfile> {
    const teachers = readStorage<TeacherProfile[]>(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
    const idx = teachers.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Không tìm thấy tài khoản giáo viên để cập nhật.');

    const current = teachers[idx];
    const now = new Date().toISOString();

    const updated: TeacherProfile = {
      ...current,
      ...data,
      id: current.id,
      role: 'teacher',
      updated_at: now,
    };

    teachers[idx] = updated;
    writeStorage(STORAGE_KEYS.TEACHERS, teachers);

    await auditRepo.log({
      actor_id: 'admin_001',
      actor_name: 'Quản trị viên',
      actor_role: 'admin',
      action: 'UPDATE_TEACHER',
      target_type: 'teacher',
      target_id: updated.id,
      target_name: `Cập nhật thông tin giáo viên: ${updated.name}`,
    });

    syncEventBus.emit('teacher', updated, 'teacher-update');
    return updated;
  }

  async deleteTeacher(id: string): Promise<void> {
    const teachers = readStorage<TeacherProfile[]>(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
    const target = teachers.find((t) => t.id === id);
    if (!target) return;

    if (target.username === 'gv001') {
      throw new Error('Không thể xóa tài khoản mẫu cốt lõi gv001 của hệ thống.');
    }

    const filtered = teachers.filter((t) => t.id !== id);
    writeStorage(STORAGE_KEYS.TEACHERS, filtered);

    await auditRepo.log({
      actor_id: 'admin_001',
      actor_name: 'Quản trị viên',
      actor_role: 'admin',
      action: 'DELETE_TEACHER',
      target_type: 'teacher',
      target_id: id,
      target_name: `Xóa tài khoản giáo viên: ${target.name} (${target.username})`,
    });

    syncEventBus.emit('teacher', { id }, 'teacher-delete');
  }

  async toggleLockTeacher(id: string, locked?: boolean): Promise<TeacherProfile> {
    const teachers = readStorage<TeacherProfile[]>(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
    const idx = teachers.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Không tìm thấy tài khoản giáo viên.');

    const current = teachers[idx];
    const nextStatus = typeof locked === 'boolean'
      ? (locked ? 'locked' : 'active')
      : (current.status === 'locked' ? 'active' : 'locked');

    const updated: TeacherProfile = {
      ...current,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    teachers[idx] = updated;
    writeStorage(STORAGE_KEYS.TEACHERS, teachers);

    await auditRepo.log({
      actor_id: 'admin_001',
      actor_name: 'Quản trị viên',
      actor_role: 'admin',
      action: nextStatus === 'locked' ? 'LOCK_TEACHER' : 'UNLOCK_TEACHER',
      target_type: 'teacher',
      target_id: id,
      target_name: `${nextStatus === 'locked' ? 'Khóa' : 'Mở khóa'} tài khoản giáo viên: ${current.name}`,
    });

    syncEventBus.emit('teacher', updated, 'teacher-status');
    return updated;
  }
}

export const teacherRepo = new MockTeacherRepository();
