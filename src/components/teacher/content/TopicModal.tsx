import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Palette, Tag, AlignLeft, Sparkles } from 'lucide-react';
import { TopicWithMeta } from '../../../services/types.ts';

interface TopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (topicData: Partial<TopicWithMeta>) => Promise<void>;
  initialData?: TopicWithMeta | null;
}

// Đợt sửa 24/10: 2 màu nhạt nhất được tăng đậm lên (Xanh tre, Hổ phách) để
// thẻ chủ đề + viền nhìn rõ hơn; các màu còn lại vốn đã đậm nên giữ nguyên.
const COLOR_PRESETS = [
  { name: 'Xanh mực', value: '#2F3E6B' },
  { name: 'Xanh tre', value: '#4F7D5F' },
  { name: 'Cam đất', value: '#E2704A' },
  { name: 'Hổ phách', value: '#D99A26' },
  { name: 'Tím mận', value: '#7C3AED' },
  { name: 'Xanh ngọc', value: '#0D9488' },
];

export const TopicModal: React.FC<TopicModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [tag, setTag] = useState('');
  const [colorScheme, setColorScheme] = useState('#2F3E6B');
  const [xpReward, setXpReward] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setShortDesc(initialData.shortDesc || '');
      setTag(initialData.tag || '');
      setColorScheme(initialData.colorScheme || '#2F3E6B');
      setXpReward(initialData.xpReward ?? 0);
    } else {
      setTitle('');
      setShortDesc('');
      setTag('');
      setColorScheme('#2F3E6B');
      setXpReward(0);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tên chủ đề.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        id: initialData?.id,
        title: title.trim(),
        shortDesc: shortDesc.trim(),
        tag: tag.trim(),
        colorScheme,
        xpReward: Math.max(0, Math.floor(Number(xpReward) || 0)),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi lưu chủ đề.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1E1B4B]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-2xl overflow-hidden text-[#2F3E6B]">
        {/* Header */}
        <div className="px-6 py-5 bg-[#FAF5EB] border-b border-[#E6DCC8] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#2F3E6B] flex items-center justify-center shadow-xs">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-lora font-bold text-lg text-[#2F3E6B]">
                {initialData ? 'Chỉnh sửa chủ đề' : 'Thêm chủ đề mới'}
              </h3>
              <p className="text-xs text-[#8C7E6A]">Quản lý nhóm bài giảng và đề kiểm tra</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/5 text-[#8C7E6A] hover:text-[#2F3E6B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
              Tên chủ đề <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Thơ bốn chữ, năm chữ; Từ láy & So sánh..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] text-sm text-[#2F3E6B] placeholder-[#8C7E6A]/50 focus:outline-none focus:border-[#2F3E6B] transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#8C7E6A]" />
              <span>Thẻ phân loại (Tag ngắn)</span>
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="VD: Thơ ca, Tiếng Việt, Văn xuôi, Tập làm văn..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] text-sm text-[#2F3E6B] placeholder-[#8C7E6A]/50 focus:outline-none focus:border-[#2F3E6B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-[#8C7E6A]" />
              <span>Mô tả ngắn gọn mục tiêu học tập</span>
            </label>
            <textarea
              rows={3}
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="VD: Nhận diện đặc điểm thể thơ bốn chữ năm chữ, cách ngắt nhịp và phân tích hình ảnh..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] text-sm text-[#2F3E6B] placeholder-[#8C7E6A]/50 focus:outline-none focus:border-[#2F3E6B] transition-colors resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8C7E6A]" />
              <span>XP thưởng khi hoàn thành toàn bộ chủ đề</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                value={xpReward}
                onChange={(e) => setXpReward(Number(e.target.value))}
                className="w-32 px-3.5 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] text-sm font-bold text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B] transition-colors"
              />
              <span className="text-xs font-bold text-[#8C7E6A]">XP</span>
              <span className="text-[11px] text-[#8C7E6A] leading-snug">
                Học sinh nhận đủ số XP này (1 lần) khi xem hết 100% video, học xong lý thuyết và làm đúng hết bài tập của chủ đề. Để 0 = không thưởng.
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2F3E6B] mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#8C7E6A]" />
              <span>Màu sắc nhận diện chủ đề</span>
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  type="button"
                  key={color.value}
                  onClick={() => setColorScheme(color.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    colorScheme === color.value
                      ? 'border-[#2F3E6B] ring-2 ring-[#2F3E6B]/20 bg-white shadow-xs'
                      : 'border-[#E6DCC8] bg-[#FAF5EB] hover:bg-white text-[#8C7E6A]'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-2xs"
                    style={{ backgroundColor: color.value }}
                  />
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#E6DCC8] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-[#E6DCC8] hover:bg-black/5 text-[#8C7E6A] text-xs font-bold transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl bg-[#E2704A] hover:bg-[#D45E36] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2"
            >
              <span>{initialData ? 'Lưu thay đổi' : 'Tạo chủ đề'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
