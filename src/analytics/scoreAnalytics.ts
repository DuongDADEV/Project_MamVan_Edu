import {
  AnalyticsFilter,
  ScoreDistributionBucket,
  TopicScoreComparison,
  TypeScoreComparison,
  WeeklyScoreTrend,
  ClassComparisonItem,
  StudentRankingRow,
} from './types.ts';
import { StudentState, QuestionResult } from '../types.ts';
import { StudentAccount, TopicWithMeta, ClassItem } from '../services/types.ts';
import { getFilterDateRange, filterStudents, filterStudentStates, filterQuestionResults } from './filterUtils.ts';
import { calculateAllMastery } from '../logic/mastery.ts';

const ONE_WEEK = 7 * 86400000;

/**
 * Phân bố điểm số (Histogram: 0-4.9, 5.0-6.4, 6.5-7.9, 8.0-10)
 */
export function computeScoreDistribution(
  allStates: Record<string, StudentState>,
  allStudents: StudentAccount[],
  filter: AnalyticsFilter
): ScoreDistributionBucket[] {
  const students = filterStudents(allStudents, filter);
  const dateRange = getFilterDateRange(filter);

  let b1 = 0; // 0 - 4.9
  let b2 = 0; // 5.0 - 6.4
  let b3 = 0; // 6.5 - 7.9
  let b4 = 0; // 8.0 - 10
  let totalWithScores = 0;
  // Thành viên từng khoảng (24/10 — để công cụ trả kèm tên học sinh).
  const m1: { id: string; ten: string; diemTB: number }[] = [];
  const m2: { id: string; ten: string; diemTB: number }[] = [];
  const m3: { id: string; ten: string; diemTB: number }[] = [];
  const m4: { id: string; ten: string; diemTB: number }[] = [];

  students.forEach((s) => {
    const st = allStates[s.id];
    let totalScore = 0;
    let attemptCount = 0;

    if (st) {
      const qList = filterQuestionResults(st.questionResults || [], filter, dateRange);
      qList.forEach((q) => {
        totalScore += q.scoreRatio * 10;
        attemptCount++;
      });

      // Thêm điểm bài viết tự luận nếu có
      (st.essaySubmissions || []).forEach((e) => {
        if (e.status === 'GRADED' && e.finalScore !== undefined) {
          totalScore += e.finalScore;
          attemptCount++;
        }
      });
    }

    if (attemptCount > 0) {
      totalWithScores++;
      const avgScore = Math.round((totalScore / attemptCount) * 10) / 10;
      const member = { id: s.id, ten: s.name, diemTB: avgScore };
      if (avgScore < 5.0) { b1++; m1.push(member); }
      else if (avgScore < 6.5) { b2++; m2.push(member); }
      else if (avgScore < 8.0) { b3++; m3.push(member); }
      else { b4++; m4.push(member); }
    }
  });

  if (totalWithScores === 0) {
    return [
      { rangeLabel: '0 – 4.9 (Cần cố gắng)', count: 0, percentage: 0, color: '#E2704A', hocSinh: [] },
      { rangeLabel: '5.0 – 6.4 (Trung bình)', count: 0, percentage: 0, color: '#F59E0B', hocSinh: [] },
      { rangeLabel: '6.5 – 7.9 (Khá)', count: 0, percentage: 0, color: '#3B82F6', hocSinh: [] },
      { rangeLabel: '8.0 – 10 (Giỏi)', count: 0, percentage: 0, color: '#10B981', hocSinh: [] },
    ];
  }

  const byScoreDesc = (a: { diemTB: number }, b: { diemTB: number }) => b.diemTB - a.diemTB;
  return [
    { rangeLabel: '0 – 4.9 (Cần cố gắng)', count: b1, percentage: Math.round((b1 / totalWithScores) * 100), color: '#E2704A', hocSinh: m1.sort(byScoreDesc) },
    { rangeLabel: '5.0 – 6.4 (Trung bình)', count: b2, percentage: Math.round((b2 / totalWithScores) * 100), color: '#F59E0B', hocSinh: m2.sort(byScoreDesc) },
    { rangeLabel: '6.5 – 7.9 (Khá)', count: b3, percentage: Math.round((b3 / totalWithScores) * 100), color: '#3B82F6', hocSinh: m3.sort(byScoreDesc) },
    { rangeLabel: '8.0 – 10 (Giỏi)', count: b4, percentage: Math.round((b4 / totalWithScores) * 100), color: '#10B981', hocSinh: m4.sort(byScoreDesc) },
  ];
}

/**
 * Điểm trung bình theo chủ đề
 */
