// Luồng lý thuyết — chọn nhiều bài Luyện tập (26/10: trước đây chỉ hiện 1
// bài, bài thứ 2 trở đi vô hình dù đã xuất bản).
import { selectTheoryPracticeQuizzes } from '../src/logic/theoryFlow.ts';

type Q = { id: string; kind: string };
const q = (id: string, kind: string): Q => ({ id, kind });

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
const ids = (list: Q[]) => list.map((x) => x.id).join(',');

console.log('=== selectTheoryPracticeQuizzes ===');
{
  // Ca thật 26/10: bài giữa gắn làm Luyện tập, bài văn cuối cùng loại
  // practice nhưng không gắn đâu — cả 2 đều phải hiện, đúng thứ tự luồng.
  const out = selectTheoryPracticeQuizzes({
    linkedPracticeId: 'quiz_giua',
    topicQuizzes: [q('quiz_giua', 'practice'), q('quiz_van', 'practice')],
    flowOrder: ['theory:t1', 'quiz:quiz_giua', 'quiz:quiz_van'],
  });
  check('ca thật: cả 2 bài hiện, bài gắn trước', ids(out) === 'quiz_giua,quiz_van', ids(out));
}
{
  // Không gắn gì: mọi bài practice trong chủ đề đều hiện theo flowOrder.
  const out = selectTheoryPracticeQuizzes({
    topicQuizzes: [q('a', 'practice'), q('b', 'practice'), q('c', 'practice')],
    flowOrder: ['theory:t1', 'quiz:c', 'quiz:a', 'quiz:b'],
  });
  check('không gắn: xếp theo flowOrder', ids(out) === 'c,a,b', ids(out));
}
{
  // Bài gắn làm Kiểm tra không lọt sang bước Luyện tập.
  const out = selectTheoryPracticeQuizzes({
    linkedPracticeId: 'p1',
    explicitTestQuizId: 't1',
    topicQuizzes: [q('p1', 'practice'), q('t1', 'practice'), q('p2', 'practice')],
    flowOrder: [],
  });
  check('bài gắn Kiểm tra bị loại khỏi Luyện tập', ids(out) === 'p1,p2', ids(out));
}
{
  // Bài của lý thuyết khác trong cùng chủ đề không lọt sang.
  const out = selectTheoryPracticeQuizzes({
    topicQuizzes: [q('mine', 'practice'), q('other', 'practice')],
    flowOrder: ['theory:t1', 'quiz:mine', 'quiz:other'],
    excludedQuizIds: ['other'],
  });
  check('bài của lý thuyết khác bị loại', ids(out) === 'mine', ids(out));
}
{
  // Bài không phải practice (trừ bài gắn) không thành bước Luyện tập;
  // bài chưa có trong flowOrder xếp cuối, giữ thứ tự danh sách.
  const out = selectTheoryPracticeQuizzes({
    topicQuizzes: [q('k1', 'quick'), q('u1', 'practice'), q('u2', 'practice')],
    flowOrder: ['theory:t1'],
  });
  check('chỉ practice + chưa xếp cuối giữ thứ tự', ids(out) === 'u1,u2', ids(out));
}
{
  // Bài gắn trùng bài Kiểm tra: bước Kiểm tra thắng, không hiện Luyện tập.
  const out = selectTheoryPracticeQuizzes({
    linkedPracticeId: 'same',
    explicitTestQuizId: 'same',
    topicQuizzes: [q('same', 'practice')],
    flowOrder: [],
  });
  check('gắn trùng: không trùng bước', ids(out) === '', ids(out));
}
{
  // Không có bài nào -> rỗng (luồng chỉ còn lý thuyết + hoàn thành).
  const out = selectTheoryPracticeQuizzes({ topicQuizzes: [], flowOrder: [] });
  check('không có bài -> rỗng', out.length === 0);
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
