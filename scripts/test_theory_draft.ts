// Trình soạn Lý thuyết — khối khởi tạo + convert sections (26/10, ca mất
// nội dung khi chuyển bước: khối soạn phải suy ra đúng từ bài đang mở).
import {
  initialBlocksFor,
  theorySectionsFromBlocks,
  defaultTheoryBlocks,
} from '../src/logic/theoryDraft.ts';

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

console.log('=== 1. initialBlocksFor ===');
{
  const withBlocks: any = {
    blocks: [
      { id: 'x1', type: 'heading', level: 2, content: 'Cách lập dàn ý văn' },
      { id: 'x2', type: 'paragraph', content: 'Đoạn Taeyang.' },
    ],
  };
  const out = initialBlocksFor(withBlocks);
  check(
    'có blocks -> giữ nguyên blocks đã lưu',
    out.length === 2 && out[0].content === 'Cách lập dàn ý văn' && out[1].content === 'Đoạn Taeyang.',
    out
  );

  const sectionsOnly: any = {
    sections: [
      {
        title: 'Mở bài',
        body: ['Câu 1.', 'Câu 2.'],
        example: { text: 'Ví dụ.', analysis: 'Phân tích.' },
        takeaway: 'Nhớ.',
      },
    ],
  };
  const conv = initialBlocksFor(sectionsOnly);
  check(
    'chỉ có sections -> convert đủ heading + paragraph + example + takeaway',
    conv.length === 5 &&
      conv[0].type === 'heading' &&
      conv[0].content === 'Mở bài' &&
      conv[1].content === 'Câu 1.' &&
      conv[2].content === 'Câu 2.' &&
      conv[3].type === 'example' &&
      conv[4].type === 'takeaway',
    conv
  );

  const empty: any = {};
  const tmpl = initialBlocksFor(empty);
  check(
    'không có gì -> mẫu 4 khối mặc định',
    tmpl.length === 4 && tmpl[0].content === '1. Khái niệm và đặc điểm chung',
    tmpl.map((b: any) => b.content)
  );
  check(
    'mẫu mặc định khớp defaultTheoryBlocks',
    JSON.stringify(tmpl) === JSON.stringify(defaultTheoryBlocks())
  );
}

console.log('=== 2. theorySectionsFromBlocks ===');
{
  const blocks: any[] = [
    { id: 'h1', type: 'heading', level: 2, content: 'Phần 1' },
    { id: 'p1', type: 'paragraph', content: 'Đoạn A.' },
    { id: 'p2', type: 'paragraph', content: 'Đoạn B.' },
    { id: 't1', type: 'takeaway', takeawayText: 'Cốt lõi.' },
    { id: 'h2', type: 'heading', level: 2, content: 'Phần 2' },
  ];
  const secs = theorySectionsFromBlocks(blocks);
  check('2 heading -> 2 sections', secs.length === 2, secs);
  check(
    'section gom tất cả paragraph (hành vi cũ, giữ nguyên)',
    secs[0].body.length === 2 && secs[1].body.length === 2,
    secs
  );
  check('takeaway lấy cái đầu tiên', secs[0].takeaway === 'Cốt lõi.');
  check(
    'không có heading -> sections rỗng (editor fallback về sections cũ)',
    theorySectionsFromBlocks([{ id: 'p', type: 'paragraph', content: 'x' } as any]).length === 0
  );
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
