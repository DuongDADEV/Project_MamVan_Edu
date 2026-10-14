import React, { useState, useEffect } from 'react';
import {
  TheoryLessonWithMeta,
  TopicWithMeta,
  QuizWithMeta,
  TheoryBlock,
  TheoryBlockType,
} from '../../../services/types.ts';
import { StatusBadge } from './StatusBadge.tsx';
import {
  BookOpen,
  Heading,
  AlignLeft,
  List,
  Sparkles,
  Bookmark,
  Image as ImageIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Eye,
  Save,
  UploadCloud,
  CheckCircle2,
  FileQuestion,
  Copy,
  Layers,
  ListOrdered,
  Upload,
  Loader2,
} from 'lucide-react';
import { uploadLessonMedia } from '../../../services/supabase/storage.ts';

interface TheoryLessonEditorProps {
  theory: TheoryLessonWithMeta;
  topics: TopicWithMeta[];
  quizzes: QuizWithMeta[];
  onSave: (updated: Partial<TheoryLessonWithMeta>) => Promise<void>;
  onPublish: () => void;
  onPreviewStudent: () => void;
  onCreateLinkedQuiz: (kind: 'practice' | 'quick' | 'mastery') => void;
}

export const TheoryLessonEditor: React.FC<TheoryLessonEditorProps> = ({
  theory,
  topics,
  quizzes,
  onSave,
  onPublish,
  onPreviewStudent,
  onCreateLinkedQuiz,
}) => {
  const [title, setTitle] = useState(theory.title || '');
  const [topicId, setTopicId] = useState(theory.topicId || topics[0]?.id || '');
  const [kind, setKind] = useState<'summary_post_video' | 'general_topic'>(
    theory.kind || 'general_topic'
  );
  const [minReadSeconds, setMinReadSeconds] = useState<number>(theory.minReadSeconds || 25);
  const [practiceQuizId, setPracticeQuizId] = useState(theory.practiceQuizId || '');
  const [testQuizId, setTestQuizId] = useState(theory.testQuizId || '');
  const [test2QuizId, setTest2QuizId] = useState(theory.test2QuizId || '');

  // Khối nội dung trong block-editor
  const [blocks, setBlocks] = useState<TheoryBlock[]>(() => {
    if (theory.blocks && theory.blocks.length > 0) {
      return theory.blocks;
    }
    // Nếu chưa có blocks mà có sections cũ, convert sang blocks
    if (theory.sections && theory.sections.length > 0) {
      const generated: TheoryBlock[] = [];
      theory.sections.forEach((sec, i) => {
        generated.push({
          id: `b_${Date.now()}_${i}_h`,
          type: 'heading',
          level: 2,
          content: sec.title,
        });
        sec.body.forEach((p, j) => {
          generated.push({
            id: `b_${Date.now()}_${i}_p_${j}`,
            type: 'paragraph',
            content: p,
          });
        });
        if (sec.example) {
          generated.push({
            id: `b_${Date.now()}_${i}_ex`,
            type: 'example',
            exampleText: sec.example.text,
            exampleAnalysis: sec.example.analysis,
          });
        }
        if (sec.takeaway) {
          generated.push({
            id: `b_${Date.now()}_${i}_tk`,
            type: 'takeaway',
            takeawayText: sec.takeaway,
          });
        }
      });
      return generated;
    }

    return [
      { id: 'b_1', type: 'heading', level: 2, content: '1. Khái niệm và đặc điểm chung' },
      { id: 'b_2', type: 'paragraph', content: 'Gõ nội dung giải thích lý thuyết chi tiết tại đây...' },
      {
        id: 'b_3',
        type: 'example',
        exampleText: 'Trích dẫn câu thơ hoặc đoạn văn mẫu...',
        exampleAnalysis: 'Phân tích nét đặc sắc về nghệ thuật hoặc nội dung...',
      },
      { id: 'b_4', type: 'takeaway', takeawayText: 'Ghi nhớ cốt lõi cần nhớ để làm bài tập.' },
    ];
  });

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  useEffect(() => {
    setTitle(theory.title || '');
    setTopicId(theory.topicId || topics[0]?.id || '');
    setKind(theory.kind || 'general_topic');
    setMinReadSeconds(theory.minReadSeconds || 25);
    setPracticeQuizId(theory.practiceQuizId || '');
    setTestQuizId(theory.testQuizId || '');
    setTest2QuizId(theory.test2QuizId || '');
  }, [theory.id]);

  // Tự động ước tính thời gian đọc từ số từ trong các khối (~200 từ/phút = ~3.3 từ/giây)
  const calculateEstimatedSeconds = () => {
    let wordCount = 0;
    blocks.forEach((b) => {
      if (b.content) wordCount += b.content.split(/\s+/).filter(Boolean).length;
      if (b.exampleText) wordCount += b.exampleText.split(/\s+/).filter(Boolean).length;
      if (b.exampleAnalysis) wordCount += b.exampleAnalysis.split(/\s+/).filter(Boolean).length;
      if (b.takeawayText) wordCount += b.takeawayText.split(/\s+/).filter(Boolean).length;
      if (b.items) wordCount += b.items.join(' ').split(/\s+/).filter(Boolean).length;
    });
    // Tối thiểu 10s, trung bình mỗi từ đọc trong 0.25s
    const estimated = Math.max(10, Math.round(wordCount * 0.25));
    setMinReadSeconds(estimated);
  };

  // Thêm khối mới
  const handleAddBlock = (type: TheoryBlockType) => {
    const newBlock: TheoryBlock = {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type,
      level: 2,
      content: '',
      items: type === 'list' ? ['Ý 1', 'Ý 2'] : undefined,
      exampleText: type === 'example' ? '' : undefined,
      exampleAnalysis: type === 'example' ? '' : undefined,
      takeawayText: type === 'takeaway' ? '' : undefined,
      imageUrl: type === 'image' ? '' : undefined,
      caption: type === 'image' ? '' : undefined,
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  // Cập nhật khối
  const handleUpdateBlock = (id: string, updates: Partial<TheoryBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  // Tải file ảnh / sơ đồ từ máy tính lên Supabase Storage
  const handleImageFileUpload = async (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingBlockId(blockId);
    try {
      const publicUrl = await uploadLessonMedia(file, 'images');
      handleUpdateBlock(blockId, { imageUrl: publicUrl });
    } catch (err: any) {
      console.error('Lỗi tải file ảnh lên:', err);
      // Fallback tự động sang FileReader DataURL
      const reader = new FileReader();
      reader.onload = () => {
        handleUpdateBlock(blockId, { imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingBlockId(null);
    }
  };

  // Xóa khối
  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  // Nhân bản khối
  const handleDuplicateBlock = (index: number) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const target = copy[index];
      const cloned: TheoryBlock = {
        ...target,
        id: 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      };
      copy.splice(index + 1, 0, cloned);
      return copy;
    });
  };

  // Di chuyển khối
  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    setBlocks((prev) => {
      const copy = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  // Mục lục tự sinh từ các khối tiêu đề
  const tableOfContents = blocks
    .filter((b) => b.type === 'heading' && b.content?.trim())
    .map((b) => ({ id: b.id, title: b.content!.trim(), level: b.level || 2 }));

  // Lưu nháp
  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      // Chuyển đổi khối thành sections nếu cần tương thích ngược
      const sections = blocks
        .filter((b) => b.type === 'heading')
        .map((h, idx) => ({
          id: h.id,
          title: h.content || `Phần ${idx + 1}`,
          body: blocks
            .filter((b) => b.type === 'paragraph')
            .map((p) => p.content || ''),
          takeaway: blocks.find((b) => b.type === 'takeaway')?.takeawayText || '',
        }));

      await onSave({
        id: theory.id,
        title: title.trim(),
        topicId,
        kind,
        minReadSeconds,
        blocks,
        sections: sections.length > 0 ? sections : theory.sections,
        practiceQuizId,
        testQuizId,
        test2QuizId,
      });

      const now = new Date();
      setLastSavedTime(
        `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`
      );
    } catch (err) {
      console.error('Lỗi khi lưu lý thuyết:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const topicQuizzes = quizzes.filter((q) => !topicId || q.topicId === topicId);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FFFDF8] rounded-2xl md:rounded-l-none overflow-hidden shadow-xs">
      {/* Top Header */}
      <div className="p-4 bg-[#FAF5EB] border-b border-[#E6DCC8] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 text-[#7C3AED] flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-lora font-bold text-sm text-[#2F3E6B] truncate">
                Trình soạn thảo Lý thuyết
              </h3>
              <StatusBadge
                status={theory.status}
                hasUnpublishedEdits={theory.has_unpublished_edits}
                size="sm"
              />
            </div>
            {lastSavedTime && (
              <p className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Đã lưu nháp lúc {lastSavedTime}</span>
              </p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviewStudent}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5 text-[#2F3E6B]" />
            <span>Xem trước như học sinh</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:bg-black/5 text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs"
          >
            <Save className="w-3.5 h-3.5 text-[#8C7E6A]" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu nháp'}</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={async () => {
              await handleSaveDraft();
              onPublish();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Cập nhật lên web học sinh</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Editor + Sidebar Table of Contents */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
        {/* Left / Center: Main Form & Blocks */}
        <div className="flex-1 space-y-6">
          {/* 1. Loại lý thuyết & Thông tin chung */}
          <div className="p-4 rounded-3xl bg-[#FAF5EB]/60 border border-[#E6DCC8] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
                  Phân loại lý thuyết
                </label>
                <div className="flex items-center p-1 bg-white rounded-2xl border border-[#E6DCC8]">
                  <button
                    type="button"
                    onClick={() => setKind('general_topic')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                      kind === 'general_topic'
                        ? 'bg-[#2F3E6B] text-white shadow-xs'
                        : 'text-[#8C7E6A] hover:text-[#2F3E6B]'
                    }`}
                  >
                    Lý thuyết chung chi tiết
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind('summary_post_video')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                      kind === 'summary_post_video'
                        ? 'bg-[#2F3E6B] text-white shadow-xs'
                        : 'text-[#8C7E6A] hover:text-[#2F3E6B]'
                    }`}
                  >
                    Tóm tắt sau video
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
                  Thuộc chủ đề nào?
                </label>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.tag})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#2F3E6B] mb-1">
                  Tiêu đề bài lý thuyết <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Cẩm nang lý thuyết: Thơ bốn chữ, năm chữ..."
                  className="w-full px-3.5 py-2 rounded-2xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
                />
              </div>

              {/* Thời gian đọc tối thiểu */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#2F3E6B] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#2F3E6B]" />
                    <span>Thời gian đọc tối thiểu (giây)</span>
                  </label>
                  <button
                    type="button"
                    onClick={calculateEstimatedSeconds}
                    className="text-[10px] text-[#E2704A] hover:underline font-bold"
                    title="Ước tính từ số lượng từ trong bài viết"
                  >
                    Tự ước tính
                  </button>
                </div>
                <input
                  type="number"
                  min="5"
                  value={minReadSeconds}
                  onChange={(e) => setMinReadSeconds(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-2xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] text-center"
                />
              </div>
            </div>
          </div>

          {/* 2. KHU SOẠN THẢO VĂN BẢN THEO KHỐI (BLOCK-BASED EDITOR) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#2F3E6B] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Trình soạn thảo khối (Block Editor)</span>
                </h4>
                <p className="text-[11px] text-[#8C7E6A] mt-0.5">
                  Thêm các khối tiêu đề, đoạn văn, danh sách, ví dụ và hình ảnh minh họa
                </p>
              </div>

              {/* Toolbar thêm khối nhanh */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddBlock('heading')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B] shadow-2xs"
                  title="Thêm khối Tiêu đề (H2/H3)"
                >
                  <Heading className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Tiêu đề</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('paragraph')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B] shadow-2xs"
                  title="Thêm khối Đoạn văn"
                >
                  <AlignLeft className="w-3.5 h-3.5 text-[#2F3E6B]" />
                  <span>Đoạn văn</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('list')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B] shadow-2xs"
                  title="Thêm khối Danh sách"
                >
                  <List className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Danh sách</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('example')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B] shadow-2xs"
                  title="Thêm khối Ví dụ trích đoạn & Phân tích"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E2704A]" />
                  <span>Ví dụ</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('takeaway')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B] shadow-2xs"
                  title="Thêm khối Ghi nhớ trọng tâm"
                >
                  <Bookmark className="w-3.5 h-3.5 text-[#F2B84B]" />
                  <span>Ghi nhớ</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('image')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B] shadow-2xs"
                  title="Thêm khối Hình ảnh"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Hình ảnh</span>
                </button>
              </div>
            </div>

            {/* Blocks List */}
            <div className="space-y-3">
              {blocks.map((block, index) => {
                return (
                  <div
                    key={block.id}
                    className="p-4 rounded-3xl bg-white border border-[#E6DCC8] shadow-2xs space-y-2.5 group relative"
                  >
                    {/* Block Toolbar */}
                    <div className="flex items-center justify-between pb-2 border-b border-[#E6DCC8]/60 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#FAF5EB] text-[#2F3E6B] text-[10px] font-bold flex items-center justify-center border border-[#E6DCC8]">
                          {index + 1}
                        </span>
                        <span className="font-bold text-[#2F3E6B] uppercase text-[11px] tracking-wider">
                          {block.type === 'heading' && `Tiêu đề (H${block.level || 2})`}
                          {block.type === 'paragraph' && 'Đoạn văn'}
                          {block.type === 'list' && 'Danh sách liệt kê'}
                          {block.type === 'example' && 'Khối ví dụ & Phân tích'}
                          {block.type === 'takeaway' && 'Khối ghi nhớ (Hộp viền nổi bật)'}
                          {block.type === 'image' && 'Hình ảnh / Sơ đồ minh họa'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {block.type === 'heading' && (
                          <div className="flex items-center bg-[#FAF5EB] rounded-lg p-0.5 border border-[#E6DCC8] mr-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateBlock(block.id, { level: 2 })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                block.level === 2 ? 'bg-white text-[#2F3E6B] shadow-2xs' : 'text-[#8C7E6A]'
                              }`}
                            >
                              H2
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateBlock(block.id, { level: 3 })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                block.level === 3 ? 'bg-white text-[#2F3E6B] shadow-2xs' : 'text-[#8C7E6A]'
                              }`}
                            >
                              H3
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveBlock(index, 'up')}
                          className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] disabled:opacity-30"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === blocks.length - 1}
                          onClick={() => handleMoveBlock(index, 'down')}
                          className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] disabled:opacity-30"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateBlock(index)}
                          className="p-1 rounded hover:bg-black/5 text-[#8C7E6A]"
                          title="Nhân bản khối này"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(block.id)}
                          className="p-1 rounded hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600"
                          title="Xóa khối này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Block Content Inputs by Type */}
                    {block.type === 'heading' && (
                      <input
                        type="text"
                        value={block.content || ''}
                        onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                        placeholder="Nhập tiêu đề mục (VD: 1. Đặc điểm số tiếng và nhịp điệu)..."
                        className={`w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] font-lora font-bold text-[#2F3E6B] ${
                          block.level === 3 ? 'text-sm' : 'text-base'
                        }`}
                      />
                    )}

                    {block.type === 'paragraph' && (
                      <textarea
                        rows={3}
                        value={block.content || ''}
                        onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                        placeholder="Nội dung đoạn văn giải thích lý thuyết chi tiết..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] leading-relaxed resize-none"
                      />
                    )}

                    {block.type === 'list' && (
                      <div className="space-y-2">
                        {(block.items || []).map((item: string, itemIdx: number) => (
                          <div key={itemIdx} className="flex items-center gap-2">
                            <span className="text-[#0D9488] font-bold">•</span>
                            <input
                              type="text"
                              value={item}
                              onChange={(e) => {
                                const newItems = [...(block.items || [])];
                                newItems[itemIdx] = e.target.value;
                                handleUpdateBlock(block.id, { items: newItems });
                              }}
                              className="flex-1 px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = (block.items || []).filter((_: string, i: number) => i !== itemIdx);
                                handleUpdateBlock(block.id, { items: newItems });
                              }}
                              className="p-1 text-[#8C7E6A] hover:text-rose-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateBlock(block.id, {
                              items: [...(block.items || []), ''],
                            });
                          }}
                          className="text-[11px] text-[#0D9488] hover:underline font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm gạch đầu dòng</span>
                        </button>
                      </div>
                    )}

                    {block.type === 'example' && (
                      <div className="space-y-2 p-3 rounded-2xl bg-orange-50/40 border border-orange-200">
                        <div>
                          <label className="block text-[11px] font-bold text-[#E2704A] mb-1">
                            Trích đoạn ngữ liệu / Ví dụ mẫu:
                          </label>
                          <textarea
                            rows={2}
                            value={block.exampleText || ''}
                            onChange={(e) => handleUpdateBlock(block.id, { exampleText: e.target.value })}
                            placeholder='"Hạt gạo làng ta / Có vị phù sa / Của sông Kinh Thầy..."'
                            className="w-full px-3 py-1.5 rounded-xl bg-white border border-orange-200 text-xs text-[#2F3E6B] italic resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#2F3E6B] mb-1">
                            Phân tích hướng dẫn học sinh:
                          </label>
                          <textarea
                            rows={2}
                            value={block.exampleAnalysis || ''}
                            onChange={(e) => handleUpdateBlock(block.id, { exampleAnalysis: e.target.value })}
                            placeholder="Mỗi dòng thơ gồm 4 tiếng, nhịp điệu nhanh, gợi tả sự hồn nhiên..."
                            className="w-full px-3 py-1.5 rounded-xl bg-white border border-orange-200 text-xs text-[#2F3E6B] resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {block.type === 'takeaway' && (
                      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                        <label className="block text-[11px] font-bold text-amber-800 flex items-center gap-1">
                          <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                          <span>Khối ghi nhớ (Học sinh cần nắm vững):</span>
                        </label>
                        <textarea
                          rows={2}
                          value={block.takeawayText || ''}
                          onChange={(e) => handleUpdateBlock(block.id, { takeawayText: e.target.value })}
                          placeholder="Quy tắc cốt lõi: Thơ bốn chữ ngắt nhịp 2/2..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs font-bold text-[#2F3E6B] resize-none"
                        />
                      </div>
                    )}

                    {block.type === 'image' && (
                      <div className="space-y-3 p-3.5 rounded-2xl bg-blue-50/40 border border-blue-200">
                        {/* Khu vực tải tệp từ máy tính hoặc dán URL */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-bold text-[#2563EB]">
                              Ảnh / Tệp sơ đồ minh họa:
                            </label>
                            {uploadingBlockId === block.id && (
                              <span className="text-[11px] text-[#2563EB] flex items-center gap-1 font-semibold animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Đang tải tệp lên...
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            {/* Nút tải tệp từ thiết bị */}
                            <label
                              className={`px-3 py-1.5 rounded-xl border border-blue-300 bg-white hover:bg-blue-50 text-[#2563EB] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-2xs hover:shadow-xs active:scale-95 ${
                                uploadingBlockId === block.id ? 'opacity-50 pointer-events-none' : ''
                              }`}
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Tải ảnh từ máy tính</span>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => handleImageFileUpload(block.id, e)}
                              />
                            </label>

                            <span className="text-[11px] text-[#8C7E6A] text-center sm:text-left font-medium">hoặc</span>

                            {/* Ô nhập URL trực tiếp */}
                            <input
                              type="text"
                              value={block.imageUrl || ''}
                              onChange={(e) => handleUpdateBlock(block.id, { imageUrl: e.target.value })}
                              placeholder="Dán link ảnh từ web (https://... /so_do.png)"
                              className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-xs text-[#2F3E6B] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                        </div>

                        {/* Xem trước ảnh nếu đã có */}
                        {block.imageUrl && (
                          <div className="p-2.5 rounded-xl bg-white border border-blue-100 flex items-center gap-3">
                            <img
                              src={block.imageUrl}
                              alt="Xem trước"
                              className="w-16 h-16 object-contain rounded-lg border border-slate-200 shrink-0 bg-slate-50"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#2F3E6B] truncate">
                                {block.imageUrl.startsWith('data:') ? 'Tệp ảnh từ máy tính' : block.imageUrl}
                              </p>
                              <p className="text-[10px] text-[#10B981] font-medium flex items-center gap-1 mt-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                Đã sẵn sàng hiển thị trong bài học
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateBlock(block.id, { imageUrl: '' })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Xóa tệp này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <div>
                          <label className="block text-[11px] font-bold text-[#2F3E6B] mb-1">
                            Chú thích hình ảnh (Caption):
                          </label>
                          <input
                            type="text"
                            value={block.caption || ''}
                            onChange={(e) => handleUpdateBlock(block.id, { caption: e.target.value })}
                            placeholder="Hình 1: Sơ đồ tư duy cấu tạo từ láy bộ phận"
                            className="w-full px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-xs text-[#2F3E6B]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. LIÊN KẾT BÀI TẬP */}
          <div className="space-y-3 pt-3 border-t border-[#E6DCC8]">
            <h4 className="text-xs font-bold text-[#2F3E6B] uppercase tracking-wider flex items-center gap-1.5">
              <FileQuestion className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span>Bài tập thực hành sau khi đọc lý thuyết</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-[#E6DCC8] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2F3E6B]">Bài luyện tập sau lý thuyết</span>
                  <button
                    type="button"
                    onClick={() => onCreateLinkedQuiz('practice')}
                    className="text-[10px] text-[#E2704A] hover:underline font-bold"
                  >
                    + Tạo mới ngay
                  </button>
                </div>
                <select
                  value={practiceQuizId}
                  onChange={(e) => setPracticeQuizId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
                >
                  <option value="">-- Chưa gắn bài --</option>
                  {topicQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-[#E6DCC8] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2F3E6B]">Bài kiểm tra lý thuyết</span>
                  <button
                    type="button"
                    onClick={() => onCreateLinkedQuiz('quick')}
                    className="text-[10px] text-[#E2704A] hover:underline font-bold"
                  >
                    + Tạo mới ngay
                  </button>
                </div>
                <select
                  value={testQuizId}
                  onChange={(e) => setTestQuizId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
                >
                  <option value="">-- Chưa gắn bài --</option>
                  {topicQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Auto-generated Table of Contents & Info */}
        <div className="w-full lg:w-72 space-y-4">
          {/* Table of Contents */}
          <div className="p-4 rounded-3xl bg-[#FAF5EB] border border-[#E6DCC8] space-y-3">
            <div className="flex items-center gap-1.5">
              <ListOrdered className="w-4 h-4 text-[#2F3E6B]" />
              <h4 className="text-xs font-bold text-[#2F3E6B] uppercase tracking-wider">
                Mục lục tự sinh (TOC)
              </h4>
            </div>

            {tableOfContents.length === 0 ? (
              <p className="text-[11px] text-[#8C7E6A] italic">
                Chưa có tiêu đề nào. Hãy thêm khối Tiêu đề để tạo mục lục.
              </p>
            ) : (
              <div className="space-y-1 text-xs">
                {tableOfContents.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-1.5 rounded-xl text-[#2F3E6B] font-medium truncate ${
                      item.level === 3 ? 'pl-4 text-[11px] text-[#8C7E6A]' : 'font-bold'
                    }`}
                  >
                    • {item.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Tip Box */}
          <div className="p-4 rounded-3xl bg-white border border-[#E6DCC8] space-y-2 text-xs">
            <h5 className="font-bold text-[#2F3E6B] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#E2704A]" />
              <span>Mẹo sư phạm Ngữ văn:</span>
            </h5>
            <p className="text-[11px] text-[#8C7E6A] leading-relaxed">
              Các bài lý thuyết Văn 7 nên kết hợp ít nhất 1 trích đoạn văn học thực tế và 1 khối ghi nhớ nổi bật để học sinh dễ liên hệ kiến thức khi làm bài tập cảm thụ.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
