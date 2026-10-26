import {
  AnalyticsFilter,
  RadarMasteryItem,
  HeatmapCell,
  WeakSkillRecommendation,
} from './types.ts';
import { StudentState, SkillLevel } from '../types.ts';
import { StudentAccount, TopicWithMeta } from '../services/types.ts';
import { filterStudents, filterStudentStates, filterQuestionResults, getFilterDateRange } from './filterUtils.ts';
import { calculateLevelMastery, calculateAllMastery, SKILL_METADATA } from '../logic/mastery.ts';

/**
 * Biểu đồ radar 4 mức Nhớ được – Hiểu được – Phân tích được – Vận dụng được
 */
export function computeClassRadarMastery(
  allStates: Record<string, StudentState>,
  allStudents: StudentAccount[],
  filter: AnalyticsFilter
): RadarMasteryItem[] {
  const students = filterStudents(allStudents, filter);
  const studentIds = new Set(students.map((s) => s.id));
  const states = filterStudentStates(allStates, studentIds);
  const dateRange = getFilterDateRange(filter);

  let allResults: any[] = [];
  Object.values(states).forEach((st) => {
    allResults = allResults.concat(filterQuestionResults(st.questionResults || [], filter, dateRange));
  });

  const levels: SkillLevel[] = ['NHAN_BIET', 'THONG_HIEU', 'PHAN_TICH', 'VAN_DUNG'];

  // Nếu có chọn đúng 1 học sinh
  let selectedStudentResults: any[] | null = null;
  if (filter.studentIds && filter.studentIds.length === 1) {
    const singleState = allStates[filter.studentIds[0]];
    if (singleState) {
      selectedStudentResults = filterQuestionResults(singleState.questionResults || [], filter, dateRange);
    }
  }

  return levels.map((lvl) => {
    const classMastery = calculateLevelMastery(allResults, lvl);
    const meta = SKILL_METADATA[lvl];

    let selectedStudentScore: number | undefined = undefined;
    if (selectedStudentResults) {
      const studentMastery = calculateLevelMastery(selectedStudentResults, lvl);
      selectedStudentScore = studentMastery.percentage;
    }

    return {
      level: lvl,
      levelName: meta.displayName,
      classAverage: classMastery.percentage ?? 0,
      targetGoal: 80, // Mục tiêu chuẩn sư phạm 80%
      selectedStudentScore,
    };
  });
}

/**
 * Bản đồ nhiệt (Heatmap) Học sinh × Chủ đề
 */
export function computeStudentTopicHeatmap(
  allStates: Record<string, StudentState>,
  allStudents: StudentAccount[],
  topics: TopicWithMeta[],
  filter: AnalyticsFilter,
  allClasses?: { id: string; name: string }[]
): HeatmapCell[] {
  const students = filterStudents(allStudents, filter);
  const cells: HeatmapCell[] = [];

  students.forEach((s) => {
    const state = allStates[s.id];
    const qList = state?.questionResults || [];
    const className = allClasses?.find((c) => c.id === s.class_id)?.name || '—';

    topics.forEach((top) => {
      // Bỏ qua nếu lọc riêng 1 topic khác
      if (filter.topicId && filter.topicId !== 'all' && top.id !== filter.topicId) {
        return;
      }

      const topQuestions = qList.filter((q) => q.topicId === top.id);
      const mastery = calculateAllMastery(topQuestions, top.id);

      // Tính tổng hợp trạng thái của chủ đề này
      const levels = Object.values(mastery);
      const avgPercentage = levels.length === 0 ? 0 : Math.round(levels.reduce((acc, l) => acc + l.percentage, 0) / levels.length);

      let status = mastery.PHAN_TICH.status;
      let statusLabel = mastery.PHAN_TICH.statusLabel;

      if (topQuestions.length < 3) {
        status = 'INSUFFICIENT_DATA';
        statusLabel = `Chưa đủ dữ liệu (${topQuestions.length}/3 câu)`;
      } else if (avgPercentage >= 78) {
        status = 'SOLID';
        statusLabel = 'Vững vàng';
      } else if (avgPercentage >= 58) {
        status = 'PROGRESSING';
        statusLabel = 'Đang tiến bộ';
      } else {
        status = 'NEEDS_REVIEW';
        statusLabel = 'Cần ôn lại';
      }

      cells.push({
        studentId: s.id,
        studentName: s.name,
        className,
        topicId: top.id,
        topicTitle: top.title,
        status,
        percentage: avgPercentage,
        statusLabel,
        attemptCount: topQuestions.length,
      });
    });
  });

  return cells;
}

