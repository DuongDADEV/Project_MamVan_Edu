import React, { useState, useMemo } from 'react';
import { formatScore } from '../../../utils/scoreFormat.ts';
import { EssaySubmission, ClassItem } from '../../../types.ts';
import { TopicWithMeta, QuizWithMeta, QuestionWithMeta } from '../../../services/index.ts';
import {
  Clock,
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
  topics?: TopicWithMeta[];
  quizzes?: QuizWithMeta[];
  questionsMap?: Record<string, QuestionWithMeta>;
  classes: ClassItem[];
  selectedClassId?: string;
  onSelectSubmission: (submission: EssaySubmission) => void;
  onViewStudent?: (submission: EssaySubmission) => void;
}

export const GradingQueueTable: React.FC<GradingQueueTableProps> = ({
  submissions,
  topics = [],
  quizzes = [],
  questionsMap = {},
  classes,
  selectedClassId = 'all',
  onSelectSubmission,
  onViewStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'AI_SUGGESTED' | 'GRADED' | 'UNGRADED'>('ALL');
  const [classFilter, setClassFilter] = useState<string>(selectedClassId);
  const [sortBy, setSortBy] = useState<'waiting_desc' | 'submitted_desc' | 'submitted_asc'>('waiting_desc');
  // Ô chọn GỘP trạng thái + sắp xếp (1 ô duy nhất): 'status:X' hoặc 'sort:Y'
  const [toolbarPick, setToolbarPick] = useState<string>('status:ALL');
  const handleToolbarPick = (v: string) => {
    setToolbarPick(v);
    if (v.startsWith('status:')) setStatusFilter(v.slice('status:'.length) as any);
    else if (v.startsWith('sort:')) setSortBy(v.slice('sort:'.length) as any);
  };

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
      const topicIds = new Set<string>();
      subs.forEach((x) => {
        const byQuiz = quizzes.find((q) => q.id === x.quizId);
        const tid =
          byQuiz?.topicId ||
          questionsMap[x.questionId]?.topicId ||
          quizzes.find((q) => q.id === x.questionId)?.topicId;
        if (tid) topicIds.add(tid);
      });
      return {
        subs,
        rep: subs[0],
        topicsDone: topicIds.size,
        ungradedCount: ungraded.length,
        aiCount: subs.filter((x) => x.status === 'AI_SUGGESTED').length,
        gradedCount: subs.length - ungraded.length,
        nextToGrade,
        latest,
        maxHours,
        totalWords: subs.reduce((t, x) => t + (x.wordCount || 0), 0),
      };
    });
  }, [filteredSubmissions, quizzes, questionsMap]);

  return (
    <div className="space-y-4">
      {/* 1+2 GỘP MỘT DẢI GỌN TRÊN ĐẦU (theo yêu cầu chủ dự án: gộp thống kê
          + tìm kiếm + bộ lọc vào MỘT thẻ trên cùng cho bảng được đẩy lên cao,
          thay cho 2 thẻ thống kê lớn + 1 thanh lọc riêng xếp chồng như trước).
          Mọi thao tác lọc bấm trên thẻ giữ nguyên hành vi cũ. */}
      <div className="bg-white p-3 rounded-2xl border border-[#E8DFD1] shadow-xs flex flex-wrap items-center gap-2.5">
        {/* Cụm thống kê nhanh dạng pill gọn */}
        <div
          onClick={() => handleToolbarPick(statusFilter === 'UNGRADED' ? 'status:ALL' : 'status:UNGRADED')}
          className={`cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
            statusFilter === 'UNGRADED'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
              : 'bg-[#FAF5EB] border-[#E8DFD1] hover:border-amber-300'
          }`}
          title="Lọc các bài cần chấm"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-xs font-bold text-slate-600">Cần chấm</span>
          <span className="text-lg font-black text-[#2F3E6B] leading-none">
            {stats.pending + stats.aiSuggested}
          </span>
          <span className="text-[11px] text-slate-400">bài</span>
        </div>

        <div
          onClick={() => handleToolbarPick('sort:waiting_desc')}
          className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 transition-all hover:border-rose-400"
          title="Đưa các bài chờ lâu nhất lên đầu hàng đợi"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span className="text-xs font-bold text-rose-700">Chờ &gt; 24 giờ</span>
          <span className="text-lg font-black text-rose-600 leading-none">{stats.urgent}</span>
          <span className="text-[11px] font-semibold text-rose-500">cần ưu tiên</span>
          {stats.urgent > 0 && <span className="animate-ping w-2 h-2 rounded-full bg-rose-500" />}
        </div>

        {/* Ô tìm kiếm */}
        <div className="relative flex-1 min-w-44">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm tên học sinh, đề bài..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2F3E6B]"
          />
        </div>

        {/* Bộ lọc Lớp + ô gộp Trạng thái/Sắp xếp */}
        <div className="flex flex-wrap items-center gap-2.5">
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

          <select
            value={toolbarPick}
            onChange={(e) => handleToolbarPick(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#2F3E6B]"
            title="Lọc trạng thái hoặc sắp xếp hàng đợi"
          >
            <optgroup label="Trạng thái">
              <option value="status:ALL">Mọi trạng thái</option>
              <option value="status:PENDING">Chờ chấm ({stats.pending})</option>
              <option value="status:AI_SUGGESTED">Đã có gợi ý AI ({stats.aiSuggested})</option>
              <option value="status:GRADED">Đã chốt ({stats.graded})</option>
            </optgroup>
            <optgroup label="Sắp xếp">
              <option value="sort:waiting_desc">Chờ lâu nhất (ưu tiên)</option>
              <option value="sort:submitted_desc">Mới nộp gần đây</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* 3. BẢNG HÀNG ĐỢI THEO HỌC SINH — đầu bảng NAVY đồng bộ giao diện
          chung (trước là cam #F59E0B chói, lệch tông với toàn app) */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#2F3E6B] text-white text-xs font-extrabold uppercase tracking-wide">
                <th className="py-3 px-4">Học sinh</th>
                <th className="py-3 px-4">Lớp</th>
                <th className="py-3 px-4 text-center">Chủ đề đã làm</th>
                <th className="py-3 px-4 text-center">Bài chờ chấm</th>
                <th className="py-3 px-4 text-center">Chờ lâu nhất</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                    Không có bài viết nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                groupedStudents.map((g) => {
                  const sub = g.rep;
                  const isOverdue = g.ungradedCount > 0 && g.maxHours > 24;
                  const totalTopics = Math.max(topics.length, g.topicsDone);
                  return (
                    <tr
                      key={sub.studentId || sub.id}
                      onClick={() => (onViewStudent ? onViewStudent(sub) : onSelectSubmission(g.nextToGrade || g.latest))}
                      className="hover:bg-[#FAF8F3] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-bold text-[#1E1B4B]">
                        {sub.studentName || 'Học sinh'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold whitespace-nowrap">
                        {(sub.className || '—').replace(/^Lớp\s*/i, '')}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                        {totalTopics > 0 ? `${g.topicsDone}/${totalTopics}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {g.ungradedCount === 0 ? (
                          <span className="text-slate-300 font-semibold">0</span>
                        ) : (
                          <span className="font-bold text-[#1E1B4B]">{g.ungradedCount}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {g.ungradedCount === 0 || g.maxHours <= 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : isOverdue ? (
                          <span className="font-extrabold text-rose-600">{g.maxHours}h</span>
                        ) : (
                          <span className="font-semibold text-slate-600">{g.maxHours}h</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onViewStudent) onViewStudent(sub);
                            else onSelectSubmission(g.nextToGrade || g.latest);
                          }}
                          className="text-xs font-bold text-[#4F46E5] hover:text-[#E2704A] transition-colors"
                        >
                          Xem chi tiết
                        </button>
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
