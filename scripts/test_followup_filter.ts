// LUẬT TRUNG THỰC DỮ LIỆU (26/10): gợi ý nối tiếp chỉ được nhắc lớp có thật.
// Gợi ý nhắc mã lớp không nằm trong danh sách lớp thật của giáo viên thì bị
// lọc bỏ — ca thật: gợi ý 7A5/7A6 trong khi DB chỉ có 7A4.
import {
  extractClassCodes,
  filterFollowupsByRealClasses,
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

const REAL = ['7A4'];
const SEQ_494 = [
  'Tình hình điểm danh và nộp bài tập của lớp 7A4 thế nào?',
  'Tình hình điểm danh và nộp bài tập của lớp 7A5 thế nào?',
  'Tình hình điểm danh và nộp bài tập của lớp 7A6 thế nào?',
];

console.log('=== 1. extractClassCodes ===');
{
  check(
    'lấy mã 7A4 từ câu có chữ lớp',
    JSON.stringify(extractClassCodes('của lớp 7A4 thế nào?')) === '["7A4"]'
  );
  check(
    'chữ thường 7a4 -> chuẩn hóa 7A4',
    JSON.stringify(extractClassCodes('lớp 7a4')) === '["7A4"]'
  );
  check('câu không có mã lớp -> rỗng', extractClassCodes('Muốn xem chi tiết không?').length === 0);
  check(
    'mã 2 chữ số 10A1',
    JSON.stringify(extractClassCodes('lớp 10A1')) === '["10A1"]'
  );
}

console.log('=== 2. filterFollowupsByRealClasses — ca thật seq 494 ===');
{
  const out = filterFollowupsByRealClasses(SEQ_494, REAL);
  check(
    'chỉ còn đúng gợi ý 7A4, 7A5/7A6 bị bỏ',
    out.length === 1 && out[0].includes('7A4'),
    out
  );
}

console.log('=== 3. Các trường hợp khác ===');
{
  check(
    'gợi ý không nhắc mã lớp thì giữ nguyên',
    filterFollowupsByRealClasses(
      ['Thầy/cô muốn biết nguyên nhân học sinh chưa có điểm không?'],
      REAL
    ).length === 1
  );
  check(
    'gợi ý nhắc 2 lớp, 1 bịa -> bỏ cả câu',
    filterFollowupsByRealClasses(['So sánh lớp 7A4 và 7A5 đi'], REAL).length === 0
  );
  check(
    'giáo viên có 2 lớp thật thì giữ cả 2',
    filterFollowupsByRealClasses(SEQ_494, ['7A4', '7A5']).length === 2
  );
  check(
    'giáo viên chưa có lớp nào -> gợi ý nhắc mã lớp đều bị bỏ',
    filterFollowupsByRealClasses(SEQ_494, []).length === 0
  );
  check('danh sách rỗng -> rỗng', filterFollowupsByRealClasses([], REAL).length === 0);
  check(
    'tên lớp có tiền tố vẫn trích được mã (vd "Lớp 7A4")',
    filterFollowupsByRealClasses(['Tình hình lớp 7A4 thế nào?'], ['Lớp 7A4']).length === 1
  );
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
