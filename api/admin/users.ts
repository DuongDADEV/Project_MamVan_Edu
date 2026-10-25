import {
  getAdminClient,
  verifyUserToken,
  readBearer,
  synthAuthEmail,
} from '../_lib/supabase.ts';

/**
 * POST /api/admin/users — tạo tài khoản / reset mật khẩu / đổi tên đăng nhập.
 * Đợt 25/10: mật khẩu chỉ sống trong Supabase Auth, profile row chỉ giữ
 * auth_user_id — không còn ghi password_hash trực tiếp từ trình duyệt.
 *
 * Người gọi:
 *  - admin (JWT app_metadata.role = 'admin'): toàn quyền.
 *  - teacher (JWT role = 'teacher'): CHỈ học sinh thuộc lớp mình (tạo,
 *    reset mật khẩu, đổi tên) và CHÍNH MÌNH (reset mật khẩu). Giáo viên
 *    không tạo được giáo viên khác.
 * Mọi kiểm tra phạm vi chạy phía server bằng service role (JWT của người
 * gọi không tự chứng minh được "lớp này là của tôi").
 *
 * Body:
 *  { action: 'create', role: 'teacher'|'student', username, password,
 *    name?, class_id?, student_code?, dob?, email?, phone?, school?,
 *    subject?, status?, trial_expires_at? }
 *  { action: 'reset-password', userId?, table?, profileId?, newPassword }
 *  { action: 'rename-student', profileId, newUsername }
 * Tạo user mà insert profile lỗi → xóa auth user vừa tạo (không để tài
 * khoản mồ côi). Không bao giờ trả về mật khẩu.
 */

type Caller =
  | { kind: 'admin' }
  | { kind: 'teacher'; teacherId: string; classIds: string[] };

async function resolveCaller(
  admin: ReturnType<typeof getAdminClient>,
  userId: string,
  role: string
): Promise<Caller | null> {
  if (role === 'admin') return { kind: 'admin' };
  if (role !== 'teacher') return null;
  const { data: prof } = await admin
    .from('teachers')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (!prof) return null;
  const { data: cls } = await admin
    .from('classes')
    .select('id')
    .eq('teacher_id', (prof as any).id);
  return {
    kind: 'teacher',
    teacherId: (prof as any).id,
    classIds: (cls || []).map((c: any) => c.id as string),
  };
}

