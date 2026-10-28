import React, { useState } from 'react';
import { StudentState, Topic } from '../types.ts';
import { calculateAllMastery, isTopicSolid } from '../logic/mastery.ts';
import { BookOpen, ArrowRight, Filter, Layers, PenLine, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { deriveFlowItems } from '../logic/flowOrder.ts';
import { countTopicFlowDone } from '../logic/topicCompletion.ts';
import { useLiveQuery, contentService, quizService, VideoLessonWithMeta, TheoryLessonWithMeta, QuizWithMeta, QuestionWithMeta } from '../services/index.ts';

interface LearnScreenProps {
  state: StudentState;
  topics?: Topic[];
  focusTopicId?: string | null;
  onSelectVideo: (videoId: string) => void;
  onSelectTheory: (theoryId: string) => void;
  onSelectQuiz?: (quizId: string) => void;
}

export const LearnScreen: React.FC<LearnScreenProps> = ({
  state,
  topics,
  focusTopicId,
  onSelectVideo,
  onSelectTheory,
  onSelectQuiz,
}) => {
  // Đợt sửa 24/10: bỏ 3 nút Luồng học / Xem video / Lý thuyết chung, thay bằng
  // MỘT nút "Học bài" trên mỗi thẻ chủ đề. Bấm nút thì mở danh sách luồng học
  // (chỉ những mục cô đã đẩy, đúng thứ tự cô đã xếp); nháp không bao giờ hiện
  // vì các truy vấn dưới đây đều dùng onlyPublished = true.
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'unlearned' | 'needs_review'>('all');
  const activeTopics = topics ?? [];

  // Điều hướng từ Trang chủ / Cây / Kết quả: cuộn tới đúng thẻ chủ đề được chọn
  // và tự mở danh sách Học bài của chủ đề đó.
  React.useEffect(() => {
    if (!focusTopicId) return;
    setFilter('all');
    setExpandedTopics((prev) => ({ ...prev, [focusTopicId]: true }));
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
  const { data: liveQuestions } = useLiveQuery<Record<string, QuestionWithMeta>>(
    () => quizService.getQuestions(undefined),
    ['content']
  );

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

    // Tính phần trăm hoàn thành bước học của chủ đề — cùng định nghĩa
    // với bảng hoàn thành của giáo viên (28/10): đếm mục luồng đã xong
    // (video xong trọn luồng, lý thuyết xong trọn luồng, bài tập làm đúng
    // hết phần chấm tự động) trên tổng số mục luồng. Trước đây chỉ đếm
    // video_watch nên xem đủ video đã hiện 100% dù chưa xong bài tập.
    const topicQs = (liveQuizzes || []).filter((q) => q.topicId === topic.id);
    const { done: doneItems, total: totalItems } = countTopicFlowDone(
      topic,
      topicQs,
      (liveQuestions || {}) as Record<string, QuestionWithMeta>,
      state.completedSteps || [],
      state.questionResults || []
    );
    const progressPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

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
      {/* HEADER: Tiêu đề */}
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
            Bấm nút Học bài ở từng chủ đề để học đúng thứ tự cô đã xếp — chỉ những bài cô đã đẩy mới hiện ở đây.
          </p>
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
            const isExpanded = !!expandedTopics[topic.id];

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

                {/* NÚT HỌC BÀI — mở/đóng danh sách luồng học của chủ đề */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedTopics((prev) => ({ ...prev, [topic.id]: !prev[topic.id] }))
                  }
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#2F3E6B] text-white text-sm font-bold hover:opacity-90 active:scale-[0.99] transition"
                >
                  <Play className="w-4 h-4" />
                  {isExpanded ? 'Thu gọn' : 'Học bài'}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {/* DANH SÁCH LUỒNG HỌC: chỉ mục cô đã đẩy, đúng thứ tự cô đã xếp */}
                {isExpanded && (
                  <div className="space-y-2 mt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Luồng học của chủ đề — học theo thứ tự từ trên xuống
                    </p>
                    {(() => {
                      const vids = (liveVideos || []).filter((v) => topic.videoIds.includes(v.id));
                      const ths = (liveTheories || []).filter((t) => t.topicId === topic.id);
                      const qzs = (liveQuizzes || []).filter((q) => q.topicId === topic.id);
                      const items = deriveFlowItems(
                        topic.flowOrder,
                        topic.videoIds.filter((id) => vids.some((v) => v.id === id)),
                        ths.map((t) => t.id),
                        qzs.map((q) => q.id)
                      );
                      if (items.length === 0) {
                        return (
                          <div className="p-6 rounded-2xl bg-[#FFFDF8] border border-[#E6DCC8] border-dashed text-center">
                            <p className="font-bold text-[#2F3E6B] text-sm">
                              Thầy/cô chưa đăng bài cho chủ đề này
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Các bài học sẽ sớm được cập nhật vào kho học liệu!
                            </p>
                          </div>
                        );
                      }
                      return items.map((item, idx) => {
                        const src: any =
                          item.type === 'video'
                            ? vids.find((v) => v.id === item.id)
                            : item.type === 'theory'
                              ? ths.find((t) => t.id === item.id)
                              : qzs.find((q) => q.id === item.id);
                        if (!src) return null;
                        const meta =
                          item.type === 'video'
                            ? `Video • ${Math.max(1, Math.round((src.durationSec || 0) / 60))} phút`
                            : item.type === 'theory'
                              ? 'Lý thuyết • Đọc và ghi nhớ'
                              : `Bài tập • ${src.questionIds?.length || 0} câu`;
                        return (
                          <button
                            key={item.type + ':' + item.id}
                            type="button"
                            onClick={() =>
                              item.type === 'video'
                                ? onSelectVideo(item.id)
                                : item.type === 'theory'
                                  ? onSelectTheory(item.id)
                                  : onSelectQuiz?.(item.id)
                            }
                            className="w-full flex items-center gap-3 bg-white border border-slate-200 hover:border-[#E2704A]/60 hover:shadow-sm rounded-2xl px-3.5 py-3 text-left transition-all"
                          >
                            <span className="w-7 h-7 rounded-full bg-[#2F3E6B] text-white text-xs font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                item.type === 'video'
                                  ? 'bg-orange-50 text-[#E2704A]'
                                  : item.type === 'theory'
                                    ? 'bg-purple-50 text-[#7C3AED]'
                                    : 'bg-indigo-50 text-[#4F46E5]'
                              }`}
                            >
                              {item.type === 'video' ? (
                                <Play className="w-4 h-4" />
                              ) : item.type === 'theory' ? (
                                <BookOpen className="w-4 h-4" />
                              ) : (
                                <PenLine className="w-4 h-4" />
                              )}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-bold text-sm text-[#1E1B4B] truncate">
                                {src.title}
                              </span>
                              <span className="block text-[11px] text-slate-500">{meta}</span>
                            </span>
                            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                          </button>
                        );
                      });
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
