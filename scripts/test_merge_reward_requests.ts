import { mergeRewardRequests } from '../src/logic/mergeRewardRequests.ts';

let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = '') {
  if (ok) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

const local = [
  { id: 'r1', rewardId: 'reward_bookmark', requestedAt: 100, status: 'PENDING_APPROVAL' as const },
  { id: 'r-local-only', rewardId: 'reward_pen', requestedAt: 300, status: 'PENDING_APPROVAL' as const },
];
const server = [
  { id: 'r1', rewardId: 'reward_bookmark', requestedAt: 100, status: 'GIVEN' as const },
  { id: 'r2', rewardId: 'reward_notebook', requestedAt: 200, status: 'APPROVED' as const },
];
const merged = mergeRewardRequests(server as any, local as any);

check('gộp đủ 3 yêu cầu (không trùng id)', merged.length === 3, `got ${merged.length}`);
check('bản máy chủ thắng trạng thái (r1 GIVEN, không còn PENDING)', merged.find((r) => r.id === 'r1')?.status === 'GIVEN');
check('giữ yêu cầu chỉ có ở máy khách', merged.some((r) => r.id === 'r-local-only'));
check('giữ yêu cầu chỉ có ở máy chủ', merged.some((r) => r.id === 'r2'));
check('mới nhất trước', merged[0].id === 'r-local-only' && merged[1].id === 'r2' && merged[2].id === 'r1');
check('không đột biến mảng gốc', local[0].status === 'PENDING_APPROVAL' && server[0].status === 'GIVEN');
check('mảng rỗng 2 phía -> rỗng', mergeRewardRequests([], []).length === 0);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
