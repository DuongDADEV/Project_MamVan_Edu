import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  UserPlus,
  FileSpreadsheet,
  Plus,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { ClassItem, CreateStudentInput, StudentAccount, StudentCredentialVoucher } from '../../services/types.ts';
import { ownedClasses } from '../../logic/teacherScope.ts';
import { studentService } from '../../services/index.ts';
import { FileDropzone } from './ui/FileDropzone.tsx';
import {
  downloadStudentTemplateExcel,
  parseUploadedExcel,
  ParsedStudentRow,
} from '../../utils/excelUtils.ts';
import { generateUsername, generateFriendlyPassword } from '../../services/mock/credentialUtils.ts';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassItem[];
  defaultClassId: string;
  existingStudents: StudentAccount[];
  onStudentsCreated: (credentials: StudentCredentialVoucher[]) => void;
  teacherId: string;
}

interface ManualRow {
  id: string;
  name: string;
  class_id: string;
  student_code: string;
  dob: string;
  custom_username?: string;
  auto_username?: string;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  isOpen,
  onClose,
  classes,
  defaultClassId,
  existingStudents,
  onStudentsCreated,
  teacherId,
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- STATE TAB NHẬP TAY ---
  // Lớp đã lưu trữ không nhận thêm học sinh.
  // 26/10: chỉ cho lớp CỦA GIÁO VIÊN NÀY — trước đây danh sách có thể
  // lẫn lớp của giáo viên khác (lỗi thời/lẫn), chọn nhầm là máy chủ
  // từ chối CLASS_NOT_OWNED. Chế độ mock/legacy giữ nguyên.
  const selectableClasses = useMemo(
    () => ownedClasses(classes, teacherId).filter((c) => c.status !== 'archived'),
    [classes, teacherId]
  );
  const activeClassId =
    selectableClasses.length === 0
      ? ''
      : defaultClassId !== 'all' &&
          selectableClasses.some((c) => c.id === defaultClassId)
        ? defaultClassId
        : selectableClasses[0].id;

  const [manualRows, setManualRows] = useState<ManualRow[]>([
    {
      id: '1',
      name: '',
      class_id: activeClassId,
      student_code: '',
      dob: '',
      auto_username: '',
    },
  ]);

