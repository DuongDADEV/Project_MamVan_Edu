import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Edit3,
  Search,
  Download,
  Info,
  X,
} from 'lucide-react';
import { AnalyticsFilter, QuestionAnalyticsItem } from '../../../analytics/types.ts';
import { StudentAccount } from '../../../services/types.ts';
import { StudentState, Question } from '../../../types.ts';
import { computeQuestionAnalytics } from '../../../analytics/questionAnalytics.ts';
import { exportToExcel } from '../../../utils/exportUtils.ts';

interface QuestionAnalyticsTabProps {
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  questions?: Record<string, Question>;
  filters: AnalyticsFilter;
  onOpenQuestionEditor?: (questionId: string) => void;
}

export const QuestionAnalyticsTab: React.FC<QuestionAnalyticsTabProps> = ({
  students,
  studentStates,
  questions = {},
  filters,
  onOpenQuestionEditor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFlag, setFilterFlag] = useState<'all' | 'too_hard' | 'too_easy' | 'possible_flaw'>('all');
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState<QuestionAnalyticsItem | null>(null);

  // 1. Phân tích toàn bộ câu hỏi
  const analyzedQuestions: QuestionAnalyticsItem[] = useMemo(() => {
    return computeQuestionAnalytics(studentStates, questions, [] as any, filters);
  }, [studentStates, questions, filters]);

  // 2. Lọc theo tìm kiếm và flags
  const filteredQuestions: QuestionAnalyticsItem[] = useMemo(() => {
    return analyzedQuestions.filter((q: QuestionAnalyticsItem) => {
      // Lọc theo flag
      if (filterFlag !== 'all' && q.flag !== filterFlag) {
        return false;
      }
      // Lọc theo từ khóa tìm kiếm
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          q.prompt.toLowerCase().includes(query) ||
          q.questionId.toLowerCase().includes(query) ||
          q.topicTitle.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [analyzedQuestions, filterFlag, searchQuery]);

  const handleExportExcel = () => {
    exportToExcel(
      filteredQuestions.map((q: QuestionAnalyticsItem) => ({
        'Mã câu': q.questionId,
        'Nội dung': q.prompt,
        'Mức năng lực': q.level,
        'Chủ đề': q.topicTitle,
        'Lượt làm': q.totalAttempts,
        'Tỉ lệ đúng (%)': `${q.accuracyRate}%`,
        'Thời gian TB (giây)': `${q.avgTimeSeconds}s`,
        'Cảnh báo': q.flagLabel || 'Bình thường',
      })),
      'phan_tich_cau_hoi',
      'Phân tích chất lượng câu hỏi'
    );
  };

  return (
    <div className="space-y-6">
      {/* THANH TỔNG QUAN CÁC CHỈ SỐ CẢNH BÁO */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setFilterFlag('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterFlag === 'all'
              ? 'bg-[#2F3E6B] text-white border-[#2F3E6B] shadow-md'
              : 'bg-[#FFFDF8] border-[#E6DCC8] hover:border-[#2F3E6B]/40'
          }`}
        >
          <div className="text-xs font-semibold opacity-80">Tổng số câu trong ngân hàng</div>
          <div className="text-2xl font-bold font-lora mt-1">{analyzedQuestions.length} câu</div>
        </div>

        <div
          onClick={() => setFilterFlag('possible_flaw')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterFlag === 'possible_flaw'
              ? 'bg-[#EF4444] text-white border-[#EF4444] shadow-md'
              : 'bg-[#FFFDF8] border-[#E6DCC8] hover:border-[#EF4444]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold opacity-80">Có thể sai đáp án</span>
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
          </div>
          <div className="text-2xl font-bold font-lora mt-1">
            {analyzedQuestions.filter((q: QuestionAnalyticsItem) => q.flag === 'possible_flaw').length} câu
          </div>
          <div className="text-[10px] opacity-80 mt-0.5">HS giỏi làm sai hoặc tỉ lệ đúng quá thấp</div>
        </div>

        <div
          onClick={() => setFilterFlag('too_hard')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterFlag === 'too_hard'
              ? 'bg-[#E2704A] text-white border-[#E2704A] shadow-md'
              : 'bg-[#FFFDF8] border-[#E6DCC8] hover:border-[#E2704A]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold opacity-80">Câu quá khó</span>
            <Info className="w-4 h-4 text-[#E2704A]" />
          </div>
          <div className="text-2xl font-bold font-lora mt-1">
            {analyzedQuestions.filter((q: QuestionAnalyticsItem) => q.flag === 'too_hard').length} câu
          </div>
          <div className="text-[10px] opacity-80 mt-0.5">Tỉ lệ đúng dưới 35%</div>
        </div>

        <div
          onClick={() => setFilterFlag('too_easy')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterFlag === 'too_easy'
              ? 'bg-[#10B981] text-white border-[#10B981] shadow-md'
              : 'bg-[#FFFDF8] border-[#E6DCC8] hover:border-[#10B981]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold opacity-80">Câu quá dễ</span>
            <CheckCircle className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-2xl font-bold font-lora mt-1">
            {analyzedQuestions.filter((q: QuestionAnalyticsItem) => q.flag === 'too_easy').length} câu
          </div>
          <div className="text-[10px] opacity-80 mt-0.5">Tỉ lệ đúng trên 92%</div>
        </div>
      </div>

      {/* DANH SÁCH BẢNG PHÂN TÍCH CHI TIẾT */}
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6DCC8]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung câu hỏi hoặc mã câu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-[#FAF5EB] hover:bg-[#F2E8D5] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] flex items-center gap-2 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-[#E2704A]" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* BẢNG CÂU HỎI */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF5EB] border-b border-[#E6DCC8] text-[#2F3E6B]">
                <th className="p-3 font-bold w-16">Mã</th>
                <th className="p-3 font-bold min-w-[280px]">Nội dung câu hỏi</th>
                <th className="p-3 font-bold text-center">Mức năng lực</th>
                <th className="p-3 font-bold text-right">Lượt làm</th>
                <th className="p-3 font-bold text-right">Tỉ lệ đúng</th>
                <th className="p-3 font-bold text-right">Thời gian TB</th>
                <th className="p-3 font-bold">Đáp án nhiễu bị chọn nhiều nhất</th>
                <th className="p-3 font-bold text-center">Đánh dấu</th>
                <th className="p-3 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCC8]/60">
              {filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-xs text-[#78716C]">
                    Không tìm thấy câu hỏi nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((q: QuestionAnalyticsItem) => (
                  <tr key={q.questionId} className="hover:bg-[#FAF5EB]/40 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-[#78716C]">{q.questionId}</td>
                    <td className="p-3">
                      <p className="font-semibold text-[#2F3E6B] line-clamp-2">{q.prompt}</p>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2F3E6B]/10 text-[#2F3E6B]">
                        {q.level}
                      </span>
                    </td>
                    <td className="p-3 text-right text-[#4B5563]">{q.totalAttempts}</td>
                    <td className="p-3 text-right font-bold">
                      <span
                        className={
                          q.accuracyRate < 40
                            ? 'text-[#EF4444]'
                            : q.accuracyRate > 80
                            ? 'text-[#10B981]'
                            : 'text-[#2F3E6B]'
                        }
                      >
                        {q.accuracyRate}%
                      </span>
                    </td>
                    <td className="p-3 text-right text-[#4B5563]">{q.avgTimeSeconds}s</td>
                    <td className="p-3">
                      {q.mostChosenDistractor ? (
                        <div className="flex items-center justify-between text-[11px] max-w-[200px]">
                          <span className="truncate text-[#78716C]">
                            {q.mostChosenDistractor.option}
                          </span>
                          <span className="font-bold text-[#E2704A] ml-2">
                            {q.mostChosenDistractor.percentage}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#9CA3AF] text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {q.flag && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mb-1 ${
                            q.flag === 'possible_flaw'
                              ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                              : q.flag === 'too_hard'
                              ? 'bg-[#E2704A]/15 text-[#E2704A]'
                              : 'bg-[#10B981]/15 text-[#10B981]'
                          }`}
                        >
                          {q.flagLabel || q.flag}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedQuestionForModal(q)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] hover:bg-[#2F3E6B] hover:text-white border border-[#E6DCC8] text-xs font-semibold text-[#2F3E6B] transition-all inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Xem & Sửa</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL MỞ CÂU ĐỂ SỬA & XEM CHI TIẾT SƯ PHẠM */}
      {selectedQuestionForModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedQuestionForModal(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-[#FAF5EB] text-[#78716C] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 rounded-lg bg-[#2F3E6B]/10 text-[#2F3E6B] text-xs font-bold">
                {selectedQuestionForModal.level}
              </span>
              <span className="text-xs text-[#78716C] font-mono">
                Mã: {selectedQuestionForModal.questionId}
              </span>
            </div>

            <h3 className="font-lora font-bold text-lg text-[#2F3E6B] leading-relaxed mb-4">
              {selectedQuestionForModal.prompt}
            </h3>

            {/* THÔNG TIN CHI TIẾT PHÂN TÍCH */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] mb-6 text-xs">
              <div>
                <span className="text-[#78716C]">Số lượt làm:</span>
                <p className="font-bold text-[#2F3E6B] mt-0.5">{selectedQuestionForModal.totalAttempts} lượt</p>
              </div>
              <div>
                <span className="text-[#78716C]">Tỉ lệ đúng:</span>
                <p className="font-bold text-[#10B981] mt-0.5">{selectedQuestionForModal.accuracyRate}%</p>
              </div>
              <div>
                <span className="text-[#78716C]">Thời gian làm TB:</span>
                <p className="font-bold text-[#2F3E6B] mt-0.5">{selectedQuestionForModal.avgTimeSeconds} giây</p>
              </div>
            </div>

            {selectedQuestionForModal.mostChosenDistractor && (
              <div className="p-3.5 rounded-2xl bg-[#E2704A]/10 border border-[#E2704A]/20 mb-6 text-xs">
                <span className="font-bold text-[#E2704A] block mb-1">Phương án sai bị chọn nhiều nhất:</span>
                <p className="text-[#2F3E6B]">
                  "{selectedQuestionForModal.mostChosenDistractor.option}" ({selectedQuestionForModal.mostChosenDistractor.percentage}% học sinh chọn)
                </p>
              </div>
            )}

            {/* THAO TÁC */}
            <div className="flex items-center justify-between pt-3 border-t border-[#E6DCC8]">
              <span className="text-xs text-[#78716C]">
                Số liệu tính trên {selectedQuestionForModal.totalAttempts} lượt làm bài của học sinh
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedQuestionForModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#78716C] hover:bg-[#FAF5EB]"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const qId = selectedQuestionForModal.questionId;
                    setSelectedQuestionForModal(null);
                    if (onOpenQuestionEditor) {
                      onOpenQuestionEditor(qId);
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E2704A] hover:bg-[#D45E36] text-white transition-all flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Sửa câu hỏi trong ngân hàng</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
