// NUDGE + DỌN ROUTE + NHÃN LỚP THẬT (26/10, sau ca model bỏ qua tool):
// - Model trả chữ có số mà chưa gọi tool nào, câu hỏi đã route tool dữ liệu
//   -> điều kiện nudge = đúng điều kiện guard chặn (isUngroundedDataAnswer).
// - Câu hỏi đọc không còn kéo tool ghi theo từ khóa 'bai tap'.
// - Evidence/dữ liệu tool luôn gắn nhãn lớp thật trong phạm vi.
import {
  isUngroundedDataAnswer,
  selectToolsForQuery,
  classScopeLabel,
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

function routedNames(q: string): string[] {
  const out = selectToolsForQuery(q);
  return out ? out.map((d: any) => d.name) : [];
}

console.log('=== 1. Điều kiện nudge (= điều kiện guard chặn) ===');
{
  const routed: any[] = [{ name: 'get_learning_activity' }];
  check(
    'chữ có số + đã route tool + 0 lượt chạy -> nudge',
    isUngroundedDataAnswer('Tỉ lệ điểm danh tuần 4 là 70%, 10 học sinh đã nộp bài.', 0, routed)
  );
  check(
    'câu hỏi làm rõ không có số -> không nudge',
    !isUngroundedDataAnswer('Thầy/cô muốn xem lớp nào ạ?', 0, routed)
  );
  check(
    'câu không khớp từ khóa (routed null) -> không nudge',
    !isUngroundedDataAnswer('Tỉ lệ điểm danh tuần 4 là 70%.', 0, null)
  );
  check(
    'đã có lượt chạy tool -> không nudge',
    !isUngroundedDataAnswer('Tỉ lệ điểm danh tuần 4 là 70%.', 1, routed)
  );
}

console.log('=== 2. Dọn route: câu đọc không kéo tool ghi ===');
{
  const read = routedNames('Tình hình điểm danh và nộp bài tập gần đây thế nào?');
  check('câu đọc vẫn có get_learning_activity', read.includes('get_learning_activity'), read);
  check('câu đọc vẫn có get_submission_history', read.includes('get_submission_history'), read);
  check('câu đọc vẫn có list_assignments', read.includes('list_assignments'), read);
  check('câu đọc KHÔNG có create_assignment', !read.includes('create_assignment'), read);
  check('câu đọc KHÔNG có update_assignment', !read.includes('update_assignment'), read);
  check(
    '"Tạo bài tập mới" vẫn giữ create_assignment',
    routedNames('Tạo bài tập mới cho lớp 7A4').includes('create_assignment')
  );
  check(
    '"Giao bài tập" vẫn giữ create_assignment',
    routedNames('Giao bài tập cho lớp 7A4').includes('create_assignment')
  );
  check(
    '"Sửa bài tập" vẫn giữ update_assignment',
    routedNames('Sửa bài tập kiểm tra số 1').includes('update_assignment')
  );
}

console.log('=== 3. Nhãn lớp thật của phạm vi ===');
{
  const ctx1: any = { classes: [{ id: 'c1', name: '7A4' }] };
  const ctx2: any = {
    classes: [
      { id: 'c1', name: '7A4' },
      { id: 'c2', name: '7A5' },
    ],
  };
  check('1 lớp, filter trống -> Lớp 7A4', classScopeLabel(ctx1, {} as any) === 'Lớp 7A4');
  check(
    '1 lớp, filter khoanh lớp khác -> vẫn Lớp 7A4 (dữ liệu chỉ có lớp đó)',
    classScopeLabel(ctx1, { classIds: ['zzz'] } as any) === 'Lớp 7A4'
  );
  check('nhiều lớp, filter trống -> không nhãn', classScopeLabel(ctx2, {} as any) === null);
  check(
    'nhiều lớp, filter khoanh 1 lớp -> đúng lớp đó',
    classScopeLabel(ctx2, { classIds: ['c2'] } as any) === 'Lớp 7A5'
  );
  check(
    'nhiều lớp, filter khoanh id lạ -> không nhãn',
    classScopeLabel(ctx2, { classIds: ['zzz'] } as any) === null
  );
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
