import React, { useState, useEffect, useRef } from 'react';
import {
  TheoryLessonWithMeta,
  TopicWithMeta,
} from '../../../services/types.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { RichTextEditor } from './RichTextEditor.tsx';
import { initialBlocksFor } from '../../../logic/theoryDraft.ts';
import { blocksToHtml, extractHeadings, htmlToText } from '../../../utils/richText.ts';

import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  Clock,
  Eye,
  Save,
  UploadCloud,
  CheckCircle2,
  ListOrdered,
} from 'lucide-react';

interface TheoryLessonEditorProps {
  theory: TheoryLessonWithMeta;
  topics: TopicWithMeta[];
  onSave: (updated: Partial<TheoryLessonWithMeta>) => Promise<void>;
  onPublish: () => void;
  onPreviewStudent: () => void;
  onBack?: () => void;
  /** Thu gọn thanh công cụ (nút 2/3 trên dải luồng) */
  toolbarCollapsed?: boolean;
}

export const TheoryLessonEditor: React.FC<TheoryLessonEditorProps> = ({
  theory,
  topics,
  onSave,
  onPublish,
  onPreviewStudent,
  onBack,
  toolbarCollapsed,
}) => {
  const [title, setTitle] = useState(theory.title || '');
  const [topicId, setTopicId] = useState(theory.topicId || topics[0]?.id || '');
  const [kind, setKind] = useState<'summary_post_video' | 'general_topic'>(
    theory.kind || 'general_topic'
  );
  const [minReadSeconds, setMinReadSeconds] = useState<number>(theory.minReadSeconds || 25);

  // Nội dung lý thuyết dạng HTML (trình soạn Word dùng chung, 30/10/2026):
  // bài đã có contentHtml thì mở thẳng, bài cũ thì convert 1 lần từ khối cũ
  // (khối đã lưu > sections cũ > mẫu mặc định, xem logic/theoryDraft.ts).
  // Dữ liệu khối/sections cũ không xóa khỏi DB — PATCH chỉ ghi contentHtml.
  const [contentHtml, setContentHtml] = useState<string>(() =>
    theory.contentHtml || blocksToHtml(initialBlocksFor(theory))
  );

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Bản nháp hiện tại + bản đã lưu gần nhất (để autosave chỉ ghi khi đổi).
  // theoryRef giữ prop mới nhất cho các closure chạy sau unmount.
  const theoryRef = useRef(theory);
  theoryRef.current = theory;
  const draftRef = useRef({
    title: theory.title || '',
    topicId: theory.topicId || topics[0]?.id || '',
    kind: theory.kind || 'general_topic',
    minReadSeconds: theory.minReadSeconds || 25,
    contentHtml,
  });
  const savedJsonRef = useRef<string>(JSON.stringify(draftRef.current));
  const savingRef = useRef(false);

  useEffect(() => {
    const html = theory.contentHtml || blocksToHtml(initialBlocksFor(theory));
    setTitle(theory.title || '');
    setTopicId(theory.topicId || topics[0]?.id || '');
    setKind(theory.kind || 'general_topic');
    setMinReadSeconds(theory.minReadSeconds || 25);
    setContentHtml(html);
    draftRef.current = {
      title: theory.title || '',
      topicId: theory.topicId || topics[0]?.id || '',
      kind: theory.kind || 'general_topic',
      minReadSeconds: theory.minReadSeconds || 25,
      contentHtml: html,
          };
    savedJsonRef.current = JSON.stringify(draftRef.current);
    setSaveError(null);
  }, [theory.id]);

  // Tự động ước tính thời gian đọc từ số từ trong văn bản (~200 từ/phút = ~3.3 từ/giây)
  const calculateEstimatedSeconds = () => {
    const wordCount = htmlToText(contentHtml).split(/\s+/).filter(Boolean).length;
    // Tối thiểu 10s, trung bình mỗi từ đọc trong 0.25s
    const estimated = Math.max(10, Math.round(wordCount * 0.25));
    setMinReadSeconds(estimated);
  };

  // Mục lục tự sinh từ các tiêu đề H2/H3 trong văn bản
  const tableOfContents = extractHeadings(contentHtml);

  // ---- TỰ LƯU NHÁP (26/10, sửa ca mất nội dung khi chuyển bước) ----
  // Trước đây nội dung soạn chỉ sống trong state của editor, chỉ lưu khi
  // bấm nút "Lưu nháp": rời bước (sang tạo bài tập) là unmount -> mất hết
  // phần chưa lưu, quay lại chỉ thấy bản đã lưu cũ (mẫu tạo mới). Nay: gõ
  // xong 2s tự lưu 1 lần (chỉ khi nội dung đổi so với lần lưu trước), và
  // khi rời trình soạn thì đẩy nốt phần còn dở dang.
  const buildPayloadFromDraft = (d: typeof draftRef.current) => {
    return {
      id: theoryRef.current.id,
      title: d.title.trim(),
      topicId: d.topicId,
      kind: d.kind,
      minReadSeconds: d.minReadSeconds,
      contentHtml: d.contentHtml,
    };
  };

  const saveDraft = async (d: typeof draftRef.current, silent: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    if (!silent) setIsSaving(true);
    try {
      await onSave(buildPayloadFromDraft(d));
      savedJsonRef.current = JSON.stringify(d);
      if (!silent) {
        setSaveError(null);
        const now = new Date();
        setLastSavedTime(
          `${now.getHours().toString().padStart(2, '0')}:${now
            .getMinutes()
            .toString()
            .padStart(2, '0')}`
        );
      }
    } catch (err) {
      console.error('Lỗi khi lưu lý thuyết:', err);
      if (!silent) setSaveError('Lưu chưa được — kiểm tra mạng rồi bấm Lưu nháp lại.');
    } finally {
      savingRef.current = false;
      if (!silent) setIsSaving(false);
    }
  };

  // Lưu nháp (nút bấm)
  const handleSaveDraft = async () => {
    await saveDraft(draftRef.current, false);
  };

  // Đồng bộ ref theo state + hẹn tự lưu sau 2s không gõ nữa
  useEffect(() => {
    draftRef.current = { title, topicId, kind, minReadSeconds, contentHtml };
    const t = setTimeout(() => {
      if (JSON.stringify(draftRef.current) !== savedJsonRef.current) {
        void saveDraft(draftRef.current, true);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [title, topicId, kind, minReadSeconds, contentHtml]);

  // Rời trình soạn: đẩy nốt phần chưa lưu (im lặng, không setState sau unmount)
  useEffect(() => {
    return () => {
      if (JSON.stringify(draftRef.current) !== savedJsonRef.current) {
        void saveDraft(draftRef.current, true);
      }
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 max-w-full bg-[#FFFDF8] rounded-2xl md:rounded-l-none overflow-y-auto overflow-x-hidden shadow-xs">
      {!toolbarCollapsed && (
      <>
      {/* Top Header — dính chặt phía trên khi thân trình soạn cuộn */}
      <div className="sticky top-0 z-20 shrink-0 p-4 bg-[#FAF5EB] border-b border-[#E6DCC8] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] hover:border-[#2F3E6B] transition-colors shrink-0"
              title="Quay lại chủ đề"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại</span>
            </button>
          )}
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
            {saveError && (
              <p className="text-[10px] text-red-600 font-medium mt-0.5">{saveError}</p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPreviewStudent}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs"
            title="Xem trước như học sinh"
          >
            <Eye className="w-3.5 h-3.5 text-[#2F3E6B]" />
            <span>Xem trước</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:bg-black/5 text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs"
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
            title="Cập nhật lên web học sinh"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Cập nhật lên web</span>
          </button>
        </div>
      </div>
      </>
      )}

      {/* Main Content Area: Editor + Sidebar Table of Contents */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 flex flex-col lg:flex-row gap-6 min-w-0 max-w-full">
        {/* Left / Center: Main Form & Blocks */}
        <div className="flex-1 min-w-0 max-w-full space-y-6">
          {/* 1. Thông tin chung */}
          <div className="p-4 rounded-3xl bg-[#FAF5EB]/60 border border-[#E6DCC8] space-y-4">
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

          {/* 2. NỘI DUNG BÀI LÝ THUYẾT (trình soạn Word dùng chung) */}
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-bold text-[#2F3E6B] uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#4F46E5]" />
                <span>Nội dung bài lý thuyết</span>
              </h4>
              <p className="text-[11px] text-[#8C7E6A] mt-0.5">
                Soạn như Word: bôi đen chữ rồi dùng thanh công cụ để in đậm, in nghiêng, tạo tiêu đề, danh sách, chèn ảnh. Dán từ Word vẫn giữ định dạng.
              </p>
            </div>
            <RichTextEditor
              value={contentHtml}
              onChange={setContentHtml}
              placeholder="Soạn nội dung bài lý thuyết tại đây…"
              minHeight={320}
            />
          </div>

        </div>

        {/* Right Sidebar: Auto-generated Table of Contents & Info */}
        <div className="w-full lg:w-64 xl:w-72 shrink-0 space-y-4">
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
                Chưa có tiêu đề nào. Hãy dùng nút Tiêu đề lớn/nhỏ trên thanh công cụ để tạo mục lục.
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
                    • {item.text}
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
              Các bài lý thuyết Văn 7 nên kết hợp ít nhất 1 trích đoạn văn học thực tế và 1 đoạn ghi nhớ in đậm nổi bật để học sinh dễ liên hệ kiến thức khi làm bài tập cảm thụ.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
