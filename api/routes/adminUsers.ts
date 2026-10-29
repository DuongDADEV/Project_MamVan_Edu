import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { query, withTransaction, db } from '../_lib/mysql';
import {
  requireAuth,
  httpErr,
  synthEmail,
  hashPassword,
  revokeRefreshTokens,
} from '../_lib/auth';
import { teacherClassIds } from '../_lib/scope';
import { encryptPassword } from '../_lib/passwordVault';

/**
 * POST /admin/users — viết lại ruột api/admin/users.ts sang MySQL + bcrypt,
 * GIỮ NGUYÊN path, body action và luật resolveCaller của file gốc.
 *
 * Người gọi (giữ nguyên file gốc):
 *  - admin: toàn quyền.
 *  - teacher: CHỈ học sinh thuộc lớp mình (tạo, reset mật khẩu, đổi tên)
 *    và CHÍNH MÌNH (reset mật khẩu). Giáo viên không tạo được giáo viên khác.
 *  - student / không profile → 403 FORBIDDEN.
 *
 * Body (giữ nguyên file gốc):
 *  { action: 'create', role: 'teacher'|'student', username, password,
 *    name?, class_id?, student_code?, dob?, email?, phone?, school?,
 *    subject?, status?, trial_expires_at? }
 *  { action: 'reset-password', userId?, table?, profileId?, newPassword }
 *  { action: 'rename-student', profileId, newUsername }
 *
 * Thay đổi so với file gốc (ghi rõ):
 * 1. Tạo user mà insert profile lỗi → rollback xóa user vừa tạo TRONG
 *    TRANSACTION (file gốc xóa auth user sau lỗi; MySQL transaction cho
 *    cùng kết quả mà không để cửa sổ tài khoản mồ côi).
 * 2. Kiểm tra trùng username TOÀN CỤC trước khi tạo/đổi tên: username
 *    (lowercase) không tồn tại trong CẢ teachers.username lẫn
 *    students.username bất kể role (quyết chống trùng tuyệt đối theo task
 *    GĐ3; file gốc chỉ chặn trùng trong cùng role qua users.email UNIQUE
 *    vì email tổng hợp gồm role + username).
 * 3. Reset-password: file gốc trả { ok: true, profile } — KHÔNG trả mật
 *    khẩu mới (mật khẩu mới do người reset tự đặt trong request nên người
 *    đó đã biết; voucher UI dựng từ profile). Bản MySQL giữ đúng vậy:
 *    KHÔNG trả mật khẩu/hash trong response. Mật khẩu mới đến tay học
 *    sinh ngoài hệ thống (giáo viên đọc/in voucher), không lưu log.
 *    (Khảo sát §3.5.3 từng đề xuất server trả lại mật khẩu trong response
 *    và §3.5.6 ghi "chưa xác nhận" — đọc code gốc đã xác nhận: gốc chỉ
 *    trả profile.)
 * 4. Rename-student: file gốc đổi auth email trước rồi mới đổi profile,
 *    lỗi profile thì rollback email. Bản MySQL đổi students.username +
 *    users.email trong 1 transaction; đồng thời thu hồi refresh token của
 *    user đó (email là định danh đăng nhập — theo khảo sát §3.5.5).
 * 5. Không bao giờ trả mật khẩu/hash: profile trả về đã strip
 *    password_hash; users.encrypted_password không bao giờ select ra
 *    ngoài trừ lúc xác thực (route này không xác thực).
 * 6. Tạo student cũng khởi tạo student_states như code gốc
 *    (SupabaseStudentRepository.createStudent upsert state trắng sau khi
 *    route tạo profile: xp 0, consecutive_days 1, topic_mastery mẫu).
 */

type Caller =
  | { kind: 'admin'; userId: string }
  | { kind: 'teacher'; userId: string; teacherId: string; classIds: string[] };

function callerUserId(caller: any): string {
  return String(caller?.userId ?? caller?.id ?? caller?.sub ?? '');
}

