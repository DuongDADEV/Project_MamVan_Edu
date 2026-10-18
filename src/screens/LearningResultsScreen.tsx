import React, { useMemo } from 'react';
import { Trophy, Target, Zap, BookOpenCheck, Award, Lock, TrendingUp } from 'lucide-react';
import { StudentState, Topic } from '../types.ts';
import { calculateAllMastery, SKILL_METADATA } from '../logic/mastery.ts';
import { countLearningSteps } from '../logic/studentStateUtils.ts';
import { formatScore } from '../utils/scoreFormat.ts';
import { BADGES_CATALOG } from '../data/mockData.ts';

interface LearningResultsScreenProps {
  state: StudentState;
  topics: Topic[];
  onSelectTopic?: (topicId: string) => void;
}

const ONE_WEEK = 7 * 86400000;

type TopicStatus = 'SOLID' | 'PROGRESSING' | 'NEEDS_REVIEW' | 'INSUFFICIENT_DATA';

const STATUS_META: Record<TopicStatus, { label: string; chip: string; bar: string }> = {
  SOLID: { label: 'Đã hoàn thành', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: '#16A34A' },
  PROGRESSING: { label: 'Đang học', chip: 'bg-sky-50 text-sky-700 border-sky-200', bar: '#38BDF8' },
  NEEDS_REVIEW: { label: 'Cần ôn lại', chip: 'bg-amber-50 text-amber-700 border-amber-200', bar: '#FBBF24' },
  INSUFFICIENT_DATA: { label: 'Chưa học', chip: 'bg-slate-100 text-slate-500 border-slate-200', bar: '#CBD5E1' },
};

/**
 * Màn "Kết quả học tập" của học sinh (mục mới ở thanh điều hướng theo Figma):
 * điểm theo từng chủ đề, biểu đồ tiến bộ theo tuần và thành tích / XP / huy hiệu.
 */
