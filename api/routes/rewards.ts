/**
 * Router nhóm B — mốc quà / yêu cầu đổi quà. Mount tại /api.
 *
 * LUỒNG TRỪ/HOÀN XP THỰC TẾ (đọc code gốc SupabaseRewardRepository +
 * types RewardRequest, KHÁC với ghi chú khảo sát §2.5 "trừ khi duyệt"):
 * - TRỪ LÚC TẠO YÊU CẦU (createRequest): kiểm tra TỔNG XP (ví vĩnh viễn)
 *   >= requiredXp, thiếu -> lỗi; đủ -> trừ ngay vào total_xp qua
 *   deductForGift, số trừ lưu theo yêu cầu (gốc lưu deductedXp trong
 *   bản sao yêu cầu ở state học sinh).
 * - DUYỆT (APPROVED): KHÔNG trừ thêm (đã trừ lúc tạo).
 * - TỪ CHỐI (REJECTED): HOÀN 100% qua refundGift (gốc: refundIfRejected
 *   cộng lại deductedXp rồi đặt về 0).
 * - GIVEN/OPENED: chỉ đổi trạng thái, không chạm XP.
 * Hạn chế server hiện tại: reward_requests KHÔNG có cột deducted_xp
 * nên số hoàn khi từ chối lấy = xp_cost HIỆN TẠI của tier khớp
 * chest_type; nếu tier đổi giá sau khi tạo yêu cầu thì số hoàn lệch
 * với số đã trừ — TODO: thêm cột deducted_xp vào reward_requests ở
 * đợt migration sau để hoàn chính xác tuyệt đối (xem báo cáo).
 *
 * Default 3 trường mô tả quà (khảo sát §5 — DB đã bỏ default):
 * teaser 'Món quà bí mật thú vị', secret_name 'Món quà bí mật',
 * secret_description 'Chi tiết quà tặng dành cho học sinh chăm chỉ.'
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query, withTransaction, parseJson, toMySQLDatetime } from '../_lib/mysql';
import type { Db } from '../_lib/mysql';
import { requireAuth, requireRole, httpErr } from '../_lib/auth';
import type { AuthedRequest } from '../_lib/auth';
import { deductForGift, refundGift, getTotals } from '../_lib/xp';
import { teacherClassIds, studentTeacherId } from '../_lib/scope';
import {
  db,
  bodyOf,
  checkKeyLen,
  rejectSentinel,
  toNum,
  isAdmin,
  isTeacher,
  isStudent,
  canAccessStudent,
  findStudent,
  ah,
} from './_shared';

export const rewardsRouter = Router();
rewardsRouter.use(requireAuth);

const DEFAULT_TEASER = 'Món quà bí mật thú vị';
const DEFAULT_SECRET_NAME = 'Món quà bí mật';
const DEFAULT_SECRET_DESC = 'Chi tiết quà tặng dành cho học sinh chăm chỉ.';

function tierKeyForXp(xpReq: number): string {
  return xpReq <= 300 ? 'HAT' : xpReq <= 500 ? 'LA' : xpReq <= 700 ? 'HOA' : 'VANG';
}

function rowToReward(row: any): any {
  return {
    id: row.id,
    requiredXp: row.required_xp ?? row.xp_cost ?? 0,
    xpCost: row.xp_cost ?? row.required_xp ?? 0,
    requiredAttendanceDays: row.required_attendance_days ?? 4,
    tierKey: row.tier_key,
    teaserDescription: row.teaser_description || DEFAULT_TEASER,
    secret: {
      name: row.secret_name || DEFAULT_SECRET_NAME,
      description: row.secret_description || DEFAULT_SECRET_DESC,
    },
    isPhysical: !!row.is_physical,
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    stock: row.stock ?? undefined,
    isActive: row.is_active ?? true,
    teacherId: row.teacher_id ?? undefined,
  };
}

function dbStatusOf(status: string): string {
  return status === 'PENDING_APPROVAL' ? 'PENDING' : status;
}
function appStatusOf(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    GIVEN: 'GIVEN',
    OPENED: 'OPENED',
  };
  return map[status] || 'PENDING_APPROVAL';
}

async function teacherTierScope(conn: Db, caller: any): Promise<{ teacherIds: string[] | null; studentIds: string[] | null }> {
  if (isAdmin(caller)) return { teacherIds: null, studentIds: null };
  if (isTeacher(caller) && caller.teacherId) {
    const classIds = await teacherClassIds(conn, caller.teacherId);
    if (!classIds.length) return { teacherIds: [caller.teacherId], studentIds: [] };
    const students = await conn.query<any>(
      `SELECT \`id\` FROM \`students\` WHERE \`class_id\` IN (${classIds.map(() => '?').join(',')})`,
      classIds
    );
    return { teacherIds: [caller.teacherId], studentIds: students.map((s: any) => s.id) };
  }
  if (isStudent(caller) && caller.studentId) {
    return { teacherIds: null, studentIds: [caller.studentId] };
  }
  return { teacherIds: [], studentIds: [] };
}

// ---------------------------------------------------------------- rewards
rewardsRouter.get('/rewards', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  let rows: any[];
  if (isTeacher(caller)) {
    rows = await query<any>(
      'SELECT * FROM `reward_tiers` WHERE `teacher_id` = ? ORDER BY `required_xp` ASC',
      [caller.teacherId]
    );
  } else if (isStudent(caller)) {
    // Học sinh thấy mốc của giáo viên phụ trách lớp mình.
    const tid = caller.studentId ? await studentTeacherId(db, caller.studentId) : null;
    rows = tid
      ? await query<any>(
          'SELECT * FROM `reward_tiers` WHERE `teacher_id` = ? AND `is_active` = 1 ORDER BY `required_xp` ASC',
          [tid]
        )
      : [];
  } else {
    rows = await query<any>('SELECT * FROM `reward_tiers` ORDER BY `required_xp` ASC');
  }
  res.json(rows.map(rowToReward));
});

rewardsRouter.post('/rewards', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const body = bodyOf(req);
  // Giáo viên: ép teacher_id = mình; admin: lấy từ body (hoặc null).
  const teacherId = isTeacher(caller) ? caller.teacherId : body.teacherId || body.teacher_id || null;
  const id = typeof body.id === 'string' && body.id ? body.id : 'reward_' + randomUUID();
  if (!checkKeyLen(res, id)) return;
  const xpReq = toNum(body.requiredXp ?? body.required_xp ?? 300, 300);
  const tierKey = body.tierKey || body.tier_key || tierKeyForXp(xpReq);
  const teaser = body.teaserDescription || body.teaser_description || DEFAULT_TEASER;
  const secret = body.secret || {};
  const secretName = secret.name || body.secretName || body.secret_name || DEFAULT_SECRET_NAME;
  const secretDesc = secret.description || body.secretDescription || body.secret_description || DEFAULT_SECRET_DESC;
  await query(
    'INSERT INTO `reward_tiers` (`id`, `teacher_id`, `required_xp`, `xp_cost`, `required_attendance_days`, `tier_key`, `teaser_description`, `secret_name`, `secret_description`, `is_physical`, `name`, `description`, `stock`, `is_active`) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE `teacher_id` = VALUES(`teacher_id`), `required_xp` = VALUES(`required_xp`), `xp_cost` = VALUES(`xp_cost`), ' +
      '`required_attendance_days` = VALUES(`required_attendance_days`), `tier_key` = VALUES(`tier_key`), `teaser_description` = VALUES(`teaser_description`), ' +
      '`secret_name` = VALUES(`secret_name`), `secret_description` = VALUES(`secret_description`), `is_physical` = VALUES(`is_physical`), ' +
      '`name` = VALUES(`name`), `description` = VALUES(`description`), `stock` = VALUES(`stock`), `is_active` = VALUES(`is_active`)',
    [
      id,
      teacherId,
      xpReq,
      toNum(body.xpCost ?? body.xp_cost, xpReq),
      toNum(body.requiredAttendanceDays ?? body.required_attendance_days, 4),
      tierKey,
      teaser,
      secretName,
      secretDesc,
      body.isPhysical ?? body.is_physical ? 1 : 0,
      body.name ?? null,
      body.description ?? null,
      body.stock ?? null,
      body.isActive ?? body.is_active ?? true ? 1 : 0,
    ]
  );
  const rows = await query<any>('SELECT * FROM `reward_tiers` WHERE `id` = ? LIMIT 1', [id]);
  res.status(201).json(rowToReward(rows[0]));
});

rewardsRouter.patch('/rewards/:id', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  if (!checkKeyLen(res, id)) return;
  const rows = await query<any>('SELECT * FROM `reward_tiers` WHERE `id` = ? LIMIT 1', [id]);
  const cur = rows[0];
  if (!cur) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isTeacher(caller) && cur.teacher_id !== caller.teacherId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const body = bodyOf(req);
  const merged = { ...rowToReward(cur), ...body };
  // Không cho đổi chủ sở hữu qua PATCH.
  const teaser = merged.teaserDescription || DEFAULT_TEASER;
  const secret = merged.secret || {};
  await query(
    'UPDATE `reward_tiers` SET `required_xp` = ?, `xp_cost` = ?, `required_attendance_days` = ?, `tier_key` = ?, `teaser_description` = ?, `secret_name` = ?, `secret_description` = ?, `is_physical` = ?, `name` = ?, `description` = ?, `stock` = ?, `is_active` = ? WHERE `id` = ?',
    [
      toNum(merged.requiredXp, cur.required_xp),
      toNum(merged.xpCost, cur.xp_cost),
      toNum(merged.requiredAttendanceDays, cur.required_attendance_days),
      merged.tierKey || cur.tier_key,
      teaser,
      secret.name || DEFAULT_SECRET_NAME,
      secret.description || DEFAULT_SECRET_DESC,
      merged.isPhysical ? 1 : 0,
      merged.name ?? null,
      merged.description ?? null,
      merged.stock ?? null,
      merged.isActive ?? true ? 1 : 0,
      id,
    ]
  );
  const updated = await query<any>('SELECT * FROM `reward_tiers` WHERE `id` = ? LIMIT 1', [id]);
  res.json(rowToReward(updated[0]));
});

rewardsRouter.delete('/rewards/:id', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  if (!checkKeyLen(res, id)) return;
  const rows = await query<any>('SELECT * FROM `reward_tiers` WHERE `id` = ? LIMIT 1', [id]);
  const cur = rows[0];
  if (!cur) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isTeacher(caller) && cur.teacher_id !== caller.teacherId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  await query('DELETE FROM `reward_tiers` WHERE `id` = ?', [id]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- requests
async function enrichRequests(conn: Db, rows: any[]): Promise<any[]> {
  if (!rows.length) return [];
  const tiers = await conn.query<any>('SELECT * FROM `reward_tiers`');
  const rewards = tiers.map(rowToReward);
  const studentIds = [...new Set(rows.map((r: any) => r.student_id))];
  const stRows = await conn.query<any>(
    `SELECT s.\`id\`, s.\`name\`, s.\`class_id\`, c.\`name\` AS class_name FROM \`students\` s LEFT JOIN \`classes\` c ON c.\`id\` = s.\`class_id\` WHERE s.\`id\` IN (${studentIds.map(() => '?').join(',')})`,
    studentIds
  );
  const stMap = new Map(stRows.map((s: any) => [s.id, s]));
  const stateRows = await conn.query<any>(
    `SELECT \`student_id\`, \`xp_week\`, \`attendance_days_this_week\` FROM \`student_states\` WHERE \`student_id\` IN (${studentIds.map(() => '?').join(',')})`,
    studentIds
  );
  const stateMap = new Map(stateRows.map((s: any) => [s.student_id, s]));
  return rows.map((row: any) => {
    const tierKey = String(row.chest_type || 'hat').toUpperCase();
    const matched = rewards.find((r: any) => r.tierKey === tierKey);
    const live: any = stateMap.get(row.student_id);
    const xpWeekActual = live?.xp_week ?? row.xp_week_snapshot ?? 0;
    const attendanceDaysActual = live?.attendance_days_this_week ?? 0;
    const reqXp = matched ? matched.requiredXp || matched.xpCost || 0 : 0;
    const reqDays = matched ? matched.requiredAttendanceDays || 0 : 0;
    const st: any = stMap.get(row.student_id);
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: st?.name || 'Học sinh',
      classId: st?.class_id,
      className: st?.class_name,
      rewardId: matched?.id || `tier_${String(row.chest_type || 'hat').toLowerCase()}`,
      giftName: row.gift_name,
      requestedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      approvedAt: row.approved_at ? new Date(row.approved_at).getTime() : undefined,
      status: appStatusOf(row.status),
      xpWeekActual,
      attendanceDaysActual,
      isEligible: matched ? xpWeekActual >= reqXp && attendanceDaysActual >= reqDays : false,
      reward: matched,
    };
  });
}

rewardsRouter.get('/reward-requests', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const scope = await teacherTierScope(db, caller);
  if (scope.studentIds && scope.studentIds.length === 0) {
    res.json([]);
    return;
  }
  const q = req.query;
  const where: string[] = [];
  const params: any[] = [];
  if (scope.studentIds) {
    where.push(`\`student_id\` IN (${scope.studentIds.map(() => '?').join(',')})`);
    params.push(...scope.studentIds);
  }
  if (q.studentId) {
    where.push('`student_id` = ?');
    params.push(q.studentId);
  }
  if (q.status) {
    where.push('`status` = ?');
    params.push(dbStatusOf(String(q.status)));
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  let rows = await query<any>(
    `SELECT * FROM \`reward_requests\` ${whereSql} ORDER BY \`created_at\` DESC`,
    params
  );
  let enriched = await enrichRequests(db, rows);
  if (q.classId && q.classId !== 'all') {
    enriched = enriched.filter((r: any) => r.classId === q.classId);
  }
  res.json(enriched);
});

rewardsRouter.post('/reward-requests', async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const body = bodyOf(req);
  let studentId: string;
  if (isStudent(caller)) {
    studentId = caller.studentId!;
  } else {
    studentId = body.studentId || body.student_id;
    if (!studentId) {
      httpErr(res, 400, 'BAD_INPUT');
      return;
    }
    if (!checkKeyLen(res, studentId) || !rejectSentinel(res, studentId)) return;
    if (isTeacher(caller) && !(await canAccessStudent(db, caller, studentId))) {
      httpErr(res, 403, 'FORBIDDEN');
      return;
    }
  }
  const student = await findStudent(db, studentId);
  if (!student) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  const rewardId = body.rewardId || body.reward_id;
  if (!rewardId || !checkKeyLen(res, rewardId)) {
    if (!rewardId) httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  // Tier khớp theo id hoặc tier_xxx (như createRequest gốc).
  const tiers = await query<any>('SELECT * FROM `reward_tiers`');
  const rewards = tiers.map(rowToReward);
  const reward =
    rewards.find((r: any) => r.id === rewardId) ||
    rewards.find((r: any) => `tier_${String(r.tierKey || '').toLowerCase()}` === rewardId);
  const tierRaw = String(reward?.tierKey || rewardId.replace(/^tier_/, '') || 'hat').toLowerCase();
  const chestType = ['hat', 'la', 'hoa', 'vang'].includes(tierRaw) ? tierRaw : 'hat';
  const requiredXp = reward?.requiredXp || 0;

  let created: any;
  try {
    created = await withTransaction(async (tx: Db) => {
    // Snapshot XP tuần thật + kiểm tra TỔNG XP trước khi trừ (gốc).
    const stRows = await tx.query<any>(
      'SELECT `xp_week`, `total_xp` FROM `student_states` WHERE `student_id` = ? LIMIT 1',
      [studentId]
    );
    const xpWeekSnapshot = stRows[0]?.xp_week ?? 0;
    let totalBalance = stRows[0]?.total_xp;
    if (totalBalance == null) {
      const totals: any = await getTotals(tx, studentId);
      totalBalance = totals?.totalXp ?? 0;
    }
    if (requiredXp > 0 && totalBalance < requiredXp) return 'INSUFFICIENT_XP';
    const id = randomUUID();
    await tx.execute(
      'INSERT INTO `reward_requests` (`id`, `student_id`, `chest_type`, `xp_week_snapshot`, `gift_name`, `status`) VALUES (?, ?, ?, ?, ?, ?)',
      [id, studentId, chestType, xpWeekSnapshot, reward?.name || 'Phần thưởng Mầm Văn', 'PENDING']
    );
    // TRỪ NGAY LÚC TẠO (không đợi duyệt) — hành vi gốc.
    // Chữ ký xp.ts: deductForGift(db, studentId, amount, requestId) —
    // requestId là khóa idempotency (gift:deduct:<requestId>), PHẢI là
    // id yêu cầu, không phải chuỗi mô tả (mô tả trùng nhau sẽ làm
    // lần trừ thứ 2 thành no-op sai).
    let deductedXp = 0;
    if (requiredXp > 0) {
      const ded: any = await deductForGift(tx, studentId, requiredXp, id);
      deductedXp = ded?.deducted ?? requiredXp;
    }
    return { id, deductedXp, xpWeekSnapshot };
    });
  } catch (e: any) {
    // deductForGift throw INSUFFICIENT_XP khi đua số dư (đã kiểm tra
    // trước nhưng vẫn có thể thua race) -> map về 400, không 500.
    if (String(e?.message || e) === 'INSUFFICIENT_XP') {
      httpErr(res, 400, 'INSUFFICIENT_XP');
      return;
    }
    throw e;
  }
  if (created === 'INSUFFICIENT_XP') {
    httpErr(res, 400, 'INSUFFICIENT_XP');
    return;
  }
  const rows = await query<any>('SELECT * FROM `reward_requests` WHERE `id` = ? LIMIT 1', [(created as any).id]);
  const enriched = await enrichRequests(db, rows);
  res.status(201).json({ ...enriched[0], deductedXp: (created as any).deductedXp });
});

/** Đổi trạng thái 1 yêu cầu (trong transaction): REJECTED -> hoàn XP. */
async function applyRequestStatus(
  tx: Db,
  requestId: string,
  status: string
): Promise<'NOT_FOUND' | 'FORBIDDEN' | { prev: string } | null> {
  const rows = await tx.query<any>('SELECT * FROM `reward_requests` WHERE `id` = ? LIMIT 1', [requestId]);
  const row = rows[0];
  if (!row) return 'NOT_FOUND';
  const dbStatus = dbStatusOf(status);
  const prev = row.status;
  await tx.execute(
    'UPDATE `reward_requests` SET `status` = ?, `approved_at` = ? WHERE `id` = ?',
    [dbStatus, dbStatus === 'APPROVED' ? toMySQLDatetime(new Date()) : null, requestId]
  );
  if (dbStatus === 'REJECTED' && prev !== 'REJECTED') {
    // HOÀN 100% — số hoàn = xp_cost hiện tại của tier khớp chest_type
    // (xem hạn chế ở đầu file: chưa có cột deducted_xp).
    const tiers = await tx.query<any>('SELECT * FROM `reward_tiers` WHERE `tier_key` = ?', [String(row.chest_type).toUpperCase()]);
    const cost = tiers[0] ? toNum(tiers[0].xp_cost, 0) : 0;
    if (cost > 0) {
      // Chữ ký xp.ts: refundGift(db, studentId, amount, requestId) —
      // requestId là khóa idempotency (gift:refund:<requestId>).
      await refundGift(tx, row.student_id, cost, requestId);
    }
  }
  return { prev };
}