async function resolveCaller(req: Request): Promise<Caller | null> {
  const caller: any = (req as any).caller;
  const role = String(caller?.role || '');
  const userId = callerUserId(caller);
  if (!userId) return null;
  if (role === 'admin') return { kind: 'admin', userId };
  if (role !== 'teacher') return null;
  // Giả định hợp đồng: caller đã mang teacherId, hoặc tra teachers theo
  // auth_user_id (giống file gốc). classIds qua lib scope.
  let teacherId = String(caller?.teacherId ?? caller?.profileId ?? '');
  if (!teacherId) {
    const profs = await query<any>(
      'SELECT `id` FROM `teachers` WHERE `auth_user_id` = ? LIMIT 1',
      [userId]
    );
    if (!profs[0]) return null;
    teacherId = String(profs[0].id);
  }
  const classIds = await teacherClassIds(db, teacherId);
  return { kind: 'teacher', userId, teacherId, classIds: Array.isArray(classIds) ? classIds.map(String) : [] };
}

function stripProfile(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  delete out.password_hash;
  delete out.encrypted_password;
  delete out.password_enc;
  return out;
}

/**
 * Chuẩn hóa giá trị datetime client gửi (thường là ISO `new Date().toISOString()`,
 * vd `2026-11-01T06:44:00.000Z`) sang dạng MySQL DATETIME `YYYY-MM-DD HH:MM:SS`.
 * MySQL strict mode từ chối chuỗi ISO (chữ T/Z, mili giây) → insert teachers lỗi
 * → transaction rollback → CREATE_PROFILE_FAILED (2026-10-29: mọi tài khoản
 * giáo viên dùng thử đều tạo lỗi vì lý do này; tài khoản chính thức không gửi
 * trial_expires_at nên không bị). Pool ép session time_zone '+00:00' nên format
 * theo UTC giữ nguyên thời điểm client tính.
 * Trả null khi không có giá trị; trả undefined khi giá trị không parse được.
 */
function toMysqlDatetime(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function checkIdLen(res: Response, ...ids: (string | undefined | null)[]): boolean {
  for (const id of ids) {
    if (id && id.length > 191) {
      httpErr(res, 400, 'BAD_INPUT');
      return false;
    }
  }
  return true;
}

/** Username đã tồn tại trong teachers hoặc students (không phân biệt hoa/thường)? */
async function usernameTaken(username: string): Promise<boolean> {
  const t = await query<any>(
    'SELECT 1 FROM `teachers` WHERE LOWER(`username`) = ? LIMIT 1',
    [username]
  );
  if (t.length) return true;
  const s = await query<any>(
    'SELECT 1 FROM `students` WHERE LOWER(`username`) = ? LIMIT 1',
    [username]
  );
  return s.length > 0;
}

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAuth);

