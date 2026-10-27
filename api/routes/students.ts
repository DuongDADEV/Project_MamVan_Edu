import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { query, execute, withTransaction, db } from '../_lib/mysql';
import {
  requireAuth,
  httpErr,
  synthEmail,
  hashPassword,
  revokeRefreshTokens,
} from '../_lib/auth';
import { isSentinelId, teacherClassIds, studentClassId } from '../_lib/scope';

/**
 * GET /students, GET /students/:id, POST /students, POST /students/batch,
 * PATCH /students/:id, DELETE /students/:id, POST /students/:id/change-class,
 * POST /students/:id/toggle-lock. Mount tại /api.
 *
 * Op gốc đã xác nhận (không còn TODO):
 * - toggleLock(id, isLocked) = updateStudent(id, { status: locked/active }).
 * - changeClass(id, newClassId) = updateStudent(id, { class_id }).
 * - resetPassword (dùng trong PATCH khi đổi mật khẩu) = gọi route users
 *   action 'reset-password' (table students, profileId) — ở đây viết trực
 *   tiếp: bcrypt.hash → UPDATE users.encrypted_password + thu hồi refresh.
 * - deleteStudent gốc = hard DELETE khỏi bảng students (KHÔNG xóa dòng
 *   users tương ứng, KHÔNG xóa student_states) — giữ nguyên hành vi đó,
 *   ghi rõ để tích hợp quyết có dọn users mồ côi hay không.
 *
 * Phân quyền: teacher bắt buộc lọc class_id thuộc lớp mình, KHÔNG cho
 * list toàn cục; admin tất cả (+ lọc lớp); student chỉ chính mình.
 * Không bao giờ trả password_hash (code gốc getStudents trả cả trường
 * này — server mới strip vì luật "không trả mật khẩu/hash").
 *
 * Tạo học sinh: users trước, profile sau trong 1 transaction, lỗi profile
 * → rollback. Username kiểm tra trùng TOÀN CỤC (teachers + students,
 * bất kể role) ở server. Username/mật khẩu/mã HS khi không kèm: sinh theo
 * đúng chuẩn credentialUtils cũ (username = tên + chữ đầu họ đệm + số
 * nhỏ nhất chưa dùng; mã HS = HS + 4 số nhỏ nhất chưa dùng; mật khẩu
 * 8 ký tự dễ đọc, loại ký tự dễ nhầm).
 */

