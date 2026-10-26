// ĐỢT 7 (26/10): bảng rộng trong bong bóng chat hẹp tự đổi thành thẻ dọc —
// cột đầu thành tiêu đề thẻ, các cột còn lại thành dòng 'Nhãn: giá trị',
// nên bảng nào cũng vừa khung, không tràn, không cần kéo ngang. Bảng hẹp
// (3 cột trở xuống) giữ dạng bảng thường.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  textOf,
  extractTable,
  toCards,
  shouldStack,
} from '../src/components/teacher/analytics/tableCards.ts';

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

// Phần tử giả dạng cây react-markdown: { props: { children } }.
const el = (children: any) => ({ props: { children } });
const tableTree = (headers: string[], rows: string[][]) =>
  el([
    el([el(headers.map((h) => el(h)))]),
    el(rows.map((r) => el(r.map((c) => el(c))))),
  ]);

console.log('=== 1. extractTable (đi theo vị trí, không theo tên thẻ) ===');
{
  const t = extractTable(tableTree(
    ['Bài / Hoạt động', 'Loại', 'Số lần nộp', 'Số lần làm lại', 'Thời gian nộp (lần cuối)', 'Điểm (lần cuối)'],
    [
      ['Đọc hiểu và viết cảm nhận', 'Assignment', '1', '0', '18:00 19/10/2026', '2.7/4'],
      ['Ôn tập kiến thức', 'Assignment', '1', '0', '18:00 14/10/2026', '3/9'],
    ]
  ).props.children);
  check('đọc đủ 6 tiêu đề', t?.headers.length === 6, t?.headers);
  check('đọc đủ 2 hàng', t?.rows.length === 2, t?.rows);
  check('ô đầu hàng 1 đúng', t?.rows[0][0] === 'Đọc hiểu và viết cảm nhận', t?.rows[0]);
  check('giờ nộp giữ nguyên', t?.rows[0][4] === '18:00 19/10/2026', t?.rows[0]);
  check('cây rỗng -> null để quay về bảng thường', extractTable(null) === null && extractTable([]) === null);
  check('text lồng nhau vẫn đọc được', textOf(el(['a', el(['b', 'c'])])) === 'abc');
}

console.log('=== 2. toCards + shouldStack ===');
{
  const cards = toCards(
    ['Bài', 'Loại', 'Số lần nộp', 'Điểm'],
    [['Bài 1', 'Assignment', '1', '2.7/4']]
  );
  check('cột đầu thành tiêu đề thẻ', cards[0].title === 'Bài 1', cards[0]);
  check('các cột còn lại thành dòng Nhãn: giá trị', cards[0].lines.length === 3 && cards[0].lines[0].label === 'Loại' && cards[0].lines[0].value === 'Assignment', cards[0].lines);
  check('6 cột -> xếp thẻ', shouldStack(['a', 'b', 'c', 'd', 'e', 'f']) === true);
  check('4 cột -> xếp thẻ', shouldStack(['a', 'b', 'c', 'd']) === true);
  check('3 cột -> giữ bảng', shouldStack(['a', 'b', 'c']) === false);
}

console.log('=== 3. Nút render dùng cơ chế thẻ dọc ===');
{
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  const tabSrc = readFileSync(join(ROOT, 'src/components/teacher/analytics/AnalyticsAssistantTab.tsx'), 'utf-8');
  const mdBlock = tabSrc.slice(tabSrc.indexOf('<ReactMarkdown'));
  check('table override gọi extractTable + shouldStack + toCards', /extractTable\(children\)/.test(mdBlock) && /shouldStack\(/.test(mdBlock) && /toCards\(/.test(mdBlock));
  check('thẻ dọc có tiêu đề + dòng nhãn', /rounded-xl p-2/.test(mdBlock));
  check('bảng hẹp vẫn có cuộn ngang dự phòng', /overflow-x-auto/.test(mdBlock));
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
