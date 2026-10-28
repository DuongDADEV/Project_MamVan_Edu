import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  UserPlus,
  Download,
  KeyRound,
  Lock,
  Unlock,
  Trash2,
  ExternalLink,
  Layers,
  PlusCircle,
  MoreVertical,
  Edit2,
  Eye,
  EyeOff,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  Archive,
  ChevronLeft,
  BookOpen,
} from 'lucide-react';
import {
  ClassItem,
  StudentAccount,
  StudentCredentialVoucher,
  AuditLog,
} from '../../services/types.ts';
import { StudentState } from '../../types.ts';
import { PageHeader } from '../../components/teacher/ui/PageHeader.tsx';
import { DataTable, Column } from '../../components/teacher/ui/DataTable.tsx';
import { StatusBadge } from '../../components/teacher/ui/StatusBadge.tsx';
import { ConfirmDialog } from '../../components/teacher/ui/ConfirmDialog.tsx';
import { AddStudentModal } from '../../components/teacher/AddStudentModal.tsx';
import { CredentialVouchersModal } from '../../components/teacher/CredentialVouchersModal.tsx';
import { StudentProfileDrawer } from '../../components/teacher/StudentProfileDrawer.tsx';
import { exportStudentsList } from '../../utils/excelUtils.ts';
import { studentService, classService } from '../../services/index.ts';
import { MamMuc } from '../../components/MamMuc.tsx';

interface ClassesAndStudentsScreenProps {
  teacherId: string;
  classes: ClassItem[];
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  selectedClassId: string;
  onSelectClassId: (classId: string) => void;
  onRefreshData: () => void;
  isAddModalOpenInitially?: boolean;
  onCloseAddModalInitial?: () => void;
}

