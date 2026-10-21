import React, { useState } from 'react';
import {
  TopicWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  QuizWithMeta,
} from '../../../services/types.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import {
  ChevronRight,
  ChevronDown,
  Video,
  BookOpen,
  FileQuestion,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  GripVertical,
  FolderPlus,
  ClipboardPlus,
  Layers,
  Sparkles,
  Copy,
  FileEdit,
} from 'lucide-react';

export type ContentItemType = 'topic' | 'video' | 'theory' | 'quiz';

export interface SelectedContentItem {
  type: ContentItemType;
  id: string;
}

interface TopicTreeSidebarProps {
  topics: TopicWithMeta[];
  videos: VideoLessonWithMeta[];
  theories: TheoryLessonWithMeta[];
  quizzes: QuizWithMeta[];
  selectedItem: SelectedContentItem | null;
  onSelectItem: (item: SelectedContentItem) => void;
  onOpenCreateTopic: () => void;
  onAddAssignment?: () => void;
  onEditTopic: (topic: TopicWithMeta) => void;
  onDeleteTopic: (topicId: string) => void;
  onReorderTopics: (orderedIds: string[]) => void;
  onDuplicateItem: (type: ContentItemType, id: string) => void;
  onDeleteItem: (type: ContentItemType, id: string) => void;
}

