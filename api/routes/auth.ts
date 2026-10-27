import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { query, execute } from '../_lib/mysql';
import {
  requireAuth,
  httpErr,
  synthEmail,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  readBearer,
  loadCaller,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshTokens,
} from '../_lib/auth';

/**
 * POST /auth/sign-in, POST /auth/sign-out, POST /auth/refresh, GET /auth/me.
 * Mount tại /api (tích hợp mount router này tại /api) — các path dưới đây
 * đã là dạng /api-relative.
 *
 * Auth mới (GĐ3, thay Supabase Auth): users MySQL + bcrypt + JWT tự ký
 * HS256 (secret đọc từ env JWT_SECRET — KHÔNG hardcode, KHÔNG in ra).
 * Access token 1 giờ (ký bằng signAccessToken của lib auth), refresh
 * token 7 ngày (lib auth lưu SHA-256 hash trong bảng refresh_tokens).
 *
 * Shape session giữ nguyên AuthSession cũ (src/services/types.ts):
 * { user, role, token, signedInAt } — token = access JWT mới; thêm
 * refreshToken để client xoay phiên, và thêm `class` cho học sinh
 * (thông tin lớp nối từ students.class_id → classes).
 *
 * Lệch khỏi code cũ (ghi rõ, có chủ đích):
 * - buildTeacherSession cũ fallback classIds = [sentinel class UUID] khi
 *   giáo viên chưa có lớp. Server mới KHÔNG làm vậy (sentinel không được
 *   lọt vào dữ liệu/phiên): classIds = [] khi chưa có lớp.
 * - signIn cũ không insert student_sessions (gốc vụ dashboard trống).
 *   Server mới insert 1 dòng mỗi lần học sinh đăng nhập thành công.
 * - getSession cũ: không xác minh được thì GIỮ phiên cũ (tránh đăng xuất
 *   oan khi mất mạng). /auth/me phía server không tái tạo được ngữ nghĩa
 *   "giữ phiên khi mất mạng" (client không tới được server thì tự giữ);
 *   khi tới được server mà không còn profile → 401 + client xóa phiên.
 */

// Rate-limit sign-in: 10 lần / IP / 5 phút → 429. Giới hạn trong bộ nhớ
// của tiến trình (restart là reset; nhiều instance thì mỗi instance đếm
// riêng) — đủ cho GĐ3, không phải rate-limit phân tán.
const SIGNIN_WINDOW_MS = 5 * 60 * 1000;
const SIGNIN_MAX_PER_WINDOW = 10;
const signinHits = new Map<string, { count: number; resetAt: number }>();

function signinAllowed(ip: string): boolean {
  const now = Date.now();
  const cur = signinHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    signinHits.set(ip, { count: 1, resetAt: now + SIGNIN_WINDOW_MS });
    return true;
  }
  cur.count += 1;
  return cur.count <= SIGNIN_MAX_PER_WINDOW;
}

