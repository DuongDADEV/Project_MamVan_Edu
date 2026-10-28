import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { query, execute, withTransaction, parseJson, db } from '../_lib/mysql';
import { requireAuth, httpErr } from '../_lib/auth';
import { isSentinelId, topicTeacherId, studentTeacherId } from '../_lib/scope';

/**
 * Topics / videos / theories / quizzes / questions. Mount tại /api.
 *
 * Luật server-thắng (đợt 3 26/10): đường đọc trả rows server, KHÔNG gộp
 * local; đường ghi chỉ ở endpoint tường minh dưới đây; xóa nội dung =
 * soft-delete (deleted_at), KHÔNG hard-delete — trừ questions: code gốc
 * deleteQuestion hard-delete khỏi bảng questions nên DELETE /questions/:id
 * giữ hard-delete (có kiểm tra sở hữu trước).
 *
 * Phân quyền mọi endpoint:
 * - teacher: chỉ teacher_id mình (+ topic_id thuộc topic mình cho
 *   video/theory/quiz/question).
 * - student: chỉ published + class_ids chứa lớp mình hoặc 'all', và chỉ
 *   nội dung của giáo viên chủ nhiệm lớp mình. Học sinh KHÔNG gọi trực
 *   tiếp /questions (chỉ qua quiz) → 403.
 * - admin: tất cả (trừ hàng đã soft-delete ở đường đọc).
 * - Id sentinel/legacy (gv001, sentinel UUID) → 400, không ghi vào MySQL.
 *   Server KHÔNG bắt chước hành vi legacy "nhận sentinel về đúng chủ"
 *   của resolvePushTeacherId — sentinel bị từ chối thẳng.
 *
 * Tạo mới: server ép teacher_id = caller, gán status='draft' khi không kèm
 * status (default DB đã bỏ ở GĐ1 §5 cho quizzes/video_lessons/
 * theory_lessons; topics trong DDL vẫn còn DEFAULT 'published' nhưng task
 * GĐ3 yêu cầu thống nhất draft khi tạo mới nên code ép 'draft' — lệch
 * này ghi rõ để tích hợp quyết có sửa DDL topics hay không).
 * Payload JSON: đọc/ghi nguyên JSON (parseJson trước khi dùng vì MySQL
 * có thể trả object hoặc string).
 *
 * Publish:
 * - Publish topic KHÔNG tự publish con (giữ hành vi hiện tại).
 * - Publish video/theory: mirror publishContent gốc — tự publish topic
 *   cha nếu topic cha chưa published (để học sinh nhìn thấy).
 * - Publish quiz: tự publish topic cha NẾU topic cha tồn tại và chưa
 *   published (điều kiện đã xác nhận từ publishQuiz gốc:
 *   `parent && parent.status !== 'published'`).
 * - Version-bump khi quiz đã có học sinh làm bài (mock publishQuiz cũ)
 *   KHÔNG triển khai ở đây: cần tra bảng attempts (nhóm BI) — ghi TODO
 *   trong báo cáo tích hợp, publish vẫn đúng về status/class_ids.
 * - Publish/unpublish/archive cho video/theory và archive cho topic là
 *   endpoint bổ sung mirror publishContent/archiveContent gốc (task chỉ
 *   liệt kê publish/unpublish cho topic và publish/unpublish/archive/
 *   duplicate cho quiz) — thêm vào không phá path nào.
 *
 * Topics: class_ids KHÔNG có cột riêng trong DDL (nằm trong
 * video_payload JSON) nên lọc lớp cho topic đọc từ video_payload.
 * Độ dài id: topics/questions VARCHAR(100), videos/theories/quizzes
 * VARCHAR(191) — kiểm tra theo đúng cột, không chỉ trần 191 chung.
 */

type Role = 'admin' | 'teacher' | 'student';

function callerInfo(req: Request): { userId: string; role: Role; teacherId: string; studentId: string; classId: string } {
  const c: any = (req as any).caller;
  return {
    userId: String(c?.userId ?? c?.id ?? c?.sub ?? ''),
    role: String(c?.role || '') as Role,
    teacherId: String(c?.teacherId ?? c?.profileId ?? ''),
    studentId: String(c?.studentId ?? ''),
    classId: String(c?.classId ?? c?.class_id ?? ''),
  };
}

async function callerTeacherId(req: Request): Promise<string> {
  const info = callerInfo(req);
  if (info.teacherId) return info.teacherId;
  if (!info.userId) return '';
  const rows = await query<any>('SELECT `id` FROM `teachers` WHERE `auth_user_id` = ? LIMIT 1', [info.userId]);
  return rows[0] ? String(rows[0].id) : '';
}

async function callerStudentCtx(req: Request): Promise<{ studentId: string; classId: string; teacherId: string }> {
  const info = callerInfo(req);
  let studentId = info.studentId;
  let classId = info.classId;
  if ((!studentId || !classId) && info.userId) {
    const rows = await query<any>('SELECT `id`, `class_id` FROM `students` WHERE `auth_user_id` = ? LIMIT 1', [info.userId]);
    if (rows[0]) {
      studentId = studentId || String(rows[0].id);
      classId = classId || String(rows[0].class_id);
    }
  }
  let teacherId = '';
  if (studentId) {
    const t = await studentTeacherId(db, studentId);
    teacherId = t ? String(t) : '';
  }
  if (!teacherId && classId) {
    const rows = await query<any>('SELECT `teacher_id` FROM `classes` WHERE `id` = ? LIMIT 1', [classId]);
    if (rows[0]) teacherId = String(rows[0].teacher_id);
  }
  return { studentId, classId, teacherId };
}

function badId(id: string | undefined | null): boolean {
  return !id || id === 'gv001' || isSentinelId(id);
}

function classIdsOf(obj: any): string[] {
  const v = obj?.class_ids;
  return Array.isArray(v) && v.length ? v.map(String) : ['all'];
}

function visibleToStudent(obj: any, studentClassId: string): boolean {
  if (obj?.status !== 'published') return false;
  const ids = classIdsOf(obj);
  return ids.includes('all') || (studentClassId !== '' && ids.includes(studentClassId));
}

function applyListFilters(list: any[], req: Request, isStudent: boolean): any[] {
  let out = list.filter((x) => !x.deleted_at);
  const status = req.query.status ? String(req.query.status) : '';
  const onlyPublished = req.query.onlyPublished === '1' || req.query.onlyPublished === 'true';
  if (status) out = out.filter((x) => x.status === status);
  else if (onlyPublished || isStudent) out = out.filter((x) => x.status === 'published');
  const classId = req.query.class_id ? String(req.query.class_id) : '';
  if (classId && classId !== 'all') {
    out = out.filter((x) => {
      const ids = classIdsOf(x);
      return ids.includes('all') || ids.includes(classId);
    });
  }
  return out;
}

