import React, { useState } from 'react';
import {
  BookOpen,
  ChevronsUpDown,
  PanelBottomClose,
  PanelBottomOpen,
  PanelTopClose,
  PanelTopOpen,
  PenLine,
  Play,
  Plus,
} from 'lucide-react';
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
  /** Thu gọn dải luồng (chỉ còn thanh mỏng) — nút 1. */
  collapsed?: boolean;
  /** Thanh công cụ của trình soạn bên dưới có đang thu gọn không — nút 2. */
  toolbarCollapsed?: boolean;
  onToggleStrip?: () => void;
  onToggleToolbar?: () => void;
  /** Thu gọn / mở lại cả luồng và thanh công cụ cùng lúc — nút 3. */
  onToggleBoth?: () => void;
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
 *
 * Thu gọn kiểu ribbon Word (29/10, theo yêu cầu chủ dự án): 3 nút ở mép phải
 * — (1) thu gọn chính dải luồng, (2) thu gọn thanh công cụ của trình soạn
 * bên dưới, (3) thu gọn cả hai cùng lúc. Trạng thái thu gọn được khung phải
 * (TeacherContentScreen) giữ + lưu localStorage theo giáo viên.
 */
/**
 * Cụm 3 nút thu gọn kiểu ribbon Word — dùng chung cho dải luồng và thanh
 * gộp khi thu cả hai: (1) thu/mở luồng, (2) thu/mở thanh công cụ,
 * (3) thu/mở cả hai cùng lúc.
 */
