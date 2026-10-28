/**
 * Router nhóm B — nguồn tài liệu của Mầm AI Studio, lưu ở DATABASE
 * (28/10, theo lệnh chủ dự án: dữ liệu giáo viên đưa lên phải nằm trong
 * database, không chỉ localStorage trình duyệt — lúc đầu chỉ file
 * pdf/docx/txt, sau đó mở rộng ra TẤT CẢ nguồn: dán văn bản, bản ghi, file).
 * Mount tại /api.
 * - GET /ai-sources?topicId=... (teacher: chỉ nguồn của mình; admin: ?teacher_id=)
 * - POST /ai-sources (upsert theo id client gửi; teacher_id ÉP từ JWT)
 * - PATCH /ai-sources/:id (đổi isEnabled/title; chỉ sửa nguồn của mình)
 * - DELETE /ai-sources/:id (chỉ xóa nguồn của mình)
 *
 * Chủ đề phải thuộc về giáo viên gọi (admin xem tất).
 * DDL bảng ai_sources: xem hidden_files/ai_sources_ddl.sql (goal Mầm Văn).
 */
import { Router } from 'express';
import { query, execute } from '../_lib/mysql';
import { requireAuth, requireRole, httpErr } from '../_lib/auth';
import type { AuthedRequest } from '../_lib/auth';
import { bodyOf, checkKeyLen, isAdmin, isTeacher, ah } from './_shared';

export const aiSourcesRouter = Router();
aiSourcesRouter.use(requireAuth);

/** Nội dung trích tối đa server nhận — client đã cắt 100.000, server nới thêm để không vỡ khi client đổi giới hạn. */
const MAX_SERVER_CONTENT_CHARS = 200000;

function resolveTeacherId(caller: any, queryTeacherId?: string): string | null {
  if (isAdmin(caller)) return typeof queryTeacherId === 'string' && queryTeacherId ? queryTeacherId : null;
  if (isTeacher(caller)) return caller.teacherId || null;
  return null;
}

const VALID_SOURCE_TYPES = new Set(['text', 'file', 'transcript']);

function mapSourceRow(row: any): any {
  return {
    id: row.id,
    title: row.title,
    type: VALID_SOURCE_TYPES.has(row.type) ? row.type : 'file',
    content: typeof row.content === 'string' ? row.content : '',
    wordCount: typeof row.word_count === 'number' ? row.word_count : Number(row.word_count) || 0,
    isEnabled: !!row.is_enabled,
    fileName: row.file_name || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    topicId: row.topic_id,
  };
}

async function topicOwnerId(topicId: string): Promise<string | null> {
  const rows = await query('SELECT `teacher_id` FROM `topics` WHERE `id` = ? LIMIT 1', [topicId]);
  const row = (rows as any[])[0];
  return row ? String(row.teacher_id) : null;
}

aiSourcesRouter.get(
  '/ai-sources',
  requireRole('teacher', 'admin'),
  ah(async (req: AuthedRequest, res) => {
    const teacherId = resolveTeacherId(req.caller!, req.query.teacher_id as string);
    const topicId = req.query.topicId as string;
    if (!teacherId || !topicId) {
      // Thiếu phạm vi (admin không gửi teacher_id, hoặc không gửi topicId)
      // thì trả rỗng thay vì lộ nguồn của giáo viên khác.
      res.json([]);
      return;
    }
    const rows = await query(
      'SELECT * FROM `ai_sources` WHERE `teacher_id` = ? AND `topic_id` = ? ORDER BY `created_at` ASC',
      [teacherId, topicId]
    );
    res.json((rows as any[]).map(mapSourceRow));
  })
);