  const handleAddManualRow = () => {
    setManualRows((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        name: '',
        class_id: activeClassId,
        student_code: '',
        dob: '',
        auto_username: '',
      },
    ]);
  };

  const handleRemoveManualRow = (id: string) => {
    if (manualRows.length <= 1) return;
    setManualRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Lớp có thể bị xóa/tạo lại trong lúc modal đang mở (lớp cũ mất khỏi
  // danh sách nhưng dòng vẫn giữ class_id cũ) → kẹt ở alert "không thuộc
  // tài khoản này" dù dropdown vẫn hiện tên lớp cũ. Tự chuyển các dòng
  // sai về lớp đang chọn khi danh sách lớp đổi; không đổi gì khi đã đúng.
  useEffect(() => {
    if (!activeClassId) return;
    setManualRows((prev) => {
      const fixed = prev.map((r) =>
        selectableClasses.some((c) => c.id === r.class_id)
          ? r
          : { ...r, class_id: activeClassId }
      );
      return fixed.some((r, i) => r.class_id !== prev[i].class_id) ? fixed : prev;
    });
  }, [selectableClasses, activeClassId]);

  const handleUpdateManualRow = (id: string, field: keyof ManualRow, value: string) => {
    setManualRows((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== id) return r;
        const newRow = { ...r, [field]: value };

        // Nếu sửa họ tên, tự động tính lại auto_username
        if (field === 'name') {
          if (value.trim()) {
            const allOtherUsernames = [
              ...existingStudents.map((s) => s.username.toLowerCase()),
              ...prev
                .filter((o) => o.id !== id)
                .map((o) => (o.custom_username !== undefined ? o.custom_username : (o.auto_username || '')).toLowerCase())
                .filter(Boolean),
            ];
            newRow.auto_username = generateUsername(value.trim(), allOtherUsernames);
          } else {
            newRow.auto_username = '';
          }
        }
        return newRow;
      });
      return updated;
    });
  };

  // Kiểm tra trùng username theo thời gian thực
  const isUsernameDuplicated = (rowId: string, username: string) => {
    if (!username) return false;
    const u = username.toLowerCase().trim();
    const inDb = existingStudents.some((s) => s.username.toLowerCase() === u);
    const inOtherRows = manualRows.some((r) => {
      if (r.id === rowId) return false;
      const otherU = (r.custom_username !== undefined ? r.custom_username : (r.auto_username || '')).toLowerCase().trim();
      return otherU === u;
    });
    return inDb || inOtherRows;
  };

  // --- STATE TAB NHẬP EXCEL ---
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [excelRows, setExcelRows] = useState<ParsedStudentRow[]>([]);
  const [excelSummary, setExcelSummary] = useState<{
    validCount: number;
    errorCount: number;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileSelected = async (file: File) => {
    setUploadedFile(file);
    setIsParsing(true);
    try {
      const classNames = selectableClasses.map((c) => c.name);
      const defaultClsName = selectableClasses.find((c) => c.id === activeClassId)?.name || '';
      const result = await parseUploadedExcel(file, existingStudents, classNames, defaultClsName);
      setExcelRows(result.rows);
      setExcelSummary({ validCount: result.validCount, errorCount: result.errorCount });
    } catch (e: any) {
      console.error('Lỗi khi đọc file Excel:', e);
      setExcelRows([]);
      setExcelSummary(null);
      alert(
        'Không đọc được file Excel này (file hỏng hoặc sai định dạng). Vui lòng kiểm tra lại file và thử lại!'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleClearExcelFile = () => {
    setUploadedFile(null);
    setExcelRows([]);
    setExcelSummary(null);
  };

  // Sửa trực tiếp ô lỗi trên bảng Excel preview
  const handleEditExcelCell = (
    index: number,
    field: 'name' | 'className' | 'studentCode' | 'dob',
    val: string
  ) => {
    const updated = [...excelRows];
    updated[index] = { ...updated[index], [field]: val };

    // Tái kiểm tra dòng đó — gồm cả trùng Mã HS như lúc đọc file
    // (trước đây sửa ô xong là mất cảnh báo trùng mã)
    const row = updated[index];
    const errors: string[] = [];
    if (!row.name.trim()) errors.push('Thiếu họ và tên');
    else if (row.name.trim().length < 2) errors.push('Họ và tên quá ngắn');
    if (!row.className.trim()) errors.push('Thiếu lớp học');
    const code = row.studentCode?.trim().toLowerCase();
    if (code) {
      const dupExisting = existingStudents.some(
        (st) => st.student_code?.trim().toLowerCase() === code
      );
      const dupInBatch = updated.some(
        (r, i) => i !== index && r.studentCode?.trim().toLowerCase() === code
      );
      if (dupExisting || dupInBatch) errors.push('Mã HS bị trùng lặp');
    }
    row.errors = errors;
    row.isValid = errors.length === 0;

    const validCount = updated.filter((r) => r.isValid).length;
    setExcelRows(updated);
    setExcelSummary({ validCount, errorCount: updated.length - validCount });
  };

  const handleRemoveExcelRow = (index: number) => {
    const updated = excelRows.filter((_, i) => i !== index);
    const validCount = updated.filter((r) => r.isValid).length;
    setExcelRows(updated);
    setExcelSummary({ validCount, errorCount: updated.length - validCount });
  };

  // --- SUBMIT TẠO TÀI KHOẢN ---
  const handleSubmitManual = async () => {
    const nonEmptyRows = manualRows.filter((r) => r.name.trim().length > 0);

    if (nonEmptyRows.length === 0) {
      alert('Vui lòng nhập ít nhất họ và tên cho 1 học sinh!');
      return;
    }

    // Kiểm tra trùng username
    for (const r of nonEmptyRows) {
      const u = (r.custom_username !== undefined ? r.custom_username : (r.auto_username || '')).trim();
      if (isUsernameDuplicated(r.id, u)) {
        alert(`Tên đăng nhập "${u}" của học sinh "${r.name}" đang bị trùng lặp. Vui lòng đổi sang tên đăng nhập khác!`);
        return;
      }
    }

    const validInputs: CreateStudentInput[] = nonEmptyRows.map((r) => {
      const u = (r.custom_username !== undefined ? r.custom_username : (r.auto_username || '')).trim();
      return {
        name: r.name.trim(),
        class_id: r.class_id,
        student_code: r.student_code.trim() || undefined,
        custom_username: u || undefined,
      };
    });

    // 26/10: chặn từ giao diện thay vì để máy chủ trả CLASS_NOT_OWNED.
    if (selectableClasses.length === 0 || !activeClassId) {
      alert('Chưa có lớp nào thuộc tài khoản này — tạo lớp trước rồi thêm học sinh sau!');
      return;
    }
    for (const r of validInputs) {
      if (!selectableClasses.some((c) => c.id === r.class_id)) {
        alert(`Lớp đã chọn cho học sinh "${r.name}" không thuộc tài khoản này. Tải lại trang rồi chọn lại lớp của mình!`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await studentService.createStudentsBatch(validInputs, teacherId);
      if (res.credentials.length > 0) {
        onStudentsCreated(res.credentials);
        onClose();
      }
      if (res.errors.length > 0) {
        alert(
          `Không tạo được ${res.errors.length} học sinh:\n` +
            res.errors.map((e) => `- ${e.name}: ${e.message}`).join('\n')
        );
      }
    } catch (e: any) {
      alert('Đã xảy ra lỗi khi tạo tài khoản: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitExcel = async () => {
    const validRows = excelRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('Chưa có dòng hợp lệ nào để tạo tài khoản!');
      return;
    }

    setIsSubmitting(true);
    try {
      const inputs: CreateStudentInput[] = validRows.map((r) => {
        // Tìm class_id từ className — chỉ trong lớp của giáo viên này.
        const cls = selectableClasses.find(
          (c) => c.name.toLowerCase() === r.className.trim().toLowerCase()
        );
        return {
          name: r.name.trim(),
          class_id: cls ? cls.id : activeClassId,
          student_code: r.studentCode?.trim() || undefined,
        };
      });

      if (selectableClasses.length === 0 || !activeClassId) {
        alert('Chưa có lớp nào thuộc tài khoản này — tạo lớp trước rồi thêm học sinh sau!');
        return;
      }
      for (const inp of inputs) {
        if (!selectableClasses.some((c) => c.id === inp.class_id)) {
          alert(`Lớp "${inp.class_id}" của học sinh "${inp.name}" không thuộc tài khoản này. Tải lại trang rồi chọn lại lớp của mình!`);
          return;
        }
      }

      const res = await studentService.createStudentsBatch(inputs, teacherId);
      if (res.credentials.length > 0) {
        onStudentsCreated(res.credentials);
        onClose();
      }
      if (res.errors.length > 0) {
        alert(
          `Không tạo được ${res.errors.length} học sinh từ Excel:\n` +
            res.errors.map((e) => `- ${e.name}: ${e.message}`).join('\n')
        );
      }
    } catch (e: any) {
      alert('Đã xảy ra lỗi khi tạo tài khoản từ Excel: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1E1B4B]/50 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative my-auto animate-[scaleUp_0.15s_ease] max-h-[92vh] flex flex-col">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[#9CA3AF] hover:text-[#2F3E6B] hover:bg-[#FAF5EB] transition-colors"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E2704A]/10 text-[#E2704A] flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <h2 className="font-lora text-2xl font-bold text-[#2F3E6B]">
              Thêm học sinh & Cấp tài khoản tự động
            </h2>
          </div>
          <p className="text-xs text-[#6B7280] mt-1 ml-11">
            Hệ thống sẽ tự động sinh tên đăng nhập không dấu và mật khẩu 8 ký tự an toàn.
          </p>
        </div>

        {/* 2 Tabs chuyển đổi phương thức */}
        <div className="flex items-center gap-2 border-b border-[#E6DCC8] pb-2 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-[#2F3E6B] text-white shadow-xs'
                : 'text-[#4B5563] hover:bg-[#FAF5EB] hover:text-[#2F3E6B]'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Cách 1: Nhập tay trực tiếp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'excel'
                ? 'bg-[#2F3E6B] text-white shadow-xs'
                : 'text-[#4B5563] hover:bg-[#FAF5EB] hover:text-[#2F3E6B]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Cách 2: Nhập từ file Excel (.xlsx)</span>
          </button>
        </div>

        {/* NỘI DUNG TAB 1: NHẬP TAY */}
        {activeTab === 'manual' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="p-3 bg-[#FAF5EB] rounded-2xl border border-[#E6DCC8]/70 flex items-start gap-2.5 text-xs text-[#4B5563]">
              <ShieldCheck className="w-4 h-4 text-[#7FA88A] shrink-0 mt-0.5" />
              <span>
                <strong>Bảo vệ quyền riêng tư học sinh:</strong> Chỉ nhập các thông tin cần thiết phục vụ học tập (Họ tên, Lớp). Bấm phím <strong>Tab</strong> để di chuyển nhanh giữa các ô.
              </span>
            </div>

            <div className="border border-[#E6DCC8] rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF5EB] border-b border-[#E6DCC8] font-semibold text-[#2F3E6B]">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Họ và tên học sinh (*)</th>
                    <th className="py-2.5 px-3 w-28">Lớp</th>
                    <th className="py-2.5 px-3 w-28">Mã HS</th>
                    <th className="py-2.5 px-3 w-40">Tên đăng nhập (tự sinh / sửa)</th>
                    <th className="py-2.5 px-3 w-10 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6DCC8]/60">
                  {manualRows.map((row, idx) => {
                    const currentUsername = row.custom_username !== undefined ? row.custom_username : (row.auto_username || '');
                    const isDup = isUsernameDuplicated(row.id, currentUsername);

                    return (
                      <tr key={row.id} className="hover:bg-[#FAF5EB]/40">
                        <td className="py-2 px-3 text-center text-[#9CA3AF] font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            required
                            value={row.name}
                            onChange={(e) =>
                              handleUpdateManualRow(row.id, 'name', e.target.value)
                            }
                            placeholder="Ví dụ: Nguyễn Minh Anh"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6DCC8] bg-white focus:border-[#2F3E6B] focus:ring-2 focus:ring-[#2F3E6B]/10 outline-none text-xs text-[#2F3E6B]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={row.class_id}
                            onChange={(e) =>
                              handleUpdateManualRow(row.id, 'class_id', e.target.value)
                            }
                            className="w-full px-2 py-1.5 rounded-lg border border-[#E6DCC8] bg-white focus:border-[#2F3E6B] outline-none text-xs text-[#2F3E6B]"
                          >
                            {selectableClasses.map((c) => (
                              <option key={c.id} value={c.id}>
                                Lớp {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.student_code}
                            onChange={(e) =>
                              handleUpdateManualRow(row.id, 'student_code', e.target.value)
                            }
                            placeholder="Tự động"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6DCC8] bg-white focus:border-[#2F3E6B] outline-none text-xs text-[#2F3E6B]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="relative">
                            <input
                              type="text"
                              value={currentUsername}
                              onChange={(e) =>
                                handleUpdateManualRow(row.id, 'custom_username', e.target.value.toLowerCase().replace(/\s+/g, ''))
                              }
                              placeholder="vd: anhnm27"
                              className={`w-full font-mono text-xs px-2.5 py-1.5 rounded-lg border outline-none transition-colors ${
                                isDup
                                  ? 'border-rose-400 bg-rose-50/50 text-rose-800 ring-1 ring-rose-300'
                                  : 'border-[#E6DCC8] bg-white focus:border-[#2F3E6B] text-[#2F3E6B]'
                              }`}
                            />
                            {isDup && (
                              <span className="text-[10px] text-rose-600 block mt-0.5 leading-tight font-sans">
                                ⚠ Trùng tên đăng nhập
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveManualRow(row.id)}
                            disabled={manualRows.length <= 1}
                            className="p-1 rounded text-[#9CA3AF] hover:text-[#DC2626] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Xóa dòng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleAddManualRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E6DCC8] bg-[#FAF5EB] hover:bg-white text-xs font-semibold text-[#2F3E6B] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm dòng (nhập tiếp em tiếp theo)</span>
            </button>
          </div>
        )}

        {/* NỘI DUNG TAB 2: NHẬP EXCEL */}
        {activeTab === 'excel' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Thanh tải file mẫu */}
            <div className="flex items-center justify-between p-3.5 bg-[#FAF5EB] rounded-2xl border border-[#E6DCC8] text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#7FA88A]" />
                <div>
                  <p className="font-semibold text-[#2F3E6B]">
                    Chưa có danh sách mẫu? Tải file mẫu chuẩn tại đây
                  </p>
                  <p className="text-[#6B7280]">
                    File gồm 2 sheet: Cột dữ liệu mẫu và Sheet hướng dẫn chi tiết
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadStudentTemplateExcel}
                className="px-3.5 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-semibold text-[#2F3E6B] flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-[#E2704A]" />
                <span>Tải file mẫu (.xlsx)</span>
              </button>
            </div>

            {/* Vùng kéo thả FileDropzone */}
            <FileDropzone
              selectedFile={uploadedFile}
              onFileSelected={handleFileSelected}
              onClearFile={handleClearExcelFile}
            />

            {/* Bảng xem trước & kiểm tra lỗi */}
            {excelRows.length > 0 && (
              <div className="space-y-3">
                {/* Banner tóm tắt */}
                {excelSummary && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[#2F3E6B]">
                        Đã đọc {excelRows.length} dòng
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#2E5E3D] font-medium bg-[#7FA88A]/20 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        {excelSummary.validCount} dòng hợp lệ
                      </span>
                      {excelSummary.errorCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[#DC2626] font-medium bg-rose-100 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          {excelSummary.errorCount} dòng cần sửa
                        </span>
                      )}
                    </div>
                    <span className="text-[#6B7280]">
                      Có thể bấm trực tiếp vào ô để sửa lỗi
                    </span>
                  </div>
                )}

                {/* Bảng dữ liệu đã đọc */}
                <div className="border border-[#E6DCC8] rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF5EB] border-b border-[#E6DCC8] sticky top-0 font-semibold text-[#2F3E6B]">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">Dòng</th>
                        <th className="py-2.5 px-3">Họ và tên</th>
                        <th className="py-2.5 px-3 w-28">Lớp</th>
                        <th className="py-2.5 px-3 w-28">Mã HS</th>
                        <th className="py-2.5 px-3">Trạng thái kiểm tra</th>
                        <th className="py-2.5 px-3 w-10 text-center">Bỏ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6DCC8]/60">
                      {excelRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-[#FAF5EB]/50 ${
                            !row.isValid ? 'bg-rose-50/60' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center text-[#9CA3AF] font-mono">
                            {row.rowNumber}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) =>
                                handleEditExcelCell(idx, 'name', e.target.value)
                              }
                              className={`w-full px-2 py-1 rounded border text-xs ${
                                !row.name
                                  ? 'border-rose-400 bg-white ring-1 ring-rose-200'
                                  : 'border-[#E6DCC8] bg-white'
                              }`}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.className}
                              onChange={(e) =>
                                handleEditExcelCell(idx, 'className', e.target.value)
                              }
                              className="w-full px-2 py-1 rounded border border-[#E6DCC8] bg-white text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.studentCode || ''}
                              onChange={(e) =>
                                handleEditExcelCell(idx, 'studentCode', e.target.value)
                              }
                              className="w-full px-2 py-1 rounded border border-[#E6DCC8] bg-white text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            {row.isValid ? (
                              <span className="text-[#2E5E3D] font-medium flex items-center gap-1 text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#7FA88A]" />
                                Hợp lệ
                              </span>
                            ) : (
                              <div className="text-rose-600 text-[11px] leading-tight">
                                {row.errors.join(' • ')}
                              </div>
                            )}
                            {row.warnings.length > 0 && (
                              <div className="text-amber-700 text-[10px] mt-0.5">
                                ⚠ {row.warnings.join(' • ')}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveExcelRow(idx)}
                              className="p-1 rounded text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                              title="Bỏ dòng này"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
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

        {/* Footer Modal */}
        <div className="pt-4 border-t border-[#E6DCC8] flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">
            {activeTab === 'manual'
              ? `${manualRows.filter((r) => r.name.trim()).length} học sinh sẵn sàng tạo`
              : `${excelSummary?.validCount || 0} học sinh hợp lệ`}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E6DCC8] text-xs font-semibold text-[#4B5563] hover:bg-[#FAF5EB] transition-colors"
            >
              Hủy bỏ
            </button>

            {activeTab === 'manual' ? (
              <button
                type="button"
                onClick={handleSubmitManual}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản & Cấp phiếu'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitExcel}
                disabled={isSubmitting || !excelSummary || excelSummary.validCount === 0}
                className="px-5 py-2.5 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? 'Đang xử lý...'
                  : `Tạo tài khoản cho ${excelSummary?.validCount || 0} học sinh`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
