/**
 * ==============================================================================
 * DỰ ÁN MẦM VĂN 7 - SUPABASE REPOSITORIES (CORE IMPLEMENTATION)
 * ==============================================================================
 * Cung cấp kết nối trực tiếp tới Supabase Database (PostgreSQL).
 * Tuân thủ nghiêm ngặt các Interface Contract trong `src/services/types.ts`.
 * Tích hợp cơ chế fallback an toàn: nếu Supabase chưa cấu hình hoặc mất mạng,
 * tự động chuyển tiếp qua Mock Repository để đảm bảo ứng dụng luôn chạy mượt mà.
 */

import { supabase, isSupabaseReady } from './client.ts';
import {
  AuthRepository,
  ClassRepository,
  StudentRepository,
  AttemptRepository,
  EssayRepository,
  RewardRepository,
  RewardItem,
  RewardRequest,
  RewardStatus,
  EnrichedRewardRequest,
  Role,
  AuthSession,
  ClassItem,
  StudentAccount,
  CreateStudentInput,
  StudentCredentialVoucher,
  StudentState,
  QuestionResult,
  EssaySubmission,
  RubricTemplate,
  GradedSampleEssay,
  AIGradingConfig,
  TeacherRepository,
  TeacherProfile,
  CreateTeacherInput,
  QuizRepository,
  QuizWithMeta,
  QuestionWithMeta,
  ContentRepository,
  TopicWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
} from '../types.ts';
import {
  authRepo as mockAuthRepo,
  classRepo as mockClassRepo,
  studentRepo as mockStudentRepo,
  attemptRepo as mockAttemptRepo,
  essayRepo as mockEssayRepo,
  rewardRepo as mockRewardRepo,
  teacherRepo as mockTeacherRepo,
  quizRepo as mockQuizRepo,
  contentRepo as mockContentRepo,
  auditRepo,
} from '../mock/mockRepositories.ts';
import { createFreshStudentState } from '../mock/seedData.ts';
import { getLocalTodayStr } from '../../logic/studentStateUtils.ts';
import { syncEventBus } from '../mock/eventBus.ts';
import { QuestionType } from '../../types.ts';
import { QUESTIONS_BANK } from '../../data/mockData.ts';
import { REWARDS_CATALOG } from '../../data/rewards.ts';
import {
  PayloadItem,
  readLocalList,
  writeLocalList,
  pushPayloadItem,
  pushLocalById,
  syncPayloadCollection,
  filterContentItems,
  getSessionUser,
  sessionTeacherId,
  resolveContentOwnerId,
} from './payloadStore.ts';
import { generateUsername, generateFriendlyPassword, generateStudentCode } from '../mock/credentialUtils.ts';

const TOPIC_CACHE_KEY = 'mam_van_topics';
const VIDEO_CACHE_KEY = 'mam_van_videos';
const THEORY_CACHE_KEY = 'mam_van_theories';
const QUIZ_CACHE_KEY = 'mam_van_quizzes';

/**
 * Phạm vi dữ liệu của một giáo viên: các lớp và học sinh thuộc về giáo viên
 * đó. Mọi truy vấn đọc dữ liệu học tập ở phía giáo viên đều phải bị chặn
 * trong phạm vi này (tách dữ liệu riêng theo giáo viên).
 */
async function getTeacherScopeIds(
  teacherId: string
): Promise<{ classIds: string[]; studentIds: string[] }> {
  try {
    const { data: cls } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', teacherId);
    const classIds = (cls || []).map((c: any) => c.id as string);
    if (!classIds.length) return { classIds, studentIds: [] };
    const { data: sts } = await supabase
      .from('students')
      .select('id')
      .in('class_id', classIds);
    return { classIds, studentIds: (sts || []).map((s: any) => s.id as string) };
  } catch {
    return { classIds: [], studentIds: [] };
  }
}

const SESSION_STORAGE_KEY = 'mam_van_auth_session';
// PHẢI khớp dữ liệu seed trong database/schema.sql (gv001 / Lớp 7A2),
// nếu không mọi thao tác ghi dùng các mặc định này sẽ vi phạm khóa ngoại
const DEFAULT_TEACHER_UUID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_CLASS_UUID = '00000000-0000-0000-0000-000000000010';

function isUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ==============================================================================
// 1. SUPABASE AUTH REPOSITORY
// ==============================================================================
export class SupabaseAuthRepository implements AuthRepository {
  async signIn(
    role: Role,
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    session?: AuthSession;
    error?: string;
    isLocked?: boolean;
  }> {
    const uClean = username.trim().toLowerCase();
    const pClean = password.trim();

    if (!isSupabaseReady()) {
      return mockAuthRepo.signIn(role, uClean, pClean);
    }

    try {
      // 0. Phân hệ Quản trị viên (Admin) — tài khoản THẬT trong bảng teachers
      // (role = 'admin', tạo bằng database/migration_006_admin_account.sql).
      // Đã gỡ hoàn toàn thông tin đăng nhập ghi cứng khỏi mã nguồn (đợt 21/10).
      if (role === 'admin') {
        const { data: admin, error } = await supabase
          .from('teachers')
          .select('*')
          .ilike('username', uClean)
          .eq('role', 'admin')
          .maybeSingle();

        if (error) {
          console.warn('[SupabaseAuth] Lỗi truy vấn tài khoản admin, fallback sang mock:', error.message);
          return mockAuthRepo.signIn(role, uClean, pClean);
        }

        if (!admin) {
          // Tài khoản có thể chỉ tồn tại ở kho local — thử local trước khi kết luận
          const localAttempt = await mockAuthRepo.signIn(role, uClean, pClean);
          if (localAttempt.success) return localAttempt;
          return {
            success: false,
            error: 'Tài khoản Quản trị viên không tồn tại trên hệ thống',
          };
        }

        if (admin.status === 'locked') {
          return {
            success: false,
            isLocked: true,
            error: 'Tài khoản Quản trị viên đã bị khóa. Vui lòng liên hệ hỗ trợ kỹ thuật!',
          };
        }

        const validPassword = admin.password_hash === pClean;
        if (!validPassword) {
          return {
            success: false,
            error: 'Mật khẩu Quản trị viên chưa chính xác',
          };
        }

        const session: AuthSession = {
          user: {
            id: admin.id,
            name: admin.name,
            username: admin.username,
            role: 'admin',
            email: admin.email || undefined,
          },
          role: 'admin',
          signedInAt: Date.now(),
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        }
        syncEventBus.emit('auth', session, 'supabase-auth');
        return { success: true, session };
      }

      // 1. Phân hệ Giáo viên
      if (role === 'teacher') {
        const { data: teacher, error } = await supabase
          .from('teachers')
          .select('*')
          .ilike('username', uClean)
          .eq('role', 'teacher')
          .maybeSingle();

        if (error) {
          console.warn('[SupabaseAuth] Lỗi truy vấn bảng teachers, fallback sang mock:', error.message);
          return mockAuthRepo.signIn(role, uClean, pClean);
        }

        if (!teacher) {
          // Tài khoản có thể chỉ tồn tại ở kho local (tạo lúc mất kết nối) —
          // thử đăng nhập local trước khi kết luận không tồn tại
          const localAttempt = await mockAuthRepo.signIn(role, uClean, pClean);
          if (localAttempt.success) return localAttempt;
          return {
            success: false,
            error: 'Tài khoản giáo viên không tồn tại trên hệ thống',
          };
        }

        if (teacher.status === 'locked') {
          return {
            success: false,
            isLocked: true,
            error: 'Tài khoản giáo viên đã bị khóa. Vui lòng liên hệ quản trị viên!',
          };
        }

        const validPassword = teacher.password_hash === pClean;
        if (!validPassword) {
          return {
            success: false,
            error: 'Mật khẩu giáo viên chưa chính xác',
          };
        }

        const { data: classRows } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', teacher.id);

        const classIds = classRows?.map((c) => c.id) || [];

        const session: AuthSession = {
          user: {
            id: teacher.id,
            name: teacher.name,
            username: teacher.username,
            role: 'teacher',
            email: teacher.email || undefined,
            subject: teacher.subject || 'Ngữ văn 7',
            school: teacher.school || 'THCS Giấy & Mực',
            classIds: classIds.length > 0 ? classIds : [DEFAULT_CLASS_UUID],
            phone: teacher.phone || undefined,
          },
          role: 'teacher',
          signedInAt: Date.now(),
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        }
        syncEventBus.emit('auth', session, 'supabase-auth');
        return { success: true, session };
      }

      // 2. Phân hệ Học sinh
      if (role === 'student') {
        const { data: student, error } = await supabase
          .from('students')
          .select('*, classes(name, grade, school_year)')
          .ilike('username', uClean)
          .maybeSingle();

        if (error) {
          console.warn('[SupabaseAuth] Lỗi truy vấn bảng students, fallback sang mock:', error.message);
          return mockAuthRepo.signIn(role, uClean, pClean);
        }

        if (!student) {
          // Tài khoản có thể chỉ tồn tại ở kho local (tạo lúc mất kết nối)
          const localAttempt = await mockAuthRepo.signIn(role, uClean, pClean);
          if (localAttempt.success) return localAttempt;
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

        const validPassword = student.password_hash === pClean;
        if (!validPassword) {
          return {
            success: false,
            error: 'Mật khẩu chưa chính xác. Nếu quên mật khẩu, em hãy nhờ Thầy/Cô cấp lại nhé!',
          };
        }

        await supabase
          .from('students')
          .update({
            has_logged_in: true,
            last_active_at: new Date().toISOString(),
          })
          .eq('id', student.id);

        const session: AuthSession = {
          user: {
            id: student.id,
            name: student.name,
            username: student.username,
            role: 'student',
            grade: (student.classes as any)?.grade || 'Lớp 7',
            school: 'THCS Giấy & Mực',
            avatarSeed: student.avatar_seed || student.username,
          },
          role: 'student',
          signedInAt: Date.now(),
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        }
        syncEventBus.emit('auth', session, 'supabase-auth');
        syncEventBus.emit('student', { studentId: student.id }, 'supabase-auth');
        return { success: true, session };
      }

      return { success: false, error: 'Phân hệ đang được hoàn thiện!' };
    } catch (err: any) {
      console.error('[SupabaseAuth] Ngoại lệ khi đăng nhập:', err);
      return mockAuthRepo.signIn(role, uClean, pClean);
    }
  }

  async signOut(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      // TÁCH DỮ LIỆU THEO TÀI KHOẢN: dọn toàn bộ bộ nhớ đệm nội dung/dữ liệu
      // học tập của tài khoản vừa đăng xuất — tài khoản khác đăng nhập trên
      // cùng trình duyệt không được thấy sót lại bất cứ thứ gì.
      try {
        [
          'mam_van_topics',
          'mam_van_videos',
          'mam_van_theories',
          'mam_van_quizzes',
          'mam_van_questions',
          'mam_van_student_states',
          'mam_van_essay_submissions',
          'mam_van_reward_requests',
        ].forEach((k) => localStorage.removeItem(k));
        Object.keys(localStorage)
          .filter((k) => k.startsWith('mam_van_system_settings'))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* bỏ qua lỗi dọn dẹp */
      }
    }
    syncEventBus.emit('auth', null, 'supabase-auth');
  }

