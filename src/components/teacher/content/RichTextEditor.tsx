// Trình soạn văn bản kiểu Word dùng chung (30/10/2026): 1 định dạng HTML cho
// cả nội dung lý thuyết chi tiết lẫn tóm tắt sau video — không chia khối nữa.
// Dùng contentEditable + execCommand (không thêm dependency): đủ định dạng
// cơ bản (B/I/U/gạch ngang, H2/H3/đoạn, list, căn lề, cỡ chữ, màu chữ, link,
// ảnh upload). Nội dung dán từ Word được sanitize trước khi chèn.

import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Image as ImageIcon,
} from 'lucide-react';
import { uploadLessonMedia } from '../../../services/api/storageClient.ts';
import { hasHtmlContent, normalizeEditorHtml, sanitizeHtml } from '../../../utils/richText.ts';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const FONT_SIZES = [
  { label: 'Cỡ chữ', value: '' },
  { label: 'Nhỏ', value: '2' },
  { label: 'Vừa', value: '3' },
  { label: 'Lớn', value: '4' },
  { label: 'Rất lớn', value: '5' },
];

const COLORS = [
  { name: 'Mặc định', value: '#1E1B4B' },
  { name: 'Đỏ', value: '#DC2626' },
  { name: 'Cam', value: '#EA580C' },
  { name: 'Xanh lá', value: '#16A34A' },
  { name: 'Xanh dương', value: '#2563EB' },
  { name: 'Tím', value: '#7C3AED' },
  { name: 'Nâu xám', value: '#8C7E6A' },
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  minHeight = 220,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [blockType, setBlockType] = useState('p');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Đồng bộ value từ ngoài vào (đổi bài) — không chạm khi đang gõ để khỏi
  // nhảy con trỏ.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== value) el.innerHTML = value || '';
  }, [value]);

  const refreshActive = () => {
    try {
      const fmt = (document.queryCommandValue('formatBlock') || 'p').toLowerCase();
      setBlockType(fmt === 'h2' || fmt === 'h3' ? fmt : 'p');
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
      });
    } catch {
      // queryCommand* có thể ném lỗi khi không có selection — bỏ qua.
    }
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    const range = savedRangeRef.current;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    if (sel && range) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const apply = (cmd: string, val?: string) => {
    restoreSelection();
    document.execCommand(cmd, false, val);
    const el = editorRef.current;
    if (el) onChange(el.innerHTML);
    refreshActive();
  };

  const handleInput = () => {
    const el = editorRef.current;
    if (el) onChange(el.innerHTML);
  };

  const handleBlur = () => {
    const el = editorRef.current;
    if (!el) return;
    const normalized = normalizeEditorHtml(el.innerHTML);
    if (normalized !== el.innerHTML) {
      el.innerHTML = normalized;
      onChange(normalized);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    restoreSelection();
    if (html) {
      document.execCommand('insertHTML', false, sanitizeHtml(html));
    } else if (text) {
      document.execCommand('insertText', false, text);
    }
    const el = editorRef.current;
    if (el) onChange(el.innerHTML);
  };

  const handleLink = () => {
    const url = window.prompt('Nhập đường link:');
    if (!url || !url.trim()) return;
    let href = url.trim();
    if (!/^https?:\/\//i.test(href) && !href.startsWith('mailto:')) href = `https://${href}`;
    apply('createLink', href);
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadLessonMedia(file, 'images');
      restoreSelection();
      document.execCommand('insertImage', false, url);
      const el = editorRef.current;
      if (el) onChange(el.innerHTML);
    } catch (err: any) {
      setUploadError(err?.message || 'Tải ảnh chưa được — thử lại nhé.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const btnCls = (isActive?: boolean) =>
    `w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-95 ${
      isActive
        ? 'bg-[#2F3E6B] text-white shadow-xs'
        : 'text-[#2F3E6B] hover:bg-white border border-transparent hover:border-[#E6DCC8]'
    }`;

  const isEmpty = !hasHtmlContent(value);

  return (
    <div className="rounded-2xl bg-white border border-[#E6DCC8] overflow-hidden shadow-2xs">
      {/* Thanh công cụ kiểu Word */}
      <div
        className="flex flex-wrap items-center gap-1 p-2 bg-[#FAF5EB] border-b border-[#E6DCC8]"
        onMouseDown={(e) => {
          // Giữ selection trong khung soạn khi bấm nút (trừ ô chọn file).
          if ((e.target as HTMLElement).closest('input,select')) return;
          e.preventDefault();
          saveSelection();
        }}
      >
        <button type="button" className={btnCls(active.bold)} title="In đậm" onClick={() => apply('bold')}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls(active.italic)} title="In nghiêng" onClick={() => apply('italic')}>
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls(active.underline)} title="Gạch chân" onClick={() => apply('underline')}>
          <Underline className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls(active.strikeThrough)} title="Gạch ngang" onClick={() => apply('strikeThrough')}>
          <Strikethrough className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-[#E6DCC8] mx-1 shrink-0" />
        <button type="button" className={btnCls(blockType === 'h2')} title="Tiêu đề lớn (H2)" onClick={() => apply('formatBlock', 'h2')}>
          <Heading2 className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls(blockType === 'h3')} title="Tiêu đề nhỏ (H3)" onClick={() => apply('formatBlock', 'h3')}>
          <Heading3 className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls(blockType === 'p')} title="Đoạn văn thường" onClick={() => apply('formatBlock', 'p')}>
          <Pilcrow className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-[#E6DCC8] mx-1 shrink-0" />
        <button type="button" className={btnCls(active.insertUnorderedList)} title="Danh sách dấu chấm" onClick={() => apply('insertUnorderedList')}>
          <List className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls(active.insertOrderedList)} title="Danh sách đánh số" onClick={() => apply('insertOrderedList')}>
          <ListOrdered className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-[#E6DCC8] mx-1 shrink-0" />
        <button type="button" className={btnCls(active.justifyLeft)} title="Căn trái" onClick={() => apply('justifyLeft')}>
          <AlignLeft className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls(active.justifyCenter)} title="Căn giữa" onClick={() => apply('justifyCenter')}>
          <AlignCenter className="w-4 h-4" />
        </button>
        <button type="button" className={btnCls(active.justifyRight)} title="Căn phải" onClick={() => apply('justifyRight')}>
          <AlignRight className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-[#E6DCC8] mx-1 shrink-0" />
        <select
          className="px-2 py-1.5 rounded-lg bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] outline-none shrink-0"
          defaultValue=""
          title="Cỡ chữ"
          onChange={(e) => {
            if (e.target.value) apply('fontSize', e.target.value);
            e.target.value = '';
          }}
        >
          {FONT_SIZES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="flex items-center gap-1 shrink-0" title="Màu chữ">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.name}
              className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
              style={{ backgroundColor: c.value }}
              onClick={() => apply('foreColor', c.value)}
            />
          ))}
        </span>
        <span className="w-px h-5 bg-[#E6DCC8] mx-1 shrink-0" />
        <button type="button" className={btnCls()} title="Chèn đường link" onClick={handleLink}>
          <Link2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={btnCls()}
          title="Chèn hình ảnh (tải lên)"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleImageFile(e.target.files?.[0])}
        />
        {uploading && <span className="text-[11px] text-[#8C7E6A] font-bold px-1">Đang tải ảnh…</span>}
      </div>

      {/* Khung soạn */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="rich-text-content p-4 outline-none text-sm text-[#1E1B4B] leading-relaxed min-w-0"
          style={{ minHeight }}
          onInput={handleInput}
          onBlur={handleBlur}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onPaste={handlePaste}
        />
        {isEmpty && placeholder && (
          <div className="absolute top-4 left-4 text-sm text-slate-400 pointer-events-none">{placeholder}</div>
        )}
      </div>
      {uploadError && (
        <div className="px-4 pb-3 text-[11px] font-bold text-red-600">{uploadError}</div>
      )}
    </div>
  );
};