/**
 * Danh sách "mức năng lực yếu nhất của lớp" theo chủ đề kèm khuyến nghị hành động
 */
export function computeWeakestSkillsByTopic(
  allStates: Record<string, StudentState>,
  topics: TopicWithMeta[]
): WeakSkillRecommendation[] {
  const list: WeakSkillRecommendation[] = [];

  topics.forEach((top) => {
    let topResults: any[] = [];
    Object.values(allStates).forEach((st) => {
      topResults = topResults.concat((st.questionResults || []).filter((q) => q.topicId === top.id));
    });

    const mAnalyze = calculateLevelMastery(topResults, 'PHAN_TICH', top.id);
    const mApply = calculateLevelMastery(topResults, 'VAN_DUNG', top.id);
    const mUnderstand = calculateLevelMastery(topResults, 'THONG_HIEU', top.id);

    // Tìm mức thấp nhất
    let weakest: any = mAnalyze;
    if (mApply.percentage < weakest.percentage) weakest = mApply;
    if (mUnderstand.percentage < weakest.percentage) weakest = mUnderstand;

    let advice = `Khuyến nghị: Tăng cường các câu hỏi gợi mở, hướng dẫn học sinh tìm từ ngữ nghệ thuật trước khi viết đoạn văn ở chủ đề "${top.title}".`;
    if (top.id === 'topic_tho_bon_nam') {
      advice = 'Khuyến nghị: Cân nhắc giao thêm phiếu bài tập phân tích cách hiệp vần và ngắt nhịp của thơ bốn chữ, năm chữ.';
    } else if (top.id === 'topic_tu_lay_so_sanh') {
      advice = 'Khuyến nghị: Tổ chức trò chơi ghép vế so sánh A và B để học sinh hiểu sâu hơn về tính gợi hình.';
    }

    list.push({
      topicId: top.id,
      topicTitle: top.title,
      weakestLevel: weakest.level,
      levelName: weakest.displayName,
      averagePercentage: weakest.percentage ?? 0,
      studentWeakCount: (() => {
        // Đếm học sinh có làm bài ở chủ đề này nhưng điểm TB < 50% (dữ liệu thật)
        let weak = 0;
        Object.values(allStates).forEach((st) => {
          const rs = (st.questionResults || []).filter((q) => q.topicId === top.id);
          if (rs.length > 0) {
            const avg = rs.reduce((sum, r) => sum + (r.scoreRatio || 0), 0) / rs.length;
            if (avg < 0.5) weak++;
          }
        });
        return weak;
      })(),
      pedagogicalAdvice: advice,
    });
  });

  return list;
}

export interface MasteryDistributionItem {
  levelName: string;
  vungPct: number;
  dangTienBoPct: number;
  canOnLaiPct: number;
  chuaDuDuLieuPct: number;
}

/**
 * Phân bổ trạng thái Mastery của lớp theo 4 mức năng lực (Stacked BarChart)
 */
export function computeMasteryDistribution(
  allStates: Record<string, StudentState>,
  allStudents: StudentAccount[],
  filter: AnalyticsFilter
): MasteryDistributionItem[] {
  const students = filterStudents(allStudents, filter);
  const studentIds = new Set(students.map((s) => s.id));
  const states = filterStudentStates(allStates, studentIds);

  const levels: SkillLevel[] = ['NHAN_BIET', 'THONG_HIEU', 'PHAN_TICH', 'VAN_DUNG'];
  const total = Math.max(1, students.length);

  return levels.map((lvl) => {
    let vung = 0;
    let dangTienBo = 0;
    let canOnLai = 0;
    let chuaDu = 0;

    students.forEach((s) => {
      const st = states[s.id];
      if (!st || !st.questionResults || st.questionResults.length < 3) {
        chuaDu++;
      } else {
        const m = calculateLevelMastery(st.questionResults, lvl);
        if (m.percentage >= 75) vung++;
        else if (m.percentage >= 50) dangTienBo++;
        else canOnLai++;
      }
    });

    const meta = SKILL_METADATA[lvl];
    return {
      levelName: meta.displayName,
      vungPct: Math.round((vung / total) * 100),
      dangTienBoPct: Math.round((dangTienBo / total) * 100),
      canOnLaiPct: Math.round((canOnLai / total) * 100),
      chuaDuDuLieuPct: Math.round((chuaDu / total) * 100),
    };
  });
}
