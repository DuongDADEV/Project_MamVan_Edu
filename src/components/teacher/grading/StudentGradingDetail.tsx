import React, { useMemo } from 'react';
import { EssaySubmission } from '../../../types.ts';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  ChevronRight,
  Award,
} from 'lucide-react';

interface StudentGradingDetailProps {
  studentId: string;
  submissions: EssaySubmission[];
  onBack: () => void;
  onSelectSubmission: (submission: EssaySubmission) => void;
}

/**
 * Màn "Xem chi tiết" theo học sinh (theo Figma — Giao diện 1 Chấm bài):
 * bấm vào một học sinh để xem em đã làm những chủ đề / bài kiểm tra nào,
 * trạng thái từng bài và điểm đã chốt, rồi bấm Chấm ngay / Xem lại từng bài.
 */
export const StudentGradingDetail: React.FC<StudentGradingDetailProps> = ({
  studentId,
  submissions,
  onBack,
  onSelectSubmission,
}) => {
  const own = useMemo(
    () =>
      submissions
        .filter((s) => s.studentId === studentId)
        .sort((a, b) => b.submittedAt - a.submittedAt),
    [submissions, studentId]
  );

  const studentName = own[0]?.studentName || 'Học sinh';
  const className = own[0]?.className || '7A2';

  const stats = useMemo(() => {
    const graded = own.filter((s) => s.status === 'GRADED');
    const pending = own.length - graded.length;
    const scores = graded
      .map((s) => s.finalScore ?? s.totalScore)
      .filter((v): v is number => typeof v === 'number');
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { total: own.length, graded: graded.length, pending, avg };
  }, [own]);

  // Nhóm bài nộp theo bài kiểm tra (quizTitle)
  const groups = useMemo(() => {
    const map = new Map<string, EssaySubmission[]>();
    own.forEach((s) => {
      const key = s.quizTitle || 'Bài kiểm tra / Bài tập';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).map(([quizTitle, items]) => ({ quizTitle, items }));
  }, [own]);

  return (
    <div className="space-y-5">
      {/* Header học sinh */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] hover:border-[#2F3E6B] transition-colors shrink-0"
              title="Quay lại hàng đợi chấm bài"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại</span>
            </button>
            <div className="w-11 h-11 rounded-full bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold text-base flex items-center justify-center shrink-0">
              {studentName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <h3 className="font-lora font-bold text-lg text-[#1E1B4B] truncate">{studentName}</h3>
              <p className="text-xs text-slate-500 font-semibold">
                Lớp {className} • Chi tiết các bài em đã làm
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
              Tổng {stats.total} bài đã nộp
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              Đã chấm {stats.graded}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
              Chờ chấm {stats.pending}
            </span>
            {stats.avg !== null && (
              <span className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Điểm TB {stats.avg.toFixed(1)}/10
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Danh sách bài theo từng bài kiểm tra */}
      {own.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8DFD1] p-10 text-center text-sm text-slate-400">
          Học sinh này chưa nộp bài viết nào.
        </div>
      ) : (
        groups.map((group) => (
          <div
            key={group.quizTitle}
            className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs overflow-hidden"
          >
            <div className="px-5 py-3.5 bg-[#FAF5EB] border-b border-[#E8DFD1] flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-[#1E1B4B] flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[#E2704A] shrink-0" />
                <span className="truncate">{group.quizTitle}</span>
              </h4>
              <span className="text-[11px] font-bold text-slate-500 shrink-0">
                {group.items.length} bài nộp
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {group.items.map((sub) => (
                <div key={sub.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-semibold text-sm text-slate-800">
                      {sub.promptTitle || 'Cảm nghĩ về đoạn văn/thơ'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>
                        Năng lực: {sub.skillLevel === 'PHAN_TICH' ? 'Phân tích' : 'Vận dụng'}
                      </span>
                      <span>•</span>
                      <span>{sub.wordCount} từ</span>
                      <span>•</span>
                      <span>
                        Nộp{' '}
                        {new Date(sub.submittedAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                      {sub.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {sub.status === 'GRADED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Đã chốt ({sub.finalScore ?? sub.totalScore}đ)
                      </span>
                    ) : sub.status === 'AI_SUGGESTED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        <Sparkles className="w-3 h-3 text-purple-500" /> Gợi ý{' '}
                        {sub.aiSuggestion?.suggestedTotalScore || 8}đ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" /> Chờ chấm
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectSubmission(sub)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1 ${
                        sub.status === 'GRADED'
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-[#4F46E5] text-white hover:bg-indigo-700 shadow-xs'
                      }`}
                    >
                      {sub.status === 'GRADED' ? 'Xem lại' : 'Chấm ngay'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
