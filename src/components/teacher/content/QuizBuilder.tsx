import React, { useState, useEffect, useRef } from 'react';
import {
  QuizWithMeta,
  QuestionWithMeta,
  TopicWithMeta,
  ClassItem,
  QuizKind,
  QuestionType,
  SkillLevel,
  Difficulty,
  RubricCriterion,
} from '../../../services/types.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { QuestionBankModal } from './QuestionBankModal.tsx';
import {
  ArrowLeft,
  FileQuestion,
  Settings,
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Save,
  UploadCloud,
  CheckCircle2,
  HelpCircle,
  Clock,
  Shuffle,
  Award,
  Sparkles,
  Calendar,
  Users,
  Image as ImageIcon,
  Quote,
  CheckSquare,
  Square,
  Radio,
  Sliders,
  Check,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { aiService } from '../../../services/index.ts';
import { XP_CONFIG } from '../../../config.ts';

interface QuizBuilderProps {
  /** Tab mở đầu: Bài tập MỚI TẠO mở thẳng 'settings' (Cài đặt bài trước, soạn câu sau). */
  initialTab?: 'questions' | 'settings';
  quiz: QuizWithMeta;
  allQuestions: Record<string, QuestionWithMeta>;
  topics: TopicWithMeta[];
  classes: ClassItem[];
  onSaveQuiz: (
    updatedQuiz: Partial<QuizWithMeta>,
    updatedQuestions: QuestionWithMeta[]
  ) => Promise<void>;
  onPublish: (warnings: string[], isBlocked: boolean) => void;
  onPreviewStudent: (draftQuiz: QuizWithMeta, draftQuestions: QuestionWithMeta[]) => void;
  onBack?: () => void;
}

// Cấu hình mặc định cho từng loại bài kiểm tra
const QUIZ_KIND_CONFIG: Record<
  QuizKind,
  { name: string; defaultCount: number; defaultTimeMin?: number; defaultXp: number }
> = {
  practice: { name: 'Luyện tập sau video', defaultCount: 5, defaultTimeMin: 0, defaultXp: 10 },
  quick: { name: 'Kiểm tra nhanh', defaultCount: 5, defaultTimeMin: 7, defaultXp: 15 },
  mastery: { name: 'Mastery Check', defaultCount: 10, defaultTimeMin: 15, defaultXp: 20 },
  reading: { name: 'Bài đọc hiểu', defaultCount: 6, defaultTimeMin: 25, defaultXp: 20 },
  final: { name: 'Kiểm tra tổng hợp', defaultCount: 15, defaultTimeMin: 45, defaultXp: 30 },
  homework: { name: 'Bài tập về nhà', defaultCount: 5, defaultTimeMin: 20, defaultXp: 20 },
};

// 4 Tiêu chí Rubric mặc định chuẩn Văn 7
const DEFAULT_ESSAY_RUBRIC: RubricCriterion[] = [
  {
    name: 'Nội dung ý',
    maxScore: 4,
    description: 'Đầy đủ ý trọng tâm, cảm nhận sâu sắc, đúng yêu cầu đề bài.',
  },
  {
    name: 'Bố cục & Liên kết',
    maxScore: 2,
    description: 'Mở đoạn, thân đoạn, kết đoạn mạch lạc; có từ ngữ liên kết hợp lý.',
  },
  {
    name: 'Dùng từ & Đặt câu',
    maxScore: 2,
    description: 'Diễn đạt trong sáng, không sai chính tả, ngữ pháp, có hình ảnh gợi cảm.',
  },
  {
    name: 'Sáng tạo & Cảm xúc',
    maxScore: 2,
    description: 'Có giọng điệu riêng, cảm xúc chân thực, phát hiện mới mẻ.',
  },
];

// Chú thích năng lực môn Văn theo CT GDPT 2018
const SKILL_TOOLTIPS: Record<SkillLevel, { title: string; desc: string }> = {
  NHAN_BIET: {
    title: 'Nhận biết',
    desc: 'Nhận diện số tiếng, vần, nhịp, từ ngữ, chi tiết, biện pháp tu từ có sẵn trong văn bản.',
  },
  THONG_HIEU: {
    title: 'Thông hiểu',
    desc: 'Giải thích ý nghĩa từ ngữ/hình ảnh, tóm tắt nội dung, cắt nghĩa hành động nhân vật.',
  },
  PHAN_TICH: {
    title: 'Phân tích',
    desc: 'Phân tích tác dụng của biện pháp tu từ, đặc sắc nghệ thuật, nguyên nhân tâm lý nhân vật.',
  },
  VAN_DUNG: {
    title: 'Vận dụng',
    desc: 'Rút ra bài học, thông điệp, liên hệ thực tiễn bản thân hoặc viết đoạn văn cảm nghĩ sáng tạo.',
  },
};

export const QuizBuilder: React.FC<QuizBuilderProps> = ({
  initialTab,
  quiz,
  allQuestions,
  topics,
  classes,
  onSaveQuiz,
  onPublish,
  onPreviewStudent,
  onBack,
}) => {
  // 1. Cài đặt bài kiểm tra (Quiz Settings)
  const [title, setTitle] = useState(quiz.title || '');
  const [kind, setKind] = useState<QuizKind>(quiz.kind || 'quick');
  const [topicId, setTopicId] = useState(quiz.topicId || topics[0]?.id || '');
  const [isUnlimitedTime, setIsUnlimitedTime] = useState(!quiz.timeLimitMinutes);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(quiz.timeLimitMinutes || 7);
  const [xp, setXp] = useState(quiz.xp || 15);
  const [shuffleQuestions, setShuffleQuestions] = useState(quiz.shuffleQuestions || false);
  const [shuffleOptions, setShuffleOptions] = useState(quiz.shuffleOptions || false);
  const [dueDate, setDueDate] = useState(quiz.dueDate || '');
  const [assignedTo, setAssignedTo] = useState<'all' | 'custom'>(quiz.assignedTo || 'all');
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>(
    quiz.assignedStudentIds || []
  );

  // 2. Danh sách câu hỏi đang soạn
  const [questions, setQuestions] = useState<QuestionWithMeta[]>(() => {
    return quiz.questionIds
      .map((id) => allQuestions[id])
      .filter(Boolean) as QuestionWithMeta[];
  });

  // Tab đang mở trên giao diện: 'questions' (Soạn câu) hoặc 'settings' (Cài đặt)
  const [activeTab, setActiveTab] = useState<'questions' | 'settings'>(initialTab ?? 'questions');

  // Modal Ngân hàng câu hỏi
  const [isBankOpen, setIsBankOpen] = useState(false);

  // Trạng thái lưu nháp
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    setTitle(quiz.title || '');
    setKind(quiz.kind || 'quick');
    setTopicId(quiz.topicId || topics[0]?.id || '');
    setIsUnlimitedTime(!quiz.timeLimitMinutes);
    setTimeLimitMinutes(quiz.timeLimitMinutes || 7);
    setXp(quiz.xp || 15);
    setShuffleQuestions(quiz.shuffleQuestions || false);
    setShuffleOptions(quiz.shuffleOptions || false);
    setDueDate(quiz.dueDate || '');
    setAssignedTo(quiz.assignedTo || 'all');
    setAssignedStudentIds(quiz.assignedStudentIds || []);

    const loadedQuestions = quiz.questionIds
      .map((id) => allQuestions[id])
      .filter(Boolean) as QuestionWithMeta[];
    setQuestions(loadedQuestions);
    isDirtyRef.current = false;
  }, [quiz.id]);

  // Tự động cập nhật thời gian & XP mặc định khi đổi loại bài
  const handleKindChange = (newKind: QuizKind) => {
    setKind(newKind);
    const cfg = QUIZ_KIND_CONFIG[newKind];
    if (cfg.defaultTimeMin && cfg.defaultTimeMin > 0) {
      setIsUnlimitedTime(false);
      setTimeLimitMinutes(cfg.defaultTimeMin);
    } else {
      setIsUnlimitedTime(true);
    }
    setXp(cfg.defaultXp);
    isDirtyRef.current = true;
  };

  // ==========================================
  // THAO TÁC TRÊN TỪNG CÂU HỎI
  // ==========================================

  // Thêm câu mới
  const handleAddQuestion = (type: QuestionType = 'single') => {
    const newQ: QuestionWithMeta = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type,
      level: 'THONG_HIEU',
      difficulty: 'TB',
      prompt: '',
      topicId,
      options: type === 'single' || type === 'multi' ? ['Lựa chọn 1', 'Lựa chọn 2', 'Lựa chọn 3', 'Lựa chọn 4'] : undefined,
      answer: type === 'single' ? 'Lựa chọn 1' : type === 'multi' ? ['Lựa chọn 1'] : type === 'fill' ? ['đáp án'] : '',
      explanation: '',
      points: 10,
      rubric: type === 'essay' ? DEFAULT_ESSAY_RUBRIC : undefined,
      minWords: type === 'essay' ? 120 : undefined,
      maxWords: type === 'essay' ? 200 : undefined,
      enableAiGrading: type === 'essay' ? true : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'draft',
      class_ids: ['all'],
      version: 1,
    };
    setQuestions((prev) => [...prev, newQ]);
    isDirtyRef.current = true;
  };

  // Cập nhật câu
  const handleUpdateQuestion = (qId: string, updates: Partial<QuestionWithMeta>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, ...updates, updated_at: new Date().toISOString() } : q))
    );
    isDirtyRef.current = true;
  };

  // Chuyển dạng câu hỏi (GIỮ LẠI ĐỀ BÀI)
  const handleChangeType = (qId: string, newType: QuestionType) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        let nextOptions = q.options;
        let nextAnswer: any = q.answer;

        if (newType === 'single') {
          nextOptions = nextOptions && nextOptions.length >= 2 ? nextOptions : ['Lựa chọn 1', 'Lựa chọn 2', 'Lựa chọn 3', 'Lựa chọn 4'];
          nextAnswer = Array.isArray(nextAnswer) ? nextAnswer[0] || nextOptions[0] : nextOptions[0];
        } else if (newType === 'multi') {
          nextOptions = nextOptions && nextOptions.length >= 2 ? nextOptions : ['Lựa chọn 1', 'Lựa chọn 2', 'Lựa chọn 3', 'Lựa chọn 4'];
          nextAnswer = Array.isArray(nextAnswer) ? nextAnswer : [nextOptions[0]];
        } else if (newType === 'fill') {
          nextOptions = undefined;
          nextAnswer = ['từ khóa'];
        } else if (newType === 'essay') {
          nextOptions = undefined;
          nextAnswer = undefined;
        }

        return {
          ...q,
          type: newType,
          options: nextOptions,
          answer: nextAnswer,
          rubric: newType === 'essay' ? DEFAULT_ESSAY_RUBRIC : undefined,
          minWords: newType === 'essay' ? 120 : undefined,
          maxWords: newType === 'essay' ? 200 : undefined,
          enableAiGrading: newType === 'essay' ? true : undefined,
        };
      })
    );
    isDirtyRef.current = true;
  };

  // Nhân bản câu hỏi
  const handleDuplicateQuestion = (index: number) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const target = copy[index];
      const cloned: QuestionWithMeta = {
        ...target,
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        prompt: `${target.prompt} (Bản sao)`,
      };
      copy.splice(index + 1, 0, cloned);
      return copy;
    });
    isDirtyRef.current = true;
  };

  // Xóa câu hỏi
  const handleDeleteQuestion = (qId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
    isDirtyRef.current = true;
  };

  // Di chuyển câu hỏi
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
    isDirtyRef.current = true;
  };

  // Thêm câu hỏi từ ngân hàng
  const handleImportFromBank = (imported: QuestionWithMeta[]) => {
    // Tạo bản sao độc lập cho từng câu được chọn
    const copies = (imported || []).filter(Boolean).map((q) => {
      let finalOptions = q.options;
      let finalAnswer: any = q.answer;

      if (q.type === 'single' || q.type === 'multi') {
        if (!Array.isArray(finalOptions) || finalOptions.length === 0) {
          finalOptions = ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'];
        }
        // Chuẩn hóa nếu answer là dạng index chữ cái 'A', 'B', 'C', 'D'
        if (q.type === 'single' && typeof finalAnswer === 'string') {
          const letterIdx = ['A', 'B', 'C', 'D'].indexOf(finalAnswer.toUpperCase());
          if (letterIdx >= 0 && finalOptions[letterIdx]) {
            finalAnswer = finalOptions[letterIdx];
          }
        } else if (q.type === 'multi' && Array.isArray(finalAnswer)) {
          finalAnswer = finalAnswer.map((a) => {
            const letterIdx = ['A', 'B', 'C', 'D'].indexOf(String(a).toUpperCase());
            return letterIdx >= 0 && finalOptions && finalOptions[letterIdx]
              ? finalOptions[letterIdx]
              : a;
          });
        }
      }

      return {
        ...q,
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        topicId: topicId || q.topicId,
        options: finalOptions,
        answer: finalAnswer,
      };
    });
    setQuestions((prev) => [...prev, ...copies]);
    isDirtyRef.current = true;
  };

  // Tạo lại 1 câu hỏi cụ thể bằng AI
  const [isAiRegeneratingIndex, setIsAiRegeneratingIndex] = useState<number | null>(null);
  const handleRegenerateQuestion = async (index: number) => {
    const targetQ = questions[index];
    setIsAiRegeneratingIndex(index);
    try {
      const activeSources = [
        {
          id: 'src_auto',
          title: quiz.title || 'Chủ đề bài học',
          type: 'text' as const,
          content: targetQ.passage || targetQ.prompt || 'Văn bản ngữ liệu Ngữ văn 7',
          wordCount: 50,
          isEnabled: true,
          createdAt: new Date().toISOString(),
        },
      ];
      const newQs = await aiService.generateQuestions(activeSources, {
        totalQuestions: 1,
        difficulty: targetQ.difficulty || 'TB',
      });
      if (newQs.length > 0) {
        const replacement: QuestionWithMeta = {
          ...targetQ,
          ...newQs[0],
          id: targetQ.id,
          type: targetQ.type,
          level: targetQ.level,
          isAiGenerated: true,
          isTeacherReviewed: false,
          created_at: targetQ.created_at,
          updated_at: new Date().toISOString(),
          status: 'draft',
          class_ids: targetQ.class_ids,
          version: targetQ.version,
        };
        const updated = [...questions];
        updated[index] = replacement;
        setQuestions(updated);
        isDirtyRef.current = true;
      }
    } catch (e) {
      console.error('Lỗi tạo lại câu với AI:', e);
    } finally {
      setIsAiRegeneratingIndex(null);
    }
  };

  // Tạo thêm câu mới bằng AI
  const handleAddQuestionWithAi = async () => {
    try {
      const activeSources = [
        {
          id: 'src_auto',
          title: quiz.title || 'Chủ đề bài học',
          type: 'text' as const,
          content: questions[0]?.passage || 'Văn bản ngữ liệu Ngữ văn 7',
          wordCount: 50,
          isEnabled: true,
          createdAt: new Date().toISOString(),
        },
      ];
      const newQs = await aiService.generateQuestions(activeSources, {
        totalQuestions: 1,
        difficulty: 'TB',
      });
      if (newQs.length > 0) {
        const appended: QuestionWithMeta = {
          ...newQs[0],
          id: 'q_' + Math.random().toString(36).slice(2, 8),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'draft',
          class_ids: ['all', 'class_7a2'],
          version: 1,
          isAiGenerated: true,
          isTeacherReviewed: false,
        };
        setQuestions((prev) => [...prev, appended]);
        isDirtyRef.current = true;
      }
    } catch (e) {
      console.error('Lỗi tạo thêm câu với AI:', e);
    }
  };

  // ==========================================
  // LƯU NHÁP TỰ ĐỘNG & THỦ CÔNG
  // ==========================================

  const performSave = async () => {
    try {
      setIsSaving(true);
      const questionIds = questions.map((q) => q.id);

      await onSaveQuiz(
        {
          id: quiz.id,
          title: title.trim(),
          kind,
          topicId,
          timeLimitMinutes: isUnlimitedTime ? undefined : Number(timeLimitMinutes),
          xp: Number(xp),
          questionIds,
          shuffleQuestions,
          shuffleOptions,
          dueDate: kind === 'homework' ? dueDate : undefined,
          assignedTo: kind === 'homework' ? assignedTo : undefined,
          assignedStudentIds: kind === 'homework' && assignedTo === 'custom' ? assignedStudentIds : undefined,
        },
        questions
      );

      isDirtyRef.current = false;
      const now = new Date();
      setLastSavedTime(
        `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`
      );
    } catch (err) {
      console.error('Lỗi khi lưu đề thi:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Tự động lưu nháp sau mỗi 4 giây nếu có thay đổi
  useEffect(() => {
    const autoSaveTimer = setInterval(() => {
      if (isDirtyRef.current) {
        performSave();
      }
    }, 4000);
    return () => clearInterval(autoSaveTimer);
  }, [title, kind, topicId, isUnlimitedTime, timeLimitMinutes, xp, questions, shuffleQuestions, shuffleOptions, dueDate]);

  // ==========================================
  // (Đã gỡ runQualityCheck 24/10 theo yêu cầu chủ dự án: không còn hộp cảnh báo
  // chất lượng "Lưu ý chất lượng bài kiểm tra" / "Có lỗi cần sửa trước khi xuất
  // bản", không còn chặn xuất bản vì thiếu câu hỏi hay sai số câu tiêu chuẩn.)

  // Gỡ hộp cảnh báo chất lượng + chặn xuất bản (24/10 theo yêu cầu chủ dự án):
  // nút xuất bản luôn lưu bản đang soạn rồi mở hộp thoại xuất bản, không còn
  // chặn vì thiếu câu hỏi / sai số câu tiêu chuẩn / thiếu đáp án.
  const handlePublishClick = async () => {
    // Lưu bản đang soạn vào database trước khi xuất bản để không mất dữ liệu
    await performSave();
    onPublish([], false);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#FFFDF8] rounded-2xl md:rounded-l-none overflow-y-auto overflow-x-hidden shadow-xs">
      {/* Top Header — dính chặt phía trên khi thân trình soạn cuộn */}
      <div className="sticky top-0 z-20 shrink-0 p-4 bg-[#FAF5EB] border-b border-[#E6DCC8] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] hover:border-[#2F3E6B] transition-colors shrink-0"
              title="Quay lại chủ đề"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại</span>
            </button>
          )}
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-[#4F46E5] flex items-center justify-center shrink-0">
            <FileQuestion className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-lora font-bold text-sm text-[#2F3E6B] truncate">
                Trình tạo bài tập & Đề kiểm tra
              </h3>
              <StatusBadge
                status={quiz.status}
                hasUnpublishedEdits={quiz.has_unpublished_edits}
                size="sm"
              />
            </div>
            {lastSavedTime && (
              <p className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Đã lưu nháp lúc {lastSavedTime}</span>
              </p>
            )}
          </div>
        </div>

        {/* 2 Tabs: Soạn câu vs Cài đặt bài */}
        <div className="flex items-center p-1 bg-white rounded-2xl border border-[#E6DCC8] shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'questions'
                ? 'bg-[#2F3E6B] text-white shadow-xs'
                : 'text-[#8C7E6A] hover:text-[#2F3E6B]'
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5" />
            <span>Câu hỏi ({questions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-[#2F3E6B] text-white shadow-xs'
                : 'text-[#8C7E6A] hover:text-[#2F3E6B]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Cài đặt bài</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPreviewStudent(quiz, questions)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs"
            title="Làm thử bài bằng đúng giao diện học sinh (không tính điểm thật)"
          >
            <Eye className="w-3.5 h-3.5 text-[#2F3E6B]" />
            <span>Xem trước như học sinh</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={performSave}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:bg-black/5 text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs"
          >
            <Save className="w-3.5 h-3.5 text-[#8C7E6A]" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu nháp'}</span>
          </button>

          <button
            type="button"
            onClick={handlePublishClick}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-xs bg-emerald-600 hover:bg-emerald-700"
            title="Cập nhật lên web học sinh"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Cập nhật lên web học sinh</span>
          </button>
        </div>
      </div>

      {/* AI Generated Review Banner */}
      {questions.some((q) => q.isAiGenerated && !q.isTeacherReviewed) && (
        <div className="px-5 py-3 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs text-[#2F3E6B]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#E2704A] animate-pulse shrink-0" />
            <div>
              <span className="font-bold text-[#E2704A]">
                Tạo bởi AI – Cần giáo viên duyệt
              </span>
              <p className="text-[11px] text-[#8C7E6A] mt-0.5">
                Các câu hỏi có nhãn AI được trích xuất tự động từ tài liệu nguồn. Thầy/cô vui lòng kiểm tra kĩ lưỡng trước khi xuất bản.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuestions(questions.map((q) => ({ ...q, isTeacherReviewed: true })));
              isDirtyRef.current = true;
            }}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-[#2F3E6B] font-bold text-xs shrink-0 transition-colors shadow-2xs cursor-pointer"
          >
            ✓ Tôi đã kiểm tra nội dung
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === 'settings' ? (
          /* =========================================================
             TAB CÀI ĐẶT BÀI KIỂM TRA
             ========================================================= */
          <div className="max-w-2xl mx-auto space-y-5 bg-white p-6 rounded-3xl border border-[#E6DCC8] shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6DCC8]">
              <Settings className="w-4 h-4 text-[#2F3E6B]" />
              <h4 className="font-lora font-bold text-base text-[#2F3E6B]">
                Cài đặt bài tập & Chế độ kiểm tra
              </h4>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
                  Tên bài tập / Đề kiểm tra <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    isDirtyRef.current = true;
                  }}
                  placeholder="VD: Kiểm tra nhanh 7 phút: Thơ bốn chữ năm chữ..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
                    Loại bài kiểm tra
                  </label>
                  <select
                    value={kind}
                    onChange={(e) => handleKindChange(e.target.value as QuizKind)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
                  >
                    <option value="practice">Luyện tập sau video</option>
                    <option value="quick">Kiểm tra nhanh (5 câu / 7 phút)</option>
                    <option value="mastery">Mastery Check (10 câu / 15 phút)</option>
                    <option value="reading">Bài đọc hiểu (20–30 phút)</option>
                    <option value="final">Kiểm tra tổng hợp</option>
                    <option value="homework">Bài tập về nhà (Giao lớp / cá nhân)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
                    Gắn kèm chủ đề nào?
                  </label>
                  <select
                    value={topicId}
                    onChange={(e) => {
                      setTopicId(e.target.value);
                      isDirtyRef.current = true;
                    }}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Thời gian làm bài & Điểm thưởng XP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8]">
                <div>
                  <label className="block text-xs font-bold text-[#2F3E6B] mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#2F3E6B]" />
                    <span>Thời gian làm bài</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      disabled={isUnlimitedTime}
                      value={timeLimitMinutes}
                      onChange={(e) => {
                        setTimeLimitMinutes(Number(e.target.value));
                        isDirtyRef.current = true;
                      }}
                      className="w-24 px-3 py-1.5 rounded-xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] disabled:opacity-50 text-center"
                    />
                    <span className="text-xs text-[#8C7E6A]">phút</span>
                  </div>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnlimitedTime}
                      onChange={(e) => {
                        setIsUnlimitedTime(e.target.checked);
                        isDirtyRef.current = true;
                      }}
                      className="rounded border-[#E6DCC8] text-[#E2704A] focus:ring-0"
                    />
                    <span className="text-xs text-[#8C7E6A]">Không giới hạn thời gian</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2F3E6B] mb-1 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#E2704A]" />
                    <span>Điểm thưởng XP khi hoàn thành</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      max="100"
                      value={xp}
                      onChange={(e) => {
                        setXp(Number(e.target.value));
                        isDirtyRef.current = true;
                      }}
                      className="w-24 px-3 py-1.5 rounded-xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] text-center"
                    />
                    <span className="text-xs text-[#8C7E6A]">XP</span>
                  </div>
                  <p className="text-[10px] text-[#8C7E6A] mt-1">
                    Mặc định theo chuẩn: {QUIZ_KIND_CONFIG[kind].defaultXp} XP
                  </p>
                </div>
              </div>

              {/* Tùy chọn đảo trật tự */}
              <div className="space-y-2 pt-2 border-t border-[#E6DCC8]">
                <label className="block text-xs font-bold text-[#2F3E6B] flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-[#2F3E6B]" />
                  <span>Xáo trộn ngẫu nhiên đề thi</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => {
                        setShuffleQuestions(e.target.checked);
                        isDirtyRef.current = true;
                      }}
                      className="rounded border-[#E6DCC8] text-[#E2704A]"
                    />
                    <span className="text-xs text-[#2F3E6B]">Đảo thứ tự câu hỏi</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => {
                        setShuffleOptions(e.target.checked);
                        isDirtyRef.current = true;
                      }}
                      className="rounded border-[#E6DCC8] text-[#E2704A]"
                    />
                    <span className="text-xs text-[#2F3E6B]">Đảo thứ tự các phương án đáp án</span>
                  </label>
                </div>
              </div>

              {/* Cài đặt riêng cho BÀI TẬP VỀ NHÀ */}
              {kind === 'homework' && (
                <div className="p-4 rounded-2xl bg-orange-50/40 border border-orange-200 space-y-3">
                  <h5 className="text-xs font-bold text-[#E2704A] flex items-center gap-1.5 uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Cài đặt Bài tập về nhà (+20 XP)</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#2F3E6B] mb-1">
                        Hạn nộp bài
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value);
                          isDirtyRef.current = true;
                        }}
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-orange-200 text-xs text-[#2F3E6B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#2F3E6B] mb-1">
                        Đối tượng giao bài
                      </label>
                      <div className="flex items-center gap-3 pt-1">
                        <label className="flex items-center gap-1.5 text-xs text-[#2F3E6B] cursor-pointer">
                          <input
                            type="radio"
                            name="assignedTo"
                            checked={assignedTo === 'all'}
                            onChange={() => {
                              setAssignedTo('all');
                              isDirtyRef.current = true;
                            }}
                          />
                          <span>Cả lớp</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[#2F3E6B] cursor-pointer">
                          <input
                            type="radio"
                            name="assignedTo"
                            checked={assignedTo === 'custom'}
                            onChange={() => {
                              setAssignedTo('custom');
                              isDirtyRef.current = true;
                            }}
                          />
                          <span>Chỉ định học sinh</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {initialTab === 'settings' && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('questions')}
                  className="px-5 py-2.5 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-sm font-black shadow-xs"
                >
                  Tiếp tục: Soạn câu hỏi →
                </button>
              </div>
            )}
          </div>
        ) : (
          /* =========================================================
             TAB SOẠN CÂU HỎI (GOOGLE FORM STYLE)
             ========================================================= */
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between p-4 rounded-3xl bg-[#FAF5EB] border border-[#E6DCC8]">
              <div>
                <h4 className="font-lora font-bold text-sm text-[#2F3E6B]">
                  Danh sách câu hỏi ({questions.length} câu)
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddQuestionWithAi}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#E2704A] to-[#D45E36] hover:from-[#D45E36] hover:to-[#C34F28] text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Thêm câu bằng AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBankOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B] shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                  <span>Ngân hàng câu hỏi</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddQuestion('single')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:bg-black/5 text-[#2F3E6B] text-xs font-bold shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm câu mới</span>
                </button>
              </div>
            </div>

            {/* Questions Vertical Cards List */}
            {questions.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white border border-[#E6DCC8] border-dashed space-y-3">
                <FileQuestion className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-[#2F3E6B]">Chưa có câu hỏi nào trong đề</p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddQuestion('single')}
                    className="px-4 py-2 rounded-xl bg-[#E2704A] text-white text-xs font-bold"
                  >
                    + Tạo câu trắc nghiệm
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBankOpen(true)}
                    className="px-4 py-2 rounded-xl bg-white border border-[#E6DCC8] text-[#2F3E6B] text-xs font-bold"
                  >
                    Lấy từ ngân hàng
                  </button>
                </div>
              </div>
            ) : (
              questions.map((q, index) => {
                const qNum = index + 1;

                return (
                  <div
                    key={q.id}
                    className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E6DCC8] shadow-xs hover:border-[#2F3E6B]/50 transition-all space-y-4 relative group"
                  >
                    {/* AI Source Reference Banner on Card */}
                    {q.isAiGenerated && (
                      <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-[#E2704A] text-white text-[10px] font-bold">
                            Tạo bởi AI
                          </span>
                          {q.aiSourceSnippet && (
                            <span className="text-[#8C7E6A] text-[11px] truncate max-w-md italic">
                              Nguồn tham chiếu: "{q.aiSourceSnippet}"
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isAiRegeneratingIndex === index}
                            onClick={() => handleRegenerateQuestion(index)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-[#E2704A] font-bold text-[11px] transition-colors"
                            title="AI sinh lại câu hỏi khác cho vị trí này"
                          >
                            <RefreshCw className={`w-3 h-3 ${isAiRegeneratingIndex === index ? 'animate-spin' : ''}`} />
                            <span>Tạo lại câu này</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Header Thẻ Câu: Số câu + Dạng câu + Toolbar nổi */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E6DCC8]/60">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#FAF5EB] text-[#2F3E6B] text-xs font-bold flex items-center justify-center border border-[#E6DCC8]">
                          {qNum}
                        </span>

                        {/* Dropdown Dạng câu hỏi (Giữ lại đề bài khi đổi) */}
                        <select
                          value={q.type}
                          onChange={(e) => handleChangeType(q.id, e.target.value as QuestionType)}
                          className="px-3 py-1 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] focus:outline-none"
                        >
                          <option value="single">Trắc nghiệm (1 đáp án)</option>
                          <option value="multi">Chọn nhiều đáp án đúng</option>
                          <option value="fill">Điền vào ô trống</option>
                          <option value="essay">Viết đoạn văn</option>
                        </select>
                      </div>

                      {/* Floating toolbar buttons on card */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveQuestion(index, 'up')}
                          className="p-1.5 rounded-lg hover:bg-black/5 text-[#8C7E6A] disabled:opacity-30"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === questions.length - 1}
                          onClick={() => handleMoveQuestion(index, 'down')}
                          className="p-1.5 rounded-lg hover:bg-black/5 text-[#8C7E6A] disabled:opacity-30"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateQuestion(index)}
                          className="p-1.5 rounded-lg hover:bg-black/5 text-[#8C7E6A]"
                          title="Nhân đôi câu hỏi"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Ngữ liệu trích dẫn / Hình ảnh (nếu có) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#8C7E6A]">
                        <span className="font-bold text-[#2F3E6B]">Đề bài câu hỏi:</span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateQuestion(q.id, {
                                passage: q.passage ? undefined : 'Đoạn trích thơ hoặc văn xuôi mẫu...',
                              });
                            }}
                            className="hover:underline flex items-center gap-1 font-medium"
                          >
                            <Quote className="w-3 h-3 text-[#E2704A]" />
                            <span>{q.passage ? 'Bỏ ngữ liệu trích' : 'Chèn ngữ liệu/đoạn trích'}</span>
                          </button>
                        </div>
                      </div>

                      {q.passage !== undefined && (
                        <textarea
                          rows={2}
                          value={q.passage}
                          onChange={(e) => handleUpdateQuestion(q.id, { passage: e.target.value })}
                          placeholder="Dán đoạn trích thơ, truyện ngắn hoặc văn bản vào đây..."
                          className="w-full px-3 py-2 rounded-xl bg-orange-50/30 border border-orange-200 text-xs italic text-[#2F3E6B] resize-none"
                        />
                      )}

                      {/* Textarea Đề bài */}
                      <textarea
                        rows={3}
                        value={q.prompt}
                        onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
                        placeholder="Nhập yêu cầu câu hỏi tại đây..."
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] leading-relaxed resize-none focus:outline-none focus:border-[#2F3E6B]"
                      />
                    </div>

                    {/* ========================================================
                        KHU VỰC ĐÁP ÁN THEO TỪNG DẠNG
                        ======================================================== */}

                    {/* 1. TRẮC NGHIỆM ĐƠN (single) */}
                    {q.type === 'single' && (
                      <div className="space-y-2 pt-2">
                        <span className="text-[11px] font-bold text-[#8C7E6A] block">
                          Chọn đáp án đúng bằng nút tròn:
                        </span>
                        {(q.options || []).map((opt, optIdx) => {
                          const letterKey = String.fromCharCode(65 + optIdx);
                          const isCorrect = q.answer === opt || q.answer === letterKey;
                          return (
                            <div key={optIdx} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuestion(q.id, { answer: opt })}
                                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                  isCorrect
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-slate-300 hover:border-slate-400 bg-white'
                                }`}
                                title="Đánh dấu đây là đáp án đúng"
                              >
                                {isCorrect && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>
                              <span className="text-xs font-bold text-[#8C7E6A] w-4">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...(q.options || [])];
                                  newOpts[optIdx] = e.target.value;
                                  // Nếu opt này đang là đáp án đúng, đổi luôn giá trị đáp án
                                  const newAns = isCorrect ? e.target.value : q.answer;
                                  handleUpdateQuestion(q.id, { options: newOpts, answer: newAns });
                                }}
                                className="flex-1 px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
                              />
                              {(q.options || []).length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newOpts = (q.options || []).filter((_, i) => i !== optIdx);
                                    // Xóa luôn đáp án trỏ vào phương án vừa xóa
                                    // (tránh đáp án "ma" không còn trong danh sách)
                                    const removedText = (q.options || [])[optIdx];
                                    const removedLetter = String.fromCharCode(65 + optIdx);
                                    let newAns: any = q.answer;
                                    if (Array.isArray(q.answer)) {
                                      newAns = q.answer.filter(
                                        (a: string) => a !== removedText && a !== removedLetter
                                      );
                                    } else if (q.answer === removedText || q.answer === removedLetter) {
                                      newAns = '';
                                    }
                                    handleUpdateQuestion(q.id, { options: newOpts, answer: newAns });
                                  }}
                                  className="p-1 text-[#8C7E6A] hover:text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = [...(q.options || []), `Lựa chọn ${(q.options?.length || 0) + 1}`];
                            handleUpdateQuestion(q.id, { options: newOpts });
                          }}
                          className="text-[11px] text-[#E2704A] hover:underline font-bold flex items-center gap-1 pt-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm phương án</span>
                        </button>
                      </div>
                    )}

                    {/* 2. CHỌN NHIỀU ĐÁP ÁN ĐÚNG (multi) */}
                    {q.type === 'multi' && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#8C7E6A]">
                            Đánh dấu ô vuông cho các đáp án đúng:
                          </span>
                          <label className="flex items-center gap-1.5 text-xs text-[#2F3E6B] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.allowPartialCredit || false}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, { allowPartialCredit: e.target.checked })
                              }
                              className="rounded border-[#E6DCC8] text-[#E2704A]"
                            />
                            <span>Chấm điểm từng phần (Partial Credit)</span>
                          </label>
                        </div>

                        {(q.options || []).map((opt, optIdx) => {
                          const currentAnswers = Array.isArray(q.answer) ? q.answer : [];
                          const letterKey = String.fromCharCode(65 + optIdx);
                          const isCorrect = currentAnswers.includes(opt) || currentAnswers.includes(letterKey);

                          return (
                            <div key={optIdx} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  let nextAns = [...currentAnswers];
                                  if (isCorrect) {
                                    nextAns = nextAns.filter((a) => a !== opt);
                                  } else {
                                    nextAns.push(opt);
                                  }
                                  handleUpdateQuestion(q.id, { answer: nextAns });
                                }}
                                className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  isCorrect
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-300 hover:border-slate-400 bg-white'
                                }`}
                                title="Đánh dấu đáp án đúng"
                              >
                                {isCorrect && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>
                              <span className="text-xs font-bold text-[#8C7E6A] w-4">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...(q.options || [])];
                                  newOpts[optIdx] = e.target.value;
                                  const nextAns = currentAnswers.map((a) => (a === opt ? e.target.value : a));
                                  handleUpdateQuestion(q.id, { options: newOpts, answer: nextAns });
                                }}
                                className="flex-1 px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
                              />
                              {(q.options || []).length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newOpts = (q.options || []).filter((_, i) => i !== optIdx);
                                    // Xóa luôn đáp án trỏ vào phương án vừa xóa
                                    // (tránh đáp án "ma" không còn trong danh sách)
                                    const removedText = (q.options || [])[optIdx];
                                    const removedLetter = String.fromCharCode(65 + optIdx);
                                    let newAns: any = q.answer;
                                    if (Array.isArray(q.answer)) {
                                      newAns = q.answer.filter(
                                        (a: string) => a !== removedText && a !== removedLetter
                                      );
                                    } else if (q.answer === removedText || q.answer === removedLetter) {
                                      newAns = '';
                                    }
                                    handleUpdateQuestion(q.id, { options: newOpts, answer: newAns });
                                  }}
                                  className="p-1 text-[#8C7E6A] hover:text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = [...(q.options || []), `Lựa chọn ${(q.options?.length || 0) + 1}`];
                            handleUpdateQuestion(q.id, { options: newOpts });
                          }}
                          className="text-[11px] text-[#E2704A] hover:underline font-bold flex items-center gap-1 pt-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm phương án</span>
                        </button>
                      </div>
                    )}

                    {/* 3. ĐIỀN VÀO Ô TRỐNG (fill) */}
                    {q.type === 'fill' && (
                      <div className="space-y-3 p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-800">
                            Cấu hình các ô trống cần điền:
                          </span>
                          <span className="text-[10px] text-emerald-700 italic">
                            Chấm không phân biệt hoa thường, tự bỏ khoảng trắng thừa
                          </span>
                        </div>

                        {/* Danh sách các ô trống */}
                        <div className="space-y-2">
                          {(Array.isArray(q.answer) ? q.answer : ['']).map((ansVal, ansIdx) => (
                            <div key={ansIdx} className="flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-700 shrink-0">
                                Ô [{ansIdx + 1}]:
                              </span>
                              <input
                                type="text"
                                value={ansVal}
                                onChange={(e) => {
                                  const currentArr = Array.isArray(q.answer) ? [...q.answer] : [''];
                                  currentArr[ansIdx] = e.target.value;
                                  handleUpdateQuestion(q.id, { answer: currentArr });
                                }}
                                placeholder="Nhập từ hoặc cụm từ đáp án chính xác..."
                                className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs text-[#2F3E6B]"
                              />
                              {(Array.isArray(q.answer) ? q.answer.length : 1) > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentArr = Array.isArray(q.answer) ? [...q.answer] : [];
                                    const nextArr = currentArr.filter((_, i) => i !== ansIdx);
                                    handleUpdateQuestion(q.id, { answer: nextArr });
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              const currentArr = Array.isArray(q.answer) ? [...q.answer] : [''];
                              handleUpdateQuestion(q.id, { answer: [...currentArr, ''] });
                            }}
                            className="text-[11px] text-emerald-700 hover:underline font-bold flex items-center gap-1 pt-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm ô trống tiếp theo</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. VIẾT ĐOẠN VĂN (essay) */}
                    {q.type === 'essay' && (
                      <div className="space-y-3 p-4 rounded-2xl bg-amber-50/40 border border-amber-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-amber-800">
                            Cấu hình Rubric chấm điểm & Giới hạn số từ:
                          </span>

                          <div className="flex items-center gap-4">
                            {/* Số từ gợi ý */}
                            <div className="flex items-center gap-1.5 text-xs text-[#2F3E6B]">
                              <span>Số từ:</span>
                              <input
                                type="number"
                                min="50"
                                value={q.minWords || 120}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, { minWords: Number(e.target.value) })
                                }
                                className="w-16 px-1.5 py-0.5 rounded-lg bg-white border border-amber-200 text-xs text-center font-bold"
                              />
                              <span>–</span>
                              <input
                                type="number"
                                min="100"
                                value={q.maxWords || 200}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, { maxWords: Number(e.target.value) })
                                }
                                className="w-16 px-1.5 py-0.5 rounded-lg bg-white border border-amber-200 text-xs text-center font-bold"
                              />
                              <span>từ</span>
                            </div>

                            {/* Công tắc Bật AI gợi ý chấm */}
                            <label className="flex items-center gap-1.5 text-xs font-bold text-[#2F3E6B] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={q.enableAiGrading ?? true}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, { enableAiGrading: e.target.checked })
                                }
                                className="rounded border-amber-300 text-[#E2704A]"
                              />
                              <Sparkles className="w-3 h-3 text-[#E2704A]" />
                              <span>Bật AI gợi ý chấm</span>
                            </label>
                          </div>
                        </div>

                        {/* Bảng Rubric 4 tiêu chí chuẩn */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-[#8C7E6A] block">
                            Tiêu chí chấm điểm (Rubric):
                          </span>
                          {(q.rubric || DEFAULT_ESSAY_RUBRIC).map((rub, rubIdx) => (
                            <div
                              key={rubIdx}
                              className="p-2.5 rounded-xl bg-white border border-amber-200/80 flex items-center gap-2 text-xs"
                            >
                              <input
                                type="text"
                                value={rub.name}
                                onChange={(e) => {
                                  const newRub = [...(q.rubric || DEFAULT_ESSAY_RUBRIC)];
                                  newRub[rubIdx] = { ...newRub[rubIdx], name: e.target.value };
                                  handleUpdateQuestion(q.id, { rubric: newRub });
                                }}
                                className="w-36 font-bold text-[#2F3E6B] px-2 py-1 rounded bg-[#FAF5EB] border border-[#E6DCC8]"
                              />
                              <input
                                type="text"
                                value={rub.description}
                                onChange={(e) => {
                                  const newRub = [...(q.rubric || DEFAULT_ESSAY_RUBRIC)];
                                  newRub[rubIdx] = { ...newRub[rubIdx], description: e.target.value };
                                  handleUpdateQuestion(q.id, { rubric: newRub });
                                }}
                                placeholder="Mô tả tiêu chí..."
                                className="flex-1 px-2 py-1 rounded bg-[#FAF5EB] border border-[#E6DCC8] text-[11px]"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={rub.maxScore}
                                  onChange={(e) => {
                                    const newRub = [...(q.rubric || DEFAULT_ESSAY_RUBRIC)];
                                    newRub[rubIdx] = { ...newRub[rubIdx], maxScore: Number(e.target.value) };
                                    handleUpdateQuestion(q.id, { rubric: newRub });
                                  }}
                                  className="w-12 px-1.5 py-1 rounded bg-[#FAF5EB] border border-[#E6DCC8] text-center font-bold"
                                />
                                <span className="text-[#8C7E6A] text-[10px]">điểm</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Đoạn văn mẫu tham khảo */}
                        <div>
                          <label className="block text-[11px] font-bold text-[#2F3E6B] mb-1">
                            Đoạn văn mẫu tham khảo (hiện cho học sinh sau khi chấm):
                          </label>
                          <textarea
                            rows={3}
                            value={q.sampleEssay || ''}
                            onChange={(e) => handleUpdateQuestion(q.id, { sampleEssay: e.target.value })}
                            placeholder="Gõ hoặc dán đoạn văn mẫu đạt điểm cao để học sinh đối chiếu học hỏi..."
                            className="w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs text-[#2F3E6B] resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* ========================================================
                        THUỘC TÍNH: MỨC NĂNG LỰC, ĐỘ KHÓ, ĐIỂM, GIẢI THÍCH
                        ======================================================== */}
                    <div className="pt-3 border-t border-[#E6DCC8]/60 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      {/* Mức năng lực (Bắt buộc) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-[#2F3E6B] flex items-center gap-1">
                            <span>Mức năng lực</span>
                            <span className="text-rose-500">*</span>
                          </label>
                          <span
                            className="text-[10px] text-[#4F46E5] cursor-help underline"
                            title={SKILL_TOOLTIPS[q.level]?.desc}
                          >
                            Xem ví dụ
                          </span>
                        </div>
                        <select
                          value={q.level}
                          onChange={(e) =>
                            handleUpdateQuestion(q.id, { level: e.target.value as SkillLevel })
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
                        >
                          <option value="NHAN_BIET">Nhận biết</option>
                          <option value="THONG_HIEU">Thông hiểu</option>
                          <option value="PHAN_TICH">Phân tích</option>
                          <option value="VAN_DUNG">Vận dụng</option>
                        </select>
                      </div>

                      {/* Độ khó */}
                      <div>
                        <label className="block text-xs font-bold text-[#2F3E6B] mb-1">Độ khó</label>
                        <select
                          value={q.difficulty}
                          onChange={(e) =>
                            handleUpdateQuestion(q.id, { difficulty: e.target.value as Difficulty })
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
                        >
                          <option value="DE">Dễ</option>
                          <option value="TB">Trung bình</option>
                          <option value="KHO">Khó</option>
                        </select>
                      </div>

                      {/* Điểm câu */}
                      <div>
                        <label className="block text-xs font-bold text-[#2F3E6B] mb-1">Điểm số</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={q.points || 10}
                          onChange={(e) => handleUpdateQuestion(q.id, { points: Number(e.target.value) })}
                          className="w-full px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] text-center"
                        />
                      </div>
                    </div>

                    {/* Giải thích đáp án */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#8C7E6A] mb-1">
                        Giải thích đáp án chi tiết (hiển thị cho học sinh sau khi làm xong):
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => handleUpdateQuestion(q.id, { explanation: e.target.value })}
                        placeholder="Giải thích vì sao phương án đó đúng, chỉ rõ căn cứ trong văn bản..."
                        className="w-full px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
                      />
                    </div>
                  </div>
                );
              })
            )}

            {/* Nút thêm câu cuối danh sách */}
            {questions.length > 0 && (
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleAddQuestion('single')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B] shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-[#E2704A]" />
                  <span>Thêm câu hỏi mới</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBankOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B] shadow-2xs"
                >
                  <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                  <span>Chọn từ ngân hàng câu hỏi</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Ngân hàng câu hỏi */}
      <QuestionBankModal
        isOpen={isBankOpen}
        onClose={() => setIsBankOpen(false)}
        questions={Object.values(allQuestions || {})}
        topics={topics || []}
        onImportQuestions={handleImportFromBank}
      />
    </div>
  );
};
