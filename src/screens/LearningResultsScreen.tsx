import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Target, Zap, BookOpenCheck, Award, Lock, TrendingUp, X, MessageSquareText, CheckCircle2, XCircle, FileCheck } from 'lucide-react';
import { StudentState, Topic, QuestionResult, EssaySubmission } from '../types.ts';
import { QuestionWithMeta } from '../services/types.ts';
import { calculateAllMastery } from '../logic/mastery.ts';
import { countLearningSteps } from '../logic/studentStateUtils.ts';
import { formatScore } from '../utils/scoreFormat.ts';
import { BADGES_CATALOG } from '../data/badges.ts';
import { essayRepository } from '../services/index.ts';
import {
  getStudentAssignments,
  getOwnAttemptsWithAnswers,
  getOwnReviews,
  BiAttempt,
  BiPendingReview,
} from '../services/api/biClient.ts';

interface LearningResultsScreenProps {
  state: StudentState;
  topics: Topic[];
  onSelectTopic?: (topicId: string) => void;
  // Ngân hàng câu hỏi (để tra loại câu: trắc nghiệm = single/multi/fill, tự luận = essay).
  questions?: Record<string, QuestionWithMeta>;
  studentId?: string;
}

const ONE_WEEK = 7 * 86400000;

type TopicStatus = 'SOLID' | 'PROGRESSING' | 'NEEDS_REVIEW' | 'INSUFFICIENT_DATA';

const STATUS_META: Record<TopicStatus, { label: string; chip: string; bar: string }> = {
  SOLID: { label: 'Đã hoàn thành', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: '#16A34A' },
  PROGRESSING: { label: 'Đang học', chip: 'bg-sky-50 text-sky-700 border-sky-200', bar: '#38BDF8' },
  NEEDS_REVIEW: { label: 'Cần ôn lại', chip: 'bg-amber-50 text-amber-700 border-amber-200', bar: '#FBBF24' },
  INSUFFICIENT_DATA: { label: 'Chưa học', chip: 'bg-slate-100 text-slate-500 border-slate-200', bar: '#CBD5E1' },
};

// Trắc nghiệm = các câu chấm tự động (single/multi/fill). Câu tự luận lấy điểm
// từ phiếu chấm essay_submissions, KHÔNG dùng điểm tạm 0.8 mà QuizRunner ghi
// vào questionResults lúc nộp (điểm tạm đó không phải điểm thật).
const MCQ_TYPES = new Set(['single', 'multi', 'fill']);

// Ngưỡng "đạt" cho tự luận thang 10 (chuẩn điểm đạt phổ thông).
const ESSAY_PASS_SCORE = 5;

// Gom các result của cùng một lần nộp thành một "lần làm": QuizRunner đóng dấu
// timestamp cho từng câu trong cùng một vòng nộp nên các câu của một lần làm
// nằm sát nhau (dưới 2 giây); lần nộp khác cách nhau xa hơn.
const BATCH_GAP_MS = 2000;

interface Batch {
  start: number;
  end: number;
  results: QuestionResult[];
}

function groupIntoBatches(results: QuestionResult[]): Batch[] {
  const sorted = [...results].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const batches: Batch[] = [];
  for (const r of sorted) {
    const last = batches[batches.length - 1];
    if (last && (r.timestamp || 0) - (last.results[last.results.length - 1].timestamp || 0) <= BATCH_GAP_MS) {
      last.results.push(r);
      last.end = r.timestamp || 0;
    } else {
      batches.push({ start: r.timestamp || 0, end: r.timestamp || 0, results: [r] });
    }
  }
  return batches.reverse();
}

