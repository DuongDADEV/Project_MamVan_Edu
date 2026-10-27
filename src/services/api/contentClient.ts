/**
 * Repository nội dung + quiz qua API VPS (GĐ3) — thay SupabaseContentRepository
 * / SupabaseQuizRepository (payloadStore + supabase.from trực tiếp).
 *
 * Luật giữ nguyên từ đợt 3 (26/10, luật server-thắng):
 * - Đọc (get*): gọi GET /api/...; server trả rows thì GHI ĐÈ toàn bộ cache
 *   localStorage (không gộp item chỉ có ở local, không đẩy item local-only
 *   lên trong đường đọc). Lỗi API → ném ApiError, KHÔNG fallback lặng sang
 *   mock/cache cũ.
 * - Ghi: chỉ ở đường tường minh (save/delete/publish/unpublish/archive/
 *   duplicate/reorder) qua POST/PATCH/DELETE tương ứng.
 * - Xóa nội dung là SOFT-delete qua API (đặt deleted_at), không hard-delete.
 * - Tạo mới không kèm status → gửi 'draft' (API cũng tự gán draft theo
 *   khảo sát §5; client gửi rõ để khớp interface cũ yêu cầu status).
 * - KHÔNG bao giờ gửi id sentinel/legacy ('gv001', sentinel UUID) lên server:
 *   item mang id đó thì bỏ khỏi hàng đợi đẩy, ghi deniedPushKeys (như code
 *   cũ) để không spam lỗi; save/publish của item đó ném lỗi rõ thay vì tự
 *   map sang id khác. teacher_id không gửi lên — server suy từ JWT.
 * - Cache localStorage GIỮ NGUYÊN key cũ (mam_van_topics/videos/theories/
 *   quizzes) vì mockRepositories + eventBus còn đọc trực tiếp các key này.
 * - Publish topic KHÔNG tự publish con. Publish quiz TỰ publish topic cha
 *   (nếu cha chưa published) với cùng classIds — giữ hành vi cũ.
 *   Publish video/lý thuyết chỉ gọi endpoint của chính item đó; server
 *   GĐ3 tự mirror publish topic cha (theo route server), nên client không
 *   cần gọi thêm.
 */
import { apiFetch, ApiError } from './http.ts';
import type {
  ContentRepository,
  QuizRepository,
  TopicWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  QuizWithMeta,
  QuestionWithMeta,
} from '../types.ts';

const TOPIC_CACHE_KEY = 'mam_van_topics';
const VIDEO_CACHE_KEY = 'mam_van_videos';
const THEORY_CACHE_KEY = 'mam_van_theories';
const QUIZ_CACHE_KEY = 'mam_van_quizzes';

/** Id legacy không bao giờ được gửi lên server (khảo sát §1.4, §2). */
const LEGACY_TEACHER_ID_MAP: Record<string, string> = {
  gv001: '00000000-0000-0000-0000-000000000001',
};
const SENTINEL_UUID = '00000000-0000-0000-0000-000000000001';
const LEGACY_IDS = new Set<string>(['gv001', SENTINEL_UUID]);

function isLegacyId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  if (LEGACY_IDS.has(id)) return true;
  return id in LEGACY_TEACHER_ID_MAP;
}

/** Khóa đã bị chặn đẩy trong phiên này — lần sau bỏ qua luôn, không thử
 *  API nữa (chặn spam lỗi; reload trang sẽ thử lại). */
const deniedPushKeys = new Set<string>();
const warnedPushKeys = new Set<string>();

export function isPushDenied(key: string): boolean {
  return deniedPushKeys.has(key);
}

/** Ghi nhận 1 khóa bị chặn; trả true nếu đây là lần đầu (để log 1 lần). */
export function markPushDenied(key: string): boolean {
  const first = !warnedPushKeys.has(key);
  deniedPushKeys.add(key);
  warnedPushKeys.add(key);
  return first;
}

function readLocalList<T>(storageKey: string): T[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(storageKey: string, list: T[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(list));
    }
  } catch (e) {
    console.warn(`[ApiContent] Không ghi được bộ nhớ đệm ${storageKey}:`, e);
  }
}

