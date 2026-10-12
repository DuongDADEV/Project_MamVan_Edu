import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../../components/teacher/ui/PageHeader.tsx';
import { ConfirmDialog } from '../../components/teacher/ui/ConfirmDialog.tsx';
import { EmptyState } from '../../components/teacher/ui/EmptyState.tsx';
import {
  AuditLog,
  TeacherProfile,
  SystemSettings,
} from '../../services/types.ts';
import {
  settingService,
  auditService,
  resetAllDemoData,
  useLiveQuery,
  DEFAULT_SYSTEM_SETTINGS,
} from '../../services/index.ts';
import {
  RotateCcw,
  Shield,
  Clock,
  Database,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Save,
  KeyRound,
  Laptop,
  Bell,
  Sparkles,
  Award,
  BookOpen,
  Sliders,
  Filter,
  Search,
  Download,
  Check,
  X,
  Lock,
  Layers,
  History,
  Info,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  RefreshCw,
} from 'lucide-react';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  getGeminiModel,
  setGeminiModel,
  testGeminiApiKey,
} from '../../services/ai/index.ts';

interface TeacherSettingsScreenProps {
  teacher: TeacherProfile;
  auditLogs?: AuditLog[];
  onRefreshData?: () => void;
}

export const TeacherSettingsScreen: React.FC<TeacherSettingsScreenProps> = ({
  teacher,
  onRefreshData,
}) => {
  // Tabs: 'pedagogical' | 'xp' | 'account' | 'audit'
  const [activeTab, setActiveTab] = useState<'pedagogical' | 'xp' | 'account' | 'audit'>('pedagogical');

  // Lắng nghe cài đặt hệ thống từ SettingRepository
  const { data: remoteSettings, refresh: refreshSettings } = useLiveQuery<SystemSettings>(
    () => settingService.getSettings(),
    ['settings']
  );

  // Lắng nghe nhật ký hoạt động từ AuditRepository
  const { data: remoteLogs, refresh: refreshLogs } = useLiveQuery<AuditLog[]>(
    () => auditService.getLogs({ limit: 150 }),
    ['audit', 'settings', 'reward', 'content', 'student', 'essay']
  );

  // Form state cho Cài đặt
  const [settingsForm, setSettingsForm] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Đổi mật khẩu state
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<boolean>(false);

  // Confirm dialogs
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [resetGroupTarget, setResetGroupTarget] = useState<'general' | 'mastery' | 'xp' | 'time' | 'notifications' | null>(null);
  const [isResetGroupConfirmOpen, setIsResetGroupConfirmOpen] = useState<boolean>(false);

  // Audit filter state
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditTimeFilter, setAuditTimeFilter] = useState<string>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Google AI Studio (Gemini) State
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>(() => getGeminiApiKey());
  const [geminiModelInput, setGeminiModelInput] = useState<string>(() => getGeminiModel());
  const [showGeminiKey, setShowGeminiKey] = useState<boolean>(false);
  const [isTestingAi, setIsTestingAi] = useState<boolean>(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);
  const [isAiConfigSaved, setIsAiConfigSaved] = useState<boolean>(() => !!getGeminiApiKey());

  const handleSaveAiConfig = () => {
    setGeminiApiKey(geminiKeyInput);
    setGeminiModel(geminiModelInput);
    setIsAiConfigSaved(!!geminiKeyInput.trim());
    showToast(
      geminiKeyInput.trim()
        ? 'Đã lưu API Key và kích hoạt Google AI Studio thật!'
        : 'Đã xóa API Key. Hệ thống chuyển về dùng AI giả lập (Mock AI).'
    );
  };

  const handleTestAiConnection = async () => {
    if (!geminiKeyInput.trim()) {
      showToast('Vui lòng nhập API Key trước khi kiểm tra kết nối.', 'error');
      return;
    }
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await testGeminiApiKey(geminiKeyInput.trim(), geminiModelInput);
      setAiTestResult(res);
      if (res.success) {
        showToast(`Kết nối thành công (${res.latencyMs}ms)!`);
      } else {
        showToast('Kết nối thất bại. Vui lòng kiểm tra lại thông báo.', 'error');
      }
    } catch (e: any) {
      setAiTestResult({
        success: false,
        message: e.message || 'Lỗi không xác định khi kết nối.',
        latencyMs: 0,
      });
      showToast('Lỗi khi kiểm tra kết nối AI.', 'error');
    } finally {
      setIsTestingAi(false);
    }
  };

  useEffect(() => {
    if (remoteSettings) {
      setSettingsForm(remoteSettings);
    }
  }, [remoteSettings]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ==========================================
  // XỬ LÝ LƯU CÀI ĐẶT
  // ==========================================
  const handleSaveSettings = async () => {
    // 1. Kiểm tra validation trần XP
    if (settingsForm.xp.weeklyCap < settingsForm.xp.dailyCapTotal) {
      showToast('Lỗi: Trần XP tuần không thể nhỏ hơn trần XP ngày tối đa!', 'error');
      return;
    }
    if (settingsForm.xp.dailyCapTotal < settingsForm.xp.dailyCapUnder45Min) {
      showToast('Lỗi: Trần XP ngày tối đa không thể nhỏ hơn trần XP dưới 45 phút!', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await settingService.updateSettings(settingsForm, teacher.id);
      showToast('Đã lưu cấu hình cài đặt hệ thống thành công!');
      refreshSettings();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err?.message || 'Không thể lưu cài đặt', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Khôi phục nhóm cài đặt cụ thể
  const handleConfirmResetGroup = async () => {
    if (!resetGroupTarget) return;
    try {
      const res = await settingService.resetGroup(resetGroupTarget);
      setSettingsForm(res);
      showToast(`Đã khôi phục mặc định nhóm ${resetGroupTarget}!`);
      setIsResetGroupConfirmOpen(false);
      setResetGroupTarget(null);
      refreshSettings();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khôi phục nhóm', 'error');
    }
  };

  // Đặt lại toàn bộ dữ liệu demo
  const handleResetDemoData = () => {
    resetAllDemoData();
    setIsResetConfirmOpen(false);
    showToast('Đã đặt lại toàn bộ dữ liệu demo (28 học sinh, 6 tuần điểm số, 4 chuyên đề) về trạng thái ban đầu!');
    refreshSettings();
    refreshLogs();
    if (onRefreshData) onRefreshData();
  };

  // Đổi mật khẩu giáo viên (mock + ghi audit an toàn)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    // Ghi audit log TUYỆT ĐỐI KHÔNG LƯU MẬT KHẨU
    await auditService.log({
      actor_id: teacher.id,
      actor_name: teacher.name,
      actor_role: 'teacher',
      action: 'CHANGE_TEACHER_PASSWORD',
      target_type: 'setting',
      target_id: teacher.id,
      target_name: `Đổi mật khẩu tài khoản (${teacher.username})`,
      details: { notes: 'Đổi mật khẩu thành công qua màn hình Cài đặt' },
    });

    setPasswordSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast('Đã đổi mật khẩu tài khoản giáo viên thành công!');
    refreshLogs();
  };

  // Đăng xuất mọi thiết bị
  const handleLogoutAllDevices = async () => {
    await auditService.log({
      actor_id: teacher.id,
      actor_name: teacher.name,
      actor_role: 'teacher',
      action: 'LOGOUT_ALL_DEVICES',
      target_type: 'setting',
      target_id: teacher.id,
      target_name: `Đăng xuất toàn bộ phiên (${teacher.username})`,
      details: { notes: 'Yêu cầu hủy mọi phiên đăng nhập trên thiết bị khác' },
    });
    showToast('Đã đăng xuất khỏi tất cả các thiết bị khác thành công!');
    refreshLogs();
  };

  // Lọc Audit Logs
  const logsList = remoteLogs || [];
  const filteredLogs = useMemo(() => {
    let list = logsList;

    // Lọc theo loại đối tượng / hành động
    if (auditActionFilter !== 'all') {
      list = list.filter((l) => l.target_type === auditActionFilter);
    }

    // Lọc theo thời gian
    const now = Date.now();
    if (auditTimeFilter === 'today') {
      const startOfDay = new Date().setHours(0, 0, 0, 0);
      list = list.filter((l) => new Date(l.created_at).getTime() >= startOfDay);
    } else if (auditTimeFilter === '7d') {
      const sevenDaysAgo = now - 7 * 86400000;
      list = list.filter((l) => new Date(l.created_at).getTime() >= sevenDaysAgo);
    } else if (auditTimeFilter === '30d') {
      const thirtyDaysAgo = now - 30 * 86400000;
      list = list.filter((l) => new Date(l.created_at).getTime() >= thirtyDaysAgo);
    }

    // Lọc tìm kiếm
    if (auditSearchQuery.trim()) {
      const q = auditSearchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.actor_name.toLowerCase().includes(q) ||
          l.target_name.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          (l.details?.notes && String(l.details.notes).toLowerCase().includes(q))
      );
    }

    return list;
  }, [logsList, auditActionFilter, auditTimeFilter, auditSearchQuery]);

  // Xuất file CSV audit
  const handleExportAuditCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('Không có bản ghi nhật ký nào để xuất', 'info');
      return;
    }
    const headers = ['Thời gian', 'Người thực hiện', 'Vai trò', 'Hành động', 'Đối tượng', 'Loại', 'Ghi chú'];
    const rows = filteredLogs.map((l) => [
      new Date(l.created_at).toLocaleString('vi-VN'),
      `"${l.actor_name}"`,
      l.actor_role,
      l.action,
      `"${l.target_name}"`,
      l.target_type,
      `"${l.details?.notes || l.details?.reason || ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Nhat_ky_kiem_toan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã xuất file nhật ký kiểm toán thành công!');
  };

  // Cảnh báo bất hợp lý XP
  const xpWarning = useMemo(() => {
    const { dailyCapUnder45Min, dailyCapTotal, weeklyCap } = settingsForm.xp;
    if (weeklyCap < dailyCapTotal) {
      return `Trần XP tuần (${weeklyCap}) nhỏ hơn trần XP ngày tối đa (${dailyCapTotal})! Học sinh sẽ nhanh chóng chạm trần tuần.`;
    }
    if (dailyCapTotal < dailyCapUnder45Min) {
      return `Trần XP ngày tối đa (${dailyCapTotal}) nhỏ hơn trần ngày dưới 45 phút (${dailyCapUnder45Min})!`;
    }
    return null;
  }, [settingsForm.xp]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cài đặt hệ thống & Nhật ký kiểm toán"
        subtitle="Quản lý thông số sư phạm, ngưỡng Mastery, cơ chế cộng XP, bảo mật tài khoản và kiểm tra nhật ký hoạt động"
      />

      {/* TOAST THÔNG BÁO */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-2 animate-[fadeIn_0.2s_ease] ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : toastMessage.type === 'info'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* THANH TABS CHÍNH */}
      <div className="flex border-b border-[#E6DCC8] bg-[#FAF5EB]/50 rounded-2xl p-1.5 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('pedagogical')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
            activeTab === 'pedagogical'
              ? 'bg-[#2F3E6B] text-white shadow-xs'
              : 'text-[#4B5563] hover:text-[#2F3E6B] hover:bg-[#FAF5EB]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Sư phạm & Trường lớp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('xp')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
            activeTab === 'xp'
              ? 'bg-[#2F3E6B] text-white shadow-xs'
              : 'text-[#4B5563] hover:text-[#2F3E6B] hover:bg-[#FAF5EB]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#F2B84B]" />
          <span>Cấu hình XP & Giới hạn</span>
          {xpWarning && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
            activeTab === 'account'
              ? 'bg-[#2F3E6B] text-white shadow-xs'
              : 'text-[#4B5563] hover:text-[#2F3E6B] hover:bg-[#FAF5EB]'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Tài khoản & Dữ liệu</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
            activeTab === 'audit'
              ? 'bg-[#2F3E6B] text-white shadow-xs'
              : 'text-[#4B5563] hover:text-[#2F3E6B] hover:bg-[#FAF5EB]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Nhật ký hoạt động ({logsList.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SƯ PHẠM & TRƯỜNG LỚP */}
      {/* ======================================================== */}
      {activeTab === 'pedagogical' && (
        <div className="space-y-6">
          {/* NHÓM 1: THÔNG TIN TRƯỜNG LỚP */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8]/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-lora font-bold text-sm text-[#2F3E6B]">
                    Thông tin Trường, Năm học & Lớp
                  </h3>
                  <p className="text-[11px] text-[#6B7280]">
                    Các thông tin nền tảng hiển thị trên báo cáo và giao diện học sinh
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetGroupTarget('general');
                  setIsResetGroupConfirmOpen(true);
                }}
                className="text-xs text-[#8C7E6A] hover:text-[#2F3E6B] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục nhóm này</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Tên trường học</label>
                <input
                  type="text"
                  value={settingsForm.schoolInfo.schoolName}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      schoolInfo: { ...settingsForm.schoolInfo, schoolName: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Năm học</label>
                <input
                  type="text"
                  value={settingsForm.schoolInfo.academicYear}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      schoolInfo: { ...settingsForm.schoolInfo, academicYear: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Học kỳ hiện tại</label>
                <select
                  value={settingsForm.schoolInfo.semester}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      schoolInfo: { ...settingsForm.schoolInfo, semester: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                >
                  <option value="Học kỳ I">Học kỳ I</option>
                  <option value="Học kỳ II">Học kỳ II</option>
                  <option value="Học kỳ Hè">Học kỳ Hè</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Lớp mặc định</label>
                <input
                  type="text"
                  value={settingsForm.schoolInfo.classNameDefault}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      schoolInfo: { ...settingsForm.schoolInfo, classNameDefault: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                />
              </div>
            </div>
          </div>

          {/* NHÓM 2: NGƯỠNG MASTERY */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8]/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#2E5E3D]/10 text-[#2E5E3D] flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-lora font-bold text-sm text-[#2F3E6B]">
                    Ngưỡng Mastery & Đánh giá Năng lực
                  </h3>
                  <p className="text-[11px] text-[#6B7280]">
                    Phân loại 3 mức: Cần ôn lại (&lt;50%), Đang tiến bộ (50-80%), Vững vàng (≥80%)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetGroupTarget('mastery');
                  setIsResetGroupConfirmOpen(true);
                }}
                className="text-xs text-[#8C7E6A] hover:text-[#2F3E6B] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục nhóm này</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                  Ngưỡng Cần ôn lại (&lt;)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={20}
                    max={70}
                    value={settingsForm.mastery.thresholdNeedsReview}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        mastery: { ...settingsForm.mastery, thresholdNeedsReview: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">%</span>
                </div>
                <span className="text-[10px] text-[#8C7E6A] mt-1 block">Mặc định: 50%</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                  Ngưỡng Vững vàng (≥)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={60}
                    max={95}
                    value={settingsForm.mastery.thresholdProgressing}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        mastery: { ...settingsForm.mastery, thresholdProgressing: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">%</span>
                </div>
                <span className="text-[10px] text-[#8C7E6A] mt-1 block">Mặc định: 80%</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                  Số câu tối thiểu mỗi mức
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={settingsForm.mastery.minQuestionsRequired}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        mastery: { ...settingsForm.mastery, minQuestionsRequired: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">câu</span>
                </div>
                <span className="text-[10px] text-[#8C7E6A] mt-1 block">Tối thiểu để kết luận Mastery</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                  Hệ số giảm dần (Decay)
                </label>
                <input
                  type="number"
                  step={0.01}
                  min={0.5}
                  max={0.99}
                  value={settingsForm.mastery.weightDecayFactor}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      mastery: { ...settingsForm.mastery, weightDecayFactor: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                />
                <span className="text-[10px] text-[#8C7E6A] mt-1 block">Mặc định: 0.88</span>
              </div>
            </div>
          </div>

          {/* NHÓM 3: NHẮC NGHỈ & THỜI GIAN HỌC */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8]/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-lora font-bold text-sm text-[#2F3E6B]">
                    Nhắc nghỉ & Thời gian học tích cực
                  </h3>
                  <p className="text-[11px] text-[#6B7280]">
                    Bảo vệ mắt và sức khỏe học sinh khi học trực tuyến
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetGroupTarget('time');
                  setIsResetGroupConfirmOpen(true);
                }}
                className="text-xs text-[#8C7E6A] hover:text-[#2F3E6B] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục nhóm này</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                  Ngưỡng không hoạt động (Tự dừng đếm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={settingsForm.time.idleLimitMinutes}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        time: { ...settingsForm.time, idleLimitMinutes: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">phút</span>
                </div>
                <span className="text-[10px] text-[#8C7E6A] mt-1 block">Khuyến nghị: 3 đến 5 phút</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                  Nhắc nghỉ giải lao liên tục
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={20}
                    max={90}
                    value={settingsForm.time.breakReminderMinutes}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        time: { ...settingsForm.time, breakReminderMinutes: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">phút</span>
                </div>
                <span className="text-[10px] text-[#8C7E6A] mt-1 block">Mặc định: 45 phút</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                  Thời gian đọc lý thuyết tối thiểu
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={settingsForm.time.minTheoryReadSeconds}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        time: { ...settingsForm.time, minTheoryReadSeconds: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">giây</span>
                </div>
                <span className="text-[10px] text-[#8C7E6A] mt-1 block">Trước khi bật nút "Đã hiểu"</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                  Thời gian chờ chấm hiển thị cho HS
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={12}
                    max={168}
                    value={settingsForm.time.essayReviewEstimatedHours}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        time: { ...settingsForm.time, essayReviewEstimatedHours: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] font-semibold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">giờ</span>
                </div>
                <span className="text-[10px] text-[#8C7E6A] mt-1 block">Mặc định: 48 giờ</span>
              </div>
            </div>
          </div>

          {/* NHÓM 4: THÔNG BÁO CHO GIÁO VIÊN */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8]/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4 text-purple-700" />
                </div>
                <div>
                  <h3 className="font-lora font-bold text-sm text-[#2F3E6B]">
                    Thông báo giáo viên
                  </h3>
                  <p className="text-[11px] text-[#6B7280]">
                    Bật/tắt huy hiệu báo số lượng chờ trên thanh điều hướng
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetGroupTarget('notifications');
                  setIsResetGroupConfirmOpen(true);
                }}
                className="text-xs text-[#8C7E6A] hover:text-[#2F3E6B] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục nhóm này</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-[#E6DCC8] bg-[#FAF5EB]/40 cursor-pointer hover:bg-[#FAF5EB]">
                <input
                  type="checkbox"
                  checked={settingsForm.notifications.notifyPendingEssays}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      notifications: { ...settingsForm.notifications, notifyPendingEssays: e.target.checked },
                    })
                  }
                  className="w-4 h-4 mt-0.5 rounded text-[#2F3E6B] border-[#D1C7B7] focus:ring-[#2F3E6B]"
                />
                <div>
                  <div className="text-xs font-bold text-[#2F3E6B]">Bài viết nộp chờ chấm</div>
                  <div className="text-[11px] text-[#6B7280]">Hiện số lượng bài viết học sinh nộp chưa duyệt</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-[#E6DCC8] bg-[#FAF5EB]/40 cursor-pointer hover:bg-[#FAF5EB]">
                <input
                  type="checkbox"
                  checked={settingsForm.notifications.notifyPendingRewards}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      notifications: { ...settingsForm.notifications, notifyPendingRewards: e.target.checked },
                    })
                  }
                  className="w-4 h-4 mt-0.5 rounded text-[#2F3E6B] border-[#D1C7B7] focus:ring-[#2F3E6B]"
                />
                <div>
                  <div className="text-xs font-bold text-[#2F3E6B]">Yêu cầu mở rương quà</div>
                  <div className="text-[11px] text-[#6B7280]">Báo khi học sinh đủ điều kiện xin nhận quà</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-[#E6DCC8] bg-[#FAF5EB]/40 cursor-pointer hover:bg-[#FAF5EB]">
                <input
                  type="checkbox"
                  checked={settingsForm.notifications.notifyInactiveStudents}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      notifications: { ...settingsForm.notifications, notifyInactiveStudents: e.target.checked },
                    })
                  }
                  className="w-4 h-4 mt-0.5 rounded text-[#2F3E6B] border-[#D1C7B7] focus:ring-[#2F3E6B]"
                />
                <div>
                  <div className="text-xs font-bold text-[#2F3E6B]">Học sinh ít hoạt động</div>
                  <div className="text-[11px] text-[#6B7280]">Cảnh báo học sinh vắng trên 3 ngày có nguy cơ héo cây</div>
                </div>
              </label>
            </div>
          </div>

          {/* NÚT LƯU CẤU HÌNH */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-6 py-3 rounded-2xl bg-[#2F3E6B] hover:bg-[#23325B] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu toàn bộ cài đặt Sư phạm'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CẤU HÌNH XP & GIỚI HẠN */}
      {/* ======================================================== */}
      {activeTab === 'xp' && (
        <div className="space-y-6">
          {/* CẢNH BÁO BẤT HỢP LÝ NẾU CÓ */}
          {xpWarning && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-3 animate-[fadeIn_0.15s_ease]">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <strong>Cảnh báo cấu hình bất hợp lý:</strong> {xpWarning}
              </div>
            </div>
          )}

          {/* KHỐI 1: CÁC TRẦN XP (CAPS) */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8]/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E2704A]/10 text-[#E2704A] flex items-center justify-center font-bold">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-lora font-bold text-sm text-[#2F3E6B]">
                    Trần giới hạn XP Ngày & Tuần
                  </h3>
                  <p className="text-[11px] text-[#6B7280]">
                    Tránh cày cuốc quá sức, đảm bảo thói quen học tập bền vững
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetGroupTarget('xp');
                  setIsResetGroupConfirmOpen(true);
                }}
                className="text-xs text-[#8C7E6A] hover:text-[#2F3E6B] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục nhóm XP</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="p-4 rounded-2xl bg-[#FAF5EB]/50 border border-[#E6DCC8]">
                <label className="block text-xs font-bold text-[#2F3E6B] mb-1">
                  Trần ngày (&lt;45 phút học tích cực)
                </label>
                <div className="relative mt-2">
                  <input
                    type="number"
                    min={50}
                    max={500}
                    step={10}
                    value={settingsForm.xp.dailyCapUnder45Min}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, dailyCapUnder45Min: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-sm text-[#2F3E6B] font-bold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">XP</span>
                </div>
                <p className="text-[11px] text-[#6B7280] mt-1.5">
                  Mặc định: 130 XP. Học dưới 45 phút tối đa đạt mức này.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF5EB]/50 border border-[#E6DCC8]">
                <label className="block text-xs font-bold text-[#2F3E6B] mb-1">
                  Trần ngày tối đa (45-90 phút)
                </label>
                <div className="relative mt-2">
                  <input
                    type="number"
                    min={60}
                    max={600}
                    step={10}
                    value={settingsForm.xp.dailyCapTotal}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, dailyCapTotal: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-sm text-[#2F3E6B] font-bold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">XP</span>
                </div>
                <p className="text-[11px] text-[#6B7280] mt-1.5">
                  Mặc định: 150 XP. Học thêm sau 45 phút tích lũy thêm tối đa 20 XP.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF5EB]/50 border border-[#E6DCC8]">
                <label className="block text-xs font-bold text-[#2F3E6B] mb-1">
                  Trần tuần tích lũy (Đổi quà)
                </label>
                <div className="relative mt-2">
                  <input
                    type="number"
                    min={300}
                    max={2500}
                    step={50}
                    value={settingsForm.xp.weeklyCap}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, weeklyCap: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-sm text-[#2F3E6B] font-bold focus:outline-none focus:border-[#2F3E6B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A] font-bold">XP</span>
                </div>
                <p className="text-[11px] text-[#6B7280] mt-1.5">
                  Mặc định: 900 XP. Khống chế mức quà đổi tối đa trong tuần.
                </p>
              </div>
            </div>
          </div>

          {/* KHỐI 2: BẢNG XP THEO HÀNH ĐỘNG HỌC TẬP */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-lora font-bold text-sm text-[#2F3E6B] pb-2 border-b border-[#E6DCC8]/70">
              Bảng điểm XP cho từng hành động học tập
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Điểm danh ngày</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settingsForm.xp.attendanceDailyXp}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, attendanceDailyXp: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A]">XP</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Xem video đạt 80%</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settingsForm.xp.videoWatchXp}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, videoWatchXp: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A]">XP</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Đọc tóm tắt trọng tâm</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settingsForm.xp.videoSummaryReadXp}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, videoSummaryReadXp: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A]">XP</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Luyện tập video</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settingsForm.xp.videoPracticeXp}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, videoPracticeXp: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A]">XP</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Kiểm tra nhanh video</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settingsForm.xp.videoQuickTestXp}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, videoQuickTestXp: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A]">XP</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Kiểm tra năng lực Mastery</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={settingsForm.xp.videoMasteryCheckXp}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, videoMasteryCheckXp: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A]">XP</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Đọc hiểu lý thuyết</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settingsForm.xp.theoryReadXp}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, theoryReadXp: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A]">XP</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Luyện tập lý thuyết</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settingsForm.xp.theoryPracticeXp}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, theoryPracticeXp: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A]">XP</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">Hoàn thành bài tập về nhà</label>
                <div className="relative">
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={settingsForm.xp.homeworkCompletedXp}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        xp: { ...settingsForm.xp, homeworkCompletedXp: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7E6A]">XP</span>
                </div>
              </div>
            </div>
          </div>

          {/* NÚT LƯU CẤU HÌNH XP */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving || !!xpWarning}
              className="px-6 py-3 rounded-2xl bg-[#2F3E6B] hover:bg-[#23325B] disabled:opacity-50 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu cấu hình XP & Giới hạn'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: TÀI KHOẢN GIÁO VIÊN & DỮ LIỆU */}
      {/* ======================================================== */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ĐỔI MẬT KHẨU */}
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#E6DCC8]/70">
                  <div className="w-10 h-10 rounded-2xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center font-bold">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-lora font-bold text-sm text-[#2F3E6B]">
                      Đổi mật khẩu tài khoản
                    </h3>
                    <p className="text-[11px] text-[#6B7280]">
                      Tài khoản: <strong>{teacher.username}</strong> ({teacher.name})
                    </p>
                  </div>
                </div>

                {passwordError && (
                  <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Đổi mật khẩu thành công!</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                      Mật khẩu hiện tại *
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại"
                      className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                      Mật khẩu mới (Tối thiểu 6 ký tự) *
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới"
                      className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E6B] mb-1">
                      Xác nhận mật khẩu mới *
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full px-3 py-2 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#2F3E6B] hover:bg-[#23325B] text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 mt-4"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Cập nhật mật khẩu</span>
                  </button>
                </form>
              </div>
            </div>

            {/* QUẢN LÝ PHIÊN & ĐĂNG XUẤT THIẾT BỊ */}
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#E6DCC8]/70">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                    <Laptop className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="font-lora font-bold text-sm text-[#2F3E6B]">
                      Phiên đăng nhập & Thiết bị
                    </h3>
                    <p className="text-[11px] text-[#6B7280]">
                      Kiểm soát các phiên làm việc của tài khoản giáo viên
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="p-3 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <div>
                        <div className="font-bold text-[#2F3E6B]">Thiết bị này (Trình duyệt hiện tại)</div>
                        <div className="text-[10px] text-[#6B7280]">Windows 11 • Chrome 134 • Đang hoạt động</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      Hiện tại
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FFFDF8] border border-[#E6DCC8] flex items-center justify-between text-xs opacity-75">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                      <div>
                        <div className="font-bold text-[#4B5563]">iPad Air (Lớp học)</div>
                        <div className="text-[10px] text-[#6B7280]">iOS 17 • Safari • Hoạt động 2 ngày trước</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
                      Đã lưu
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogoutAllDevices}
                className="w-full py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4 text-rose-600" />
                <span>Đăng xuất khỏi tất cả các thiết bị khác</span>
              </button>
            </div>
          </div>

          {/* CẤU HÌNH GOOGLE AI STUDIO (GEMINI API) */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E6DCC8]/70 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#E2704A] to-[#F2B84B] text-white flex items-center justify-center font-bold shadow-xs">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                      Cấu hình Google AI Studio (Gemini API)
                    </h3>
                    {isAiConfigSaved ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                        AI Thật Đang Hoạt Động
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF5EB] text-[#8C7E6A] border border-[#E6DCC8]">
                        Đang dùng AI Giả lập (Mock Demo)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    Kích hoạt trí tuệ nhân tạo thật cho Xưởng NotebookLM, sinh câu hỏi, video và chấm bài tự luận
                  </p>
                </div>
              </div>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#E2704A] hover:bg-[#FAF5EB]/80 transition-colors w-fit shrink-0"
              >
                <span>Lấy API Key tại Google AI Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Ô NHẬP API KEY */}
              <div className="lg:col-span-2 space-y-2">
                <label className="block text-xs font-bold text-[#2F3E6B]">
                  Google Gemini API Key <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="Dán API Key (bắt đầu bằng AIzaSy...)"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-[#D1C7B7] bg-[#FAF5EB]/50 text-xs text-[#2F3E6B] font-mono focus:outline-none focus:border-[#E2704A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7E6A] hover:text-[#2F3E6B]"
                    title={showGeminiKey ? 'Ẩn key' : 'Hiện key'}
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#6B7280]">
                  🔒 Khóa API được lưu cục bộ an toàn trong trình duyệt của thầy/cô, không chia sẻ cho bên thứ ba.
                </p>
              </div>

              {/* CHỌN MODEL */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#2F3E6B]">
                  Mô hình Gemini AI
                </label>
                <select
                  value={geminiModelInput}
                  onChange={(e) => setGeminiModelInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D1C7B7] bg-[#FAF5EB]/50 text-xs text-[#2F3E6B] font-bold focus:outline-none focus:border-[#E2704A]"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Thế hệ mới 2.5 - Siêu tốc)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (Khuyên dùng - Ổn định & Thông minh)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Bản tiêu chuẩn)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (Suy luận chuyên sâu cao cấp)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Ngữ văn phân tích sâu)</option>
                </select>
                <p className="text-[11px] text-[#6B7280]">
                  Gợi ý: Hệ thống hỗ trợ đa model và tự động chuyển model dự phòng khi có tình trạng nghẽn token.
                </p>
              </div>
            </div>

            {/* KẾT QUẢ TEST NẾU CÓ */}
            {aiTestResult && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in duration-200 ${
                  aiTestResult.success
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50/80 border-rose-300 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold flex-wrap gap-2">
                  <span className="flex items-center gap-1.5">
                    {aiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{aiTestResult.success ? 'Kết nối thành công!' : 'Kết nối thất bại!'}</span>
                  </span>
                  {aiTestResult.latencyMs > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/60 font-mono">
                      Độ trễ: {aiTestResult.latencyMs}ms
                    </span>
                  )}
                </div>
                <div className="p-2.5 rounded-xl bg-white/70 border border-black/5 text-[11px] leading-relaxed italic">
                  "{aiTestResult.message}"
                </div>
              </div>
            )}

            {/* HÀNG NÚT THAO TÁC */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-[#8C7E6A]">
                {isAiConfigSaved
                  ? '✓ Đã kích hoạt. Khi có lệnh sinh nội dung, hệ thống sẽ gọi trực tiếp Google AI Studio.'
                  : 'Chưa lưu API Key. Hệ thống đang chạy ở chế độ mô phỏng sư phạm.'}
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={isTestingAi || !geminiKeyInput.trim()}
                  className="px-4 py-2.5 rounded-xl border border-[#2F3E6B] text-[#2F3E6B] hover:bg-[#2F3E6B]/5 disabled:opacity-40 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isTestingAi ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang kiểm tra kết nối...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Kiểm tra kết nối AI</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveAiConfig}
                  className="px-5 py-2.5 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu cấu hình AI</span>
                </button>
              </div>
            </div>
          </div>

          {/* KHU VỰC ĐẶT LẠI DỮ LIỆU DEMO */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-[#E2704A]" />
                <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                  Khôi phục & Đặt lại dữ liệu thử nghiệm (Demo)
                </h3>
              </div>
              <p className="text-xs text-[#6B7280] mt-1 max-w-xl">
                Bấm nút bên dưới để khôi phục toàn bộ danh sách 28 học sinh seed chuẩn, 6 tuần lịch sử điểm số,
                4 chuyên đề Ngữ văn 7 và cài đặt mặc định ban đầu.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="px-5 py-2.5 rounded-2xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-all shadow-xs flex items-center gap-2 shrink-0"
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>Đặt lại dữ liệu demo</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: NHẬT KÝ HOẠT ĐỘNG (AUDIT LOGS) */}
      {/* ======================================================== */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* THANH CÔNG CỤ TÌM KIẾM & LỌC NHẬT KÝ */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FFFDF8] p-3.5 rounded-2xl border border-[#E6DCC8]">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Lọc loại hành động */}
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <Filter className="w-3.5 h-3.5 text-[#2F3E6B]" />
                <span>Loại:</span>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                >
                  <option value="all">Tất cả loại đối tượng</option>
                  <option value="student">Học sinh & Tài khoản</option>
                  <option value="content">Nội dung học</option>
                  <option value="quiz">Bài tập & Câu hỏi</option>
                  <option value="essay">Chấm bài viết</option>
                  <option value="reward">Quà tặng & Rương</option>
                  <option value="setting">Cài đặt hệ thống</option>
                </select>
              </div>

              {/* Lọc thời gian */}
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <span>Thời gian:</span>
                <select
                  value={auditTimeFilter}
                  onChange={(e) => setAuditTimeFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
                >
                  <option value="all">Toàn bộ thời gian</option>
                  <option value="today">Hôm nay</option>
                  <option value="7d">7 ngày gần nhất</option>
                  <option value="30d">30 ngày gần nhất</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#8C7E6A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  placeholder="Tìm hành động, người thực hiện..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleExportAuditCSV}
                className="px-3.5 py-1.5 rounded-xl border border-[#2E5E3D] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Xuất CSV</span>
              </button>
            </div>
          </div>

          {/* BẢNG NHẬT KÝ KIỂM TOÁN */}
          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-8 h-8 text-[#8C7E6A]" />}
              title="Không có nhật ký nào phù hợp"
              description="Thử đổi bộ lọc thời gian hoặc loại đối tượng để xem thêm lịch sử thao tác."
            />
          ) : (
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF5EB] border-b border-[#E6DCC8] sticky top-0 font-bold text-[#2F3E6B] z-10">
                    <tr>
                      <th className="py-3 px-3.5 w-36">Thời gian</th>
                      <th className="py-3 px-3">Người thực hiện</th>
                      <th className="py-3 px-3">Hành động</th>
                      <th className="py-3 px-3">Đối tượng tác động</th>
                      <th className="py-3 px-3">Phân loại</th>
                      <th className="py-3 px-3">Ghi chú / Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6DCC8]/60">
                    {filteredLogs.map((log) => {
                      const isTeacher = log.actor_role === 'teacher';
                      return (
                        <tr key={log.id} className="hover:bg-[#FAF5EB]/50 transition-colors">
                          <td className="py-2.5 px-3.5 text-[#6B7280] font-mono text-[11px]">
                            {new Date(log.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#2F3E6B]">
                            <div className="flex items-center gap-1.5">
                              <span>{log.actor_name}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                  isTeacher ? 'bg-[#2F3E6B]/10 text-[#2F3E6B]' : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {isTeacher ? 'Giáo viên' : 'Hệ thống'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#E2704A] text-[11px]">
                            {log.action}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#2F3E6B]">
                            {log.target_name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-[#FAF5EB] border border-[#E6DCC8] text-[10px] font-semibold text-[#4B5563]">
                              {log.target_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#6B7280] text-[11px] max-w-xs truncate">
                            {log.details?.notes ||
                              log.details?.reason ||
                              (log.details ? JSON.stringify(log.details) : '—')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRM DIALOG KHÔI PHỤC NHÓM CÀI ĐẶT */}
      <ConfirmDialog
        isOpen={isResetGroupConfirmOpen}
        title="Khôi phục nhóm cài đặt về mặc định?"
        message={`Bạn có chắc muốn khôi phục nhóm cài đặt "${resetGroupTarget}" về cấu hình chuẩn ban đầu?`}
        confirmLabel="Khôi phục ngay"
        variant="warning"
        onCancel={() => {
          setIsResetGroupConfirmOpen(false);
          setResetGroupTarget(null);
        }}
        onConfirm={handleConfirmResetGroup}
      />

      {/* CONFIRM DIALOG ĐẶT LẠI TOÀN BỘ DEMO */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        title="Đặt lại toàn bộ dữ liệu thử nghiệm (Demo)?"
        message="Hành động này sẽ khôi phục danh sách học sinh, bài tập, điểm số 6 tuần và cài đặt về trạng thái chuẩn ban đầu. Bạn có chắc chắn muốn thực hiện?"
        confirmLabel="Đặt lại ngay"
        variant="danger"
        onCancel={() => setIsResetConfirmOpen(false)}
        onConfirm={async () => handleResetDemoData()}
      />
    </div>
  );
};
