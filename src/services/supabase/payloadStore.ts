import { supabase, isSupabaseReady } from './client.ts';

/**
 * Kho lưu "payload" (JSON) lên Supabase cho các loại nội dung chưa có bảng cột riêng:
 * video_lessons, theory_lessons, quizzes.
 * Mỗi dòng: id, topic_id, status, payload (toàn bộ đối tượng), deleted_at, created_at, updated_at.
 * localStorage chỉ còn đóng vai trò bộ nhớ đệm — nguồn dữ liệu thật là Supabase.
 */

export interface PayloadItem {
  id: string;
  status?: string;
  topicId?: string;
  class_ids?: string[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  /** Chủ sở hữu: id giáo viên tạo nội dung này (tách dữ liệu riêng theo giáo viên). */
  teacher_id?: string;
}

// ==============================================================================
// CHỦ SỞ HỮU NỘI DUNG THEO PHIÊN ĐĂNG NHẬP (tách dữ liệu riêng theo giáo viên)
// Giáo viên: chủ là chính mình. Học sinh: chủ là giáo viên chủ nhiệm lớp của
// em (tra từ DB). Admin: không có nội dung riêng -> null. Không có phiên
// (chế độ mock/test): null để giữ hành vi cũ.
// ==============================================================================
const SESSION_KEY = 'mam_van_auth_session';
const LEGACY_TEACHER_ID_MAP: Record<string, string> = {
  gv001: '00000000-0000-0000-0000-000000000001',
};

export function getSessionUser(): any | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user || null;
  } catch {
    return null;
  }
}

/** Id giáo viên của phiên hiện tại (chỉ khi phiên là giáo viên). */
export function sessionTeacherId(): string | null {
  const u = getSessionUser();
  if (!u || u.role !== 'teacher') return null;
  return LEGACY_TEACHER_ID_MAP[u.id] || u.id;
}

let studentTeacherCache: { studentId: string; teacherId: string | null } | null = null;

/** Giáo viên sở hữu nội dung mà phiên hiện tại được phép thấy. */
export async function resolveContentOwnerId(): Promise<string | null> {
  const u = getSessionUser();
  if (!u) return null;
  if (u.role === 'teacher') return LEGACY_TEACHER_ID_MAP[u.id] || u.id;
  if (u.role === 'student') {
    if (studentTeacherCache && studentTeacherCache.studentId === u.id) {
      return studentTeacherCache.teacherId;
    }
    let teacherId: string | null = null;
    try {
      const { data: st } = await supabase
        .from('students')
        .select('class_id')
        .eq('id', u.id)
        .maybeSingle();
      if (st?.class_id) {
        const { data: cl } = await supabase
          .from('classes')
          .select('teacher_id')
          .eq('id', st.class_id)
          .maybeSingle();
        teacherId = cl?.teacher_id || null;
      }
    } catch {
      teacherId = null;
    }
    studentTeacherCache = { studentId: u.id, teacherId };
    return teacherId;
  }
  return null;
}

export function readLocalList<T>(storageKey: string): T[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalList<T>(storageKey: string, list: T[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(list));
    }
  } catch (e) {
    console.warn(`[PayloadStore] Không ghi được bộ nhớ đệm ${storageKey}:`, e);
  }
}

