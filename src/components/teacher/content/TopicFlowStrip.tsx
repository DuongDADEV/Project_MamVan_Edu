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
  video: <Play className="w-3.5 h-3.5" />,
  theory: <BookOpen className="w-3.5 h-3.5" />,
  quiz: <PenLine className="w-3.5 h-3.5" />,
};

const TYPE_LABEL: Record<FlowItemType, string> = {
  video: 'Bài giảng Video',
  theory: 'Lý thuyết',
  quiz: 'Bài tập',
};

/**
 * Dải LUỒNG HỌC — một thanh MỎNG gọn ngay trên trình soạn: các bài trong chủ
 * đề xếp sát nhau theo đúng thứ tự (nút tròn icon theo loại + tên bài nằm
 * ngang bên cạnh), bấm để tới bài, kéo–thả đổi thứ tự, nút + ở cuối để thêm.
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
    <div className="shrink-0 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl px-3 py-2 mb-3 shadow-xs flex items-center gap-2">
      {/* Nhãn luồng */}
      <div className="hidden lg:flex flex-col shrink-0 pr-2 border-r border-[#E6DCC8]">
        <span className="text-[9px] font-black uppercase tracking-widest text-[#8C7E6A]">
          Luồng học
        </span>
        <span className="text-xs font-black text-[#2F3E6B] max-w-36 truncate">{topicTitle}</span>
      </div>

      {/* Các bài — xếp sát nhau, cuộn ngang khi dài */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1 py-0.5">
        {items.map((item, idx) => {
          const active = item.key === activeKey;
          const isOver = overKey === item.key && dragKey !== item.key;
          return (
            <React.Fragment key={item.key}>
              {idx > 0 && <div className="w-4 h-0.5 bg-[#D8CCAF] rounded shrink-0" />}
              <div
                className={`flex items-center gap-1.5 shrink-0 rounded-full pl-0.5 pr-2 py-0.5 border transition-all ${
                  active
                    ? 'bg-[#2F3E6B] border-[#2F3E6B] text-white shadow-sm'
                    : 'bg-white border-transparent hover:border-[#D8CCAF] text-[#374151]'
                } ${dragKey === item.key ? 'opacity-40' : ''} ${
                  isOver ? 'ring-2 ring-[#E2704A]' : ''
                }`}
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
                title={`${TYPE_LABEL[item.type]}: ${item.title} — bấm để mở, giữ và kéo để đổi thứ tự`}
              >
                <button
                  type="button"
                  onClick={() => onSelect({ type: item.type, id: item.id })}
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing ${
                    active ? 'bg-white/15 text-white' : 'bg-[#2F3E6B]/8 text-[#2F3E6B]'
                  }`}
                >
                  {TYPE_ICON[item.type]}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                      active ? 'border-[#2F3E6B]' : 'border-white'
                    } ${item.status === 'published' ? 'bg-emerald-500' : 'bg-amber-400'}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onSelect({ type: item.type, id: item.id })}
                  className="text-left min-w-0"
                >
                  <span
                    className={`block text-[11px] leading-tight truncate max-w-32 ${
                      active ? 'font-black text-white' : 'font-bold text-[#2F3E6B]'
                    }`}
                  >
                    {idx + 1}. {item.title}
                  </span>
                  <span
                    className={`block text-[9px] leading-tight ${
                      active ? 'text-white/70' : 'text-[#8C7E6A]'
                    }`}
                  >
                    {TYPE_LABEL[item.type]}
                    {item.status === 'published' ? ' · Đã xuất bản' : ' · Nháp'}
                  </span>
                </button>
              </div>
            </React.Fragment>
          );
        })}

        {items.length === 0 && (
          <span className="text-[11px] text-[#8C7E6A] italic shrink-0">
            Chủ đề chưa có bài nào — bấm + để thêm bài đầu tiên.
          </span>
        )}

        {/* Nút + thêm bài */}
        <div className="relative shrink-0 ml-1">
          <button
            type="button"
            onClick={() => setAddOpen((p) => !p)}
            className="flex items-center gap-1 h-8 pl-1.5 pr-2.5 rounded-full border-2 border-dashed border-[#E2704A]/70 text-[#E2704A] bg-[#E2704A]/5 hover:bg-[#E2704A]/15 transition-all"
            title="Thêm bài mới vào luồng học"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[11px] font-black">Thêm bài</span>
          </button>
          {addOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setAddOpen(false)} />
              <div className="absolute right-0 top-10 w-48 bg-white border border-[#E6DCC8] rounded-2xl shadow-xl z-30 p-1.5">
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