export function computeAvgScoreByTopic(
  allStates: Record<string, StudentState>,
  topics: TopicWithMeta[],
  filter: AnalyticsFilter
): TopicScoreComparison[] {
  const dateRange = getFilterDateRange(filter);
  const result: TopicScoreComparison[] = [];

  topics.forEach((t) => {
    let sumScore = 0;
    let count = 0;
    let passCount = 0;

    Object.values(allStates).forEach((st) => {
      const qList = (st.questionResults || []).filter((q) => q.topicId === t.id && q.timestamp >= dateRange[0] && q.timestamp <= dateRange[1]);
      qList.forEach((q) => {
        sumScore += q.scoreRatio * 10;
        count++;
        if (q.scoreRatio >= 0.5) passCount++;
      });
    });

    const averageScore = count === 0 ? 0 : Math.round((sumScore / count) * 10) / 10;
    const passRate = count === 0 ? 0 : Math.round((passCount / count) * 100);

    result.push({
      topicId: t.id,
      topicTitle: t.title,
      averageScore,
      attemptCount: count,
      passRate,
    });
  });

  return result;
}

/**
 * Điểm trung bình theo loại bài học
 */
export function computeAvgScoreByType(
  allStates: Record<string, StudentState>,
  filter: AnalyticsFilter
): TypeScoreComparison[] {
  let practiceSum = 0, practiceCount = 0;
  let quickSum = 0, quickCount = 0;
  let masterySum = 0, masteryCount = 0;
  let essaySum = 0, essayCount = 0;

  Object.values(allStates).forEach((st) => {
    (st.questionResults || []).forEach((q) => {
      const score = q.scoreRatio * 10;
      if (q.questionId?.includes('practice')) {
        practiceSum += score;
        practiceCount++;
      } else if (q.questionId?.includes('mastery')) {
        masterySum += score;
        masteryCount++;
      } else {
        quickSum += score;
        quickCount++;
      }
    });
    (st.essaySubmissions || []).forEach((e) => {
      if (e.status === 'GRADED' && e.finalScore !== undefined) {
        essaySum += e.finalScore;
        essayCount++;
      }
    });
  });

  return [
    { typeKey: 'practice', typeName: 'Luyện tập sau lý thuyết', averageScore: practiceCount > 0 ? Math.round((practiceSum / practiceCount) * 10) / 10 : 0, totalAttempts: practiceCount },
    { typeKey: 'quiz_quick', typeName: 'Kiểm tra nhanh 7 phút', averageScore: quickCount > 0 ? Math.round((quickSum / quickCount) * 10) / 10 : 0, totalAttempts: quickCount },
    { typeKey: 'mastery_check', typeName: 'Mastery Check năng lực', averageScore: masteryCount > 0 ? Math.round((masterySum / masteryCount) * 10) / 10 : 0, totalAttempts: masteryCount },
    { typeKey: 'homework', typeName: 'Bài tập về nhà', averageScore: 0, totalAttempts: 0 },
    { typeKey: 'essay', typeName: 'Viết đoạn văn tự luận', averageScore: essayCount > 0 ? Math.round((essaySum / essayCount) * 10) / 10 : 0, totalAttempts: essayCount },
  ];
}

/**
 * Xu hướng điểm trung bình theo tuần qua 6 tuần
 */
export function computeWeeklyScoreTrends(
  allStates: Record<string, StudentState>,
  filter: AnalyticsFilter
): WeeklyScoreTrend[] {
  const now = Date.now();
  const trends: WeeklyScoreTrend[] = [];

  for (let w = 5; w >= 0; w--) {
    const weekStart = now - (w + 1) * ONE_WEEK;
    const weekEnd = now - w * ONE_WEEK;
    const weekLabel = `Tuần ${6 - w}`;

    // Điểm TB tuần tính từ TOÀN BỘ kết quả thật trong tuần — trước đây code
    // chia đôi theo 2 lớp demo '7A2'/'7A3' (mọi học sinh thật đều rơi vào
    // nhóm '7A3' bịa); đã bỏ hẳn cách chia đó.
    let sum = 0;
    let totalCount = 0;
    Object.values(allStates).forEach((st) => {
      (st.questionResults || []).forEach((q) => {
        if (q.timestamp >= weekStart && q.timestamp < weekEnd) {
          sum += q.scoreRatio * 10;
          totalCount++;
        }
      });
    });
    const overallAvg = totalCount === 0 ? 0 : Math.round((sum / totalCount) * 10) / 10;

    trends.push({
      weekLabel,
      weekTimestamp: weekStart,
      averageScore: overallAvg,
      attemptCount: totalCount,
    });
  }

  return trends;
}

/**
 * So sánh giữa các lớp
 */
