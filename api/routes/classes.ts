import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { query, execute } from '../_lib/mysql';
import { requireAuth, httpErr } from '../_lib/auth';
import { isSentinelId } from '../_lib/scope';

/**
 * GET /classes, GET /classes/:id, POST /classes, PATCH /classes/:id,
 * POST /classes/:id/archive. Mount tại /api.
 *
 * archiveClass gốc đã xác nhận: SupabaseClassRepository.archiveClass(id)
 * = updateClass(id, { status: 'archived' }) — tức UPDATE classes SET
 * status='archived'. Không còn TODO ở endpoint này.
 *
 * Phân quyền: teacher chỉ lớp mình (teacher_id = caller), admin tất cả,
 * student chỉ lớp mình (đọc). Server ép teacher_id lúc tạo, bỏ qua giá
 * trị client gửi (teacher); admin được chỉ định teacher_id nhưng phải là
 * giáo viên đã tồn tại, nếu không → 400.
 * Lớp không có cột deleted_at trong DDL MySQL nên response luôn trả
 * deleted_at: null (khớp ClassItem nhưng không có cột thật để đọc).
 */

function callerInfo(req: Request): { userId: string; role: string; teacherId: string } {
  const c: any = (req as any).caller;
  return {
    userId: String(c?.userId ?? c?.id ?? c?.sub ?? ''),
    role: String(c?.role || ''),
    teacherId: String(c?.teacherId ?? c?.profileId ?? ''),
  };
}

async function callerTeacherId(req: Request): Promise<string> {
  const info = callerInfo(req);
  if (info.teacherId) return info.teacherId;
  if (!info.userId) return '';
  const rows = await query<any>('SELECT `id` FROM `teachers` WHERE `auth_user_id` = ? LIMIT 1', [info.userId]);
  return rows[0] ? String(rows[0].id) : '';
}

function toClassItem(row: any, studentCount: number, active7DaysCount: number): any {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade || 'Lớp 7',
    schoolYear: row.school_year || '2026-2027',
    teacherId: row.teacher_id,
    description: row.description || undefined,
    studentCount,
    active7DaysCount,
    status: row.status || 'active',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    deleted_at: null,
  };
}

/** Đếm học sinh + số học sinh active 7 ngày cho 1 lớp (theo code gốc). */
async function classCounts(classId: string): Promise<{ studentCount: number; active7DaysCount: number }> {
  const rows = await query<any>(
    'SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN `last_active_at` >= UTC_TIMESTAMP() - INTERVAL 7 DAY THEN 1 ELSE 0 END), 0) AS a ' +
      'FROM `students` WHERE `class_id` = ?',
    [classId]
  );
  return {
    studentCount: Number(rows[0]?.n || 0),
    active7DaysCount: Number(rows[0]?.a || 0),
  };
}

export const classesRouter = Router();
classesRouter.use(requireAuth);