  async getSession(): Promise<AuthSession | null> {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export const supabaseAuthRepo = new SupabaseAuthRepository();

// ==============================================================================
// 2. SUPABASE CLASS REPOSITORY
// ==============================================================================
export class SupabaseClassRepository implements ClassRepository {
  async getClasses(teacherId?: string): Promise<ClassItem[]> {
    if (!isSupabaseReady()) {
      return mockClassRepo.getClasses(teacherId);
    }

    try {
      let query = supabase
        .from('classes')
        .select('*, students(id, last_active_at)')
        .order('name', { ascending: true });

      let targetTeacherId = teacherId;
      if (targetTeacherId === 'gv001') {
        targetTeacherId = DEFAULT_TEACHER_UUID;
      }
      if (targetTeacherId && isUUID(targetTeacherId)) {
        query = query.eq('teacher_id', targetTeacherId);
      } else if (targetTeacherId) {
        // teacherId không phải UUID và không ánh xạ được (vd id từ kho local):
        // KHÔNG được bỏ lọc rồi trả TẤT CẢ lớp của mọi giáo viên
        return mockClassRepo.getClasses(teacherId);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.warn('[SupabaseClass] Không tải được bảng classes, fallback sang mock:', error?.message);
        return mockClassRepo.getClasses(teacherId);
      }

      const now = Date.now();
      const sevenDaysAgo = now - 7 * 86400000;

      const dbClasses = data.map((c: any) => {
        const validStudents: any[] = Array.isArray(c.students) ? c.students : [];
        const active7DaysCount = validStudents.filter((s) => {
          if (!s.last_active_at) return false;
          const t = new Date(s.last_active_at).getTime();
          return t >= sevenDaysAgo;
        }).length;

        return {
          id: c.id,
          name: c.name,
          grade: c.grade || 'Lớp 7',
          schoolYear: c.school_year || '2026-2027',
          teacherId: c.teacher_id,
          description: c.description || undefined,
          studentCount: validStudents.length,
          active7DaysCount,
          status: (c.status as 'active' | 'archived') || 'active',
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
          deleted_at: null,
        };
      });

      // Gộp thêm các lớp chỉ tồn tại ở kho local (tạo lúc mất mạng/chưa đồng bộ)
      try {
        const localClasses = await mockClassRepo.getClasses(teacherId);
        const dbIds = new Set(dbClasses.map((c) => c.id));
        const localOnly = localClasses.filter((c) => !dbIds.has(c.id));
        return [...dbClasses, ...localOnly];
      } catch {
        return dbClasses;
      }
    } catch (err) {
      console.error('[SupabaseClass] Ngoại lệ khi getClasses:', err);
      return mockClassRepo.getClasses(teacherId);
    }
  }

  async getClassById(id: string): Promise<ClassItem | null> {
    const list = await this.getClasses();
    return list.find((c) => c.id === id) || null;
  }

  async createClass(
    data: Omit<ClassItem, 'id' | 'created_at' | 'updated_at' | 'studentCount' | 'active7DaysCount'>
  ): Promise<ClassItem> {
    if (!isSupabaseReady()) {
      return mockClassRepo.createClass(data);
    }

    try {
      const payload = {
        name: data.name,
        grade: data.grade || 'Lớp 7',
        school_year: data.schoolYear || '2026-2027',
        teacher_id: isUUID(data.teacherId) ? data.teacherId : DEFAULT_TEACHER_UUID,
        description: data.description || null,
        status: data.status || 'active',
      };

      const { data: created, error } = await supabase
        .from('classes')
        .insert(payload)
        .select()
        .single();

      if (error || !created) {
        console.warn('[SupabaseClass] Thất bại khi tạo lớp trên Supabase, chuyển qua mock:', error?.message);
        return mockClassRepo.createClass(data);
      }

      await auditRepo.log({
        actor_id: data.teacherId || 'gv001',
        actor_name: 'Thầy/Cô',
        actor_role: 'teacher',
        action: 'CREATE_CLASS',
        target_type: 'class',
        target_id: created.id,
        target_name: `Lớp ${created.name} (${created.school_year})`,
        details: { grade: created.grade },
      });

      syncEventBus.emit('class');

      return {
        id: created.id,
        name: created.name,
        grade: created.grade,
        schoolYear: created.school_year,
        teacherId: created.teacher_id,
        description: created.description || undefined,
        studentCount: 0,
        active7DaysCount: 0,
        status: created.status || 'active',
        created_at: created.created_at,
        updated_at: created.updated_at,
        deleted_at: null,
      };
    } catch (err) {
      console.error('[SupabaseClass] Ngoại lệ khi createClass:', err);
      return mockClassRepo.createClass(data);
    }
  }

  async updateClass(id: string, data: Partial<ClassItem>): Promise<ClassItem> {
    if (!isSupabaseReady()) {
      return mockClassRepo.updateClass(id, data);
    }

    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (data.name !== undefined) payload.name = data.name;
      if (data.grade !== undefined) payload.grade = data.grade;
      if (data.schoolYear !== undefined) payload.school_year = data.schoolYear;
      if (data.description !== undefined) payload.description = data.description;
      if (data.status !== undefined) payload.status = data.status;

      const { data: updated, error } = await supabase
        .from('classes')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error || !updated) {
        console.warn('[SupabaseClass] Lỗi updateClass Supabase, chuyển qua mock:', error?.message);
        return mockClassRepo.updateClass(id, data);
      }

      syncEventBus.emit('class');
      // Đọc lại bản ghi đầy đủ (kèm số học sinh thật) thay vì trả studentCount = 0
      const fresh = await this.getClassById(updated.id);
      if (fresh) return fresh;
      return {
        id: updated.id,
        name: updated.name,
        grade: updated.grade,
        schoolYear: updated.school_year,
        teacherId: updated.teacher_id,
        description: updated.description || undefined,
        studentCount: data.studentCount || 0,
        active7DaysCount: data.active7DaysCount || 0,
        status: updated.status,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        deleted_at: null,
      };
    } catch (err) {
      console.error('[SupabaseClass] Ngoại lệ updateClass:', err);
      return mockClassRepo.updateClass(id, data);
    }
  }

  async archiveClass(id: string): Promise<void> {
    await this.updateClass(id, { status: 'archived' });
  }
}

export const supabaseClassRepo = new SupabaseClassRepository();

// ==============================================================================
// 3. SUPABASE STUDENT REPOSITORY
// ==============================================================================
export class SupabaseStudentRepository implements StudentRepository {
  async getStudents(filter?: {
    classId?: string;
    search?: string;
    status?: 'active' | 'locked' | 'all';
  }): Promise<StudentAccount[]> {
    if (!isSupabaseReady()) {
      return mockStudentRepo.getStudents(filter);
    }

    try {
      let query = supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true });

      if (filter?.classId && filter.classId !== 'all') {
        const cId = filter.classId === 'class_7a2' ? DEFAULT_CLASS_UUID : filter.classId;
        if (isUUID(cId)) {
          query = query.eq('class_id', cId);
        }
      }

      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.warn('[SupabaseStudent] Không tải được bảng students, fallback sang mock:', error?.message);
        return mockStudentRepo.getStudents(filter);
      }

      let result: StudentAccount[] = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        username: s.username,
        password_hash: s.password_hash,
        class_id: s.class_id,
        student_code: s.student_code || undefined,
        dob: s.dob || undefined,
        status: (s.status as 'active' | 'locked') || 'active',
        has_logged_in: Boolean(s.has_logged_in),
        last_active_at: s.last_active_at ? new Date(s.last_active_at).getTime() : null,
        created_at: s.created_at,
        updated_at: s.updated_at,
        deleted_at: null,
      }));

      if (filter?.search) {
        const q = filter.search.toLowerCase().trim();
        result = result.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.username.toLowerCase().includes(q) ||
            (s.student_code && s.student_code.toLowerCase().includes(q))
        );
      }

      // Hợp nhất với kho mock (local): học sinh từng rơi vào đường fallback khi
      // tạo vẫn phải hiển thị trong danh sách, tránh lỗi "thêm mà không thấy".
      try {
        const dbIds = new Set(result.map((s) => s.id));
        const dbUsernames = new Set(result.map((s) => s.username.toLowerCase()));
        const mockList = await mockStudentRepo.getStudents(filter);
        const extras = mockList.filter(
          (s) => !dbIds.has(s.id) && !dbUsernames.has(s.username.toLowerCase())
        );
        if (extras.length > 0) {
          result = [...result, ...extras].sort((a, b) => a.name.localeCompare(b.name));
        }
      } catch {
        // Bỏ qua lỗi hợp nhất, giữ nguyên kết quả từ DB
      }

      return result;
    } catch (err) {
      console.error('[SupabaseStudent] Ngoại lệ getStudents:', err);
      return mockStudentRepo.getStudents(filter);
    }
  }

  async getStudentById(id: string): Promise<StudentAccount | null> {
    if (!isSupabaseReady()) {
      return mockStudentRepo.getStudentById(id);
    }
    try {
      let query = supabase.from('students').select('*');
      if (isUUID(id)) {
        query = query.eq('id', id);
      } else {
        query = query.eq('username', id);
      }

      const { data, error } = await query.maybeSingle();
      if (error || !data) {
        return mockStudentRepo.getStudentById(id);
      }

      return {
        id: data.id,
        name: data.name,
        username: data.username,
        password_hash: data.password_hash,
        class_id: data.class_id,
        student_code: data.student_code || undefined,
        dob: data.dob || undefined,
        status: data.status || 'active',
        has_logged_in: Boolean(data.has_logged_in),
        last_active_at: data.last_active_at ? new Date(data.last_active_at).getTime() : null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        deleted_at: null,
      };
    } catch {
      return mockStudentRepo.getStudentById(id);
    }
  }

  async createStudent(
    data: CreateStudentInput,
    teacherActorId: string
  ): Promise<{ student: StudentAccount; credential: StudentCredentialVoucher }> {
    if (!isSupabaseReady()) {
      return mockStudentRepo.createStudent(data, teacherActorId);
    }

    try {
      const cleanName = data.name.trim();
      // Tên đăng nhập: ưu tiên giá trị giáo viên đặt; nếu trống thì sinh theo chuẩn
      // dự án (generateUsername xác định, không ngẫu nhiên) dựa trên danh sách hiện có.
      let generatedUsername = data.custom_username?.trim().toLowerCase() || '';
      if (!generatedUsername) {
        const existing = await this.getStudents();
        generatedUsername = generateUsername(
          cleanName,
          existing.map((s) => s.username.toLowerCase())
        );
      }
      const initialPassword = data.custom_password?.trim() || generateFriendlyPassword(8);
      // class_id: UUID dùng thẳng; id lớp mẫu 'class_7a2' ánh xạ sang lớp mặc định
      // (giống đường đọc getStudents). Id lạ không thuộc DB thì để mock xử lý để
      // giữ đúng lớp — danh sách đọc đã hợp nhất nên học sinh vẫn hiển thị.
      let cleanClassId: string | null = null;
      if (isUUID(data.class_id)) {
        cleanClassId = data.class_id;
      } else if (data.class_id === 'class_7a2') {
        cleanClassId = DEFAULT_CLASS_UUID;
      }
      if (!cleanClassId) {
        return mockStudentRepo.createStudent(data, teacherActorId);
      }

      const payload = {
        name: cleanName,
        username: generatedUsername,
        password_hash: initialPassword,
        class_id: cleanClassId,
        student_code:
          data.student_code?.trim() ||
          generateStudentCode((await this.getStudents()).map((s) => s.student_code)),
        dob: data.dob || null,
        status: 'active',
        has_logged_in: false,
      };

      let { data: created, error } = await supabase
        .from('students')
        .insert(payload)
        .select()
        .single();

      if ((error || !created) && error) {
        // Trùng tên đăng nhập ở DB (unique): sinh lại tên khác và thử lại 1 lần
        // thay vì đổ sang mock khiến học sinh "tạo mà không thấy".
        const isDuplicateUsername =
          (error as any).code === '23505' || /username|duplicate/i.test(error.message || '');
        if (isDuplicateUsername) {
          const existing = await this.getStudents();
          const retryUsername = generateUsername(
            cleanName,
            existing.map((s) => s.username.toLowerCase()).concat(generatedUsername)
          );
          const retry = await supabase
            .from('students')
            .insert({ ...payload, username: retryUsername })
            .select()
            .single();
          if (!retry.error && retry.data) {
            created = retry.data;
            error = null;
          }
        }
      }

      if (error || !created) {
        console.warn('[SupabaseStudent] Không tạo được học sinh trên DB, dùng mock:', error?.message);
        return mockStudentRepo.createStudent(data, teacherActorId);
      }

      await supabase.from('student_states').upsert({
        student_id: created.id,
        xp_today: 0,
        xp_week: 0,
        total_xp: 0,
        active_seconds_today: 0,
        consecutive_days: 1,
        topic_mastery: { topic_1: 0, topic_2: 0, topic_3: 0, topic_4: 0 },
      });

      const student: StudentAccount = {
        id: created.id,
        name: created.name,
        username: created.username,
        password_hash: created.password_hash,
        class_id: created.class_id,
        student_code: created.student_code || undefined,
        dob: created.dob || undefined,
        status: 'active',
        has_logged_in: false,
        created_at: created.created_at,
        updated_at: created.updated_at,
        deleted_at: null,
      };

      const credential: StudentCredentialVoucher = {
        id: created.id,
        name: created.name,
        username: created.username,
        initialPassword,
        class_id: created.class_id,
        student_code: created.student_code || undefined,
      };

      await auditRepo.log({
        actor_id: teacherActorId,
        actor_name: 'Thầy/Cô',
        actor_role: 'teacher',
        action: 'CREATE_STUDENT',
        target_type: 'student',
        target_id: created.id,
        target_name: created.name,
        details: { username: created.username },
      });

      syncEventBus.emit('student');
      syncEventBus.emit('class');
      return { student, credential };
    } catch (err) {
      console.error('[SupabaseStudent] Ngoại lệ createStudent:', err);
      return mockStudentRepo.createStudent(data, teacherActorId);
    }
  }

  async createStudentsBatch(
    data: CreateStudentInput[],
    teacherActorId: string
  ): Promise<{ students: StudentAccount[]; credentials: StudentCredentialVoucher[] }> {
    const students: StudentAccount[] = [];
    const credentials: StudentCredentialVoucher[] = [];

    for (const item of data) {
      const res = await this.createStudent(item, teacherActorId);
      students.push(res.student);
      credentials.push(res.credential);
    }
    return { students, credentials };
  }

  async updateStudent(
    id: string,
    data: Partial<StudentAccount>,
    teacherActorId: string
  ): Promise<StudentAccount> {
    if (!isSupabaseReady()) {
      return mockStudentRepo.updateStudent(id, data, teacherActorId);
    }

    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (data.name !== undefined) payload.name = data.name;
      if (data.username !== undefined) payload.username = data.username;
      if ((data as any).password_hash !== undefined) {
        payload.password_hash = (data as any).password_hash;
      }
      if ((data as any).password !== undefined) payload.password_hash = (data as any).password;
      if (data.student_code !== undefined) payload.student_code = data.student_code;
      if (data.dob !== undefined) payload.dob = data.dob;
      if (data.class_id !== undefined && isUUID(data.class_id)) payload.class_id = data.class_id;
      if (data.status !== undefined) payload.status = data.status;

      const { data: updated, error } = await supabase
        .from('students')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error || !updated) {
        return mockStudentRepo.updateStudent(id, data, teacherActorId);
      }

      syncEventBus.emit('student');
      syncEventBus.emit('class');
      return {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        password_hash: updated.password_hash,
        class_id: updated.class_id,
        student_code: updated.student_code || undefined,
        dob: updated.dob || undefined,
        status: updated.status,
        has_logged_in: Boolean(updated.has_logged_in),
        last_active_at: updated.last_active_at ? new Date(updated.last_active_at).getTime() : null,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        deleted_at: null,
      };
    } catch {
      return mockStudentRepo.updateStudent(id, data, teacherActorId);
    }
  }

  async deleteStudent(id: string, teacherActorId: string): Promise<void> {
    if (!isSupabaseReady()) {
      return mockStudentRepo.deleteStudent(id, teacherActorId);
    }
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) {
        console.error('[SupabaseStudent] Lỗi xóa học sinh trên DB, chuyển kho local:', error.message);
        return mockStudentRepo.deleteStudent(id, teacherActorId);
      }
      syncEventBus.emit('student');
      syncEventBus.emit('class');
    } catch {
      return mockStudentRepo.deleteStudent(id, teacherActorId);
    }
  }

  async resetPassword(
    id: string,
    teacherActorId: string,
    customNewPassword?: string
  ): Promise<{ credential: StudentCredentialVoucher }> {
    const newPass = customNewPassword?.trim() || generateFriendlyPassword(8);
    if (!isSupabaseReady()) {
      return mockStudentRepo.resetPassword(id, teacherActorId, newPass);
    }

    try {
      const { data: updated, error } = await supabase
        .from('students')
        .update({ password_hash: newPass, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error || !updated) {
        return mockStudentRepo.resetPassword(id, teacherActorId, newPass);
      }

      syncEventBus.emit('student');
      return {
        credential: {
          id: updated.id,
          name: updated.name,
          username: updated.username,
          initialPassword: newPass,
          class_id: updated.class_id,
          student_code: updated.student_code || undefined,
        },
      };
    } catch {
      return mockStudentRepo.resetPassword(id, teacherActorId, newPass);
    }
  }

  async toggleLock(id: string, isLocked: boolean, teacherActorId: string): Promise<StudentAccount> {
    return this.updateStudent(id, { status: isLocked ? 'locked' : 'active' }, teacherActorId);
  }

  async changeClass(id: string, newClassId: string, teacherActorId: string): Promise<StudentAccount> {
    return this.updateStudent(id, { class_id: newClassId }, teacherActorId);
  }
}

