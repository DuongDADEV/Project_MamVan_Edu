import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StudentState, QuestionResult, EssaySubmission, Quiz, Question } from '../types.ts';
import { XP_CONFIG, TIME_CONFIG } from '../config.ts';
import { recordStepCompletion } from '../logic/xpEngine.ts';
import { QuizRunner } from '../components/QuizRunner.tsx';
import { QuizResult } from '../components/QuizResult.tsx';
import { MamMuc } from '../components/MamMuc.tsx';
import {
  Clock,
  ArrowRight,
  ArrowLeft,
  Volume2,
  VolumeX,
  Gauge,
  Play,
  Pause,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  useLiveQuery,
  contentService,
  quizService,
  essayRepository,
  VideoLessonWithMeta,
  QuizWithMeta,
  TheoryLessonWithMeta,
  TopicWithMeta,
  QuestionWithMeta,
} from '../services/index.ts';
import { buildTopicFlowPath, nextFlowItem } from '../logic/topicFlow.ts';
import { StudentTopicFlowStrip } from '../components/StudentTopicFlowStrip.tsx';

interface FlowStep {
  key: 'video' | 'summary' | 'practice' | 'quick' | 'mastery' | 'complete';
  label: string;
  quiz?: Quiz;
  xpBonus: number;
}

interface VideoLessonScreenProps {
  videoId: string;
  state: StudentState;
  onUpdateState: (updater: (prev: StudentState) => StudentState) => void;
  onBackToList: () => void;
  onOpenFlowItem?: (type: 'video' | 'theory' | 'quiz', id: string) => void;
}

