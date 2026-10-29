import React, { useState } from 'react';
import { StudentState, Topic } from '../types.ts';
import { BADGES_CATALOG } from '../data/badges.ts';
import { TREE_STAGES_CONFIG } from '../config.ts';
import { calculateAllMastery, SKILL_METADATA } from '../logic/mastery.ts';
import { buildTopicLeaf } from '../logic/topicCompletion.ts';
import {
  useLiveQuery,
  quizService,
  QuizWithMeta,
  QuestionWithMeta,
} from '../services/index.ts';
import { getLocalTodayStr, countLearningSteps } from '../logic/studentStateUtils.ts';
import { GrowthTree, TopicLeafData } from '../components/GrowthTree.tsx';
import { MamMuc } from '../components/MamMuc.tsx';
import { Award, Sprout, BarChart3, ArrowRight, CheckCircle2, Lock, Sparkles, Layers, Droplets } from 'lucide-react';

interface TreeScreenProps {
  state: StudentState;
  topics?: Topic[];
  onSelectTopic: (topicId: string) => void;
  onCheckIn?: () => void;
}

export const TreeScreen: React.FC<TreeScreenProps> = ({ state, topics, onSelectTopic, onCheckIn }) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'mastery' | 'badges'>('tree');
  const [selectedLeafTopicId, setSelectedLeafTopicId] = useState<string | null>(null);
  const [isWatering, setIsWatering] = useState(false);
  const [wateringFeedback, setWateringFeedback] = useState<string | null>(null);

  const todayStr = getLocalTodayStr();
  const [hasWateredThisSession, setHasWateredThisSession] = useState<boolean>(() => {
    try {
      const studentKey = state.profile?.id || 'hs001';
      return (
        sessionStorage.getItem('mam_van_watered_session_' + studentKey) === todayStr ||
        state.lastAttendanceDate === todayStr
      );
    } catch {
      return state.lastAttendanceDate === todayStr;
    }
  });

  const handleWaterTree = () => {
    if (hasWateredThisSession || isWatering) {
      return;
    }
    setIsWatering(true);
    setHasWateredThisSession(true);
    try {
      const studentKey = state.profile?.id || 'hs001';
      sessionStorage.setItem('mam_van_watered_session_' + studentKey, todayStr);
    } catch {}

    if (onCheckIn) {
      onCheckIn();
    }
    setWateringFeedback('💧 Bạn đã tưới nước cho Cây Mầm Mực! Hạt mầm văn chương đang lớn lên từng ngày 🌱✨');
    setTimeout(() => {
      setIsWatering(false);
    }, 1800);
    setTimeout(() => {
      setWateringFeedback(null);
    }, 3500);
  };

  // Dữ liệu lá trên cây lấy từ danh sách chủ đề thực tế (chỉ hiện chủ đề giáo viên đã xuất bản)
  const activeTopics = topics || [];
  const { data: liveQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(state.profile?.grade || undefined, true),
    ['quiz', 'content']
  );
  const { data: liveQuestions } = useLiveQuery<Record<string, QuestionWithMeta>>(
    () => quizService.getQuestions(undefined),
    ['content']
  );
  // Màu lá theo TIẾN ĐỘ LUỒNG HỌC (cùng phần trăm với màn Học bài), không
  // theo độ vững trắc nghiệm nữa (29/10: lá từng kẹt xám "Chưa học" khi
  // chưa đủ 3 câu NHAN_BIET dù luồng đã 100%).
  const topicLeavesData: TopicLeafData[] = activeTopics.map((t) =>
    buildTopicLeaf(
      t,
      liveQuizzes || [],
      liveQuestions || {},
      state.completedSteps || [],
      state.questionResults || []
    )
  );

  // Tính toán toàn bộ Mastery 4 mức
  const allMastery = calculateAllMastery(state.questionResults);

  // SVG Icon cho từng huy hiệu
  const renderBadgeIcon = (iconType: string, isUnlocked: boolean) => {
    const strokeColor = isUnlocked ? '#8B5CF6' : '#94A3B8';
    const fillColor = isUnlocked ? '#F5F3FF' : '#F1F5F9';

    switch (iconType) {
      case 'streak_fire':
        return (
          <svg width="36" height="36" viewBox="0 0 24 24" fill={fillColor} stroke={isUnlocked ? '#F59E0B' : strokeColor} strokeWidth="2">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
        );
      case 'analysis_feather':
        return (
          <svg width="36" height="36" viewBox="0 0 24 24" fill={fillColor} stroke={isUnlocked ? '#4F46E5' : strokeColor} strokeWidth="2">
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
            <line x1="16" y1="8" x2="2" y2="22" />
            <line x1="17.5" y1="15" x2="9" y2="15" />
          </svg>
        );
      case 'solid_tree':
        return (
          <svg width="36" height="36" viewBox="0 0 24 24" fill={fillColor} stroke={isUnlocked ? '#10B981' : strokeColor} strokeWidth="2">
            <path d="M12 10v12" />
            <path d="M12 2a5 5 0 0 0-5 5c0 1.5.6 2.8 1.6 3.8L5 14h14l-3.6-3.2A5 5 0 0 0 12 2z" />
          </svg>
        );
      case 'overcome_mountain':
        return (
          <svg width="36" height="36" viewBox="0 0 24 24" fill={fillColor} stroke={isUnlocked ? '#EC4899' : strokeColor} strokeWidth="2">
            <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
          </svg>
        );
      case 'book_sprout':
      default:
        return (
          <svg width="36" height="36" viewBox="0 0 24 24" fill={fillColor} stroke={isUnlocked ? '#06B6D4' : strokeColor} strokeWidth="2">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
        );
    }
  };

  const selectedTopic = activeTopics.find((t) => t.id === selectedLeafTopicId);

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 sm:px-8 space-y-6 text-[#1E1B4B]">
      {/* HEADER: Tiêu đề + 3 Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700 mb-2">
            <Sprout className="w-3.5 h-3.5" />
            <span>Khu vườn năng lực</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] tracking-tight">
            Cây Văn & Năng lực
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi sự lớn lên của Cây tri thức và 4 mức độ tư duy Ngữ văn
          </p>
        </div>

        {/* 3 Tabs chuyển đổi góc nhìn */}
        <div className="flex items-center p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('tree')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'tree'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-[#1E1B4B]'
            }`}
          >
            <Sprout className="w-4 h-4 text-emerald-600" />
            <span>Cây tri thức</span>
          </button>

          <button
            onClick={() => setActiveTab('mastery')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'mastery'
                ? 'bg-white text-[#4F46E5] shadow-sm'
                : 'text-slate-600 hover:text-[#1E1B4B]'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-[#4F46E5]" />
            <span>Ma trận năng lực</span>
          </button>

          <button
            onClick={() => setActiveTab('badges')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'badges'
                ? 'bg-white text-[#8B5CF6] shadow-sm'
                : 'text-slate-600 hover:text-[#1E1B4B]'
            }`}
          >
            <Award className="w-4 h-4 text-[#8B5CF6]" />
            <span>Huy hiệu</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: CÂY TRI THỨC VÀ CÁC LÁ CHỦ ĐỀ ================= */}
      {activeTab === 'tree' && (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
          {/* Card Cây chính */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col items-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Tiến trình sinh trưởng
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#1E1B4B]">
                  Vườn Văn Mầm Mực
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium block">Đã tích lũy:</span>
                <span className="font-extrabold text-[#4F46E5] font-mono text-sm sm:text-base">
                  {countLearningSteps(state.completedSteps)} hoạt động học
                </span>
              </div>
            </div>

            {/* VẼ CÂY LỚN BẰNG SVG */}
            <GrowthTree
              completedStepsCount={countLearningSteps(state.completedSteps)}
              topicLeaves={topicLeavesData}
              isWatering={isWatering}
              onWaterComplete={() => setIsWatering(false)}
              onLeafClick={(tId) => setSelectedLeafTopicId(tId)}
              className="my-4"
            />

            {/* Thông báo nếu giáo viên chưa xuất bản chủ đề nào */}
            {activeTopics.length === 0 && (
              <div className="w-full text-center py-3 px-4 my-2 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 font-medium">
                🌱 Thầy/Cô chưa công bố chủ đề nào cho lớp. Các chồi lá tri thức sẽ trổ sinh ngay khi có bài học mới được xuất bản!
              </div>
            )}

            {/* THANH TƯƠNG TÁC TƯỚI NƯỚC CHO MẦM MỰC */}
            <div className="w-full mt-2 mb-4 p-4 bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-emerald-50/80 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-2xl bg-white shadow-xs border border-indigo-100 flex items-center justify-center text-xl shrink-0">
                  {hasWateredThisSession ? '🌱' : '💧'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1E1B4B] flex items-center gap-1.5">
                    <span>Nước tưới Mầm Mực</span>
                    {hasWateredThisSession ? (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Đã tưới nước ✓
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Sẵn sàng
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {hasWateredThisSession
                      ? 'Cây Mầm Mực đã nhận đủ dưỡng chất! Hãy quay lại tưới nước ở lần đăng nhập tiếp theo nhé.'
                      : 'Tưới nước mỗi ngày để kích thích mầm cây vươn chồi và trổ lá tri thức!'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWaterTree}
                disabled={isWatering || hasWateredThisSession}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shrink-0 ${
                  hasWateredThisSession
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 opacity-90 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] disabled:opacity-60 text-white shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer'
                }`}
              >
                {hasWateredThisSession ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Đã tưới nước xong ✓</span>
                  </>
                ) : (
                  <>
                    <Droplets className={`w-4 h-4 text-cyan-200 ${isWatering ? 'animate-bounce' : ''}`} />
                    <span>{isWatering ? 'Đang tưới nước...' : 'Tưới nước cho cây (+XP)'}</span>
                  </>
                )}
              </button>
            </div>

            {wateringFeedback && (
              <div className="mb-4 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-4 py-2.5 rounded-xl text-center animate-[fadeIn_0.3s_ease] w-full shadow-xs">
                {wateringFeedback}
              </div>
            )}

            {/* Chú giải trạng thái lá */}
            <div className="mt-2 pt-4 border-t border-slate-100 w-full flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#10B981]" /> Vững (≥80%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#22D3EE]" /> Đang tiến bộ (50–79%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#FBBF24]" /> Cần ôn lại (&lt;50%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-300" /> Chưa học
              </span>
            </div>
          </div>

          {/* CÁC GIAI ĐOẠN SINH TRƯỞNG CỦA CÂY */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h4 className="text-sm font-extrabold text-[#1E1B4B] mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FBBF24]" />
              <span>6 Mốc sinh trưởng của Cây:</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {TREE_STAGES_CONFIG.map((stage, idx) => {
                const isReached = countLearningSteps(state.completedSteps) >= stage.minSteps;

                return (
                  <div
                    key={stage.stage}
                    className={`p-3.5 rounded-2xl border text-center transition-all ${
                      isReached
                        ? 'border-emerald-200 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-100 bg-slate-50 opacity-60'
                    }`}
                  >
                    <span className="text-xl block mb-1">
                      {idx === 0 ? '🌰' : idx === 1 ? '🌱' : idx === 2 ? '🌿' : idx === 3 ? '🪴' : idx === 4 ? '🌸' : '🍎'}
                    </span>
                    <h5 className="text-xs font-bold text-[#1E1B4B] mb-0.5">{stage.name}</h5>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {stage.minSteps} bước
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: MA TRẬN 4 MỨC NĂNG LỰC ================= */}
      {activeTab === 'mastery' && (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-base sm:text-lg font-extrabold text-[#1E1B4B] mb-1">
              Đánh giá theo 4 mức độ nhận thức
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Hệ thống tính điểm có trọng số giảm dần theo thời gian (kết quả gần nhất phản ánh đúng nhất năng lực hiện tại của bạn)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  { key: 'NHAN_BIET' as const, color: 'emerald', bar: 'from-emerald-400 to-teal-500' },
                  { key: 'THONG_HIEU' as const, color: 'indigo', bar: 'from-indigo-500 to-blue-600' },
                  { key: 'PHAN_TICH' as const, color: 'purple', bar: 'from-purple-500 to-indigo-600' },
                  { key: 'VAN_DUNG' as const, color: 'amber', bar: 'from-amber-400 to-orange-500' },
                ]
              ).map(({ key, bar }) => {
                const info = SKILL_METADATA[key];
                const data = allMastery[key];

                let statusBadge = (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
                    Chưa đủ dữ liệu (&lt;3 câu)
                  </span>
                );

                if (data.status === 'SOLID') {
                  statusBadge = (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                      ✓ Đạt vững ({data.percentage}%)
                    </span>
                  );
                } else if (data.status === 'PROGRESSING') {
                  statusBadge = (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold">
                      Đang tiến bộ ({data.percentage}%)
                    </span>
                  );
                } else if (data.status === 'NEEDS_REVIEW') {
                  statusBadge = (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                      Cần ôn lại ({data.percentage}%)
                    </span>
                  );
                }

                return (
                  <div
                    key={key}
                    className="p-5 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-3 hover:border-indigo-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-mono text-slate-400 font-semibold block">
                          {key}
                        </span>
                        <h4 className="text-base font-extrabold text-[#1E1B4B]">
                          {info.displayName}
                        </h4>
                      </div>
                      {statusBadge}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {info.shortDesc}
                    </p>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${bar} rounded-full transition-all duration-500`}
                          style={{ width: `${data.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>Đã làm: {data.totalQuestionsAttempted} câu</span>
                        <span>Mức đạt: {data.percentage}%</span>
                      </div>
                    </div>

                    {/* Gợi ý hành động */}
                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <strong>Kỹ năng rèn luyện:</strong> {info.exampleSkill}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: BỘ SƯU TẬP HUY HIỆU ================= */}
      {activeTab === 'badges' && (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#1E1B4B]">
                  Huy hiệu thành tích
                </h3>
                <p className="text-xs text-slate-500">
                  Những cột mốc ghi nhận nỗ lực rèn luyện của bạn cùng Mầm Mực
                </p>
              </div>
              <span className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-purple-50 text-[#8B5CF6] border border-purple-100">
                Đã đạt: {state.unlockedBadgeIds.length} / {BADGES_CATALOG.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BADGES_CATALOG.map((b) => {
                const isUnlocked = state.unlockedBadgeIds.includes(b.id);

                return (
                  <div
                    key={b.id}
                    className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${
                      isUnlocked
                        ? 'bg-gradient-to-br from-white to-purple-50/40 border-purple-100 shadow-xs'
                        : 'bg-slate-50 border-slate-200/70 opacity-65'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                        isUnlocked
                          ? 'bg-white border-purple-200 shadow-sm'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      {renderBadgeIcon(b.iconType, isUnlocked)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h4 className="text-sm font-extrabold text-[#1E1B4B]">{b.title}</h4>
                        {isUnlocked ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Đã đạt
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 flex items-center gap-0.5">
                            <Lock className="w-3 h-3" /> Chưa mở
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mb-2">
                        {b.desc}
                      </p>

                      <span className="text-[11px] font-medium text-slate-400 block capitalize">
                        Phân loại: {b.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT KHI BẤM VÀO MỘT LÁ TRÊN CÂY */}
      {selectedTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-[scaleIn_0.2s_ease]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#4F46E5] font-bold">
                {selectedTopic.tag}
              </span>
              <button
                onClick={() => setSelectedLeafTopicId(null)}
                className="text-xs text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕ Đóng
              </button>
            </div>

            <h3 className="text-lg font-extrabold text-[#1E1B4B] mb-2">
              {selectedTopic.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {selectedTopic.shortDesc}
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 mb-5">
              <span className="text-xs font-bold text-slate-700 block">
                Nội dung trong chủ đề này:
              </span>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                <li>Gồm {(selectedTopic.videoIds || []).length} bài giảng video của thầy/cô</li>
                <li>1 chuyên đề lý thuyết tổng hợp chi tiết</li>
                <li>Hệ thống bài tập kiểm tra 4 mức độ năng lực</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedLeafTopicId(null);
                  onSelectTopic(selectedTopic.id);
                }}
                className="flex-1 py-3 rounded-2xl gradient-primary text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/25 hover:brightness-105 active:scale-95 transition-all"
              >
                <span>Vào ôn luyện chủ đề này</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