// ---------- Topics ----------
function toTopic(row: any): any {
  const v = parseJson<any>(row.video_payload, {});
  const t = parseJson<any>(row.theory_payload, {});
  return {
    id: row.id,
    title: row.title || '',
    shortDesc: v.shortDesc || '',
    tag: row.category || 'Chung',
    videoIds: Array.isArray(v.videoIds) ? v.videoIds : [],
    flowOrder: Array.isArray(v.flowOrder) ? v.flowOrder : [],
    theoryId: t.theoryId || '',
    colorScheme: v.colorScheme || '#2F3E6B',
    xpReward: typeof v.xpReward === 'number' ? v.xpReward : 0,
    status: row.status || 'published',
    class_ids: Array.isArray(v.class_ids) ? v.class_ids : ['all'],
    version: typeof v.version === 'number' ? v.version : 1,
    has_unpublished_edits: !!v.has_unpublished_edits,
    published_at: v.published_at || undefined,
    order_index: row.order_index ?? 0,
    subject: row.subject || undefined,
    grade: row.grade || undefined,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    deleted_at: row.deleted_at || null,
    teacher_id: row.teacher_id || undefined,
  };
}

function topicPayloads(body: any, existing?: any): { videoPayload: any; theoryPayload: any } {
  const src: any = { ...(body || {}), ...((body || {}).payload || {}) };
  const ev = existing ? parseJson<any>(existing.video_payload, {}) : {};
  const et = existing ? parseJson<any>(existing.theory_payload, {}) : {};
  const videoPayload = {
    shortDesc: src.shortDesc ?? ev.shortDesc ?? '',
    videoIds: src.videoIds ?? ev.videoIds ?? [],
    flowOrder: src.flowOrder ?? ev.flowOrder ?? [],
    colorScheme: src.colorScheme ?? ev.colorScheme ?? '#2F3E6B',
    xpReward: src.xpReward ?? ev.xpReward ?? 0,
    class_ids: src.class_ids ?? src.classIds ?? ev.class_ids ?? ['all'],
    version: src.version ?? ev.version ?? 1,
    has_unpublished_edits: src.has_unpublished_edits ?? ev.has_unpublished_edits ?? false,
    published_at: src.published_at ?? ev.published_at ?? undefined,
  };
  const theoryPayload = { theoryId: src.theoryId ?? et.theoryId ?? '' };
  return { videoPayload, theoryPayload };
}

async function loadTopicOwned(req: Request, res: Response, id: string): Promise<any | null> {
  const rows = await query<any>('SELECT * FROM `topics` WHERE `id` = ? LIMIT 1', [id]);
  const row = rows[0];
  if (!row || row.deleted_at) {
    httpErr(res, 404, 'NOT_FOUND');
    return null;
  }
  const { role } = callerInfo(req);
  if (role === 'admin') return row;
  if (role === 'teacher') {
    const teacherId = await callerTeacherId(req);
    if (String(row.teacher_id) !== teacherId) {
      httpErr(res, 403, 'FORBIDDEN');
      return null;
    }
    return row;
  }
  httpErr(res, 403, 'FORBIDDEN');
  return null;
}

async function publishTopicRow(topicId: string, classIds: string[] | null): Promise<void> {
  const rows = await query<any>('SELECT * FROM `topics` WHERE `id` = ? LIMIT 1', [topicId]);
  const row = rows[0];
  if (!row || row.deleted_at || String(row.status) === 'published') return;
  const v = parseJson<any>(row.video_payload, {});
  if (classIds) v.class_ids = classIds;
  v.has_unpublished_edits = false;
  v.published_at = new Date().toISOString();
  await execute('UPDATE `topics` SET `status` = ?, `video_payload` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?', [
    'published',
    JSON.stringify(v),
    topicId,
  ]);
}

// ---------- Payload items (videos / theories / quizzes) ----------
function toPayloadItem(row: any): any {
  const p = parseJson<any>(row.payload, {});
  return {
    ...p,
    id: row.id,
    topicId: row.topic_id || p.topicId || p.topic_id || undefined,
    status: p.status || row.status || 'draft',
    teacher_id: row.teacher_id || p.teacher_id || undefined,
    class_ids: classIdsOf(p),
    deleted_at: row.deleted_at || p.deleted_at || null,
    created_at: p.created_at || row.created_at || null,
    updated_at: p.updated_at || row.updated_at || null,
  };
}

async function checkTopicOwnedForWrite(req: Request, res: Response, topicId: string | null): Promise<boolean> {
  // topic_id lạ (thuộc giáo viên khác) → 403. Topic không tồn tại: cho qua
  // (cột topic_id không có FK — đúng hành vi pushPayloadItem cũ).
  if (!topicId) return true;
  if (badId(topicId)) {
    httpErr(res, 400, 'BAD_INPUT');
    return false;
  }
  const { role } = callerInfo(req);
  if (role === 'admin') return true;
  if (role === 'teacher') {
    const owner = await topicTeacherId(db, topicId);
    if (owner && String(owner) !== (await callerTeacherId(req))) {
      httpErr(res, 403, 'FORBIDDEN');
      return false;
    }
  }
  return true;
}

async function loadPayloadOwned(
  req: Request,
  res: Response,
  table: string,
  id: string
): Promise<any | null> {
  const rows = await query<any>(`SELECT * FROM \`${table}\` WHERE \`id\` = ? LIMIT 1`, [id]);
  const row = rows[0];
  if (!row || row.deleted_at) {
    httpErr(res, 404, 'NOT_FOUND');
    return null;
  }
  const { role } = callerInfo(req);
  if (role === 'admin') return row;
  if (role === 'teacher') {
    const teacherId = await callerTeacherId(req);
    if (String(row.teacher_id) !== teacherId) {
      httpErr(res, 403, 'FORBIDDEN');
      return null;
    }
    return row;
  }
  httpErr(res, 403, 'FORBIDDEN');
  return null;
}

async function publishPayloadRow(
  table: string,
  row: any,
  classIds: string[] | null,
  autoPublishParent: boolean
): Promise<any> {
  const item = toPayloadItem(row);
  item.status = 'published';
  item.has_unpublished_edits = false;
  item.published_at = new Date().toISOString();
  if (classIds) item.class_ids = classIds;
  await execute(`UPDATE \`${table}\` SET \`status\` = ?, \`payload\` = ?, \`updated_at\` = UTC_TIMESTAMP() WHERE \`id\` = ?`, [
    'published',
    JSON.stringify(item),
    row.id,
  ]);
  if (autoPublishParent && item.topicId) {
    await publishTopicRow(String(item.topicId), classIds);
  }
  const fresh = await query<any>(`SELECT * FROM \`${table}\` WHERE \`id\` = ? LIMIT 1`, [row.id]);
  return toPayloadItem(fresh[0]);
}