export const VideoLessonScreen: React.FC<VideoLessonScreenProps> = ({
  videoId,
  state,
  onUpdateState,
  onBackToList,
  onOpenFlowItem,
}) => {
  const { data: liveVideo } = useLiveQuery<VideoLessonWithMeta | null>(
    () => contentService.getVideoLessonById(videoId),
    ['content'],
    [videoId]
  );
  const { data: allVideos } = useLiveQuery<VideoLessonWithMeta[]>(
    () => contentService.getVideoLessons(undefined, true),
    ['content']
  );
  // CHỈ hiện đúng video được yêu cầu từ dữ liệu thật. Không thấy = không
  // hiện gì (màn hình báo không tìm thấy) — TUYỆT ĐỐI không thay bằng video
  // mẫu hay video khác (đã gỡ mockData + fallback thay thế).
  const video = useMemo(() => {
    if (liveVideo && !liveVideo.deleted_at) return liveVideo;
    if (allVideos && allVideos.length > 0) {
      const match = allVideos.find((v) => v.id === videoId && !v.deleted_at);
      if (match) return match;
    }
    return null;
  }, [liveVideo, videoId, allVideos]);

  const { data: liveQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(undefined, false),
    ['quiz']
  );
  const { data: liveQuestions } = useLiveQuery<Record<string, QuestionWithMeta>>(
    () => quizService.getQuestions(),
    ['quiz']
  );
  // Du lieu cho dai luong chu de (26/10): chi bai DA XUAT BAN.
  const { data: liveTopics } = useLiveQuery<TopicWithMeta[]>(
    () => contentService.getTopics(undefined, true),
    ['content']
  );
  const { data: liveTheories } = useLiveQuery<TheoryLessonWithMeta[]>(
    () => contentService.getTheoryLessons(undefined, true),
    ['content']
  );
  const { data: livePublishedQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(undefined, true),
    ['quiz']
  );

  // Khai báo toàn bộ state & refs ngay tại đầu component theo đúng chuẩn React Hook
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [watchedSecondsSet, setWatchedSecondsSet] = useState<Set<number>>(new Set());
  const [isVideoError, setIsVideoError] = useState(false);
  const [mediaDuration, setMediaDuration] = useState<number>(video?.durationSec || 0);
  const [summarySecondsLeft, setSummarySecondsLeft] = useState(TIME_CONFIG.MIN_SUMMARY_READ_SECONDS);
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

  const quizzesMap: Record<string, Quiz> = useMemo(
    () => (liveQuizzes ? Object.fromEntries(liveQuizzes.map((q) => [q.id, q])) : {}),
    [liveQuizzes]
  );

  const questionsMap: Record<string, Question> = useMemo(() => {
    // Luật DB-thắng (đợt 3 26/10): chỉ dùng câu hỏi từ máy chủ — không lót
    // thêm bộ đệm local bên dưới, nếu không câu ma (đã xóa khỏi DB nhưng còn
    // trong localStorage) sẽ hiện lại trong bài luyện/kiểm tra của bài học.
    // Chỉ câu hỏi thật: dữ liệu máy chủ (đã gỡ ngân hàng mẫu).
    return liveQuestions || {};
  }, [liveQuestions]);

  // Tìm tất cả các bài tập đã xuất bản thuộc cùng chủ đề
  const topicQuizzes: Quiz[] = useMemo(() => {
    return Object.values(quizzesMap).filter(
      (q: Quiz) => q && q.topicId && video && q.topicId === video.topicId
    );
  }, [quizzesMap, video]);

  // Luong chu de (26/10): du cac bai co da dang theo dung thu tu co xep.
  const topicFlowPath = useMemo(() => {
    if (!video) return [];
    const topic = (liveTopics || []).find((t) => t.id === video.topicId);
    if (!topic) return [];
    return buildTopicFlowPath({
      flowOrder: topic.flowOrder,
      videos: (allVideos || []).filter((v) => v.topicId === video.topicId),
      theories: (liveTheories || []).filter((t) => t.topicId === video.topicId),
      quizzes: (livePublishedQuizzes || []).filter((q) => q.topicId === video.topicId),
    });
  }, [video, liveTopics, allVideos, liveTheories, livePublishedQuizzes]);
  const nextTopicFlowItem = useMemo(
    () => (video ? nextFlowItem(topicFlowPath, 'video', videoId) : undefined),
    [topicFlowPath, video, videoId]
  );

  // 1. Bài Luyện tập: ưu tiên video.practiceQuizId hoặc tìm bài kind 'practice' trong chủ đề
  const practiceQuiz: Quiz | undefined = useMemo(() => {
    return (video?.practiceQuizId && quizzesMap[video.practiceQuizId]) ||
      topicQuizzes.find((q: Quiz) => q.kind === 'practice');
  }, [video?.practiceQuizId, quizzesMap, topicQuizzes]);

  // 2. Bài Kiểm tra nhanh: ưu tiên video.quickTestId hoặc tìm bài kind 'quick' trong chủ đề
  const quickTestQuiz: Quiz | undefined = useMemo(() => {
    return (video?.quickTestId && quizzesMap[video.quickTestId]) ||
      topicQuizzes.find((q: Quiz) => q.kind === 'quick' && q.id !== practiceQuiz?.id);
  }, [video?.quickTestId, quizzesMap, topicQuizzes, practiceQuiz]);

  // 3. Bài Đánh giá năng lực: ưu tiên video.masteryCheckId hoặc bài kind 'review' / 'mastery'
  const masteryQuiz: Quiz | undefined = useMemo(() => {
    return (video?.masteryCheckId && quizzesMap[video.masteryCheckId]) ||
      topicQuizzes.find(
        (q: Quiz) =>
          (q.kind === 'mastery' || q.kind === 'homework' || q.kind === 'final') &&
          q.id !== practiceQuiz?.id &&
          q.id !== quickTestQuiz?.id
      );
  }, [video?.masteryCheckId, quizzesMap, topicQuizzes, practiceQuiz, quickTestQuiz]);

  // Xây dựng danh sách các bước học ĐỘNG theo đúng những gì giáo viên thực tế giao
  const dynamicSteps = useMemo<FlowStep[]>(() => {
    const steps: FlowStep[] = [
      { key: 'video', label: 'Xem video', xpBonus: 5 },
    ];

    if (video?.summaryPoints && video.summaryPoints.length > 0) {
      steps.push({ key: 'summary', label: 'Trọng tâm', xpBonus: 2 });
    }

    if (practiceQuiz) {
      steps.push({
        key: 'practice',
        label: 'Luyện tập',
        quiz: practiceQuiz,
        xpBonus: 5,
      });
    }

    if (quickTestQuiz) {
      steps.push({
        key: 'quick',
        label: 'KT nhanh',
        quiz: quickTestQuiz,
        xpBonus: 8,
      });
    }

    if (masteryQuiz) {
      steps.push({
        key: 'mastery',
        label: 'Đánh giá',
        quiz: masteryQuiz,
        xpBonus: 8,
      });
    }

    steps.push({ key: 'complete', label: 'Hoàn thành', xpBonus: 20 });
    return steps;
  }, [video?.summaryPoints, practiceQuiz, quickTestQuiz, masteryQuiz]);

  const currentStep = dynamicSteps[currentStepIndex] || dynamicSteps[0];

  // Cập nhật khi video prop đổi
  useEffect(() => {
    if (video?.durationSec) {
      setMediaDuration(video.durationSec);
    }
  }, [video?.durationSec]);

  // Độ dài hiệu dụng thật của bài giảng
  const fallbackDuration = video?.durationSec && video.durationSec > 0 ? video.durationSec : 60;
  const effectiveDuration = mediaDuration > 0 ? mediaDuration : fallbackDuration;

  // Theo dõi tỷ lệ đã xem thật (≥ 80%)
  const watchedRatio = watchedSecondsSet.size / Math.max(1, effectiveDuration);
  const isWatchedEligible = watchedRatio >= 0.8 || state.completedSteps.includes(`video_watch:${videoId}`);

  // Tự động khôi phục bước đang dở nếu có (ưu tiên theo stepKey —
  // stepIndex có thể lệch khi GV thêm/bớt bài tập liên kết)
  useEffect(() => {
    if (state.currentProgress && state.currentProgress.itemId === videoId) {
      const savedKey = state.currentProgress.stepKey;
      const byKey = savedKey ? dynamicSteps.findIndex((st) => st.key === savedKey) : -1;
      const restored =
        byKey >= 0
          ? byKey
          : Math.min(state.currentProgress.stepIndex || 0, dynamicSteps.length - 1);
      setCurrentStepIndex(Math.max(0, restored));
      if (state.currentProgress.videoSeconds && videoRef.current) {
        videoRef.current.currentTime = state.currentProgress.videoSeconds;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, state.currentProgress]);

  // Bộ đếm thời gian khi phát video (theo dõi các giây đã xem thật sự)
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        if (videoRef.current) {
          const sec = Math.floor(videoRef.current.currentTime);
          setCurrentTime(sec);
          setWatchedSecondsSet((prev) => new Set(prev).add(sec));
        } else {
          setCurrentTime((prev) => {
            const next = prev + 1;
            setWatchedSecondsSet((s) => new Set(s).add(next));
            return next;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Đếm ngược thời gian đọc tóm tắt tối thiểu khi ở bước summary
  useEffect(() => {
    if (currentStep?.key === 'summary' && summarySecondsLeft > 0) {
      const timer = setTimeout(() => {
        setSummarySecondsLeft((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentStep?.key, summarySecondsLeft]);

  if (!video) {
    return (
      <div className="p-8 text-center text-[#1E1B4B]">
        <p className="font-bold">Không tìm thấy video bài giảng này.</p>
        <button onClick={onBackToList} className="mt-4 px-5 py-2.5 gradient-primary text-white rounded-2xl font-bold">
          Quay lại danh sách
        </button>
      </div>
    );
  }

  // 1. Chuyển sang bước tiếp theo sau khi xem video
  const handleProceedFromVideo = () => {
    onUpdateState((prev) => {
      const xpRes = { updatedState: recordStepCompletion(prev, `video_watch:${videoId}`) };
      return {
        ...prev,
        ...xpRes.updatedState,
        currentProgress: {
          type: 'video',
          topicId: video.topicId,
          itemId: videoId,
          stepIndex: currentStepIndex + 1,
          stepKey: dynamicSteps[currentStepIndex + 1]?.key,
          videoSeconds: currentTime,
        },
      };
    });
    setCurrentStepIndex((prev) => Math.min(prev + 1, dynamicSteps.length - 1));
  };

  // 2. Chuyển sang bước tiếp theo sau khi đọc tóm tắt
  const handleProceedFromSummary = () => {
    onUpdateState((prev) => {
      const xpRes = { updatedState: recordStepCompletion(prev, `summary_read:${videoId}`) };
      return {
        ...prev,
        ...xpRes.updatedState,
        currentProgress: {
          type: 'video',
          topicId: video.topicId,
          itemId: videoId,
          stepIndex: currentStepIndex + 1,
          stepKey: dynamicSteps[currentStepIndex + 1]?.key,
        },
      };
    });
    setCurrentStepIndex((prev) => Math.min(prev + 1, dynamicSteps.length - 1));
  };

  // 3. Hoàn thành một bài tập Quiz trong luồng
  const handleCompleteQuizStep = (
    step: FlowStep,
    results: QuestionResult[],
    essays: EssaySubmission[],
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
        promptTitle: e.promptTitle || 'Viết đoạn văn',
        quizTitle: `${step.label}: ${video.title}`,
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

    // Mô hình XP mới: các bước trong luồng video KHÔNG cộng XP lẻ nữa —
    // chỉ ghi nhận hoàn thành (XP nằm ở quỹ chủ đề + XP của từng bài tập).
    const rec1 = recordStepCompletion(state, `quiz_completed:${qId}`);

    let nextState: StudentState = {
      ...state,
      ...rec1,
      questionResults: [...results, ...state.questionResults],
      essaySubmissions: [...essays, ...(state.essaySubmissions || [])],
    };

    const xpAwarded = 0;
    const cappedNotice = undefined;

    if (isNextComplete) {
      const recBonus = recordStepCompletion(nextState, `video_flow_completed:${videoId}`);
      nextState = {
        ...nextState,
        ...recBonus,
        currentProgress: undefined,
      };
    } else {
      nextState.currentProgress = {
        type: 'video',
        topicId: video.topicId,
        itemId: videoId,
        stepIndex: currentStepIndex + 1,
          stepKey: dynamicSteps[currentStepIndex + 1]?.key,
      };
    }

    onUpdateState(() => nextState);

    // Hiện màn Kết quả (điểm, XP, xem lại từng câu) trước khi sang bước tiếp
    setQuizOutcome({
      quiz: step.quiz,
      results,
      essays,
      earned,
      max,
      xpAwarded,
      cappedNotice,
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 sm:px-8 space-y-6 text-[#1E1B4B]">
      {/* HEADER: Nút quay lại + Tên chủ đề */}
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
          <span>Danh sách bài giảng</span>
        </button>

        <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[#4F46E5] font-bold">
          Luồng Bài giảng Video
        </span>
      </div>

      {topicFlowPath.length > 1 && (
        <StudentTopicFlowStrip
          path={topicFlowPath}
          currentType="video"
          currentId={videoId}
          onJump={onOpenFlowItem}
        />
      )}

      {/* STEPPER THANH TIẾN TRÌNH ĐỘNG THEO NỘI DUNG GIAO */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          {dynamicSteps.map((st: FlowStep, idx: number) => {
            const isDone = currentStepIndex > idx;
            const isCurrent = currentStepIndex === idx;

            return (
              <div key={st.key} className="flex-1 flex flex-col items-center relative">
                {/* Đường nối giữa các bước */}
                {idx > 0 && (
                  <div
                    className={`absolute top-4 right-1/2 left-[-50%] h-0.5 -z-0 transition-colors ${
                      currentStepIndex >= idx ? 'bg-indigo-500' : 'bg-slate-100'
                    }`}
                  />
                )}

                {/* Vòng tròn số bước */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold z-10 transition-all ${
                    isDone
                      ? 'bg-[#10B981] text-white shadow-xs'
                      : isCurrent
                      ? 'gradient-primary text-white ring-4 ring-indigo-100 scale-110 shadow-md shadow-indigo-500/20'
                      : 'bg-slate-100 text-slate-400 border border-slate-200/80'
                  }`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>

                <span
                  className={`text-[10px] sm:text-xs mt-1.5 font-bold hidden sm:inline ${
                    isCurrent ? 'text-[#4F46E5]' : isDone ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= BƯỚC: XEM VIDEO ================= */}
      {currentStep.key === 'video' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E1B4B] mb-2">
              {video.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-6">
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-[#4F46E5]" />
                Thời lượng: {effectiveDuration >= 60 ? `${Math.round(effectiveDuration / 60)} phút` : `${effectiveDuration} giây`}
              </span>
              <span>·</span>
              <span>Chủ đề: {video.subtopics.join(', ')}</span>
            </div>

            {/* KHUNG PHÁT VIDEO HIỆN ĐẠI (Overlay controls, không bị đẩy tràn ra ngoài) */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-950 aspect-video border border-slate-800 shadow-2xl group select-none">
              {!isVideoError && video.sampleUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={video.sampleUrl}
                    className="w-full h-full object-contain bg-black cursor-pointer"
                    onClick={() => {
                      if (videoRef.current) {
                        if (isPlaying) videoRef.current.pause();
                        else videoRef.current.play().catch(() => {});
                      } else {
                        setIsPlaying(!isPlaying);
                      }
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onLoadedMetadata={(e) => {
                      const d = Math.round(e.currentTarget.duration);
                      if (d && !isNaN(d) && d > 0) {
                        setMediaDuration(d);
                      }
                    }}
                    onTimeUpdate={(e) => {
                      const sec = Math.floor(e.currentTarget.currentTime);
                      setCurrentTime(sec);
                      setWatchedSecondsSet((prev) => new Set(prev).add(sec));
                    }}
                    onError={() => setIsVideoError(true)}
                    playsInline
                  />

                  {/* Nút Play to ở giữa màn hình khi đang tạm dừng */}
                  {!isPlaying && (
                    <div
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.play().catch(() => {});
                        } else {
                          setIsPlaying(true);
                        }
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer transition-opacity z-10"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-2xl shadow-indigo-500/50 flex items-center justify-center transform hover:scale-110 active:scale-95 transition-all">
                        <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
                      </div>
                    </div>
                  )}

                  {/* BỘ ĐIỀU KHIỂN VIDEO (Nổi ở đáy video, luôn hiển thị đầy đủ) */}
                  <div className="absolute bottom-3 left-3 right-3 z-20 bg-slate-900/90 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2 text-white text-xs border border-white/10 shadow-lg">
                    {/* Scrubber / Progress Bar của video */}
                    <div
                      className="w-full h-1.5 hover:h-2 bg-white/20 rounded-full cursor-pointer overflow-hidden transition-all relative"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const targetSec = Math.floor(pos * effectiveDuration);
                        if (videoRef.current) {
                          videoRef.current.currentTime = targetSec;
                        }
                        setCurrentTime(targetSec);
                      }}
                    >
                      <div
                        className="h-full bg-[#4F46E5] rounded-full transition-all"
                        style={{ width: `${Math.min(100, (currentTime / Math.max(1, effectiveDuration)) * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              if (isPlaying) videoRef.current.pause();
                              else videoRef.current.play().catch(() => {});
                            } else {
                              setIsPlaying(!isPlaying);
                            }
                          }}
                          className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 transition-colors"
                          title={isPlaying ? 'Tạm dừng bài giảng' : 'Bắt đầu phát'}
                        >
                          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>

                        <button
                          onClick={() => {
                            setIsMuted(!isMuted);
                            if (videoRef.current) videoRef.current.muted = !isMuted;
                          }}
                          className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 transition-colors"
                          title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                        >
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>

                        <span className="font-mono text-[11px] sm:text-xs font-semibold tabular-nums text-slate-300">
                          {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')} /{' '}
                          {Math.floor(effectiveDuration / 60)}:{(effectiveDuration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Tốc độ phát 0.75x - 1.5x */}
                        <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2 py-1 border border-white/10">
                          <Gauge className="w-3.5 h-3.5 text-yellow-400" />
                          <select
                            value={playbackSpeed}
                            onChange={(e) => {
                              const s = parseFloat(e.target.value);
                              setPlaybackSpeed(s);
                              if (videoRef.current) videoRef.current.playbackRate = s;
                            }}
                            className="bg-transparent text-white font-bold outline-none text-[11px] sm:text-xs cursor-pointer"
                          >
                            <option value="0.75" className="bg-slate-900">0.75x</option>
                            <option value="1" className="bg-slate-900">1.0x</option>
                            <option value="1.25" className="bg-slate-900">1.25x</option>
                            <option value="1.5" className="bg-slate-900">1.5x</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Placeholder mô phỏng bài giảng video */
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-slate-900 to-indigo-950 text-white rounded-2xl">
                  <MamMuc mood="cheer" size="md" className="mb-3" />
                  <p className="text-base sm:text-lg font-extrabold mb-1">
                    {video.title}
                  </p>
                  <p className="text-xs text-slate-300 max-w-sm mb-4">
                    Khung phát mô phỏng thông minh (tự động đếm chính xác từng giây học thật).
                  </p>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-6 py-2.5 rounded-full gradient-primary text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:brightness-105 active:scale-95 transition-all"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaying ? 'Tạm dừng bài giảng' : 'Bắt đầu xem bài giảng'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* THANH ĐO TIẾN TRÌNH XEM THẬT (Chống tua nhanh) */}
            <div className="mt-5 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                <span className="text-slate-700">
                  Thời lượng đã xem thật: <strong className="text-[#4F46E5] font-bold font-mono">{Math.round(watchedRatio * 100)}%</strong> (Cần ≥ 80% để sang bước tiếp theo)
                </span>
                <span className="text-[#4F46E5] font-bold">+5 XP khi hoàn thành</span>
              </div>
              <div className="w-full h-2.5 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full gradient-primary rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round(watchedRatio * 100))}%` }}
                />
              </div>
            </div>

            {/* Nút sang bước tiếp theo */}
            <div className="mt-6 flex justify-end">
              <button
                disabled={!isWatchedEligible}
                onClick={handleProceedFromVideo}
                className="px-6 py-3 rounded-2xl gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/25 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-[0.99]"
              >
                <span>
                  {dynamicSteps[currentStepIndex + 1]?.label
                    ? `Sang ${dynamicSteps[currentStepIndex + 1].label}`
                    : 'Hoàn thành bài giảng'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BƯỚC: TRỌNG TÂM ================= */}
      {currentStep.key === 'summary' && (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E1B4B]">
                Kiến thức trọng tâm sau bài giảng
              </h2>
              <span className="text-xs px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-extrabold">
                +2 XP khi hoàn thành
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              Hãy dành ít nhất 15 giây đọc kĩ các ý cần nhớ bên dưới để nắm vững bài học nhé!
            </p>

            <div className="space-y-4 mb-8">
              {video.summaryPoints.map((point, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 hover:border-indigo-100 transition-colors"
                >
                  <h4 className="text-sm font-extrabold text-[#1E1B4B] flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-xl bg-gradient-to-tr from-[#4F46E5] to-[#8B5CF6] text-white text-xs flex items-center justify-center shrink-0 font-bold shadow-xs">
                      {idx + 1}
                    </span>
                    <span>{point.title}</span>
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pl-8">
                    {point.content}
                  </p>
                  {point.example && (
                    <div className="mt-2 pl-8 text-xs text-[#4F46E5] italic bg-white p-3 rounded-xl border border-indigo-100">
                      <strong>Ví dụ minh họa:</strong> {point.example}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Nút điều hướng */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
                className="text-xs font-bold text-slate-500 hover:text-[#4F46E5] flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Xem lại video</span>
              </button>

              <button
                disabled={summarySecondsLeft > 0}
                onClick={handleProceedFromSummary}
                className="px-6 py-3 rounded-2xl gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/25 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-[0.99]"
              >
                <span>
                  {summarySecondsLeft > 0
                    ? `Đọc kĩ thêm (${summarySecondsLeft}s)`
                    : dynamicSteps[currentStepIndex + 1]?.label
                    ? `Sang ${dynamicSteps[currentStepIndex + 1].label}`
                    : 'Hoàn thành bài giảng'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CÁC BƯỚC BÀI TẬP (LUYỆN TẬP / KT NHANH / ĐÁNH GIÁ) ================= */}
      {(currentStep.key === 'practice' || currentStep.key === 'quick' || currentStep.key === 'mastery') && (
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
                    Quay lại bước trước
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
                  Bài tập "{q.title}" đang được thầy/cô soạn câu hỏi.
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
              onComplete={(results, essays, earned, max) => handleCompleteQuizStep(currentStep, results, essays, earned, max)}
              onExit={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
            />
          );
        })()
      )}

      {/* ================= BƯỚC CUỐI: TỔNG KẾT HOÀN THÀNH ================= */}
      {currentStep.key === 'complete' && (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease]">
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-xl shadow-indigo-950/5 text-center relative overflow-hidden">
            {/* Background glowing rings */}
            <div className="absolute top-0 right-0 w-60 h-60 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <MamMuc mood="proud" size="xl" className="mx-auto mb-4" />

              <span className="text-xs uppercase tracking-wider text-emerald-600 font-extrabold px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 inline-block mb-2">
                Tuyệt vời! Em đã hoàn thành bài học
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] mb-2">
                {video.title}
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
                Em đã hoàn thành xuất sắc tất cả các nội dung được giao cho bài giảng này!
              </p>

              {/* Bảng tổng kết XP nhận được */}
              <div className="p-5 rounded-3xl gradient-soft-indigo border border-indigo-100 max-w-sm mx-auto mb-8 text-center shadow-xs">
                <span className="text-xs font-bold text-slate-500 block mb-1">
                  Bạn đã hoàn thành trọn vẹn luồng học này
                </span>
                <span className="text-4xl font-black text-[#4F46E5] font-mono tabular-nums">
                  🎉
                </span>
                <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                  Hoàn thành {dynamicSteps.length - 1} chặng học tập xuất sắc!
                </p>
              </div>

              {/* Nut sang bai tiep theo dung thu tu chu de (26/10) */}
              <div className="flex justify-center gap-3 flex-wrap">
                {nextTopicFlowItem && onOpenFlowItem && (
                  <button
                    onClick={() => onOpenFlowItem(nextTopicFlowItem.type, nextTopicFlowItem.id)}
                    className="px-8 py-3.5 rounded-2xl gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/25 hover:brightness-105 flex items-center gap-2 transition-all active:scale-[0.99]"
                  >
                    <span>Bài tiếp theo: {nextTopicFlowItem.title}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onBackToList}
                  className={
                    nextTopicFlowItem && onOpenFlowItem
                      ? 'px-8 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 flex items-center gap-2 transition-all active:scale-[0.99]'
                      : 'px-8 py-3.5 rounded-2xl gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/25 hover:brightness-105 flex items-center gap-2 transition-all active:scale-[0.99]'
                  }
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