export const CollapseButtons: React.FC<{
  collapsed?: boolean;
  toolbarCollapsed?: boolean;
  onToggleStrip?: () => void;
  onToggleToolbar?: () => void;
  onToggleBoth?: () => void;
}> = ({ collapsed, toolbarCollapsed, onToggleStrip, onToggleToolbar, onToggleBoth }) => (
  <div className="flex items-center gap-1 shrink-0 pl-2 ml-1 border-l border-[#E6DCC8]">
    <button
      type="button"
      onClick={onToggleStrip}
      className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
        collapsed
          ? 'bg-[#2F3E6B] border-[#2F3E6B] text-white'
          : 'bg-white border-[#E6DCC8] text-[#2F3E6B] hover:border-[#2F3E6B]'
      }`}
      title={collapsed ? 'Mở lại luồng học' : 'Thu gọn luồng học'}
    >
      {collapsed ? (
        <PanelTopOpen className="w-4 h-4" />
      ) : (
        <PanelTopClose className="w-4 h-4" />
      )}
    </button>
    <button
      type="button"
      onClick={onToggleToolbar}
      className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
        toolbarCollapsed
          ? 'bg-[#2F3E6B] border-[#2F3E6B] text-white'
          : 'bg-white border-[#E6DCC8] text-[#2F3E6B] hover:border-[#2F3E6B]'
      }`}
      title={toolbarCollapsed ? 'Mở lại thanh công cụ' : 'Thu gọn thanh công cụ'}
    >
      {toolbarCollapsed ? (
        <PanelBottomOpen className="w-4 h-4" />
      ) : (
        <PanelBottomClose className="w-4 h-4" />
      )}
    </button>
    <button
      type="button"
      onClick={onToggleBoth}
      className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
        collapsed && toolbarCollapsed
          ? 'bg-[#E2704A] border-[#E2704A] text-white'
          : 'bg-white border-[#E6DCC8] text-[#2F3E6B] hover:border-[#E2704A]'
      }`}
      title={
        collapsed && toolbarCollapsed
          ? 'Mở lại cả luồng và thanh công cụ'
          : 'Thu gọn cả luồng và thanh công cụ'
      }
    >
      <ChevronsUpDown className="w-4 h-4" />
    </button>
  </div>
);

/**
 * Thanh gộp duy nhất khi thu CẢ hai (29/10, theo yêu cầu chủ dự án: thu cả
 * hai mà vẫn còn 2 thanh thì "chả bé hơn là bao"). Thay cho cả dải luồng
 * lẫn thanh công cụ — chỉ còn 1 hàng mỏng, vẫn giữ đủ 3 nút để mở lại.
 */
export const CombinedCollapsedBar: React.FC<{
  topicTitle: string;
  editorLabel: string;
  collapsed?: boolean;
  toolbarCollapsed?: boolean;
  onToggleStrip?: () => void;
  onToggleToolbar?: () => void;
  onToggleBoth?: () => void;
}> = ({
  topicTitle,
  editorLabel,
  collapsed,
  toolbarCollapsed,
  onToggleStrip,
  onToggleToolbar,
  onToggleBoth,
}) => (
  <div className="shrink-0 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl px-3 py-1 mb-2 shadow-xs flex items-center gap-2">
    <button
      type="button"
      onClick={onToggleBoth}
      className="flex items-center gap-2 min-w-0 text-left"
      title="Mở lại cả luồng và thanh công cụ"
    >
      <span className="text-[9px] font-black uppercase tracking-widest text-[#8C7E6A] shrink-0">
        Luồng học
      </span>
      <span className="text-xs font-black text-[#2F3E6B] truncate max-w-48">
        {topicTitle}
      </span>
      {editorLabel && (
        <>
          <span className="text-[#D8CCAF] shrink-0">·</span>
          <span className="text-xs font-bold text-[#2F3E6B] truncate max-w-40">
            {editorLabel}
          </span>
        </>
      )}
      <span className="text-[11px] text-[#8C7E6A] shrink-0">— đã thu gọn cả hai, bấm để mở lại</span>
    </button>
    <span className="flex-1" />
    <CollapseButtons
      collapsed={collapsed}
      toolbarCollapsed={toolbarCollapsed}
      onToggleStrip={onToggleStrip}
      onToggleToolbar={onToggleToolbar}
      onToggleBoth={onToggleBoth}
    />
  </div>
);

export const TopicFlowStrip: React.FC<TopicFlowStripProps> = ({
  topicTitle,
  items,
  activeKey,
  onSelect,
  onAdd,
  onReorder,
  collapsed,
  toolbarCollapsed,
  onToggleStrip,
  onToggleToolbar,
  onToggleBoth,
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

  // Cụm 3 nút thu gọn — hiện ở cả 2 trạng thái của dải để lúc nào cũng
  // bấm được, kể cả khi dải đã thu gọn.
  const collapseCluster = (
    <CollapseButtons
      collapsed={collapsed}
      toolbarCollapsed={toolbarCollapsed}
      onToggleStrip={onToggleStrip}
      onToggleToolbar={onToggleToolbar}
      onToggleBoth={onToggleBoth}
    />
  );

  // Dải đã thu gọn: chỉ còn thanh mỏng (tiêu đề chủ đề + cụm 3 nút).
  if (collapsed) {
    return (
      <div className="shrink-0 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl px-3 py-1 mb-2 shadow-xs flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleStrip}
          className="flex items-center gap-2 min-w-0 text-left"
          title="Mở lại luồng học"
        >
          <span className="text-[9px] font-black uppercase tracking-widest text-[#8C7E6A] shrink-0">
            Luồng học
          </span>
          <span className="text-xs font-black text-[#2F3E6B] truncate max-w-48">
            {topicTitle}
          </span>
          <span className="text-[11px] text-[#8C7E6A] shrink-0">— đã thu gọn, bấm để mở lại</span>
        </button>
        <span className="flex-1" />
        {collapseCluster}
      </div>
    );
  }

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
      </div>

      {/* Nút + thêm bài — nằm NGOÀI vùng cuộn ngang để menu xổ xuống phủ lên
          các mục bên dưới, không bị cắt mất */}
      <div className="relative shrink-0">
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
            <div className="fixed inset-0 z-40" onClick={() => setAddOpen(false)} />
            <div className="absolute right-0 top-[calc(100%+6px)] w-48 bg-white border border-[#E6DCC8] rounded-2xl shadow-xl z-50 p-1.5">
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

      {/* Cụm 3 nút thu gọn kiểu ribbon Word */}
      {collapseCluster}
    </div>
  );
};