aiSourcesRouter.post(
  '/ai-sources',
  requireRole('teacher', 'admin'),
  ah(async (req: AuthedRequest, res) => {
    const caller = req.caller!;
    // teacher_id LUÔN ép từ JWT — client gửi gì cũng bỏ qua (admin cũng có
    // teacher profile riêng nên cùng một luật).
    const teacherId = caller.teacherId || null;
    if (!teacherId) {
      httpErr(res, 401, 'UNAUTHORIZED');
      return;
    }
    const body = bodyOf(req);
    const id = body.id;
    const topicId = body.topicId;
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
    const content = typeof body.content === 'string' ? body.content : null;
    if (!checkKeyLen(res, id) || !checkKeyLen(res, topicId)) return;
    if (!id || !topicId || !title || content === null) {
      httpErr(res, 400, 'BAD_INPUT');
      return;
    }
    if (content.length > MAX_SERVER_CONTENT_CHARS) {
      httpErr(res, 400, 'BAD_INPUT');
      return;
    }
    const owner = await topicOwnerId(topicId);
    if (owner === null) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    if (!isAdmin(caller) && owner !== teacherId) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
    const fileName = typeof body.fileName === 'string' ? body.fileName.slice(0, 255) : null;
    const wordCount = Number(body.wordCount) || 0;
    const isEnabled = body.isEnabled === undefined ? 1 : body.isEnabled ? 1 : 0;
    const type = VALID_SOURCE_TYPES.has(body.type) ? body.type : 'file';
    await execute(
      'INSERT INTO `ai_sources` (`id`, `teacher_id`, `topic_id`, `title`, `type`, `content`, `file_name`, `word_count`, `is_enabled`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `type` = VALUES(`type`), `content` = VALUES(`content`), ' +
        '`file_name` = VALUES(`file_name`), `word_count` = VALUES(`word_count`), `is_enabled` = VALUES(`is_enabled`)',
      [id, teacherId, topicId, title, type, content, fileName, wordCount, isEnabled]
    );
    res.json({ ok: true, id });
  })
);

aiSourcesRouter.patch(
  '/ai-sources/:id',
  requireRole('teacher', 'admin'),
  ah(async (req: AuthedRequest, res) => {
    const caller = req.caller!;
    const teacherId = caller.teacherId || null;
    if (!teacherId) {
      httpErr(res, 401, 'UNAUTHORIZED');
      return;
    }
    const id = req.params.id;
    if (!checkKeyLen(res, id)) return;
    const rows = await query('SELECT `teacher_id` FROM `ai_sources` WHERE `id` = ? LIMIT 1', [id]);
    const row = (rows as any[])[0];
    // Không tồn tại hoặc không phải của mình đều 404 — không lộ sự tồn tại.
    if (!row || (!isAdmin(caller) && String(row.teacher_id) !== teacherId)) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    const body = bodyOf(req);
    const sets: string[] = [];
    const params: any[] = [];
    if (body.isEnabled !== undefined) {
      sets.push('`is_enabled` = ?');
      params.push(body.isEnabled ? 1 : 0);
    }
    if (typeof body.title === 'string' && body.title.trim()) {
      sets.push('`title` = ?');
      params.push(body.title.trim());
    }
    if (sets.length === 0) {
      httpErr(res, 400, 'BAD_INPUT');
      return;
    }
    params.push(id);
    await execute(`UPDATE \`ai_sources\` SET ${sets.join(', ')} WHERE \`id\` = ?`, params);
    res.json({ ok: true, id });
  })
);

aiSourcesRouter.delete(
  '/ai-sources/:id',
  requireRole('teacher', 'admin'),
  ah(async (req: AuthedRequest, res) => {
    const caller = req.caller!;
    const teacherId = caller.teacherId || null;
    if (!teacherId) {
      httpErr(res, 401, 'UNAUTHORIZED');
      return;
    }
    const id = req.params.id;
    if (!checkKeyLen(res, id)) return;
    const rows = await query('SELECT `teacher_id` FROM `ai_sources` WHERE `id` = ? LIMIT 1', [id]);
    const row = (rows as any[])[0];
    if (!row || (!isAdmin(caller) && String(row.teacher_id) !== teacherId)) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    await execute('DELETE FROM `ai_sources` WHERE `id` = ?', [id]);
    res.json({ ok: true, id });
  })
);
