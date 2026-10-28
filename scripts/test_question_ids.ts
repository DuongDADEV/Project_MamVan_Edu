import { assignUniqueQuestionIds } from '../src/services/ai/GeminiAIService.ts';

let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = '') {
  if (ok) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

const batchA = [{ id: 'q_ai_1', prompt: 'A' }, { id: 'q_ai_2', prompt: 'B' }, { id: 'q_ai_3', prompt: 'C' }];
const batchB = [{ id: 'q_ai_1', prompt: 'D' }];
const outA = assignUniqueQuestionIds(batchA);
const outB = assignUniqueQuestionIds(batchB);
const all = [...outA, ...outB];
const ids = all.map((q) => q.id!);

check('giữ đủ số câu', all.length === 4);
check('mọi id đều duy nhất qua 2 đợt (lỗi cũ: q_ai_1 trùng)', new Set(ids).size === 4, `ids=${ids.join(',')}`);
check('không còn id mẫu q_ai_1/q_ai_2/q_ai_3', !ids.some((i) => /^q_ai_[123]$/.test(i)));
check('id vẫn chứa "ai" (cờ isAiGenerated không đổi)', ids.every((i) => i.includes('ai')));
check('đề bài giữ nguyên', all.map((q) => q.prompt).join('|') === 'A|B|C|D');
check('không đột biến mảng gốc', batchA[0].id === 'q_ai_1');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