function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isUuidLike(value?: string | null): boolean {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Màn "Kết quả học tập" của học sinh (đợt sửa 24/10):
 * - BỎ hiển thị 4 mức nhớ/hiểu/phân tích/vận dụng ở phía học sinh (4 mức vẫn
 *   giữ nguyên phía giáo viên + AI; hàm calculateAllMastery KHÔNG bị sửa, chỉ
 *   còn dùng để tính chip trạng thái tổng quát của chủ đề).
 * - Điểm theo từng chủ đề = trắc nghiệm (đúng/tổng câu, điểm TB) + tự luận
 *   (thang 10, đạt/chưa đạt, đã chấm/chưa chấm) + lịch sử lần làm + popup chi
 *   tiết toàn bộ bài đã làm (trắc nghiệm → tự luận) kèm nhận xét của cô.
 * - Điểm theo từng bài kiểm tra = bài tập BI cô giao (điểm attempts, trạng thái
 *   chấm) + popup chi tiết (đáp án + nhận xét). Bài kiểm tra nội dung xem lại
 *   qua màn Bài tập (QuizReviewScreen).
 */
export const LearningResultsScreen: React.FC<LearningResultsScreenProps> = ({
  state,
  topics,
  onSelectTopic,
  questions = {},
  studentId,
}) => {
  const results = state.questionResults || [];

  // Bài tự luận: hợp nhất bản local trong state với phiếu chấm từ kho essay
  // (phiếu kho có total_score/teacher_feedback mới nhất sau khi cô chấm).
  // Chỉ gọi kho khi studentId là UUID — bộ lọc studentId của kho chỉ có tác
  // dụng với UUID; gọi với id không phải UUID sẽ trả về phiếu của học sinh
  // khác, tuyệt đối không dùng ở màn học sinh.
  const [essays, setEssays] = useState<EssaySubmission[]>(state.essaySubmissions || []);
  useEffect(() => {
    setEssays(state.essaySubmissions || []);
    if (!studentId || !isUuidLike(studentId)) return;
    let cancelled = false;
    essayRepository
      .getSubmissions({ studentId })
      .then((rows) => {
        if (cancelled) return;
        setEssays((prev) => {
          const byId = new Map<string, EssaySubmission>();
          for (const e of prev) byId.set(e.id, e);
          for (const r of rows || []) {
            const old = byId.get(r.id);
            byId.set(r.id, old ? { ...old, status: r.status, totalScore: r.totalScore, teacherFeedback: r.teacherFeedback, gradedAt: r.gradedAt } : r);
          }
          return [...byId.values()];
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [studentId, state.essaySubmissions]);

  // Tổng quan (giữ nguyên)
  const overview = useMemo(() => {
    const total = results.length;
    const correct = results.filter((r) => r.isCorrect).length;
    const avgScore =
      total > 0
        ? Math.round((results.reduce((acc, r) => acc + r.scoreRatio, 0) / total) * 100) / 10
        : 0;
    return {
      total,
      correctRate: total > 0 ? Math.round((correct / total) * 100) : 0,
      avgScore,
    };
  }, [results]);

  // Điểm mới theo từng chủ đề: trắc nghiệm + tự luận + lịch sử lần làm.
  const topicRows = useMemo(
    () =>
      topics.map((t) => {
        const topicResults = results.filter((r) => r.topicId === t.id);
        const mcq = topicResults.filter((r) => {
          const q = questions[r.questionId];
          // Không tra được loại câu (câu đã gỡ khỏi ngân hàng) thì tính vào
          // trắc nghiệm để không làm mất câu khỏi thống kê.
          return !q || MCQ_TYPES.has(q.type);
        });
        const mcqCorrect = mcq.filter((r) => r.isCorrect).length;
        const mcqAvg =
          mcq.length > 0
            ? Math.round((mcq.reduce((acc, r) => acc + r.scoreRatio, 0) / mcq.length) * 100) / 10
            : null;

        const topicQuestionIds = new Set(
          Object.values(questions)
            .filter((q) => q.topicId === t.id)
            .map((q) => q.id)
        );
        const topicEssays = essays.filter((e) => topicQuestionIds.has(e.questionId));
        const graded = topicEssays.filter((e) => e.status === 'GRADED' && e.totalScore != null);
        const pending = topicEssays.filter((e) => e.status !== 'GRADED');
        const essayAvg =
          graded.length > 0
            ? Math.round((graded.reduce((acc, e) => acc + (e.totalScore || 0), 0) / graded.length) * 10) / 10
            : null;
        const essayPassed = graded.filter((e) => (e.totalScore || 0) >= ESSAY_PASS_SCORE).length;

        const batches = groupIntoBatches(topicResults);

        // Chip trạng thái tổng quát (giữ nguyên logic cũ, chỉ dùng để gắn nhãn).
        const mastery = calculateAllMastery(results, t.id);
        const avg = Math.round(
          (mastery.NHAN_BIET.percentage +
            mastery.THONG_HIEU.percentage +
            mastery.PHAN_TICH.percentage +
            mastery.VAN_DUNG.percentage) /
            4
        );
        let status: TopicStatus = 'INSUFFICIENT_DATA';
        if (mastery.NHAN_BIET.totalQuestionsAttempted >= 3) {
          if (avg >= 80) status = 'SOLID';
          else if (avg >= 50) status = 'PROGRESSING';
          else status = 'NEEDS_REVIEW';
        }
        return {
          topic: t,
          mcq,
          mcqCorrect,
          mcqAvg,
          topicEssays,
          graded,
          pending,
          essayAvg,
          essayPassed,
          batches,
          attempts: topicResults.length,
          status,
        };
      }),
    [topics, results, questions, essays]
  );

  // Tiến bộ theo tuần (6 tuần gần nhất, chỉ tính bài làm của chính học sinh)
  const weeklyData = useMemo(() => {
    const now = Date.now();
    const weeks: { weekLabel: string; diemTB: number | null; soCau: number }[] = [];
    for (let w = 5; w >= 0; w--) {
      const start = now - (w + 1) * ONE_WEEK;
      const end = now - w * ONE_WEEK;
      const inWeek = results.filter((r) => r.timestamp >= start && r.timestamp < end);
      // Tuần không làm bài -> null (đường điểm đứt đoạn), không vẽ như điểm 0
      const avg =
        inWeek.length > 0
          ? Math.round((inWeek.reduce((acc, r) => acc + r.scoreRatio, 0) / inWeek.length) * 100) /
            10
          : null;
      weeks.push({
        weekLabel: w === 0 ? 'Tuần này' : w === 1 ? 'Tuần trước' : `${w} tuần trước`,
        diemTB: avg,
        soCau: inWeek.length,
      });
    }
    return weeks;
  }, [results]);

  const hasWeeklyData = weeklyData.some((w) => w.soCau > 0);
  const unlockedCount = (state.unlockedBadgeIds || []).length;

  // ---- Điểm theo từng bài kiểm tra (bài tập BI cô giao) ----
  const [biAssignments, setBiAssignments] = useState<any[]>([]);
  const [biLoaded, setBiLoaded] = useState(false);
  useEffect(() => {
    if (!studentId) {
      setBiLoaded(true);
      return;
    }
    let cancelled = false;
    setBiLoaded(false);
    getStudentAssignments(studentId)
      .then((rows) => {
        if (!cancelled) {
          setBiAssignments(rows || []);
          setBiLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBiAssignments([]);
          setBiLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // Popup chi tiết: chủ đề hoặc bài kiểm tra BI.
  const [detailTopicId, setDetailTopicId] = useState<string | null>(null);
  const [detailTestId, setDetailTestId] = useState<string | null>(null);
  const [testAttempts, setTestAttempts] = useState<BiAttempt[]>([]);
  const [testReviews, setTestReviews] = useState<BiPendingReview[]>([]);
  const [testDetailLoading, setTestDetailLoading] = useState(false);

  const detailTopic = topicRows.find((r) => r.topic.id === detailTopicId) || null;
  const detailTest = biAssignments.find((a: any) => a.assignmentId === detailTestId) || null;

  useEffect(() => {
    if (!detailTest || !studentId) {
      setTestAttempts([]);
      setTestReviews([]);
      return;
    }
    let cancelled = false;
    setTestDetailLoading(true);
    Promise.all([
      getOwnAttemptsWithAnswers(),
      getOwnReviews(),
    ])
      .then(([atts, reviews]) => {
        if (cancelled) return;
        // Khớp theo assignmentId (chắc chắn); chỉ khi lần làm không mang
        // assignmentId mới rơi về khớp tiêu đề bài.
        const mine = (atts || [])
          .filter((a) => a.assignmentId
            ? a.assignmentId === detailTest.assignmentId
            : a.sourceType === 'assignment' && a.sourceTitle === detailTest.title)
          .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
        setTestAttempts(mine);
        const attIds = new Set(mine.map((a) => a.id));
        setTestReviews((reviews || []).filter((r) => attIds.has(r.attemptId)));
        setTestDetailLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setTestAttempts([]);
          setTestReviews([]);
          setTestDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [detailTest, studentId]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Tiêu đề */}
      <div>
        <h2 className="font-lora font-bold text-2xl text-[#1E1B4B] flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[#E2704A]" />
          Kết quả học tập
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Hành trình tiến bộ của em qua từng chủ đề — học đều mỗi ngày để cây tri thức lớn nhanh nhé!
        </p>
      </div>

      {/* Thẻ tổng quan */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-[#E8DFD1] p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Tổng XP tích lũy
          </div>
          <div className="text-2xl font-black text-[#1E1B4B]">
            {state.totalXp} <span className="text-xs font-bold text-slate-400">XP</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Hôm nay +{state.xpToday} XP</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8DFD1] p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
            <Trophy className="w-3.5 h-3.5 text-purple-500" /> Huy hiệu đạt được
          </div>
          <div className="text-2xl font-black text-[#1E1B4B]">
            {unlockedCount}
            <span className="text-xs font-bold text-slate-400"> /{BADGES_CATALOG.length}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Điểm danh tuần này {state.attendanceDaysThisWeek} ngày
          </div>
        </div>
      </div>

      {/* Điểm theo chủ đề: trắc nghiệm + tự luận + lịch sử lần làm */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5 space-y-4">
        <h3 className="font-lora font-bold text-base text-[#1E1B4B]">Điểm theo từng chủ đề</h3>
        {topicRows.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            Chưa có chủ đề nào được công bố. Khi thầy cô mở bài mới, kết quả của em sẽ hiện ở đây.
          </p>
        ) : (
          <div className="space-y-4">
            {topicRows.map((row) => {
              const meta = STATUS_META[row.status];
              const lastBatch = row.batches[0];
              return (
                <div
                  key={row.topic.id}
                  className="border rounded-2xl p-4"
                  style={{
                    backgroundColor: `${row.topic.colorScheme || '#2F3E6B'}26`,
                    borderColor: `${row.topic.colorScheme || '#2F3E6B'}80`,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectTopic && onSelectTopic(row.topic.id)}
                      className="font-bold text-sm text-[#1E1B4B] hover:text-[#E2704A] transition-colors text-left"
                      title="Tới bài học của chủ đề này"
                    >
                      {row.topic.title}
                    </button>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm text-[#1E1B4B]">
                    <p>
                      <span className="font-bold">Trắc nghiệm: </span>
                      {row.mcq.length > 0 ? (
                        <>
                          đúng {row.mcqCorrect}/{row.mcq.length} câu
                          {row.mcqAvg !== null && (
                            <span className="text-slate-500"> • Điểm TB {row.mcqAvg}/10</span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">chưa làm câu trắc nghiệm nào</span>
                      )}
                    </p>
                    <p>
                      <span className="font-bold">Tự luận: </span>
                      {row.topicEssays.length > 0 ? (
                        <>
                          {row.graded.length} đã chấm
                          {row.essayAvg !== null && (
                            <span className="text-slate-500"> (ĐTB {row.essayAvg}/10)</span>
                          )}
                          {` • ${row.essayPassed} đạt • ${row.pending.length} chưa chấm`}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">chưa nộp bài tự luận nào</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      Lịch sử: {row.batches.length} lần làm
                      {lastBatch ? ` • Gần nhất ${fmtDateTime(lastBatch.start)}` : ''}
                      {` • Tổng ${row.attempts} câu đã làm`}
                    </p>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setDetailTopicId(row.topic.id)}
                      className="px-4 py-2 rounded-full bg-[#2F3E6B] text-white text-xs font-bold hover:opacity-90 active:scale-95 transition"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Điểm theo từng bài kiểm tra (bài tập BI cô giao) */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5 space-y-4">
        <h3 className="font-lora font-bold text-base text-[#1E1B4B] flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-[#E2704A]" /> Điểm theo từng bài kiểm tra
        </h3>
        {!biLoaded ? (
          <p className="text-sm text-slate-400 italic">Đang tải bài kiểm tra cô giao…</p>
        ) : biAssignments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            Chưa có bài kiểm tra nào cô giao. Bài kiểm tra nội dung em xem lại ở mục Bài tập.
          </p>
        ) : (
          <div className="space-y-3">
            {biAssignments.map((a: any) => {
              const attempts = a.attempts || [];
              const scored = attempts.filter((x: any) => x.score_awarded != null && x.max_score != null);
              const best = scored.length
                ? scored.reduce((acc: any, cur: any) =>
                    Number(cur.score_awarded) / Number(cur.max_score) >
                    Number(acc.score_awarded) / Number(acc.max_score)
                      ? cur
                      : acc
                  )
                : null;
              const latest = attempts[0];
              return (
                <div key={a.assignmentId} className="border border-[#E6DCC8] rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-sm text-[#1E1B4B]">{a.title}</p>
                    <span className="text-xs font-bold text-slate-500">
                      {attempts.length > 0 ? `${attempts.length} lần nộp` : 'Chưa nộp'}
                    </span>
                  </div>
                  <p className="text-sm text-[#1E1B4B] mt-1">
                    {best ? (
                      <>
                        Điểm cao nhất: <span className="font-bold text-[#2F6B4F]">{formatScore(Number(best.score_awarded))}/{formatScore(Number(best.max_score))}</span>
                        {latest?.grading_status && (
                          <span className="text-slate-500"> • Trạng thái chấm: {latest.grading_status}</span>
                        )}
                      </>
                    ) : attempts.length > 0 ? (
                      <span className="text-amber-600 font-bold">Đã nộp — cô giáo chưa chấm</span>
                    ) : (
                      <span className="text-slate-400 italic">Chưa nộp bài</span>
                    )}
                  </p>
                  {attempts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDetailTestId(a.assignmentId)}
                      className="mt-2 px-4 py-2 rounded-full bg-[#2F3E6B] text-white text-xs font-bold hover:opacity-90 active:scale-95 transition"
                    >
                      Xem chi tiết
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tiến bộ theo tuần: đường mốc nối 6 tuần (tuần này nổi bật nhất;
          tuần chưa làm bài hiện mốc xám thay vì biến mất khỏi biểu đồ) */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5">
        <div className="flex items-start justify-between gap-3 mb-5">
          <h3 className="font-lora font-bold text-base text-[#1E1B4B]">
            Biểu đồ tiến bộ (6 tuần gần nhất)
          </h3>
          {hasWeeklyData && (
            <div className="text-right shrink-0">
              <p className="text-[11px] font-semibold text-slate-400">
                Tổng {weeklyData.reduce((acc, w) => acc + w.soCau, 0)} câu · Tuần này:{' '}
                {weeklyData[5].soCau} câu
                {weeklyData[5].diemTB !== null && ` · ĐTB ${formatScore(weeklyData[5].diemTB)}`}
              </p>
            </div>
          )}
        </div>
        {hasWeeklyData ? (
          <div className="relative px-1 pt-1 pb-1">
            {/* Đường nối các mốc tuần */}
            <div className="absolute left-[8%] right-[8%] top-[27px] h-1.5 rounded-full bg-slate-100" />
            <div
              className="absolute left-[8%] top-[27px] h-1.5 rounded-full bg-gradient-to-r from-indigo-200 via-indigo-300 to-[#E2704A]"
              style={{ width: '84%' }}
            />
            <div className="relative flex items-start">
              {weeklyData.map((w, i) => {
                const isCurrent = i === weeklyData.length - 1;
                const hasData = w.soCau > 0 && w.diemTB !== null;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center text-center min-w-0">
                    <div
                      className={`rounded-full flex items-center justify-center font-extrabold border-4 border-white shadow-sm ${
                        isCurrent
                          ? 'w-14 h-14 text-sm text-white bg-gradient-to-br from-[#E2704A] to-[#F59E0B] ring-4 ring-orange-100'
                          : hasData
                            ? 'w-11 h-11 mt-[5px] text-xs text-white bg-gradient-to-br from-[#4F46E5] to-[#7C3AED]'
                            : 'w-11 h-11 mt-[5px] text-xs text-slate-300 bg-slate-100'
                      }`}
                      title={hasData ? `ĐTB ${formatScore(w.diemTB)} — ${w.soCau} câu` : 'Chưa làm bài'}
                    >
                      {hasData ? formatScore(w.diemTB) : '—'}
                    </div>
                    <p
                      className={`mt-2 text-[11px] leading-tight ${
                        isCurrent ? 'font-extrabold text-[#1E1B4B]' : 'font-semibold text-slate-500'
                      }`}
                    >
                      {w.weekLabel}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {w.soCau > 0 ? `${w.soCau} câu` : 'Chưa học'}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-slate-400 text-center">
              Số trong mỗi mốc là điểm trung bình của tuần đó (thang 10).
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">
            Em chưa làm bài trong 6 tuần gần đây. Làm vài câu hỏi hôm nay để biểu đồ tiến bộ bắt đầu
            nhích lên nhé!
          </p>
        )}
      </div>

      {/* Thành tích & huy hiệu */}
      <div className="bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5">
        <h3 className="font-lora font-bold text-base text-[#1E1B4B] mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-500" /> Thành tích & Huy hiệu
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BADGES_CATALOG.map((badge) => {
            const unlocked = (state.unlockedBadgeIds || []).includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`p-3.5 rounded-2xl border flex gap-3 ${
                  unlocked
                    ? 'bg-purple-50/60 border-purple-200'
                    : 'bg-slate-50 border-slate-200 opacity-70'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    unlocked ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {unlocked ? <Award className="w-5 h-5" /> : <Lock className="w-4.5 h-4.5" />}
                </div>
                <div className="min-w-0">
                  <div className={`text-xs font-bold ${unlocked ? 'text-purple-900' : 'text-slate-500'}`}>
                    {badge.title}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{badge.desc}</p>
                  <span
                    className={`inline-block mt-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      unlocked ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {unlocked ? 'Đã đạt ✓' : 'Chưa đạt'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* POPUP CHI TIẾT CHỦ ĐỀ: toàn bộ bài đã làm — trắc nghiệm trước, tự luận sau,
          nhận xét của cô nằm ngay dưới từng bài tự luận. */}
      {detailTopic && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDetailTopicId(null)}>
          <div
            className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg text-[#1E1B4B]">{detailTopic.topic.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Trắc nghiệm đúng {detailTopic.mcqCorrect}/{detailTopic.mcq.length} câu
                  {detailTopic.mcqAvg !== null && ` • ĐTB ${detailTopic.mcqAvg}/10`} • Tự luận{' '}
                  {detailTopic.topicEssays.length} bài ({detailTopic.graded.length} đã chấm,{' '}
                  {detailTopic.pending.length} chưa chấm)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailTopicId(null)}
                className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 shrink-0"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailTopic.batches.length === 0 && detailTopic.topicEssays.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Em chưa làm bài nào ở chủ đề này.</p>
            ) : (
              <>
                {detailTopic.batches.map((batch, bi) => {
                  const batchMcq = batch.results.filter((r) => {
                    const q = questions[r.questionId];
                    return !q || MCQ_TYPES.has(q.type);
                  });
                  const batchMcqCorrect = batchMcq.filter((r) => r.isCorrect).length;
                  const batchEssays = detailTopic.topicEssays.filter(
                    (e) => e.submittedAt >= batch.start - BATCH_GAP_MS && e.submittedAt <= batch.end + BATCH_GAP_MS
                  );
                  return (
                    <div key={bi} className="border border-[#E6DCC8] rounded-2xl p-4 space-y-3">
                      <p className="font-bold text-sm text-[#2F3E6B]">
                        Lần làm {detailTopic.batches.length - bi} • {fmtDateTime(batch.start)}
                        <span className="font-normal text-slate-500">
                          {' '}
                          • Trắc nghiệm đúng {batchMcqCorrect}/{batchMcq.length} câu
                        </span>
                      </p>
                      {/* Trắc nghiệm trước */}
                      <div className="space-y-2">
                        {batch.results
                          .filter((r) => {
                            const q = questions[r.questionId];
                            return !q || MCQ_TYPES.has(q.type);
                          })
                          .map((r) => {
                            const q = questions[r.questionId];
                            return (
                              <div key={r.questionId} className="flex items-start gap-2 text-sm">
                                {r.isCorrect ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#2F6B4F] shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                )}
                                <span className="text-[#1E1B4B]">
                                  {q?.prompt || 'Câu hỏi (đã gỡ khỏi ngân hàng)'}
                                  <span className="text-slate-500">
                                    {' '}
                                    • {r.isCorrect ? 'Đúng' : 'Sai'} • Điểm {Math.round(r.scoreRatio * 100)}%
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                      </div>
                      {/* Tự luận sau, kèm nhận xét của cô ngay dưới bài làm */}
                      {batchEssays.map((e) => (
                        <div key={e.id} className="bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-500">
                            Tự luận • {questions[e.questionId]?.prompt || e.promptTitle || 'Bài viết tự luận'}
                          </p>
                          <p className="text-sm text-[#1E1B4B] line-clamp-6">{e.content}</p>
                          {e.status === 'GRADED' && e.totalScore != null ? (
                            <p className="text-sm font-bold text-[#2F6B4F]">Đã chấm: {e.totalScore}/10</p>
                          ) : (
                            <p className="text-sm font-bold text-amber-600">Cô giáo chưa chấm</p>
                          )}
                          {e.teacherFeedback && (
                            <p className="text-sm text-[#1E1B4B] bg-white border border-[#2F6B4F]/20 rounded-xl p-3 flex gap-2">
                              <MessageSquareText className="w-4 h-4 shrink-0 mt-0.5 text-[#2F6B4F]" />
                              <span>
                                <span className="font-bold">Nhận xét của cô: </span>
                                {e.teacherFeedback}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}
                      {batchEssays.length === 0 &&
                        batch.results.some((r) => questions[r.questionId]?.type === 'essay') && (
                          <p className="text-xs text-slate-400 italic">
                            Bài tự luận của lần này không còn gắn được với lần làm (đã nộp từ thiết bị khác).
                          </p>
                        )}
                    </div>
                  );
                })}
                {/* Bài tự luận không gắn được vào lần làm nào (vẫn phải hiện) */}
                {detailTopic.topicEssays.filter(
                  (e) =>
                    !detailTopic.batches.some(
                      (b) => e.submittedAt >= b.start - BATCH_GAP_MS && e.submittedAt <= b.end + BATCH_GAP_MS
                    )
                ).map((e) => (
                  <div key={e.id} className="bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-slate-500">
                      Tự luận (không gắn lần làm) • {questions[e.questionId]?.prompt || e.promptTitle || 'Bài viết tự luận'}
                    </p>
                    <p className="text-sm text-[#1E1B4B] line-clamp-6">{e.content}</p>
                    {e.status === 'GRADED' && e.totalScore != null ? (
                      <p className="text-sm font-bold text-[#2F6B4F]">Đã chấm: {e.totalScore}/10</p>
                    ) : (
                      <p className="text-sm font-bold text-amber-600">Cô giáo chưa chấm</p>
                    )}
                    {e.teacherFeedback && (
                      <p className="text-sm text-[#1E1B4B] bg-white border border-[#2F6B4F]/20 rounded-xl p-3 flex gap-2">
                        <MessageSquareText className="w-4 h-4 shrink-0 mt-0.5 text-[#2F6B4F]" />
                        <span>
                          <span className="font-bold">Nhận xét của cô: </span>
                          {e.teacherFeedback}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* POPUP CHI TIẾT BÀI KIỂM TRA: các lần nộp + đáp án + nhận xét của cô */}
      {detailTest && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDetailTestId(null)}>
          <div
            className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg text-[#1E1B4B]">{detailTest.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(detailTest.attempts || []).length} lần nộp
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailTestId(null)}
                className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 shrink-0"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {testDetailLoading ? (
              <p className="text-sm text-slate-400 italic">Đang tải bài làm…</p>
            ) : testAttempts.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                Chưa tải được chi tiết lần làm, thử mở lại sau.
              </p>
            ) : (
              testAttempts.map((att) => (
                <div key={att.id} className="border border-[#E6DCC8] rounded-2xl p-4 space-y-3">
                  <p className="font-bold text-sm text-[#2F3E6B]">
                    Lần {att.attemptNo ?? '—'}
                    {att.submittedAt && ` • ${fmtDateTime(new Date(att.submittedAt).getTime())}`}
                    {att.score != null && att.maxScore != null && (
                      <span className="text-[#2F6B4F]"> • Điểm {formatScore(att.score)}/{formatScore(att.maxScore)}</span>
                    )}
                    {att.gradingStatus && (
                      <span className="font-normal text-slate-500"> • {att.gradingStatus}</span>
                    )}
                  </p>
                  {(att.answers || []).map((ans) => {
                    const review = testReviews.find((r) => r.answerId === ans.id);
                    return (
                      <div key={ans.id} className="space-y-1.5">
                        <p className="text-sm text-[#1E1B4B]">
                          <span className="font-bold">{ans.prompt}</span>
                          <span className="text-slate-500">
                            {' '}
                            • Trả lời: {ans.responseText || '(trống)'}
                            {ans.isCorrect === true && ' • Đúng'}
                            {ans.isCorrect === false && ' • Sai'}
                            {ans.score != null && ans.maxScore != null && ` • ${formatScore(ans.score)}/${formatScore(ans.maxScore)}`}
                            {ans.gradingStatus === 'PENDING' && ' • Cô giáo chưa chấm'}
                          </span>
                        </p>
                        {review?.feedback && (
                          <p className="text-sm text-[#1E1B4B] bg-[#FAF5EB] border border-[#2F6B4F]/20 rounded-xl p-3 flex gap-2">
                            <MessageSquareText className="w-4 h-4 shrink-0 mt-0.5 text-[#2F6B4F]" />
                            <span>
                              <span className="font-bold">Nhận xét của cô: </span>
                              {review.feedback}
                              {review.scoreAwarded != null && ` (Điểm câu: ${formatScore(review.scoreAwarded)})`}
                            </span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {(att.answers || []).length === 0 && (
                    <p className="text-xs text-slate-400 italic">Lần này không còn đáp án chi tiết.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
