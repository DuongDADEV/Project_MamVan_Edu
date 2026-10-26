import React, { useState, useEffect, useMemo } from 'react';
import { formatScore } from '../../../utils/scoreFormat.ts';
import { EssaySubmission, RubricTemplate, RubricCriterion, GradedSampleEssay } from '../../../types.ts';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Save,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Send,
  RotateCcw,
  Star,
  HelpCircle,
  FileCheck,
  Award,
  Layers,
  Info,
} from 'lucide-react';

interface SplitGradingWorkspaceProps {
  submission: EssaySubmission;
  // Đợt sửa 3 (26/10): true khi bài văn của phiếu review đang được fetch
  // riêng (đường list đã hoãn tải text) — hiện "Đang tải bài làm…" thay cho
  // hộp "nộp bài trắng" để không hiển thị sai trong lúc chờ.
  contentLoading?: boolean;
  rubricTemplates: RubricTemplate[];
  onBack: () => void;
  onFinalizeGrading: (grading: {
    rubricScores: { criterionName: string; score: number; maxScore: number; reason?: string; comment?: string }[];
    totalScore: number;
    finalRatio: number;
    teacherFeedback: string;
    ai_vs_teacher_diff: number;
  }) => Promise<void>;
  onSaveDraft: (draft: {
    rubricScores: { criterionName: string; score: number; maxScore: number }[];
    teacherFeedback: string;
  }) => Promise<void>;
  onNextSubmission?: () => void;
  hasNextSubmission?: boolean;
  onPrevSubmission?: () => void;
  hasPrevSubmission?: boolean;
  onSaveToSampleLibrary?: (sample: Partial<GradedSampleEssay>) => Promise<void>;
}

