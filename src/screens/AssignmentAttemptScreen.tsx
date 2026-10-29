import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Hourglass, Send, Timer } from 'lucide-react';
import {
  AssignmentDetail,
  SubmitResult,
  getAssignmentDetail,
  submitAssignmentAttempt,
} from '../services/api/biClient.ts';
import { splitPromptBlanks, countBlanks } from '../logic/fillBlank.ts';

interface AssignmentAttemptScreenProps {
  assignmentId: string;
  studentId: string;
  onBack: () => void;
  /** Báo về App sau khi nộp thành công để trao XP của bài (nếu có cấu hình). */
  onSubmitted?: (info: { assignmentId: string; title: string; xpReward: number; totalXp?: number; xpToday?: number; xpWeek?: number }) => void;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const AssignmentAttemptScreen: React.FC<AssignmentAttemptScreenProps> = ({
  assignmentId,
  studentId,
  onBack,
  onSubmitted,
}) => {
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, { selected: string[]; text: string; blanks?: string[] }>>({});
  const [startedAt] = useState(() => new Date().toISOString());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    getAssignmentDetail(assignmentId)
      .then((d) => {
        if (!d) setLoadError('Không tìm thấy bài tập này.');
        else {
          setDetail(d);
          if (d.isTimed && d.timeLimitMinutes) setSecondsLeft(d.timeLimitMinutes * 60);
        }
      })
      .catch(() => setLoadError('Không tải được bài tập. Em thử lại sau nhé.'));
  }, [assignmentId]);

  const doSubmit = async () => {
    if (submittedRef.current || submitting) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await submitAssignmentAttempt({
        assignmentId,
        studentId,
        startedAt,
        responses,
      });
      setResult(r);
      if (detail && onSubmitted) {
        onSubmitted({ assignmentId, title: detail.title, xpReward: detail.xpReward || 0, totalXp: r.totalXp, xpToday: r.xpToday, xpWeek: r.xpWeek });
      }
    } catch (e: any) {
      submittedRef.current = false;
      setSubmitError('Nộp bài thất bại: ' + (e?.message || 'lỗi không rõ') + '. Em bấm nộp lại nhé.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (secondsLeft == null || result) return;
    if (secondsLeft <= 0) {
      doSubmit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result]);

  const answeredCount = useMemo(() => {
    if (!detail) return 0;
    return detail.questions.filter((q) => {
      const r = responses[q.id];
      if (!r) return false;
      if (q.type === 'single_choice' || q.type === 'multiple_choice') return r.selected.length > 0;
      if (q.type === 'fill_in_blank') {
        if (Array.isArray(r.blanks)) return r.blanks.some((b) => (b || '').trim().length > 0);
        return (r.text || '').trim().length > 0;
      }
      return (r.text || '').trim().length > 0;
    }).length;
  }, [detail, responses]);

  const setBlank = (qid: string, idx: number, value: string) => {
    setResponses((prev) => {
      const cur = prev[qid] || { selected: [], text: '' };
      const blanks = [...(cur.blanks || [])];
      while (blanks.length <= idx) blanks.push('');
      blanks[idx] = value;
      return { ...prev, [qid]: { ...cur, blanks } };
    });
  };

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center space-y-4">
        <p className="text-red-500 font-semibold">{loadError}</p>
        <button onClick={onBack} className="bg-[#2F3E6B] text-white font-bold px-5 py-2.5 rounded-xl">
          Về trang chủ
        </button>
      </div>
    );
  }
  if (!detail) {
    return <div className="py-16 text-center text-sm text-[#6B7280]">Đang tải bài tập…</div>;
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center space-y-4 px-4">
        <CheckCircle2 size={52} className="mx-auto text-emerald-500" />
        <h2 className="text-2xl font-black text-[#2F3E6B]">Đã nộp bài!</h2>
        {result.gradedCount > 0 && (
          <p className="text-lg">
            Phần tự chấm: <b className="text-[#2F3E6B]">{result.autoScore} điểm</b>
          </p>
        )}
        {result.pendingCount > 0 && (
          <p className="text-sm text-[#6B7280] flex items-center justify-center gap-1.5">
            <Hourglass size={15} />
            {result.pendingCount} câu tự luận đang chờ giáo viên chấm — điểm sẽ cập nhật sau.
          </p>
        )}
        <p className="text-sm text-[#6B7280]">Tổng điểm tối đa của bài: {result.maxScore} điểm.</p>
        <button onClick={onBack} className="bg-[#2F3E6B] text-white font-bold px-6 py-2.5 rounded-xl">
          Về trang chủ
        </button>
      </div>
    );
  }

  const setSelected = (qid: string, letter: string, multi: boolean) =>
    setResponses((prev) => {
      const cur = prev[qid] || { selected: [], text: '' };
      const selected = multi
        ? cur.selected.includes(letter)
          ? cur.selected.filter((l) => l !== letter)
          : [...cur.selected, letter]
        : [letter];
      return { ...prev, [qid]: { ...cur, selected } };
    });

  return (
    <div className="max-w-3xl mx-auto px-4 pb-28">
      <div className="sticky top-0 z-10 bg-[#FBF7EF]/95 backdrop-blur py-3 flex items-center gap-3 border-b border-[#E6DCC8]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-bold text-[#2F3E6B]"
        >
          <ArrowLeft size={16} /> Quay lại
        </button>
        <h2 className="font-black text-[#2F3E6B] flex-1 truncate">{detail.title}</h2>
        {secondsLeft != null && (
          <span
            className={`flex items-center gap-1 font-black text-sm px-2.5 py-1 rounded-full ${
              secondsLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-[#2F3E6B]/10 text-[#2F3E6B]'
            }`}
          >
            <Timer size={14} />
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        )}
        <span className="text-xs font-bold text-[#6B7280]">
          Đã trả lời {answeredCount}/{detail.questions.length}
        </span>
      </div>

      <div className="space-y-4 mt-4">
        {detail.questions.map((q, idx) => {
          const r = responses[q.id] || { selected: [], text: '' };
          const letters = q.options.length
            ? q.options.map((_, i) => LETTERS[i])
            : ['A', 'B', 'C', 'D'];
          return (
            <div key={q.id} className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
              <p className="font-bold text-[#2F3E6B]">
                Câu {idx + 1} <span className="text-xs font-bold text-[#E2704A]">({q.points} điểm)</span>
              </p>
              {q.passage && (
                <p className="mt-2 text-sm italic bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl px-3 py-2 whitespace-pre-wrap">
                  {q.passage}
                </p>
              )}
              {/* Điền trống kiểu mới: ô nhập nằm ngay trong câu, thay cho
                  dòng đề + 1 ô nhập chung. Câu cũ không có ___ thì giữ
                  nguyên cách hiển thị cũ. */}
              {q.type === 'fill_in_blank' && countBlanks(q.prompt || '') > 0 ? (
                <p className="mt-1.5 text-[15px] leading-loose whitespace-pre-wrap">
                  {splitPromptBlanks(q.prompt || '').map((seg, sIdx, arr) => (
                    <span key={sIdx}>
                      {seg}
                      {sIdx < arr.length - 1 && (
                        <input
                          className="inline-block mx-1 min-w-24 border-b-2 border-[#2F3E6B] bg-[#FAF5EB] rounded-t-lg px-2 py-0.5 text-sm text-center align-baseline focus:outline-none focus:bg-white"
                          style={{ width: `${Math.max(6, ((r.blanks || [])[sIdx] || '').length + 2)}ch` }}
                          placeholder={`Ô ${sIdx + 1}`}
                          value={(r.blanks || [])[sIdx] || ''}
                          onChange={(e) => setBlank(q.id, sIdx, e.target.value)}
                        />
                      )}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="mt-1.5 text-[15px] whitespace-pre-wrap">{q.prompt}</p>
              )}

              {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                <div className="mt-3 space-y-2">
                  {letters.map((letter, i) => {
                    const on = r.selected.includes(letter);
                    return (
                      <button
                        key={letter}
                        onClick={() => setSelected(q.id, letter, q.type === 'multiple_choice')}
                        className={`w-full text-left flex items-center gap-2.5 border rounded-xl px-3 py-2.5 text-sm transition ${
                          on
                            ? 'border-[#2F3E6B] bg-[#2F3E6B]/5 font-bold'
                            : 'border-[#E6DCC8] hover:border-[#2F3E6B]/50'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            on ? 'bg-[#2F3E6B] text-white' : 'bg-[#E6DCC8]/60 text-[#2F3E6B]'
                          }`}
                        >
                          {letter}
                        </span>
                        <span>{q.options[i] || `Đáp án ${letter}`}</span>
                      </button>
                    );
                  })}
                  {q.type === 'multiple_choice' && (
                    <p className="text-[11px] text-[#6B7280]">Câu này có thể chọn nhiều đáp án.</p>
                  )}
                </div>
              )}

              {q.type === 'fill_in_blank' && countBlanks(q.prompt || '') === 0 && (
                <input
                  className="mt-3 w-full border border-[#E6DCC8] rounded-xl px-3 py-2.5 text-sm"
                  placeholder="Nhập đáp án của em…"
                  value={r.text}
                  onChange={(e) =>
                    setResponses((prev) => ({
                      ...prev,
                      [q.id]: { ...(prev[q.id] || { selected: [] }), text: e.target.value },
                    }))
                  }
                />
              )}

              {q.type === 'essay' && (
                <textarea
                  className="mt-3 w-full border border-[#E6DCC8] rounded-xl px-3 py-2.5 text-sm min-h-32"
                  placeholder="Viết bài làm của em vào đây…"
                  value={r.text}
                  onChange={(e) =>
                    setResponses((prev) => ({
                      ...prev,
                      [q.id]: { ...(prev[q.id] || { selected: [] }), text: e.target.value },
                    }))
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#FBF7EF]/95 backdrop-blur border-t border-[#E6DCC8] py-3 px-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {submitError && <p className="flex-1 text-xs font-semibold text-red-500">{submitError}</p>}
          {!submitError && confirming && answeredCount < detail.questions.length && (
            <p className="flex-1 text-xs font-semibold text-amber-600">
              Còn {detail.questions.length - answeredCount} câu chưa trả lời — bấm "Nộp bài" lần
              nữa để nộp luôn.
            </p>
          )}
          <button
            disabled={submitting}
            onClick={() => {
              if (!confirming && answeredCount < detail.questions.length) {
                setConfirming(true);
                return;
              }
              doSubmit();
            }}
            className="ml-auto flex items-center gap-2 bg-[#E2704A] hover:bg-[#d1633c] text-white font-black px-6 py-3 rounded-xl disabled:opacity-50"
          >
            <Send size={16} /> {submitting ? 'Đang nộp…' : 'Nộp bài'}
          </button>
        </div>
      </div>
    </div>
  );
};
