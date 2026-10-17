import React, { useState, useMemo } from 'react';
import { PageHeader } from '../../components/teacher/ui/PageHeader.tsx';
import { EmptyState } from '../../components/teacher/ui/EmptyState.tsx';
import { ConfirmDialog } from '../../components/teacher/ui/ConfirmDialog.tsx';
import { RewardMilestoneModal } from '../../components/teacher/rewards/RewardMilestoneModal.tsx';
import { RejectRewardModal } from '../../components/teacher/rewards/RejectRewardModal.tsx';
import { RewardStudentPreviewModal } from '../../components/teacher/rewards/RewardStudentPreviewModal.tsx';
import { ChestIllustration } from '../../components/rewards/ChestIllustration.tsx';
import { CHEST_TIERS, getChestTierConfig } from '../../config.ts';
import {
  RewardItem,
  EnrichedRewardRequest,
  RewardStatus,
  ClassItem,
} from '../../services/types.ts';
import {
  rewardService,
  classService,
  useLiveQuery,
} from '../../services/index.ts';
import {
  Gift,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Check,
  X,
  Plus,
  Eye,
  EyeOff,
  Filter,
  Search,
  Download,
  Sparkles,
  Layers,
  History,
  Calendar,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface TeacherRewardsScreenProps {
  pendingCount?: number;
  selectedClassId?: string;
}

export const TeacherRewardsScreen: React.FC<TeacherRewardsScreenProps> = ({
  selectedClassId: initialClassId,
}) => {
  // Tabs: 'queue' (Hàng đợi) | 'catalog' (Danh mục mốc) | 'history' (Lịch sử)
  const [activeTab, setActiveTab] = useState<'queue' | 'catalog' | 'history'>('queue');

  // Lắng nghe dữ liệu phần thưởng & lớp học thời gian thực
  const { data: rawRequests, loading: loadingRequests, refresh: refreshRequests } = useLiveQuery<EnrichedRewardRequest[]>(
    () => rewardService.getRequests(),
    ['reward', 'state']
  );

  const { data: rewards, loading: loadingRewards, refresh: refreshRewards } = useLiveQuery<RewardItem[]>(
    () => rewardService.getRewards(),
    ['reward']
  );

  const { data: classes } = useLiveQuery<ClassItem[]>(
    () => classService.getClasses(),
    ['class']
  );

  // Bộ lọc
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSecretsInCatalog, setShowSecretsInCatalog] = useState<boolean>(false);

  // Quản lý chọn hàng loạt trong hàng đợi
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());

  // Quản lý Modal
  const [milestoneModalOpen, setMilestoneModalOpen] = useState<boolean>(false);
  const [editingMilestone, setEditingMilestone] = useState<RewardItem | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectingRequest, setRejectingRequest] = useState<EnrichedRewardRequest | null>(null);

  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [previewingReward, setPreviewingReward] = useState<RewardItem | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [deletingRewardId, setDeletingRewardId] = useState<string | null>(null);

  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const requests = rawRequests || [];
  const rewardsList = rewards || [];
  const classList = classes || [];

  // Thống kê nhanh
  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'PENDING_APPROVAL').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const given = requests.filter((r) => r.status === 'GIVEN').length;
    const opened = requests.filter((r) => r.status === 'OPENED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return { pending, approved, given, opened, rejected, total: requests.length };
  }, [requests]);

  // Lọc hàng đợi
  const filteredQueue = useMemo(() => {
    let list = requests;
    if (selectedClassId !== 'all') {
      list = list.filter((r) => r.classId === selectedClassId);
    }
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.studentName?.toLowerCase().includes(q) ||
          r.className?.toLowerCase().includes(q) ||
          r.reward?.teaserDescription.toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, selectedClassId, statusFilter, searchQuery]);

  // Lọc lịch sử (tôn trọng bộ lọc lớp + ô tìm kiếm giống hàng đợi)
  const historyList = useMemo(() => {
    let list = requests.filter(
      (r) => r.status === 'GIVEN' || r.status === 'OPENED' || r.status === 'REJECTED'
    );
    if (selectedClassId !== 'all') {
      list = list.filter((r) => r.classId === selectedClassId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.studentName?.toLowerCase().includes(q) ||
          r.className?.toLowerCase().includes(q) ||
          r.reward?.teaserDescription.toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, selectedClassId, searchQuery]);

  // Xử lý đơn lẻ
  const handleApprove = async (req: EnrichedRewardRequest) => {
    try {
      await rewardService.updateRequestStatus(req.id, 'APPROVED', undefined, 'teacher_001');
      showNotification(`Đã duyệt yêu cầu của học sinh ${req.studentName}!`);
      refreshRequests();
    } catch (err: any) {
      showNotification(err?.message || 'Có lỗi xảy ra', 'error');
    }
  };

  const handleGive = async (req: EnrichedRewardRequest) => {
    try {
      await rewardService.updateRequestStatus(req.id, 'GIVEN', undefined, 'teacher_001');
      showNotification(`Đã trao quà cho học sinh ${req.studentName}! Học sinh hiện có thể bấm "Mở rương" để nhận quà.`);
      refreshRequests();
    } catch (err: any) {
      showNotification(err?.message || 'Có lỗi xảy ra', 'error');
    }
  };

  const handleOpenRejectModal = (req: EnrichedRewardRequest) => {
    setRejectingRequest(req);
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (requestId: string, reason: string) => {
    await rewardService.updateRequestStatus(requestId, 'REJECTED', reason, 'teacher_001');
    showNotification('Đã gửi lời nhắn từ chối nhẹ nhàng tới học sinh.', 'info');
    refreshRequests();
  };

  // Xử lý chọn hàng loạt
  const handleToggleSelectAll = () => {
    if (selectedRequestIds.size === filteredQueue.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(filteredQueue.map((r) => r.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedRequestIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRequestIds(next);
  };

  const handleBatchApprove = async () => {
    if (selectedRequestIds.size === 0) return;
    // Chỉ yêu cầu đang CHỜ mới duyệt được — lọc trước để thông báo đúng số lượng
    const actionable = Array.from(selectedRequestIds).filter(
      (id) => requests.find((r) => r.id === id)?.status === 'PENDING_APPROVAL'
    );
    if (actionable.length === 0) {
      showNotification('Không có yêu cầu nào đang chờ duyệt trong số đã chọn', 'info');
      return;
    }
    setBatchActionLoading(true);
    try {
      await rewardService.batchUpdateStatus(actionable, 'APPROVED', undefined, 'teacher_001');
      showNotification(`Đã phê duyệt hàng loạt ${actionable.length} yêu cầu!`);
      setSelectedRequestIds(new Set());
      refreshRequests();
    } catch (err: any) {
      showNotification(err?.message || 'Lỗi duyệt hàng loạt', 'error');
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchGive = async () => {
    if (selectedRequestIds.size === 0) return;
    // Chỉ yêu cầu ĐÃ DUYỆT mới trao được
    const actionable = Array.from(selectedRequestIds).filter(
      (id) => requests.find((r) => r.id === id)?.status === 'APPROVED'
    );
    if (actionable.length === 0) {
      showNotification('Không có yêu cầu nào đã duyệt (chờ trao) trong số đã chọn', 'info');
      return;
    }
    setBatchActionLoading(true);
    try {
      await rewardService.batchUpdateStatus(actionable, 'GIVEN', undefined, 'teacher_001');
      showNotification(`Đã trao quà hàng loạt cho ${actionable.length} học sinh!`);
      setSelectedRequestIds(new Set());
      refreshRequests();
    } catch (err: any) {
      showNotification(err?.message || 'Lỗi trao hàng loạt', 'error');
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Lưu mốc quà
  const handleSaveMilestone = async (data: Partial<RewardItem>) => {
    await rewardService.saveReward(data);
    showNotification(data.id ? 'Đã cập nhật mốc quà tặng!' : 'Đã tạo mốc quà tặng mới thành công!');
    refreshRewards();
  };

  // Xóa mốc quà
  const handleDeleteMilestone = async () => {
    if (!deletingRewardId) return;
    await rewardService.deleteReward(deletingRewardId);
    showNotification('Đã xóa mốc quà tặng.', 'info');
    setDeleteConfirmOpen(false);
    setDeletingRewardId(null);
    refreshRewards();
  };

  // Xuất file CSV lịch sử
  const handleExportHistoryCSV = () => {
    if (historyList.length === 0) {
      showNotification('Không có dữ liệu lịch sử để xuất file', 'info');
      return;
    }
    const headers = ['Mã yêu cầu', 'Học sinh', 'Lớp', 'Rương quà', 'XP tuần', 'Điểm danh', 'Trạng thái', 'Thời gian gửi', 'Ghi chú / Lý do'];
    const rows = historyList.map((r) => [
      r.id,
      `"${r.studentName || ''}"`,
      `"${r.className || ''}"`,
      `"${r.reward?.teaserDescription || ''}"`,
      r.xpWeekActual || 0,
      r.attendanceDaysActual || 0,
      r.status === 'GIVEN' ? 'Đã trao' : r.status === 'OPENED' ? 'Đã mở rương' : 'Từ chối',
      new Date(r.requestedAt).toLocaleString('vi-VN'),
      `"${r.rejectReason || ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Lich_su_qua_tang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Đã xuất file lịch sử quà tặng thành công!');
  };

  return (
    <div className="space-y-6">
      {/* HEADER TRANG */}
      <PageHeader
        title="Quản lý Quà tặng & Rương báu bí mật"
        subtitle="Thiết lập các mốc rương tuần, phê duyệt yêu cầu đổi quà và trao quà tặng khích lệ học sinh"
      />

      {/* THÔNG BÁO TOAST */}
      {notificationMsg && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-2 animate-[fadeIn_0.2s_ease] ${
            notificationMsg.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : notificationMsg.type === 'info'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notificationMsg.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          )}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* THỐNG KÊ NHANH 4 THẺ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#E6DCC8] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="text-xl font-bold font-lora text-[#2F3E6B]">{stats.pending}</div>
            <div className="text-xs text-[#6B7280]">Chờ giáo viên duyệt</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#E6DCC8] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
            <Check className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <div className="text-xl font-bold font-lora text-[#2F3E6B]">{stats.approved}</div>
            <div className="text-xs text-[#6B7280]">Đã duyệt (Chờ trao)</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#E6DCC8] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <Gift className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <div className="text-xl font-bold font-lora text-[#2F3E6B]">{stats.given}</div>
            <div className="text-xs text-[#6B7280]">Đã trao (Chờ em mở)</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#E6DCC8] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <div className="text-xl font-bold font-lora text-[#2F3E6B]">{stats.opened}</div>
            <div className="text-xs text-[#6B7280]">Đã mở & Khám phá</div>
          </div>
        </div>
      </div>

      {/* THANH TAB ĐIỀU HƯỚNG */}
      <div className="flex border-b border-[#E6DCC8] bg-[#FAF5EB]/50 rounded-2xl p-1.5 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'queue'
              ? 'bg-[#2F3E6B] text-white shadow-xs'
              : 'text-[#4B5563] hover:text-[#2F3E6B] hover:bg-[#FAF5EB]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Hàng đợi yêu cầu quà</span>
          {stats.pending > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#E2704A] text-white text-[10px] font-bold">
              {stats.pending}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'catalog'
              ? 'bg-[#2F3E6B] text-white shadow-xs'
              : 'text-[#4B5563] hover:text-[#2F3E6B] hover:bg-[#FAF5EB]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Danh mục mốc quà & Rương ({rewardsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'history'
              ? 'bg-[#2F3E6B] text-white shadow-xs'
              : 'text-[#4B5563] hover:text-[#2F3E6B] hover:bg-[#FAF5EB]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Lịch sử quà tặng</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: HÀNG ĐỢI YÊU CẦU QUÀ TẶNG */}
      {/* ======================================================== */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* THANH CÔNG CỤ LỌC & TÌM KIẾM */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FFFDF8] p-3.5 rounded-2xl border border-[#E6DCC8]">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Lọc lớp */}
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <Filter className="w-3.5 h-3.5 text-[#2F3E6B]" />
                <span>Lớp:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
                >
                  <option value="all">Tất cả các lớp</option>
                  {classList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lọc trạng thái */}
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <span>Trạng thái:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="PENDING_APPROVAL">Chờ duyệt ({stats.pending})</option>
                  <option value="APPROVED">Đã duyệt ({stats.approved})</option>
                  <option value="GIVEN">Đã trao ({stats.given})</option>
                  <option value="OPENED">Đã mở rương ({stats.opened})</option>
                  <option value="REJECTED">Từ chối ({stats.rejected})</option>
                </select>
              </div>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-[#8C7E6A] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên học sinh..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
              />
            </div>
          </div>

          {/* THANH THAO TÁC HÀNG LOẠT (KHI CÓ MỤC ĐƯỢC CHỌN) */}
          {selectedRequestIds.size > 0 && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#2F3E6B] text-white shadow-md animate-[fadeIn_0.15s_ease]">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Đã chọn {selectedRequestIds.size} yêu cầu</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBatchApprove}
                  disabled={batchActionLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Duyệt hàng loạt</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchGive}
                  disabled={batchActionLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Trao quà hàng loạt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRequestIds(new Set())}
                  className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs transition-colors"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}

          {/* BẢNG HÀNG ĐỢI YÊU CẦU */}
          {filteredQueue.length === 0 ? (
            <EmptyState
              icon={<Gift className="w-8 h-8 text-[#F2B84B]" />}
              title="Không có yêu cầu quà tặng nào"
              description={
                searchQuery || statusFilter !== 'all' || selectedClassId !== 'all'
                  ? 'Không tìm thấy yêu cầu phù hợp với bộ lọc hiện tại. Hãy thử thay đổi bộ lọc.'
                  : 'Học sinh khi đạt đủ mức XP tuần và số ngày điểm danh sẽ gửi yêu cầu mở rương tại đây.'
              }
            />
          ) : (
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF5EB] border-b border-[#E6DCC8] font-bold text-[#2F3E6B]">
                    <tr>
                      <th className="py-3 px-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRequestIds.size === filteredQueue.length && filteredQueue.length > 0}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded text-[#2F3E6B] border-[#D1C7B7] focus:ring-[#2F3E6B]"
                        />
                      </th>
                      <th className="py-3 px-3">Học sinh / Lớp</th>
                      <th className="py-3 px-3">Rương quà</th>
                      <th className="py-3 px-3">Số liệu thực tế</th>
                      <th className="py-3 px-3 text-center">Thẩm định điều kiện</th>
                      <th className="py-3 px-3">Thời điểm gửi</th>
                      <th className="py-3 px-3 text-center">Trạng thái</th>
                      <th className="py-3 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6DCC8]/60">
                    {filteredQueue.map((req) => {
                      const isSelected = selectedRequestIds.has(req.id);
                      const tier = req.reward ? CHEST_TIERS[req.reward.tierKey] : CHEST_TIERS.HAT;
                      const isPending = req.status === 'PENDING_APPROVAL';
                      const isApproved = req.status === 'APPROVED';
                      const isGiven = req.status === 'GIVEN';
                      const isOpened = req.status === 'OPENED';
                      const isRejected = req.status === 'REJECTED';

                      return (
                        <tr
                          key={req.id}
                          className={`hover:bg-[#FAF5EB]/50 transition-colors ${
                            isSelected ? 'bg-[#FAF5EB]' : ''
                          }`}
                        >
                          {/* CHECKBOX */}
                          <td className="py-3 px-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(req.id)}
                              className="w-4 h-4 rounded text-[#2F3E6B] border-[#D1C7B7] focus:ring-[#2F3E6B]"
                            />
                          </td>

                          {/* HỌC SINH */}
                          <td className="py-3 px-3 font-semibold text-[#2F3E6B]">
                            <div className="font-bold text-xs">{req.studentName}</div>
                            <div className="text-[11px] text-[#6B7280]">
                              Lớp {req.className || '7A2'}
                            </div>
                          </td>

                          {/* RƯƠNG QUÀ */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              {req.reward && (
                                <ChestIllustration
                                  tier={req.reward.tierKey}
                                  state={isOpened ? 'opened' : isGiven ? 'given' : isApproved ? 'approved' : 'eligible'}
                                  size={36}
                                  animationsEnabled={false}
                                />
                              )}
                              <div className="max-w-[200px]">
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                                  style={{
                                    backgroundColor: tier.badgeBg,
                                    color: tier.badgeText,
                                    borderColor: tier.borderColor,
                                  }}
                                >
                                  {tier.name}
                                </span>
                                <p className="text-[11px] text-[#4B5563] truncate mt-0.5">
                                  {req.reward?.teaserDescription || 'Rương bí mật'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* SỐ LIỆU THỰC TẾ (ĐỐI CHIẾU) */}
                          <td className="py-3 px-3 text-[11px]">
                            <div className="space-y-0.5">
                              <div>
                                XP tuần: <strong>{req.xpWeekActual ?? 0}</strong> /{' '}
                                <span className="text-[#6B7280]">{req.reward?.requiredXp || req.reward?.xpCost || 0} XP</span>
                              </div>
                              <div>
                                Điểm danh: <strong>{req.attendanceDaysActual ?? 0}</strong> /{' '}
                                <span className="text-[#6B7280]">{req.reward?.requiredAttendanceDays || 0} ngày</span>
                              </div>
                            </div>
                          </td>

                          {/* THẨM ĐỊNH ĐIỀU KIỆN */}
                          <td className="py-3 px-3 text-center">
                            {req.isEligible ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Đủ điều kiện</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-bold text-[11px]"
                                title="Số liệu thực tế thấp hơn mốc yêu cầu của rương"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Chưa đủ điều kiện!</span>
                              </span>
                            )}
                          </td>

                          {/* THỜI ĐIỂM GỬI */}
                          <td className="py-3 px-3 text-[#6B7280] font-mono text-[11px]">
                            {new Date(req.requestedAt).toLocaleString('vi-VN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* TRẠNG THÁI */}
                          <td className="py-3 px-3 text-center">
                            {isPending && (
                              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200">
                                Chờ duyệt
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200">
                                Đã duyệt (Chờ trao)
                              </span>
                            )}
                            {isGiven && (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                                Đã trao (Chờ mở)
                              </span>
                            )}
                            {isOpened && (
                              <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-bold text-[11px] border border-purple-200 flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                <span>Đã mở rương</span>
                              </span>
                            )}
                            {isRejected && (
                              <span
                                className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px] border border-rose-200"
                                title={req.rejectReason || 'Không có lý do'}
                              >
                                Đã từ chối
                              </span>
                            )}
                          </td>

                          {/* THAO TÁC */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApprove(req)}
                                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors shadow-xs"
                                    title="Duyệt yêu cầu"
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRejectModal(req)}
                                    className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition-colors"
                                    title="Từ chối yêu cầu kèm lý do nhẹ nhàng"
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}

                              {isApproved && (
                                <button
                                  type="button"
                                  onClick={() => handleGive(req)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shadow-xs flex items-center gap-1"
                                  title="Trao quà để kích hoạt nút 'Mở rương ngay!' trên màn hình học sinh"
                                >
                                  <Gift className="w-3.5 h-3.5" />
                                  <span>Trao quà</span>
                                </button>
                              )}

                              {isGiven && (
                                <span className="text-[11px] text-[#2E5E3D] font-semibold italic">
                                  Học sinh sắp mở...
                                </span>
                              )}

                              {isOpened && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (req.reward) {
                                      setPreviewingReward(req.reward);
                                      setPreviewModalOpen(true);
                                    }
                                  }}
                                  className="px-2 py-1 rounded-lg border border-[#D1C7B7] hover:bg-[#FAF5EB] text-[11px] text-[#4B5563]"
                                >
                                  Xem quà
                                </button>
                              )}

                              {isRejected && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRejectModal(req)}
                                  className="text-[11px] text-[#6B7280] hover:text-[#2F3E6B] underline"
                                  title="Xem lý do từ chối"
                                >
                                  Xem lý do
                                </button>
                              )}
                            </div>
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

      {/* ======================================================== */}
      {/* TAB 2: DANH MỤC MỐC QUÀ & RƯƠNG BÍ MẬT */}
      {/* ======================================================== */}
      {activeTab === 'catalog' && (
        <div className="space-y-5">
          {/* HEADER DANH MỤC */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#FFFDF8] p-4 rounded-2xl border border-[#E6DCC8]">
            <div>
              <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                Danh mục các mốc quà bí mật
              </h3>
              <p className="text-xs text-[#6B7280]">
                Học sinh chỉ nhìn thấy mô tả gợi mở và hình rương. Món quà thật chỉ hé lộ sau khi học sinh mở rương.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowSecretsInCatalog(!showSecretsInCatalog)}
                className="px-3.5 py-2 rounded-xl border border-[#D1C7B7] bg-[#FAF5EB] hover:bg-[#E6DCC8]/40 text-xs font-semibold text-[#2F3E6B] transition-colors flex items-center gap-1.5"
              >
                {showSecretsInCatalog ? <EyeOff className="w-4 h-4 text-[#E2704A]" /> : <Eye className="w-4 h-4 text-[#2F3E6B]" />}
                <span>{showSecretsInCatalog ? 'Ẩn món quà thật' : 'Xem món quà thật (GV)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingMilestone(null);
                  setMilestoneModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#2F3E6B] hover:bg-[#23325B] text-white text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm mốc quà mới</span>
              </button>
            </div>
          </div>

          {/* GRID CÁC MỐC QUÀ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4.5">
            {rewardsList.map((reward) => {
              const tier = CHEST_TIERS[reward.tierKey] || CHEST_TIERS.HAT;
              const isActive = reward.isActive !== false;

              return (
                <div
                  key={reward.id}
                  className={`bg-[#FFFDF8] border-2 rounded-3xl p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                    !isActive ? 'opacity-65 border-dashed border-gray-300' : ''
                  }`}
                  style={{ borderColor: isActive ? tier.borderColor : undefined }}
                >
                  <div>
                    {/* BADGE CẤP & TRẠNG THÁI */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: tier.badgeBg,
                          color: tier.badgeText,
                          borderColor: tier.borderColor,
                        }}
                      >
                        {tier.name} • {tier.sizeLabel}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isActive ? 'Đang mở' : 'Tạm ẩn'}
                      </span>
                    </div>

                    {/* MINH HỌA RƯƠNG TRỰC QUAN */}
                    <div className="flex justify-center my-3">
                      <ChestIllustration
                        tier={reward.tierKey}
                        state="eligible"
                        size={84}
                        animationsEnabled={false}
                      />
                    </div>

                    {/* MÔ TẢ GỢI MỞ (TEASER HỌC SINH THẤY) */}
                    <div className="space-y-1 mb-3">
                      <div className="text-[11px] font-bold text-[#8C7E6A] uppercase tracking-wider">
                        Gợi ý cho học sinh:
                      </div>
                      <p className="text-xs text-[#2F3E6B] italic font-medium leading-relaxed bg-[#FAF5EB] p-2.5 rounded-xl border border-[#E6DCC8]/70">
                        "{reward.teaserDescription}"
                      </p>
                    </div>

                    {/* ĐIỀU KIỆN ĐẠT */}
                    <div className="space-y-1 text-xs text-[#4B5563] pb-3 border-b border-[#E6DCC8]/60">
                      <div className="flex justify-between">
                        <span>XP tuần yêu cầu:</span>
                        <strong className="text-[#2F3E6B]">{reward.requiredXp || reward.xpCost} XP</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Điểm danh tối thiểu:</span>
                        <strong className="text-[#2F3E6B]">{reward.requiredAttendanceDays} ngày</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Số lượng còn:</span>
                        <span className="font-semibold text-[#8C7E6A]">
                          {reward.stock !== undefined ? `${reward.stock} suất` : 'Không giới hạn'}
                        </span>
                      </div>
                    </div>

                    {/* MÓN QUÀ THẬT (CHỈ GIÁO VIÊN THẤY) */}
                    <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                        <span>Món quà thật:</span>
                        <span className="text-[9px] bg-amber-200/60 px-1.5 py-0.5 rounded text-amber-900 font-semibold">
                          Chỉ GV thấy
                        </span>
                      </div>
                      {showSecretsInCatalog ? (
                        <div>
                          <h4 className="text-xs font-bold text-[#2F3E6B]">{reward.secret?.name}</h4>
                          <p className="text-[11px] text-[#6B7280] line-clamp-2 mt-0.5">
                            {reward.secret?.description}
                          </p>
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-900/60 italic flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Bấm "Xem món quà thật" ở góc trên để mở</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* THAO TÁC VỚI MỐC QUÀ */}
                  <div className="pt-4 mt-2 border-t border-[#E6DCC8]/60 flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewingReward(reward);
                        setPreviewModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[#D1C7B7] hover:bg-[#FAF5EB] text-[11px] font-semibold text-[#2F3E6B] transition-colors flex items-center gap-1"
                      title="Xem trước giao diện học sinh sẽ thấy"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#F2B84B]" />
                      <span>Xem trước</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMilestone(reward);
                          setMilestoneModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#2F3E6B]/10 hover:bg-[#2F3E6B]/20 text-[#2F3E6B] text-[11px] font-bold transition-colors"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingRewardId(reward.id);
                          setDeleteConfirmOpen(true);
                        }}
                        className="px-2 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 text-[11px] transition-colors"
                        title="Xóa mốc quà"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LỊCH SỬ QUÀ TẶNG THEO HỌC SINH VÀ LỚP */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* HEADER LỊCH SỬ & NÚT XUẤT CSV */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FFFDF8] p-3.5 rounded-2xl border border-[#E6DCC8]">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold text-[#2F3E6B]">Bộ lọc:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs font-semibold text-[#2F3E6B] focus:outline-none"
              >
                <option value="all">Tất cả lớp</option>
                {classList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#8C7E6A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Lọc theo tên học sinh..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#D1C7B7] bg-[#FFFDF8] text-xs text-[#2F3E6B] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportHistoryCSV}
              className="px-4 py-2 rounded-xl border border-[#2E5E3D] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Xuất lịch sử (Excel/CSV)</span>
            </button>
          </div>

          {historyList.length === 0 ? (
            <EmptyState
              icon={<History className="w-8 h-8 text-[#8C7E6A]" />}
              title="Chưa có lịch sử quà tặng"
              description="Khi giáo viên trao quà hoặc từ chối các yêu cầu, lịch sử chi tiết sẽ được ghi nhận tại đây."
            />
          ) : (
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF5EB] border-b border-[#E6DCC8] font-bold text-[#2F3E6B]">
                    <tr>
                      <th className="py-3 px-3.5">Thời điểm</th>
                      <th className="py-3 px-3">Học sinh</th>
                      <th className="py-3 px-3">Lớp</th>
                      <th className="py-3 px-3">Rương quà</th>
                      <th className="py-3 px-3 text-center">Trạng thái</th>
                      <th className="py-3 px-3">Món quà thật / Lời nhắn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6DCC8]/60">
                    {historyList
                      .filter((r) => (selectedClassId === 'all' ? true : r.classId === selectedClassId))
                      .filter((r) =>
                        searchQuery ? r.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) : true
                      )
                      .map((req) => (
                        <tr key={req.id} className="hover:bg-[#FAF5EB]/50">
                          <td className="py-3 px-3.5 text-[#6B7280] font-mono text-[11px]">
                            {new Date(req.requestedAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-3 px-3 font-bold text-[#2F3E6B]">
                            {req.studentName}
                          </td>
                          <td className="py-3 px-3 text-[#4B5563]">
                            {req.className}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-[#2F3E6B]">
                              {req.reward?.teaserDescription || 'Rương bí mật'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {req.status === 'GIVEN' && (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                Đã trao (Chờ mở)
                              </span>
                            )}
                            {req.status === 'OPENED' && (
                              <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-bold text-[11px] flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                <span>Đã mở rương</span>
                              </span>
                            )}
                            {req.status === 'REJECTED' && (
                              <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                                Từ chối
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[#4B5563] text-[11px]">
                            {req.status === 'REJECTED' ? (
                              <span className="text-rose-700 italic">"{req.rejectReason}"</span>
                            ) : req.status === 'OPENED' ? (
                              <span className="text-purple-900 font-semibold">
                                {req.reward?.secret?.name} (Em đã nhận)
                              </span>
                            ) : (
                              <span className="text-emerald-800">
                                {req.reward?.secret?.name} (Chờ em mở)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL TẠO / SỬA MỐC QUÀ */}
      {/* ======================================================== */}
      <RewardMilestoneModal
        isOpen={milestoneModalOpen}
        reward={editingMilestone}
        onClose={() => {
          setMilestoneModalOpen(false);
          setEditingMilestone(null);
        }}
        onSave={handleSaveMilestone}
      />

      {/* MODAL TỪ CHỐI NHẸ NHÀNG */}
      <RejectRewardModal
        isOpen={rejectModalOpen}
        request={rejectingRequest}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectingRequest(null);
        }}
        onConfirmReject={handleConfirmReject}
      />

      {/* MODAL XEM TRƯỚC PHÍA HỌC SINH */}
      <RewardStudentPreviewModal
        isOpen={previewModalOpen}
        reward={previewingReward}
        onClose={() => {
          setPreviewModalOpen(false);
          setPreviewingReward(null);
        }}
      />

      {/* MODAL XÁC NHẬN XÓA MỐC QUÀ */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Xóa mốc phần thưởng?"
        message="Học sinh sẽ không thể gửi yêu cầu đổi mốc quà này trong các tuần tới. Bạn có chắc chắn muốn xóa?"
        confirmLabel="Xóa ngay"
        variant="danger"
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeletingRewardId(null);
        }}
        onConfirm={handleDeleteMilestone}
      />
    </div>
  );
};
