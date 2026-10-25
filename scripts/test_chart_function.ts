// ĐỢT 6 (26/10): vẽ biểu đồ = 1 function duy nhất — render_chart nhận loai
// rồi tự chạy công cụ dữ liệu trong code; get_class_summary có series số
// học sinh từng lớp để vẽ được tổng quan lớp.
import {
  CHART_LOAI_TO_TOOL,
  buildClassCountSeries,
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

const CLASSES = [
  { id: 'c1', name: '7A4' },
  { id: 'c2', name: '7A5' },
] as any;
const STUDENTS = [
  { class_id: 'c1' },
  { class_id: 'c1' },
  { class_id: 'c2' },
] as any;

console.log('=== 1. CHART_LOAI_TO_TOOL ===');
{
  check('tong_quan_lop -> get_class_summary', CHART_LOAI_TO_TOOL['tong_quan_lop']?.tool === 'get_class_summary');
  check(
    'tien_do_hoc_sinh -> get_student_profile + studentName',
    CHART_LOAI_TO_TOOL['tien_do_hoc_sinh']?.tool === 'get_student_profile' &&
      CHART_LOAI_TO_TOOL['tien_do_hoc_sinh']?.argName === 'studentName'
  );
  check('pho_diem -> get_score_distribution', CHART_LOAI_TO_TOOL['pho_diem']?.tool === 'get_score_distribution');
  check('hoat_dong -> get_learning_activity', CHART_LOAI_TO_TOOL['hoat_dong']?.tool === 'get_learning_activity');
  check('so_sanh_chu_de -> compare_topics', CHART_LOAI_TO_TOOL['so_sanh_chu_de']?.tool === 'compare_topics');
  check('loai lạ -> undefined', (CHART_LOAI_TO_TOOL as any)['khong_co'] === undefined);
}

console.log('=== 2. buildClassCountSeries ===');
{
  const all = { classIds: ['all'], studentIds: [] } as any;
  const s = buildClassCountSeries(CLASSES, STUDENTS, all);
  check('đủ 2 lớp', s.rows.length === 2, s.rows);
  check('7A4 = 2', s.rows.find((r: any) => r.lop === '7A4')?.soHocSinh === 2, s.rows);
  check('7A5 = 1', s.rows.find((r: any) => r.lop === '7A5')?.soHocSinh === 1, s.rows);
  check('xKey lop, yKey soHocSinh', s.xKey === 'lop' && s.yKey === 'soHocSinh');
  check('yLabel + defaultType bar', s.yLabel === 'Số học sinh' && s.defaultType === 'bar');

  const one = { classIds: ['c1'], studentIds: [] } as any;
  const s1 = buildClassCountSeries(CLASSES, STUDENTS, one);
  check('lọc 1 lớp -> chỉ 7A4', s1.rows.length === 1 && s1.rows[0].lop === '7A4', s1.rows);

  const s0 = buildClassCountSeries(CLASSES, [], all);
  check('không học sinh -> rows rỗng', s0.rows.length === 0, s0.rows);
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