async function setPayloadStatus(table: string, row: any, status: string): Promise<any> {
  const item = toPayloadItem(row);
  item.status = status;
  if (status !== 'published') delete (item as any).published_at;
  await execute(`UPDATE \`${table}\` SET \`status\` = ?, \`payload\` = ?, \`updated_at\` = UTC_TIMESTAMP() WHERE \`id\` = ?`, [
    status,
    JSON.stringify(item),
    row.id,
  ]);
  const fresh = await query<any>(`SELECT * FROM \`${table}\` WHERE \`id\` = ? LIMIT 1`, [row.id]);
  return toPayloadItem(fresh[0]);
}

// ---------- Questions ----------
const DB_TYPE: Record<string, string> = {
  single: 'single_choice',
  multi: 'multiple_choice',
  fill: 'fill_in_blank',
  essay: 'essay',
};
const APP_TYPE: Record<string, string> = {
  single_choice: 'single',
  multiple_choice: 'multi',
  fill_in_blank: 'fill',
  essay: 'essay',
};

function toQuestion(row: any): any {
  const p = parseJson<any>(row.payload, {});
  const base: any = {
    id: row.id,
    topicId: row.topic_id || p.topicId || 'topic_1',
    type: APP_TYPE[String(row.type)] || row.type,
    level: row.level || 'NHAN_BIET',
    difficulty: row.difficulty || (row.level === 'NHAN_BIET' ? 'DE' : row.level === 'THONG_HIEU' ? 'TB' : 'KHO'),
    prompt: row.prompt || '',
    options: Array.isArray(parseJson<any>(row.options, [])) ? parseJson<any>(row.options, []) : undefined,
    answer: parseJson<any>(row.correct_answer, null),
    explanation: row.explanation || '',
    points: 10,
    isAiGenerated: String(row.id).includes('ai'),
    isTeacherReviewed: true,
    status: 'published',
    version: 1,
    class_ids: ['all'],
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    teacher_id: row.teacher_id || undefined,
  };
  return { ...base, ...p, id: row.id };
}

export const contentRouter = Router();
contentRouter.use(requireAuth);

