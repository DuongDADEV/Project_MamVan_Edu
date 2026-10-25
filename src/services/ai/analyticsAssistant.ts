/**
 * TRỢ LÝ PHÂN TÍCH HỌC TẬP (Gemini Function Calling)
 *
 * Nguyên tắc cứng (theo yêu cầu chủ dự án 22/10):
 * - MỌI con số do CODE HỆ THỐNG tính từ dữ liệu thật (dùng chung các hàm
 *   tính của mục Phân tích) — mô hình AI chỉ chọn công cụ, diễn đạt kết quả
 *   và đề xuất bước tiếp theo. AI không tự sinh số.
 * - Công cụ chỉ đọc dữ liệu thuộc phạm vi giáo viên đang đăng nhập (dữ liệu
 *   truyền vào đã được cổng giáo viên lọc theo chủ sở hữu).
 * - Từ 24/10: trợ lý có thêm công cụ GHI (tạo/xuất bản/sửa/xóa/chấm/duyệt)
 *   đi qua đúng service/repository mà UI dùng, vẫn trong phạm vi giáo viên
 *   đó — không vượt sang giáo viên khác, không đụng cài đặt cấp hệ thống.
 * - Biểu đồ: AI gọi render_chart 1 lần với loai, hàm tự lấy dữ liệu thật
 *   rồi vẽ trong code — AI không khai trục, không chạm vào dữ liệu điểm.
 */

import { callAiProxy } from './proxyClient.ts';
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
  getTeacherAssignments,
  createAssignment,
  updateAssignment,
  getAssignmentDetail,
  getPendingReviews,
  gradePendingAnswer,
} from '../supabase/biRepository.ts';
import {
  supabaseContentRepo as contentRepo,
  supabaseQuizRepo as quizRepo,
  supabaseEssayRepo as essayRepo,
  supabaseRewardRepo as rewardRepo,
} from '../supabase/supabaseRepositories.ts';
import { REWARDS_CATALOG } from '../../data/rewards.ts';

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
  render_chart: 'Biểu đồ',
  list_class_students: 'Danh sách học sinh',
  list_topics: 'Danh sách chủ đề',
  list_quizzes: 'Danh sách bài kiểm tra',
  list_assignments: 'Danh sách bài tập đã giao',
  list_questions: 'Danh sách câu hỏi',
  get_essay_detail: 'Chi tiết bài tự luận',
  list_pending_essays: 'Bài tự luận chờ chấm',
  list_pending_reviews: 'Bài chờ chấm (BI)',
  list_reward_requests: 'Yêu cầu quà chờ duyệt',
  create_topic: 'Tạo chủ đề',
  create_video_draft: 'Tạo nháp video',
  create_theory_draft: 'Tạo nháp lý thuyết',
  publish_content: 'Xuất bản học liệu',
  unpublish_content: 'Gỡ xuất bản học liệu',
  create_quiz: 'Tạo bài kiểm tra',
  create_question: 'Tạo câu hỏi',
  publish_quiz: 'Xuất bản bài kiểm tra',
  create_assignment: 'Giao bài tập (BI)',
  update_assignment: 'Sửa bài tập (BI)',
  grade_essay: 'Chấm bài tự luận',
  grade_pending_review: 'Chấm bài chờ duyệt (BI)',
  approve_reward_request: 'Duyệt yêu cầu quà',
  reject_reward_request: 'Từ chối yêu cầu quà',
  delete_content: 'Xóa học liệu',
  delete_quiz: 'Xóa bài kiểm tra',
  delete_question: 'Xóa câu hỏi',
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

// ---- Công cụ HÀNH ĐỘNG (24/10): phạm vi = dữ liệu của chính giáo viên ----
// Mọi công cụ ghi đối chiếu tên/id với ctx trước khi chạm service. Không tìm
// thấy trong phạm vi thì ném lỗi "không tìm thấy ... trong phạm vi của
// thầy/cô" — case ghi bắt lỗi này và trả về dạng error để mô hình báo lại,
// tuyệt đối không bịa id, không chạm dữ liệu giáo viên khác, không đụng cài
// đặt cấp hệ thống. Các tool ghi đi qua ĐÚNG service/repository mà UI dùng
// (contentRepo/quizRepo/essayRepo/rewardRepo/biRepository) nên validation +
// phân tách theo giáo viên của các service được giữ nguyên.
const actorOf = (ctx: AssistantContext): string => ctx.teacherId || '';
const ownClassIds = (ctx: AssistantContext): string[] => ctx.classes.map((c) => c.id);
const findClassByName = (ctx: AssistantContext, nameOrId?: string) =>
  ctx.classes.find((c) => c.id === nameOrId || norm(c.name) === norm(nameOrId));
const findStudentByName = (ctx: AssistantContext, nameOrId: string, classId?: string) =>
  ctx.students.find(
    (s) => (s.id === nameOrId || norm(s.name) === norm(nameOrId)) && (!classId || s.class_id === classId)
  );
const findTopicByTitle = (ctx: AssistantContext, titleOrId: string) =>
  ctx.topics.find((t) => t.id === titleOrId || norm(t.title) === norm(titleOrId));
const scopeErr = (what: string, extra?: string) =>
  new Error(
    `Không tìm thấy ${what} trong phạm vi của thầy/cô${extra ? ` (${extra})` : ''}. Chỉ xử lý dữ liệu thuộc các lớp của thầy/cô, không dùng dữ liệu ngoài phạm vi.`
  );
function resolveClassIds(ctx: AssistantContext, classNames?: string[]): string[] {
  if (!classNames || classNames.length === 0) return ownClassIds(ctx);
  const ids: string[] = [];
  for (const n of classNames) {
    const c = findClassByName(ctx, n);
    if (!c) throw scopeErr(`lớp "${n}"`, `các lớp của thầy/cô: ${ctx.classes.map((x) => x.name).join(', ') || 'không có lớp nào'}`);
    ids.push(c.id);
  }
  return ids;
}
function resolveClassForAssignment(ctx: AssistantContext, className?: string): string {
  if (className) {
    const c = findClassByName(ctx, className);
    if (!c) throw scopeErr(`lớp "${className}"`, `các lớp của thầy/cô: ${ctx.classes.map((x) => x.name).join(', ')}`);
    return c.id;
  }
  if (ctx.classes.length === 1) return ctx.classes[0].id;
  throw new Error(
    `Chưa rõ giao cho lớp nào — thầy/cô đang quản lý ${ctx.classes.length} lớp: ${ctx.classes.map((x) => x.name).join(', ')}. Hãy nêu tên lớp.`
  );
}
const trunc = (s: any, n: number): string => {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, n) + '…' : t;
};

// ĐỢT 6 (26/10): series số học sinh từng lớp cho get_class_summary — trước
// đây công cụ này không có series nên render_chart không vẽ được tổng quan
// lớp dù dữ liệu đã có sẵn.
export function buildClassCountSeries(
  classes: ClassItem[],
  students: StudentAccount[],
  filter: AnalyticsFilter
): NonNullable<ToolOutcome['series']> {
  const scoped = filterStudents(students, filter);
  return {
    rows: classes
      .map((c) => ({
        lop: c.name,
        soHocSinh: scoped.filter((s) => s.class_id === c.id).length,
      }))
      .filter((r) => r.soHocSinh > 0),
    xKey: 'lop',
    yKey: 'soHocSinh',
    yLabel: 'Số học sinh',
    defaultType: 'bar',
  };
}

// ĐỢT 6 (26/10): vẽ biểu đồ = 1 function duy nhất — loại biểu đồ -> công
// cụ dữ liệu chạy trong code. Model chỉ gọi render_chart 1 lần với loai,
// không gọi công cụ dữ liệu trước, không khai dataSource/xKey/yKey.
export const CHART_LOAI_TO_TOOL: Record<string, { tool: string; argName?: string }> = {
  tong_quan_lop: { tool: 'get_class_summary' },
  tien_do_hoc_sinh: { tool: 'get_student_profile', argName: 'studentName' },
  pho_diem: { tool: 'get_score_distribution' },
  hoat_dong: { tool: 'get_learning_activity' },
  so_sanh_chu_de: { tool: 'compare_topics' },
};