function upsertLocal<T extends { id: string }>(storageKey: string, item: T): void {
  const list = readLocalList<T>(storageKey);
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  writeLocalList(storageKey, list);
}

function markDeletedLocal<T extends { id: string }>(storageKey: string, id: string): void {
  const list = readLocalList<T>(storageKey);
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) {
    (list[idx] as any).deleted_at = new Date().toISOString();
    writeLocalList(storageKey, list);
  }
}

/** Bóc envelope { data | rows | items } hoặc giữ nguyên mảng/object. */
function unwrap(data: any): any {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray((data as any).data)) return (data as any).data;
    if (Array.isArray((data as any).rows)) return (data as any).rows;
    if (Array.isArray((data as any).items)) return (data as any).items;
    if ((data as any).data && typeof (data as any).data === 'object') return (data as any).data;
  }
  return data;
}

function unwrapList(data: any): any[] {
  const v = unwrap(data);
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.values(v);
  return [];
}

/**
 * Chuẩn hóa 1 row server về shape app: server có thể trả flat object hoặc
 * row payload ({ id, status, topic_id, payload, teacher_id, deleted_at }).
 * Row thắng payload ở các trường định danh/trạng thái (như syncPayloadCollection cũ).
 */
function normalizeRow<T>(row: any): T {
  if (!row || typeof row !== 'object') return row as T;
  const p = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const out: any = {
    ...p,
    ...row,
    payload: undefined,
  };
  delete out.payload;
  out.id = row.id ?? p.id;
  if (row.status !== undefined) out.status = row.status;
  else if (p.status !== undefined) out.status = p.status;
  out.topicId = p.topicId ?? row.topic_id ?? row.topicId;
  if (row.topic_id === undefined && p.topicId === undefined) delete out.topicId;
  out.teacher_id = p.teacher_id ?? row.teacher_id;
  if (out.teacher_id === undefined) delete out.teacher_id;
  out.deleted_at = row.deleted_at ?? p.deleted_at ?? null;
  out.created_at = p.created_at ?? row.created_at;
  out.updated_at = p.updated_at ?? row.updated_at;
  // Dọn key snake_case trùng lặp, giữ shape app (camelCase) làm chuẩn.
  delete out.topic_id;
  return out as T;
}

/** Lọc theo trạng thái xóa / xuất bản / lớp (giống filterContentItems cũ). */
function filterItems<T extends { deleted_at?: string | null; status?: string; class_ids?: string[] }>(
  list: T[],
  classId: string | undefined,
  onlyPublished: boolean
): T[] {
  let out = list.filter((x) => !x.deleted_at);
  if (onlyPublished) out = out.filter((x) => x.status === 'published');
  if (classId && classId !== 'all') {
    out = out.filter((x) => {
      const ids = Array.isArray(x.class_ids) ? x.class_ids : ['all'];
      return ids.includes('all') || ids.includes(classId);
    });
  }
  return out;
}

function isNotFound(err: unknown): boolean {
  return (
    (err instanceof ApiError && err.status === 404) ||
    (typeof err === 'object' && err !== null && (err as any).status === 404)
  );
}

/** Đọc 1 collection từ API và GHI ĐÈ cache (server-thắng, không gộp local). */
async function fetchCollection<T extends { id: string }>(
  path: string,
  cacheKey: string
): Promise<T[]> {
  const rows = unwrapList(await apiFetch(path));
  const list = rows.map((r) => normalizeRow<T>(r));
  writeLocalList(cacheKey, list);
  return list;
}

