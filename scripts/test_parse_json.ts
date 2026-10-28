/**
 * Kiểm chứng trích JSON từ phản hồi AI (src/services/ai/GeminiAIService.ts):
 * - JSON thuần, JSON kèm chữ thừa sau (kể cả chữ thừa chứa ] hoặc } — lỗi
 *   "non-whitespace character after JSON" ngày 28/10 làm rớt xuống bản mẫu),
 * - JSON trong code fence (thử mọi khối fence, không chỉ khối đầu),
 * - JSON bọc trong đối tượng {"questions": [...]}.
 * Chạy: npx tsx scripts/test_parse_json.ts
 */
import { extractJsonFromText, normalizeAiQuestionArray } from '../src/services/ai/GeminiAIService.ts';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  PASS ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}`);
  }
}

const q1 = { prompt: 'Câu 1', type: 'single', level: 'NHAN_BIET', difficulty: 'DE', options: ['a', 'b'], answer: 'a' };
const q2 = { prompt: 'Câu 2', type: 'fill', level: 'PHAN_TICH', difficulty: 'TB', answer: ['x'] };
const arr = JSON.stringify([q1, q2]);

check('JSON thuần', JSON.stringify(extractJsonFromText(arr)) === arr);
check(
  'JSON + chữ thừa sau',
  (extractJsonFromText(`${arr}\nĐây là 5 câu hỏi theo yêu cầu.`) as any[]).length === 2
);
check(
  'JSON + chữ thừa chứa ] và }',
  (extractJsonFromText(`${arr}\nXem thêm [phần 1] {ghi chú} và chúc bạn dạy tốt!`) as any[]).length === 2
);
check(
  'JSON trong fence + chữ thừa sau',
  (extractJsonFromText(`\`\`\`json\n${arr}\n\`\`\`\nHy vọng giúp ích cho thầy/cô!`) as any[]).length === 2
);
check(
  'khối fence đầu là ví dụ rác, khối sau mới là JSON thật',
  (extractJsonFromText(`Ví dụ định dạng:\n\`\`\`json\n{"note": "mau"}\n\`\`\`\nKết quả:\n\`\`\`json\n${arr}\n\`\`\``) as any[]).length === 2
);
check(
  'chữ trước JSON + JSON trần',
  (extractJsonFromText(`Dưới đây là bộ câu hỏi:\n${arr}`) as any[]).length === 2
);
check(
  '2 đối tượng JSON liên tiếp -> lấy đối tượng đầu',
  (extractJsonFromText(`${JSON.stringify(q1)}\n${JSON.stringify(q2)}`) as any).prompt === 'Câu 1'
);
check(
  'bọc {"questions": [...]} gỡ về mảng',
  normalizeAiQuestionArray(extractJsonFromText(JSON.stringify({ questions: [q1, q2] }))).length === 2
);
check(
  'mảng giữ nguyên qua normalize',
  normalizeAiQuestionArray([q1]).length === 1
);
check(
  'không phải JSON -> ném lỗi rõ',
  (() => {
    try {
      extractJsonFromText('Xin chào, tôi không trả JSON đâu.');
      return false;
    } catch (e: any) {
      return String(e.message).includes('Không thể phân tích');
    }
  })()
);

if (failures > 0) {
  console.log(`\n${failures} kiểm chứng THẤT BẠI`);
  process.exit(1);
}
console.log('\nTất cả kiểm chứng parse JSON ĐẠT');