export async function executeTool(
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
        series: buildClassCountSeries(ctx.classes, ctx.students, f),
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
        // Danh sách học sinh trong khoảng (24/10) — để trả lời câu hỏi tên
        // theo mức điểm bằng tên thật + điểm TB, không chỉ số lượng.
        hocSinh: (b.hocSinh || []).map((m) => ({ ten: m.ten, diemTB: m.diemTB })),
      }));
      // Học sinh CHƯA CÓ ĐIỂM (25/10) — học sinh trong phạm vi lọc mà không
      // nằm trong bất kỳ khoảng điểm nào (chưa có lượt làm/chấm trong kỳ).
      // Dùng để trả lời trực tiếp câu hỏi đếm ("bao nhiêu em chưa có điểm")
      // và để vẽ breakdown đã có điểm vs chưa có điểm. Lưu ý: phanTram của
      // các khoảng là tỉ lệ trong số học sinh CÓ điểm, còn phanTram của hàng
      // "Chưa có điểm" là tỉ lệ trong TỔNG số học sinh — biểu đồ vẽ theo
      // soHocSinh (số lượng) nên không bị lệch.
      const scopedStudents = filterStudents(ctx.students, f);
      const scoredIds = new Set(
        buckets.flatMap((b) => (b.hocSinh || []).map((m) => m.id))
      );
      const unscoredStudents = scopedStudents.filter((s) => !scoredIds.has(s.id));
      const unscoredRow = {
        khoangDiem: 'Chưa có điểm',
        soHocSinh: unscoredStudents.length,
        phanTram:
          scopedStudents.length > 0
            ? Math.round((unscoredStudents.length / scopedStudents.length) * 100)
            : 0,
        hocSinh: unscoredStudents.map((s) => ({ ten: s.name })),
      };
      return {
        evidence,
        data: {
          cacKhoang: rows,
          tongHocSinhCoDiem: rows.reduce((s, r) => s + r.soHocSinh, 0),
          tongHocSinh: scopedStudents.length,
          soHocSinhChuaCoDiem: unscoredStudents.length,
          hocSinhChuaCoDiem: unscoredStudents.map((s) => ({ ten: s.name })),
        },
        series: {
          // Series kèm thêm hàng "Chưa có điểm" để vẽ được breakdown đầy đủ;
          // data.cacKhoang vẫn giữ nguyên 4 khoảng điểm để câu trả lời tên
          // theo mức điểm không bị lẫn học sinh chưa có điểm.
          rows: [...rows, unscoredRow],
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
      // Tiến độ theo chủ đề — dùng chung cho cả data lẫn series của
      // render_chart (25/10: trước đây công cụ này không có series nên
      // render_chart(dataSource=get_student_profile) không bao giờ vẽ được
      // gì dù dữ liệu đã có sẵn, model đành xin lỗi "thiếu trường").
      const tienDoChuDe = profile.topicMasteryList.map((t) => ({
        chuDe: t.topicTitle,
        phanTramHoanThanh: t.percentage,
        trangThai: t.status,
      }));
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
          tienDoChuDe,
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
        series: {
          rows: tienDoChuDe,
          xKey: 'chuDe',
          yKey: 'phanTramHoanThanh',
          yLabel: '% hoàn thành',
          defaultType: 'bar',
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

    // ============ CÔNG CỤ ĐỌC BỔ SUNG (24/10 — phục vụ hành động) ============
    case 'list_class_students': {
      let list = ctx.students;
      let lop = 'tất cả lớp của thầy/cô';
      if (args.className) {
        const c = findClassByName(ctx, args.className);
        if (!c) return { evidence, data: { error: `Không tìm thấy lớp "${args.className}" trong phạm vi của thầy/cô.` } };
        list = list.filter((s) => s.class_id === c.id);
        lop = c.name;
      }
      return {
        evidence,
        data: {
          lop,
          soHocSinh: list.length,
          hocSinh: list.map((s) => ({ id: s.id, ten: s.name })),
        },
      };
    }

    case 'list_topics': {
      return {
        evidence,
        data: { chuDe: ctx.topics.map((t) => ({ id: t.id, tieuDe: t.title })) },
      };
    }

    case 'list_quizzes': {
      try {
        let topicId: string | undefined;
        if (args.topicTitle) {
          const t = findTopicByTitle(ctx, args.topicTitle);
          if (!t) throw scopeErr(`chủ đề "${args.topicTitle}"`);
          topicId = t.id;
        }
        const all = await quizRepo.getQuizzes();
        const topicIds = new Set(ctx.topics.map((t) => t.id));
        const owned = all.filter(
          (q) =>
            (!ctx.teacherId || (q as any).teacher_id === ctx.teacherId || (q as any).teacher_id === undefined || topicIds.has(q.topicId)) &&
            (!topicId || q.topicId === topicId)
        );
        return {
          evidence,
          data: {
            baiKiemTra: owned.map((q) => ({
              id: q.id,
              tieuDe: q.title,
              loai: q.kind,
              chuDe: ctx.topics.find((t) => t.id === q.topicId)?.title || q.topicId,
              trangThai: q.status,
            })),
          },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Liệt kê bài kiểm tra thất bại.' } };
      }
    }

    case 'list_assignments': {
      try {
        if (!ctx.teacherId) throw new Error('Không xác định được giáo viên đang đăng nhập nên không liệt kê được bài tập đã giao.');
        const list = await getTeacherAssignments(ctx.teacherId);
        return {
          evidence,
          data: {
            baiTap: list.map((a) => ({
              id: a.id,
              tieuDe: a.title,
              daXuatBan: a.published,
              hanNop: a.dueAt,
              soCau: a.questionCount,
              soHocSinhDuocGiao: a.targetCount,
              soBaiDaNop: a.submittedCount,
            })),
          },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Liệt kê bài tập thất bại.' } };
      }
    }

    case 'list_questions': {
      try {
        let topicId: string | undefined;
        if (args.topicTitle) {
          const t = findTopicByTitle(ctx, args.topicTitle);
          if (!t) throw scopeErr(`chủ đề "${args.topicTitle}"`);
          topicId = t.id;
        }
        const all = Object.values(ctx.questions || {});
        const filtered = topicId ? all.filter((q) => q.topicId === topicId) : all;
        return {
          evidence,
          data: {
            cauHoi: filtered.slice(0, 100).map((q) => ({
              id: q.id,
              deBai: trunc(q.prompt, 160),
              loai: q.type,
              chuDe: ctx.topics.find((t) => t.id === q.topicId)?.title || q.topicId || '(ngân hàng chung)',
            })),
          },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Liệt kê câu hỏi thất bại.' } };
      }
    }

    case 'get_essay_detail': {
      const e = ctx.essays.find((x) => x.id === args.essayId);
      if (!e) return { evidence, data: { error: `Không tìm thấy bài tự luận "${args.essayId}" trong phạm vi của thầy/cô.` } };
      return {
        evidence,
        data: {
          id: e.id,
          hocSinh: e.studentName || ctx.students.find((s) => s.id === e.studentId)?.name || e.studentId,
          deBai: e.questionPrompt || e.promptTitle || '',
          noiDung: e.content,
          soTu: e.wordCount,
          ngayNop: new Date(e.submittedAt).toISOString(),
          trangThai: e.status,
          nhanXetGiaoVien: e.teacherFeedback || null,
        },
      };
    }

    case 'list_pending_essays': {
      const pending = ctx.essays.filter((e) => e.status === 'PENDING_TEACHER' || e.status === 'AI_SUGGESTED');
      return {
        evidence,
        data: {
          baiChoCham: pending.map((e) => ({
            id: e.id,
            hocSinh: e.studentName || ctx.students.find((s) => s.id === e.studentId)?.name || e.studentId,
            deBai: trunc(e.questionPrompt || e.promptTitle || '', 120),
            ngayNop: new Date(e.submittedAt).toISOString(),
            trangThai: e.status,
          })),
        },
      };
    }

    case 'list_pending_reviews': {
      try {
        const list = await getPendingReviews(ctx.students.map((s) => s.id));
        return {
          evidence,
          data: {
            baiChoCham: list.slice(0, 20).map((r) => ({
              reviewId: r.reviewId,
              hocSinh: r.studentName,
              bai: r.sourceTitle,
              deBai: trunc(r.questionPrompt, 160),
              baiLam: r.responseText,
              diemToiDa: r.maxScore,
            })),
          },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Liệt kê bài chờ chấm thất bại.' } };
      }
    }

    case 'list_reward_requests': {
      const wanted = args.status || 'PENDING_APPROVAL';
      const list = ctx.rewards.filter((r) => (wanted === 'ALL' ? true : r.status === wanted));
      return {
        evidence,
        data: {
          yeuCau: list.map((r: any) => ({
            id: r.id,
            hocSinh: r.studentName || r.studentId || '(không rõ học sinh)',
            qua: REWARDS_CATALOG.find((t) => t.id === r.rewardId)?.secret?.name || REWARDS_CATALOG.find((t) => t.id === r.rewardId)?.name || r.rewardId,
            trangThai: r.status,
            ngayGui: new Date(r.requestedAt).toISOString(),
          })),
        },
      };
    }

    // ============ CÔNG CỤ GHI (24/10 — toàn quyền trong phạm vi giáo viên) ============
    case 'create_topic': {
      try {
        if (!args.title?.trim()) throw new Error('Cần tiêu đề chủ đề.');
        const saved = await contentRepo.saveTopic({
          title: args.title.trim(),
          shortDesc: args.shortDesc || '',
          tag: args.tag || '',
          videoIds: [],
          theoryId: '',
          colorScheme: '#2F3E6B',
          status: 'draft',
          class_ids: ownClassIds(ctx),
          teacher_id: ctx.teacherId,
        } as any);
        return { evidence, data: { daTao: { loai: 'chuDe', id: saved.id, tieuDe: saved.title, trangThai: 'nháp' } } };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Tạo chủ đề thất bại.' } };
      }
    }

    case 'create_video_draft': {
      try {
        if (!args.topic || !args.title?.trim()) throw new Error('Cần tên chủ đề và tiêu đề bài giảng.');
        const topic = findTopicByTitle(ctx, args.topic);
        if (!topic) throw scopeErr(`chủ đề "${args.topic}"`);
        const saved = await contentRepo.saveVideoLesson({
          topicId: topic.id,
          title: args.title.trim(),
          durationSec: 600,
          subtopics: [],
          summaryPoints: [{ title: 'Khái niệm trọng tâm', content: '', example: '' }],
          practiceQuizId: '',
          quickTestId: '',
          masteryCheckId: '',
          status: 'draft',
          class_ids: ownClassIds(ctx),
          teacher_id: ctx.teacherId,
        } as any);
        const full = await contentRepo.getTopicById(topic.id);
        if (full) {
          const vids = Array.isArray(full.videoIds) ? full.videoIds : [];
          await contentRepo.saveTopic({
            ...full,
            videoIds: vids.includes(saved.id) ? vids : [...vids, saved.id],
            flowOrder: [...(full.flowOrder || []), `video:${saved.id}`],
          });
        }
        return { evidence, data: { daTao: { loai: 'video', id: saved.id, tieuDe: saved.title, chuDe: topic.title, trangThai: 'nháp (đã gắn vào luồng chủ đề)' } } };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Tạo nháp video thất bại.' } };
      }
    }

    case 'create_theory_draft': {
      try {
        if (!args.topic || !args.title?.trim()) throw new Error('Cần tên chủ đề và tiêu đề bài lý thuyết.');
        const topic = findTopicByTitle(ctx, args.topic);
        if (!topic) throw scopeErr(`chủ đề "${args.topic}"`);
        const blocks = args.content
          ? [{ id: 'b_1', type: 'paragraph', content: args.content }]
          : [
              { id: 'b_1', type: 'heading', level: 2, content: '1. Khái niệm và nhận diện' },
              { id: 'b_2', type: 'paragraph', content: 'Gõ nội dung lý thuyết tại đây...' },
            ];
        const saved = await contentRepo.saveTheoryLesson({
          topicId: topic.id,
          title: args.title.trim(),
          minReadSeconds: 25,
          kind: 'general_topic',
          sections: [],
          blocks,
          practiceQuizId: '',
          testQuizId: '',
          status: 'draft',
          class_ids: ownClassIds(ctx),
          teacher_id: ctx.teacherId,
        } as any);
        const full = await contentRepo.getTopicById(topic.id);
        if (full) {
          await contentRepo.saveTopic({
            ...full,
            flowOrder: [...(full.flowOrder || []), `theory:${saved.id}`],
          });
        }
        return { evidence, data: { daTao: { loai: 'lyThuyet', id: saved.id, tieuDe: saved.title, chuDe: topic.title, trangThai: 'nháp (đã gắn vào luồng chủ đề)' } } };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Tạo nháp lý thuyết thất bại.' } };
      }
    }

    case 'publish_content':
    case 'unpublish_content': {
      try {
        const isPublish = name === 'publish_content';
        const type = args.type as 'topic' | 'video' | 'theory';
        if (!['topic', 'video', 'theory'].includes(type)) throw new Error('Loại học liệu phải là topic, video hoặc theory.');
        if (!args.target) throw new Error('Cần tên hoặc id học liệu.');
        let id = '';
        let tieuDe = '';
        if (type === 'topic') {
          const t = findTopicByTitle(ctx, args.target);
          if (!t) throw scopeErr(`chủ đề "${args.target}"`);
          id = t.id;
          tieuDe = t.title;
        } else {
          const getById = type === 'video' ? contentRepo.getVideoLessonById.bind(contentRepo) : contentRepo.getTheoryLessonById.bind(contentRepo);
          const item: any = await getById(args.target);
          const topicIds = new Set(ctx.topics.map((t) => t.id));
          if (!item || (ctx.teacherId && item.teacher_id && item.teacher_id !== ctx.teacherId && !topicIds.has(item.topicId))) {
            throw scopeErr(`${type === 'video' ? 'bài giảng video' : 'bài lý thuyết'} "${args.target}"`);
          }
          id = item.id;
          tieuDe = item.title;
        }
        if (isPublish) {
          const classIds = resolveClassIds(ctx, args.classNames);
          await contentRepo.publishContent(type, id, { classIds, notifyStudent: !!args.notifyStudent }, actorOf(ctx));
          const classNames = ctx.classes.filter((c) => classIds.includes(c.id)).map((c) => c.name);
          return { evidence, data: { daXuatBan: { loai: type, id, tieuDe, cacLop: classNames, thongBaoHocSinh: !!args.notifyStudent } } };
        }
        await contentRepo.unpublishContent(type, id, actorOf(ctx));
        return { evidence, data: { daGoXuatBan: { loai: type, id, tieuDe } } };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Xuất bản/gỡ xuất bản thất bại.' } };
      }
    }

    case 'create_quiz': {
      try {
        if (!args.title?.trim()) throw new Error('Cần tiêu đề bài kiểm tra.');
        const kind = args.kind as string;
        if (!['practice', 'quick', 'mastery', 'reading', 'final', 'homework'].includes(kind)) {
          throw new Error('Loại bài phải là practice, quick, mastery, reading, final hoặc homework.');
        }
        if (!args.topic) throw new Error('Cần tên chủ đề của bài kiểm tra.');
        const topic = findTopicByTitle(ctx, args.topic);
        if (!topic) throw scopeErr(`chủ đề "${args.topic}"`);
        const saved = await quizRepo.saveQuiz({
          title: args.title.trim(),
          kind: kind as any,
          topicId: topic.id,
          timeLimitMinutes: args.timeLimitMinutes ?? (kind === 'quick' ? 7 : kind === 'mastery' ? 15 : undefined),
          xp: args.xp ?? (kind === 'mastery' ? 20 : 10),
          questionIds: [],
          status: 'draft',
          class_ids: ownClassIds(ctx),
          teacher_id: ctx.teacherId,
        } as any);
        return { evidence, data: { daTao: { loai: 'quiz', id: saved.id, tieuDe: saved.title, loaiBai: kind, chuDe: topic.title, trangThai: 'nháp' } } };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Tạo bài kiểm tra thất bại.' } };
      }
    }

    case 'create_question': {
      try {
        if (!args.prompt?.trim()) throw new Error('Cần nội dung câu hỏi (prompt).');
        const typeMap: Record<string, string> = {
          single: 'single', SINGLE_CHOICE: 'single',
          multi: 'multi', MULTIPLE_CHOICE: 'multi',
          fill: 'fill', FILL_IN: 'fill',
          essay: 'essay', ESSAY: 'essay',
        };
        const type = typeMap[args.type] || typeMap[String(args.type || '').toUpperCase()];
        if (!type) throw new Error('Loại câu hỏi phải là single, multi, fill hoặc essay.');
        if ((type === 'single' || type === 'multi') && (!Array.isArray(args.options) || args.options.length < 2)) {
          throw new Error('Câu trắc nghiệm cần ít nhất 2 lựa chọn (options).');
        }
        if ((type === 'single' || type === 'multi' || type === 'fill') && !args.answer) {
          throw new Error('Câu này cần đáp án đúng (answer).');
        }
        let topicId = '';
        let chuDe = '(ngân hàng chung — không gắn chủ đề cụ thể)';
        if (args.topic) {
          const t = findTopicByTitle(ctx, args.topic);
          if (!t) throw scopeErr(`chủ đề "${args.topic}"`);
          topicId = t.id;
          chuDe = t.title;
        }
        const answer = type === 'single' ? (Array.isArray(args.answer) ? args.answer[0] : args.answer) : args.answer;
        const saved = await quizRepo.saveQuestion({
          id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          type: type as any,
          level: 'THONG_HIEU',
          difficulty: 'TB',
          prompt: args.prompt.trim(),
          topicId,
          options: args.options,
          answer,
          explanation: args.explanation || '',
          points: 10,
          minWords: type === 'essay' ? 120 : undefined,
          teacher_id: ctx.teacherId,
        } as any);
        return { evidence, data: { daTao: { loai: 'cauHoi', id: saved.id, deBai: trunc(args.prompt, 120), loaiCauHoi: type, chuDe } } };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Tạo câu hỏi thất bại.' } };
      }
    }

    case 'publish_quiz': {
      try {
        if (!args.target) throw new Error('Cần tên hoặc id bài kiểm tra.');
        let quiz: any = null;
        const inCtx = (ctx.quizzes || []).find((q) => q.id === args.target);
        if (inCtx) {
          quiz = await quizRepo.getQuizById(inCtx.id);
        } else {
          const found = await quizRepo.getQuizById(args.target);
          const topicIds = new Set(ctx.topics.map((t) => t.id));
          if (found && (!ctx.teacherId || !found.teacher_id || found.teacher_id === ctx.teacherId || topicIds.has(found.topicId))) {
            quiz = found;
          }
        }
        if (!quiz) {
          // Tìm theo tiêu đề trong danh sách trực tiếp
          const all = await quizRepo.getQuizzes();
          const topicIds = new Set(ctx.topics.map((t) => t.id));
          quiz = all.find(
            (q) =>
              norm(q.title) === norm(args.target) &&
              (!ctx.teacherId || !q.teacher_id || q.teacher_id === ctx.teacherId || topicIds.has(q.topicId))
          );
        }
        if (!quiz) throw scopeErr(`bài kiểm tra "${args.target}"`);
        const classIds = resolveClassIds(ctx, args.classNames);
        const published = await quizRepo.publishQuiz(quiz.id, { classIds, notifyStudent: !!args.notifyStudent }, actorOf(ctx));
        return {
          evidence,
          data: {
            daXuatBan: {
              loai: 'quiz',
              id: published.id,
              tieuDe: published.title,
              cacLop: ctx.classes.filter((c) => classIds.includes(c.id)).map((c) => c.name),
              thongBaoHocSinh: !!args.notifyStudent,
            },
          },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Xuất bản bài kiểm tra thất bại.' } };
      }
    }

    case 'create_assignment': {
      try {
        if (!ctx.teacherId) throw new Error('Không xác định được giáo viên đang đăng nhập nên không giao được bài tập.');
        if (!args.title?.trim()) throw new Error('Cần tiêu đề bài tập.');
        if (!Array.isArray(args.questionIds) || args.questionIds.length === 0) {
          throw new Error('Cần ít nhất 1 câu hỏi (questionIds) — dùng list_questions để lấy id câu hỏi trong ngân hàng của thầy/cô.');
        }
        for (const qid of args.questionIds) {
          if (!ctx.questions[qid]) throw scopeErr(`câu hỏi "${qid}"`, 'câu hỏi không thuộc ngân hàng của thầy/cô');
        }
        const classId = resolveClassForAssignment(ctx, args.className);
        let studentIds: string[];
        if (Array.isArray(args.studentNames) && args.studentNames.length > 0) {
          studentIds = [];
          for (const n of args.studentNames) {
            const s = findStudentByName(ctx, n, classId);
            if (!s) throw scopeErr(`học sinh "${n}"`, `học sinh lớp ${ctx.classes.find((c) => c.id === classId)?.name || classId}`);
            studentIds.push(s.id);
          }
        } else {
          studentIds = ctx.students.filter((s) => s.class_id === classId).map((s) => s.id);
        }
        if (studentIds.length === 0) throw new Error('Không có học sinh nào để giao bài.');
        const id = await createAssignment({
          teacherId: ctx.teacherId,
          classId,
          title: args.title.trim(),
          questionIds: args.questionIds,
          studentIds,
          dueAt: args.dueAt || null,
          isTimed: !!args.isTimed,
          timeLimitMinutes: args.isTimed ? args.timeLimitMinutes ?? null : null,
        });
        return {
          evidence,
          data: {
            daTaoVaGiao: {
              loai: 'baiTapBI',
              id,
              tieuDe: args.title.trim(),
              soCau: args.questionIds.length,
              soHocSinh: studentIds.length,
              lop: ctx.classes.find((c) => c.id === classId)?.name || classId,
            },
            luuY: 'Bài tập BI được giao ngay khi tạo (học sinh thấy trong mục Bài tập).',
          },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Giao bài tập thất bại.' } };
      }
    }

    case 'update_assignment': {
      try {
        if (!ctx.teacherId) throw new Error('Không xác định được giáo viên đang đăng nhập nên không sửa được bài tập.');
        if (!args.target) throw new Error('Cần tên hoặc id bài tập.');
        const summaries = await getTeacherAssignments(ctx.teacherId);
        const summary = summaries.find((a) => a.id === args.target || norm(a.title) === norm(args.target));
        if (!summary) throw scopeErr(`bài tập "${args.target}"`);
        const detail = await getAssignmentDetail(summary.id);
        if (!detail) throw new Error(`Không đọc được chi tiết bài tập "${summary.title}".`);
        const progress = await getAssignmentsProgress(ctx.teacherId, ctx.students.map((s) => s.id));
        const prog = progress.find((a) => a.id === summary.id);
        const currentStudentIds = (prog?.targets || []).map((t) => t.studentId);
        let classId: string | null;
        if (args.className) {
          const c = findClassByName(ctx, args.className);
          if (!c) throw scopeErr(`lớp "${args.className}"`);
          classId = c.id;
        } else {
          const classesOfTargets = [...new Set(currentStudentIds.map((sid) => ctx.students.find((s) => s.id === sid)?.class_id).filter(Boolean))];
          classId = classesOfTargets.length === 1 ? (classesOfTargets[0] as string) : null;
          if (classesOfTargets.length > 1) throw new Error('Bài tập đang giao cho nhiều lớp — hãy nêu tên lớp khi sửa.');
        }
        let studentIds = currentStudentIds;
        if (Array.isArray(args.studentNames) && args.studentNames.length > 0) {
          studentIds = [];
          for (const n of args.studentNames) {
            const s = findStudentByName(ctx, n, classId || undefined);
            if (!s) throw scopeErr(`học sinh "${n}"`);
            studentIds.push(s.id);
          }
        }
        await updateAssignment(summary.id, {
          title: args.title ?? detail.title,
          classId,
          dueAt: args.dueAt ?? detail.dueAt,
          isTimed: args.isTimed ?? detail.isTimed,
          timeLimitMinutes: args.isTimed ?? detail.isTimed ? args.timeLimitMinutes ?? detail.timeLimitMinutes : null,
          xpReward: args.xpReward ?? detail.xpReward,
          questionIds: args.questionIds ?? detail.questions.map((q) => q.id),
          studentIds,
          publish: summary.published,
        });
        return {
          evidence,
          data: {
            daSua: {
              loai: 'baiTapBI',
              id: summary.id,
              tieuDe: args.title ?? detail.title,
              giuNguyenCauHoi: !args.questionIds,
              giuNguyenHocSinh: !args.studentNames,
            },
          },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Sửa bài tập thất bại.' } };
      }
    }

    case 'grade_essay': {
      try {
        const e = ctx.essays.find((x) => x.id === args.essayId);
        if (!e) throw scopeErr(`bài tự luận "${args.essayId}"`);
        const totalScore = Number(args.totalScore);
        if (Number.isNaN(totalScore) || totalScore < 0 || totalScore > 10) {
          throw new Error('Điểm chấm phải từ 0 đến 10.');
        }
        await essayRepo.gradeSubmission(
          e.id,
          {
            teacherFeedback: args.teacherFeedback || '',
            rubricScores: args.rubricScores || [],
            totalScore,
            finalRatio: totalScore / 10,
          },
          actorOf(ctx)
        );
        return {
          evidence,
          data: {
            daCham: {
              loai: 'tuLuan',
              id: e.id,
              hocSinh: e.studentName || ctx.students.find((s) => s.id === e.studentId)?.name || e.studentId,
              diem: totalScore,
            },
          },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Chấm bài tự luận thất bại.' } };
      }
    }

    case 'grade_pending_review': {
      try {
        const list = await getPendingReviews(ctx.students.map((s) => s.id));
        const r = list.find((x) => x.reviewId === args.reviewId);
        if (!r) throw scopeErr(`phiếu chấm "${args.reviewId}"`, 'phiếu không còn chờ chấm hoặc không thuộc lớp của thầy/cô');
        const score = Number(args.score);
        if (Number.isNaN(score) || score < 0 || (r.maxScore != null && score > r.maxScore)) {
          throw new Error(`Điểm chấm phải từ 0 đến ${r.maxScore ?? 'thang điểm của câu'}.`);
        }
        await gradePendingAnswer(
          { reviewId: r.reviewId, answerId: r.answerId, attemptId: r.attemptId },
          score,
          args.feedback || '',
          actorOf(ctx)
        );
        return {
          evidence,
          data: { daCham: { loai: 'phieuChamBI', reviewId: r.reviewId, hocSinh: r.studentName, bai: r.sourceTitle, diem: score } },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Chấm phiếu chờ duyệt thất bại.' } };
      }
    }

    case 'approve_reward_request':
    case 'reject_reward_request': {
      try {
        const req: any = ctx.rewards.find((r) => r.id === args.requestId);
        if (!req) throw scopeErr(`yêu cầu quà "${args.requestId}"`);
        if (req.status !== 'PENDING_APPROVAL') {
          throw new Error(`Yêu cầu quà này đang ở trạng thái ${req.status}, không còn chờ duyệt.`);
        }
        const status = name === 'approve_reward_request' ? 'APPROVED' : 'REJECTED';
        await rewardRepo.updateRequestStatus(req.id, status as any, args.reason || undefined, actorOf(ctx));
        return {
          evidence,
          data: {
            daXuLyYeuCauQua: {
              id: req.id,
              hocSinh: req.studentName || req.studentId || '(không rõ học sinh)',
              ketQua: status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối',
            },
          },
        };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Xử lý yêu cầu quà thất bại.' } };
      }
    }

    case 'delete_content': {
      try {
        const type = args.type as 'topic' | 'video' | 'theory';
        if (!['topic', 'video', 'theory'].includes(type)) throw new Error('Loại học liệu phải là topic, video hoặc theory.');
        if (!args.target) throw new Error('Cần tên hoặc id học liệu.');
        let id = '';
        let tieuDe = '';
        if (type === 'topic') {
          const t = findTopicByTitle(ctx, args.target);
          if (!t) throw scopeErr(`chủ đề "${args.target}"`);
          id = t.id;
          tieuDe = t.title;
        } else {
          const getById = type === 'video' ? contentRepo.getVideoLessonById.bind(contentRepo) : contentRepo.getTheoryLessonById.bind(contentRepo);
          const item: any = await getById(args.target);
          const topicIds = new Set(ctx.topics.map((t) => t.id));
          if (!item || (ctx.teacherId && item.teacher_id && item.teacher_id !== ctx.teacherId && !topicIds.has(item.topicId))) {
            throw scopeErr(`${type === 'video' ? 'bài giảng video' : 'bài lý thuyết'} "${args.target}"`);
          }
          id = item.id;
          tieuDe = item.title;
        }
        if (type === 'topic') await contentRepo.deleteTopic(id, actorOf(ctx));
        else if (type === 'video') await contentRepo.deleteVideoLesson(id, actorOf(ctx));
        else await contentRepo.deleteTheoryLesson(id, actorOf(ctx));
        return { evidence, data: { daXoa: { loai: type, id, tieuDe } } };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Xóa học liệu thất bại.' } };
      }
    }

    case 'delete_quiz': {
      try {
        if (!args.target) throw new Error('Cần tên hoặc id bài kiểm tra.');
        let quiz: any = null;
        const inCtx = (ctx.quizzes || []).find((q) => q.id === args.target);
        if (inCtx) quiz = await quizRepo.getQuizById(inCtx.id);
        if (!quiz) {
          const found = await quizRepo.getQuizById(args.target);
          const topicIds = new Set(ctx.topics.map((t) => t.id));
          if (found && (!ctx.teacherId || !found.teacher_id || found.teacher_id === ctx.teacherId || topicIds.has(found.topicId))) {
            quiz = found;
          }
        }
        if (!quiz) {
          const all = await quizRepo.getQuizzes();
          const topicIds = new Set(ctx.topics.map((t) => t.id));
          quiz = all.find(
            (q) =>
              norm(q.title) === norm(args.target) &&
              (!ctx.teacherId || !q.teacher_id || q.teacher_id === ctx.teacherId || topicIds.has(q.topicId))
          );
        }
        if (!quiz) throw scopeErr(`bài kiểm tra "${args.target}"`);
        await quizRepo.deleteQuiz(quiz.id, actorOf(ctx));
        return { evidence, data: { daXoa: { loai: 'quiz', id: quiz.id, tieuDe: quiz.title } } };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Xóa bài kiểm tra thất bại.' } };
      }
    }

    case 'delete_question': {
      try {
        if (!args.questionId) throw new Error('Cần id câu hỏi.');
        const q = ctx.questions[args.questionId];
        if (!q) throw scopeErr(`câu hỏi "${args.questionId}"`, 'câu hỏi không thuộc ngân hàng của thầy/cô');
        await quizRepo.deleteQuestion(q.id, actorOf(ctx));
        return { evidence, data: { daXoa: { loai: 'cauHoi', id: q.id, deBai: trunc(q.prompt, 120) } } };
      } catch (e: any) {
        return { evidence, data: { error: e?.message || 'Xóa câu hỏi thất bại.' } };
      }
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
    description: 'Phổ điểm của lớp: số học sinh trong từng khoảng điểm (chưa đạt / trung bình / khá / giỏi), mỗi khoảng kèm danh sách học sinh (tên + điểm TB) trong khoảng đó. Dùng công cụ này khi giáo viên hỏi tên học sinh ở một mức điểm (vd "học sinh điểm khá là những ai").',
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
  // ---- Công cụ đọc bổ sung + công cụ ghi (24/10) ----
  {
    name: 'list_class_students',
    description: 'Liệt kê học sinh của một lớp (id + tên) — dùng trước khi giao bài, chấm bài hoặc gọi tên học sinh.',
    parameters: { type: 'OBJECT', properties: { className: { type: 'STRING', description: 'Tên lớp; bỏ trống = tất cả lớp của giáo viên.' } } },
  },
  {
    name: 'list_topics',
    description: 'Liệt kê các chủ đề của giáo viên (id + tiêu đề) — dùng trước khi tạo/xuất bản/xóa học liệu theo tên chủ đề.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_quizzes',
    description: 'Liệt kê bài kiểm tra của giáo viên (id, tiêu đề, loại, chủ đề, trạng thái) — dùng trước khi xuất bản/xóa bài kiểm tra theo tên.',
    parameters: { type: 'OBJECT', properties: { topicTitle: { type: 'STRING', description: 'Lọc theo tên chủ đề; bỏ trống = tất cả.' } } },
  },
  {
    name: 'list_assignments',
    description: 'Liệt kê bài tập BI đã giao của giáo viên (id, tiêu đề, đã xuất bản, hạn nộp, số câu, số học sinh được giao, số bài đã nộp) — dùng trước khi sửa bài tập theo tên.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_questions',
    description: 'Liệt kê câu hỏi trong ngân hàng riêng của giáo viên (id, đề bài rút gọn, loại, chủ đề) — dùng trước khi giao bài tập (lấy questionIds) hoặc xóa câu hỏi.',
    parameters: { type: 'OBJECT', properties: { topicTitle: { type: 'STRING', description: 'Lọc theo tên chủ đề; bỏ trống = tất cả.' } } },
  },
  {
    name: 'get_essay_detail',
    description: 'Đọc toàn bộ nội dung một bài tự luận (đề bài, bài làm, trạng thái, nhận xét cũ) — dùng trước khi chấm bài.',
    parameters: { type: 'OBJECT', properties: { essayId: { type: 'STRING' } } },
  },
  {
    name: 'list_pending_essays',
    description: 'Liệt kê bài tự luận đang chờ chấm (id, học sinh, đề bài, ngày nộp).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_pending_reviews',
    description: 'Liệt kê phiếu chấm BI đang chờ (reviewId, học sinh, bài, đề bài, bài làm, điểm tối đa) — dùng trước khi chấm phiếu chờ duyệt.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_reward_requests',
    description: 'Liệt kê yêu cầu quà của học sinh (id, học sinh, quà, trạng thái) — mặc định chỉ yêu cầu chờ duyệt.',
    parameters: { type: 'OBJECT', properties: { status: { type: 'STRING', description: 'PENDING_APPROVAL (mặc định), APPROVED, REJECTED hoặc ALL.' } } },
  },
  {
    name: 'create_topic',
    description: 'Tạo chủ đề mới ở trạng thái nháp (chưa xuất bản, học sinh chưa thấy).',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        shortDesc: { type: 'STRING' },
        tag: { type: 'STRING' },
      },
    },
  },
  {
    name: 'create_video_draft',
    description: 'Tạo nháp bài giảng video trong một chủ đề (trạng thái nháp, đã gắn vào luồng chủ đề).',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: 'Tên hoặc id chủ đề.' },
        title: { type: 'STRING' },
      },
    },
  },
  {
    name: 'create_theory_draft',
    description: 'Tạo nháp bài lý thuyết trong một chủ đề (trạng thái nháp, đã gắn vào luồng chủ đề).',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: 'Tên hoặc id chủ đề.' },
        title: { type: 'STRING' },
        content: { type: 'STRING', description: 'Nội dung đoạn mở đầu (tùy chọn).' },
      },
    },
  },
  {
    name: 'publish_content',
    description: 'Xuất bản học liệu (topic/video/theory) cho các lớp của giáo viên. Có thể kèm thông báo cho học sinh (notifyStudent=true gửi thông báo như khi xuất bản trên UI).',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', enum: ['topic', 'video', 'theory'] },
        target: { type: 'STRING', description: 'Tên hoặc id học liệu.' },
        classNames: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Tên các lớp; bỏ trống = tất cả lớp của giáo viên.' },
        notifyStudent: { type: 'BOOLEAN' },
      },
    },
  },
  {
    name: 'unpublish_content',
    description: 'Gỡ xuất bản học liệu (topic/video/theory) — học sinh không còn thấy bài đó.',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', enum: ['topic', 'video', 'theory'] },
        target: { type: 'STRING', description: 'Tên hoặc id học liệu.' },
      },
    },
  },
  {
    name: 'create_quiz',
    description: 'Tạo bài kiểm tra mới ở trạng thái nháp (chưa xuất bản). Loại: practice, quick, mastery, reading, final, homework.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        kind: { type: 'STRING', enum: ['practice', 'quick', 'mastery', 'reading', 'final', 'homework'] },
        topic: { type: 'STRING', description: 'Tên hoặc id chủ đề.' },
        timeLimitMinutes: { type: 'NUMBER' },
        xp: { type: 'NUMBER' },
      },
    },
  },
  {
    name: 'create_question',
    description: 'Tạo câu hỏi mới vào ngân hàng riêng của giáo viên (có thể gắn chủ đề hoặc để trống = ngân hàng chung). Loại: single (trắc nghiệm 1 đáp án), multi (nhiều đáp án), fill (điền khuyết), essay (tự luận).',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: 'Tên hoặc id chủ đề; bỏ trống = chỉ vào ngân hàng.' },
        type: { type: 'STRING', enum: ['single', 'multi', 'fill', 'essay'] },
        prompt: { type: 'STRING' },
        options: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Các lựa chọn cho single/multi.' },
        answer: { description: 'Đáp án đúng: chuỗi "A" cho single; mảng ["A","C"] cho multi; mảng đáp án cho fill.' },
        explanation: { type: 'STRING' },
      },
    },
  },
  {
    name: 'publish_quiz',
    description: 'Xuất bản bài kiểm tra cho các lớp của giáo viên. Có thể kèm thông báo cho học sinh (notifyStudent=true).',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', description: 'Tên hoặc id bài kiểm tra.' },
        classNames: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Tên các lớp; bỏ trống = tất cả lớp của giáo viên.' },
        notifyStudent: { type: 'BOOLEAN' },
      },
    },
  },
  {
    name: 'create_assignment',
    description: 'Tạo và giao ngay bài tập BI (học sinh thấy trong mục Bài tập). Cần questionIds lấy từ list_questions. Không nêu lớp thì giao cho lớp duy nhất của giáo viên; nhiều lớp thì phải nêu tên lớp. Không nêu học sinh thì giao cho cả lớp.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        className: { type: 'STRING' },
        questionIds: { type: 'ARRAY', items: { type: 'STRING' } },
        studentNames: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Tên học sinh; bỏ trống = cả lớp.' },
        dueAt: { type: 'STRING', description: 'Hạn nộp dạng ISO (vd 2026-10-30T00:00:00.000Z) hoặc bỏ trống.' },
        isTimed: { type: 'BOOLEAN' },
        timeLimitMinutes: { type: 'NUMBER' },
      },
    },
  },
  {
    name: 'update_assignment',
    description: 'Sửa bài tập BI đã giao (tiêu đề, hạn nộp, thời gian, XP, câu hỏi, học sinh). Trường nào không nêu thì giữ nguyên.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', description: 'Tên hoặc id bài tập.' },
        title: { type: 'STRING' },
        className: { type: 'STRING' },
        dueAt: { type: 'STRING' },
        isTimed: { type: 'BOOLEAN' },
        timeLimitMinutes: { type: 'NUMBER' },
        xpReward: { type: 'NUMBER' },
        questionIds: { type: 'ARRAY', items: { type: 'STRING' } },
        studentNames: { type: 'ARRAY', items: { type: 'STRING' } },
      },
    },
  },
  {
    name: 'grade_essay',
    description: 'Chấm bài tự luận: ghi nhận xét + điểm (0–10) + điểm rubric (tùy chọn). Đọc bài trước bằng get_essay_detail.',
    parameters: {
      type: 'OBJECT',
      properties: {
        essayId: { type: 'STRING' },
        totalScore: { type: 'NUMBER', description: 'Điểm từ 0 đến 10.' },
        teacherFeedback: { type: 'STRING' },
        rubricScores: { type: 'ARRAY', items: { type: 'OBJECT', properties: { criterionName: { type: 'STRING' }, score: { type: 'NUMBER' }, maxScore: { type: 'NUMBER' } } } },
      },
    },
  },
  {
    name: 'grade_pending_review',
    description: 'Chấm phiếu chờ duyệt BI (bài làm đã gộp từ bài tập): ghi điểm + nhận xét. Lấy reviewId từ list_pending_reviews.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reviewId: { type: 'STRING' },
        score: { type: 'NUMBER' },
        feedback: { type: 'STRING' },
      },
    },
  },
  {
    name: 'approve_reward_request',
    description: 'Duyệt yêu cầu đổi quà của học sinh (trạng thái chờ duyệt).',
    parameters: {
      type: 'OBJECT',
      properties: {
        requestId: { type: 'STRING' },
        reason: { type: 'STRING' },
      },
    },
  },
  {
    name: 'reject_reward_request',
    description: 'Từ chối yêu cầu đổi quà của học sinh (trạng thái chờ duyệt) — XP giữ sẽ được hoàn lại theo luồng của app.',
    parameters: {
      type: 'OBJECT',
      properties: {
        requestId: { type: 'STRING' },
        reason: { type: 'STRING' },
      },
    },
  },
  {
    name: 'delete_content',
    description: 'Xóa học liệu (topic/video/theory) qua đúng luồng xóa của app. Xóa chủ đề sẽ xóa cả nội dung thuộc chủ đề đó theo luồng của app — chỉ xóa khi giáo viên nói rõ.',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', enum: ['topic', 'video', 'theory'] },
        target: { type: 'STRING', description: 'Tên hoặc id học liệu.' },
      },
    },
  },
  {
    name: 'delete_quiz',
    description: 'Xóa bài kiểm tra qua đúng luồng xóa của app. Chỉ xóa khi giáo viên nói rõ.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', description: 'Tên hoặc id bài kiểm tra.' },
      },
    },
  },
  {
    name: 'delete_question',
    description: 'Xóa câu hỏi khỏi ngân hàng của giáo viên qua đúng luồng xóa của app. Chỉ xóa khi giáo viên nói rõ.',
    parameters: {
      type: 'OBJECT',
      properties: {
        questionId: { type: 'STRING' },
      },
    },
  },
  {
    name: 'render_chart',
    description:
      'Vẽ biểu đồ trong MỘT lần gọi duy nhất: tự lấy dữ liệu thật rồi vẽ luôn, không cần gọi công cụ dữ liệu trước, không cần dataSource/xKey/yKey, không viết bảng chữ thay biểu đồ. loai = loại biểu đồ: tong_quan_lop (số học sinh từng lớp), tien_do_hoc_sinh (tiến độ theo chủ đề của 1 học sinh — cần tenHocSinh), pho_diem (phân bố điểm, kèm hàng Chưa có điểm), hoat_dong (điểm danh theo tuần), so_sanh_chu_de (điểm TB từng chủ đề). Số liệu lấy từ kết quả công cụ — không tự cung cấp số.',
    parameters: {
      type: 'OBJECT',
      properties: {
        loai: {
          type: 'STRING',
          enum: ['tong_quan_lop', 'tien_do_hoc_sinh', 'pho_diem', 'hoat_dong', 'so_sanh_chu_de'],
        },
        tenHocSinh: { type: 'STRING', description: 'Tên học sinh, chỉ cần cho loai tien_do_hoc_sinh.' },
        chartType: { type: 'STRING', enum: ['bar', 'line'] },
      },
      required: ['loai'],
    },
  },
];

