import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { EmptyState } from './EmptyState.tsx';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionText?: string;
  onEmptyAction?: () => void;
  // Selection
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  bulkActions?: (selectedIds: string[], clearSelection: () => void) => React.ReactNode;
  // Extra controls
  filterComponent?: React.ReactNode;
  headerActions?: React.ReactNode;
  initialSortKey?: string;
  initialSortDir?: 'asc' | 'desc';
  pageSize?: number;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  searchPlaceholder = 'Tìm kiếm nhanh...',
  searchFilter,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription = 'Không tìm thấy mục nào phù hợp.',
  emptyActionText,
  onEmptyAction,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  filterComponent,
  headerActions,
  initialSortKey,
  initialSortDir = 'asc',
  pageSize = 10,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);
  const [currentPage, setCurrentPage] = useState(1);

  // Lọc tìm kiếm
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();
    if (searchFilter) {
      return data.filter((item) => searchFilter(item, q));
    }
    return data.filter((item) => {
      return Object.values(item).some((val) =>
        String(val).toLowerCase().includes(q)
      );
    });
  }, [data, searchQuery, searchFilter]);

  // Sắp xếp
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      const res = valA > valB ? 1 : -1;
      return sortDir === 'asc' ? res : -res;
    });
  }, [filteredData, sortKey, sortDir]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize]);

  // Xử lý đổi sắp xếp
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(undefined);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Xử lý chọn nhiều
  const allPageIds = useMemo(
    () => paginatedData.map((d) => keyExtractor(d)),
    [paginatedData, keyExtractor]
  );

  const isAllPageSelected =
    allPageIds.length > 0 && allPageIds.every((id) => selectedIds.includes(id));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (isAllPageSelected) {
      // Bỏ chọn tất cả dòng ở trang hiện tại
      onSelectionChange(selectedIds.filter((id) => !allPageIds.includes(id)));
    } else {
      // Chọn tất cả dòng ở trang hiện tại
      const next = Array.from(new Set([...selectedIds, ...allPageIds]));
      onSelectionChange(next);
    }
  };

  const handleSelectRow = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const clearSelection = () => {
    if (onSelectionChange) onSelectionChange([]);
  };

  return (
    <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl shadow-xs overflow-hidden">
      {/* Thanh công cụ bảng: Tìm kiếm, Bộ lọc & Tác vụ hàng loạt */}
      <div className="p-4 sm:p-5 border-b border-[#E6DCC8]/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {selectedIds.length > 0 && bulkActions ? (
          <div className="flex-1 flex items-center justify-between bg-[#FAF5EB] p-2 sm:px-4 rounded-xl border border-[#E6DCC8] animate-[fadeIn_0.15s_ease]">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#2F3E6B]">
              <span className="w-6 h-6 rounded-full bg-[#2F3E6B] text-white flex items-center justify-center text-xs">
                {selectedIds.length}
              </span>
              <span>Đang chọn {selectedIds.length} học sinh</span>
            </div>
            <div className="flex items-center gap-2">
              {bulkActions(selectedIds, clearSelection)}
              <button
                onClick={clearSelection}
                className="text-xs text-[#6B7280] hover:text-[#2F3E6B] font-medium px-2 py-1 rounded"
              >
                Hủy chọn
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E6DCC8] bg-[#FAF5EB]/50 focus:bg-white focus:border-[#2F3E6B] focus:ring-2 focus:ring-[#2F3E6B]/10 outline-none text-xs sm:text-sm text-[#2F3E6B] placeholder-[#9CA3AF] transition-all"
              />
            </div>
            {filterComponent}
          </div>
        )}

        {headerActions && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {headerActions}
          </div>
        )}
      </div>

      {/* Bảng dữ liệu chính */}
      <div className="overflow-x-auto">
        {paginatedData.length === 0 ? (
          <div className="py-12">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              actionText={emptyActionText}
              onAction={onEmptyAction}
            />
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#FAF5EB]/70 border-b border-[#E6DCC8] text-[#2F3E6B] font-semibold">
                {selectable && (
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      onChange={handleSelectAll}
                      className="rounded border-[#E6DCC8] text-[#2F3E6B] focus:ring-[#2F3E6B] cursor-pointer"
                      aria-label="Chọn tất cả dòng"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`py-3.5 px-4 font-semibold tracking-wide ${
                      col.sortable ? 'cursor-pointer select-none hover:text-[#E2704A]' : ''
                    } ${col.className || ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-[#9CA3AF]">
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#2F3E6B]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[#2F3E6B]" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCC8]/60">
              {paginatedData.map((item, index) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    className={`transition-colors hover:bg-[#FAF5EB]/50 ${
                      isSelected ? 'bg-[#FAF5EB]/80' : ''
                    }`}
                  >
                    {selectable && (
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(id)}
                          className="rounded border-[#E6DCC8] text-[#2F3E6B] focus:ring-[#2F3E6B] cursor-pointer"
                          aria-label={`Chọn dòng ${id}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={`py-3.5 px-4 text-[#2F3E6B] ${col.className || ''}`}>
                        {col.render
                          ? col.render(item, (safePage - 1) * pageSize + index)
                          : item[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Phân trang */}
      {sortedData.length > 0 && (
        <div className="p-4 border-t border-[#E6DCC8]/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
          <div>
            Hiển thị{' '}
            <span className="font-semibold text-[#2F3E6B]">
              {Math.min(sortedData.length, (safePage - 1) * pageSize + 1)}-
              {Math.min(sortedData.length, safePage * pageSize)}
            </span>{' '}
            trong tổng số{' '}
            <span className="font-semibold text-[#2F3E6B]">{sortedData.length}</span> kết quả
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg border border-[#E6DCC8] text-[#2F3E6B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FAF5EB] transition-colors"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-semibold text-[#2F3E6B] bg-[#FAF5EB] rounded-lg border border-[#E6DCC8]">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg border border-[#E6DCC8] text-[#2F3E6B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FAF5EB] transition-colors"
              aria-label="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
