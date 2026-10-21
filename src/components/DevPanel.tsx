import React, { useState } from 'react';
import { StudentState, EssaySubmission, RewardRequest, ThemeId } from '../types.ts';
import { REWARDS_CATALOG, QUESTIONS_BANK } from '../data/mockData.ts';
import { THEMES_LIST } from '../data/themes.ts';
import { getChestTierConfig } from '../config.ts';
import { Wrench, X, Play, FastForward, Calendar, CheckSquare, Gift, RotateCcw, ListFilter, Palette, Sparkles, AlertCircle } from 'lucide-react';

interface DevPanelProps {
  state: StudentState;
  onUpdateState: (updater: (prev: StudentState) => StudentState) => void;
  onResetData: (studentId: 'hs001' | 'hs002') => void;
}

export const DevPanel: React.FC<DevPanelProps> = ({ state, onUpdateState, onResetData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'time' | 'essay' | 'reward' | 'xplog'>('time');
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('Em cần điểm danh thêm 1 ngày nữa để đạt tiêu chuẩn tuần nhé!');

  // Xử lý tăng tốc thời gian
  const setMultiplier = (mult: number) => {
    onUpdateState((prev) => ({
      ...prev,
      devTimeMultiplier: mult,
    }));
  };

  // Xử lý tăng/giảm ngày
  const addDayOffset = (days: number) => {
    onUpdateState((prev) => ({
      ...prev,
      devDateOffsetDays: prev.devDateOffsetDays + days,
      // Khi sang ngày mới: reset thời gian và xp hôm nay
      xpToday: days > 0 ? 0 : prev.xpToday,
      activeSecondsToday: days > 0 ? 0 : prev.activeSecondsToday,
      activeSecondsContinuous: 0,
    }));
  };

  // Giả lập giáo viên chốt chấm bài viết
  const gradeEssaySubmission = (subId: string) => {
    onUpdateState((prev) => {
      const sub = prev.essaySubmissions.find((s) => s.id === subId);
      if (!sub) return prev;

      const q = QUESTIONS_BANK[sub.questionId];

      const rubricScores = [
        { criterionName: 'Nội dung ý', score: 3.5, maxScore: 4 },
        { criterionName: 'Bố cục liên kết', score: 2.0, maxScore: 2 },
        { criterionName: 'Dùng từ đặt câu', score: 1.8, maxScore: 2 },
        { criterionName: 'Sáng tạo cảm xúc', score: 1.7, maxScore: 2 },
      ];

      const totalScore = rubricScores.reduce((acc, r) => acc + r.score, 0);
      const maxScore = rubricScores.reduce((acc, r) => acc + r.maxScore, 0);
      const finalRatio = totalScore / maxScore; // ~0.9

      const teacherFeedback =
        'Cô khen em đã nắm vững thể thơ, diễn đạt có cảm xúc và biết liên hệ sâu sắc. Đoạn văn rất ấm áp và giàu chất thơ!';

      const updatedSubs = prev.essaySubmissions.map((s) =>
        s.id === subId
          ? {
              ...s,
              status: 'GRADED' as const,
              rubricScores,
              totalScore,
              finalRatio,
              teacherFeedback,
            }
          : s
      );

      // Cập nhật Mastery cho câu hỏi này
      const newResult = {
        questionId: sub.questionId,
        level: q ? q.level : ('VAN_DUNG' as const),
        isCorrect: finalRatio >= 0.7,
        scoreRatio: finalRatio,
        timestamp: Date.now(),
        topicId: q ? q.topicId : 'topic_tho_bon_nam',
      };

      return {
        ...prev,
        essaySubmissions: updatedSubs,
        questionResults: [newResult, ...prev.questionResults],
      };
    });
  };

  // Giả lập giáo viên duyệt / trao / từ chối rương quà
  const handleRewardAction = (reqId: string, newStatus: 'APPROVED' | 'GIVEN' | 'REJECTED', reason?: string) => {
    onUpdateState((prev) => {
      const updated = prev.rewardRequests.map((r) => {
        if (r.id === reqId) {
          return {
            ...r,
            status: newStatus,
            approvedAt: newStatus === 'APPROVED' ? Date.now() : r.approvedAt,
            givenAt: newStatus === 'GIVEN' ? Date.now() : r.givenAt,
            rejectReason:
              newStatus === 'REJECTED'
                ? (reason || 'Em cần điểm danh thêm 1 ngày nữa để đạt tiêu chuẩn tuần nhé!')
                : undefined,
          };
        }
        return r;
      });

      return {
        ...prev,
        rewardRequests: updated,
      };
    });
    setRejectingReqId(null);
  };

  // Tạo yêu cầu nhận quà mẫu nếu chưa có
  const createMockRewardRequest = (rewardId: string) => {
    onUpdateState((prev) => ({
      ...prev,
      rewardRequests: [
        {
          id: 'req_' + Date.now(),
          rewardId,
          requestedAt: Date.now(),
          status: 'PENDING_APPROVAL',
        },
        ...prev.rewardRequests,
      ],
    }));
  };

  const activeMinutes = Math.floor(state.activeSecondsToday / 60);

  return (
    <>
      {/* NÚT MỞ DEV PANEL (Góc dưới bên phải) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 sm:bottom-6 right-4 z-40 px-3.5 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-white shadow-xl hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-xs font-bold"
        title="Mở Bảng thử nghiệm Dev Panel"
      >
        <Wrench className="w-4 h-4 text-[#FBBF24]" />
        <span className="hidden sm:inline">Bảng Demo</span>
        {state.devTimeMultiplier > 1 && (
          <span className="w-2 h-2 rounded-full bg-[#22D3EE] animate-ping" />
        )}
      </button>

      {/* MODAL / DRAWER DEV PANEL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-6 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl animate-[slideUp_0.2s_ease] text-[#1E1B4B]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80 rounded-t-3xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#1E1B4B]">
                    Bảng Thử Nghiệm (Dev Panel)
                  </h3>
                  <p className="text-[10px] text-slate-400">Dành cho Giám khảo & Lập trình viên</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-indigo-50/40 border-b border-slate-100 text-center text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] font-medium">Tích cực hôm nay</span>
                <span className="font-extrabold text-[#1E1B4B] font-mono">{activeMinutes} phút</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-medium">XP / Trần ngày</span>
                <span className="font-extrabold text-[#4F46E5] font-mono">
                  {state.xpToday}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-medium">Tốc độ đo</span>
                <span className="font-extrabold text-emerald-600 font-mono">
                  x{state.devTimeMultiplier || 1}
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-100 bg-white text-xs font-bold">
              <button
                onClick={() => setActiveTab('time')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                  activeTab === 'time'
                    ? 'border-[#4F46E5] text-[#4F46E5]'
                    : 'border-transparent text-slate-500 hover:text-[#1E1B4B]'
                }`}
              >
                Thời gian
              </button>
              <button
                onClick={() => setActiveTab('essay')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                  activeTab === 'essay'
                    ? 'border-[#4F46E5] text-[#4F46E5]'
                    : 'border-transparent text-slate-500 hover:text-[#1E1B4B]'
                }`}
              >
                Chấm bài ({state.essaySubmissions.filter((s) => s.status === 'PENDING_TEACHER').length})
              </button>
              <button
                onClick={() => setActiveTab('reward')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                  activeTab === 'reward'
                    ? 'border-[#4F46E5] text-[#4F46E5]'
                    : 'border-transparent text-slate-500 hover:text-[#1E1B4B]'
                }`}
              >
                Duyệt quà
              </button>
              <button
                onClick={() => setActiveTab('xplog')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                  activeTab === 'xplog'
                    ? 'border-[#4F46E5] text-[#4F46E5]'
                    : 'border-transparent text-slate-500 hover:text-[#1E1B4B]'
                }`}
              >
                Nhật ký XP
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* TAB 1: THỜI GIAN & NGÀY */}
              {activeTab === 'time' && (
                <div className="space-y-4">
                  {/* Tốc độ đo thời gian học tích cực */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-2">
                      Hệ số tăng tốc thời gian tích cực:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 10, 60].map((m) => (
                        <button
                          key={m}
                          onClick={() => setMultiplier(m)}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                            state.devTimeMultiplier === m
                              ? 'gradient-primary text-white border-transparent shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          x{m} {m === 1 ? '(Thực)' : m === 10 ? '(Nhanh)' : '(Siêu tốc)'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                      * Dùng x60 để 1 giây ngoài đời = 1 phút tích cực, thử nhanh trần 45p và 90p!
                    </p>
                  </div>

                  {/* Giả lập ngày (Test điểm danh, chuỗi, cây ủ rũ) */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="font-bold text-slate-700 block mb-2">
                      Giả lập lệch ngày (Hiện tại lệch: {state.devDateOffsetDays || 0} ngày):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addDayOffset(-1)}
                        className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold"
                      >
                        -1 Ngày
                      </button>
                      <button
                        onClick={() => addDayOffset(1)}
                        className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold"
                      >
                        +1 Ngày (Hôm sau)
                      </button>
                      <button
                        onClick={() => addDayOffset(3)}
                        className="flex-1 py-2 px-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-bold"
                        title="Vắng 3 ngày để xem cây hơi ủ rũ"
                      >
                        +3 Ngày (Ủ rũ)
                      </button>
                    </div>
                  </div>

                  {/* Nút cộng nhanh 40 XP để test trần */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="font-bold text-slate-700 block mb-2">
                      Thử nghiệm nạp XP:
                    </label>
                    <button
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          xpToday: prev.xpToday + 40,
                          xpWeek: prev.xpWeek + 40,
                          totalXp: prev.totalXp + 40,
                        }))
                      }
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold hover:bg-emerald-100 transition-colors"
                    >
                      +40 XP hôm nay
                    </button>
                  </div>

                  {/* Đặt lại dữ liệu mẫu */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="font-bold text-slate-700 block mb-2">
                      Đặt lại dữ liệu demo:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onResetData('hs001')}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100"
                      >
                        Đặt lại hs001 (Đã học)
                      </button>
                      <button
                        onClick={() => onResetData('hs002')}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100"
                      >
                        Đặt lại hs002 (Mới bắt đầu)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CHẤM BÀI VIẾT ĐOẠN VĂN */}
              {activeTab === 'essay' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    Bài viết sau khi học sinh nộp sẽ chờ giáo viên chốt. Bấm nút bên dưới để mô phỏng giáo viên chấm điểm theo rubric và cập nhật Mastery Phân tích/Vận dụng!
                  </p>

                  {state.essaySubmissions.length === 0 ? (
                    <p className="text-center py-6 text-slate-400 italic">
                      Chưa có bài viết nào được nộp. Hãy vào làm bài kiểm tra để nộp bài nhé!
                    </p>
                  ) : (
                    state.essaySubmissions.map((sub) => {
                      const q = QUESTIONS_BANK[sub.questionId];

                      return (
                        <div
                          key={sub.id}
                          className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#1E1B4B] truncate max-w-[180px]">
                              {q ? q.prompt.substring(0, 35) + '…' : 'Bài viết'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                sub.status === 'PENDING_TEACHER'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {sub.status === 'PENDING_TEACHER' ? 'Chờ chốt' : 'Đã chốt'}
                            </span>
                          </div>

                          <p className="text-slate-600 italic line-clamp-2 bg-white p-2.5 rounded-xl border border-slate-100">
                            "{sub.content}"
                          </p>

                          {sub.status === 'PENDING_TEACHER' ? (
                            <button
                              onClick={() => gradeEssaySubmission(sub.id)}
                              className="w-full py-2 rounded-xl gradient-primary text-white font-bold text-xs hover:brightness-105 transition-all shadow-xs"
                            >
                              Giả lập Giáo viên chốt bài (+Mastery)
                            </button>
                          ) : (
                            <div className="text-[10px] text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-medium">
                              ✓ Đã chấm: {sub.totalScore}/10 điểm. Lời phê: "{sub.teacherFeedback}"
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: DUYỆT RƯƠNG QUÀ */}
              {activeTab === 'reward' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    Mô phỏng quy trình giáo viên duyệt, trao rương và từ chối. Dev Panel được phép xem trước nội dung bí mật.
                  </p>

                  {/* Nút tạo nhanh request rương mẫu để test */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Tạo nhanh yêu cầu mở rương:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {REWARDS_CATALOG.map((reward) => {
                        const tier = getChestTierConfig(reward.requiredXp, reward.tierKey);
                        return (
                          <button
                            key={reward.id}
                            onClick={() => createMockRewardRequest(reward.id)}
                            className="py-1.5 px-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-[11px] hover:bg-slate-50 text-left truncate"
                            title={`Tạo yêu cầu ${tier.name} (${reward.requiredXp} XP)`}
                          >
                            + {tier.name} ({reward.requiredXp} XP)
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {state.rewardRequests.length === 0 ? (
                    <p className="text-center py-6 text-slate-400 italic text-xs">
                      Chưa có yêu cầu nhận rương nào. Bấm nút phía trên hoặc vào màn "Quà" để xin mở rương nhé!
                    </p>
                  ) : (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      {state.rewardRequests.map((req) => {
                        const item = REWARDS_CATALOG.find((r) => r.id === req.rewardId);
                        const tier = item ? getChestTierConfig(item.requiredXp, item.tierKey) : null;
                        const isRejectingThis = rejectingReqId === req.id;

                        return (
                          <div
                            key={req.id}
                            className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-2.5 shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs text-[#1E1B4B]">
                                    {tier?.name || req.rewardId}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    ({item?.requiredXp} XP)
                                  </span>
                                </div>
                                {/* Hiển thị nội dung bí mật cho giáo viên/dev kiểm thử */}
                                {item && (
                                  <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                                    🎁 [Bí mật giáo viên]: <strong>{item.secret.name}</strong>
                                  </p>
                                )}
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                                  req.status === 'OPENED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : req.status === 'GIVEN'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                                    : req.status === 'APPROVED'
                                    ? 'bg-indigo-50 text-[#4F46E5] border-indigo-200'
                                    : req.status === 'REJECTED'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-white text-slate-600 border-slate-200'
                                }`}
                              >
                                {req.status === 'OPENED'
                                  ? 'ĐÃ MỞ'
                                  : req.status === 'GIVEN'
                                  ? 'ĐÃ TRAO (Chờ mở)'
                                  : req.status === 'APPROVED'
                                  ? 'ĐÃ DUYỆT'
                                  : req.status === 'REJECTED'
                                  ? 'BỊ TỪ CHỐI'
                                  : 'CHỜ DUYỆT'}
                              </span>
                            </div>

                            {/* Gợi ý khi đã trao */}
                            {req.status === 'GIVEN' && (
                              <p className="text-[10px] text-emerald-700 bg-emerald-50 p-2 rounded-xl border border-emerald-200 leading-tight">
                                ✨ Đã trao! Hãy qua tab <strong>Quà</strong> bấm <strong>"Mở rương ngay!"</strong> để chiêm ngưỡng hoạt ảnh bung nắp và nhận quà bí mật.
                              </p>
                            )}

                            {/* Lý do từ chối nếu có */}
                            {req.status === 'REJECTED' && req.rejectReason && (
                              <p className="text-[10px] text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200 leading-tight">
                                💬 Lời nhắn: {req.rejectReason}
                              </p>
                            )}

                            {/* Hộp nhập lý do từ chối inline (không dùng window.prompt) */}
                            {isRejectingThis && (
                              <div className="p-2.5 rounded-xl bg-white border border-rose-200 space-y-2 animate-[fadeIn_0.2s_ease]">
                                <label className="text-[10px] font-bold text-slate-700 block">
                                  Nhập lý do gửi học sinh:
                                </label>
                                <input
                                  type="text"
                                  value={rejectReasonInput}
                                  onChange={(e) => setRejectReasonInput(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-rose-400"
                                />
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    onClick={() => setRejectingReqId(null)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    onClick={() => handleRewardAction(req.id, 'REJECTED', rejectReasonInput)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 shadow-2xs"
                                  >
                                    Xác nhận từ chối
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 3 Nút mô phỏng giáo viên */}
                            <div className="grid grid-cols-3 gap-1.5 pt-1">
                              <button
                                onClick={() => handleRewardAction(req.id, 'APPROVED')}
                                className="py-1.5 px-2 rounded-xl bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold text-[11px] hover:bg-indigo-100 transition-colors"
                              >
                                Giả lập duyệt
                              </button>
                              <button
                                onClick={() => handleRewardAction(req.id, 'GIVEN')}
                                className="py-1.5 px-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px] hover:bg-emerald-100 transition-colors"
                              >
                                Giả lập đã trao
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingReqId(req.id);
                                  setRejectReasonInput('Em cần điểm danh thêm 1 ngày nữa để đạt tiêu chuẩn tuần nhé!');
                                }}
                                className="py-1.5 px-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] hover:bg-rose-100 transition-colors"
                              >
                                Giả lập từ chối
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: NHẬT KÝ XP */}
              {activeTab === 'xplog' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">
                    Bảng theo dõi minh bạch từng lần cộng XP (kiểm tra luật chỉ cộng lần đầu và trần XP).
                  </p>

                  {state.xpLogs.length === 0 ? (
                    <p className="text-center py-6 text-slate-400 italic">
                      Chưa có nhật ký cộng XP nào.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {state.xpLogs.slice(0, 15).map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-2xl border border-slate-100 bg-slate-50 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-[#1E1B4B] truncate max-w-[200px]">
                              {log.actionName}
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                log.actualXp > 0 ? 'text-[#4F46E5]' : 'text-slate-400'
                              }`}
                            >
                              +{log.actualXp} XP (gốc: {log.rawXp})
                            </span>
                          </div>
                          {log.cappedNotice && (
                            <p className="text-[10px] text-amber-700 italic">
                              ⚠️ {log.cappedNotice}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
