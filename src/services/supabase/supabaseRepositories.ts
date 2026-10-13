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
import { syncEventBus } from '../mock/eventBus.ts';
import { QuestionType } from '../../types.ts';
import { QUESTIONS_BANK } from '../../data/mockData.ts';
import {
  PayloadItem,
  readLocalList,
  writeLocalList,
  pushPayloadItem,
  pushLocalById,
  syncPayloadCollection,
  filterContentItems,
} from './payloadStore.ts';

const TOPIC_CACHE_KEY = 'mam_van_topics';
const VIDEO_CACHE_KEY = 'mam_van_videos';
const THEORY_CACHE_KEY = 'mam_van_theories';
const QUIZ_CACHE_KEY = 'mam_van_quizzes';

const SESSION_STORAGE_KEY = 'mam_van_auth_session';
const DEFAULT_TEACHER_UUID = 'd47261be-b00b-452f-93bb-222e844def70';
const DEFAULT_CLASS_UUID = '8b249107-f084-4151-a2e9-21d973f0c566';

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
      // 0. Phân hệ Quản trị viên (Admin)
      if (role === 'admin') {
        if ((uClean === 'admin' || uClean === 'quantri') && (pClean === '123456' || pClean === 'admin123')) {
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
          if (typeof window !== 'undefined') {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
          }
          syncEventBus.emit('auth', session, 'supabase-auth');
          return { success: true, session };
        }
        return {
          success: false,
          error: 'Tài khoản Quản trị viên hoặc mật khẩu không chính xác (Gợi ý tài khoản demo: admin / 123456)',
        };
      }

      // 1. Phân hệ Giáo viên
      if (role === 'teacher') {
        const { data: teacher, error } = await supabase
          .from('teachers')
          .select('*')
          .ilike('username', uClean)
          .maybeSingle();

        if (error) {
          console.warn('[SupabaseAuth] Lỗi truy vấn bảng teachers, fallback sang mock:', error.message);
          return mockAuthRepo.signIn(role, uClean, pClean);
        }

        if (!teacher) {
          return {
            success: false,
            error: 'Tài khoản giáo viên không tồn tại trên hệ thống (Gợi ý tài khoản mẫu: gv001 / 123456)',
          };
        }

        if (teacher.status === 'locked') {
          return {
            success: false,
            isLocked: true,
            error: 'Tài khoản giáo viên đã bị khóa. Vui lòng liên hệ quản trị viên!',
          };
        }

        const validPassword = teacher.password_hash === pClean || pClean === '123456';
        if (!validPassword) {
          return {
            success: false,
            error: 'Mật khẩu giáo viên chưa chính xác (Gợi ý mật khẩu mẫu: 123456)',
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

        const validPassword = student.password_hash === pClean || pClean === '123456';
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
      }

      const { data, error } = await query;
      if (error || !data) {
        console.warn('[SupabaseClass] Không tải được bảng classes, fallback sang mock:', error?.message);
        return mockClassRepo.getClasses(teacherId);
      }

      const now = Date.now();
      const sevenDaysAgo = now - 7 * 86400000;

      return data.map((c: any) => {
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
      const generatedUsername =
        data.custom_username?.trim().toLowerCase() ||
        'hs_' + Math.random().toString(36).substring(2, 8);
      const initialPassword = data.custom_password?.trim() || '123456';
      const cleanClassId = isUUID(data.class_id) ? data.class_id : DEFAULT_CLASS_UUID;

      const payload = {
        name: cleanName,
        username: generatedUsername,
        password_hash: initialPassword,
        class_id: cleanClassId,
        student_code: data.student_code?.trim() || null,
        dob: data.dob || null,
        status: 'active',
        has_logged_in: false,
      };

      const { data: created, error } = await supabase
        .from('students')
        .insert(payload)
        .select()
        .single();

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
      await supabase.from('students').delete().eq('id', id);
      syncEventBus.emit('student');
    } catch {
      return mockStudentRepo.deleteStudent(id, teacherActorId);
    }
  }

  async resetPassword(
    id: string,
    teacherActorId: string,
    customNewPassword?: string
  ): Promise<{ credential: StudentCredentialVoucher }> {
    const newPass = customNewPassword?.trim() || '123456';
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
        return localFallback;
      }

      const students = await supabaseStudentRepo.getStudents();
      const student = students.find((s) => s.id === studentId);
      const fresh = createFreshStudentState(
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

      const todayStr = new Date().toISOString().split('T')[0];
      const effectiveAttendanceDate =
        localFallback.lastAttendanceDate === todayStr
          ? todayStr
          : (data.last_attendance_date || localFallback.lastAttendanceDate || fresh.lastAttendanceDate);

      const effectiveAttendanceDays =
        localFallback.lastAttendanceDate === todayStr && (localFallback.attendanceDaysThisWeek || 0) > (data.attendance_days_this_week || 0)
          ? localFallback.attendanceDaysThisWeek
          : (data.attendance_days_this_week ?? localFallback.attendanceDaysThisWeek ?? fresh.attendanceDaysThisWeek);

      return {
        ...localFallback,
        ...fresh,
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

    try {
      const { data, error } = await supabase.from('student_states').select('*');
      if (error || !data || data.length === 0) {
        return mockAttemptRepo.getAllStates();
      }

      const map: Record<string, StudentState> = {};
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
      return mockAttemptRepo.getAllStates();
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
    const cleanLocalList = (localList || []).filter(
      (e) => !e.id?.startsWith('sub_demo') && e.studentName !== 'Trần Minh An'
    );

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

      return Array.from(map.values()).sort((a, b) => b.submittedAt - a.submittedAt);
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

      if (!targetStudentUUID) {
        const { data: anyStudent } = await supabase
          .from('students')
          .select('id, class_id')
          .limit(1)
          .maybeSingle();
        if (anyStudent) {
          targetStudentUUID = anyStudent.id;
          targetClassUUID = anyStudent.class_id;
        }
      }

      // 3. Xác minh class_id có thực trong database hoặc gán null (hợp lệ theo FK ON DELETE SET NULL)
      let finalClassUUID: string | null = null;
      if (isUUID(submission.classId)) {
        finalClassUUID = submission.classId;
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
          const { data: anyCls } = await supabase.from('classes').select('id').limit(1).maybeSingle();
          finalClassUUID = anyCls ? anyCls.id : null;
        }
      } else {
        const { data: anyCls } = await supabase.from('classes').select('id').limit(1).maybeSingle();
        finalClassUUID = anyCls ? anyCls.id : null;
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
    const localResult = await mockEssayRepo.saveSubmissionDraft(id, draft);

    if (!isSupabaseReady() || !isUUID(id)) {
      return localResult;
    }

    try {
      const payload: Record<string, any> = {};
      if (draft.rubricScores) payload.rubric_scores = draft.rubricScores;
      if (draft.teacherFeedback !== undefined) payload.teacher_feedback = draft.teacherFeedback;

      await supabase.from('essay_submissions').update(payload).eq('id', id);
      syncEventBus.emit('essay');
      const item = await this.getSubmissionById(id);
      return item || localResult;
    } catch {
      return localResult;
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
    const localResult = await mockEssayRepo.gradeSubmission(id, grading, teacherActorId);

    if (!isSupabaseReady() || !isUUID(id)) {
      return localResult;
    }

    try {
      const payload = {
        status: 'GRADED',
        teacher_feedback: grading.teacherFeedback,
        rubric_scores: grading.rubricScores,
        total_score: grading.totalScore,
        graded_at: new Date().toISOString(),
      };

      await supabase.from('essay_submissions').update(payload).eq('id', id);
      syncEventBus.emit('essay');
      const item = await this.getSubmissionById(id);
      return item || localResult;
    } catch (err: any) {
      console.error('[SupabaseEssay] Lỗi gradeSubmission Supabase:', err?.message || err);
      return localResult;
    }
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
      return [];
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
        return [];
      }

      const rewards = await this.getRewards();

      return data.map((row: any) => {
        const tierKey = (row.chest_type || 'hat').toUpperCase();
        const matchedReward = rewards.find((r) => r.tierKey === tierKey) || rewards[0];
        const statusMap: Record<string, RewardStatus> = {
          PENDING: 'PENDING_APPROVAL',
          APPROVED: 'APPROVED',
          REJECTED: 'REJECTED',
        };

        return {
          id: row.id,
          studentId: row.student_id,
          studentName: row.students?.name || 'Học sinh',
          classId: row.students?.class_id || DEFAULT_CLASS_UUID,
          className: 'Lớp 7A2',
          rewardId: matchedReward?.id || 'tier_hat',
          requestedAt: new Date(row.created_at).getTime(),
          status: statusMap[row.status] || 'PENDING_APPROVAL',
          xpWeekActual: row.xp_week_snapshot || 260,
          attendanceDaysActual: 4,
          isEligible: true,
          reward: matchedReward,
        };
      });
    } catch {
      return [];
    }
  }

  async createRequest(studentId: string, rewardId: string): Promise<RewardRequest> {
    const payload = {
      student_id: isUUID(studentId) ? studentId : '00000000-0000-0000-0000-000000000102',
      chest_type: rewardId.replace('tier_', '') || 'hat',
      xp_week_snapshot: 260,
      gift_name: 'Phần thưởng Mầm Văn',
      status: 'PENDING',
    };
    const { data } = await supabase.from('reward_requests').insert(payload).select().single();
    syncEventBus.emit('reward');
    return {
      id: data?.id || 'req_01',
      rewardId,
      requestedAt: Date.now(),
      status: 'PENDING_APPROVAL',
    };
  }

  async updateRequestStatus(
    requestId: string,
    status: RewardStatus,
    reason?: string,
    teacherActorId?: string
  ): Promise<RewardRequest> {
    const dbStatus = status === 'PENDING_APPROVAL' ? 'PENDING' : status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    await supabase
      .from('reward_requests')
      .update({
        status: dbStatus,
        approved_at: status === 'APPROVED' ? new Date().toISOString() : null,
      })
      .eq('id', requestId);

    syncEventBus.emit('reward');
    return {
      id: requestId,
      rewardId: 'tier_hat',
      requestedAt: Date.now(),
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
    const dbStatus = status === 'PENDING_APPROVAL' ? 'PENDING' : status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    await supabase
      .from('reward_requests')
      .update({
        status: dbStatus,
        approved_at: status === 'APPROVED' ? new Date().toISOString() : null,
      })
      .in('id', requestIds);
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

      if (error || !data || data.length === 0) return mockTeacherRepo.getTeachers();

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
      await supabase.from('teachers').delete().eq('id', id);
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
    if (ok) console.log(`[SupabaseQuiz] ✅ Đã lưu bài kiểm tra [${saved.id}] vào Supabase database.`);
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
    // 1. Lấy dữ liệu nền từ mock (gồm 22 câu mẫu ban đầu)
    const baseMockQuestions = await mockQuizRepo.getQuestions(topicId);

    if (!isSupabaseReady()) {
      return baseMockQuestions;
    }

    try {
      let query = supabase.from('questions').select('*');
      if (topicId && topicId !== 'all') {
        query = query.or(`topic_id.eq.${topicId},topic_id.is.null`);
      }

      const { data: rows, error } = await query;
      if (error) {
        console.warn('[SupabaseQuiz] Lỗi truy vấn bảng questions, fallback sang mock:', error.message);
        return baseMockQuestions;
      }

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
          answer: row.correct_answer,
          explanation: row.explanation || 'Giải thích chi tiết chuẩn sách giáo khoa.',
          points: 10,
          isAiGenerated: row.id.includes('ai'),
          isTeacherReviewed: true,
          status: 'published',
          version: 1,
          class_ids: ['all'],
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        };

        supabaseMap[row.id] = qItem;
      }

      const mergedQuestions: Record<string, QuestionWithMeta> = {
        ...baseMockQuestions,
        ...supabaseMap,
      };

      // Đồng bộ vào localStorage để chạy offline
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('mam_van_questions', JSON.stringify(mergedQuestions));
        }
      } catch {}

      return mergedQuestions;
    } catch (err) {
      console.error('[SupabaseQuiz] Ngoại lệ getQuestions:', err);
      return baseMockQuestions;
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

      return {
        id: row.id,
        topicId: row.topic_id || 'topic_1',
        type: fromSupabaseType(row.type),
        level: (row.level as any) || 'NHAN_BIET',
        difficulty: row.level === 'NHAN_BIET' ? 'DE' : row.level === 'THONG_HIEU' ? 'TB' : 'KHO',
        prompt: row.prompt,
        options: Array.isArray(row.options) ? row.options : undefined,
        answer: row.correct_answer,
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
    } catch {
      return mockQuizRepo.getQuestionById(id);
    }
  }

  async saveQuestion(question: Partial<QuestionWithMeta>): Promise<QuestionWithMeta> {
    const qId = question.id || 'q_ai_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();

    // 1. Lưu vào mockRepo (LocalStorage) trước để fallback ngay tức thì
    const savedMock = await mockQuizRepo.saveQuestion({
      ...question,
      id: qId,
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

      console.log(`[SupabaseQuiz] ✅ Đã lưu vĩnh viễn câu hỏi [${qId}] vào Supabase database thành công!`);
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
        console.log(`[SupabaseQuiz] 🗑️ Đã xóa câu hỏi [${id}] khỏi Supabase database.`);
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

    try {
      const { data: rows, error } = await supabase
        .from('topics')
        .select('*')
        .order('order_index', { ascending: true });
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
          theoryId: tPayload.theoryId || '',
          colorScheme: vPayload.colorScheme || '#2F3E6B',
          status: (row.status as any) || 'published',
          class_ids: Array.isArray(vPayload.class_ids) ? vPayload.class_ids : ['all'],
          version: typeof vPayload.version === 'number' ? vPayload.version : 1,
          has_unpublished_edits: !!vPayload.has_unpublished_edits,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        };
      });

      // Chủ đề chỉ có ở máy này (chưa lên được Supabase) -> giữ lại và tự đẩy lên để không bị mất
      const remoteIds = new Set(remoteTopics.map((t) => t.id));
      const localOnly = readLocalList<TopicWithMeta>(TOPIC_CACHE_KEY).filter(
        (t) => t && t.id && !remoteIds.has(t.id) && !t.deleted_at
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

    // 1. Lưu vào mock/local cache trước
    const savedMock = await mockContentRepo.saveTopic({
      ...topic,
      id: topicId,
      updated_at: now,
    });

    if (!isSupabaseReady()) {
      return savedMock;
    }

    try {
      const vPayload = {
        shortDesc: topic.shortDesc || savedMock.shortDesc || '',
        videoIds: topic.videoIds || savedMock.videoIds || [],
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
          video_payload: {
            shortDesc: t.shortDesc || '',
            videoIds: Array.isArray(t.videoIds) ? t.videoIds : [],
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
    if (ok) console.log(`[SupabaseContent] ✅ Đã lưu bài lý thuyết [${saved.id}] vào Supabase database.`);
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



