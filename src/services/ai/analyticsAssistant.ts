/**
 * TRỢ LÝ PHÂN TÍCH HỌC TẬP (Gemini Function Calling)
 *
 * Nguyên tắc cứng (theo yêu cầu chủ dự án 22/10):
 * - MỌI con số do CODE HỆ THỐNG tính từ dữ liệu thật (dùng chung các hàm
 *   tính của mục Phân tích) — mô hình AI chỉ chọn công cụ, diễn đạt kết quả
 *   và đề xuất bước tiếp theo. AI không tự sinh số.
 * - Công cụ chỉ đọc dữ liệu thuộc phạm vi giáo viên đang đăng nhập (dữ liệu
 *   truyền vào đã được cổng giáo viên lọc theo chủ sở hữu).
 * - Biểu đồ: AI chỉ được KHAI BÁO (loại/tựa/trục) qua công cụ render_chart;
 *   số liệu vẽ lấy nguyên văn từ kết quả công cụ đã chạy — AI không chạm
 *   vào dữ liệu điểm.
 */

import { getGeminiApiKey, getGeminiModel } from './index.ts';
import { StudentState, EssaySubmission, RewardRequest, Question } from '../../types.ts';
import { StudentAccount, ClassItem } from '../types.ts';
import { AnalyticsFilter } from '../../analytics/types.ts';
import {
  computeOverviewMetrics,
  detectStudentsNeedingAttention,
} from '../../analytics/metricsEngine.ts';
import {
  computeScoreDistribution,
  computeAvgScoreByTopic,
  computeStudentScoreRankings,
} from '../../analytics/scoreAnalytics.ts';
import { computeQuestionAnalytics } from '../../analytics/questionAnalytics.ts';
import { computeStudentProfileData } from '../../analytics/studentProfileAnalytics.ts';
import {
  computeWeeklyAttendance,
  computeDailyALT,
} from '../../analytics/engagementAnalytics.ts';
import {
  filterStudents,
  filterQuestionResults,
  getFilterDateRange,
} from '../../analytics/filterUtils.ts';
import {
  getSessionsSummary,
  getAssignmentsProgress,
} from '../supabase/biRepository.ts';

export interface AssistantContext {
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  classes: ClassItem[];
  topics: { id: string; title: string; videoIds?: string[]; theoryId?: string }[];
  quizzes?: { id: string; topicId?: string }[];
  essays: EssaySubmission[];
  rewards: RewardRequest[];
  questions: Record<string, Question>;
  filters: AnalyticsFilter;
  teacherId?: string;
}

export interface AssistantToolRun {
  name: string;
  label: string;
  evidence: string;
}

export interface AssistantChart {
  type: 'bar' | 'line';
  title: string;
  rows: Record<string, any>[];
  xKey: string;
  yKey: string;
  yLabel: string;
}

export interface AssistantReply {
  text: string;
  toolRuns: AssistantToolRun[];
  chart?: AssistantChart;
  followups: string[];
}

const TOOL_LABELS: Record<string, string> = {
  get_class_summary: 'Tổng quan lớp',
  compare_topics: 'So sánh chủ đề',
  get_score_distribution: 'Phổ điểm',
  get_question_analysis: 'Phân tích câu hỏi',
  get_student_profile: 'Hồ sơ học sinh',
  get_learning_activity: 'Hoạt động học tập',
};

