import React, { useMemo } from 'react';
import { Eye, CheckCircle2, XCircle, Clock, MessageSquareText } from 'lucide-react';
import { Quiz, Question, QuestionResult, EssaySubmission } from '../types.ts';

interface QuizReviewScreenProps {
  quiz: Quiz;
  questions: Question[];
  results: QuestionResult[];
  essaySubmissions: EssaySubmission[];
  onBack: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  single: 'Trắc nghiệm 1 đáp án',
  multi: 'Trắc nghiệm nhiều đáp án',
  fill: 'Điền khuyết',
  essay: 'Tự luận',
};

/**
 * Màn xem lại bài kiểm tra đã làm (quy tắc 1 lần): chỉ đọc, không ghi thêm
 * questionResults, không cộng XP, không tạo lần làm mới. Hiển thị đúng/sai mới
 * nhất theo từng câu + trạng thái/điểm/nhận xét của bài tự luận.
 */
export const QuizReviewScreen: React.FC<QuizReviewScreenProps> = ({
  quiz,
  questions,
  results,
  essaySubmissions,
  onBack,
}) => {
  const latestByQuestion = useMemo(() => {
    const map = new Map<string, QuestionResult>();
    for (const r of results || []) {
      const prev = map.get(r.questionId);
      if (!prev || (r.timestamp || 0) >= (prev.timestamp || 0)) map.set(r.questionId, r);
    }
    return map;
  }, [results]);

  const latestEssayByQuestion = useMemo(() => {
    const map = new Map<string, EssaySubmission>();
    for (const e of essaySubmissions || []) {
      const prev = map.get(e.questionId);
      if (!prev || (e.submittedAt || 0) >= (prev.submittedAt || 0)) map.set(e.questionId, e);
    }
    return map;
  }, [essaySubmissions]);

  const answered = questions.filter((q) => latestByQuestion.has(q.id));
  const correctCount = answered.filter((q) => latestByQuestion.get(q.id)?.isCorrect).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-[#2F3E6B] flex items-center gap-2">
          <Eye className="w-6 h-6 text-[#E2704A]" /> Xem lại: {quiz.title}
        </h1>
        <p className="text-sm text-[#8C7E6A] mt-1 flex items-center gap-1">
          <Clock className="w-4 h-4" /> Bài kiểm tra chỉ làm 1 lần — đây là bài cũ của em, điểm không thay đổi.
          {answered.length > 0 && (
            <span className="font-bold text-[#2F3E6B]">
              {' '}
              Trắc nghiệm đúng {correctCount}/{answered.filter((q) => q.type !== 'essay').length} câu.
            </span>
          )}
        </p>
      </div>

      {questions.length === 0 && (
        <p className="text-sm text-[#8C7E6A] italic">Không còn câu hỏi nào trong đề này.</p>
      )}

      <div className="space-y-3">
        {questions.map((q, idx) => {
          const r = latestByQuestion.get(q.id);
          const essay = q.type === 'essay' ? latestEssayByQuestion.get(q.id) : undefined;
          return (
            <div key={q.id} className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
              <div className="flex items-start gap-2">
                {r ? (
                  r.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-[#2F6B4F] shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  )
                ) : (
                  <span className="w-5 h-5 shrink-0 mt-0.5 rounded-full bg-[#F6F1E8] border border-[#E6DCC8]" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#8C7E6A]">
                    Câu {idx + 1} • {TYPE_LABEL[q.type] || q.type}
                    {r && q.type !== 'essay' && (
                      <span className={r.isCorrect ? ' text-[#2F6B4F]' : ' text-red-500'}>
                        {' '}
                        • {r.isCorrect ? 'Đúng' : 'Sai'}
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-bold text-[#2F3E6B] mt-1">{q.prompt}</p>
                  {q.type !== 'essay' && (q.options || []).length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {(q.options || []).map((opt, oi) => {
                        const letter = String.fromCharCode(65 + oi);
                        const isAnswer =
                          q.type === 'multi'
                            ? Array.isArray(q.answer) && (q.answer as string[]).includes(letter)
                            : q.answer === letter;
                        return (
                          <li
                            key={oi}
                            className={`text-sm px-3 py-1.5 rounded-xl border ${
                              isAnswer
                                ? 'bg-[#2F6B4F]/10 border-[#2F6B4F]/40 text-[#2F6B4F] font-bold'
                                : 'bg-[#FAF5EB] border-[#E6DCC8] text-[#2F3E6B]'
                            }`}
                          >
                            {letter}. {opt}
                            {isAnswer && ' ✓ Đáp án đúng'}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-[#8C7E6A] mt-2 italic">Giải thích: {q.explanation}</p>
                  )}
                  {q.type === 'essay' && (
                    <div className="mt-2 space-y-2">
                      {essay ? (
                        <>
                          <p className="text-sm text-[#2F3E6B] bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl p-3 line-clamp-6">
                            {essay.content}
                          </p>
                          {essay.status === 'GRADED' && essay.totalScore != null ? (
                            <p className="text-sm font-bold text-[#2F6B4F]">
                              Đã chấm: {essay.totalScore}/10
                            </p>
                          ) : (
                            <p className="text-sm font-bold text-amber-600">Cô giáo chưa chấm</p>
                          )}
                          {essay.teacherFeedback && (
                            <p className="text-sm text-[#2F3E6B] bg-[#2F6B4F]/5 border border-[#2F6B4F]/20 rounded-xl p-3 flex gap-2">
                              <MessageSquareText className="w-4 h-4 shrink-0 mt-0.5 text-[#2F6B4F]" />
                              <span>
                                <span className="font-bold">Nhận xét của cô: </span>
                                {essay.teacherFeedback}
                              </span>
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-[#8C7E6A] italic">Em chưa nộp bài tự luận này.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="px-5 py-2.5 rounded-full bg-[#2F3E6B] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition"
      >
        Quay lại
      </button>
    </div>
  );
};
