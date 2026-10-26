import React, { useState, useEffect, useMemo } from 'react';
import { StudentState, QuestionResult, EssaySubmission, Quiz, Question } from '../types.ts';
import { XP_CONFIG, TIME_CONFIG } from '../config.ts';
import { recordStepCompletion } from '../logic/xpEngine.ts';
import { QuizRunner } from '../components/QuizRunner.tsx';
import { QuizResult } from '../components/QuizResult.tsx';
import { MamMuc } from '../components/MamMuc.tsx';
import {
  BookOpen,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Clock,
  Sparkles,
  ListTree,
  ChevronRight,
  Bookmark,
  ImageIcon,
} from 'lucide-react';
import {
  useLiveQuery,
  contentService,
  quizService,
  essayRepository,
  TheoryLessonWithMeta,
  QuizWithMeta,
  QuestionWithMeta,
} from '../services/index.ts';

interface FlowStep {
  key: 'theory' | 'practice' | 'test' | 'complete';
  label: string;
  quiz?: Quiz;
  xpBonus: number;
}

interface TheoryLessonScreenProps {
  theoryId: string;
  state: StudentState;
  onUpdateState: (updater: (prev: StudentState) => StudentState) => void;
  onBackToList: () => void;
}

export const TheoryLessonScreen: React.FC<TheoryLessonScreenProps> = ({
  theoryId,
  state,
  onUpdateState,
  onBackToList,
}) => {
  const { data: liveTheory } = useLiveQuery<TheoryLessonWithMeta | null>(
    () => contentService.getTheoryLessonById(theoryId),
    ['content'],
    [theoryId]
  );
  // Chỉ lý thuyết THẬT từ máy chủ — không dự phòng bằng bản mẫu (đã gỡ mockData).
  const theory = liveTheory || null;

  const { data: liveQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(undefined, false),
    ['quiz']
  );
  const { data: liveQuestions } = useLiveQuery<Record<string, QuestionWithMeta>>(
    () => quizService.getQuestions(),
    ['quiz']
  );

  // Đếm ngược thời gian đọc tối thiểu (25s) trước khi nút "Đã hiểu" bật
  const [secondsLeft, setSecondsLeft] = useState<number>(TIME_CONFIG.MIN_THEORY_READ_SECONDS);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [quizOutcome, setQuizOutcome] = useState<{
    quiz: Quiz;
    results: QuestionResult[];
    essays: EssaySubmission[];
    earned: number;
    max: number;
    xpAwarded: number;
    cappedNotice?: string;
  } | null>(null);

  // Đợt QA 26/10, blocker 8: bài tự luận gửi lên máy chủ lỗi thì giữ lại để
  // gửi lại — trước đây chỉ .catch(console.error) rồi im, học sinh tưởng đã
  // nộp trong khi giáo viên không thấy bài (hàng đợi chấm nay chỉ đọc DB).
  const [failedEssays, setFailedEssays] = useState<Array<{
    payload: Omit<EssaySubmission, 'id' | 'submittedAt'>;
    error: string;
  }>>([]);
  const retryFailedEssays = async () => {
    const pending = failedEssays;
    setFailedEssays([]);
    const results = await Promise.allSettled(pending.map((f) => essayRepository.createSubmission(f.payload)));
    const stillFailed = pending.filter((_, i) => results[i].status === 'rejected');
    if (stillFailed.length > 0) setFailedEssays(stillFailed);
  };


  const isUnderstoodAlready = state.completedSteps.includes(`theory_understood:${theoryId}`);

  useEffect(() => {
    if (secondsLeft > 0 && !isUnderstoodAlready) {
      const timer = setTimeout(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [secondsLeft, isUnderstoodAlready]);

  const quizzesMap: Record<string, Quiz> = useMemo(() => ({
    ...(liveQuizzes ? Object.fromEntries(liveQuizzes.map((q) => [q.id, q])) : {}),
  }), [liveQuizzes]);

  const questionsMap: Record<string, Question> = useMemo(() => {
    let localStored: Record<string, Question> = {};
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('mam_van_questions') : null;
      if (raw) localStored = JSON.parse(raw);
    } catch {}
    return {
      ...localStored,
      ...(liveQuestions || {}),
    };
  }, [liveQuestions]);

  // Tìm các bài tập đã xuất bản thuộc cùng chủ đề
  const topicQuizzes: Quiz[] = useMemo(() => {
    return Object.values(quizzesMap).filter(
      (q: Quiz) => q && q.topicId && theory && q.topicId === theory.topicId
    );
  }, [quizzesMap, theory]);

  // 1. Bài Luyện tập lý thuyết
  const practiceQuiz: Quiz | undefined = useMemo(() => {
    return (theory?.practiceQuizId && quizzesMap[theory.practiceQuizId]) ||
      topicQuizzes.find((q: Quiz) => q.kind === 'practice');
  }, [theory?.practiceQuizId, quizzesMap, topicQuizzes]);

  // 2. Bài Kiểm tra lý thuyết
  const testQuiz: Quiz | undefined = useMemo(() => {
    return (theory?.testQuizId && quizzesMap[theory.testQuizId]) ||
      topicQuizzes.find((q: Quiz) => (q.kind === 'quick' || q.kind === 'mastery' || q.kind === 'homework' || q.kind === 'final') && q.id !== practiceQuiz?.id);
  }, [theory?.testQuizId, quizzesMap, topicQuizzes, practiceQuiz]);

  const dynamicSteps = useMemo<FlowStep[]>(() => {
    const steps: FlowStep[] = [
      { key: 'theory', label: 'Đọc lý thuyết', xpBonus: XP_CONFIG.THEORY_READ_UNDERSTOOD_XP },
    ];

    if (practiceQuiz) {
      steps.push({
        key: 'practice',
        label: 'Luyện tập',
        quiz: practiceQuiz,
        xpBonus: XP_CONFIG.THEORY_PRACTICE_COMPLETED_XP,
      });
    }

    if (testQuiz) {
      steps.push({
        key: 'test',
        label: 'Kiểm tra',
        quiz: testQuiz,
        xpBonus: XP_CONFIG.THEORY_TEST_XP,
      });
    }

    steps.push({ key: 'complete', label: 'Hoàn thành', xpBonus: XP_CONFIG.THEORY_FULL_COMPLETION_XP });
    return steps;
  }, [practiceQuiz, testQuiz]);

  // Khôi phục bước đang học dở (trước đây màn lý thuyết luôn bắt đầu lại từ bước 0).
  // Ưu tiên stepKey vì stepIndex có thể lệch khi GV thêm/bớt bài tập liên kết.
  React.useEffect(() => {
    const cp = state.currentProgress;
    if (cp && cp.type === 'theory' && cp.itemId === theoryId && dynamicSteps.length > 0) {
      const byKey = cp.stepKey ? dynamicSteps.findIndex((st) => st.key === cp.stepKey) : -1;
      const restored =
        byKey >= 0 ? byKey : Math.min(cp.stepIndex || 0, dynamicSteps.length - 1);
      setCurrentStepIndex(Math.max(0, restored));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theoryId, dynamicSteps.length]);

  const currentStep = dynamicSteps[currentStepIndex] || dynamicSteps[0];

  if (!theory) {
    return (
      <div className="p-8 text-center text-[#1E1B4B]">
        <p className="font-bold">Không tìm thấy bài lý thuyết này.</p>
        <button onClick={onBackToList} className="mt-4 px-5 py-2.5 gradient-primary text-white rounded-2xl font-bold">
          Quay lại danh sách
        </button>
      </div>
    );
  }

  // 1. Bấm "Đã hiểu" -> Cộng XP đọc hiểu -> Sang Bước tiếp theo
  const handleUnderstood = () => {
    const landsOnComplete = currentStepIndex + 2 >= dynamicSteps.length;
    onUpdateState((prev) => {
      // Mô hình XP mới: không cộng XP lẻ — chỉ ghi nhận hoàn thành bước.
      let finalUpdated = recordStepCompletion(prev, `theory_understood:${theoryId}`);
      if (landsOnComplete) {
        finalUpdated = recordStepCompletion(
          { ...prev, ...finalUpdated },
          `theory_flow_completed:${theoryId}`
        );
      }
      const updatedFlagged = prev.flaggedNeedReviewTopicIds.filter((t) => t !== theory.topicId);

      return {
        ...prev,
        ...finalUpdated,
        flaggedNeedReviewTopicIds: updatedFlagged,
        currentProgress: {
          type: 'theory',
          topicId: theory.topicId,
          itemId: theoryId,
          stepIndex: currentStepIndex + 1,
          stepKey: dynamicSteps[currentStepIndex + 1]?.key,
        },
      };
    });
    setCurrentStepIndex((prev) => Math.min(prev + 1, dynamicSteps.length - 1));
  };

  // 2. Bấm "Chưa hiểu" -> Đánh dấu vào "Cần xem lại" + lưu vị trí học dở như "Đã hiểu"
  const handleNotUnderstood = () => {
    onUpdateState((prev) => {
      const isAlreadyFlagged = prev.flaggedNeedReviewTopicIds.includes(theory.topicId);
      return {
        ...prev,
        flaggedNeedReviewTopicIds: isAlreadyFlagged
          ? prev.flaggedNeedReviewTopicIds
          : [...prev.flaggedNeedReviewTopicIds, theory.topicId],
        currentProgress: {
          type: 'theory',
          topicId: theory.topicId,
          itemId: theoryId,
          stepIndex: currentStepIndex + 1,
          stepKey: dynamicSteps[currentStepIndex + 1]?.key,
        },
      };
    });
    setCurrentStepIndex((prev) => Math.min(prev + 1, dynamicSteps.length - 1));
  };

  // 3. Hoàn thành một bài tập Quiz trong luồng lý thuyết
  const handleCompleteTheoryQuiz = (
    step: FlowStep,
    results: QuestionResult[],
    essays: EssaySubmission[] | undefined,
    earned: number,
    max: number
  ) => {
    if (!step.quiz) return;
    const qId = step.quiz.id;

    if (essays && essays.length > 0) {
      // Đợt QA 26/10, blocker 8: không nuốt lỗi gửi bài — bài nào lỗi thì
      // vào failedEssays để hiện banner gửi lại (nội dung vẫn còn trong
      // bài làm của học sinh qua nextState bên dưới).
      const payloads: Array<Omit<EssaySubmission, 'id' | 'submittedAt'>> = essays.map((e) => ({
        studentId: state.profile?.id || 'hs001',
        studentName: state.profile?.name || 'Học sinh',
        classId: (state.profile as any)?.classId,
        className: state.profile?.grade || '7A1',
        questionId: e.questionId,
        quizId: qId,
        content: e.content,
        wordCount: e.wordCount,
        status: 'PENDING_TEACHER' as const,
        promptTitle: e.promptTitle || 'Viết đoạn văn theo yêu cầu',
        quizTitle: `${step.label}: ${theory.title}`,
        skillLevel: 'VAN_DUNG' as const,
      }));
      Promise.allSettled(payloads.map((p) => essayRepository.createSubmission(p))).then((results) => {
        const failed = payloads.filter((_, i) => results[i].status === 'rejected');
        if (failed.length > 0) {
          setFailedEssays((prev) => [
            ...prev,
            ...failed.map((payload) => ({ payload, error: 'Không gửi được lên máy chủ' })),
          ]);
        }
      });
    }

    const isNextComplete = currentStepIndex + 2 >= dynamicSteps.length;

    // Mô hình XP mới: không cộng XP lẻ — chỉ ghi nhận hoàn thành bước;
    // XP nằm ở quỹ chủ đề + XP của từng bài tập.
    let finalUpdated = recordStepCompletion(state, `quiz_completed:${qId}`);
    const xpAwarded = 0;
    const cappedNotice = undefined;
    if (isNextComplete) {
      finalUpdated = recordStepCompletion(
        { ...state, ...finalUpdated },
        `theory_flow_completed:${theoryId}`
      );
    }

    onUpdateState(() => ({
      ...state,
      ...finalUpdated,
      questionResults: [...results, ...state.questionResults],
      essaySubmissions: essays ? [...essays, ...(state.essaySubmissions || [])] : state.essaySubmissions,
      currentProgress: isNextComplete
        ? undefined
        : {
            type: 'theory',
            topicId: theory.topicId,
            itemId: theoryId,
            stepIndex: currentStepIndex + 1,
          stepKey: dynamicSteps[currentStepIndex + 1]?.key,
          },
    }));

    // Hiện màn Kết quả trước khi sang bước tiếp
    setQuizOutcome({
      quiz: step.quiz,
      results,
      essays: essays || [],
      earned,
      max,
      xpAwarded,
      cappedNotice,
    });
  };

  // Render SVG Diagram trực quan cho từng chủ đề
  const renderSvgDiagram = (diagramType?: string) => {
    if (!diagramType) return null;

    if (diagramType === 'so_sanh') {
      return (
        <div className="my-5 p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 overflow-x-auto">
          <p className="text-xs font-bold text-[#4F46E5] uppercase tracking-wider mb-3">
            Sơ đồ mô hình 4 yếu tố của Phép so sánh:
          </p>
          <div className="flex items-center gap-2.5 min-w-[460px] justify-between text-center text-xs">
            <div className="flex-1 p-3 rounded-2xl bg-white border border-indigo-200 shadow-xs">
              <span className="font-extrabold text-[#4F46E5] block text-sm">Vế A</span>
              <span className="text-[11px] text-slate-500">(Sự vật so sánh)</span>
            </div>
            <span className="text-[#8B5CF6] font-extrabold text-base">→</span>
            <div className="flex-1 p-3 rounded-2xl bg-white border border-purple-200 shadow-xs">
              <span className="font-extrabold text-[#8B5CF6] block text-sm">Phương diện</span>
              <span className="text-[11px] text-slate-500">(Đặc điểm chung)</span>
            </div>
            <span className="text-[#22D3EE] font-extrabold text-base">→</span>
            <div className="flex-1 p-3 rounded-2xl bg-white border border-cyan-200 shadow-xs">
              <span className="font-extrabold text-cyan-600 block text-sm">Từ so sánh</span>
              <span className="text-[11px] text-slate-500">(như, là, hơn, tày)</span>
            </div>
            <span className="text-[#10B981] font-extrabold text-base">→</span>
            <div className="flex-1 p-3 rounded-2xl bg-white border border-emerald-200 shadow-xs">
              <span className="font-extrabold text-[#10B981] block text-sm">Vế B</span>
              <span className="text-[11px] text-slate-500">(Chuẩn so sánh)</span>
            </div>
          </div>
        </div>
      );
    }

    if (diagramType === 'tu_lay') {
      return (
        <div className="my-5 p-5 rounded-2xl bg-purple-50/40 border border-purple-100">
          <p className="text-xs font-bold text-[#8B5CF6] uppercase tracking-wider mb-3">
            Sơ đồ phân loại Từ láy:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-xs space-y-1.5">
              <span className="font-extrabold text-[#10B981] block text-sm">1. Từ láy toàn bộ</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Lặp lại toàn bộ cả âm, vần, thanh hoặc biến đổi thanh nhẹ để tạo nhịp điệu.
              </p>
              <p className="text-[11px] font-mono font-bold text-[#4F46E5] bg-indigo-50 px-2 py-1 rounded-lg">
                Ví dụ: xanh xanh, thoang thoảng
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-xs space-y-1.5">
              <span className="font-extrabold text-[#4F46E5] block text-sm">2. Từ láy bộ phận</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Láy phụ âm đầu hoặc chỉ láy phần vần để gợi hình và gợi cảm giác.
              </p>
              <p className="text-[11px] font-mono font-bold text-[#8B5CF6] bg-purple-50 px-2 py-1 rounded-lg">
                Ví dụ: long lanh, liêu xiêu
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (diagramType === 'tho_bon_nam') {
      return (
        <div className="my-5 p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
          <p className="text-xs font-bold text-[#4F46E5] uppercase tracking-wider mb-3">
            Nhịp ngắt và Vần trong Thơ bốn chữ, năm chữ:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="font-extrabold text-[#4F46E5] block text-sm">Thơ 4 chữ</span>
              <p className="text-[11px] text-slate-600 mt-1">
                Nhịp chẵn đều đặn: <strong className="text-[#1E1B4B]">2/2</strong>
              </p>
              <p className="text-xs italic text-indigo-700 font-serif mt-2 bg-indigo-50/60 p-2 rounded-xl">
                "Mầm non / mắt lim dim"
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="font-extrabold text-[#8B5CF6] block text-sm">Thơ 5 chữ</span>
              <p className="text-[11px] text-slate-600 mt-1">
                Linh hoạt: <strong className="text-[#1E1B4B]">3/2</strong> hoặc <strong className="text-[#1E1B4B]">2/3</strong>
              </p>
              <p className="text-xs italic text-purple-700 font-serif mt-2 bg-purple-50/60 p-2 rounded-xl">
                "Đang nằm chờ / đón nắng"
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (diagramType === 'doan_van') {
      return (
        <div className="my-5 p-5 rounded-2xl bg-cyan-50/40 border border-cyan-100">
          <p className="text-xs font-bold text-cyan-800 uppercase tracking-wider mb-3">
            Cấu trúc 3 phần của Đoạn văn cảm nghĩ:
          </p>
          <div className="space-y-2.5 text-xs">
            <div className="p-3.5 rounded-2xl bg-white border border-indigo-100 shadow-xs flex items-center gap-3">
              <span className="font-extrabold text-[#4F46E5] w-24 shrink-0">1. Mở đoạn:</span>
              <span className="text-[11px] text-slate-700">Giới thiệu tác giả, tác phẩm & ấn tượng bao trùm.</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-purple-100 shadow-xs flex items-center gap-3">
              <span className="font-extrabold text-[#8B5CF6] w-24 shrink-0">2. Thân đoạn:</span>
              <span className="text-[11px] text-slate-700">Chọn 1–2 hình ảnh độc đáo để phân tích cảm xúc sâu sắc.</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-emerald-100 shadow-xs flex items-center gap-3">
              <span className="font-extrabold text-[#10B981] w-24 shrink-0">3. Kết đoạn:</span>
              <span className="text-[11px] text-slate-700">Khái quát lại giá trị tác phẩm & liên hệ tâm hồn bản thân.</span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };



  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 sm:px-8 space-y-6 text-[#1E1B4B]">
      {/* HEADER: Quay lại + Nhãn */}
      {failedEssays.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] px-4 py-3 rounded-2xl bg-red-600 text-white shadow-xl">
          <p className="text-sm font-bold">Có {failedEssays.length} bài tự luận chưa gửi được lên máy chủ.</p>
          <p className="text-xs mt-1 opacity-90">Nội dung vẫn còn trong bài làm của em — bấm Gửi lại để gửi lên cho thầy/cô chấm.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={retryFailedEssays}
              className="px-3 py-1.5 rounded-xl bg-white text-red-700 text-xs font-bold"
            >
              Gửi lại
            </button>
            <button
              onClick={() => setFailedEssays([])}
              className="px-3 py-1.5 rounded-xl bg-red-700 text-white text-xs font-bold border border-red-400"
            >
              Để sau
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <button
          onClick={onBackToList}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-[#4F46E5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Danh sách bài học</span>
        </button>

        <span className="text-xs px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-[#8B5CF6] font-bold">
          Luồng Lý thuyết chi tiết
        </span>
      </div>

      {/* STEPPER LUỒNG LÝ THUYẾT */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          {dynamicSteps.map((st: FlowStep, idx: number) => {
            const isDone = currentStepIndex > idx;
            const isCurrent = currentStepIndex === idx;

            return (
              <div key={st.key} className="flex-1 flex flex-col items-center relative">
                {idx > 0 && (
                  <div
                    className={`absolute top-4 right-1/2 left-[-50%] h-0.5 -z-0 transition-colors ${
                      currentStepIndex >= idx ? 'bg-purple-500' : 'bg-slate-100'
                    }`}
                  />
                )}

                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold z-10 transition-all ${
                    isDone
                      ? 'bg-[#10B981] text-white shadow-xs'
                      : isCurrent
                      ? 'bg-gradient-to-tr from-[#8B5CF6] to-[#22D3EE] text-white ring-4 ring-purple-100 scale-110 shadow-md shadow-purple-500/20'
                      : 'bg-slate-100 text-slate-400 border border-slate-200/80'
                  }`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>

                <span
                  className={`text-[10px] sm:text-xs mt-1.5 font-bold hidden sm:inline ${
                    isCurrent ? 'text-[#8B5CF6]' : isDone ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= BƯỚC: ĐỌC LÝ THUYẾT ================= */}
      {currentStep.key === 'theory' && (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E1B4B]">
                {theory.title}
              </h2>
              <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[#4F46E5] font-extrabold self-start sm:self-auto">
                +10 XP khi bấm "Đã hiểu"
              </span>
            </div>

            {/* MỤC LỤC NHANH (Table of Contents) — chỉ hiện khi nội dung render theo
                sections (có id neo tương ứng); nhánh blocks không có neo nên ẩn để
                tránh bấm vào mà không đi tới đâu */}
            {!(theory.blocks && theory.blocks.length > 0) && theory.sections && theory.sections.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                <ListTree className="w-4 h-4 text-[#8B5CF6]" />
                <span>Mục lục bài đọc:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {theory.sections.map((sec, sIdx) => (
                  <a
                    key={sIdx}
                    href={`#section-${sIdx}`}
                    className="text-xs px-3 py-1 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:text-[#8B5CF6] text-slate-600 transition-colors"
                  >
                    {sIdx + 1}. {sec.title}
                  </a>
                ))}
              </div>
            </div>
            )}

            {/* CÁC PHẦN NỘI DUNG LÝ THUYẾT (BLOCKS HOẶC SECTIONS) */}
            {theory.blocks && theory.blocks.length > 0 ? (
              <div className="space-y-4">
                {theory.blocks.map((b, bIdx) => (
                  <div key={b.id || bIdx}>
                    {b.type === 'heading' && (
                      <h3
                        className={`font-extrabold text-[#1E1B4B] mt-5 mb-2 ${
                          b.level === 3 ? 'text-base' : 'text-lg'
                        }`}
                      >
                        {b.content}
                      </h3>
                    )}
                    {b.type === 'paragraph' && (
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-3">
                        {b.content}
                      </p>
                    )}
                    {b.type === 'list' && (
                      <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-slate-700 mb-3 pl-2">
                        {(b.items || []).map((it, itIdx) => (
                          <li key={itIdx}>{it}</li>
                        ))}
                      </ul>
                    )}
                    {b.type === 'example' && (
                      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1.5 my-3">
                        <strong className="text-xs font-bold text-[#4F46E5] block">Ví dụ thực tế:</strong>
                        <p className="text-xs sm:text-sm text-slate-800 italic">"{b.exampleText}"</p>
                        {b.exampleAnalysis && (
                          <p className="text-xs text-slate-600 pt-1 border-t border-indigo-100">
                            <strong>Phân tích:</strong> {b.exampleAnalysis}
                          </p>
                        )}
                      </div>
                    )}
                    {b.type === 'takeaway' && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-1 my-3">
                        <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                          Ghi nhớ trọng tâm
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">{b.takeawayText}</p>
                      </div>
                    )}
                    {b.type === 'image' && b.imageUrl && (
                      <div className="my-3 text-center space-y-1">
                        <img
                          src={b.imageUrl}
                          alt={b.caption || 'Minh họa'}
                          className="max-h-72 rounded-2xl mx-auto object-contain border border-slate-200"
                        />
                        {b.caption && (
                          <p className="text-xs text-slate-500 italic">{b.caption}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {(theory.sections || []).map((sec, sIdx) => (
                  <div
                    key={sIdx}
                    id={`section-${sIdx}`}
                    className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-3"
                  >
                    <h3 className="text-base sm:text-lg font-extrabold text-[#1E1B4B] flex items-center gap-2">
                      <span className="w-6 h-6 rounded-xl bg-purple-100 text-[#8B5CF6] text-xs font-extrabold flex items-center justify-center shrink-0">
                        {sIdx + 1}
                      </span>
                      <span>{sec.title}</span>
                    </h3>

                    <div className="text-xs sm:text-sm text-slate-700 leading-relaxed pl-8 space-y-2">
                      {sec.body.map((paragraph, pIdx) => (
                        <p key={pIdx}>{paragraph}</p>
                      ))}
                    </div>

                    {/* Sơ đồ nếu có */}
                    {sec.svgDiagramType && renderSvgDiagram(sec.svgDiagramType)}

                    {/* Ví dụ mẫu nếu có */}
                    {sec.example && (
                      <div className="mt-3 pl-8">
                        <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-100 text-xs text-slate-700 leading-relaxed">
                          <strong className="text-[#4F46E5] block mb-1">Ví dụ thực tế:</strong>
                          <p className="italic font-serif text-indigo-950 mb-1">"{sec.example.text}"</p>
                          <p className="text-slate-600">{sec.example.analysis}</p>
                        </div>
                      </div>
                    )}

                    {sec.takeaway && (
                      <div className="pl-8 pt-1 text-xs text-emerald-800 flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Ghi nhớ: {sec.takeaway}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 2 NÚT CUỐI BÀI: ĐÃ HIỂU VÀ CHƯA HIỂU */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={handleNotUnderstood}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-xs sm:text-sm font-bold hover:bg-amber-100 flex items-center justify-center gap-2 transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Chưa hiểu (Lưu vào Cần ôn)</span>
              </button>

              <button
                disabled={secondsLeft > 0 && !isUnderstoodAlready}
                onClick={handleUnderstood}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl gradient-primary text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/25 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {secondsLeft > 0 && !isUnderstoodAlready
                    ? `Đọc kỹ thêm (${secondsLeft}s) để xác nhận`
                    : dynamicSteps[currentStepIndex + 1]?.label
                    ? `Đã hiểu bài · Sang ${dynamicSteps[currentStepIndex + 1].label}`
                    : 'Đã hiểu bài · Hoàn thành'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CÁC BƯỚC BÀI TẬP LÝ THUYẾT (LUYỆN TẬP / KIỂM TRA) ================= */}
      {(currentStep.key === 'practice' || currentStep.key === 'test') && (
        (() => {
          const q = currentStep.quiz;
          if (!q) {
            return (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 space-y-4">
                <p className="font-bold text-slate-700">Chưa có bài tập cho phần này.</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
                    className="text-xs text-slate-500 font-bold px-4 py-2 border rounded-xl"
                  >
                    Quay lại lý thuyết
                  </button>
                  <button
                    onClick={() => setCurrentStepIndex((p) => Math.min(p + 1, dynamicSteps.length - 1))}
                    className="text-xs gradient-primary text-white font-bold px-4 py-2 rounded-xl"
                  >
                    Tiếp tục bước kế tiếp ➔
                  </button>
                </div>
              </div>
            );
          }

          const qList = (q.questionIds || []).map((id: string) => questionsMap[id]).filter(Boolean);
          if (qList.length === 0) {
            return (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 space-y-4">
                <p className="font-bold text-slate-700">
                  Bài tập "{q.title}" đang được chuẩn bị câu hỏi.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
                    className="text-xs text-slate-500 font-bold px-4 py-2 border rounded-xl"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={() => setCurrentStepIndex((p) => Math.min(p + 1, dynamicSteps.length - 1))}
                    className="text-xs gradient-primary text-white font-bold px-4 py-2 rounded-xl"
                  >
                    Bỏ qua & Sang bước kế tiếp ➔
                  </button>
                </div>
              </div>
            );
          }

          if (quizOutcome && quizOutcome.quiz.id === q.id) {
            return (
              <QuizResult
                quiz={quizOutcome.quiz}
                questions={qList}
                results={quizOutcome.results}
                essaySubmissions={quizOutcome.essays}
                earnedScore={quizOutcome.earned}
                maxScore={quizOutcome.max}
                xpAwarded={quizOutcome.xpAwarded}
                cappedNotice={quizOutcome.cappedNotice}
                onContinue={() => {
                  setQuizOutcome(null);
                  setCurrentStepIndex((p) => Math.min(p + 1, dynamicSteps.length - 1));
                }}
              />
            );
          }

          return (
            <QuizRunner
              key={q.id}
              quiz={q}
              studentId={state.profile?.id}
              questions={qList}
              onComplete={(res, essays, earned, max) => handleCompleteTheoryQuiz(currentStep, res, essays, earned, max)}
              onExit={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
            />
          );
        })()
      )}

      {/* ================= BƯỚC CUỐI: TỔNG KẾT HOÀN THÀNH ================= */}
      {currentStep.key === 'complete' && (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease]">
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-xl shadow-indigo-950/5 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-60 h-60 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <MamMuc mood="proud" size="xl" className="mx-auto mb-4" />

              <span className="text-xs uppercase tracking-wider text-purple-600 font-extrabold px-3 py-1 rounded-full bg-purple-50 border border-purple-200 inline-block mb-2">
                Xuất sắc! Đã hoàn thành chuyên đề lý thuyết
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] mb-2">
                {theory.title}
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
                Em đã đọc kỹ lý thuyết và vượt qua các yêu cầu của bài học!
              </p>

              {/* Bảng tổng kết XP */}
              <div className="p-5 rounded-3xl gradient-soft-indigo border border-indigo-100 max-w-sm mx-auto mb-8 text-center shadow-xs">
                <span className="text-xs font-bold text-slate-500 block mb-1">
                  Bạn đã hoàn thành trọn vẹn chuyên đề này
                </span>
                <span className="text-4xl font-black text-[#8B5CF6] font-mono tabular-nums">
                  🎉
                </span>
                <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                  Hoàn thành {dynamicSteps.length - 1} nội dung xuất sắc!
                </p>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={onBackToList}
                  className="px-8 py-3.5 rounded-2xl gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/25 hover:brightness-105 flex items-center gap-2 transition-all active:scale-[0.99]"
                >
                  <span>Về danh sách bài học</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
