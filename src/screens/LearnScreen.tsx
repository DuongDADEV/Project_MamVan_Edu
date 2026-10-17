import React, { useState, useMemo } from 'react';
import { StudentState, Topic, VideoLesson, TheoryLesson, Quiz } from '../types.ts';
import { calculateAllMastery, isTopicSolid } from '../logic/mastery.ts';
import { VideoCard, VideoCardSkeleton } from '../components/VideoCard.tsx';
import { MamMuc } from '../components/MamMuc.tsx';
import { Video, BookOpen, CheckCircle, Clock, ArrowRight, Filter, Sparkles, Layers } from 'lucide-react';
import { useLiveQuery, contentService, quizService, VideoLessonWithMeta, TheoryLessonWithMeta, QuizWithMeta } from '../services/index.ts';
import { QUIZZES } from '../data/mockData.ts';

interface LearnScreenProps {
  state: StudentState;
  topics?: Topic[];
  focusTopicId?: string | null;
  onSelectVideo: (videoId: string) => void;
  onSelectTheory: (theoryId: string) => void;
  isLoading?: boolean;
}

export const LearnScreen: React.FC<LearnScreenProps> = ({
  state,
  topics,
  focusTopicId,
  onSelectVideo,
  onSelectTheory,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'theory'>('video');
  const [filter, setFilter] = useState<'all' | 'unlearned' | 'needs_review'>('all');
  const activeTopics = topics ?? [];

  // Điều hướng từ Trang chủ / Cây / Kết quả: cuộn tới đúng thẻ chủ đề được chọn
  React.useEffect(() => {
    if (!focusTopicId) return;
    setFilter('all');
    const t = setTimeout(() => {
      document
        .getElementById('learn-topic-' + focusTopicId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(t);
  }, [focusTopicId]);

  // Lắng nghe video, lý thuyết và bài tập đã xuất bản từ kho chung
  const { data: liveVideos } = useLiveQuery<VideoLessonWithMeta[]>(
    () => contentService.getVideoLessons(undefined, true),
    ['content']
  );
  const { data: liveTheories } = useLiveQuery<TheoryLessonWithMeta[]>(
    () => contentService.getTheoryLessons(undefined, true),
    ['content']
  );
  const { data: liveQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(undefined, true),
    ['content']
  );

  const allQuizzes: Quiz[] = useMemo(() => [
    ...Object.values(QUIZZES),
    ...(liveQuizzes || []),
  ], [liveQuizzes]);

  const videosMap: Record<string, VideoLesson> = liveVideos
    ? Object.fromEntries(liveVideos.map((v) => [v.id, v]))
    : {};

  const theoriesMap: Record<string, TheoryLesson> = liveTheories
    ? Object.fromEntries(liveTheories.map((t) => [t.id, t]))
    : {};

  // Tính trạng thái của từng topic
  const getTopicProgress = (topic: Topic) => {
    const isSolid = isTopicSolid(state.questionResults, topic.id);
    const mastery = calculateAllMastery(state.questionResults, topic.id);
    const hasAttempted = Object.values(mastery).some((m) => m.totalQuestionsAttempted > 0);

    const isFlagged = state.flaggedNeedReviewTopicIds.includes(topic.id);
    const hasReview = Object.values(mastery).some((m) => m.status === 'NEEDS_REVIEW') || isFlagged;

    let status: 'Chưa học' | 'Đang học' | 'Cần ôn' | 'Vững' = 'Chưa học';
    let statusClass = 'bg-slate-100 text-slate-600 border-slate-200';

    if (isSolid) {
      status = 'Vững';
      statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (hasReview) {
      status = 'Cần ôn';
      statusClass = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (hasAttempted) {
      status = 'Đang học';
      statusClass = 'bg-indigo-50 text-[#4F46E5] border-indigo-200';
    }

    // Tính phần trăm hoàn thành bước học của chủ đề
    const videoSteps = topic.videoIds.map((vId) => `video_watch:${vId}`);
    const completedVideosCount = videoSteps.filter((s) => state.completedSteps.includes(s)).length;
    const progressPercent = Math.round((completedVideosCount / Math.max(1, topic.videoIds.length)) * 100);

    return { status, statusClass, progressPercent, hasAttempted, isSolid, hasReview };
  };

  // Lọc chủ đề
  const filteredTopics = activeTopics.filter((t) => {
    const p = getTopicProgress(t);
    if (filter === 'unlearned') return p.status === 'Chưa học';
    if (filter === 'needs_review') return p.status === 'Cần ôn';
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 sm:px-8 space-y-6 text-[#1E1B4B]">
      {/* HEADER: Tiêu đề + 2 Tab chính */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-[#4F46E5] mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Kho học liệu Ngữ văn 7</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] tracking-tight">
            Bài học & Rèn luyện
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Chọn luồng học theo bài giảng video thầy/cô hoặc đọc lý thuyết chi tiết
          </p>
        </div>

        {/* 2 Tabs chuyển đổi luồng học */}
        <div className="flex items-center p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'video'
                ? 'bg-white text-[#4F46E5] shadow-sm'
                : 'text-slate-600 hover:text-[#1E1B4B]'
            }`}
          >
            <Video className="w-4 h-4 text-[#4F46E5]" />
            <span>Xem video</span>
          </button>

          <button
            onClick={() => setActiveTab('theory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'theory'
                ? 'bg-white text-[#8B5CF6] shadow-sm'
                : 'text-slate-600 hover:text-[#1E1B4B]'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#8B5CF6]" />
            <span>Lý thuyết chung</span>
          </button>
        </div>
      </div>

      {/* THANH BỘ LỌC (Interactive Filter Tabs) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 flex items-center gap-1 font-semibold mr-1">
          <Filter className="w-3.5 h-3.5 text-slate-400" /> Lọc theo:
        </span>
        {[
          { key: 'all' as const, label: 'Tất cả chủ đề' },
          { key: 'unlearned' as const, label: 'Chưa học' },
          { key: 'needs_review' as const, label: 'Cần ôn lại' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full border transition-all font-semibold whitespace-nowrap ${
              filter === f.key
                ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* DANH SÁCH CÁC CHỦ ĐỀ HỌC */}
      <div className="space-y-5">
        {filteredTopics.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-100">
            Không có chủ đề nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredTopics.map((topic) => {
            const prog = getTopicProgress(topic);

            return (
              <div
                key={topic.id}
                id={'learn-topic-' + topic.id}
                className={`bg-white rounded-3xl p-6 border shadow-sm hover:shadow-md transition-all ${
                  focusTopicId === topic.id
                    ? 'border-indigo-300 ring-2 ring-indigo-200'
                    : 'border-slate-100 hover:border-indigo-100'
                }`}
              >
                {/* Header thẻ chủ đề */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-[#4F46E5] font-bold">
                      {topic.tag}
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[#1E1B4B]">
                      {topic.title}
                    </h3>
                  </div>

                  {/* Trạng thái chủ đề */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`text-xs px-3 py-1 rounded-full border font-bold ${prog.statusClass}`}
                    >
                      {prog.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                  {topic.shortDesc}
                </p>

                {/* THANH TIẾN ĐỘ CHỦ ĐỀ */}
                <div className="w-full bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-5">
                  <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                    <span className="text-slate-500">Tiến độ bài học:</span>
                    <span className="font-bold text-[#4F46E5] font-mono">{prog.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-primary rounded-full transition-all duration-300"
                      style={{ width: `${prog.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* DANH SÁCH BÀI THEO TAB HIỆN TẠI */}
                {activeTab === 'video' ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Bài giảng video ({topic.videoIds.length} bài)
                    </p>

                    {isLoading ? (
                      /* Trạng thái đang tải: Lưới Skeleton card cùng kích thước */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
                        <VideoCardSkeleton />
                        <VideoCardSkeleton />
                        <VideoCardSkeleton />
                      </div>
                    ) : topic.videoIds.length === 0 ? (
                      /* Trạng thái rỗng: Chủ đề chưa có video */
                      <div className="p-8 rounded-2xl bg-[#FFFDF8] border border-[#E6DCC8] border-dashed text-center flex flex-col items-center justify-center gap-3">
                        <MamMuc mood="waiting" size="sm" animate={false} />
                        <div>
                          <p className="font-bold text-[#2F3E6B] text-sm">
                            Thầy/cô chưa đăng video cho phần này
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Bài giảng video sẽ sớm được cập nhật vào kho học liệu!
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Lưới thẻ video: 1 cột mobile (<640px), 2 cột tablet (640-1024px), 3 cột desktop (>=1024px), gap 16-20px */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
                        {topic.videoIds.map((vId, idx) => {
                          const v = videosMap[vId];
                          if (!v) return null;
                          return (
                            <VideoCard
                              key={vId}
                              video={v}
                              topic={topic}
                              index={idx}
                              state={state}
                              quizzes={allQuizzes}
                              onClick={() => onSelectVideo(vId)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Lý thuyết chi tiết
                    </p>
                    {(() => {
                      const th =
                        theoriesMap[topic.theoryId] ||
                        Object.values(theoriesMap).find((item) => item.topicId === topic.id);
                      if (!th) {
                        return (
                          <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs text-center font-medium bg-slate-50/50">
                            Chủ đề này chưa có bài lý thuyết đọc. Em hãy học qua tab <strong>Xem video</strong> nhé!
                          </div>
                        );
                      }
                      const isUnderstood = state.completedSteps.includes(
                        `theory_understood:${th.id}`
                      );

                      return (
                        <div
                          onClick={() => onSelectTheory(th.id)}
                          className="p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-purple-300 hover:bg-purple-50/20 cursor-pointer flex items-center justify-between gap-3 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 group-hover:bg-gradient-to-tr group-hover:from-[#8B5CF6] group-hover:to-[#22D3EE] group-hover:text-white text-[#8B5CF6] flex items-center justify-center shrink-0 transition-all shadow-xs">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-[#1E1B4B] group-hover:text-[#8B5CF6] transition-colors">
                                {th.title}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Gồm {th.sections.length} phần chi tiết kèm sơ đồ mô hình và ví dụ minh họa
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isUnderstood && (
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 hidden sm:inline">
                                Đã hiểu
                              </span>
                            )}
                            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:border-[#8B5CF6] group-hover:text-[#8B5CF6] group-hover:translate-x-0.5 transition-all">
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