classesRouter.get('/classes', async (req: Request, res: Response) => {
  try {
    const { role } = callerInfo(req);
    let rows: any[];
    if (role === 'admin') {
      rows = await query<any>('SELECT * FROM `classes` ORDER BY `name` ASC');
    } else if (role === 'teacher') {
      const teacherId = await callerTeacherId(req);
      if (!teacherId) return res.status(200).json([]);
      rows = await query<any>('SELECT * FROM `classes` WHERE `teacher_id` = ? ORDER BY `name` ASC', [teacherId]);
    } else if (role === 'student') {
      const c: any = (req as any).caller;
      const classId = String(c?.classId ?? c?.class_id ?? '');
      if (!classId) return res.status(200).json([]);
      rows = await query<any>('SELECT * FROM `classes` WHERE `id` = ? LIMIT 1', [classId]);
    } else {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    const out: any[] = [];
    for (const row of rows) {
      const counts = await classCounts(String(row.id));
      out.push(toClassItem(row, counts.studentCount, counts.active7DaysCount));
    }
    return res.status(200).json(out);
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

classesRouter.get('/classes/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (isSentinelId(id) || id === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    const rows = await query<any>('SELECT * FROM `classes` WHERE `id` = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return httpErr(res, 404, 'NOT_FOUND');
    const { role } = callerInfo(req);
    if (role === 'admin') {
      // qua
    } else if (role === 'teacher') {
      const teacherId = await callerTeacherId(req);
      if (String(row.teacher_id) !== teacherId) return httpErr(res, 403, 'FORBIDDEN');
    } else if (role === 'student') {
      const c: any = (req as any).caller;
      const classId = String(c?.classId ?? c?.class_id ?? '');
      if (!classId || classId !== id) return httpErr(res, 403, 'FORBIDDEN');
    } else {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    const counts = await classCounts(id);
    return res.status(200).json(toClassItem(row, counts.studentCount, counts.active7DaysCount));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

classesRouter.post('/classes', async (req: Request, res: Response) => {
  try {
    const { role } = callerInfo(req);
    const body: any = req.body || {};
    const name = String(body.name || '').trim();
    if (!name) return httpErr(res, 400, 'BAD_INPUT');
    let teacherId: string;
    if (role === 'teacher') {
      // Server ép teacher_id = caller, bỏ qua client gửi.
      teacherId = await callerTeacherId(req);
      if (!teacherId) return httpErr(res, 403, 'FORBIDDEN');
    } else if (role === 'admin') {
      teacherId = String(body.teacherId || body.teacher_id || '');
      if (!teacherId) return httpErr(res, 400, 'BAD_INPUT');
      const t = await query<any>('SELECT `id` FROM `teachers` WHERE `id` = ? LIMIT 1', [teacherId]);
      if (!t[0]) return httpErr(res, 400, 'BAD_INPUT');
    } else {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    if (isSentinelId(teacherId) || teacherId === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    const id = String(body.id || '').trim() || randomUUID();
    if (id.length > 36) return httpErr(res, 400, 'BAD_INPUT');
    const status = body.status === 'archived' ? 'archived' : 'active';
    await execute(
      'INSERT INTO `classes` (`id`, `name`, `grade`, `school_year`, `teacher_id`, `description`, `status`) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, body.grade ? String(body.grade) : 'Lớp 7', body.schoolYear ? String(body.schoolYear) : '2026-2027', teacherId, body.description ? String(body.description) : null, status]
    );
    const rows = await query<any>('SELECT * FROM `classes` WHERE `id` = ? LIMIT 1', [id]);
    if (!rows[0]) return httpErr(res, 500, 'SERVER_ERROR');
    return res.status(200).json(toClassItem(rows[0], 0, 0));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

async function loadOwnedClass(req: Request, res: Response, id: string): Promise<any | null> {
  const rows = await query<any>('SELECT * FROM `classes` WHERE `id` = ? LIMIT 1', [id]);
  const row = rows[0];
  if (!row) {
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

classesRouter.patch('/classes/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (isSentinelId(id) || id === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    const row = await loadOwnedClass(req, res, id);
    if (!row) return;
    const body: any = req.body || {};
    // Giữ nguyên các trường updateClass gốc: name, grade, schoolYear,
    // description, status. teacher_id không cho đổi qua endpoint này.
    const sets: string[] = ['`updated_at` = UTC_TIMESTAMP()'];
    const params: any[] = [];
    if (body.name !== undefined) {
      sets.push('`name` = ?');
      params.push(String(body.name));
    }
    if (body.grade !== undefined) {
      sets.push('`grade` = ?');
      params.push(String(body.grade));
    }
    if (body.schoolYear !== undefined) {
      sets.push('`school_year` = ?');
      params.push(String(body.schoolYear));
    }
    if (body.description !== undefined) {
      sets.push('`description` = ?');
      params.push(body.description === null ? null : String(body.description));
    }
    if (body.status !== undefined) {
      if (!['active', 'archived'].includes(String(body.status))) return httpErr(res, 400, 'BAD_INPUT');
      sets.push('`status` = ?');
      params.push(String(body.status));
    }
    params.push(id);
    await execute(`UPDATE \`classes\` SET ${sets.join(', ')} WHERE \`id\` = ?`, params);
    const fresh = await query<any>('SELECT * FROM `classes` WHERE `id` = ? LIMIT 1', [id]);
    const counts = await classCounts(id);
    return res.status(200).json(toClassItem(fresh[0], counts.studentCount, counts.active7DaysCount));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

classesRouter.delete('/classes/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (isSentinelId(id) || id === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    const row = await loadOwnedClass(req, res, id);
    if (!row) return;
    // Xóa lớp kéo theo học sinh của lớp (FK students.class_id CASCADE xóa
    // states/sessions/attempts/essays/targets/reward_requests) + dọn dòng
    // users liên kết của từng em (kẻo thành users mồ côi như lỗi xóa HS
    // đơn trước đây). assignments/essays trỏ lớp thì SET NULL theo FK.
    // topics.class_ids (JSON) giữ id lớp cũ — chủ đề đó không còn hiện
    // dưới lớp nào, cần gán lại lớp khác hoặc xóa riêng.
    const stus = await query<any>('SELECT `id`, `auth_user_id` FROM `students` WHERE `class_id` = ?', [id]);
    for (const s of stus) {
      await execute('DELETE FROM `students` WHERE `id` = ?', [s.id]);
      if (s.auth_user_id) {
        await execute('DELETE FROM `users` WHERE `id` = ?', [s.auth_user_id]);
      }
    }
    await execute('DELETE FROM `classes` WHERE `id` = ?', [id]);
    return res.status(200).json({ ok: true, deletedStudents: stus.length });
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

classesRouter.post('/classes/:id/archive', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (isSentinelId(id) || id === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    const row = await loadOwnedClass(req, res, id);
    if (!row) return;
    // archiveClass gốc = updateClass({ status: 'archived' }) — đã xác nhận.
    await execute('UPDATE `classes` SET `status` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?', ['archived', id]);
    const fresh = await query<any>('SELECT * FROM `classes` WHERE `id` = ? LIMIT 1', [id]);
    const counts = await classCounts(id);
    return res.status(200).json(toClassItem(fresh[0], counts.studentCount, counts.active7DaysCount));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});