/** Ngày VN (UTC+7) dạng YYYY-MM-DD, tính bằng JS — không dùng CONVERT_TZ. */
function vnToday(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function signAccess(userId: string, role: string): string | null {
  // Lib auth: token chỉ mang sub + role; profile đọc lại mỗi request
  // (loadCaller) nên không cần nhét profileId vào token. Thiếu
  // JWT_SECRET → lib throw SERVER_NOT_CONFIGURED → trả null.
  try {
    return signAccessToken({ sub: userId, role });
  } catch {
    return null;
  }
}

/** Thông báo lỗi đăng nhập chung theo role — không lộ user có tồn tại. */
function genericSigninMessage(role: string): string {
  if (role === 'admin') return 'Tên đăng nhập hoặc mật khẩu Quản trị viên chưa chính xác';
  if (role === 'teacher') return 'Tên đăng nhập hoặc mật khẩu giáo viên chưa chính xác';
  return 'Mật khẩu chưa chính xác. Nếu quên mật khẩu, em hãy nhờ Thầy/Cô cấp lại nhé!';
}

async function buildSession(
  userRow: any,
  accessToken: string,
  refreshToken: string
): Promise<any> {
  const role = String(userRow.role);
  const signedInAt = Date.now();
  if (role === 'admin' || role === 'teacher') {
    const profs = await query<any>(
      'SELECT * FROM `teachers` WHERE `auth_user_id` = ? LIMIT 1',
      [userRow.id]
    );
    const prof = profs[0];
    if (!prof) return null;
    const classRows = await query<any>(
      'SELECT `id` FROM `classes` WHERE `teacher_id` = ?',
      [prof.id]
    );
    const classIds = classRows.map((c: any) => c.id);
    return {
      user: {
        id: prof.id,
        name: prof.name,
        username: prof.username,
        role: role === 'admin' ? 'admin' : 'teacher',
        email: prof.email || undefined,
        subject: role === 'teacher' ? prof.subject || 'Ngữ văn 7' : undefined,
        school: role === 'teacher' ? prof.school || 'THCS Giấy & Mực' : undefined,
        classIds,
        phone: prof.phone || undefined,
      },
      role,
      token: accessToken,
      refreshToken,
      signedInAt,
    };
  }
  // student
  const stus = await query<any>(
    'SELECT s.*, c.`name` AS class_name, c.`grade` AS class_grade, c.`school_year` AS class_school_year ' +
      'FROM `students` s LEFT JOIN `classes` c ON c.`id` = s.`class_id` ' +
      'WHERE s.`auth_user_id` = ? LIMIT 1',
    [userRow.id]
  );
  const stu = stus[0];
  if (!stu) return null;
  return {
    user: {
      id: stu.id,
      name: stu.name,
      username: stu.username,
      role: 'student',
      grade: stu.class_grade || 'Lớp 7',
      school: 'THCS Giấy & Mực',
      avatarSeed: (stu as any).avatar_seed || stu.username,
    },
    role: 'student',
    token: accessToken,
    refreshToken,
    signedInAt,
    class: stu.class_id
      ? {
          id: stu.class_id,
          name: stu.class_name || null,
          grade: stu.class_grade || null,
          school_year: stu.class_school_year || null,
        }
      : null,
  };
}

/** Đọc profile + kiểm tra role/status. Trả { profile, locked, roleMismatch }. */
async function loadProfileForSignin(userRow: any, role: string): Promise<any> {
  if (role === 'admin' || role === 'teacher') {
    const profs = await query<any>(
      'SELECT * FROM `teachers` WHERE `auth_user_id` = ? LIMIT 1',
      [userRow.id]
    );
    const prof = profs[0];
    if (!prof) return { missing: true };
    if (String(prof.role) !== role) return { roleMismatch: true };
    if (String(prof.status) === 'locked') return { locked: true, profile: prof };
    return { profile: prof };
  }
  const stus = await query<any>(
    'SELECT * FROM `students` WHERE `auth_user_id` = ? LIMIT 1',
    [userRow.id]
  );
  const stu = stus[0];
  if (!stu) return { missing: true };
  if (String(stu.status) === 'locked') return { locked: true, profile: stu };
  return { profile: stu };
}

export const authRouter = Router();

authRouter.post('/auth/sign-in', async (req: Request, res: Response) => {
  try {
    const ip = String((req as any).ip || req.socket?.remoteAddress || 'unknown');
    if (!signinAllowed(ip)) {
      return httpErr(res, 429, 'TOO_MANY_REQUESTS');
    }
    const role = String(req.body?.role || '');
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!['admin', 'teacher', 'student'].includes(role) || !username || !password) {
      return httpErr(res, 400, 'BAD_INPUT');
    }
    const email = synthEmail(role, username);
    const users = await query<any>(
      'SELECT * FROM `users` WHERE `email` = ? LIMIT 1',
      [email]
    );
    const userRow = users[0];
    // Sai ở bước nào cũng chung 1 thông báo theo role (không lộ user tồn tại).
    if (!userRow) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: genericSigninMessage(role) });
    }
    const ok = await verifyPassword(password, String(userRow.encrypted_password || ''));
    if (!ok) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: genericSigninMessage(role) });
    }
    const chk = await loadProfileForSignin(userRow, role);
    if (chk.missing) {
      return res.status(401).json({
        error: 'PROFILE_NOT_FOUND',
        message:
          role === 'student'
            ? 'Tài khoản chưa được liên kết hồ sơ. Vui lòng liên hệ Thầy/Cô phụ trách nhé!'
            : 'Tài khoản chưa được liên kết hồ sơ. Vui lòng liên hệ quản trị viên!',
      });
    }
    if (chk.roleMismatch) {
      return res.status(403).json({ error: 'ROLE_MISMATCH', message: 'Tài khoản này không thuộc phân hệ đã chọn.' });
    }
    if (chk.locked) {
      return res.status(403).json({
        error: 'ACCOUNT_LOCKED',
        isLocked: true,
        message:
          role === 'admin'
            ? 'Tài khoản Quản trị viên đã bị khóa. Vui lòng liên hệ hỗ trợ kỹ thuật!'
            : role === 'teacher'
              ? 'Tài khoản giáo viên đã bị khóa. Vui lòng liên hệ quản trị viên!'
              : 'Tài khoản của em đang tạm khóa. Vui lòng liên hệ Thầy/Cô phụ trách để mở khóa nhé!',
      });
    }
    const profile = chk.profile;
    const accessToken = signAccess(String(userRow.id), role);
    if (!accessToken) {
      return httpErr(res, 500, 'SERVER_NOT_CONFIGURED');
    }
    const refreshToken = await createRefreshToken(String(userRow.id));
    if (role === 'student') {
      // Ghi nhận đăng nhập + phiên học (gốc vụ dashboard trống trước đây:
      // không code nào insert student_sessions nên KPI "Hoạt động 7 ngày" = 0).
      // Cột student_sessions theo DDL: session_id (PK, không default nên
      // phải tự sinh), student_id, login_at, login_date (+ logout_at,
      // session_duration_minutes, device_type, session_status để NULL trừ
      // session_status đặt 'ACTIVE' — giá trị lịch sử trong dữ liệu cũ là
      // 'COMPLETED' cho phiên đã kết thúc; phiên vừa mở là 'ACTIVE').
      await execute(
        'UPDATE `students` SET `has_logged_in` = 1, `last_active_at` = UTC_TIMESTAMP() WHERE `id` = ?',
        [profile.id]
      );
      await execute(
        'INSERT INTO `student_sessions` (`session_id`, `student_id`, `login_at`, `login_date`, `session_status`) ' +
          'VALUES (?, ?, UTC_TIMESTAMP(), ?, ?)',
        [randomUUID(), profile.id, vnToday(), 'ACTIVE']
      );
    }
    const session = await buildSession(userRow, accessToken, refreshToken);
    if (!session) {
      return httpErr(res, 401, 'PROFILE_NOT_FOUND');
    }
    return res.status(200).json({ session });
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

