import React, { useState } from 'react';
import { VideoLesson, Topic, StudentState, Quiz } from '../types.ts';
import { XP_CONFIG, TOTAL_VIDEO_XP } from '../config.ts';
import { useLiveQuery, contentService, quizService, QuizWithMeta } from '../services/index.ts';
import { QUIZZES } from '../data/mockData.ts';
import {
  Clock,
  Play,
  Check,
  Sparkles,
  BookOpen,
  Feather,
  Compass,
  FileText,
  RotateCcw,
} from 'lucide-react';

export interface VideoCardProps {
  video: VideoLesson;
  topic: Topic;
  index: number;
  state: StudentState;
  quizzes?: Quiz[];
  onClick: () => void;
}

// Bảng màu Giấy & Mực phong cách thư quán thanh lịch
const THEME_PALETTES: Record<
  string,
  {
    bgGradient: string;
    primaryColor: string;
    accentColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  // Thơ bốn chữ, năm chữ: Xanh mực cổ điển
  topic_tho_bon_nam: {
    bgGradient: 'from-[#1E2B4D] via-[#2F3E6B] to-[#3C5287]',
    primaryColor: '#2F3E6B',
    accentColor: '#C8A96E',
    icon: Feather,
  },
  // Từ láy và tu từ so sánh: Xanh sage dịu mát
  topic_tu_lay_so_sanh: {
    bgGradient: 'from-[#254A32] via-[#416B4E] to-[#588157]',
    primaryColor: '#588157',
    accentColor: '#D8B365',
    icon: BookOpen,
  },
  // Truyện ngắn: Cam đất ấm nồng
  topic_truyen_ngan: {
    bgGradient: 'from-[#6E2C17] via-[#A84A28] to-[#C85A32]',
    primaryColor: '#C85A32',
    accentColor: '#F0C987',
    icon: Compass,
  },
  // Viết đoạn văn: Vàng mật sâu lắng
  topic_doan_van: {
    bgGradient: 'from-[#6B4B10] via-[#A07018] to-[#C99126]',
    primaryColor: '#D99B26',
    accentColor: '#F5DEB3',
    icon: FileText,
  },
};

export type VideoLearningStatus = 'Chưa học' | 'Đang học' | 'Đã hoàn thành' | 'Cần ôn';