const norm = (x?: string) =>
  (x || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

function periodLabel(f: AnalyticsFilter): string {
  switch (f.timeRange) {
    case '7d':
      return '7 ngày gần nhất';
    case '30d':
      return '30 ngày gần nhất';
    case 'this_week':
      return 'tuần này';
    case 'custom':
      return 'khoảng thời gian tùy chọn';
    default:
      return '6 tuần gần nhất';
  }
}

function effectiveFilter(ctx: AssistantContext, args: any): AnalyticsFilter {
  const f: AnalyticsFilter = { ...ctx.filters };
  if (
    args?.timeRange &&
    ['7d', '30d', 'this_week', '6w'].includes(args.timeRange)
  ) {
    f.timeRange = args.timeRange;
  }
  if (args?.className) {
    const c = ctx.classes.find(
      (c) =>
        norm(c.name).includes(norm(args.className)) ||
        norm(args.className).includes(norm(c.name))
    );
    if (c) f.classIds = [c.id];
  }
  if (args?.topicName) {
    const t = ctx.topics.find(
      (t) =>
        norm(t.title).includes(norm(args.topicName)) ||
        norm(args.topicName).includes(norm(t.title))
    );
    if (t) f.topicId = t.id;
  }
  return f;
}

function sampleInfo(ctx: AssistantContext, f: AnalyticsFilter): string {
  const students = filterStudents(ctx.students, f);
  const range = getFilterDateRange(f);
  let results = 0;
  students.forEach((s) => {
    results += filterQuestionResults(
      ctx.studentStates[s.id]?.questionResults || [],
      f,
      range
    ).length;
  });
  return `${students.length} học sinh · ${results} lượt trả lời câu hỏi · kỳ ${periodLabel(f)}`;
}

interface ToolOutcome {
  data: any;
  evidence: string;
  series?: {
    rows: Record<string, any>[];
    xKey: string;
    yKey: string;
    yLabel: string;
    defaultType: 'bar' | 'line';
  };
}

async function executeTool(
  name: string,
  args: any,
  ctx: AssistantContext
): Promise<ToolOutcome> {
  const f = effectiveFilter(ctx, args);
  const evidence = sampleInfo(ctx, f);

  switch (name) {
    case 'get_class_summary': {
      const overview = computeOverviewMetrics(
        ctx.studentStates,
        ctx.students,
        f,
        ctx.essays,
        ctx.rewards,
        { topics: ctx.topics, quizzes: ctx.quizzes }
      );
      const rankings = computeStudentScoreRankings(
        ctx.studentStates,
        ctx.students,
        f,
        ctx.classes
      );
      const withAttempts = rankings.filter((r) => r.totalAttempts > 0);
      const pick = (r: (typeof rankings)[number]) => ({
        hoTen: r.studentName,
        lop: r.className,
        diemTB: r.averageScore,
        soLuotLam: r.totalAttempts,
        tongXP: r.totalXp,
      });
      const attention = detectStudentsNeedingAttention(
        ctx.studentStates,
        ctx.students,
        ctx.topics as any,
        f,
        ctx.classes as any
      )
        .slice(0, 8)
        .map((a) => ({
          hoTen: a.studentName,
          lyDo: a.reasonDetail,
          nhanLyDo: a.reasonTag,
          goiYHanhDong: a.suggestedAction,
        }));
      const pendingEssays = ctx.essays.filter(
        (e) => e.status === 'PENDING_TEACHER' || e.status === 'AI_SUGGESTED'
      ).length;
      return {
        evidence,
        data: {
          cacLop: ctx.classes.map((c) => c.name),
          tongHocSinh: filterStudents(ctx.students, f).length,
          hocSinhHoatDong7Ngay: overview.active7DaysCount,
          tyLeHoanThanhBaiHoc: overview.completionRatePercent,
          diemTrungBinhLop: overview.averageScore,
          phutHocTichCucTB: overview.avgActiveMinutes,
          baiTuLuanChoCham: pendingEssays,
          yeuCauQuaChoDuyet: overview.pendingRewardCount,
          hocSinhDiemCaoNhat: [...withAttempts]
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, 3)
            .map(pick),
          hocSinhDiemThapNhat: [...withAttempts]
            .sort((a, b) => a.averageScore - b.averageScore)
            .slice(0, 3)
            .map(pick),
          hocSinhCanChuY: attention,
        },
      };
    }

    case 'compare_topics': {
      const rows = computeAvgScoreByTopic(ctx.studentStates, ctx.topics as any, f)
        .slice()
        .sort((a, b) => b.averageScore - a.averageScore);
      const seriesRows = rows.map((r) => ({
        chuDe: r.topicTitle,
        diemTB: r.averageScore,
        luotLam: r.attemptCount,
        tyLeDat: r.passRate,
      }));
      return {
        evidence,
        data: {
          danhSach: seriesRows,
          chuDeManhNhat: seriesRows[0] || null,
          chuDeYeuNhat:
            seriesRows.filter((r) => r.luotLam > 0).slice(-1)[0] || null,
        },
        series: {
          rows: seriesRows,
          xKey: 'chuDe',
          yKey: 'diemTB',
          yLabel: 'Điểm TB',
          defaultType: 'bar',
        },
      };
    }

    case 'get_score_distribution': {
      const buckets = computeScoreDistribution(ctx.studentStates, ctx.students, f);
      const rows = buckets.map((b) => ({
        khoangDiem: b.rangeLabel,
        soHocSinh: b.count,
        phanTram: b.percentage,
      }));
      return {
        evidence,
        data: {
          cacKhoang: rows,
          tongHocSinhCoDiem: rows.reduce((s, r) => s + r.soHocSinh, 0),
        },
        series: {
          rows,
          xKey: 'khoangDiem',
          yKey: 'soHocSinh',
          yLabel: 'Số học sinh',
          defaultType: 'bar',
        },
      };
    }

    case 'get_question_analysis': {
      const items = computeQuestionAnalytics(
        ctx.studentStates,
        ctx.questions,
        ctx.topics as any,
        f
      );
      const attempted = items.filter((i) => i.totalAttempts > 0);
      const focus = args?.focus || 'flagged';
      const sorted = [...attempted].sort((a, b) => {
        if (focus === 'hardest') return a.accuracyRate - b.accuracyRate;
        if (focus === 'most_attempts') return b.totalAttempts - a.totalAttempts;
        const af = a.flag ? 0 : 1;
        const bf = b.flag ? 0 : 1;
        return af - bf || a.accuracyRate - b.accuracyRate;
      });
      const limit = Math.min(20, Math.max(1, Number(args?.limit) || 10));
      return {
        evidence,
        data: {
          tongCauTrongNganHang: items.length,
          cauDaCoLuotLam: attempted.length,
          danhSach: sorted.slice(0, limit).map((i) => ({
            cauHoi: (i.prompt || '').slice(0, 140),
            chuDe: i.topicTitle,
            mucNangLuc: i.level,
            luotLam: i.totalAttempts,
            tyLeDung: i.accuracyRate,
            canhBao: i.flagLabel || null,
          })),
        },
      };
    }

    case 'get_student_profile': {
      const query = norm(args?.studentName);
      if (!query) {
        return { evidence, data: { found: false, lyDo: 'Chưa rõ tên học sinh cần xem.' } };
      }
      const matches = ctx.students.filter((s) => norm(s.name).includes(query));
      if (matches.length === 0) {
        return {
          evidence,
          data: {
            found: false,
            lyDo: 'Không tìm thấy học sinh có tên này trong các lớp của giáo viên.',
          },
        };
      }
      if (matches.length > 1) {
        return {
          evidence,
          data: {
            found: false,
            lyDo: 'Có nhiều học sinh trùng tên, cần nói rõ hơn.',
            ungVien: matches.map((m) => m.name),
          },
        };
      }
      const student = matches[0];
      const profile = computeStudentProfileData(
        student.id,
        ctx.studentStates,
        ctx.students,
        ctx.topics as any,
        f,
        ctx.classes as any,
        ctx.questions
      );
      if (!profile) {
        return { evidence, data: { found: false, lyDo: 'Học sinh chưa có dữ liệu học tập.' } };
      }
      return {
        evidence,
        data: {
          found: true,
          hoTen: profile.account.name,
          lop: profile.className,
          hangTrongLop: `${profile.rankInClass}/${profile.totalStudentsInClass}`,
          tongXP: profile.state.totalXp,
          nangLucTheoMuc: profile.radarScores.map((r) => ({
            muc: r.levelName,
            diemPhanTram: r.selectedStudentScore ?? null,
          })),
          tienDoChuDe: profile.topicMasteryList.map((t) => ({
            chuDe: t.topicTitle,
            phanTramHoanThanh: t.percentage,
            trangThai: t.status,
          })),
          lichSuLamBai: {
            tongLuot: profile.attemptHistory.length,
            ganNhat: profile.attemptHistory.slice(0, 5).map((h) => ({
              bai: h.quizTitle,
              chuDe: h.topicTitle,
              diem: `${h.score}/${h.maxScore}`,
              dat: h.isPass,
            })),
          },
          hoatDongTuan: profile.weeklyActivity.map((w) => ({
            tuan: w.weekLabel,
            ngayDiemDanh: w.daysAttended,
          })),
        },
      };
    }

    case 'get_learning_activity': {
      const attendance = computeWeeklyAttendance(ctx.studentStates, f);
      const alt = computeDailyALT(ctx.studentStates, ctx.students, f);
      const last7Alt = alt.slice(-7);
      // Trung bình số học sinh có điểm danh mỗi ngày trong 7 ngày qua (số thật
      // từ attendanceHistory — hệ thống không lưu phút học theo ngày).
      const avgActiveStudents =
        last7Alt.length === 0
          ? 0
          : Math.round(
              (last7Alt.reduce((s, p) => s + p.studentActiveCount, 0) / last7Alt.length) * 10
            ) / 10;
      const scopedIds = filterStudents(ctx.students, f).map((s) => s.id);
      let sessions: any = null;
      let assignments: any = null;
      try {
        const sum = await getSessionsSummary(scopedIds);
        sessions = {
          phienDangNhap7NgayQua: sum.activeLast7,
          phienDangNhap7NgayTruoc: sum.activePrev7,
          soNgayCoHoatDong: sum.perDay.filter((d) => d.count > 0).length,
        };
      } catch {
        sessions = null;
      }
      if (ctx.teacherId) {
        try {
          const list = await getAssignmentsProgress(ctx.teacherId, scopedIds);
          assignments = list.map((a) => ({
            bai: a.title,
            soCau: a.questionCount,
            daNop: `${a.submittedCount}/${a.targets.length} học sinh`,
          }));
        } catch {
          assignments = null;
        }
      }
      const seriesRows = attendance.map((p) => ({
        tuan: p.weekLabel,
        tyLeDiemDanh: p.attendanceRate,
      }));
      return {
        evidence,
        data: {
          diemDanh6Tuan: seriesRows,
          hocSinhHoatDongTBNgay7NgayQua: avgActiveStudents,
          phienDangNhap: sessions,
          baiTapDaGiao: assignments,
        },
        series: {
          rows: seriesRows,
          xKey: 'tuan',
          yKey: 'tyLeDiemDanh',
          yLabel: 'Tỉ lệ điểm danh (%)',
          defaultType: 'line',
        },
      };
    }

    default:
      return { evidence, data: { error: `Không có công cụ ${name}` } };
  }
}

