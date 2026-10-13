import React, { useState, useEffect } from 'react';
import { TREE_STAGES_CONFIG } from '../config.ts';
import { MasteryStatus } from '../types.ts';

export interface TopicLeafData {
  topicId: string;
  topicTitle: string;
  masteryStatus: MasteryStatus;
  percentage: number;
}

interface GrowthTreeProps {
  completedStepsCount: number;
  topicLeaves?: TopicLeafData[];
  isWilted?: boolean; // Khi vắng học vài ngày
  isWatering?: boolean; // Hiệu ứng tưới giọt mực
  onWaterComplete?: () => void;
  onLeafClick?: (topicId: string) => void;
  className?: string;
  compact?: boolean;
}

export const GrowthTree: React.FC<GrowthTreeProps> = ({
  completedStepsCount,
  topicLeaves = [],
  isWilted = false,
  isWatering = false,
  onWaterComplete,
  onLeafClick,
  className = '',
  compact = false,
}) => {
  // Xác định giai đoạn hiện tại
  const currentStageIndex = (() => {
    for (let i = TREE_STAGES_CONFIG.length - 1; i >= 0; i--) {
      if (completedStepsCount >= TREE_STAGES_CONFIG[i].minSteps) {
        return i;
      }
    }
    return 0;
  })();

  const currentStage = TREE_STAGES_CONFIG[currentStageIndex];
  const nextStage = TREE_STAGES_CONFIG[currentStageIndex + 1];
  const stepsToNext = nextStage ? nextStage.minSteps - completedStepsCount : 0;

  // Xử lý hiệu ứng tưới cây kết thúc sau 1.8 giây
  const onWaterCompleteRef = React.useRef(onWaterComplete);
  onWaterCompleteRef.current = onWaterComplete;

  useEffect(() => {
    if (isWatering) {
      const timer = setTimeout(() => {
        if (onWaterCompleteRef.current) onWaterCompleteRef.current();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [isWatering]);

  // Màu lá theo Mastery
  const getLeafStyle = (status: MasteryStatus) => {
    switch (status) {
      case 'SOLID':
        return { fill: '#10B981', stroke: '#059669', label: 'Vững' };
      case 'PROGRESSING':
        return { fill: '#22D3EE', stroke: '#0891B2', label: 'Đang tiến bộ' };
      case 'NEEDS_REVIEW':
        return { fill: '#FBBF24', stroke: '#D97706', label: 'Cần ôn' };
      case 'INSUFFICIENT_DATA':
      default:
        return { fill: '#E2E8F0', stroke: '#CBD5E1', label: 'Chưa học' };
    }
  };

  // Kích thước SVG
  const width = compact ? 220 : 360;
  const height = compact ? 210 : 340;

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Khung vẽ Cây SVG */}
      <div className="relative">
        <svg
          width={width}
          height={height}
          viewBox="0 0 360 340"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform duration-500 ${isWilted ? 'rotate-[-2deg] opacity-90' : ''} ${
            isWatering ? 'scale-[1.03] animate-[bounce_0.6s_ease-out]' : ''
          }`}
        >
          <defs>
            {/* Gradient đất màu mỡ */}
            <linearGradient id="soilGrad" x1="180" y1="280" x2="180" y2="330" gradientUnits="userSpaceOnUse">
              <stop stopColor="#64748B" />
              <stop offset="1" stopColor="#334155" />
            </linearGradient>

            {/* Gradient thân cây gỗ ấm */}
            <linearGradient id="trunkGrad" x1="170" y1="120" x2="190" y2="290" gradientUnits="userSpaceOnUse">
              <stop stopColor="#64748B" />
              <stop offset="1" stopColor="#1E293B" />
            </linearGradient>

            {/* Gradient giọt mực tưới cây */}
            <linearGradient id="waterDropGrad" x1="180" y1="0" x2="180" y2="50" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4F46E5" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>

          {/* HIỆU ỨNG GIỌT MỰC TƯỚI CÂY */}
          {isWatering && (
            <g className="animate-[bounce_1.4s_cubic-bezier(0.16,1,0.3,1)]">
              {/* Giọt mực xanh rơi xuống từ đỉnh */}
              <path
                d="M 180 15 C 185 28 194 40 194 50 C 194 58 188 64 180 64 C 172 64 166 58 166 50 C 166 40 175 28 180 15 Z"
                fill="url(#waterDropGrad)"
                stroke="#4F46E5"
                strokeWidth="1.5"
                className="animate-[pulse_0.8s_infinite]"
              />
              {/* Vệt sáng trên giọt mực */}
              <ellipse cx="176" cy="46" rx="2.5" ry="5" fill="#FFFFFF" opacity="0.8" />

              {/* Vòng lan tỏa ánh sáng dưới gốc */}
              <circle cx="180" cy="285" r="26" stroke="#22D3EE" strokeWidth="2.5" fill="none" opacity="0.8" />
              <circle cx="180" cy="285" r="38" stroke="#8B5CF6" strokeWidth="1.5" fill="none" opacity="0.5" />

              {/* Tia sáng li ti (Sparkles) */}
              <circle cx="140" cy="180" r="3" fill="#FBBF24" />
              <circle cx="220" cy="160" r="3" fill="#22D3EE" />
              <circle cx="170" cy="100" r="2.5" fill="#F2B84B" />
              <circle cx="210" cy="220" r="2.5" fill="#7FA88A" />
            </g>
          )}

          {/* CHẬU CÂY / Ụ ĐẤT MẦU MỠ */}
          <ellipse cx="180" cy="305" rx="100" ry="24" fill="#E6DCC8" opacity="0.6" />
          <path
            d="M 90 295 C 90 280 270 280 270 295 C 270 316 230 326 180 326 C 130 326 90 316 90 295 Z"
            fill="url(#soilGrad)"
            stroke="#4A3423"
            strokeWidth="2"
          />
          {/* Vài viên sỏi nhỏ quanh gốc */}
          <ellipse cx="130" cy="298" rx="7" ry="4" fill="#A89482" />
          <ellipse cx="230" cy="300" rx="9" ry="5" fill="#A89482" />
          <ellipse cx="170" cy="312" rx="6" ry="3.5" fill="#7A604D" />

          {/* GIAI ĐOẠN 0: HẠT MẦM (Seed) */}
          {currentStageIndex === 0 && (
            <g>
              <ellipse cx="180" cy="285" rx="14" ry="10" fill="#4A3423" stroke="#2F2116" strokeWidth="2" />
              {/* Vết nứt màu xanh báo hiệu sắp nảy mầm */}
              <path d="M 174 285 Q 180 281 186 286" stroke="#7FA88A" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}

          {/* GIAI ĐOẠN 1: NẢY MẦM (Sprout) */}
          {currentStageIndex === 1 && (
            <g className={isWilted ? 'origin-[180px_285px] rotate-6' : ''}>
              {/* Thân mầm */}
              <path d="M 180 285 Q 182 240 180 215" stroke="#6C9778" strokeWidth="6" strokeLinecap="round" />
              {/* Chiếc lá non đầu tiên */}
              <path
                d="M 180 215 C 160 210 145 190 155 178 C 172 182 178 205 180 215 Z"
                fill="#7FA88A"
                stroke="#487A54"
                strokeWidth="2"
              />
              <path
                d="M 180 215 C 200 210 215 190 205 178 C 188 182 182 205 180 215 Z"
                fill="#8DB594"
                stroke="#487A54"
                strokeWidth="2"
              />
            </g>
          )}

          {/* GIAI ĐOẠN 2: CHỒI NON (Shoot with small branches) */}
          {currentStageIndex === 2 && (
            <g className={isWilted ? 'origin-[180px_285px] rotate-3' : ''}>
              <path d="M 180 285 Q 178 220 180 170" stroke="url(#trunkGrad)" strokeWidth="9" strokeLinecap="round" />
              {/* Cành trái */}
              <path d="M 179 230 Q 150 210 135 200" stroke="#7A5335" strokeWidth="4.5" strokeLinecap="round" />
              {/* Cành phải */}
              <path d="M 180 205 Q 210 185 228 175" stroke="#7A5335" strokeWidth="4.5" strokeLinecap="round" />

              {/* Các chùm lá nhỏ */}
              <circle cx="130" cy="195" r="14" fill="#7FA88A" />
              <circle cx="232" cy="170" r="15" fill="#8DB594" />
              <circle cx="180" cy="155" r="18" fill="#5F8C68" />
            </g>
          )}

          {/* GIAI ĐOẠN 3, 4, 5: CÂY CON, RA HOA, KẾT TRÁI */}
          {currentStageIndex >= 3 && (
            <g className={isWilted ? 'origin-[180px_285px] rotate-2' : ''}>
              {/* Thân cây gỗ chắc khỏe */}
              <path
                d="M 172 290 Q 174 210 170 160 Q 166 120 180 90 Q 192 120 190 160 Q 186 210 188 290 Z"
                fill="url(#trunkGrad)"
                stroke="#442612"
                strokeWidth="2.5"
              />

              {/* Cành lớn vươn sang trái */}
              <path d="M 174 190 Q 140 175 110 170" stroke="#6E4426" strokeWidth="6" strokeLinecap="round" />
              <path d="M 130 174 Q 105 140 85 130" stroke="#6E4426" strokeWidth="4" strokeLinecap="round" />

              {/* Cành lớn vươn sang phải */}
              <path d="M 186 180 Q 220 165 250 160" stroke="#6E4426" strokeWidth="6" strokeLinecap="round" />
              <path d="M 230 163 Q 255 130 275 120" stroke="#6E4426" strokeWidth="4" strokeLinecap="round" />

              {/* Tán cây vòm xanh mát (chùm tán lá nền) */}
              <circle cx="180" cy="100" r="48" fill="#7FA88A" opacity="0.9" />
              <circle cx="120" cy="140" r="42" fill="#8DB594" opacity="0.9" />
              <circle cx="240" cy="135" r="44" fill="#699672" opacity="0.9" />
              <circle cx="180" cy="70" r="38" fill="#5A8863" opacity="0.95" />

              {/* GIAI ĐOẠN 4 & 5: HOA NỞ (Blossoms) */}
              {currentStageIndex >= 4 && (
                <g>
                  {/* Bông hoa trắng ngà nhị vàng */}
                  {[
                    { cx: 140, cy: 95 },
                    { cx: 220, cy: 90 },
                    { cx: 175, cy: 50 },
                    { cx: 105, cy: 130 },
                    { cx: 255, cy: 125 },
                  ].map((pos, idx) => (
                    <g key={idx}>
                      <circle cx={pos.cx - 4} cy={pos.cy} r="4" fill="#FFFDF8" />
                      <circle cx={pos.cx + 4} cy={pos.cy} r="4" fill="#FFFDF8" />
                      <circle cx={pos.cx} cy={pos.cy - 4} r="4" fill="#FFFDF8" />
                      <circle cx={pos.cx} cy={pos.cy + 4} r="4" fill="#FFFDF8" />
                      <circle cx={pos.cx} cy={pos.cy} r="2.5" fill="#F2B84B" />
                    </g>
                  ))}
                </g>
              )}

              {/* GIAI ĐOẠN 5: TRÁI CHÍN (Fruits) */}
              {currentStageIndex === 5 && (
                <g>
                  {[
                    { cx: 160, cy: 80 },
                    { cx: 200, cy: 75 },
                    { cx: 120, cy: 115 },
                    { cx: 240, cy: 110 },
                    { cx: 180, cy: 115 },
                  ].map((pos, idx) => (
                    <g key={idx}>
                      <circle cx={pos.cx} cy={pos.cy} r="6.5" fill="#E2704A" stroke="#B84E29" strokeWidth="1.2" />
                      <path d={`M ${pos.cx} ${pos.cy - 6.5} Q ${pos.cx + 2} ${pos.cy - 10} ${pos.cx + 4} ${pos.cy - 9}`} stroke="#487A54" strokeWidth="1.2" fill="none" />
                      <circle cx={pos.cx - 2} cy={pos.cy - 2} r="1.5" fill="#FFFDF8" opacity="0.6" />
                    </g>
                  ))}
                </g>
              )}
            </g>
          )}

          {/* CÁC CHIẾC LÁ ĐẠI DIỆN CHO TỪNG CHỦ ĐỀ HỌC (Interactive Topic Leaves) */}
          {topicLeaves.map((leaf, index) => {
            const style = getLeafStyle(leaf.masteryStatus);

            // Vị trí cố định hài hòa của 4 chủ đề trên cây
            const leafPositions = [
              { x: 100, y: 160, rot: -25, align: 'start' },
              { x: 260, y: 155, rot: 25, align: 'end' },
              { x: 130, y: 90, rot: -15, align: 'start' },
              { x: 230, y: 85, rot: 15, align: 'end' },
            ];

            const pos = leafPositions[index % leafPositions.length];

            return (
              <g
                key={leaf.topicId}
                className="cursor-pointer transition-transform duration-200 hover:scale-110"
                onClick={() => onLeafClick && onLeafClick(leaf.topicId)}
              >
                <g transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.rot})`}>
                  {/* Cuống lá */}
                  <path d="M 0 0 Q -5 -8 -8 -16" stroke="#3A5E40" strokeWidth="2" fill="none" />
                  {/* Bản lá */}
                  <path
                    d="M -8 -16 C -20 -28 -12 -42 0 -48 C 12 -42 20 -28 8 -16 C 0 -10 -4 -12 -8 -16 Z"
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth="2"
                    className="drop-shadow-sm"
                  />
                  {/* Gân lá */}
                  <path d="M 0 -14 L 0 -44" stroke="#FFFDF8" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
                  <path d="M 0 -24 L -6 -30 M 0 -32 L -5 -38 M 0 -24 L 6 -30 M 0 -32 L 5 -38" stroke="#FFFDF8" strokeWidth="1" strokeLinecap="round" opacity="0.5" />

                  {/* Quả nhỏ nếu đạt Vững */}
                  {leaf.masteryStatus === 'SOLID' && (
                    <circle cx="6" cy="-14" r="4.5" fill="#E2704A" stroke="#B84E29" strokeWidth="1" />
                  )}
                </g>

                {/* Nhãn nhỏ khi không compact */}
                {!compact && (
                  <text
                    x={pos.x}
                    y={pos.y + 22}
                    textAnchor="middle"
                    fill="#2F3E6B"
                    fontSize="11"
                    fontWeight="600"
                    className="pointer-events-none drop-shadow-sm font-sans"
                  >
                    {leaf.topicTitle.length > 16 ? leaf.topicTitle.substring(0, 15) + '…' : leaf.topicTitle}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Cảnh báo ủ rũ khi vắng học */}
        {isWilted && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#FAF5EB] border border-[#E8A752] text-[#8C5E2D] text-xs font-medium shadow-xs">
            Cây đang hơi ủ rũ vì nhớ bạn! Học một bài để tưới cây tươi lại nhé 🌱
          </div>
        )}
      </div>

      {/* THÔNG TIN TIẾN TRÌNH GIAI ĐOẠN */}
      <div className="mt-2 text-center max-w-xs">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFFDF8] border border-[#E6DCC8] text-xs font-semibold text-[#2F3E6B]">
          <span>Giai đoạn {currentStageIndex}:</span>
          <span className="text-[#E2704A] font-bold">{currentStage.name}</span>
        </div>

        <p className="text-xs text-[#26304D]/80 mt-1 leading-relaxed">{currentStage.desc}</p>

        {/* Thanh bước học lên giai đoạn tiếp */}
        {nextStage ? (
          <div className="mt-2.5 w-48 mx-auto">
            <div className="flex justify-between text-[11px] text-[#26304D]/70 mb-1">
              <span>Tiến độ lớn</span>
              <span className="font-semibold text-[#2F3E6B]">Còn {stepsToNext} bước</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#E6DCC8] overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7FA88A] to-[#E2704A] transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((completedStepsCount - currentStage.minSteps) /
                        (nextStage.minSteps - currentStage.minSteps)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-2 text-xs font-medium text-[#7FA88A]">
            ✨ Chúc mừng bạn đã nuôi Cây Văn đạt mức cực thịnh!
          </div>
        )}
      </div>
    </div>
  );
};