export const LearningResultsScreen: React.FC<LearningResultsScreenProps> = ({
  state,
  topics,
  onSelectTopic,
}) => {
  const results = state.questionResults || [];

  // Tổng quan
  const overview = useMemo(() => {
    const total = results.length;
    const correct = results.filter((r) => r.isCorrect).length;
    const avgScore =
      total > 0
        ? Math.round((results.reduce((acc, r) => acc + r.scoreRatio, 0) / total) * 100) / 10
        : 0;
    return {
      total,
      correctRate: total > 0 ? Math.round((correct / total) * 100) : 0,
      avgScore,
    };
  }, [results]);

  // Điểm theo từng chủ đề
  const topicRows = useMemo(
    () =>
      topics.map((t) => {
        const mastery = calculateAllMastery(results, t.id);
        const avg = Math.round(
          (mastery.NHAN_BIET.percentage +
            mastery.THONG_HIEU.percentage +
            mastery.PHAN_TICH.percentage +
            mastery.VAN_DUNG.percentage) /
            4
        );
        const topicResults = results.filter((r) => r.topicId === t.id);
        const avgScore =
          topicResults.length > 0
            ? Math.round(
                (topicResults.reduce((acc, r) => acc + r.scoreRatio, 0) / topicResults.length) *
                  100
              ) / 10
            : null;
        let status: TopicStatus = 'INSUFFICIENT_DATA';
        if (mastery.NHAN_BIET.totalQuestionsAttempted >= 3) {
          if (avg >= 80) status = 'SOLID';
          else if (avg >= 50) status = 'PROGRESSING';
          else status = 'NEEDS_REVIEW';
        }
        return { topic: t, mastery, avg, avgScore, attempts: topicResults.length, status };
      }),
    [topics, results]
  );

  // Tiến bộ theo tuần (6 tuần gần nhất, chỉ tính bài làm của chính học sinh)
  const weeklyData = useMemo(() => {
    const now = Date.now();
    const weeks: { weekLabel: string; diemTB: number | null; soCau: number }[] = [];
    for (let w = 5; w >= 0; w--) {
      const start = now - (w + 1) * ONE_WEEK;
      const end = now - w * ONE_WEEK;
      const inWeek = results.filter((r) => r.timestamp >= start && r.timestamp < end);
      // Tuần không làm bài -> null (đường điểm đứt đoạn), không vẽ như điểm 0
      const avg =
        inWeek.length > 0
          ? Math.round((inWeek.reduce((acc, r) => acc + r.scoreRatio, 0) / inWeek.length) * 100) /
            10
          : null;
      weeks.push({
        weekLabel: w === 0 ? 'Tuần này' : w === 1 ? 'Tuần trước' : `${w} tuần trước`,
        diemTB: avg,
        soCau: inWeek.length,
      });
    }
    return weeks;
  }, [results]);

  const hasWeeklyData = weeklyData.some((w) => w.soCau > 0);
  const unlockedCount = (state.unlockedBadgeIds || []).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Tiêu đề */}
      <div>
        <h2 className="font-lora font-bold text-2xl text-[#1E1B4B] flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[#E2704A]" />
          Kết quả học tập
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Hành trình tiến bộ của em qua từng chủ đề — học đều mỗi ngày để cây tri thức lớn nhanh nhé!
        </p>
      </div>

      {/* Thẻ tổng quan */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-[#E8DFD1] p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Tổng XP tích lũy
          </div>
          <div className="text-2xl font-black text-[#1E1B4B]">
            {state.totalXp} <span className="text-xs font-bold text-slate-400">XP</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Hôm nay +{state.xpToday} XP</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8DFD1] p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
            <Trophy className="w-3.5 h-3.5 text-purple-500" /> Huy hiệu đạt được
          </div>
          <div className="text-2xl font-black text-[#1E1B4B]">
            {unlockedCount}
            <span className="text-xs font-bold text-slate-400"> /{BADGES_CATALOG.length}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Điểm danh tuần này {state.attendanceDaysThisWeek} ngày
          </div>
        </div>
      </div>

      {/* Điểm theo chủ đề */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5 space-y-4">
        <h3 className="font-lora font-bold text-base text-[#1E1B4B]">Điểm theo từng chủ đề</h3>
        {topicRows.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            Chưa có chủ đề nào được công bố. Khi thầy cô mở bài mới, kết quả của em sẽ hiện ở đây.
          </p>
        ) : (
          <div className="space-y-4">
            {topicRows.map(({ topic, mastery, avg, avgScore, attempts, status }) => {
              const meta = STATUS_META[status];
              return (
                <div key={topic.id} className="border border-slate-100 rounded-2xl p-4 bg-[#FFFEFA]">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectTopic && onSelectTopic(topic.id)}
                      className="font-bold text-sm text-[#1E1B4B] hover:text-[#E2704A] transition-colors text-left"
                      title="Tới bài học của chủ đề này"
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                        style={{ backgroundColor: topic.colorScheme || '#2F3E6B' }}
                      />
                      {topic.title}
                    </button>
                    <div className="flex items-center gap-2">
                      {avgScore !== null && (
                        <span className="text-xs font-bold text-slate-500">
                          Điểm TB {avgScore}/10 • {attempts} câu
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.chip}`}
                      >
                        {meta.label} {status !== 'INSUFFICIENT_DATA' && `(${avg}%)`}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
                    {(['NHAN_BIET', 'THONG_HIEU', 'PHAN_TICH', 'VAN_DUNG'] as const).map((lvl) => (
                      <div key={lvl}>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                          <span>{SKILL_METADATA[lvl]?.displayName || lvl}</span>
                          <span>{mastery[lvl].percentage}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${mastery[lvl].percentage}%`, backgroundColor: meta.bar }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tiến bộ theo tuần: đường mốc nối 6 tuần (tuần này nổi bật nhất;
          tuần chưa làm bài hiện mốc xám thay vì biến mất khỏi biểu đồ) */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5">
        <div className="flex items-start justify-between gap-3 mb-5">
          <h3 className="font-lora font-bold text-base text-[#1E1B4B]">
            Biểu đồ tiến bộ (6 tuần gần nhất)
          </h3>
          {hasWeeklyData && (
            <div className="text-right shrink-0">
              <p className="text-[11px] font-semibold text-slate-400">
                Tổng {weeklyData.reduce((acc, w) => acc + w.soCau, 0)} câu · Tuần này:{' '}
                {weeklyData[5].soCau} câu
                {weeklyData[5].diemTB !== null && ` · ĐTB ${formatScore(weeklyData[5].diemTB)}`}
              </p>
            </div>
          )}
        </div>
        {hasWeeklyData ? (
          <div className="relative px-1 pt-1 pb-1">
            {/* Đường nối các mốc tuần */}
            <div className="absolute left-[8%] right-[8%] top-[27px] h-1.5 rounded-full bg-slate-100" />
            <div
              className="absolute left-[8%] top-[27px] h-1.5 rounded-full bg-gradient-to-r from-indigo-200 via-indigo-300 to-[#E2704A]"
              style={{ width: '84%' }}
            />
            <div className="relative flex items-start">
              {weeklyData.map((w, i) => {
                const isCurrent = i === weeklyData.length - 1;
                const hasData = w.soCau > 0 && w.diemTB !== null;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center text-center min-w-0">
                    <div
                      className={`rounded-full flex items-center justify-center font-extrabold border-4 border-white shadow-sm ${
                        isCurrent
                          ? 'w-14 h-14 text-sm text-white bg-gradient-to-br from-[#E2704A] to-[#F59E0B] ring-4 ring-orange-100'
                          : hasData
                            ? 'w-11 h-11 mt-[5px] text-xs text-white bg-gradient-to-br from-[#4F46E5] to-[#7C3AED]'
                            : 'w-11 h-11 mt-[5px] text-xs text-slate-300 bg-slate-100'
                      }`}
                      title={hasData ? `ĐTB ${formatScore(w.diemTB)} — ${w.soCau} câu` : 'Chưa làm bài'}
                    >
                      {hasData ? formatScore(w.diemTB) : '—'}
                    </div>
                    <p
                      className={`mt-2 text-[11px] leading-tight ${
                        isCurrent ? 'font-extrabold text-[#1E1B4B]' : 'font-semibold text-slate-500'
                      }`}
                    >
                      {w.weekLabel}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {w.soCau > 0 ? `${w.soCau} câu` : 'Chưa học'}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-slate-400 text-center">
              Số trong mỗi mốc là điểm trung bình của tuần đó (thang 10).
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">
            Em chưa làm bài trong 6 tuần gần đây. Làm vài câu hỏi hôm nay để biểu đồ tiến bộ bắt đầu
            nhích lên nhé!
          </p>
        )}
      </div>

      {/* Thành tích & huy hiệu */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5">
        <h3 className="font-lora font-bold text-base text-[#1E1B4B] mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-500" /> Thành tích & Huy hiệu
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BADGES_CATALOG.map((badge) => {
            const unlocked = (state.unlockedBadgeIds || []).includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`p-3.5 rounded-2xl border flex gap-3 ${
                  unlocked
                    ? 'bg-purple-50/60 border-purple-200'
                    : 'bg-slate-50 border-slate-200 opacity-70'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    unlocked ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {unlocked ? <Award className="w-5 h-5" /> : <Lock className="w-4.5 h-4.5" />}
                </div>
                <div className="min-w-0">
                  <div className={`text-xs font-bold ${unlocked ? 'text-purple-900' : 'text-slate-500'}`}>
                    {badge.title}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{badge.desc}</p>
                  <span
                    className={`inline-block mt-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      unlocked ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {unlocked ? 'Đã đạt ✓' : 'Chưa đạt'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
