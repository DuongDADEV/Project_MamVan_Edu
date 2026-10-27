// Đồng bộ lịch sử chat trợ lý lên DB — đợt 4 (26/10, user hỏi
// "tin nhắn giữa giáo viên với AI vẫn chưa đồng bộ, nó có lưu
// vào database không"): trước đây lịch sử chỉ ở localStorage nên
// đổi trình duyệt là mất. Từ đợt này server là nguồn thật duy
// nhất khi đọc thành công; local chỉ là fallback khi lỗi.
// Test logic thuần (merge/cap/normalize/row-mapping) + source
// guard cho store/repository/migration.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHAT_HISTORY_MAX,
  capChatHistory,
  fromServerRow,
  mergeChatHistories,
  normalizeChatHistory,
  stampLegacyBeforeServer,
  toServerInsert,
} from '../src/components/teacher/analytics/assistantChatSync.ts';
import type { ChatMsg } from '../src/components/teacher/analytics/assistantChatStore.ts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) {
    pass++;
    console.log(`  PASS: ${name}`);
  } else {
    fail++;
    console.log(`  FAIL: ${name}`, extra ?? '');
  }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');
const storeSrc = read('src/components/teacher/analytics/assistantChatStore.ts');
const chatClientSrc = read('src/services/api/chatClient.ts');
const chatRouteSrc = read('api/routes/chat.ts');
const syncSrc = read('src/components/teacher/analytics/assistantChatSync.ts');
const tabSrc = read('src/components/teacher/analytics/AnalyticsAssistantTab.tsx');
const migSrc = read('database/migration_018_assistant_chat_history.sql');

const msg = (
  id: number,
  clientId: string | undefined,
  text: string,
  role: 'user' | 'assistant' = 'user'
): ChatMsg => ({ id, clientId, role, text });

console.log('=== 1. normalize: gán id legacy xác định ===');
const legacy = [msg(1, undefined, 'hi'), msg(2, undefined, 'hi')];
const n1 = normalizeChatHistory(legacy);
const n2 = normalizeChatHistory(legacy);
check('Tin chưa có clientId được gán legacy id', !!n1[0].clientId?.startsWith('legacy-'));
check('Cùng input cho cùng id (xác định)', n1[0].clientId === n2[0].clientId);
check('Cùng text khác vị trí cho id khác nhau', n1[0].clientId !== n1[1].clientId);
check('Tin đã có clientId giữ nguyên', normalizeChatHistory([msg(1, 'u1', 'x')])[0].clientId === 'u1');

console.log('=== 2. merge: server thắng, local-only nối thêm, không trùng ===');
const server = [msg(1, 'a', 'server1'), msg(2, 'b', 'server2')];
const local = [
  msg(1, 'b', 'LOCAL-GHI-ĐÈ?'),
  msg(2, 'c', 'local-only'),
  msg(3, undefined, 'legacy-local'),
];
const merged = mergeChatHistories(server, local);
check('Thứ tự server giữ nguyên đầu danh sách', merged[0].text === 'server1' && merged[1].text === 'server2');
check('Trùng clientId không trùng lặp, bản server thắng', merged.filter((m) => m.clientId === 'b').length === 1 && merged.find((m) => m.clientId === 'b')?.text === 'server2');
check('Tin chỉ-có-ở-local được nối thêm', merged.some((m) => m.clientId === 'c' && m.text === 'local-only'));
check('Tin legacy local được gán id rồi nối thêm', merged.some((m) => (m.clientId ?? '').startsWith('legacy-')));
check('Merge server rỗng + local = local đã chuẩn hóa', mergeChatHistories([], local).length === 3);

console.log('=== 3. cap 80 ===');
check('CHAT_HISTORY_MAX = 80', CHAT_HISTORY_MAX === 80);
const many = Array.from({ length: 90 }, (_, i) => msg(i + 1, `c${i + 1}`, `t${i + 1}`));
const capped = capChatHistory(many);
check('90 tin cắt còn 80', capped.length === 80);
check('Giữ 80 tin mới nhất (bỏ 10 đầu)', capped[0].text === 't11' && capped[79].text === 't90');
const mergedBig = mergeChatHistories(
  Array.from({ length: 70 }, (_, i) => msg(i + 1, `s${i + 1}`, `s${i + 1}`)),
  Array.from({ length: 20 }, (_, i) => msg(i + 1, `l${i + 1}`, `l${i + 1}`))
);
check('Merge 70 + 20 cắt còn 80', mergedBig.length === 80);

