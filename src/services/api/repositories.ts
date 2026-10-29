/**
 * Client repository GĐ3 (nhóm A) — gọi API VPS qua apiFetch.
 *
 * NGUYÊN TẮC:
 * - Implements đúng interface trong services/types.ts (UI không sửa).
 * - KHÔNG fallback lặng sang mock khi API lỗi: lỗi thì ném ApiError để
 *   UI hiện lỗi rõ (luật server-thật 26/10). Ngoại lệ duy nhất là 9
 *   method rubric/sample/config/accuracy của Essay (xem cuối file):
 *   khảo sát §1.5/§6.3 ghi dữ liệu này hiện chỉ ở local, chưa có
 *   endpoint §2 — nên giữ nguyên đường local như bản Supabase cũ, chờ
 *   tích hợp quyết có thêm endpoint hay không.
 * - Token lấy từ http.ts (Bearer tự gắn + refresh 401), KHÔNG đọc
 *   Supabase session ở đây nữa.
 * - Các method từng đi qua /api/admin/users giữ nguyên path + body
 *   (create/reset-password/rename-student), chỉ đổi nguồn token.
 * - Body tạo/cập nhật tài nguyên (classes/students/essays/...) gửi
 *   camelCase theo interface TypeScript; server tự dịch sang cột MySQL.
 *   Response đọc khoan dung cả camelCase lẫn snake_case. Đây là điểm
 *   tích hợp cần server xác nhận (xem báo cáo).
 * - KHÔNG gửi id legacy/sentinel lên server (gv001, sentinel UUID,
 *   class_7a2): class_7a2 được resolve sang lớp UUID thật qua
 *   GET /api/classes (tìm tên '7A2'); resolve không được thì báo lỗi
 *   rõ / trả rỗng, không gửi sentinel vào MySQL (khảo sát §2).
 * - get*ById: 404 → null (đúng semantics interface), không phải lỗi.
 * - Audit log + thông báo local (mam_van_announcements) giữ như bản cũ
 *   vì đó là dữ liệu local, chưa có endpoint server tương ứng.
 */
import { ApiError, apiFetch, apiPost } from './http.ts';
import type {
  AIAccuracyMetrics,
  AIGradingConfig,
  AttemptRepository,
  ClassItem,
  ClassRepository,
  CreateStudentInput,
  CreateTeacherInput,
  EnrichedRewardRequest,
  EssayRepository,
  EssaySubmission,
  GradedSampleEssay,
  RewardItem,
  RewardRepository,
  RewardRequest,
  RewardStatus,
  RubricTemplate,
  StudentAccount,
  StudentCredentialVoucher,
  StudentState,
  QuestionResult,
  StudentRepository,
  TeacherProfile,
  TeacherRepository,
} from '../types.ts';
import {
  auditRepo,
  essayRepo as mockEssayRepo,
} from '../mock/mockRepositories.ts';
import { createFreshStudentState } from '../mock/seedData.ts';
import { syncEventBus } from '../mock/eventBus.ts';
import {
  generateFriendlyPassword,
  generateStudentCode,
  generateUsername,
} from '../mock/credentialUtils.ts';

// ---------------------------------------------------------------- helpers

const LEGACY_TEACHER_IDS = new Set([
  'gv001',
  '00000000-0000-0000-0000-000000000001',
]);
const LEGACY_CLASS_ID = 'class_7a2';

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function asArray(json: any, keys: string[] = ['data', 'items', 'rows']): any[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    for (const k of keys) {
      if (Array.isArray((json as any)[k])) return (json as any)[k];
    }
  }
  return [];
}

/** Lấy entity từ response: { profile } / { student } / { data } / bản thân. */
function unwrapEntity(json: any, keys: string[] = []): any | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  for (const k of keys) {
    const v = (json as any)[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  }
  if ((json as any).id !== undefined) return json;
  return null;
}

function toMs(v: any, fallback = Date.now()): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v) {
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return fallback;
}

function toNum(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function pick(row: any, ...keys: string[]): any {
  for (const k of keys) {
    if (row?.[k] !== undefined && row?.[k] !== null) return row[k];
  }
  return undefined;
}

/** Route /api/admin/users — giữ nguyên path + body như callUsersRoute cũ,
 *  chỉ đổi nguồn token sang http.ts. Map CLASS_NOT_OWNED sang thông báo
 *  thân thiện như cũ nhưng giữ nguyên code để tầng gọi nhận diện. */
async function callUsersRoute(body: any): Promise<any> {
  try {
    return await apiPost('/api/admin/users', body);
  } catch (err: any) {
    if (
      err instanceof ApiError &&
      (err.code === 'CLASS_NOT_OWNED' || err.message === 'CLASS_NOT_OWNED')
    ) {
      throw new ApiError(
        err.status,
        'Lớp này không thuộc tài khoản đang đăng nhập — tải lại trang rồi chọn lại lớp của mình (CLASS_NOT_OWNED).',
        'CLASS_NOT_OWNED'
      );
    }
    throw err;
  }
}

/** Resolve mã lớp legacy 'class_7a2' sang UUID lớp thật (tên '7A2').
 *  Không resolve được → null (không bao giờ gửi sentinel vào MySQL). */
async function resolveLegacyClassId(): Promise<string | null> {
  try {
    const classes = await new ApiClassRepository().getClasses();
    const found = classes.find((c) => c.name === '7A2');
    return found ? found.id : null;
  } catch {
    return null;
  }
}

function isDuplicateError(err: any): boolean {
  return (
    /TAKEN|duplicate|already|23505|trùng/i.test(String(err?.message || '')) ||
    err?.code === 'CREATE_USER_FAILED' ||
    err?.code === 'CREATE_PROFILE_FAILED' ||
    err?.code === 'USERNAME_TAKEN'
  );
}

// ---------------------------------------------------------------- mapping

function toClass(row: any): ClassItem {
  const students = Array.isArray(row?.students) ? row.students : [];
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const computedActive = students.filter((s: any) => {
    if (!s?.last_active_at) return false;
    return new Date(s.last_active_at).getTime() >= sevenDaysAgo;
  }).length;
  return {
    id: row.id,
    name: row.name,
    grade: row.grade || 'Lớp 7',
    schoolYear: row.schoolYear || row.school_year || '2026-2027',
    teacherId: row.teacherId || row.teacher_id,
    description: row.description || undefined,
    studentCount: pick(row, 'studentCount', 'student_count') ?? students.length,
    active7DaysCount: pick(row, 'active7DaysCount', 'active_7_days_count') ?? computedActive,
    status: (row.status as 'active' | 'archived') || 'active',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    deleted_at: row.deleted_at ?? null,
  };
}

function toStudent(row: any): StudentAccount {
  const last = row.last_active_at ?? row.lastActiveAt;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    password_hash: row.password_hash,
    class_id: row.class_id ?? row.classId,
    student_code: row.student_code || row.studentCode || undefined,
    dob: row.dob || undefined,
    status: (row.status as 'active' | 'locked') || 'active',
    has_logged_in: Boolean(row.has_logged_in ?? row.hasLoggedIn),
    last_active_at: typeof last === 'string' ? toMs(last, 0) || null : (last ?? null),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    deleted_at: row.deleted_at ?? null,
  };
}

