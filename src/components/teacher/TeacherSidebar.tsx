import React from 'react';
import {
  LayoutDashboard,
  Users2,
  BookOpenCheck,
  PenTool,
  Gift,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  GraduationCap,
  Sparkles,
  HelpCircle,
  ClipboardList,
} from 'lucide-react';
import { BrandWordmark } from '../MamVanLogo.tsx';

export type TeacherNavTab =
  | 'overview'
  | 'classes_students'
  | 'content'
  | 'question_bank'
  | 'grading'
  | 'progress'
  | 'rewards'
  | 'analytics'
  | 'settings';

interface TeacherSidebarProps {
  currentTab: TeacherNavTab;
  onTabChange: (tab: TeacherNavTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  onSwitchToStudentView: () => void;
  pendingGradingCount?: number;
  pendingRewardCount?: number;
}

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({
  currentTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  onLogout,
  onSwitchToStudentView,
  pendingGradingCount = 0,
  pendingRewardCount = 0,
}) => {
  const navItems = [
    {
      id: 'overview' as TeacherNavTab,
      label: 'Tổng quan',
      icon: LayoutDashboard,
    },
    {
      id: 'classes_students' as TeacherNavTab,
      label: 'Lớp & Học sinh',
      icon: Users2,
    },
    {
      id: 'content' as TeacherNavTab,
      label: 'Nội dung học',
      icon: BookOpenCheck,
    },
    {
      id: 'question_bank' as TeacherNavTab,
      label: 'Ngân hàng câu hỏi',
      icon: HelpCircle,
    },
    {
      id: 'grading' as TeacherNavTab,
      label: 'Chấm bài',
      icon: PenTool,
      badge: pendingGradingCount > 0 ? pendingGradingCount : undefined,
    },
    {
      id: 'progress' as TeacherNavTab,
      label: 'Tiến độ bài làm',
      icon: ClipboardList,
    },
    {
      id: 'rewards' as TeacherNavTab,
      label: 'Quà tặng',
      icon: Gift,
      badge: pendingRewardCount > 0 ? pendingRewardCount : undefined,
    },
    {
      id: 'analytics' as TeacherNavTab,
      label: 'Phân tích',
      icon: BarChart3,
    },
    {
      id: 'settings' as TeacherNavTab,
      label: 'Cài đặt',
      icon: Settings,
    },
  ];

  return (
    <aside
      className={`bg-[#FFFDF8] border-r border-[#E6DCC8] flex flex-col justify-between transition-all duration-200 z-30 shrink-0 select-none h-screen sticky top-0 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* PHẦN ĐẦU: LOGO & BRAND + MENU (CUỘN NỘI BỘ NẾU MÀN HÌNH NHỎ) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-[#E6DCC8]/70 flex items-center justify-between shrink-0">
          {!isCollapsed ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <BrandWordmark size="xs" showSlogan={false} />
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#E2704A]/10 text-[#E2704A] border border-[#E2704A]/20">
                  Giáo viên
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] mt-0.5 font-medium">
                Không gian quản lý & giảng dạy
              </p>
            </div>
          ) : (
            <div className="mx-auto w-9 h-9 rounded-xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center font-bold text-sm">
              MV
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#2F3E6B] hover:bg-[#FAF5EB] transition-colors shrink-0"
            title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* DANH SÁCH MENU ĐIỀU HƯỚNG */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all relative ${
                  isActive
                    ? 'bg-[#2F3E6B] text-white shadow-xs font-semibold'
                    : 'text-[#4B5563] hover:bg-[#FAF5EB] hover:text-[#2F3E6B]'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#6B7280]'}`} />

                {!isCollapsed && <span className="truncate">{item.label}</span>}

                {item.badge && (
                  <span
                    className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-[#E2704A] text-white'
                        : 'bg-[#E2704A]/15 text-[#E2704A]'
                    } ${isCollapsed ? 'absolute -top-1 -right-1 ring-2 ring-white' : ''}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* PHẦN ĐÁY: CHUYỂN GÓC HỌC SINH & ĐĂNG XUẤT (CỐ ĐỊNH Ở ĐÁY) */}
      <div className="p-3 border-t border-[#E6DCC8]/70 space-y-1 shrink-0 bg-[#FFFDF8]">
        {/* Nút xem thử góc học sinh */}
        <button
          onClick={onSwitchToStudentView}
          title={isCollapsed ? 'Xem giao diện Học sinh' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#2F3E6B] bg-[#FAF5EB] hover:bg-[#E6DCC8]/50 border border-[#E6DCC8] transition-colors ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#F2B84B] shrink-0" />
          {!isCollapsed && <span className="truncate">Xem góc Học sinh</span>}
        </button>

        {/* Nút đăng xuất */}
        <button
          onClick={onLogout}
          title={isCollapsed ? 'Đăng xuất' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#DC2626] hover:bg-rose-50 transition-colors ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
};
