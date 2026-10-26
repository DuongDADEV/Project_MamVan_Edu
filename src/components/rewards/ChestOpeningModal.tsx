import React, { useState, useEffect } from 'react';
import { RewardTier, RewardRequest } from '../../types.ts';
import { getChestTierConfig } from '../../config.ts';
import { ChestIllustration } from './ChestIllustration.tsx';
import { MamMuc } from '../MamMuc.tsx';
import { Sparkles, Award, CheckCircle, X } from 'lucide-react';

interface ChestOpeningModalProps {
  reward: RewardTier;
  request: RewardRequest;
  isOpen: boolean;
  onClose: () => void;
  onConfirmClaim: (rewardId: string, requestId: string) => void;
  soundEnabled?: boolean;
  animationsEnabled?: boolean;
}

/**
 * Hiệu ứng âm thanh procedural chuông reo vui tai khi mở rương
 */
function playChestFanfare() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (hợp âm Đô trưởng)
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.09);
      osc.stop(ctx.currentTime + idx * 0.09 + 0.55);
    });
  } catch {}
}

/**
 * Modal hoạt ảnh "Mở Rương Bí Mật":
 * - Nắp rương bật mở, ánh sáng và tia sao tỏa ra
 * - Mầm Mực chúc mừng (cheer)
 * - ĐÂY LÀ NƠI DUY NHẤT VÀ LẦN ĐẦU TIÊN món quà thật (secret) được tiết lộ cho học sinh!
 */
export const ChestOpeningModal: React.FC<ChestOpeningModalProps> = ({
  reward,
  request,
  isOpen,
  onClose,
  onConfirmClaim,
  soundEnabled = true,
  animationsEnabled = true,
}) => {
  const [phase, setPhase] = useState<'opening' | 'revealed'>('opening');
  const tierConfig = getChestTierConfig(reward.requiredXp, reward.tierKey);

  useEffect(() => {
    if (isOpen) {
      setPhase('opening');
      if (soundEnabled) {
        playChestFanfare();
      }
      // Sau 900ms hoạt ảnh nắp rương bung ra -> chuyển sang hiển thị món quà bí mật
      const timer = setTimeout(() => {
        setPhase('revealed');
      }, animationsEnabled ? 950 : 200);

      return () => clearTimeout(timer);
    }
  }, [isOpen, soundEnabled, animationsEnabled]);

  if (!isOpen) return null;

  const handleCollect = () => {
    onConfirmClaim(reward.id, request.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chest-reveal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B4B]/60 backdrop-blur-md animate-[fadeIn_0.2s_ease]"
    >
      <div className="relative w-full max-w-lg bg-[#FFFDF8] rounded-3xl p-6 sm:p-8 border-2 border-[#E6DCC8] shadow-2xl overflow-hidden text-[#1E1B4B] text-center">
        {/* Nền ánh sáng tỏa */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40"
          style={{ background: tierConfig.glowColor }}
        />

        {/* Nút đóng góc phải — sau khi quà đã lộ diện, đóng cũng tính là đã nhận
            (trước đây đóng bằng X làm yêu cầu kẹt ở trạng thái GIVEN mãi mãi) */}
        <button
          onClick={phase === 'revealed' ? handleCollect : onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-[#7A6A55] hover:bg-[#FAF5EB] transition-colors"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* GIAI ĐOẠN 1: RƯƠNG BẬT NẮP TỎA SÁNG */}
        {phase === 'opening' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <ChestIllustration
                tier={reward.tierKey}
                state="opened"
                size={150}
                animationsEnabled={animationsEnabled}
              />
            </div>
            <h3 className="text-xl font-black text-[#2F3E6B] animate-pulse">
              Đang mở {tierConfig.name}...
            </h3>
            <p className="text-xs text-[#5C6A79]">Điều bất ngờ chuẩn bị xuất hiện!</p>
          </div>
        )}

        {/* GIAI ĐOẠN 2: TIẾT LỘ MÓN QUÀ THẬT (REVEAL CARD) */}
        {phase === 'revealed' && (
          <div className="py-2 flex flex-col items-center space-y-5 animate-[scaleUp_0.4s_ease]">
            {/* Mascot Mầm Mực mừng vui */}
            <div className="flex items-center justify-center">
              <MamMuc mood="cheer" size="md" />
            </div>

            {/* Tiêu đề chúc mừng */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF8EC] text-[#9A6B12] border border-[#F8DE9F] text-xs font-bold mb-2 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-[#F2B84B]" />
                <span>Bí mật đã được bật mí!</span>
              </div>
              <h3
                id="chest-reveal-title"
                className="text-2xl font-black text-[#2F3E6B] tracking-tight"
                style={{ fontFamily: "'Lora', Georgia, serif" }}
              >
                Chúc mừng em đã nhận quà!
              </h3>
              <p className="text-xs text-[#5C6A79] mt-0.5">
                Phần quà từ {tierConfig.name} do thầy/cô gửi tặng
              </p>
            </div>

            {/* THẺ TIẾT LỘ NỘI DUNG MÓN QUÀ THẬT (CHỈ XUẤT HIỆN TẠI ĐÂY) */}
            <div className="w-full p-5 rounded-2xl bg-[#FAF5EB] border-2 border-[#EADBBE] shadow-xs text-left relative overflow-hidden">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#E6DCC8] flex items-center justify-center shrink-0 shadow-2xs">
                  <Award className="w-6 h-6 text-[#E2704A]" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] uppercase font-bold text-[#E2704A] tracking-wider block mb-0.5">
                    Món quà của em:
                  </span>
                  <h4
                    className="text-base sm:text-lg font-bold text-[#2F3E6B]"
                    style={{ fontFamily: "'Lora', Georgia, serif" }}
                  >
                    {reward.secret.name}
                  </h4>
                  <p className="text-xs text-[#5C6A79] leading-relaxed mt-1">
                    {reward.secret.description}
                  </p>
                </div>
              </div>
            </div>

            {/* NÚT XÁC NHẬN ĐƯA VÀO BỘ SƯU TẬP */}
            <button
              onClick={handleCollect}
              className="w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-[0.99]"
              style={{
                backgroundColor: '#2D6846',
                boxShadow: '0 4px 14px rgba(45, 104, 70, 0.3)',
              }}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Đưa vào bộ sưu tập "Rương đã mở"</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChestOpeningModal;