export const ClassesAndStudentsScreen: React.FC<ClassesAndStudentsScreenProps> = ({
  teacherId,
  classes,
  students,
  studentStates,
  selectedClassId,
  onSelectClassId,
  onRefreshData,
  isAddModalOpenInitially = false,
  onCloseAddModalInitial,
}) => {

  // Quản lý xem chi tiết lớp học
  const [detailClassId, setDetailClassId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'students' | 'assigned_content'>('students');

  // Sửa lớp & Sửa học sinh
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentAccount | null>(null);

  // Lọc
  const [classSearch, setClassSearch] = useState('');

  // Multi-select
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(isAddModalOpenInitially);
  const [voucherModalData, setVoucherModalData] = useState<{
    isOpen: boolean;
    vouchers: StudentCredentialVoucher[];
    title?: string;
  }>({ isOpen: false, vouchers: [] });

  const [drawerStudentId, setDrawerStudentId] = useState<string | null>(null);

  // Dialog xác nhận thao tác
  const resetCustomPasswordRef = useRef('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
  });

  // Modal tạo lớp mới
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassYear, setNewClassYear] = useState('2026-2027');
  const [newClassDesc, setNewClassDesc] = useState('');

  // Modal đổi lớp học sinh
  const [changeClassModal, setChangeClassModal] = useState<{
    isOpen: boolean;
    studentIds: string[];
    targetClassId: string;
  }>({
    isOpen: false,
    studentIds: [],
    targetClassId: classes[0]?.id || '',
  });

  // Bộ lọc quyền riêng tư: Giáo viên chỉ thấy học sinh thuộc các lớp mình quản lý
  const teacherClassIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes]);

  // Tính toán dữ liệu hiển thị học sinh kèm chỉ số thật từ StudentStates
  const enrichedStudents = useMemo(() => {
    return students
      .filter((s) => teacherClassIds.has(s.class_id))
      .map((s) => {
        const cls = classes.find((c) => c.id === s.class_id);
        const st = studentStates[s.id];
        const xpWeek = st?.xpWeek ?? 0;
        const totalXp = st?.totalXp ?? 0;
        const completedSteps = st?.completedSteps?.length ?? 0;
        // Giả sử có 20 bước học cơ bản tổng cộng
        const progressPercent = Math.min(100, Math.round((completedSteps / 20) * 100));

        return {
          ...s,
          className: cls ? `Lớp ${cls.name}` : s.class_id,
          xpWeek,
          totalXp,
          progressPercent,
        };
      });
  }, [students, classes, studentStates, teacherClassIds]);

  // --- CÁC HÀNH ĐỘNG HỌC SINH ---

  // Đặt lại mật khẩu: Thầy/Cô TỰ ĐẶT theo ý mình, hoặc để trống để hệ thống
  // sinh ngẫu nhiên — phiếu tài khoản hiện 1 lần sau khi đặt
  // Mật khẩu thật đã lưu mã hóa, bấm mắt là xem (chỉ giáo viên lớp mình/
  // admin — server kiểm tra scope). Em chưa có dữ liệu két (tạo trước khi
  // bật tính năng) thì báo đặt lại 1 lần để nạp két.
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  // Ô vừa copy (username:<id> hoặc password:<id>) — hiện "Đã copy!" 2 giây.
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback khi trình duyệt chặn clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedCell(key);
    setTimeout(() => setCopiedCell((prev) => (prev === key ? null : prev)), 2000);
  };
  // Lấy mật khẩu thật (đã hiện thì dùng luôn, chưa thì gọi API reveal rồi
  // giữ nguyên trạng thái hiện). Trả null khi chưa lưu két hoặc lỗi.
  const ensureRevealedPassword = async (studentId: string): Promise<string | null> => {
    const existing = revealedPasswords[studentId];
    if (existing) return existing;
    if (revealingId) return null;
    setRevealingId(studentId);
    try {
      const res = await studentService.getStudentPassword(studentId);
      if (!res.stored || !res.password) {
        alert('Chưa lưu mật khẩu xem được cho em này (em tạo trước khi bật tính năng). Đặt lại mật khẩu 1 lần là xem được.');
        return null;
      }
      const pw = res.password as string;
      setRevealedPasswords((prev) => ({ ...prev, [studentId]: pw }));
      return pw;
    } catch (e: any) {
      alert('Không xem được mật khẩu: ' + (e?.message || 'đã xảy ra lỗi'));
      return null;
    } finally {
      setRevealingId(null);
    }
  };
  const handleToggleRevealPassword = async (studentId: string) => {
    if (revealedPasswords[studentId]) {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      return;
    }
    await ensureRevealedPassword(studentId);
  };
  // Bấm vào mật khẩu là copy mật khẩu thật: chưa hiện thì reveal rồi copy.
  const handleCopyPassword = async (studentId: string) => {
    if (revealingId === studentId) return;
    const pw = await ensureRevealedPassword(studentId);
    if (!pw) return;
    await handleCopyText(`password:${studentId}`, pw);
  };

  const handleResetPassword = async (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    resetCustomPasswordRef.current = '';

    setConfirmDialog({
      isOpen: true,
      title: 'Đặt lại mật khẩu học sinh',
      message: (
        <div>
          Bạn có chắc chắn muốn đặt lại mật khẩu cho học sinh{' '}
          <strong className="text-[#2F3E6B]">{student.name}</strong> ({student.username})?
          <div className="mt-3 text-left">
            <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
              Mật khẩu mới (Thầy/Cô tự đặt)
            </label>
            <input
              type="text"
              autoComplete="off"
              placeholder="Để trống = hệ thống sinh ngẫu nhiên"
              onChange={(e) => {
                resetCustomPasswordRef.current = e.target.value;
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-100 outline-none text-sm text-[#1E1B4B] font-medium transition-all"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              Nếu tự đặt, mật khẩu cần tối thiểu 6 ký tự.
            </p>
          </div>
          <p className="mt-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            Sau khi đặt, hệ thống sẽ hiển thị phiếu tài khoản 1 lần để Thầy/Cô gửi cho em.
          </p>
        </div>
      ),
      confirmLabel: 'Đặt lại mật khẩu',
      variant: 'warning',
      action: async () => {
        const custom = resetCustomPasswordRef.current.trim();
        if (custom && custom.length < 6) {
          alert('Mật khẩu tự đặt cần tối thiểu 6 ký tự. Thầy/Cô nhập lại nhé.');
          return;
        }
        const res = await studentService.resetPassword(
          studentId,
          teacherId,
          custom || undefined
        );
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setVoucherModalData({
          isOpen: true,
          vouchers: withClassNames([res.credential]),
          title: 'Mật khẩu mới đã được đặt lại',
        });
        onRefreshData();
      },
    });
  };

  // Khóa / Mở khóa tài khoản
  const handleToggleLock = async (studentId: string, currentLocked: boolean) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    setConfirmDialog({
      isOpen: true,
      title: currentLocked ? 'Mở khóa tài khoản học sinh' : 'Tạm khóa tài khoản học sinh',
      message: currentLocked ? (
        <span>
          Cho phép học sinh <strong className="text-[#2F3E6B]">{student.name}</strong> đăng nhập và học tập trở lại bình thường?
        </span>
      ) : (
        <span>
          Khi khóa, học sinh <strong className="text-[#2F3E6B]">{student.name}</strong> sẽ không thể đăng nhập. Dữ liệu học tập và điểm số vẫn được bảo lưu an toàn.
        </span>
      ),
      confirmLabel: currentLocked ? 'Mở khóa ngay' : 'Khóa tài khoản',
      variant: currentLocked ? 'primary' : 'danger',
      action: async () => {
        await studentService.toggleLock(studentId, !currentLocked, teacherId);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        onRefreshData();
      },
    });
  };

  // Xóa học sinh (xóa vĩnh viễn, kèm tài khoản đăng nhập)
  const handleDeleteStudent = async (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Xóa học sinh khỏi danh sách lớp',
      message: (
        <div>
          Bạn có chắc chắn muốn xóa học sinh{' '}
          <strong className="text-[#2F3E6B]">{student.name}</strong>?
          <p className="mt-2 text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            Xóa vĩnh viễn: học sinh biến mất khỏi danh sách lớp, tài khoản đăng nhập bị thu hồi, toàn bộ điểm XP, bài nộp và kết quả học tập của em cũng bị xóa theo và không khôi phục được.
          </p>
        </div>
      ),
      confirmLabel: 'Xóa học sinh',
      variant: 'danger',
      action: async () => {
        await studentService.deleteStudent(studentId, teacherId);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        onRefreshData();
      },
    });
  };

  // Chuyển lớp hàng loạt hoặc 1 em
  const handleConfirmChangeClass = async () => {
    if (changeClassModal.studentIds.length === 0 || !changeClassModal.targetClassId) return;
    try {
      for (const sId of changeClassModal.studentIds) {
        await studentService.changeClass(sId, changeClassModal.targetClassId, teacherId);
      }
      setChangeClassModal({ isOpen: false, studentIds: [], targetClassId: '' });
      setSelectedStudentIds([]);
      onRefreshData();
    } catch (err: any) {
      alert('Không chuyển lớp được: ' + (err?.message || 'đã xảy ra lỗi, vui lòng thử lại'));
    }
  };

  // Khóa hàng loạt
  const handleBulkToggleLock = async (isLock: boolean) => {
    try {
      for (const sId of selectedStudentIds) {
        await studentService.toggleLock(sId, isLock, teacherId);
      }
      setSelectedStudentIds([]);
      onRefreshData();
    } catch (err: any) {
      alert('Không cập nhật được trạng thái khóa: ' + (err?.message || 'đã xảy ra lỗi'));
    }
  };

  // Xóa hàng loạt học sinh đã chọn (xác nhận trước vì xóa vĩnh viễn)
  const handleBulkDelete = () => {
    const idsToDelete = [...selectedStudentIds];
    const selected = students.filter((s) => idsToDelete.includes(s.id));
    if (selected.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: `Xóa ${selected.length} học sinh đã chọn`,
      message: (
        <div>
          Bạn có chắc chắn muốn xóa {selected.length} học sinh đã chọn (
          {selected.map((s) => s.name).join(', ')})?
          <p className="mt-2 text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            Xóa vĩnh viễn: các em biến mất khỏi danh sách lớp, tài khoản đăng nhập bị thu hồi, toàn bộ điểm XP, bài nộp và kết quả học tập cũng bị xóa theo và không khôi phục được.
          </p>
        </div>
      ),
      confirmLabel: 'Xóa vĩnh viễn',
      variant: 'danger',
      action: async () => {
        const failed: string[] = [];
        const succeeded: string[] = [];
        for (const sId of idsToDelete) {
          try {
            await studentService.deleteStudent(sId, teacherId);
            succeeded.push(sId);
          } catch {
            failed.push(students.find((s) => s.id === sId)?.name || sId);
          }
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setSelectedStudentIds((prev) => prev.filter((id) => !succeeded.includes(id)));
        onRefreshData();
        if (failed.length > 0) {
          alert(`Không xóa được ${failed.length} học sinh: ${failed.join(', ')}`);
        }
      },
    });
  };

  // Phiếu chỉ mang class_id; tên lớp lấy từ danh sách lớp đã tải (bản mock
  // cũ làm vậy, bản API GĐ3 đánh rơi className nên phiếu in ra UUID lớp).
  const withClassNames = (vouchers: StudentCredentialVoucher[]) =>
    vouchers.map((v) => ({
      ...v,
      className: classes.find((c) => c.id === v.class_id)?.name || v.className,
    }));

  // Tạo lớp mới
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const dup = classes.find(
      (c) =>
        c.name.trim().toLowerCase() === newClassName.trim().toLowerCase() &&
        c.schoolYear === (newClassYear.trim() || '2026-2027') &&
        c.status !== 'archived'
    );
    if (
      dup &&
      !window.confirm(
        `Đã có lớp "${dup.name}" (${dup.schoolYear}) đang hoạt động. Vẫn tạo thêm một lớp trùng tên?`
      )
    ) {
      return;
    }
    await classService.createClass({
      name: newClassName.trim(),
      grade: 'Lớp 7',
      schoolYear: newClassYear.trim() || '2026-2027',
      teacherId,
      description: newClassDesc.trim(),
      status: 'active',
    });
    setNewClassName('');
    setNewClassDesc('');
    setIsCreateClassModalOpen(false);
    onRefreshData();
  };

  // Cập nhật lớp học
  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    await classService.updateClass(editingClass.id, {
      name: editingClass.name.trim(),
      schoolYear: editingClass.schoolYear.trim(),
      status: editingClass.status,
      description: editingClass.description?.trim(),
    });
    setEditingClass(null);
    onRefreshData();
  };

  // Cập nhật thông tin học sinh
  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    await studentService.updateStudent(
      editingStudent.id,
      {
        name: editingStudent.name.trim(),
        student_code: editingStudent.student_code?.trim() || undefined,
        dob: editingStudent.dob || undefined,
        class_id: editingStudent.class_id,
      },
      teacherId
    );
    setEditingStudent(null);
    onRefreshData();
  };

  // Cột bảng dữ liệu học sinh
  const studentColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Họ và tên',
      sortable: true,
      render: (item) => (
        <div
          onClick={() => setDrawerStudentId(item.id)}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-full bg-[#2F3E6B]/10 text-[#2F3E6B] font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-[#2F3E6B] group-hover:text-white transition-colors">
            {item.name.charAt(item.name.lastIndexOf(' ') + 1) || 'H'}
          </div>
          <div>
            <span className="font-semibold text-[#2F3E6B] group-hover:text-[#E2704A] transition-colors block">
              {item.name}
            </span>
            {item.dob && (
              <span className="text-[10px] text-[#6B7280]">{item.dob}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'student_code',
      header: 'Mã HS',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-xs text-[#4B5563]">
          {item.student_code || '—'}
        </span>
      ),
    },
    {
      key: 'className',
      header: 'Lớp',
      sortable: true,
      render: (item) => (
        <span className="text-xs font-medium text-[#2F3E6B]">
          {item.className}
        </span>
      ),
    },
    {
      key: 'username',
      header: 'Tên đăng nhập',
      sortable: true,
      render: (item) => (
        <span className="inline-flex items-center gap-1.5">
          <span
            onClick={() => handleCopyText(`username:${item.id}`, item.username)}
            className="font-mono text-xs font-semibold text-[#2F3E6B] bg-[#FAF5EB] px-2 py-0.5 rounded border border-[#E6DCC8] cursor-pointer hover:border-[#2F3E6B] transition-colors"
            title="Bấm để copy tên đăng nhập"
          >
            {item.username}
          </span>
          {copiedCell === `username:${item.id}` && (
            <span className="text-[11px] font-medium text-green-700">Đã copy!</span>
          )}
        </span>
      ),
    },
    {
      key: 'password',
      header: 'Mật khẩu',
      // Mắt xem mật khẩu thật đã lưu mã hóa. Em chưa có dữ liệu két thì
      // báo đặt lại 1 lần để nạp két (không tự đặt lại im lặng).
      // Bấm vào chính mật khẩu là copy mật khẩu thật (chưa hiện thì
      // reveal rồi copy); mắt vẫn chỉ đổi hiện/ẩn, không copy.
      render: (item) => {
        const revealed = revealedPasswords[item.id];
        return (
          <span className="inline-flex items-center gap-1.5">
            <span
              onClick={() => handleCopyPassword(item.id)}
              className={`font-mono text-xs cursor-pointer ${revealed ? 'font-semibold text-[#2F3E6B]' : 'text-[#9CA3AF]'}`}
              title={revealed ? 'Bấm để copy mật khẩu' : 'Bấm để xem và copy mật khẩu thật'}
            >
              {revealed ?? '••••••••'}
            </span>
            <button
              type="button"
              onClick={() => handleToggleRevealPassword(item.id)}
              disabled={revealingId === item.id}
              className="p-1 rounded-md text-[#9CA3AF] hover:text-[#2F3E6B] hover:bg-[#FAF5EB] transition-colors disabled:opacity-50"
              title={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu thật'}
            >
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            {copiedCell === `password:${item.id}` && (
              <span className="text-[11px] font-medium text-green-700">Đã copy!</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortable: true,
      render: (item) => {
        if (item.status === 'locked') {
          return <StatusBadge status="locked" label="Tạm khóa" />;
        }
        if (!item.has_logged_in) {
          return <StatusBadge status="new" label="Chưa đăng nhập" />;
        }
        return <StatusBadge status="active" label="Hoạt động" />;
      },
    },
    {
      key: 'last_active_at',
      header: 'Lần học gần nhất',
      sortable: true,
      render: (item) => {
        if (!item.last_active_at) {
          return <span className="text-[11px] text-[#9CA3AF]">—</span>;
        }
        return (
          <span className="text-xs text-[#4B5563]">
            {new Date(item.last_active_at).toLocaleDateString('vi-VN', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        );
      },
    },
    {
      key: 'xpWeek',
      header: 'XP tuần',
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-xs text-[#E2704A]">
          +{item.xpWeek}
        </span>
      ),
    },
    {
      key: 'progressPercent',
      header: 'Tiến độ',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-[#FAF5EB] h-1.5 rounded-full overflow-hidden border border-[#E6DCC8]">
            <div
              className="bg-[#7FA88A] h-full"
              style={{ width: `${item.progressPercent}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-[#2F3E6B]">
            {item.progressPercent}%
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setDrawerStudentId(item.id)}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#2F3E6B] hover:bg-[#FAF5EB] transition-colors"
            title="Xem hồ sơ tóm tắt"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setEditingStudent(item)}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#2F3E6B] hover:bg-[#FAF5EB] transition-colors"
            title="Sửa thông tin học sinh"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleResetPassword(item.id)}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#E2704A] hover:bg-[#FAF5EB] transition-colors"
            title="Đặt lại mật khẩu"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleLock(item.id, item.status === 'locked')}
            className={`p-1.5 rounded-lg transition-colors ${
              item.status === 'locked'
                ? 'text-[#7FA88A] hover:bg-emerald-50'
                : 'text-[#6B7280] hover:text-rose-600 hover:bg-rose-50'
            }`}
            title={item.status === 'locked' ? 'Mở khóa' : 'Tạm khóa'}
          >
            {item.status === 'locked' ? (
              <Unlock className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleDeleteStudent(item.id)}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#DC2626] hover:bg-rose-50 transition-colors"
            title="Xóa học sinh"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const drawerStudent = students.find((s) => s.id === drawerStudentId) || null;
  const drawerStudentClass = classes.find((c) => c.id === drawerStudent?.class_id)?.name;

  const detailClass = classes.find((c) => c.id === detailClassId);
  const detailStudents = useMemo(() => {
    if (!detailClassId) return [];
    return enrichedStudents.filter((s) => s.class_id === detailClassId);
  }, [enrichedStudents, detailClassId]);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. GIAO DIỆN CHI TIẾT LỚP HỌC (NẾU ĐANG CHỌN XEM 1 LỚP CỤ THỂ) */}
      {/* ======================================================== */}
      {detailClass ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDetailClassId(null)}
              className="px-3.5 py-1.5 rounded-xl border border-[#E6DCC8] bg-[#FFFDF8] hover:bg-[#FAF5EB] text-xs font-semibold text-[#2F3E6B] flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Quay lại danh sách các lớp</span>
            </button>
          </div>

          {/* Banner thông tin lớp */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#2F3E6B] text-white flex items-center justify-center font-bold text-lg shadow-xs">
                {detailClass.name}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-lora text-2xl font-bold text-[#2F3E6B]">
                    Lớp {detailClass.name}
                  </h2>
                  <StatusBadge
                    status={detailClass.status === 'active' ? 'active' : 'archived'}
                    label={detailClass.status === 'active' ? 'Đang mở' : 'Đã lưu trữ'}
                  />
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {detailClass.grade} • Năm học: {detailClass.schoolYear} • Sĩ số:{' '}
                  <strong className="text-[#2F3E6B]">{detailClass.studentCount} em</strong> • Hoạt động 7 ngày qua:{' '}
                  <strong className="text-[#7FA88A]">{detailClass.active7DaysCount} em</strong>
                </p>
                {detailClass.description && (
                  <p className="text-xs text-[#4B5563] mt-1 italic">
                    "{detailClass.description}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingClass(detailClass)}
                className="px-3.5 py-2 rounded-xl border border-[#E6DCC8] bg-[#FFFDF8] hover:bg-[#FAF5EB] text-xs font-semibold text-[#2F3E6B] flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#2F3E6B]" />
                <span>Sửa lớp</span>
              </button>

              <button
                type="button"
                onClick={() => exportStudentsList(detailStudents, 'xlsx')}
                className="px-3.5 py-2 rounded-xl border border-[#E6DCC8] bg-[#FFFDF8] hover:bg-[#FAF5EB] text-xs font-semibold text-[#2F3E6B] flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-[#7FA88A]" />
                <span>Xuất danh sách (Excel)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectClassId(detailClass.id);
                  setIsAddModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4" />
                <span>Thêm học sinh</span>
              </button>
            </div>
          </div>

          {/* Hai Tabs: Học sinh · Nội dung được giao */}
          <div className="flex items-center gap-2 border-b border-[#E6DCC8] pb-3">
            <button
              type="button"
              onClick={() => setDetailTab('students')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                detailTab === 'students'
                  ? 'bg-[#2F3E6B] text-white shadow-xs'
                  : 'text-[#4B5563] hover:bg-[#FAF5EB] hover:text-[#2F3E6B]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Học sinh ({detailStudents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setDetailTab('assigned_content')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                detailTab === 'assigned_content'
                  ? 'bg-[#2F3E6B] text-white shadow-xs'
                  : 'text-[#4B5563] hover:bg-[#FAF5EB] hover:text-[#2F3E6B]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Nội dung được giao</span>
            </button>
          </div>

          {/* Nội dung tab chi tiết */}
          {detailTab === 'students' ? (
            <DataTable
              data={detailStudents}
              columns={studentColumns}
              keyExtractor={(item) => item.id}
              searchPlaceholder="Tìm kiếm học sinh trong lớp này..."
              selectable={true}
              selectedIds={selectedStudentIds}
              onSelectionChange={setSelectedStudentIds}
              emptyTitle="Lớp này chưa có học sinh nào"
              emptyDescription="Hãy bấm nút 'Thêm học sinh' để thêm các em vào lớp."
              emptyActionText="Thêm học sinh vào lớp"
              onEmptyAction={() => {
                onSelectClassId(detailClass.id);
                setIsAddModalOpen(true);
              }}
              bulkActions={(ids) => (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setChangeClassModal({
                        isOpen: true,
                        studentIds: ids,
                        targetClassId:
                          classes.find((c) => c.id !== detailClass.id && c.status !== 'archived')
                            ?.id || '',
                      })
                    }
                    className="px-2.5 py-1 rounded-lg border border-[#E6DCC8] bg-white hover:bg-[#FAF5EB] text-xs font-semibold text-[#2F3E6B] flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Chuyển lớp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkToggleLock(true)}
                    className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-800 flex items-center gap-1"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Khóa tài khoản</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkToggleLock(false)}
                    className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 flex items-center gap-1"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Mở khóa</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-2.5 py-1 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-800 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa đã chọn</span>
                  </button>
                </div>
              )}
            />
          ) : (
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-10 text-center space-y-4 shadow-xs">
              <MamMuc mood="thinking" size="lg" className="mx-auto" />
              <span className="inline-block px-3 py-1 rounded-full bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-semibold text-[#2F3E6B]">
                Để dành • Sắp ra mắt ở Prompt tiếp theo
              </span>
              <h3 className="font-lora text-xl font-bold text-[#2F3E6B]">
                Nội dung học tập được giao cho Lớp {detailClass.name}
              </h3>
              <p className="text-xs text-[#6B7280] max-w-lg mx-auto leading-relaxed">
                Mục này sẽ cho phép Thầy/Cô giao bài đọc, video ngữ liệu, phiếu bài tập và theo dõi tiến độ từng học sinh trong lớp {detailClass.name}. Tính năng này sẽ được triển khai ở bước tiếp theo.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* 2. GIAO DIỆN TỔNG QUAN DANH SÁCH HỌC SINH / CÁC LỚP */
        /* ======================================================== */
        <>
          {/* TIÊU ĐỀ TRANG & NÚT CHÍNH */}
          <PageHeader
            title="Quản lý Lớp & Học sinh"
            subtitle="Quản lý danh sách lớp, cấp tài khoản học tập tự động và theo dõi năng lực học sinh"
            actions={
              <button
                type="button"
                onClick={() => setIsCreateClassModalOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-[#E2704A]/25 transition-all active:scale-[0.98]"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tạo lớp mới</span>
              </button>
            }
          />

          {/* TÌM KIẾM LỚP */}
          <div className="flex items-center justify-between gap-3 border-b border-[#E6DCC8] pb-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7E6A]" />
              <input
                type="text"
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                placeholder="Tìm theo tên lớp..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E6DCC8] bg-[#FFFDF8] text-xs sm:text-sm text-[#2F3E6B] placeholder-[#8C7E6A]/60 focus:outline-none focus:border-[#2F3E6B] transition-colors"
              />
            </div>
            <span className="text-xs text-[#6B7280] font-medium">{classes.length} lớp học</span>
          </div>

          {/* ======================================================== */}
          {/* TAB 2: QUẢN LÝ LỚP HỌC */}
          {/* ======================================================== */}
          {(
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {classes.filter((cls) => cls.name.toLowerCase().includes(classSearch.trim().toLowerCase())).map((cls) => {
                const isSelected = selectedClassId === cls.id;

                return (
                  <div
                    key={cls.id}
                    className={`bg-[#FFFDF8] border rounded-2xl p-5 shadow-xs transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#2F3E6B] ring-2 ring-[#2F3E6B]/15'
                        : 'border-[#E6DCC8] hover:border-[#2F3E6B]/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center justify-center font-bold">
                            {cls.name}
                          </div>
                          <div>
                            <h3 className="font-lora font-bold text-lg text-[#2F3E6B]">
                              Lớp {cls.name}
                            </h3>
                            <p className="text-xs text-[#6B7280]">
                              {cls.grade} • Năm học {cls.schoolYear}
                            </p>
                          </div>
                        </div>

                        <StatusBadge
                          status={cls.status === 'active' ? 'active' : 'archived'}
                          label={cls.status === 'active' ? 'Đang mở' : 'Đã lưu trữ'}
                        />
                      </div>

                      {/* Dòng mô tả luôn chiếm đúng 1 dòng cố định (kể cả khi
                          trống) để khối số liệu của mọi thẻ lớp thẳng hàng nhau */}
                      <p className="text-xs text-[#4B5563] mb-4 h-4 line-clamp-1">
                        {cls.description || ''}
                      </p>

                      <div className="grid grid-cols-2 gap-2 p-3 bg-[#FAF5EB] rounded-xl border border-[#E6DCC8]/70 text-xs mb-4">
                        <div>
                          <span className="text-[#6B7280] block">Sĩ số học sinh:</span>
                          <strong className="font-lora text-base text-[#2F3E6B]">
                            {cls.studentCount} em
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#6B7280] block">Hoạt động 7 ngày:</span>
                          <strong className="font-lora text-base text-[#7FA88A]">
                            {cls.active7DaysCount} em
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#E6DCC8]/60 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailClassId(cls.id);
                          setDetailTab('students');
                        }}
                        className="font-semibold text-[#2F3E6B] hover:text-[#E2704A] transition-colors flex items-center gap-1"
                      >
                        <span>Vào lớp →</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingClass(cls)}
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#2F3E6B] hover:bg-[#FAF5EB] transition-colors"
                          title="Sửa thông tin lớp"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Lưu trữ lớp học',
                              message: (
                                <span>
                                  Bạn muốn lưu trữ lớp{' '}
                                  <strong className="text-[#2F3E6B]">{cls.name}</strong>?
                                  Lớp sẽ ẩn khỏi danh sách đang mở nhưng dữ liệu học sinh và điểm số vẫn được giữ nguyên.
                                </span>
                              ),
                              confirmLabel: 'Lưu trữ lớp',
                              variant: 'warning',
                              action: async () => {
                                await classService.archiveClass(cls.id);
                                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                                onRefreshData();
                              },
                            });
                          }}
                          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#FAF5EB] transition-colors"
                          title="Lưu trữ lớp"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Xóa vĩnh viễn lớp học',
                              message: (
                                <span>
                                  Bạn muốn xóa vĩnh viễn lớp{' '}
                                  <strong className="text-[#2F3E6B]">{cls.name}</strong>?
                                  {cls.studentCount > 0 && (
                                    <>
                                      {' '}Lớp đang có <strong>{cls.studentCount} học sinh</strong> — toàn bộ học sinh, tài khoản đăng nhập, điểm XP và bài nộp của lớp cũng bị xóa theo.
                                    </>
                                  )}
                                  <p className="mt-2 text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                                    Xóa lớp không khôi phục được. Nếu chỉ muốn ẩn lớp khỏi danh sách đang mở mà vẫn giữ dữ liệu, hãy dùng Lưu trữ lớp thay vì Xóa.
                                  </p>
                                </span>
                              ),
                              confirmLabel: 'Xóa vĩnh viễn',
                              variant: 'danger',
                              action: async () => {
                                await classService.deleteClass(cls.id);
                                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                                onRefreshData();
                              },
                            });
                          }}
                          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#DC2626] hover:bg-rose-50 transition-colors"
                          title="Xóa vĩnh viễn lớp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL THÊM HỌC SINH (NHẬP TAY / EXCEL) */}
      {/* ======================================================== */}
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          if (onCloseAddModalInitial) onCloseAddModalInitial();
        }}
        classes={classes}
        defaultClassId={selectedClassId}
        existingStudents={students}
        teacherId={teacherId}
        onStudentsCreated={(vouchers) => {
          setVoucherModalData({
            isOpen: true,
            vouchers: withClassNames(vouchers),
            title: 'Phiếu tài khoản học sinh vừa tạo',
          });
          onRefreshData();
        }}
      />

      {/* ======================================================== */}
      {/* MODAL PHIẾU TÀI KHOẢN (CREDENTIAL VOUCHERS - HIỆN 1 LẦN) */}
      {/* ======================================================== */}
      <CredentialVouchersModal
        isOpen={voucherModalData.isOpen}
        onClose={() => setVoucherModalData({ isOpen: false, vouchers: [] })}
        vouchers={voucherModalData.vouchers}
        title={voucherModalData.title}
      />

      {/* ======================================================== */}
      {/* DRAWER HỒ SƠ TÓM TẮT HỌC SINH */}
      {/* ======================================================== */}
      <StudentProfileDrawer
        isOpen={!!drawerStudentId}
        onClose={() => setDrawerStudentId(null)}
        student={drawerStudent}
        className={drawerStudentClass}
        studentState={drawerStudent ? studentStates[drawerStudent.id] : null}
        onResetPassword={(id) => {
          setDrawerStudentId(null);
          handleResetPassword(id);
        }}
        onToggleLock={(id, currentLocked) => {
          setDrawerStudentId(null);
          handleToggleLock(id, currentLocked);
        }}
        onChangeClass={(id) => {
          setDrawerStudentId(null);
          setChangeClassModal({
            isOpen: true,
            studentIds: [id],
            // Mặc định chọn lớp KHÁC lớp hiện tại của học sinh (và chưa lưu trữ)
            targetClassId:
              classes.find(
                (c) => c.id !== drawerStudent?.class_id && c.status !== 'archived'
              )?.id || '',
          });
        }}
        onEditStudent={(s) => {
          setDrawerStudentId(null);
          setEditingStudent(s);
        }}
      />

      {/* ======================================================== */}
      {/* DIALOG XÁC NHẬN CHUNG (CONFIRM DIALOG) */}
      {/* ======================================================== */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.action}
      />

      {/* ======================================================== */}
      {/* MODAL TẠO LỚP HỌC MỚI */}
      {/* ======================================================== */}
      {isCreateClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B4B]/40 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="font-lora text-xl font-bold text-[#2F3E6B] mb-2">
              Tạo lớp học mới
            </h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Thêm một lớp học mới vào tài khoản giảng dạy của bạn
            </p>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Tên lớp (*)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 7A4"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs sm:text-sm text-[#2F3E6B] outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Năm học
                </label>
                <input
                  type="text"
                  required
                  placeholder="2026-2027"
                  value={newClassYear}
                  onChange={(e) => setNewClassYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs sm:text-sm text-[#2F3E6B] outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Mô tả / Ghi chú
                </label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Lớp chọn văn học buổi sáng..."
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs sm:text-sm text-[#2F3E6B] outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6DCC8]">
                <button
                  type="button"
                  onClick={() => setIsCreateClassModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E6DCC8] text-xs font-semibold text-[#4B5563]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold transition-all shadow-xs"
                >
                  Tạo lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL CHUYỂN LỚP HỌC SINH */}
      {/* ======================================================== */}
      {changeClassModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B4B]/40 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="font-lora text-xl font-bold text-[#2F3E6B] mb-2">
              Chuyển lớp học
            </h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Đang chọn {changeClassModal.studentIds.length} học sinh để chuyển lớp
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1.5">
                  Chọn lớp chuyển tới:
                </label>
                <select
                  value={changeClassModal.targetClassId}
                  onChange={(e) =>
                    setChangeClassModal((prev) => ({
                      ...prev,
                      targetClassId: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E6DCC8] bg-white text-xs text-[#2F3E6B] outline-none"
                >
                  {classes
                    .filter((cls) => cls.status !== 'archived')
                    .map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        Lớp {cls.name} ({cls.schoolYear})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6DCC8]">
                <button
                  type="button"
                  onClick={() =>
                    setChangeClassModal({
                      isOpen: false,
                      studentIds: [],
                      targetClassId: '',
                    })
                  }
                  className="px-4 py-2 rounded-xl border border-[#E6DCC8] text-xs font-semibold text-[#4B5563]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmChangeClass}
                  className="px-5 py-2 rounded-xl bg-[#2F3E6B] hover:bg-[#253256] text-white text-xs font-bold transition-all shadow-xs"
                >
                  Xác nhận chuyển
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL SỬA THÔNG TIN LỚP HỌC */}
      {/* ======================================================== */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B4B]/40 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="font-lora text-xl font-bold text-[#2F3E6B] mb-2">
              Chỉnh sửa thông tin lớp
            </h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Cập nhật tên lớp, năm học và trạng thái lưu trữ của lớp
            </p>

            <form onSubmit={handleUpdateClass} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Tên lớp (*)
                </label>
                <input
                  type="text"
                  required
                  value={editingClass.name}
                  onChange={(e) =>
                    setEditingClass({ ...editingClass, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs sm:text-sm text-[#2F3E6B] outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Năm học
                </label>
                <input
                  type="text"
                  required
                  value={editingClass.schoolYear}
                  onChange={(e) =>
                    setEditingClass({ ...editingClass, schoolYear: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs sm:text-sm text-[#2F3E6B] outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Trạng thái lớp
                </label>
                <select
                  value={editingClass.status}
                  onChange={(e) =>
                    setEditingClass({
                      ...editingClass,
                      status: e.target.value as 'active' | 'archived',
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs text-[#2F3E6B] outline-none"
                >
                  <option value="active">Đang mở (Hoạt động)</option>
                  <option value="archived">Đã lưu trữ</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Mô tả / Ghi chú
                </label>
                <textarea
                  rows={2}
                  value={editingClass.description || ''}
                  onChange={(e) =>
                    setEditingClass({ ...editingClass, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs sm:text-sm text-[#2F3E6B] outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6DCC8]">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 rounded-xl border border-[#E6DCC8] text-xs font-semibold text-[#4B5563]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2F3E6B] hover:bg-[#253256] text-white text-xs font-bold transition-all shadow-xs"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL SỬA THÔNG TIN HỌC SINH */}
      {/* ======================================================== */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B4B]/40 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="font-lora text-xl font-bold text-[#2F3E6B] mb-2">
              Sửa thông tin học sinh
            </h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Cập nhật hồ sơ học tập của tài khoản{' '}
              <strong className="font-mono text-[#2F3E6B]">{editingStudent.username}</strong>
            </p>

            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Họ và tên học sinh (*)
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs sm:text-sm text-[#2F3E6B] outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Lớp học
                </label>
                <select
                  value={editingStudent.class_id}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, class_id: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs text-[#2F3E6B] outline-none"
                >
                  {classes
                    .filter((cls) => cls.status !== 'archived')
                    .map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        Lớp {cls.name} ({cls.schoolYear})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Mã học sinh
                </label>
                <input
                  type="text"
                  value={editingStudent.student_code || ''}
                  onChange={(e) =>
                    setEditingStudent({
                      ...editingStudent,
                      student_code: e.target.value,
                    })
                  }
                  placeholder="HS7A2-..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs sm:text-sm text-[#2F3E6B] outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#2F3E6B] block mb-1">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={editingStudent.dob || ''}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, dob: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E6DCC8] bg-white text-xs sm:text-sm text-[#2F3E6B] outline-none focus:border-[#2F3E6B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6DCC8]">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl border border-[#E6DCC8] text-xs font-semibold text-[#4B5563]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2F3E6B] hover:bg-[#253256] text-white text-xs font-bold transition-all shadow-xs"
                >
                  Cập nhật thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