rewardsRouter.patch('/reward-requests/:id', requireRole('teacher', 'admin'), ah(async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const id = req.params.id;
  if (!checkKeyLen(res, id)) return;
  const body = bodyOf(req);
  const status = body.status;
  if (!['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'GIVEN', 'OPENED', 'PENDING'].includes(status)) {
    httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  // Kiểm tra phạm vi trước (request của học sinh lớp mình).
  const row = await query<any>('SELECT `student_id` FROM `reward_requests` WHERE `id` = ? LIMIT 1', [id]);
  if (!row[0]) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isTeacher(caller) && !(await canAccessStudent(db, caller, row[0].student_id))) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const out = await withTransaction(async (tx: Db) => applyRequestStatus(tx, id, status));
  if (out === 'NOT_FOUND') {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  const rows = await query<any>('SELECT * FROM `reward_requests` WHERE `id` = ? LIMIT 1', [id]);
  const enriched = await enrichRequests(db, rows);
  res.json({ ...enriched[0], rejectReason: body.reason });
}));

rewardsRouter.post('/reward-requests/batch', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const body = bodyOf(req);
  const ids: string[] = Array.isArray(body.ids) ? body.ids : Array.isArray(body.requestIds) ? body.requestIds : [];
  const status = body.status;
  if (!ids.length || !['APPROVED', 'REJECTED', 'GIVEN', 'OPENED'].includes(status)) {
    httpErr(res, 400, 'BAD_INPUT');
    return;
  }
  for (const rid of ids) if (!checkKeyLen(res, rid)) return;
  // Toàn bộ batch phải thuộc phạm vi, không thì 403 cả batch (fail closed).
  const rows = await query<any>(
    `SELECT \`id\`, \`student_id\` FROM \`reward_requests\` WHERE \`id\` IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  if (rows.length !== ids.length) {
    httpErr(res, 404, 'NOT_FOUND');
    return;
  }
  if (isTeacher(caller)) {
    for (const r of rows) {
      if (!(await canAccessStudent(db, caller, r.student_id))) {
        httpErr(res, 403, 'FORBIDDEN');
        return;
      }
    }
  }
  await withTransaction(async (tx: Db) => {
    for (const rid of ids) {
      await applyRequestStatus(tx, rid, status);
    }
  });
  res.json({ ok: true, updated: ids.length, status });
});
