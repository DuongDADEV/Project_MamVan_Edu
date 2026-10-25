import { getAdminClient, synthAuthEmail } from '../_lib/supabase.ts';

/**
 * POST /api/admin/migrate-auth — route 1 LẦN duy nhất.
 * Gated bằng env MIGRATION_TOKEN (admin tự tạo, dùng 1 lần rồi xóa
 * khỏi Vercel env). Sau khi chạy thành công toàn bộ, route tự khóa
 * bằng cờ ai_settings.auth_migrated.
 *
 * Việc làm (mỗi dòng teachers/students chưa có auth_user_id):
 *  1. Tạo auth user qua Admin API với email tổng hợp
 *     `<role>_<username>@mamvan.internal` (đăng nhập vẫn bằng username;
 *     frontend tự ghép email này). Prefix role để tránh trùng email
 *     giữa bảng teachers và students.
 *  2. Mật khẩu GIỮ NGUYÊN: đọc password_hash hiện tại (plaintext)
 *     và đặt làm mật khẩu auth user — chỉ xử lý trong bộ nhớ server,
 *     KHÔNG in/log/trả về mật khẩu. Mật khẩu < 6 ký tự bị Supabase
 *     từ chối → ghi vào danh sách failed (chỉ username), admin reset
 *     sau cho các tài khoản đó.
 *  3. Ghi auth_user_id về dòng đó, rồi NULL password_hash (và
 *     teachers.gemini_api_key — key cũ của giáo viên không còn dùng
 *     sau khi chuyển sang proxy admin).
 * Trả về số lượng + username thất bại (không mật khẩu, không key).
 * Chạy lại an toàn: bỏ qua các dòng đã có auth_user_id.
 */

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const setupToken = process.env.MIGRATION_TOKEN || '';
  if (!setupToken) {
    res.status(500).json({ error: 'MIGRATION_TOKEN_NOT_SET' });
    return;
  }
  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    body = {};
  }
  const token = String(body.token || '');
  if (!token || !safeEqual(token, setupToken)) {
    res.status(401).json({ error: 'BAD_TOKEN' });
    return;
  }

  const admin = getAdminClient();

  // Cờ tự khóa: đã migrate xong toàn bộ thì không chạy lại.
  try {
    const { data: flag } = await admin
      .from('ai_settings')
      .select('value')
      .eq('key', 'auth_migrated')
      .maybeSingle();
    if ((flag as any)?.value?.done === true) {
      res.status(409).json({ error: 'ALREADY_MIGRATED' });
      return;
    }
  } catch {
    // Bảng ai_settings chưa có (migration 014 chưa chạy) — tiếp tục,
    // cờ sẽ được tạo ở cuối nếu migrate xong.
  }

  // Migration 015 phải chạy trước (cột auth_user_id phải tồn tại).
  const probe = await admin.from('teachers').select('id').limit(1);
  if (probe.error && /auth_user_id/i.test(probe.error.message || '')) {
    res.status(500).json({ error: 'MIGRATION_015_NOT_RUN' });
    return;
  }

  async function findUserIdByEmail(email: string): Promise<string | null> {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const hit = (data?.users || []).find(
      (u: any) => String(u.email || '').toLowerCase() === email
    );
    return hit ? hit.id : null;
  }

  async function migrateTable(
    table: 'teachers' | 'students',
    roleOf: (row: any) => string
  ): Promise<{ linked: number; skipped: number; failed: string[] }> {
    const out = { linked: 0, skipped: 0, failed: [] as string[] };
    // students KHÔNG có cột role (chỉ teachers có) — select chung cả 2
    // bảng từng gây TABLE_ERROR:students ở lần migrate đầu (25/10).
    const selectCols =
      table === 'teachers'
        ? 'id,username,password_hash,auth_user_id,role'
        : 'id,username,password_hash,auth_user_id';
    const { data: rows, error } = await admin
      .from(table)
      .select(selectCols)
      .order('username');
    if (error) {
      out.failed.push(`TABLE_ERROR:${table}`);
      return out;
    }
    for (const row of rows || []) {
      if ((row as any).auth_user_id) {
        out.skipped++;
        continue;
      }
      const username = String((row as any).username || '');
      const password = String((row as any).password_hash || '');
      if (!username || !password) {
        out.failed.push(username || `?${(row as any).id}`);
        continue;
      }
      if (password.length < 6) {
        out.failed.push(username);
        continue;
      }
      const role = roleOf(row);
      const email = synthAuthEmail(role, username);
      let userId: string | null = null;
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { role },
          user_metadata: { username },
        });
      if (created?.user?.id) {
        userId = created.user.id;
      } else if (
        createErr &&
        /already|registered|exists/i.test(createErr.message || '')
      ) {
        userId = await findUserIdByEmail(email);
      }
      if (!userId) {
        // Ghi kèm thông báo lỗi để lần sau khỏi đoán mò (thông báo của
        // Auth/PostgREST không chứa secret; cắt 200 ký tự cho gọn).
        out.failed.push(
          `${username} (create: ${String(createErr?.message || 'unknown').slice(0, 200)})`
        );
        continue;
      }
      const patch: any = { auth_user_id: userId, password_hash: null };
      if (table === 'teachers') patch.gemini_api_key = null;
      const { error: updErr } = await admin
        .from(table)
        .update(patch)
        .eq('id', (row as any).id);
      if (updErr) {
        out.failed.push(
          `${username} (update: ${String(updErr.message || 'unknown').slice(0, 200)})`
        );
        continue;
      }
      out.linked++;
    }
    return out;
  }

  const teachers = await migrateTable('teachers', (r) =>
    r.role === 'admin' ? 'admin' : 'teacher'
  );
  const students = await migrateTable('students', () => 'student');

  const allDone = teachers.failed.length === 0 && students.failed.length === 0;
  if (allDone) {
    await admin.from('ai_settings').upsert(
      {
        key: 'auth_migrated',
        value: { done: true, at: new Date().toISOString() },
      },
      { onConflict: 'key' }
    );
  }

  res.status(200).json({
    ok: true,
    migrated: allDone,
    teachers,
    students,
    note: allDone
      ? 'DONE — route tự khóa từ lần sau. Xóa MIGRATION_TOKEN khỏi Vercel env.'
      : 'PARTIAL — một số tài khoản chưa link (xem failed). Chạy lại sau khi admin reset mật khẩu cho các username đó.',
  });
}
