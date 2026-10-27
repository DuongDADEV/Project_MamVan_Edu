/**
 * Router nhóm B — lịch sử chat trợ lý AI. Mount tại /api.
 * - GET /chat/history (teacher: teacher_id mình; admin: ?teacher_id=;
 *   student: 403)
 * - POST /chat/messages (upsert batch theo (teacher_id, client_id) —
 *   teacher_id ÉP từ JWT; trùng là no-op)
 * - DELETE /chat/history (chỉ xóa của mình)
 * - POST /chat/prune (giữ tối đa CHAT_HISTORY_MAX tin mới nhất)
 *
 * CHAT_HISTORY_MAX = 80 — hằng số thật trong
 * src/components/teacher/analytics/assistantChatSync.ts (khớp
 * MAX_STORED trong store). Thứ tự prune: cũ nhất theo created_at
 * rồi seq (như pruneAssistantChatHistory gốc).
 * Tin chat tạo mới LUÔN có text (kể cả rỗng) — DB đã bỏ default ''.
 * Upsert dùng INSERT ... ON DUPLICATE KEY UPDATE dạng no-op
 * (client_id = client_id) sau khi DDL đã xác nhận UNIQUE
 * (teacher_id, client_id) — đúng ngữ nghĩa "trùng là no-op" của
 * upsertAssistantChatMessages gốc (2 trình duyệt append đồng thời
 * không ghi đè nhau).
 */
import { Router } from 'express';
import { query, execute, parseJson } from '../_lib/mysql';
import { requireAuth, requireRole, httpErr } from '../_lib/auth';
import type { AuthedRequest } from '../_lib/auth';
import { bodyOf, checkKeyLen, isAdmin, isTeacher } from './_shared';

export const chatRouter = Router();
chatRouter.use(requireAuth);

/** Số tin tối đa giữ lại — assistantChatSync.CHAT_HISTORY_MAX. */
export const CHAT_HISTORY_MAX = 80;

function resolveTeacherId(caller: any, queryTeacherId?: string): string | null {
  if (isAdmin(caller)) return typeof queryTeacherId === 'string' && queryTeacherId ? queryTeacherId : null;
  if (isTeacher(caller)) return caller.teacherId || null;
  return null;
}

function mapChatRow(row: any): any {
  return {
    id: row.id,
    clientId: row.client_id,
    role: row.role,
    text: typeof row.text === 'string' ? row.text : '',
    toolRuns: parseJson(row.tool_runs, []),
    chart: parseJson(row.chart, null),
    followups: parseJson(row.followups, []),
    isError: !!row.is_error,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
    seq: row.seq,
  };
}

chatRouter.get('/chat/history', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const teacherId = resolveTeacherId(req.caller!, req.query.teacher_id as string);
  if (!teacherId) {
    // Admin không gửi teacher_id -> không có phạm vi, trả rỗng (không
    // lộ lịch sử của giáo viên khác).
    res.json([]);
    return;
  }
  if (!checkKeyLen(res, teacherId)) return;
  const rows = await query<any>(
    'SELECT * FROM `assistant_chat_messages` WHERE `teacher_id` = ? ORDER BY `created_at` ASC, `seq` ASC',
    [teacherId]
  );
  res.json(rows.map(mapChatRow));
});

chatRouter.post('/chat/messages', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  // Giáo viên: ép teacher_id từ JWT, bỏ qua giá trị client gửi.
  const teacherId = isTeacher(caller)
    ? caller.teacherId
    : typeof bodyOf(req).teacher_id === 'string'
      ? bodyOf(req).teacher_id
      : typeof bodyOf(req).teacherId === 'string'
        ? bodyOf(req).teacherId
        : null;
  if (!teacherId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  if (!checkKeyLen(res, teacherId)) return;
  const body = bodyOf(req);
  const msgs = Array.isArray(body) ? body : Array.isArray(body.messages) ? body.messages : [];
  const rows = msgs.filter((m: any) => m && typeof m.clientId === 'string' && m.clientId);
  for (const m of rows) {
    if (!checkKeyLen(res, m.clientId)) return;
    if (m.role !== 'user' && m.role !== 'assistant') {
      httpErr(res, 400, 'BAD_INPUT');
      return;
    }
  }
  for (const m of rows) {
    // text LUÔN gửi, kể cả rỗng (DB không còn default ''). created_at
    // thiếu thì dùng UTC_TIMESTAMP(6) (cột NOT NULL, không insert NULL).
    await execute(
      'INSERT INTO `assistant_chat_messages` (`teacher_id`, `client_id`, `role`, `text`, `tool_runs`, `chart`, `followups`, `is_error`, `created_at`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, UTC_TIMESTAMP(6))) ON DUPLICATE KEY UPDATE `client_id` = `client_id`',
      [
        teacherId,
        m.clientId,
        m.role,
        typeof m.text === 'string' ? m.text : '',
        JSON.stringify(m.toolRuns ?? []),
        m.chart != null ? JSON.stringify(m.chart) : null,
        JSON.stringify(m.followups ?? []),
        m.isError ? 1 : 0,
        m.createdAt ? new Date(m.createdAt).toISOString() : null,
      ]
    );
  }
  res.json({ ok: true, upserted: rows.length });
});

chatRouter.delete('/chat/history', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const teacherId = isTeacher(caller)
    ? caller.teacherId
    : typeof req.query.teacher_id === 'string'
      ? req.query.teacher_id
      : null;
  if (!teacherId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  await execute('DELETE FROM `assistant_chat_messages` WHERE `teacher_id` = ?', [teacherId]);
  res.json({ ok: true });
});

chatRouter.post('/chat/prune', requireRole('teacher', 'admin'), async (req: AuthedRequest, res) => {
  const caller = req.caller!;
  const teacherId = isTeacher(caller)
    ? caller.teacherId
    : typeof bodyOf(req).teacher_id === 'string'
      ? bodyOf(req).teacher_id
      : typeof bodyOf(req).teacherId === 'string'
        ? bodyOf(req).teacherId
        : null;
  if (!teacherId) {
    httpErr(res, 403, 'FORBIDDEN');
    return;
  }
  const body = bodyOf(req);
  const keep = Math.min(
    CHAT_HISTORY_MAX,
    Math.max(0, Math.floor(Number(body.keep ?? CHAT_HISTORY_MAX) || CHAT_HISTORY_MAX))
  );
  // Tin mới nhất theo created_at rồi seq; phần thừa (cũ nhất) bị xóa.
  const rows = await query<any>(
    'SELECT `id` FROM `assistant_chat_messages` WHERE `teacher_id` = ? ORDER BY `created_at` DESC, `seq` DESC',
    [teacherId]
  );
  const excess = rows.slice(keep);
  if (excess.length) {
    await execute(
      `DELETE FROM \`assistant_chat_messages\` WHERE \`id\` IN (${excess.map(() => '?').join(',')})`,
      excess.map((r: any) => r.id)
    );
  }
  res.json({ ok: true, kept: rows.length - excess.length, pruned: excess.length });
});
