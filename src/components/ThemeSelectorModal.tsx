import React, { useState, useEffect } from 'react';
import { ThemeId } from '../types.ts';
import { THEMES_LIST } from '../data/themes.ts';
import { Palette, Check, X, Sparkles } from 'lucide-react';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
}) => {
  // Chọn trước trong modal (bản nháp) — chỉ áp dụng thật khi bấm nút Áp dụng,
  // đóng bằng X là hủy lựa chọn
  const [draftTheme, setDraftTheme] = useState<ThemeId>(currentTheme);
  useEffect(() => {
    if (isOpen) setDraftTheme(currentTheme);
  }, [isOpen, currentTheme]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-100 rounded-3xl max-w-xl w-full p-6 shadow-2xl animate-[scaleIn_0.2s_ease] text-[#1E1B4B] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center font-bold">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-[#1E1B4B]">
                Chọn Phong Cách Giao Diện
              </h3>
              <p className="text-xs text-slate-500">
                Các phong cách màu sắc tinh tế cho không gian học Ngữ văn 7
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Danh sách 5 Theme Cards */}
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          {THEMES_LIST.map((th) => {
            const isSelected = draftTheme === th.id;

            return (
              <div
                key={th.id}
                onClick={() => setDraftTheme(th.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#4F46E5] bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-base text-[#1E1B4B]">
                        {th.name}
                      </h4>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        isSelected ? 'bg-indigo-100 text-[#4F46E5]' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {th.subtitle}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {th.description}
                    </p>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#4F46E5] border-[#4F46E5] text-white shadow-xs'
                        : 'border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>

                {/* Bảng mẫu màu (Color Palette Swatches) */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-400 font-medium mr-1">Bảng màu:</span>
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: th.palette.backgroundPage }}
                    title="Nền trang"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: th.palette.primaryTitle }}
                    title="Chữ tiêu đề"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: th.palette.accentAction }}
                    title="Nút hành động"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: th.palette.successSage }}
                    title="Điểm nhấn thành công"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 mt-4 flex justify-end">
          <button
            onClick={() => {
              onSelectTheme(draftTheme);
              onClose();
            }}
            className="px-6 py-2.5 rounded-2xl gradient-primary text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/25 hover:brightness-105 active:scale-[0.99] transition-all"
          >
            Áp dụng phong cách này
          </button>
        </div>
      </div>
    </div>
  );
};