export const SplitGradingWorkspace: React.FC<SplitGradingWorkspaceProps> = ({
  submission,
  contentLoading,
  rubricTemplates,
  onBack,
  onFinalizeGrading,
  onSaveDraft,
  onNextSubmission,
  hasNextSubmission,
  onPrevSubmission,
  hasPrevSubmission,
  onSaveToSampleLibrary,
}) => {
  // Chuẩn bị Rubric áp dụng
  const initialRubric: RubricCriterion[] = useMemo(() => {
    if (submission.rubric && submission.rubric.length > 0) return submission.rubric;
    const defaultTemplate = rubricTemplates.find((t) => t.isDefault) || rubricTemplates[0];
    if (defaultTemplate && defaultTemplate.criteria.length > 0) {
      return defaultTemplate.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        weight: c.weight,
        maxPoints: (c.weight / 100) * 10,
      }));
    }
    return [
      { id: 'c1', name: 'Nội dung ý & Cảm thụ', description: 'Cảm nhận đúng và phát hiện chi tiết đắt giá', weight: 40, maxPoints: 4 },
      { id: 'c2', name: 'Bố cục & Liên kết', description: 'Có mở, thân, kết đoạn mạch lạc', weight: 20, maxPoints: 2 },
      { id: 'c3', name: 'Dùng từ & Chính tả', description: 'Dùng từ gợi cảm, không lỗi chính tả', weight: 20, maxPoints: 2 },
      { id: 'c4', name: 'Sáng tạo & Cảm xúc', description: 'Có giọng điệu riêng, cảm xúc chân thành', weight: 20, maxPoints: 2 },
    ];
  }, [submission, rubricTemplates]);

  // Khởi tạo điểm và nhận xét từ AI hoặc draft cũ hoặc đã chấm
  const [criterionScores, setCriterionScores] = useState<Record<string, number>>({});
  // Chuỗi đang gõ trong ô điểm: giữ nguyên "7." / ô rỗng trong lúc gõ,
  // tránh parseFloat ép ngược lại làm mất dấu thập phân (điểm chỉ chốt khi hợp lệ)
  const [scoreTexts, setScoreTexts] = useState<Record<string, string>>({});
  const [criterionComments, setCriterionComments] = useState<Record<string, string>>({});
  const [generalFeedback, setGeneralFeedback] = useState<string>('');
  const [showSampleEssay, setShowSampleEssay] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [savedToSamples, setSavedToSamples] = useState<boolean>(false);

  // Sync state khi đổi submission
  useEffect(() => {
    const scores: Record<string, number> = {};
    const comments: Record<string, string> = {};

    // 1. Nếu đã chấm xong (GRADED), lấy điểm đã chấm
    if (submission.status === 'GRADED' && submission.rubricScores) {
      submission.rubricScores.forEach((rs) => {
        scores[rs.criterionName] = rs.score;
      });
      setGeneralFeedback(submission.finalComment || submission.teacherFeedback || '');
    }
    // 2. Nếu có draft dở
    else if (submission.teacherDraft) {
      submission.teacherDraft.rubricScores?.forEach((rs) => {
        scores[rs.criterionName] = rs.score;
      });
      setGeneralFeedback(submission.teacherDraft.teacherFeedback || '');
    }
    // 3. Nếu có gợi ý AI sẵn
    else if (submission.aiSuggestion?.rubricScores) {
      submission.aiSuggestion.rubricScores.forEach((rs) => {
        scores[rs.criterionName] = rs.score;
      });
      setGeneralFeedback(submission.aiSuggestion.overallComment || '');
    }
    // 4. Mặc định khởi tạo điểm = 0
    else {
      initialRubric.forEach((c) => {
        scores[c.name] = (c.maxPoints ?? ((c.weight ?? 20) / 100) * 10) * 0.8;
      });
      setGeneralFeedback('');
    }

    setCriterionScores(scores);
    setScoreTexts({});
    setCriterionComments(comments);
    setSavedToSamples(false);
  }, [submission, initialRubric]);

  // Tính tổng điểm giáo viên
  const totalTeacherScore = useMemo(() => {
    let sum = 0;
    initialRubric.forEach((c) => {
      const s = criterionScores[c.name] ?? 0;
      sum += s;
    });
    return Math.min(10, Math.max(0, Math.round(sum * 10) / 10));
  }, [criterionScores, initialRubric]);

  // Điểm AI gợi ý (không có gợi ý thì không so lệch — trước đây mặc định bịa 8.0)
  const aiTotalScore = submission.aiSuggestion?.suggestedTotalScore;
  const aiDiff =
    aiTotalScore !== undefined
      ? Math.round(Math.abs(totalTeacherScore - aiTotalScore) * 10) / 10
      : 0;

  // Hành động: Chấp nhận toàn bộ gợi ý AI
  const handleAcceptAllAI = () => {
    if (!submission.aiSuggestion) return;
    const newScores: Record<string, number> = {};
    submission.aiSuggestion.rubricScores?.forEach((rs) => {
      newScores[rs.criterionName] = rs.score;
    });
    setCriterionScores(newScores);
    setGeneralFeedback(submission.aiSuggestion.overallComment || '');
  };

  // Hành động: Bỏ gợi ý AI, chấm tay từ đầu
  const handleClearAI = () => {
    const zeroScores: Record<string, number> = {};
    initialRubric.forEach((c) => {
      zeroScores[c.name] = 0;
    });
    setCriterionScores(zeroScores);
    setGeneralFeedback('');
  };

  // Hành động: Lưu nháp
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const rubricScores = initialRubric.map((c) => ({
        criterionName: c.name,
        score: criterionScores[c.name] ?? 0,
        maxScore: c.maxPoints ?? ((c.weight ?? 20) / 100) * 10,
      }));
      await onSaveDraft({ rubricScores, teacherFeedback: generalFeedback });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Hành động: Chốt và gửi cho học sinh
  const handleFinalize = async () => {
    setIsSubmitting(true);
    try {
      const rubricScores = initialRubric.map((c) => ({
        criterionName: c.name,
        score: criterionScores[c.name] ?? 0,
        maxScore: c.maxPoints ?? ((c.weight ?? 20) / 100) * 10,
        comment: criterionComments[c.name],
      }));
      await onFinalizeGrading({
        rubricScores,
        totalScore: totalTeacherScore,
        finalRatio: totalTeacherScore / 10,
        teacherFeedback:
          generalFeedback.trim() ||
          'Thầy/cô đã chấm và ghi nhận bài làm văn của em. Hãy tiếp tục phát huy nhé!',
        ai_vs_teacher_diff: aiDiff,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lưu vào bài mẫu huấn luyện AI (ẩn danh học sinh)
  const handleSaveSample = async () => {
    if (!onSaveToSampleLibrary) return;
    let gradeLevel: 'poor' | 'average' | 'good' | 'excellent' = 'good';
    if (totalTeacherScore >= 8.5) gradeLevel = 'excellent';
    else if (totalTeacherScore >= 7.0) gradeLevel = 'good';
    else if (totalTeacherScore >= 5.0) gradeLevel = 'average';
    else gradeLevel = 'poor';

    await onSaveToSampleLibrary({
      title: `Bài mẫu (${totalTeacherScore}đ) - ${submission.promptTitle || 'Cảm nghĩ văn học'}`,
      topicPrompt: submission.promptTitle || 'Viết đoạn văn theo yêu cầu',
      studentContent: submission.content,
      levelGrade: gradeLevel,
      totalScore: totalTeacherScore,
      teacherFeedback: generalFeedback,
      isFromStudentSubmission: true,
      rubricScores: initialRubric.map((c) => ({
        criterionName: c.name,
        score: criterionScores[c.name] ?? 0,
        maxScore: c.maxPoints ?? ((c.weight ?? 20) / 100) * 10,
        comment: criterionComments[c.name],
      })),
    });
    setSavedToSamples(true);
  };

  // Phím tắt cơ bản (Alt + S để chốt, Alt + N để sang bài tiếp theo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleFinalize();
      } else if (e.altKey && e.key.toLowerCase() === 'n' && hasNextSubmission && onNextSubmission) {
        e.preventDefault();
        onNextSubmission();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinalize, onNextSubmission, hasNextSubmission]);

  const skillLevel = submission.skillLevel || 'VAN_DUNG';

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#FAF5EB] -m-4 sm:-m-6 lg:-m-8">
      {/* 1. TOPBAR ĐIỀU HƯỚNG MÀN CHẤM */}
      <div className="bg-white border-b border-[#E8DFD1] px-6 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Quay lại hàng đợi"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-[#1E1B4B] text-base">
                {submission.studentName || 'Học sinh'} · {submission.className ? (submission.className.toLowerCase().startsWith('lớp') ? submission.className : `Lớp ${submission.className}`) : 'Chưa rõ lớp'}
              </h2>
              {/* Badge mức năng lực ảnh hưởng Mastery */}
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  skillLevel === 'PHAN_TICH'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-indigo-100 text-[#4F46E5] border border-indigo-300'
                }`}
              >
                Cập nhật Mastery: {skillLevel === 'PHAN_TICH' ? 'Phân tích' : 'Vận dụng'}
              </span>
              {submission.status === 'GRADED' && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ Đã chốt điểm
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nộp bài lúc {new Date(submission.submittedAt).toLocaleTimeString('vi-VN')} ·{' '}
              {new Date(submission.submittedAt).toLocaleDateString('vi-VN')}
            </p>
          </div>
        </div>

        {/* Nút điều hướng Chấm liên tục + Phím tắt */}
        <div className="flex items-center gap-2">
          {/* Nút lưu bài mẫu huấn luyện */}
          <button
            onClick={handleSaveSample}
            disabled={savedToSamples}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              savedToSamples
                ? 'bg-purple-100 border-purple-300 text-purple-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200'
            }`}
            title="Đưa bài này vào thư viện mẫu để huấn luyện AI (đã tự động ẩn danh tên học sinh)"
          >
            <Star className={`w-3.5 h-3.5 ${savedToSamples ? 'fill-purple-600 text-purple-600' : 'text-amber-500'}`} />
            {savedToSamples ? 'Đã lưu làm bài mẫu' : 'Lưu làm bài mẫu'}
          </button>

          {/* Phím điều hướng Bài trước / Bài tiếp */}
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <button
              onClick={onPrevSubmission}
              disabled={!hasPrevSubmission}
              className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-xs font-semibold flex items-center gap-1"
              title="Bài trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-slate-400 px-1">|</span>
            <button
              onClick={onNextSubmission}
              disabled={!hasNextSubmission}
              className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-xs font-bold flex items-center gap-1"
              title="Bài tiếp theo (Alt + N)"
            >
              <span>Bài tiếp theo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. KHU VỰC CHIA ĐÔI (SPLIT VIEW) */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================= CỘT TRÁI: BÀI VIẾT CỦA HỌC SINH ================= */}
        <div className="w-1/2 flex flex-col border-r border-[#E8DFD1] bg-[#FFFDF8] overflow-y-auto">
          {/* Thông tin đề bài & yêu cầu */}
          <div className="p-6 border-b border-[#E8DFD1] bg-[#FAF5EB]/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4F46E5] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> Đề bài yêu cầu
              </span>
              <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-full border border-[#E8DFD1]">
                {submission.wordCount} từ {submission.minWords ? `(Yêu cầu: ${submission.minWords}–${submission.maxWords || 200} từ)` : ''}
              </span>
            </div>
            <h3 className="font-extrabold text-[#1E1B4B] text-base mb-1.5">
              {submission.promptTitle || 'Viết đoạn văn ghi lại cảm nghĩ về đoạn thơ'}
            </h3>
            <p className="text-xs text-slate-600 italic">
              Thuộc bài kiểm tra: {submission.quizTitle || 'Kiểm tra năng lực môn Ngữ văn'}
            </p>

            {/* Đoạn văn tham khảo nếu có */}
            {submission.sampleEssay && (
              <div className="mt-3">
                <button
                  onClick={() => setShowSampleEssay(!showSampleEssay)}
                  className="text-xs font-bold text-[#8B5CF6] hover:underline flex items-center gap-1"
                >
                  <Info className="w-3.5 h-3.5" />
                  {showSampleEssay ? 'Ẩn đoạn văn mẫu tham khảo' : 'Xem đoạn văn mẫu tham khảo'}
                </button>
                {showSampleEssay && (
                  <div className="mt-2 p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-950 leading-relaxed italic">
                    "{submission.sampleEssay}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bài làm trang giấy học trò */}
          <div className="p-8 flex-1">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xs border border-[#E8DFD1] relative">
              {/* Trang trí dòng kẻ phong cách vở ô ly */}
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 pb-2 border-b border-dashed border-slate-200 flex justify-between">
                <span>Bài làm học sinh</span>
                <span>{submission.studentName}</span>
              </div>
              {contentLoading ? (
                <div className="py-12 px-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="font-sans font-bold text-slate-500 text-sm">Đang tải bài làm…</p>
                </div>
              ) : submission.content && submission.content.trim().length > 0 ? (
                <p className="font-serif text-base text-[#1E1B4B] leading-relaxed whitespace-pre-wrap select-text">
                  {submission.content}
                </p>
              ) : (
                <div className="py-12 px-6 text-center bg-amber-50/60 rounded-xl border border-dashed border-amber-300">
                  <p className="font-sans font-bold text-amber-900 text-sm">Học sinh nộp bài trắng (chưa nhập nội dung bài viết)</p>
                  <p className="font-sans text-xs text-amber-700 mt-1">Học sinh đã nộp đề kiểm tra nhưng không điền nội dung câu tự luận này.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= CỘT PHẢI: RUBRIC & GỢI Ý AI ================= */}
        <div className="w-1/2 flex flex-col bg-white overflow-y-auto">
          {/* AI Banner & Nút đồng bộ */}
          <div className="p-5 border-b border-[#E8DFD1] bg-purple-50/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1 rounded-lg bg-purple-600 text-white shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <span className="font-extrabold text-purple-950 text-sm">
                    Gợi ý chấm tự động bởi AI (Chuẩn GDPT 2018)
                  </span>
                </div>
                <p className="text-xs text-purple-800">
                  AI đã phân tích ngữ nghĩa, cấu trúc và đề xuất mức điểm{' '}
                  <strong className="text-purple-950 text-sm font-black underline">
                    {formatScore(aiTotalScore)} / 10
                  </strong>
                  . Thầy/cô có toàn quyền điều chỉnh.
                </p>
              </div>

              {/* Nút hành động AI */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleAcceptAllAI}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1"
                  title="Điền toàn bộ điểm và nhận xét AI vào ô của giáo viên"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Chấp nhận gợi ý
                </button>
                <button
                  onClick={handleClearAI}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition-colors"
                  title="Xóa gợi ý AI để tự cho điểm từ đầu"
                >
                  Bỏ gợi ý, chấm tay
                </button>
              </div>
            </div>
          </div>

          {/* Danh sách tiêu chí Rubric */}
          <div className="p-6 space-y-6 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-[#1E1B4B] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#4F46E5]" /> Tiêu chí đánh giá & Chấm điểm
              </h4>
              <span className="text-xs font-semibold text-slate-500">
                Kéo thanh trượt hoặc gõ trực tiếp
              </span>
            </div>

            <div className="space-y-4">
              {initialRubric.map((criterion, idx) => {
                const maxPoints = criterion.maxPoints ?? ((criterion.weight ?? 20) / 100) * 10;
                const teacherScore = criterionScores[criterion.name] ?? 0;
                const aiItem = submission.aiSuggestion?.rubricScores?.find(
                  (rs) => rs.criterionName === criterion.name
                );

                return (
                  <div
                    key={criterion.id || idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-[#FAF8F3] hover:border-indigo-200 transition-colors space-y-3"
                  >
                    {/* Header tiêu chí */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-sm text-[#1E1B4B]">
                            {criterion.name}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {criterion.weight}% (Tối đa {maxPoints}đ)
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 pl-7">
                          {criterion.description}
                        </p>
                      </div>

                      {/* Ô nhập điểm của giáo viên */}
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={maxPoints}
                          value={scoreTexts[criterion.name] ?? String(teacherScore)}
                          onChange={(e) => {
                            const txt = e.target.value;
                            setScoreTexts((prev) => ({ ...prev, [criterion.name]: txt }));
                            const val = parseFloat(txt);
                            if (!Number.isNaN(val)) {
                              setCriterionScores({
                                ...criterionScores,
                                [criterion.name]: Math.min(maxPoints, Math.max(0, val)),
                              });
                            }
                          }}
                          onBlur={() =>
                            setScoreTexts((prev) => {
                              const next = { ...prev };
                              delete next[criterion.name];
                              return next;
                            })
                          }
                          className="w-12 text-center font-black text-sm text-[#4F46E5] focus:outline-hidden"
                        />
                        <span className="text-xs font-semibold text-slate-400">/ {maxPoints}</span>
                      </div>
                    </div>

                    {/* Gợi ý của AI cho tiêu chí này */}
                    {aiItem && (
                      <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-100 text-xs flex items-start justify-between gap-2">
                        <div className="text-purple-900">
                          <span className="font-bold text-purple-700">💡 Lý do AI: </span>
                          <span className="italic">{aiItem.reason}</span>
                        </div>
                        <span className="text-purple-700 font-extrabold shrink-0 bg-white px-2 py-0.5 rounded-lg border border-purple-200">
                          AI: {aiItem.score}đ
                        </span>
                      </div>
                    )}

                    {/* Thanh trượt điểm của giáo viên */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="0"
                        max={maxPoints}
                        step="0.1"
                        value={teacherScore}
                        onChange={(e) => {
                          setCriterionScores({
                            ...criterionScores,
                            [criterion.name]: parseFloat(e.target.value),
                          });
                        }}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#4F46E5]"
                      />
                    </div>

                    {/* Ô nhận xét riêng của tiêu chí */}
                    <div>
                      <input
                        type="text"
                        placeholder="Nhận xét riêng cho tiêu chí này (tùy chọn)..."
                        value={criterionComments[criterion.name] || ''}
                        onChange={(e) =>
                          setCriterionComments({
                            ...criterionComments,
                            [criterion.name]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#4F46E5]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Khung Nhận xét chung của giáo viên */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-[#1E1B4B] uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-[#4F46E5]" /> Nhận xét chung gửi học sinh
                </label>
                <span className="text-[11px] text-slate-400">
                  (Đã nạp sẵn gợi ý AI thân thiện, thầy/cô sửa tự do)
                </span>
              </div>
              <textarea
                rows={4}
                value={generalFeedback}
                onChange={(e) => setGeneralFeedback(e.target.value)}
                placeholder="Nhập nhận xét khích lệ, chỉ ra điểm sáng và gợi ý hoàn thiện cho học sinh..."
                className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-[#4F46E5] leading-relaxed"
              />

              {/* Các câu mẫu nhanh */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[
                  'Cảm xúc rất chân thành!',
                  'Nắm chắc nghệ thuật nhân hóa',
                  'Chú ý mở rộng thêm liên hệ thực tế',
                  'Diễn đạt trôi chảy, giàu hình ảnh',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() =>
                      setGeneralFeedback((prev) => (prev ? `${prev} ${chip}` : chip))
                    }
                    className="text-[11px] font-semibold px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg transition-colors border border-slate-200"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ================= FOOTER CHỐT ĐIỂM CỐ ĐỊNH ================= */}
          <div className="p-5 border-t border-[#E8DFD1] bg-[#FAF5EB] flex items-center justify-between gap-4 shrink-0 shadow-lg">
            {/* Tổng điểm và chênh lệch AI */}
            <div className="flex items-center gap-4">
              <div className="bg-white px-4 py-2 rounded-2xl border border-[#E8DFD1] shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">
                  Tổng điểm chốt
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-[#1E1B4B]">
                    {totalTeacherScore}
                  </span>
                  <span className="text-xs font-bold text-slate-400">/ 10</span>
                </div>
              </div>

              {/* So sánh với điểm AI */}
              <div className="text-xs text-slate-600">
                <div>
                  AI gợi ý: <strong className="text-purple-700">{formatScore(aiTotalScore)}đ</strong>
                </div>
                <div className="text-[11px] text-slate-400">
                  Chênh lệch: {aiDiff === 0 ? 'Trùng khớp 100%' : `±${aiDiff} điểm`}
                </div>
              </div>
            </div>

            {/* Các nút hành động */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingDraft ? 'Đang lưu...' : 'Lưu nháp'}
              </button>

              <button
                type="button"
                onClick={handleFinalize}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#E2704A] hover:bg-[#D05F39] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 hover:scale-[1.02]"
                title="Chốt điểm và gửi cho học sinh (Alt + S)"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Đang chốt...' : 'Chốt và gửi cho học sinh (Alt + S)'}
              </button>

              {hasNextSubmission && onNextSubmission && (
                <button
                  type="button"
                  onClick={onNextSubmission}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  title="Bài tiếp theo (Alt + N)"
                >
                  <span>Bài tiếp</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
