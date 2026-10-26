import React from 'react';
import { CheckCircle2, Clock, FileEdit, Archive } from 'lucide-react';

export interface StatusBadgeProps {
  status: 'draft' | 'published' | 'archived';
  hasUnpublishedEdits?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  hasUnpublishedEdits = false,
  size = 'md',
}) => {
  const isSmall = size === 'sm';
  const sizeClasses = isSmall ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  const iconSize = isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5';

  if (hasUnpublishedEdits && status === 'published') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap bg-indigo-50 border border-indigo-200 text-[#4F46E5] shadow-2xs ${sizeClasses}`}
        title="Nội dung đã xuất bản nhưng đang có bản nháp chỉnh sửa mới chưa cập nhật lên web học sinh"
      >
        <FileEdit className={iconSize} />
        <span>Có sửa chưa đăng</span>
      </span>
    );
  }

  if (status === 'published') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-2xs ${sizeClasses}`}
      >
        <CheckCircle2 className={iconSize} />
        <span>Đã xuất bản</span>
      </span>
    );
  }

  if (status === 'archived') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap bg-slate-100 border border-slate-200 text-slate-600 shadow-2xs ${sizeClasses}`}
      >
        <Archive className={iconSize} />
        <span>Lưu trữ</span>
      </span>
    );
  }

  // Draft (Bản nháp)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap bg-amber-50 border border-amber-200 text-amber-700 shadow-2xs ${sizeClasses}`}
    >
      <Clock className={iconSize} />
      <span>Bản nháp</span>
    </span>
  );
};