const TIME_RANGE_PARAM = {
  type: 'STRING',
  enum: ['7d', '30d', 'this_week', '6w'],
  description: 'Khoảng thời gian phân tích; bỏ trống = dùng bộ lọc chung của trang (mặc định 6 tuần).',
};

const FUNCTION_DECLARATIONS: any[] = [
  {
    name: 'get_class_summary',
    description:
      'Tổng quan lớp: sĩ số, học sinh hoạt động 7 ngày, tỉ lệ hoàn thành, điểm trung bình, bài tự luận chờ chấm, học sinh điểm cao/thấp nhất và học sinh cần chú ý.',
    parameters: {
      type: 'OBJECT',
      properties: {
        className: { type: 'STRING', description: 'Tên lớp (bỏ trống = tất cả lớp của giáo viên).' },
        timeRange: TIME_RANGE_PARAM,
      },
    },
  },
  {
    name: 'compare_topics',
    description: 'So sánh kết quả học tập giữa các chủ đề: điểm trung bình, lượt làm, tỉ lệ đạt của từng chủ đề.',
    parameters: {
      type: 'OBJECT',
      properties: {
        className: { type: 'STRING' },
        timeRange: TIME_RANGE_PARAM,
      },
    },
  },
  {
    name: 'get_score_distribution',
    description: 'Phổ điểm của lớp: số học sinh trong từng khoảng điểm (chưa đạt / trung bình / khá / giỏi).',
    parameters: {
      type: 'OBJECT',
      properties: {
        className: { type: 'STRING' },
        timeRange: TIME_RANGE_PARAM,
      },
    },
  },
  {
    name: 'get_question_analysis',
    description:
      'Phân tích từng câu hỏi trong ngân hàng: lượt làm, tỉ lệ đúng, cảnh báo quá khó / quá dễ / nghi sai đáp án.',
    parameters: {
      type: 'OBJECT',
      properties: {
        focus: {
          type: 'STRING',
          enum: ['flagged', 'hardest', 'most_attempts'],
          description: 'flagged = ưu tiên câu có cảnh báo; hardest = tỉ lệ đúng thấp nhất; most_attempts = nhiều lượt làm nhất.',
        },
        limit: { type: 'INTEGER', description: 'Số câu tối đa trả về (mặc định 10, tối đa 20).' },
        topicName: { type: 'STRING', description: 'Chỉ xem câu thuộc chủ đề này (bỏ trống = mọi chủ đề).' },
        timeRange: TIME_RANGE_PARAM,
      },
    },
  },
  {
    name: 'get_student_profile',
    description: 'Hồ sơ học tập của MỘT học sinh: hạng trong lớp, XP, năng lực theo mức, tiến độ từng chủ đề, lịch sử làm bài gần nhất.',
    parameters: {
      type: 'OBJECT',
      properties: {
        studentName: { type: 'STRING', description: 'Họ tên học sinh cần xem.' },
      },
      required: ['studentName'],
    },
  },
  {
    name: 'get_learning_activity',
    description:
      'Hoạt động học tập: tỉ lệ điểm danh 6 tuần, phút học trung bình mỗi ngày, phiên đăng nhập 7 ngày qua, tiến độ nộp các bài tập đã giao.',
    parameters: {
      type: 'OBJECT',
      properties: {
        className: { type: 'STRING' },
        timeRange: TIME_RANGE_PARAM,
      },
    },
  },
  {
    name: 'render_chart',
    description:
      'Vẽ biểu đồ từ dữ liệu của một công cụ vừa chạy. Chỉ dùng khi câu trả lời xoay quanh so sánh/phân bố/xu hướng. Số liệu lấy từ kết quả công cụ — không tự cung cấp số.',
    parameters: {
      type: 'OBJECT',
      properties: {
        chartType: { type: 'STRING', enum: ['bar', 'line'] },
        title: { type: 'STRING' },
        dataSource: {
          type: 'STRING',
          enum: [
            'get_class_summary',
            'compare_topics',
            'get_score_distribution',
            'get_question_analysis',
            'get_student_profile',
            'get_learning_activity',
          ],
        },
        xKey: { type: 'STRING', description: 'Khóa trục hoành đúng như trong dữ liệu công cụ (vd chuDe, khoangDiem, tuan).' },
        yKey: { type: 'STRING', description: 'Khóa trục tung đúng như trong dữ liệu công cụ (vd diemTB, soHocSinh, tyLeDiemDanh).' },
      },
      required: ['chartType', 'title', 'dataSource', 'xKey', 'yKey'],
    },
  },
];

