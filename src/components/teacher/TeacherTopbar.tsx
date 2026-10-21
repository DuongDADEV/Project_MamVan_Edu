import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Search,
  ChevronDown,
  Layers,
  CheckCircle2,
  Clock,
  Gift,
  PenTool,
  LogOut,
  User,
  School,
} from 'lucide-react';
import { ClassItem, TeacherProfile } from '../../services/types.ts';

interface TeacherTopbarProps {
  teacher: TeacherProfile;
  classes: ClassItem[];
  selectedClassId: string;
  onSelectClassId: (classId: string) => void;
  pendingGradingCount: number;
  pendingRewardCount: number;
  onNavigateToGrading: () => void;
  onNavigateToRewards: () => void;
  onLogout: () => void;
}

export const TeacherTopbar: React.FC<TeacherTopbarProps> = ({
  teacher,
  classes,
  selectedClassId,
  onSelectClassId,
  pendingGradingCount,
  pendingRewardCount,
  onNavigateToGrading,
  onNavigateToRewards,
  onLogout,
}) => {
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const totalNotifications = pendingGradingCount + pendingRewardCount;

  const classRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (classRef.current && !classRef.current.contains(e.target as Node)) {
        setIsClassDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentClass = classes.find((c) => c.id === selectedClassId);

  return (
    <header className="h-16 bg-[#FFFDF8] border-b border-[#E6DCC8] px-4 sm:px-6 flex items-center justify-between gap-4 z-20 shrink-0">
      {/* KHỐI TRÁI: CHỌN LỚP ĐANG LÀM VIỆC */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={classRef}>
          <button
            type="button"
            onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E6DCC8] bg-[#FAF5EB] hover:bg-[#FAF5EB]/80 text-xs sm:text-sm font-semibold text-[#2F3E6B] transition-colors"
          >
            <Layers className="w-4 h-4 text-[#E2704A]" />
            <span>
              {selectedClassId === 'all'
                ? 'Tất cả các lớp'
                : currentClass
                ? `Lớp ${currentClass.name} (${currentClass.schoolYear})`
                : 'Chọn lớp học'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
          </button>

          {isClassDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-64 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl shadow-xl p-2 z-40 animate-[scaleUp_0.15s_ease]">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Chọn lớp làm việc:
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectClassId('all');
                  setIsClassDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-between ${
                  selectedClassId === 'all'
                    ? 'bg-[#2F3E6B] text-white font-semibold'
                    : 'text-[#2F3E6B] hover:bg-[#FAF5EB]'
                }`}
              >
                <span>Tất cả các lớp</span>
                {selectedClassId === 'all' && <CheckCircle2 className="w-4 h-4" />}
              </button>

              <div className="my-1 border-t border-[#E6DCC8]/60" />

              {classes.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => {
                    onSelectClassId(cls.id);
                    setIsClassDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-between ${
                    selectedClassId === cls.id
                      ? 'bg-[#2F3E6B] text-white font-semibold'
                      : 'text-[#2F3E6B] hover:bg-[#FAF5EB]'
                  }`}
                >
                  <div>
                    <span className="font-semibold">Lớp {cls.name}</span>
                    <span className="text-[11px] opacity-75 block">{cls.schoolYear} • {cls.studentCount} HS</span>
                  </div>
                  {selectedClassId === cls.id && <CheckCircle2 className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KHỐI PHẢI: CHUÔNG THÔNG BÁO & USER MENU */}
      <div className="flex items-center gap-3">
        {/* CHUÔNG THÔNG BÁO */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-xl border border-[#E6DCC8] bg-[#FAF5EB] hover:bg-[#FAF5EB]/80 text-[#2F3E6B] transition-colors"
            title="Thông báo cần xử lý"
            aria-label="Thông báo cần xử lý"
          >
            <Bell className="w-4 h-4" />
            {totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E2704A] text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {totalNotifications}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-80 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl shadow-xl p-3 z-40 animate-[scaleUp_0.15s_ease]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E6DCC8]/70">
                <span className="font-lora font-bold text-sm text-[#2F3E6B]">
                  Thông báo cần xử lý
                </span>
                <span className="text-[11px] text-[#6B7280]">
                  {totalNotifications} việc chờ
                </span>
              </div>

              {totalNotifications === 0 ? (
                <div className="py-6 text-center text-xs text-[#6B7280]">
                  <CheckCircle2 className="w-8 h-8 text-[#7FA88A] mx-auto mb-2 opacity-80" />
                  <span>Mọi việc đã xử lý xong, thầy/cô có thể thư giãn!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingGradingCount > 0 && (
                    <div
                      onClick={() => {
                        setIsNotifOpen(false);
                        onNavigateToGrading();
                      }}
                      className="p-2.5 rounded-xl bg-[#FAF5EB] hover:bg-[#FAF5EB]/80 border border-[#E6DCC8] cursor-pointer transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#E2704A]/15 text-[#E2704A] flex items-center justify-center shrink-0">
                        <PenTool className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-[#2F3E6B]">
                          {pendingGradingCount} bài viết chờ chấm
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          Bấm để xem danh sách bài nộp
                        </p>
                      </div>
                    </div>
                  )}

                  {pendingRewardCount > 0 && (
                    <div
                      onClick={() => {
                        setIsNotifOpen(false);
                        onNavigateToRewards();
                      }}
                      className="p-2.5 rounded-xl bg-[#FAF5EB] hover:bg-[#FAF5EB]/80 border border-[#E6DCC8] cursor-pointer transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#F2B84B]/20 text-[#8C5D00] flex items-center justify-center shrink-0">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-[#2F3E6B]">
                          {pendingRewardCount} yêu cầu nhận quà chờ duyệt
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          Bấm để duyệt rương phần thưởng
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* THÔNG TIN GIÁO VIÊN & AVATAR MENU */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2.5 p-1 sm:px-2 rounded-xl hover:bg-[#FAF5EB] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2F3E6B] to-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {teacher.name.charAt(teacher.name.lastIndexOf(' ') + 1) || 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-[#2F3E6B] leading-none">
                {teacher.name}
              </p>
              <p className="text-[10px] text-[#6B7280] leading-none mt-1">
                {teacher.subject} • {teacher.school}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] hidden sm:block" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-64 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl shadow-xl p-2 z-40 animate-[scaleUp_0.15s_ease]">
              <div className="p-3 bg-[#FAF5EB] rounded-xl border border-[#E6DCC8]/70 mb-2">
                <p className="font-semibold text-xs text-[#2F3E6B]">{teacher.name}</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5">{teacher.email || 'Chưa cập nhật email'}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#2E5E3D] bg-[#7FA88A]/15 px-2 py-0.5 rounded-full w-fit">
                  <School className="w-3 h-3" />
                  <span>{teacher.school}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#DC2626] hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất tài khoản</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
