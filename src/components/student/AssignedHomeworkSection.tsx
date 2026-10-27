import React, { useEffect, useState } from 'react';
import { BookOpenCheck, CheckCircle2, Clock, Hourglass, Timer } from 'lucide-react';
import { getStudentAssignments } from '../../services/api/biClient.ts';

interface AssignedHomeworkSectionProps {
  studentId: string;
  onOpen?: (assignmentId: string) => void;
}

function fmtDue(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return (
    d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  );
}

/** Bài tập độc lập được giáo viên giao riêng cho từng em (bảng assignments/targets). */
export const AssignedHomeworkSection: React.FC<AssignedHomeworkSectionProps> = ({
  studentId,
  onOpen,
}) => {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let alive = true;
    getStudentAssignments(studentId)
      .then((r) => {
        if (alive) setItems(r);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [studentId]);

  if (!items || items.length === 0) return null;

  return (
    <section className="mt-6">
      <h3 className="font-black text-[#2F3E6B] flex items-center gap-2 text-base">
        <BookOpenCheck size={18} /> Bài tập được giao
      </h3>
      <div className="grid gap-3 mt-3">
        {items.map((it) => {
          const done = it.status === 'SUBMITTED';
          const best = (it.attempts || []).reduce(
            (m: number | null, a: any) =>
              a.score_awarded != null && (m == null || a.score_awarded > m) ? a.score_awarded : m,
            null
          );
          const bestMax = (it.attempts || []).find((a: any) => a.score_awarded === best)?.max_score;
          return (
            <div
              key={it.targetId}
              onClick={onOpen ? () => onOpen(it.assignmentId) : undefined}
              className={`bg-white border border-[#E6DCC8] rounded-2xl px-4 py-3 flex items-center gap-3 ${
                onOpen ? 'cursor-pointer hover:border-[#2F3E6B]/60 transition' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#2F3E6B] truncate">{it.title}</p>
                <p className="text-xs text-[#6B7280] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span>{it.questionCount} câu hỏi</span>
                  {it.dueAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Hạn nộp: {fmtDue(it.dueAt)}
                    </span>
                  )}
                  {it.isTimed && (
                    <span className="flex items-center gap-1">
                      <Timer size={11} /> Giới hạn {it.timeLimitMinutes} phút
                    </span>
                  )}
                  {(it.attempts || []).length > 0 && (
                    <span>Đã làm {it.attempts.length} lượt</span>
                  )}
                </p>
              </div>
              {best != null && (
                <span className="font-black text-[#2F3E6B] text-sm whitespace-nowrap">
                  {best}/{bestMax ?? '?'} điểm
                </span>
              )}
              {done ? (
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 font-bold text-xs px-2.5 py-1 rounded-full whitespace-nowrap">
                  <CheckCircle2 size={13} /> Đã nộp
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 font-bold text-xs px-2.5 py-1 rounded-full whitespace-nowrap">
                  <Hourglass size={13} /> Chưa nộp
                </span>
              )}
              {onOpen && (
                <span className="text-xs font-black text-[#E2704A] whitespace-nowrap">
                  {done ? 'Làm lại' : 'Làm bài'} →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
