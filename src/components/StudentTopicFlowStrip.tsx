import React from 'react';
import type { TopicFlowItem, TopicFlowType } from '../logic/topicFlow.ts';

const TYPE_LABEL: Record<TopicFlowType, string> = {
  video: 'Video',
  theory: 'Lý thuyết',
  quiz: 'Bài tập',
};

interface StudentTopicFlowStripProps {
  path: TopicFlowItem[];
  currentType: TopicFlowType;
  currentId: string;
  onJump?: (type: TopicFlowType, id: string) => void;
}

/**
 * Dải luồng chủ đề cho học sinh: hiện ĐỦ các bài cô đã đăng theo ĐÚNG
 * thứ tự cô xếp, bài đang học được tô đậm. Bấm vào một bài để nhảy tới
 * bài đó (đi theo thứ tự từ trên xuống, không cần quay lại danh sách).
 */
export const StudentTopicFlowStrip: React.FC<StudentTopicFlowStripProps> = ({
  path,
  currentType,
  currentId,
  onJump,
}) => {
  if (path.length < 2) return null;
  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm mb-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
        Luồng chủ đề — học theo đúng thứ tự cô đã đăng
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {path.map((item, idx) => {
          const isCurrent = item.type === currentType && item.id === currentId;
          const chip = (
            <>
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                  isCurrent ? 'bg-white text-[#4F46E5]' : 'bg-[#2F3E6B] text-white'
                }`}
              >
                {idx + 1}
              </span>
              <span className="text-xs font-bold truncate max-w-[160px]">
                {TYPE_LABEL[item.type]}: {item.title}
              </span>
            </>
          );
          const cls = `flex items-center gap-2 rounded-full px-3 py-1.5 text-left transition-all ${
            isCurrent
              ? 'gradient-primary text-white shadow-md shadow-indigo-500/20'
              : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-[#4F46E5] border border-slate-200/80'
          }`;
          return (
            <React.Fragment key={`${item.type}:${item.id}`}>
              {idx > 0 && <span className="text-slate-300 font-black text-xs">→</span>}
              {isCurrent || !onJump ? (
                <span className={cls}>{chip}</span>
              ) : (
                <button type="button" onClick={() => onJump(item.type, item.id)} className={cls}>
                  {chip}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
