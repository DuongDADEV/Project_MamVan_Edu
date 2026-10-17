import React, { useState } from 'react';
import { StudentState, RewardTier, RewardRequest } from '../types.ts';
import { REWARDS_CATALOG } from '../data/rewards.ts';
import { RewardTrack } from '../components/rewards/RewardTrack.tsx';
import { ChestCard } from '../components/rewards/ChestCard.tsx';
import { ChestOpeningModal } from '../components/rewards/ChestOpeningModal.tsx';
import { OpenedChestsCollection } from '../components/rewards/OpenedChestsCollection.tsx';
import { RequestHistory } from '../components/rewards/RequestHistory.tsx';
import { ChestIllustration } from '../components/rewards/ChestIllustration.tsx';

interface RewardsScreenProps {
  state: StudentState;
  onRequestReward: (rewardId: string) => void;
  onClaimRewardChest?: (rewardId: string, requestId: string) => void;
}

/**
 * Màn hình "Rương Quà Bí Mật" (RewardsScreen)
 * - Phong cách Giấy & Mực
 * - Học sinh không được biết trước món quà thật
 * - Mỗi mốc quà là một chiếc rương với hình ảnh, tên và kích thước tăng dần
 * - Hiển thị "Đường lên rương", lưới rương bí mật, bộ sưu tập "Rương đã mở" và lịch sử đề xuất
 */
export const RewardsScreen: React.FC<RewardsScreenProps> = ({
  state,
  onRequestReward,
  onClaimRewardChest,
}) => {
  // Sắp xếp các mốc quà tăng dần theo yêu cầu XP
  const sortedRewards = [...REWARDS_CATALOG].sort((a, b) => a.requiredXp - b.requiredXp);

  // Quản lý Modal mở rương hoạt ảnh
  const [openingTarget, setOpeningTarget] = useState<{
    reward: RewardTier;
    request: RewardRequest;
  } | null>(null);

  const handleOpenChest = (reward: RewardTier, request: RewardRequest) => {
    setOpeningTarget({ reward, request });
  };

  const handleConfirmClaim = (rewardId: string, requestId: string) => {
    if (onClaimRewardChest) {
      onClaimRewardChest(rewardId, requestId);
    }
  };

  // Lọc danh sách rương đã mở (OPENED) cho mục Bộ sưu tập
  const openedRequests = state.rewardRequests
    .filter((req) => req.status === 'OPENED')
    .map((req) => ({
      request: req,
      // Không tìm thấy trong catalog tĩnh (quà do GV tạo/sửa) -> nhãn trung tính,
      // TUYỆT ĐỐI không thay bằng một phần quà khác gây hiểu nhầm
      reward: REWARDS_CATALOG.find((r) => r.id === req.rewardId) || {
        id: req.rewardId,
        requiredXp: 0,
        xpCost: 0,
        requiredAttendanceDays: 0,
        tierKey: 'HAT' as const,
        teaserDescription: '',
        secret: {
          name: 'Phần quà từ thầy/cô',
          description: 'Món quà đặc biệt do thầy/cô trao tặng.',
        },
        isPhysical: false,
      },
    }));

  return (
    <div className="w-full max-w-5xl mx-auto py-6 px-4 sm:px-8 space-y-7 text-[#1E1B4B]">
      {/* 1. HEADER TRANG: RƯƠNG QUÀ BÍ MẬT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6DCC8] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF5EB] border border-[#EADBBE] text-xs font-bold text-[#7A6A55] mb-2 shadow-2xs">
            {/* Icon SVG rương nhỏ thay cho icon lấp lánh */}
            <ChestIllustration tier="HAT" state="eligible" size={18} animationsEnabled={false} />
            <span>Phần thưởng bí mật của Thầy/Cô</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[#2F3E6B] tracking-tight"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            Rương quà bí mật
          </h2>
          <p className="text-xs sm:text-sm text-[#5C6A79] mt-1">
            Học đều mỗi tuần để mở những món quà bất ngờ từ thầy/cô.
          </p>
        </div>
      </div>

      {/* 2. ĐƯỜNG LÊN RƯƠNG (REWARD TRACK) */}
      <RewardTrack
        currentXp={state.xpWeek}
        currentAttendanceDays={state.attendanceDaysThisWeek}
        rewards={sortedRewards}
      />

      {/* 3. LƯỚI THẺ RƯƠNG BÍ MẬT */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3
              className="text-lg sm:text-xl font-bold text-[#2F3E6B]"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              Các cấp rương tuần này
            </h3>
            <p className="text-xs text-[#5C6A79]">
              Mốc XP càng cao, rương càng lộng lẫy và chứa đựng món quà càng giá trị!
            </p>
          </div>
        </div>

        {/* Lưới responsive: 1 cột mobile, 2 cột tablet, 4 cột desktop. Chiều cao bằng nhau. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {sortedRewards.map((reward) => {
            // Lấy request tích cực gần nhất cho rương này (GIVEN, APPROVED, PENDING, REJECTED, hoặc OPENED)
            const activeRequest = state.rewardRequests.find(
              (r) => r.rewardId === reward.id && r.status !== 'REJECTED'
            ) || state.rewardRequests.find((r) => r.rewardId === reward.id);

            return (
              <div key={reward.id} className="h-full flex flex-col">
                <ChestCard
                  reward={reward}
                  currentXp={state.xpWeek}
                  currentAttendanceDays={state.attendanceDaysThisWeek}
                  activeRequest={activeRequest}
                  onRequestReward={onRequestReward}
                  onOpenChest={handleOpenChest}
                  animationsEnabled={state.animationsEnabled}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. MỤC "RƯƠNG ĐÃ MỞ" (BỘ SƯU TẬP QUÀ ĐÃ TIẾT LỘ) */}
      <OpenedChestsCollection openedRequests={openedRequests} />

      {/* 5. MỤC "LỊCH SỬ ĐỀ XUẤT NHẬN QUÀ" (GHI "QUÀ BÍ MẬT" CHO CÁC YÊU CẦU CHƯA MỞ) */}
      <RequestHistory
        requests={state.rewardRequests}
        rewards={REWARDS_CATALOG}
        onOpenChest={handleOpenChest}
      />

      {/* 6. MODAL HOẠT ẢNH MỞ RƯƠNG VÀ TIẾT LỘ MÓN QUÀ THẬT */}
      {openingTarget && (
        <ChestOpeningModal
          reward={openingTarget.reward}
          request={openingTarget.request}
          isOpen={true}
          onClose={() => setOpeningTarget(null)}
          onConfirmClaim={handleConfirmClaim}
          soundEnabled={state.soundEnabled}
          animationsEnabled={state.animationsEnabled}
        />
      )}
    </div>
  );
};

export default RewardsScreen;