adminUsersRouter.post('/admin/users', async (req: Request, res: Response) => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return httpErr(res, 403, 'FORBIDDEN');
    }
    const isAdmin = caller.kind === 'admin';
    const teacher = caller.kind === 'teacher' ? caller : null;
    const body: any = req.body || {};

    if (body.action === 'create') {
      const role = String(body.role || '');
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!['teacher', 'student'].includes(role) || !username) {
        return httpErr(res, 400, 'BAD_INPUT');
      }
      if (password.length < 6) {
        return httpErr(res, 400, 'PASSWORD_TOO_SHORT');
      }
      if (role === 'teacher' && !isAdmin) {
        return httpErr(res, 403, 'FORBIDDEN');
      }
      if (role === 'student') {
        if (!body.class_id) {
          return httpErr(res, 400, 'CLASS_REQUIRED');
        }
        if (teacher && !teacher.classIds.includes(String(body.class_id))) {
          return httpErr(res, 403, 'CLASS_NOT_OWNED');
        }
        if (!String(body.name || '').trim()) {
          return httpErr(res, 400, 'NAME_REQUIRED');
        }
      }
      if (role === 'teacher' && !String(body.name || '').trim()) {
        return httpErr(res, 400, 'NAME_REQUIRED');
      }
      if (!checkIdLen(res, username, String(body.class_id || ''))) return;
      if (await usernameTaken(username)) {
        return httpErr(res, 400, 'USERNAME_TAKEN');
      }
      // trial_expires_at phải về dạng DATETIME trước khi insert (xem toMysqlDatetime).
      const trialExpiresAt = toMysqlDatetime(body.trial_expires_at);
      if (trialExpiresAt === undefined) {
        return httpErr(res, 400, 'BAD_INPUT');
      }
      const email = synthEmail(role, username);
      const hashed = await hashPassword(password);
      const authUserId = randomUUID();
      const profileId = randomUUID();
      try {
        const profile = await withTransaction(async (db) => {
          await db.execute(
            'INSERT INTO `users` (`id`, `email`, `encrypted_password`, `role`) VALUES (?, ?, ?, ?)',
            [authUserId, email, hashed, role]
          );
          if (role === 'teacher') {
            await db.execute(
              'INSERT INTO `teachers` (`id`, `auth_user_id`, `username`, `name`, `role`, `email`, `phone`, `school`, `subject`, `status`, `trial_expires_at`) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                profileId,
                authUserId,
                username,
                String(body.name).trim(),
                'teacher',
                body.email ? String(body.email) : null,
                body.phone ? String(body.phone) : null,
                body.school ? String(body.school) : null,
                body.subject ? String(body.subject) : null,
                body.status ? String(body.status) : 'active',
                trialExpiresAt,
              ]
            );
          } else {
            await db.execute(
              'INSERT INTO `students` (`id`, `auth_user_id`, `username`, `name`, `class_id`, `student_code`, `dob`, `status`) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                profileId,
                authUserId,
                username,
                String(body.name).trim(),
                String(body.class_id),
                body.student_code ? String(body.student_code) : null,
                body.dob || null,
                'active',
              ]
            );
            // Khởi tạo student_states như code gốc (repo createStudent).
            await db.execute(
              'INSERT INTO `student_states` (`student_id`, `xp_today`, `xp_week`, `total_xp`, `active_seconds_today`, `consecutive_days`, `topic_mastery`) ' +
                'VALUES (?, 0, 0, 0, 0, 1, ?)',
              [profileId, JSON.stringify({ topic_1: 0, topic_2: 0, topic_3: 0, topic_4: 0 })]
            );
          }
          const table = role === 'teacher' ? 'teachers' : 'students';
          const rows = await db.query<any>(`SELECT * FROM \`${table}\` WHERE \`id\` = ? LIMIT 1`, [profileId]);
          return rows[0];
        });
        // Két mật khẩu xem được cho học sinh (best-effort, sau transaction).
        if (role === 'student') {
          try {
            const enc = encryptPassword(password);
            if (enc) await query('UPDATE `students` SET `password_enc` = ? WHERE `id` = ?', [enc, profileId]);
          } catch { /* két chưa sẵn sàng */ }
        }
        if (!profile) {
          return httpErr(res, 400, 'CREATE_PROFILE_FAILED');
        }
        return res.status(200).json({ ok: true, profileId, authUserId, profile: stripProfile(profile) });
      } catch {
        // Transaction rollback đã xóa users vừa tạo (tương đương file gốc
        // xóa auth user khi insert profile lỗi).
        return httpErr(res, 400, 'CREATE_PROFILE_FAILED');
      }
    }

    if (body.action === 'reset-password') {
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 6) {
        return httpErr(res, 400, 'PASSWORD_TOO_SHORT');
      }
      let targetAuthId = String(body.userId || '');
      let targetTable = '';
      let targetProfileId = '';
      if (!targetAuthId && body.table && body.profileId) {
        targetTable = String(body.table);
        targetProfileId = String(body.profileId);
        if (!['teachers', 'students'].includes(targetTable)) {
          return httpErr(res, 400, 'BAD_INPUT');
        }
        const rows = await query<any>(
          `SELECT \`auth_user_id\`, \`class_id\` FROM \`${targetTable}\` WHERE \`id\` = ? LIMIT 1`,
          [targetProfileId]
        );
        const data = rows[0];
        if (!data) {
          return httpErr(res, 400, 'USER_NOT_FOUND');
        }
        targetAuthId = String(data.auth_user_id || '');
        if (teacher) {
          const isSelf = targetTable === 'teachers' && targetProfileId === teacher.teacherId;
          const isOwnStudent =
            targetTable === 'students' &&
            data.class_id &&
            teacher.classIds.includes(String(data.class_id));
          if (!isSelf && !isOwnStudent) {
            return httpErr(res, 403, 'FORBIDDEN');
          }
        }
      } else if (teacher && targetAuthId) {
        // Reset theo auth id: giáo viên chỉ được reset chính mình hoặc học
        // sinh lớp mình — resolve ngược để kiểm tra (giữ nguyên file gốc).
        const t = await query<any>('SELECT `id` FROM `teachers` WHERE `auth_user_id` = ? LIMIT 1', [targetAuthId]);
        const s = await query<any>('SELECT `class_id` FROM `students` WHERE `auth_user_id` = ? LIMIT 1', [targetAuthId]);
        const isSelf = !!(t[0]) && String(t[0].id) === teacher.teacherId;
        const isOwnStudent =
          !!(s[0]) && s[0].class_id && teacher.classIds.includes(String(s[0].class_id));
        if (!isSelf && !isOwnStudent) {
          return httpErr(res, 403, 'FORBIDDEN');
        }
      }
      if (!targetAuthId) {
        return httpErr(res, 400, 'USER_NOT_FOUND');
      }
      const hashed = await hashPassword(newPassword);
      const result: any = await withTransaction(async (db) => {
        const r: any = await db.execute(
          'UPDATE `users` SET `encrypted_password` = ? WHERE `id` = ?',
          [hashed, targetAuthId]
        );
        return r;
      }).catch(() => null);
      const affected = result?.affectedRows;
      if (affected !== undefined && affected === 0) {
        return httpErr(res, 400, 'USER_NOT_FOUND');
      }
      if (!result) {
        return httpErr(res, 400, 'RESET_FAILED');
      }
      // Đồng bộ két xem được khi reset mật khẩu học sinh (best-effort).
      if (targetTable === 'students' && targetProfileId) {
        try {
          const enc = encryptPassword(newPassword);
          if (enc) await query('UPDATE `students` SET `password_enc` = ? WHERE `id` = ?', [enc, targetProfileId]);
        } catch { /* két chưa sẵn sàng */ }
      }
      // Thu hồi refresh token của user đó (khảo sát §3.5.2).
      try {
        await revokeRefreshTokens(targetAuthId);
      } catch {
        /* không làm hỏng response reset */
      }
      // Trả về profile để UI dựng voucher (tên, lớp, mã HS) như luồng cũ.
      // KHÔNG trả mật khẩu mới — người reset tự đặt nên đã biết.
      let profile: any = null;
      if (targetTable && targetProfileId) {
        const rows = await query<any>(
          `SELECT * FROM \`${targetTable}\` WHERE \`id\` = ? LIMIT 1`,
          [targetProfileId]
        );
        profile = rows[0] ? stripProfile(rows[0]) : null;
      }
      return res.status(200).json({ ok: true, profile });
    }

    if (body.action === 'rename-student') {
      const profileId = String(body.profileId || '');
      const newUsername = String(body.newUsername || '').trim().toLowerCase();
      if (!profileId || !newUsername || /\s/.test(newUsername)) {
        return httpErr(res, 400, 'BAD_INPUT');
      }
      const rows = await query<any>(
        'SELECT `id`, `username`, `auth_user_id`, `class_id` FROM `students` WHERE `id` = ? LIMIT 1',
        [profileId]
      );
      const stu = rows[0];
      if (!stu) {
        return httpErr(res, 400, 'USER_NOT_FOUND');
      }
      if (teacher && !teacher.classIds.includes(String(stu.class_id))) {
        return httpErr(res, 403, 'FORBIDDEN');
      }
      // Chống trùng tuyệt đối (task GĐ3): kể cả khi tên mới chỉ trùng với
      // giáo viên khác role (file gốc chỉ chặn qua email cùng role).
      if (String(stu.username).toLowerCase() !== newUsername && (await usernameTaken(newUsername))) {
        return httpErr(res, 400, 'USERNAME_TAKEN');
      }
      const newEmail = synthEmail('student', newUsername);
      try {
        const updated = await withTransaction(async (db) => {
          if (stu.auth_user_id) {
            await db.execute('UPDATE `users` SET `email` = ? WHERE `id` = ?', [newEmail, String(stu.auth_user_id)]);
          }
          await db.execute(
            'UPDATE `students` SET `username` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?',
            [newUsername, profileId]
          );
          const r = await db.query<any>('SELECT * FROM `students` WHERE `id` = ? LIMIT 1', [profileId]);
          return r[0];
        });
        if (!updated) {
          return httpErr(res, 400, 'RENAME_FAILED');
        }
        if (stu.auth_user_id) {
          try {
            await revokeRefreshTokens(String(stu.auth_user_id));
          } catch {
            /* không làm hỏng response */
          }
        }
        return res.status(200).json({ ok: true, profile: stripProfile(updated) });
      } catch {
        return httpErr(res, 400, 'RENAME_FAILED');
      }
    }

    return httpErr(res, 400, 'UNKNOWN_ACTION');
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});