authRouter.post('/auth/sign-out', async (req: Request, res: Response) => {
  // Cố tình KHÔNG qua requireAuth: tài khoản đã bị khóa vẫn phải sign-out
  // được (middleware sẽ chặn 403 ACCOUNT_LOCKED trước khi tới handler).
  // Token không hợp lệ cũng vẫn trả ok — client xóa phiên local là đủ.
  // JWT access stateless nên sign-out chủ yếu là client xóa token; ở đây
  // thu hồi toàn bộ refresh token của user nếu client gửi kèm refreshToken
  // (lib auth: revokeRefreshTokens(userId) đánh revoked=1 mọi token của user).
  try {
    const refreshToken = String(req.body?.refreshToken || '');
    if (refreshToken) {
      const verified = verifyAccessToken(readBearer(req));
      if (verified) {
        const caller = await loadCaller(verified.sub, verified.role);
        if (caller) {
          try {
            await revokeRefreshTokens(caller.userId);
          } catch {
            /* thu hồi lỗi cũng vẫn trả ok */
          }
        }
      }
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true });
  }
});

authRouter.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = String(req.body?.refreshToken || '');
    if (!refreshToken) {
      return httpErr(res, 400, 'BAD_INPUT');
    }
    // Lib auth: validateRefreshToken kiểm tra token còn sống (chưa
    // revoke, chưa hết hạn) và TRẢ LẠI CHÍNH token đó — không xoay, để
    // mất response hay 2 tab cùng refresh cũng không kẹt (xem ghi chú
    // ở validateRefreshToken). Token lạ/hết hạn/đã revoke → null.
    const validated = await validateRefreshToken(refreshToken);
    if (!validated) {
      return httpErr(res, 401, 'UNAUTHORIZED');
    }
    const userId = validated.userId;
    const users = await query<any>('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [userId]);
    const userRow = users[0];
    if (!userRow) {
      return httpErr(res, 401, 'UNAUTHORIZED');
    }
    const role = String(userRow.role);
    const chk = await loadProfileForSignin(userRow, role);
    if (chk.missing || chk.roleMismatch || chk.locked) {
      return httpErr(res, 401, 'UNAUTHORIZED');
    }
    const accessToken = signAccess(String(userRow.id), role);
    if (!accessToken) {
      return httpErr(res, 500, 'SERVER_NOT_CONFIGURED');
    }
    const sameRefresh = validated.refreshToken;
    const session = await buildSession(userRow, accessToken, sameRefresh);
    if (!session) {
      return httpErr(res, 401, 'UNAUTHORIZED');
    }
    return res.status(200).json({ session, accessToken, refreshToken: sameRefresh });
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});

authRouter.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const caller: any = (req as any).caller;
    const userId = caller?.userId ?? caller?.id ?? caller?.sub;
    if (!userId) {
      return httpErr(res, 401, 'UNAUTHORIZED');
    }
    const users = await query<any>('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [userId]);
    const userRow = users[0];
    if (!userRow) {
      return httpErr(res, 401, 'UNAUTHORIZED');
    }
    const role = String(userRow.role);
    const chk = await loadProfileForSignin(userRow, role);
    // Tự chữa lệch như getSession cũ: dựng lại phiên từ hồ sơ thật; không
    // profile → 401 + client xóa phiên (không giữ phiên xác chết).
    if (chk.missing || chk.roleMismatch || chk.locked) {
      return httpErr(res, 401, 'UNAUTHORIZED');
    }
    const accessToken = signAccess(String(userRow.id), role);
    if (!accessToken) {
      return httpErr(res, 500, 'SERVER_NOT_CONFIGURED');
    }
    // /auth/me không xoay refresh token: client giữ refresh cũ; chỉ cấp
    // access mới để phiên tiếp tục chạy (tránh vô hiệu refresh khi chỉ
    // kiểm tra phiên).
    const session = await buildSession(userRow, accessToken, String(req.body?.refreshToken || ''));
    if (!session) {
      return httpErr(res, 401, 'UNAUTHORIZED');
    }
    return res.status(200).json({ session });
  } catch {
    return httpErr(res, 500, 'SERVER_ERROR');
  }
});
