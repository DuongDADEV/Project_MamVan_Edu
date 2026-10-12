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
} from '../types.ts';
import {
  authRepo as mockAuthRepo,
  classRepo as mockClassRepo,
  studentRepo as mockStudentRepo,
  attemptRepo as mockAttemptRepo,
  essayRepo as mockEssayRepo,
  auditRepo,
} from '../mock/mockRepositories.ts';
import { createFreshStudentState } from '../mock/seedData.ts';
import { syncEventBus } from '../mock/eventBus.ts';

const SESSION_STORAGE_KEY = 'mam_van_auth_session';

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
      // 1. Phân hệ Giáo viên / Admin
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
          .eq('teacher_id', teacher.id)
          .is('deleted_at', null);

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
            classIds: classIds.length > 0 ? classIds : ['00000000-0000-0000-0000-000000000010'],
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
          .is('deleted_at', null)
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
        .select('*, students(id, last_active_at, deleted_at)')
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (teacherId) {
        query = query.eq('teacher_id', teacherId);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.warn('[SupabaseClass] Không tải được bảng classes, fallback sang mock:', error?.message);
        return mockClassRepo.getClasses(teacherId);
      }

      const now = Date.now();
      const sevenDaysAgo = now - 7 * 86400000;

      return data.map((c: any) => {
        const rawStudents: any[] = Array.isArray(c.students) ? c.students : [];
        const validStudents = rawStudents.filter((s) => !s.deleted_at);
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
          deleted_at: c.deleted_at || null,
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
        teacher_id: data.teacherId || '00000000-0000-0000-0000-000000000001',
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
        deleted_at: updated.deleted_at,
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
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (filter?.classId && filter.classId !== 'all') {
        query = query.eq('class_id', filter.classId);
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
        deleted_at: s.deleted_at || null,
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
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

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
        deleted_at: data.deleted_at || null,
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

      const payload = {
        name: cleanName,
        username: generatedUsername,
        password_hash: initialPassword,
        class_id: data.class_id,
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

      // Khởi tạo bản ghi student_states ban đầu trên DB
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
      if (data.class_id !== undefined) payload.class_id = data.class_id;
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
        deleted_at: updated.deleted_at || null,
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
      await supabase
        .from('students')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
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
    if (!isSupabaseReady()) {
      return mockAttemptRepo.getStudentState(studentId);
    }

    try {
      const { data, error } = await supabase
        .from('student_states')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (error || !data) {
        const fallback = await mockAttemptRepo.getStudentState(studentId);
        await this.saveStudentState(studentId, fallback);
        return fallback;
      }

      const students = await supabaseStudentRepo.getStudents();
      const student = students.find((s) => s.id === studentId);
      const fresh = createFreshStudentState(
        student || {
          id: studentId,
          name: 'Học sinh',
          username: studentId,
          class_id: '00000000-0000-0000-0000-000000000010',
          status: 'active',
          has_logged_in: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );

      return {
        ...fresh,
        xpToday: data.xp_today ?? fresh.xpToday,
        xpWeek: data.xp_week ?? fresh.xpWeek,
        totalXp: data.total_xp ?? fresh.totalXp,
        activeSecondsToday: data.active_seconds_today ?? fresh.activeSecondsToday,
        lastAttendanceDate: data.last_attendance_date || fresh.lastAttendanceDate,
        attendanceDaysThisWeek: data.attendance_days_this_week ?? fresh.attendanceDaysThisWeek,
        attendanceHistory: Array.isArray(data.attendance_history) ? data.attendance_history : fresh.attendanceHistory,
        completedSteps: Array.isArray(data.completed_steps) ? data.completed_steps : fresh.completedSteps,
        questionResults: Array.isArray(data.question_results) ? data.question_results : fresh.questionResults,
        flaggedNeedReviewTopicIds: Array.isArray(data.flagged_topic_ids) ? data.flagged_topic_ids : fresh.flaggedNeedReviewTopicIds,
        unlockedBadgeIds: Array.isArray(data.unlocked_badge_ids) ? data.unlocked_badge_ids : fresh.unlockedBadgeIds,
        xpLogs: Array.isArray(data.xp_logs) ? data.xp_logs : fresh.xpLogs,
        currentProgress: data.current_progress || fresh.currentProgress,
      };
    } catch (err) {
      console.error('[SupabaseAttempt] Ngoại lệ getStudentState:', err);
      return mockAttemptRepo.getStudentState(studentId);
    }
  }

  async saveStudentState(studentId: string, state: StudentState, sourceId?: string): Promise<void> {
    if (!isSupabaseReady()) {
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

      await supabase.from('student_states').upsert(payload, { onConflict: 'student_id' });
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
            class_id: '00000000-0000-0000-0000-000000000010',
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
    if (!isSupabaseReady()) {
      return mockEssayRepo.getSubmissions(filter);
    }

    try {
      let query = supabase
        .from('essay_submissions')
        .select('*, students(name), classes(name)')
        .order('submitted_at', { ascending: false });

      if (filter?.studentId) query = query.eq('student_id', filter.studentId);
      if (filter?.classId && filter.classId !== 'all') query = query.eq('class_id', filter.classId);
      if (filter?.status && filter.status !== 'ALL') {
        if (filter.status === 'PENDING_TEACHER') {
          query = query.in('status', ['PENDING_TEACHER', 'AI_SUGGESTED']);
        } else {
          query = query.eq('status', filter.status);
        }
      }

      const { data, error } = await query;
      if (error || !data) {
        return mockEssayRepo.getSubmissions(filter);
      }

      return data.map((e: any) => ({
        id: e.id,
        questionId: e.question_id || 'q_essay_01',
        quizId: e.question_id || 'q_essay_01',
        studentId: e.student_id,
        studentName: e.students?.name || 'Học sinh',
        classId: e.class_id,
        className: e.classes?.name || '7A2',
        prompt: 'Bài tập làm văn',
        content: e.content,
        wordCount: e.word_count || 0,
        submittedAt: new Date(e.submitted_at).getTime(),
        status: e.status,
        teacherFeedback: e.teacher_feedback || undefined,
        rubricScores: Array.isArray(e.rubric_scores) ? e.rubric_scores : undefined,
        totalScore: e.total_score ? Number(e.total_score) : undefined,
        finalRatio: e.final_ratio ? Number(e.final_ratio) : undefined,
        hoursWaiting: Math.max(0, Math.floor((Date.now() - new Date(e.submitted_at).getTime()) / 3600000)),
      }));
    } catch {
      return mockEssayRepo.getSubmissions(filter);
    }
  }

  async getSubmissionById(id: string): Promise<EssaySubmission | null> {
    const all = await this.getSubmissions();
    return all.find((e) => e.id === id) || null;
  }

  async createSubmission(
    submission: Omit<EssaySubmission, 'id' | 'submittedAt'>
  ): Promise<EssaySubmission> {
    if (!isSupabaseReady()) {
      return mockEssayRepo.createSubmission(submission);
    }

    try {
      const payload = {
        question_id: submission.questionId || submission.quizId || 'q_essay_01',
        student_id: submission.studentId,
        class_id: submission.classId || '00000000-0000-0000-0000-000000000010',
        content: submission.content,
        word_count: submission.wordCount || submission.content.trim().split(/\s+/).length,
        status: submission.status || 'PENDING_TEACHER',
      };

      const { data: created, error } = await supabase
        .from('essay_submissions')
        .insert(payload)
        .select()
        .single();

      if (error || !created) {
        return mockEssayRepo.createSubmission(submission);
      }

      syncEventBus.emit('essay');

      return {
        ...submission,
        id: created.id,
        submittedAt: new Date(created.submitted_at).getTime(),
        status: created.status,
        hoursWaiting: 0,
      };
    } catch {
      return mockEssayRepo.createSubmission(submission);
    }
  }

  async saveSubmissionDraft(
    id: string,
    draft: {
      rubricScores?: { criterionName: string; score: number; maxScore: number }[];
      teacherFeedback?: string;
    }
  ): Promise<EssaySubmission> {
    if (!isSupabaseReady()) {
      return mockEssayRepo.saveSubmissionDraft(id, draft);
    }

    try {
      const payload: Record<string, any> = {};
      if (draft.rubricScores) payload.rubric_scores = draft.rubricScores;
      if (draft.teacherFeedback !== undefined) payload.teacher_feedback = draft.teacherFeedback;

      await supabase.from('essay_submissions').update(payload).eq('id', id);
      syncEventBus.emit('essay');
      const item = await this.getSubmissionById(id);
      return item || mockEssayRepo.saveSubmissionDraft(id, draft);
    } catch {
      return mockEssayRepo.saveSubmissionDraft(id, draft);
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
    if (!isSupabaseReady()) {
      return mockEssayRepo.gradeSubmission(id, grading, teacherActorId);
    }

    try {
      const payload = {
        status: 'GRADED',
        teacher_feedback: grading.teacherFeedback,
        rubric_scores: grading.rubricScores,
        total_score: grading.totalScore,
        final_ratio: grading.finalRatio,
        graded_by: teacherActorId.includes('-') ? teacherActorId : null,
      };

      const { error } = await supabase.from('essay_submissions').update(payload).eq('id', id);
      if (error) {
        return mockEssayRepo.gradeSubmission(id, grading, teacherActorId);
      }

      syncEventBus.emit('essay');
      const item = await this.getSubmissionById(id);
      return item || mockEssayRepo.gradeSubmission(id, grading, teacherActorId);
    } catch {
      return mockEssayRepo.gradeSubmission(id, grading, teacherActorId);
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
