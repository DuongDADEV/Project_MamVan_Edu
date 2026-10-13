import React, { useState } from 'react';
import {
  X,
  Search,
  Filter,
  CheckSquare,
  Square,
  FileQuestion,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  QuestionWithMeta,
  TopicWithMeta,
  QuestionType,
  SkillLevel,
  Difficulty,
} from '../../../services/types.ts';

interface QuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuestionWithMeta[];
  topics: TopicWithMeta[];
  onImportQuestions: (selectedQuestions: QuestionWithMeta[]) => void;
}

export const QuestionBankModal: React.FC<QuestionBankModalProps> = ({
  isOpen,
  onClose,
  questions,
  topics,
  onImportQuestions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [checkedQuestionIds, setCheckedQuestionIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  // Lọc danh sách câu hỏi
  const filteredQuestions = (questions || []).filter((q) => {
    if (!q) return false;
    if (selectedTopicId !== 'all' && q.topicId !== selectedTopicId) return false;
    if (selectedType !== 'all' && q.type !== selectedType) return false;
    if (selectedLevel !== 'all' && q.level !== selectedLevel) return false;
    if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false;
    if (searchQuery.trim()) {
      const text = ((q.prompt || '') + ' ' + (q.explanation || '')).toLowerCase();
      if (!text.includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  const handleToggleCheck = (qId: string) => {
    setCheckedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (checkedQuestionIds.size === filteredQuestions.length) {
      setCheckedQuestionIds(new Set());
    } else {
      setCheckedQuestionIds(new Set(filteredQuestions.map((q) => q.id)));
    }
  };

  const handleImport = () => {
    const selected = (questions || []).filter((q) => q && checkedQuestionIds.has(q.id));
    onImportQuestions(selected);
    onClose();
  };

  const getTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'single':
        return <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold">Trắc nghiệm</span>;
      case 'multi':
        return <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold">Nhiều đáp án</span>;
      case 'fill':
        return <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold">Điền ô trống</span>;
      case 'essay':
        return <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-bold">Viết đoạn văn</span>;
    }
  };

  const getLevelBadge = (lvl: SkillLevel) => {
    switch (lvl) {
      case 'NHAN_BIET':
        return <span className="text-[10px] text-slate-500 font-bold">Nhận biết</span>;
      case 'THONG_HIEU':
        return <span className="text-[10px] text-blue-600 font-bold">Thông hiểu</span>;
      case 'PHAN_TICH':
        return <span className="text-[10px] text-purple-600 font-bold">Phân tích</span>;
      case 'VAN_DUNG':
        return <span className="text-[10px] text-orange-600 font-bold">Vận dụng</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1E1B4B]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[85vh] bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-[#2F3E6B]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF5EB] border-b border-[#E6DCC8] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 text-[#2F3E6B] flex items-center justify-center shadow-xs">
              <FileQuestion className="w-5 h-5 text-[#4F46E5]" />
            </div>
            <div>
              <h3 className="font-lora font-bold text-lg text-[#2F3E6B]">
                Ngân hàng câu hỏi Ngữ văn 7
              </h3>
              <p className="text-xs text-[#8C7E6A]">
                Tìm kiếm và sao chép câu hỏi vào bài tập hiện tại (sửa bài không ảnh hưởng câu gốc)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/5 text-[#8C7E6A] hover:text-[#2F3E6B]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-white border-b border-[#E6DCC8] space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C7E6A] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm nội dung đề bài, ngữ liệu trích dẫn..."
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[#8C7E6A] font-bold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Lọc:
            </span>

            {/* Chủ đề */}
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
            >
              <option value="all">Tất cả chủ đề</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>

            {/* Dạng câu */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
            >
              <option value="all">Tất cả dạng câu</option>
              <option value="single">Trắc nghiệm đơn</option>
              <option value="multi">Chọn nhiều đáp án</option>
              <option value="fill">Điền ô trống</option>
              <option value="essay">Viết đoạn văn</option>
            </select>

            {/* Mức năng lực */}
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
            >
              <option value="all">Tất cả mức năng lực</option>
              <option value="NHAN_BIET">Nhận biết</option>
              <option value="THONG_HIEU">Thông hiểu</option>
              <option value="PHAN_TICH">Phân tích</option>
              <option value="VAN_DUNG">Vận dụng</option>
            </select>

            {/* Độ khó */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
            >
              <option value="all">Mọi độ khó</option>
              <option value="DE">Dễ</option>
              <option value="TB">Trung bình</option>
              <option value="KHO">Khó</option>
            </select>

            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="ml-auto text-xs text-[#E2704A] hover:underline font-bold"
            >
              {checkedQuestionIds.size === filteredQuestions.length && filteredQuestions.length > 0
                ? 'Bỏ chọn tất cả'
                : 'Chọn tất cả kết quả'}
            </button>
          </div>
        </div>

        {/* Questions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredQuestions.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#8C7E6A] italic">
              Không tìm thấy câu hỏi nào phù hợp với bộ lọc.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isChecked = checkedQuestionIds.has(q.id);
              const topic = topics.find((t) => t.id === q.topicId);

              return (
                <div
                  key={q.id}
                  onClick={() => handleToggleCheck(q.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    isChecked
                      ? 'bg-indigo-50/40 border-[#2F3E6B] shadow-2xs'
                      : 'bg-white border-[#E6DCC8] hover:border-[#8C7E6A]'
                  }`}
                >
                  <div className="pt-0.5 shrink-0 text-[#2F3E6B]">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-[#4F46E5]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#8C7E6A]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTypeBadge(q.type)}
                      {getLevelBadge(q.level)}
                      <span className="text-[10px] text-[#8C7E6A]">• Độ khó: {q.difficulty}</span>
                      {topic && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#FAF5EB] text-[#8C7E6A] ml-auto">
                          {topic.title}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-[#2F3E6B] line-clamp-2">
                      {q.prompt}
                    </p>

                    {Array.isArray(q.options) && q.options.length > 0 && (
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-[#8C7E6A]">
                        {q.options.slice(0, 4).map((opt, idx) => (
                          <div key={idx} className="truncate">
                            {String.fromCharCode(65 + idx)}. {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FAF5EB] border-t border-[#E6DCC8] flex items-center justify-between">
          <span className="text-xs font-bold text-[#2F3E6B]">
            Đã chọn {checkedQuestionIds.size} câu hỏi
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl border border-[#E6DCC8] text-xs font-bold text-[#8C7E6A] hover:bg-black/5"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={checkedQuestionIds.size === 0}
              onClick={handleImport}
              className="px-5 py-2 rounded-2xl bg-[#E2704A] hover:bg-[#D45E36] disabled:opacity-40 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              <span>Thêm vào bài kiểm tra ({checkedQuestionIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