// ================= TOPICS =================
contentRouter.get('/topics', async (req: Request, res: Response) => {
  try {
    const { role } = callerInfo(req);
    let rows: any[];
    if (role === 'admin') {
      rows = await query<any>('SELECT * FROM `topics` WHERE `deleted_at` IS NULL ORDER BY `order_index` ASC');
    } else if (role === 'teacher') {
      const teacherId = await callerTeacherId(req);
      rows = teacherId
        ? await query<any>('SELECT * FROM `topics` WHERE `teacher_id` = ? AND `deleted_at` IS NULL ORDER BY `order_index` ASC', [teacherId])
        : [];
    } else if (role === 'student') {
      const ctx = await callerStudentCtx(req);
      rows = ctx.teacherId
        ? await query<any>('SELECT * FROM `topics` WHERE `teacher_id` = ? AND `deleted_at` IS NULL ORDER BY `order_index` ASC', [ctx.teacherId])
        : [];
    } else {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    let list = rows.map(toTopic);
    if (role === 'student') {
      const ctx = await callerStudentCtx(req);
      list = list.filter((t) => visibleToStudent(t, ctx.classId));
    } else {
      list = applyListFilters(list, req, false);
    }
    return res.status(200).json(list);
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.get('/topics/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id)) return httpErr(res, 400, 'BAD_INPUT');
    const { role } = callerInfo(req);
    const rows = await query<any>('SELECT * FROM `topics` WHERE `id` = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row || row.deleted_at) return httpErr(res, 404, 'NOT_FOUND');
    if (role === 'admin') return res.status(200).json(toTopic(row));
    if (role === 'teacher') {
      const teacherId = await callerTeacherId(req);
      if (String(row.teacher_id) !== teacherId) return httpErr(res, 403, 'FORBIDDEN');
      return res.status(200).json(toTopic(row));
    }
    if (role === 'student') {
      const ctx = await callerStudentCtx(req);
      const topic = toTopic(row);
      if (String(row.teacher_id) !== ctx.teacherId || !visibleToStudent(topic, ctx.classId)) {
        return httpErr(res, 404, 'NOT_FOUND');
      }
      return res.status(200).json(topic);
    }
    return httpErr(res, 403, 'FORBIDDEN');
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.post('/topics', async (req: Request, res: Response) => {
  try {
    const { role } = callerInfo(req);
    const body: any = req.body || {};
    if (role === 'student') return httpErr(res, 403, 'FORBIDDEN');
    let teacherId: string;
    if (role === 'teacher') {
      teacherId = await callerTeacherId(req);
      if (!teacherId) return httpErr(res, 403, 'FORBIDDEN');
    } else if (role === 'admin') {
      teacherId = String(body.teacher_id || body.teacherId || '');
      if (!teacherId) return httpErr(res, 400, 'BAD_INPUT');
    } else {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    if (badId(teacherId)) return httpErr(res, 400, 'BAD_INPUT');
    const id = String(body.id || `topic_${Date.now()}`);
    if (id.length > 100 || badId(id)) return httpErr(res, 400, 'BAD_INPUT');
    // Upsert theo id: nếu id đã tồn tại của giáo viên khác thì không được
    // ghi đè (kẻo POST tạo mới biến thành chiếm topic người khác).
    if (body.id) {
      const existing = await query<any>('SELECT `teacher_id`, `deleted_at` FROM `topics` WHERE `id` = ? LIMIT 1', [id]);
      if (existing[0] && role === 'teacher' && String(existing[0].teacher_id) !== teacherId) {
        return httpErr(res, 403, 'FORBIDDEN');
      }
    }
    const title = String(body.title || body.payload?.title || 'Chủ đề mới');
    const status = body.status || body.payload?.status || 'draft';
    if (!['draft', 'published', 'archived'].includes(String(status))) return httpErr(res, 400, 'BAD_INPUT');
    const { videoPayload, theoryPayload } = topicPayloads(body);
    let orderIndex = body.order_index ?? body.payload?.order_index;
    if (orderIndex === undefined) {
      const mx = await query<any>('SELECT COALESCE(MAX(`order_index`), 0) AS m FROM `topics` WHERE `teacher_id` = ?', [teacherId]);
      orderIndex = Number(mx[0]?.m || 0) + 1;
    }
    // Upsert theo id (saveTopic gốc dùng upsert onConflict id).
    await execute(
      'INSERT INTO `topics` (`id`, `teacher_id`, `title`, `category`, `order_index`, `video_payload`, `theory_payload`, `status`, `subject`, `grade`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `teacher_id` = VALUES(`teacher_id`), `title` = VALUES(`title`), `category` = VALUES(`category`), `order_index` = VALUES(`order_index`), `video_payload` = VALUES(`video_payload`), `theory_payload` = VALUES(`theory_payload`), `status` = VALUES(`status`), `subject` = VALUES(`subject`), `grade` = VALUES(`grade`), `updated_at` = UTC_TIMESTAMP()',
      [
        id,
        teacherId,
        title,
        body.tag || body.category || body.payload?.tag || 'Chung',
        orderIndex,
        JSON.stringify(videoPayload),
        JSON.stringify(theoryPayload),
        status,
        body.subject || body.payload?.subject || null,
        body.grade || body.payload?.grade || null,
      ]
    );
    const rows = await query<any>('SELECT * FROM `topics` WHERE `id` = ? LIMIT 1', [id]);
    return res.status(200).json(toTopic(rows[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.patch('/topics/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id)) return httpErr(res, 400, 'BAD_INPUT');
    const row = await loadTopicOwned(req, res, id);
    if (!row) return;
    const body: any = req.body || {};
    const { videoPayload, theoryPayload } = topicPayloads(body, row);
    const status = body.status ?? body.payload?.status;
    if (status !== undefined && !['draft', 'published', 'archived'].includes(String(status))) {
      return httpErr(res, 400, 'BAD_INPUT');
    }
    await execute(
      'UPDATE `topics` SET `title` = ?, `category` = ?, `order_index` = ?, `video_payload` = ?, `theory_payload` = ?, `status` = ?, `subject` = ?, `grade` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?',
      [
        body.title ?? body.payload?.title ?? row.title,
        body.tag ?? body.category ?? body.payload?.tag ?? row.category,
        body.order_index ?? body.payload?.order_index ?? row.order_index,
        JSON.stringify(videoPayload),
        JSON.stringify(theoryPayload),
        status ?? row.status,
        body.subject ?? body.payload?.subject ?? row.subject,
        body.grade ?? body.payload?.grade ?? row.grade,
        id,
      ]
    );
    const fresh = await query<any>('SELECT * FROM `topics` WHERE `id` = ? LIMIT 1', [id]);
    return res.status(200).json(toTopic(fresh[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.post('/topics/:id/delete', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id)) return httpErr(res, 400, 'BAD_INPUT');
    const row = await loadTopicOwned(req, res, id);
    if (!row) return;
    await execute('UPDATE `topics` SET `deleted_at` = UTC_TIMESTAMP(), `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?', [id]);
    return res.status(200).json({ ok: true });
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.post('/topics/reorder', async (req: Request, res: Response) => {
  try {
    const { role } = callerInfo(req);
    if (role === 'student') return httpErr(res, 403, 'FORBIDDEN');
    const ids: string[] = Array.isArray(req.body)
      ? req.body.map(String)
      : Array.isArray(req.body?.topicIds)
        ? req.body.topicIds.map(String)
        : Array.isArray(req.body?.ids)
          ? req.body.ids.map(String)
          : [];
    if (!ids.length) return httpErr(res, 400, 'BAD_INPUT');
    if (ids.some((x) => badId(x) || x.length > 100)) return httpErr(res, 400, 'BAD_INPUT');
    // Kiểm tra sở hữu toàn bộ trước khi ghi (gốc ném nếu 1 update lỗi).
    for (const tid of ids) {
      const row = await loadTopicOwned(req, res, tid);
      if (!row) return;
    }
    for (let i = 0; i < ids.length; i++) {
      await execute('UPDATE `topics` SET `order_index` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?', [i + 1, ids[i]]);
    }
    return res.status(200).json({ ok: true });
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.post('/topics/:id/publish', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id)) return httpErr(res, 400, 'BAD_INPUT');
    const row = await loadTopicOwned(req, res, id);
    if (!row) return;
    const classIds: string[] | null = Array.isArray(req.body?.classIds)
      ? req.body.classIds.map(String)
      : Array.isArray(req.body?.class_ids)
        ? req.body.class_ids.map(String)
        : null;
    // Publish topic KHÔNG tự publish con.
    const v = parseJson<any>(row.video_payload, {});
    if (classIds) v.class_ids = classIds;
    v.has_unpublished_edits = false;
    v.published_at = new Date().toISOString();
    await execute('UPDATE `topics` SET `status` = ?, `video_payload` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?', [
      'published',
      JSON.stringify(v),
      id,
    ]);
    const fresh = await query<any>('SELECT * FROM `topics` WHERE `id` = ? LIMIT 1', [id]);
    return res.status(200).json(toTopic(fresh[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.post('/topics/:id/unpublish', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id)) return httpErr(res, 400, 'BAD_INPUT');
    const row = await loadTopicOwned(req, res, id);
    if (!row) return;
    await execute('UPDATE `topics` SET `status` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?', ['draft', id]);
    const fresh = await query<any>('SELECT * FROM `topics` WHERE `id` = ? LIMIT 1', [id]);
    return res.status(200).json(toTopic(fresh[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.post('/topics/:id/archive', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id)) return httpErr(res, 400, 'BAD_INPUT');
    const row = await loadTopicOwned(req, res, id);
    if (!row) return;
    await execute('UPDATE `topics` SET `status` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?', ['archived', id]);
    const fresh = await query<any>('SELECT * FROM `topics` WHERE `id` = ? LIMIT 1', [id]);
    return res.status(200).json(toTopic(fresh[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

// ================= VIDEOS / THEORIES (payload tables) =================
function payloadListHandler(table: string) {
  return async (req: Request, res: Response) => {
    try {
      const { role } = callerInfo(req);
      const topicFilter = req.query.topic_id ? String(req.query.topic_id) : '';
      let rows: any[];
      if (role === 'admin') {
        rows = await query<any>(`SELECT * FROM \`${table}\` WHERE \`deleted_at\` IS NULL`);
      } else if (role === 'teacher') {
        const teacherId = await callerTeacherId(req);
        rows = teacherId
          ? await query<any>(`SELECT * FROM \`${table}\` WHERE \`teacher_id\` = ? AND \`deleted_at\` IS NULL`, [teacherId])
          : [];
      } else if (role === 'student') {
        const ctx = await callerStudentCtx(req);
        rows = ctx.teacherId
          ? await query<any>(`SELECT * FROM \`${table}\` WHERE \`teacher_id\` = ? AND \`status\` = 'published' AND \`deleted_at\` IS NULL`, [ctx.teacherId])
          : [];
      } else {
        return httpErr(res, 403, 'FORBIDDEN');
      }
      let list = rows.map(toPayloadItem);
      if (topicFilter) list = list.filter((x) => String(x.topicId || '') === topicFilter);
      if (role === 'student') {
        const ctx = await callerStudentCtx(req);
        list = list.filter((x) => visibleToStudent(x, ctx.classId));
      } else {
        list = applyListFilters(list, req, false);
      }
      return res.status(200).json(list);
    } catch {
      return httpErr(res, 500, 'SERVER_ERROR');
    }
  };
}

function payloadGetHandler(table: string) {
  return async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (badId(id) || id.length > 191) return httpErr(res, 400, 'BAD_INPUT');
      const { role } = callerInfo(req);
      const rows = await query<any>(`SELECT * FROM \`${table}\` WHERE \`id\` = ? LIMIT 1`, [id]);
      const row = rows[0];
      if (!row || row.deleted_at) return httpErr(res, 404, 'NOT_FOUND');
      if (role === 'admin') return res.status(200).json(toPayloadItem(row));
      if (role === 'teacher') {
        const teacherId = await callerTeacherId(req);
        if (String(row.teacher_id) !== teacherId) return httpErr(res, 403, 'FORBIDDEN');
        return res.status(200).json(toPayloadItem(row));
      }
      if (role === 'student') {
        const ctx = await callerStudentCtx(req);
        const item = toPayloadItem(row);
        if (String(row.teacher_id) !== ctx.teacherId || !visibleToStudent(item, ctx.classId)) {
          return httpErr(res, 404, 'NOT_FOUND');
        }
        return res.status(200).json(item);
      }
      return httpErr(res, 403, 'FORBIDDEN');
    } catch {
      return httpErr(res, 500, 'SERVER_ERROR');
    }
  };
}

function payloadCreateHandler(table: string, prefix: string) {
  return async (req: Request, res: Response) => {
    try {
      const { role } = callerInfo(req);
      if (role === 'student') return httpErr(res, 403, 'FORBIDDEN');
      const body: any = req.body || {};
      let teacherId: string;
      if (role === 'teacher') {
        teacherId = await callerTeacherId(req);
        if (!teacherId) return httpErr(res, 403, 'FORBIDDEN');
      } else if (role === 'admin') {
        teacherId = String(body.teacher_id || body.teacherId || '');
        if (!teacherId) return httpErr(res, 400, 'BAD_INPUT');
      } else {
        return httpErr(res, 403, 'FORBIDDEN');
      }
      if (badId(teacherId)) return httpErr(res, 400, 'BAD_INPUT');
      const id = String(body.id || `${prefix}_${Date.now()}`);
      if (id.length > 191 || badId(id)) return httpErr(res, 400, 'BAD_INPUT');
      if (body.id) {
        const existing = await query<any>(`SELECT \`teacher_id\`, \`deleted_at\` FROM \`${table}\` WHERE \`id\` = ? LIMIT 1`, [id]);
        if (existing[0] && role === 'teacher' && String(existing[0].teacher_id) !== teacherId) {
          return httpErr(res, 403, 'FORBIDDEN');
        }
      }
      const topicId = body.topicId || body.topic_id || body.payload?.topicId || null;
      if (!(await checkTopicOwnedForWrite(req, res, topicId ? String(topicId) : null))) return;
      const status = body.status || body.payload?.status || 'draft';
      if (!['draft', 'published', 'archived'].includes(String(status))) return httpErr(res, 400, 'BAD_INPUT');
      const item = { ...body, ...(body.payload || {}), id, topicId: topicId || undefined, status, teacher_id: teacherId };
      if (!item.class_ids) item.class_ids = ['all'];
      await execute(
        `INSERT INTO \`${table}\` (\`id\`, \`topic_id\`, \`status\`, \`payload\`, \`teacher_id\`) VALUES (?, ?, ?, ?, ?) ` +
          'ON DUPLICATE KEY UPDATE `topic_id` = VALUES(`topic_id`), `status` = VALUES(`status`), `payload` = VALUES(`payload`), `teacher_id` = VALUES(`teacher_id`), `updated_at` = UTC_TIMESTAMP()',
        [id, topicId ? String(topicId) : null, status, JSON.stringify(item), teacherId]
      );
      const rows = await query<any>(`SELECT * FROM \`${table}\` WHERE \`id\` = ? LIMIT 1`, [id]);
      return res.status(200).json(toPayloadItem(rows[0]));
    } catch {
      return httpErr(res, 500, 'SERVER_ERROR');
    }
  };
}

function payloadPatchHandler(table: string) {
  return async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (badId(id) || id.length > 191) return httpErr(res, 400, 'BAD_INPUT');
      const row = await loadPayloadOwned(req, res, table, id);
      if (!row) return;
      const body: any = req.body || {};
      const current = toPayloadItem(row);
      const merged = { ...current, ...body, ...(body.payload || {}), id };
      const topicId = merged.topicId ?? merged.topic_id ?? null;
      if (!(await checkTopicOwnedForWrite(req, res, topicId ? String(topicId) : null))) return;
      const status = merged.status || row.status || 'draft';
      if (!['draft', 'published', 'archived'].includes(String(status))) return httpErr(res, 400, 'BAD_INPUT');
      await execute(`UPDATE \`${table}\` SET \`topic_id\` = ?, \`status\` = ?, \`payload\` = ?, \`updated_at\` = UTC_TIMESTAMP() WHERE \`id\` = ?`, [
        topicId ? String(topicId) : null,
        status,
        JSON.stringify(merged),
        id,
      ]);
      const fresh = await query<any>(`SELECT * FROM \`${table}\` WHERE \`id\` = ? LIMIT 1`, [id]);
      return res.status(200).json(toPayloadItem(fresh[0]));
    } catch {
      return httpErr(res, 500, 'SERVER_ERROR');
    }
  };
}

function payloadDeleteHandler(table: string) {
  return async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (badId(id) || id.length > 191) return httpErr(res, 400, 'BAD_INPUT');
      const row = await loadPayloadOwned(req, res, table, id);
      if (!row) return;
      await execute(`UPDATE \`${table}\` SET \`deleted_at\` = UTC_TIMESTAMP(), \`updated_at\` = UTC_TIMESTAMP() WHERE \`id\` = ?`, [id]);
      return res.status(200).json({ ok: true });
    } catch {
      return httpErr(res, 500, 'SERVER_ERROR');
    }
  };
}

function payloadPublishHandler(table: string, autoPublishParent: boolean) {
  return async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (badId(id) || id.length > 191) return httpErr(res, 400, 'BAD_INPUT');
      const row = await loadPayloadOwned(req, res, table, id);
      if (!row) return;
      const classIds: string[] | null = Array.isArray(req.body?.classIds)
        ? req.body.classIds.map(String)
        : Array.isArray(req.body?.class_ids)
          ? req.body.class_ids.map(String)
          : null;
      const out = await publishPayloadRow(table, row, classIds, autoPublishParent);
      return res.status(200).json(out);
    } catch {
      return httpErr(res, 500, 'SERVER_ERROR');
    }
  };
}

function payloadStatusHandler(table: string, status: string) {
  return async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (badId(id) || id.length > 191) return httpErr(res, 400, 'BAD_INPUT');
      const row = await loadPayloadOwned(req, res, table, id);
      if (!row) return;
      const out = await setPayloadStatus(table, row, status);
      return res.status(200).json(out);
    } catch {
      return httpErr(res, 500, 'SERVER_ERROR');
    }
  };
}

contentRouter.get('/videos', payloadListHandler('video_lessons'));
contentRouter.get('/videos/:id', payloadGetHandler('video_lessons'));
contentRouter.post('/videos', payloadCreateHandler('video_lessons', 'video'));
contentRouter.patch('/videos/:id', payloadPatchHandler('video_lessons'));
contentRouter.post('/videos/:id/delete', payloadDeleteHandler('video_lessons'));
contentRouter.post('/videos/:id/publish', payloadPublishHandler('video_lessons', true));
contentRouter.post('/videos/:id/unpublish', payloadStatusHandler('video_lessons', 'draft'));
contentRouter.post('/videos/:id/archive', payloadStatusHandler('video_lessons', 'archived'));

contentRouter.get('/theories', payloadListHandler('theory_lessons'));
contentRouter.get('/theories/:id', payloadGetHandler('theory_lessons'));
contentRouter.post('/theories', payloadCreateHandler('theory_lessons', 'theory'));
contentRouter.patch('/theories/:id', payloadPatchHandler('theory_lessons'));
contentRouter.post('/theories/:id/delete', payloadDeleteHandler('theory_lessons'));
contentRouter.post('/theories/:id/publish', payloadPublishHandler('theory_lessons', true));
contentRouter.post('/theories/:id/unpublish', payloadStatusHandler('theory_lessons', 'draft'));
contentRouter.post('/theories/:id/archive', payloadStatusHandler('theory_lessons', 'archived'));

// ================= QUIZZES =================
contentRouter.get('/quizzes', payloadListHandler('quizzes'));
contentRouter.get('/quizzes/:id', payloadGetHandler('quizzes'));
contentRouter.post('/quizzes', payloadCreateHandler('quizzes', 'quiz'));
contentRouter.patch('/quizzes/:id', payloadPatchHandler('quizzes'));
contentRouter.post('/quizzes/:id/delete', payloadDeleteHandler('quizzes'));
contentRouter.post('/quizzes/:id/publish', payloadPublishHandler('quizzes', true));
contentRouter.post('/quizzes/:id/unpublish', payloadStatusHandler('quizzes', 'draft'));
contentRouter.post('/quizzes/:id/archive', payloadStatusHandler('quizzes', 'archived'));

contentRouter.post('/quizzes/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id) || id.length > 191) return httpErr(res, 400, 'BAD_INPUT');
    const row = await loadPayloadOwned(req, res, 'quizzes', id);
    if (!row) return;
    const { role } = callerInfo(req);
    // Bản sao mang teacher_id của người nhân bản, status về draft.
    const duplicatorId = role === 'teacher' ? await callerTeacherId(req) : String(req.body?.teacher_id || req.body?.teacherId || '') || (await callerTeacherId(req));
    if (!duplicatorId || badId(duplicatorId)) return httpErr(res, 400, 'BAD_INPUT');
    const original = toPayloadItem(row);
    const newQuizId = `quiz_${randomUUID()}`;
    const clonedQuestionIds: string[] = [];
    const questionIds: string[] = Array.isArray(original.questionIds) ? original.questionIds : [];
    const cloned = await withTransaction(async (db) => {
      for (const qId of questionIds) {
        const qRows = await db.query<any>('SELECT * FROM `questions` WHERE `id` = ? LIMIT 1', [String(qId)]);
        const qRow = qRows[0];
        if (!qRow) continue;
        const q = toQuestion(qRow);
        const newQId = `q_${randomUUID()}`;
        if (newQId.length > 100) continue;
        const qPayload = { ...q, id: newQId, teacher_id: duplicatorId, status: 'draft' };
        await db.execute(
          'INSERT INTO `questions` (`id`, `topic_id`, `type`, `level`, `prompt`, `options`, `correct_answer`, `explanation`, `teacher_id`, `payload`, `max_score`, `grading_method`, `difficulty`) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            newQId,
            qRow.topic_id || null,
            qRow.type,
            qRow.level,
            qRow.prompt,
            qRow.options === null || qRow.options === undefined ? null : typeof qRow.options === 'string' ? qRow.options : JSON.stringify(qRow.options),
            qRow.correct_answer === null || qRow.correct_answer === undefined ? null : typeof qRow.correct_answer === 'string' ? qRow.correct_answer : JSON.stringify(qRow.correct_answer),
            qRow.explanation || '',
            duplicatorId,
            JSON.stringify(qPayload),
            qRow.max_score ?? null,
            qRow.grading_method ?? (qRow.type === 'essay' ? 'TEACHER' : 'AUTO'),
            qRow.difficulty ?? null,
          ]
        );
        clonedQuestionIds.push(newQId);
      }
      const quizPayload = {
        ...original,
        id: newQuizId,
        title: `${original.title || 'Bài tập'} (Bản sao)`,
        questionIds: clonedQuestionIds,
        status: 'draft',
        version: 1,
        has_unpublished_edits: false,
        teacher_id: duplicatorId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      delete (quizPayload as any).published_at;
      await db.execute(
        'INSERT INTO `quizzes` (`id`, `topic_id`, `status`, `payload`, `teacher_id`) VALUES (?, ?, ?, ?, ?)',
        [newQuizId, original.topicId ? String(original.topicId) : null, 'draft', JSON.stringify(quizPayload), duplicatorId]
      );
      const r = await db.query<any>('SELECT * FROM `quizzes` WHERE `id` = ? LIMIT 1', [newQuizId]);
      return r[0];
    });
    if (!cloned) return httpErr(res, 500, 'SERVER_ERROR');
    return res.status(200).json(toPayloadItem(cloned));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

// ================= QUESTIONS =================
contentRouter.get('/questions', async (req: Request, res: Response) => {
  try {
    const { role, classId } = callerInfo(req);
    if (role === 'student') {
      // GĐ3 tích hợp — SỬA HỒI QUY: App tải rawQuestions cho HS qua
      // quizService.getQuestions() (không lọc topic); chặn 403 ở đây
      // làm QuizRunner rơi về cache localStorage cũ. HS chỉ thấy câu
      // hỏi thuộc chủ đề published + đúng lớp mình (class_ids chứa
      // lớp em hoặc 'all'); câu không gắn chủ đề published thì loại.
      // QuizRunner chấm local nên cần cả đáp án như luồng cũ.
      if (!classId) return httpErr(res, 403, 'FORBIDDEN');
      const topics = await query<any>(
        'SELECT `id`, `video_payload` FROM `topics` WHERE `status` = ? AND `deleted_at` IS NULL',
        ['published']
      );
      const visible: string[] = [];
      for (const t of topics) {
        const p: any = parseJson<any>(t.video_payload, {});
        const ids: string[] = Array.isArray(p.class_ids) ? p.class_ids : ['all'];
        if (ids.includes('all') || ids.includes(classId)) visible.push(t.id);
      }
      if (!visible.length) return res.status(200).json({});
      const rows = await query<any>(
        `SELECT * FROM \`questions\` WHERE \`topic_id\` IN (${visible.map(() => '?').join(',')})`,
        visible
      );
      const out: Record<string, any> = {};
      for (const r of rows) out[r.id] = toQuestion(r);
      return res.status(200).json(out);
    }
    const topicId = req.query.topic_id ? String(req.query.topic_id) : '';
    if (role === 'teacher') {
      const teacherId = await callerTeacherId(req);
      if (!teacherId) return res.status(200).json({});
      if (topicId) {
        // Ngân hàng theo chủ đề: kiểm tra topics.teacher_id (task yêu cầu).
        const tRows = await query<any>('SELECT `teacher_id` FROM `topics` WHERE `id` = ? LIMIT 1', [topicId]);
        if (!tRows[0]) return httpErr(res, 404, 'NOT_FOUND');
        if (String(tRows[0].teacher_id) !== teacherId) return httpErr(res, 403, 'FORBIDDEN');
      }
      // Như code gốc: câu của mình HOẶC thuộc chủ đề của mình.
      const myTopics = await query<any>('SELECT `id` FROM `topics` WHERE `teacher_id` = ?', [teacherId]);
      const myTopicIds = new Set(myTopics.map((t: any) => String(t.id)));
      let rows = await query<any>('SELECT * FROM `questions` WHERE `teacher_id` = ?', [teacherId]);
      if (myTopicIds.size) {
        const placeholders = [...myTopicIds].map(() => '?').join(',');
        const extra = await query<any>(`SELECT * FROM \`questions\` WHERE \`topic_id\` IN (${placeholders})`, [...myTopicIds]);
        const seen = new Set(rows.map((r: any) => r.id));
        for (const r of extra) if (!seen.has(r.id)) rows.push(r);
      }
      if (topicId && topicId !== 'all') {
        rows = rows.filter((r: any) => r.topic_id === topicId || r.topic_id === null);
      }
      const out: Record<string, any> = {};
      for (const r of rows) out[r.id] = toQuestion(r);
      return res.status(200).json(out);
    }
    if (role === 'admin') {
      let rows: any[];
      if (topicId && topicId !== 'all') {
        rows = await query<any>('SELECT * FROM `questions` WHERE `topic_id` = ? OR `topic_id` IS NULL', [topicId]);
      } else {
        rows = await query<any>('SELECT * FROM `questions`');
      }
      const out: Record<string, any> = {};
      for (const r of rows) out[r.id] = toQuestion(r);
      return res.status(200).json(out);
    }
    return httpErr(res, 403, 'FORBIDDEN');
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.get('/questions/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id) || id.length > 100) return httpErr(res, 400, 'BAD_INPUT');
    const { role } = callerInfo(req);
    // Không chặn HS sớm ở đây — nhánh student có kiểm tra phạm vi riêng bên dưới.
    const rows = await query<any>('SELECT * FROM `questions` WHERE `id` = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return httpErr(res, 404, 'NOT_FOUND');
    if (role === 'student') {
      // Cùng phạm vi như GET /questions: câu thuộc chủ đề published +
      // đúng lớp học sinh. Không gắn chủ đề published → 403.
      const { classId } = callerInfo(req);
      const p: any = parseJson<any>(row.payload, {});
      const topicId = row.topic_id || p.topicId || '';
      const tRows = topicId
        ? await query<any>('SELECT `status`, `video_payload`, `deleted_at` FROM `topics` WHERE `id` = ? LIMIT 1', [topicId])
        : [];
      const t = tRows[0];
      const ids: string[] = t ? (Array.isArray(parseJson<any>(t.video_payload, {}).class_ids) ? parseJson<any>(t.video_payload, {}).class_ids : ['all']) : [];
      if (!t || t.deleted_at || t.status !== 'published' || !classId || (!ids.includes('all') && !ids.includes(classId))) {
        return httpErr(res, 403, 'FORBIDDEN');
      }
      return res.status(200).json(toQuestion(row));
    }
    if (role === 'teacher') {
      const teacherId = await callerTeacherId(req);
      let owned = String(row.teacher_id) === teacherId;
      if (!owned && row.topic_id && !isSentinelId(String(row.topic_id))) {
        const owner = await topicTeacherId(db, String(row.topic_id));
        owned = !!owner && String(owner) === teacherId;
      }
      if (!owned) return httpErr(res, 403, 'FORBIDDEN');
    } else if (role !== 'admin') {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    return res.status(200).json(toQuestion(row));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.post('/questions', async (req: Request, res: Response) => {
  try {
    const { role } = callerInfo(req);
    if (role === 'student') return httpErr(res, 403, 'FORBIDDEN');
    const body: any = req.body || {};
    let teacherId: string;
    if (role === 'teacher') {
      teacherId = await callerTeacherId(req);
      if (!teacherId) return httpErr(res, 403, 'FORBIDDEN');
    } else if (role === 'admin') {
      teacherId = String(body.teacher_id || body.teacherId || '');
      if (!teacherId) return httpErr(res, 400, 'BAD_INPUT');
    } else {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    if (badId(teacherId)) return httpErr(res, 400, 'BAD_INPUT');
    const id = String(body.id || `q_ai_${Date.now()}${Math.random().toString(36).slice(2, 6)}`);
    if (id.length > 100 || badId(id)) return httpErr(res, 400, 'BAD_INPUT');
    if (body.id) {
      const existing = await query<any>('SELECT `teacher_id`, `topic_id` FROM `questions` WHERE `id` = ? LIMIT 1', [id]);
      if (existing[0] && role === 'teacher') {
        let owned = String(existing[0].teacher_id) === teacherId;
        if (!owned && existing[0].topic_id && !isSentinelId(String(existing[0].topic_id))) {
          const owner = await topicTeacherId(db, String(existing[0].topic_id));
          owned = !!owner && String(owner) === teacherId;
        }
        if (!owned) return httpErr(res, 403, 'FORBIDDEN');
      }
    }
    // Chuẩn hóa topic_id như saveQuestion gốc: 'all'/topic mẫu → null;
    // topic không tồn tại → null; topic của giáo viên khác → 403.
    // Chuỗi rỗng cũng là "không có chủ đề" (ngân hàng câu hỏi gửi
    // topicId: ''): để '' lọt xuống INSERT sẽ vi phạm FK
    // questions_topic_id_fkey → 500 (lỗi 2026-10-28).
    let topicId: string | null = body.topicId ?? body.topic_id ?? body.payload?.topicId ?? null;
    if (topicId) topicId = String(topicId);
    if (!topicId || topicId === 'all' || topicId === 'topic_1' || topicId === 'topic_tho_bon_nam') topicId = null;
    if (topicId) {
      if (badId(topicId)) return httpErr(res, 400, 'BAD_INPUT');
      const tRows = await query<any>('SELECT `teacher_id` FROM `topics` WHERE `id` = ? LIMIT 1', [topicId]);
      if (!tRows[0]) {
        topicId = null;
      } else if (role === 'teacher' && String(tRows[0].teacher_id) !== teacherId) {
        return httpErr(res, 403, 'FORBIDDEN');
      }
    }
    const typeRaw = String(body.type || body.payload?.type || 'single');
    const dbType = DB_TYPE[typeRaw] || typeRaw;
    if (!['single_choice', 'multiple_choice', 'fill_in_blank', 'essay'].includes(dbType)) {
      return httpErr(res, 400, 'BAD_INPUT');
    }
    const full: any = {
      ...(body.payload || {}),
      ...body,
      id,
      topicId: topicId || 'topic_1',
      type: APP_TYPE[dbType] || dbType,
      level: body.level || body.payload?.level || 'NHAN_BIET',
      prompt: body.prompt || body.payload?.prompt || 'Câu hỏi chưa có tiêu đề',
      options: Array.isArray(body.options) ? body.options : Array.isArray(body.payload?.options) ? body.payload.options : [],
      answer: body.answer ?? body.correct_answer ?? body.payload?.answer ?? null,
      explanation: body.explanation ?? body.payload?.explanation ?? '',
      points: body.points ?? body.payload?.points ?? 10,
      status: body.status || body.payload?.status || 'published',
      class_ids: body.class_ids || body.payload?.class_ids || ['all'],
      teacher_id: teacherId,
    };
    await execute(
      'INSERT INTO `questions` (`id`, `topic_id`, `type`, `level`, `prompt`, `options`, `correct_answer`, `explanation`, `teacher_id`, `payload`, `max_score`, `grading_method`, `difficulty`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `topic_id` = VALUES(`topic_id`), `type` = VALUES(`type`), `level` = VALUES(`level`), `prompt` = VALUES(`prompt`), `options` = VALUES(`options`), `correct_answer` = VALUES(`correct_answer`), `explanation` = VALUES(`explanation`), `teacher_id` = VALUES(`teacher_id`), `payload` = VALUES(`payload`), `max_score` = VALUES(`max_score`), `grading_method` = VALUES(`grading_method`), `difficulty` = VALUES(`difficulty`), `updated_at` = UTC_TIMESTAMP()',
      [
        id,
        topicId,
        dbType,
        full.level,
        full.prompt,
        JSON.stringify(full.options),
        full.answer === null || full.answer === undefined ? null : JSON.stringify(full.answer),
        full.explanation,
        teacherId,
        JSON.stringify(full),
        body.max_score ?? body.payload?.max_score ?? null,
        body.grading_method ?? body.payload?.grading_method ?? (dbType === 'essay' ? 'TEACHER' : 'AUTO'),
        body.difficulty ?? body.payload?.difficulty ?? null,
      ]
    );
    const rows = await query<any>('SELECT * FROM `questions` WHERE `id` = ? LIMIT 1', [id]);
    return res.status(200).json(toQuestion(rows[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.patch('/questions/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id) || id.length > 100) return httpErr(res, 400, 'BAD_INPUT');
    const { role } = callerInfo(req);
    if (role === 'student') return httpErr(res, 403, 'FORBIDDEN');
    const rows = await query<any>('SELECT * FROM `questions` WHERE `id` = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return httpErr(res, 404, 'NOT_FOUND');
    let teacherId: string;
    if (role === 'teacher') {
      teacherId = await callerTeacherId(req);
      let owned = String(row.teacher_id) === teacherId;
      if (!owned && row.topic_id && !isSentinelId(String(row.topic_id))) {
        const owner = await topicTeacherId(db, String(row.topic_id));
        owned = !!owner && String(owner) === teacherId;
      }
      if (!owned) return httpErr(res, 403, 'FORBIDDEN');
    } else if (role === 'admin') {
      teacherId = String(row.teacher_id || '');
    } else {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    const body: any = req.body || {};
    const current = toQuestion(row);
    const merged: any = { ...current, ...body, ...(body.payload || {}), id };
    let topicId: string | null = merged.topicId ?? merged.topic_id ?? row.topic_id;
    if (topicId) topicId = String(topicId);
    if (!topicId || topicId === 'all' || topicId === 'topic_1' || topicId === 'topic_tho_bon_nam') topicId = null;
    if (topicId) {
      const tRows = await query<any>('SELECT `teacher_id` FROM `topics` WHERE `id` = ? LIMIT 1', [topicId]);
      if (!tRows[0]) topicId = null;
      else if (role === 'teacher' && String(tRows[0].teacher_id) !== teacherId) return httpErr(res, 403, 'FORBIDDEN');
    }
    const typeRaw = String(merged.type || 'single');
    const dbType = DB_TYPE[typeRaw] || typeRaw;
    if (!['single_choice', 'multiple_choice', 'fill_in_blank', 'essay'].includes(dbType)) {
      return httpErr(res, 400, 'BAD_INPUT');
    }
    const answer = merged.answer ?? merged.correct_answer ?? null;
    await execute(
      'UPDATE `questions` SET `topic_id` = ?, `type` = ?, `level` = ?, `prompt` = ?, `options` = ?, `correct_answer` = ?, `explanation` = ?, `payload` = ?, `max_score` = ?, `grading_method` = ?, `difficulty` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?',
      [
        topicId,
        dbType,
        merged.level || 'NHAN_BIET',
        merged.prompt || 'Câu hỏi chưa có tiêu đề',
        JSON.stringify(Array.isArray(merged.options) ? merged.options : []),
        answer === null || answer === undefined ? null : JSON.stringify(answer),
        merged.explanation || '',
        JSON.stringify({ ...merged, topicId: topicId || 'topic_1', type: APP_TYPE[dbType] || dbType }),
        merged.max_score ?? row.max_score ?? null,
        merged.grading_method ?? row.grading_method ?? null,
        merged.difficulty ?? row.difficulty ?? null,
        id,
      ]
    );
    const fresh = await query<any>('SELECT * FROM `questions` WHERE `id` = ? LIMIT 1', [id]);
    return res.status(200).json(toQuestion(fresh[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

contentRouter.delete('/questions/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (badId(id) || id.length > 100) return httpErr(res, 400, 'BAD_INPUT');
    const { role } = callerInfo(req);
    if (role === 'student') return httpErr(res, 403, 'FORBIDDEN');
    const rows = await query<any>('SELECT * FROM `questions` WHERE `id` = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return httpErr(res, 404, 'NOT_FOUND');
    if (role === 'teacher') {
      const teacherId = await callerTeacherId(req);
      let owned = String(row.teacher_id) === teacherId;
      if (!owned && row.topic_id && !isSentinelId(String(row.topic_id))) {
        const owner = await topicTeacherId(db, String(row.topic_id));
        owned = !!owner && String(owner) === teacherId;
      }
      if (!owned) return httpErr(res, 403, 'FORBIDDEN');
    } else if (role !== 'admin') {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    // Hard-delete như deleteQuestion gốc (khác luật soft-delete nội dung).
    await execute('DELETE FROM `questions` WHERE `id` = ?', [id]);
    return res.status(200).json({ ok: true });
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});
