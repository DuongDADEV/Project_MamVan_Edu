// ĐỢT 7 (26/10): bảng markdown trong câu trả lời trợ lý — trước đây không
// có style nên 6 cột bị bóp dúm trong bong bóng hẹp (chữ dính nhau kiểu
// 'Assignment1', tiêu đề vỡ giữa từ). Bảng nay bọc trong khung cuộn ngang,
// cột đủ rộng, ô có padding + viền. Test chốt chặn hồi quy bằng source.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const tabSrc = readFileSync(join(ROOT, 'src/components/teacher/analytics/AnalyticsAssistantTab.tsx'), 'utf-8');
const mdBlock = tabSrc.slice(tabSrc.indexOf('<ReactMarkdown'));

console.log('=== Bảng markdown có style, cuộn ngang ===');
{
  check('table bọc overflow-x-auto', /table:\s*\(\{\s*children\s*\}\)\s*=>\s*\(?\s*<div[^>]*overflow-x-auto/.test(mdBlock));
  check('bảng có chiều rộng tối thiểu để cột không bóp', /min-w-\[\d+px\]/.test(mdBlock));
  check('th có padding + viền + không vỡ từ', /th:\s*\(\{\s*children\s*\}\)\s*=>\s*\(?\s*<th[^>]*border[^>]*px-2[^>]*whitespace-nowrap/.test(mdBlock));
  check('td có padding + viền', /td:\s*\(\{\s*children\s*\}\)\s*=>\s*\(?\s*<td[^>]*border[^>]*px-2/.test(mdBlock));
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
