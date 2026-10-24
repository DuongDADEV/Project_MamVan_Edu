import React, { useState } from 'react';
import { X, Eye, Play, Sparkles, CheckCircle2, Clock, BookOpen, Layers } from 'lucide-react';
import {
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  QuizWithMeta,
  QuestionWithMeta,
} from '../../../services/types.ts';
import { QuizRunner } from '../../QuizRunner.tsx';
import { MamMuc } from '../../MamMuc.tsx';

interface StudentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewType: 'video' | 'theory' | 'quiz';
  videoData?: VideoLessonWithMeta | null;
  theoryData?: TheoryLessonWithMeta | null;
  quizData?: QuizWithMeta | null;
  quizQuestions?: QuestionWithMeta[];
}

export const StudentPreviewModal: React.FC<StudentPreviewModalProps> = ({
  isOpen,
  onClose,
  previewType,
  videoData,
  theoryData,
  quizData,
  quizQuestions = [],
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [previewScore, setPreviewScore] = useState<{ earned: number; max: number } | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#1E1B4B]/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#FAF5EB] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-[#E6DCC8]">
        {/* Preview Banner Header */}
        <div className="px-5 py-3 bg-[#2F3E6B] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <Eye className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
              Chế độ xem trước như học sinh
            </span>
            <span className="text-[11px] text-white/70 italic hidden sm:inline">
              (Dữ liệu nháp thử nghiệm • Không ghi điểm hay cộng XP thật)
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* ========================================================
              1. PREVIEW VIDEO
              ======================================================== */}
          {previewType === 'video' && videoData && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Stepper Navigation */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#E6DCC8] shadow-2xs text-xs font-bold">
                {[
                  { step: 1, label: '1. Xem Video' },
                  { step: 2, label: '2. Tóm tắt' },
                  { step: 3, label: '3. Luyện tập' },
                ].map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(s.step)}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      activeStep === s.step
                        ? 'bg-[#E2704A] text-white shadow-xs'
                        : 'text-[#8C7E6A] hover:text-[#2F3E6B]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Step 1: Video Player */}
              {activeStep === 1 && (
                <div className="space-y-4">
                  <div className="aspect-video w-full rounded-3xl bg-black overflow-hidden shadow-lg relative flex items-center justify-center">
                    {videoData.sampleUrl ? (
                      <video
                        src={videoData.sampleUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-white/70 p-6 space-y-2">
                        <Play className="w-12 h-12 text-white/50 mx-auto" />
                        <p className="text-xs">Chưa có URL video để phát thử.</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-[#E6DCC8] shadow-xs space-y-2">
                    <h3 className="font-lora font-bold text-lg text-[#2F3E6B]">
                      {videoData.title}
                    </h3>
                    <p className="text-xs text-[#8C7E6A]">{videoData.description}</p>
                    {videoData.subtopics && videoData.subtopics.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-2">
                        {videoData.subtopics.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-xl bg-orange-50 text-[#E2704A] text-[11px] font-bold"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Summary Points */}
              {activeStep === 2 && (
                <div className="bg-white p-6 rounded-3xl border border-[#E6DCC8] shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-[#E6DCC8]">
                    <Sparkles className="w-5 h-5 text-[#F2B84B]" />
                    <h4 className="font-lora font-bold text-base text-[#2F3E6B]">
                      Kiến thức trọng tâm sau video
                    </h4>
                  </div>

                  <div className="space-y-3">
                    {(videoData.summaryPoints || []).map((pt, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] space-y-1.5"
                      >
                        <h5 className="text-xs font-bold text-[#2F3E6B]">
                          {i + 1}. {pt.title}
                        </h5>
                        <p className="text-xs text-[#2F3E6B]/80 leading-relaxed">{pt.content}</p>
                        {pt.example && (
                          <p className="text-[11px] text-[#E2704A] italic pt-1 border-t border-[#E6DCC8]/60">
                            Ví dụ: {pt.example}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Practice Placeholder */}
              {activeStep === 3 && (
                <div className="p-8 text-center bg-white rounded-3xl border border-[#E6DCC8] space-y-3">
                  <MamMuc mood="cheer" size="md" />
                  <p className="text-sm font-bold text-[#2F3E6B]">
                    Học sinh sẽ chuyển sang làm bài luyện tập gắn kèm ({videoData.practiceQuizId || 'Chưa gắn bài'})
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              2. PREVIEW THEORY
              ======================================================== */}
          {previewType === 'theory' && theoryData && (
            <div className="max-w-2xl mx-auto space-y-5 bg-white p-6 sm:p-8 rounded-3xl border border-[#E6DCC8] shadow-xs">
              <div className="pb-4 border-b border-[#E6DCC8] space-y-2">
                <span className="text-[10px] px-2.5 py-1 rounded-xl bg-purple-50 text-[#7C3AED] font-bold">
                  {theoryData.kind === 'summary_post_video' ? 'Tóm tắt bài học' : 'Lý thuyết chuyên sâu'}
                </span>
                <h3 className="font-lora font-bold text-2xl text-[#2F3E6B]">
                  {theoryData.title}
                </h3>
              </div>

              {/* Blocks Render */}
              <div className="space-y-4">
                {(theoryData.blocks || []).map((b, i) => (
                  <div key={b.id || i}>
                    {b.type === 'heading' && (
                      <h4
                        className={`font-lora font-bold text-[#2F3E6B] mt-4 mb-2 ${
                          b.level === 3 ? 'text-base' : 'text-lg'
                        }`}
                      >
                        {b.content}
                      </h4>
                    )}

                    {b.type === 'paragraph' && (
                      <p className="text-xs sm:text-sm text-[#2F3E6B] leading-relaxed">
                        {b.content}
                      </p>
                    )}

                    {b.type === 'list' && (
                      <ul className="list-disc list-inside space-y-1 text-xs text-[#2F3E6B]">
                        {(b.items || []).map((item, itemIdx) => (
                          <li key={itemIdx}>{item}</li>
                        ))}
                      </ul>
                    )}

                    {b.type === 'example' && (
                      <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200 space-y-1.5 my-2">
                        <p className="text-xs font-bold text-[#E2704A] italic">
                          {b.exampleText}
                        </p>
                        <p className="text-xs text-[#2F3E6B]">{b.exampleAnalysis}</p>
                      </div>
                    )}

                    {b.type === 'takeaway' && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-1 my-2">
                        <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                          Ghi nhớ trọng tâm
                        </span>
                        <p className="text-xs font-bold text-[#2F3E6B]">{b.takeawayText}</p>
                      </div>
                    )}

                    {b.type === 'image' && b.imageUrl && (
                      <div className="space-y-1 my-3 text-center">
                        <img
                          src={b.imageUrl}
                          alt={b.caption || 'Minh họa'}
                          className="max-h-72 rounded-2xl mx-auto object-contain border border-[#E6DCC8]"
                        />
                        {b.caption && (
                          <p className="text-[11px] text-[#8C7E6A] italic">{b.caption}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom "Đã hiểu" Button Preview */}
              <div className="pt-4 border-t border-[#E6DCC8] flex items-center justify-between">
                <span className="text-xs text-[#8C7E6A] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Thời gian đọc tối thiểu: {theoryData.minReadSeconds} giây</span>
                </span>
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-2xl bg-[#7C3AED] text-white text-xs font-bold shadow-xs opacity-90 cursor-default"
                >
                  Đã hiểu (+10 XP)
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              3. PREVIEW QUIZ / TEST (RUNS REAL QUIZRUNNER)
              ======================================================== */}
          {previewType === 'quiz' && quizData && (
            <div>
              {isQuizCompleted ? (
                <div className="max-w-md mx-auto p-8 rounded-3xl bg-white border border-[#E6DCC8] text-center space-y-4 shadow-md">
                  <MamMuc mood="happy" size="lg" className="mx-auto" />
                  <h4 className="font-lora font-bold text-xl text-[#2F3E6B]">
                    Hoàn thành bài kiểm tra thử nghiệm!
                  </h4>
                  <p className="text-xs text-[#8C7E6A]">
                    Học sinh đã đạt {previewScore?.earned || 0} / {previewScore?.max || 100} điểm
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuizCompleted(false);
                      setPreviewScore(null);
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-[#2F3E6B] text-white text-xs font-bold"
                  >
                    Làm lại từ đầu
                  </button>
                </div>
              ) : (
                <QuizRunner
                  quiz={quizData}
                  questions={quizQuestions}
                  onComplete={(results, essays, earned, max) => {
                    setIsQuizCompleted(true);
                    setPreviewScore({ earned, max });
                  }}
                  onExit={onClose}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