export const TopicTreeSidebar: React.FC<TopicTreeSidebarProps> = ({
  topics,
  videos,
  theories,
  quizzes,
  selectedItem,
  onSelectItem,
  onOpenCreateTopic,
  onAddAssignment,
  onEditTopic,
  onDeleteTopic,
  onReorderTopics,
  onDuplicateItem,
  onDeleteItem,
}) => {
  const [pendingDelete, setPendingDelete] = useState<{ type: ContentItemType; id: string; label: string; title: string } | null>(null);
  // Trạng thái thu gọn/mở rộng từng chủ đề
  const [expandedTopicIds, setExpandedTopicIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    topics.forEach((t) => {
      initial[t.id] = true; // Mặc định mở rộng tất cả
    });
    return initial;
  });

  // Menu tùy chọn đang mở
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Kéo-thả đổi thứ tự chủ đề (giữ-kéo thay cho nút lên/xuống)
  const [draggingTopicId, setDraggingTopicId] = useState<string | null>(null);
  const [dragOverTopicId, setDragOverTopicId] = useState<string | null>(null);

  const handleTopicDrop = (targetId: string) => {
    const fromId = draggingTopicId;
    setDraggingTopicId(null);
    setDragOverTopicId(null);
    if (!fromId || fromId === targetId) return;
    const ids = topics.map((t) => t.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, fromId);
    onReorderTopics(ids);
  };

  const toggleTopic = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTopicIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getQuizKindLabel = (kind: string) => {
    switch (kind) {
      case 'practice':
        return 'Luyện tập';
      case 'quick':
        return 'Kiểm tra nhanh';
      case 'mastery':
        return 'Mastery Check';
      case 'reading':
        return 'Bài đọc hiểu';
      case 'homework':
        return 'BTVN';
      default:
        return 'Bài tập';
    }
  };

  return (
    <div className="w-full md:w-72 lg:w-80 flex flex-col min-h-0 max-h-[45%] md:max-h-none bg-[#FFFDF8] border-r border-[#E6DCC8] rounded-2xl md:rounded-r-none overflow-hidden shrink-0 shadow-xs">
      {/* Top Header */}
      <div className="p-4 bg-[#FAF5EB] border-b border-[#E6DCC8] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-[#2F3E6B] shrink-0" />
          <h3 className="font-lora font-bold text-sm text-[#2F3E6B] whitespace-nowrap">
            Cây chủ đề
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-bold font-mono shrink-0">
            {topics.length}
          </span>
        </div>

        <button
          onClick={onOpenCreateTopic}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs hover:shadow-xs whitespace-nowrap shrink-0"
          title="Thêm chủ đề học mới"
        >
          <FolderPlus className="w-3.5 h-3.5 text-[#E2704A]" />
          <span>Thêm chủ đề</span>
        </button>
      </div>

      {/* Thêm bài tập & đánh giá: tạo bài tập độc lập giao từng học sinh */}
      {onAddAssignment && (
        <div className="px-3 pt-3">
          <button
            onClick={onAddAssignment}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#2F3E6B] hover:bg-[#28355c] text-white text-xs font-black transition-all shadow-xs"
            title="Tạo bài tập độc lập và giao cho học sinh"
          >
            <ClipboardPlus className="w-4 h-4" />
            <span>Thêm bài tập & đánh giá</span>
          </button>
        </div>
      )}

      {/* Topics Tree List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {topics.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#8C7E6A] italic">
            Chưa có chủ đề nào. Hãy bấm "Thêm chủ đề" để bắt đầu!
          </div>
        ) : (
          topics.map((topic, index) => {
            const isExpanded = expandedTopicIds[topic.id] !== false;
            const topicVideos = videos.filter((v) => v.topicId === topic.id);
            const topicTheories = theories.filter((th) => th.topicId === topic.id);
            const topicQuizzes = quizzes.filter((q) => q.topicId === topic.id);

            const isTopicSelected =
              selectedItem?.type === 'topic' && selectedItem?.id === topic.id;

            const topicColor = topic.colorScheme || '#2F3E6B';
            // Không hiển thị thẻ mặc định "Ngữ văn 7" (theo yêu cầu bỏ chữ này)
            const displayTag =
              topic.tag && topic.tag.trim() !== '' && topic.tag.trim() !== 'Ngữ văn 7'
                ? topic.tag
                : null;

            return (
              <div
                key={topic.id}
                draggable
                onDragStart={(e) => {
                  setDraggingTopicId(topic.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggingTopicId(null);
                  setDragOverTopicId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingTopicId && draggingTopicId !== topic.id) setDragOverTopicId(topic.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleTopicDrop(topic.id);
                }}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  draggingTopicId === topic.id ? 'opacity-50' : ''
                } ${dragOverTopicId === topic.id ? 'ring-2 ring-[#E2704A]' : ''}`}
                style={{
                  backgroundColor: `${topicColor}14`,
                  borderColor: `${topicColor}59`,
                }}
                title="Giữ và kéo để đổi thứ tự chủ đề"
              >
                {/* Topic Header Row */}
                <div
                  onClick={() => onSelectItem({ type: 'topic', id: topic.id })}
                  className={`px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isTopicSelected ? 'border-l-4' : 'hover:bg-black/5'
                  }`}
                  style={
                    isTopicSelected
                      ? { backgroundColor: `${topicColor}26`, borderLeftColor: topicColor }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => toggleTopic(topic.id, e)}
                      className="p-1 rounded-lg hover:bg-black/5 text-[#8C7E6A] transition-colors shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#2F3E6B]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#2F3E6B]" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-base font-lora font-bold text-[#2F3E6B] leading-snug">
                          {topic.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {displayTag && (
                          <>
                            <span className="text-[10px] text-[#8C7E6A]">{displayTag}</span>
                            <span className="text-[10px] text-slate-300">•</span>
                          </>
                        )}
                        <StatusBadge
                          status={topic.status}
                          hasUnpublishedEdits={topic.has_unpublished_edits}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions on topic */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Tay nắm kéo-thả đổi thứ tự (giữ và kéo thẻ chủ đề) */}
                    <span
                      className="p-1 text-[#8C7E6A] cursor-grab active:cursor-grabbing"
                      title="Giữ và kéo để đổi thứ tự chủ đề"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTopic(topic);
                      }}
                      className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] hover:text-[#2F3E6B] transition-colors"
                      title="Chỉnh sửa thông tin chủ đề"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTopic(topic.id);
                      }}
                      className="p-1 rounded hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600 transition-colors"
                      title="Xóa chủ đề"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub-items List (Videos, Theories, Quizzes) */}
                {isExpanded && (
                  <div className="bg-white px-2 py-2 border-t border-[#E6DCC8]/60 space-y-1 pl-6">
                    {/* Videos */}
                    {topicVideos.map((vid) => {
                      const isSelected =
                        selectedItem?.type === 'video' && selectedItem?.id === vid.id;
                      return (
                        <div
                          key={vid.id}
                          onClick={() => onSelectItem({ type: 'video', id: vid.id })}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all text-xs ${
                            isSelected
                              ? 'bg-orange-50 border border-orange-200 text-[#E2704A] font-bold shadow-2xs'
                              : 'hover:bg-[#FAF5EB] text-[#2F3E6B]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Video className="w-3.5 h-3.5 text-[#E2704A] shrink-0" />
                            <span className="truncate">{vid.title}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <StatusBadge
                              status={vid.status}
                              hasUnpublishedEdits={vid.has_unpublished_edits}
                              size="sm"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateItem('video', vid.id);
                              }}
                              className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] hover:text-[#2F3E6B]"
                              title="Nhân bản video"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ type: 'video', id: vid.id, label: 'video', title: vid.title });
                              }}
                              className="p-1 rounded hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600"
                              title="Xóa video"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Theories (hiện TẤT CẢ bài lý thuyết của chủ đề) */}
                    {topicTheories.map((topicTheory) => (
                      <div
                        key={topicTheory.id}
                        onClick={() => onSelectItem({ type: 'theory', id: topicTheory.id })}
                        className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all text-xs ${
                          selectedItem?.type === 'theory' &&
                          selectedItem?.id === topicTheory.id
                            ? 'bg-purple-50 border border-purple-200 text-[#7C3AED] font-bold shadow-2xs'
                            : 'hover:bg-[#FAF5EB] text-[#2F3E6B]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
                          <span className="truncate">{topicTheory.title}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <StatusBadge
                            status={topicTheory.status}
                            hasUnpublishedEdits={topicTheory.has_unpublished_edits}
                            size="sm"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateItem('theory', topicTheory.id);
                            }}
                            className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] hover:text-[#2F3E6B]"
                            title="Nhân bản lý thuyết"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDelete({ type: 'theory', id: topicTheory.id, label: 'lý thuyết', title: topicTheory.title });
                            }}
                            className="p-1 rounded hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600"
                            title="Xóa lý thuyết"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Quizzes / Tests */}
                    {topicQuizzes.map((quiz) => {
                      const isSelected =
                        selectedItem?.type === 'quiz' && selectedItem?.id === quiz.id;
                      return (
                        <div
                          key={quiz.id}
                          onClick={() => onSelectItem({ type: 'quiz', id: quiz.id })}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all text-xs ${
                            isSelected
                              ? 'bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold shadow-2xs'
                              : 'hover:bg-[#FAF5EB] text-[#2F3E6B]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileQuestion className="w-3.5 h-3.5 text-[#4F46E5] shrink-0" />
                            <div className="min-w-0">
                              <span className="truncate block">{quiz.title}</span>
                              <span className="text-[10px] text-[#8C7E6A] font-medium">
                                {getQuizKindLabel(quiz.kind)} • {quiz.questionIds.length} câu
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <StatusBadge
                              status={quiz.status}
                              hasUnpublishedEdits={quiz.has_unpublished_edits}
                              size="sm"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateItem('quiz', quiz.id);
                              }}
                              className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] hover:text-[#2F3E6B]"
                              title="Nhân bản đề thi"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ type: 'quiz', id: quiz.id, label: 'bài tập', title: quiz.title });
                              }}
                              className="p-1 rounded hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600"
                              title="Xóa bài tập"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {topicVideos.length === 0 && topicTheories.length === 0 && topicQuizzes.length === 0 && (
                      <div className="py-2 text-center text-[11px] text-[#8C7E6A] italic">
                        Chủ đề này chưa có bài giảng hoặc bài tập.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Hộp thoại xác nhận xóa — giữa màn hình (thay hộp thoại mặc định của trình duyệt) */}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title={pendingDelete ? `Xóa ${pendingDelete.label}` : ''}
        message={
          pendingDelete
            ? `Bạn có chắc chắn muốn xóa ${pendingDelete.label} "${pendingDelete.title}" không? Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xóa"
        variant="danger"
        onConfirm={() => {
          if (pendingDelete) onDeleteItem(pendingDelete.type, pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