// ---------- Sinh username / mã HS / mật khẩu (chuẩn credentialUtils cũ) ----------
function removeTones(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function generateUsername(fullName: string, existing: string[]): string {
  const clean = removeTones(fullName.trim().toLowerCase());
  const parts = clean.split(/\s+/).filter(Boolean);
  const taken = new Set(existing.map((u) => u.toLowerCase()));
  if (!parts.length) {
    for (let n = 10; n <= 9999; n++) {
      if (!taken.has(`hocsinh${n}`)) return `hocsinh${n}`;
    }
    return `hocsinh${Date.now()}`;
  }
  const base = `${parts[parts.length - 1]}${parts.slice(0, -1).map((p) => p.charAt(0)).join('')}`;
  for (let n = 10; n <= 9999; n++) {
    if (!taken.has(`${base}${n}`)) return `${base}${n}`;
  }
  return `${base}${Date.now()}`;
}

function generateStudentCode(existing: (string | null | undefined)[]): string {
  const taken = new Set(existing.filter(Boolean).map((c) => String(c).toUpperCase()));
  for (let n = 1; n <= 9999; n++) {
    const cand = `HS${String(n).padStart(4, '0')}`;
    if (!taken.has(cand)) return cand;
  }
  return `HS${Date.now()}`;
}

function generateFriendlyPassword(length = 8): string {
  const chars = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  const buf = new Uint32Array(length);
  try {
    crypto.getRandomValues(buf);
    for (let i = 0; i < length; i++) out += chars.charAt(buf[i] % chars.length);
  } catch {
    for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// ---------- Caller / scope ----------
function callerInfo(req: Request): { userId: string; role: string; teacherId: string; studentId: string; classId: string } {
  const c: any = (req as any).caller;
  return {
    userId: String(c?.userId ?? c?.id ?? c?.sub ?? ''),
    role: String(c?.role || ''),
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

async function callerStudentProfile(req: Request): Promise<any | null> {
  const info = callerInfo(req);
  if (info.studentId) {
    const rows = await query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [info.studentId]);
    if (rows[0]) return rows[0];
  }
  if (!info.userId) return null;
  const rows = await query<any>('SELECT * FROM `students` WHERE `auth_user_id` = ? LIMIT 1', [info.userId]);
  return rows[0] || null;
}

async function teacherOwnClassIds(req: Request): Promise<string[]> {
  const teacherId = await callerTeacherId(req);
  if (!teacherId) return [];
  const ids = await teacherClassIds(db, teacherId);
  return Array.isArray(ids) ? ids.map(String) : [];
}

function stripStudent(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  delete out.password_hash;
  delete out.encrypted_password;
  if (out.last_active_at instanceof Date) out.last_active_at = out.last_active_at.getTime();
  else if (typeof out.last_active_at === 'string') out.last_active_at = new Date(out.last_active_at).getTime();
  return out;
}

async function usernameTaken(username: string): Promise<boolean> {
  const t = await query<any>('SELECT 1 FROM `teachers` WHERE LOWER(`username`) = ? LIMIT 1', [username]);
  if (t.length) return true;
  const s = await query<any>('SELECT 1 FROM `students` WHERE LOWER(`username`) = ? LIMIT 1', [username]);
  return s.length > 0;
}

/** Tạo 1 học sinh (dùng chung cho POST đơn và từng dòng batch). */
async function createOne(
  item: any,
  classIdsOfTeacher: string[] | null // null = admin (mọi lớp)
): Promise<{ student: any; credential: any }> {
  const name = String(item.name || '').trim();
  const classId = String(item.class_id || item.classId || '');
  if (!name) throw Object.assign(new Error('NAME_REQUIRED'), { code: 'NAME_REQUIRED', status: 400 });
  if (!classId) throw Object.assign(new Error('CLASS_REQUIRED'), { code: 'CLASS_REQUIRED', status: 400 });
  if (isSentinelId(classId) || classId === 'gv001') {
    throw Object.assign(new Error('BAD_INPUT'), { code: 'BAD_INPUT', status: 400 });
  }
  if (classIdsOfTeacher && !classIdsOfTeacher.includes(classId)) {
    throw Object.assign(new Error('CLASS_NOT_OWNED'), { code: 'CLASS_NOT_OWNED', status: 403 });
  }
  const cls = await query<any>('SELECT `id` FROM `classes` WHERE `id` = ? LIMIT 1', [classId]);
  if (!cls[0]) throw Object.assign(new Error('CLASS_NOT_FOUND'), { code: 'CLASS_NOT_FOUND', status: 400 });

  let username = String(item.custom_username || item.username || '').trim().toLowerCase();
  if (!username) {
    const existing = await query<any>('SELECT `username` FROM `students`');
    const existingT = await query<any>('SELECT `username` FROM `teachers`');
    username = generateUsername(name, [
      ...existing.map((r: any) => String(r.username)),
      ...existingT.map((r: any) => String(r.username)),
    ]);
  }
  if (/\s/.test(username)) throw Object.assign(new Error('BAD_INPUT'), { code: 'BAD_INPUT', status: 400 });
  if (await usernameTaken(username)) {
    throw Object.assign(new Error('USERNAME_TAKEN'), { code: 'USERNAME_TAKEN', status: 400 });
  }
  const initialPassword = String(item.custom_password || item.password || '').trim() || generateFriendlyPassword(8);
  if (initialPassword.length < 6) {
    throw Object.assign(new Error('PASSWORD_TOO_SHORT'), { code: 'PASSWORD_TOO_SHORT', status: 400 });
  }
  let studentCode = String(item.student_code || '').trim();
  if (!studentCode) {
    const codes = await query<any>('SELECT `student_code` FROM `students`');
    studentCode = generateStudentCode(codes.map((r: any) => r.student_code));
  }
  const hashed = await hashPassword(initialPassword);
  const authUserId = randomUUID();
  const profileId = randomUUID();
  const email = synthEmail('student', username);
  const profile = await withTransaction(async (db) => {
    await db.execute('INSERT INTO `users` (`id`, `email`, `encrypted_password`, `role`) VALUES (?, ?, ?, ?)', [
      authUserId,
      email,
      hashed,
      'student',
    ]);
    await db.execute(
      'INSERT INTO `students` (`id`, `auth_user_id`, `username`, `name`, `class_id`, `student_code`, `dob`, `status`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [profileId, authUserId, username, name, classId, studentCode, item.dob || null, 'active']
    );
    await db.execute(
      'INSERT INTO `student_states` (`student_id`, `xp_today`, `xp_week`, `total_xp`, `active_seconds_today`, `consecutive_days`, `topic_mastery`) VALUES (?, 0, 0, 0, 0, 1, ?)',
      [profileId, JSON.stringify({ topic_1: 0, topic_2: 0, topic_3: 0, topic_4: 0 })]
    );
    const rows = await db.query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [profileId]);
    return rows[0];
  });
  if (!profile) throw Object.assign(new Error('CREATE_PROFILE_FAILED'), { code: 'CREATE_PROFILE_FAILED', status: 400 });
  const student = stripStudent(profile);
  return {
    student,
    credential: {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      initialPassword,
      class_id: profile.class_id,
      student_code: profile.student_code || undefined,
    },
  };
}

/** Học sinh có thuộc phạm vi caller không (teacher: lớp mình; student: mình). */
async function scopeCheckStudent(req: Request, res: Response, studentRow: any): Promise<boolean> {
  const { role } = callerInfo(req);
  if (role === 'admin') return true;
  if (role === 'teacher') {
    // studentClassId (lib scope) = class_id của học sinh; đối chiếu lớp mình.
    const cid = await studentClassId(db, String(studentRow.id));
    const own = await teacherOwnClassIds(req);
    const actual = cid ? String(cid) : String(studentRow.class_id);
    if (!actual || !own.includes(actual)) {
      httpErr(res, 403, 'FORBIDDEN');
      return false;
    }
    return true;
  }
  if (role === 'student') {
    const me = await callerStudentProfile(req);
    if (!me || String(me.id) !== String(studentRow.id)) {
      httpErr(res, 403, 'FORBIDDEN');
      return false;
    }
    return true;
  }
  httpErr(res, 403, 'FORBIDDEN');
  return false;
}

export const studentsRouter = Router();
studentsRouter.use(requireAuth);

studentsRouter.get('/students', async (req: Request, res: Response) => {
  try {
    const { role } = callerInfo(req);
    const qClassId = req.query.class_id ? String(req.query.class_id) : '';
    const search = req.query.search ? String(req.query.search).toLowerCase().trim() : '';
    const status = req.query.status ? String(req.query.status) : '';
    let rows: any[];
    if (role === 'admin') {
      const where: string[] = [];
      const params: any[] = [];
      if (qClassId && qClassId !== 'all') {
        where.push('`class_id` = ?');
        params.push(qClassId);
      }
      if (status && status !== 'all') {
        where.push('`status` = ?');
        params.push(status);
      }
      rows = await query<any>(
        `SELECT * FROM \`students\`${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY \`name\` ASC`,
        params
      );
    } else if (role === 'teacher') {
      // Không kèm class_id: trả học sinh của TẤT CẢ lớp mình (vẫn
      // chặn tuyệt đối lớp của giáo viên khác — xem CLASS_NOT_OWNED
      // bên dưới). Màn hình giáo viên (TeacherPortal, AssignmentEditor)
      // nạp toàn bộ học sinh của mình không kèm lớp nên bắt buộc
      // class_id ở đây làm cả màn hình sập với CLASS_REQUIRED; route
      // /student-states đã làm đúng kiểu union này từ trước.
      const own = await teacherOwnClassIds(req);
      if (qClassId) {
        if (!own.includes(qClassId)) return httpErr(res, 403, 'CLASS_NOT_OWNED');
        const where: string[] = ['`class_id` = ?'];
        const params: any[] = [qClassId];
        if (status && status !== 'all') {
          where.push('`status` = ?');
          params.push(status);
        }
        rows = await query<any>(`SELECT * FROM \`students\` WHERE ${where.join(' AND ')} ORDER BY \`name\` ASC`, params);
      } else if (!own.length) {
        rows = [];
      } else {
        const where: string[] = [`\`class_id\` IN (${own.map(() => '?').join(',')})`];
        const params: any[] = [...own];
        if (status && status !== 'all') {
          where.push('`status` = ?');
          params.push(status);
        }
        rows = await query<any>(`SELECT * FROM \`students\` WHERE ${where.join(' AND ')} ORDER BY \`name\` ASC`, params);
      }
    } else if (role === 'student') {
      const me = await callerStudentProfile(req);
      rows = me ? [me] : [];
    } else {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    let out = rows.map(stripStudent);
    if (search) {
      out = out.filter(
        (s: any) =>
          String(s.name || '').toLowerCase().includes(search) ||
          String(s.username || '').toLowerCase().includes(search) ||
          String(s.student_code || '').toLowerCase().includes(search)
      );
    }
    return res.status(200).json(out);
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

studentsRouter.get('/students/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (isSentinelId(id) || id === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    // getStudentById gốc còn cho tra theo username khi id không phải UUID;
    // server mới chỉ tra theo id (username tra qua ?search= ở list).
    const rows = await query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [id]);
    if (!rows[0]) return httpErr(res, 404, 'NOT_FOUND');
    if (!(await scopeCheckStudent(req, res, rows[0]))) return;
    return res.status(200).json(stripStudent(rows[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

studentsRouter.post('/students', async (req: Request, res: Response) => {
  try {
    const { role } = callerInfo(req);
    if (role !== 'teacher' && role !== 'admin') return httpErr(res, 403, 'FORBIDDEN');
    const own = role === 'teacher' ? await teacherOwnClassIds(req) : null;
    try {
      const created = await createOne(req.body || {}, own);
      return res.status(200).json(created);
    } catch (e: any) {
      return httpErr(res, e?.status || 400, e?.code || 'CREATE_FAILED');
    }
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

studentsRouter.post('/students/batch', async (req: Request, res: Response) => {
  try {
    const { role } = callerInfo(req);
    if (role !== 'teacher' && role !== 'admin') return httpErr(res, 403, 'FORBIDDEN');
    const items: any[] = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return httpErr(res, 400, 'BAD_INPUT');
    const own = role === 'teacher' ? await teacherOwnClassIds(req) : null;
    // KHÔNG atomic (giữ hành vi hiện tại): từng học sinh một, lỗi giữa
    // chừng thì học sinh tạo trước vẫn tồn tại; trả kết quả từng dòng.
    // (Lệch nhỏ so với repo batch cũ: repo cũ ném ở dòng lỗi đầu tiên và
    // không trả kết quả từng dòng — task GĐ3 yêu cầu trả từng dòng.)
    const results: any[] = [];
    for (const item of items) {
      try {
        const created = await createOne(item, own);
        results.push({ ok: true, student: created.student, credential: created.credential });
      } catch (e: any) {
        results.push({ ok: false, error: e?.code || 'CREATE_FAILED', name: item?.name || null });
      }
    }
    return res.status(200).json({ results });
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

studentsRouter.patch('/students/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (isSentinelId(id) || id === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    const rows = await query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [id]);
    const current = rows[0];
    if (!current) return httpErr(res, 404, 'NOT_FOUND');
    if (!(await scopeCheckStudent(req, res, current))) return;
    const body: any = req.body || {};
    const { role } = callerInfo(req);
    // Đổi mật khẩu: qua users (như route reset-password gốc) — làm trước
    // trong cùng transaction để lỗi thì không lệch 2 phía (gốc: route chạy
    // trước khi ghi các trường khác).
    const newPassword = body.password !== undefined ? String(body.password).trim() : body.password_hash !== undefined ? String(body.password_hash).trim() : '';
    if (newPassword) {
      if (newPassword.length < 6) return httpErr(res, 400, 'PASSWORD_TOO_SHORT');
    }
    // Đổi username: qua rename (đổi cả users.email) — kiểm tra trùng toàn cục.
    let wantedUsername: string | null = null;
    if (body.username !== undefined) {
      wantedUsername = String(body.username).trim().toLowerCase();
      if (wantedUsername && wantedUsername !== String(current.username).toLowerCase()) {
        if (/\s/.test(wantedUsername)) return httpErr(res, 400, 'BAD_INPUT');
        if (await usernameTaken(wantedUsername)) return httpErr(res, 400, 'USERNAME_TAKEN');
      } else {
        wantedUsername = null;
      }
    }
    let targetClassId: string | null = null;
    if (body.class_id !== undefined) {
      targetClassId = String(body.class_id);
      if (role === 'teacher') {
        // change-class: lớp đích cũng phải thuộc mình.
        const own = await teacherOwnClassIds(req);
        if (!own.includes(targetClassId)) return httpErr(res, 403, 'CLASS_NOT_OWNED');
      }
      const cls = await query<any>('SELECT `id` FROM `classes` WHERE `id` = ? LIMIT 1', [targetClassId]);
      if (!cls[0]) return httpErr(res, 400, 'CLASS_NOT_FOUND');
    }
    try {
      const updated = await withTransaction(async (db) => {
        if (newPassword && current.auth_user_id) {
          const hashed = await hashPassword(newPassword);
          await db.execute('UPDATE `users` SET `encrypted_password` = ? WHERE `id` = ?', [hashed, String(current.auth_user_id)]);
        }
        if (wantedUsername && current.auth_user_id) {
          await db.execute('UPDATE `users` SET `email` = ? WHERE `id` = ?', [synthEmail('student', wantedUsername), String(current.auth_user_id)]);
        }
        const sets: string[] = ['`updated_at` = UTC_TIMESTAMP()'];
        const params: any[] = [];
        if (body.name !== undefined) {
          sets.push('`name` = ?');
          params.push(String(body.name));
        }
        if (wantedUsername) {
          sets.push('`username` = ?');
          params.push(wantedUsername);
        }
        if (body.student_code !== undefined) {
          sets.push('`student_code` = ?');
          params.push(body.student_code === null ? null : String(body.student_code));
        }
        if (body.dob !== undefined) {
          sets.push('`dob` = ?');
          params.push(body.dob || null);
        }
        if (targetClassId) {
          sets.push('`class_id` = ?');
          params.push(targetClassId);
        }
        if (body.status !== undefined) {
          if (!['active', 'locked'].includes(String(body.status))) throw new Error('BAD_STATUS');
          sets.push('`status` = ?');
          params.push(String(body.status));
        }
        params.push(id);
        await db.execute(`UPDATE \`students\` SET ${sets.join(', ')} WHERE \`id\` = ?`, params);
        const r = await db.query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [id]);
        return r[0];
      });
      if (newPassword && current.auth_user_id) {
        try {
          await revokeRefreshTokens(String(current.auth_user_id));
        } catch {
          /* không làm hỏng response */
        }
      }
      if (wantedUsername && current.auth_user_id) {
        try {
          await revokeRefreshTokens(String(current.auth_user_id));
        } catch {
          /* không làm hỏng response */
        }
      }
      return res.status(200).json(stripStudent(updated));
    } catch {
      return httpErr(res, 400, 'UPDATE_FAILED');
    }
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

studentsRouter.delete('/students/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (isSentinelId(id) || id === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    const rows = await query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [id]);
    if (!rows[0]) return httpErr(res, 404, 'NOT_FOUND');
    if (!(await scopeCheckStudent(req, res, rows[0]))) return;
    // Hard delete như code gốc (xem ghi chú đầu file về users mồ côi).
    await execute('DELETE FROM `students` WHERE `id` = ?', [id]);
    return res.status(200).json({ ok: true });
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

studentsRouter.post('/students/:id/change-class', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (isSentinelId(id) || id === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    const rows = await query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [id]);
    const current = rows[0];
    if (!current) return httpErr(res, 404, 'NOT_FOUND');
    if (!(await scopeCheckStudent(req, res, current))) return;
    const body: any = req.body || {};
    const newClassId = String(body.class_id || body.newClassId || body.classId || '');
    if (!newClassId) return httpErr(res, 400, 'BAD_INPUT');
    const { role } = callerInfo(req);
    if (role === 'teacher') {
      const own = await teacherOwnClassIds(req);
      if (!own.includes(newClassId)) return httpErr(res, 403, 'CLASS_NOT_OWNED');
    }
    const cls = await query<any>('SELECT `id` FROM `classes` WHERE `id` = ? LIMIT 1', [newClassId]);
    if (!cls[0]) return httpErr(res, 400, 'CLASS_NOT_FOUND');
    await execute('UPDATE `students` SET `class_id` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?', [newClassId, id]);
    const fresh = await query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [id]);
    return res.status(200).json(stripStudent(fresh[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

studentsRouter.post('/students/:id/toggle-lock', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (isSentinelId(id) || id === 'gv001') return httpErr(res, 400, 'BAD_INPUT');
    const rows = await query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [id]);
    const current = rows[0];
    if (!current) return httpErr(res, 404, 'NOT_FOUND');
    if (!(await scopeCheckStudent(req, res, current))) return;
    const body: any = req.body || {};
    // toggleLock gốc: updateStudent({ status: isLocked ? 'locked' : 'active' }).
    let isLocked: boolean;
    if (body.isLocked !== undefined) isLocked = !!body.isLocked;
    else if (body.locked !== undefined) isLocked = !!body.locked;
    else isLocked = String(current.status) !== 'locked'; // không kèm cờ → đảo trạng thái
    const status = isLocked ? 'locked' : 'active';
    await execute('UPDATE `students` SET `status` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?', [status, id]);
    const fresh = await query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [id]);
    return res.status(200).json(stripStudent(fresh[0]));
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});
