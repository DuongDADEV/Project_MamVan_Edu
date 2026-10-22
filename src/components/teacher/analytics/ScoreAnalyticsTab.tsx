import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  ArrowUpDown,
  Download,
} from 'lucide-react';
import { AnalyticsFilter, StudentRankingRow } from '../../../analytics/types.ts';
import { StudentAccount, ClassItem } from '../../../services/types.ts';
import { StudentState } from '../../../types.ts';
import { AccessibleChartWrapper } from './AccessibleChartWrapper.tsx';
import {
  computeScoreDistribution,
  computeAvgScoreByTopic,
  computeWeeklyScoreTrends,
  computeClassComparison,
  computeStudentScoreRankings,
} from '../../../analytics/scoreAnalytics.ts';
import { exportToExcel } from '../../../utils/exportUtils.ts';

interface ScoreAnalyticsTabProps {
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  classes: ClassItem[];
  topics: Array<{ id: string; title: string }>;
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

export const ScoreAnalyticsTab: React.FC<ScoreAnalyticsTabProps> = ({
  students,
  studentStates,
  classes,
  topics,
  filters,
  onSelectStudentDossier,
}) => {
  // Sort state cho bảng xếp theo điểm
  const [sortField, setSortField] = useState<keyof StudentRankingRow>('averageScore');
  const [sortAsc, setSortAsc] = useState(false);

  // 1. Phân bố điểm (Histogram)
  const distribution = useMemo(() => {
    return computeScoreDistribution(studentStates, students, filters);
  }, [studentStates, students, filters]);

  // 2. Điểm TB theo chủ đề
  const topicScores = useMemo(() => {
    return computeAvgScoreByTopic(studentStates, topics as any, filters);
  }, [studentStates, topics, filters]);

  // 3. Xu hướng điểm theo tuần (Line)
  const weeklyTrends = useMemo(() => {
    return computeWeeklyScoreTrends(studentStates, filters);
  }, [studentStates, filters]);

  // 4. So sánh các lớp
  const classComparison = useMemo(() => {
    return computeClassComparison(studentStates, students, classes);
  }, [studentStates, students, classes]);

  // 5. Bảng điểm nội bộ có thể sắp xếp
  const rankingList = useMemo(() => {
    const raw = computeStudentScoreRankings(studentStates, students, filters, classes);
    return [...raw].sort((a: StudentRankingRow, b: StudentRankingRow) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [studentStates, students, classes, filters, sortField, sortAsc]);

  const handleSort = (field: keyof StudentRankingRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportRankingExcel = () => {
    exportToExcel(
      rankingList.map((r: StudentRankingRow) => ({
        'Họ và tên': r.studentName,
        'Mã học sinh': r.studentCode,
        'Lớp': `Lớp ${r.className}`,
        'Điểm trung bình': r.averageScore,
        'Số câu đã làm': r.totalAttempts,
        'Trạng thái': r.statusLabel,
      })),
      'bang_diem_noi_bo_giao_vien',
      'Bảng điểm nội bộ'
    );
  };

  return (
    <div className="space-y-6">
      {/* KHỐI 1: HISTOGRAM PHÂN BỐ ĐIỂM & ĐIỂM THEO CHỦ ĐỀ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histogram phân bố điểm */}
        <AccessibleChartWrapper
          title="Phân bố phổ điểm (Histogram)"
          subtitle="Số lượng học sinh theo từng dải điểm trên thang 10"
          unitNote="Số học sinh"
          empty={rankingList.length === 0}
          tableData={distribution}
          tableColumns={[
            { key: 'rangeLabel', label: 'Dải điểm' },
            { key: 'count', label: 'Số học sinh' },
            { key: 'percentage', label: 'Tỉ lệ (%)' },
          ]}
          exportFileName="phan_bo_pho_diem"
          pedagogicalNote="Giúp giáo viên quan sát ngay độ lệch chuẩn và mức độ phân hóa năng lực học tập của lớp."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" vertical={false} />
              <XAxis dataKey="rangeLabel" tick={{ fontSize: 10, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFDF8',
                  borderColor: '#E6DCC8',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#2F3E6B',
                }}
                formatter={(val: any) => [`${val} học sinh`, 'Số lượng']}
              />
              <Bar dataKey="count" fill={PALETTE.muc} radius={[6, 6, 0, 0]}>
                {distribution.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || PALETTE.muc}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AccessibleChartWrapper>

        {/* Điểm TB theo chủ đề */}
        <AccessibleChartWrapper
          title="Điểm trung bình theo chủ đề"
          subtitle="Đánh giá mức độ tiếp thu bài học ở từng mảng kiến thức"
          unitNote="Thang 10"
          empty={topicScores.length === 0}
          tableData={topicScores}
          tableColumns={[
            { key: 'topicTitle', label: 'Chủ đề' },
            { key: 'averageScore', label: 'Điểm trung bình' },
            { key: 'attemptCount', label: 'Số lượt làm' },
          ]}
          exportFileName="diem_tb_theo_chu_de"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topicScores} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" vertical={false} />
              <XAxis dataKey="topicTitle" tick={{ fontSize: 11, fill: '#78716C' }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#78716C' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFDF8',
                  borderColor: '#E6DCC8',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#2F3E6B',
                }}
                formatter={(val: any) => [`${val} / 10`, 'Điểm TB']}
              />
              <Bar dataKey="averageScore" fill={PALETTE.timHue} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AccessibleChartWrapper>
      </div>

      {/* KHỐI 2: XU HƯỚNG ĐIỂM THEO TUẦN & SO SÁNH GIỮA CÁC LỚP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Xu hướng điểm theo tuần */}
        <AccessibleChartWrapper
          title="Xu hướng điểm qua 6 tuần"
          subtitle="Đường tiến bộ điểm số trung bình của toàn bộ học sinh được chọn"
          unitNote="Thang 10"
          empty={weeklyTrends.length === 0}
          tableData={weeklyTrends}
          tableColumns={[
            { key: 'weekLabel', label: 'Tuần học' },
            { key: 'averageScore', label: 'Điểm trung bình' },
            { key: 'attemptCount', label: 'Số lượt làm' },
          ]}
          exportFileName="xu_huong_diem_tuan"
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" vertical={false} />
              <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#78716C' }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#78716C' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFDF8',
                  borderColor: '#E6DCC8',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#2F3E6B',
                }}
                formatter={(val: any) => [`${val} / 10`, 'Điểm TB tuần']}
              />
              <Line
                type="monotone"
                dataKey="averageScore"
                stroke={PALETTE.datNung}
                strokeWidth={3}
                dot={{ r: 4, fill: PALETTE.muc }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </AccessibleChartWrapper>

        {/* So sánh giữa các lớp */}
        <AccessibleChartWrapper
          title="So sánh giữa các lớp"
          subtitle="Điểm trung bình và tỉ lệ nỗ lực giữa các khối lớp"
          unitNote="Thang 10"
          empty={classComparison.length === 0}
          tableData={classComparison}
          tableColumns={[
            { key: 'className', label: 'Tên lớp' },
            { key: 'studentCount', label: 'Sĩ số' },
            { key: 'averageScore', label: 'Điểm trung bình' },
            { key: 'passRate', label: 'Tỉ lệ đạt (≥5.0)' },
          ]}
          exportFileName="so_sanh_cac_lop"
          pedagogicalNote="Dùng để điều chỉnh nhịp độ giảng dạy chung giữa các lớp phụ trách, không so sánh áp lực."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={classComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" vertical={false} />
              <XAxis dataKey="className" tick={{ fontSize: 11, fill: '#78716C' }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#78716C' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFDF8',
                  borderColor: '#E6DCC8',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#2F3E6B',
                }}
                formatter={(val: any) => [`${val} / 10`, 'Điểm trung bình']}
              />
              <Bar dataKey="averageScore" fill={PALETTE.muc} radius={[6, 6, 0, 0]}>
                {classComparison.map((_: any, index: number) => (
                  <Cell
                    key={`c-cell-${index}`}
                    fill={index === 0 ? PALETTE.muc : PALETTE.timHue}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AccessibleChartWrapper>
      </div>

      {/* KHỐI 3: BẢNG XẾP THEO ĐIỂM NỘI BỘ GIÁO VIÊN */}
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6DCC8]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                Bảng điểm nội bộ giáo viên ({rankingList.length} học sinh)
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FAF5EB] border border-[#E6DCC8] text-[#78716C]">
                Chỉ dành cho thầy cô
              </span>
            </div>
            <p className="text-xs text-[#78716C] mt-1">
              Ghi chú sư phạm: Bảng điểm này chỉ dùng để giáo viên theo dõi và có kế hoạch bồi dưỡng phù hợp, tuyệt đối không dùng để xếp hạng công khai với học sinh.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportRankingExcel}
              className="px-3.5 py-2 rounded-xl bg-[#FAF5EB] hover:bg-[#F2E8D5] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] flex items-center gap-2 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-[#E2704A]" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* BẢNG CÓ KHẢ NĂNG SẮP XẾP */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF5EB] border-b border-[#E6DCC8] text-[#2F3E6B]">
                <th
                  scope="col"
                  className="p-3 font-bold cursor-pointer hover:bg-[#F2E8D5] transition-colors"
                  onClick={() => handleSort('studentName')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Họ và tên</span>
                    <ArrowUpDown className="w-3 h-3 text-[#9CA3AF]" />
                  </div>
                </th>
                <th scope="col" className="p-3 font-bold">
                  Mã số
                </th>
                <th scope="col" className="p-3 font-bold">
                  Lớp
                </th>
                <th
                  scope="col"
                  className="p-3 font-bold cursor-pointer hover:bg-[#F2E8D5] transition-colors text-right"
                  onClick={() => handleSort('averageScore')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Điểm TB (/10)</span>
                    <ArrowUpDown className="w-3 h-3 text-[#9CA3AF]" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="p-3 font-bold cursor-pointer hover:bg-[#F2E8D5] transition-colors text-right"
                  onClick={() => handleSort('totalAttempts')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Số câu đã làm</span>
                    <ArrowUpDown className="w-3 h-3 text-[#9CA3AF]" />
                  </div>
                </th>
                <th scope="col" className="p-3 font-bold text-center">
                  Đánh giá sư phạm
                </th>
                <th scope="col" className="p-3 font-bold text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCC8]/60">
              {rankingList.map((st: StudentRankingRow) => (
                <tr
                  key={st.studentId}
                  className="hover:bg-[#FAF5EB]/50 transition-colors group cursor-pointer"
                  onClick={() => onSelectStudentDossier(st.studentId)}
                >
                  <td className="p-3 font-bold text-[#2F3E6B] group-hover:text-[#E2704A] transition-colors">
                    {st.studentName}
                  </td>
                  <td className="p-3 text-[#78716C] font-mono">{st.studentCode}</td>
                  <td className="p-3 text-[#4B5563]">Lớp {st.className}</td>
                  <td className="p-3 font-bold text-right text-[#2F3E6B]">
                    {st.averageScore > 0 ? (
                      <span
                        className={`px-2 py-0.5 rounded-lg ${
                          st.averageScore >= 8.0
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : st.averageScore >= 6.5
                            ? 'bg-[#2F3E6B]/10 text-[#2F3E6B]'
                            : st.averageScore >= 5.0
                            ? 'bg-[#F59E0B]/15 text-[#D97706]'
                            : 'bg-[#EF4444]/15 text-[#EF4444]'
                        }`}
                      >
                        {st.averageScore}
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF] italic">Chưa đủ dữ liệu</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-[#4B5563]">{st.totalAttempts}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        st.statusLabel === 'Vững'
                          ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30'
                          : st.statusLabel === 'Đang tiến bộ'
                          ? 'bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/30'
                          : st.statusLabel === 'Cần ôn lại'
                          ? 'bg-[#E2704A]/10 text-[#E2704A] border-[#E2704A]/30'
                          : 'bg-[#FAF5EB] text-[#78716C] border-[#E6DCC8]'
                      }`}
                    >
                      {st.statusLabel}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-xs font-bold text-[#2F3E6B] group-hover:text-[#E2704A] transition-colors">
                      Xem hồ sơ →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