export const supabaseStudentRepo = new SupabaseStudentRepository();

// ==============================================================================
// 4. SUPABASE ATTEMPT REPOSITORY (TIẾN ĐỘ & XP)
// ==============================================================================
export class SupabaseAttemptRepository implements AttemptRepository {
  // Dựng state trắng từ HỒ SƠ THẬT của học sinh (đúng tên + đúng lớp) —
  // tránh hồ sơ mẫu chung chung "Học sinh / Lớp 7A2" cho tài khoản mới
  private async buildFreshFromAccount(studentId: string): Promise<StudentState | null> {
    try {
      const students = await supabaseStudentRepo.getStudents();
      const student = students.find((st) => st.id === studentId);
      if (!student) return null;
      let className: string | undefined;
      try {
        const cls = await supabaseClassRepo.getClassById(student.class_id);
        if (cls?.name) className = cls.name.startsWith('Lớp') ? cls.name : `Lớp ${cls.name}`;
      } catch {}
      return createFreshStudentState(student, className);
    } catch {
      return null;
    }
  }

  async getStudentState(studentId: string): Promise<StudentState> {
    const localFallback = await mockAttemptRepo.getStudentState(studentId);
    if (!isSupabaseReady() || !isUUID(studentId)) {
      return localFallback;
    }

    try {
      const { data, error } = await supabase
        .from('student_states')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (error || !data) {
        // Chưa có dòng state trên DB (học sinh mới): bắt đầu TRẮNG với hồ sơ
        // THẬT của em. KHÔNG thừa kế tiến độ từ bản local — bản local có thể là
        // dữ liệu mẫu/đệm cũ của trình duyệt và sẽ làm ô nhiễm DB khi được lưu
        // ngược lên (đã gặp thực tế: state mẫu 310 XP ghi đè học sinh mới).
        const freshReal = await this.buildFreshFromAccount(studentId);
        if (freshReal) {
          return freshReal;
        }
        return localFallback;
      }

      const students = await supabaseStudentRepo.getStudents();
      const student = students.find((s) => s.id === studentId);
      const fresh =
        (await this.buildFreshFromAccount(studentId)) ||
        createFreshStudentState(
          student || {
            id: studentId,
            name: 'Học sinh',
            username: studentId,
            class_id: DEFAULT_CLASS_UUID,
            status: 'active',
            has_logged_in: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );

      const todayStr = getLocalTodayStr();
      const effectiveAttendanceDate =
        localFallback.lastAttendanceDate === todayStr
          ? todayStr
          : (data.last_attendance_date || localFallback.lastAttendanceDate || fresh.lastAttendanceDate);

      const effectiveAttendanceDays =
        localFallback.lastAttendanceDate === todayStr && (localFallback.attendanceDaysThisWeek || 0) > (data.attendance_days_this_week || 0)
          ? localFallback.attendanceDaysThisWeek
          : (data.attendance_days_this_week ?? localFallback.attendanceDaysThisWeek ?? fresh.attendanceDaysThisWeek);

      return {
        // fresh (trạng thái trắng) chỉ làm nền; dữ liệu local phải thắng nó —
        // thứ tự cũ (...local, ...fresh) xóa sạch rewardRequests và các tùy chọn
        // cá nhân (theme/âm thanh/cỡ chữ) sau mỗi lần đọc ở chế độ Supabase
        ...fresh,
        ...localFallback,
        profile: {
          ...fresh.profile,
          name: student ? student.name : fresh.profile.name,
          username: student ? student.username : fresh.profile.username,
        },
        essaySubmissions: (localFallback.essaySubmissions || []).filter(
          (e) => !e.id?.startsWith('sub_demo') && e.studentName !== 'Trần Minh An'
        ),
        xpToday: Math.max(data.xp_today ?? 0, localFallback.xpToday ?? 0),
        xpWeek: Math.max(data.xp_week ?? 0, localFallback.xpWeek ?? 0),
        totalXp: Math.max(data.total_xp ?? 0, localFallback.totalXp ?? 0),
        activeSecondsToday: Math.max(data.active_seconds_today ?? 0, localFallback.activeSecondsToday ?? 0),
        lastAttendanceDate: effectiveAttendanceDate,
        attendanceDaysThisWeek: effectiveAttendanceDays,
        attendanceHistory:
          Array.isArray(data.attendance_history) && data.attendance_history.length >= (localFallback.attendanceHistory?.length || 0)
            ? data.attendance_history
            : localFallback.attendanceHistory || [],
        completedSteps:
          Array.isArray(data.completed_steps) && data.completed_steps.length >= (localFallback.completedSteps?.length || 0)
            ? data.completed_steps
            : localFallback.completedSteps || [],
        questionResults:
          Array.isArray(data.question_results) && data.question_results.length >= (localFallback.questionResults?.length || 0)
            ? data.question_results
            : localFallback.questionResults || [],
        flaggedNeedReviewTopicIds: Array.isArray(data.flagged_topic_ids) ? data.flagged_topic_ids : localFallback.flaggedNeedReviewTopicIds,
        unlockedBadgeIds: Array.isArray(data.unlocked_badge_ids) ? data.unlocked_badge_ids : localFallback.unlockedBadgeIds,
        xpLogs:
          Array.isArray(data.xp_logs) && data.xp_logs.length >= (localFallback.xpLogs?.length || 0)
            ? data.xp_logs
            : localFallback.xpLogs,
        currentProgress: data.current_progress || localFallback.currentProgress,
      };
    } catch (err) {
      console.error('[SupabaseAttempt] Ngoại lệ getStudentState:', err);
      return localFallback;
    }
  }

  async saveStudentState(studentId: string, state: StudentState, sourceId?: string): Promise<void> {
    if (!isSupabaseReady() || !isUUID(studentId)) {
      return mockAttemptRepo.saveStudentState(studentId, state, sourceId);
    }

    try {
      const payload = {
        student_id: studentId,
        xp_today: state.xpToday,
        xp_week: state.xpWeek,
        total_xp: state.totalXp,
        active_seconds_today: state.activeSecondsToday,
        consecutive_days: state.consecutiveWeeks || 1,
        last_attendance_date: state.lastAttendanceDate || null,
        attendance_days_this_week: state.attendanceDaysThisWeek || 0,
        attendance_history: state.attendanceHistory || [],
        completed_steps: state.completedSteps || [],
        question_results: state.questionResults || [],
        flagged_topic_ids: state.flaggedNeedReviewTopicIds || [],
        unlocked_badge_ids: state.unlockedBadgeIds || [],
        xp_logs: state.xpLogs || [],
        current_progress: state.currentProgress || {},
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase.from('student_states').upsert(payload, { onConflict: 'student_id' });
      if (upsertError) {
        console.error('[SupabaseAttempt] ❌ Lưu student_states thất bại:', upsertError.message);
      }
      await mockAttemptRepo.saveStudentState(studentId, state, sourceId);
      syncEventBus.emit('state', { studentId }, sourceId);
    } catch (err) {
      console.error('[SupabaseAttempt] Ngoại lệ saveStudentState:', err);
      await mockAttemptRepo.saveStudentState(studentId, state, sourceId);
    }
  }

  async recordQuestionResult(studentId: string, result: QuestionResult): Promise<void> {
    const state = await this.getStudentState(studentId);
    const updated: StudentState = {
      ...state,
      questionResults: [result, ...(state.questionResults || [])],
    };
    await this.saveStudentState(studentId, updated);
  }

  async recordAttendance(studentId: string, dateStr: string): Promise<void> {
    const state = await this.getStudentState(studentId);
    if (state.lastAttendanceDate === dateStr) return;
    const updated: StudentState = {
      ...state,
      lastAttendanceDate: dateStr,
      attendanceDaysThisWeek: (state.attendanceDaysThisWeek || 0) + 1,
      attendanceHistory: [dateStr, ...(state.attendanceHistory || [])],
    };
    await this.saveStudentState(studentId, updated);
  }

  async getAllStates(): Promise<Record<string, StudentState>> {
    if (!isSupabaseReady()) {
      return mockAttemptRepo.getAllStates();
    }

    // TÁCH THEO GIÁO VIÊN: giáo viên chỉ được thấy trạng thái học sinh của
    // các lớp thuộc về mình; học sinh chỉ thấy trạng thái của chính mình.
    const sessUser = getSessionUser();
    let scopeStudentIds: string[] | null = null;
    if (sessUser?.role === 'teacher') {
      const tid = sessionTeacherId();
      scopeStudentIds = tid ? (await getTeacherScopeIds(tid)).studentIds : [];
    } else if (sessUser?.role === 'student') {
      scopeStudentIds = [sessUser.id];
    }
    const scopeSet = scopeStudentIds ? new Set(scopeStudentIds) : null;
    const scopedFallback = async (): Promise<Record<string, StudentState>> => {
      const all = await mockAttemptRepo.getAllStates().catch(() => ({}));
      if (!scopeSet) return all;
      const out: Record<string, StudentState> = {};
      for (const [k, v] of Object.entries(all)) {
        if (scopeSet.has(k)) out[k] = v;
      }
      return out;
    };

    try {
      if (scopeSet && scopeSet.size === 0) return {};
      let statesQuery = supabase.from('student_states').select('*');
      if (scopeStudentIds) {
        statesQuery = statesQuery.in('student_id', scopeStudentIds);
      }
      const { data, error } = await statesQuery;
      if (error || !data) {
        return scopedFallback();
      }

      // Bắt đầu từ các state chỉ có ở local (chưa đồng bộ) rồi phủ dữ liệu DB lên —
      // trước đây state local bị bỏ hẳn khiến học sinh "biến mất" khỏi màn giáo viên
      const map: Record<string, StudentState> = await scopedFallback();
      const students = await supabaseStudentRepo.getStudents();

      for (const row of data) {
        const student = students.find((s) => s.id === row.student_id);
        const fresh = createFreshStudentState(
          student || {
            id: row.student_id,
            name: 'Học sinh',
            username: row.student_id,
            class_id: DEFAULT_CLASS_UUID,
            status: 'active',
            has_logged_in: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );

        map[row.student_id] = {
          ...fresh,
          ...(map[row.student_id] || {}),
          xpToday: row.xp_today ?? fresh.xpToday,
          xpWeek: row.xp_week ?? fresh.xpWeek,
          totalXp: row.total_xp ?? fresh.totalXp,
          activeSecondsToday: row.active_seconds_today ?? fresh.activeSecondsToday,
          lastAttendanceDate: row.last_attendance_date || fresh.lastAttendanceDate,
          attendanceDaysThisWeek: row.attendance_days_this_week ?? fresh.attendanceDaysThisWeek,
          attendanceHistory: Array.isArray(row.attendance_history) ? row.attendance_history : fresh.attendanceHistory,
          completedSteps: Array.isArray(row.completed_steps) ? row.completed_steps : fresh.completedSteps,
          questionResults: Array.isArray(row.question_results) ? row.question_results : fresh.questionResults,
          flaggedNeedReviewTopicIds: Array.isArray(row.flagged_topic_ids) ? row.flagged_topic_ids : fresh.flaggedNeedReviewTopicIds,
          unlockedBadgeIds: Array.isArray(row.unlocked_badge_ids) ? row.unlocked_badge_ids : fresh.unlockedBadgeIds,
          xpLogs: Array.isArray(row.xp_logs) ? row.xp_logs : fresh.xpLogs,
          currentProgress: row.current_progress || fresh.currentProgress,
        };
      }
      return map;
    } catch {
      return scopedFallback();
    }
  }
}

export const supabaseAttemptRepo = new SupabaseAttemptRepository();

// ==============================================================================
// 5. SUPABASE ESSAY REPOSITORY (BÀI TẬP LÀM VĂN & CHẤM ĐIỂM)
// ==============================================================================
export class SupabaseEssayRepository implements EssayRepository {
  async getSubmissions(filter?: {
    classId?: string;
    status?: 'PENDING_TEACHER' | 'AI_SUGGESTED' | 'GRADED' | 'ALL';
    studentId?: string;
    quizId?: string;
  }): Promise<EssaySubmission[]> {
    // 1. Lấy danh sách local, tuyệt đối lọc bỏ toàn bộ bài nộp demo
    const localList = await mockEssayRepo.getSubmissions(filter);
    let cleanLocalList = (localList || []).filter(
      (e) => !e.id?.startsWith('sub_demo') && e.studentName !== 'Trần Minh An'
    );

    // TÁCH THEO GIÁO VIÊN: giáo viên chỉ thấy bài nộp của học sinh thuộc các
    // lớp của mình — kể cả khi nơi gọi không truyền bộ lọc lớp.
    let scopeClassIds: Set<string> | null = null;
    const sessUser = getSessionUser();
    if (sessUser?.role === 'teacher' && isSupabaseReady()) {
      const tid = sessionTeacherId();
      if (tid) {
        const scope = await getTeacherScopeIds(tid);
        scopeClassIds = new Set(scope.classIds);
        const scopeStudentIds = new Set(scope.studentIds);
        cleanLocalList = cleanLocalList.filter(
          (e) =>
            scopeStudentIds.has(e.studentId) ||
            (e.classId ? scopeClassIds!.has(e.classId) : false)
        );
      }
    }

    if (!isSupabaseReady()) {
      return cleanLocalList;
    }

    try {
      let query = supabase
        .from('essay_submissions')
        .select('*, students(name), classes(name)')
        .order('created_at', { ascending: false });

      if (filter?.studentId && isUUID(filter.studentId)) {
        query = query.eq('student_id', filter.studentId);
      }
      if (filter?.classId && filter.classId !== 'all') {
        if (isUUID(filter.classId)) {
          query = query.eq('class_id', filter.classId);
        }
      }
      if (filter?.status && filter.status !== 'ALL') {
        if (filter.status === 'PENDING_TEACHER') {
          query = query.in('status', ['PENDING_TEACHER', 'AI_SUGGESTED']);
        } else {
          query = query.eq('status', filter.status);
        }
      }
      if (scopeClassIds) {
        if (scopeClassIds.size === 0) return cleanLocalList;
        query = query.in('class_id', Array.from(scopeClassIds));
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[SupabaseEssay] Lỗi getSubmissions Supabase, dùng fallback local:', error.message);
        return cleanLocalList;
      }

      const remoteList: EssaySubmission[] = (data || []).map((e: any) => {
        const qInfo = (QUESTIONS_BANK as any)[e.question_id];
        const submittedTime = new Date(e.created_at || Date.now()).getTime();
        return {
          id: e.id,
          questionId: e.question_id || 'q_essay_01',
          quizId: e.question_id || 'q_essay_01',
          studentId: e.student_id,
          studentName: e.students?.name || 'Học sinh',
          classId: e.class_id,
          className: e.classes?.name || '7A1',
          promptTitle: qInfo?.prompt || 'Cảm nghĩ về bài thơ / văn bản',
          quizTitle: 'Bài tập làm văn',
          prompt: qInfo?.prompt || 'Viết đoạn văn theo yêu cầu',
          content: e.content,
          wordCount: e.word_count || (e.content ? e.content.trim().split(/\s+/).length : 0),
          submittedAt: submittedTime,
          status: e.status,
          teacherFeedback: e.teacher_feedback || undefined,
          rubricScores: Array.isArray(e.rubric_scores) ? e.rubric_scores : undefined,
          totalScore: e.total_score != null ? Number(e.total_score) : undefined,
          finalRatio: e.total_score != null ? Number(e.total_score) / 10 : undefined,
          aiSuggestion: e.ai_suggested_scores ? {
            rubricScores: e.ai_suggested_scores,
            overallComment: e.ai_suggested_feedback || '',
            suggestedTotalScore: Array.isArray(e.ai_suggested_scores)
              ? e.ai_suggested_scores.reduce((sum: number, c: any) => sum + (c.score || 0), 0)
              : undefined,
            suggestedAt: e.created_at,
          } : undefined,
          skillLevel: qInfo?.level || 'VAN_DUNG',
          hoursWaiting: Math.max(0, Math.floor((Date.now() - submittedTime) / 3600000)),
        };
      });

      // HỢP NHẤT hai nguồn (remote ưu tiên, local chỉ là phần đệm chưa kịp đồng bộ)
      const map = new Map<string, EssaySubmission>();
      cleanLocalList.forEach((item) => map.set(item.id, item));
      remoteList.forEach((item) => map.set(item.id, item));

      let merged = Array.from(map.values()).sort((a, b) => b.submittedAt - a.submittedAt);
      // quizId không có cột riêng trên DB (được suy từ question_id) nên lọc sau hợp nhất —
      // trước đây bộ lọc này bị bỏ qua hoàn toàn sau khi gộp dữ liệu
      if (filter?.quizId) {
        merged = merged.filter(
          (e) => e.quizId === filter.quizId || e.questionId === filter.quizId
        );
      }

      // HỢP NHẤT ĐỊNH DANH HỌC SINH + KHỬ TRÙNG BÀI:
      // Cùng một học sinh có thể mang nhiều studentId khác nhau giữa các nguồn
      // local (bản trong state của học sinh, bản độc lập, dữ liệu cũ) khiến hàng
      // đợi chấm hiện em đó thành 2 người khác nhau. Quy mọi bài về ĐÚNG MỘT
      // học sinh trong bảng students (khớp theo id, else khớp duy nhất theo tên
      // + lớp), rồi khử các bản sao của cùng một bài (cùng học sinh + câu hỏi +
      // nội dung + mốc nộp gần nhau) chỉ giữ một bản.
      try {
        const { data: studentRows } = await supabase
          .from('students')
          .select('id, name, class_id');
        const { data: classRows } = await supabase.from('classes').select('id, name');
        const classNameById = new Map<string, string>(
          (classRows || []).map((c: any) => [c.id, (c.name || '').toLowerCase()])
        );
        const norm = (x?: string) => (x || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const studentIds = new Set((studentRows || []).map((st: any) => st.id));
        const canonicalize = (sub: EssaySubmission): EssaySubmission => {
          if (studentIds.has(sub.studentId)) return sub;
          const candidates = (studentRows || []).filter(
            (st: any) => norm(st.name) === norm(sub.studentName)
          );
          if (candidates.length === 0) return sub;
          const byClass = candidates.find(
            (st: any) =>
              classNameById.get(st.class_id) &&
              norm(sub.className).includes(classNameById.get(st.class_id) as string)
          );
          const picked = byClass || (candidates.length === 1 ? candidates[0] : null);
          return picked ? { ...sub, studentId: picked.id } : sub;
        };
        merged = merged.map(canonicalize);

        // Lớp gộp thứ hai: các định danh KHÔNG có trong bảng students (dữ liệu
        // cũ còn sót trên máy) nhưng trùng tên + lớp thì vẫn là cùng một người.
        const nameClassKey = new Map<string, string>();
        merged = merged.map((sub) => {
          const k = `${norm(sub.studentName)}|${norm(sub.className)}`;
          if (!nameClassKey.has(k)) nameClassKey.set(k, sub.studentId);
          const canon = nameClassKey.get(k) as string;
          return canon === sub.studentId ? sub : { ...sub, studentId: canon };
        });

        const seen = new Set<string>();
        merged = merged.filter((sub) => {
          const fingerprint = `${sub.studentId}|${sub.questionId}|${(sub.content || '')
            .trim()
            .slice(0, 120)}|${Math.round((sub.submittedAt || 0) / 60000)}`;
          if (seen.has(fingerprint)) return false;
          seen.add(fingerprint);
          return true;
        });
      } catch (canonErr) {
        console.warn('[SupabaseEssay] Bỏ qua hợp nhất định danh học sinh:', canonErr);
      }
      return merged;
    } catch {
      return cleanLocalList;
    }
  }

  async getSubmissionById(id: string): Promise<EssaySubmission | null> {
    const all = await this.getSubmissions();
    return all.find((e) => e.id === id) || null;
  }

  async createSubmission(
    submission: Omit<EssaySubmission, 'id' | 'submittedAt'>
  ): Promise<EssaySubmission> {
    if (!submission.content || submission.content.trim().length === 0) {
      throw new Error('Nội dung bài viết không được để trống.');
    }

    // 1. Lưu vào local state để phản hồi tức thời
    const localCreated = await mockEssayRepo.createSubmission(submission);

    if (!isSupabaseReady()) {
      return localCreated;
    }

    try {
      // 2. Tìm ID học sinh thực tế trong Supabase (tránh vi phạm khóa ngoại)
      let targetStudentUUID: string | null = null;
      let targetClassUUID: string | null = null;

      if (isUUID(submission.studentId)) {
        const { data: s } = await supabase
          .from('students')
          .select('id, class_id')
          .eq('id', submission.studentId)
          .maybeSingle();
        if (s) {
          targetStudentUUID = s.id;
          targetClassUUID = s.class_id;
        }
      }

      if (!targetStudentUUID) {
        const { data: s } = await supabase
          .from('students')
          .select('id, class_id')
          .or(`username.eq.${submission.studentId},student_code.eq.${submission.studentId}`)
          .maybeSingle();
        if (s) {
          targetStudentUUID = s.id;
          targetClassUUID = s.class_id;
        }
      }

      if (!targetStudentUUID && submission.studentName) {
        const { data: s } = await supabase
          .from('students')
          .select('id, class_id')
          .ilike('name', submission.studentName)
          .maybeSingle();
        if (s) {
          targetStudentUUID = s.id;
          targetClassUUID = s.class_id;
        }
      }

      // KHÔNG suy đoán chủ bài viết: không xác định được học sinh thì giữ bản
      // local (đúng chủ) và bỏ qua DB — tuyệt đối không gán bài cho học sinh khác.

      // 3. Xác minh class_id có thực trong database hoặc gán null (hợp lệ theo FK ON DELETE SET NULL)
      let finalClassUUID: string | null = null;
      if (isUUID(submission.classId)) {
        finalClassUUID = submission.classId ?? null;
      } else if (targetClassUUID && isUUID(targetClassUUID)) {
        finalClassUUID = targetClassUUID;
      }

      if (finalClassUUID) {
        const { data: cls } = await supabase
          .from('classes')
          .select('id')
          .eq('id', finalClassUUID)
          .maybeSingle();
        if (!cls) {
          // Lớp không tồn tại trên DB -> để NULL (FK ON DELETE SET NULL), không gán lớp lạ
          finalClassUUID = null;
        }
      }

      if (targetStudentUUID) {
        const payload = {
          question_id: submission.questionId || submission.quizId || 'q_essay_01',
          student_id: targetStudentUUID,
          class_id: finalClassUUID,
          content: submission.content.trim(),
          word_count: submission.wordCount || submission.content.trim().split(/\s+/).length,
          status: localCreated.status || submission.status || 'PENDING_TEACHER',
          ai_suggested_scores: localCreated.aiSuggestion?.rubricScores || null,
          ai_suggested_feedback: localCreated.aiSuggestion?.overallComment || null,
        };

        const { data: created, error } = await supabase
          .from('essay_submissions')
          .insert(payload)
          .select('*, students(name), classes(name)')
          .single();

        if (error) {
          console.error('[SupabaseEssay] Lỗi insert essay_submissions:', error.message);
        } else if (created) {
          syncEventBus.emit('essay');
          return {
            ...localCreated,
            id: created.id,
            studentId: created.student_id,
            studentName: created.students?.name || localCreated.studentName,
            classId: created.class_id,
            className: created.classes?.name || localCreated.className,
            submittedAt: new Date(created.created_at).getTime(),
            status: created.status,
          };
        }
      }

      syncEventBus.emit('essay');
      return localCreated;
    } catch (err: any) {
      console.error('[SupabaseEssay] Ngoại lệ createSubmission:', err?.message || err);
      syncEventBus.emit('essay');
      return localCreated;
    }
  }

  async saveSubmissionDraft(
    id: string,
    draft: {
      rubricScores?: { criterionName: string; score: number; maxScore: number }[];
      teacherFeedback?: string;
    }
  ): Promise<EssaySubmission> {
    if (isSupabaseReady() && isUUID(id)) {
      try {
        const payload: Record<string, any> = {};
        if (draft.rubricScores) payload.rubric_scores = draft.rubricScores;
        if (draft.teacherFeedback !== undefined) payload.teacher_feedback = draft.teacherFeedback;

        const { data: updated } = await supabase
          .from('essay_submissions')
          .update(payload)
          .eq('id', id)
          .select('*, students(name), classes(name)')
          .maybeSingle();

        if (updated) {
          syncEventBus.emit('essay');
          const item = await this.getSubmissionById(id);
          if (item) return item;
        }
      } catch (e) {
        console.warn('[SupabaseEssay] Lỗi lưu nháp Supabase:', e);
      }
    }

    try {
      return await mockEssayRepo.saveSubmissionDraft(id, draft);
    } catch {
      const item = await this.getSubmissionById(id);
      if (item) return item;
      throw new Error('Không tìm thấy bài viết');
    }
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
    if (isSupabaseReady() && isUUID(id)) {
      try {
        const payload = {
          status: 'GRADED',
          teacher_feedback: grading.teacherFeedback,
          rubric_scores: grading.rubricScores,
          total_score: grading.totalScore,
          graded_at: new Date().toISOString(),
        };

        const { data: updated, error } = await supabase
          .from('essay_submissions')
          .update(payload)
          .eq('id', id)
          .select('*, students(name), classes(name)')
          .maybeSingle();

        if (error) {
          console.error('[SupabaseEssay] Lỗi chốt điểm Supabase:', error.message);
          throw new Error(error.message);
        }

        if (updated) {
          syncEventBus.emit('essay');

          // Ghi audit + thông báo cho học sinh (ngang hàng bản mock; thiếu trước đây)
          try {
            await auditRepo.log({
              actor_id: teacherActorId,
              actor_name: 'Thầy/Cô',
              actor_role: 'teacher',
              action: 'GRADE_ESSAY',
              target_type: 'essay',
              target_id: id,
              target_name: `Bài viết của ${updated.student_id}`,
              details: { totalScore: grading.totalScore },
            });
            if (typeof localStorage !== 'undefined') {
              const annos = JSON.parse(localStorage.getItem('mam_van_announcements') || '[]');
              annos.unshift({
                id: 'anno_' + Date.now(),
                title: 'Bài viết đã được chấm',
                content: `Thầy/cô đã chấm bài viết của em. Điểm: ${grading.totalScore}/10. Hãy xem nhận xét chi tiết nhé!`,
                type: 'essay_graded',
                targetClassIds: ['all'],
                studentId: updated.student_id,
                created_at: new Date().toISOString(),
              });
              localStorage.setItem('mam_van_announcements', JSON.stringify(annos));
            }
          } catch (sideErr) {
            console.warn('[SupabaseEssay] Lỗi ghi audit/thông báo sau chấm:', sideErr);
          }

          // Cập nhật Mastery của học sinh nếu có bản ghi student_states
          if (updated.student_id) {
            try {
              const { data: stRow } = await supabase
                .from('student_states')
                .select('*')
                .eq('student_id', updated.student_id)
                .maybeSingle();

              if (stRow) {
                const currentQResults = Array.isArray(stRow.question_results) ? stRow.question_results : [];
                const isPassed = grading.totalScore >= 5;
                // Chủ đề/mức độ THẬT của câu hỏi (không gán cứng chủ đề thơ + VẬN DỤNG)
                const qInfo2 = (QUESTIONS_BANK as any)[updated.question_id || ''];
                let essayTopicId: string | undefined = qInfo2?.topicId;
                if (!essayTopicId && updated.quiz_id) {
                  try {
                    const quiz = await supabaseQuizRepo.getQuizById(updated.quiz_id);
                    essayTopicId = quiz?.topicId;
                  } catch {
                    /* bỏ qua: giữ undefined */
                  }
                }
                if (essayTopicId) {
                  const newQResult = {
                    questionId: updated.question_id || id,
                    level: qInfo2?.level || 'VAN_DUNG',
                    isCorrect: isPassed,
                    scoreRatio: grading.finalRatio || (grading.totalScore / 10),
                    timestamp: Date.now(),
                    topicId: essayTopicId,
                  };
                  await supabase
                    .from('student_states')
                    .update({
                      question_results: [...currentQResults, newQResult],
                    })
                    .eq('student_id', updated.student_id);
                } else {
                  console.warn('[SupabaseEssay] Không xác định được chủ đề bài viết, bỏ qua ghi mastery.');
                }
              }
            } catch (e) {
              console.warn('[SupabaseEssay] Không cập nhật được mastery học sinh:', e);
            }
          }

          const item = await this.getSubmissionById(id);
          if (item) return item;

          const qInfo = (QUESTIONS_BANK as any)[updated.question_id];
          return {
            id: updated.id,
            questionId: updated.question_id || 'q_essay_01',
            quizId: updated.question_id || 'q_essay_01',
            studentId: updated.student_id,
            studentName: updated.students?.name || 'Học sinh',
            classId: updated.class_id,
            className: updated.classes?.name || '7A1',
            promptTitle: qInfo?.prompt || 'Cảm nghĩ về bài thơ / văn bản',
            quizTitle: 'Bài tập làm văn',
            questionPrompt: qInfo?.prompt || 'Viết đoạn văn theo yêu cầu',
            content: updated.content,
            wordCount: updated.word_count || 0,
            submittedAt: new Date(updated.created_at || Date.now()).getTime(),
            status: 'GRADED',
            teacherFeedback: updated.teacher_feedback || undefined,
            rubricScores: Array.isArray(updated.rubric_scores) ? updated.rubric_scores : undefined,
            totalScore: updated.total_score != null ? Number(updated.total_score) : undefined,
            finalRatio: updated.total_score != null ? Number(updated.total_score) / 10 : undefined,
            hoursWaiting: 0,
          };
        }
      } catch (err: any) {
        console.error('[SupabaseEssay] Lỗi gradeSubmission:', err?.message || err);
        throw err;
      }
    }

    return mockEssayRepo.gradeSubmission(id, grading, teacherActorId);
  }

  // Huấn luyện & Cấu hình AI (ủy quyền an toàn qua Mock)
  getRubricTemplates(): Promise<RubricTemplate[]> {
    return mockEssayRepo.getRubricTemplates();
  }
  saveRubricTemplate(template: Partial<RubricTemplate>): Promise<RubricTemplate> {
    return mockEssayRepo.saveRubricTemplate(template);
  }
  deleteRubricTemplate(id: string): Promise<void> {
    return mockEssayRepo.deleteRubricTemplate(id);
  }
  getGradedSamples(): Promise<GradedSampleEssay[]> {
    return mockEssayRepo.getGradedSamples();
  }
  saveGradedSample(sample: Partial<GradedSampleEssay>): Promise<GradedSampleEssay> {
    return mockEssayRepo.saveGradedSample(sample);
  }
  deleteGradedSample(id: string): Promise<void> {
    return mockEssayRepo.deleteGradedSample(id);
  }
  getGradingConfig(): Promise<AIGradingConfig> {
    return mockEssayRepo.getGradingConfig();
  }
  saveGradingConfig(config: Partial<AIGradingConfig>): Promise<AIGradingConfig> {
    return mockEssayRepo.saveGradingConfig(config);
  }
  getAIAccuracyMetrics(): Promise<{
    averageDiff: number;
    highDiffRatio: number;
    weeklyTrends: { week: string; diff: number; total: number }[];
    diffByCriterion: { name: string; diff: number }[];
  }> {
    return mockEssayRepo.getAIAccuracyMetrics();
  }
}

export const supabaseEssayRepo = new SupabaseEssayRepository();

// ==============================================================================
// 6. SUPABASE REWARD REPOSITORY (QUÀ TẶNG & YÊU CẦU ĐỔI QUÀ)
// ==============================================================================
export class SupabaseRewardRepository implements RewardRepository {
  async getRewards(): Promise<RewardItem[]> {
    return mockRewardRepo.getRewards();
  }
  async saveReward(reward: Partial<RewardItem>): Promise<RewardItem> {
    return mockRewardRepo.saveReward(reward);
  }
  async deleteReward(id: string): Promise<void> {
    return mockRewardRepo.deleteReward(id);
  }

  async getRequests(filter?: {
    classId?: string;
    studentId?: string;
    status?: RewardStatus;
  }): Promise<EnrichedRewardRequest[]> {
    if (!isSupabaseReady()) {
      return mockRewardRepo.getRequests(filter);
    }

    try {
      let query = supabase
        .from('reward_requests')
        .select('*, students(name, class_id)')
        .order('created_at', { ascending: false });

      if (filter?.studentId && isUUID(filter.studentId)) {
        query = query.eq('student_id', filter.studentId);
      }
      if (filter?.status) {
        const dbStatus = filter.status === 'PENDING_APPROVAL' ? 'PENDING' : filter.status;
        query = query.eq('status', dbStatus);
      }

      const { data, error } = await query;
      if (error || !data) {
        if (error) console.error('[SupabaseReward] Lỗi đọc reward_requests:', error.message);
        return mockRewardRepo.getRequests(filter);
      }

      const rewards = await this.getRewards();

      // Dữ liệu thật để đối chiếu điều kiện: XP tuần + số ngày điểm danh từ student_states
      const studentIds = [...new Set(data.map((r: any) => r.student_id).filter(Boolean))];
      const stateByStudent = new Map<string, { xpWeek: number; attendanceDays: number }>();
      if (studentIds.length > 0) {
        const { data: stateRows } = await supabase
          .from('student_states')
          .select('student_id, xp_week, attendance_days_this_week')
          .in('student_id', studentIds);
        (stateRows || []).forEach((row: any) => {
          stateByStudent.set(row.student_id, {
            xpWeek: row.xp_week ?? 0,
            attendanceDays: row.attendance_days_this_week ?? 0,
          });
        });
      }

      // Tên lớp thật từ bảng classes
      const classIds = [...new Set(data.map((r: any) => r.students?.class_id).filter(Boolean))];
      const classNameById = new Map<string, string>();
      if (classIds.length > 0) {
        const { data: classRows } = await supabase.from('classes').select('id, name').in('id', classIds);
        (classRows || []).forEach((row: any) => classNameById.set(row.id, row.name));
      }

      const statusMap: Record<string, RewardStatus> = {
        PENDING: 'PENDING_APPROVAL',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
        GIVEN: 'GIVEN',
        OPENED: 'OPENED',
      };

      let enriched: EnrichedRewardRequest[] = data.map((row: any) => {
        const tierKey = (row.chest_type || 'hat').toUpperCase();
        const matchedReward = rewards.find((r) => r.tierKey === tierKey);
        const live = stateByStudent.get(row.student_id);
        const xpWeekActual = live?.xpWeek ?? row.xp_week_snapshot ?? 0;
        const attendanceDaysActual = live?.attendanceDays ?? 0;
        const reqXp = matchedReward ? matchedReward.requiredXp || matchedReward.xpCost || 0 : 0;
        const reqDays = matchedReward ? matchedReward.requiredAttendanceDays || 0 : 0;

        return {
          id: row.id,
          studentId: row.student_id,
          studentName: row.students?.name || 'Học sinh',
          classId: row.students?.class_id || undefined,
          className: row.students?.class_id ? classNameById.get(row.students.class_id) : undefined,
          rewardId: matchedReward?.id || `tier_${(row.chest_type || 'hat').toLowerCase()}`,
          requestedAt: new Date(row.created_at).getTime(),
          status: statusMap[row.status] || 'PENDING_APPROVAL',
          xpWeekActual,
          attendanceDaysActual,
          isEligible: matchedReward ? xpWeekActual >= reqXp && attendanceDaysActual >= reqDays : false,
          reward: matchedReward,
        };
      });

      if (filter?.classId && filter.classId !== 'all') {
        enriched = enriched.filter((r) => r.classId === filter.classId);
      }

      return enriched;
    } catch (e) {
      console.error('[SupabaseReward] getRequests thất bại:', e);
      return mockRewardRepo.getRequests(filter);
    }
  }

  async createRequest(studentId: string, rewardId: string): Promise<RewardRequest> {
    // Học sinh không có UUID (tài khoản demo/local) thì ghi ở kho local như mock,
    // TUYỆT ĐỐI không gán nhờ sang id của một học sinh mẫu bất kỳ trên DB
    if (!isSupabaseReady() || !isUUID(studentId)) {
      return mockRewardRepo.createRequest(studentId, rewardId);
    }

    const rewards = await this.getRewards();
    const reward =
      rewards.find((r) => r.id === rewardId) ||
      REWARDS_CATALOG.find((r) => r.id === rewardId);
    const tierRaw = (reward?.tierKey || rewardId.replace('tier_', '') || 'hat').toLowerCase();
    const chestType = ['hat', 'la', 'hoa', 'vang'].includes(tierRaw) ? tierRaw : 'hat';

    // Snapshot XP tuần THẬT của học sinh (DB trước, local dự phòng) — không bịa số.
    // Đồng thời đọc TỔNG XP của tài khoản: đó là ví chi tiêu khi đổi quà.
    let xpWeekSnapshot = 0;
    let totalXpBalance = 0;
    try {
      const { data: st } = await supabase
        .from('student_states')
        .select('xp_week, total_xp')
        .eq('student_id', studentId)
        .maybeSingle();
      if (st && typeof st.xp_week === 'number') {
        xpWeekSnapshot = st.xp_week;
      } else {
        const allStates = JSON.parse(localStorage.getItem('mam_van_student_states') || '{}');
        xpWeekSnapshot = allStates[studentId]?.xpWeek ?? 0;
      }
      if (st && typeof st.total_xp === 'number') {
        totalXpBalance = st.total_xp;
      } else {
        const allStates = JSON.parse(localStorage.getItem('mam_van_student_states') || '{}');
        totalXpBalance = allStates[studentId]?.totalXp ?? 0;
      }
    } catch {
      xpWeekSnapshot = 0;
    }

    // Đổi quà TRỪ vào TỔNG XP của tài khoản (XP vĩnh viễn): kiểm tra số dư TRƯỚC
    const requiredXp = reward?.requiredXp || 0;
    if (requiredXp > 0 && totalXpBalance < requiredXp) {
      throw new Error(
        `Chưa đủ XP để xin phần quà này (cần ${requiredXp} XP, hiện có ${totalXpBalance} XP)`
      );
    }

    const payload = {
      student_id: studentId,
      chest_type: chestType,
      xp_week_snapshot: xpWeekSnapshot,
      gift_name: reward?.name || 'Phần thưởng Mầm Văn',
      status: 'PENDING',
    };
    const { data, error } = await supabase.from('reward_requests').insert(payload).select().single();
    if (error || !data) {
      console.error('[SupabaseReward] Lỗi tạo yêu cầu quà, chuyển sang kho local:', error?.message);
      return mockRewardRepo.createRequest(studentId, rewardId);
    }

    // Trừ vào TỔNG XP trong state của học sinh, ghi số đã trừ vào bản sao yêu cầu
    let deductedXp = 0;
    if (requiredXp > 0) {
      try {
        const st = await supabaseAttemptRepo.getStudentState(studentId);
        st.totalXp = Math.max(0, (st.totalXp || 0) - requiredXp);
        st.rewardRequests = (st.rewardRequests || []).map((r) =>
          r.id === data.id ? { ...r, deductedXp: requiredXp } : r
        );
        // Yêu cầu vừa tạo ở DB có thể chưa có trong state — gắn bản sao để hoàn XP khi bị từ chối
        if (!st.rewardRequests.some((r) => r.id === data.id)) {
          st.rewardRequests = [
            {
              id: data.id,
              rewardId,
              requestedAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
              status: 'PENDING_APPROVAL' as const,
              deductedXp: requiredXp,
            },
            ...st.rewardRequests,
          ];
        }
        await supabaseAttemptRepo.saveStudentState(studentId, st);
        deductedXp = requiredXp;
      } catch (e) {
        console.error('[SupabaseReward] Không trừ được XP cho yêu cầu quà:', e);
      }
    }

    syncEventBus.emit('reward');
    return {
      id: data.id,
      rewardId,
      requestedAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
      status: 'PENDING_APPROVAL',
      deductedXp,
    };
  }

  // Hoàn vào TỔNG XP cho yêu cầu bị TỪ CHỐI (bản sao yêu cầu trong state học
  // sinh mang deductedXp; trạng thái ở bản sao cũng được cập nhật theo)
  private async refundIfRejected(requestId: string): Promise<void> {
    try {
      const states = await supabaseAttemptRepo.getAllStates();
      for (const [sId, st] of Object.entries(states)) {
        const req = (st.rewardRequests || []).find((r) => r.id === requestId);
        if (!req) continue;
        let changed = false;
        if ((req.deductedXp || 0) > 0) {
          st.totalXp = (st.totalXp || 0) + (req.deductedXp || 0);
          req.deductedXp = 0;
          changed = true;
        }
        if (req.status !== 'REJECTED') {
          req.status = 'REJECTED';
          changed = true;
        }
        if (changed) await supabaseAttemptRepo.saveStudentState(sId, st);
        return;
      }
    } catch (e) {
      console.error('[SupabaseReward] Không hoàn được XP cho yêu cầu bị từ chối:', e);
    }
  }

  async updateRequestStatus(
    requestId: string,
    status: RewardStatus,
    reason?: string,
    teacherActorId?: string
  ): Promise<RewardRequest> {
    const dbStatus = status === 'PENDING_APPROVAL' ? 'PENDING' : status;

    // Đọc bản ghi thật trước để trả về đúng rewardId/thời điểm, không chế dữ liệu
    let existing: any = null;
    try {
      const { data } = await supabase
        .from('reward_requests')
        .select('chest_type, created_at')
        .eq('id', requestId)
        .maybeSingle();
      existing = data;
    } catch {}

    const { error } = await supabase
      .from('reward_requests')
      .update({
        status: dbStatus,
        approved_at: status === 'APPROVED' ? new Date().toISOString() : null,
      })
      .eq('id', requestId);
    if (error) {
      // Thường do CHECK constraint trên DB chưa có GIVEN/OPENED (cần migration 003)
      console.error('[SupabaseReward] Lỗi cập nhật trạng thái yêu cầu quà:', error.message);
    }

    if (status === 'REJECTED') {
      await this.refundIfRejected(requestId);
    }

    syncEventBus.emit('reward');
    const rewards = await this.getRewards();
    const tierKey = (existing?.chest_type || 'hat').toUpperCase();
    const matched = rewards.find((r) => r.tierKey === tierKey);
    return {
      id: requestId,
      rewardId: matched?.id || `tier_${(existing?.chest_type || 'hat').toLowerCase()}`,
      requestedAt: existing?.created_at ? new Date(existing.created_at).getTime() : Date.now(),
      status,
      rejectReason: reason,
    };
  }

  async batchUpdateStatus(
    requestIds: string[],
    status: RewardStatus,
    reason?: string,
    teacherActorId?: string
  ): Promise<void> {
    const dbStatus = status === 'PENDING_APPROVAL' ? 'PENDING' : status;
    const { error } = await supabase
      .from('reward_requests')
      .update({
        status: dbStatus,
        approved_at: status === 'APPROVED' ? new Date().toISOString() : null,
      })
      .in('id', requestIds);
    if (error) {
      console.error('[SupabaseReward] Lỗi cập nhật hàng loạt trạng thái quà:', error.message);
    }
    if (status === 'REJECTED') {
      for (const id of requestIds) {
        await this.refundIfRejected(id);
      }
    }
    syncEventBus.emit('reward');
  }
}

export const supabaseRewardRepo = new SupabaseRewardRepository();

// ==============================================================================
// 7. SUPABASE TEACHER REPOSITORY (ADMIN QUẢN LÝ GIÁO VIÊN)
// ==============================================================================
export class SupabaseTeacherRepository implements TeacherRepository {
  async getTeachers(): Promise<TeacherProfile[]> {
    if (!isSupabaseReady()) return mockTeacherRepo.getTeachers();
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return mockTeacherRepo.getTeachers();
      if (!data) return [];

      return data.map((t) => ({
        id: t.id,
        name: t.name,
        username: t.username,
        role: 'teacher',
        email: t.email || undefined,
        phone: t.phone || undefined,
        school: t.school || 'THCS Giấy & Mực',
        subject: t.subject || 'Ngữ văn 7',
        classIds: [],
        status: (t.status as any) || 'active',
        trialExpiresAt: t.trial_expires_at || undefined,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
    } catch {
      return mockTeacherRepo.getTeachers();
    }
  }

  async getTeacherById(id: string): Promise<TeacherProfile | null> {
    if (!isSupabaseReady()) return mockTeacherRepo.getTeacherById(id);
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return mockTeacherRepo.getTeacherById(id);

      return {
        id: data.id,
        name: data.name,
        username: data.username,
        role: 'teacher',
        email: data.email || undefined,
        phone: data.phone || undefined,
        school: data.school || 'THCS Giấy & Mực',
        subject: data.subject || 'Ngữ văn 7',
        classIds: [],
        status: (data.status as any) || 'active',
        trialExpiresAt: data.trial_expires_at || undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch {
      return mockTeacherRepo.getTeacherById(id);
    }
  }

  async createTeacher(data: CreateTeacherInput): Promise<TeacherProfile> {
    if (!isSupabaseReady()) return mockTeacherRepo.createTeacher(data);
    try {
      // Form tạo nhanh có thể không nhập username -> tự sinh từ họ tên như phía học sinh,
      // tránh insert username NULL làm hỏng bản ghi
      if (!data.username || !data.username.trim()) {
        const existing = await this.getTeachers().catch(() => []);
        data = {
          ...data,
          username: generateUsername(
            data.name,
            existing.map((t) => t.username.toLowerCase())
          ),
        };
      }
      const trialDays = data.trialDays || 3;
      const trialExpiresAt =
        data.status === 'trial'
          ? new Date(Date.now() + trialDays * 86400000).toISOString()
          : null;

      const { data: created, error } = await supabase
        .from('teachers')
        .insert({
          name: data.name,
          username: data.username,
          password_hash: data.password || '123456',
          email: data.email || null,
          phone: data.phone || null,
          school: data.school || 'THCS Giấy & Mực',
          subject: data.subject || 'Ngữ văn 7',
          status: data.status || 'active',
          trial_expires_at: trialExpiresAt,
          role: 'teacher',
        })
        .select()
        .single();

      if (error || !created) {
        console.warn('[SupabaseTeacher] Lỗi tạo giáo viên, fallback sang mock:', error?.message);
        return mockTeacherRepo.createTeacher(data);
      }

      syncEventBus.emit('teacher');
      return {
        id: created.id,
        name: created.name,
        username: created.username,
        role: 'teacher',
        email: created.email || undefined,
        phone: created.phone || undefined,
        school: created.school || 'THCS Giấy & Mực',
        subject: created.subject || 'Ngữ văn 7',
        classIds: [],
        status: (created.status as any) || 'active',
        trialExpiresAt: created.trial_expires_at || undefined,
        created_at: created.created_at,
        updated_at: created.updated_at,
      };
    } catch {
      return mockTeacherRepo.createTeacher(data);
    }
  }

  async updateTeacher(id: string, data: Partial<TeacherProfile>): Promise<TeacherProfile> {
    if (!isSupabaseReady()) return mockTeacherRepo.updateTeacher(id, data);
    try {
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (data.name) updatePayload.name = data.name;
      if (data.email !== undefined) updatePayload.email = data.email || null;
      if (data.phone !== undefined) updatePayload.phone = data.phone || null;
      if (data.school) updatePayload.school = data.school;
      if (data.subject) updatePayload.subject = data.subject;
      if (data.status) updatePayload.status = data.status;
      if (data.password) updatePayload.password_hash = data.password;
      if (data.trialExpiresAt) updatePayload.trial_expires_at = data.trialExpiresAt;

      const { data: updated, error } = await supabase
        .from('teachers')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error || !updated) return mockTeacherRepo.updateTeacher(id, data);

      syncEventBus.emit('teacher');
      return {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        role: 'teacher',
        email: updated.email || undefined,
        phone: updated.phone || undefined,
        school: updated.school || 'THCS Giấy & Mực',
        subject: updated.subject || 'Ngữ văn 7',
        classIds: [],
        status: (updated.status as any) || 'active',
        trialExpiresAt: updated.trial_expires_at || undefined,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      };
    } catch {
      return mockTeacherRepo.updateTeacher(id, data);
    }
  }

  async deleteTeacher(id: string): Promise<void> {
    if (!isSupabaseReady()) return mockTeacherRepo.deleteTeacher(id);
    try {
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (error) {
        console.error('[SupabaseTeacher] Lỗi xóa giáo viên trên DB, chuyển kho local:', error.message);
        return mockTeacherRepo.deleteTeacher(id);
      }
      syncEventBus.emit('teacher');
    } catch {
      return mockTeacherRepo.deleteTeacher(id);
    }
  }

  async toggleLockTeacher(id: string, locked?: boolean): Promise<TeacherProfile> {
    const current = await this.getTeacherById(id);
    const nextStatus =
      typeof locked === 'boolean'
        ? (locked ? 'locked' : 'active')
        : (current?.status === 'locked' ? 'active' : 'locked');

    return this.updateTeacher(id, { status: nextStatus });
  }
}

export const supabaseTeacherRepo = new SupabaseTeacherRepository();

// ==============================================================================
// 7. SUPABASE QUIZ & QUESTION REPOSITORY (NGÂN HÀNG CÂU HỎI TRỰC TIẾP POSTGRESQL)
// ==============================================================================

function toSupabaseType(type?: string): string {
  switch (type) {
    case 'single':
    case 'single_choice':
      return 'single_choice';
    case 'multi':
    case 'multiple_choice':
      return 'multiple_choice';
    case 'fill':
    case 'fill_in_blank':
      return 'fill_in_blank';
    case 'essay':
      return 'essay';
    default:
      return 'single_choice';
  }
}

/**
 * Chuẩn hoá đáp án theo loại câu: câu điền khuyết / chọn nhiều lưu trong DB
 * có thể là CHUỖI đơn (vd đáp án điền 1 chỗ trống "Hà Nội") trong khi code
 * chấm bài luôn coi đáp án là MẢNG. Không chuẩn hoá ở đây thì lúc nộp bài
 * sẽ văng lỗi "forEach is not a function" và bài nộp chết im lặng.
 */
function normalizeAnswerForType(type: QuestionType, answer: any): any {
  if (type === 'fill' || type === 'multi') {
    if (Array.isArray(answer)) return answer;
    if (answer === null || answer === undefined || answer === '') return [];
    return [String(answer)];
  }
  return answer;
}

function fromSupabaseType(type?: string): QuestionType {
  switch (type) {
    case 'single_choice':
    case 'single':
      return 'single';
    case 'multiple_choice':
    case 'multi':
      return 'multi';
    case 'fill_in_blank':
    case 'fill':
      return 'fill';
    case 'essay':
      return 'essay';
    default:
      return 'single';
  }
}

export class SupabaseQuizRepository implements QuizRepository {
  // QUIZZES: lưu vào bảng `quizzes` trên Supabase (payload JSON); localStorage chỉ là bộ nhớ đệm
  private async ensureQuizLocal(id?: string): Promise<void> {
    if (!id || !isSupabaseReady()) return;
    if (readLocalList<PayloadItem>(QUIZ_CACHE_KEY).some((x) => x.id === id)) return;
    await syncPayloadCollection('quizzes', QUIZ_CACHE_KEY);
  }

  async getQuizzes(classId?: string, onlyPublished = true): Promise<QuizWithMeta[]> {
    const list = await syncPayloadCollection<QuizWithMeta>('quizzes', QUIZ_CACHE_KEY);
    if (!list) return mockQuizRepo.getQuizzes(classId, onlyPublished);
    return filterContentItems(list, classId, onlyPublished);
  }

  async getQuizById(id: string): Promise<QuizWithMeta | null> {
    const list = await this.getQuizzes(undefined, false);
    return list.find((q) => q.id === id) || null;
  }

  async saveQuiz(quiz: Partial<QuizWithMeta>): Promise<QuizWithMeta> {
    await this.ensureQuizLocal(quiz.id);
    const saved = await mockQuizRepo.saveQuiz(quiz);
    const ok = await pushPayloadItem('quizzes', saved);
    return saved;
  }

  async deleteQuiz(id: string, teacherActorId: string): Promise<void> {
    await this.ensureQuizLocal(id);
    await mockQuizRepo.deleteQuiz(id, teacherActorId);
    await pushLocalById('quizzes', QUIZ_CACHE_KEY, id);
  }

  async publishQuiz(
    id: string,
    options: { classIds: string[]; notifyStudent?: boolean },
    teacherActorId: string
  ): Promise<QuizWithMeta> {
    await this.ensureQuizLocal(id);
    const result = await mockQuizRepo.publishQuiz(id, options, teacherActorId);
    await pushPayloadItem('quizzes', result);
    return result;
  }

  async unpublishQuiz(id: string, teacherActorId: string): Promise<QuizWithMeta> {
    await this.ensureQuizLocal(id);
    const result = await mockQuizRepo.unpublishQuiz(id, teacherActorId);
    await pushPayloadItem('quizzes', result);
    return result;
  }

  async archiveQuiz(id: string, teacherActorId: string): Promise<QuizWithMeta> {
    await this.ensureQuizLocal(id);
    const result = await mockQuizRepo.archiveQuiz(id, teacherActorId);
    await pushPayloadItem('quizzes', result);
    return result;
  }

  async duplicateQuiz(id: string, teacherActorId: string): Promise<QuizWithMeta> {
    await this.ensureQuizLocal(id);
    const cloned = await mockQuizRepo.duplicateQuiz(id, teacherActorId);
    await pushPayloadItem('quizzes', cloned);
    for (const qId of cloned.questionIds || []) {
      const q = await mockQuizRepo.getQuestionById(qId);
      if (q) await this.saveQuestion(q);
    }
    return cloned;
  }

  async hasStudentAttempts(quizId: string): Promise<boolean> {
    await this.ensureQuizLocal(quizId);
    return mockQuizRepo.hasStudentAttempts(quizId);
  }

  // QUESTIONS: KẾT NỐI TRỰC TIẾP BẢNG QUESTIONS TRÊN SUPABASE (POSTGRESQL)
  async getQuestions(topicId?: string): Promise<Record<string, QuestionWithMeta>> {
    if (!isSupabaseReady()) {
      // Chế độ offline/mock thuần: giữ nguyên kho local (gồm câu mẫu).
      return mockQuizRepo.getQuestions(topicId);
    }

    // TÁCH THEO GIÁO VIÊN: chỉ lấy câu hỏi của chủ sở hữu theo phiên — câu
    // gắn trực tiếp với giáo viên, hoặc thuộc chủ đề của giáo viên đó.
    // KHÔNG còn gộp 22 câu mẫu dùng chung ở chế độ Supabase.
    const sessUser = getSessionUser();
    const ownerId = await resolveContentOwnerId();
    if (sessUser && !ownerId) return {};
    const ownLocalQuestions = async (): Promise<Record<string, QuestionWithMeta>> => {
      if (!ownerId) return {};
      const locals = await mockQuizRepo
        .getQuestions(topicId)
        .catch(() => ({}) as Record<string, QuestionWithMeta>);
      const out: Record<string, QuestionWithMeta> = {};
      for (const [id, q] of Object.entries(locals)) {
        if ((q as any).teacher_id === ownerId) out[id] = q;
      }
      return out;
    };

    try {
      let query = supabase.from('questions').select('*');
      if (ownerId) {
        const { data: myTopics } = await supabase
          .from('topics')
          .select('id')
          .eq('teacher_id', ownerId);
        const myTopicIds = (myTopics || []).map((t: any) => t.id as string);
        const orParts = [`teacher_id.eq.${ownerId}`];
        if (myTopicIds.length) {
          orParts.push(`topic_id.in.(${myTopicIds.map((id) => `"${id}"`).join(',')})`);
        }
        query = query.or(orParts.join(','));
      }

      const { data: rawRows, error } = await query;
      if (error) {
        console.warn('[SupabaseQuiz] Lỗi truy vấn bảng questions, dùng câu local của giáo viên:', error.message);
        return ownLocalQuestions();
      }
      // Lọc theo chủ đề ở phía client (tránh mơ hồ khi chồng 2 điều kiện or)
      const rows =
        topicId && topicId !== 'all'
          ? (rawRows || []).filter((r: any) => r.topic_id === topicId || r.topic_id === null)
          : rawRows;

      // 2. Chuyển đổi dữ liệu từ Supabase sang QuestionWithMeta
      const supabaseMap: Record<string, QuestionWithMeta> = {};
      for (const row of rows || []) {
        let optionsList: string[] = [];
        if (Array.isArray(row.options)) {
          optionsList = row.options;
        }

        const qItem: QuestionWithMeta = {
          id: row.id,
          topicId: row.topic_id || 'topic_1',
          type: fromSupabaseType(row.type),
          level: (row.level as any) || 'NHAN_BIET',
          difficulty: row.level === 'NHAN_BIET' ? 'DE' : row.level === 'THONG_HIEU' ? 'TB' : 'KHO',
          prompt: row.prompt || '',
          options: optionsList.length > 0 ? optionsList : undefined,
          answer: normalizeAnswerForType(fromSupabaseType(row.type), row.correct_answer),
          explanation: row.explanation || 'Giải thích chi tiết chuẩn sách giáo khoa.',
          points: 10,
          isAiGenerated: row.id.includes('ai'),
          isTeacherReviewed: true,
          status: 'published',
          version: 1,
          class_ids: ['all'],
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
          teacher_id: row.teacher_id || undefined,
        };

        // Nếu dòng có payload đầy đủ (migration_004) thì dùng nó phủ lên bản dựng
        // từ cột cơ bản — giữ lại passage/points/status/class_ids... thay vì mất hết
        supabaseMap[row.id] =
          row.payload && typeof row.payload === 'object'
            ? { ...qItem, ...row.payload, id: row.id }
            : qItem;
      }

      const mergedQuestions: Record<string, QuestionWithMeta> = {
        ...(await ownLocalQuestions()),
        ...supabaseMap,
      };

      // Đồng bộ vào localStorage để chạy offline (chỉ còn câu của chủ sở hữu)
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('mam_van_questions', JSON.stringify(mergedQuestions));
        }
      } catch {}

      return mergedQuestions;
    } catch (err) {
      console.error('[SupabaseQuiz] Ngoại lệ getQuestions:', err);
      return ownLocalQuestions();
    }
  }

  async getQuestionById(id: string): Promise<QuestionWithMeta | null> {
    if (!isSupabaseReady()) {
      return mockQuizRepo.getQuestionById(id);
    }

    try {
      const { data: row, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !row) {
        return mockQuizRepo.getQuestionById(id);
      }

      const reconstructed: QuestionWithMeta = {
        id: row.id,
        topicId: row.topic_id || 'topic_1',
        type: fromSupabaseType(row.type),
        level: (row.level as any) || 'NHAN_BIET',
        difficulty: row.level === 'NHAN_BIET' ? 'DE' : row.level === 'THONG_HIEU' ? 'TB' : 'KHO',
        prompt: row.prompt,
        options: Array.isArray(row.options) ? row.options : undefined,
        answer: normalizeAnswerForType(fromSupabaseType(row.type), row.correct_answer),
        explanation: row.explanation || '',
        points: 10,
        isAiGenerated: row.id.includes('ai'),
        isTeacherReviewed: true,
        status: 'published',
        version: 1,
        class_ids: ['all'],
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      return row.payload && typeof row.payload === 'object'
        ? { ...reconstructed, ...row.payload, id: row.id }
        : reconstructed;
    } catch {
      return mockQuizRepo.getQuestionById(id);
    }
  }

  async saveQuestion(question: Partial<QuestionWithMeta>): Promise<QuestionWithMeta> {
    const qId = question.id || 'q_ai_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();

    // 1. Lưu vào mockRepo (LocalStorage) trước để fallback ngay tức thì
    // (đóng dấu chủ sở hữu = giáo viên đang đăng nhập)
    const savedMock = await mockQuizRepo.saveQuestion({
      ...question,
      id: qId,
      teacher_id: (question as any).teacher_id || sessionTeacherId() || undefined,
      updated_at: now,
    });

    if (!isSupabaseReady()) {
      return savedMock;
    }

    try {
      // 2. Chuẩn hóa topic_id an toàn (tránh lỗi khóa ngoại nếu topic chưa tạo trên Supabase)
      let topicId: string | null = question.topicId || null;
      if (topicId === 'all' || topicId === 'topic_1' || topicId === 'topic_tho_bon_nam') {
        topicId = null;
      }
      if (topicId) {
        // Kiểm tra xem topicId có thực sự tồn tại trong bảng topics không
        const { data: topicExists } = await supabase
          .from('topics')
          .select('id')
          .eq('id', topicId)
          .maybeSingle();
        if (!topicExists) {
          topicId = null;
        }
      }

      // 3. Chuẩn bị payload chuẩn bảng `questions` trên Supabase PostgreSQL
      const dbPayload = {
        id: qId,
        topic_id: topicId,
        teacher_id: sessionTeacherId() || (question as any).teacher_id || null,
        type: toSupabaseType(question.type),
        level: question.level || 'NHAN_BIET',
        prompt: question.prompt || 'Câu hỏi chưa có tiêu đề',
        options: Array.isArray(question.options) ? question.options : [],
        correct_answer: question.answer ?? null,
        explanation: question.explanation || '',
        created_at: question.created_at || now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('questions')
        .upsert(dbPayload, { onConflict: 'id' })
        .select()
        .single();

      if (error || !data) {
        if (error) console.warn('[SupabaseQuiz] Lỗi lưu câu hỏi lên Supabase, giữ bản lưu mock:', error.message);
        return savedMock;
      }

      // Lưu thêm bản đầy đủ vào cột payload (migration_004) để không mất
      // passage/points/status/class_ids... khi đọc lại từ Supabase.
      // Chưa chạy migration -> lỗi cột, chỉ cảnh báo, bản cột cơ bản vẫn đã lưu.
      try {
        const { error: payloadError } = await supabase
          .from('questions')
          .update({ payload: savedMock })
          .eq('id', qId);
        if (payloadError) {
          console.warn('[SupabaseQuiz] Chưa lưu được payload câu hỏi (đã chạy migration_004 chưa?):', payloadError.message);
        }
      } catch (payloadErr) {
        console.warn('[SupabaseQuiz] Ngoại lệ khi lưu payload câu hỏi:', payloadErr);
      }

      syncEventBus.emit('quiz', { questionId: qId });

      return {
        ...savedMock,
        id: data.id,
        topicId: data.topic_id || topicId,
        prompt: data.prompt,
        options: Array.isArray(data.options) ? data.options : savedMock.options,
        answer: data.correct_answer ?? savedMock.answer,
        explanation: data.explanation || savedMock.explanation,
        updated_at: data.updated_at || now,
      };
    } catch (err) {
      console.error('[SupabaseQuiz] Ngoại lệ saveQuestion:', err);
      return savedMock;
    }
  }

  async deleteQuestion(id: string, teacherActorId: string): Promise<void> {
    // 1. Xóa khỏi mockRepo
    await mockQuizRepo.deleteQuestion(id, teacherActorId);

    if (!isSupabaseReady()) return;

    try {
      // 2. Xóa khỏi Supabase bảng questions
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) {
        console.warn('[SupabaseQuiz] Lỗi xóa câu hỏi khỏi Supabase:', error.message);
      } else {
      }
      syncEventBus.emit('quiz', { deletedId: id });
    } catch (err) {
      console.error('[SupabaseQuiz] Ngoại lệ deleteQuestion:', err);
    }
  }
}

export const supabaseQuizRepo = new SupabaseQuizRepository();

// ==============================================================================
// 9. SUPABASE CONTENT REPOSITORY (QUẢN LÝ CÂY CHỦ ĐỀ & HỌC LIỆU TRÊN SUPABASE)
// ==============================================================================
export class SupabaseContentRepository implements ContentRepository {
  async getTopics(classId?: string, onlyPublished = true): Promise<TopicWithMeta[]> {
    if (!isSupabaseReady()) {
      return mockContentRepo.getTopics(classId, onlyPublished);
    }

    // TÁCH THEO GIÁO VIÊN: chỉ lấy chủ đề của chủ sở hữu theo phiên (giáo
    // viên thấy của mình; học sinh thấy của giáo viên chủ nhiệm lớp mình).
    const sessUser = getSessionUser();
    const ownerId = await resolveContentOwnerId();
    if (sessUser && !ownerId) return [];

    try {
      let topicQuery = supabase
        .from('topics')
        .select('*')
        .order('order_index', { ascending: true });
      if (ownerId) {
        topicQuery = topicQuery.eq('teacher_id', ownerId);
      }
      const { data: rows, error } = await topicQuery;
      if (error) {
        console.warn('[SupabaseContent] Lỗi truy vấn bảng topics, fallback sang mock:', error.message);
        return mockContentRepo.getTopics(classId, onlyPublished);
      }

      const remoteTopics: TopicWithMeta[] = (rows || []).map((row) => {
        const vPayload = typeof row.video_payload === 'object' && row.video_payload !== null ? row.video_payload : {};
        const tPayload = typeof row.theory_payload === 'object' && row.theory_payload !== null ? row.theory_payload : {};

        return {
          id: row.id,
          title: row.title || '',
          shortDesc: vPayload.shortDesc || '',
          tag: row.category || 'Chung',
          videoIds: Array.isArray(vPayload.videoIds) ? vPayload.videoIds : [],
          flowOrder: Array.isArray(vPayload.flowOrder) ? vPayload.flowOrder : [],
          theoryId: tPayload.theoryId || '',
          colorScheme: vPayload.colorScheme || '#2F3E6B',
          status: (row.status as any) || 'published',
          class_ids: Array.isArray(vPayload.class_ids) ? vPayload.class_ids : ['all'],
          version: typeof vPayload.version === 'number' ? vPayload.version : 1,
          has_unpublished_edits: !!vPayload.has_unpublished_edits,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
          teacher_id: row.teacher_id || undefined,
        };
      });

      // Chủ đề chỉ có ở máy này (chưa lên được Supabase) -> giữ lại và tự đẩy lên để không bị mất.
      // CHỈ nhận bản local mang dấu chủ của ĐÚNG giáo viên đang đăng nhập —
      // bản của người khác hoặc vô chủ thì bỏ qua (chặn rò dữ liệu chéo tài khoản).
      const remoteIds = new Set(remoteTopics.map((t) => t.id));
      const localOnly = readLocalList<TopicWithMeta>(TOPIC_CACHE_KEY).filter(
        (t) =>
          t &&
          t.id &&
          !remoteIds.has(t.id) &&
          !t.deleted_at &&
          (!ownerId || (t as any).teacher_id === ownerId)
      );
      const topics: TopicWithMeta[] = [...remoteTopics, ...localOnly];

      // Lưu đệm TOÀN BỘ chủ đề (cả bản nháp) vào localStorage để load mượt mà
      writeLocalList(TOPIC_CACHE_KEY, topics);
      if (localOnly.length > 0) {
        await Promise.all(localOnly.map((t) => this.pushTopicRecord(t.id)));
      }

      // Lọc theo trạng thái xuất bản & lớp
      let filtered = topics;
      if (onlyPublished) {
        filtered = filtered.filter((t) => t.status === 'published');
      }
      if (classId && classId !== 'all') {
        filtered = filtered.filter((t) => t.class_ids.includes('all') || t.class_ids.includes(classId));
      }

      return filtered;
    } catch (err) {
      console.error('[SupabaseContent] Ngoại lệ getTopics:', err);
      return mockContentRepo.getTopics(classId, onlyPublished);
    }
  }

  async getTopicById(id: string): Promise<TopicWithMeta | null> {
    const list = await this.getTopics(undefined, false);
    return list.find((t) => t.id === id) || null;
  }

  async saveTopic(topic: Partial<TopicWithMeta>): Promise<TopicWithMeta> {
    const topicId = topic.id || 'topic_' + Date.now();
    const now = new Date().toISOString();

    // 1. Lưu vào mock/local cache trước (đóng dấu chủ sở hữu theo phiên)
    const savedMock = await mockContentRepo.saveTopic({
      ...topic,
      id: topicId,
      teacher_id: (topic as any).teacher_id || sessionTeacherId() || undefined,
      updated_at: now,
    });

    if (!isSupabaseReady()) {
      return savedMock;
    }

    try {
      const vPayload = {
        shortDesc: topic.shortDesc || savedMock.shortDesc || '',
        videoIds: topic.videoIds || savedMock.videoIds || [],
        flowOrder: topic.flowOrder || savedMock.flowOrder || [],
        colorScheme: topic.colorScheme || savedMock.colorScheme || '#2F3E6B',
        class_ids: topic.class_ids || savedMock.class_ids || ['all'],
        version: topic.version ?? savedMock.version ?? 1,
        has_unpublished_edits: topic.has_unpublished_edits ?? savedMock.has_unpublished_edits ?? false,
      };

      const tPayload = {
        theoryId: topic.theoryId || savedMock.theoryId || '',
      };

      const dbPayload = {
        id: topicId,
        title: topic.title || savedMock.title || 'Chủ đề mới',
        category: topic.tag || savedMock.tag || 'Chung',
        teacher_id: sessionTeacherId() || (topic as any).teacher_id || null,
        order_index: (topic as any).order_index ?? 0,
        video_payload: vPayload,
        theory_payload: tPayload,
        status: topic.status || savedMock.status || 'published',
        created_at: topic.created_at || savedMock.created_at || now,
        updated_at: now,
      };

      const { error } = await supabase
        .from('topics')
        .upsert(dbPayload, { onConflict: 'id' });

      if (error) {
        console.warn('[SupabaseContent] Lỗi lưu chủ đề lên Supabase:', error.message);
        return savedMock;
      }

      console.log(`[SupabaseContent] ✅ Đã lưu chủ đề [${topicId}] vào Supabase database thành công!`);
      syncEventBus.emit('content', { topicId });
      return savedMock;
    } catch (err) {
      console.error('[SupabaseContent] Ngoại lệ saveTopic:', err);
      return savedMock;
    }
  }

  async deleteTopic(id: string, teacherActorId: string): Promise<void> {
    await mockContentRepo.deleteTopic(id, teacherActorId);

    if (!isSupabaseReady()) return;

    try {
      const { error } = await supabase.from('topics').delete().eq('id', id);
      if (error) {
        console.warn('[SupabaseContent] Lỗi xóa chủ đề trên Supabase:', error.message);
      } else {
        console.log(`[SupabaseContent] 🗑️ Đã xóa chủ đề [${id}] trên Supabase database.`);
      }
      syncEventBus.emit('content', { deletedTopicId: id });
    } catch (err) {
      console.error('[SupabaseContent] Ngoại lệ deleteTopic:', err);
    }
  }

  async reorderTopics(topicIds: string[]): Promise<void> {
    await mockContentRepo.reorderTopics(topicIds);

    if (!isSupabaseReady()) return;

    try {
      await Promise.all(
        topicIds.map((id, index) =>
          supabase.from('topics').update({ order_index: index + 1 }).eq('id', id)
        )
      );
      syncEventBus.emit('content');
    } catch (err) {
      console.error('[SupabaseContent] Ngoại lệ reorderTopics:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Nội dung học (video / lý thuyết) được lưu vào các bảng `video_lessons`, `theory_lessons`
  // trên Supabase (payload JSON). localStorage chỉ còn là bộ nhớ đệm.
  // ---------------------------------------------------------------------------
  private async ensureLocal(table: string, key: string, id?: string): Promise<void> {
    if (!id || !isSupabaseReady()) return;
    if (readLocalList<PayloadItem>(key).some((x) => x.id === id)) return;
    await syncPayloadCollection(table, key);
  }

  /** Đẩy bản ghi chủ đề (đang ở bộ nhớ đệm) lên bảng topics trên Supabase. */
  private async pushTopicRecord(topicId?: string): Promise<void> {
    if (!topicId || !isSupabaseReady()) return;
    const t = readLocalList<TopicWithMeta>(TOPIC_CACHE_KEY).find((x) => x.id === topicId);
    if (!t) return;
    try {
      const { error } = await supabase.from('topics').upsert(
        {
          id: t.id,
          title: t.title || 'Chủ đề mới',
          category: t.tag || 'Chung',
          teacher_id: (t as any).teacher_id || sessionTeacherId() || null,
          video_payload: {
            shortDesc: t.shortDesc || '',
            videoIds: Array.isArray(t.videoIds) ? t.videoIds : [],
            flowOrder: Array.isArray(t.flowOrder) ? t.flowOrder : [],
            colorScheme: t.colorScheme || '#2F3E6B',
            class_ids: Array.isArray(t.class_ids) ? t.class_ids : ['all'],
            version: t.version ?? 1,
            has_unpublished_edits: !!t.has_unpublished_edits,
          },
          theory_payload: { theoryId: t.theoryId || '' },
          status: t.status || 'draft',
          created_at: t.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (error) console.warn('[SupabaseContent] Lỗi đẩy chủ đề lên Supabase:', error.message);
    } catch (err) {
      console.error('[SupabaseContent] Ngoại lệ pushTopicRecord:', err);
    }
  }

  private async pushContentById(type: 'topic' | 'video' | 'theory', id: string): Promise<void> {
    if (type === 'topic') {
      await this.pushTopicRecord(id);
    } else if (type === 'video') {
      await pushLocalById('video_lessons', VIDEO_CACHE_KEY, id);
    } else {
      await pushLocalById('theory_lessons', THEORY_CACHE_KEY, id);
    }
    syncEventBus.emit('content');
  }

  async getVideoLessons(classId?: string, onlyPublished = true): Promise<VideoLessonWithMeta[]> {
    const list = await syncPayloadCollection<VideoLessonWithMeta>('video_lessons', VIDEO_CACHE_KEY);
    if (!list) return mockContentRepo.getVideoLessons(classId, onlyPublished);
    return filterContentItems(list, classId, onlyPublished);
  }

  async getVideoLessonById(id: string): Promise<VideoLessonWithMeta | null> {
    const list = await this.getVideoLessons(undefined, false);
    return list.find((v) => v.id === id) || null;
  }

  async getTheoryLessons(classId?: string, onlyPublished = true): Promise<TheoryLessonWithMeta[]> {
    const list = await syncPayloadCollection<TheoryLessonWithMeta>('theory_lessons', THEORY_CACHE_KEY);
    if (!list) return mockContentRepo.getTheoryLessons(classId, onlyPublished);
    return filterContentItems(list, classId, onlyPublished);
  }

  async getTheoryLessonById(id: string): Promise<TheoryLessonWithMeta | null> {
    const list = await this.getTheoryLessons(undefined, false);
    return list.find((t) => t.id === id) || null;
  }

  async saveVideoLesson(video: Partial<VideoLessonWithMeta>): Promise<VideoLessonWithMeta> {
    await this.ensureLocal('video_lessons', VIDEO_CACHE_KEY, video.id);
    const saved = await mockContentRepo.saveVideoLesson(video);
    const ok = await pushPayloadItem('video_lessons', saved);
    if (ok) console.log(`[SupabaseContent] ✅ Đã lưu video [${saved.id}] vào Supabase database.`);
    return saved;
  }

  async saveTheoryLesson(theory: Partial<TheoryLessonWithMeta>): Promise<TheoryLessonWithMeta> {
    await this.ensureLocal('theory_lessons', THEORY_CACHE_KEY, theory.id);
    const saved = await mockContentRepo.saveTheoryLesson(theory);
    const ok = await pushPayloadItem('theory_lessons', saved);
    return saved;
  }

  async deleteVideoLesson(id: string, teacherActorId: string): Promise<void> {
    await this.ensureLocal('video_lessons', VIDEO_CACHE_KEY, id);
    const affectedTopicIds = readLocalList<TopicWithMeta>(TOPIC_CACHE_KEY)
      .filter((t) => Array.isArray(t.videoIds) && t.videoIds.includes(id))
      .map((t) => t.id);
    await mockContentRepo.deleteVideoLesson(id, teacherActorId);
    await pushLocalById('video_lessons', VIDEO_CACHE_KEY, id);
    await Promise.all(affectedTopicIds.map((tid) => this.pushTopicRecord(tid)));
  }

  async deleteTheoryLesson(id: string, teacherActorId: string): Promise<void> {
    await this.ensureLocal('theory_lessons', THEORY_CACHE_KEY, id);
    await mockContentRepo.deleteTheoryLesson(id, teacherActorId);
    await pushLocalById('theory_lessons', THEORY_CACHE_KEY, id);
  }

  async reorderTopicVideos(topicId: string, videoIds: string[]): Promise<void> {
    await mockContentRepo.reorderTopicVideos(topicId, videoIds);
    await this.pushTopicRecord(topicId);
  }

  async publishContent(
    type: 'topic' | 'video' | 'theory',
    id: string,
    options: { classIds: string[]; notifyStudent?: boolean },
    teacherActorId: string
  ): Promise<void> {
    if (type === 'video') await this.ensureLocal('video_lessons', VIDEO_CACHE_KEY, id);
    if (type === 'theory') await this.ensureLocal('theory_lessons', THEORY_CACHE_KEY, id);

    await mockContentRepo.publishContent(type, id, options, teacherActorId);

    if (type === 'topic' && isSupabaseReady()) {
      try {
        await supabase.from('topics').update({ status: 'published' }).eq('id', id);
      } catch {}
    }
    await this.pushContentById(type, id);

    // Xuất bản video/lý thuyết => tự động xuất bản chủ đề cha để học sinh nhìn thấy
    if (type !== 'topic') {
      const key = type === 'video' ? VIDEO_CACHE_KEY : THEORY_CACHE_KEY;
      const item = readLocalList<PayloadItem>(key).find((x) => x.id === id);
      const parentId = item?.topicId;
      if (parentId) {
        const parent = readLocalList<TopicWithMeta>(TOPIC_CACHE_KEY).find((t) => t.id === parentId);
        if (parent && parent.status !== 'published') {
          await mockContentRepo.publishContent('topic', parentId, { classIds: options.classIds }, teacherActorId);
          await this.pushContentById('topic', parentId);
        }
      }
    }
  }

  async unpublishContent(type: 'topic' | 'video' | 'theory', id: string, teacherActorId: string): Promise<void> {
    if (type === 'video') await this.ensureLocal('video_lessons', VIDEO_CACHE_KEY, id);
    if (type === 'theory') await this.ensureLocal('theory_lessons', THEORY_CACHE_KEY, id);
    await mockContentRepo.unpublishContent(type, id, teacherActorId);
    await this.pushContentById(type, id);
  }

  async archiveContent(type: 'topic' | 'video' | 'theory', id: string, teacherActorId: string): Promise<void> {
    if (type === 'video') await this.ensureLocal('video_lessons', VIDEO_CACHE_KEY, id);
    if (type === 'theory') await this.ensureLocal('theory_lessons', THEORY_CACHE_KEY, id);
    await mockContentRepo.archiveContent(type, id, teacherActorId);
    await this.pushContentById(type, id);
  }

  async duplicateContent(
    type: 'topic' | 'video' | 'theory',
    id: string,
    teacherActorId: string
  ): Promise<TopicWithMeta | VideoLessonWithMeta | TheoryLessonWithMeta> {
    if (type === 'video') await this.ensureLocal('video_lessons', VIDEO_CACHE_KEY, id);
    if (type === 'theory') await this.ensureLocal('theory_lessons', THEORY_CACHE_KEY, id);
    const result = await mockContentRepo.duplicateContent(type, id, teacherActorId);
    if (result?.id) {
      await this.pushContentById(type, result.id);
      if (type === 'video' && (result as VideoLessonWithMeta).topicId) {
        await this.pushTopicRecord((result as VideoLessonWithMeta).topicId);
      }
    }
    return result;
  }
}

export const supabaseContentRepo = new SupabaseContentRepository();



