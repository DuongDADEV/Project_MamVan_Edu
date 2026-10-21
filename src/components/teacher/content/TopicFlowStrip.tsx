import React, { useState } from 'react';
import { BookOpen, PenLine, Play, Plus } from 'lucide-react';
import { FlowItemType } from '../../../logic/flowOrder.ts';

export interface TopicFlowStripItem {
  key: string;
  type: FlowItemType;
  id: string;
  title: string;
  status?: string;
}

interface TopicFlowStripProps {
  topicTitle: string;
  items: TopicFlowStripItem[];
  activeKey?: string | null;
  onSelect: (item: { type: FlowItemType; id: string }) => void;
  onAdd: (kind: 'video' | 'theory' | 'quiz') => void;
  onReorder: (keys: string[]) => void;
}

const TYPE_ICON: Record<FlowItemType, React.ReactNode> = {
  video: <Play className="w-4 h-4" />,
  theory: <BookOpen className="w-4 h-4" />,
  quiz: <PenLine className="w-4 h-4" />,
};

const TYPE_LABEL: Record<FlowItemType, string> = {
  video: 'Bài giảng Video',
  theory: 'Lý thuyết',
  quiz: 'Bài tập',
};

/**
 * Dải LUỒNG HỌC ở đầu trang: mỗi bài trong chủ đề là một nút tròn có icon
 * theo loại, nối nhau bằng gạch ngang, đúng thứ tự học. Bấm nút → mở bài đó;
 * kéo–thả để đổi thứ tự; nút + ở cuối để thêm bài mới (3 lựa chọn).
 */
export const TopicFlowStrip: React.FC<TopicFlowStripProps> = ({
  topicTitle,
  items,
  activeKey,
  onSelect,
  onAdd,
  onReorder,
}) => {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const handleDrop = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) return;
    const keys = items.map((i) => i.key);
    const from = keys.indexOf(dragKey);
    const to = keys.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, dragKey);
    onReorder(keys);
  };

  return (
    <div className="shrink-0 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl px-4 py-3 mb-3 shadow-xs">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#8C7E6A]">
        Luồng học · {topicTitle}
        <span className="normal-case font-semibold text-[#B4A888] ml-2">
          (bấm vào nút tròn để tới bài đó — kéo để đổi thứ tự)
        </span>
      </p>
      <div className="mt-2 flex items-start overflow-x-auto pb-1">
        {items.map((item, idx) => {
          const active = item.key === activeKey;
          const isOver = overKey === item.key && dragKey !== item.key;
          return (
            <React.Fragment key={item.key}>
              {idx > 0 && (
                <div className="flex-1 min-w-4 h-0.5 bg-[#D8CCAF] mt-[22px] rounded" />
              )}
              <div
                className="flex flex-col items-center w-[76px] shrink-0"
                draggable
                onDragStart={(e) => {
                  setDragKey(item.key);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDragKey(null);
                  setOverKey(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverKey(item.key);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(item.key);
                  setDragKey(null);
                  setOverKey(null);
                }}
                title={`${TYPE_LABEL[item.type]}: ${item.title} (giữ và kéo để đổi thứ tự)`}
              >
                <button
                  type="button"
                  onClick={() => onSelect({ type: item.type, id: item.id })}
                  className={`relative w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all cursor-grab active:cursor-grabbing ${
                    active
                      ? 'bg-[#2F3E6B] border-[#2F3E6B] text-white scale-110 shadow-md'
                      : 'bg-white border-[#D8CCAF] text-[#2F3E6B] hover:border-[#2F3E6B]'
                  } ${dragKey === item.key ? 'opacity-40' : ''} ${
                    isOver ? 'ring-2 ring-[#E2704A]' : ''
                  }`}
                >
                  {TYPE_ICON[item.type]}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      item.status === 'published' ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}
                    title={item.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                  />
                </button>
                <span
                  className={`mt-1 text-[10px] leading-tight text-center line-clamp-2 ${
                    active ? 'font-black text-[#2F3E6B]' : 'font-semibold text-[#6B7280]'
                  }`}
                >
                  {idx + 1}. {item.title}
                </span>
              </div>
            </React.Fragment>
          );
        })}

        {/* Nút + thêm bài mới vào cuối luồng */}
        {items.length > 0 && <div className="flex-1 min-w-4 h-0.5 bg-[#D8CCAF] mt-[22px] rounded" />}
        <div className="relative flex flex-col items-center w-[76px] shrink-0">
          <button
            type="button"
            onClick={() => setAddOpen((p) => !p)}
            className="w-11 h-11 rounded-full border-2 border-dashed border-[#E2704A] text-[#E2704A] bg-[#E2704A]/5 hover:bg-[#E2704A]/15 flex items-center justify-center transition-all"
            title="Thêm bài mới vào luồng học"
          >
            <Plus className="w-5 h-5" />
          </button>
          <span className="mt-1 text-[10px] font-bold text-[#E2704A]">Thêm bài</span>
          {addOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setAddOpen(false)} />
              <div className="absolute right-0 top-12 w-48 bg-white border border-[#E6DCC8] rounded-2xl shadow-xl z-30 p-1.5">
                {(['video', 'theory', 'quiz'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setAddOpen(false);
                      onAdd(kind);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[#FAF5EB] text-left text-xs font-bold text-[#2F3E6B]"
                  >
                    <span className="text-[#E2704A]">{TYPE_ICON[kind]}</span>
                    {TYPE_LABEL[kind]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