const SYSTEM_PROMPT = `Bạn là Trợ lý phân tích học tập của Mầm Văn, hỗ trợ giáo viên Ngữ văn hiểu tình hình lớp học TỪ DỮ LIỆU THẬT của hệ thống.

QUY TẮC BẮT BUỘC:
1. Mọi con số trong câu trả lời PHẢI lấy từ kết quả công cụ — tuyệt đối không tự bịa số, không suy đoán số khi chưa gọi công cụ phù hợp.
2. Cần số liệu nào thì gọi công cụ tương ứng trước khi trả lời. Khi câu trả lời xoay quanh so sánh/phân bố/xu hướng và đã có dữ liệu, hãy gọi thêm render_chart để vẽ biểu đồ (dataSource = tên công cụ vừa cho dữ liệu; xKey/yKey phải là các khóa có thật trong dữ liệu đó).
3. Nếu dữ liệu cho thấy mẫu quá ít (0 lượt làm, 0 học sinh có điểm...), phải nói rõ "chưa đủ dữ liệu" và KHÔNG kết luận học sinh yếu/giỏi.
4. Nhận xét học sinh phải kèm bằng chứng cụ thể (lượt làm, điểm TB, khoảng thời gian). Không dán nhãn tiêu cực khi bằng chứng yếu.
5. QUYỀN HẠN (đợt sửa 24/10 — cô giao toàn quyền, không từ chối vì quyền nữa): bạn hành động với toàn quyền của giáo viên trong phạm vi dữ liệu của giáo viên đó — cô hỏi gì, làm nấy, không từ chối với lý do "không có quyền/không được phép" khi yêu cầu nằm trong dữ liệu của giáo viên. Việc nào đã có công cụ thì làm thẳng bằng công cụ; việc nào chưa có công cụ ghi thì chuẩn bị sẵn toàn bộ nội dung/bước làm để giáo viên bấm một lần là xong, tuyệt đối không bắt giáo viên tự làm lại từ đầu và không viện cớ quyền hạn để thoái thác.
5b. KHÔNG hỏi ngược lại kiểu "thầy/cô muốn xem lớp nào/chủ đề nào" khi câu hỏi không nêu cụ thể: bộ lọc chung hiện tại CHÍNH LÀ phạm vi trả lời (để "Tất cả các lớp" nghĩa là mọi lớp của giáo viên; giáo viên có thể chỉ quản lý đúng 1 lớp). Cứ gọi công cụ theo đúng bộ lọc hiện tại, trả lời luôn và ghi rõ phạm vi đã áp dụng. Chỉ hỏi lại khi câu hỏi thật sự không xác định được cần số liệu gì.
6. Trả lời tiếng Việt, ngắn gọn, rõ cấu trúc (đoạn ngắn hoặc gạch đầu dòng). Xưng "em", gọi người dùng là "thầy/cô".
7. Cuối MỖI câu trả lời, thêm một khối đúng định dạng sau (tối đa 3 câu hỏi gợi ý liên quan trực tiếp tới điều vừa phân tích):
GOI_Y:
- <câu hỏi gợi ý 1>
- <câu hỏi gợi ý 2>

Phạm vi dữ liệu: toàn bộ dữ liệu của giáo viên đang đăng nhập (các lớp/học sinh thuộc quyền quản lý của giáo viên đó) — đây là phạm vi toàn quyền của cô, không giới hạn thêm. Các công cụ chỉ trả về dữ liệu trong phạm vi này nên không bao giờ lộ dữ liệu của giáo viên khác. Mặc định áp dụng bộ lọc chung của trang Phân tích (6 tuần gần nhất) trừ khi giáo viên hỏi khoảng khác.`;

