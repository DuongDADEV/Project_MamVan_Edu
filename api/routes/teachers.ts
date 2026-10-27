/**
 * Router teachers (GĐ3, tích hợp thêm — client ApiTeacherRepository cần
 * GET/PATCH/DELETE /api/teachers ngoài tạo tài khoản qua /api/admin/users).
 * Mount tại /api.
 *
 * Phân quyền (luật 26/10): admin toàn quyền; teacher chỉ chính mình
 * (list trả [chính mình], PATCH tự thân không được đổi status/trial);
 * student 403. Không bao giờ trả password_hash / gemini_api_key.
 * DELETE chỉ xóa dòng teachers (giữ đúng code gốc — dòng users tương
 * ứng thành mồ côi, xem TODO; không tự xóa kèm để tránh lệch hành vi).
 */
import { Router } from 'express';
import { query, execute } from '../_lib/mysql';
import { requireAuth, requireRole, httpErr } from '../_lib/auth';
import type { AuthedRequest } from '../_lib/auth';
import { bodyOf, checkKeyLen, rejectSentinel, isAdmin, isTeacher, isStudent } from './_shared';

export const teachersRouter = Router();
teachersRouter.use(requireAuth);

function stripTeacher(row: any): any {
  if (!row) return row;
  const { password_hash, gemini_api_key, ...rest } = row;
  return rest;
}

/** Giáo viên có được xem/sửa dòng này không (admin: mọi dòng). */
function canAccessTeacher(caller: any, teacherId: string): boolean {
  if (isAdmin(caller)) return true;
  if (isTeacher(caller)) return caller.teacherId === teacherId;
  return false;
}

teachersRouter.get('/teachers', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  if (isStudent(caller)) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  if (isTeacher(caller)) {
    if (!caller.teacherId) {
      res.json([]);
      return;
    }
    const rows = await query<any>('SELECT * FROM `teachers` WHERE `id` = ? LIMIT 1', [caller.teacherId]);
    res.json(rows.map(stripTeacher));
    return;
  }
  const rows = await query<any>('SELECT * FROM `teachers` ORDER BY `created_at` DESC');
  res.json(rows.map(stripTeacher));
});

teachersRouter.get('/teachers/:id', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  if (!checkKeyLen(res, id) || !rejectSentinel(res, id)) return;
  if (!canAccessTeacher(caller, id)) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const rows = await query<any>('SELECT * FROM `teachers` WHERE `id` = ? LIMIT 1', [id]);
  if (!rows[0]) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  res.json(stripTeacher(rows[0]));
});

const PATCH_COLS: Record<string, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  school: 'school',
  subject: 'subject',
  status: 'status',
  trialExpiresAt: 'trial_expires_at',
  trial_expires_at: 'trial_expires_at',
};
// notes không có cột trong DDL teachers → bỏ qua (client có gửi kèm).

teachersRouter.patch('/teachers/:id', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  if (!checkKeyLen(res, id) || !rejectSentinel(res, id)) return;
  if (!canAccessTeacher(caller, id)) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const body = bodyOf(req);
  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, col] of Object.entries(PATCH_COLS)) {
    if (body[key] === undefined) continue;
    // status / trial chỉ admin được đổi (giáo viên tự sửa thì bỏ qua).
    if (!isAdmin(caller) && (col === 'status' || col === 'trial_expires_at')) continue;
    if (col === 'status' && !['trial', 'active', 'locked'].includes(String(body[key]))) {
      httpErr(res, 400, 'BAD_INPUT');
      return;
    }
    sets.push(`\`${col}\` = ?`);
    params.push(body[key] === null ? null : body[key]);
  }
  if (!sets.length) {
    const rows = await query<any>('SELECT * FROM `teachers` WHERE `id` = ? LIMIT 1', [id]);
    if (!rows[0]) {
      httpErr(res, 404, 'NOT_FOUND');
      return;
    }
    res.json(stripTeacher(rows[0]));
    return;
  }
  const out: any = await execute(
    `UPDATE \`teachers\` SET ${sets.join(', ')} WHERE \`id\` = ?`,
    [...params, id]
  );
  if (!out.affectedRows) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  const rows = await query<any>('SELECT * FROM `teachers` WHERE `id` = ? LIMIT 1', [id]);
  res.json(stripTeacher(rows[0]));
});

teachersRouter.delete('/teachers/:id', requireRole('admin'), async (req: AuthedRequest, res) => {
  const id = req.params.id;
  if (!checkKeyLen(res, id) || !rejectSentinel(res, id)) return;
  const out: any = await execute('DELETE FROM `teachers` WHERE `id` = ?', [id]);
  if (!out.affectedRows) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  res.json({ ok: true });
});
