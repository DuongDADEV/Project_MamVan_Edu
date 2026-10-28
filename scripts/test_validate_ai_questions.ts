/**
 * Kiểm chứng lớp kiểm chứng câu hỏi AI (src/logic/validateAiQuestions.ts):
 * - Câu đủ trường -> hợp lệ.
 * - Câu thiếu đề bài / loại / mức / độ khó / đáp án -> bị loại.
 * - missingTypeCounts tính đúng số thiếu theo từng loại.
 * Chạy: npx tsx scripts/test_validate_ai_questions.ts
 */
import {
  isValidGeneratedQuestion,
  filterValidQuestions,
  missingTypeCounts,
} from '../src/logic/validateAiQuestions.ts';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  PASS ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}`);
  }
}

const good = {
  id: 'q1',
  prompt: 'Đâu là từ láy?',
  type: 'single',
  options: ['lấp lánh', 'lấp ló'],
  answer: 'lấp lánh',
  level: 'NHAN_BIET',
  difficulty: 'DE',
};
check('câu đủ trường hợp lệ', isValidGeneratedQuestion(good as any) === true);
check('thiếu đề bài -> loại', isValidGeneratedQuestion({ ...good, prompt: '' } as any) === false);
check('thiếu đề bài (khoảng trắng) -> loại', isValidGeneratedQuestion({ ...good, prompt: '   ' } as any) === false);
check('loại lạ -> loại', isValidGeneratedQuestion({ ...good, type: 'weird' } as any) === false);
check('không có loại -> loại', isValidGeneratedQuestion({ ...good, type: undefined } as any) === false);
check('mức lạ -> loại', isValidGeneratedQuestion({ ...good, level: 'KHO' } as any) === false);
check('độ khó lạ -> loại', isValidGeneratedQuestion({ ...good, difficulty: 'KHO_KHAN' } as any) === false);
check('trắc nghiệm < 2 lựa chọn -> loại', isValidGeneratedQuestion({ ...good, options: ['a'] } as any) === false);
check('trắc nghiệm thiếu đáp án -> loại', isValidGeneratedQuestion({ ...good, answer: '' } as any) === false);
check('điền khuyết đáp án rỗng -> loại', isValidGeneratedQuestion({ ...good, type: 'fill', answer: '' } as any) === false);
check('điền khuyết đáp án có ô trống hợp lệ', isValidGeneratedQuestion({ ...good, type: 'fill', prompt: 'Từ ___ và ___ là từ láy.', answer: ['xanh', ''] } as any) === true);
check('tự luận không cần đáp án', isValidGeneratedQuestion({ ...good, type: 'essay', options: undefined, answer: undefined } as any) === true);
check('null -> loại', isValidGeneratedQuestion(null as any) === false);

const mixed = filterValidQuestions([
  good as any,
  { ...good, id: 'q2', prompt: '' } as any,
  { ...good, id: 'q3', type: 'essay', options: undefined, answer: undefined } as any,
  { ...good, id: 'q4', level: 'SAI' } as any,
]);
check('lọc giữ đúng 2 câu hợp lệ', mixed.length === 2 && mixed[0].id === 'q1' && mixed[1].id === 'q3');

const missing = missingTypeCounts(
  { single: 2, multi: 1, fill: 1, essay: 1 },
  [{ ...good, type: 'single' } as any, { ...good, type: 'fill' } as any]
);
check(
  'thiếu đúng single 1 + multi 1 + essay 1 = 3',
  missing.counts.single === 1 && missing.counts.multi === 1 && missing.counts.fill === 0 && missing.counts.essay === 1 && missing.total === 3
);

// 28/10: câu điền từ bắt buộc có ô trống ___ trong đề bài.
const fillGood = {
  id: 'qf1',
  prompt: 'Tác giả đã làm nổi bật ___ cảm xúc và thông điệp nhân văn ___ gửi gắm đến bạn đọc.',
  type: 'fill',
  answer: ['chiều sâu', 'cao đẹp'],
  level: 'PHAN_TICH',
  difficulty: 'TB',
};
check('điền từ có ___ hợp lệ', isValidGeneratedQuestion(fillGood as any) === true);
check(
  'điền từ đề chỉ là câu lệnh chung -> loại',
  isValidGeneratedQuestion({ ...fillGood, prompt: 'Điền từ ngữ thích hợp vào các vị trí trống để hoàn thiện nhận định phân tích sau:' } as any) === false
);
check(
  'điền từ đề không có ___ nhưng đáp án đủ -> vẫn loại',
  isValidGeneratedQuestion({ ...fillGood, prompt: 'Qua ngòi bút tinh tế, tác giả đã làm nổi bật cảm xúc và thông điệp nhân văn gửi gắm đến bạn đọc.' } as any) === false
);
check(
  'điền từ có ___ nhưng đáp án rỗng -> loại',
  isValidGeneratedQuestion({ ...fillGood, answer: [] } as any) === false
);

if (failures > 0) {
  console.log(`\n${failures} kiểm chứng THẤT BẠI`);
  process.exit(1);
}
console.log('\nTất cả kiểm chứng validateAiQuestions ĐẠT');
