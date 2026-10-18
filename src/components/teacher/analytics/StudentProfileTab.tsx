import React, { useState, useMemo, useEffect } from 'react';
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
  User,
  Printer,
  Save,
  CheckCircle,
  XCircle,
  Award,
  BookOpen,
  PenTool,
  TreeDeciduous,
  Flame,
  Check,
  FileText,
} from 'lucide-react';
import { StudentAccount, ClassItem } from '../../../services/types.ts';
import { StudentState, EssaySubmission, RewardRequest, Question } from '../../../types.ts';
import { computeStudentProfileData } from '../../../analytics/studentProfileAnalytics.ts';
import { StudentProfileFullData, RadarMasteryItem } from '../../../analytics/types.ts';
import { printReport } from '../../../utils/exportUtils.ts';
import { QUESTIONS_BANK } from '../../../data/mockData.ts';
import { attemptService } from '../../../services/index.ts';

interface StudentProfileTabProps {
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  classes: ClassItem[];
  topics: Array<{ id: string; title: string }>;
  essays: EssaySubmission[];
  rewards: RewardRequest[];
  questions?: Record<string, Question>;
  selectedStudentId: string;
  onSelectStudentId: (studentId: string) => void;
  onRefreshData?: () => void;
}

const PALETTE = {
  muc: '#2F3E6B',
  datNung: '#E2704A',
  xanhMa: '#10B981',
  vangNghe: '#F59E0B',
};

