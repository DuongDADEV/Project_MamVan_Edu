import React, { useEffect, useState } from 'react';
import {
  TopicWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  QuizWithMeta,
} from '../../../services/types.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { deriveFlowItems } from '../../../logic/flowOrder.ts';
import { TeacherAssignmentSummary } from '../../../services/api/biClient.ts';
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
  ClipboardList,
  Layers,
  Sparkles,
  Copy,
  FileEdit,
  ChevronsRight,
  ChevronsLeft,
} from 'lucide-react';

export type ContentItemType = 'topic' | 'video' | 'theory' | 'quiz' | 'assignment';

export interface SelectedContentItem {
  type: ContentItemType;
  id: string;
}

interface TopicTreeSidebarProps {
  teacherId?: string;
  // Khi trình soạn đang mở, cây thu gọn thành rail để vùng soạn chiếm toàn bộ
  // khung phải; bấm nút mở lại thì cây trở lại.
  collapsed?: boolean;
  onExpandTree?: () => void;
  // Nút thu gọn toàn bộ panel thành rail (24/10 theo yêu cầu chủ dự án):
  // tái dùng đúng rail khi mở trình soạn, bấm mở lại thì cây trở lại.
  onCollapseTree?: () => void;
  topics: TopicWithMeta[];
  videos: VideoLessonWithMeta[];
  theories: TheoryLessonWithMeta[];
  quizzes: QuizWithMeta[];
  assignments?: TeacherAssignmentSummary[];
  selectedItem: SelectedContentItem | null;
  onSelectItem: (item: SelectedContentItem) => void;
  onOpenCreateTopic: () => void;
  onAddAssignment?: () => void;
  onCreateItemInTopic?: (topicId: string, kind: 'video' | 'theory' | 'quiz') => void;
  onEditTopic: (topic: TopicWithMeta) => void;
  onDeleteTopic: (topicId: string) => void;
  onReorderTopics: (orderedIds: string[]) => void;
  onDuplicateItem: (type: ContentItemType, id: string) => void;
  onDeleteItem: (type: ContentItemType, id: string) => void;
}

