import React, { useState, useEffect, useRef } from 'react';
import { Question, Quiz, QuestionResult, EssaySubmission } from '../types.ts';
import { QUESTIONS_BANK } from '../data/mockData.ts';
import { SKILL_METADATA } from '../logic/mastery.ts';
import { MamMuc } from './MamMuc.tsx';
import { Clock, CheckCircle2, XCircle, AlertCircle, Send, ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';

interface QuizRunnerProps {
  quiz: Quiz;
  questions?: Question[];
  onComplete: (
    results: QuestionResult[],
    essaySubmissions: EssaySubmission[],
    earnedScore: number,
    maxScore: number
  ) => void;
  onExit: () => void;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  quiz,
  questions: customQuestions,
  onComplete,
  onExit,
}) => {
  let localStoredQuestions: Record<string, Question> = {};
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('mam_van_questions') : null;
    if (raw) localStoredQuestions = JSON.parse(raw);
  } catch {}

  const questions: Question[] =
    customQuestions && customQuestions.length > 0
      ? customQuestions
      : (quiz.questionIds || [])
          .map((id) => localStoredQuestions[id] || QUESTIONS_BANK[id])
          .filter(Boolean);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [essayDrafts, setEssayDrafts] = useState<Record<string, string>>({});
  const [practiceChecked, setPracticeChecked] = useState<Record<string, boolean>>({});
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Đồng hồ đếm ngược nếu là bài test có time limit
  const isPractice = quiz.kind === 'practice';
  const initialSeconds = quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60 : 0;
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const timerRef = useRef<any>(null);

  // Khi chuyển sang bài quiz khác, reset ngay lập tức toàn bộ trạng thái về câu số 1
  useEffect(() => {
    setCurrentIndex(0);
    setUserAnswers({});
    setEssayDrafts({});
    setPracticeChecked({});
    setIsSubmitModalOpen(false);
    setTimeLeft(quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60 : 0);
  }, [quiz.id]);

  // Đảm bảo chỉ số câu hỏi luôn an toàn, không bao giờ vượt quá chiều dài mảng câu hỏi
  const safeIndex = questions.length > 0 ? Math.min(currentIndex, questions.length - 1) : 0;
  const currentQ = questions[safeIndex];

  useEffect(() => {
    if (!isPractice && initialSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // Hết giờ tự nộp
            handleSubmitFinal();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timerRef.current);
    }
  }, [isPractice, initialSeconds]);

  // Xử lý nộp bài chung
  const handleSubmitFinal = () => {
    setIsSubmitModalOpen(false);

    const results: QuestionResult[] = [];
    const essaySubs: EssaySubmission[] = [];
    let totalScore = 0;
    const maxScore = questions.length;

    questions.forEach((q) => {
      const ans = userAnswers[q.id];

      if (q.type === 'single') {
        const isCorrect = ans === q.answer;
        const ratio = isCorrect ? 1 : 0;
        if (isCorrect) totalScore += 1;
        results.push({
          questionId: q.id,
          level: q.level,
          isCorrect,
          scoreRatio: ratio,
          timestamp: Date.now(),
          topicId: q.topicId,
        });
      } else if (q.type === 'multi') {
        const correctArray = (q.answer as string[]) || [];
        const chosenArray = (ans as string[]) || [];
        const matches = chosenArray.filter((c) => correctArray.includes(c)).length;
        const extraWrong = chosenArray.filter((c) => !correctArray.includes(c)).length;
        const ratio = Math.max(0, (matches - extraWrong * 0.5) / Math.max(1, correctArray.length));
        const isCorrect = ratio >= 0.85;
        totalScore += ratio;
        results.push({
          questionId: q.id,
          level: q.level,
          isCorrect,
          scoreRatio: ratio,
          timestamp: Date.now(),
          topicId: q.topicId,
        });
      } else if (q.type === 'fill') {
        const correctArray = (q.answer as string[]) || [];
        const fillAns = (ans as string[]) || [];
        let matchCount = 0;
        correctArray.forEach((cWord, i) => {
          if (fillAns[i] && fillAns[i].trim().toLowerCase() === cWord.trim().toLowerCase()) {
            matchCount += 1;
          }
        });
        const ratio = matchCount / Math.max(1, correctArray.length);
        const isCorrect = ratio >= 0.75;
        totalScore += ratio;
        results.push({
          questionId: q.id,
          level: q.level,
          isCorrect,
          scoreRatio: ratio,
          timestamp: Date.now(),
          topicId: q.topicId,
        });
      } else if (q.type === 'essay') {
        const text = (essayDrafts[q.id] || '').trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        if (words > 0) {
          totalScore += 0.8;
          results.push({
            questionId: q.id,
            level: q.level,
            isCorrect: true,
            scoreRatio: 0.8,
            timestamp: Date.now(),
            topicId: q.topicId,
          });
          essaySubs.push({
            id: 'sub_' + Date.now() + '_' + q.id,
            questionId: q.id,
            studentId: 'hs001',
            promptTitle: q.prompt || 'Viết đoạn văn theo yêu cầu',
            quizTitle: quiz.title,
            content: text,
            wordCount: words,
            submittedAt: Date.now(),
            status: 'PENDING_TEACHER',
          });
        } else {
          // Bỏ trống câu tự luận: không tạo bài nộp rỗng gửi giáo viên
          results.push({
            questionId: q.id,
            level: q.level,
            isCorrect: false,
            scoreRatio: 0,
            timestamp: Date.now(),
            topicId: q.topicId,
          });
        }
      }
    });

    onComplete(results, essaySubs, Math.round(totalScore * 10) / 10, maxScore);
  };

  if (!currentQ) {
    return (
      <div className="p-8 text-center text-[#1E1B4B]">
        <p className="font-bold">Không tìm thấy câu hỏi trong đề này.</p>
        <button onClick={onExit} className="mt-4 px-5 py-2.5 gradient-primary text-white rounded-2xl font-bold">
          Quay lại
        </button>
      </div>
    );
  }

  const isCurrentAnswered =
    currentQ.type === 'essay'
      ? (essayDrafts[currentQ.id]?.trim().split(/\s+/).length || 0) >= 5
      : userAnswers[currentQ.id] !== undefined;

  const isChecked = isPractice && practiceChecked[currentQ.id];

  // Kiểm tra tính đúng/sai nếu ở chế độ Luyện tập
  let isAnswerCorrectInPractice = false;
  if (isChecked) {
    if (currentQ.type === 'single') {
      isAnswerCorrectInPractice = userAnswers[currentQ.id] === currentQ.answer;
    } else if (currentQ.type === 'multi') {
      const correctArr = (currentQ.answer as string[]) || [];
      const userArr = (userAnswers[currentQ.id] as string[]) || [];
      isAnswerCorrectInPractice =
        correctArr.length === userArr.length &&
        correctArr.every((c) => userArr.includes(c));
    } else if (currentQ.type === 'fill') {
      const correctArr = (currentQ.answer as string[]) || [];
      const userArr = (userAnswers[currentQ.id] as string[]) || [];
      isAnswerCorrectInPractice = correctArr.every(
        (c, idx) => userArr[idx] && userArr[idx].trim().toLowerCase() === c.trim().toLowerCase()
      );
    }
  }

  // Format thời gian đếm ngược
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const skillInfo = SKILL_METADATA[currentQ.level];

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4 text-[#1E1B4B]">
      {/* HEADER BÀI QUIZ: Tên + Bộ đếm + Tiến độ */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[#4F46E5] font-extrabold">
              {skillInfo?.displayName || 'Nhận thức'}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Câu {safeIndex + 1}/{questions.length}
            </span>
          </div>
          <h3 className="text-sm font-extrabold text-[#1E1B4B] mt-0.5">{quiz.title}</h3>
        </div>

        {/* Đồng hồ đếm ngược nếu có */}
        {!isPractice && timeLeft > 0 && (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-bold ${
              timeLeft < 60
                ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        )}

        {isPractice && (
          <button
            onClick={onExit}
            className="text-xs text-slate-400 hover:text-slate-700 font-bold transition-colors"
          >
            Tạm dừng
          </button>
        )}
      </div>

      {/* THANH TIẾN ĐỘ CÂU HỎI */}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
        <div
          className="h-full gradient-primary transition-all duration-300 rounded-full"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* NỘI DUNG CÂU HỎI */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm mb-6">
        <p className="text-base sm:text-lg font-bold text-[#1E1B4B] leading-relaxed whitespace-pre-line mb-6">
          {currentQ.prompt}
        </p>

        {/* 1. DẠNG TRẮC NGHIỆM ĐƠN (single) */}
        {currentQ.type === 'single' && currentQ.options && (
          <div className="space-y-3">
            {currentQ.options.map((opt, idx) => {
              const isSelected = userAnswers[currentQ.id] === opt;
              let optClass = 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20 text-slate-800';

              if (isChecked) {
                if (opt === currentQ.answer) {
                  optClass = 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold ring-2 ring-emerald-500/20';
                } else if (isSelected && opt !== currentQ.answer) {
                  optClass = 'border-rose-300 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20';
                }
              } else if (isSelected) {
                optClass = 'border-[#4F46E5] bg-indigo-50/70 text-[#1E1B4B] font-bold shadow-xs ring-2 ring-indigo-500/20';
              }

              return (
                <button
                  key={idx}
                  disabled={isChecked}
                  onClick={() => setUserAnswers({ ...userAnswers, [currentQ.id]: opt })}
                  className={`w-full text-left p-4 rounded-2xl border text-sm sm:text-base transition-all flex items-start gap-3.5 ${optClass}`}
                >
                  <span
                    className={`w-7 h-7 rounded-xl font-extrabold shrink-0 flex items-center justify-center text-xs mt-0.5 transition-colors ${
                      isSelected
                        ? 'bg-[#4F46E5] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="leading-relaxed flex-1 mt-0.5">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. DẠNG CHỌN NHIỀU ĐÁP ÁN (multi) */}
        {currentQ.type === 'multi' && currentQ.options && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 italic mb-2">
              (Gợi ý: Câu hỏi này có thể chọn nhiều hơn 1 đáp án đúng)
            </p>
            {currentQ.options.map((opt, idx) => {
              const currentArr = (userAnswers[currentQ.id] as string[]) || [];
              const isSelected = currentArr.includes(opt);
              let optClass = 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20 text-slate-800';

              if (isChecked) {
                const correctArr = (currentQ.answer as string[]) || [];
                if (correctArr.includes(opt)) {
                  optClass = 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold ring-2 ring-emerald-500/20';
                } else if (isSelected && !correctArr.includes(opt)) {
                  optClass = 'border-rose-300 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20';
                }
              } else if (isSelected) {
                optClass = 'border-[#4F46E5] bg-indigo-50/70 text-[#1E1B4B] font-bold shadow-xs ring-2 ring-indigo-500/20';
              }

              return (
                <button
                  key={idx}
                  disabled={isChecked}
                  onClick={() => {
                    const next = isSelected
                      ? currentArr.filter((c) => c !== opt)
                      : [...currentArr, opt];
                    setUserAnswers({ ...userAnswers, [currentQ.id]: next });
                  }}
                  className={`w-full text-left p-4 rounded-2xl border text-sm sm:text-base transition-all flex items-start gap-3.5 ${optClass}`}
                >
                  <div
                    className={`w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center text-xs mt-0.5 transition-all ${
                      isSelected ? 'bg-[#4F46E5] border-[#4F46E5] text-white shadow-xs' : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="leading-relaxed flex-1">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 3. DẠNG ĐIỀN VÀO Ô TRỐNG (fill) */}
        {currentQ.type === 'fill' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 italic mb-2">
              Nhập các từ hoặc cụm từ tương ứng vào các ô bên dưới:
            </p>
            {Array.from({ length: currentQ.fillBlanksCount || 1 }).map((_, fIdx) => {
              const currentVals = (userAnswers[currentQ.id] as string[]) || [];
              const val = currentVals[fIdx] || '';

              return (
                <div key={fIdx} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 w-16 shrink-0">
                    Ô số {fIdx + 1}:
                  </span>
                  <input
                    type="text"
                    disabled={isChecked}
                    value={val}
                    placeholder="Nhập từ cần điền..."
                    onChange={(e) => {
                      const updated = [...currentVals];
                      updated[fIdx] = e.target.value;
                      setUserAnswers({ ...userAnswers, [currentQ.id]: updated });
                    }}
                    className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-100 outline-none text-sm text-[#1E1B4B] font-medium transition-all"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* 4. DẠNG VIẾT ĐOẠN VĂN (essay) */}
        {currentQ.type === 'essay' && (
          <div className="space-y-4">
            {/* Tiêu chí chấm (Rubric nhỏ để học sinh định hướng) */}
            {currentQ.rubric && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                <p className="font-bold text-[#1E1B4B] mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
                  <span>Tiêu chí đánh giá bài viết:</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {currentQ.rubric.map((r, rIdx) => (
                    <div key={rIdx} className="flex justify-between p-2 rounded-xl bg-white border border-slate-200/80">
                      <span className="font-medium text-slate-600">{r.name}</span>
                      <span className="font-bold text-[#4F46E5] font-mono">{r.maxScore}đ</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <textarea
                rows={7}
                value={essayDrafts[currentQ.id] || ''}
                onChange={(e) =>
                  setEssayDrafts({ ...essayDrafts, [currentQ.id]: e.target.value })
                }
                placeholder="Viết đoạn văn của em tại đây (hãy diễn đạt tự nhiên, chân thành)..."
                className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-100 outline-none text-sm text-[#1E1B4B] font-sans leading-relaxed resize-none transition-all"
              />

              <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-1">
                <span>* Bài viết sẽ được lưu và chuyển tới giáo viên nhận xét chi tiết.</span>
                <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {(essayDrafts[currentQ.id]?.trim().split(/\s+/).filter(Boolean).length || 0)} từ
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PHẢN HỒI KHI KIỂM TRA ĐÁP ÁN (Chế độ Luyện tập) */}
        {isChecked && (
          <div
            className={`mt-6 p-4 rounded-2xl border text-xs sm:text-sm animate-[fadeIn_0.2s_ease] ${
              isAnswerCorrectInPractice
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                : 'bg-amber-50/80 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2 font-bold mb-1.5">
              {isAnswerCorrectInPractice ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Chính xác! Em làm rất tốt!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Chưa hoàn toàn chính xác. Hãy cùng xem lời giải nhé:</span>
                </>
              )}
            </div>

            <p className="leading-relaxed pl-7 text-xs sm:text-sm text-slate-700">
              {currentQ.explanation}
            </p>
          </div>
        )}
      </div>

      {/* THANH ĐIỀU HƯỚNG BÊN DƯỚI */}
      <div className="flex items-center justify-between gap-3">
        <button
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => prev - 1)}
          className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Câu trước</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Nút kiểm tra đáp án ở chế độ Luyện tập */}
          {isPractice && !isChecked && currentQ.type !== 'essay' && (
            <button
              disabled={!isCurrentAnswered}
              onClick={() =>
                setPracticeChecked({ ...practiceChecked, [currentQ.id]: true })
              }
              className="px-5 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold text-xs hover:bg-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Kiểm tra ngay
            </button>
          )}

          {/* Nút Câu tiếp theo hoặc Nộp bài */}
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="px-6 py-2.5 rounded-2xl gradient-primary text-white font-bold text-xs shadow-md shadow-indigo-500/25 hover:brightness-105 flex items-center gap-1.5 transition-all"
            >
              <span>Câu tiếp theo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-6 py-2.5 rounded-2xl gradient-primary text-white font-bold text-xs shadow-md shadow-indigo-500/25 hover:brightness-105 flex items-center gap-1.5 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Nộp bài thi</span>
            </button>
          )}
        </div>
      </div>

      {/* MODAL XÁC NHẬN NỘP BÀI */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center animate-[scaleIn_0.2s_ease]">
            <MamMuc mood="cheer" size="md" className="mx-auto mb-3" />
            <h4 className="text-base font-extrabold text-[#1E1B4B] mb-2">
              Xác nhận nộp bài?
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Em đã hoàn thành phần làm bài của mình. Em có muốn kiểm tra lại trước khi gửi kết quả không?
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Xem lại bài
              </button>
              <button
                onClick={handleSubmitFinal}
                className="flex-1 py-2.5 rounded-2xl gradient-primary text-white text-xs font-bold shadow-md shadow-indigo-500/25 hover:brightness-105 transition-all"
              >
                Đồng ý nộp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