function bad(res: any, status: number, error: string, detail?: string) {
  res.status(status).json({ error, detail: detail ? detail.slice(0, 200) : undefined });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const user = await verifyUserToken(readBearer(req));
  if (!user) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    body = {};
  }
  const admin = getAdminClient();
  const caller = await resolveCaller(admin, user.id, user.role);
  if (!caller) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  const isAdmin = caller.kind === 'admin';
  const teacher = caller.kind === 'teacher' ? caller : null;

  if (body.action === 'create') {
    const role = String(body.role || '');
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!['teacher', 'student'].includes(role) || !username) {
      bad(res, 400, 'BAD_INPUT');
      return;
    }
    if (password.length < 6) {
      bad(res, 400, 'PASSWORD_TOO_SHORT');
      return;
    }
    if (role === 'teacher' && !isAdmin) {
      bad(res, 403, 'FORBIDDEN');
      return;
    }
    if (role === 'student') {
      if (!body.class_id) {
        bad(res, 400, 'CLASS_REQUIRED');
        return;
      }
      if (teacher && !teacher.classIds.includes(String(body.class_id))) {
        bad(res, 403, 'CLASS_NOT_OWNED');
        return;
      }
      if (!String(body.name || '').trim()) {
        bad(res, 400, 'NAME_REQUIRED');
        return;
      }
    }
    if (role === 'teacher' && !String(body.name || '').trim()) {
      bad(res, 400, 'NAME_REQUIRED');
      return;
    }
    const email = synthAuthEmail(role, username);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { username },
    });
    if (!created?.user?.id) {
      bad(res, 400, 'CREATE_USER_FAILED', createErr?.message);
      return;
    }
    const authUserId = created.user.id;
    const profile: any = { auth_user_id: authUserId, username, status: 'active' };
    if (role === 'teacher') {
      profile.name = String(body.name).trim();
      profile.role = 'teacher';
      if (body.email) profile.email = String(body.email);
      if (body.phone) profile.phone = String(body.phone);
      if (body.school) profile.school = String(body.school);
      if (body.subject) profile.subject = String(body.subject);
      if (body.status) profile.status = String(body.status);
      if (body.trial_expires_at) profile.trial_expires_at = body.trial_expires_at;
    } else {
      profile.name = String(body.name).trim();
      profile.class_id = body.class_id;
      if (body.student_code) profile.student_code = String(body.student_code);
      if (body.dob) profile.dob = body.dob;
    }
    const table = role === 'teacher' ? 'teachers' : 'students';
    const { data: inserted, error: insErr } = await admin
      .from(table)
      .insert(profile)
      .select()
      .single();
    if (insErr || !inserted) {
      await admin.auth.admin.deleteUser(authUserId);
      bad(res, 400, 'CREATE_PROFILE_FAILED', insErr?.message);
      return;
    }
    res.status(200).json({ ok: true, profileId: (inserted as any).id, authUserId, profile: inserted });
    return;
  }

  if (body.action === 'reset-password') {
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 6) {
      bad(res, 400, 'PASSWORD_TOO_SHORT');
      return;
    }
    let targetAuthId = String(body.userId || '');
    let targetTable = '';
    let targetProfileId = '';
    if (!targetAuthId && body.table && body.profileId) {
      targetTable = String(body.table);
      targetProfileId = String(body.profileId);
      if (!['teachers', 'students'].includes(targetTable)) {
        bad(res, 400, 'BAD_INPUT');
        return;
      }
      const { data } = await admin
        .from(targetTable)
        .select('auth_user_id, class_id')
        .eq('id', targetProfileId)
        .maybeSingle();
      if (!data) {
        bad(res, 400, 'USER_NOT_FOUND');
        return;
      }
      targetAuthId = (data as any).auth_user_id || '';
      if (teacher) {
        const isSelf =
          targetTable === 'teachers' && targetProfileId === teacher.teacherId;
        const isOwnStudent =
          targetTable === 'students' &&
          (data as any).class_id &&
          teacher.classIds.includes(String((data as any).class_id));
        if (!isSelf && !isOwnStudent) {
          bad(res, 403, 'FORBIDDEN');
          return;
        }
      }
    } else if (teacher && targetAuthId) {
      // Reset theo auth id: giáo viên chỉ được reset chính mình hoặc học
      // sinh lớp mình — resolve ngược để kiểm tra.
      const { data: t } = await admin
        .from('teachers')
        .select('id')
        .eq('auth_user_id', targetAuthId)
        .maybeSingle();
      const { data: s } = await admin
        .from('students')
        .select('class_id')
        .eq('auth_user_id', targetAuthId)
        .maybeSingle();
      const isSelf = !!(t as any) && (t as any).id === teacher.teacherId;
      const isOwnStudent =
        !!(s as any) &&
        (s as any).class_id &&
        teacher.classIds.includes(String((s as any).class_id));
      if (!isSelf && !isOwnStudent) {
        bad(res, 403, 'FORBIDDEN');
        return;
      }
    }
    if (!targetAuthId) {
      bad(res, 400, 'USER_NOT_FOUND');
      return;
    }
    const { error } = await admin.auth.admin.updateUserById(targetAuthId, {
      password: newPassword,
    });
    if (error) {
      bad(res, 400, 'RESET_FAILED', error.message);
      return;
    }
    // Trả về profile để UI dựng voucher (tên, lớp, mã HS) như luồng cũ.
    let profile: any = null;
    if (targetTable && targetProfileId) {
      const { data } = await admin
        .from(targetTable)
        .select()
        .eq('id', targetProfileId)
        .maybeSingle();
      profile = data;
    }
    res.status(200).json({ ok: true, profile });
    return;
  }

  if (body.action === 'rename-student') {
    const profileId = String(body.profileId || '');
    const newUsername = String(body.newUsername || '').trim().toLowerCase();
    if (!profileId || !newUsername || /\s/.test(newUsername)) {
      bad(res, 400, 'BAD_INPUT');
      return;
    }
    const { data: stu } = await admin
      .from('students')
      .select('id, username, auth_user_id, class_id')
      .eq('id', profileId)
      .maybeSingle();
    if (!stu) {
      bad(res, 400, 'USER_NOT_FOUND');
      return;
    }
    if (teacher && !teacher.classIds.includes(String((stu as any).class_id))) {
      bad(res, 403, 'FORBIDDEN');
      return;
    }
    const oldUsername = String((stu as any).username || '');
    const oldEmail = synthAuthEmail('student', oldUsername);
    const newEmail = synthAuthEmail('student', newUsername);
    const authId = (stu as any).auth_user_id as string | null;
    if (authId) {
      const { error: authErr } = await admin.auth.admin.updateUserById(authId, {
        email: newEmail,
        user_metadata: { username: newUsername },
      });
      if (authErr) {
        bad(res, 400, 'RENAME_FAILED', authErr.message);
        return;
      }
    }
    const { data: updated, error: updErr } = await admin
      .from('students')
      .update({ username: newUsername, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .select()
      .single();
    if (updErr || !updated) {
      // Rollback email auth về tên cũ để không lệch 2 phía.
      if (authId) {
        await admin.auth.admin.updateUserById(authId, {
          email: oldEmail,
          user_metadata: { username: oldUsername },
        });
      }
      bad(res, 400, 'RENAME_FAILED', updErr?.message);
      return;
    }
    res.status(200).json({ ok: true, profile: updated });
    return;
  }

  res.status(400).json({ error: 'UNKNOWN_ACTION' });
}