function toEssay(row: any): EssaySubmission {
  const questionId =
    row.questionId || row.question_id || row.quizId || row.quiz_id || 'q_essay_01';
  const content = row.content || '';
  const totalScore = toNum(pick(row, 'totalScore', 'total_score'));
  const submittedAt = toMs(pick(row, 'submittedAt', 'created_at', 'submitted_at'));
  const aiScores = row.aiSuggestion?.rubricScores || row.ai_suggested_scores;
  return {
    id: row.id,
    questionId,
    quizId: row.quizId || row.quiz_id || questionId,
    answerId: row.answerId || row.answer_id || undefined,
    studentId: row.studentId || row.student_id,
    studentName: row.studentName || row.students?.name || row.student_name || 'Học sinh',
    classId: row.classId || row.class_id,
    className: row.className || row.classes?.name || row.class_name || 'Không rõ lớp',
    promptTitle:
      row.promptTitle || row.prompt_title || row.questionPrompt || row.question_prompt || 'Bài viết tự luận',
    quizTitle: row.quizTitle || row.quiz_title || 'Bài tập làm văn',
    questionPrompt: row.questionPrompt || row.question_prompt || undefined,
    content,
    wordCount:
      pick(row, 'wordCount', 'word_count') ??
      (content.trim() ? content.trim().split(/\s+/).length : 0),
    submittedAt,
    status: row.status,
    teacherFeedback: row.teacherFeedback || row.teacher_feedback || undefined,
    rubricScores: row.rubricScores || row.rubric_scores || undefined,
    totalScore,
    finalRatio:
      pick(row, 'finalRatio', 'final_ratio') ??
      (totalScore != null ? totalScore / 10 : undefined),
    aiSuggestion: row.aiSuggestion
      ? row.aiSuggestion
      : aiScores
        ? {
            rubricScores: aiScores,
            overallComment: row.ai_suggested_feedback || '',
            suggestedTotalScore: Array.isArray(aiScores)
              ? aiScores.reduce((sum: number, c: any) => sum + (c.score || 0), 0)
              : 0,
            suggestedAt: row.created_at || '',
          }
        : undefined,
    skillLevel: row.skillLevel || row.skill_level || undefined,
    hoursWaiting:
      pick(row, 'hoursWaiting', 'hours_waiting') ??
      Math.max(0, Math.floor((Date.now() - submittedAt) / 3600000)),
    teacherDraft: row.teacherDraft || undefined,
  };
}

/** Phiếu review (answer_reviews) → EssaySubmission giả 'review:<id>' như bản cũ. */
function reviewToEssay(r: any, graded: boolean): EssaySubmission {
  const reviewId = r.reviewId || r.review_id || r.id;
  const maxScoreRaw = toNum(pick(r, 'maxScore', 'max_score'));
  const maxScore = maxScoreRaw && maxScoreRaw > 0 ? maxScoreRaw : 10;
  const awarded = toNum(pick(r, 'scoreAwarded', 'score_awarded', 'score'));
  const ratio = graded && awarded != null ? awarded / maxScore : undefined;
  const content = r.responseText || r.response_text || r.content || '';
  const submittedAt = toMs(pick(r, 'createdAt', 'created_at', 'submittedAt'));
  return {
    id: `review:${reviewId}`,
    questionId: r.questionId || r.question_id || 'q_essay_01',
    answerId: r.answerId || r.answer_id || undefined,
    quizId: r.questionId || r.question_id || 'q_essay_01',
    studentId: r.studentId || r.student_id,
    studentName: r.studentName || r.student_name || 'Học sinh',
    classId: r.classId || r.class_id || '',
    className: r.className || r.class_name || 'Không rõ lớp',
    promptTitle: r.questionPrompt || r.question_prompt || 'Bài viết tự luận',
    quizTitle: r.sourceTitle || r.source_title || 'Bài tập làm văn',
    questionPrompt: r.questionPrompt || r.question_prompt || '',
    content,
    wordCount: content.trim() ? content.trim().split(/\s+/).length : 0,
    submittedAt,
    status: graded ? 'GRADED' : 'PENDING_TEACHER',
    teacherFeedback: graded ? r.feedback || undefined : undefined,
    totalScore: ratio != null ? Math.round(ratio * 1000) / 100 : undefined,
    finalRatio: ratio,
    skillLevel: (r.level as any) || 'VAN_DUNG',
    hoursWaiting: graded ? 0 : Math.max(0, Math.floor((Date.now() - submittedAt) / 3600000)),
  };
}

function tierKeyForXp(xpReq: number): RewardItem['tierKey'] {
  return xpReq <= 300 ? 'HAT' : xpReq <= 500 ? 'LA' : xpReq <= 700 ? 'HOA' : 'VANG';
}

function toReward(row: any): RewardItem {
  const requiredXp = pick(row, 'requiredXp', 'required_xp', 'xpCost', 'xp_cost') ?? 0;
  const tierRaw = String(row.tierKey || row.tier_key || tierKeyForXp(requiredXp)).toUpperCase();
  return {
    id: row.id,
    requiredXp,
    xpCost: pick(row, 'xpCost', 'xp_cost') ?? requiredXp,
    requiredAttendanceDays: pick(row, 'requiredAttendanceDays', 'required_attendance_days') ?? 4,
    tierKey: (['HAT', 'LA', 'HOA', 'VANG'].includes(tierRaw) ? tierRaw : 'HAT') as RewardItem['tierKey'],
    teaserDescription: row.teaserDescription || row.teaser_description || 'Món quà bí mật thú vị',
    secret: row.secret || {
      name: row.secret_name || 'Món quà bí mật',
      description: row.secret_description || 'Chi tiết quà tặng dành cho học sinh chăm chỉ.',
    },
    isPhysical: row.isPhysical ?? row.is_physical ?? false,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    stock: row.stock ?? undefined,
    isActive: row.isActive ?? row.is_active ?? true,
    teacherId: row.teacherId || row.teacher_id || undefined,
  };
}

function toDbRewardStatus(s: RewardStatus): string {
  return s === 'PENDING_APPROVAL' ? 'PENDING' : s;
}

function fromDbRewardStatus(s: string): RewardStatus {
  return s === 'PENDING' ? 'PENDING_APPROVAL' : (s as RewardStatus);
}

function toRewardRequest(row: any, rewards?: RewardItem[]): EnrichedRewardRequest {
  const chest = String(row.chest_type || row.chestType || 'hat').toLowerCase();
  const tierKey = chest.toUpperCase();
  const matched =
    rewards?.find((r) => r.tierKey === tierKey) ||
    (row.reward ? toReward(row.reward) : undefined);
  const xpWeekActual = pick(row, 'xpWeekActual', 'xp_week_actual', 'xp_week_snapshot') ?? 0;
  const attendanceDaysActual = pick(row, 'attendanceDaysActual', 'attendance_days_actual') ?? 0;
  const reqXp = matched ? matched.requiredXp || matched.xpCost || 0 : 0;
  const reqDays = matched ? matched.requiredAttendanceDays || 0 : 0;
  return {
    id: row.id,
    studentId: row.studentId || row.student_id,
    studentName: row.studentName || row.students?.name || row.student_name || 'Học sinh',
    classId: row.classId || row.students?.class_id || row.class_id || undefined,
    className: row.className || row.class_name || undefined,
    rewardId: row.rewardId || row.reward_id || matched?.id || `tier_${chest}`,
    requestedAt: toMs(pick(row, 'requestedAt', 'created_at', 'requested_at')),
    status: fromDbRewardStatus(row.status),
    xpWeekActual,
    attendanceDaysActual,
    isEligible: matched ? xpWeekActual >= reqXp && attendanceDaysActual >= reqDays : false,
    reward: matched,
    deductedXp: pick(row, 'deductedXp', 'deducted_xp'),
    rejectReason: row.rejectReason || row.reject_reason || undefined,
  };
}

