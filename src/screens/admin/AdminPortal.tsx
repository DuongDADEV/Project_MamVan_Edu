import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Lock,
  Unlock,
  Trash2,
  Edit2,
  Shield,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  School,
  BookOpen,
  LogOut,
  Sparkles,
  RefreshCw,
  X,
  KeyRound,
  GraduationCap,
  Calendar,
  AlertCircle,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { BrandWordmark } from '../../components/MamVanLogo.tsx';
import { AdminAiSettings } from '../../components/admin/AdminAiSettings.tsx';
import {
  teacherService,
  classService,
  useLiveQuery,
  TeacherProfile,
  AdminProfile,
  ClassItem,
  CreateTeacherInput,
} from '../../services/index.ts';

interface AdminPortalProps {
  admin: AdminProfile;
  onLogout: () => void;
  onImpersonateTeacher: (teacher: TeacherProfile) => void;
  onSwitchToStudentView?: () => void;
}

type TeacherFilterTab = 'all' | 'active' | 'trial' | 'locked';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  admin,
  onLogout,
  onImpersonateTeacher,
  onSwitchToStudentView,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<TeacherFilterTab>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<TeacherProfile | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live query nạp danh sách giáo viên và lớp học
  const {
    data: queryData,
    loading: isLoading,
    refresh: refreshData,
  } = useLiveQuery(
    async () => {
      const [teachers, classes] = await Promise.all([
        teacherService.getTeachers(),
        classService.getClasses(),
      ]);
      return {
        teachers: teachers || [],
        classes: classes || [],
      };
    },
    ['teacher', 'class'],
    []
  );

  const teachers = queryData?.teachers || [];
  const classes = queryData?.classes || [];

  // Tạo map đếm số lớp cho từng giáo viên
  const classCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    classes.forEach((c) => {
      if (c.teacherId) {
        map[c.teacherId] = (map[c.teacherId] || 0) + 1;
      }
    });
    return map;
  }, [classes]);

  // Thống kê số liệu
  const stats = useMemo(() => {
    const total = teachers.length;
    const active = teachers.filter((t) => t.status === 'active' || !t.status).length;
    const trial = teachers.filter((t) => t.status === 'trial').length;
    const locked = teachers.filter((t) => t.status === 'locked').length;
    return { total, active, trial, locked };
  }, [teachers]);

  // Lọc danh sách giáo viên
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      // Lọc theo tab
      if (filterTab === 'active' && t.status !== 'active' && t.status) return false;
      if (filterTab === 'trial' && t.status !== 'trial') return false;
      if (filterTab === 'locked' && t.status !== 'locked') return false;

      // Tìm kiếm từ khóa
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        t.name.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.phone && t.phone.toLowerCase().includes(q)) ||
        (t.school && t.school.toLowerCase().includes(q)) ||
        (t.subject && t.subject.toLowerCase().includes(q))
      );
    });
  }, [teachers, filterTab, searchTerm]);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  // 1. Khóa / Mở khóa tài khoản
  const handleToggleLock = async (teacher: TeacherProfile) => {
    try {
      setIsSubmitting(true);
      const isLockedCurrently = teacher.status === 'locked';
      await teacherService.toggleLockTeacher(teacher.id, !isLockedCurrently);
      showNotification(
        isLockedCurrently
          ? `Đã mở khóa tài khoản cho giáo viên ${teacher.name}`
          : `Đã khóa tài khoản của giáo viên ${teacher.name}`
      );
      refreshData();
    } catch (err: any) {
      alert('Lỗi thao tác: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Xóa tài khoản
  const handleConfirmDelete = async () => {
    if (!deletingTeacher) return;
    try {
      setIsSubmitting(true);
      await teacherService.deleteTeacher(deletingTeacher.id);
      showNotification(`Đã xóa vĩnh viễn tài khoản của giáo viên ${deletingTeacher.name}`);
      setDeletingTeacher(null);
      refreshData();
    } catch (err: any) {
      alert('Lỗi xóa giáo viên: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#1F2937] flex flex-col font-sans select-none">
      {/* ======================================================== */}
      {/* 1. TOPBAR ADMIN (THEME GIÁO VIÊN ĐỒNG BỘ)                  */}
      {/* ======================================================== */}
      <header className="h-16 bg-[#FFFDF8] border-b border-[#E6DCC8] px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3">
          <BrandWordmark size="xs" showSlogan={false} />
          <div className="h-5 w-px bg-[#E6DCC8]" />
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-[#8B5CF6]/10 text-[#7C3AED] border border-[#8B5CF6]/25">
            <Shield className="w-3.5 h-3.5" />
            <span>Quản Trị Viên (Admin)</span>
          </span>
        </div>

        {/* Nút hành động phải: Xem học sinh + Đăng xuất */}
        <div className="flex items-center gap-3">
          {onSwitchToStudentView && (
            <button
              onClick={onSwitchToStudentView}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#2F3E6B] bg-[#FAF5EB] hover:bg-[#E6DCC8]/50 border border-[#E6DCC8] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F2B84B]" />
              <span>Xem góc Học sinh</span>
            </button>
          )}

          <div className="flex items-center gap-2 pl-3 border-l border-[#E6DCC8]">
            <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              AD
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-[#1F2937] leading-none">
                {admin.name || 'Quản trị viên'}
              </span>
              <span className="text-[10px] text-[#6B7280] mt-0.5 font-mono">
                {admin.username || 'admin'}
              </span>
            </div>

            <button
              onClick={onLogout}
              title="Đăng xuất khỏi Cổng Admin"
              className="p-2 ml-1 text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEE2E2]/50 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* THÔNG BÁO TOAST NỔI GÓC DƯỚI                              */}
      {/* ======================================================== */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F2937] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-medium border border-white/10 animate-[fadeIn_0.2s_ease]">
          <CheckCircle2 className="w-5 h-5 text-[#34D399] shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. NỘI DUNG CHÍNH (QUẢN LÝ TÀI KHOẢN GIÁO VIÊN)           */}
      {/* ======================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* TIÊU ĐỀ KHU VỰC & NÚT TẠO MỚI */}
        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#7C3AED] uppercase tracking-wider mb-1.5">
              <Users className="w-4 h-4" />
              <span>Phân Hệ Quản Trị Người Dùng</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2937]">
              Quản Lý Tài Khoản Giáo Viên
            </h1>
            <p className="text-sm text-[#4B5563] mt-1 max-w-2xl leading-relaxed">
              Cấp tài khoản dùng thử, quản lý thông tin trường lớp, khóa/kích hoạt và đăng nhập dưới quyền giáo viên để kiểm tra hỗ trợ kỹ thuật.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => refreshData()}
              disabled={isLoading}
              title="Tải lại danh sách"
              className="p-3 rounded-2xl border border-[#E6DCC8] bg-[#FAF5EB] hover:bg-[#E6DCC8]/40 text-[#4B5563] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#7C3AED]' : ''}`} />
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-[#2F3E6B] hover:bg-[#233054] text-white font-bold text-sm shadow-md shadow-[#2F3E6B]/15 hover:shadow-lg transition-all flex items-center gap-2.5 active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4 text-[#F2B84B]" />
              <span>Cấp Tài Khoản Giáo Viên</span>
            </button>
          </div>
        </div>

        {/* 4 THẺ THỐNG KÊ (CARDS) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tổng giáo viên */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280]">Tổng số giáo viên</p>
              <p className="text-2xl font-black text-[#1F2937] mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Đang hoạt động */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280]">Đang hoạt động</p>
              <p className="text-2xl font-black text-[#059669] mt-1">{stats.active}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#10B981]/10 text-[#059669] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* Dùng thử */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280]">Dùng thử (Trial)</p>
              <p className="text-2xl font-black text-[#D97706] mt-1">{stats.trial}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/10 text-[#D97706] flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Bị khóa */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280]">Tài khoản bị khóa</p>
              <p className="text-2xl font-black text-[#DC2626] mt-1">{stats.locked}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/10 text-[#DC2626] flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* CẤU HÌNH MẦM AI (chỉ admin) */}
        <AdminAiSettings />

        {/* BẢNG QUẢN LÝ GIÁO VIÊN */}
        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-xs overflow-hidden">
          {/* THANH TÌM KIẾM & TAB LỌC */}
          <div className="p-4 sm:p-6 border-b border-[#E6DCC8] flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Tab lọc */}
            <div className="flex items-center gap-1.5 p-1 bg-[#FAF5EB] rounded-2xl border border-[#E6DCC8] overflow-x-auto">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'all'
                    ? 'bg-[#2F3E6B] text-white shadow-xs'
                    : 'text-[#4B5563] hover:text-[#1F2937]'
                }`}
              >
                Tất cả ({stats.total})
              </button>
              <button
                onClick={() => setFilterTab('active')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'active'
                    ? 'bg-[#059669] text-white shadow-xs'
                    : 'text-[#4B5563] hover:text-[#059669]'
                }`}
              >
                Hoạt động ({stats.active})
              </button>
              <button
                onClick={() => setFilterTab('trial')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'trial'
                    ? 'bg-[#D97706] text-white shadow-xs'
                    : 'text-[#4B5563] hover:text-[#D97706]'
                }`}
              >
                Dùng thử ({stats.trial})
              </button>
              <button
                onClick={() => setFilterTab('locked')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'locked'
                    ? 'bg-[#DC2626] text-white shadow-xs'
                    : 'text-[#4B5563] hover:text-[#DC2626]'
                }`}
              >
                Bị khóa ({stats.locked})
              </button>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên, username, SĐT, trường..."
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] focus:ring-2 focus:ring-[#2F3E6B]/10 outline-none transition-all placeholder:text-[#9CA3AF]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1F2937]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* DANH SÁCH BẢNG */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#FAF5EB]/70 border-b border-[#E6DCC8] text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-3.5 px-6">Giáo viên & Tài khoản</th>
                  <th className="py-3.5 px-4">Thông tin liên hệ</th>
                  <th className="py-3.5 px-4">Trường & Bộ môn</th>
                  <th className="py-3.5 px-4 text-center">Lớp dạy</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DCC8]/60">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#6B7280]">
                      <Users className="w-10 h-10 mx-auto text-[#D1D5DB] mb-3" />
                      <p className="font-semibold text-base text-[#374151]">
                        Không tìm thấy giáo viên nào
                      </p>
                      <p className="text-xs text-[#9CA3AF] mt-1">
                        {searchTerm
                          ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc'
                          : 'Bấm nút "Cấp Tài Khoản Giáo Viên" ở trên để thêm mới'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((teacher) => {
                    const isLocked = teacher.status === 'locked';
                    const isTrial = teacher.status === 'trial';
                    const classCount = classCountMap[teacher.id] || 0;

                    return (
                      <tr
                        key={teacher.id}
                        className={`hover:bg-[#FAF5EB]/50 transition-colors ${
                          isLocked ? 'bg-red-50/20' : ''
                        }`}
                      >
                        {/* 1. Tên & username */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                isLocked
                                  ? 'bg-red-100 text-red-600 border border-red-200'
                                  : isTrial
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-[#2F3E6B]/10 text-[#2F3E6B] border border-[#2F3E6B]/20'
                              }`}
                            >
                              {teacher.name.charAt(0) || 'G'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#1F2937] hover:underline cursor-pointer" onClick={() => setEditingTeacher(teacher)}>
                                  {teacher.name}
                                </span>
                                {teacher.username === 'gv001' && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                                    Mẫu gốc
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#FAF5EB] text-[#4B5563] border border-[#E6DCC8]">
                                  {teacher.username}
                                </span>
                                {teacher.notes && (
                                  <span className="text-[11px] text-[#6B7280] italic truncate max-w-[200px]" title={teacher.notes}>
                                    • {teacher.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Liên hệ */}
                        <td className="py-4 px-4">
                          <div className="space-y-1 text-xs">
                            {teacher.phone ? (
                              <div className="flex items-center gap-1.5 text-[#374151]">
                                <Phone className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                <span>{teacher.phone}</span>
                              </div>
                            ) : (
                              <span className="text-[#9CA3AF] italic text-[11px]">Chưa có SĐT</span>
                            )}
                            {teacher.email ? (
                              <div className="flex items-center gap-1.5 text-[#4B5563]">
                                <Mail className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                <span className="truncate max-w-[180px]">{teacher.email}</span>
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* 3. Trường & môn */}
                        <td className="py-4 px-4">
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-1.5 font-medium text-[#1F2937]">
                              <School className="w-3.5 h-3.5 text-[#9CA3AF]" />
                              <span>{teacher.school || 'THCS Giấy & Mực'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[#4B5563]">
                              <BookOpen className="w-3.5 h-3.5 text-[#9CA3AF]" />
                              <span>{teacher.subject || 'Ngữ văn 7'}</span>
                            </div>
                          </div>
                        </td>

                        {/* 4. Số lớp */}
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center font-bold px-2.5 py-1 rounded-full text-xs bg-[#FAF5EB] text-[#2F3E6B] border border-[#E6DCC8]">
                            {classCount} lớp
                          </span>
                        </td>

                        {/* 5. Trạng thái */}
                        <td className="py-4 px-4">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                              <Lock className="w-3 h-3" />
                              <span>Đã khóa</span>
                            </span>
                          ) : isTrial ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Dùng thử</span>
                              </span>
                              {teacher.trialExpiresAt && (
                                <p className="text-[10px] text-[#6B7280] font-mono">
                                  Hết: {new Date(teacher.trialExpiresAt).toLocaleDateString('vi-VN')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Hoạt động</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Thao tác */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút Impersonate - Đăng nhập dưới quyền GV */}
                            <button
                              onClick={() => onImpersonateTeacher(teacher)}
                              title="Truy cập với tư cách Giáo viên này"
                              className="px-2.5 py-1.5 rounded-xl bg-[#2F3E6B]/10 hover:bg-[#2F3E6B] text-[#2F3E6B] hover:text-white font-semibold text-xs transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Vào xem</span>
                            </button>

                            {/* Nút Sửa */}
                            <button
                              onClick={() => setEditingTeacher(teacher)}
                              title="Chỉnh sửa thông tin"
                              className="p-1.5 rounded-xl text-[#4B5563] hover:text-[#2F3E6B] hover:bg-[#FAF5EB] border border-transparent hover:border-[#E6DCC8] transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Nút Khóa / Mở khóa */}
                            <button
                              onClick={() => handleToggleLock(teacher)}
                              disabled={isSubmitting}
                              title={isLocked ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản'}
                              className={`p-1.5 rounded-xl transition-colors border ${
                                isLocked
                                  ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                                  : 'text-amber-600 hover:bg-amber-50 border-transparent hover:border-amber-200'
                              }`}
                            >
                              {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>

                            {/* Nút Xóa (bảo vệ gv001) */}
                            {teacher.username !== 'gv001' && (
                              <button
                                onClick={() => setDeletingTeacher(teacher)}
                                title="Xóa tài khoản giáo viên"
                                className="p-1.5 rounded-xl text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ======================================================== */}
      {/* 3. MODAL CẤP TÀI KHOẢN GIÁO VIÊN MỚI                     */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <CreateTeacherModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(newTeacher) => {
            setIsCreateModalOpen(false);
            showNotification(`Đã cấp thành công tài khoản cho giáo viên ${newTeacher.name} (${newTeacher.username})`);
            refreshData();
          }}
        />
      )}

      {/* ======================================================== */}
      {/* 4. MODAL CHỈNH SỬA TÀI KHOẢN GIÁO VIÊN                    */}
      {/* ======================================================== */}
      {editingTeacher && (
        <EditTeacherModal
          teacher={editingTeacher}
          onClose={() => setEditingTeacher(null)}
          onSuccess={(updated) => {
            setEditingTeacher(null);
            showNotification(`Đã cập nhật thông tin giáo viên ${updated.name}`);
            refreshData();
          }}
        />
      )}

      {/* ======================================================== */}
      {/* 5. MODAL XÁC NHẬN XÓA                                     */}
      {/* ======================================================== */}
      {deletingTeacher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 max-w-md w-full shadow-2xl animate-[fadeIn_0.2s_ease]">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-extrabold text-[#1F2937]">
              Xác nhận xóa tài khoản giáo viên?
            </h3>
            <p className="text-sm text-[#4B5563] mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản của thầy/cô{' '}
              <strong className="text-[#1F2937]">{deletingTeacher.name}</strong> (
              <span className="font-mono text-xs font-semibold">{deletingTeacher.username}</span>)?
              Hành động này không thể hoàn tác.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setDeletingTeacher(null)}
                className="px-4 py-2.5 rounded-xl border border-[#E6DCC8] bg-[#FAF5EB] hover:bg-[#E6DCC8]/40 text-sm font-bold text-[#4B5563] transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-600/20 transition-colors flex items-center gap-2"
              >
                {isSubmitting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// MODAL CẤP TÀI KHOẢN MỚI
// ==============================================================================
interface CreateTeacherModalProps {
  onClose: () => void;
  onSuccess: (teacher: TeacherProfile) => void;
}

const CreateTeacherModal: React.FC<CreateTeacherModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123456');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [school, setSchool] = useState('THCS Giấy & Mực');
  const [subject, setSubject] = useState('Ngữ văn 7');
  const [accountType, setAccountType] = useState<'trial_3' | 'trial_7' | 'active'>('trial_3');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên của giáo viên');
      return;
    }

    setIsSubmitting(true);
    try {
      const isTrial = accountType.startsWith('trial');
      const trialDays = accountType === 'trial_7' ? 7 : 3;

      const created = await teacherService.createTeacher({
        name: name.trim(),
        username: username.trim() || undefined,
        password: password.trim() || '123456',
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        school: school.trim() || 'THCS Giấy & Mực',
        subject: subject.trim() || 'Ngữ văn 7',
        status: isTrial ? 'trial' : 'active',
        trialDays: isTrial ? trialDays : undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess(created);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tạo tài khoản giáo viên');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-[fadeIn_0.2s_ease] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[#E6DCC8]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#1F2937]">Cấp Tài Khoản Giáo Viên</h3>
              <p className="text-xs text-[#6B7280]">Khởi tạo tài khoản dùng thử hoặc chính thức</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#9CA3AF] hover:text-[#1F2937] hover:bg-[#FAF5EB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Họ tên */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1">
              Họ và tên giáo viên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Thầy Trần Quang Vinh"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] focus:ring-2 focus:ring-[#2F3E6B]/10 outline-none"
            />
          </div>

          {/* Tên đăng nhập & Mật khẩu */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Tên đăng nhập <span className="text-[#9CA3AF] font-normal">(để trống tự sinh)</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="vd: gv_vinh"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Mật khẩu khởi tạo
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="123456"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none font-mono text-xs"
              />
            </div>
          </div>

          {/* SĐT & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912 345 678"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.edu.vn"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
              />
            </div>
          </div>

          {/* Trường & Môn */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Trường học
              </label>
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="THCS Giấy & Mực"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Bộ môn
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ngữ văn 7"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
              />
            </div>
          </div>

          {/* Loại tài khoản */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1.5">
              Thời hạn kích hoạt
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('trial_3')}
                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                  accountType === 'trial_3'
                    ? 'border-[#D97706] bg-amber-50 text-[#D97706]'
                    : 'border-[#E6DCC8] bg-[#FAF5EB] text-[#4B5563]'
                }`}
              >
                Dùng thử 3 ngày
              </button>
              <button
                type="button"
                onClick={() => setAccountType('trial_7')}
                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                  accountType === 'trial_7'
                    ? 'border-[#D97706] bg-amber-50 text-[#D97706]'
                    : 'border-[#E6DCC8] bg-[#FAF5EB] text-[#4B5563]'
                }`}
              >
                Dùng thử 7 ngày
              </button>
              <button
                type="button"
                onClick={() => setAccountType('active')}
                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                  accountType === 'active'
                    ? 'border-[#059669] bg-emerald-50 text-[#059669]'
                    : 'border-[#E6DCC8] bg-[#FAF5EB] text-[#4B5563]'
                }`}
              >
                Chính thức
              </button>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1">
              Ghi chú nội bộ
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Cô đăng ký form dùng thử từ Zalo..."
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
            />
          </div>

          {/* Nút hành động */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6DCC8]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E6DCC8] bg-[#FAF5EB] hover:bg-[#E6DCC8]/40 text-xs font-bold text-[#4B5563]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#2F3E6B] hover:bg-[#233054] text-white text-xs font-bold shadow-md shadow-[#2F3E6B]/20 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? 'Đang cấp...' : 'Xác nhận cấp tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// MODAL CHỈNH SỬA TÀI KHOẢN GIÁO VIÊN
// ==============================================================================
interface EditTeacherModalProps {
  teacher: TeacherProfile;
  onClose: () => void;
  onSuccess: (updated: TeacherProfile) => void;
}

const EditTeacherModal: React.FC<EditTeacherModalProps> = ({ teacher, onClose, onSuccess }) => {
  const [name, setName] = useState(teacher.name);
  const [newPassword, setNewPassword] = useState('');
  const [phone, setPhone] = useState(teacher.phone || '');
  const [email, setEmail] = useState(teacher.email || '');
  const [school, setSchool] = useState(teacher.school || 'THCS Giấy & Mực');
  const [subject, setSubject] = useState(teacher.subject || 'Ngữ văn 7');
  const [status, setStatus] = useState<'active' | 'trial' | 'locked'>(teacher.status || 'active');
  const [notes, setNotes] = useState(teacher.notes || '');
  const [extendDays, setExtendDays] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Họ và tên không được để trống');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<TeacherProfile> = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        school: school.trim() || 'THCS Giấy & Mực',
        subject: subject.trim() || 'Ngữ văn 7',
        status,
        notes: notes.trim() || undefined,
      };

      if (newPassword.trim()) {
        payload.password = newPassword.trim();
      }

      // Nếu gia hạn dùng thử
      if (extendDays > 0) {
        payload.status = 'trial';
        const base = teacher.trialExpiresAt ? new Date(teacher.trialExpiresAt).getTime() : Date.now();
        payload.trialExpiresAt = new Date(Math.max(Date.now(), base) + extendDays * 86400000).toISOString();
      }

      const updated = await teacherService.updateTeacher(teacher.id, payload);
      onSuccess(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi cập nhật tài khoản');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-[fadeIn_0.2s_ease] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[#E6DCC8]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#1F2937]">Sửa Thông Tin Giáo Viên</h3>
              <p className="text-xs text-[#6B7280]">
                Tài khoản: <span className="font-mono font-bold text-[#1F2937]">{teacher.username}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#9CA3AF] hover:text-[#1F2937] hover:bg-[#FAF5EB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Họ tên */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1">
              Họ và tên giáo viên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
            />
          </div>

          {/* Đổi mật khẩu mới */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1">
              Đặt lại mật khẩu mới <span className="text-[#9CA3AF] font-normal">(bỏ trống nếu giữ nguyên)</span>
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới..."
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none font-mono text-xs"
            />
          </div>

          {/* SĐT & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
              />
            </div>
          </div>

          {/* Trường & Môn */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Trường học
              </label>
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Bộ môn
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
              />
            </div>
          </div>

          {/* Trạng thái tài khoản */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1.5">
              Trạng thái tài khoản
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                  status === 'active'
                    ? 'border-[#059669] bg-emerald-50 text-[#059669]'
                    : 'border-[#E6DCC8] bg-[#FAF5EB] text-[#4B5563]'
                }`}
              >
                Hoạt động
              </button>
              <button
                type="button"
                onClick={() => setStatus('trial')}
                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                  status === 'trial'
                    ? 'border-[#D97706] bg-amber-50 text-[#D97706]'
                    : 'border-[#E6DCC8] bg-[#FAF5EB] text-[#4B5563]'
                }`}
              >
                Dùng thử
              </button>
              <button
                type="button"
                onClick={() => setStatus('locked')}
                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                  status === 'locked'
                    ? 'border-[#DC2626] bg-red-50 text-[#DC2626]'
                    : 'border-[#E6DCC8] bg-[#FAF5EB] text-[#4B5563]'
                }`}
              >
                Khóa tài khoản
              </button>
            </div>
          </div>

          {/* Gia hạn dùng thử */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1.5">
              Gia hạn thêm ngày dùng thử
            </label>
            <div className="flex items-center gap-2">
              {[0, 3, 7, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExtendDays(d)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    extendDays === d
                      ? 'border-[#2F3E6B] bg-[#2F3E6B] text-white'
                      : 'border-[#E6DCC8] bg-[#FAF5EB] text-[#4B5563] hover:bg-[#E6DCC8]/40'
                  }`}
                >
                  {d === 0 ? 'Không gia hạn' : `+${d} ngày`}
                </button>
              ))}
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1">
              Ghi chú nội bộ
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#FAF5EB] border border-[#E6DCC8] focus:bg-white focus:border-[#2F3E6B] outline-none"
            />
          </div>

          {/* Nút hành động */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6DCC8]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E6DCC8] bg-[#FAF5EB] hover:bg-[#E6DCC8]/40 text-xs font-bold text-[#4B5563]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#2F3E6B] hover:bg-[#233054] text-white text-xs font-bold shadow-md shadow-[#2F3E6B]/20 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
