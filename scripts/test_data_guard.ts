// ĐỢT 5 (26/10): guard chặn số bịa ở trợ lý phân tích — câu hỏi đã chọn
// tool mà model trả toàn chữ không gọi tool nào, lại chứa số liệu thì câu
// đó bị chặn (isUngroundedDataAnswer = true).
import {
  isUngroundedDataAnswer,
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

const ROUTED = [{ name: 'render_chart' }, { name: 'get_class_summary' }];

console.log('=== 1. isUngroundedDataAnswer ===');
{
  check(
    'bảng % kiểu ảnh chụp -> chặn',
    isUngroundedDataAnswer('Toán 85% Văn 80% Anh 90%', 0, ROUTED) === true
  );
  check(
    'số kèm điểm -> chặn',
    isUngroundedDataAnswer('An được 120 điểm kinh nghiệm', 0, ROUTED) === true
  );
  check(
    'phân số -> chặn',
    isUngroundedDataAnswer('Hoàn thành 3/5 bài', 0, ROUTED) === true
  );
  check(
    'số kèm XP -> chặn',
    isUngroundedDataAnswer('Tổng 250 XP', 0, ROUTED) === true
  );
  check(
    'chỉ mã lớp 7A4, không số liệu -> không chặn',
    isUngroundedDataAnswer('Em xem lớp 7A4 cho thầy nhé', 0, ROUTED) === false
  );
  check(
    'số thứ tự (chủ đề 1) -> không chặn',
    isUngroundedDataAnswer('Xem chủ đề 1 giúp thầy', 0, ROUTED) === false
  );
  check(
    'câu không có số -> không chặn',
    isUngroundedDataAnswer('Thầy cho em biết tên học sinh nhé', 0, ROUTED) === false
  );
  check(
    'đã gọi tool rồi -> không chặn',
    isUngroundedDataAnswer('Toán 85%', 1, ROUTED) === false
  );
  check(
    'câu chào (routed rỗng) -> không chặn',
    isUngroundedDataAnswer('Chào thầy, em giúp gì được ạ? 100%', 0, []) === false
  );
  check(
    'câu nối tiếp không khớp (routed null) -> không chặn',
    isUngroundedDataAnswer('An được 8 điểm', 0, null) === false
  );
}

console.log('=== 2. router cho câu hỏi trong ảnh chụp ===');
{
  const decls = selectToolsForQuery('xem biểu đồ tổng quan');
  check('router chọn được tool', Array.isArray(decls) && decls.length > 0, decls);
  check(
    'router có render_chart',
    !!decls && decls.some((d: any) => d.name === 'render_chart'),
    decls?.map((d: any) => d.name)
  );
  check(
    'câu chào -> routed rỗng',
    JSON.stringify(selectToolsForQuery('xin chào')) === '[]'
  );
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
