import React, { useState, useMemo } from 'react';
import { formatScore } from '../../../utils/scoreFormat.ts';
import { EssaySubmission, ClassItem } from '../../../types.ts';
import {
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowUpDown,
  BookOpen,
  ChevronRight,
  Eye,
  Filter,
  Flame,
  Award,
} from 'lucide-react';

interface GradingQueueTableProps {
  submissions: EssaySubmission[];
  classes: ClassItem[];
  selectedClassId?: string;
  onSelectSubmission: (submission: EssaySubmission) => void;
  onViewStudent?: (submission: EssaySubmission) => void;
}

export const GradingQueueTable: React.FC<GradingQueueTableProps> = ({
  submissions,
  classes,
  selectedClassId = 'all',
  onSelectSubmission,
  onViewStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'AI_SUGGESTED' | 'GRADED' | 'UNGRADED'>('ALL');
  const [classFilter, setClassFilter] = useState<string>(selectedClassId);
  const [sortBy, setSortBy] = useState<'waiting_desc' | 'submitted_desc' | 'submitted_asc'>('waiting_desc');

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter((s) => s.status === 'PENDING_TEACHER').length;
    const aiSuggested = submissions.filter((s) => s.status === 'AI_SUGGESTED').length;
    const graded = submissions.filter((s) => s.status === 'GRADED').length;
    const urgent = submissions.filter((s) => (s.hoursWaiting || 0) >= 24 && s.status !== 'GRADED').length;
    return { total, pending, aiSuggested, graded, urgent };
  }, [submissions]);

  // Lọc và sắp xếp
  const filteredSubmissions = useMemo(() => {
    let result = [...submissions];

    // Lọc theo lớp
    if (classFilter !== 'all') {
      result = result.filter(
        (s) => s.classId === classFilter || s.className?.toLowerCase() === classFilter.toLowerCase()
      );
    }

    // Lọc theo trạng thái
    if (statusFilter === 'PENDING') {
      result = result.filter((s) => s.status === 'PENDING_TEACHER');
    } else if (statusFilter === 'AI_SUGGESTED') {
      result = result.filter((s) => s.status === 'AI_SUGGESTED');
    } else if (statusFilter === 'GRADED') {
      result = result.filter((s) => s.status === 'GRADED');
    } else if (statusFilter === 'UNGRADED') {
      result = result.filter((s) => s.status !== 'GRADED');
    }

    // Tìm kiếm từ khóa
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.studentName?.toLowerCase().includes(q) ||
          s.promptTitle?.toLowerCase().includes(q) ||
          s.quizTitle?.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q)
      );
    }

    // Sắp xếp
    result.sort((a, b) => {
      if (sortBy === 'waiting_desc') {
        const wA = a.hoursWaiting ?? Math.floor((Date.now() - a.submittedAt) / 3600000);
        const wB = b.hoursWaiting ?? Math.floor((Date.now() - b.submittedAt) / 3600000);
        return wB - wA;
      }
      if (sortBy === 'submitted_desc') {
        return b.submittedAt - a.submittedAt;
      }
      return a.submittedAt - b.submittedAt;
    });

    return result;
  }, [submissions, classFilter, statusFilter, searchTerm, sortBy]);

  // GOM THEO HỌC SINH: mỗi em chỉ 1 dòng tổng hợp trong hàng đợi —
  // bấm "Xem chi tiết" mới vào danh sách từng bài của em.
  const groupedStudents = useMemo(() => {
    const map = new Map<string, EssaySubmission[]>();
    filteredSubmissions.forEach((sub) => {
      const key = sub.studentId || sub.studentName || sub.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(sub);
    });
    return Array.from(map.values()).map((subs) => {
      const ungraded = subs.filter((x) => x.status !== 'GRADED');
      const nextToGrade = [...ungraded].sort((a, b) => a.submittedAt - b.submittedAt)[0];
      const latest = [...subs].sort((a, b) => b.submittedAt - a.submittedAt)[0];
      const maxHours = ungraded.reduce(
        (mx, x) =>
          Math.max(mx, x.hoursWaiting ?? Math.max(0, Math.floor((Date.now() - x.submittedAt) / 3600000))),
        0
      );
      return {
        subs,
        rep: subs[0],
        ungradedCount: ungraded.length,
        aiCount: subs.filter((x) => x.status === 'AI_SUGGESTED').length,
        gradedCount: subs.length - ungraded.length,
        nextToGrade,
        latest,
        maxHours,
        totalWords: subs.reduce((t, x) => t + (x.wordCount || 0), 0),
      };
    });
  }, [filteredSubmissions]);

  return (
    <div className="space-y-6">
      {/* 1. THẺ THỐNG KÊ NHANH — 2 thẻ theo mẫu: Cần chấm (gộp gợi ý AI) + Chờ > 24 giờ màu đỏ nổi nhất */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Cần chấm */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'UNGRADED' ? 'ALL' : 'UNGRADED')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'UNGRADED'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400'
              : 'bg-white border-[#E8DFD1] hover:border-amber-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-700">Cần chấm</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1E1B4B]">{stats.pending + stats.aiSuggested}</span>
            <span className="text-xs text-slate-400">bài</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setStatusFilter(statusFilter === 'AI_SUGGESTED' ? 'ALL' : 'AI_SUGGESTED');
            }}
            className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-colors ${
              statusFilter === 'AI_SUGGESTED'
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
            }`}
            title="Lọc riêng các bài đã có gợi ý AI"
          >
            <Sparkles className="w-3 h-3" /> Đã có gợi ý AI · {stats.aiSuggested}
          </button>
        </div>

        {/* Chờ > 24 giờ — màu đỏ, nổi nhất */}
        <div
          onClick={() => setSortBy('waiting_desc')}
          className="cursor-pointer p-4 rounded-2xl border-2 border-rose-400 bg-rose-50 shadow-xs transition-all hover:shadow-sm"
          title="Sắp xếp hàng đợi theo thời gian chờ lâu nhất"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" /> Chờ &gt; 24 giờ
            </span>
            {stats.urgent > 0 && <span className="animate-ping w-2.5 h-2.5 rounded-full bg-rose-500" />}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">{stats.urgent}</span>
            <span className="text-xs font-semibold text-rose-500">cần ưu tiên</span>
          </div>
          <p className="mt-3 text-[11px] font-medium text-rose-500">
            Bấm để đưa các bài chờ lâu nhất lên đầu hàng đợi
          </p>
        </div>
      </div>

      {/* 2. THANH CÔNG CỤ TÌM KIẾM VÀ BỘ LỌC */}
      <div className="bg-white p-4 rounded-2xl border border-[#E8DFD1] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Ô tìm kiếm */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm tên học sinh, đề bài..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2F3E6B]"
          />
        </div>

        {/* Bộ lọc Lớp, Trạng thái, Sắp xếp */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Lọc Lớp */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#2F3E6B]"
          >
            <option value="all">Tất cả các lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Lọc Trạng thái */}
          <select
            value={statusFilter === 'UNGRADED' ? 'ALL' : statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#2F3E6B]"
          >
            <option value="ALL">Mọi trạng thái</option>
            <option value="PENDING">Chờ chấm ({stats.pending})</option>
            <option value="AI_SUGGESTED">Đã có gợi ý AI ({stats.aiSuggested})</option>
            <option value="GRADED">Đã chốt ({stats.graded})</option>
          </select>

          {/* Sắp xếp */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#2F3E6B]"
          >
            <option value="waiting_desc">Chờ lâu nhất (ưu tiên)</option>
            <option value="submitted_desc">Mới nộp gần đây</option>
            <option value="submitted_asc">Nộp trước nhất</option>
          </select>

          {/* Nút chấm bài ưu tiên đầu tiên */}
          {filteredSubmissions.some((s) => s.status !== 'GRADED') && (
            <button
              onClick={() => {
                const first = filteredSubmissions.find((s) => s.status !== 'GRADED');
                if (first) onSelectSubmission(first);
              }}
              className="px-4 py-2 bg-[#E2704A] hover:bg-[#D05F39] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" /> Chấm bài kế tiếp
            </button>
          )}
        </div>
      </div>

      {/* 3. BẢNG HÀNG ĐỢI BÀI CHẤM */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF5EB] text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-[#E8DFD1]">
              <tr>
                <th className="py-3.5 px-4">Học sinh & Lớp</th>
                <th className="py-3.5 px-4">Bài tập / Câu hỏi</th>
                <th className="py-3.5 px-4 text-center">Năng lực</th>
                <th className="py-3.5 px-4 text-center">Số từ</th>
                <th className="py-3.5 px-4">Thời điểm nộp</th>
                <th className="py-3.5 px-4 text-center">Thời gian chờ</th>
                <th className="py-3.5 px-4 text-center">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    Không có bài viết nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                groupedStudents.map((g) => {
                  const sub = g.rep;
                  const isUrgent = g.ungradedCount > 0 && g.maxHours >= 24;
                  const skillLevel = sub.skillLevel || 'VAN_DUNG';
                  const summaryParts: string[] = [];
                  if (g.ungradedCount > 0) summaryParts.push(`${g.ungradedCount} chờ chấm`);
                  if (g.aiCount > 0) summaryParts.push(`${g.aiCount} có gợi ý AI`);
                  if (g.gradedCount > 0) summaryParts.push(`${g.gradedCount} đã chốt`);

                  return (
                    <tr
                      key={sub.studentId || sub.id}
                      onClick={() => (onViewStudent ? onViewStudent(sub) : onSelectSubmission(g.nextToGrade || g.latest))}
                      className="hover:bg-[#FAF8F3] transition-colors cursor-pointer group"
                    >
                      {/* Học sinh & Lớp */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold text-xs flex items-center justify-center shrink-0">
                            {sub.studentName?.slice(0, 1) || 'H'}
                          </div>
                          <div>
                            <div className="font-bold text-[#1E1B4B] group-hover:text-[#4F46E5] transition-colors">
                              {sub.studentName || 'Học sinh'}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500">
                              Lớp {sub.className || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tổng số bài của học sinh */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-800">
                          {g.subs.length} bài đã nộp
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {summaryParts.join(' • ')}
                        </div>
                      </td>

                      {/* Mức năng lực (của bài ưu tiên nhất) */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            skillLevel === 'PHAN_TICH'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-indigo-50 text-[#4F46E5] border border-indigo-200'
                          }`}
                        >
                          {skillLevel === 'PHAN_TICH' ? 'Phân tích' : 'Vận dụng'}
                        </span>
                      </td>

                      {/* Tổng số từ */}
                      <td className="py-3.5 px-4 text-center font-medium text-slate-700 text-xs">
                        {g.totalWords} từ
                      </td>

                      {/* Lần nộp gần nhất */}
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {new Date(g.latest.submittedAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Thời gian chờ lâu nhất trong các bài chưa chấm */}
                      <td className="py-3.5 px-4 text-center">
                        {g.ungradedCount === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : isUrgent ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-700" />
                            {g.maxHours}h (Quá hẹn)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-semibold px-2 py-0.5 rounded-full bg-slate-100">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {g.maxHours}h
                          </span>
                        )}
                      </td>

                      {/* Trạng thái tổng hợp */}
                      <td className="py-3.5 px-4 text-center">
                        {g.ungradedCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" /> Đã chốt hết
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                            Chờ chấm ({g.ungradedCount})
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                        {onViewStudent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewStudent(sub);
                            }}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-[#4F46E5] hover:text-[#4F46E5] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                            title="Xem chi tiết các bài học sinh này đã làm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Xem chi tiết
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSubmission(g.nextToGrade || g.latest);
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                            g.ungradedCount === 0
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-[#4F46E5] text-white hover:bg-indigo-700 shadow-xs'
                          }`}
                        >
                          {g.ungradedCount === 0 ? 'Xem lại' : 'Chấm ngay'}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
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
    </div>
  );
};