const SYSTEM_PROMPT = `Bạn là Trợ lý phân tích học tập của Mầm Văn, hỗ trợ giáo viên Ngữ văn hiểu tình hình lớp học TỪ DỮ LIỆU THẬT của hệ thống.

QUY TẮC BẮT BUỘC:
1. Mọi con số trong câu trả lời PHẢI lấy từ kết quả công cụ — tuyệt đối không tự bịa số, không suy đoán số khi chưa gọi công cụ phù hợp.
2. Cần số liệu nào thì gọi công cụ tương ứng trước khi trả lời. Khi câu trả lời có phân breakdown theo nhóm — so sánh/phân bố/xu hướng, hoặc đếm theo trạng thái như đã có điểm vs chưa có điểm — hoặc giáo viên yêu cầu vẽ biểu đồ, hãy gọi render_chart MỘT lần với loai phù hợp (tong_quan_lop / tien_do_hoc_sinh / pho_diem / hoat_dong / so_sanh_chu_de): hàm tự lấy dữ liệu thật rồi vẽ luôn, không cần gọi công cụ dữ liệu trước, không cần dataSource/xKey/yKey, không viết bảng chữ thay biểu đồ. Với pho_diem, series đã kèm hàng "Chưa có điểm" để vẽ cả breakdown đó.
3. Nếu dữ liệu cho thấy mẫu quá ít (0 lượt làm, 0 học sinh có điểm...), phải nói rõ "chưa đủ dữ liệu" và KHÔNG kết luận học sinh yếu/giỏi.
4. Nhận xét học sinh phải kèm bằng chứng cụ thể (lượt làm, điểm TB, khoảng thời gian). Không dán nhãn tiêu cực khi bằng chứng yếu.
5. HÀNH ĐỘNG TRỰC TIẾP (toàn quyền trong phạm vi của giáo viên): khi giáo viên yêu cầu LÀM việc — tạo/xuất bản/gỡ xuất bản/sửa/xóa chủ đề, video, lý thuyết, bài kiểm tra, câu hỏi, bài tập; chấm bài tự luận; duyệt/từ chối yêu cầu quà — thì gọi NGAY công cụ ghi tương ứng, không xin xác nhận thêm, không xin lỗi vì quyền, không từ chối vì quyền trong phạm vi dữ liệu của giáo viên. Sau mỗi hành động, báo kết quả cụ thể: đã tạo/cập nhật/xóa cái gì, tiêu đề, id. Mọi công cụ ghi đều đối chiếu tên/id với dữ liệu của giáo viên trước khi làm; nếu công cụ trả lỗi "không tìm thấy trong phạm vi" thì báo đúng lỗi đó và gợi ý tên đúng trong phạm vi, không đoán id. Việc nào chưa có công cụ ghi thì nói rõ giới hạn đó + chuẩn bị sẵn nội dung để giáo viên bấm một lần là xong, tuyệt đối không bắt giáo viên tự làm lại từ đầu.
5b. KHÔNG hỏi ngược lại kiểu "thầy/cô muốn xem lớp nào/chủ đề nào" khi câu hỏi không nêu cụ thể: bộ lọc chung hiện tại CHÍNH LÀ phạm vi trả lời (để "Tất cả các lớp" nghĩa là mọi lớp của giáo viên; giáo viên có thể chỉ quản lý đúng 1 lớp). Cứ gọi công cụ theo đúng bộ lọc hiện tại, trả lời luôn và ghi rõ phạm vi đã áp dụng. Chỉ hỏi lại khi câu hỏi thật sự không xác định được cần số liệu gì.
5c. Khi giáo viên hỏi TÊN học sinh ở một mức điểm (vd "điểm khá là những ai", "em biết tên học sinh điểm khá đó không"), gọi get_score_distribution rồi trả lời bằng tên thật + điểm TB lấy từ danh sách hocSinh của khoảng đó — tuyệt đối không xin lỗi vì "công cụ không cung cấp tên" hay "không có quyền xem tên", vì công cụ đã trả tên.
5d. Tên lớp/chủ đề/học sinh/bài tập mơ hồ hoặc không tìm thấy: dùng công cụ liệt kê (list_class_students, list_topics, list_quizzes, list_assignments, list_questions) để đối chiếu rồi báo lại danh sách đúng trong phạm vi cho giáo viên chọn — không tự đoán đối tượng.
5e. Khi giáo viên hỏi ĐẾM theo trạng thái (vd "lớp 7A4 có bao nhiêu học sinh chưa có điểm", "mấy em chưa nộp bài"), gọi công cụ tương ứng — với chưa có điểm thì gọi get_score_distribution rồi TRẢ LỜI TRỰC TIẾP con số soHocSinhChuaCoDiem kèm tên trong hocSinhChuaCoDiem (gọi thêm list_class_students nếu cần tổng số lớp) — tuyệt đối không né sang đề nghị khác, không xin lỗi vì "không vẽ được" hay "không có quyền". Nếu giáo viên yêu cầu vẽ (vd "vẽ sơ đồ", "vẽ biểu đồ") hoặc câu trả lời có breakdown, gọi render_chart MỘT lần với loai phù hợp (không gọi công cụ dữ liệu trước).
5f. KHÔNG dùng câu "Em xin lỗi, em không thể..." với bất kỳ yêu cầu nào NẰM TRONG phạm vi công cụ: dữ liệu lớp mình, trả lời đếm/liệt kê/tên, vẽ biểu đồ từ dữ liệu có được, và mọi việc ghi đã có công cụ — phải làm luôn (trả lời + vẽ nếu được yêu cầu). Chỉ từ chối khi yêu cầu THỰC SỰ ngoài phạm vi (dữ liệu giáo viên khác, quản trị hệ thống, việc chưa có công cụ) — và khi đó từ chối ngắn gọn trong 1 câu + nói rõ việc thay thế làm được ngay (kèm nội dung chuẩn bị sẵn nếu là việc ghi chưa có công cụ).
5g. "Vẽ sơ đồ tổng quan học sinh" LUÔN vẽ được: gọi render_chart MỘT lần với loai = tien_do_hoc_sinh + tenHocSinh (hàm tự lấy hồ sơ rồi vẽ cột % hoàn thành theo chủ đề: chuDe × phanTramHoanThanh). TUYỆT ĐỐI không nói công cụ thiếu trường — tienDoChuDe sinh ra chính cho việc này. Nếu hồ sơ không có dữ liệu chủ đề nào thì nói ngắn "chưa đủ dữ liệu" + hiện phần văn bản, không xin lỗi kiểu từ chối.
5h. Tham chiếu mơ hồ không có tên: "học sinh này", "em đó", "bạn đó" mà hội thoại hiện tại chưa gọi tên học sinh nào thì HỎI LẠI học sinh nào — tuyệt đối không gọi công cụ với tên đoán mò hoặc tên rỗng (tên rỗng làm API lỗi).
6. Trả lời tiếng Việt, ngắn gọn, rõ cấu trúc (đoạn ngắn hoặc gạch đầu dòng). Xưng "em", gọi người dùng là "thầy/cô".
7. Cuối MỖI câu trả lời, thêm một khối đúng định dạng sau (tối đa 3 câu hỏi gợi ý liên quan trực tiếp tới điều vừa phân tích):
GOI_Y:
- <câu hỏi gợi ý 1>
- <câu hỏi gợi ý 2>

Phạm vi dữ liệu: toàn bộ dữ liệu của giáo viên đang đăng nhập (các lớp/học sinh thuộc quyền quản lý của giáo viên đó) — đây là phạm vi toàn quyền của cô, không giới hạn thêm. Các công cụ chỉ trả về dữ liệu trong phạm vi này nên không bao giờ lộ dữ liệu của giáo viên khác. Mặc định áp dụng bộ lọc chung của trang Phân tích (6 tuần gần nhất) trừ khi giáo viên hỏi khoảng khác.`;

