import React from 'react';
import { RewardTier } from '../../types.ts';
import { CHEST_TIERS, getChestTierConfig } from '../../config.ts';
import { ChestIllustration } from './ChestIllustration.tsx';
import { Sprout, Check } from 'lucide-react';

interface RewardTrackProps {
  currentXp: number;
  currentAttendanceDays: number;
  rewards: RewardTier[];
  onSelectReward?: (rewardId: string) => void;
}

/**
 * Component "Đường lên rương" (RewardTrack):
 * - Biểu diễn hành trình tích lũy XP tuần từ 0 đến mốc cao nhất
 * - Đặt các rương nhỏ tại các mốc XP tương ứng
 * - Cột mốc hình mầm cây nhỏ chỉ vị trí XP tuần hiện tại của học sinh
 * - Rương đã đạt mốc XP thì sáng, chưa đạt thì mờ
 * - Bấm vào rương trên đường sẽ cuộn mượt tới thẻ tương ứng
 */
export const RewardTrack: React.FC<RewardTrackProps> = ({
  currentXp,
  currentAttendanceDays,
  rewards,
  onSelectReward,
}) => {
  // Sắp xếp quà tăng dần theo XP
  const sortedRewards = [...rewards].sort((a, b) => a.requiredXp - b.requiredXp);
  const maxXp = Math.max(750, ...sortedRewards.map((r) => r.requiredXp));
  const currentPercent = Math.min(100, Math.max(0, (currentXp / maxXp) * 100));

  const handleChestClick = (rewardId: string) => {
    if (onSelectReward) {
      onSelectReward(rewardId);
    } else {
      const el = document.getElementById(`chest-card-${rewardId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div className="bg-[#FFFDF8] rounded-3xl p-5 sm:p-7 border border-[#E6DCC8] shadow-sm relative overflow-hidden">
      {/* Tiêu đề & Thông số nhanh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFF5F0] text-[#2D5A3D] text-[11px] font-bold border border-[#D4E2D7] mb-1">
            <Sprout className="w-3.5 h-3.5 text-[#4D8F5A]" />
            <span>Hành trình tuần</span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-[#2F3E6B]">
            Đường lên rương kho báu
          </h3>
          <p className="text-xs text-[#5C6A79]">
            Tích lũy XP tuần để tiến bước tới các rương quà lớn hơn
          </p>
        </div>

        {/* Chip hiển thị vị trí hiện tại */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3.5 py-1.5 rounded-2xl bg-[#FAF5EB] border border-[#EADBBE] text-center shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#7A6A55] block">XP Tuần này</span>
            <span className="text-base font-mono font-black text-[#2F3E6B]">
              {currentXp} / {maxXp} XP
            </span>
          </div>
          <div className="px-3.5 py-1.5 rounded-2xl bg-[#EFF5F0] border border-[#D4E2D7] text-center shadow-xs">
            <span className="text-[10px] uppercase font-bold text-[#2D5A3D] block">Chuyên cần</span>
            <span className="text-base font-mono font-black text-[#2D5A3D]">
              {currentAttendanceDays}/5 ngày
            </span>
          </div>
        </div>
      </div>

      {/* TRACK CHÍNH: THANH TIẾN ĐỘ & CÁC CỘT MỐC RƯƠNG */}
      <div className="relative pt-12 pb-6 px-4 sm:px-8 select-none">
        {/* Đường ray nền */}
        <div className="relative h-3 bg-[#EFE9DF] rounded-full overflow-visible border border-[#E2D8C7]">
          {/* Thanh tiến độ đầy dần (gradient Giấy & Mực cam đất - vàng mật) */}
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${currentPercent}%`,
              background: 'linear-gradient(90deg, #7FA88A 0%, #E2704A 50%, #F2B84B 100%)',
            }}
          />

          {/* CỘT MỐC HÌNH MẦM CÂY NHỎ CHỈ VỊ TRÍ HIỆN TẠI CỦA HỌC SINH */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-700 pointer-events-none"
            style={{ left: `${Math.min(97, Math.max(3, currentPercent))}%` }}
          >
            {/* Nhãn mầm cây nổi phía trên */}
            <div className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap animate-[bounce_2.5s_ease-in-out_infinite] motion-reduce:animate-none">
              <div className="px-2.5 py-1 rounded-full bg-[#1E5238] text-white text-[11px] font-bold shadow-md shadow-[#1E5238]/20 flex items-center gap-1 border border-[#3B7D4E]">
                <Sprout className="w-3.5 h-3.5 text-[#A8D6AF]" />
                <span>Em ở đây: {currentXp} XP</span>
              </div>
              {/* Mũi tên nhỏ chỉ xuống */}
              <div className="w-2 h-2 bg-[#1E5238] rotate-45 mx-auto -mt-1" />
            </div>

            {/* Viên bi định vị trên thanh ray */}
            <div className="w-6 h-6 rounded-full bg-white border-2 border-[#1E5238] shadow-md flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1E5238]" />
            </div>
          </div>
        </div>

        {/* CÁC ĐIỂM DỪNG RƯƠNG TRÊN ĐƯỜNG RAY (chiều cao cố định: các điểm dừng
            đều position absolute nên không đặt chiều cao là khung sập về 0) */}
        <div className="relative w-full mt-3 h-24">
          {sortedRewards.map((reward) => {
            const tierConfig = getChestTierConfig(reward.requiredXp, reward.tierKey);
            // Kẹp vị trí hiển thị để rương ở mốc 0%/100% không tràn ra ngoài khung
            const posPercent = Math.min(96, Math.max(4, (reward.requiredXp / maxXp) * 100));
            const isReached = currentXp >= reward.requiredXp;

            return (
              <div
                key={reward.id}
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center cursor-pointer group"
                style={{ left: `${posPercent}%` }}
                onClick={() => handleChestClick(reward.id)}
                title={`Bấm để xem ${tierConfig.name} (${reward.requiredXp} XP)`}
              >
                {/* Vạch đánh dấu trên ray */}
                <div
                  className={`w-1 h-3 -mt-6 rounded-full transition-colors ${
                    isReached ? 'bg-[#1E5238]' : 'bg-[#C2B7A3]'
                  }`}
                />

                {/* Hộp rương thu nhỏ */}
                <div
                  className={`mt-2 p-1.5 rounded-2xl transition-all duration-300 transform group-hover:scale-110 ${
                    isReached
                      ? 'bg-white border-2 border-[#7FA88A] shadow-md shadow-[#7FA88A]/20 opacity-100'
                      : 'bg-[#FAF5EB]/90 border border-[#E2D8C7] opacity-65 group-hover:opacity-90'
                  }`}
                >
                  <ChestIllustration
                    tier={reward.tierKey}
                    state={isReached ? 'eligible' : 'locked'}
                    size={42}
                    animationsEnabled={false}
                  />

                  {/* Dấu tick đã đạt mốc XP */}
                  {isReached && (
                    <div className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[#2F6B4F] text-white flex items-center justify-center text-[10px] shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Tên rương & mốc XP (KHÔNG hiển thị tên món quà thật) */}
                <span className="text-[11px] font-bold text-[#2F3E6B] mt-1.5 text-center leading-tight">
                  {tierConfig.name}
                </span>
                <span className="text-[10px] font-mono font-semibold text-[#8C7A65]">
                  {reward.requiredXp} XP
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RewardTrack;
