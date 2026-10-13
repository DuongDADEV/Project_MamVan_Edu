import React, { useState } from 'react';
import { StudentState, Topic } from '../types.ts';
import { TOPICS, VIDEOS, REWARDS_CATALOG, QUIZZES } from '../data/mockData.ts';
import { getCurrentDailyXpCap } from '../logic/xpEngine.ts';
import { calculateAllMastery } from '../logic/mastery.ts';
import { MamMuc } from '../components/MamMuc.tsx';
import { GrowthTree } from '../components/GrowthTree.tsx';
import { ChestIllustration } from '../components/rewards/ChestIllustration.tsx';
import { getChestTierConfig } from '../config.ts';
import {
  CalendarCheck,
  Flame,
  Clock,
  Play,
  ArrowRight,
  RotateCcw,
  Sparkles,
  BookOpen,
  Gift,
  FileCheck,
  CheckCircle,
  Star,
  Award,
  Zap,
  Feather,
  Bell,
} from 'lucide-react';
import {
  useLiveQuery,
  contentService,
  quizService,
  VideoLessonWithMeta,
  QuizWithMeta,
} from '../services/index.ts';

interface HomeScreenProps {
  state: StudentState;
  topics?: Topic[];
  onCheckIn: () => void;
  onResumeLearning: (targetVideoId?: string) => void;
  onSelectTopic: (topicId: string) => void;
  onSelectVideo: (videoId: string) => void;
  onSelectTheory: (theoryId: string) => void;
  onSelectHomework: (homeworkQuizId?: string) => void;
  onNavigateTab: (tab: 'learn' | 'tree' | 'rewards' | 'profile') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  state,
  topics,
  onCheckIn,
  onResumeLearning,
  onSelectTopic,
  onSelectVideo,
  onSelectTheory,
  onSelectHomework,
  onNavigateTab,
}) => {
  const [wateringTrigger, setWateringTrigger] = useState(false);
  const activeTopics = topics ?? [];

  // Lắng nghe video và quizzes từ kho nội dung
  const { data: liveVideos } = useLiveQuery<VideoLessonWithMeta[]>(
    () => contentService.getVideoLessons(undefined, true),
    ['content']
  );
  const { data: liveQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(state.profile.grade || undefined, true),
    ['quizzes', 'content']
  );

  // Xác định bài học tiếp tục / bắt đầu
  const currentVideo = state.currentProgress
    ? ((liveVideos || []).find((v) => v.id === state.currentProgress?.itemId) || VIDEOS[state.currentProgress?.itemId])
    : null;

  const firstAvailableVideo = React.useMemo(() => {
    if (liveVideos && liveVideos.length > 0) {
      for (const t of activeTopics) {
        if (t.videoIds && t.videoIds.length > 0) {
          const match = liveVideos.find((lv) => t.videoIds.includes(lv.id));
          if (match) return match;
        }
      }
      return liveVideos[0];
    }
    return null;
  }, [liveVideos, activeTopics]);

  const activeLesson = currentVideo || firstAvailableVideo;
  const isResuming = !!currentVideo;

  // Lấy danh sách BTVN từ kho quizzes (loại homework)
  const homeworkQuizzes = (liveQuizzes || []).filter((q) => q.kind === 'homework');

  const isQuizCompleted = (qId: string) =>
    (state.completedSteps || []).includes(`quiz_completed:${qId}`);

  // Ưu tiên bài tập chưa làm
  const pendingHomework = homeworkQuizzes.find((hw) => !isQuizCompleted(hw.id));
  const completedHomework = homeworkQuizzes.find((hw) => isQuizCompleted(hw.id));
  const activeHomework = pendingHomework || completedHomework;
  const isHomeworkCompleted = !pendingHomework && !!completedHomework;

  // Lời chào theo giờ
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? 'Chào buổi sáng'
      : currentHour < 18
      ? 'Chào buổi chiều'
      : 'Chào buổi tối';

  const todayStr = new Date().toISOString().split('T')[0];
  const hasCheckedInToday = state.lastAttendanceDate === todayStr;

  const activeMinutes = Math.floor(state.activeSecondsToday / 60);
  const currentDailyCap = getCurrentDailyXpCap(activeMinutes);

  // Xác định câu nói của Mầm Mực
  let mascotText = `Chào ${state.profile.name}! Hôm nay chúng mình cùng khám phá những áng văn thật hay nhé!`;
  let mascotMood: any = 'happy';

  if (!hasCheckedInToday) {
    mascotText = `Bạn ơi, điểm danh đầu ngày để nhận +2 XP và tưới cho mầm cây thêm tươi nào!`;
    mascotMood = 'cheer';
  } else if (state.currentProgress) {
    mascotText = `Chúng mình đang học dở bài thơ, bấm "Học tiếp" để cùng hoàn thành nhé!`;
    mascotMood = 'cheer';
  } else if (state.xpToday >= currentDailyCap) {
    mascotText = `Hôm nay bạn học xuất sắc lắm, đạt trần ${currentDailyCap} XP rồi! Vẫn có thể học để nuôi Cây lớn nha!`;
    mascotMood = 'proud';
  }

  // Lấy dữ liệu quà gần đạt nhất
  const closestReward = REWARDS_CATALOG[0];
  const rewardXpPercent = Math.min(
    100,
    Math.round((state.xpWeek / Math.max(1, closestReward.xpCost)) * 100)
  );

  // Danh sách cần xem lại
  const allMastery = calculateAllMastery(state.questionResults);
  const weakItems: { id: string; title: string; reason: string; videoId?: string }[] = [];

  activeTopics.forEach((t) => {
    const isFlagged = state.flaggedNeedReviewTopicIds.includes(t.id);
    const tMastery = calculateAllMastery(state.questionResults, t.id);
    const hasLowSkill = Object.values(tMastery).some((m) => m.status === 'NEEDS_REVIEW');
    if ((isFlagged || hasLowSkill) && weakItems.length < 3) {
      weakItems.push({
        id: t.id,
        title: t.title,
        reason: isFlagged
          ? 'Bạn đã đánh dấu "Chưa hiểu" ở bài lý thuyết'
          : 'Cần củng cố thêm một số câu hỏi trắc nghiệm',
        videoId: t.videoIds && t.videoIds.length > 0 ? t.videoIds[0] : undefined,
      });
    }
  });

  // Dữ liệu lá cho cây
  const topicLeavesData = activeTopics.map((t) => {
    const tMastery = calculateAllMastery(state.questionResults, t.id);
    const avg = Math.round(
      (tMastery.NHAN_BIET.percentage +
        tMastery.THONG_HIEU.percentage +
        tMastery.PHAN_TICH.percentage +
        tMastery.VAN_DUNG.percentage) /
        4
    );

    let status: any = 'INSUFFICIENT_DATA';
    if (tMastery.NHAN_BIET.totalQuestionsAttempted >= 3) {
      if (avg >= 80) status = 'SOLID';
      else if (avg >= 50) status = 'PROGRESSING';
      else status = 'NEEDS_REVIEW';
    }

    return {
      topicId: t.id,
      topicTitle: t.title,
      masteryStatus: status,
      percentage: avg,
    };
  });

  const handleCheckInClick = () => {
    setWateringTrigger(true);
    onCheckIn();
  };

  // Màu sắc thẻ chủ đề kiểu EdTech đa dạng
  const topicVisuals = [
    {
      gradient: 'from-[#4F46E5] to-[#7C3AED]',
      iconBg: 'bg-indigo-400/30 text-white',
      badge: 'Thơ ca',
      icon: BookOpen,
    },
    {
      gradient: 'from-[#10B981] to-[#059669]',
      iconBg: 'bg-emerald-400/30 text-white',
      badge: 'Tiếng Việt',
      icon: Feather,
    },
    {
      gradient: 'from-[#06B6D4] to-[#2563EB]',
      iconBg: 'bg-cyan-400/30 text-white',
      badge: 'Văn xuôi',
      icon: Sparkles,
    },
    {
      gradient: 'from-[#F59E0B] to-[#EA580C]',
      iconBg: 'bg-amber-400/30 text-white',
      badge: 'Tập làm văn',
      icon: FileCheck,
    },
  ];

  // Lắng nghe thông báo bài học mới từ giáo viên
  const { data: rawAnnouncements } = useLiveQuery<any[]>(
    () => {
      try {
        const raw = localStorage.getItem('mam_van_announcements');
        return Promise.resolve(raw ? JSON.parse(raw) : []);
      } catch {
        return Promise.resolve([]);
      }
    },
    ['content']
  );
  const activeAnnouncement = (rawAnnouncements || [])[0];

  return (
    <div className="w-full max-w-5xl mx-auto py-6 px-4 sm:px-8 space-y-7">
      {/* Biểu ngữ Thông báo bài học mới nếu có */}
      {activeAnnouncement && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-indigo-500/10 border border-orange-200/80 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-[#E2704A] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1E1B4B] truncate">
                📢 {activeAnnouncement.title}
              </p>
              <p className="text-[11px] text-slate-600 truncate">
                {activeAnnouncement.content}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('learn')}
            className="px-3.5 py-1.5 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold shrink-0 transition-colors shadow-2xs"
          >
            Học ngay
          </button>
        </div>
      )}

      {/* ================= 1. CREATIVE EDTECH HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-3xl gradient-primary text-white p-6 sm:p-8 shadow-xl shadow-indigo-500/20">
        {/* Background decorative glowing rings & stars */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-cyan-400/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-cyan-200">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Không gian rèn luyện Ngữ văn lớp 7</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
              {greeting}, {state.profile.name}! 🌟
            </h2>

            <p className="text-sm text-indigo-100 max-w-lg leading-relaxed font-normal">
              {state.profile.grade} · {state.profile.school}. Hôm nay bạn đã sẵn sàng ươm mầm cảm thụ văn học cùng bạn đồng hành chưa?
            </p>

            {/* Achievement Mini Dashboard Tags */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {/* Stars / XP */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold">
                <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                <span>{state.xpToday}/{currentDailyCap} XP</span>
              </div>

              {/* Time */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold">
                <Clock className="w-4 h-4 text-cyan-300" />
                <span>{activeMinutes} phút học</span>
              </div>

              {/* Attendance Streak */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold">
                <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
                <span>{state.attendanceDaysThisWeek}/5 ngày</span>
              </div>
            </div>
          </div>

          {/* Mascot in Hero Banner */}
          <div className="shrink-0 flex items-center justify-center lg:justify-end">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-lg">
              <MamMuc mood={mascotMood} size="lg" bubbleText={mascotText} />
            </div>
          </div>
        </div>
      </div>

      {/* ================= 2. SUBJECT / TOPIC CAROUSEL (IN THE STYLE OF THE REFERENCE IMAGE) ================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[#1E1B4B] tracking-tight">
              Chủ đề học kỳ này
            </h3>
            <p className="text-xs text-slate-500">
              Chọn chủ đề yêu thích để xem bài giảng hoặc đọc lý thuyết
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('learn')}
            className="text-xs font-bold text-[#4F46E5] hover:text-[#7C3AED] flex items-center gap-1 transition-colors"
          >
            <span>Tất cả bài học</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeTopics.length === 0 ? (
          <div className="p-8 text-center bg-white/70 border border-slate-200/80 rounded-3xl">
            <MamMuc mood="waiting" size="sm" className="mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-500">
              Chưa có chủ đề nào được xuất bản. Thầy/Cô sẽ sớm cập nhật các bài học mới nhé!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeTopics.map((topic, idx) => {
              const visual = topicVisuals[idx % topicVisuals.length];
              const Icon = visual.icon;

              return (
                <div
                  key={topic.id}
                  onClick={() => onSelectTopic(topic.id)}
                  className={`relative overflow-hidden rounded-3xl p-5 text-white bg-gradient-to-br ${visual.gradient} shadow-md shadow-indigo-950/10 cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-xl group`}
                >
                  {/* Light reflection glow */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/15 rounded-full blur-xl pointer-events-none -mr-8 -mt-8 group-hover:scale-125 transition-transform" />

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md border border-white/25">
                      {visual.badge}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h4 className="font-extrabold text-base mb-1.5 leading-snug line-clamp-2">
                    {topic.title}
                  </h4>

                  <p className="text-[11px] text-white/80 line-clamp-2 leading-relaxed mb-4">
                    {topic.shortDesc}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/20 text-xs font-semibold">
                    <span>{(topic.videoIds || []).length} bài giảng</span>
                    <div className="flex items-center gap-1 text-white group-hover:translate-x-1 transition-transform">
                      <span>Vào học</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= 3. HÀNG 2 CỘT: ĐIỂM DANH & HỌC TIẾP ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* THẺ ĐIỂM DANH HIỆN ĐẠI */}
        <div className="edtech-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#1E1B4B]">
                    Điểm danh mỗi ngày
                  </h3>
                  <p className="text-xs text-slate-500">Chuỗi chuyên cần trong tuần</p>
                </div>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                +2 XP & Tưới cây
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              Học đều đặn giúp cây luôn xanh tươi! Mỗi tuần có{' '}
              <strong className="text-[#4F46E5]">1 ngày nghỉ được miễn</strong> không lo mất chuỗi.
            </p>

            {/* Các ngày trong tuần */}
            <div className="flex items-center justify-between gap-2 mb-6">
              {['T2', 'T3', 'T4', 'T5', 'T6'].map((day, idx) => {
                const isPassed = idx < state.attendanceDaysThisWeek;
                return (
                  <div
                    key={day}
                    className={`flex-1 py-2.5 rounded-2xl text-center border transition-all ${
                      isPassed
                        ? 'bg-gradient-to-tr from-[#10B981] to-[#059669] text-white border-transparent shadow-xs font-bold'
                        : 'bg-slate-50 border-slate-200/80 text-slate-500 font-medium'
                    }`}
                  >
                    <span className="text-xs block">{day}</span>
                    <span className="text-[10px] block mt-0.5">{isPassed ? '✓' : '·'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {!hasCheckedInToday ? (
            <button
              onClick={handleCheckInClick}
              className="w-full py-3 rounded-2xl gradient-reward text-white font-bold text-sm hover:brightness-105 active:scale-[0.99] transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Điểm danh ngay (+2 XP)</span>
            </button>
          ) : (
            <div className="w-full py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs text-center flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Đã điểm danh hôm nay! Chuỗi: {state.attendanceDaysThisWeek}/5 ngày</span>
            </div>
          )}
        </div>

        {/* THẺ "HỌC TIẾP" NỔI BẬT */}
        <div className="edtech-card rounded-3xl p-6 bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/30 border border-indigo-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5] bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                {isResuming ? 'Tiếp tục bài học' : 'Bài học đề xuất'}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  isResuming
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {isResuming ? 'Đang dở' : 'Bài học mới'}
              </span>
            </div>

            <h3 className="font-extrabold text-lg text-[#1E1B4B] mb-2 leading-snug">
              {activeLesson ? activeLesson.title : 'Khám phá bài học mới'}
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              {isResuming ? (
                <>
                  Bước hiện tại:{' '}
                  <strong className="text-[#4F46E5]">
                    {state.currentProgress?.stepIndex === 3
                      ? 'Luyện tập sau video'
                      : state.currentProgress?.stepIndex === 4
                      ? 'Kiểm tra 1 (7 phút)'
                      : 'Xem bài giảng & Tóm tắt'}
                  </strong>
                </>
              ) : activeLesson ? (
                <>
                  Bắt đầu học cùng bạn đồng hành Mầm Mực · Thời lượng:{' '}
                  <strong className="text-[#4F46E5]">{Math.round((activeLesson.durationSec || 600) / 60)} phút</strong>
                </>
              ) : (
                'Khám phá kho bài giảng phong phú cùng bạn đồng hành Mầm Mực!'
              )}
            </p>
          </div>

          <button
            onClick={() => {
              if (activeLesson) {
                onSelectVideo(activeLesson.id);
              } else {
                onNavigateTab('learn');
              }
            }}
            className="w-full py-3.5 rounded-2xl gradient-primary text-white font-bold text-sm hover:brightness-105 active:scale-[0.99] transition-all shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              {isResuming
                ? 'Học tiếp ngay'
                : activeLesson
                ? 'Bắt đầu học ngay'
                : 'Khám phá bài học'}
            </span>
          </button>
        </div>
      </div>

      {/* ================= 4. THANH TIẾN ĐỘ THỜI GIAN & XP HÔM NAY ================= */}
      <div className="edtech-card rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              <h3 className="font-extrabold text-base text-[#1E1B4B]">
                Tiến độ năng lượng học tập hôm nay
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Thời gian tích cực: <strong className="text-[#1E1B4B]">{activeMinutes} phút</strong> (Bộ đếm chỉ ghi nhận khi bạn có thao tác thật)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-slate-500 block">XP hôm nay:</span>
              <span className="text-lg font-black text-[#4F46E5] font-mono tabular-nums">
                {state.xpToday} / {currentDailyCap} XP
              </span>
            </div>
          </div>
        </div>

        {/* Soft Modern Bar */}
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full rounded-full gradient-primary transition-all duration-500"
            style={{ width: `${Math.min(100, (state.xpToday / currentDailyCap) * 100)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2 font-medium">
          <span>0 XP</span>
          <span>Trần ngày: {currentDailyCap} XP (0–45p: 130 XP · 45–90p: 150 XP)</span>
          <span>{currentDailyCap} XP</span>
        </div>
      </div>

      {/* ================= 5. CÂY CỦA TÔI & BTVN GIÁO VIÊN GIAO ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Cây tri thức thu nhỏ */}
        <div className="edtech-card rounded-3xl p-6 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                🌱
              </div>
              <h3 className="font-extrabold text-base text-[#1E1B4B]">Cây tri thức Mầm Mực</h3>
            </div>
            <button
              onClick={() => onNavigateTab('tree')}
              className="text-xs font-bold text-[#4F46E5] hover:underline flex items-center gap-1"
            >
              <span>Xem vườn</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <GrowthTree
            compact
            completedStepsCount={state.completedSteps.length}
            topicLeaves={topicLeavesData}
            isWatering={wateringTrigger}
            onWaterComplete={() => setWateringTrigger(false)}
            onLeafClick={(tId) => onSelectTopic(tId)}
          />
        </div>

        {/* Bài tập về nhà đặc biệt (BTVN từ giáo viên) */}
        <div className="edtech-card rounded-3xl p-6 border-indigo-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                  isHomeworkCompleted
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-purple-100 text-[#8B5CF6]'
                }`}
              >
                {isHomeworkCompleted
                  ? 'Đã hoàn thành ✓'
                  : activeHomework?.dueDate
                  ? `Hạn nộp: ${activeHomework.dueDate}`
                  : 'Nhiệm vụ tuần'}
              </span>
              <span
                className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                  isHomeworkCompleted
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                }`}
              >
                +{activeHomework?.xp || 20} XP
              </span>
            </div>

            <h3 className="font-extrabold text-base text-[#1E1B4B] mb-2">
              {activeHomework
                ? activeHomework.title
                : 'Chưa có bài tập về nhà mới'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              {isHomeworkCompleted
                ? 'Em đã hoàn thành xuất sắc bài tập này! Em có thể làm lại để nâng cao kết quả và củng cố tư duy.'
                : activeHomework
                ? (activeHomework as any).description ||
                  'Bài tập rèn luyện do cô giáo giao riêng! Làm bài để tích lũy XP và rèn luyện kỹ năng nhé.'
                : 'Thầy/cô chưa giao thêm bài tập về nhà mới cho lớp. Bạn hãy luyện tập các bài học trong kho tri thức nhé!'}
            </p>
          </div>

          {activeHomework ? (
            isHomeworkCompleted ? (
              <button
                onClick={() => onSelectHomework(activeHomework.id)}
                className="w-full py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm border border-emerald-200 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Xem lại / Làm lại bài (+XP)</span>
              </button>
            ) : (
              <button
                onClick={() => onSelectHomework(activeHomework.id)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm hover:brightness-105 active:scale-[0.99] transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>Làm bài BTVN ngay (+{activeHomework?.xp || 20} XP)</span>
              </button>
            )
          ) : (
            <button
              onClick={() => onNavigateTab('learn')}
              className="w-full py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] font-bold text-sm border border-indigo-200 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#4F46E5]" />
              <span>Đến kho bài học rèn luyện</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= 6. KHU "CẦN XEM LẠI" & QUÀ TẶNG ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Cần xem lại */}
        <div className="edtech-card rounded-3xl p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-[#1E1B4B]">Cần ôn lại</h3>
          </div>

          {weakItems.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              Tuyệt vời! Kiến thức hiện tại rất vững, không có phần nào cần ôn lại.
            </div>
          ) : (
            <div className="space-y-3">
              {weakItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100 flex items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#1E1B4B]">{item.title}</h4>
                    <p className="text-[11px] text-rose-600 mt-0.5 font-medium">{item.reason}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (item.videoId) onSelectVideo(item.videoId);
                      else onSelectTopic(item.id);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-colors shrink-0 shadow-xs"
                  >
                    Ôn ngay
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quà tặng tuần */}
        <div className="edtech-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-[#1E1B4B]">Rương quà bí mật</h3>
              </div>
              <button
                onClick={() => onNavigateTab('rewards')}
                className="text-xs font-bold text-[#4F46E5] hover:underline flex items-center gap-1"
              >
                <span>Xem kho rương</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {(() => {
              const chestTier = getChestTierConfig(closestReward.requiredXp, closestReward.tierKey);
              const isEligible = state.xpWeek >= closestReward.requiredXp && state.attendanceDaysThisWeek >= closestReward.requiredAttendanceDays;

              return (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-xs">
                    <ChestIllustration
                      tier={closestReward.tierKey}
                      state={isEligible ? 'eligible' : 'locked'}
                      size={36}
                      animationsEnabled={false}
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-[#1E1B4B]">
                      {chestTier.name} (Quà bí mật)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Mốc: {closestReward.requiredXp} XP · Chuyên cần {closestReward.requiredAttendanceDays} ngày
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span>Tiến độ tuần:</span>
              <span className="text-[#4F46E5] font-bold font-mono">{rewardXpPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full gradient-primary transition-all duration-300"
                style={{ width: `${rewardXpPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
