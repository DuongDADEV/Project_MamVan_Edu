import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  FileSpreadsheet,
  Scissors,
} from 'lucide-react';
import { StudentCredentialVoucher } from '../../services/types.ts';
import { exportCredentialVouchers } from '../../utils/excelUtils.ts';
import { BrandFullLogo } from '../MamVanLogo.tsx';

interface CredentialVouchersModalProps {
  isOpen: boolean;
  onClose: () => void;
  vouchers: StudentCredentialVoucher[];
  title?: string;
  subtitle?: string;
}

export const CredentialVouchersModal: React.FC<CredentialVouchersModalProps> = ({
  isOpen,
  onClose,
  vouchers,
  title = 'Phiếu tài khoản học sinh',
  subtitle = 'Tài khoản đã được tạo thành công!',
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Ẩn/hiện mật khẩu từng dòng trên màn hình (phần in phiếu vẫn hiện đủ
  // để cắt phát cho học sinh). Mở phiếu mới là reset về hiện hết.
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (isOpen) setHiddenIds(new Set());
  }, [isOpen]);
  const toggleHidden = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isOpen || vouchers.length === 0) return null;

  const handleCopyRow = (v: StudentCredentialVoucher) => {
    const text = `Họ tên: ${v.name} | Tài khoản: ${v.username} | Mật khẩu: ${v.initialPassword} | Lớp: ${v.className || v.class_id}`;
    navigator.clipboard.writeText(text);
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadExcel = () => {
    exportCredentialVouchers(vouchers, 'xlsx');
  };

  const handleDownloadCsv = () => {
    exportCredentialVouchers(vouchers, 'csv');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* 1. MÀN HÌNH MODAL HIỂN THỊ TRÊN GIAO DIỆN (ẨN KHI IN) */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1E1B4B]/50 backdrop-blur-xs no-print overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative my-auto animate-[scaleUp_0.15s_ease] max-h-[92vh] flex flex-col">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-[#9CA3AF] hover:text-[#2F3E6B] hover:bg-[#FAF5EB] transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Tiêu đề & Cảnh báo quan trọng */}
          <div className="mb-4">
            <h2 className="font-lora text-2xl font-bold text-[#2F3E6B]">
              {title}
            </h2>
            <p className="text-xs text-[#6B7280] mt-1">
              {subtitle} (Tổng số: {vouchers.length} học sinh)
            </p>

            <div className="mt-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900 leading-relaxed font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Lưu ý bảo mật quan trọng:</span> Mật khẩu ban đầu chỉ hiển thị <strong>MỘT LẦN DUY NHẤT</strong> tại màn hình này. Thầy/Cô hãy tải file Excel hoặc bấm "In phiếu tài khoản" để cắt phát cho học sinh ngay. Sau khi đóng màn hình, mật khẩu sẽ bị ẩn vĩnh viễn (chỉ có thể đặt lại mật khẩu mới).
              </div>
            </div>
          </div>

          {/* Thanh công cụ hành động nhanh */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-[#E6DCC8]/70">
            <span className="text-xs font-semibold text-[#2F3E6B]">
              Danh sách tài khoản vừa tạo:
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="px-3 py-1.5 rounded-xl border border-[#E6DCC8] bg-[#FAF5EB] hover:bg-white text-xs font-semibold text-[#2F3E6B] flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#7FA88A]" />
                <span>Tải Excel</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-3 py-1.5 rounded-xl border border-[#E6DCC8] bg-[#FAF5EB] hover:bg-white text-xs font-semibold text-[#2F3E6B] flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#2F3E6B]" />
                <span>Tải CSV</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-1.5 rounded-xl bg-[#2F3E6B] hover:bg-[#253256] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In phiếu cắt phát</span>
              </button>
            </div>
          </div>

          {/* Bảng hiển thị thông tin tài khoản */}
          <div className="flex-1 overflow-y-auto my-3 border border-[#E6DCC8] rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF5EB] border-b border-[#E6DCC8] sticky top-0 font-semibold text-[#2F3E6B]">
                <tr>
                  <th className="py-2.5 px-3">Họ và tên</th>
                  <th className="py-2.5 px-3">Lớp</th>
                  <th className="py-2.5 px-3">Tên đăng nhập</th>
                  <th className="py-2.5 px-3">Mật khẩu ban đầu</th>
                  <th className="py-2.5 px-3 text-right">Sao chép</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DCC8]/60">
                {vouchers.map((v) => {
                  const isCopied = copiedId === v.id;
                  return (
                    <tr key={v.id} className="hover:bg-[#FAF5EB]/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-[#2F3E6B]">
                        {v.name}
                        {v.student_code && (
                          <span className="block text-[10px] text-[#6B7280]">
                            Mã: {v.student_code}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#4B5563]">
                        {v.className || v.class_id}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#2F3E6B]">
                        {v.username}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono font-bold px-2 py-1 rounded bg-[#FAF5EB] border border-[#E6DCC8] text-[#E2704A]">
                            {hiddenIds.has(v.id) ? '••••••••' : v.initialPassword}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleHidden(v.id)}
                            className="p-1.5 rounded-lg border border-[#E6DCC8] bg-white text-[#4B5563] hover:text-[#2F3E6B] hover:border-[#2F3E6B] transition-all"
                            title={hiddenIds.has(v.id) ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
                          >
                            {hiddenIds.has(v.id) ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleCopyRow(v)}
                          className={`p-1.5 rounded-lg border text-[11px] font-semibold transition-all inline-flex items-center gap-1 ${
                            isCopied
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'border-[#E6DCC8] bg-white text-[#4B5563] hover:text-[#2F3E6B] hover:border-[#2F3E6B]'
                          }`}
                          title="Sao chép thông tin"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Chép</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#E6DCC8]/70 flex items-center justify-between">
            <span className="text-xs text-[#6B7280]">
              Học sinh có thể đổi mật khẩu sau khi đăng nhập.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#FAF5EB] hover:bg-[#E6DCC8]/70 border border-[#E6DCC8] text-xs font-semibold text-[#2F3E6B] transition-colors"
            >
              Tôi đã lưu, đóng cửa sổ
            </button>
          </div>
        </div>
      </div>

      {/* 2. BẢN IN CẮT PHÁT CHO TỪNG HỌC SINH (@media print) */}
      <div className="hidden print-only p-4 bg-white text-black">
        <div className="text-center mb-6 border-b pb-3">
          <h1 className="text-xl font-bold uppercase tracking-wider text-black">
            Phiếu tài khoản học tập Mầm Văn - Ngữ văn lớp 7
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Thầy/Cô cắt theo đường nét đứt và phát riêng cho từng học sinh
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {vouchers.map((v) => (
            <div
              key={v.id}
              className="voucher-card p-4 rounded-lg border-2 border-dashed border-gray-400 relative bg-white"
            >
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-gray-500" />
                  <span className="font-bold text-xs uppercase tracking-wider">
                    Mầm Văn • Lớp 7
                  </span>
                </div>
                <span className="text-xs font-semibold">
                  Lớp: {v.className || v.class_id}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <p>
                  <span className="text-gray-600">Họ và tên:</span>{' '}
                  <strong className="text-sm">{v.name}</strong>
                  {v.student_code && (
                    <span className="text-gray-500 text-[11px] ml-1">
                      ({v.student_code})
                    </span>
                  )}
                </p>

                <div className="p-2 rounded bg-gray-50 border border-gray-200 font-mono text-xs">
                  <p>
                    <span className="text-gray-600">Tên đăng nhập:</span>{' '}
                    <strong className="text-black">{v.username}</strong>
                  </p>
                  <p className="mt-1">
                    <span className="text-gray-600">Mật khẩu ban đầu:</span>{' '}
                    <strong className="text-black">{v.initialPassword}</strong>
                  </p>
                </div>

                <div className="pt-2 text-[10px] text-gray-600 leading-tight">
                  📌 <strong>Hướng dẫn đăng nhập:</strong> Mở trang <em>Mầm Văn</em> → Chọn vai trò <strong>Học sinh</strong> → Nhập tài khoản và mật khẩu ở trên để vào góc học tập.
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
