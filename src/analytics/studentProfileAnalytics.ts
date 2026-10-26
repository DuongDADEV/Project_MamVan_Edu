import {
  StudentProfileFullData,
  RadarMasteryItem,
  AnalyticsFilter,
} from './types.ts';
import { StudentState, SkillLevel, Question } from '../types.ts';
import { StudentAccount, TopicWithMeta } from '../services/types.ts';
import { calculateLevelMastery, calculateAllMastery, SKILL_METADATA } from '../logic/mastery.ts';

const ONE_WEEK = 7 * 86400000;

export function computeStudentProfileData(
  studentId: string,
  allStates: Record<string, StudentState>,
  allStudents: StudentAccount[],
  topics: TopicWithMeta[],
  filter?: AnalyticsFilter,
  allClasses?: { id: string; name: string }[],
  // Ngân hàng câu hỏi THẬT (từ máy chủ) để tra nội dung/đáp án — không còn
  // ngân hàng mẫu; tra không thấy thì ghi rõ thay vì bịa số liệu.
  questions?: Record<string, Question>
): StudentProfileFullData | null {
  const account = allStudents.find((s) => s.id === studentId);
  const state = allStates[studentId];
  if (!account || !state) return null;

  const className = allClasses?.find((c) => c.id === account.class_id)?.name || '—';
  const classStudents = allStudents.filter((s) => s.class_id === account.class_id);

  // Tính xếp hạng trong lớp
  let rank = 1;
  const myTotalXp = state.totalXp || 0;
  classStudents.forEach((cs) => {
    const csState = allStates[cs.id];
    if (csState && (csState.totalXp || 0) > myTotalXp) {
      rank++;
    }
  });

  // Radar 4 mức so với lớp
  const levels: SkillLevel[] = ['NHAN_BIET', 'THONG_HIEU', 'PHAN_TICH', 'VAN_DUNG'];
  const myResults = state.questionResults || [];

  const radarScores: RadarMasteryItem[] = levels.map((lvl) => {
    const myMastery = calculateLevelMastery(myResults, lvl);
    const meta = SKILL_METADATA[lvl];

    // Tính trung bình lớp
    let classSum = 0;
    let classCount = 0;
    classStudents.forEach((cs) => {
      const cst = allStates[cs.id];
      if (cst) {
        const cm = calculateLevelMastery(cst.questionResults || [], lvl);
        classSum += cm.percentage;
        classCount++;
      }
    });

    const classAverage = classCount === 0 ? 70 : Math.round(classSum / classCount);

    return {
      level: lvl,
      levelName: meta.displayName,
      classAverage,
      targetGoal: 80,
      selectedStudentScore: myMastery.percentage,
    };
  });

  // Tiến độ từng chủ đề
  const topicMasteryList = topics.map((top) => {
    const topResults = myResults.filter((r) => r.topicId === top.id);
    const m = calculateAllMastery(topResults, top.id);
    const avgP = Math.round((m.NHAN_BIET.percentage + m.THONG_HIEU.percentage + m.PHAN_TICH.percentage + m.VAN_DUNG.percentage) / 4);

    let status = m.PHAN_TICH.status;
    if (topResults.length < 3) status = 'INSUFFICIENT_DATA';
    else if (avgP >= 78) status = 'SOLID';
    else if (avgP >= 58) status = 'PROGRESSING';
    else status = 'NEEDS_REVIEW';

    const completedStepCount = (state.completedSteps || []).filter((s) => s.includes(top.id)).length;

    return {
      topicId: top.id,
      topicTitle: top.title,
      status,
      percentage: avgP,
      completedStepCount,
    };
  });

  // Lịch sử bài làm chi tiết
  const attemptHistory = myResults
    .slice(-15)
    .reverse()
    .map((r, i) => {
      const qDef = questions?.[r.questionId];
      const top = topics.find((t) => t.id === r.topicId);
      const isPass = r.scoreRatio >= 0.5;

      return {
        id: `att_${r.questionId}_${i}`,
        timestamp: r.timestamp,
        quizTitle: top?.title ? `Kiểm tra năng lực: ${top.title}` : 'Bài kiểm tra theo chủ đề',
        topicTitle: top?.title || 'Chủ đề',
        score: Math.round(r.scoreRatio * 10 * 10) / 10,
        maxScore: 10,
        isPass,
        level: r.level,
        // Hệ thống KHÔNG lưu đáp án học sinh đã chọn trong kết quả làm bài —
        // tuyệt đối không suy diễn/bịa lựa chọn; chỉ hiện đáp án đúng khi tra
        // được câu hỏi thật trong ngân hàng máy chủ.
        questionPrompt: qDef?.prompt || 'Câu hỏi không còn trong ngân hàng',
        selectedAnswer: undefined,
        correctAnswer: qDef
          ? Array.isArray((qDef as any).answer)
            ? (qDef as any).answer.join(', ')
            : (qDef as any).answer
          : undefined,
      };
    });

  // Hoạt động theo 6 tuần: chỉ đếm ngày điểm danh THẬT trong tuần.
  // (Trước đây nhân cứng 32 phút/ngày thành "phút học" — số bịa; hệ thống
  // không lưu phút học theo tuần nên không hiển thị chỉ số đó.)
  const now = Date.now();
  const weeklyActivity: { weekLabel: string; daysAttended: number }[] = [];

  for (let w = 5; w >= 0; w--) {
    const wStart = now - (w + 1) * ONE_WEEK;
    const wEnd = now - w * ONE_WEEK;

    const daysAttended = (state.attendanceHistory || []).filter((d) => {
      const t = new Date(d).getTime();
      return t >= wStart && t < wEnd;
    }).length;

    weeklyActivity.push({
      weekLabel: `Tuần ${6 - w}`,
      daysAttended,
    });
  }

  return {
    account,
    state,
    className,
    rankInClass: rank,
    totalStudentsInClass: classStudents.length,
    radarScores,
    topicMasteryList,
    attemptHistory,
    weeklyActivity,
    teacherNote: (state as any).teacherNotes || 'Chưa có ghi chú riêng từ giáo viên.',
  };
}