console.log('=== 4. map hàng DB 2 chiều ===');
const row = toServerInsert(
  { id: 5, clientId: 'u9', role: 'assistant', text: 'xin chào', toolRuns: [], followups: ['tiếp?'], isError: false, createdAt: 1793000000000 },
  'teacher-uuid-1'
);
check('Insert mang đủ teacher_id + client_id + role + text', row.teacher_id === 'teacher-uuid-1' && row.client_id === 'u9' && row.role === 'assistant' && row.text === 'xin chào');
check('createdAt đổi sang ISO', row.created_at === new Date(1793000000000).toISOString());
check('chart vắng thì null, không undefined', row.chart === null);
const back = fromServerRow({
  client_id: 'u9',
  role: 'assistant',
  text: 'xin chào',
  tool_runs: [{ tool: 'x' }],
  chart: null,
  followups: ['tiếp?'],
  is_error: true,
  created_at: new Date(1793000000000).toISOString(),
});
check('Đọc hàng DB về đủ trường + isError', back.clientId === 'u9' && back.isError === true && back.createdAt === 1793000000000 && (back.followups ?? []).length === 1);
check('Role lạ rơi về user (không vỡ)', fromServerRow({ client_id: 'z', role: 'weird', text: 't' }).role === 'user');

console.log('=== 5. Store: server-thắng + outbox + clear xóa server ===');
check('Store có initAssistantChatSync', storeSrc.includes('export function initAssistantChatSync'));
check('Store có outbox key riêng', storeSrc.includes('mam_van_assistant_chat_outbox_v1'));
check('Store có marker đồng bộ lần đầu theo giáo viên', storeSrc.includes('mam_van_assistant_chat_synced_v1:'));
check('Store ghi nhớ giáo viên của cache để đổi GV không gộp nhầm', storeSrc.includes('mam_van_assistant_chat_teacher_v1'));
check('Append ghi server ngay, lỗi xếp outbox', storeSrc.includes('upsertAssistantChatMessages(tid, [full])') && storeSrc.includes('saveOutbox([...rest, { teacherId: tid, msg: full }]'));
check('Clear xóa cả server', storeSrc.includes('deleteAssistantChatHistory(tid)'));
check('Clear vẫn giữ 2 chạm (không gọi window.confirm)', !storeSrc.includes('window.confirm('));
check('Đồng bộ lỗi giữ local + cho mount sau thử lại', storeSrc.includes('syncTeacherId = null'));
check('Hành vi cũ giữ nguyên: cap 80 + dùng chung store', storeSrc.includes('MAX_STORED = 80') && storeSrc.includes('useSyncExternalStore'));

console.log('=== 6. Chat API (GĐ3): upsert chống trùng + prune + phạm vi JWT ===');
// GĐ3: assistantChatRepository (Supabase) đã xóa; upsert/prune nằm ở
// route server api/routes/chat.ts, client gọi qua chatClient.ts.
check('Upsert theo cặp (teacher_id, client_id) ở server (ON DUPLICATE KEY UPDATE no-op)', chatRouteSrc.includes('ON DUPLICATE KEY UPDATE') && chatRouteSrc.includes('`teacher_id`, `client_id`'));
check('Đọc xếp theo created_at rồi seq', chatRouteSrc.includes('ORDER BY `created_at` ASC, `seq` ASC'));
check('Có hàm prune giữ 80 mới nhất (client + server CHAT_HISTORY_MAX)', chatClientSrc.includes('pruneAssistantChatHistory') && chatRouteSrc.includes('CHAT_HISTORY_MAX'));
check('Mọi query gắn teacher_id từ JWT (không tin client gửi)', (chatRouteSrc.match(/teacher_id/g) ?? []).length >= 5 && chatRouteSrc.includes('ép teacher_id từ JWT'));
check('Lỗi API ném ra để store fallback (apiFetch ném ApiError, không nuốt)', chatClientSrc.includes("await apiFetch('/api/chat/messages'") && chatClientSrc.includes("await apiFetch('/api/chat/history'"));

console.log('=== 7. Migration 018: bảng + RLS theo mẫu 015 ===');
check('Bảng assistant_chat_messages + UNIQUE (teacher_id, client_id)', migSrc.includes('CREATE TABLE IF NOT EXISTS public.assistant_chat_messages') && migSrc.includes('UNIQUE (teacher_id, client_id)'));
check('teacher_id uuid nối teachers + cascade', migSrc.includes('teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE'));
check('RLS bật', migSrc.includes('ENABLE ROW LEVEL SECURITY'));
check('Policy teacher_own theo my_teacher_id()', migSrc.includes('teacher_own_assistant_chat') && migSrc.includes('teacher_id = public.my_teacher_id()'));
check('Policy admin_all theo is_admin()', migSrc.includes('CREATE POLICY "admin_all"') && migSrc.includes('public.is_admin()'));
check('Đủ cột role/text/tool_runs/chart/followups/is_error/created_at/seq', ['role text', 'tool_runs jsonb', 'chart jsonb', 'followups jsonb', 'is_error boolean', 'created_at timestamptz', 'seq bigint GENERATED ALWAYS AS IDENTITY'].every((s) => migSrc.includes(s)));