function toTeacher(row: any): TeacherProfile {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role === 'admin' ? 'admin' : 'teacher',
    email: row.email || undefined,
    phone: row.phone || undefined,
    school: row.school || 'THCS Giấy & Mực',
    subject: row.subject || 'Ngữ văn 7',
    classIds: row.classIds || row.class_ids || [],
    status: (row.status as any) || 'active',
    trialDays: row.trialDays ?? row.trial_days ?? undefined,
    trialExpiresAt: row.trialExpiresAt || row.trial_expires_at || undefined,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------- class

export class ApiClassRepository implements ClassRepository {
  async getClasses(teacherId?: string): Promise<ClassItem[]> {
    const params: Record<string, string | undefined> = {};
    // Id legacy không gửi lên server — để JWT scope quyết phạm vi.
    if (teacherId && !LEGACY_TEACHER_IDS.has(teacherId)) params.teacher_id = teacherId;
    const json = await apiFetch(`/api/classes${qs(params)}`);
    return asArray(json, ['classes', 'data', 'items']).map(toClass);
  }

  async getClassById(id: string): Promise<ClassItem | null> {
    try {
      const json = await apiFetch(`/api/classes/${encodeURIComponent(id)}`);
      const row = unwrapEntity(json, ['class', 'data']);
      return row ? toClass(row) : null;
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async createClass(
    data: Omit<ClassItem, 'id' | 'created_at' | 'updated_at' | 'studentCount' | 'active7DaysCount'>
  ): Promise<ClassItem> {
    const json = await apiPost('/api/classes', {
      name: data.name,
      grade: data.grade || 'Lớp 7',
      schoolYear: data.schoolYear || '2026-2027',
      teacherId: data.teacherId,
      description: data.description || null,
      status: data.status || 'active',
    });
    const row = unwrapEntity(json, ['class', 'data']);
    if (!row) throw new Error('Không tạo được lớp trên máy chủ.');
    const created = toClass(row);
    await auditRepo.log({
      actor_id: data.teacherId || 'gv001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'CREATE_CLASS',
      target_type: 'class',
      target_id: created.id,
      target_name: `Lớp ${created.name} (${created.schoolYear})`,
      details: { grade: created.grade },
    }).catch(() => {});
    syncEventBus.emit('class');
    return created;
  }

  async updateClass(id: string, data: Partial<ClassItem>): Promise<ClassItem> {
    const body: Record<string, any> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.grade !== undefined) body.grade = data.grade;
    if (data.schoolYear !== undefined) body.schoolYear = data.schoolYear;
    if (data.description !== undefined) body.description = data.description;
    if (data.status !== undefined) body.status = data.status;
    const json = await apiFetch(`/api/classes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const row = unwrapEntity(json, ['class', 'data']);
    syncEventBus.emit('class');
    if (row) {
      // Đọc lại bản đầy đủ (kèm số học sinh thật) như bản cũ.
      const fresh = await this.getClassById(id).catch(() => null);
      return fresh || toClass(row);
    }
    const fresh = await this.getClassById(id).catch(() => null);
    if (fresh) return fresh;
    throw new Error('Không cập nhật được lớp trên máy chủ.');
  }

  async archiveClass(id: string): Promise<void> {
    await apiPost(`/api/classes/${encodeURIComponent(id)}/archive`, {});
    syncEventBus.emit('class');
  }

  async deleteClass(id: string): Promise<{ deletedStudents: number }> {
    const json: any = await apiFetch(`/api/classes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    syncEventBus.emit('class');
    syncEventBus.emit('student');
    return { deletedStudents: Number(json?.deletedStudents || 0) };
  }
}

export const apiClassRepo = new ApiClassRepository();

// ---------------------------------------------------------------- student

export class ApiStudentRepository implements StudentRepository {
  async getStudents(filter?: {
    classId?: string;
    search?: string;
    status?: 'active' | 'locked' | 'all';
  }): Promise<StudentAccount[]> {
    let classId = filter?.classId;
    if (classId === 'all') classId = undefined;
    if (classId === LEGACY_CLASS_ID) {
      const resolved = await resolveLegacyClassId();
      if (!resolved) return [];
      classId = resolved;
    }
    const json = await apiFetch(
      `/api/students${qs({
        class_id: classId,
        search: filter?.search,
        status: filter?.status && filter.status !== 'all' ? filter.status : undefined,
      })}`
    );
    let result = asArray(json, ['students', 'data', 'items']).map(toStudent);
    // Lọc client như bản cũ (phòng server bỏ qua tham số search).
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
  }

  async getStudentById(id: string): Promise<StudentAccount | null> {
    const isUuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuidLike) {
      try {
        const json = await apiFetch(`/api/students/${encodeURIComponent(id)}`);
        const row = unwrapEntity(json, ['student', 'data']);
        return row ? toStudent(row) : null;
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    }
    // Id không phải UUID (bản cũ tra theo username): tìm đúng username.
    const list = await this.getStudents({ search: id });
    return list.find((s) => s.username.toLowerCase() === id.toLowerCase()) || null;
  }

  async createStudent(
    data: CreateStudentInput,
    teacherActorId: string
  ): Promise<{ student: StudentAccount; credential: StudentCredentialVoucher }> {
    const cleanName = data.name.trim();
    let generatedUsername = data.custom_username?.trim().toLowerCase() || '';
    if (!generatedUsername) {
      const existing = await this.getStudents();
      generatedUsername = generateUsername(
        cleanName,
        existing.map((s) => s.username.toLowerCase())
      );
    }
    const initialPassword = data.custom_password?.trim() || generateFriendlyPassword(8);
    let cleanClassId = data.class_id;
    if (cleanClassId === LEGACY_CLASS_ID) {
      const resolved = await resolveLegacyClassId();
      if (!resolved) {
        throw new Error(
          'Không tìm thấy lớp 7A2 tương ứng với mã lớp cũ — chọn lại lớp thật rồi tạo lại học sinh.'
        );
      }
      cleanClassId = resolved;
    }
    const existingForCode = await this.getStudents();
    const studentCode =
      data.student_code?.trim() ||
      generateStudentCode(existingForCode.map((s) => s.student_code));

    // Tạo tài khoản qua route /api/admin/users — giữ nguyên body như cũ.
    // Kiểm tra trùng cuối cùng là ở server (UNIQUE email tổng hợp): chỉ
    // retry đổi tên 1 lần khi server báo trùng, như dòng ~818-842 bản cũ.
    let created: any = null;
    try {
      const routeRes = await callUsersRoute({
        action: 'create',
        role: 'student',
        username: generatedUsername,
        password: initialPassword,
        name: cleanName,
        class_id: cleanClassId,
        student_code: studentCode,
        dob: data.dob || null,
      });
      created = routeRes?.profile || routeRes;
    } catch (routeErr: any) {
      if (isDuplicateError(routeErr)) {
        const existing = await this.getStudents();
        const retryUsername = generateUsername(
          cleanName,
          existing.map((s) => s.username.toLowerCase()).concat(generatedUsername)
        );
        const retryRes = await callUsersRoute({
          action: 'create',
          role: 'student',
          username: retryUsername,
          password: initialPassword,
          name: cleanName,
          class_id: cleanClassId,
          student_code: studentCode,
          dob: data.dob || null,
        });
        created = retryRes?.profile || retryRes;
        generatedUsername = retryUsername;
      } else {
        throw routeErr;
      }
    }
    if (!created) {
      throw new Error('Không tạo được học sinh trên máy chủ.');
    }

    // Khởi tạo dòng student_states như bản cũ (upsert ban đầu). Lỗi ở đây
    // không làm hỏng việc tạo học sinh (bản cũ cũng không kiểm tra lỗi
    // upsert này); state sẽ được tạo lười khi đọc lần đầu.
    try {
      await apiFetch(`/api/student-states/${encodeURIComponent(created.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          student_id: created.id,
          xp_today: 0,
          xp_week: 0,
          total_xp: 0,
          active_seconds_today: 0,
          consecutive_days: 1,
          topic_mastery: { topic_1: 0, topic_2: 0, topic_3: 0, topic_4: 0 },
        }),
      });
    } catch (e) {
      console.warn('[ApiStudent] Không khởi tạo được student_states (sẽ tạo lười khi đọc):', e);
    }

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
    }).catch(() => {});
    syncEventBus.emit('student');
    syncEventBus.emit('class');
    return { student, credential };
  }

  async createStudentsBatch(
    data: CreateStudentInput[],
    teacherActorId: string
  ): Promise<{ students: StudentAccount[]; credentials: StudentCredentialVoucher[]; errors: { name: string; message: string }[] }> {
    // Từng học sinh một, KHÔNG atomic — học sinh tạo trước lỗi giữa chừng
    // vẫn tồn tại. Lỗi từng dòng được thu lại vào errors (không ném giữa
    // chừng làm mất phiếu của các em đã tạo xong) để caller báo rõ: phiếu
    // cho em tạo được + danh sách em lỗi kèm lý do.
    const students: StudentAccount[] = [];
    const credentials: StudentCredentialVoucher[] = [];
    const errors: { name: string; message: string }[] = [];
    for (const item of data) {
      try {
        const res = await this.createStudent(item, teacherActorId);
        students.push(res.student);
        credentials.push(res.credential);
      } catch (e: any) {
        errors.push({ name: item.name.trim(), message: e?.message || 'đã xảy ra lỗi' });
      }
    }
    return { students, credentials, errors };
  }

  async updateStudent(
    id: string,
    data: Partial<StudentAccount>,
    teacherActorId: string
  ): Promise<StudentAccount> {
    // Đổi mật khẩu / đổi tên qua route server TRƯỚC khi ghi các trường
    // khác, để lỗi thì không lệch 2 phía (đúng thứ tự bản cũ).
    const newPassword = (data as any).password || (data as any).password_hash;
    if (newPassword !== undefined && String(newPassword).trim()) {
      await callUsersRoute({
        action: 'reset-password',
        table: 'students',
        profileId: id,
        newPassword: String(newPassword).trim(),
      });
    }
    if (data.username !== undefined) {
      const wanted = String(data.username).trim().toLowerCase();
      const current = await this.getStudentById(id);
      if (current && wanted && wanted !== current.username.toLowerCase()) {
        await callUsersRoute({ action: 'rename-student', profileId: id, newUsername: wanted });
      }
      // username đã do route đổi (hoặc giữ nguyên) — không ghi trực tiếp.
    }
    const body: Record<string, any> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.student_code !== undefined) body.student_code = data.student_code;
    if (data.dob !== undefined) body.dob = data.dob;
    if (data.class_id !== undefined) body.class_id = data.class_id;
    if (data.status !== undefined) body.status = data.status;
    const json = await apiFetch(`/api/students/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const row = unwrapEntity(json, ['student', 'data']);
    syncEventBus.emit('student');
    syncEventBus.emit('class');
    if (row) return toStudent(row);
    const fresh = await this.getStudentById(id);
    if (fresh) return fresh;
    throw new Error('Không cập nhật được học sinh trên máy chủ.');
  }

  async deleteStudent(id: string, teacherActorId: string): Promise<void> {
    await apiFetch(`/api/students/${encodeURIComponent(id)}`, { method: 'DELETE' });
    syncEventBus.emit('student');
    syncEventBus.emit('class');
  }

  async getStudentPassword(id: string): Promise<{ password: string | null; stored: boolean }> {
    const json = await apiFetch(`/api/students/${encodeURIComponent(id)}/password`);
    return { password: (json?.password ?? null) as string | null, stored: Boolean(json?.stored) };
  }

  async resetPassword(
    id: string,
    teacherActorId: string,
    customNewPassword?: string
  ): Promise<{ credential: StudentCredentialVoucher }> {
    const newPass = customNewPassword?.trim() || generateFriendlyPassword(8);
    // Qua route server, KHÔNG fallback mock: mật khẩu local không đăng
    // nhập được prod (đúng bản cũ).
    const routeRes = await callUsersRoute({
      action: 'reset-password',
      table: 'students',
      profileId: id,
      newPassword: newPass,
    });
    const updated = routeRes?.profile || routeRes;
    if (!updated) {
      throw new Error('Không reset được mật khẩu trên máy chủ.');
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
  }

  async toggleLock(id: string, isLocked: boolean, teacherActorId: string): Promise<StudentAccount> {
    return this.updateStudent(id, { status: isLocked ? 'locked' : 'active' }, teacherActorId);
  }

  async changeClass(id: string, newClassId: string, teacherActorId: string): Promise<StudentAccount> {
    return this.updateStudent(id, { class_id: newClassId }, teacherActorId);
  }
}

export const apiStudentRepo = new ApiStudentRepository();

// ---------------------------------------------------------------- attempt

function normalizeState(state: any): StudentState {
  return {
    ...state,
    completedSteps: state.completedSteps || [],
    questionResults: state.questionResults || [],
    flaggedNeedReviewTopicIds: state.flaggedNeedReviewTopicIds || [],
    essaySubmissions: state.essaySubmissions || [],
    rewardRequests: state.rewardRequests || [],
    unlockedBadgeIds: state.unlockedBadgeIds || [],
    xpLogs: state.xpLogs || [],
    attendanceHistory: state.attendanceHistory || [],
    soundEnabled: state.soundEnabled ?? true,
    animationsEnabled: state.animationsEnabled ?? true,
    fontSizePreference: state.fontSizePreference || 'normal',
  } as StudentState;
}

export class ApiAttemptRepository implements AttemptRepository {
  private async fetchAccount(studentId: string): Promise<StudentAccount | null> {
    try {
      const json = await apiFetch(`/api/students/${encodeURIComponent(studentId)}`);
      const row = unwrapEntity(json, ['student', 'data']);
      return row ? toStudent(row) : null;
    } catch {
      return null;
    }
  }

  private async fetchClassName(classId?: string): Promise<string> {
    if (!classId) return '';
    try {
      const json = await apiFetch(`/api/classes/${encodeURIComponent(classId)}`);
      const row = unwrapEntity(json, ['class', 'data']);
      const name = row?.name || '';
      return name ? (name.startsWith('Lớp') ? name : `Lớp ${name}`) : '';
    } catch {
      return '';
    }
  }

  /** State trắng từ HỒ SƠ THẬT (đúng tên + đúng lớp) khi chưa có dòng
   *  state trên server — không thừa kế tiến độ mẫu/local (luật bản cũ). */
  private async buildFreshState(studentId: string): Promise<StudentState> {
    const account = await this.fetchAccount(studentId);
    const className = account ? await this.fetchClassName(account.class_id) : '';
    const fallback: StudentAccount = account || {
      id: studentId,
      name: 'Học sinh',
      username: studentId,
      class_id: '',
      status: 'active',
      has_logged_in: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return createFreshStudentState(fallback, className);
  }

  private async rowToState(row: any, studentId: string): Promise<StudentState> {
    const account = await this.fetchAccount(studentId);
    const className = account ? await this.fetchClassName(account.class_id) : '';
    const fallback: StudentAccount = account || {
      id: studentId,
      name: 'Học sinh',
      username: studentId,
      class_id: '',
      status: 'active',
      has_logged_in: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const fresh = createFreshStudentState(fallback, className);
    return {
      ...fresh,
      profile: {
        ...fresh.profile,
        name: account ? account.name : fresh.profile.name,
        username: account ? account.username : fresh.profile.username,
        ...(className ? { grade: className } : {}),
      },
      xpToday: pick(row, 'xpToday', 'xp_today') ?? fresh.xpToday,
      xpWeek: pick(row, 'xpWeek', 'xp_week') ?? fresh.xpWeek,
      totalXp: pick(row, 'totalXp', 'total_xp') ?? fresh.totalXp,
      activeSecondsToday: pick(row, 'activeSecondsToday', 'active_seconds_today') ?? fresh.activeSecondsToday,
      lastAttendanceDate: pick(row, 'lastAttendanceDate', 'last_attendance_date') ?? fresh.lastAttendanceDate,
      attendanceDaysThisWeek:
        pick(row, 'attendanceDaysThisWeek', 'attendance_days_this_week') ?? fresh.attendanceDaysThisWeek,
      attendanceHistory: pick(row, 'attendanceHistory', 'attendance_history') || fresh.attendanceHistory,
      completedSteps: pick(row, 'completedSteps', 'completed_steps') || fresh.completedSteps,
      questionResults: pick(row, 'questionResults', 'question_results') || fresh.questionResults,
      flaggedNeedReviewTopicIds:
        pick(row, 'flaggedNeedReviewTopicIds', 'flagged_topic_ids') || fresh.flaggedNeedReviewTopicIds,
      unlockedBadgeIds: pick(row, 'unlockedBadgeIds', 'unlocked_badge_ids') || fresh.unlockedBadgeIds,
      xpLogs: pick(row, 'xpLogs', 'xp_logs') || fresh.xpLogs,
      currentProgress: pick(row, 'currentProgress', 'current_progress') || fresh.currentProgress,
      consecutiveWeeks: pick(row, 'consecutiveWeeks', 'consecutive_days') ?? fresh.consecutiveWeeks,
    } as StudentState;
  }

  async getStudentState(studentId: string): Promise<StudentState> {
    let raw: any;
    try {
      raw = await apiFetch(`/api/student-states/${encodeURIComponent(studentId)}`);
    } catch (err: any) {
      // Chưa có dòng state (học sinh mới): bắt đầu TRẮNG với hồ sơ thật.
      if (err instanceof ApiError && err.status === 404) return this.buildFreshState(studentId);
      throw err;
    }
    const state = raw?.state ?? raw;
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return this.buildFreshState(studentId);
    }
    // Server trả full StudentState (camelCase) thì dùng thẳng (chuẩn hóa
    // các mảng thiếu). Server trả dòng DB (snake_case) thì map như bản cũ.
    if (state.profile || state.xpToday !== undefined || state.totalXp !== undefined) {
      return normalizeState(state);
    }
    if (state.student_id || state.studentId) {
      return this.rowToState(state, studentId);
    }
    return this.buildFreshState(studentId);
  }

  async saveStudentState(studentId: string, state: StudentState, sourceId?: string): Promise<void> {
    await apiFetch(`/api/student-states/${encodeURIComponent(studentId)}`, {
      method: 'PUT',
      body: JSON.stringify(state),
    });
    syncEventBus.emit('state', { studentId }, sourceId);
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
    // §2.4 chỉ định nghĩa GET /api/student-states/:studentId; endpoint
    // list dưới đây là giả định cần server xác nhận. Nếu server chưa có
    // list (404/405) thì ghép từ danh sách học sinh + từng state — vẫn
    // là dữ liệu server, không phải mock.
    try {
      const json = await apiFetch('/api/student-states');
      const map: Record<string, StudentState> = {};
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        const arr = asArray(json, ['states', 'data', 'items']);
        if (arr.length) {
          for (const row of arr) {
            const sid = row.studentId || row.student_id || row.profile?.id;
            if (!sid) continue;
            map[sid] =
              row.profile || row.xpToday !== undefined
                ? normalizeState(row)
                : await this.rowToState(row, sid);
          }
          return map;
        }
        for (const [sid, row] of Object.entries(json)) {
          if (!row || typeof row !== 'object') continue;
          const r: any = row;
          map[sid] =
            r.profile || r.xpToday !== undefined ? normalizeState(r) : await this.rowToState(r, sid);
        }
        return map;
      }
      return map;
    } catch (err: any) {
      if (!(err instanceof ApiError && (err.status === 404 || err.status === 405))) throw err;
      const students = await new ApiStudentRepository().getStudents();
      const entries = await Promise.allSettled(
        students.map(async (s) => [s.id, await this.getStudentState(s.id)] as const)
      );
      const map: Record<string, StudentState> = {};
      for (const e of entries) {
        if (e.status === 'fulfilled') map[e.value[0]] = e.value[1];
      }
      return map;
    }
  }
}

export const apiAttemptRepo = new ApiAttemptRepository();

// ---------------------------------------------------------------- essay

function readReviewDrafts(): Record<string, any> {
  try {
    if (typeof window === 'undefined') return {};
    return JSON.parse(localStorage.getItem('mam_van_review_drafts') || '{}');
  } catch {
    return {};
  }
}

function writeReviewDrafts(store: Record<string, any>): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mam_van_review_drafts', JSON.stringify(store));
  } catch {
    /* bỏ qua */
  }
}

async function logGradeAuditAndAnnouncement(
  teacherActorId: string,
  targetId: string,
  studentId: string | undefined,
  totalScore: number
): Promise<void> {
  try {
    await auditRepo.log({
      actor_id: teacherActorId,
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'GRADE_ESSAY',
      target_type: 'essay',
      target_id: targetId,
      target_name: `Bài viết của ${studentId}`,
      details: { totalScore },
    });
    if (studentId && typeof window !== 'undefined') {
      const annos = JSON.parse(localStorage.getItem('mam_van_announcements') || '[]');
      annos.unshift({
        id: 'anno_' + Date.now(),
        title: 'Bài viết đã được chấm',
        content: `Thầy/cô đã chấm bài viết của em. Điểm: ${totalScore}/10. Hãy xem nhận xét chi tiết nhé!`,
        type: 'essay_graded',
        targetClassIds: ['all'],
        studentId,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem('mam_van_announcements', JSON.stringify(annos));
    }
  } catch (e) {
    console.warn('[ApiEssay] Lỗi ghi audit/thông báo sau chấm:', e);
  }
}

export class ApiEssayRepository implements EssayRepository {
  async getSubmissions(filter?: {
    classId?: string;
    status?: 'PENDING_TEACHER' | 'AI_SUGGESTED' | 'GRADED' | 'ALL';
    studentId?: string;
    quizId?: string;
    includeReviews?: boolean;
    includeReviewText?: boolean;
  }): Promise<EssaySubmission[]> {
    let classId = filter?.classId;
    if (classId === 'all') classId = undefined;
    if (classId === LEGACY_CLASS_ID) {
      const resolved = await resolveLegacyClassId();
      if (!resolved) return [];
      classId = resolved;
    }
    const json = await apiFetch(
      `/api/essays${qs({
        class_id: classId,
        student_id: filter?.studentId,
        status: filter?.status && filter.status !== 'ALL' ? filter.status : undefined,
      })}`
    );
    let merged: EssaySubmission[] = asArray(json, ['essays', 'submissions', 'data', 'items']).map(
      toEssay
    );

    // Gộp phiếu chấm answer_reviews (như bản cũ) trừ khi caller tắt
    // (màn chấm tải 2 giai đoạn: includeReviews:false → chỉ bài nộp).
    if (filter?.includeReviews !== false) {
      const wantPending = filter?.status !== 'GRADED';
      const wantGraded =
        filter?.status !== 'PENDING_TEACHER' && filter?.status !== 'AI_SUGGESTED';
      const reviewParams = qs({
        class_id: classId,
        student_id: filter?.studentId,
        include_review_text: filter?.includeReviewText === false ? false : undefined,
      });
      const reviewRows: { row: any; graded: boolean }[] = [];
      if (wantPending) {
        try {
          const r = await apiFetch(`/api/reviews/pending${reviewParams}`);
          asArray(r, ['reviews', 'data', 'items']).forEach((row) =>
            reviewRows.push({ row, graded: false })
          );
        } catch (e) {
          // Gộp phiếu lỗi thì bỏ qua khối gộp (như bản cũ) — danh sách
          // bài nộp essay vẫn hiện, không rơi sang mock.
          console.warn('[ApiEssay] Bỏ qua gộp phiếu chấm chờ vào hàng đợi:', e);
        }
      }
      if (wantGraded) {
        try {
          const r = await apiFetch(`/api/reviews/graded${reviewParams}`);
          asArray(r, ['reviews', 'data', 'items']).forEach((row) =>
            reviewRows.push({ row, graded: true })
          );
        } catch (e) {
          console.warn('[ApiEssay] Bỏ qua gộp phiếu chấm đã chấm vào hàng đợi:', e);
        }
      }
      if (reviewRows.length) {
        // Phiếu thiếu classId mà caller lọc theo lớp: resolve lớp qua hồ
        // sơ học sinh (best-effort, lỗi thì bỏ phiếu đó khỏi bộ lọc).
        const needClass = classId && reviewRows.some(({ row }) => !row.classId && !row.class_id);
        const classByStudent = new Map<string, string>();
        if (needClass) {
          const students = await new ApiStudentRepository().getStudents().catch(() => []);
          students.forEach((s) => classByStudent.set(s.id, s.class_id));
        }
        for (const { row, graded } of reviewRows) {
          const essay = reviewToEssay(row, graded);
          if (!essay.classId && classByStudent.has(essay.studentId)) {
            essay.classId = classByStudent.get(essay.studentId) as string;
          }
          if (classId && essay.classId !== classId) continue;
          essay.teacherDraft = readReviewDrafts()[essay.id];
          merged.push(essay);
        }
        merged.sort((a, b) => b.submittedAt - a.submittedAt);
      }
    }

    // Lọc trạng thái ở client (phòng server chưa map PENDING_TEACHER →
    // PENDING_TEACHER + AI_SUGGESTED như bản cũ) và lọc quizId sau hợp
    // nhất (quizId suy từ question_id nên lọc sau như bản cũ).
    if (filter?.status && filter.status !== 'ALL') {
      if (filter.status === 'PENDING_TEACHER') {
        merged = merged.filter(
          (e) => e.status === 'PENDING_TEACHER' || e.status === 'AI_SUGGESTED'
        );
      } else {
        merged = merged.filter((e) => e.status === filter.status);
      }
    }
    if (filter?.quizId) {
      merged = merged.filter(
        (e) => e.quizId === filter.quizId || e.questionId === filter.quizId
      );
    }

    // Khử trùng như bản cũ: cùng học sinh + câu hỏi + nội dung + phút
    // nộp chỉ giữ một bản (phiếu list hoãn tải text thì vân tay rơi về id).
    const seen = new Set<string>();
    merged = merged.filter((sub) => {
      const contentKey = (sub.content || '').trim().slice(0, 120) || sub.id;
      const fingerprint = `${sub.studentId}|${sub.questionId}|${contentKey}|${Math.round(
        (sub.submittedAt || 0) / 60000
      )}`;
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
    return merged;
  }

  async getSubmissionById(id: string): Promise<EssaySubmission | null> {
    if (id.startsWith('review:')) {
      const all = await this.getSubmissions();
      return all.find((e) => e.id === id) || null;
    }
    try {
      const json = await apiFetch(`/api/essays/${encodeURIComponent(id)}`);
      const row = unwrapEntity(json, ['essay', 'submission', 'data']);
      return row ? toEssay(row) : null;
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async getReviewAnswerContent(answerId: string): Promise<string> {
    if (!answerId) return '';
    const json: any = await apiFetch(`/api/reviews/${encodeURIComponent(answerId)}`);
    if (typeof json === 'string') return json;
    const row = unwrapEntity(json, ['review', 'answer', 'data']) || json;
    if (typeof row?.responseText === 'string') return row.responseText;
    if (typeof row?.response_text === 'string') return row.response_text;
    if (typeof row?.content === 'string') return row.content;
    if (typeof row?.text === 'string') return row.text;
    if (typeof row?.response_json === 'string') return row.response_json;
    if (row?.response_json && typeof row.response_json === 'object') {
      return row.response_json.text || '';
    }
    return '';
  }

  async createSubmission(
    submission: Omit<EssaySubmission, 'id' | 'submittedAt'>
  ): Promise<EssaySubmission> {
    if (!submission.content || submission.content.trim().length === 0) {
      throw new Error('Nội dung bài viết không được để trống.');
    }
    // KHÔNG suy đoán chủ bài viết: studentId gửi thẳng lên server, server
    // phải từ chối nếu không xác định được học sinh (đúng luật bản cũ).
    const json = await apiPost('/api/essays', {
      questionId: submission.questionId,
      quizId: submission.quizId,
      studentId: submission.studentId,
      studentName: submission.studentName,
      classId: submission.classId,
      className: submission.className,
      content: submission.content.trim(),
      wordCount: submission.wordCount || submission.content.trim().split(/\s+/).length,
      status: submission.status || 'PENDING_TEACHER',
      rubricScores: submission.rubricScores,
      aiSuggestion: submission.aiSuggestion,
    });
    const row = unwrapEntity(json, ['essay', 'submission', 'data']);
    if (!row) throw new Error('Không gửi được bài tự luận lên máy chủ.');
    syncEventBus.emit('essay');
    return toEssay(row);
  }

  async saveSubmissionDraft(
    id: string,
    draft: {
      rubricScores?: { criterionName: string; score: number; maxScore: number }[];
      teacherFeedback?: string;
    }
  ): Promise<EssaySubmission> {
    // Phiếu gộp: nháp chấm lưu ở bộ nhớ máy theo đúng id phiếu (phiếu
    // không có cột nháp riêng trên DB) — giữ nguyên hành vi bản cũ.
    if (id.startsWith('review:')) {
      const store = readReviewDrafts();
      store[id] = draft;
      writeReviewDrafts(store);
      const item = await this.getSubmissionById(id);
      if (item) return { ...item, teacherDraft: draft };
      throw new Error('Không tìm thấy bài viết');
    }
    const json = await apiFetch(`/api/essays/${encodeURIComponent(id)}/draft`, {
      method: 'PATCH',
      body: JSON.stringify({
        rubricScores: draft.rubricScores,
        teacherFeedback: draft.teacherFeedback,
      }),
    });
    const row = unwrapEntity(json, ['essay', 'submission', 'data']);
    syncEventBus.emit('essay');
    if (row) return toEssay(row);
    const item = await this.getSubmissionById(id);
    if (item) return item;
    throw new Error('Không tìm thấy bài viết');
  }

  async attachAiSuggestion(
    id: string,
    suggestion: NonNullable<EssaySubmission['aiSuggestion']>
  ): Promise<EssaySubmission> {
    if (id.startsWith('review:')) {
      throw new Error('Phiếu chấm từ bài tập không gắn gợi ý AI theo đường này.');
    }
    const json = await apiFetch(`/api/essays/${encodeURIComponent(id)}/ai-suggestion`, {
      method: 'POST',
      body: JSON.stringify({ aiSuggestion: suggestion }),
    });
    const row = unwrapEntity(json, ['essay', 'submission', 'data']);
    syncEventBus.emit('essay');
    if (row) return toEssay(row);
    const item = await this.getSubmissionById(id);
    if (item) return item;
    throw new Error('Không tìm thấy bài viết');
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
    // Chấm phiếu gộp: ghi điểm về đúng phiếu answer_reviews qua endpoint
    // review (server cập nhật answer_reviews + attempt_answers + attempts
    // + student_states trong 1 transaction theo khảo sát §2.4 — client
    // KHÔNG tự vá student_states như bản cũ để tránh tính trùng mastery).
    if (id.startsWith('review:')) {
      const item = await this.getSubmissionById(id);
      const answerId = item?.answerId;
      if (!answerId) throw new Error('Không tìm thấy câu trả lời gắn với phiếu chấm.');
      await apiPost(`/api/reviews/${encodeURIComponent(answerId)}/grade`, {
        teacherFeedback: grading.teacherFeedback,
        rubricScores: grading.rubricScores,
        totalScore: grading.totalScore,
        finalRatio: grading.finalRatio,
        ai_vs_teacher_diff: grading.ai_vs_teacher_diff,
        teacherActorId,
      });
      const store = readReviewDrafts();
      if (store[id]) {
        delete store[id];
        writeReviewDrafts(store);
      }
      await logGradeAuditAndAnnouncement(
        teacherActorId,
        id,
        item?.studentId,
        grading.totalScore
      );
      syncEventBus.emit('essay');
      const refreshed = await this.getSubmissionById(id);
      if (refreshed) return refreshed;
      throw new Error('Đã chốt điểm nhưng không tải lại được bài.');
    }

    const json = await apiPost(`/api/essays/${encodeURIComponent(id)}/grade`, {
      teacherFeedback: grading.teacherFeedback,
      rubricScores: grading.rubricScores,
      totalScore: grading.totalScore,
      finalRatio: grading.finalRatio,
      ai_vs_teacher_diff: grading.ai_vs_teacher_diff,
      teacherActorId,
    });
    const row = unwrapEntity(json, ['essay', 'submission', 'data']);
    const studentId = row?.studentId || row?.student_id;
    await logGradeAuditAndAnnouncement(teacherActorId, id, studentId, grading.totalScore);
    syncEventBus.emit('essay');
    if (row) return toEssay(row);
    const refreshed = await this.getSubmissionById(id);
    if (refreshed) return refreshed;
    throw new Error('Đã chốt điểm nhưng không tải lại được bài.');
  }

  // --- Huấn luyện & cấu hình AI: dữ liệu chỉ ở local (khảo sát §1.5/§6.3),
  // chưa có endpoint §2 — giữ nguyên đường local như bản Supabase cũ.
  // Đây KHÔNG phải fallback khi API lỗi mà là nguồn chính của nhóm này.
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
  getAIAccuracyMetrics(): Promise<AIAccuracyMetrics | null> {
    return mockEssayRepo.getAIAccuracyMetrics();
  }
}

export const apiEssayRepo = new ApiEssayRepository();

// ---------------------------------------------------------------- reward

export class ApiRewardRepository implements RewardRepository {
  async getRewards(): Promise<RewardItem[]> {
    const json = await apiFetch('/api/rewards');
    return asArray(json, ['rewards', 'tiers', 'data', 'items']).map(toReward);
  }

  async saveReward(reward: Partial<RewardItem>): Promise<RewardItem> {
    let saved: RewardItem;
    if (reward.id) {
      // PATCH: server merge với dòng hiện có (đúng ngữ nghĩa gộp cur +
      // reward của bản cũ), client chỉ gửi trường được truyền.
      const body: Record<string, any> = {};
      if (reward.requiredXp !== undefined) body.requiredXp = reward.requiredXp;
      if (reward.xpCost !== undefined) body.xpCost = reward.xpCost;
      if (reward.requiredAttendanceDays !== undefined) {
        body.requiredAttendanceDays = reward.requiredAttendanceDays;
      }
      if (reward.tierKey !== undefined) body.tierKey = reward.tierKey;
      if (reward.teaserDescription !== undefined) body.teaserDescription = reward.teaserDescription;
      if (reward.secret !== undefined) body.secret = reward.secret;
      if (reward.isPhysical !== undefined) body.isPhysical = reward.isPhysical;
      if (reward.name !== undefined) body.name = reward.name;
      if (reward.description !== undefined) body.description = reward.description;
      if (reward.stock !== undefined) body.stock = reward.stock;
      if (reward.isActive !== undefined) body.isActive = reward.isActive;
      if (reward.teacherId !== undefined) body.teacherId = reward.teacherId;
      const json = await apiFetch(`/api/rewards/${encodeURIComponent(reward.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const row = unwrapEntity(json, ['reward', 'tier', 'data']);
      if (row) saved = toReward(row);
      else {
        const all = await this.getRewards();
        const found = all.find((r) => r.id === reward.id);
        if (!found) throw new Error('Không lưu được mốc quà trên máy chủ.');
        saved = found;
      }
    } else {
      // POST: áp default hiển thị như khảo sát §5 (server cũng phải tự
      // gán khi thiếu — client gán trước để UI thấy đúng ngay).
      const xpReq = reward.requiredXp ?? 300;
      const json = await apiPost('/api/rewards', {
        requiredXp: xpReq,
        xpCost: xpReq,
        requiredAttendanceDays: reward.requiredAttendanceDays ?? 4,
        tierKey: reward.tierKey || tierKeyForXp(xpReq),
        teaserDescription: reward.teaserDescription || 'Món quà bí mật thú vị',
        secret: reward.secret || {
          name: 'Món quà bí mật',
          description: 'Chi tiết quà tặng dành cho học sinh chăm chỉ.',
        },
        isPhysical: reward.isPhysical ?? false,
        name: reward.name ?? null,
        description: reward.description ?? null,
        stock: reward.stock ?? null,
        isActive: reward.isActive ?? true,
        teacherId: reward.teacherId ?? null,
      });
      const row = unwrapEntity(json, ['reward', 'tier', 'data']);
      if (!row) throw new Error('Không lưu được mốc quà trên máy chủ.');
      saved = toReward(row);
    }
    await auditRepo.log({
      actor_id: 'teacher_001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: reward.id ? 'UPDATE_REWARD_MILESTONE' : 'CREATE_REWARD_MILESTONE',
      target_type: 'reward',
      target_id: saved.id,
      target_name: `Mốc quà: ${saved.teaserDescription.slice(0, 30)}...`,
      details: { requiredXp: saved.requiredXp, requiredAttendanceDays: saved.requiredAttendanceDays },
    }).catch(() => {});
    syncEventBus.emit('reward');
    return saved;
  }

  async deleteReward(id: string): Promise<void> {
    await apiFetch(`/api/rewards/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await auditRepo.log({
      actor_id: 'teacher_001',
      actor_name: 'Thầy/Cô',
      actor_role: 'teacher',
      action: 'DELETE_REWARD_MILESTONE',
      target_type: 'reward',
      target_id: id,
      target_name: id,
    }).catch(() => {});
    syncEventBus.emit('reward');
  }

  async getRequests(filter?: {
    classId?: string;
    studentId?: string;
    status?: RewardStatus;
  }): Promise<EnrichedRewardRequest[]> {
    let classId = filter?.classId;
    if (classId === 'all') classId = undefined;
    if (classId === LEGACY_CLASS_ID) {
      const resolved = await resolveLegacyClassId();
      if (!resolved) return [];
      classId = resolved;
    }
    const json = await apiFetch(
      `/api/reward-requests${qs({
        class_id: classId,
        student_id: filter?.studentId,
        status: filter?.status ? toDbRewardStatus(filter.status) : undefined,
      })}`
    );
    const rewards = await this.getRewards().catch(() => []);
    let enriched = asArray(json, ['requests', 'data', 'items']).map((row) =>
      toRewardRequest(row, rewards)
    );
    // Lọc lớp ở client (phòng server bỏ qua tham số) như bản cũ.
    if (classId) enriched = enriched.filter((r) => r.classId === classId);
    return enriched;
  }

  async createRequest(studentId: string, rewardId: string): Promise<RewardRequest> {
    // Server sở hữu kiểm tra số dư + trừ TỔNG XP (bản cũ client tự trừ
    // qua saveStudentState — API không làm vậy để tránh trừ trùng khi
    // server cũng trừ; server phải báo lỗi rõ khi thiếu XP và ghi số đã
    // trừ để hoàn khi bị từ chối — xem báo cáo tích hợp).
    const json = await apiPost('/api/reward-requests', { studentId, rewardId });
    const row = unwrapEntity(json, ['request', 'data']);
    if (!row) throw new Error('Không tạo được yêu cầu đổi quà trên máy chủ.');
    syncEventBus.emit('reward');
    const enriched = toRewardRequest(row, []);
    return {
      id: enriched.id,
      rewardId,
      requestedAt: enriched.requestedAt,
      status: enriched.status,
      deductedXp: enriched.deductedXp,
    };
  }

  async updateRequestStatus(
    requestId: string,
    status: RewardStatus,
    reason?: string,
    teacherActorId?: string
  ): Promise<RewardRequest> {
    // Đọc trước để trả đúng rewardId/thời điểm như bản cũ (best-effort).
    let existing: EnrichedRewardRequest | undefined;
    try {
      const all = await this.getRequests();
      existing = all.find((r) => r.id === requestId);
    } catch {
      /* bỏ qua: vẫn cập nhật, rewardId fallback bên dưới */
    }
    const json = await apiFetch(`/api/reward-requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: toDbRewardStatus(status), reason }),
    });
    const row = unwrapEntity(json, ['request', 'data']);
    // HOÀN XP khi bị từ chối: server sở hữu (dựa trên deductedXp đã ghi
    // lúc tạo) — client KHÔNG tự vá student_states như bản cũ.
    syncEventBus.emit('reward');
    if (row) {
      const mapped = toRewardRequest(row, []);
      return {
        id: requestId,
        rewardId: mapped.rewardId || existing?.rewardId || '',
        requestedAt: mapped.requestedAt || existing?.requestedAt || Date.now(),
        status,
        rejectReason: reason,
        deductedXp: mapped.deductedXp,
      };
    }
    return {
      id: requestId,
      rewardId: existing?.rewardId || '',
      requestedAt: existing?.requestedAt || Date.now(),
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
    await apiPost('/api/reward-requests/batch', {
      requestIds,
      status: toDbRewardStatus(status),
      reason,
    });
    // HOÀN XP khi bị từ chối: server sở hữu cho cả batch (xem trên).
    syncEventBus.emit('reward');
  }
}

export const apiRewardRepo = new ApiRewardRepository();

// ---------------------------------------------------------------- teacher

export class ApiTeacherRepository implements TeacherRepository {
  async getTeachers(): Promise<TeacherProfile[]> {
    const json = await apiFetch('/api/teachers');
    return asArray(json, ['teachers', 'data', 'items']).map(toTeacher);
  }

  async getTeacherById(id: string): Promise<TeacherProfile | null> {
    try {
      const json = await apiFetch(`/api/teachers/${encodeURIComponent(id)}`);
      const row = unwrapEntity(json, ['teacher', 'data']);
      return row ? toTeacher(row) : null;
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async createTeacher(data: CreateTeacherInput): Promise<TeacherProfile> {
    // Form tạo nhanh có thể không nhập username → tự sinh từ họ tên như
    // bản cũ, tránh insert username NULL.
    let username = data.username?.trim();
    if (!username) {
      const existing = await this.getTeachers().catch(() => []);
      username = generateUsername(
        data.name,
        existing.map((t) => t.username.toLowerCase())
      );
    }
    const trialDays = data.trialDays || 3;
    const trialExpiresAt =
      data.status === 'trial'
        ? new Date(Date.now() + trialDays * 86400000).toISOString()
        : null;
    // Tạo giáo viên qua route server — giữ nguyên body như bản cũ (tạo
    // luôn tài khoản auth, không ghi password_hash).
    const routeRes = await callUsersRoute({
      action: 'create',
      role: 'teacher',
      username,
      password: data.password || '123456',
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      school: data.school || 'THCS Giấy & Mực',
      subject: data.subject || 'Ngữ văn 7',
      status: data.status || 'active',
      trial_expires_at: trialExpiresAt,
    });
    const created = routeRes?.profile || routeRes;
    if (!created) {
      throw new Error('Không tạo được giáo viên trên máy chủ.');
    }
    syncEventBus.emit('teacher');
    return toTeacher(created);
  }

  async updateTeacher(id: string, data: Partial<TeacherProfile>): Promise<TeacherProfile> {
    // Đổi mật khẩu qua route server (admin hoặc chính giáo viên đó) —
    // route kiểm tra phạm vi như bản cũ.
    if (data.password) {
      await callUsersRoute({
        action: 'reset-password',
        table: 'teachers',
        profileId: id,
        newPassword: data.password,
      });
    }
    const body: Record<string, any> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.email !== undefined) body.email = data.email;
    if (data.phone !== undefined) body.phone = data.phone;
    if (data.school !== undefined) body.school = data.school;
    if (data.subject !== undefined) body.subject = data.subject;
    if (data.status !== undefined) body.status = data.status;
    if (data.trialExpiresAt !== undefined) body.trialExpiresAt = data.trialExpiresAt;
    if (data.notes !== undefined) body.notes = data.notes;
    const json = await apiFetch(`/api/teachers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const row = unwrapEntity(json, ['teacher', 'data']);
    syncEventBus.emit('teacher');
    if (row) return toTeacher(row);
    const fresh = await this.getTeacherById(id);
    if (fresh) return fresh;
    throw new Error('Không cập nhật được giáo viên trên máy chủ.');
  }

  async deleteTeacher(id: string): Promise<void> {
    await apiFetch(`/api/teachers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    syncEventBus.emit('teacher');
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

export const apiTeacherRepo = new ApiTeacherRepository();
