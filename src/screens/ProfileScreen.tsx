import React from 'react';
import { StudentState, ThemeId } from '../types.ts';
import { APP_NAME } from '../config.ts';
import { countLearningSteps } from '../logic/studentStateUtils.ts';
import { THEMES_LIST } from '../data/themes.ts';
import {
  User,
  Volume2,
  VolumeX,
  Sparkles,
  Type,
  RotateCcw,
  LogOut,
  CheckCircle2,
  BookOpen,
  Palette,
  Check,
  Flame,
  Award,
} from 'lucide-react';

interface ProfileScreenProps {
  state: StudentState;
  onUpdateState: (updater: (prev: StudentState) => StudentState) => void;
  onResetData: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  state,
  onUpdateState,
  onResetData,
  onLogout,
}) => {
  const currentTheme = state.themePreference || 'creative_edtech';

  const selectTheme = (themeId: ThemeId) => {
    onUpdateState((prev) => ({
      ...prev,
      themePreference: themeId,
    }));
  };

  const toggleSound = () => {
    onUpdateState((prev) => ({
      ...prev,
      soundEnabled: !prev.soundEnabled,
    }));
  };

  const toggleAnimations = () => {
    onUpdateState((prev) => ({
      ...prev,
      animationsEnabled: !prev.animationsEnabled,
    }));
  };

  const setFontSize = (size: 'normal' | 'large' | 'larger') => {
    onUpdateState((prev) => ({
      ...prev,
      fontSizePreference: size,
    }));
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4 sm:px-8 space-y-6 text-[#1E1B4B]">
      {/* HEADER */}
      <div className="border-b border-slate-100 pb-5">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] tracking-tight">
          Hồ sơ học tập
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Thông tin cá nhân và tùy chỉnh trải nghiệm học tập
        </p>
      </div>

      {/* THẺ THÔNG TIN HỌC SINH */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#4F46E5] to-[#8B5CF6] p-0.5 shadow-md shadow-indigo-500/20 shrink-0">
          <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center font-extrabold text-[#4F46E5] text-xl">
            {state.profile.name
              .split(' ')
              .map((n) => n[0])
              .slice(-2)
              .join('')}
          </div>
        </div>

        <div>
          <h3 className="font-extrabold text-xl text-[#1E1B4B]">
            {state.profile.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Mã học sinh: <strong className="text-[#1E1B4B]">{state.profile.username}</strong> · {state.profile.grade}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{state.profile.school}</p>
        </div>
      </div>

      {/* THỐNG KÊ HỌC TẬP TỔNG QUAN */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs text-center">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Tổng XP</span>
          <span className="text-xl sm:text-2xl font-black text-[#4F46E5] font-mono tabular-nums">
            {state.totalXp}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs text-center">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Chuyên cần</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono tabular-nums">
            {state.attendanceDaysThisWeek}/5
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs text-center">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Hoạt động</span>
          <span className="text-xl sm:text-2xl font-black text-[#8B5CF6] font-mono tabular-nums">
            {countLearningSteps(state.completedSteps)}
          </span>
        </div>
      </div>

      {/* CÀI ĐẶT TRẢI NGHIỆM */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-sm font-extrabold text-[#1E1B4B] uppercase tracking-wider">
          Tùy chỉnh giao diện & Âm thanh
        </h3>

        {/* 1. Âm thanh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center">
              {state.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E1B4B]">Hiệu ứng âm thanh</p>
              <p className="text-xs text-slate-400">Tiếng chúc mừng khi hoàn thành bài</p>
            </div>
          </div>

          <button
            onClick={toggleSound}
            className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 ${
              state.soundEnabled ? 'bg-[#4F46E5]' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-5.5 h-5.5 rounded-full bg-white transition-transform shadow-xs ${
                state.soundEnabled ? 'translate-x-5.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 2. Hiệu ứng động */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#8B5CF6] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E1B4B]">Hiệu ứng chuyển động (Animation)</p>
              <p className="text-xs text-slate-400">Hoạt ảnh tưới cây và Mầm Mực nhấp nháy</p>
            </div>
          </div>

          <button
            onClick={toggleAnimations}
            className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 ${
              state.animationsEnabled ? 'bg-[#4F46E5]' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-5.5 h-5.5 rounded-full bg-white transition-transform shadow-xs ${
                state.animationsEnabled ? 'translate-x-5.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 3. Cỡ chữ */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Type className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1E1B4B]">Cỡ chữ hiển thị</p>
                <p className="text-xs text-slate-400">Điều chỉnh độ lớn chữ đọc bài trên toàn hệ thống</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
              {[
                { key: 'normal' as const, label: 'Chuẩn', scale: '100%' },
                { key: 'large' as const, label: 'Lớn', scale: '112%' },
                { key: 'larger' as const, label: 'Rất lớn', scale: '125%' },
              ].map((s) => {
                const isActive = (state.fontSizePreference || 'normal') === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setFontSize(s.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-white text-[#4F46E5] shadow-xs'
                        : 'text-slate-600 hover:text-[#1E1B4B]'
                    }`}
                  >
                    <span>{s.label}</span>
                    <span className={`text-[10px] font-mono ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {s.scale}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        {/* 4. Giao diện (Theme) */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E1B4B]">Giao diện hiển thị</p>
              <p className="text-xs text-slate-400">Chọn bộ màu chủ đạo cho không gian học của em</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {THEMES_LIST.map((theme) => {
              const isActive = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => selectTheme(theme.id)}
                  className={`text-left p-3.5 rounded-2xl border transition-all ${
                    isActive
                      ? 'border-[#4F46E5] ring-2 ring-indigo-100 bg-indigo-50/40'
                      : 'border-slate-200 hover:border-indigo-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-extrabold text-[#1E1B4B]">{theme.name}</span>
                    {isActive && <Check className="w-4 h-4 text-[#4F46E5]" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2.5">{theme.subtitle}</p>
                  <div className="flex items-center gap-1.5">
                    {[
                      theme.palette.primaryTitle,
                      theme.palette.accentAction,
                      theme.palette.successSage,
                      theme.palette.backgroundPage,
                    ].map((color, i) => (
                      <span
                        key={i}
                        className="w-5 h-5 rounded-full border border-black/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

          {/* Hộp xem trước cỡ chữ trực quan */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
                Xem trước đoạn văn mẫu:
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-50 text-[#4F46E5]">
                {(state.fontSizePreference || 'normal') === 'larger'
                  ? 'Cỡ Rất lớn — Chống mỏi mắt khi đọc lâu'
                  : (state.fontSizePreference || 'normal') === 'large'
                  ? 'Cỡ Lớn — Dễ đọc, rõ nét'
                  : 'Cỡ Chuẩn — Mặc định ban đầu'}
              </span>
            </div>
            <p className="text-slate-800 leading-relaxed italic font-serif text-sm">
              "Tre xanh xanh tự bao giờ? Chuyện ngày xưa đã có bờ tre xanh. Thân gầy guộc, lá mong manh, mà sao nên lũy nên thành tre ơi..."
            </p>
          </div>
        </div>
      </div>

      {/* HÀNH ĐỘNG DỮ LIỆU & ĐĂNG XUẤT */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-3">
        <button
          onClick={onResetData}
          className="w-full py-3 rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <span>Đặt lại dữ liệu demo của tài khoản</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất khỏi ứng dụng</span>
        </button>
      </div>
    </div>
  );
};
