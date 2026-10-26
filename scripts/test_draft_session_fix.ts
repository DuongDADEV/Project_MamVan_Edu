// ĐỢT 7 (26/10): bản nháp lưu/duyệt lỗi ở cả 3 phần Studio — 2 nguyên nhân
// đã chứng minh:
//  1. Phiên đăng nhập cũ (id legacy 'gv001') đóng dấu teacher_id = sentinel
//     mà RLS chặn (403, đã tái hiện bằng JWT thật: sentinel -> 403, UUID
//     thật -> 201) — nhưng App không bao giờ gọi getSession() lúc mở app
//     nên phiên cũ không được tự chữa. Sửa: App tự chữa phiên khi mở app.
//  2. Bấm "Duyệt trong Studio" với nháp 'global'/chủ đề đã xóa thì Studio
//     nạp sai khóa nháp nên không mở màn duyệt. Sửa: đặt formTopicId đúng
//     khóa nháp, không điều kiện.
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
const appSrc = readFileSync(join(ROOT, 'src/App.tsx'), 'utf-8');
const bankSrc = readFileSync(join(ROOT, 'src/screens/teacher/TeacherQuestionBankScreen.tsx'), 'utf-8');

console.log('=== 1. App tự chữa phiên khi mở app ===');
{
  check('App gọi authService.getSession()', /authService\.getSession\(\)/.test(appSrc));
  check('chỉ đồng bộ khi phiên khác phiên lúc mở app', /JSON\.stringify\(healed\) !== JSON\.stringify\(initial\)/.test(appSrc) && /setCurrentSession\(healed\)/.test(appSrc));
  check('effect chạy 1 lần khi mở app', /authService\.getSession\(\)[\s\S]{0,400}\},\ \[\]\)/.test(appSrc));
}

console.log('=== 2. Duyệt trong Studio nạp đúng khóa nháp ===');
{
  const m = bankSrc.match(/const handleReviewDraftInStudio[\s\S]*?^  \};/m);
  check('tìm được handler', !!m);
  if (m) {
    check("nháp 'global' -> topic rỗng", /setFormTopicId\(topicId === 'global' \? '' : topicId\)/.test(m[0]));
    check('không còn điều kiện topics.some chặn đặt topic', !/topics\.some\(\(t\) => t\.id === topicId\)/.test(m[0]));
  }
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