console.log('=== 8. Tab móc init (tab + bong bóng cùng component) ===');
check('Tab import initAssistantChatSync', tabSrc.includes('initAssistantChatSync'));
check('Tab gọi init theo teacherId', tabSrc.includes('initAssistantChatSync(teacherId)'));
check('Nút xóa 2 chạm còn nguyên (confirmClear)', tabSrc.includes('confirmClear'));

console.log('=== 9. Đợt 4b: first-sync không bao giờ cắt dòng server ===');
// Tái hiện đúng vụ 26/10: server 2 dòng + trình duyệt first-sync với
// 115 dòng legacy (không createdAt) → tổng 117, vượt cap 80.
const srv2 = [msg(1, 'srv-1', 'srv1'), msg(2, 'srv-2', 'srv2')];
const legacy115 = Array.from({ length: 115 }, (_, i) => msg(i + 1, undefined, `legacy-${i + 1}`));
const merged4b = mergeChatHistories(srv2, legacy115);
check('First-sync 2 + 115 vẫn cap 80', merged4b.length === 80);
check('2 dòng server còn nguyên ở đầu danh sách', merged4b[0].clientId === 'srv-1' && merged4b[1].clientId === 'srv-2');
check('Phần bị cắt là legacy cũ nhất (1–37), giữ legacy mới nhất', !merged4b.some((m) => m.text === 'legacy-1' || m.text === 'legacy-37') && merged4b[2].text === 'legacy-38' && merged4b[79].text === 'legacy-115');
// Siết thêm case cũ 70 + 20: trước đợt 4b cap cắt 10 dòng server đầu.
const merged70 = mergeChatHistories(
  Array.from({ length: 70 }, (_, i) => msg(i + 1, `s${i + 1}`, `s${i + 1}`)),
  Array.from({ length: 20 }, (_, i) => msg(i + 1, `l${i + 1}`, `l${i + 1}`))
);
check('Merge 70 + 20 giữ đủ 70 dòng server + 10 local mới nhất', merged70.length === 80 && merged70.filter((m) => (m.clientId ?? '').startsWith('s')).length === 70 && merged70[79].text === 'l20');
// Server một mình đã ≥ cap: tin local mới vẫn hiện, chỉ cắt dòng
// server cũ nhất khỏi DANH SÁCH (DB không đụng — prune lo riêng).
const mergedEdge = mergeChatHistories(
  Array.from({ length: 90 }, (_, i) => msg(i + 1, `s${i + 1}`, `s${i + 1}`)),
  [msg(1, 'n1', 'new1'), msg(2, 'n2', 'new2'), msg(3, 'n3', 'new3')]
);
check('Server 90 + local 3 vẫn cap 80, tin local không bị cắt', mergedEdge.length === 80 && ['n1', 'n2', 'n3'].every((c) => mergedEdge.some((m) => m.clientId === c)));
check('Dòng server giữ lại là mới nhất (s14–s90)', mergedEdge[0].clientId === 's14' && mergedEdge[76].clientId === 's90');
// stampLegacyBeforeServer: legacy xếp trước dòng server sớm nhất.
const toStamp = [
  { ...msg(1, 'a', 'co-ts'), createdAt: 1000 },
  msg(2, undefined, 'legacy-A'),
  msg(3, undefined, 'legacy-B'),
  { ...msg(4, 'd', 'co-ts-2'), createdAt: 2000 },
];
const stamped = stampLegacyBeforeServer(toStamp, 5000);
check('Tin đã có createdAt giữ nguyên', stamped[0].createdAt === 1000 && stamped[3].createdAt === 2000);
check('Tin legacy xếp trước dòng server sớm nhất, giữ thứ tự, lệch 1ms', (stamped[1].createdAt ?? 0) < 5000 && (stamped[2].createdAt ?? 0) < 5000 && (stamped[1].createdAt ?? 0) < (stamped[2].createdAt ?? 0) && (stamped[2].createdAt ?? 0) - (stamped[1].createdAt ?? 0) === 1);
const stampedNoServer = stampLegacyBeforeServer([msg(1, undefined, 'x'), msg(2, undefined, 'y')]);
check('Không có dòng server thì mốc là giờ hiện tại, thứ tự giữ', (stampedNoServer[0].createdAt ?? 0) <= Date.now() && (stampedNoServer[0].createdAt ?? 0) < (stampedNoServer[1].createdAt ?? 0));
check('Store first-sync stamp legacy trước upsert', storeSrc.includes('stampLegacyBeforeServer(') && storeSrc.includes('earliestServerAt'));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
