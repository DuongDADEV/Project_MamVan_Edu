import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../components/teacher/ui/PageHeader.tsx';
import { GradingQueueTable } from '../../components/teacher/grading/GradingQueueTable.tsx';
import { StudentGradingDetail } from '../../components/teacher/grading/StudentGradingDetail.tsx';
import { SplitGradingWorkspace } from '../../components/teacher/grading/SplitGradingWorkspace.tsx';
import { AiTrainingStudio } from '../../components/teacher/grading/AiTrainingStudio.tsx';
import {
  EssaySubmission,
  RubricTemplate,
  GradedSampleEssay,
  AIGradingConfig,
  ClassItem,
} from '../../types.ts';
import { essayRepository, syncEventBus } from '../../services/index.ts';
import {
  PenTool,
  Sparkles,
  Layers,
  GraduationCap,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

interface TeacherGradingScreenProps {
  classes?: ClassItem[];
  selectedClassId?: string;
  pendingCount?: number;
  onRefreshData?: () => void;
}

export const TeacherGradingScreen: React.FC<TeacherGradingScreenProps> = ({
  classes = [],
  selectedClassId = 'all',
  onRefreshData,
}) => {
  // Tabs: 'queue' (Hàng đợi chấm bài) | 'training' (Huấn luyện AI chấm)
  const [activeMainTab, setActiveMainTab] = useState<'queue' | 'training'>('queue');

  // Dữ liệu bài viết
  const [submissions, setSubmissions] = useState<EssaySubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);

  // Dữ liệu huấn luyện AI
  const [rubricTemplates, setRubricTemplates] = useState<RubricTemplate[]>([]);
  const [gradedSamples, setGradedSamples] = useState<GradedSampleEssay[]>([]);
  const [aiConfig, setAiConfig] = useState<AIGradingConfig>({
    tone: 'encouraging',
    strictness: 3,
    praiseStrengthsFirst: true,
    feedbackLength: 'medium',
    anonymizeStudentData: true,
  });
  const [accuracyMetrics, setAccuracyMetrics] = useState<any>(undefined);

  // Toast thông báo
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Tải toàn bộ dữ liệu
  const loadData = useCallback(async () => {
    try {
      const [subs, rubrics, samples, cfg, metrics] = await Promise.all([
        essayRepository.getSubmissions({ classId: selectedClassId }),
        essayRepository.getRubricTemplates(),
        essayRepository.getGradedSamples(),
        essayRepository.getGradingConfig(),
        essayRepository.getAIAccuracyMetrics(),
      ]);
      setSubmissions(subs);
      setRubricTemplates(rubrics);
      setGradedSamples(samples);
      setAiConfig(cfg);
      setAccuracyMetrics(metrics);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu chấm bài:', err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [selectedClassId]);

  // Lắng nghe realtime eventBus
  useEffect(() => {
    loadData();
    const unsub = syncEventBus.subscribe('essay', () => {
      loadData();
    });
    return () => unsub();
  }, [loadData]);

  // Bài đang được chọn để chấm (Split screen)
  const selectedSubmission = useMemo(() => {
    if (!selectedSubmissionId) return null;
    return submissions.find((s) => s.id === selectedSubmissionId) || null;
  }, [submissions, selectedSubmissionId]);

  // Vị trí bài hiện tại trong danh sách
  const currentIndex = useMemo(() => {
    if (!selectedSubmissionId) return -1;
    return submissions.findIndex((s) => s.id === selectedSubmissionId);
  }, [submissions, selectedSubmissionId]);

  const hasNext = currentIndex >= 0 && currentIndex < submissions.length - 1;
  const hasPrev = currentIndex > 0;

  const handleNext = () => {
    if (hasNext) {
      setSelectedSubmissionId(submissions[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setSelectedSubmissionId(submissions[currentIndex - 1].id);
    }
  };

  // Xử lý chốt điểm
  const handleFinalizeGrading = async (grading: {
    rubricScores: { criterionName: string; score: number; maxScore: number; reason?: string; comment?: string }[];
    totalScore: number;
    finalRatio: number;
    teacherFeedback: string;
    ai_vs_teacher_diff: number;
  }) => {
    if (!selectedSubmission) return;
    try {
      await essayRepository.gradeSubmission(
        selectedSubmission.id,
        grading,
        'gv001'
      );
      showToast(`🎉 Đã chốt điểm ${grading.totalScore}/10 cho em ${selectedSubmission.studentName || 'học sinh'}!`);
      if (onRefreshData) onRefreshData();

      // Nếu còn bài tiếp theo thì chuyển sang bài tiếp
      if (hasNext) {
        handleNext();
      } else {
        setSelectedSubmissionId(null);
      }
    } catch (e: any) {
      console.error('Lỗi khi chốt bài:', e);
      alert('Không thể chốt bài viết: ' + (e?.message || 'Đã có lỗi xảy ra'));
    }
  };

  // Xử lý lưu nháp
  const handleSaveDraft = async (draft: {
    rubricScores: { criterionName: string; score: number; maxScore: number }[];
    teacherFeedback: string;
  }) => {
    if (!selectedSubmission) return;
    try {
      await essayRepository.saveSubmissionDraft(selectedSubmission.id, draft);
      showToast('Đã lưu bản nháp chấm bài!');
    } catch (e) {
      console.error('Lỗi lưu nháp:', e);
    }
  };

  // Lưu vào kho bài mẫu
  const handleSaveToSampleLibrary = async (sampleData: Partial<GradedSampleEssay>) => {
    try {
      await essayRepository.saveGradedSample({
        id: 'sample_' + Date.now(),
        title: sampleData.title || 'Bài văn mẫu',
        topicPrompt: sampleData.topicPrompt || '',
        studentContent: sampleData.studentContent || '',
        levelGrade: sampleData.levelGrade || 'good',
        totalScore: sampleData.totalScore ?? 8,
        rubricScores: sampleData.rubricScores || [],
        teacherFeedback: sampleData.teacherFeedback || '',
        isFromStudentSubmission: true,
        createdAt: new Date().toISOString(),
      });
      showToast('⭐ Đã lưu bài viết vào Thư viện mẫu huấn luyện AI (đã ẩn danh học sinh)!');
    } catch (e) {
      console.error('Lỗi lưu bài mẫu:', e);
    }
  };

  const pendingCount = submissions.filter((s) => s.status !== 'GRADED').length;

  return (
    <div className="space-y-6">
      {/* TOAST THÔNG BÁO TOÀN CỤC */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E1B4B] text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER MÀN HÌNH (Chỉ hiển thị khi đang ở hàng đợi hoặc huấn luyện) */}
      {!selectedSubmission && !detailStudentId && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <PageHeader
              title="Chấm bài viết & Huấn luyện AI"
              subtitle="Đánh giá đoạn văn cảm nghĩ học sinh với trợ lực từ AI, tùy chỉnh Rubric chuẩn GDPT 2018"
            />

            {/* TAB CHÍNH: HÀNG ĐỢI VS HUẤN LUYỆN */}
            <div className="flex bg-[#EFE9DC] p-1 rounded-2xl border border-[#E8DFD1] self-start sm:self-auto shrink-0">
              <button
                onClick={() => setActiveMainTab('queue')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                  activeMainTab === 'queue'
                    ? 'bg-white text-[#1E1B4B] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-[#E2704A]" />
                <span>Hàng đợi bài chấm</span>
                {pendingCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-[#E2704A] text-white">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveMainTab('training')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                  activeMainTab === 'training'
                    ? 'bg-white text-[#1E1B4B] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Huấn luyện AI chấm</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ================= NỘI DUNG CHÍNH ================= */}
      {selectedSubmission ? (
        /* MÀN CHẤM CHIA ĐÔI (SPLIT SCREEN WORKSPACE) */
        <SplitGradingWorkspace
          submission={selectedSubmission}
          rubricTemplates={rubricTemplates}
          onBack={() => setSelectedSubmissionId(null)}
          onFinalizeGrading={handleFinalizeGrading}
          onSaveDraft={handleSaveDraft}
          onNextSubmission={handleNext}
          hasNextSubmission={hasNext}
          onPrevSubmission={handlePrev}
          hasPrevSubmission={hasPrev}
          onSaveToSampleLibrary={handleSaveToSampleLibrary}
        />
      ) : detailStudentId ? (
        /* XEM CHI TIẾT THEO HỌC SINH (Figma Giao diện 1) */
        <StudentGradingDetail
          studentId={detailStudentId}
          submissions={submissions}
          onBack={() => setDetailStudentId(null)}
          onSelectSubmission={(sub) => setSelectedSubmissionId(sub.id)}
        />
      ) : activeMainTab === 'queue' ? (
        /* HÀNG ĐỢI BÀI CHỜ CHỐT */
        <GradingQueueTable
          submissions={submissions}
          classes={classes}
          selectedClassId={selectedClassId}
          onSelectSubmission={(sub) => setSelectedSubmissionId(sub.id)}
          onViewStudent={(sub) => setDetailStudentId(sub.studentId)}
        />
      ) : (
        /* TAB HUẤN LUYỆN AI CHẤM */
        <AiTrainingStudio
          rubricTemplates={rubricTemplates}
          onSaveRubricTemplate={async (t) => {
            await essayRepository.saveRubricTemplate(t);
            loadData();
          }}
          onDeleteRubricTemplate={async (id) => {
            await essayRepository.deleteRubricTemplate(id);
            loadData();
          }}
          gradedSamples={gradedSamples}
          onSaveGradedSample={async (s) => {
            await essayRepository.saveGradedSample(s);
            loadData();
          }}
          onDeleteGradedSample={async (id) => {
            await essayRepository.deleteGradedSample(id);
            loadData();
          }}
          aiConfig={aiConfig}
          onSaveAIConfig={async (cfg) => {
            await essayRepository.saveGradingConfig(cfg);
            loadData();
          }}
          accuracyMetrics={accuracyMetrics}
        />
      )}
    </div>
  );
};