export function getVideoCardStatus(
  video: VideoLesson,
  topic: Topic,
  state: StudentState,
  quizzes?: Quiz[]
): {
  status: VideoLearningStatus;
  completedStepsCount: number;
  totalStepsCount: number;
  maxXP: number;
  isFlowCompleted: boolean;
  isInProgress: boolean;
} {
  // Xây dựng danh sách bước thực tế của video này (khớp chính xác với VideoLessonScreen)
  const stepKeys = [`video_watch:${video.id}`];
  let maxXP = XP_CONFIG.VIDEO_WATCH_80_PERCENT_XP;

  if (video.summaryPoints && video.summaryPoints.length > 0) {
    stepKeys.push(`summary_read:${video.id}`);
    maxXP += XP_CONFIG.VIDEO_SUMMARY_READ_XP;
  }

  // Khám phá quiz theo topic tương tự VideoLessonScreen
  const allQuizzes = quizzes || [];
  const topicQuizzes = allQuizzes.filter(
    (q) => q && (q.topicId === topic.id || q.topicId === video.topicId)
  );

  const practiceQuiz =
    (video.practiceQuizId && allQuizzes.find((q) => q.id === video.practiceQuizId)) ||
    topicQuizzes.find((q) => q.kind === 'practice');

  const quickTestQuiz =
    (video.quickTestId && allQuizzes.find((q) => q.id === video.quickTestId)) ||
    topicQuizzes.find((q) => q.kind === 'quick' && q.id !== practiceQuiz?.id);

  const masteryQuiz =
    (video.masteryCheckId && allQuizzes.find((q) => q.id === video.masteryCheckId)) ||
    topicQuizzes.find(
      (q) =>
        (q.kind === 'mastery' || q.kind === 'homework' || q.kind === 'final') &&
        q.id !== practiceQuiz?.id &&
        q.id !== quickTestQuiz?.id
    );

  if (practiceQuiz) {
    stepKeys.push(`quiz_completed:${practiceQuiz.id}`);
    maxXP += XP_CONFIG.VIDEO_PRACTICE_COMPLETED_XP;
  }
  if (quickTestQuiz) {
    stepKeys.push(`quiz_completed:${quickTestQuiz.id}`);
    maxXP += XP_CONFIG.VIDEO_QUICK_TEST_XP;
  }
  if (masteryQuiz) {
    stepKeys.push(`quiz_completed:${masteryQuiz.id}`);
    maxXP += XP_CONFIG.VIDEO_MASTERY_CHECK_XP;
  }

  stepKeys.push(`video_flow_completed:${video.id}`);
  maxXP += XP_CONFIG.VIDEO_FULL_COMPLETION_XP;

  const totalStepsCount = stepKeys.length;
  const completedStepsCount = stepKeys.filter((k) =>
    state.completedSteps.includes(k)
  ).length;

  const isFlowCompleted =
    state.completedSteps.includes(`video_flow_completed:${video.id}`) ||
    (totalStepsCount > 0 && completedStepsCount >= totalStepsCount);

  const isDirectlyActive = state.currentProgress?.itemId === video.id;
  const isInProgress = isDirectlyActive || (completedStepsCount > 0 && !isFlowCompleted);

  // Kiểm tra tình trạng cần ôn:
  // Nếu học sinh tự đánh dấu chưa hiểu hoặc có câu hỏi thuộc chủ đề bị sai/điểm thấp
  const isTopicFlagged = state.flaggedNeedReviewTopicIds.includes(topic.id);
  const hasLowScoreQuestions =
    completedStepsCount > 0 &&
    state.questionResults.some(
      (r) => r.topicId === topic.id && r.scoreRatio < 0.6
    );

  let status: VideoLearningStatus = 'Chưa học';
  if ((isTopicFlagged || hasLowScoreQuestions) && completedStepsCount > 0 && !isFlowCompleted) {
    status = 'Cần ôn';
  } else if (isFlowCompleted) {
    status = 'Đã hoàn thành';
  } else if (isInProgress) {
    status = 'Đang học';
  } else {
    status = 'Chưa học';
  }

  return { status, completedStepsCount, totalStepsCount, maxXP, isFlowCompleted, isInProgress };
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  topic,
  index,
  state,
  quizzes,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);

  // Lắng nghe realtime quizzes nếu component chưa được truyền quizzes
  const { data: liveQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(undefined, true),
    ['content']
  );

  const effectiveQuizzes = quizzes || [
    ...Object.values(QUIZZES),
    ...(liveQuizzes || []),
  ];

  const { status, completedStepsCount, totalStepsCount, maxXP, isFlowCompleted, isInProgress } =
    getVideoCardStatus(video, topic, state, effectiveQuizzes);

  // Tách số thứ tự bài học từ tiêu đề (ví dụ: "Bài 1: Đặc điểm..." -> "Bài 1")
  const match = video.title.match(/^(Bài\s*\d+)/i);
  const lessonNumber = match ? match[1] : `Bài ${index + 1}`;
  const shortTitle = video.title.replace(/^(Bài\s*\d+[:\-.]?\s*)/i, '');

  const durationMinutes = Math.round(video.durationSec / 60);

  // Bảng màu & Icon theo chủ đề
  const palette =
    THEME_PALETTES[topic.id] || {
      bgGradient: 'from-[#1E2B4D] via-[#2F3E6B] to-[#3C5287]',
      primaryColor: topic.colorScheme || '#2F3E6B',
      accentColor: '#C8A96E',
      icon: BookOpen,
    };
  const TopicIcon = palette.icon;

  // Cấu hình nhãn trạng thái (badge góc trên bên trái)
  const statusConfig: Record<
    VideoLearningStatus,
    { label: string; badgeClass: string; icon?: React.ComponentType<{ className?: string }> }
  > = {
    'Chưa học': {
      label: 'Chưa học',
      badgeClass: 'bg-white/85 text-[#5A6578] border-[#D4C8B5] backdrop-blur-xs',
    },
    'Đang học': {
      label: 'Đang học',
      badgeClass: 'bg-[#EBF3FF]/90 text-[#2B6CB0] border-[#BEE3F8] backdrop-blur-xs font-semibold',
    },
    'Đã hoàn thành': {
      label: 'Đã hoàn thành',
      badgeClass: 'bg-[#EAF5EC]/90 text-[#2F6B4F] border-[#B8DFC0] backdrop-blur-xs font-semibold',
      icon: Check,
    },
    'Cần ôn': {
      label: 'Cần ôn',
      badgeClass: 'bg-[#FFF7ED]/95 text-[#C05621] border-[#FBD38D] backdrop-blur-xs font-semibold',
      icon: RotateCcw,
    },
  };

  const currentStatusInfo = statusConfig[status];
  const StatusIcon = currentStatusInfo.icon;

  // Xử lý phím Enter / Space để mở bài học
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const progressPercent = totalStepsCount > 0 ? Math.min(100, Math.round((completedStepsCount / totalStepsCount) * 100)) : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`${lessonNumber}: ${shortTitle || video.title}, ${durationMinutes} phút, ${status.toLowerCase()}`}
      className={`group relative flex flex-col justify-between h-full bg-[#FFFDF8] border border-[#E6DCC8] rounded-[18px] text-left cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md hover:border-[#D5C7B0] hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E6B] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none ${
        status === 'Chưa học' ? 'opacity-95' : 'opacity-100'
      }`}
    >
      {/* ================= PHẦN THUMBNAIL (16:9, BO GÓC TRÊN 16-18PX) ================= */}
      <div className="relative aspect-video w-full rounded-t-[17px] overflow-hidden select-none bg-slate-900">
        {video.thumbnailUrl && !imgError ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          /* Thumbnail SVG phong cách Giấy & Mực độc quyền */
          <div
            className={`w-full h-full relative p-4 flex flex-col justify-between bg-gradient-to-br ${palette.bgGradient} overflow-hidden transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transform-none`}
          >
            {/* Họa tiết dòng kẻ vở mờ & lề tập học sinh */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id={`notebook-grid-${video.id}`}
                  width="100%"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <line
                    x1="0"
                    y1="19"
                    x2="100%"
                    y2="19"
                    stroke="#FFFFFF"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#notebook-grid-${video.id})`} />
              {/* Đường kẻ lề đỏ mờ truyền thống */}
              <line x1="32" y1="0" x2="32" y2="100%" stroke="#FFA8A8" strokeWidth="1.2" opacity="0.35" />
            </svg>

            {/* Watermark icon chủ đề lớn mờ góc phải */}
            <div className="absolute -right-3 -bottom-3 text-white/10 pointer-events-none">
              <TopicIcon className="w-24 h-24 stroke-[1]" />
            </div>

            {/* Nội dung tiêu đề trên thumbnail */}
            <div className="relative z-10 pl-5 pr-2 pt-6">
              <span className="font-['Lora',serif] text-xl sm:text-2xl font-bold text-white tracking-wide block drop-shadow-xs">
                {lessonNumber}
              </span>
              <p className="font-['Lora',serif] text-xs sm:text-sm text-white/90 font-medium line-clamp-2 leading-snug drop-shadow-xs mt-1">
                {shortTitle || video.title}
              </p>
            </div>

            {/* Icon gợi ý chủ đề nhỏ ở góc trái dưới nội dung */}
            <div className="relative z-10 pl-5 flex items-center gap-1.5 text-white/70 text-[11px]">
              <TopicIcon className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{topic.tag}</span>
            </div>
          </div>
        )}

        {/* NHÃN TRẠNG THÁI (GÓC TRÊN BÊN TRÁI) */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border shadow-xs ${currentStatusInfo.badgeClass}`}
          >
            {StatusIcon && <StatusIcon className="w-3 h-3 stroke-[2.5]" />}
            <span>{currentStatusInfo.label}</span>
          </span>
        </div>

        {/* DẤU TICK XANH SAGE KHI ĐÃ HOÀN THÀNH (GÓC TRÊN BÊN PHẢI) */}
        {isFlowCompleted && (
          <div
            title="Đã hoàn thành toàn bộ luồng bài giảng"
            className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-[#588157] text-white flex items-center justify-center shadow-xs border border-white/60"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        )}

        {/* NÚT PLAY Ở GIỮA THUMBNAIL HOẶC NÚT "HỌC TIẾP" Ở GÓC */}
        {isInProgress ? (
          /* Đang học dở: Hiển thị nút "Học tiếp" nổi bật */
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 text-[#2F3E6B] text-xs font-bold shadow-md border border-[#E6DCC8] group-hover:scale-105 group-hover:bg-white transition-transform duration-200">
              <Play className="w-3 h-3 fill-current text-[#2F3E6B]" />
              <span>Học tiếp</span>
            </span>
          </div>
        ) : (
          /* Nút play tròn nhỏ ở giữa; hover phóng to nhẹ 1.1x */
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-10 h-10 rounded-full bg-white/90 text-[#2F3E6B] shadow-md flex items-center justify-center group-hover:scale-110 transition-transform duration-200 motion-reduce:transform-none">
              <Play className="w-4 h-4 fill-current ml-0.5 text-[#2F3E6B]" />
            </div>
          </div>
        )}

        {/* NHÃN THỜI LƯỢNG (GÓC DƯỚI BÊN PHẢI) */}
        <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 bg-black/65 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded-full shadow-xs">
          <Clock className="w-3 h-3 text-white/80" />
          <span>{durationMinutes} phút</span>
        </div>
      </div>

      {/* ================= PHẦN THÔNG TIN (PADDING 16PX) ================= */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3.5">
        <div>
          {/* Tiêu đề video (đậm, tối đa 2 dòng, cắt bằng "...") */}
          <h4
            title={video.title}
            className="font-bold text-[#2F3E6B] text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-[#1E294B] transition-colors"
          >
            {video.title}
          </h4>

          {/* Dòng thời lượng video */}
          <div className="flex items-center gap-1.5 text-xs text-[#718096] mt-2.5">
            <Clock className="w-3.5 h-3.5 text-[#A0AEC0]" />
            <span>{durationMinutes} phút</span>
          </div>
        </div>

        {/* Thanh tiến độ và Nhãn XP */}
        <div className="pt-2.5 border-t border-[#F2ECE1] space-y-2.5">
          {/* Thanh tiến độ mỏng của riêng video đó (0-6 bước) */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-[#718096] mb-1.5 font-medium">
              <span>Tiến độ bài</span>
              <span className="font-semibold text-[#2F3E6B]">
                {completedStepsCount}/{totalStepsCount} bước
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#EAE2D5] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#588157] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Nhãn XP nhỏ màu vàng mật (lấy động theo số bước thực tế của bài) */}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-[#8C7A65]">Phần thưởng</span>
            <span
              title="Tổng XP có thể nhận được khi hoàn thành toàn bộ các bước học"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-full shadow-2xs"
            >
              <Sparkles className="w-3 h-3 text-[#D97706]" />
              <span>Tối đa {maxXP} XP</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton Card hiển thị trạng thái đang tải (cùng kích thước và bố cục)
 */
export const VideoCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col justify-between h-full bg-[#FFFDF8] border border-[#E6DCC8] rounded-[18px] overflow-hidden animate-pulse select-none">
      {/* Thumbnail Skeleton (16:9) */}
      <div className="relative aspect-video w-full bg-[#EFE9DF]">
        <div className="absolute top-2.5 left-2.5 w-16 h-5 rounded-full bg-[#E2D8C8]" />
        <div className="absolute bottom-2.5 right-2.5 w-14 h-4 rounded-full bg-[#E2D8C8]" />
      </div>

      {/* Info Skeleton */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3.5">
        <div>
          <div className="h-4 bg-[#EFE9DF] rounded-md w-3/4 mb-2" />
          <div className="h-4 bg-[#EFE9DF] rounded-md w-1/2 mb-3" />
          <div className="h-3.5 bg-[#EFE9DF] rounded w-20" />
        </div>

        <div className="pt-2.5 border-t border-[#F2ECE1] space-y-2.5">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <div className="h-3 bg-[#EFE9DF] rounded w-16" />
              <div className="h-3 bg-[#EFE9DF] rounded w-12" />
            </div>
            <div className="h-1.5 bg-[#EFE9DF] rounded-full w-full" />
          </div>
          <div className="flex justify-between items-center pt-0.5">
            <div className="h-3 bg-[#EFE9DF] rounded w-16" />
            <div className="h-5 bg-[#EFE9DF] rounded-full w-24" />
          </div>
        </div>
      </div>
    </div>
  );
};
