import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
} from 'recharts';
import {
  Award,
  Lightbulb,
  X,
  User,
} from 'lucide-react';
import { AnalyticsFilter, HeatmapCell, RadarMasteryItem, WeakSkillRecommendation } from '../../../analytics/types.ts';
import { ClassItem, StudentAccount } from '../../../services/types.ts';
import { StudentState } from '../../../types.ts';
import { AccessibleChartWrapper } from './AccessibleChartWrapper.tsx';
import {
  computeClassRadarMastery,
  computeStudentTopicHeatmap,
  computeWeakestSkillsByTopic,
} from '../../../analytics/masteryAnalytics.ts';

interface MasteryAnalyticsTabProps {
  classes: ClassItem[];
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  topics: Array<{ id: string; title: string }>;
  filters: AnalyticsFilter;
  onSelectStudentDossier: (studentId: string) => void;
}

const PALETTE = {
  muc: '#2F3E6B',
  datNung: '#E2704A',
  xanhMa: '#10B981',
  vangNghe: '#F59E0B',
};

export const MasteryAnalyticsTab: React.FC<MasteryAnalyticsTabProps> = ({
  classes,
  students,
  studentStates,
  topics,
  filters,
  onSelectStudentDossier,
}) => {
  // Học sinh được chọn để so sánh trên Radar
  const [selectedStudentIdForRadar, setSelectedStudentIdForRadar] = useState<string>('');

  // Modal chi tiết ô heatmap khi bấm vào
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<HeatmapCell | null>(null);

  // 1. Radar 4 mức
  const radarData: RadarMasteryItem[] = useMemo(() => {
    const radarFilter: AnalyticsFilter = selectedStudentIdForRadar
      ? { ...filters, studentIds: [selectedStudentIdForRadar] }
      : filters;
    return computeClassRadarMastery(studentStates, students, radarFilter);
  }, [studentStates, students, selectedStudentIdForRadar, filters]);

  // 2. Heatmap dữ liệu học sinh × chủ đề
  const heatmapData: HeatmapCell[] = useMemo(() => {
    return computeStudentTopicHeatmap(studentStates, students, topics as any, filters, classes);
  }, [studentStates, students, topics, filters]);

  // 3. Gợi ý hành động mức yếu nhất
  const recommendations: WeakSkillRecommendation[] = useMemo(() => {
    return computeWeakestSkillsByTopic(studentStates, topics as any);
  }, [studentStates, topics]);

  // Tạo ma trận học sinh × chủ đề
  const uniqueStudents = useMemo(() => {
    const map = new Map<string, string>();
    heatmapData.forEach((d: HeatmapCell) => map.set(d.studentId, d.studentName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [heatmapData]);

  const uniqueTopics = useMemo(() => {
    const map = new Map<string, string>();
    heatmapData.forEach((d: HeatmapCell) => map.set(d.topicId, d.topicTitle));
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [heatmapData]);

  // Hàm lấy màu cho ô Heatmap theo trạng thái sư phạm
  const getCellColor = (statusLabel: string) => {
    switch (statusLabel) {
      case 'Vững':
        return 'bg-[#10B981] text-white hover:ring-2 hover:ring-[#10B981]/50';
      case 'Đang tiến bộ':
        return 'bg-[#F59E0B] text-white hover:ring-2 hover:ring-[#F59E0B]/50';
      case 'Cần ôn lại':
        return 'bg-[#E2704A] text-white hover:ring-2 hover:ring-[#E2704A]/50';
      case 'Chưa đủ dữ liệu':
      default:
        return 'bg-[#E6DCC8]/50 text-[#78716C] hover:bg-[#E6DCC8]';
    }
  };

  return (
    <div className="space-y-6">
      {/* KHỐI 1: RADAR CHART 4 MỨC & DANH SÁCH GỢI Ý HÀNH ĐỘNG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (6 phần): RadarChart 4 mức */}
        <div className="lg:col-span-6">
          <AccessibleChartWrapper
            title="Biểu đồ Radar 4 mức năng lực"
            subtitle="So sánh trung bình cả lớp với học sinh được chọn hoặc mục tiêu chuẩn"
            unitNote="Mastery %"
            empty={radarData.length === 0}
            tableData={radarData}
            tableColumns={[
              { key: 'levelName', label: 'Mức năng lực' },
              { key: 'classAverage', label: 'Trung bình lớp (%)' },
              { key: 'targetGoal', label: 'Mục tiêu chuẩn (%)' },
            ]}
            exportFileName="radar_nang_luc_4_muc"
            headerAction={
              <select
                value={selectedStudentIdForRadar}
                onChange={(e) => setSelectedStudentIdForRadar(e.target.value)}
                className="px-2.5 py-1 rounded-xl text-xs bg-[#FAF5EB] border border-[#E6DCC8] text-[#2F3E6B] font-medium focus:outline-none"
              >
                <option value="">So với Mục tiêu chuẩn (80%)</option>
                {students.map((s: StudentAccount) => (
                  <option key={s.id} value={s.id}>
                    So với: {s.name}
                  </option>
                ))}
              </select>
            }
            pedagogicalNote="Mastery được tính theo mô hình suy giảm trọng số thời gian (decay factor = 0.85) để phản ánh trung thực năng lực hiện tại của học sinh."
          >
            <ResponsiveContainer width="100%" height={290}>
              <RadarChart outerRadius={95} data={radarData}>
                <PolarGrid stroke="#E6DCC8" />
                <PolarAngleAxis dataKey="levelName" tick={{ fill: '#2F3E6B', fontSize: 11, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#78716C' }} />
                <Radar
                  name="Trung bình lớp"
                  dataKey="classAverage"
                  stroke={PALETTE.muc}
                  fill={PALETTE.muc}
                  fillOpacity={0.4}
                />
                <Radar
                  name={selectedStudentIdForRadar ? 'Học sinh chọn' : 'Mục tiêu (80%)'}
                  dataKey={selectedStudentIdForRadar ? 'selectedStudentScore' : 'targetGoal'}
                  stroke={PALETTE.datNung}
                  fill={PALETTE.datNung}
                  fillOpacity={0.35}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFDF8',
                    borderColor: '#E6DCC8',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => [`${val}%`, name]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </AccessibleChartWrapper>
        </div>

        {/* Cột phải (6 phần): Danh sách mức năng lực yếu nhất & Gợi ý hành động */}
        <div className="lg:col-span-6 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6DCC8]">
              <div className="w-8 h-8 rounded-xl bg-[#E2704A]/10 text-[#E2704A] flex items-center justify-center">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                  Mức năng lực yếu nhất & Gợi ý hành động
                </h3>
                <p className="text-xs text-[#78716C]">
                  Khuyến nghị can thiệp sư phạm kịp thời theo từng chủ đề
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {recommendations.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#78716C]">
                  Cả lớp đang duy trì mức độ nắm vững rất tốt ở tất cả các chủ đề.
                </div>
              ) : (
                recommendations.map((rec: WeakSkillRecommendation, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#FAF5EB]/60 border border-[#E6DCC8] hover:border-[#E2704A]/40 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#2F3E6B]">
                          {rec.topicTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#E2704A]/10 text-[#E2704A] text-[10px] font-bold">
                          Mức {rec.levelName}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#E2704A]">
                        Mastery: {rec.averagePercentage}%
                      </span>
                    </div>

                    <p className="text-xs text-[#4B5563] leading-relaxed">
                      💡 {rec.pedagogicalAdvice}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#78716C] pt-1 border-t border-[#E6DCC8]/50">
                      <span>Có {rec.studentWeakCount} học sinh đang cần củng cố</span>
                      <span className="font-semibold text-[#2F3E6B]">
                        Ưu tiên sư phạm cao
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E6DCC8]/60 flex items-center justify-between text-xs text-[#78716C]">
            <span>Gợi ý được sinh tự động dựa trên phân tích điểm yếu Bloom</span>
          </div>
        </div>
      </div>

      {/* KHỐI 2: BẢN ĐỒ NHIỆT (HEATMAP) HỌC SINH × CHỦ ĐỀ */}
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6DCC8]">
          <div>
            <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
              Bản đồ nhiệt năng lực (Heatmap: Học sinh × Chủ đề)
            </h3>
            <p className="text-xs text-[#78716C] mt-1">
              Bấm vào từng ô để xem chi tiết điểm số, số bài đã làm và gợi ý học tập cụ thể cho từng em.
            </p>
          </div>

          {/* CHÚ GIẢI TRẠNG THÁI SƯ PHẠM */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#10B981]" />
              <span className="text-[#374151]">Vững (≥75%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#F59E0B]" />
              <span className="text-[#374151]">Đang tiến bộ (50-74%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#E2704A]" />
              <span className="text-[#374151]">Cần ôn lại (&lt;50%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#E6DCC8]" />
              <span className="text-[#78716C]">Chưa đủ dữ liệu</span>
            </span>
          </div>
        </div>

        {/* BẢNG MATRIX HEATMAP */}
        <div className="overflow-x-auto mt-4 max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#FAF5EB] z-10 border-b border-[#E6DCC8]">
              <tr>
                <th className="p-3 font-bold text-[#2F3E6B] w-48 min-w-[180px]">Học sinh</th>
                {uniqueTopics.map((topic) => (
                  <th key={topic.id} className="p-3 font-bold text-[#2F3E6B] text-center min-w-[140px]">
                    {topic.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCC8]/50">
              {uniqueStudents.map((st) => (
                <tr key={st.id} className="hover:bg-[#FAF5EB]/30 transition-colors">
                  <td
                    className="p-3 font-semibold text-[#2F3E6B] cursor-pointer hover:text-[#E2704A] transition-colors"
                    onClick={() => onSelectStudentDossier(st.id)}
                  >
                    {st.name}
                  </td>
                  {uniqueTopics.map((topic) => {
                    const cell = heatmapData.find(
                      (d: HeatmapCell) => d.studentId === st.id && d.topicId === topic.id
                    );
                    const statusLabel = cell?.statusLabel || 'Chưa đủ dữ liệu';
                    const pct = cell?.percentage !== undefined ? `${cell.percentage}%` : '—';

                    return (
                      <td key={topic.id} className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedHeatmapCell(
                              cell || {
                                studentId: st.id,
                                studentName: st.name,
                                className: '7A2',
                                topicId: topic.id,
                                topicTitle: topic.title,
                                status: 'NOT_ENOUGH_DATA' as any,
                                percentage: 0,
                                statusLabel: 'Chưa đủ dữ liệu',
                                attemptCount: 0,
                              }
                            )
                          }
                          className={`w-full py-2 px-2 rounded-xl text-xs font-bold transition-all shadow-2xs ${getCellColor(
                            statusLabel
                          )}`}
                          title={`${st.name} - ${topic.title}: ${statusLabel} (${pct})`}
                        >
                          {pct}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CHI TIẾT Ô HEATMAP KHI BẤM */}
      {selectedHeatmapCell && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedHeatmapCell(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-[#FAF5EB] text-[#78716C] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-lora font-bold text-base text-[#2F3E6B]">
                  Chi tiết năng lực học sinh
                </h4>
                <p className="text-xs text-[#78716C]">
                  {selectedHeatmapCell.studentName}
                </p>
              </div>
            </div>

            <div className="space-y-3.5 bg-[#FAF5EB]/60 rounded-2xl p-4 border border-[#E6DCC8]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B7280]">Chủ đề:</span>
                <span className="font-bold text-[#2F3E6B]">
                  {selectedHeatmapCell.topicTitle}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B7280]">Trạng thái sư phạm:</span>
                <span className="font-bold text-[#E2704A]">
                  {selectedHeatmapCell.statusLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B7280]">Điểm Mastery tính toán:</span>
                <span className="font-bold text-base text-[#2F3E6B]">
                  {selectedHeatmapCell.percentage}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B7280]">Số câu hỏi đã làm:</span>
                <span className="font-medium text-[#2F3E6B]">
                  {selectedHeatmapCell.attemptCount} câu
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedHeatmapCell(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#78716C] hover:bg-[#FAF5EB]"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const sId = selectedHeatmapCell.studentId;
                  setSelectedHeatmapCell(null);
                  onSelectStudentDossier(sId);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2F3E6B] text-white hover:bg-[#233054] transition-all flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>Mở hồ sơ học sinh</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
