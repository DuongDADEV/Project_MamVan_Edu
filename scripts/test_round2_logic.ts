/**
 * Test vòng QA 2 (2026-10-18): logic XP/ngày/tuần + máy trạng thái yêu cầu quà.
 * Chạy: TZ=Asia/Ho_Chi_Minh npx tsx scripts/test_round2_logic.ts
 * Tiền điều kiện: các state đưa vào awardXP đã qua rolloverStudentState khi nạp
 * (đúng như App làm) — awardXP tự lật mốc phòng thủ thêm một lớp.
 */
import {
  getLocalTodayStr,
  getWeekKey,
  rolloverStudentState,
  countLearningSteps,
} from '../src/logic/studentStateUtils.ts';
import { awardXP } from '../src/logic/xpEngine.ts';
import { createFreshStudentState } from '../src/services/mock/seedData.ts';
import {
  MockAttemptRepository,
  MockRewardRepository,
} from '../src/services/mock/mockRepositories.ts';
import type { StudentState } from '../src/types.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${name}${extra ? ' — ' + extra : ''}`);
  }
}

const account: any = {
  id: 'hs_test',
  name: 'Học Sinh Test',
  username: 'hstest',
  class_id: 'class_7a2',
  status: 'active',
  has_logged_in: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const fresh = (): StudentState => createFreshStudentState(account);

async function main() {
  console.log('=== 1. Ngày địa phương (chống lỗi UTC) ===');
  // 00:30 sáng 18/10 giờ VN = 17:30 UTC ngày 17/10
  const earlyMorning = new Date('2026-10-17T17:30:00.000Z');
  check(
    'getLocalTodayStr dùng giờ địa phương (không phải UTC)',
    getLocalTodayStr(earlyMorning) === '2026-10-18',
    `got ${getLocalTodayStr(earlyMorning)}, ISO=${earlyMorning.toISOString().slice(0, 10)}`
  );
  check(
    'getWeekKey: Chủ nhật 18/10/2026 thuộc tuần bắt đầu thứ Hai 12/10',
    getWeekKey(new Date(2026, 9, 18)) === '2026-10-12',
    getWeekKey(new Date(2026, 9, 18))
  );
  check(
    'getWeekKey: thứ Hai trả chính nó',
    getWeekKey(new Date(2026, 9, 12)) === '2026-10-12'
  );

  console.log('=== 2. Rollover ngày/tuần ===');
  const today = getLocalTodayStr();
  const weekKey = getWeekKey();

  const sameDay = fresh();
  sameDay.xpToday = 40;
  sameDay.xpWeek = 200;
  sameDay.lastXpResetDate = today;
  sameDay.xpWeekKey = weekKey;
  const rSame = rolloverStudentState(sameDay);
  check('Cùng ngày: giữ nguyên xpToday/xpWeek', rSame.xpToday === 40 && rSame.xpWeek === 200);

  const staleDay = fresh();
  staleDay.xpToday = 150;
  staleDay.activeSecondsToday = 9999;
  staleDay.xpWeek = 300;
  staleDay.lastXpResetDate = '2020-01-01';
  staleDay.xpWeekKey = weekKey;
  const rDay = rolloverStudentState(staleDay);
  check(
    'Qua ngày: xpToday + thời gian học về 0, xpWeek giữ nguyên',
    rDay.xpToday === 0 && rDay.activeSecondsToday === 0 && rDay.xpWeek === 300
  );
  check('Qua ngày: mốc được cập nhật', rDay.lastXpResetDate === today);

  const staleWeek = fresh();
  staleWeek.xpWeek = 900;
  staleWeek.attendanceDaysThisWeek = 5;
  staleWeek.exemptDaysUsedThisWeek = 2;
  staleWeek.lastXpResetDate = today;
  staleWeek.xpWeekKey = '2020-01-06';
  const rWeek = rolloverStudentState(staleWeek);
  check(
    'Qua tuần: xpWeek + ngày điểm danh tuần + ngày miễn về 0',
    rWeek.xpWeek === 0 && rWeek.attendanceDaysThisWeek === 0 && rWeek.exemptDaysUsedThisWeek === 0
  );

  const legacy = fresh();
  delete (legacy as any).lastXpResetDate;
  delete (legacy as any).xpWeekKey;
  legacy.lastAttendanceDate = today;
  legacy.xpToday = 25;
  legacy.xpWeek = 120;
  legacy.attendanceDaysThisWeek = 3;
  const rLegacy = rolloverStudentState(legacy);
  check(
    'State cũ (chưa có mốc, điểm danh hôm nay): KHÔNG xóa bộ đếm của hôm nay',
    rLegacy.xpToday === 25 && rLegacy.xpWeek === 120 && rLegacy.attendanceDaysThisWeek === 3
  );

  console.log('=== 3. countLearningSteps ===');
  check(
    'Không đếm khóa điểm danh là bước học',
    countLearningSteps(['video_watch:v1', 'attendance:2026-10-18', 'quiz_completed:q1', 'attendance:2026-10-17']) === 2
  );

  console.log('=== 4. awardXP ===');
  const s1 = fresh();
  s1.lastXpResetDate = today;
  s1.xpWeekKey = weekKey;
  const a1 = awardXP(s1, 'quiz_completed:q1', 15, 'Quiz 1');
  check('Lần đầu: cộng đủ 15 XP', a1.actualXp === 15 && a1.updatedState.xpToday === 15);
  check('Lần đầu: ghi bước đã hoàn thành', a1.updatedState.completedSteps.includes('quiz_completed:q1'));

  const s1After: StudentState = { ...s1, ...a1.updatedState };
  const a2 = awardXP(s1After, 'quiz_completed:q1', 15, 'Quiz 1');
  check('Làm lại cùng một mục: 0 XP (chống farm)', a2.actualXp === 0 && a2.isFirstTime === false);

  // Trần theo phút học: >= 90 phút -> không cộng NHƯNG không được "đốt" bước
  const sBusy = fresh();
  sBusy.lastXpResetDate = today;
  sBusy.xpWeekKey = weekKey;
  sBusy.activeSecondsToday = 95 * 60;
  const aBusy = awardXP(sBusy, 'video_watch:v9', 10, 'Video 9');
  check('Học >= 90 phút: actualXp = 0', aBusy.actualXp === 0);
  check(
    'Học >= 90 phút: tiến độ VẪN ghi vào completedSteps (Cây/Năng lực tính bình thường)',
    aBusy.updatedState.completedSteps.includes('video_watch:v9')
  );
  check(
    'Học >= 90 phút: bước CHƯA vào xpAwardedSteps (chưa được trả)',
    !aBusy.updatedState.xpAwardedSteps.includes('video_watch:v9')
  );

  // Hôm sau làm lại bước đó (phút học đã lật về 0): được trả XP đúng 1 lần
  const sNextDay: StudentState = {
    ...sBusy,
    ...aBusy.updatedState,
    activeSecondsToday: 0,
  };
  const aNext = awardXP(sNextDay, 'video_watch:v9', 10, 'Video 9');
  check('Hôm sau làm lại bước chạm trần: được trả 10 XP', aNext.actualXp === 10);
  const sNextAfter: StudentState = { ...sNextDay, ...aNext.updatedState };
  const aThird = awardXP(sNextAfter, 'video_watch:v9', 10, 'Video 9');
  check('Làm thêm lần nữa: 0 XP (đã trả rồi)', aThird.actualXp === 0);

  // X1: state từ hôm qua chưa lật — vẫn phải cộng được XP hôm nay
  const sStale = fresh();
  sStale.lastXpResetDate = '2020-01-01';
  sStale.xpWeekKey = '2020-01-06';
  sStale.xpToday = 150; // đầy trần của "hôm qua"
  sStale.xpWeek = 900; // đầy trần của "tuần trước"
  sStale.activeSecondsToday = 95 * 60; // số phút của hôm qua — không được chặn hôm nay
  const aStale = awardXP(sStale, 'quiz_completed:q_new', 20, 'Quiz mới');
  check(
    'State cũ từ hôm qua: vẫn cộng XP bình thường (không khóa vĩnh viễn)',
    aStale.actualXp === 20,
    `actualXp=${aStale.actualXp}`
  );
  check(
    'State cũ: bộ đếm hôm nay bắt đầu lại từ 0 + XP mới',
    aStale.updatedState.xpToday === 20 && aStale.updatedState.xpWeek === 20
  );

  // Trần ngày: gần đầy trần thì chỉ cộng phần còn lại
  const sCap = fresh();
  sCap.lastXpResetDate = today;
  sCap.xpWeekKey = weekKey;
  sCap.xpToday = 125; // trần <45 phút là 130
  sCap.activeSecondsToday = 10 * 60;
  const aCap = awardXP(sCap, 'theory_understood:t1', 10, 'Lý thuyết');
  check('Sát trần ngày: chỉ cộng phần còn lại (5/10)', aCap.actualXp === 5, `actualXp=${aCap.actualXp}`);
  check('Sát trần: vẫn ghi bước (XP đã được cộng một phần)', aCap.updatedState.completedSteps.includes('theory_understood:t1'));

  console.log('=== 5. Máy trạng thái yêu cầu quà (mock repo) ===');
  const attemptRepo = new MockAttemptRepository();
  const rewardRepo = new MockRewardRepository();
  const st = fresh();
  st.rewardRequests = [
    {
      id: 'req_test_1',
      studentId: 'hs_test',
      rewardId: 'reward_bookmark',
      status: 'PENDING_APPROVAL',
      requestedAt: Date.now(),
      xpWeekSnapshot: 300,
      attendanceDaysSnapshot: 4,
      isEligible: true,
    } as any,
  ];
  await attemptRepo.saveStudentState('hs_test', st);

  let threw = false;
  try {
    await rewardRepo.updateRequestStatus('req_test_1', 'GIVEN');
  } catch {
    threw = true;
  }
  check('PENDING_APPROVAL -> GIVEN (bỏ qua duyệt): bị chặn', threw);

  const approved = await rewardRepo.updateRequestStatus('req_test_1', 'APPROVED');
  check('PENDING_APPROVAL -> APPROVED: hợp lệ', approved.status === 'APPROVED');

  threw = false;
  try {
    await rewardRepo.updateRequestStatus('req_test_1', 'OPENED');
  } catch {
    threw = true;
  }
  check('APPROVED -> OPENED (chưa trao): bị chặn', threw);

  const given = await rewardRepo.updateRequestStatus('req_test_1', 'GIVEN');
  check('APPROVED -> GIVEN: hợp lệ', given.status === 'GIVEN');
  const opened = await rewardRepo.updateRequestStatus('req_test_1', 'OPENED');
  check('GIVEN -> OPENED: hợp lệ', opened.status === 'OPENED');

  threw = false;
  try {
    await rewardRepo.updateRequestStatus('req_test_1', 'APPROVED');
  } catch {
    threw = true;
  }
  check('OPENED -> APPROVED (hồi sinh): bị chặn', threw);

  console.log(`\nKẾT QUẢ: ${passed} đạt, ${failed} lỗi`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test crash:', err);
  process.exit(1);
});