async function callProxyWithTools(
  contents: any[],
  declarations: any[] | undefined
): Promise<any> {
  // Đợt 25/10: trợ lý gọi qua proxy admin — failover và key nằm ở server,
  // trình duyệt chỉ gửi contents + system prompt + tool declarations.
  // Proxy trả đúng shape Gemini generateContent nên vòng lặp tool bên dưới
  // không đổi (parts.functionCall → executeTool → parts.functionResponse
  // role 'function').
  const body: any = {
    contents,
    systemInstruction: SYSTEM_PROMPT,
    tools: declarations && declarations.length ? [{ functionDeclarations: declarations }] : undefined,
  };
  const json = await callAiProxy(body);
  if (!json?.candidates?.[0]) {
    const err: any = new Error('EMPTY_RESPONSE');
    throw err;
  }
  return json;
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
 * Chọn tool theo câu hỏi (tiết kiệm token + tránh chạm trần TPM của gói
 * free): gửi cả 33 tool mỗi lần tốn ~3500 tokens/call, trong khi 1 câu
 * hỏi thường chỉ cần 1–4 tool. Khớp từ khóa trên câu hỏi mới nhất (bỏ
 * dấu, khớp theo từ để khỏi nhận nhầm: 'kha' không khớp 'khac',
 * 'diem' không khớp 'diem danh').
 * - Trả về null = không khớp gì → gửi đủ 33 tool (an toàn cho câu lạ,
 * câu nối tiếp, câu mơ hồ).
 * - Trả về [] = chỉ chào hỏi → không gửi tool nào (trả lời text 1 vòng).
 * - render_chart không bao giờ đứng một mình: luôn kèm các tool dữ liệu
 * vẽ được (điểm, tổng quan, hồ sơ, so sánh, hoạt động).
 */
function normalizeQuery(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

const TOOL_KEYWORDS: [string, string[]][] = [
  ['danh sach hoc sinh', ['list_class_students']],
  ['hoc sinh', ['list_class_students']],
  ['lop', ['list_class_students', 'get_class_summary']],
  ['si so', ['list_class_students', 'get_class_summary']],
  ['tong quan', ['get_class_summary']],
  ['tinh hinh lop', ['get_class_summary']],
  ['pho diem', ['get_score_distribution']],
  ['chua co diem', ['get_score_distribution']],
  ['chua dat', ['get_score_distribution']],
  ['diem', ['get_score_distribution']],
  ['so sanh', ['compare_topics']],
  ['chu de', ['compare_topics', 'list_topics']],
  ['cau hoi', ['get_question_analysis', 'list_questions']],
  ['ngan hang', ['list_questions']],
  ['ho so', ['get_student_profile']],
  ['tien do', ['get_student_profile']],
  ['diemdanh', ['get_learning_activity']],
  ['hoat dong', ['get_learning_activity']],
  ['phut hoc', ['get_learning_activity']],
  ['tu luan', ['list_pending_essays', 'get_essay_detail', 'grade_essay']],
  ['bai viet', ['list_pending_essays', 'get_essay_detail']],
  ['cham bai', ['list_pending_essays', 'grade_essay', 'list_pending_reviews', 'grade_pending_review']],
  ['cho cham', ['list_pending_essays', 'list_pending_reviews']],
  ['phieu', ['list_pending_reviews', 'grade_pending_review']],
  ['cho duyet', ['list_pending_reviews', 'list_reward_requests']],
  ['doi qua', ['list_reward_requests', 'approve_reward_request', 'reject_reward_request']],
  ['duyet qua', ['list_reward_requests', 'approve_reward_request']],
  ['tu choi qua', ['list_reward_requests', 'reject_reward_request']],
  ['yeu cau qua', ['list_reward_requests']],
  ['ruong', ['list_reward_requests', 'approve_reward_request', 'reject_reward_request']],
  ['phan thuong', ['list_reward_requests', 'approve_reward_request', 'reject_reward_request']],
  ['tao chu de', ['create_topic', 'list_topics']],
  ['tao video', ['create_video_draft', 'list_topics']],
  ['video', ['create_video_draft', 'list_topics']],
  ['ly thuyet', ['create_theory_draft', 'list_topics']],
  ['tao bai kiem tra', ['create_quiz', 'list_quizzes']],
  ['bai kiem tra', ['list_quizzes', 'create_quiz', 'publish_quiz']],
  ['kiem tra', ['list_quizzes', 'create_quiz', 'publish_quiz']],
  ['tao cau hoi', ['create_question', 'list_questions']],
  ['xuat ban', ['publish_content', 'publish_quiz']],
  ['go xuat ban', ['unpublish_content']],
  ['an bai', ['unpublish_content']],
  ['bai tap', ['list_assignments', 'create_assignment', 'update_assignment']],
  ['giao bai', ['create_assignment', 'list_assignments']],
  ['tao bai tap', ['create_assignment', 'list_questions']],
  ['xoa', ['delete_content', 'delete_quiz', 'delete_question']],
  ['tao', ['create_topic', 'create_video_draft', 'create_theory_draft', 'create_quiz', 'create_question']],
  ['bieu do', ['render_chart']],
  ['ve bieu do', ['render_chart']],
  ['so do', ['render_chart']],
];

const CHARTABLE_TOOLS = [
  'get_score_distribution',
  'get_class_summary',
  'get_student_profile',
  'compare_topics',
  'get_learning_activity',
];

// ĐỢT 5 (26/10): số liệu không có bằng chứng tool — phần trăm, phân số,
// số kèm đơn vị đo (XP/điểm/bài/học sinh/em). Câu hỏi đã chọn tool mà model
// trả toàn chữ không gọi tool nào, lại chứa mẫu này thì số đó là bịa:
// khung chat hiện 'chưa đủ dữ liệu' thay cho câu đó. Câu chào (không chọn
// tool), câu nối tiếp không khớp từ khóa (gửi đủ 33 tool, có thể trả từ
// lịch sử) và câu không có số thì không bị chặn.
const UNGROUNDED_NUMBER_RE =
  /(\d+\s*%|\d+\s*\/\s*\d+|\d[\d.,]*\s*(XP|điểm|bài|học sinh|em\b))/i;

export function isUngroundedDataAnswer(
  text: string,
  toolRunCount: number,
  routed: any[] | null
): boolean {
  if (toolRunCount > 0) return false;
  if (!routed || routed.length === 0) return false;
  return UNGROUNDED_NUMBER_RE.test(text);
}

export function selectToolsForQuery(latestUserText: string): any[] | null {
  const raw = normalizeQuery(latestUserText).replace(/\s+/g, ' ').trim();
  if (/^(xin chao|hi|hello|chao|chao thay|chao co)[\s!.?]*$/.test(raw)) return [];
  // 'diem danh' là 1 cụm riêng — gộp lại để 'diem' không khớp nhầm vào nó.
  // (Từ khóa cũng viết dạng gộp 'diemdanh' cho khớp với text đã gộp.)
  const text = ` ${raw.replace(/diem danh/g, 'diemdanh')} `;
  const picked = new Set<string>();
  for (const [kw, tools] of TOOL_KEYWORDS) {
    if (text.includes(` ${kw} `) || text.includes(` ${kw},`) || text.includes(` ${kw}.`) || text.includes(` ${kw}?`)) {
      for (const t of tools) picked.add(t);
    }
  }
  if (picked.size === 0) return null;
  if (picked.has('render_chart')) {
    // Vẽ luôn cần dữ liệu: kèm các tool dữ liệu vẽ được để model tự lấy.
    for (const t of CHARTABLE_TOOLS) picked.add(t);
  }
  const out: any[] = [];
  for (const d of FUNCTION_DECLARATIONS) {
    if (picked.has(d.name)) out.push(d);
  }
  return out;
}

/**
 * Chạy một lượt hỏi–đáp của trợ lý: mô hình chọn công cụ, hệ thống chạy
 * hàm tính thật, mô hình diễn đạt lại kèm bằng chứng.
 */
export async function askAnalyticsAssistant(
  history: { role: 'user' | 'assistant'; text: string }[],
  ctx: AssistantContext
): Promise<AssistantReply> {
  // Đợt 25/10: không còn key giáo viên, không còn chuỗi model ở client —
  // failover Gemini → Groq → OpenRouter nằm ở proxy /api/ai/chat.

  const contents: any[] = history.map((h) => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.text }],
  }));

  // Tiết kiệm token: lượt này chỉ gửi tool khớp câu hỏi mới nhất (null =
  // không khớp → gửi đủ, [] = chỉ chào hỏi → không gửi tool nào).
  const lastUser = [...history].reverse().find((h) => h.role === 'user');
  const routed = selectToolsForQuery(lastUser?.text || '');
  const turnDecls = routed ?? FUNCTION_DECLARATIONS;

  const toolRuns: AssistantToolRun[] = [];
  let chart: AssistantChart | undefined;
  let lastError: any = null;

  // ĐỢT 5 (26/10): chặn số bịa — câu trả lời không kèm kết quả tool thật
  // mà chứa số liệu thì bỏ câu đó, hiện 'chưa đủ dữ liệu' (kèm gợi ý hỏi
  // lại/nêu tên), và bỏ luôn gợi ý nối tiếp sinh ra từ câu bịa đó.
  const guardReply = (parsed: {
    text: string;
    followups: string[];
  }): AssistantReply => {
    if (isUngroundedDataAnswer(parsed.text, toolRuns.length, routed)) {
      return {
        text: 'Chưa đủ dữ liệu để trả lời câu này. Thầy/cô thử hỏi lại hoặc nêu rõ tên học sinh/chủ đề giúp em.',
        toolRuns,
        chart,
        followups: [],
      };
    }
    return { text: parsed.text, toolRuns, chart, followups: parsed.followups };
  };

  try {
      // Tối đa 5 vòng gọi hàm cho mỗi câu hỏi
      for (let round = 0; round < 5; round++) {
        const res = await callProxyWithTools(contents, turnDecls);
        const parts = res?.candidates?.[0]?.content?.parts || [];
        const calls = parts.filter((p: any) => p.functionCall);
        const textPart = parts.find((p: any) => typeof p.text === 'string')?.text as
          | string
          | undefined;

        if (calls.length === 0) {
          if (textPart) {
            const parsed = parseFollowups(textPart);
            return guardReply(parsed);
          }
          throw new Error('EMPTY_RESPONSE');
        }

        contents.push({ role: 'model', parts });
        const responseParts: any[] = [];
        for (const callPart of calls) {
          const { name, args } = callPart.functionCall || {};
          if (name === 'render_chart') {
            // ĐỢT 6 (26/10): 1 lần gọi là xong — hàm tự chạy công cụ dữ
            // liệu trong code rồi vẽ luôn, model không cần gọi 2 lần hay
            // khai dataSource/xKey/yKey.
            const mapping = CHART_LOAI_TO_TOOL[args?.loai as string];
            if (!mapping) {
              responseParts.push({
                functionResponse: {
                  name,
                  response: {
                    result: {
                      daVe: false,
                      coBieuDo: false,
                      lyDo: 'Loại biểu đồ chưa hỗ trợ, chọn trong: tong_quan_lop, tien_do_hoc_sinh, pho_diem, hoat_dong, so_sanh_chu_de.',
                    },
                  },
                },
              });
              continue;
            }
            const dataArgs: any = {};
            if (mapping.argName && args?.tenHocSinh) dataArgs[mapping.argName] = args.tenHocSinh;
            const chartOutcome = await executeTool(mapping.tool, dataArgs, ctx);
            const series = chartOutcome.series;
            let drew = false;
            if (series && series.rows.length > 0) {
              drew = true;
              chart = {
                type: args.chartType === 'line' ? 'line' : series.defaultType,
                title: TOOL_LABELS[mapping.tool] || 'Biểu đồ',
                rows: series.rows,
                xKey: series.xKey,
                yKey: series.yKey,
                yLabel: series.yLabel,
              };
            }
            toolRuns.push({ name, label: TOOL_LABELS[name] || name, evidence: chartOutcome.evidence });
            responseParts.push({
              functionResponse: {
                name,
                response: { result: { ...chartOutcome.data, daVe: drew, coBieuDo: drew } },
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
          responseParts.push({
            functionResponse: { name, response: { result: outcome.data } },
          });
        }
        // Chuẩn Gemini API: functionResponse PHẢI nằm trong Content role
        // 'function' — gửi kèm role 'user' là sai chuẩn và là nghi phạm số 1
        // cho lỗi 500 "Internal error encountered" ở lượt gọi sau khi có kết
        // quả công cụ (25/10). Chỉ đổi role của push này; history ban đầu
        // giữ role 'user', parts của model giữ role 'model'.
        contents.push({ role: 'function', parts: responseParts });
      }

      // Hết vòng gọi hàm mà chưa có câu trả lời: ép mô hình trả lời bằng
      // dữ liệu đã có (không kèm công cụ nữa).
      const finalRes = await callProxyWithTools(contents, undefined);
      const finalText =
        finalRes?.candidates?.[0]?.content?.parts?.find(
          (p: any) => typeof p.text === 'string'
        )?.text || 'Em đã truy vấn dữ liệu nhưng chưa diễn đạt được kết quả. Thầy/cô thử hỏi lại giúp em.';
      const parsed = parseFollowups(finalText);
      return guardReply(parsed);
    } catch (err: any) {
      lastError = err;
      // 400/INVALID_ARGUMENT (25/10): thử lại CÙNG contents qua model khác
      // vô ích — model nào cũng 400, chỉ làm quay lâu rồi hiện hộp đỏ với
      // text API thô. Dừng chuỗi ngay, trả câu hỏi làm rõ để giáo viên gửi
      // lại thay vì retry.
      const errMsg = String(err?.message || '');
      if (err?.status === 400 || /invalid argument/i.test(errMsg)) {
        return {
          text: 'Yêu cầu vừa rồi không hợp lệ nên em không truy vấn được. Thầy/cô thử nói rõ hơn (vd tên học sinh, lớp hoặc chủ đề cần xem) rồi gửi lại giúp em.',
          toolRuns,
          chart,
          followups: [],
        };
      }
      // Không còn chuỗi model để thử tiếp (failover nằm ở proxy) — mọi
      // lỗi không phải 400 đều rơi xuống throw lastError bên dưới.
    }
  throw lastError || new Error('Không kết nối được AI.');
}
