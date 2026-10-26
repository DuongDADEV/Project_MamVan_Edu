// Phạm vi giáo viên (26/10: toangv thấy dữ liệu gv001; cache chat không
// gắn giáo viên bị đẩy nhầm sang tài khoản mới).
import {
  ownedClasses,
  scopeStudentsToClasses,
  scopeStatesToStudents,
  scopeEssaysToStudents,
  scopeItemsToTeacher,
  scopeQuestionsToTeacher,
  isOwnChatCache,
} from '../src/logic/teacherScope.ts';

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

const GV = '31e24229-6a30-4a7f-8c42-ad6dba9a4c06';
const OTHER = 'f48787f3-fd03-43d1-916c-c4e87bb75a69';

console.log('=== teacherScope ===');
{
  const classes = [
    { id: 'c1', teacherId: GV },
    { id: 'c2', teacherId: OTHER },
    { id: 'c3' },
  ];
  const owned = ownedClasses(classes, GV);
  check('chỉ lớp của mình', owned.map((c) => c.id).join(',') === 'c1', owned.map((c) => c.id));
  check('mock/legacy giữ nguyên', ownedClasses(classes, 'gv001').length === 3);
  check('thiếu teacherId giữ nguyên', ownedClasses(classes, undefined).length === 3);
}
{
  const students = [
    { id: 's1', class_id: 'c1' },
    { id: 's2', class_id: 'c2' },
    { id: 's3' },
  ];
  const scoped = scopeStudentsToClasses(students, new Set(['c1']));
  check('học sinh theo lớp', scoped.map((s) => s.id).join(',') === 's1', scoped.map((s) => s.id));
}
{
  const states = { s1: { xp: 1 }, s2: { xp: 2 } } as any;
  const scoped = scopeStatesToStudents(states, new Set(['s1']));
  check('trạng thái theo học sinh', Object.keys(scoped).join(',') === 's1');
}
{
  const essays = [{ studentId: 's1' }, { studentId: 's2' }, {}];
  const scoped = scopeEssaysToStudents(essays as any, new Set(['s1']));
  check('bài nộp theo học sinh', scoped.length === 1);
}
{
  const items = [{ teacher_id: GV }, { teacher_id: OTHER }, {}];
  check('chủ đề/bài theo GV', scopeItemsToTeacher(items as any, GV).length === 1);
  check('chủ đề/bài legacy giữ nguyên', scopeItemsToTeacher(items as any, 'gv001').length === 3);
}
{
  const qs = { q1: { teacher_id: GV }, q2: { teacher_id: OTHER } } as any;
  const scoped = scopeQuestionsToTeacher(qs, GV);
  check('câu hỏi theo GV', Object.keys(scoped).join(',') === 'q1');
}
{
  check('cache đúng GV được gộp', isOwnChatCache(GV, GV) === true);
  check('cache khác GV không gộp', isOwnChatCache(OTHER, GV) === false);
  check('cache không rõ chủ KHÔNG gộp (lỗ 26/10)', isOwnChatCache(null, GV) === false);
  check('cache không rõ chủ KHÔNG gộp (undefined)', isOwnChatCache(undefined, GV) === false);
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
