// Luồng học cấp chủ đề (26/10: HS phải thấy đủ bài, đúng thứ tự cô đăng).
import { buildTopicFlowPath, flowIndexOf, nextFlowItem, prevFlowItem } from '../src/logic/topicFlow.ts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) { pass++; console.log(`  PASS: ${name}`); }
  else { fail++; console.log(`  FAIL: ${name}`, extra ?? ''); }
}

const V1 = { id: 'v1', title: 'Video 1' };
const V2 = { id: 'v2', title: 'Video 2' };
const Q = { id: 'q1', title: 'Bài tập mới' };
const T = { id: 't1', title: 'Lý thuyết mới' };

{
  // Đúng thứ tự cô đăng: video, bài tập, lý thuyết, video (topic "bài học 1").
  const path = buildTopicFlowPath({
    flowOrder: ['video:v1', 'quiz:q1', 'theory:t1', 'video:v2'],
    videos: [V1, V2],
    theories: [T],
    quizzes: [Q],
  });
  check('đủ 4 bài đúng thứ tự cô đăng',
    path.map((p) => `${p.type}:${p.id}`).join(',') === 'video:v1,quiz:q1,theory:t1,video:v2',
    path.map((p) => `${p.type}:${p.id}`));
  check('tiêu đề lấy từ bài', path[1].title === 'Bài tập mới' && path[3].title === 'Video 2');
  check('cả 2 video đều có mặt', path.filter((p) => p.type === 'video').length === 2);
}
{
  // Mục trong flowOrder nhưng không còn tồn tại thì bỏ.
  const path = buildTopicFlowPath({
    flowOrder: ['video:v1', 'quiz:qx', 'video:v2'],
    videos: [V1, V2],
    theories: [],
    quizzes: [],
  });
  check('bỏ mục đã mất', path.map((p) => p.id).join(',') === 'v1,v2', path.map((p) => p.id));
}
{
  // Không có flowOrder: bổ sung cuối theo video → lý thuyết → bài tập.
  const path = buildTopicFlowPath({
    flowOrder: undefined,
    videos: [V1, V2],
    theories: [T],
    quizzes: [Q],
  });
  check('không flowOrder thì video → lý thuyết → bài tập',
    path.map((p) => `${p.type}:${p.id}`).join(',') === 'video:v1,video:v2,theory:t1,quiz:q1',
    path.map((p) => `${p.type}:${p.id}`));
}
{
  const path = buildTopicFlowPath({
    flowOrder: ['video:v1', 'quiz:q1', 'theory:t1', 'video:v2'],
    videos: [V1, V2],
    theories: [T],
    quizzes: [Q],
  });
  check('next của video đầu là bài tập', nextFlowItem(path, 'video', 'v1')?.id === 'q1');
  check('next của lý thuyết là video 2', nextFlowItem(path, 'theory', 't1')?.id === 'v2');
  check('next của cuối là rỗng', nextFlowItem(path, 'video', 'v2') === undefined);
  check('prev của bài tập là video đầu', prevFlowItem(path, 'quiz', 'q1')?.id === 'v1');
  check('prev của đầu là rỗng', prevFlowItem(path, 'video', 'v1') === undefined);
  check('index đúng', flowIndexOf(path, 'theory', 't1') === 2 && flowIndexOf(path, 'video', 'zz') === -1);
}
{
  const path = buildTopicFlowPath({
    flowOrder: ['video:v9'],
    videos: [{ id: 'v9' }],
    theories: [],
    quizzes: [],
  });
  check('thiếu tiêu đề thì dùng tên mặc định', path[0].title === 'Bài giảng Video');
}


{
  // Vi du cua chu du an 26/10: bai tap, ly thuyet, video, video, bai tap, ly thuyet, video.
  const path = buildTopicFlowPath({
    flowOrder: ['quiz:q1', 'theory:t1', 'video:v1', 'video:v2', 'quiz:q2', 'theory:t2', 'video:v3'],
    videos: [{ id: 'v1', title: 'Video 1' }, { id: 'v2', title: 'Video 2' }, { id: 'v3', title: 'Video 3' }],
    theories: [{ id: 't1', title: 'Ly thuyet 1' }, { id: 't2', title: 'Ly thuyet 2' }],
    quizzes: [{ id: 'q1', title: 'Bai tap 1' }, { id: 'q2', title: 'Bai tap 2' }],
  });
  check('vi du 7 bai cua chu du an: dung thu tu, du so luong',
    path.map((p) => `${p.type}:${p.id}`).join(',') === 'quiz:q1,theory:t1,video:v1,video:v2,quiz:q2,theory:t2,video:v3',
    path.map((p) => `${p.type}:${p.id}`));
  check('di het luong 7 bai bang next',
    (() => {
      let cur: any = path[0];
      const seen = [cur.id];
      for (let i = 0; i < 6; i++) {
        cur = nextFlowItem(path, cur.type, cur.id);
        if (!cur) break;
        seen.push(cur.id);
      }
      return seen.join(',') === 'q1,t1,v1,v2,q2,t2,v3';
    })());
}
console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
