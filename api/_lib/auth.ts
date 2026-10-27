import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { db, withTransaction } from './mysql.ts';
import { classTeacherId, teacherClassIds } from './scope.ts';

/**
 * GĐ3 — auth VPS-only: JWT tự ký (HS256) + bcrypt + refresh token.
 * Thay thế Supabase Auth: nguồn thật duy nhất là bảng `users` trong
 * MySQL (xem hidden_files/users_table_mysql.sql + auth_import_design.md).
 * KHÔNG bao giờ trả encrypted_password / hash refresh token ra client.
 *
 * Lưu ý theo khảo sát §3.4: token chỉ mang `sub` + `role`; middleware
 * KHÔNG tin role trong token một cách mù mà đọc lại users + profile
 * mỗi request (loadCaller) — đổi role/khóa tài khoản có hiệu lực ngay
 * mà không cần chờ token hết hạn. JWT stateless nên sign-out chỉ là
 * client xóa token + thu hồi refresh token; tài khoản bị khóa được
 * chặn ở middleware mỗi request (403 ACCOUNT_LOCKED).
 */

export type CallerRole = 'admin' | 'teacher' | 'student';

export interface Caller {
  userId: string;
  role: CallerRole;
  teacherId?: string;
  profileId?: string;
  studentId?: string;
  classId?: string;
  classIds?: string[];
}

/**
 * Request Express đã qua requireAuth: giống Request thường, thêm
 * caller (không bắt buộc ở kiểu để route chưa qua auth vẫn biên dịch;
 * requireRole trả 401 khi thiếu caller).
 */
export interface AuthedRequest extends Request {
  caller?: Caller;
}

/** Email tổng hợp — giữ nguyên format của Supabase Auth cũ để tài khoản
 *  đã migrate vẫn đăng nhập được: {role}_{username}@mamvan.internal. */
export function synthEmail(role: string, username: string): string {
  return `${role}_${username.trim()}@mamvan.internal`.toLowerCase();
}

export function readBearer(req: any): string {
  const h = req?.headers?.authorization || req?.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  return m ? m[1] : '';
}

