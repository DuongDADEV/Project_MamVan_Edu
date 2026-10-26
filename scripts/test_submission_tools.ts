// ĐỢT 7 (26/10): function cho dữ liệu trước đây không tool nào tới được —
// bảng attempts (thời gian nộp + attempt_no), phiếu đã chấm, chi tiết bài
// tập đã giao, mốc quà; tool hồ sơ nay trả cả thời gian làm bài.
import {
  fmtTime,
  matchStudentsByName,
  groupAttemptsBySource,
  selectToolsForQuery,
} from '../src/services/ai/analyticsAssistant.ts';

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

console.log('=== 1. fmtTime (giờ Việt Nam, tính trong code) ===');
{
  check('ISO UTC -> 21:32 25/10/2026', fmtTime('2026-10-25T14:32:00.000Z') === '21:32 25/10/2026', fmtTime('2026-10-25T14:32:00.000Z'));
  check('ms epoch -> cùng giờ', fmtTime(Date.UTC(2026, 9, 25, 14, 32)) === '21:32 25/10/2026');
  check('null -> null', fmtTime(null) === null);
  check('chuỗi rác -> null', fmtTime('khong-phai-ngay') === null);
}

console.log('=== 2. matchStudentsByName (bỏ dấu, chứa chuỗi) ===');
{
  const students = [
    { name: 'Lê Khánh Chi' },
    { name: 'Nguyễn Minh An' },
    { name: 'Lê Khánh Linh' },
  ] as any;
  const one = matchStudentsByName(students, 'Khánh Chi');
  check('khớp 1 em bỏ dấu', one.length === 1 && one[0].name === 'Lê Khánh Chi', one);
  const two = matchStudentsByName(students, 'Khánh');
  check('trùng tên -> 2 ứng viên', two.length === 2, two);
  check('không khớp -> rỗng', matchStudentsByName(students, 'Trần Văn X').length === 0);
  check('tên rỗng -> rỗng', matchStudentsByName(students, '').length === 0);
}

console.log('=== 3. groupAttemptsBySource (số lần làm lại tính trong code) ===');
{
  const atts = [
    { sourceType: 'assignment', sourceTitle: 'Bài tập 1', attemptNo: 2, submittedAt: '2026-10-24T10:00:00.000Z', score: 8, maxScore: 10, status: 'done' },
    { sourceType: 'assignment', sourceTitle: 'Bài tập 1', attemptNo: 1, submittedAt: '2026-10-23T09:00:00.000Z', score: 5, maxScore: 10, status: 'done' },
    { sourceType: 'activity', sourceTitle: 'Hoạt động A', attemptNo: 1, submittedAt: '2026-10-22T08:00:00.000Z', score: null, maxScore: null, status: null },
  ];
  const groups = groupAttemptsBySource(atts);
  check('gộp thành 2 bài', groups.length === 2, groups);
  const b1 = groups.find((g) => g.bai === 'Bài tập 1')!;
  check('Bài tập 1: 2 lần nộp, 1 lần làm lại', b1.soLanNop === 2 && b1.soLanLamLai === 1, b1);
  check('thời gian đổi sang giờ VN', b1.cacLan[0].thoiGianNop === '17:00 24/10/2026', b1.cacLan);
  check('điểm dạng x/y', b1.cacLan[0].diem === '8/10', b1.cacLan);
  const b2 = groups.find((g) => g.bai === 'Hoạt động A')!;
  check('1 lần nộp -> 0 lần làm lại', b2.soLanNop === 1 && b2.soLanLamLai === 0, b2);
  check('điểm null khi chưa có', b2.cacLan[0].diem === null, b2.cacLan);
}

console.log('=== 4. Router: câu hỏi kiểu ảnh chụp phải chọn đúng tool ===');
{
  const names = (q: string) => (selectToolsForQuery(q) || []).map((d: any) => d.name);
  check(
    'thời gian nộp + số lần làm lại -> get_submission_history',
    names('Muốn biết thời gian nộp và số lần làm lại của Lê Khánh Chi không?').includes('get_submission_history'),
    names('Muốn biết thời gian nộp và số lần làm lại của Lê Khánh Chi không?')
  );
  check('xem bài đã chấm -> list_graded_reviews', names('xem bài đã chấm').includes('list_graded_reviews'));
  check('chi tiết bài tập -> get_assignment_detail', names('chi tiết bài tập kiểm tra 15 phút').includes('get_assignment_detail'));
  check('mốc quà -> list_reward_tiers', names('mốc quà hiện tại').includes('list_reward_tiers'));
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
