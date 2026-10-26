import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { AnalyticsAssistantTab } from './analytics/AnalyticsAssistantTab.tsx';
import {
  StudentState,
  EssaySubmission,
  RewardRequest,
  Question,
} from '../../types.ts';
import { StudentAccount, ClassItem } from '../../services/types.ts';
import { GlobalAnalyticsFilter } from '../../analytics/types.ts';

interface AnalyticsAssistantBubbleProps {
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  classes: ClassItem[];
  topics: Array<{ id: string; title: string }>;
  essays: EssaySubmission[];
  rewards: RewardRequest[];
  questions: Record<string, Question>;
  teacherId?: string;
}

// Cùng mặc định với bộ lọc chung của màn Phân tích (và đọc lại đúng khóa
// sessionStorage màn đó đang dùng) để số liệu trợ lý trong bong bóng luôn
// khớp với trang Phân tích.
const DEFAULT_FILTERS: GlobalAnalyticsFilter = {
  classIds: [],
  timeRange: '6w',
  topicId: 'all',
  studentIds: [],
  skillLevels: ['NHAN_BIET', 'THONG_HIEU', 'PHAN_TICH', 'VAN_DUNG'],
  activityType: 'all',
};

/**
 * Bong bóng chat nổi của Trợ lý phân tích: hiện ở mọi màn hình của cổng
 * giáo viên, bấm vào mở khung chat ngay tại chỗ (không phải chuyển sang
 * mục Phân tích). Nội dung chat được giữ nguyên khi đóng/mở lại.
 */
export const AnalyticsAssistantBubble: React.FC<AnalyticsAssistantBubbleProps> = (props) => {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [filters] = useState<GlobalAnalyticsFilter>(() => {
    try {
      const saved = sessionStorage.getItem('mam_van_analytics_filters');
      if (saved) return JSON.parse(saved);
    } catch {
      /* bỏ qua: dùng mặc định */
    }
    return DEFAULT_FILTERS;
  });

  const toggle = () => {
    if (!open) setEverOpened(true);
    setOpen(!open);
  };

  return (
    <>
      {everOpened && (
        <div
          className={`fixed z-[95] bottom-24 right-4 sm:right-5 w-[min(430px,calc(100vw-2rem))] h-[min(640px,calc(100dvh-9rem))] bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-2xl flex-col overflow-hidden ${
            open ? 'flex' : 'hidden'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-[#2F3E6B] text-white shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-bold font-lora">Trợ lý phân tích học tập</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center transition"
              aria-label="Đóng trợ lý phân tích"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <AnalyticsAssistantTab {...props} filters={filters} compact />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        className="fixed z-[95] bottom-5 right-4 sm:right-5 w-14 h-14 rounded-full bg-[#2F3E6B] text-white shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition"
        aria-label="Mở trợ lý phân tích AI"
        title="Trợ lý phân tích AI — hỏi đáp số liệu lớp học"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
        {!open && (
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
        )}
      </button>
    </>
  );
};
