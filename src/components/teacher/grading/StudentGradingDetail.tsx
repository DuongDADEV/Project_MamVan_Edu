import React, { useMemo, useState } from 'react';
import { formatScore } from '../../../utils/scoreFormat.ts';
import { EssaySubmission } from '../../../types.ts';
import { ArrowLeft } from 'lucide-react';

interface StudentGradingDetailProps {
  studentId: string;
  submissions: EssaySubmission[];
  onBack: () => void;
  onSelectSubmission: (submission: EssaySubmission) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// "02:43 14-10" — đúng định dạng mẫu thiết kế
const formatSubmittedAt = (ts: number) => {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}`;
};

const waitingHours = (s: EssaySubmission) =>
  s.hoursWaiting ?? Math.max(0, Math.floor((Date.now() - s.submittedAt) / 3600000));

/**
 * Màn "Xem chi tiết" theo học sinh (theo mẫu Figma chấm bài):
 * thẻ tên học sinh, thanh tổng kết đậm (tiến độ / chờ chấm / quá hạn / ĐTB,
 * công tắc "Chỉ hiện bài chưa chấm"), bảng gom theo bài kiểm tra với
 * dòng nhóm "… - bài chờ chấm: N" hoặc "… - (Hoàn thành)".
 */
export const StudentGradingDetail: React.FC<StudentGradingDetailProps> = ({
  studentId,
  submissions,
  onBack,
  onSelectSubmission,
}) => {
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);

  const own = useMemo(
    () =>
      submissions
        .filter((s) => s.studentId === studentId)
        .sort((a, b) => b.submittedAt - a.submittedAt),
    [submissions, studentId]
  );

  const studentName = own[0]?.studentName || 'Học sinh';
  const className = own[0]?.className || '—';

  // Nhóm theo bài kiểm tra (quizTitle)
  const groups = useMemo(() => {
    const map = new Map<string, EssaySubmission[]>();
    own.forEach((s) => {
      const key = s.quizTitle || 'Bài kiểm tra / Bài tập';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).map(([quizTitle, items]) => ({
      quizTitle,
      items,
      pendingCount: items.filter((i) => i.status !== 'GRADED').length,
    }));
  }, [own]);

  const stats = useMemo(() => {
    const graded = own.filter((s) => s.status === 'GRADED');
    const pending = own.length - graded.length;
    const overdue = own.filter((s) => s.status !== 'GRADED' && waitingHours(s) >= 24).length;
    const scores = graded
      .map((s) => s.finalScore ?? s.totalScore)
      .filter((v): v is number => typeof v === 'number');
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const doneGroups = groups.filter((g) => g.pendingCount === 0).length;
    return { pending, overdue, avg, doneGroups, totalGroups: groups.length };
  }, [own, groups]);

  const visibleGroups = useMemo(() => {
    if (!onlyUnmarked) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.status !== 'GRADED') }))
      .filter((g) => g.items.length > 0);
  }, [groups, onlyUnmarked]);

  return (
    <div className="space-y-4">
      {/* Thẻ tên học sinh */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] hover:border-[#2F3E6B] transition-colors shrink-0"
            title="Quay lại hàng đợi chấm bài"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại</span>
          </button>
          <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold text-sm flex items-center justify-center shrink-0">
            {studentName.slice(0, 1)}
          </div>
          <h3 className="font-lora font-bold text-lg text-[#1E1B4B]">
            {studentName} · Lớp {className}
          </h3>
        </div>

        {/* Thanh tổng kết đậm */}
        <div className="mt-4 rounded-xl bg-[#1E1B4B] text-white px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-semibold">
          <span>
            {stats.doneGroups}/{stats.totalGroups} bài kiểm tra đã làm
          </span>
          <span className="text-amber-300">{stats.pending} bài chờ chấm</span>
          <span className="text-rose-300">{stats.overdue} bài quá hạn</span>
          <span>ĐTB {stats.avg !== null ? formatScore(stats.avg) : '—'}</span>
          <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyUnmarked}
              onChange={(e) => setOnlyUnmarked(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-[#E2704A] cursor-pointer"
            />
            <span>Chỉ hiện bài chưa chấm</span>
          </label>
        </div>
      </div>

      {/* Bảng bài nộp gom theo bài kiểm tra */}
      {own.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8DFD1] p-10 text-center text-sm text-slate-400">
          Học sinh này chưa nộp bài viết nào.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#F59E0B] text-[#1E1B4B] text-xs font-extrabold uppercase tracking-wide">
                  <th className="py-3 px-4">Tên bài</th>
                  <th className="py-3 px-4">Thời điểm nộp</th>
                  <th className="py-3 px-4">Thời gian chờ chấm</th>
                  <th className="py-3 px-4">Điểm</th>
                  <th className="py-3 px-4">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                      Không còn bài chưa chấm nào.
                    </td>
                  </tr>
                ) : (
                  visibleGroups.map((group) => (
                    <React.Fragment key={group.quizTitle}>
                      {/* Dòng nhóm bài kiểm tra */}
                      <tr className="bg-[#FEF3C7]">
                        <td colSpan={5} className="py-2 px-4 text-xs text-[#1E1B4B]">
                          <span className="font-bold">{group.quizTitle}</span>
                          <span className="text-slate-600">
                            {group.pendingCount > 0
                              ? ` - bài chờ chấm: ${group.pendingCount}`
                              : ' - (Hoàn thành)'}
                          </span>
                        </td>
                      </tr>
                      {group.items.map((sub) => {
                        const hours = waitingHours(sub);
                        const isOverdue = sub.status !== 'GRADED' && hours >= 24;
                        return (
                          <tr
                            key={sub.id}
                            onClick={() => onSelectSubmission(sub)}
                            className="border-t border-slate-100 hover:bg-[#FAF8F3] transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {sub.promptTitle || 'Cảm nghĩ về đoạn văn/thơ'}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                              {formatSubmittedAt(sub.submittedAt)}
                            </td>
                            <td className="py-3 px-4 text-xs whitespace-nowrap">
                              {sub.status === 'GRADED' ? (
                                <span className="text-slate-400">–</span>
                              ) : isOverdue ? (
                                <span className="font-bold text-rose-600">
                                  {hours}h (quá hạn)
                                </span>
                              ) : (
                                <span className="text-slate-600 font-semibold">{hours}h</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs whitespace-nowrap">
                              {sub.status === 'GRADED' ? (
                                <span className="font-bold text-[#1E1B4B]">
                                  {formatScore(sub.finalScore ?? sub.totalScore)}đ
                                </span>
                              ) : sub.status === 'AI_SUGGESTED' ? (
                                <span className="font-bold text-purple-700">
                                  Gợi ý {formatScore(sub.aiSuggestion?.suggestedTotalScore)}đ
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectSubmission(sub);
                                }}
                                className={`text-xs transition-colors ${
                                  sub.status === 'GRADED'
                                    ? 'font-semibold text-slate-500 hover:text-[#2F3E6B]'
                                    : 'font-bold text-[#1E1B4B] hover:text-[#E2704A]'
                                }`}
                              >
                                {sub.status === 'GRADED' ? 'Xem lại' : 'Chấm ngay'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
