import React, { useState } from 'react';
import { Home, BookOpen, Sprout, Gift, User, Flame, Clock, Palette, TrendingUp, Bell, PlayCircle, FileQuestion } from 'lucide-react';
import { APP_NAME, MASCOT_NAME } from '../config.ts';
import { StudentState } from '../types.ts';
import { THEMES_LIST } from '../data/themes.ts';
import { BrandHeaderLockup } from './MamVanLogo.tsx';
import {
  StudentNotification,
  formatRelativeTime,
} from '../logic/studentNotifications.ts';

export type NavTab = 'home' | 'learn' | 'tree' | 'results' | 'rewards' | 'profile';

interface NavbarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  state: StudentState;
  topicsCount?: number;
  onOpenDevPanel?: () => void;
  onOpenThemeSelector?: () => void;
  notifications?: StudentNotification[];
  unreadNotificationCount?: number;
  seenNotificationIds?: string[];
  onOpenNotification?: (n: StudentNotification) => void;
  onMarkAllNotificationsRead?: () => void;
}


/** Chuông thông báo bài mới của học sinh (dùng cho cả thanh trên di động và thanh bên) */
const NotificationBell: React.FC<{
  notifications: StudentNotification[];
  unreadCount: number;
  seenIds: string[];
  onOpen: (n: StudentNotification) => void;
  onMarkAllRead: () => void;
  align?: 'left' | 'right';
}> = ({ notifications, unreadCount, seenIds, onOpen, onMarkAllRead, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-indigo-50 hover:text-[#4F46E5] text-slate-500 transition-all hover:scale-105"
        title="Thông báo bài học mới"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute top-full mt-2 w-80 max-w-[86vw] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-xs font-extrabold text-[#1E1B4B]">Thông báo</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkAllRead();
                    setOpen(false);
                  }}
                  className="text-[11px] font-bold text-[#4F46E5] hover:underline"
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400">
                  Chưa có thông báo mới. Khi thầy/cô đăng bài mới, em sẽ thấy ở đây nhé!
                </p>
              ) : (
                notifications.map((n) => {
                  const unread = !seenIds.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onOpen(n);
                      }}
                      className={`w-full text-left px-4 py-3 flex gap-3 border-b border-slate-50 transition-colors hover:bg-indigo-50/50 ${
                        unread ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          n.kind === 'video'
                            ? 'bg-rose-50 text-rose-500'
                            : n.kind === 'theory'
                              ? 'bg-violet-50 text-violet-500'
                              : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {n.kind === 'video' ? (
                          <PlayCircle className="w-4 h-4" />
                        ) : n.kind === 'theory' ? (
                          <BookOpen className="w-4 h-4" />
                        ) : (
                          <FileQuestion className="w-4 h-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-[#E2704A] uppercase tracking-wide">
                            {n.kindLabel}
                          </span>
                          {unread && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
                        </span>
                        <span className="block text-xs font-bold text-[#1E1B4B] truncate">{n.title}</span>
                        <span className="block text-[11px] text-slate-400 truncate">
                          {n.topicTitle ? `${n.topicTitle} · ` : ''}
                          {formatRelativeTime(n.publishedAt)}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  state,
  topicsCount,
  onOpenThemeSelector,
  notifications = [],
  unreadNotificationCount = 0,
  seenNotificationIds = [],
  onOpenNotification,
  onMarkAllNotificationsRead,
}) => {
  const navItems = [
    { key: 'home' as NavTab, label: 'Trang chủ', icon: Home, badge: null },
    {
      key: 'learn' as NavTab,
      label: 'Học bài',
      icon: BookOpen,
      badge: topicsCount !== undefined ? (topicsCount > 0 ? `${topicsCount} chủ đề` : null) : null,
    },
    { key: 'tree' as NavTab, label: 'Cây tri thức', icon: Sprout, badge: null },
    { key: 'results' as NavTab, label: 'Kết quả học tập', icon: TrendingUp, badge: null },
    { key: 'rewards' as NavTab, label: 'Đổi quà', icon: Gift, badge: 'Mới' },
    { key: 'profile' as NavTab, label: 'Hồ sơ', icon: User, badge: null },
  ];

  const activeMinutes = Math.floor(state.activeSecondsToday / 60);
  const currentThemeInfo =
    THEMES_LIST.find((t) => t.id === state.themePreference) || THEMES_LIST[0];

  return (
    <>
      {/* ================= MOBILE TOP HEADER ================= */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <BrandHeaderLockup size="sm" showSlogan={false} />
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F6F1E8] text-[#2F6B4F] border border-[#E8D8BE]">
            Lớp 7
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenNotification && (
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadNotificationCount}
              seenIds={seenNotificationIds}
              onOpen={onOpenNotification}
              onMarkAllRead={onMarkAllNotificationsRead || (() => {})}
            />
          )}
          {onOpenThemeSelector && (
            <button
              type="button"
              onClick={onOpenThemeSelector}
              className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
              title="Đổi giao diện"
            >
              <Palette className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-100/90 h-screen sticky top-0 shrink-0 p-5 lg:p-6 justify-between select-none shadow-[2px_0_16px_-4px_rgba(79,70,229,0.03)] z-30">
        {/* Brand & Menu */}
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <div className="flex items-center text-left">
              <BrandHeaderLockup
                size="md"
                showSlogan={true}
                sloganText="Ngữ văn lớp 7"
              />
            </div>

            {/* Action buttons (Theme switcher) */}
            <div className="flex items-center gap-1.5">
              {onOpenNotification && (
                <NotificationBell
                  notifications={notifications}
                  unreadCount={unreadNotificationCount}
                  seenIds={seenNotificationIds}
                  onOpen={onOpenNotification}
                  onMarkAllRead={onMarkAllNotificationsRead || (() => {})}
                  align="left"
                />
              )}
              {onOpenThemeSelector && (
                <button
                  type="button"
                  onClick={onOpenThemeSelector}
                  className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-indigo-50 hover:text-[#4F46E5] text-slate-500 transition-all hover:scale-105"
                  title={`Đổi phong cách màu (Đang dùng: ${currentThemeInfo.name})`}
                >
                  <Palette className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2" aria-label="Điều hướng chính">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.key;

              return (
                <button
                  key={item.key}
                  onClick={(e) => { onTabChange(item.key); e.currentTarget.blur(); }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all group focus:outline-none focus:ring-0 outline-none select-none ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-[#4F46E5] border border-indigo-200/60 shadow-xs'
                      : 'text-slate-600 hover:text-[#1E1B4B] hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-gradient-to-tr from-[#4F46E5] to-[#8B5CF6] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-[#4F46E5]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#8B5CF6]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Stats & Profile Card */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          {/* Card Thời gian & XP ngày */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 border border-indigo-100/70 text-xs space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[#1E1B4B]">
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <Clock className="w-3.5 h-3.5 text-[#4F46E5]" />
                Học tích cực:
              </span>
              <span className="font-mono font-bold text-[#1E1B4B] bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                {activeMinutes} phút
              </span>
            </div>

            <div className="flex items-center justify-between text-[#1E1B4B]">
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
                Tổng XP tích lũy:
              </span>
              <span className="font-mono font-bold text-[#4F46E5] bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                {state.totalXp} XP
              </span>
            </div>

            <div className="text-right text-[10px] font-medium text-slate-400">
              Hôm nay +{state.xpToday} XP
            </div>
          </div>

          {/* Student Profile Pill */}
          <button
            onClick={(e) => { onTabChange('profile'); e.currentTarget.blur(); }}
            className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-[#22D3EE] p-0.5 shadow-xs shrink-0">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center font-bold text-[#4F46E5] text-xs">
                {state.profile.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(-2)
                  .join('')}
              </div>
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-bold text-[#1E1B4B] group-hover:text-[#4F46E5] transition-colors truncate">
                {state.profile.name}
              </p>
              <p className="text-[11px] font-medium text-slate-500">{state.profile.grade}</p>
            </div>
          </button>
        </div>
      </aside>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      <nav
        aria-label="Thanh điều hướng di động"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 px-3 py-2 flex items-center justify-around shadow-lg shadow-indigo-950/5"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.key;

          return (
            <button
              key={item.key}
              onClick={(e) => { onTabChange(item.key); e.currentTarget.blur(); }}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-2xl transition-all focus:outline-none focus:ring-0 outline-none select-none ${
                isActive ? 'text-[#4F46E5]' : 'text-slate-500 hover:text-[#1E1B4B]'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-[#4F46E5] scale-110 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span
                className={`text-[10px] leading-tight mt-0.5 ${
                  isActive ? 'font-bold text-[#4F46E5]' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