function ts(v?: string | null): number {
  if (!v) return 0;
  const n = Date.parse(v);
  return Number.isNaN(n) ? 0 : n;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** UUID giả thời legacy (map 'gv001' -> sentinel) — không khớp dòng nào trên server. */
const LEGACY_SENTINEL_UUID = '00000000-0000-0000-0000-000000000001';

/**
 * teacher_id hợp lệ để đẩy lên Supabase dưới RLS mới (25/10: RLS chặn
 * mọi dòng có teacher_id khác giáo viên của JWT, kể cả bản nháp local cũ).
 * - Trả về UUID để đẩy: bản của chính phiên hiện tại; bản nháp vô chủ,
 *   chuỗi legacy ('gv001') hay sentinel legacy đều được NHẬN VỀ đúng chủ
 *   (đẩy thành công, dứt vòng đẩy lỗi, không mất dữ liệu).
 * - Trả về null = BỎ QUA, không đẩy: bản mang UUID thật của giáo viên
 *   khác (RLS sẽ chặn, đẩy chỉ spam lỗi) hoặc không có phiên.
 */
export function resolvePushTeacherId(rawTid: unknown): string | null {
  const own = sessionTeacherId();
  if (!own || !UUID_RE.test(own)) return null;
  const raw = String(rawTid || '');
  if (!raw) return own;
  if (!UUID_RE.test(raw)) return own;
  if (raw === LEGACY_SENTINEL_UUID) return own;
  if (raw !== own) return null;
  return own;
}

/** Ghi (upsert) 1 đối tượng lên Supabase. Trả về true nếu thành công. */
export async function pushPayloadItem(table: string, item: PayloadItem): Promise<boolean> {
  if (!isSupabaseReady() || !item || !item.id) return false;
  const now = new Date().toISOString();
  // Đóng dấu chủ sở hữu: bản của người khác thì bỏ qua (RLS chặn),
  // bản vô chủ/legacy thì nhận về đúng giáo viên của phiên hiện tại.
  const pushTid = resolvePushTeacherId(item.teacher_id);
  if (!pushTid) return false;
  const stamped: PayloadItem = { ...item, teacher_id: pushTid };
  try {
    const { error } = await supabase.from(table).upsert(
      {
        id: stamped.id,
        topic_id: stamped.topicId || null,
        status: stamped.status || 'draft',
        payload: stamped,
        teacher_id: pushTid,
        deleted_at: stamped.deleted_at || null,
        created_at: stamped.created_at || now,
        updated_at: stamped.updated_at || now,
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn(`[PayloadStore] Lỗi lưu lên bảng ${table}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[PayloadStore] Ngoại lệ khi lưu bảng ${table}:`, err);
    return false;
  }
}

/** Đẩy đối tượng (đang nằm trong bộ nhớ đệm) có id tương ứng lên Supabase. */
export async function pushLocalById(table: string, storageKey: string, id: string): Promise<boolean> {
  const item = readLocalList<PayloadItem>(storageKey).find((x) => x.id === id);
  if (!item) return false;
  return pushPayloadItem(table, item);
}

/**
 * Đồng bộ 2 chiều 1 bộ sưu tập:
 *  - Lấy toàn bộ từ Supabase (nguồn thật).
 *  - Dữ liệu cũ chỉ có trong localStorage (hoặc mới hơn) sẽ được tự động đẩy lên Supabase.
 *  - Cập nhật lại bộ nhớ đệm localStorage.
 * Trả về null nếu không đọc được Supabase (để caller dùng bộ nhớ đệm).
 */
export async function syncPayloadCollection<T extends PayloadItem>(
  table: string,
  storageKey: string
): Promise<T[] | null> {
  if (!isSupabaseReady()) return null;
  try {
    // TÁCH THEO GIÁO VIÊN: chỉ đồng bộ nội dung của chủ sở hữu theo phiên.
    const ownerId = await resolveContentOwnerId();
    const sessUser = getSessionUser();
    if (sessUser && !ownerId) return [] as T[];

    let query = supabase.from(table).select('*');
    if (ownerId) {
      query = query.eq('teacher_id', ownerId);
    }
    const { data: rows, error } = await query;
    if (error) {
      console.warn(`[PayloadStore] Lỗi đọc bảng ${table}, dùng bộ nhớ đệm:`, error.message);
      return null;
    }

    const merged = new Map<string, T>();
    for (const row of rows || []) {
      const p = row.payload && typeof row.payload === 'object' ? row.payload : {};
      merged.set(row.id, {
        ...p,
        id: row.id,
        status: p.status || row.status,
        topicId: p.topicId || row.topic_id || undefined,
        teacher_id: (p as any).teacher_id || row.teacher_id || undefined,
        deleted_at: row.deleted_at || p.deleted_at || null,
        created_at: p.created_at || row.created_at,
        updated_at: p.updated_at || row.updated_at,
      } as T);
    }

    const toPush: T[] = [];
    for (const localItem of readLocalList<T>(storageKey)) {
      if (!localItem || !localItem.id) continue;
      // Item mang dấu chủ của NGƯỜI KHÁC -> bỏ qua hoàn toàn (không hiển thị,
      // không đẩy lên). Item không dấu chủ khi đang có phiên -> coi là dữ
      // liệu vô chủ từ trước đợt tách, cũng không nhận để tránh rò chéo.
      const stamp = (localItem as any).teacher_id as string | undefined;
      if (ownerId && stamp && stamp !== ownerId) continue;
      if (ownerId && !stamp && !merged.has(localItem.id)) continue;
      const remoteItem = merged.get(localItem.id);
      if (
        !remoteItem ||
        ts(localItem.updated_at) > ts(remoteItem.updated_at) ||
        (localItem.deleted_at && !remoteItem.deleted_at)
      ) {
        merged.set(localItem.id, localItem);
        toPush.push(localItem);
      }
    }

    if (toPush.length > 0) {
      await Promise.all(toPush.map((it) => pushPayloadItem(table, it)));
    }

    const list = Array.from(merged.values());
    writeLocalList(storageKey, list);
    return list;
  } catch (err) {
    console.error(`[PayloadStore] Ngoại lệ đồng bộ bảng ${table}:`, err);
    return null;
  }
}

/** Lọc theo trạng thái xoá / xuất bản / lớp (giống logic của Mock Repository). */
export function filterContentItems<T extends PayloadItem>(
  list: T[],
  classId: string | undefined,
  onlyPublished: boolean
): T[] {
  let out = list.filter((x) => !x.deleted_at);
  if (onlyPublished) {
    out = out.filter((x) => x.status === 'published');
  }
  if (classId && classId !== 'all') {
    out = out.filter((x) => {
      const ids = Array.isArray(x.class_ids) ? x.class_ids : ['all'];
      return ids.includes('all') || ids.includes(classId);
    });
  }
  return out;
}