export const StudentProfileTab: React.FC<StudentProfileTabProps> = ({
  students,
  studentStates,
  classes,
  topics,
  essays,
  rewards,
  questions = QUESTIONS_BANK,
  selectedStudentId,
  onSelectStudentId,
  onRefreshData,
}) => {
  // Ghi chú của giáo viên (state nội bộ để chỉnh sửa)
  const [notesText, setNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Lấy dữ liệu hồ sơ chi tiết của học sinh đang chọn
  const dossier: StudentProfileFullData | null = useMemo(() => {
    if (!selectedStudentId) return null;
    return computeStudentProfileData(
      selectedStudentId,
      studentStates,
      students,
      topics as any,
      undefined,
      classes
    );
  }, [selectedStudentId, studentStates, students, topics, classes]);

  // Lấy các bài viết của học sinh này
  const studentEssays = useMemo(() => {
    return essays.filter((e) => e.studentId === selectedStudentId);
  }, [essays, selectedStudentId]);

  // Cập nhật text ghi chú khi đổi học sinh
  useEffect(() => {
    if (dossier) {
      setNotesText(dossier.teacherNote || '');
    }
  }, [dossier?.account.id]);

  // Lưu ghi chú của giáo viên
  const handleSaveNotes = async () => {
    if (!selectedStudentId) return;
    setIsSavingNotes(true);
    try {
      const currentState = studentStates[selectedStudentId] || (await attemptService.getStudentState(selectedStudentId));
      const updatedState: StudentState = {
        ...currentState,
        teacherNotes: notesText,
      };
      await attemptService.saveStudentState(selectedStudentId, updatedState, 'teacher_notes');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error('Lỗi lưu ghi chú giáo viên:', e);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // In hồ sơ học sinh ra PDF
  const handlePrint = () => {
    printReport();
  };

  return (
    <div className="space-y-6">
      {/* THANH CHỌN HỌC SINH & THAO TÁC IN ẤN */}
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="w-10 h-10 rounded-2xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center font-bold shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-[#78716C] block">
              Chọn học sinh xem hồ sơ:
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => onSelectStudentId(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.student_code || s.id}) - Lớp {classes.find((c) => c.id === s.class_id)?.name || '—'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2.5 rounded-xl bg-[#2F3E6B] text-white hover:bg-[#233054] text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs shrink-0"
        >
          <Printer className="w-4 h-4" />
          <span>In hồ sơ (Xuất PDF)</span>
        </button>
      </div>

      {!dossier ? (
        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-12 text-center text-[#78716C]">
          Vui lòng chọn một học sinh để xem toàn bộ hồ sơ năng lực và lịch sử học tập.
        </div>
      ) : (
        /* HỒ SƠ HỌC SINH CHI TIẾT (HỖ TRỢ @media print) */
        <div className="space-y-6 printable-document">
          {/* BANNER THÔNG TIN HỌC SINH */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#2F3E6B] text-white flex items-center justify-center font-bold text-2xl shadow-md shrink-0">
                {dossier.account.name.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-lora text-2xl font-extrabold text-[#2F3E6B]">
                    {dossier.account.name}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-semibold text-[#78716C]">
                    Mã: {dossier.account.student_code}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#4B5563] mt-1.5">
                  <span>Lớp: <strong>{dossier.className}</strong></span>
                  <span>•</span>
                  <span>Thứ hạng: <strong>{dossier.rankInClass}/{dossier.totalStudentsInClass}</strong></span>
                  <span>•</span>
                  <span>Ngày sinh: {dossier.account.dob || '15/01/2013'}</span>
                </div>
              </div>
            </div>

            {/* THỐNG KÊ GAMIFICATION TỔNG QUÁT */}
            <div className="flex flex-wrap items-center gap-3 bg-[#FAF5EB] border border-[#E6DCC8] rounded-2xl p-3.5 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1">
                <Flame className="w-4 h-4 text-[#F59E0B]" />
                <div>
                  <div className="text-[10px] text-[#78716C]">Tổng XP</div>
                  <div className="font-bold text-sm text-[#2F3E6B]">{dossier.state.totalXp || 0} XP</div>
                </div>
              </div>
              <div className="border-r border-[#E6DCC8] h-8" />
              <div className="flex items-center gap-2 px-3 py-1">
                <TreeDeciduous className="w-4 h-4 text-[#10B981]" />
                <div>
                  <div className="text-[10px] text-[#78716C]">Điểm danh</div>
                  <div className="font-bold text-sm text-[#2F3E6B]">{dossier.state.attendanceHistory?.length || 0} buổi</div>
                </div>
              </div>
              <div className="border-r border-[#E6DCC8] h-8" />
              <div className="flex items-center gap-2 px-3 py-1">
                <Award className="w-4 h-4 text-[#8B5CF6]" />
                <div>
                  <div className="text-[10px] text-[#78716C]">Huy hiệu</div>
                  <div className="font-bold text-sm text-[#2F3E6B]">{dossier.state.unlockedBadgeIds?.length || 0} đã đạt</div>
                </div>
              </div>
            </div>
          </div>

          {/* KHỐI 1: RADAR 4 MỨC SO VỚI LỚP & TIẾN ĐỘ TỪNG CHỦ ĐỀ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Radar 4 mức so với lớp (5 phần) */}
            <div className="lg:col-span-5 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-lora font-bold text-base text-[#2F3E6B] mb-1">
                  Radar năng lực 4 mức (Bloom)
                </h3>
                <p className="text-xs text-[#78716C] mb-4">
                  So sánh năng lực của em với mức trung bình chung của cả lớp
                </p>

                <div className="h-64 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart outerRadius={85} data={dossier.radarScores}>
                      <PolarGrid stroke="#E6DCC8" />
                      <PolarAngleAxis dataKey="levelName" tick={{ fill: '#2F3E6B', fontSize: 11, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#78716C' }} />
                      <Radar
                        name={dossier.account.name}
                        dataKey="selectedStudentScore"
                        stroke={PALETTE.datNung}
                        fill={PALETTE.datNung}
                        fillOpacity={0.4}
                      />
                      <Radar
                        name="Trung bình lớp"
                        dataKey="classAverage"
                        stroke={PALETTE.muc}
                        fill={PALETTE.muc}
                        fillOpacity={0.25}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
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
                </div>
              </div>

              <div className="text-[11px] text-[#78716C] pt-2 border-t border-[#E6DCC8]/60 italic">
                * Dữ liệu được tính tự động từ AttemptRepository theo thang đo Bloom.
              </div>
            </div>

            {/* Tiến độ và Mastery từng chủ đề (7 phần) */}
            <div className="lg:col-span-7 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-lora font-bold text-base text-[#2F3E6B] mb-1">
                  Tiến độ & Mastery từng chủ đề
                </h3>
                <p className="text-xs text-[#78716C] mb-4">
                  Trạng thái nắm vững kiến thức các chủ đề trong chương trình
                </p>

                <div className="space-y-3">
                  {dossier.topicMasteryList.map((tp) => (
                    <div
                      key={tp.topicId}
                      className="p-3.5 rounded-2xl bg-[#FAF5EB]/60 border border-[#E6DCC8] space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#2F3E6B]">{tp.topicTitle}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                            tp.percentage >= 75
                              ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                              : tp.percentage >= 50
                              ? 'bg-[#F59E0B]/15 text-[#D97706] border-[#F59E0B]/30'
                              : 'bg-[#E2704A]/15 text-[#E2704A] border-[#E2704A]/30'
                          }`}
                        >
                          {tp.percentage >= 75 ? 'Vững' : tp.percentage >= 50 ? 'Đang tiến bộ' : 'Cần ôn lại'} ({tp.percentage}%)
                        </span>
                      </div>

                      {/* Thanh phần trăm */}
                      <div className="w-full h-2.5 bg-[#E6DCC8]/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${tp.percentage}%`,
                            backgroundColor:
                              tp.percentage >= 75
                                ? PALETTE.xanhMa
                                : tp.percentage >= 50
                                ? PALETTE.vangNghe
                                : PALETTE.datNung,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#78716C]">
                        <span>Đã hoàn thành {tp.completedStepCount} bước học</span>
                        <span>Điểm Mastery: {tp.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E6DCC8]/60 flex items-center justify-between text-xs text-[#78716C]">
                <span>Chuyên cần: {dossier.state.attendanceHistory?.length || 0} buổi điểm danh</span>
                <span>Học tích cực: {Math.round((dossier.state.activeSecondsToday || 0) / 60)} phút hôm nay</span>
              </div>
            </div>
          </div>

          {/* KHỐI 2: CÁC BÀI VIẾT ĐOẠN VĂN ĐÃ CHẤM KÈM NHẬN XÉT */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6DCC8] mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#E2704A]/10 text-[#E2704A] flex items-center justify-center font-bold">
                <PenTool className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                  Bài viết đoạn văn đã chấm ({studentEssays.length})
                </h3>
                <p className="text-xs text-[#78716C]">
                  Toàn bộ bài làm tự luận, điểm số tiêu chí rubric và nhận xét của giáo viên
                </p>
              </div>
            </div>

            {studentEssays.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#78716C]">
                Học sinh chưa có bài viết đoạn văn nào được chấm điểm.
              </div>
            ) : (
              <div className="space-y-4">
                {studentEssays.map((essay: EssaySubmission) => (
                  <div
                    key={essay.id}
                    className="p-4 rounded-2xl bg-[#FAF5EB]/50 border border-[#E6DCC8] space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#2F3E6B]">{essay.promptTitle}</h4>
                        <span className="text-[11px] text-[#78716C]">{essay.quizTitle}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#78716C]">
                          {new Date(essay.submittedAt).toLocaleDateString('vi-VN')}
                        </span>
                        <span className="px-3 py-1 rounded-xl bg-[#2F3E6B] text-white font-bold text-sm">
                          {essay.finalScore ?? essay.totalScore ?? '—'} / 10
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#FFFDF8] rounded-xl border border-[#E6DCC8] text-xs text-[#374151] leading-relaxed italic">
                      "{essay.content}"
                    </div>

                    {essay.finalComment && (
                      <div className="p-3 rounded-xl bg-[#7FA88A]/15 border border-[#7FA88A]/30 text-xs text-[#2E5E3D]">
                        <strong>Nhận xét của giáo viên:</strong> {essay.finalComment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KHỐI 3: LỊCH SỬ LÀM BÀI GẦN ĐÂY (XEM LẠI CÂU HỎI VÀ ĐÁP ÁN CỦA EM) */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6DCC8] mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                  Lịch sử làm bài gần đây ({dossier.attemptHistory.length} câu)
                </h3>
                <p className="text-xs text-[#78716C]">
                  Xem lại chi tiết câu hỏi, lựa chọn của học sinh và lời giải thích
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {dossier.attemptHistory.map((attempt) => (
                <div
                  key={attempt.id}
                  className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                    attempt.isPass
                      ? 'bg-[#10B981]/5 border-[#10B981]/30'
                      : 'bg-[#EF4444]/5 border-[#EF4444]/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      {attempt.isPass ? (
                        <CheckCircle className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold text-[#2F3E6B]">{attempt.questionPrompt}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[#78716C]">
                          <span className="font-medium">Mức: {attempt.level}</span>
                          <span>•</span>
                          <span>{attempt.quizTitle}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        attempt.isPass ? 'bg-[#10B981] text-white' : 'bg-[#EF4444] text-white'
                      }`}
                    >
                      {attempt.isPass ? 'Làm đúng' : 'Làm sai'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFDF8] border border-[#E6DCC8]/60 text-[11px] text-[#4B5563]">
                    <strong>Đáp án đúng:</strong> {attempt.correctAnswer}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KHỐI 4: GHI CHÚ RIÊNG CỦA GIÁO VIÊN (LƯU VÀO KHO DỮ LIỆU) */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs print:hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8] mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#E2704A]" />
                <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                  Sổ tay ghi chú riêng của giáo viên
                </h3>
              </div>
              <span className="text-[11px] text-[#78716C] bg-[#FAF5EB] px-2.5 py-1 rounded-full border border-[#E6DCC8]">
                Chỉ giáo viên thấy
              </span>
            </div>

            <p className="text-xs text-[#78716C] mb-3">
              Ghi lại những nhận xét định tính, lưu ý về tâm lý, phong cách học tập hoặc kế hoạch bồi dưỡng riêng cho học sinh này. Ghi chú được lưu trữ an toàn trong kho dữ liệu cá nhân của em.
            </p>

            <textarea
              rows={4}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Nhập ghi chú sư phạm cho học sinh này (ví dụ: Em có tư duy phân tích tốt nhưng làm bài còn vội, đã trao đổi với phụ huynh vào thứ Ba)..."
              className="w-full p-3.5 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B] leading-relaxed"
            />

            <div className="flex items-center justify-between mt-3">
              {saveSuccess ? (
                <span className="text-xs text-[#10B981] font-semibold flex items-center gap-1.5 animate-fade-in">
                  <Check className="w-4 h-4" />
                  Đã lưu ghi chú vào hồ sơ học sinh thành công!
                </span>
              ) : (
                <span className="text-[11px] text-[#78716C]">
                  Bấm "Lưu ghi chú" để cập nhật ngay vào hệ thống.
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="px-4 py-2 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingNotes ? 'Đang lưu...' : 'Lưu ghi chú'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
