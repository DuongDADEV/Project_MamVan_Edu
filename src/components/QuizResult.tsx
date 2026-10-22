import React, { useState } from 'react';
import { Question, Quiz, QuestionResult, EssaySubmission, SkillLevel } from '../types.ts';
import { SKILL_METADATA, generateMamMucFeedback, calculateAllMastery } from '../logic/mastery.ts';
import { MamMuc } from './MamMuc.tsx';
import { CheckCircle2, XCircle, Award, ArrowRight, RotateCcw, BookOpen, Sparkles, Star } from 'lucide-react';

interface QuizResultProps {
  quiz: Quiz;
  questions?: Question[];
  results: QuestionResult[];
  essaySubmissions: EssaySubmission[];
  earnedScore: number;
  maxScore: number;
  xpAwarded: number;
  cappedNotice?: string;
  onContinue: () => void;
  onReviewWeakArea?: (topicId: string) => void;
}

export const QuizResult: React.FC<QuizResultProps> = ({
  quiz,
  questions,
  results,
  essaySubmissions,
  earnedScore,
  maxScore,
  xpAwarded,
  cappedNotice,
  onContinue,
  onReviewWeakArea,
}) => {
  const [showReviewList, setShowReviewList] = useState(false);

  // Tính feedback Mầm Mực
  const miniMastery = calculateAllMastery(results, quiz.topicId);
  const feedback = generateMamMucFeedback(miniMastery, quiz.title);

  const percentage = Math.round((earnedScore / Math.max(1, maxScore)) * 100);

  // Mầm Mực biểu cảm theo kết quả
  const mascotMood = percentage >= 80 ? 'proud' : percentage >= 50 ? 'cheer' : 'thinking';

  // Tìm mức năng lực còn yếu trong bài này
  const weakLevel = Object.values(miniMastery).find(
    (m) => m.status === 'NEEDS_REVIEW' || m.percentage < 60
  );

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4 sm:px-6 text-[#1E1B4B]">
      {/* THẺ TỔNG KẾT KẾT QUẢ */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden mb-6 border border-slate-100 shadow-xl shadow-indigo-950/5">
        {/* Nền trang trí glow nhẹ */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-gradient-to-bl from-indigo-500/10 to-transparent blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-gradient-to-tr from-emerald-500/10 to-transparent blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <MamMuc mood={mascotMood} size="lg" className="mx-auto mb-4" />

          <span className="text-xs uppercase tracking-wider text-[#4F46E5] font-extrabold px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 inline-block mb-2">
            Hoàn thành bài tập
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] mb-1">
            Kết quả của bạn
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 font-medium">{quiz.title}</p>

          {/* Cột số liệu: Điểm & XP */}
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-6">
            {/* Điểm số */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block mb-1">
                Điểm số
              </span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-black text-[#4F46E5] font-mono tabular-nums">
                  {earnedScore}
                </span>
                <span className="text-sm text-slate-400 font-mono">/{maxScore}</span>
              </div>
              <span className="text-xs font-bold text-emerald-600 mt-1 block">
                Đạt {percentage}%
              </span>
            </div>

            {/* XP nhận được */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block mb-1">
                Điểm XP
              </span>
              <div className="flex items-center justify-center gap-1 text-3xl font-black text-amber-600 font-mono tabular-nums">
                <span>+{xpAwarded}</span>
                <span className="text-xs font-sans text-amber-700 font-extrabold">XP</span>
              </div>
              <span className="text-xs text-amber-700 font-medium mt-1 block">Tưới cây lớn 🌱</span>
            </div>
          </div>

          {/* Thông báo trần XP nếu có */}
          {cappedNotice && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-6 max-w-md mx-auto text-left leading-relaxed font-medium">
              ✨ {cappedNotice}
            </div>
          )}

          {/* NHẬN XÉT CỦA MẦM MỰC THEO 3 PHẦN: Điểm tốt -> Cần xem lại -> Lời nhắn */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-xs text-left mb-6 max-w-lg mx-auto">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200/80">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4F46E5] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
                Nhận xét từ Mầm Mực
              </span>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-[#1E1B4B]">
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold text-base leading-none">✓</span>
                <p>
                  <strong className="text-slate-800">Điểm sáng:</strong> {feedback.goodPoint}
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold text-base leading-none">🔍</span>
                <p>
                  <strong className="text-slate-800">Cần chú ý:</strong> {feedback.needsReview}
                </p>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-slate-200/60 text-slate-600 italic">
                <span className="text-amber-500 font-bold text-base leading-none">🌱</span>
                <p>{feedback.encouragement}</p>
              </div>
            </div>
          </div>

          {/* CÁC NÚT HÀNH ĐỘNG CHÍNH */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            {/* Nút Ôn phần yếu nếu có */}
            {weakLevel && onReviewWeakArea && (
              <button
                onClick={() => onReviewWeakArea(quiz.topicId)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>Ôn phần {weakLevel.displayName}</span>
              </button>
            )}

            {/* Nút Tiếp tục bài học */}
            <button
              onClick={onContinue}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl gradient-primary text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/25 hover:brightness-105 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <span>Tiếp tục hành trình</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Nút xem lại chi tiết từng câu */}
          <button
            onClick={() => setShowReviewList(!showReviewList)}
            className="mt-6 text-xs text-[#4F46E5] hover:underline font-bold inline-flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{showReviewList ? 'Thu gọn danh sách câu hỏi' : 'Xem lại chi tiết từng câu trả lời'}</span>
          </button>
        </div>
      </div>

      {/* DANH SÁCH CHI TIẾT TỪNG CÂU HỎI */}
      {showReviewList && (
        <div className="space-y-4 animate-[fadeIn_0.3s_ease]">
          <h3 className="text-base sm:text-lg font-extrabold text-[#1E1B4B]">
            Chi tiết các câu hỏi đã làm
          </h3>

          {quiz.questionIds.map((qId, idx) => {
            // Ưu tiên danh sách câu hỏi THẬT đã dùng khi làm bài (câu GV tạo/AI sinh
            // không có trong ngân hàng tĩnh) — tránh câu hỏi biến mất khỏi màn xem lại
            const q = (questions || []).find((qq) => qq.id === qId);
            if (!q) return null;
            const res = results.find((r) => r.questionId === qId);
            const isEssay = q.type === 'essay';
            const essaySub = essaySubmissions.find((s) => s.questionId === qId);
            const isGraded = essaySub?.status === 'GRADED' || essaySub?.finalScore !== undefined;

            return (
              <div key={qId} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-700">
                    Câu {idx + 1} · {SKILL_METADATA[q.level].displayName}
                  </span>
                  {isEssay ? (
                    isGraded ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 font-extrabold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Đã chốt điểm: {essaySub?.finalScore ?? essaySub?.totalScore}/10
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold">
                        Đã nộp – chờ thầy/cô chốt
                      </span>
                    )
                  ) : res?.isCorrect ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đúng
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Chưa đúng
                    </span>
                  )}
                </div>

                <p className="text-sm font-bold text-[#1E1B4B] mb-3 leading-relaxed">
                  {q.prompt}
                </p>

                {/* Phần hiển thị bài viết học sinh đã nộp */}
                {isEssay && essaySub && (
                  <div className="mb-3 p-3.5 rounded-2xl bg-[#FFFDF8] border border-[#E8DFD1] text-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1 font-semibold">
                      <span>Bài viết em đã nộp ({essaySub.wordCount} từ):</span>
                    </div>
                    <p className="font-serif italic text-slate-800 leading-relaxed whitespace-pre-wrap">
                      "{essaySub.content}"
                    </p>
                  </div>
                )}

                {/* Nếu giáo viên đã chấm: Hiển thị nhận xét & điểm Rubric */}
                {isEssay && isGraded && essaySub && (
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs text-slate-800 space-y-2 mb-3">
                    <p className="font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Nhận xét của thầy cô:
                    </p>
                    <p className="italic leading-relaxed text-slate-800">
                      "{essaySub.finalComment || essaySub.teacherFeedback || 'Bài viết tốt, em hãy tiếp tục phát huy nhé!'}"
                    </p>
                    {essaySub.rubricScores && essaySub.rubricScores.length > 0 && (
                      <div className="pt-2 border-t border-emerald-200/60 grid grid-cols-2 gap-1.5 text-[11px]">
                        {essaySub.rubricScores.map((rs, i) => (
                          <div key={i} className="flex justify-between bg-white/70 px-2 py-1 rounded-md">
                            <span className="text-slate-600">{rs.criterionName}:</span>
                            <span className="font-bold text-emerald-800">{rs.score}/{rs.maxScore}đ</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Nếu chưa chấm: Hiển thị thông báo chờ */}
                {isEssay && !isGraded && (
                  <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-xs text-[#4F46E5] italic leading-relaxed">
                    Bài viết của em đã được chuyển đến hệ thống chấm của thầy/cô. Thầy/cô sẽ chấm điểm theo Rubric và gửi nhận xét chi tiết sớm nhất!
                  </div>
                )}

                {/* Đáp án chuẩn cho câu trắc nghiệm */}
                {!isEssay && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed space-y-1">
                    <p className="font-bold text-[#4F46E5]">
                      Đáp án đúng: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                    </p>
                    <p className="text-slate-600">
                      <strong>Giải thích:</strong> {q.explanation}
                    </p>
                  </div>
                )}

                {/* Đoạn văn mẫu gợi ý */}
                {isEssay && q.sampleEssay && (
                  <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-xs text-slate-700 leading-relaxed mt-2">
                    <p className="font-bold text-[#8B5CF6] mb-1">Đoạn văn tham khảo:</p>
                    <p className="italic text-slate-700">"{q.sampleEssay}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
