import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ClipboardList,
  Hourglass,
  LogIn,
  PenLine,
  Send,
  Smartphone,
  Timer,
} from 'lucide-react';
import { PageHeader } from '../../components/teacher/ui/PageHeader.tsx';
import { ClassItem, StudentAccount, TeacherProfile } from '../../services/types.ts';
import {
  BiAssignment,
  BiAttempt,
  BiPendingReview,
  BiSessionSummary,
  BiTopicFlow,
  getAssignmentsProgress,
  getAttemptsWithAnswers,
  getPendingReviews,
  getSessionsSummary,
  getTopicFlows,
  gradePendingAnswer,
} from '../../services/supabase/biRepository.ts';

interface TeacherProgressScreenProps {
  teacher: TeacherProfile;
  classes: ClassItem[];
  students: StudentAccount[];
}

function fmtDateTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  );
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v.length <= 10 ? v + 'T00:00:00' : v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const QTYPE_LABEL: Record<string, string> = {
  single_choice: 'Trắc nghiệm 1 đáp án',
  multiple_choice: 'Trắc nghiệm nhiều đáp án',
  fill_in_blank: 'Điền vào chỗ trống',
  essay: 'Tự luận',
};

export const TeacherProgressScreen: React.FC<TeacherProgressScreenProps> = ({
  teacher,
  classes,
  students,
}) => {
  const classIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes]);
  const myStudents = useMemo(
    () => students.filter((s) => classIds.has(s.class_id)),
    [students, classIds]
  );
  const studentIds = useMemo(() => myStudents.map((s) => s.id), [myStudents]);

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<BiSessionSummary | null>(null);
  const [assignments, setAssignments] = useState<BiAssignment[]>([]);
  const [attempts, setAttempts] = useState<BiAttempt[]>([]);
  const [pending, setPending] = useState<BiPendingReview[]>([]);
  const [flows, setFlows] = useState<BiTopicFlow[]>([]);
  const [openAsg, setOpenAsg] = useState<string | null>(null);
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);
  const [gradeDraft, setGradeDraft] = useState<Record<string, { score: string; feedback: string }>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeMsg, setGradeMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ss, asg, att, pen, fl] = await Promise.all([
        getSessionsSummary(studentIds),
        getAssignmentsProgress(teacher.id, studentIds),
        getAttemptsWithAnswers(studentIds),
        getPendingReviews(studentIds),
        getTopicFlows(teacher.id),
      ]);
      setSessions(ss);
      setAssignments(asg);
      setAttempts(att);
      setPending(pen);
      setFlows(fl);
    } finally {
      setLoading(false);
    }
  }, [teacher.id, studentIds]);

  useEffect(() => {
    load();
  }, [load]);

  const totalTargets = assignments.reduce((s, a) => s + a.targets.length, 0);
  const totalSubmitted = assignments.reduce((s, a) => s + a.submittedCount, 0);
  const delta =
    sessions != null ? sessions.activeLast7 - sessions.activePrev7 : 0;
  const deltaPct =
    sessions && sessions.activePrev7 > 0
      ? Math.round((delta / sessions.activePrev7) * 100)
      : null;
  const maxPerDay = sessions ? Math.max(1, ...sessions.perDay.map((d) => d.count)) : 1;

  const handleGrade = async (review: BiPendingReview) => {
    const draft = gradeDraft[review.reviewId] || { score: '', feedback: '' };
    const score = Number(draft.score);
    if (draft.score === '' || Number.isNaN(score) || score < 0 || (review.maxScore != null && score > review.maxScore)) {
      setGradeMsg(`Điểm cho câu của ${review.studentName} phải từ 0 đến ${review.maxScore ?? '?'}.`);
      return;
    }
    setGradingId(review.reviewId);
    setGradeMsg(null);
    try {
      await gradePendingAnswer(review, score, draft.feedback, teacher.id);
      setGradeMsg(`Đã chấm câu của ${review.studentName}: ${score} điểm.`);
      await load();
    } catch (e: any) {
      setGradeMsg('Chấm thất bại: ' + (e?.message || 'lỗi không rõ'));
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tiến độ & lượt làm bài"
        subtitle="Phiên đăng nhập, bài tập độc lập, lượt làm và hàng chờ chấm — dữ liệu theo từng học sinh của lớp bạn phụ trách"
      />

      {loading ? (
        <div className="bg-white border border-[#E6DCC8] rounded-2xl p-8 text-center text-sm text-[#6B7280]">
          Đang tải dữ liệu tiến độ…
        </div>
      ) : (
        <>
          {/* ===== KPI ===== */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
              <div className="flex items-center gap-2 text-[#2F3E6B] text-xs font-bold uppercase tracking-wide">
                <LogIn size={15} /> Đăng nhập 7 ngày
              </div>
              <p className="text-3xl font-black text-[#2F3E6B] mt-2">
                {sessions?.activeLast7 ?? 0}
                <span className="text-base font-bold text-[#6B7280]"> / {myStudents.length} em</span>
              </p>
              <p className="text-xs mt-1 text-[#6B7280]">
                Kỳ trước: {sessions?.activePrev7 ?? 0} em
                {deltaPct != null && (
                  <span className={delta >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                    {' '}({delta >= 0 ? '+' : ''}{deltaPct}%)
                  </span>
                )}
              </p>
            </div>
            <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
              <div className="flex items-center gap-2 text-[#2F3E6B] text-xs font-bold uppercase tracking-wide">
                <Activity size={15} /> Phiên đăng nhập
              </div>
              <p className="text-3xl font-black text-[#2F3E6B] mt-2">{sessions?.sessions.length ?? 0}</p>
              <p className="text-xs mt-1 text-[#6B7280]">Toàn bộ lịch sử đã ghi nhận</p>
            </div>
            <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
              <div className="flex items-center gap-2 text-[#2F3E6B] text-xs font-bold uppercase tracking-wide">
                <BookOpenCheck size={15} /> Đã nộp bài độc lập
              </div>
              <p className="text-3xl font-black text-[#2F3E6B] mt-2">
                {totalSubmitted}
                <span className="text-base font-bold text-[#6B7280]"> / {totalTargets}</span>
              </p>
              <p className="text-xs mt-1 text-[#6B7280]">Theo lượt giao bài cho từng em</p>
            </div>
            <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
              <div className="flex items-center gap-2 text-[#2F3E6B] text-xs font-bold uppercase tracking-wide">
                <ClipboardList size={15} /> Lượt làm bài
              </div>
              <p className="text-3xl font-black text-[#2F3E6B] mt-2">{attempts.length}</p>
              <p className="text-xs mt-1 text-[#6B7280]">Luồng học + bài độc lập</p>
            </div>
            <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
              <div className="flex items-center gap-2 text-[#E2704A] text-xs font-bold uppercase tracking-wide">
                <Hourglass size={15} /> Câu chờ chấm
              </div>
              <p className="text-3xl font-black text-[#E2704A] mt-2">{pending.length}</p>
              <p className="text-xs mt-1 text-[#6B7280]">Câu tự luận / trả lời ngắn</p>
            </div>
          </div>

          {/* ===== ĐĂNG NHẬP & CHUYÊN CẦN ===== */}
          <section className="bg-white border border-[#E6DCC8] rounded-2xl p-5">
            <h3 className="font-black text-[#2F3E6B] flex items-center gap-2">
              <Smartphone size={18} /> Đăng nhập & chuyên cần
              {sessions?.anchorDate && (
                <span className="text-xs font-semibold text-[#6B7280]">
                  (7 ngày tính tới {fmtDate(sessions.anchorDate)} — ngày có dữ liệu mới nhất)
                </span>
              )}
            </h3>
            {sessions && sessions.perDay.length > 0 && (
              <div className="flex items-end gap-1.5 h-28 mt-4">
                {sessions.perDay.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-[#2F3E6B]">{d.count || ''}</span>
                    <div
                      className="w-full rounded-t-lg bg-[#2F3E6B]/85"
                      style={{ height: `${Math.max(4, (d.count / maxPerDay) * 72)}px` }}
                      title={`${fmtDate(d.date)}: ${d.count} phiên`}
                    />
                    <span className="text-[9px] text-[#6B7280]">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[#6B7280] border-b border-[#E6DCC8]">
                    <th className="py-2 pr-3">Học sinh</th>
                    <th className="py-2 pr-3">Đăng nhập</th>
                    <th className="py-2 pr-3">Thiết bị</th>
                    <th className="py-2 pr-3">Thời lượng</th>
                    <th className="py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {(sessions?.sessions || []).slice(0, 10).map((s) => (
                    <tr key={s.id} className="border-b border-[#E6DCC8]/50">
                      <td className="py-2 pr-3 font-semibold text-[#2F3E6B]">{s.studentName}</td>
                      <td className="py-2 pr-3">{fmtDateTime(s.loginAt)}</td>
                      <td className="py-2 pr-3">{s.deviceType || '—'}</td>
                      <td className="py-2 pr-3">{s.durationMinutes != null ? `${s.durationMinutes} phút` : '—'}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {s.status === 'COMPLETED' ? 'Đã kết thúc' : 'Đang hoạt động'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(sessions?.sessions.length || 0) === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-[#6B7280]">Chưa có phiên đăng nhập nào được ghi nhận.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ===== BÀI ĐỘC LẬP & TIẾN ĐỘ NỘP ===== */}
          <section className="bg-white border border-[#E6DCC8] rounded-2xl p-5">
            <h3 className="font-black text-[#2F3E6B] flex items-center gap-2">
              <BookOpenCheck size={18} /> Bài tập độc lập & tiến độ nộp
            </h3>
            <div className="space-y-3 mt-4">
              {assignments.map((a) => {
                const pct = a.targets.length ? Math.round((a.submittedCount / a.targets.length) * 100) : 0;
                const open = openAsg === a.id;
                return (
                  <div key={a.id} className="border border-[#E6DCC8] rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 bg-[#FFFDF8] hover:bg-[#FBF6EA] text-left"
                      onClick={() => setOpenAsg(open ? null : a.id)}
                    >
                      {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      <span className="font-bold text-[#2F3E6B] flex-1">{a.title}</span>
                      {a.isTimed && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center gap-1">
                          <Timer size={12} /> {a.timeLimitMinutes} phút
                        </span>
                      )}
                      <span className="text-xs text-[#6B7280]">{a.questionCount} câu · Hạn {fmtDateTime(a.dueAt)}</span>
                      <span className="text-sm font-black text-[#2F3E6B]">{a.submittedCount}/{a.targets.length} đã nộp</span>
                    </button>
                    <div className="h-1.5 bg-[#E6DCC8]/50">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    {open && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-[#6B7280] bg-white">
                            <th className="py-2 px-4">Học sinh</th>
                            <th className="py-2 px-3">Trạng thái</th>
                            <th className="py-2 px-3">Nộp lần đầu</th>
                            <th className="py-2 px-3">Số lượt làm</th>
                            <th className="py-2 px-3">Điểm cao nhất</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.targets.map((t) => (
                            <tr key={t.id} className="border-t border-[#E6DCC8]/50">
                              <td className="py-2 px-4 font-semibold text-[#2F3E6B]">{t.studentName}</td>
                              <td className="py-2 px-3">
                                {t.status === 'SUBMITTED' ? (
                                  <span className="text-emerald-700 font-bold text-xs">Đã nộp</span>
                                ) : (
                                  <span className="text-red-500 font-bold text-xs">Chưa nộp</span>
                                )}
                              </td>
                              <td className="py-2 px-3">{fmtDateTime(t.firstSubmittedAt)}</td>
                              <td className="py-2 px-3">{t.attemptsCount}</td>
                              <td className="py-2 px-3">{t.bestScore != null ? `${t.bestScore}/${t.maxScore ?? '?'}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
              {assignments.length === 0 && (
                <p className="text-sm text-[#6B7280] text-center py-3">Chưa có bài tập độc lập nào.</p>
              )}
            </div>
          </section>

          {/* ===== HÀNG CHỜ CHẤM ===== */}
          <section className="bg-white border border-[#E6DCC8] rounded-2xl p-5">
            <h3 className="font-black text-[#2F3E6B] flex items-center gap-2">
              <PenLine size={18} /> Hàng chờ chấm ({pending.length})
            </h3>
            {gradeMsg && (
              <p className="mt-3 text-sm font-semibold px-3 py-2 rounded-xl bg-[#2F3E6B]/5 text-[#2F3E6B]">{gradeMsg}</p>
            )}
            <div className="space-y-3 mt-4">
              {pending.map((r) => {
                const draft = gradeDraft[r.reviewId] || { score: '', feedback: '' };
                return (
                  <div key={r.reviewId} className="border border-[#E6DCC8] rounded-xl p-4 bg-[#FFFDF8]">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-black text-[#2F3E6B] text-sm">{r.studentName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#2F3E6B]/10 text-[#2F3E6B] font-bold">{r.sourceTitle}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        {QTYPE_LABEL[r.questionType] || r.questionType} · tối đa {r.maxScore ?? '?'} điểm
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#374151]">{r.questionPrompt}</p>
                    <div className="mt-2 text-sm bg-white border border-[#E6DCC8] rounded-lg px-3 py-2 whitespace-pre-wrap">
                      {r.responseText}
                    </div>
                    {r.rubricText && (
                      <p className="mt-2 text-xs text-[#6B7280] flex items-start gap-1">
                        <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> Gợi ý chấm: {r.rubricText}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={r.maxScore ?? undefined}
                        step="0.5"
                        placeholder="Điểm"
                        className="w-24 border border-[#E6DCC8] rounded-lg px-3 py-2 text-sm"
                        value={draft.score}
                        onChange={(e) =>
                          setGradeDraft((p) => ({ ...p, [r.reviewId]: { ...draft, score: e.target.value } }))
                        }
                      />
                      <input
                        type="text"
                        placeholder="Nhận xét cho học sinh (không bắt buộc)"
                        className="flex-1 min-w-52 border border-[#E6DCC8] rounded-lg px-3 py-2 text-sm"
                        value={draft.feedback}
                        onChange={(e) =>
                          setGradeDraft((p) => ({ ...p, [r.reviewId]: { ...draft, feedback: e.target.value } }))
                        }
                      />
                      <button
                        className="flex items-center gap-1.5 bg-[#E2704A] hover:bg-[#d1633c] text-white font-bold text-sm px-4 py-2 rounded-lg disabled:opacity-50"
                        disabled={gradingId === r.reviewId}
                        onClick={() => handleGrade(r)}
                      >
                        <Send size={14} /> {gradingId === r.reviewId ? 'Đang lưu…' : 'Chấm'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {pending.length === 0 && (
                <p className="text-sm text-[#6B7280] text-center py-3">Không còn câu nào chờ chấm. 🎉</p>
              )}
            </div>
          </section>

          {/* ===== LƯỢT LÀM BÀI ===== */}
          <section className="bg-white border border-[#E6DCC8] rounded-2xl p-5">
            <h3 className="font-black text-[#2F3E6B] flex items-center gap-2">
              <ClipboardList size={18} /> Lượt làm bài gần đây ({attempts.length})
            </h3>
            <div className="space-y-2 mt-4">
              {attempts.slice(0, 30).map((a) => {
                const open = openAttempt === a.id;
                return (
                  <div key={a.id} className="border border-[#E6DCC8] rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#FFFDF8] hover:bg-[#FBF6EA] text-left text-sm"
                      onClick={() => setOpenAttempt(open ? null : a.id)}
                    >
                      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="font-bold text-[#2F3E6B]">{a.studentName}</span>
                      <span className="flex-1 truncate">{a.sourceTitle}</span>
                      <span className="text-xs text-[#6B7280] flex items-center gap-1">
                        <Clock size={12} /> {fmtDateTime(a.submittedAt)}
                      </span>
                      <span className="font-black text-[#2F3E6B]">
                        {a.score != null ? `${a.score}/${a.maxScore ?? '?'}` : 'Chưa có điểm'}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${a.gradingStatus === 'GRADED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {a.gradingStatus === 'GRADED' ? 'Đã chấm xong' : a.gradingStatus === 'PENDING_TEACHER_REVIEW' ? 'Chờ giáo viên chấm' : 'Chấm một phần'}
                      </span>
                    </button>
                    {open && (
                      <div className="px-4 py-3 space-y-2 bg-white">
                        {a.answers.map((ans) => (
                          <div key={ans.id} className="text-sm border-b border-[#E6DCC8]/50 pb-2 last:border-0">
                            <p className="font-semibold text-[#374151]">{ans.prompt}</p>
                            <p className="text-[#6B7280] mt-0.5">
                              Trả lời: <span className="text-[#111827]">{ans.responseText}</span>
                              {ans.isCorrect === true && <span className="text-emerald-600 font-bold"> · Đúng</span>}
                              {ans.isCorrect === false && <span className="text-red-500 font-bold"> · Sai</span>}
                              {ans.score != null && <span className="font-bold"> · {ans.score}/{ans.maxScore ?? '?'} điểm</span>}
                              {ans.responseTimeSeconds != null && <span> · {ans.responseTimeSeconds}s</span>}
                            </p>
                          </div>
                        ))}
                        {a.answers.length === 0 && <p className="text-sm text-[#6B7280]">Không có chi tiết câu trả lời.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              {attempts.length === 0 && (
                <p className="text-sm text-[#6B7280] text-center py-3">Chưa có lượt làm bài nào.</p>
              )}
            </div>
          </section>

          {/* ===== LUỒNG HỌC THEO CHỦ ĐỀ ===== */}
          <section className="bg-white border border-[#E6DCC8] rounded-2xl p-5">
            <h3 className="font-black text-[#2F3E6B] flex items-center gap-2">
              <BookOpenCheck size={18} /> Luồng học theo chủ đề
            </h3>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              {flows.map((tf) => (
                <div key={tf.topicId} className="border border-[#E6DCC8] rounded-xl p-4 bg-[#FFFDF8]">
                  <p className="font-black text-[#2F3E6B]">{tf.topicTitle}</p>
                  {tf.flows.map((f) => (
                    <div key={f.flowType} className="mt-3">
                      <p className="text-xs font-black uppercase tracking-wide text-[#E2704A]">
                        {f.flowType === 'VIDEO_FLOW' ? 'Luồng Video' : f.flowType === 'THEORY_FLOW' ? 'Luồng Lý thuyết' : f.flowType}
                      </p>
                      <ol className="mt-1.5 space-y-1">
                        {f.steps.map((s) => (
                          <li key={s.id} className="text-sm flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#2F3E6B] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                              {s.sequenceNo ?? '·'}
                            </span>
                            <span className="flex-1">{s.title}</span>
                            {s.required && <span className="text-[10px] font-bold text-[#E2704A]">BẮT BUỘC</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                  {tf.flows.length === 0 && <p className="text-sm text-[#6B7280] mt-2">Chưa có hoạt động học nào.</p>}
                </div>
              ))}
              {flows.length === 0 && (
                <p className="text-sm text-[#6B7280]">Chưa có chủ đề nào thuộc về bạn.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
