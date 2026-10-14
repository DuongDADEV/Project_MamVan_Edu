import React, { useState, useMemo } from 'react';
import {
  Users,
  BookOpenCheck,
  PenTool,
  Gift,
  ArrowRight,
  PlusCircle,
  Clock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { TeacherNavTab } from '../../components/teacher/TeacherSidebar.tsx';
import { AuditLog, ClassItem, StudentAccount } from '../../services/types.ts';
import { StudentState, EssaySubmission, RewardRequest } from '../../types.ts';
import { MamMuc } from '../../components/MamMuc.tsx';
import { AnalyticsFilter, GlobalAnalyticsFilter } from '../../analytics/types.ts';
import { AnalyticsFilterBar } from '../../components/teacher/analytics/AnalyticsFilterBar.tsx';
import { AccessibleChartWrapper } from '../../components/teacher/analytics/AccessibleChartWrapper.tsx';
import {
  computeOverviewMetrics,
  detectStudentsNeedingAttention,
  generatePedagogicalInsights,
} from '../../analytics/metricsEngine.ts';
import { computeMasteryDistribution } from '../../analytics/masteryAnalytics.ts';
import { computeDailyALT, computeTopicProgressList } from '../../analytics/engagementAnalytics.ts';

interface TeacherOverviewScreenProps {
  teacherName: string;
  classes: ClassItem[];
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  topics: Array<{ id: string; title: string }>;
  essays: EssaySubmission[];
  rewards: RewardRequest[];
  auditLogs: AuditLog[];
  onNavigateTab: (tab: TeacherNavTab) => void;
  onOpenAddStudentModal: () => void;
  onOpenStudentDossier: (studentId: string) => void;
}

const DEFAULT_FILTERS: GlobalAnalyticsFilter = {
  classIds: [],
  timeRange: '6w',
  topicId: 'all',
  studentIds: [],
  skillLevels: ['NHAN_BIET', 'THONG_HIEU', 'PHAN_TICH', 'VAN_DUNG'],
  activityType: 'all',
};

// Bảng màu Giấy & Mực thanh nhã, sư phạm
const PALETTE = {
  muc: '#2F3E6B', // Chàm mực
  datNung: '#E2704A', // Đất nung
  timHue: '#8B5CF6', // Tím huế
  xanhMa: '#10B981', // Xanh mạ
  vangNghe: '#F59E0B', // Vàng nghệ
  giayNga: '#FAF5EB', // Giấy ngà
  trangGiay: '#FFFDF8', // Trang giấy
  xamNhat: '#9CA3AF',
};

export const TeacherOverviewScreen: React.FC<TeacherOverviewScreenProps> = ({
  teacherName,
  classes,
  students,
  studentStates,
  topics,
  essays,
  rewards,
  auditLogs,
  onNavigateTab,
  onOpenAddStudentModal,
  onOpenStudentDossier,
}) => {
  // Quản lý bộ lọc chung (lưu phiên tạm thời)
  const [filters, setFilters] = useState<GlobalAnalyticsFilter>(() => {
    try {
      const saved = sessionStorage.getItem('mam_van_overview_filters');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_FILTERS;
  });

  const handleUpdateFilters = (newFilters: GlobalAnalyticsFilter) => {
    setFilters(newFilters);
    try {
      sessionStorage.setItem('mam_van_overview_filters', JSON.stringify(newFilters));
    } catch (e) {
      // ignore
    }
  };

  const handleResetFilters = () => {
    handleUpdateFilters(DEFAULT_FILTERS);
  };

  // 1. Tính toán 6 thẻ số liệu tổng quan với so sánh kỳ trước (+/- %)
  const overviewMetrics = useMemo(() => {
    return computeOverviewMetrics(studentStates, students, filters, essays, rewards);
  }, [students, studentStates, filters, essays, rewards]);

  // 2. Tự động nhận diện học sinh cần quan tâm sư phạm
  const attentionStudents = useMemo(() => {
    return detectStudentsNeedingAttention(studentStates, students, topics as any, filters, classes);
  }, [studentStates, students, topics, filters, classes]);

  // 3. Tự động sinh nhận xét sư phạm 3-5 câu
  const pedagogicalInsights = useMemo(() => {
    return generatePedagogicalInsights(studentStates, topics as any, filters);
  }, [studentStates, topics, filters]);

  // 4. Dữ liệu biểu đồ 1: Xu hướng thời gian học tích cực theo ngày (LineChart)
  const dailyEngagement = useMemo(() => {
    return computeDailyALT(studentStates, students, filters);
  }, [students, studentStates, filters]);

  // 5. Dữ liệu biểu đồ 2: Phân bổ trạng thái Mastery của lớp (Stacked BarChart)
  const masteryDistribution = useMemo(() => {
    return computeMasteryDistribution(studentStates, students, filters);
  }, [students, studentStates, filters]);

  // 6. Dữ liệu biểu đồ 3: Tiến độ hoàn thành theo chủ đề (Horizontal BarChart)
  const topicProgress = useMemo(() => {
    return computeTopicProgressList(studentStates, students, topics, filters);
  }, [students, studentStates, topics, filters]);

  return (
    <div className="space-y-6 pb-12">
      {/* LỜI CHÀO & BANNER GIẤY & MỰC */}
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#7FA88A]/10 via-[#F2B84B]/10 to-transparent rounded-bl-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-semibold text-[#2F3E6B] mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#E2704A]" />
              <span>
                {filters.classIds.length === 0
                  ? 'Tổng quan toàn trường'
                  : `Đang lọc: ${filters.classIds
                      .map((id: string) => classes.find((c) => c.id === id)?.name || id)
                      .join(', ')}`}
              </span>
            </div>

            <h1 className="font-lora text-2xl sm:text-3xl font-extrabold text-[#2F3E6B] tracking-tight leading-snug">
              Chào thầy {teacherName}!
            </h1>
            <p className="text-sm text-[#4B5563] mt-2 leading-relaxed font-normal">
              Chào mừng thầy trở lại bàn làm việc. Dưới đây là bức tranh toàn cảnh 6 tuần học tập của các em học sinh, được tổng hợp tức thì từ từng câu hỏi, bài viết và phút học tích cực.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <MamMuc mood="happy" size="md" className="hidden sm:block" />
            <button
              onClick={onOpenAddStudentModal}
              className="px-5 py-3 rounded-2xl bg-[#E2704A] hover:bg-[#D45E36] text-white font-bold text-sm shadow-md shadow-[#E2704A]/25 transition-all flex items-center gap-2 active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm học sinh mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* BỘ LỌC CHUNG CỐ ĐỊNH PHÍA TRÊN */}
      <AnalyticsFilterBar
        classes={classes}
        students={students}
        topics={topics}
        filters={filters}
        onChangeFilters={handleUpdateFilters}
        onResetFilters={handleResetFilters}
      />

      {/* 6 THẺ SỐ LIỆU TỔNG QUAN (CÓ SO SÁNH KỲ TRƯỚC) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Thẻ 1: Học sinh hoạt động 7 ngày qua */}
        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-[#2F3E6B]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Hoạt động 7 ngày</span>
            <div className="w-8 h-8 rounded-xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-lora text-[#2F3E6B]">
              {overviewMetrics.active7DaysCount}
              <span className="text-xs text-[#9CA3AF] font-sans font-normal ml-1">
                /{students.length} em
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {overviewMetrics.active7DaysDiffPercent >= 0 ? (
                <span className="text-[#10B981] font-semibold flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                  +{overviewMetrics.active7DaysDiffPercent}%
                </span>
              ) : (
                <span className="text-[#EF4444] font-semibold flex items-center">
                  <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                  {overviewMetrics.active7DaysDiffPercent}%
                </span>
              )}
              <span className="text-[#9CA3AF] text-[11px]">so với tuần trước</span>
            </div>
          </div>
        </div>

        {/* Thẻ 2: Tỉ lệ hoàn thành bài được giao */}
        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-[#2F3E6B]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Hoàn thành bài tập</span>
            <div className="w-8 h-8 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
              <BookOpenCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-lora text-[#2F3E6B]">
              {overviewMetrics.completionRatePercent}%
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {overviewMetrics.completionRateDiffPercent >= 0 ? (
                <span className="text-[#10B981] font-semibold flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                  +{overviewMetrics.completionRateDiffPercent}%
                </span>
              ) : (
                <span className="text-[#EF4444] font-semibold flex items-center">
                  <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                  {overviewMetrics.completionRateDiffPercent}%
                </span>
              )}
              <span className="text-[#9CA3AF] text-[11px]">so với kỳ trước</span>
            </div>
          </div>
        </div>

        {/* Thẻ 3: Điểm trung bình */}
        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-[#2F3E6B]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Điểm trung bình</span>
            <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/15 text-[#D97706] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-lora text-[#2F3E6B]">
              {overviewMetrics.averageScore > 0 ? overviewMetrics.averageScore : '—'}
              <span className="text-xs text-[#9CA3AF] font-sans font-normal ml-1">/10</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {overviewMetrics.averageScoreDiff >= 0 ? (
                <span className="text-[#10B981] font-semibold flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                  +{overviewMetrics.averageScoreDiff}
                </span>
              ) : (
                <span className="text-[#EF4444] font-semibold flex items-center">
                  <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                  {overviewMetrics.averageScoreDiff}
                </span>
              )}
              <span className="text-[#9CA3AF] text-[11px]">điểm</span>
            </div>
          </div>
        </div>

        {/* Thẻ 4: Thời gian học tích cực TB / tuần */}
        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-[#2F3E6B]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Học tích cực TB/tuần</span>
            <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-lora text-[#2F3E6B]">
              {overviewMetrics.avgActiveMinutesPerWeek}
              <span className="text-xs text-[#9CA3AF] font-sans font-normal ml-1">phút</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {overviewMetrics.avgActiveMinutesDiff >= 0 ? (
                <span className="text-[#10B981] font-semibold flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                  +{overviewMetrics.avgActiveMinutesDiff}%
                </span>
              ) : (
                <span className="text-[#EF4444] font-semibold flex items-center">
                  <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                  {overviewMetrics.avgActiveMinutesDiff}%
                </span>
              )}
              <span className="text-[#9CA3AF] text-[11px]">so với tuần trước</span>
            </div>
          </div>
        </div>

        {/* Thẻ 5: Bài viết chờ chấm */}
        <div
          onClick={() => onNavigateTab('grading')}
          className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-[#E2704A] cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Bài viết chờ chấm</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                overviewMetrics.pendingGradingCount > 0
                  ? 'bg-[#E2704A]/15 text-[#E2704A]'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <PenTool className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-lora text-[#2F3E6B] flex items-center justify-between">
              <span>{overviewMetrics.pendingGradingCount}</span>
              <ArrowRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#E2704A] group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-[11px] text-[#6B7280] mt-1">
              {overviewMetrics.pendingGradingCount > 0 ? 'Cần duyệt & cho lời khuyên' : 'Đã chấm xong'}
            </p>
          </div>
        </div>

        {/* Thẻ 6: Yêu cầu quà chờ duyệt */}
        <div
          onClick={() => onNavigateTab('rewards')}
          className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-[#F59E0B] cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Quà chờ duyệt</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                overviewMetrics.pendingRewardCount > 0
                  ? 'bg-[#F59E0B]/20 text-[#D97706]'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-lora text-[#2F3E6B] flex items-center justify-between">
              <span>{overviewMetrics.pendingRewardCount}</span>
              <ArrowRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#D97706] group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-[11px] text-[#6B7280] mt-1">
              {overviewMetrics.pendingRewardCount > 0 ? 'Đổi bookmark, bút, sticker' : 'Đã duyệt hết'}
            </p>
          </div>
        </div>
      </div>

      {/* KHỐI 2 CỘT: CẦN CHÚ Ý & NHẬN XÉT TỰ ĐỘNG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (7 phần): Danh sách tự động Cần chú ý */}
        <div className="lg:col-span-7 bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E2704A]/10 text-[#E2704A] flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                  Học sinh cần quan tâm ({attentionStudents.length})
                </h3>
              </div>
              <span className="text-[11px] text-[#78716C] bg-[#FAF5EB] px-2.5 py-1 rounded-full border border-[#E6DCC8]">
                Tự động phát hiện
              </span>
            </div>

            <p className="text-xs text-[#78716C] italic mt-2.5 mb-3">
              Ghi chú: Đây là danh sách gợi ý từ thuật toán để giáo viên cân nhắc theo dõi, không phải là kết luận đánh giá học lực của học sinh.
            </p>

            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {attentionStudents.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#78716C]">
                  Hiện tại không có học sinh nào gặp vấn đề cần lưu ý đặc biệt.
                </div>
              ) : (
                attentionStudents.map((st) => (
                  <div
                    key={st.studentId}
                    onClick={() => onOpenStudentDossier(st.studentId)}
                    className="p-3.5 rounded-2xl bg-[#FAF5EB]/60 hover:bg-[#FAF5EB] border border-[#E6DCC8]/80 hover:border-[#2F3E6B]/30 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#2F3E6B] text-[#FFFDF8] flex items-center justify-center font-bold text-xs shrink-0">
                        {st.studentName.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#2F3E6B] group-hover:text-[#E2704A] transition-colors truncate">
                            {st.studentName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFFDF8] border border-[#E6DCC8] text-[#78716C]">
                            Lớp {st.className}
                          </span>
                        </div>
                        <p className="text-xs text-[#E2704A] font-medium mt-0.5 line-clamp-1">
                          {st.reasonTag}: {st.reasonDetail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-[#2F3E6B] font-semibold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                        Xem hồ sơ
                      </span>
                      <ExternalLink className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#2F3E6B] group-hover:scale-110 transition-all" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E6DCC8]/60 text-right">
            <button
              type="button"
              onClick={() => onNavigateTab('analytics')}
              className="text-xs font-bold text-[#2F3E6B] hover:text-[#E2704A] inline-flex items-center gap-1"
            >
              <span>Xem phân tích chi tiết toàn lớp</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Cột phải (5 phần): Nhận xét tự động bằng luật */}
        <div className="lg:col-span-5 bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6DCC8]">
              <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/15 text-[#D97706] flex items-center justify-center">
                <Lightbulb className="w-4 h-4" />
              </div>
              <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                Nhận xét sư phạm tự động
              </h3>
            </div>

            <p className="text-xs text-[#78716C] mt-2 mb-4">
              Hệ thống tự động phát hiện các quy luật nổi bật trong tuần qua để hỗ trợ thầy cô lập kế hoạch bài giảng tiếp theo:
            </p>

            <div className="space-y-3">
              {pedagogicalInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="flex items-start gap-3 p-3 rounded-2xl bg-[#FAF5EB]/50 border border-[#E6DCC8]/60 text-xs leading-relaxed text-[#2F3E6B]"
                >
                  <span className="w-5 h-5 rounded-full bg-[#2F3E6B]/10 text-[#2F3E6B] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    •
                  </span>
                  <span>{insight.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 rounded-2xl bg-[#7FA88A]/10 border border-[#7FA88A]/30 flex items-center gap-2 text-xs text-[#2E5E3D]">
            <CheckCircle2 className="w-4 h-4 text-[#2E5E3D] shrink-0" />
            <span>
              Mọi nhận xét được tính toán trực tiếp từ kho dữ liệu, bảo đảm khách quan và tức thì.
            </span>
          </div>
        </div>
      </div>

      {/* 3 BIỂU ĐỒ TỔNG QUAN RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ 1: Xu hướng thời gian học tích cực theo ngày (LineChart) */}
        <AccessibleChartWrapper
          title="Thời gian học tích cực theo ngày"
          subtitle="Tổng số phút cả lớp học tập tập trung trong từng ngày"
          unitNote="Phút/ngày"
          empty={dailyEngagement.length === 0}
          tableData={dailyEngagement}
          tableColumns={[
            { key: 'dateLabel', label: 'Ngày' },
            { key: 'activeMinutes', label: 'Tổng số phút' },
            { key: 'studentActiveCount', label: 'Số học sinh tham gia' },
          ]}
          exportFileName="thoi_gian_hoc_tich_cuc_ngay"
          pedagogicalNote="Thời gian tích cực chỉ tính khi học sinh đang tương tác (làm bài, rê chuột, gõ văn bản), không tính thời gian treo máy."
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyEngagement} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFDF8',
                  borderColor: '#E6DCC8',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  fontSize: '12px',
                  color: '#2F3E6B',
                }}
                formatter={(val: any) => [`${val} phút`, 'Thời gian tích cực']}
              />
              <Line
                type="monotone"
                dataKey="activeMinutes"
                name="Tổng phút học"
                stroke={PALETTE.muc}
                strokeWidth={2.5}
                dot={{ r: 3, fill: PALETTE.datNung }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </AccessibleChartWrapper>

        {/* Biểu đồ 2: Phân bổ trạng thái Mastery của lớp (Stacked BarChart) */}
        <AccessibleChartWrapper
          title="Phân bổ Mastery theo 4 mức"
          subtitle="Tỉ lệ % học sinh đạt từng trạng thái năng lực sư phạm"
          unitNote="%"
          empty={masteryDistribution.length === 0}
          tableData={masteryDistribution}
          tableColumns={[
            { key: 'levelName', label: 'Mức năng lực' },
            { key: 'vungPct', label: 'Vững (%)' },
            { key: 'dangTienBoPct', label: 'Đang tiến bộ (%)' },
            { key: 'canOnLaiPct', label: 'Cần ôn lại (%)' },
            { key: 'chuaDuDuLieuPct', label: 'Chưa đủ dữ liệu (%)' },
          ]}
          exportFileName="phan_bo_mastery_lop"
          pedagogicalNote="Diễn giải: Vững (≥75%), Đang tiến bộ (50-74%), Cần ôn lại (<50%), Chưa đủ dữ liệu (<3 lần tương tác)."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={masteryDistribution}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" vertical={false} />
              <XAxis dataKey="levelName" tick={{ fontSize: 11, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFDF8',
                  borderColor: '#E6DCC8',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#2F3E6B',
                }}
                formatter={(val: any, name: any) => [`${val}%`, name]}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
              />
              <Bar dataKey="vungPct" name="Vững" stackId="a" fill={PALETTE.xanhMa} />
              <Bar dataKey="dangTienBoPct" name="Đang tiến bộ" stackId="a" fill={PALETTE.vangNghe} />
              <Bar dataKey="canOnLaiPct" name="Cần ôn lại" stackId="a" fill={PALETTE.datNung} />
              <Bar dataKey="chuaDuDuLieuPct" name="Chưa đủ DL" stackId="a" fill={PALETTE.xamNhat} />
            </BarChart>
          </ResponsiveContainer>
        </AccessibleChartWrapper>

        {/* Biểu đồ 3: Tiến độ hoàn thành theo chủ đề (Horizontal BarChart) */}
        <AccessibleChartWrapper
          title="Tiến độ hoàn thành theo chủ đề"
          subtitle="Tỉ lệ học sinh đã hoàn thành các bước học theo chủ đề"
          unitNote="%"
          empty={topicProgress.length === 0}
          tableData={topicProgress}
          tableColumns={[
            { key: 'topicTitle', label: 'Chủ đề' },
            { key: 'completionRate', label: 'Tỉ lệ hoàn thành (%)' },
            { key: 'completedStudentsCount', label: 'Số học sinh xong' },
          ]}
          exportFileName="tien_do_chu_de"
          pedagogicalNote="Tính dựa trên học sinh đã xem video, đọc lý thuyết và hoàn thành bài kiểm tra của chủ đề."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={topicProgress}
              margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#78716C' }} />
              <YAxis
                dataKey="shortTitle"
                type="category"
                tick={{ fontSize: 11, fill: '#2F3E6B' }}
                width={85}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFDF8',
                  borderColor: '#E6DCC8',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#2F3E6B',
                }}
                formatter={(val: any) => [`${val}%`, 'Tỉ lệ hoàn thành']}
              />
              <Bar dataKey="completionRate" fill={PALETTE.muc} radius={[0, 6, 6, 0]}>
                {topicProgress.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? PALETTE.muc : index === 1 ? PALETTE.timHue : PALETTE.datNung}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AccessibleChartWrapper>
      </div>
    </div>
  );
};