async function fetchOne<T>(path: string): Promise<T | null> {
  try {
    const data = await apiFetch(path);
    const row = unwrap(data);
    if (!row || (typeof row === 'object' && !row.id && Object.keys(row).length === 0)) return null;
    return normalizeRow<T>(row);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/**
 * Body gửi lên server: bỏ teacher_id (server suy từ JWT), bỏ các trường
 * undefined. Tạo mới (không id) mà thiếu status → 'draft'.
 */
function toBody(item: Record<string, any>, isCreate: boolean): Record<string, any> {
  const body: Record<string, any> = {};
  for (const [k, v] of Object.entries(item)) {
    if (k === 'teacher_id') continue;
    if (v !== undefined) body[k] = v;
  }
  if (isCreate && !body.status) body.status = 'draft';
  return body;
}

function assertSendableId(kind: string, id: string | undefined): void {
  if (id && isLegacyId(id)) {
    const key = `${kind}:${id}`;
    if (markPushDenied(key)) {
      console.warn(
        `[ApiContent] Bỏ qua đẩy ${kind} mang id legacy/sentinel (${id}) — id này không được gửi lên server và không tự map sang id khác. Hãy tạo mới item để lấy id thật.`
      );
    }
    throw new Error(
      `Không lưu được ${kind} mang id legacy/sentinel (${id}). Hãy tạo mới để lấy id thật từ máy chủ.`
    );
  }
}

async function saveItem<T extends { id: string }>(
  collection: string,
  cacheKey: string,
  item: Partial<T>
): Promise<T> {
  assertSendableId(collection, (item as any).id);
  const isCreate = !(item as any).id;
  const body = toBody(item as Record<string, any>, isCreate);
  const saved = isCreate
    ? await apiFetch(`/api/${collection}`, { method: 'POST', body: JSON.stringify(body) })
    : await apiFetch(`/api/${collection}/${encodeURIComponent((item as any).id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
  const out = normalizeRow<T>(unwrap(saved));
  if (cacheKey) upsertLocal(cacheKey, out);
  return out;
}

async function deleteItem(collection: string, cacheKey: string, id: string): Promise<void> {
  // Item local-only mang id legacy: không có gì trên server để xóa — chỉ
  // dọn cache local, không gọi API, không spam lỗi.
  if (isLegacyId(id)) {
    const list = readLocalList(cacheKey).filter((x: any) => x.id !== id);
    writeLocalList(cacheKey, list);
    return;
  }
  await apiFetch(`/api/${collection}/${encodeURIComponent(id)}/delete`, { method: 'POST' });
  markDeletedLocal(cacheKey, id);
}

const PLURAL: Record<'topic' | 'video' | 'theory', string> = {
  topic: 'topics',
  video: 'videos',
  theory: 'theories',
};
const CACHE_BY_TYPE: Record<'topic' | 'video' | 'theory', string> = {
  topic: TOPIC_CACHE_KEY,
  video: VIDEO_CACHE_KEY,
  theory: THEORY_CACHE_KEY,
};

export class ApiContentRepository implements ContentRepository {
  async getTopics(classId?: string, onlyPublished = true): Promise<TopicWithMeta[]> {
    const list = await fetchCollection<TopicWithMeta>('/api/topics', TOPIC_CACHE_KEY);
    return filterItems(list, classId, onlyPublished);
  }

  async getTopicById(id: string): Promise<TopicWithMeta | null> {
    return fetchOne<TopicWithMeta>(`/api/topics/${encodeURIComponent(id)}`);
  }

  async getVideoLessons(classId?: string, onlyPublished = true): Promise<VideoLessonWithMeta[]> {
    const list = await fetchCollection<VideoLessonWithMeta>('/api/videos', VIDEO_CACHE_KEY);
    return filterItems(list, classId, onlyPublished);
  }

  async getVideoLessonById(id: string): Promise<VideoLessonWithMeta | null> {
    return fetchOne<VideoLessonWithMeta>(`/api/videos/${encodeURIComponent(id)}`);
  }

  async getTheoryLessons(classId?: string, onlyPublished = true): Promise<TheoryLessonWithMeta[]> {
    const list = await fetchCollection<TheoryLessonWithMeta>('/api/theories', THEORY_CACHE_KEY);
    return filterItems(list, classId, onlyPublished);
  }

  async getTheoryLessonById(id: string): Promise<TheoryLessonWithMeta | null> {
    return fetchOne<TheoryLessonWithMeta>(`/api/theories/${encodeURIComponent(id)}`);
  }

  async saveTopic(topic: Partial<TopicWithMeta>): Promise<TopicWithMeta> {
    return saveItem<TopicWithMeta>('topics', TOPIC_CACHE_KEY, topic);
  }

  async saveVideoLesson(video: Partial<VideoLessonWithMeta>): Promise<VideoLessonWithMeta> {
    return saveItem<VideoLessonWithMeta>('videos', VIDEO_CACHE_KEY, video);
  }

  async saveTheoryLesson(theory: Partial<TheoryLessonWithMeta>): Promise<TheoryLessonWithMeta> {
    return saveItem<TheoryLessonWithMeta>('theories', THEORY_CACHE_KEY, theory);
  }

  async deleteTopic(id: string, _teacherActorId: string): Promise<void> {
    await deleteItem('topics', TOPIC_CACHE_KEY, id);
  }

  async deleteVideoLesson(id: string, _teacherActorId: string): Promise<void> {
    await deleteItem('videos', VIDEO_CACHE_KEY, id);
  }

  async deleteTheoryLesson(id: string, _teacherActorId: string): Promise<void> {
    await deleteItem('theories', THEORY_CACHE_KEY, id);
  }

  async reorderTopics(topicIds: string[]): Promise<void> {
    const sendable = topicIds.filter((id) => !isLegacyId(id));
    await apiFetch('/api/topics/reorder', { method: 'POST', body: JSON.stringify({ topicIds: sendable }) });
    const list = readLocalList<TopicWithMeta>(TOPIC_CACHE_KEY);
    const map = new Map(list.map((t) => [t.id, t]));
    const reordered: TopicWithMeta[] = [];
    for (const id of sendable) {
      const item = map.get(id);
      if (item) {
        reordered.push(item);
        map.delete(id);
      }
    }
    map.forEach((t) => reordered.push(t));
    writeLocalList(TOPIC_CACHE_KEY, reordered);
  }

  async reorderTopicVideos(topicId: string, videoIds: string[]): Promise<void> {
    // Khảo sát không có endpoint reorder-videos riêng: thứ tự video nằm
    // trên topic (videoIds) nên PATCH topic — không bịa thêm endpoint.
    assertSendableId('topics', topicId);
    const saved = await apiFetch(`/api/topics/${encodeURIComponent(topicId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ videoIds }),
    });
    upsertLocal(TOPIC_CACHE_KEY, normalizeRow<TopicWithMeta>(unwrap(saved)));
  }

  async publishContent(
    type: 'topic' | 'video' | 'theory',
    id: string,
    options: { classIds: string[]; notifyStudent?: boolean },
    _teacherActorId: string
  ): Promise<void> {
    assertSendableId(PLURAL[type], id);
    const collection = PLURAL[type];
    const saved = await apiFetch(`/api/${collection}/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ classIds: options.classIds }),
    });
    const row = unwrap(saved);
    if (row && typeof row === 'object' && row.id) {
      upsertLocal<any>(CACHE_BY_TYPE[type], normalizeRow<any>(unwrap(saved)));
    } else {
      // Server chỉ trả { ok } → tự đóng dấu published lên cache local.
      const list = readLocalList<any>(CACHE_BY_TYPE[type]);
      const idx = list.findIndex((x) => x.id === id);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          status: 'published',
          class_ids: options.classIds,
          published_at: new Date().toISOString(),
          has_unpublished_edits: false,
          updated_at: new Date().toISOString(),
        };
        writeLocalList(CACHE_BY_TYPE[type], list);
      }
    }
    // Publish topic KHÔNG tự publish con (giữ hành vi). Publish video/
    // lý thuyết chỉ gọi endpoint của item đó — server tự mirror publish
    // topic cha nếu cần.
  }

  async unpublishContent(
    type: 'topic' | 'video' | 'theory',
    id: string,
    _teacherActorId: string
  ): Promise<void> {
    assertSendableId(PLURAL[type], id);
    const collection = PLURAL[type];
    await apiFetch(`/api/${collection}/${encodeURIComponent(id)}/unpublish`, { method: 'POST' });
    const list = readLocalList<any>(CACHE_BY_TYPE[type]);
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status: 'draft', updated_at: new Date().toISOString() };
      writeLocalList(CACHE_BY_TYPE[type], list);
    }
  }

  async archiveContent(
    type: 'topic' | 'video' | 'theory',
    id: string,
    _teacherActorId: string
  ): Promise<void> {
    // Server GĐ3 có endpoint POST /:id/archive cho cả 3 loại (mirror
    // archiveContent gốc) nên dùng đúng endpoint, không PATCH tay.
    assertSendableId(PLURAL[type], id);
    const collection = PLURAL[type];
    const saved = await apiFetch(`/api/${collection}/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    });
    const row = unwrap(saved);
    if (row && typeof row === 'object' && row.id) {
      upsertLocal<any>(CACHE_BY_TYPE[type], normalizeRow<any>(row));
    }
  }

  async duplicateContent(
    type: 'topic' | 'video' | 'theory',
    id: string,
    _teacherActorId: string
  ): Promise<any> {
    // Khảo sát không có endpoint duplicate cho content (chỉ quiz có):
    // đọc bản gốc rồi tạo bản sao qua POST collection (status về draft,
    // không gửi id cũ để server cấp id mới).
    assertSendableId(PLURAL[type], id);
    const collection = PLURAL[type];
    const cacheKey = CACHE_BY_TYPE[type];
    const orig =
      readLocalList<any>(cacheKey).find((x) => x.id === id) ||
      (await fetchOne<any>(`/api/${collection}/${encodeURIComponent(id)}`));
    if (!orig) throw new Error('Không tìm thấy nội dung để nhân bản');
    const { id: _oldId, created_at: _c, updated_at: _u, teacher_id: _t, ...rest } = orig;
    const now = new Date().toISOString();
    const clone = await saveItem<any>(collection, cacheKey, {
      ...rest,
      title: `${orig.title || ''} (Bản sao)`,
      status: 'draft',
      created_at: now,
      updated_at: now,
      version: 1,
      has_unpublished_edits: false,
    });
    // Nhân bản video: gắn bản sao vào videoIds của topic cha (như mock cũ).
    if (type === 'video' && orig.topicId) {
      try {
        const parent = await fetchOne<TopicWithMeta>(
          `/api/topics/${encodeURIComponent(orig.topicId)}`
        );
        if (parent) {
          const videoIds = [...(parent.videoIds || [])];
          if (!videoIds.includes(clone.id)) videoIds.push(clone.id);
          await apiFetch(`/api/topics/${encodeURIComponent(parent.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ videoIds }),
          });
        }
      } catch (err) {
        console.warn('[ApiContent] Nhân bản video xong nhưng chưa gắn vào topic cha:', err);
      }
    }
    return clone;
  }
}

export class ApiQuizRepository implements QuizRepository {
  async getQuizzes(classId?: string, onlyPublished = true): Promise<QuizWithMeta[]> {
    const list = await fetchCollection<QuizWithMeta>('/api/quizzes', QUIZ_CACHE_KEY);
    return filterItems(list, classId, onlyPublished);
  }

  async getQuizById(id: string): Promise<QuizWithMeta | null> {
    return fetchOne<QuizWithMeta>(`/api/quizzes/${encodeURIComponent(id)}`);
  }

  async getQuestions(topicId?: string): Promise<Record<string, QuestionWithMeta>> {
    const path = topicId ? `/api/questions?topic_id=${encodeURIComponent(topicId)}` : '/api/questions';
    const rows = unwrapList(await apiFetch(path));
    const out: Record<string, QuestionWithMeta> = {};
    for (const r of rows) {
      const q = normalizeRow<QuestionWithMeta>(r);
      if (q && (q as any).id && !(q as any).deleted_at) out[(q as any).id] = q;
    }
    return out;
  }

  async getQuestionById(id: string): Promise<QuestionWithMeta | null> {
    return fetchOne<QuestionWithMeta>(`/api/questions/${encodeURIComponent(id)}`);
  }

  async saveQuiz(quiz: Partial<QuizWithMeta>): Promise<QuizWithMeta> {
    return saveItem<QuizWithMeta>('quizzes', QUIZ_CACHE_KEY, quiz);
  }

  async saveQuestion(question: Partial<QuestionWithMeta>): Promise<QuestionWithMeta> {
    return saveItem<QuestionWithMeta>('questions', '', question).then((saved) => saved);
  }

  async deleteQuiz(id: string, _teacherActorId: string): Promise<void> {
    await deleteItem('quizzes', QUIZ_CACHE_KEY, id);
  }

  async deleteQuestion(id: string, _teacherActorId: string): Promise<void> {
    // Questions: DELETE trực tiếp (khảo sát §2.3); UI đã hỏi xác nhận trước.
    if (isLegacyId(id)) return;
    await apiFetch(`/api/questions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async publishQuiz(
    id: string,
    options: { classIds: string[]; notifyStudent?: boolean },
    _teacherActorId: string
  ): Promise<QuizWithMeta> {
    assertSendableId('quizzes', id);
    const saved = await apiFetch(`/api/quizzes/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ classIds: options.classIds }),
    });
    const quiz = normalizeRow<QuizWithMeta>(unwrap(saved));
    if (quiz && (quiz as any).id) upsertLocal(QUIZ_CACHE_KEY, quiz);
    // Quiz publish TỰ publish topic cha (giữ hành vi cũ): cha chưa published
    // thì publish cha với cùng classIds.
    const parentId = (quiz as any).topicId;
    if (parentId && !isLegacyId(parentId)) {
      try {
        const parent = await fetchOne<TopicWithMeta>(
          `/api/topics/${encodeURIComponent(parentId)}`
        );
        if (parent && parent.status !== 'published') {
          await apiFetch(`/api/topics/${encodeURIComponent(parentId)}/publish`, {
            method: 'POST',
            body: JSON.stringify({ classIds: options.classIds }),
          });
        }
      } catch (err) {
        console.warn('[ApiContent] Publish quiz xong nhưng chưa publish được topic cha:', err);
      }
    }
    return quiz;
  }

  async unpublishQuiz(id: string, _teacherActorId: string): Promise<QuizWithMeta> {
    assertSendableId('quizzes', id);
    const saved = await apiFetch(`/api/quizzes/${encodeURIComponent(id)}/unpublish`, {
      method: 'POST',
    });
    const quiz = normalizeRow<QuizWithMeta>(unwrap(saved));
    if (quiz && (quiz as any).id) upsertLocal(QUIZ_CACHE_KEY, quiz);
    return quiz;
  }

  async archiveQuiz(id: string, _teacherActorId: string): Promise<QuizWithMeta> {
    assertSendableId('quizzes', id);
    const saved = await apiFetch(`/api/quizzes/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    });
    const quiz = normalizeRow<QuizWithMeta>(unwrap(saved));
    if (quiz && (quiz as any).id) upsertLocal(QUIZ_CACHE_KEY, quiz);
    return quiz;
  }

  async duplicateQuiz(id: string, _teacherActorId: string): Promise<QuizWithMeta> {
    assertSendableId('quizzes', id);
    const saved = await apiFetch(`/api/quizzes/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
    });
    const quiz = normalizeRow<QuizWithMeta>(unwrap(saved));
    if (quiz && (quiz as any).id) upsertLocal(QUIZ_CACHE_KEY, quiz);
    return quiz;
  }

  async hasStudentAttempts(quizId: string): Promise<boolean> {
    // Khảo sát không có endpoint riêng cho việc này: quét dashboard attempts
    // và đối chiếu liên kết quiz (nếu server trả kèm quizId/quiz_id). Màn
    // publish chỉ dùng kết quả làm cờ cảnh báo, không chặn thao tác — nếu
    // server chưa trả liên kết thì trả false; cần endpoint riêng để chính
    // xác tuyệt đối (xem báo cáo GĐ3).
    try {
      const rows = unwrapList(await apiFetch('/api/dashboard/attempts'));
      return rows.some((r: any) => {
        const q = r?.quizId ?? r?.quiz_id ?? r?.sourceId ?? r?.source_id;
        return q === quizId;
      });
    } catch {
      return false;
    }
  }
}