/** Access token hết hạn 1 giờ. Thiếu JWT_SECRET → throw SERVER_NOT_CONFIGURED. */
export function signAccessToken(input: { sub: string; role: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('SERVER_NOT_CONFIGURED');
  return jwt.sign({ sub: input.sub, role: input.role }, secret, { expiresIn: '1h' });
}

/** Verify chữ ký + hạn. Mọi lỗi (thiếu secret, sai chữ ký, hết hạn,
 *  payload thiếu sub/role) đều → null, không throw. */
export function verifyAccessToken(token: string): { sub: string; role: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret) as any;
    if (typeof payload?.sub !== 'string' || typeof payload?.role !== 'string') return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

interface CallerWithStatus {
  caller: Caller;
  status: string | null;
}

async function loadCallerInternal(userId: string, role: string): Promise<CallerWithStatus | null> {
  if (role !== 'admin' && role !== 'teacher' && role !== 'student') return null;
  const users = await db.query<any[]>('SELECT id, role FROM users WHERE id = ? LIMIT 1', [userId]);
  const user = users[0];
  // Role trong token phải khớp cột users.role — lệch là phiên cũ/sai, từ chối.
  if (!user || user.role !== role) return null;

  if (role === 'student') {
    const rows = await db.query<any[]>(
      'SELECT id, class_id, status FROM students WHERE auth_user_id = ? LIMIT 1',
      [userId]
    );
    const profile = rows[0];
    if (!profile) return null;
    const teacherId = profile.class_id ? await classTeacherId(db, profile.class_id) : null;
    return {
      caller: {
        userId,
        role: 'student',
        profileId: profile.id,
        studentId: profile.id,
        classId: profile.class_id ?? undefined,
        teacherId: teacherId ?? undefined,
      },
      status: profile.status ?? null,
    };
  }

  // admin + teacher đều sống trong bảng teachers (admin: role='admin').
  const rows = await db.query<any[]>(
    'SELECT id, status FROM teachers WHERE auth_user_id = ? LIMIT 1',
    [userId]
  );
  const profile = rows[0];
  if (!profile) return null;
  if (role === 'admin') {
    // Admin toàn quyền, không gắn classIds (route kiểm tra role trước).
    return { caller: { userId, role: 'admin', teacherId: profile.id, profileId: profile.id }, status: profile.status ?? null };
  }
  const classIds = await teacherClassIds(db, profile.id);
  return {
    caller: { userId, role: 'teacher', teacherId: profile.id, profileId: profile.id, classIds },
    status: profile.status ?? null,
  };
}

/**
 * Đọc users + profile theo userId/role. Trả null khi: role lạ, không có
 * users, role lệch users.role, hoặc không có profile (tài khoản mồ côi).
 * Không kiểm tra status ở đây — requireAuth tự xử lý ACCOUNT_LOCKED.
 */
export async function loadCaller(userId: string, role: string): Promise<Caller | null> {
  const found = await loadCallerInternal(userId, role);
  return found ? found.caller : null;
}

/**
 * Middleware Express: đọc Bearer → verify JWT → loadCaller → gắn
 * (req as any).caller rồi gọi next(). Lỗi:
 *  - thiếu JWT_SECRET → 500 SERVER_NOT_CONFIGURED
 *  - thiếu/sai/hết hạn token, không load được caller → 401 UNAUTHORIZED
 *  - profile status='locked' → 403 ACCOUNT_LOCKED
 *  - lỗi DB bất ngờ → 500 SERVER_ERROR (không lộ chi tiết).
 */
export async function requireAuth(req: any, res: any, next: () => void): Promise<void> {
  try {
    if (!process.env.JWT_SECRET) {
      httpErr(res, 500, 'SERVER_NOT_CONFIGURED');
      return;
    }
    const token = readBearer(req);
    if (!token) {
      httpErr(res, 401, 'UNAUTHORIZED');
      return;
    }
    const verified = verifyAccessToken(token);
    if (!verified) {
      httpErr(res, 401, 'UNAUTHORIZED');
      return;
    }
    const found = await loadCallerInternal(verified.sub, verified.role);
    if (!found) {
      httpErr(res, 401, 'UNAUTHORIZED');
      return;
    }
    if (found.status === 'locked') {
      httpErr(res, 403, 'ACCOUNT_LOCKED');
      return;
    }
    (req as any).caller = found.caller;
    next();
  } catch {
    httpErr(res, 500, 'SERVER_ERROR');
  }
}

/** Middleware factory: chỉ cho các role liệt kê qua (sau requireAuth).
 *  Chưa có caller → 401; sai role → 403 FORBIDDEN. */
export function requireRole(...roles: string[]) {
  return (req: any, res: any, next: () => void): void => {
    const caller = (req as any).caller as Caller | undefined;
    if (!caller) {
      httpErr(res, 401, 'UNAUTHORIZED');
      return;
    }
    if (!roles.includes(caller.role)) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
    next();
  };
}

/**
 * Trả lỗi đúng quy ước route cũ: body chỉ { error: code }, không stack
 * trace, không chi tiết nội bộ. Tham số message chỉ để call-site ghi
 * chú (không gửi ra client — route tự log nếu cần).
 */
export function httpErr(res: any, status: number, code: string, _message?: string): void {
  res.status(status).json({ error: code });
}

/** Bcrypt 10 rounds — cùng độ mạnh với hash đã migrate từ Supabase Auth. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** So khớp bcrypt; mọi lỗi (hash hỏng, đầu vào lạ) → false, không throw. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function insertRefreshToken(
  tx: any,
  userId: string
): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex');
  await tx.execute(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked)
     VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY), 0)`,
    [crypto.randomUUID(), userId, hashRefreshToken(raw)]
  );
  return raw;
}

/**
 * Tạo refresh token 7 ngày: chỉ SHA-256 hash được lưu DB, raw token chỉ
 * trả về 1 lần cho caller (client giữ, server không giữ bản raw).
 */
export async function createRefreshToken(userId: string): Promise<string> {
  return withTransaction(async (tx) => insertRefreshToken(tx, userId));
}

/**
 * Đổi refresh token: hash + tra cứu (chưa revoke, chưa hết hạn) → xóa
 * token cũ, tạo token mới, trả { userId, newRefresh }. Token lạ/hết
 * hạn/đã revoke → null. Xoay trong cùng 1 transaction nên token cũ
 * không thể dùng 2 lần (dùng lại sau khi xoay → null).
 */
export async function consumeRefreshToken(
  token: string
): Promise<{ userId: string; newRefresh: string } | null> {
  if (!token) return null;
  return withTransaction(async (tx) => {
    const rows = await tx.query<any[]>(
      `SELECT user_id FROM refresh_tokens
        WHERE token_hash = ? AND revoked = 0 AND expires_at > UTC_TIMESTAMP() LIMIT 1`,
      [hashRefreshToken(token)]
    );
    const row = rows[0];
    if (!row) return null;
    await tx.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashRefreshToken(token)]);
    const newRefresh = await insertRefreshToken(tx, row.user_id);
    return { userId: row.user_id, newRefresh };
  });
}

/** Thu hồi toàn bộ refresh token của 1 user (đổi mật khẩu / khóa tài
 *  khoản / đăng xuất mọi thiết bị): đánh revoked=1, giữ hàng để đối
 *  chiếu — consumeRefreshToken đã loại hàng revoked. */
export async function revokeRefreshTokens(userId: string): Promise<void> {
  await db.execute('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);
}
