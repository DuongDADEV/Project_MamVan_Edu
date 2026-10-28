/**
 * Kiểm chứng passageLeaksAnswer (src/logic/fillBlank.ts): đoạn trích có lộ
 * đáp án điền từ không — quyết định ẩn đoạn trích ở đề giao học sinh.
 * Chạy: npx tsx scripts/test_fill_passage.ts
 */
import { passageLeaksAnswer } from '../src/logic/fillBlank.ts';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  PASS ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}`);
  }
}

const passage =
  'Từ láy là từ được tạo thành bằng cách láy lại một phần hoặc toàn bộ tiếng gốc. Ví dụ: lấp lánh, xanh xanh, ào ào. Từ láy giúp câu văn gợi hình, gợi cảm và giàu nhạc điệu.';
check('đoạn chứa đáp án giữa câu + dấu chấm -> lộ', passageLeaksAnswer(passage, ['nhạc điệu', 'ào ào']) === true);
check('đoạn chứa 1 trong 2 đáp án -> lộ', passageLeaksAnswer(passage, ['nhạc điệu', 'không có']) === true);
check('đoạn không chứa đáp án -> không lộ', passageLeaksAnswer(passage, ['từ ghép', 'ẩn dụ']) === false);
check('không phân biệt hoa/thường + dấu', passageLeaksAnswer(passage, ['NHẠC ĐIỆU']) === true);
check('đáp án là từ con trong từ khác -> không lộ', passageLeaksAnswer('Hoa lan nở trong vườn.', ['an']) === false);
check('đáp án cụm từ -> lộ', passageLeaksAnswer(passage, ['láy lại một phần']) === true);
check('đáp án có biến thể |, 1 biến thể có mặt -> lộ', passageLeaksAnswer(passage, ['nhạc điệu|giai điệu']) === true);
check('đáp án chuỗi đơn (không phải mảng) -> lộ', passageLeaksAnswer(passage, 'ào ào') === true);
check('đoạn rỗng -> không lộ', passageLeaksAnswer('', ['a']) === false);
check('không có đáp án -> không lộ', passageLeaksAnswer(passage, []) === false);
check('không có đáp án (null) -> không lộ', passageLeaksAnswer(passage, null) === false);

if (failures > 0) {
  console.log(`\n${failures} kiểm chứng THẤT BẠI`);
  process.exit(1);
}
console.log('\nTất cả kiểm chứng passageLeaksAnswer ĐẠT');
