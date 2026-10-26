// ĐỢT 7 (26/10): ảnh markdown hỏng trong câu trả lời trợ lý — model chèn
// ![Biểu đồ đăng nhập](...) nhưng URL hỏng nên khung chat chỉ hiện icon vỡ
// + chữ alt, nhấp nháy mỗi lần khung chat re-render. Khung chat duy nhất
// render markdown là AnalyticsAssistantTab (tab + bong bóng dùng chung),
// nên chặn ở đúng nút render đó. Test này là chốt chặn hồi quy: đọc source
// của nút render và luật prompt, bảo đảm chốt chặn còn đó.
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
const assistantSrc = readFileSync(join(ROOT, 'src/services/ai/analyticsAssistant.ts'), 'utf-8');

console.log('=== 1. Nút render markdown chặn ảnh ===');
{
  const mdBlock = tabSrc.slice(tabSrc.indexOf('<ReactMarkdown'));
  check('ReactMarkdown có override img -> null', /img:\s*\(\)\s*=>\s*null/.test(mdBlock), mdBlock.slice(0, 200));
  check('chỉ 1 nút ReactMarkdown trong app (tab + bong bóng dùng chung)', (tabSrc.match(/<ReactMarkdown/g) || []).length === 1);
}

console.log('=== 2. Luật prompt cấm model chèn ảnh markdown ===');
{
  check('luật 5j cấm ảnh markdown', assistantSrc.includes('KHÔNG chèn ảnh markdown'));
  check('5j nêu rõ biểu đồ chỉ qua render_chart', assistantSrc.includes('biểu đồ chỉ hiện qua render_chart'));
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