export const TopicTreeSidebar: React.FC<TopicTreeSidebarProps> = ({
  teacherId,
  collapsed = false,
  onExpandTree,
  onCollapseTree,
  topics,
  videos,
  theories,
  quizzes,
  assignments = [],
  selectedItem,
  onSelectItem,
  onOpenCreateTopic,
  onAddAssignment,
  onCreateItemInTopic,
  onEditTopic,
  onDeleteTopic,
  onReorderTopics,
  onDuplicateItem,
  onDeleteItem,
}) => {
  // Cột tách 2 MỤC RIÊNG: tab Chủ đề / tab Bài tập & đánh giá (chủ dự án
  // không muốn hai loại chung một danh sách — khó nhìn, khó kiểm soát)
  const [treeTab, setTreeTab] = useState<'topics' | 'assignments'>('topics');
  useEffect(() => {
    if (selectedItem?.type === 'assignment') setTreeTab('assignments');
    else if (selectedItem) setTreeTab('topics');
  }, [selectedItem]);

  const [pendingDelete, setPendingDelete] = useState<{ type: ContentItemType; id: string; label: string; title: string } | null>(null);
  // Trạng thái thu gọn/mở rộng từng chủ đề — LƯU THEO GIÁO VIÊN để rời trang
  // rồi quay lại vẫn giữ nguyên như lúc rời đi (đợt sửa 24/10: trước đây chỉ
  // nằm trong bộ nhớ nên lần nào vào lại cũng mở hết ra). Chưa có trạng thái
  // lưu thì mặc định mở như cũ; chủ đề mới (chưa có khóa) cũng mặc định mở
  // nhờ phép kiểm `!== false` ở chỗ render.
  const TREE_STORAGE_KEY = `mamvan_topic_tree_expanded:${teacherId || 'gv001'}`;
  const [expandedTopicIds, setExpandedTopicIds] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(TREE_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      // localStorage lỗi thì rơi về mặc định mở hết
    }
    const initial: Record<string, boolean> = {};
    topics.forEach((t) => {
      initial[t.id] = true; // Mặc định mở rộng tất cả
    });
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(TREE_STORAGE_KEY, JSON.stringify(expandedTopicIds));
    } catch {
      // Bỏ qua lỗi quota
    }
  }, [expandedTopicIds, TREE_STORAGE_KEY]);

  // Menu tùy chọn đang mở
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [addMenuTopicId, setAddMenuTopicId] = useState<string | null>(null);

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

  // Rail thu gọn khi trình soạn đang mở: chỉ còn nút mở lại để vùng soạn
  // chiếm toàn bộ khung phải. Thoát soạn thì cây trở lại (do prop collapsed).
  if (collapsed) {
    return (
      <div className="w-full md:w-14 flex md:flex-col flex-row items-center justify-center md:justify-start py-2 md:py-3 px-2 gap-2 bg-[#FFFDF8] border-r border-[#E6DCC8] rounded-2xl md:rounded-r-none shrink-0 shadow-xs">
        <button
          type="button"
          onClick={onExpandTree}
          className="p-2 rounded-xl bg-white border border-[#E6DCC8] text-[#2F3E6B] hover:border-[#2F3E6B] transition"
          title="Mở lại cây chủ đề"
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
        <span className="hidden md:block text-[10px] font-bold text-[#8C7E6A] [writing-mode:vertical-rl] tracking-wider">
          Cây chủ đề
        </span>
      </div>
    );
  }

  return (
    <div className="w-full md:w-72 lg:w-80 flex flex-col min-h-0 max-h-[45%] md:max-h-none bg-[#FFFDF8] border-r border-[#E6DCC8] rounded-2xl md:rounded-r-none overflow-hidden shrink-0 shadow-xs">
      {/* Top Header — cột tách 2 mục riêng bằng TAB: bấm tab "Chủ đề" thì
          cột hiện cây chủ đề; bấm tab "Bài tập & đánh giá" thì đúng vị trí
          đó thay bằng danh sách bài kiểm tra. Mỗi tab có nút Thêm riêng. */}
      <div className="p-4 bg-[#FAF5EB] border-b border-[#E6DCC8]">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-[#2F3E6B] shrink-0" />
            <h3 className="font-lora font-bold text-sm text-[#2F3E6B] whitespace-nowrap">
              Cây chủ đề
            </h3>
          </div>
          {onCollapseTree && (
            <button
              type="button"
              onClick={onCollapseTree}
              className="p-1.5 rounded-lg bg-white border border-[#E6DCC8] text-[#2F3E6B] hover:border-[#2F3E6B] transition shrink-0"
              title="Thu gọn cây chủ đề thành thanh rail"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1 mt-3 p-1 rounded-xl bg-white border border-[#E6DCC8]">
          <button
            type="button"
            onClick={() => setTreeTab('topics')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-black transition-all ${
              treeTab === 'topics'
                ? 'bg-[#2F3E6B] text-white shadow-xs'
                : 'text-[#8C7E6A] hover:text-[#2F3E6B]'
            }`}
          >
            Chủ đề
            <span
              className={`text-[10px] px-1.5 py-px rounded-full font-mono font-bold ${
                treeTab === 'topics' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {topics.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTreeTab('assignments')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-black transition-all ${
              treeTab === 'assignments'
                ? 'bg-[#B45309] text-white shadow-xs'
                : 'text-[#8C7E6A] hover:text-[#B45309]'
            }`}
          >
            Bài tập & đánh giá
            <span
              className={`text-[10px] px-1.5 py-px rounded-full font-mono font-bold ${
                treeTab === 'assignments'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {assignments.length}
            </span>
          </button>
        </div>

        {treeTab === 'topics' ? (
          <button
            onClick={onOpenCreateTopic}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs hover:shadow-xs"
            title="Thêm chủ đề học mới"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#E2704A]" />
            <span>Thêm chủ đề</span>
          </button>
        ) : onAddAssignment ? (
          <button
            onClick={onAddAssignment}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-black transition-all shadow-xs"
            title="Thêm bài tập & đánh giá mới — tạo một mục riêng rồi soạn như một bài kiểm tra"
          >
            <ClipboardPlus className="w-3.5 h-3.5" />
            <span>Thêm bài tập & đánh giá</span>
          </button>
        ) : null}
      </div>

      {/* Topics Tree List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {treeTab === 'assignments' ? (
          assignments.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8C7E6A] italic">
              Chưa có bài tập & đánh giá nào. Bấm "Thêm bài tập & đánh giá" ở trên để tạo bài đầu tiên!
            </div>
          ) : (
            <>
          {/* Bài tập & đánh giá — MỤC RIÊNG ngang hàng chủ đề */}
          {assignments.map((a) => {
            const isSelected =
              selectedItem?.type === 'assignment' && selectedItem?.id === a.id;
            return (
              <div
                key={a.id}
                onClick={() => onSelectItem({ type: 'assignment', id: a.id })}
                className={`rounded-2xl border overflow-hidden cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#B45309] ring-1 ring-[#B45309]/40 bg-[#F59E0B]/10'
                    : 'border-[#B45309]/30 bg-[#F59E0B]/5 hover:bg-[#F59E0B]/10'
                }`}
                title="Bài tập & đánh giá — bấm để mở màn soạn bài kiểm tra"
              >
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-[#B45309]/15 text-[#B45309] flex items-center justify-center shrink-0">
                    <ClipboardList className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-lora font-bold text-[#2F3E6B] leading-snug truncate">
                      {a.title}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-[#8C7E6A]">Bài tập & đánh giá</span>
                      <span className="text-[10px] text-slate-300">•</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-px rounded-full ${
                          a.published
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {a.published ? 'Đã giao' : 'Bản nháp'}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8C7E6A] mt-0.5">
                      {a.questionCount} câu hỏi · {a.targetCount} học sinh
                      {a.published ? ` · đã nộp ${a.submittedCount}/${a.targetCount}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete({
                        type: 'assignment',
                        id: a.id,
                        label: 'bài tập & đánh giá',
                        title: a.title,
                      });
                    }}
                    className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] hover:text-red-600 transition-colors shrink-0"
                    title="Xóa bài tập & đánh giá"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
            </>
          )
        ) : topics.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#8C7E6A] italic">
            Chưa có chủ đề nào. Hãy bấm "Thêm chủ đề" để bắt đầu!
          </div>
        ) : (
          <>
          {topics.map((topic, index) => {
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
                  backgroundColor: `${topicColor}26`,
                  borderColor: `${topicColor}80`,
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
                      ? { backgroundColor: `${topicColor}40`, borderLeftColor: topicColor }
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

                {/* Sub-items List — hợp nhất theo THỨ TỰ LUỒNG HỌC của chủ đề */}
                {isExpanded && (
                  <div className="bg-white px-2 py-2 border-t border-[#E6DCC8]/60 space-y-1 pl-6">
                    {deriveFlowItems(
                      topic.flowOrder,
                      topicVideos.map((v) => v.id),
                      topicTheories.map((t) => t.id),
                      topicQuizzes.map((q) => q.id)
                    ).map((child) => {
                      const src: any =
                        child.type === 'video'
                          ? topicVideos.find((v) => v.id === child.id)
                          : child.type === 'theory'
                            ? topicTheories.find((t) => t.id === child.id)
                            : topicQuizzes.find((q) => q.id === child.id);
                      if (!src) return null;
                      const isSelected =
                        selectedItem?.type === child.type && selectedItem?.id === child.id;
                      const conf =
                        child.type === 'video'
                          ? {
                              icon: <Video className="w-3.5 h-3.5 text-[#E2704A] shrink-0" />,
                              sel: 'bg-orange-50 border border-orange-200 text-[#E2704A] font-bold shadow-2xs',
                              label: 'video',
                              dupTitle: 'Nhân bản video',
                              delTitle: 'Xóa video',
                            }
                          : child.type === 'theory'
                            ? {
                                icon: <BookOpen className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />,
                                sel: 'bg-purple-50 border border-purple-200 text-[#7C3AED] font-bold shadow-2xs',
                                label: 'lý thuyết',
                                dupTitle: 'Nhân bản lý thuyết',
                                delTitle: 'Xóa lý thuyết',
                              }
                            : {
                                icon: <FileQuestion className="w-3.5 h-3.5 text-[#4F46E5] shrink-0" />,
                                sel: 'bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold shadow-2xs',
                                label: 'bài tập',
                                dupTitle: 'Nhân bản đề thi',
                                delTitle: 'Xóa bài tập',
                              };
                      return (
                        <div
                          key={child.type + ':' + child.id}
                          onClick={() => onSelectItem({ type: child.type, id: child.id })}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all text-xs ${
                            isSelected ? conf.sel : 'hover:bg-[#FAF5EB] text-[#2F3E6B]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {conf.icon}
                            <div className="min-w-0">
                              <span className="truncate block">{src.title}</span>
                              {child.type === 'quiz' && (
                                <span className="text-[10px] text-[#8C7E6A] font-medium">
                                  {getQuizKindLabel(src.kind)} • {src.questionIds.length} câu
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <StatusBadge
                              status={src.status}
                              hasUnpublishedEdits={src.has_unpublished_edits}
                              size="sm"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateItem(child.type, child.id);
                              }}
                              className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] hover:text-[#2F3E6B]"
                              title={conf.dupTitle}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ type: child.type, id: child.id, label: conf.label, title: src.title });
                              }}
                              className="p-1 rounded hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600"
                              title={conf.delTitle}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {topicVideos.length === 0 && topicTheories.length === 0 && topicQuizzes.length === 0 && (
                      <div className="py-1.5 text-center text-[11px] text-[#8C7E6A] italic">
                        Chủ đề chưa có bài nào — bấm + Tạo mới để thêm bài đầu tiên.
                      </div>
                    )}

                    {/* + Tạo mới: luôn ở cuối danh sách bài của chủ đề */}
                    {onCreateItemInTopic && (
                      <div className="relative pt-0.5">
                        <button
                          type="button"
                          onClick={() => setAddMenuTopicId(addMenuTopicId === topic.id ? null : topic.id)}
                          className="w-full p-2 rounded-xl border border-dashed border-[#D8CCAF] text-[#8C7E6A] hover:border-[#E2704A] hover:text-[#E2704A] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tạo mới
                        </button>
                        {addMenuTopicId === topic.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setAddMenuTopicId(null)} />
                            <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-[#E6DCC8] rounded-xl shadow-xl z-30 p-1">
                              {(
                                [
                                  { kind: 'video' as const, label: 'Bài giảng Video', icon: <Video className="w-3.5 h-3.5 text-[#E2704A]" /> },
                                  { kind: 'theory' as const, label: 'Lý thuyết', icon: <BookOpen className="w-3.5 h-3.5 text-[#7C3AED]" /> },
                                  { kind: 'quiz' as const, label: 'Bài tập', icon: <FileQuestion className="w-3.5 h-3.5 text-[#4F46E5]" /> },
                                ]
                              ).map((row) => (
                                <button
                                  key={row.kind}
                                  type="button"
                                  onClick={() => {
                                    setAddMenuTopicId(null);
                                    onCreateItemInTopic(topic.id, row.kind);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[#FAF5EB] text-left text-xs font-bold text-[#2F3E6B]"
                                >
                                  {row.icon} {row.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          </>
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
