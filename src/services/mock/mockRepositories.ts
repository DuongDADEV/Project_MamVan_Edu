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
  SEED_AUDIT_LOGS,
  SEED_RUBRIC_TEMPLATES,
  SEED_GRADED_SAMPLES,
  SEED_AI_GRADING_CONFIG,
} from './seedData.ts';
import {
  generateUsername,
  generateFriendlyPassword,
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
import { generateDemoSeedData } from './demoSeedHistory.ts';

export const STORAGE_SCHEMA_VERSION = 'mam_van_v3_prompt5';

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
    schoolName: 'Trường THCS Lê Quý Đôn',
    academicYear: '2026-2027',
    semester: 'Học kỳ I',
    classNameDefault: '7A2',
  },
  mastery: {
    thresholdNeedsReview: 50,
    thresholdProgressing: 80,
    minQuestionsRequired: 5,
    weightDecayFactor: 0.88,
  },
  xp: {
    dailyCapUnder45Min: 130,
    dailyCapTotal: 150,
    weeklyCap: 900,
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
    return val ? JSON.parse(val) : defaultVal;
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

// Khởi tạo Seed Data lần đầu nếu chưa có
export function initSeedDataIfEmpty(): void {
  if (typeof window === 'undefined') return;

  const { students: demoStudents, studentStates: demoStates, classes: demoClasses } = generateDemoSeedData();

  if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
    writeStorage(STORAGE_KEYS.CLASSES, demoClasses);
  }
  const currentStudents = readStorage<StudentAccount[]>(STORAGE_KEYS.STUDENTS, []);
  if (!localStorage.getItem(STORAGE_KEYS.STUDENTS) || currentStudents.length < 20) {
    writeStorage(STORAGE_KEYS.STUDENTS, demoStudents);
    writeStorage(STORAGE_KEYS.CLASSES, demoClasses);
  }
  if (!localStorage.getItem(STORAGE_KEYS.TEACHERS)) {
    writeStorage(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.TOPICS)) {
    writeStorage(STORAGE_KEYS.TOPICS, getSeedTopics());
  }
  if (!localStorage.getItem(STORAGE_KEYS.VIDEOS)) {
    writeStorage(STORAGE_KEYS.VIDEOS, getSeedVideos());
  }
  if (!localStorage.getItem(STORAGE_KEYS.THEORIES)) {
    writeStorage(STORAGE_KEYS.THEORIES, getSeedTheories());
  }
  if (!localStorage.getItem(STORAGE_KEYS.QUIZZES)) {
    writeStorage(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
  }
  if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) {
    writeStorage(STORAGE_KEYS.QUESTIONS, getSeedQuestions());
  }
  if (!localStorage.getItem(STORAGE_KEYS.REWARDS)) {
    writeStorage(STORAGE_KEYS.REWARDS, getSeedRewards());
  }
  const currentStates = readStorage<Record<string, StudentState>>(STORAGE_KEYS.STATES, {});
  if (!localStorage.getItem(STORAGE_KEYS.STATES) || Object.keys(currentStates).length < 20) {
    writeStorage(STORAGE_KEYS.STATES, { ...getSeedStudentStates(), ...demoStates, ...currentStates });
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT)) {
    writeStorage(STORAGE_KEYS.AUDIT, SEED_AUDIT_LOGS);
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
 * Nếu chưa có hoặc phiên bản cũ/lỗi, dọn sạch dữ liệu cũ và nạp lại seed một lần duy nhất.
 */
export function bootstrapStorage(): { reset: boolean } {
  if (typeof window === 'undefined') return { reset: false };

  const currentVersion = localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
  if (currentVersion !== STORAGE_SCHEMA_VERSION) {
    console.log('[Storage] Phát hiện schema mới hoặc chưa có, tiến hành khởi tạo seed chuẩn...');
    const { students: demoStudents, studentStates: demoStates, classes: demoClasses } = generateDemoSeedData();

    // Xóa các key cũ của app
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('mam_van_') || k.startsWith('vo_muc_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Lỗi khi xóa key cũ:', e);
    }

    // Seed lại toàn bộ
    writeStorage(STORAGE_KEYS.SCHEMA_VERSION, STORAGE_SCHEMA_VERSION);
    writeStorage(STORAGE_KEYS.CLASSES, demoClasses);
    writeStorage(STORAGE_KEYS.STUDENTS, demoStudents);
    writeStorage(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
    writeStorage(STORAGE_KEYS.TOPICS, getSeedTopics());
    writeStorage(STORAGE_KEYS.VIDEOS, getSeedVideos());
    writeStorage(STORAGE_KEYS.THEORIES, getSeedTheories());
    writeStorage(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
    writeStorage(STORAGE_KEYS.QUESTIONS, getSeedQuestions());
    writeStorage(STORAGE_KEYS.REWARDS, getSeedRewards());
    writeStorage(STORAGE_KEYS.STATES, { ...getSeedStudentStates(), ...demoStates });
    writeStorage(STORAGE_KEYS.AUDIT, SEED_AUDIT_LOGS);
    writeStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SYSTEM_SETTINGS);
    return { reset: true };
  }

  // Đảm bảo không bị thiếu key nếu đã có schema_version
  initSeedDataIfEmpty();
  return { reset: false };
}

// Đặt lại toàn bộ dữ liệu demo (người dùng chủ động nhấn nút hoặc qua ErrorBoundary)
export function resetAllDemoData(): void {
  if (typeof window === 'undefined') return;
  const { students: demoStudents, studentStates: demoStates, classes: demoClasses } = generateDemoSeedData();

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('mam_van_') || k.startsWith('vo_muc_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Lỗi khi xóa localStorage:', e);
  }

  writeStorage(STORAGE_KEYS.SCHEMA_VERSION, STORAGE_SCHEMA_VERSION);
  writeStorage(STORAGE_KEYS.CLASSES, demoClasses);
  writeStorage(STORAGE_KEYS.STUDENTS, demoStudents);
  writeStorage(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
  writeStorage(STORAGE_KEYS.TOPICS, getSeedTopics());
  writeStorage(STORAGE_KEYS.VIDEOS, getSeedVideos());
  writeStorage(STORAGE_KEYS.THEORIES, getSeedTheories());
  writeStorage(STORAGE_KEYS.QUIZZES, getSeedQuizzes());
  writeStorage(STORAGE_KEYS.QUESTIONS, getSeedQuestions());
  writeStorage(STORAGE_KEYS.REWARDS, getSeedRewards());
  writeStorage(STORAGE_KEYS.STATES, { ...getSeedStudentStates(), ...demoStates });
  writeStorage(STORAGE_KEYS.AUDIT, SEED_AUDIT_LOGS);
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
      if ((uClean === 'admin' || uClean === 'quantri') && pClean === '123456') {
        const session: AuthSession = {
          user: {
            id: 'admin_001',
            name: 'Quản trị viên Hệ thống',
            username: 'admin',
            role: 'admin',
            email: 'admin@mamvan.edu.vn',
          },
          role: 'admin',
          signedInAt: Date.now(),
        };
        writeStorage(STORAGE_KEYS.SESSION, session);
        syncEventBus.emit('auth', session, 'auth-service');
        return { success: true, session };
      }
      return {
        success: false,
        error: 'Tài khoản Quản trị viên hoặc mật khẩu không chính xác (Gợi ý tài khoản demo: admin / 123456)',
      };
    }

    if (role === 'teacher') {
      const teachers = readStorage<TeacherProfile[]>(STORAGE_KEYS.TEACHERS, SEED_TEACHERS);
      const matched = teachers.find((t) => t.username.toLowerCase() === uClean);
      if (!matched) {
        return {
          success: false,
          error: 'Tài khoản giáo viên hoặc mật khẩu không chính xác (Gợi ý tài khoản demo: gv001 / 123456)',
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
      const validPw = (matched.password && matched.password === pClean) || pClean === '123456';
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
        error: 'Mật khẩu giáo viên chưa chính xác (Gợi ý tài khoản demo: gv001 / 123456)',
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
        states[student.id] = createFreshStudentState(student, cls ? `Lớp ${cls.name}` : 'Lớp 7A2');
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
      id: 'class_' + generateUUID().slice(0, 8),
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
        student_code: item.student_code?.trim(),
        dob: item.dob,
        status: 'active',
        has_logged_in: false,
        last_active_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      students.push(newStudent);
      createdStudents.push(newStudent);

      // Khởi tạo StudentState sạch bắt đầu từ 0
      states[id] = createFreshStudentState(newStudent, cls ? `Lớp ${cls.name}` : 'Lớp 7');

      credentials.push({
        id,
        name: newStudent.name,
        username: newStudent.username,
        initialPassword: rawPassword,
        class_id: newStudent.class_id,
        className: cls?.name || '7A2',
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
        className: cls?.name || '7A2',
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
      topics = topics.filter((t) => t.class_ids.includes('all') || t.class_ids.includes(classId));
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
      videos = videos.filter((v) => v.class_ids.includes('all') || v.class_ids.includes(classId));
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
      theories = theories.filter((t) => t.class_ids.includes('all') || t.class_ids.includes(classId));
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
        id: topic.id || 'topic_' + generateUUID().slice(0, 8),
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
        id: video.id || 'video_' + generateUUID().slice(0, 8),
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
        id: theory.id || 'theory_' + generateUUID().slice(0, 8),
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
        id: 'topic_' + generateUUID().slice(0, 8),
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
        id: 'video_' + generateUUID().slice(0, 8),
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
        id: 'theory_' + generateUUID().slice(0, 8),
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
      quizzes = quizzes.filter((q) => q.class_ids.includes('all') || q.class_ids.includes(classId));
    }
    return quizzes;
  }

  async getQuizById(id: string): Promise<QuizWithMeta | null> {
    const quizzes = await this.getQuizzes(undefined, false);
    return quizzes.find((q) => q.id === id) || null;
  }

  async getQuestions(topicId?: string): Promise<Record<string, QuestionWithMeta>> {
    const questions = readStorage<Record<string, QuestionWithMeta>>(STORAGE_KEYS.QUESTIONS, getSeedQuestions());
    if (!topicId) return questions;
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
    return questions[id] || null;
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
        id: quiz.id || 'quiz_' + generateUUID().slice(0, 8),
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
    const qId = question.id || 'q_' + generateUUID().slice(0, 8);
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
      const match = studentState.questionResults?.some((qr) => quiz.questionIds.includes(qr.questionId));
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
        const newQId = 'q_' + generateUUID().slice(0, 8);
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
      id: 'quiz_' + generateUUID().slice(0, 8),
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
      cls ? `Lớp ${cls.name}` : 'Lớp 7A2'
    );
    states[studentId] = fresh;
    writeStorage(STORAGE_KEYS.STATES, states);
    return fresh;
  }

  async saveStudentState(studentId: string, state: StudentState, sourceId?: string): Promise<void> {
    const states = readStorage<Record<string, StudentState>>(STORAGE_KEYS.STATES, {});
    states[studentId] = state;
    writeStorage(STORAGE_KEYS.STATES, states);

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
    return readStorage<Record<string, StudentState>>(STORAGE_KEYS.STATES, getSeedStudentStates());
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

    let allEssays: EssaySubmission[] = [];
    for (const [sId, st] of Object.entries(states)) {
      if (st.essaySubmissions) {
        // Gắn thêm studentName và className nếu thiếu
        const student = students.find((s) => s.id === sId);
        const enriched = st.essaySubmissions.map((e) => ({
          ...e,
          studentName: e.studentName || student?.name || 'Học sinh',
          className: e.className || '7A2',
          classId: e.classId || student?.class_id || 'class_7a2',
          hoursWaiting: Math.max(0, Math.floor((Date.now() - e.submittedAt) / 3600000)),
        }));
        allEssays = allEssays.concat(enriched);
      }
    }

    if (filter?.studentId) {
      allEssays = allEssays.filter((e) => e.studentId === filter.studentId);
    }

    if (filter?.quizId) {
      allEssays = allEssays.filter((e) => e.quizId === filter.quizId);
    }

    if (filter?.status && filter.status !== 'ALL') {
      if (filter.status === 'PENDING_TEACHER') {
        allEssays = allEssays.filter((e) => e.status === 'PENDING_TEACHER' || e.status === 'AI_SUGGESTED');
      } else {
        allEssays = allEssays.filter((e) => e.status === filter.status);
      }
    }

    if (filter?.classId && filter.classId !== 'all') {
      const allowedStudentIds = new Set(
        students.filter((s) => s.class_id === filter.classId).map((s) => s.id)
      );
      allEssays = allEssays.filter((e) => allowedStudentIds.has(e.studentId));
    }

    return allEssays.sort((a, b) => b.submittedAt - a.submittedAt);
  }

  async getSubmissionById(id: string): Promise<EssaySubmission | null> {
    const all = await this.getSubmissions();
    return all.find((e) => e.id === id) || null;
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
      id: 'sub_' + generateUUID().slice(0, 8),
      submittedAt: Date.now(),
      status: 'PENDING_TEACHER',
      studentName: submission.studentName || student?.name || 'Học sinh',
      className: submission.className || cls?.name || '7A2',
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

        // Cập nhật Mastery (Phân tích / Vận dụng) cho học sinh lúc này
        const masteryLevel: SkillLevel = original.skillLevel || 'VAN_DUNG';
        const isPassed = grading.totalScore >= 5;
        if (!st.questionResults) st.questionResults = [];
        st.questionResults.push({
          questionId: original.questionId || id,
          level: masteryLevel,
          isCorrect: isPassed,
          scoreRatio: grading.finalRatio,
          timestamp: Date.now(),
          topicId: 'topic_tho_bon_nam',
        });

        await attemptRepo.saveStudentState(sId, st);
        break;
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
    return readStorage<RubricTemplate[]>(STORAGE_KEYS.RUBRICS, SEED_RUBRIC_TEMPLATES);
  }

  async saveRubricTemplate(template: Partial<RubricTemplate>): Promise<RubricTemplate> {
    const list = await this.getRubricTemplates();
    const id = template.id || 'rubric_' + generateUUID().slice(0, 8);
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
    return readStorage<GradedSampleEssay[]>(STORAGE_KEYS.SAMPLES, SEED_GRADED_SAMPLES);
  }

  async saveGradedSample(sample: Partial<GradedSampleEssay>): Promise<GradedSampleEssay> {
    const list = await this.getGradedSamples();
    const id = sample.id || 'sample_' + generateUUID().slice(0, 8);
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

  async getAIAccuracyMetrics(): Promise<{
    averageDiff: number;
    highDiffRatio: number;
    weeklyTrends: { week: string; diff: number; total: number }[];
    diffByCriterion: { name: string; diff: number }[];
  }> {
    const all = await this.getSubmissions();
    const gradedWithDiff = all.filter((e) => e.status === 'GRADED' && e.ai_vs_teacher_diff !== undefined);

    if (gradedWithDiff.length === 0) {
      return {
        averageDiff: 0.35,
        highDiffRatio: 10,
        weeklyTrends: [
          { week: 'Tuần 1', diff: 0.6, total: 4 },
          { week: 'Tuần 2', diff: 0.4, total: 7 },
          { week: 'Tuần 3', diff: 0.35, total: 11 },
          { week: 'Tuần 4', diff: 0.25, total: 14 },
        ],
        diffByCriterion: [
          { name: 'Nội dung ý', diff: 0.35 },
          { name: 'Bố cục & Liên kết', diff: 0.2 },
          { name: 'Dùng từ đặt câu', diff: 0.15 },
          { name: 'Sáng tạo cảm xúc', diff: 0.45 },
        ],
      };
    }

    const totalDiff = gradedWithDiff.reduce((acc, curr) => acc + (curr.ai_vs_teacher_diff || 0), 0);
    const avg = Math.round((totalDiff / gradedWithDiff.length) * 10) / 10;
    const highCount = gradedWithDiff.filter((e) => (e.ai_vs_teacher_diff || 0) > 1.5).length;
    const highRatio = Math.round((highCount / gradedWithDiff.length) * 100);

    return {
      averageDiff: avg,
      highDiffRatio: highRatio,
      weeklyTrends: [
        { week: 'Tuần 3', diff: avg + 0.1, total: gradedWithDiff.length },
        { week: 'Tuần 4', diff: avg, total: gradedWithDiff.length },
      ],
      diffByCriterion: [
        { name: 'Nội dung ý & Cảm thụ', diff: Math.round(avg * 1.1 * 10) / 10 },
        { name: 'Bố cục & Liên kết', diff: Math.round(avg * 0.7 * 10) / 10 },
        { name: 'Dùng từ & Chính tả', diff: Math.round(avg * 0.5 * 10) / 10 },
        { name: 'Sáng tạo & Cảm xúc', diff: Math.round(avg * 1.2 * 10) / 10 },
      ],
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
        id: 'reward_' + generateUUID().slice(0, 8),
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
            studentName: student?.name || (sId === 'hs001' ? 'Nguyễn Minh Anh' : sId === 'hs002' ? 'Trần Gia Bảo' : sId),
            classId: student?.class_id,
            className: cls?.name || '7A2',
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
    const newReq: RewardRequest = {
      id: 'req_' + generateUUID().slice(0, 8),
      rewardId,
      requestedAt: Date.now(),
      status: 'PENDING_APPROVAL',
    };

    const state = await attemptRepo.getStudentState(studentId);
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
        const now = Date.now();
        updatedReq = {
          ...cur,
          status,
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
    for (const id of requestIds) {
      await this.updateRequestStatus(id, status, reason, teacherActorId);
    }
  }
}

export const rewardRepo = new MockRewardRepository();

// ==========================================
// 10. SETTING REPOSITORY
// ==========================================
export class MockSettingRepository implements SettingRepository {
  async getSettings(): Promise<SystemSettings> {
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

    // Kiểm tra ràng buộc hợp lệ:
    if (updated.xp.weeklyCap < updated.xp.dailyCapTotal) {
      throw new Error('Trần XP tuần không thể nhỏ hơn trần XP ngày tối đa');
    }
    if (updated.xp.dailyCapTotal < updated.xp.dailyCapUnder45Min) {
      throw new Error('Trần XP ngày tối đa không thể nhỏ hơn trần XP dưới 45 phút');
    }

    writeStorage(STORAGE_KEYS.SETTINGS, updated);

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

    writeStorage(STORAGE_KEYS.SETTINGS, updated);
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
    writeStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SYSTEM_SETTINGS);
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
