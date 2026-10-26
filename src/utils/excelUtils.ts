/**
 * Tiện ích xử lý Excel & CSV phía trình duyệt bằng SheetJS (xlsx)
 * - Tải file mẫu .xlsx (kèm 2 sheet: Dữ liệu mẫu & Hướng dẫn)
 * - Đọc & phân tích dữ liệu từ file .xlsx, .xls, .csv tải lên
 * - Xuất danh sách học sinh (không kèm mật khẩu)
 * - Xuất phiếu tài khoản (kèm mật khẩu 1 lần)
 */

import * as XLSX from 'xlsx';
import { StudentAccount, StudentCredentialVoucher } from '../services/types.ts';

export interface ParsedStudentRow {
  rowNumber: number;
  name: string;
  className: string;
  studentCode?: string;
  dob?: string;
  // Cảnh báo & Lỗi
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

/**
 * Tạo và tải về file Excel mẫu cho giáo viên
 */
export function downloadStudentTemplateExcel(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Danh sách học sinh mẫu
  const templateData = [
    {
      'Họ và tên (*)': 'Nguyễn Hoàng Long',
      'Lớp (*)': '7A2',
      'Mã học sinh': 'HS7A2-03',
      'Ngày sinh (YYYY-MM-DD)': '2013-04-12',
    },
    {
      'Họ và tên (*)': 'Lê Phương Thảo',
      'Lớp (*)': '7A2',
      'Mã học sinh': 'HS7A2-04',
      'Ngày sinh (YYYY-MM-DD)': '2013-11-28',
    },
    {
      'Họ và tên (*)': 'Vũ Đức Trí',
      'Lớp (*)': '7A3',
      'Mã học sinh': 'HS7A3-01',
      'Ngày sinh (YYYY-MM-DD)': '2013-09-05',
    },
  ];

  const wsData = XLSX.utils.json_to_sheet(templateData);

  // Đặt độ rộng cột
  wsData['!cols'] = [
    { wch: 26 }, // Họ và tên
    { wch: 12 }, // Lớp
    { wch: 18 }, // Mã học sinh
    { wch: 25 }, // Ngày sinh
  ];

  XLSX.utils.book_append_sheet(wb, wsData, 'Danh sách học sinh');

  // Sheet 2: Hướng dẫn nhập liệu
  const instructionData = [
    {
      'CỘT': 'Họ và tên (*)',
      'BẮT BUỘC': 'Có',
      'HƯỚNG DẪN': 'Họ và tên đầy đủ có dấu (ví dụ: Nguyễn Minh Anh). Hệ thống sẽ tự động tạo tên đăng nhập (vd: anhnm27).',
    },
    {
      'CỘT': 'Lớp (*)',
      'BẮT BUỘC': 'Có (nếu không chọn lớp trước)',
      'HƯỚNG DẪN': 'Tên lớp đang có trong hệ thống (ví dụ: 7A2, 7A3).',
    },
    {
      'CỘT': 'Mã học sinh',
      'BẮT BUỘC': 'Không',
      'HƯỚNG DẪN': 'Mã định danh của trường/lớp (ví dụ: HS7A2-05). Không được trùng lặp.',
    },
    {
      'CỘT': 'Ngày sinh',
      'BẮT BUỘC': 'Không',
      'HƯỚNG DẪN': 'Định dạng năm-tháng-ngày (YYYY-MM-DD, ví dụ: 2013-05-15) hoặc ngày/tháng/năm.',
    },
    {
      'CỘT': 'Lưu ý bảo mật',
      'BẮT BUỘC': '-',
      'HƯỚNG DẪN': 'Chỉ nhập thông tin cần thiết phục vụ học tập theo thông tư ngành GD&ĐT. Không thu thập thông tin nhạy cảm.',
    },
  ];

  const wsInstruction = XLSX.utils.json_to_sheet(instructionData);
  wsInstruction['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstruction, 'Hướng dẫn');

  // Tải file xuống
  XLSX.writeFile(wb, 'Mau_Nhap_Hoc_Sinh_Mam_Van.xlsx');
}

/**
 * Đọc file Excel/CSV từ browser và xác thực dữ liệu
 */
export async function parseUploadedExcel(
  file: File,
  existingStudents: StudentAccount[],
  existingClassNames: string[],
  defaultClass = ''
): Promise<{ rows: ParsedStudentRow[]; validCount: number; errorCount: number }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const firstSheetName = wb.SheetNames[0];
  const worksheet = wb.Sheets[firstSheetName];
  // blankrows: true để dòng trống vẫn chiếm chỉ số — số dòng báo lỗi khớp dòng thật trong Excel
  const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '', blankrows: true });

  const existingCodes = new Set(
    existingStudents.map((s) => s.student_code?.trim().toLowerCase()).filter(Boolean)
  );

  const existingNameDob = new Set(
    existingStudents.map((s) => `${s.name.trim().toLowerCase()}_${s.dob || ''}`)
  );

  const parsedRows: ParsedStudentRow[] = [];
  const inBatchCodes = new Set<string>();
  const inBatchNameDob = new Set<string>();

  rawJson.forEach((row, index) => {
    // Tìm các cột tương ứng theo tên linh hoạt
    const nameKey = Object.keys(row).find((k) =>
      /họ và tên|họ tên|tên học sinh|name|fullname/i.test(k)
    );
    const classKey = Object.keys(row).find((k) => /lớp|class/i.test(k));
    const codeKey = Object.keys(row).find((k) => /mã học sinh|mã hs|code|student_code/i.test(k));
    const dobKey = Object.keys(row).find((k) => /ngày sinh|dob|birth/i.test(k));

    const name = nameKey ? String(row[nameKey]).trim() : '';
    let className = classKey ? String(row[classKey]).trim() : defaultClass;
    const studentCode = codeKey ? String(row[codeKey]).trim() : undefined;
    let dob = dobKey ? String(row[dobKey]).trim() : undefined;

    // Chuẩn hóa ngày nếu là object Date
    if (dobKey && row[dobKey] instanceof Date) {
      const d: Date = row[dobKey];
      dob = d.toISOString().split('T')[0];
    }

    // Bỏ qua dòng trống hoàn toàn
    if (!name && !className && !studentCode) return;

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Kiểm tra Họ và tên
    if (!name) {
      errors.push('Thiếu họ và tên học sinh');
    } else if (name.length < 2) {
      errors.push('Họ và tên quá ngắn');
    }

    // 2. Kiểm tra Lớp
    if (!className) {
      errors.push('Chưa có thông tin lớp học');
    } else {
      // Chuẩn hóa tên lớp
      const matchedClass = existingClassNames.find(
        (c) => c.toLowerCase() === className.toLowerCase()
      );
      if (matchedClass) {
        className = matchedClass;
      } else {
        warnings.push(`Lớp "${className}" chưa có trong hệ thống (sẽ tự gán lớp hiện tại)`);
      }
    }

    // 3. Kiểm tra trùng lặp Mã học sinh
    if (studentCode) {
      const codeLow = studentCode.toLowerCase();
      if (existingCodes.has(codeLow)) {
        errors.push(`Mã học sinh "${studentCode}" đã tồn tại trong hệ thống`);
      } else if (inBatchCodes.has(codeLow)) {
        errors.push(`Mã học sinh "${studentCode}" bị trùng trong chính file tải lên`);
      } else {
        inBatchCodes.add(codeLow);
      }
    }

    // 4. Kiểm tra trùng lặp Họ tên + Ngày sinh
    if (name && dob) {
      const comboKey = `${name.toLowerCase()}_${dob}`;
      if (existingNameDob.has(comboKey)) {
        warnings.push('Trùng cả họ tên và ngày sinh với học sinh đã có');
      } else if (inBatchNameDob.has(comboKey)) {
        warnings.push('Trùng họ tên và ngày sinh với dòng khác trong file');
      } else {
        inBatchNameDob.add(comboKey);
      }
    }

    parsedRows.push({
      rowNumber: index + 2, // Excel dòng 2 (sau header)
      name,
      className: className || defaultClass,
      studentCode,
      dob,
      errors,
      warnings,
      isValid: errors.length === 0,
    });
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.length - validCount;

  return { rows: parsedRows, validCount, errorCount };
}

/**
 * Xuất danh sách học sinh (Excel / CSV) - Tuyệt đối KHÔNG kèm mật khẩu
 */
export function exportStudentsList(
  students: (StudentAccount & {
    className?: string;
    xpWeek?: number;
    progressPercent?: number;
  })[],
  format: 'xlsx' | 'csv' = 'xlsx'
): void {
  const data = students.map((s, idx) => ({
    'STT': idx + 1,
    'Họ và tên': s.name,
    'Mã học sinh': s.student_code || '-',
    'Lớp': s.className || s.class_id,
    'Tên đăng nhập': s.username,
    'Trạng thái': s.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa',
    'Đã từng học': s.has_logged_in ? 'Rồi' : 'Chưa',
    'XP tuần': s.xpWeek ?? 0,
    'Tiến độ': `${s.progressPercent ?? 0}%`,
    'Ngày tạo': s.created_at ? s.created_at.split('T')[0] : '-',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học sinh');

  if (format === 'csv') {
    XLSX.writeFile(wb, `Danh_Sach_Hoc_Sinh_Mam_Van_${new Date().toISOString().split('T')[0]}.csv`, {
      bookType: 'csv',
    });
  } else {
    XLSX.writeFile(wb, `Danh_Sach_Hoc_Sinh_Mam_Van_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
}

/**
 * Xuất Phiếu tài khoản (chỉ dùng ngay sau khi tạo tài khoản hoặc đặt lại mật khẩu)
 */
export function exportCredentialVouchers(
  vouchers: StudentCredentialVoucher[],
  format: 'xlsx' | 'csv' = 'xlsx'
): void {
  const data = vouchers.map((v, idx) => ({
    'STT': idx + 1,
    'Họ và tên': v.name,
    'Lớp': v.className || v.class_id,
    'Mã học sinh': v.student_code || '-',
    'Tên đăng nhập': v.username,
    'Mật khẩu ban đầu': v.initialPassword,
    'Hướng dẫn': 'Đăng nhập tại MamVan -> Chọn vai trò Học sinh -> Nhập tên đăng nhập & mật khẩu',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 10 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 50 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Phiếu tài khoản học sinh');

  if (format === 'csv') {
    XLSX.writeFile(wb, `Phieu_Tai_Khoan_Mam_Van_${Date.now()}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, `Phieu_Tai_Khoan_Mam_Van_${Date.now()}.xlsx`);
  }
}
