import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Calendar,
  CalendarCheck,
  Video,
  TrendingDown,
  Info,
  PlayCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { AnalyticsFilter, FunnelStepItem, WeeklyAttendancePoint, VideoAnalyticsSummary } from '../../../analytics/types.ts';
import { ClassItem, StudentAccount } from '../../../services/types.ts';
import { StudentState } from '../../../types.ts';
import { AccessibleChartWrapper } from './AccessibleChartWrapper.tsx';
import {
  computeWeeklyAttendance,
  computeLearningFunnel,
  computeVideoAnalytics,
  computeLongestAttendanceStreak,
} from '../../../analytics/engagementAnalytics.ts';
import { exportToExcel } from '../../../utils/exportUtils.ts';

interface EngagementAnalyticsTabProps {
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  classes?: ClassItem[];
  filters: AnalyticsFilter;
  onSelectStudentDossier: (studentId: string) => void;
}

const PALETTE = {
  muc: '#2F3E6B',
  datNung: '#E2704A',
  timHue: '#8B5CF6',
  xanhMa: '#10B981',
  vangNghe: '#F59E0B',
};

export const EngagementAnalyticsTab: React.FC<EngagementAnalyticsTabProps> = ({
  students,
  studentStates,
  classes,
  filters,
  onSelectStudentDossier,
}) => {
  // 1. Phễu học tập 5 bước
  const funnelData: FunnelStepItem[] = useMemo(() => {
    return computeLearningFunnel(studentStates, students.length);
  }, [studentStates, students.length]);

  // 2. Điểm danh theo tuần
  const weeklyAttendance: WeeklyAttendancePoint[] = useMemo(() => {
    return computeWeeklyAttendance(studentStates, filters);
  }, [studentStates, filters]);

  // 3. Video phân tích tỉ lệ xem >= 80% & điểm nóng xem lại
  const videoStats: VideoAnalyticsSummary = useMemo(() => {
    return computeVideoAnalytics();
  }, []);

  // 4. Bảng học sinh: Thời gian học tích cực & Chuyên cần
  // Phút học tích cực = giây học GHI THẬT trong state (hôm nay + phiên liên tục),
  // cùng nguồn với thẻ Tổng quan. Hệ thống không đo "thời gian mở web" và khái
  // niệm trần XP đã bãi bỏ — không hiển thị hai chỉ số đó nữa; thay bằng chuỗi
  // ngày điểm danh liên tục dài nhất đếm từ attendanceHistory thật.
  const studentRank = useMemo(() => {
    return students.map((s) => {
      const st = studentStates[s.id];
      const activeMinutes = Math.round(
        ((st?.activeSecondsToday || 0) + (st?.activeSecondsContinuous || 0)) / 60
      );
      const attendanceDays = st?.attendanceHistory?.length || 0;

      return {
        studentId: s.id,
        studentName: s.name,
        // Tên lớp tra từ danh sách lớp thật — không gán nhãn lớp bịa theo class_id
        className: (classes || []).find((c) => c.id === s.class_id)?.name || '',
        activeLearningMinutes: activeMinutes,
        attendanceDaysCount: attendanceDays,
        longestStreakDays: computeLongestAttendanceStreak(st?.attendanceHistory),
      };
    }).sort((a, b) => b.activeLearningMinutes - a.activeLearningMinutes);
  }, [students, studentStates, classes]);

  const totalAttendanceDays = useMemo(() => {
    return studentRank.reduce((sum, s) => sum + s.attendanceDaysCount, 0);
  }, [studentRank]);

  // Chưa có học sinh nào trong phạm vi lọc -> chưa có dữ liệu, để null hiện "—"
  // (trước đây mặc định bịa 85%).
  const avgAttendanceRate = useMemo(() => {
    if (students.length === 0 || weeklyAttendance.length === 0) return null;
    const sum = weeklyAttendance.reduce((acc, w) => acc + w.attendanceRate, 0);
    return Math.round(sum / weeklyAttendance.length);
  }, [weeklyAttendance, students.length]);

  const handleExportStudentsEngagement = () => {
    exportToExcel(
      studentRank.map((s) => ({
        'Họ và tên': s.studentName,
        'Lớp': s.className ? `Lớp ${s.className}` : '',
        'Học tích cực (phút)': s.activeLearningMinutes,
        'Số buổi điểm danh': s.attendanceDaysCount,
        'Chuỗi ngày điểm danh liên tục dài nhất (ngày)': s.longestStreakDays,
      })),
      'thoi_gian_hoc_hoc_sinh',
      'Thời gian học & chuyên cần'
    );
  };

  return (
    <div className="space-y-6">
      {/* KHỐI 4 THẺ TỔNG HỢP TƯƠNG TÁC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>Chuyên cần toàn kỳ</span>
            <Calendar className="w-4 h-4 text-[#2F3E6B]" />
          </div>
          <div className="text-2xl font-bold font-lora text-[#2F3E6B] mt-1">
            {avgAttendanceRate === null ? '—' : `${avgAttendanceRate}%`}
          </div>
          <p className="text-[11px] text-[#78716C] mt-0.5">
            {avgAttendanceRate === null
              ? 'Chưa có dữ liệu điểm danh'
              : 'Tỉ lệ tham gia điểm danh trung bình'}
          </p>
        </div>

        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>Tổng số buổi điểm danh</span>
            <CalendarCheck className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-bold font-lora text-[#2F3E6B] mt-1">
            {totalAttendanceDays} buổi
          </div>
          <p className="text-[11px] text-[#78716C] mt-0.5">Tổng số ngày học sinh đã điểm danh trên hệ thống</p>
        </div>

        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>Xem video bài giảng ≥ 80%</span>
            <Video className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-2xl font-bold font-lora text-[#2F3E6B] mt-1">
            {videoStats.completionRateOver80}%
          </div>
          <p className="text-[11px] text-[#78716C] mt-0.5">Tỉ lệ học sinh hoàn thành bài giảng</p>
        </div>

        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>Thời lượng xem video TB</span>
            <PlayCircle className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <div className="text-2xl font-bold font-lora text-[#2F3E6B] mt-1">
            {Math.round(videoStats.averageWatchSeconds / 60)} phút
          </div>
          <p className="text-[11px] text-[#78716C] mt-0.5">Thời gian xem video thực tế</p>
        </div>
      </div>

      {/* KHỐI 1: PHỄU HỌC TẬP 5 BƯỚC & ĐIỂM DANH THEO TUẦN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Phễu học tập 5 bước (7 phần) */}
        <div className="lg:col-span-7 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8] mb-4">
            <div>
              <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                Phễu hoàn thành bài học (5 bước chuẩn)
              </h3>
              <p className="text-xs text-[#78716C] mt-0.5">
                Quan sát xem học sinh rơi rụng hoặc gặp rào cản ở bước nào trong quy trình học
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#FAF5EB] border border-[#E6DCC8] text-[#2F3E6B] font-semibold">
              Quy trình Mầm Văn
            </span>
          </div>

          <div className="space-y-3">
            {funnelData.map((step, idx) => {
              const widthPct = Math.max(15, step.percentage);
              return (
                <div key={step.stepKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#2F3E6B] flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#2F3E6B]/10 text-[#2F3E6B] text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span>{step.stepName}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#78716C]">{step.studentCount} học sinh</span>
                      <span className="font-bold text-[#2F3E6B]">{step.percentage}%</span>
                      {step.dropOffPercentage > 0 && (
                        <span className="text-[#E2704A] text-[11px] font-semibold flex items-center">
                          <TrendingDown className="w-3 h-3 mr-0.5" />
                          -{step.dropOffPercentage}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-4 bg-[#FAF5EB] rounded-full overflow-hidden border border-[#E6DCC8]/60 relative">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor:
                          idx === 0
                            ? PALETTE.muc
                            : idx === 1
                            ? PALETTE.timHue
                            : idx === 2
                            ? PALETTE.xanhMa
                            : idx === 3
                            ? PALETTE.vangNghe
                            : PALETTE.datNung,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[#E6DCC8]/60 flex items-start gap-1.5 text-xs text-[#78716C]">
            <Info className="w-3.5 h-3.5 text-[#E2704A] shrink-0 mt-0.5" />
            <span>
              Bước "Đánh giá năng lực Mastery" dành cho học sinh muốn rèn luyện nâng cao và củng cố thêm sau khi đã hoàn thành các bước cơ bản.
            </span>
          </div>
        </div>

        {/* Điểm danh theo tuần (5 phần) */}
        <div className="lg:col-span-5">
          <AccessibleChartWrapper
            title="Tỉ lệ điểm danh theo tuần"
            subtitle="Độ chuyên cần qua từng tuần học trong kỳ"
            unitNote="%"
            empty={weeklyAttendance.length === 0}
            tableData={weeklyAttendance}
            tableColumns={[
              { key: 'weekLabel', label: 'Tuần học' },
              { key: 'attendanceRate', label: 'Tỉ lệ điểm danh (%)' },
            ]}
            exportFileName="diem_danh_tuan"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={weeklyAttendance}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" vertical={false} />
                <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#78716C' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#78716C' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFDF8',
                    borderColor: '#E6DCC8',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Tỉ lệ điểm danh']}
                />
                <Bar dataKey="attendanceRate" fill={PALETTE.xanhMa} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </AccessibleChartWrapper>
        </div>
      </div>

      {/* KHỐI 2: ĐOẠN VIDEO XEM LẠI NHIỀU & BẢNG SO SÁNH THỜI GIAN HỌC */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Điểm nóng video xem lại nhiều (5 phần) */}
        <div className="lg:col-span-5 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6DCC8] mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center font-bold">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                  Đoạn video học sinh xem lại nhiều
                </h3>
                <p className="text-xs text-[#78716C]">
                  Điểm nóng (Hotspots) cho thấy nội dung kiến thức các em băn khoăn nhiều nhất
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {videoStats.rewatchHotspots.map((hotspot, hIdx) => (
                <div
                  key={hIdx}
                  className="p-3.5 rounded-2xl bg-[#FAF5EB]/60 border border-[#E6DCC8] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#2F3E6B] font-mono">{hotspot.rangeLabel}</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#8B5CF6]/10 text-[#8B5CF6] text-[10px] font-bold">
                      {hotspot.count} lượt xem lại
                    </span>
                  </div>
                  <p className="text-xs text-[#4B5563]">
                    {hotspot.note}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-[#78716C] pt-1">
                    <span className="text-[#E2704A] font-semibold">Cần giải thích thêm trên lớp</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E6DCC8]/60 text-xs text-[#78716C]">
            Dữ liệu hỗ trợ giáo viên biết chính xác học sinh vướng mắc chỗ nào để nhấn mạnh trong giờ giảng trực tiếp.
          </div>
        </div>

        {/* Bảng thời gian học tích cực & chuyên cần theo học sinh (7 phần) */}
        <div className="lg:col-span-7 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6DCC8]">
            <div>
              <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                Thời gian học tích cực theo từng học sinh
              </h3>
              <p className="text-xs text-[#78716C] mt-0.5">
                Phút học tích cực ghi nhận thực tế trên hệ thống, số buổi điểm danh và chuỗi ngày học liên tục
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportStudentsEngagement}
              className="px-3.5 py-2 rounded-xl bg-[#FAF5EB] hover:bg-[#F2E8D5] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] flex items-center gap-2 transition-all self-end sm:self-auto"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#E2704A]" />
              <span>Xuất Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto mt-4 max-h-[360px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF5EB] z-10 border-b border-[#E6DCC8] text-[#2F3E6B]">
                <tr>
                  <th className="p-3 font-bold">Học sinh</th>
                  <th className="p-3 font-bold">Lớp</th>
                  <th className="p-3 font-bold text-right">Học tích cực (phút)</th>
                  <th className="p-3 font-bold text-right">Buổi điểm danh</th>
                  <th className="p-3 font-bold text-right">Chuỗi ngày học dài nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DCC8]/60">
                {studentRank.map((st) => (
                  <tr
                    key={st.studentId}
                    className="hover:bg-[#FAF5EB]/40 transition-colors cursor-pointer"
                    onClick={() => onSelectStudentDossier(st.studentId)}
                  >
                    <td className="p-3 font-bold text-[#2F3E6B] hover:text-[#E2704A]">
                      {st.studentName}
                    </td>
                    <td className="p-3 text-[#4B5563]">Lớp {st.className}</td>
                    <td className="p-3 text-right font-bold text-[#2F3E6B]">
                      {st.activeLearningMinutes} phút
                    </td>
                    <td className="p-3 text-right text-[#4B5563]">
                      {st.attendanceDaysCount} buổi
                    </td>
                    <td className="p-3 text-right">
                      {st.longestStreakDays > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#D97706] font-bold text-[10px]">
                          {st.longestStreakDays} ngày
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
