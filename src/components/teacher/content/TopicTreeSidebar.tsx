import React, { useState } from 'react';
import {
  TopicWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  QuizWithMeta,
} from '../../../services/types.ts';
import { StatusBadge } from './StatusBadge.tsx';
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
  ArrowUp,
  ArrowDown,
  FolderPlus,
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
  onEditTopic: (topic: TopicWithMeta) => void;
  onDeleteTopic: (topicId: string) => void;
  onMoveTopic: (topicId: string, direction: 'up' | 'down') => void;
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
  onEditTopic,
  onDeleteTopic,
  onMoveTopic,
  onDuplicateItem,
  onDeleteItem,
}) => {
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
    <div className="w-full md:w-72 lg:w-80 flex flex-col bg-[#FFFDF8] border-r border-[#E6DCC8] rounded-2xl md:rounded-r-none overflow-hidden shrink-0 shadow-xs">
      {/* Top Header */}
      <div className="p-4 bg-[#FAF5EB] border-b border-[#E6DCC8] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#2F3E6B]" />
          <h3 className="font-lora font-bold text-sm text-[#2F3E6B]">
            Cây chủ đề & Học liệu
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-bold font-mono">
            {topics.length}
          </span>
        </div>

        <button
          onClick={onOpenCreateTopic}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs hover:shadow-xs"
          title="Thêm chủ đề học mới"
        >
          <FolderPlus className="w-3.5 h-3.5 text-[#E2704A]" />
          <span>Thêm chủ đề</span>
        </button>
      </div>

      {/* Topics Tree List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {topics.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#8C7E6A] italic">
            Chưa có chủ đề nào. Hãy bấm "Thêm chủ đề" để bắt đầu!
          </div>
        ) : (
          topics.map((topic, index) => {
            const isExpanded = !!expandedTopicIds[topic.id];
            const topicVideos = videos.filter((v) => v.topicId === topic.id);
            const topicTheory = theories.find((th) => th.topicId === topic.id);
            const topicQuizzes = quizzes.filter((q) => q.topicId === topic.id);

            const isTopicSelected =
              selectedItem?.type === 'topic' && selectedItem?.id === topic.id;

            return (
              <div
                key={topic.id}
                className="rounded-2xl border border-[#E6DCC8] bg-[#FAF5EB]/40 overflow-hidden transition-all"
              >
                {/* Topic Header Row */}
                <div
                  onClick={() => onSelectItem({ type: 'topic', id: topic.id })}
                  className={`px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isTopicSelected
                      ? 'bg-[#2F3E6B]/10 border-l-4 border-l-[#2F3E6B]'
                      : 'hover:bg-black/5'
                  }`}
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
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: topic.colorScheme || '#2F3E6B' }}
                        />
                        <h4 className="text-xs font-bold text-[#2F3E6B] truncate">
                          {topic.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-[#8C7E6A]">{topic.tag}</span>
                        <span className="text-[10px] text-slate-300">•</span>
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
                    {/* Up / Down Reorder */}
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveTopic(topic.id, 'up');
                      }}
                      className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] disabled:opacity-30 transition-colors"
                      title="Di chuyển lên trên"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === topics.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveTopic(topic.id, 'down');
                      }}
                      className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] disabled:opacity-30 transition-colors"
                      title="Di chuyển xuống dưới"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

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
                                if (window.confirm(`Xóa video "${vid.title}"?`)) {
                                  onDeleteItem('video', vid.id);
                                }
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

                    {/* Theory */}
                    {topicTheory && (
                      <div
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
                              if (window.confirm(`Xóa lý thuyết "${topicTheory.title}"?`)) {
                                onDeleteItem('theory', topicTheory.id);
                              }
                            }}
                            className="p-1 rounded hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600"
                            title="Xóa lý thuyết"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

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
                                if (window.confirm(`Xóa bài tập "${quiz.title}"?`)) {
                                  onDeleteItem('quiz', quiz.id);
                                }
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

                    {topicVideos.length === 0 && !topicTheory && topicQuizzes.length === 0 && (
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
    </div>
  );
};