export function computeClassComparison(
  allStates: Record<string, StudentState>,
  students: StudentAccount[],
  classes: ClassItem[]
): ClassComparisonItem[] {
  return classes.map((c) => {
    const classStudents = students.filter((s) => s.class_id === c.id);
    let totalScore = 0;
    let scoreCount = 0;
    let passCount = 0;
    let totalMinutes = 0;

    classStudents.forEach((st) => {
      const state = allStates[st.id];
      if (state) {
        (state.questionResults || []).forEach((q) => {
          totalScore += q.scoreRatio * 10;
          scoreCount++;
          if (q.scoreRatio >= 0.5) passCount++;
        });
        // Phút học GHI THẬT (giây hôm nay + giây phiên liên tục) — bỏ phép
        // bịa "mỗi ngày điểm danh = 1800 giây" và phép chia 6 tuần vô căn cứ.
        totalMinutes += Math.round(((state.activeSecondsToday || 0) + (state.activeSecondsContinuous || 0)) / 60);
      }
    });

    return {
      classId: c.id,
      className: c.name,
      studentCount: classStudents.length,
      averageScore: scoreCount === 0 ? 0 : Math.round((totalScore / scoreCount) * 10) / 10,
      passRate: scoreCount === 0 ? 0 : Math.round((passCount / scoreCount) * 100),
      activeMinutesPerWeek: classStudents.length === 0 ? 0 : Math.round(totalMinutes / classStudents.length),
      solidMasteryRate: (() => {
        // Tỉ lệ học sinh của lớp đạt mức vững (điểm TB các câu đã làm >= 8/10), tính từ dữ liệu thật
        let solid = 0;
        let withData = 0;
        classStudents.forEach((stu: any) => {
          const st: any = (allStates as any)[stu.id];
          const results = st?.questionResults || [];
          if (results.length > 0) {
            withData++;
            const avg = results.reduce((sum: number, r: any) => sum + (r.scoreRatio || 0) * 10, 0) / results.length;
            if (avg >= 8) solid++;
          }
        });
        return withData === 0 ? 0 : Math.round((solid / withData) * 100);
      })(),
    };
  });
}

/**
 * Bảng xếp theo điểm dành cho giáo viên tham khảo chuyên môn
 */
export function computeStudentScoreRankings(
  allStates: Record<string, StudentState>,
  allStudents: StudentAccount[],
  filter: AnalyticsFilter,
  classes: { id: string; name: string }[] = []
): StudentRankingRow[] {
  const students = filterStudents(allStudents, filter);
  const dateRange = getFilterDateRange(filter);

  const rows: StudentRankingRow[] = students.map((s) => {
    const state = allStates[s.id];
    let totalScore = 0;
    let attemptCount = 0;

    if (state) {
      const qList = filterQuestionResults(state.questionResults || [], filter, dateRange);
      qList.forEach((q) => {
        totalScore += q.scoreRatio * 10;
        attemptCount++;
      });
    }

    const averageScore = attemptCount === 0 ? 0 : Math.round((totalScore / attemptCount) * 10) / 10;
    const masteryStatus = averageScore >= 8.0 ? 'SOLID' : averageScore >= 5.5 ? 'PROGRESSING' : 'NEEDS_REVIEW';
    const statusLabel = averageScore >= 8.0 ? 'Vững' : averageScore >= 5.5 ? 'Đang tiến bộ' : 'Cần ôn lại';
    // Phút học GHI THẬT trong state — không cộng 1800 giây/ngày điểm danh (số bịa).
    const activeMinutesTotal = Math.round(((state?.activeSecondsToday || 0) + (state?.activeSecondsContinuous || 0)) / 60);

    return {
      rank: 1,
      studentId: s.id,
      studentName: s.name,
      // Tên lớp THẬT: tra trong danh sách lớp của giáo viên; không có thì
      // lấy khối/lớp ghi trong hồ sơ của chính học sinh; tuyệt đối không
      // gán nhãn lớp bịa theo kiểu thời demo ('7A2'/'7A3').
      className:
        classes.find((c) => c.id === s.class_id)?.name ||
        (state?.profile?.grade ? state.profile.grade.replace(/^Lớp\s*/i, '') : '—'),
      studentCode: s.student_code || s.username.toUpperCase(),
      averageScore,
      totalAttempts: attemptCount,
      masteryStatus,
      statusLabel,
      activeMinutesTotal,
      totalXp: state?.totalXp || 0,
    };
  });

  // Sắp xếp theo điểm giảm dần và gán thứ hạng
  rows.sort((a, b) => b.averageScore - a.averageScore || b.totalXp - a.totalXp);
  rows.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return rows;
}