async function callGeminiWithTools(
  model: string,
  apiKey: string,
  contents: any[],
  withTools: boolean
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const generationConfig: any = { temperature: 0.2, maxOutputTokens: 4096 };
  // Tắt thinking trên các model flash như GeminiAIService đang làm — trả
  // lời phân tích nhanh hơn rõ rệt mà không đổi chất lượng số liệu.
  if (model.includes('flash')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const body: any = {
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig,
  };
  if (withTools) {
    body.tools = [{ functionDeclarations: FUNCTION_DECLARATIONS }];
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      msg = err?.error?.message || msg;
    } catch {}
    const err: any = new Error(msg);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

function parseFollowups(text: string): { text: string; followups: string[] } {
  const idx = text.indexOf('GOI_Y:');
  if (idx < 0) return { text: text.trim(), followups: [] };
  const main = text.slice(0, idx).trim();
  const rest = text.slice(idx + 'GOI_Y:'.length);
  const followups = rest
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter((l) => l.length > 3)
    .slice(0, 3);
  return { text: main, followups };
}

/**
 * Chạy một lượt hỏi–đáp của trợ lý: mô hình chọn công cụ, hệ thống chạy
 * hàm tính thật, mô hình diễn đạt lại kèm bằng chứng.
 */
export async function askAnalyticsAssistant(
  history: { role: 'user' | 'assistant'; text: string }[],
  ctx: AssistantContext
): Promise<AssistantReply> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  // gemini-2.0-flash đã bị Google khai tử (lỗi kiểm chứng 22/10 — các model
  // chính chạm giới hạn trong chốc lát là chuỗi dự phòng rơi xuống model chết
  // và báo lỗi oan). Thay bằng flash-lite + gemma làm tầng dự phòng sâu.
  const candidateModels = [
    getGeminiModel(),
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemma-4-31b-it',
  ].filter((m, i, arr) => !!m && arr.indexOf(m) === i);

  const contents: any[] = history.map((h) => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.text }],
  }));

  const toolRuns: AssistantToolRun[] = [];
  const seriesByTool = new Map<string, NonNullable<ToolOutcome['series']>>();
  let chart: AssistantChart | undefined;
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      // Tối đa 5 vòng gọi hàm cho mỗi câu hỏi
      for (let round = 0; round < 5; round++) {
        const res = await callGeminiWithTools(model, apiKey, contents, true);
        const parts = res?.candidates?.[0]?.content?.parts || [];
        const calls = parts.filter((p: any) => p.functionCall);
        const textPart = parts.find((p: any) => typeof p.text === 'string')?.text as
          | string
          | undefined;

        if (calls.length === 0) {
          if (textPart) {
            const parsed = parseFollowups(textPart);
            return { text: parsed.text, toolRuns, chart, followups: parsed.followups };
          }
          throw new Error('EMPTY_RESPONSE');
        }

        contents.push({ role: 'model', parts });
        const responseParts: any[] = [];
        for (const callPart of calls) {
          const { name, args } = callPart.functionCall || {};
          if (name === 'render_chart') {
            const series = seriesByTool.get(args?.dataSource);
            if (series && series.rows.length > 0) {
              const row0 = series.rows[0];
              const xKey = args.xKey && args.xKey in row0 ? args.xKey : series.xKey;
              const yKey = args.yKey && args.yKey in row0 ? args.yKey : series.yKey;
              chart = {
                type: args.chartType === 'line' ? 'line' : series.defaultType,
                title: args.title || TOOL_LABELS[args.dataSource] || 'Biểu đồ',
                rows: series.rows,
                xKey,
                yKey,
                yLabel: series.yLabel,
              };
            }
            responseParts.push({
              functionResponse: {
                name,
                response: { result: { daXuLy: true, coBieuDo: !!chart } },
              },
            });
            continue;
          }
          const outcome = await executeTool(name, args || {}, ctx);
          toolRuns.push({
            name,
            label: TOOL_LABELS[name] || name,
            evidence: outcome.evidence,
          });
          if (outcome.series) seriesByTool.set(name, outcome.series);
          responseParts.push({
            functionResponse: { name, response: { result: outcome.data } },
          });
        }
        contents.push({ role: 'user', parts: responseParts });
      }

      // Hết vòng gọi hàm mà chưa có câu trả lời: ép mô hình trả lời bằng
      // dữ liệu đã có (không kèm công cụ nữa).
      const finalRes = await callGeminiWithTools(model, apiKey, contents, false);
      const finalText =
        finalRes?.candidates?.[0]?.content?.parts?.find(
          (p: any) => typeof p.text === 'string'
        )?.text || 'Em đã truy vấn dữ liệu nhưng chưa diễn đạt được kết quả. Thầy/cô thử hỏi lại giúp em.';
      const parsed = parseFollowups(finalText);
      return { text: parsed.text, toolRuns, chart, followups: parsed.followups };
    } catch (err: any) {
      lastError = err;
      // Chỉ thử model kế tiếp khi lỗi thuộc về model/kết nối; lỗi dữ liệu
      // (vd câu hỏi sai) thì dừng ngay.
      if (err?.status && ![400, 404, 429, 500, 503].includes(err.status)) throw err;
    }
  }
  throw lastError || new Error('Không kết nối được Gemini.');
}
