import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  HelpCircle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  Edit3,
  Video,
  BookOpen,
  FileQuestion,
  Layers,
  ChevronDown,
  ChevronUp,
  Quote,
  Check,
  X,
  Clock,
  Award,
  RefreshCw,
  FolderOpen,
  BookOpenCheck,
  Eye,
  Copy,
  KeyRound,
  Zap,
  ExternalLink,
} from 'lucide-react';
import {
  quizService,
  contentService,
  useLiveQuery,
  TopicWithMeta,
  QuestionWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  TeacherProfile,
  ClassItem,
} from '../../services/index.ts';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  getGeminiModel,
  setGeminiModel,
  testGeminiApiKey,
} from '../../services/ai/index.ts';
import { QuestionType, SkillLevel, Difficulty, Question } from '../../types.ts';
import { PageHeader } from '../../components/teacher/ui/PageHeader.tsx';
import { ConfirmDialog } from '../../components/teacher/ui/ConfirmDialog.tsx';
import { AiContentStudioModal } from '../../components/teacher/ai/AiContentStudioModal.tsx';
import { MamMuc } from '../../components/MamMuc.tsx';

interface TeacherQuestionBankScreenProps {
  teacher?: TeacherProfile;
  classes?: ClassItem[];
  selectedClassId?: string;
  onRefreshData?: () => void;
}

export const TeacherQuestionBankScreen: React.FC<TeacherQuestionBankScreenProps> = ({
  teacher,
  classes = [],
  selectedClassId = 'all',
  onRefreshData,
}) => {
  const teacherId = teacher?.id || 'gv001';

  // 1. NẠP DỮ LIỆU TỪ SERVICES QUA useLiveQuery
  const { data: rawTopics } = useLiveQuery<TopicWithMeta[]>(
    () => contentService.getTopics(selectedClassId === 'all' ? undefined : selectedClassId, false),
    ['content']
  );
  const { data: rawQuestions } = useLiveQuery<Record<string, QuestionWithMeta>>(
    () => quizService.getQuestions(),
    ['quiz']
  );
  const { data: rawVideos } = useLiveQuery<VideoLessonWithMeta[]>(
    () => contentService.getVideoLessons(selectedClassId === 'all' ? undefined : selectedClassId, false),
    ['content']
  );
  const { data: rawTheories } = useLiveQuery<TheoryLessonWithMeta[]>(
    () => contentService.getTheoryLessons(selectedClassId === 'all' ? undefined : selectedClassId, false),
    ['content']
  );

  const topics = rawTopics ?? [];
  const questionsMap = rawQuestions ?? {};
  const questionsList = useMemo(() => Object.values(questionsMap), [questionsMap]);
  const videos = rawVideos ?? [];
  const theories = rawTheories ?? [];

  // 2. TABS ĐIỀU HƯỚNG CHÍNH: 'bank' (Kho câu hỏi) HOẶC 'ai_studio' (Mầm AI Studio)
  const [activeMainTab, setActiveMainTab] = useState<'bank' | 'ai_studio'>('bank');

  // Trạng thái AI Key & Model
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => !!getGeminiApiKey());
  const [activeModel, setActiveModel] = useState<string>(() => getGeminiModel());
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [modalKeyInput, setModalKeyInput] = useState<string>(() => getGeminiApiKey());
  const [modalModelInput, setModalModelInput] = useState<string>(() => getGeminiModel());
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [keyTestResult, setKeyTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs: number;
  } | null>(null);

  // 3. BỘ LỌC KHO CÂU HỎI
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [openFilterGroups, setOpenFilterGroups] = useState({ type: true, level: true, difficulty: true });
  const [selectedContentType, setSelectedContentType] = useState<
    'all' | 'single' | 'multi' | 'fill' | 'essay' | 'video' | 'theory'
  >('all');
  const [selectedLevel, setSelectedLevel] = useState<'all' | SkillLevel>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | Difficulty>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newlyCreatedQuestionIds, setNewlyCreatedQuestionIds] = useState<string[]>([]);

  // 4. TOAST THÔNG BÁO
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 5. MODAL THÊM / SỬA CÂU HỎI THỦ CÔNG
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuestionWithMeta> | null>(null);

  // Form State cho Câu hỏi thủ công
  const [formTopicId, setFormTopicId] = useState<string>('');
  const [formType, setFormType] = useState<QuestionType>('single');
  const [formLevel, setFormLevel] = useState<SkillLevel>('NHAN_BIET');
  const [formDifficulty, setFormDifficulty] = useState<Difficulty>('TB');
  const [formPrompt, setFormPrompt] = useState('');
  const [formPassage, setFormPassage] = useState('');
  const [formOptions, setFormOptions] = useState<string[]>([
    'Phương án A',
    'Phương án B',
    'Phương án C',
    'Phương án D',
  ]);
  const [formSingleAnswer, setFormSingleAnswer] = useState<string>('A');
  const [formMultiAnswers, setFormMultiAnswers] = useState<string[]>(['A']);
  const [formFillAnswers, setFormFillAnswers] = useState<string>('từ khóa 1, từ khóa 2');
  const [formExplanation, setFormExplanation] = useState('');
  const [formPoints, setFormPoints] = useState<number>(10);

  // Mở modal thêm câu hỏi mới
  const handleOpenAddQuestionModal = () => {
    setEditingQuestion(null);
    setFormTopicId(topics[0]?.id || '');
    setFormType('single');
    setFormLevel('NHAN_BIET');
    setFormDifficulty('TB');
    setFormPrompt('');
    setFormPassage('');
    setFormOptions(['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D']);
    setFormSingleAnswer('A');
    setFormMultiAnswers(['A']);
    setFormFillAnswers('');
    setFormExplanation('');
    setFormPoints(10);
    setIsQuestionModalOpen(true);
  };

  // Mở modal sửa câu hỏi
  const handleOpenEditQuestion = (q: QuestionWithMeta) => {
    setEditingQuestion(q);
    setFormTopicId(q.topicId || topics[0]?.id || '');
    setFormType(q.type || 'single');
    setFormLevel(q.level || 'NHAN_BIET');
    setFormDifficulty(q.difficulty || 'TB');
    setFormPrompt(q.prompt || '');
    setFormPassage(q.passage || '');
    const currentOptions =
      q.options && q.options.length > 0
        ? q.options
        : ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'];
    setFormOptions(currentOptions);
    if (q.type === 'single') {
      const optIdx = currentOptions.indexOf(q.answer as string);
      if (optIdx >= 0) {
        setFormSingleAnswer(['A', 'B', 'C', 'D'][optIdx] || 'A');
      } else {
        setFormSingleAnswer(
          typeof q.answer === 'string' && ['A', 'B', 'C', 'D'].includes(q.answer.toUpperCase())
            ? q.answer.toUpperCase()
            : 'A'
        );
      }
    } else if (q.type === 'multi') {
      const ansArr = Array.isArray(q.answer) ? q.answer : [];
      const mapped = ansArr.map((ans) => {
        const idx = currentOptions.indexOf(ans);
        return idx >= 0 ? ['A', 'B', 'C', 'D'][idx] : ans;
      });
      setFormMultiAnswers(mapped.length > 0 ? mapped : ['A']);
    } else if (q.type === 'fill') {
      setFormFillAnswers(Array.isArray(q.answer) ? q.answer.join(', ') : q.answer || '');
    }
    setFormExplanation(q.explanation || '');
    setFormPoints(q.points || 10);
    setIsQuestionModalOpen(true);
  };

  // Xóa câu hỏi (hỏi xác nhận bằng hộp thoại giữa màn hình của app)
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  const handleDeleteQuestion = (id: string) => {
    setQuestionToDelete(id);
  };

  const confirmDeleteQuestion = async () => {
    if (!questionToDelete) return;
    try {
      await quizService.deleteQuestion(questionToDelete, teacherId);
      showToast('Đã xóa câu hỏi khỏi ngân hàng.');
      onRefreshData?.();
    } catch (e) {
      showToast('Lỗi khi xóa câu hỏi.');
    }
    setQuestionToDelete(null);
  };

  // Lưu câu hỏi thủ công
  const handleSaveQuestionForm = async () => {
    if (!formPrompt.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi (đề bài).');
      return;
    }

    let finalAnswer: any = formSingleAnswer;
    if (formType === 'single') {
      const letterIndex = ['A', 'B', 'C', 'D'].indexOf(formSingleAnswer);
      if (letterIndex >= 0 && formOptions[letterIndex]) {
        finalAnswer = formOptions[letterIndex];
      } else {
        finalAnswer = formSingleAnswer;
      }
    } else if (formType === 'multi') {
      finalAnswer = formMultiAnswers.map((k) => {
        const letterIndex = ['A', 'B', 'C', 'D'].indexOf(k);
        return letterIndex >= 0 && formOptions[letterIndex] ? formOptions[letterIndex] : k;
      });
    } else if (formType === 'fill') {
      finalAnswer = formFillAnswers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (formType === 'essay') {
      finalAnswer = '';
    }

    const payload: Partial<QuestionWithMeta> = {
      ...(editingQuestion || {}),
      id: editingQuestion?.id || 'q_manual_' + Date.now(),
      topicId: formTopicId,
      type: formType,
      level: formLevel,
      difficulty: formDifficulty,
      prompt: formPrompt.trim(),
      passage: formPassage.trim() || undefined,
      options: formType === 'single' || formType === 'multi' ? formOptions : undefined,
      answer: finalAnswer,
      explanation: formExplanation.trim() || 'Giải thích chi tiết chuẩn sách giáo khoa.',
      points: Number(formPoints) || 10,
      isAiGenerated: editingQuestion?.isAiGenerated ?? false,
      isTeacherReviewed: true,
    };

    try {
      await quizService.saveQuestion(payload);
      setIsQuestionModalOpen(false);
      showToast(editingQuestion ? 'Cập nhật câu hỏi thành công!' : 'Đã thêm câu hỏi mới vào ngân hàng!');
      onRefreshData?.();
    } catch (e) {
      alert('Không thể lưu câu hỏi. Vui lòng thử lại.');
    }
  };

  // 6. XỬ LÝ KHI AI STUDIO TẠO BẢN NHÁP
  const handleApplyDraftFromAi = async (payload: {
    type: 'video' | 'theory' | 'quiz';
    data: any;
  }) => {
    try {
      if (payload.type === 'quiz') {
        const generatedQuestions: Question[] = payload.data.questions || [];
        const savedIds: string[] = [];
        for (const q of generatedQuestions) {
          const qId = q.id || 'q_ai_' + Date.now() + Math.random().toString(36).substring(2, 6);
          await quizService.saveQuestion({
            ...q,
            id: qId,
            topicId: payload.data.topicId || formTopicId,
            isAiGenerated: true,
            isTeacherReviewed: true,
          });
          savedIds.push(qId);
        }
        setNewlyCreatedQuestionIds(savedIds);
        if (payload.data.topicId) {
          setSelectedTopicId(payload.data.topicId);
        }
        showToast(`🎉 Đã lưu ${generatedQuestions.length} câu hỏi AI vừa chọn vào Ngân hàng! Các câu mới được làm nổi bật trên đầu.`);
      } else if (payload.type === 'video') {
        await contentService.saveVideoLesson({
          ...payload.data,
          topicId: formTopicId,
          status: 'draft',
        });
        showToast('🎉 Đã lưu bài giảng video & ý trọng tâm vào Ngân hàng học liệu!');
      } else if (payload.type === 'theory') {
        const blocks = payload.data.blocks || [];
        let sections = payload.data.sections || [];

        // Nếu có blocks mà thiếu sections, tự động convert blocks thành sections
        if ((!sections || sections.length === 0) && blocks.length > 0) {
          let currentSec: any = null;
          for (const b of blocks) {
            if (b.type === 'heading' || !currentSec) {
              if (currentSec) sections.push(currentSec);
              currentSec = {
                id: 'sec_' + (b.id || Date.now() + Math.random().toString(36).substring(2, 5)),
                title: b.content || 'Nội dung bài học',
                body: [],
                takeaway: '',
              };
            } else if (b.type === 'paragraph' && b.content) {
              currentSec.body.push(b.content);
            } else if (b.type === 'takeaway' && (b.takeawayText || b.content)) {
              currentSec.takeaway = b.takeawayText || b.content;
            } else if (b.type === 'example') {
              currentSec.example = {
                text: b.exampleText || b.content || '',
                analysis: b.exampleAnalysis || '',
              };
            }
          }
          if (currentSec) sections.push(currentSec);
        }

        await contentService.saveTheoryLesson({
          ...payload.data,
          topicId: formTopicId,
          sections,
          blocks,
          status: 'draft',
        });
        showToast('🎉 Đã lưu khối lý thuyết chuyên sâu vào Ngân hàng học liệu!');
      }
      setActiveMainTab('bank');
      onRefreshData?.();
    } catch (e) {
      console.error(e);
      showToast('Có lỗi xảy ra khi lưu bản nháp AI vào Ngân hàng.');
    }
  };

  // 7. LỌC CÂU HỎI & HỌC LIỆU
  const filteredQuestions = useMemo(() => {
    return questionsList.filter((q) => {
      // Lọc theo chủ đề
      if (selectedTopicId !== 'all' && q.topicId !== selectedTopicId) return false;
      // Lọc theo loại câu hỏi
      if (selectedContentType !== 'all') {
        if (['single', 'multi', 'fill', 'essay'].includes(selectedContentType)) {
          if (q.type !== selectedContentType) return false;
        } else {
          return false;
        }
      }
      // Lọc theo mức năng lực
      if (selectedLevel !== 'all' && q.level !== selectedLevel) return false;
      // Lọc theo độ khó
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false;
      // Tìm kiếm văn bản
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchPrompt = q.prompt?.toLowerCase().includes(query);
        const matchPassage = q.passage?.toLowerCase().includes(query);
        const matchExplanation = q.explanation?.toLowerCase().includes(query);
        if (!matchPrompt && !matchPassage && !matchExplanation) return false;
      }
      return true;
    }).sort((a, b) => {
      const aIsNew = newlyCreatedQuestionIds.includes(a.id);
      const bIsNew = newlyCreatedQuestionIds.includes(b.id);
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      return 0;
    });
  }, [questionsList, selectedTopicId, selectedContentType, selectedLevel, selectedDifficulty, searchQuery, newlyCreatedQuestionIds]);

  const filteredVideos = useMemo(() => {
    if (['single', 'multi', 'fill', 'essay', 'theory'].includes(selectedContentType)) return [];
    return videos.filter((v) => {
      if (selectedTopicId !== 'all' && v.topicId !== selectedTopicId) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = v.title?.toLowerCase().includes(query);
        const matchDesc = v.description?.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [videos, selectedTopicId, selectedContentType, searchQuery]);

  const filteredTheories = useMemo(() => {
    if (['single', 'multi', 'fill', 'essay', 'video'].includes(selectedContentType)) return [];
    return theories.filter((t) => {
      if (selectedTopicId !== 'all' && t.topicId !== selectedTopicId) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(query);
        if (!matchTitle) return false;
      }
      return true;
    });
  }, [theories, selectedTopicId, selectedContentType, searchQuery]);

  // Thống kê số lượng
  const countStats = useMemo(() => {
    const single = questionsList.filter((q) => q.type === 'single').length;
    const multi = questionsList.filter((q) => q.type === 'multi').length;
    const fill = questionsList.filter((q) => q.type === 'fill').length;
    const essay = questionsList.filter((q) => q.type === 'essay').length;
    return {
      totalQuestions: questionsList.length,
      single,
      multi,
      fill,
      essay,
      videos: videos.length,
      theories: theories.length,
    };
  }, [questionsList, videos, theories]);

  // Nhãn hiển thị mức năng lực
  const getLevelBadge = (level: SkillLevel) => {
    switch (level) {
      case 'NHAN_BIET':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20">Nhận biết</span>;
      case 'THONG_HIEU':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Thông hiểu</span>;
      case 'PHAN_TICH':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Phân tích</span>;
      case 'VAN_DUNG':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E2704A]/10 text-[#E2704A] border border-[#E2704A]/20">Vận dụng</span>;
      default:
        return null;
    }
  };

  // Nhãn hiển thị độ khó
  const getDifficultyBadge = (diff: Difficulty) => {
    switch (diff) {
      case 'DE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Dễ</span>;
      case 'TB':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">TB</span>;
      case 'KHO':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">Khó</span>;
      default:
        return null;
    }
  };

  const getTypeName = (type: QuestionType) => {
    switch (type) {
      case 'single':
        return 'Trắc nghiệm 1 đáp án';
      case 'multi':
        return 'Chọn nhiều đáp án';
      case 'fill':
        return 'Điền vào ô trống';
      case 'essay':
        return 'Tự luận / Đoạn văn';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. THANH TIÊU ĐỀ TRANG */}
      <PageHeader
        title="Ngân hàng câu hỏi & Kho học liệu"
        subtitle="Quản lý toàn bộ câu hỏi trắc nghiệm, tự luận, video bài giảng và lý thuyết; tích hợp Mầm AI Studio đối chiếu trực tiếp từ ngữ liệu."
        badge={
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#E2704A]/10 text-[#E2704A] border border-[#E2704A]/20 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E2704A]" />
            <span>Mầm AI Studio</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddQuestionModal}
              className="px-4 py-2 rounded-2xl bg-white border border-[#E6DCC8] hover:bg-[#FAF5EB] text-[#2F3E6B] font-bold text-xs flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#E2704A]" />
              <span>Thêm câu hỏi thủ công</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab(activeMainTab === 'ai_studio' ? 'bank' : 'ai_studio')}
              className={`px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                activeMainTab === 'ai_studio'
                  ? 'bg-[#2F3E6B] text-white hover:bg-[#233055]'
                  : 'bg-gradient-to-r from-[#E2704A] to-[#D45E36] hover:from-[#D45E36] hover:to-[#C34F28] text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{activeMainTab === 'ai_studio' ? '📚 Quay lại Kho ngân hàng' : '⚡ Mở Mầm AI Studio'}</span>
            </button>
          </div>
        }
      />

      {/* TOAST THÔNG BÁO NỔI */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2F3E6B] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/20 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* THANH TRẠNG THÁI AI (đã tối giản) */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-[#E6DCC8] bg-[#FFFDF8] shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${hasApiKey ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-xs font-semibold text-[#2F3E6B] truncate">
            {hasApiKey ? `Mầm AI đang kích hoạt (${activeModel.replace(/^gemini/i, 'AI')})` : 'Chưa cấu hình Google AI Studio API Key'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setModalKeyInput(getGeminiApiKey());
            setModalModelInput(getGeminiModel());
            setKeyTestResult(null);
            setShowApiKeyModal(true);
          }}
          className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors ${
            hasApiKey
              ? 'bg-white border border-[#E6DCC8] text-[#2F3E6B] hover:bg-[#FAF5EB]'
              : 'bg-[#E2704A] hover:bg-[#D45E36] text-white'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>{hasApiKey ? 'Cấu hình' : 'Nhập API Key'}</span>
        </button>
      </div>

      {/* 2. TAB SWITCHER CHÍNH */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl w-fit shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveMainTab('bank')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeMainTab === 'bank'
              ? 'bg-[#2F3E6B] text-white shadow-xs'
              : 'text-[#8C7E6A] hover:text-[#2F3E6B] hover:bg-black/5'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Kho ngân hàng</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('ai_studio')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeMainTab === 'ai_studio'
              ? 'bg-[#E2704A] text-white shadow-xs'
              : 'text-[#8C7E6A] hover:text-[#E2704A] hover:bg-[#E2704A]/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Mầm AI Studio</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/20 font-bold">RAG Studio</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PHÂN HỆ 1: XƯỞNG SÁNG TẠO AI NOTEBOOKLM (NHÚNG TRỰC TIẾP ĐẦY ĐỦ 3 CỘT)    */}
      {/* ========================================================================= */}
      {activeMainTab === 'ai_studio' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-4 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-[#8C7E6A]">Chủ đề ngữ liệu làm việc:</span>
              <select
                value={formTopicId}
                onChange={(e) => setFormTopicId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] outline-none focus:border-[#E2704A]"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-[#8C7E6A]">
              💡 AI sẽ trích dẫn nguồn ngữ liệu, cho phép trò chuyện hỏi đáp và sinh câu hỏi/video/lý thuyết lưu thẳng vào Ngân hàng.
            </p>
          </div>

          <AiContentStudioModal
            isOpen={true}
            isEmbedded={true}
            onClose={() => setActiveMainTab('bank')}
            topicId={formTopicId}
            topicTitle={topics.find((t) => t.id === formTopicId)?.title || 'Ngữ văn 7'}
            onApplyDraft={handleApplyDraftFromAi}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHÂN HỆ 2: KHO CÂU HỎI & HỌC LIỆU ĐÃ LƯU                                 */}
      {/* ========================================================================= */}
      {activeMainTab === 'bank' && (
        <div className="space-y-6">
          {/* THẺ THỐNG KÊ NHANH */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] p-3.5 rounded-2xl shadow-2xs">
              <span className="text-[11px] font-bold text-[#8C7E6A] block">Tổng câu hỏi</span>
              <span className="text-xl font-bold font-lora text-[#2F3E6B]">{countStats.totalQuestions}</span>
            </div>
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] p-3.5 rounded-2xl shadow-2xs">
              <span className="text-[11px] font-bold text-[#0D9488] block">Trắc nghiệm 1 đáp án</span>
              <span className="text-xl font-bold font-lora text-[#2F3E6B]">{countStats.single}</span>
            </div>
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] p-3.5 rounded-2xl shadow-2xs">
              <span className="text-[11px] font-bold text-blue-600 block">Nhiều đáp án</span>
              <span className="text-xl font-bold font-lora text-[#2F3E6B]">{countStats.multi}</span>
            </div>
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] p-3.5 rounded-2xl shadow-2xs">
              <span className="text-[11px] font-bold text-amber-600 block">Điền vào ô trống</span>
              <span className="text-xl font-bold font-lora text-[#2F3E6B]">{countStats.fill}</span>
            </div>
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] p-3.5 rounded-2xl shadow-2xs">
              <span className="text-[11px] font-bold text-[#E2704A] block">Tự luận</span>
              <span className="text-xl font-bold font-lora text-[#2F3E6B]">{countStats.essay}</span>
            </div>
            <div className="bg-[#FFFDF8] border border-[#E6DCC8] p-3.5 rounded-2xl shadow-2xs">
              <span className="text-[11px] font-bold text-indigo-600 block">Video & Lý thuyết</span>
              <span className="text-xl font-bold font-lora text-[#2F3E6B]">
                {countStats.videos + countStats.theories}
              </span>
            </div>
          </div>

          {/* BỘ LỌC ĐA TIÊU CHÍ */}
          <div className="bg-[#FFFDF8] border border-[#E6DCC8] p-4 rounded-2xl shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Tìm kiếm */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#8C7E6A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm câu hỏi, đoạn ngữ liệu, lời giải thích..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] placeholder-[#8C7E6A] outline-none focus:border-[#E2704A]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7E6A] hover:text-[#2F3E6B]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Lọc theo Chủ đề */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#8C7E6A] shrink-0">Chủ đề:</span>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                >
                  <option value="all">Tất cả chủ đề ({topics.length})</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* BỘ LỌC DẠNG DANH SÁCH (LIST) — 3 nhóm theo Figma */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#E6DCC8]/60">
              <div>
                <button
                  type="button"
                  onClick={() => setOpenFilterGroups((prev) => ({ ...prev, type: !prev.type }))}
                  className="w-full flex items-center justify-between text-xs font-bold text-[#2F3E6B] mb-1.5 hover:text-[#E2704A] transition-colors"
                >
                  <span>
                    1. Dạng học liệu
                    {!openFilterGroups.type && (
                      <span className="ml-1.5 font-semibold text-[#E2704A]">· {({ all: 'Tất cả', single: 'Trắc nghiệm đơn', multi: 'Nhiều đáp án', fill: 'Điền từ', essay: 'Tự luận', video: 'Video & Ý trọng tâm', theory: 'Lý thuyết chi tiết' } as Record<string, string>)[selectedContentType]}</span>
                    )}
                  </span>
                  {openFilterGroups.type ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {openFilterGroups.type && (
                <ul className="divide-y divide-[#E6DCC8]/50 rounded-xl border border-[#E6DCC8] overflow-hidden">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'single', label: 'Trắc nghiệm đơn' },
                    { id: 'multi', label: 'Nhiều đáp án' },
                    { id: 'fill', label: 'Điền từ' },
                    { id: 'essay', label: 'Tự luận' },
                    { id: 'video', label: 'Video & Ý trọng tâm' },
                    { id: 'theory', label: 'Lý thuyết chi tiết' },
                  ].map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedContentType(item.id as any)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                          selectedContentType === item.id
                            ? 'bg-[#2F3E6B] text-white font-bold'
                            : 'bg-[#FFFDF8] text-[#4B5563] hover:bg-[#FAF5EB]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedContentType === item.id ? 'bg-white' : 'bg-[#E6DCC8]'}`} />
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setOpenFilterGroups((prev) => ({ ...prev, level: !prev.level }))}
                  className="w-full flex items-center justify-between text-xs font-bold text-[#2F3E6B] mb-1.5 hover:text-[#E2704A] transition-colors"
                >
                  <span>
                    2. Năng lực
                    {!openFilterGroups.level && (
                      <span className="ml-1.5 font-semibold text-[#E2704A]">· {({ all: 'Tất cả', NHAN_BIET: 'Nhận biết', THONG_HIEU: 'Thông hiểu', PHAN_TICH: 'Phân tích', VAN_DUNG: 'Vận dụng' } as Record<string, string>)[selectedLevel]}</span>
                    )}
                  </span>
                  {openFilterGroups.level ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {openFilterGroups.level && (
                <ul className="divide-y divide-[#E6DCC8]/50 rounded-xl border border-[#E6DCC8] overflow-hidden">
                  {([
                    { id: 'all', label: 'Tất cả' },
                    { id: 'NHAN_BIET', label: 'Nhận biết' },
                    { id: 'THONG_HIEU', label: 'Thông hiểu' },
                    { id: 'PHAN_TICH', label: 'Phân tích' },
                    { id: 'VAN_DUNG', label: 'Vận dụng' },
                  ] as const).map((lvl) => (
                    <li key={lvl.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedLevel(lvl.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                          selectedLevel === lvl.id
                            ? 'bg-[#E2704A] text-white font-bold'
                            : 'bg-[#FFFDF8] text-[#4B5563] hover:bg-[#FAF5EB]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedLevel === lvl.id ? 'bg-white' : 'bg-[#E6DCC8]'}`} />
                        {lvl.label}
                      </button>
                    </li>
                  ))}
                </ul>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setOpenFilterGroups((prev) => ({ ...prev, difficulty: !prev.difficulty }))}
                  className="w-full flex items-center justify-between text-xs font-bold text-[#2F3E6B] mb-1.5 hover:text-[#E2704A] transition-colors"
                >
                  <span>
                    3. Độ khó
                    {!openFilterGroups.difficulty && (
                      <span className="ml-1.5 font-semibold text-[#E2704A]">· {({ all: 'Tất cả', DE: 'Dễ', TB: 'Trung bình', KHO: 'Khó' } as Record<string, string>)[selectedDifficulty]}</span>
                    )}
                  </span>
                  {openFilterGroups.difficulty ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {openFilterGroups.difficulty && (
                <ul className="divide-y divide-[#E6DCC8]/50 rounded-xl border border-[#E6DCC8] overflow-hidden">
                  {([
                    { id: 'all', label: 'Tất cả' },
                    { id: 'DE', label: 'Dễ' },
                    { id: 'TB', label: 'Trung bình' },
                    { id: 'KHO', label: 'Khó' },
                  ] as const).map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedDifficulty(d.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                          selectedDifficulty === d.id
                            ? 'bg-[#2F3E6B] text-white font-bold'
                            : 'bg-[#FFFDF8] text-[#4B5563] hover:bg-[#FAF5EB]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedDifficulty === d.id ? 'bg-white' : 'bg-[#E6DCC8]'}`} />
                        {d.label}
                      </button>
                    </li>
                  ))}
                </ul>
                )}
              </div>
            </div>
          </div>

          {/* DANH SÁCH CÂU HỎI & HỌC LIỆU HIỂN THỊ */}
          <div className="space-y-4">
            {/* THẺ CÂU HỎI */}
            {filteredQuestions.map((q, idx) => {
              const topicName = topics.find((t) => t.id === q.topicId)?.title || q.topicId;
              const options = q.options || [];

              return (
                <div
                  key={q.id || idx}
                  className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 shadow-2xs hover:border-[#E2704A]/60 transition-all space-y-3 text-[#2F3E6B]"
                >
                  {/* HÀNG TRÊN CÙNG: HUY HIỆU & THAO TÁC */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[#FAF5EB] text-[#2F3E6B] border border-[#E6DCC8]">
                        Câu {idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FAF5EB] text-[#8C7E6A]">
                        {getTypeName(q.type)}
                      </span>
                      {getLevelBadge(q.level)}
                      {getDifficultyBadge(q.difficulty)}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAF5EB] text-[#8C7E6A]">
                        Chủ đề: {topicName}
                      </span>
                      {newlyCreatedQuestionIds.includes(q.id) && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 animate-pulse">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          Vừa tạo mới
                        </span>
                      )}
                      {q.isAiGenerated && !newlyCreatedQuestionIds.includes(q.id) && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-500" />
                          Mầm AI
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#E2704A] mr-2">
                        {q.points || 10} điểm
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditQuestion(q)}
                        className="p-1.5 rounded-xl hover:bg-[#FAF5EB] text-[#8C7E6A] hover:text-[#2F3E6B] transition-colors"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-xl hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600 transition-colors"
                        title="Xóa câu hỏi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* ĐOẠN TRÍCH NGỮ LIỆU NẾU CÓ */}
                  {q.passage && (
                    <div className="p-3 rounded-xl bg-[#FAF5EB] border-l-4 border-[#E2704A] text-xs italic text-[#4B5563] flex items-start gap-2.5">
                      <Quote className="w-4 h-4 text-[#E2704A] shrink-0 mt-0.5" />
                      <div className="whitespace-pre-line leading-relaxed">{q.passage}</div>
                    </div>
                  )}

                  {/* ĐỀ BÀI (PROMPT) */}
                  <h3 className="font-lora text-sm sm:text-base font-bold text-[#2F3E6B] leading-relaxed">
                    {q.prompt}
                  </h3>

                  {/* PHẦN ĐÁP ÁN THEO TỪNG DẠNG */}
                  {q.type === 'single' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {options.map((opt, oIdx) => {
                        const optKey = String.fromCharCode(65 + oIdx);
                        const isCorrect = q.answer === optKey || q.answer === opt;
                        return (
                          <div
                            key={oIdx}
                            className={`p-2.5 rounded-xl text-xs flex items-center gap-2.5 border transition-all ${
                              isCorrect
                                ? 'bg-emerald-50/80 border-emerald-400 text-emerald-900 font-semibold shadow-2xs'
                                : 'bg-[#FAF5EB]/40 border-[#E6DCC8] text-[#4B5563]'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#FAF5EB] text-[#8C7E6A] border border-[#E6DCC8]'
                              }`}
                            >
                              {optKey}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'multi' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {options.map((opt, oIdx) => {
                        const optKey = String.fromCharCode(65 + oIdx);
                        const isCorrect =
                          Array.isArray(q.answer) &&
                          (q.answer.includes(optKey) || q.answer.includes(opt));
                        return (
                          <div
                            key={oIdx}
                            className={`p-2.5 rounded-xl text-xs flex items-center gap-2.5 border transition-all ${
                              isCorrect
                                ? 'bg-emerald-50/80 border-emerald-400 text-emerald-900 font-semibold shadow-2xs'
                                : 'bg-[#FAF5EB]/40 border-[#E6DCC8] text-[#4B5563]'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#FAF5EB] text-[#8C7E6A] border border-[#E6DCC8]'
                              }`}
                            >
                              {optKey}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'fill' && (
                    <div className="p-3 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs">
                      <span className="font-bold text-[#8C7E6A] mr-2">Đáp án điền từ đúng:</span>
                      <span className="font-bold text-emerald-700">
                        {Array.isArray(q.answer) ? q.answer.join(' | ') : q.answer}
                      </span>
                    </div>
                  )}

                  {q.type === 'essay' && (
                    <div className="p-3 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs space-y-2">
                      <span className="font-bold text-[#8C7E6A] block">Tiêu chí chấm tự luận (Rubric):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(q.rubric || [
                          { name: 'Ý tứ & Cảm xúc', maxScore: 4, description: 'Bộc lộ đúng cảm nhận về hình ảnh' },
                          { name: 'Nghệ thuật & Biện pháp tu từ', maxScore: 4, description: 'Chỉ ra nhịp thơ, vần, từ láy' },
                          { name: 'Chính tả & Diễn đạt', maxScore: 2, description: 'Không sai ngữ pháp, câu trôi chảy' },
                        ]).map((r, rIdx) => (
                          <div key={rIdx} className="bg-white p-2.5 rounded-xl border border-[#E6DCC8]">
                            <div className="flex items-center justify-between font-bold text-[#2F3E6B]">
                              <span>{r.name}</span>
                              <span className="text-[#E2704A]">{r.maxScore || r.maxPoints || 4}đ</span>
                            </div>
                            <p className="text-[10px] text-[#8C7E6A] mt-1">{r.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LỜI GIẢI THÍCH CHI TIẾT */}
                  {q.explanation && (
                    <div className="pt-2 border-t border-[#E6DCC8]/60 text-xs text-[#6B7280] flex items-start gap-2">
                      <span className="font-bold text-[#8C7E6A] shrink-0">Giải thích:</span>
                      <p className="leading-relaxed">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* DANH SÁCH BÀI GIẢNG VIDEO & Ý TRỌNG TÂM (NẾU ĐƯỢC CHỌN) */}
            {(selectedContentType === 'all' || selectedContentType === 'video') &&
              filteredVideos.map((v) => (
                <div
                  key={v.id}
                  className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                        <Video className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                            Video bài giảng
                          </span>
                          <span className="text-xs text-[#8C7E6A]">
                            Thời lượng: {Math.round(v.durationSec / 60)} phút
                          </span>
                        </div>
                        <h4 className="font-lora font-bold text-base text-[#2F3E6B] mt-0.5">{v.title}</h4>
                      </div>
                    </div>
                  </div>

                  {v.description && <p className="text-xs text-[#4B5563]">{v.description}</p>}

                  {/* CÁC Ý TRỌNG TÂM VIDEO */}
                  <div className="space-y-2 pt-2 border-t border-[#E6DCC8]">
                    <span className="text-xs font-bold text-[#8C7E6A] block">
                      Các ý trọng tâm video ({v.summaryPoints?.length || 0} mốc kiến thức):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(v.summaryPoints || []).map((pt, pIdx) => (
                        <div key={pIdx} className="p-3 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#2F3E6B]">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px]">
                              Ý #{pIdx + 1}
                            </span>
                            <span>{pt.title}</span>
                          </div>
                          <p className="text-[11px] text-[#4B5563] leading-relaxed">{pt.content}</p>
                          {pt.example && (
                            <p className="text-[10px] text-amber-700 italic bg-amber-50/60 p-1 rounded">
                              Ví dụ: {pt.example}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

            {/* DANH SÁCH LÝ THUYẾT CHI TIẾT (NẾU ĐƯỢC CHỌN) */}
            {(selectedContentType === 'all' || selectedContentType === 'theory') &&
              filteredTheories.map((t) => (
                <div
                  key={t.id}
                  className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl p-5 shadow-2xs space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-teal-50 text-teal-600">
                      <BookOpen className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700">
                          Lý thuyết chi tiết
                        </span>
                        <span className="text-xs text-[#8C7E6A]">Đọc ~{t.minReadSeconds}s</span>
                      </div>
                      <h4 className="font-lora font-bold text-base text-[#2F3E6B] mt-0.5">{t.title}</h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#E6DCC8]">
                    {t.blocks && t.blocks.length > 0 ? (
                      t.blocks.map((blk, bIdx) => (
                        <div key={bIdx} className="p-3 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] space-y-1.5">
                          {blk.type === 'heading' && (
                            <span className="text-xs font-bold text-[#2F3E6B] flex items-center gap-1.5">
                              📌 {blk.content}
                            </span>
                          )}
                          {blk.type === 'paragraph' && (
                            <p className="text-[11px] text-[#4B5563] leading-relaxed">
                              {blk.content}
                            </p>
                          )}
                          {blk.type === 'example' && (
                            <div className="text-[11px] bg-white/80 p-2 rounded-lg border border-amber-200/60">
                              <span className="font-bold text-amber-800 block text-[10px]">
                                Ví dụ: {blk.exampleText || blk.content}
                              </span>
                              {blk.exampleAnalysis && (
                                <span className="text-[10px] text-slate-600 block mt-0.5">{blk.exampleAnalysis}</span>
                              )}
                            </div>
                          )}
                          {blk.type === 'takeaway' && (
                            <p className="text-[10px] text-teal-800 font-bold bg-teal-50/80 p-1.5 rounded-lg border border-teal-200/50">
                              💡 Ghi nhớ: {blk.takeawayText || blk.content}
                            </p>
                          )}
                          {blk.type === 'list' && blk.items && (
                            <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-0.5">
                              {blk.items.map((it, iIdx) => (
                                <li key={iIdx}>{it}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    ) : (t.sections && t.sections.length > 0) ? (
                      t.sections.map((sec, sIdx) => (
                        <div key={sIdx} className="p-3 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] space-y-1">
                          <span className="text-xs font-bold text-[#2F3E6B]">{sec.title}</span>
                          <p className="text-[11px] text-[#4B5563] leading-relaxed line-clamp-3">
                            {Array.isArray(sec.body) ? sec.body.join(' ') : sec.body}
                          </p>
                          {sec.takeaway && (
                            <p className="text-[10px] text-teal-700 font-medium">Ghi nhớ: {sec.takeaway}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 p-3 text-center text-xs text-slate-400 italic">
                        Khối lý thuyết chuyên sâu đang được chuẩn hóa...
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {/* TRẠNG THÁI TRỐNG */}
            {filteredQuestions.length === 0 &&
              filteredVideos.length === 0 &&
              filteredTheories.length === 0 && (
                <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-12 text-center space-y-4">
                  <MamMuc mood="thinking" size="md" className="mx-auto" />
                  <h3 className="font-lora font-bold text-lg text-[#2F3E6B]">
                    Không tìm thấy câu hỏi hoặc học liệu phù hợp
                  </h3>
                  <p className="text-xs text-[#8C7E6A] max-w-md mx-auto">
                    Thử đổi bộ lọc hoặc dùng Mầm AI Studio để nạp ngữ liệu và sinh thêm câu hỏi tự động.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTopicId('all');
                        setSelectedContentType('all');
                        setSelectedLevel('all');
                        setSelectedDifficulty('all');
                        setSearchQuery('');
                      }}
                      className="px-4 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] hover:bg-[#E6DCC8]"
                    >
                      Xóa bộ lọc
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMainTab('ai_studio')}
                      className="px-4 py-2 rounded-xl bg-[#E2704A] text-white text-xs font-bold flex items-center gap-2 shadow-xs hover:bg-[#D45E36]"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Mở Mầm AI Studio</span>
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL THÊM / CHỈNH SỬA CÂU HỎI THỦ CÔNG                                */}
      {/* ========================================================================= */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1E1B4B]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[90vh] bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#2F3E6B]">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-[#FAF5EB] border-b border-[#E6DCC8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E2704A]/10 text-[#E2704A] flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-lora font-bold text-base text-[#2F3E6B]">
                    {editingQuestion ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới vào ngân hàng'}
                  </h3>
                  <p className="text-[11px] text-[#8C7E6A]">
                    Chuẩn hóa câu hỏi theo ma trận 4 mức độ năng lực GDPT 2018
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuestionModalOpen(false)}
                className="p-1.5 rounded-xl text-[#8C7E6A] hover:text-[#2F3E6B] hover:bg-black/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung Form cuộn */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Chủ đề & Dạng câu hỏi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#2F3E6B] block mb-1">Chủ đề bài học</label>
                  <select
                    value={formTopicId}
                    onChange={(e) => setFormTopicId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                  >
                    <option value="">-- Chưa gắn chủ đề (Chung) --</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2F3E6B] block mb-1">Dạng câu hỏi</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                  >
                    <option value="single">Trắc nghiệm 1 đáp án</option>
                    <option value="multi">Chọn nhiều đáp án</option>
                    <option value="fill">Điền vào ô trống</option>
                    <option value="essay">Tự luận / Viết đoạn văn</option>
                  </select>
                </div>
              </div>

              {/* Mức năng lực & Độ khó & Điểm */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#2F3E6B] block mb-1">Mức năng lực</label>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value as SkillLevel)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                  >
                    <option value="NHAN_BIET">Nhận biết</option>
                    <option value="THONG_HIEU">Thông hiểu</option>
                    <option value="PHAN_TICH">Phân tích</option>
                    <option value="VAN_DUNG">Vận dụng</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2F3E6B] block mb-1">Độ khó</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as Difficulty)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                  >
                    <option value="DE">Dễ</option>
                    <option value="TB">Trung bình</option>
                    <option value="KHO">Khó</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2F3E6B] block mb-1">Điểm số</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formPoints}
                    onChange={(e) => setFormPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                  />
                </div>
              </div>

              {/* Ngữ liệu trích dẫn */}
              <div>
                <label className="text-xs font-bold text-[#2F3E6B] block mb-1">
                  Ngữ liệu / Đoạn trích dẫn (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  placeholder="Dán đoạn thơ, đoạn văn trích dẫn..."
                  value={formPassage}
                  onChange={(e) => setFormPassage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                />
              </div>

              {/* Đề bài (Prompt) */}
              <div>
                <label className="text-xs font-bold text-[#2F3E6B] block mb-1">
                  Nội dung câu hỏi (Đề bài) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Nhập câu hỏi..."
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                />
              </div>

              {/* Phương án cho Single / Multi */}
              {(formType === 'single' || formType === 'multi') && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2F3E6B] block">
                    Các phương án trả lời & Chọn đáp án đúng
                  </label>
                  {formOptions.map((opt, oIdx) => {
                    const optKey = String.fromCharCode(65 + oIdx);
                    const isSelected =
                      formType === 'single'
                        ? formSingleAnswer === optKey
                        : formMultiAnswers.includes(optKey);

                    return (
                      <div key={oIdx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (formType === 'single') {
                              setFormSingleAnswer(optKey);
                            } else {
                              setFormMultiAnswers(
                                isSelected
                                  ? formMultiAnswers.filter((k) => k !== optKey)
                                  : [...formMultiAnswers, optKey]
                              );
                            }
                          }}
                          className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#FAF5EB] text-[#8C7E6A] border border-[#E6DCC8]'
                          }`}
                        >
                          {optKey}
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...formOptions];
                            next[oIdx] = e.target.value;
                            setFormOptions(next);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                          placeholder={`Nội dung phương án ${optKey}...`}
                        />
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-[#8C7E6A] italic">
                    Bấm vào chữ cái A, B, C, D màu xanh để chọn làm đáp án đúng.
                  </p>
                </div>
              )}

              {/* Đáp án điền từ */}
              {formType === 'fill' && (
                <div>
                  <label className="text-xs font-bold text-[#2F3E6B] block mb-1">
                    Đáp án đúng (ngăn cách bởi dấu phẩy nếu có nhiều từ)
                  </label>
                  <input
                    type="text"
                    value={formFillAnswers}
                    onChange={(e) => setFormFillAnswers(e.target.value)}
                    placeholder="ví dụ: so sánh, nhân hóa"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                  />
                </div>
              )}

              {/* Lời giải thích */}
              <div>
                <label className="text-xs font-bold text-[#2F3E6B] block mb-1">
                  Lời giải thích chi tiết
                </label>
                <textarea
                  rows={2}
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  placeholder="Giải thích vì sao đáp án đúng..."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                />
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 bg-[#FAF5EB] border-t border-[#E6DCC8] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsQuestionModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#8C7E6A] hover:bg-black/5"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveQuestionForm}
                className="px-5 py-2 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold shadow-xs transition-colors"
              >
                {editingQuestion ? 'Lưu thay đổi' : 'Thêm vào ngân hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CẤU HÌNH API KEY TRỰC TIẾP TRÊN NGÂN HÀNG CÂU HỎI */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-60 bg-[#1E1B4B]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-2xl p-6 space-y-4 text-[#2F3E6B] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E2704A]/10 text-[#E2704A] flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-lora font-bold text-base">Cấu hình Google AI Studio API Key</h3>
                  <p className="text-[11px] text-[#8C7E6A]">Kích hoạt Mầm AI thật cho toàn hệ thống Mầm Văn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="p-1 rounded-lg text-[#8C7E6A] hover:bg-black/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">
                  Google Gemini API Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Dán API Key (bắt đầu bằng AIzaSy...)"
                  value={modalKeyInput}
                  onChange={(e) => setModalKeyInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-mono outline-none focus:border-[#E2704A]"
                />
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#E2704A] hover:underline inline-flex items-center gap-1 mt-1 font-medium"
                >
                  <span>Lấy API Key miễn phí tại Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">
                  Lưu ý bảo mật: API Key được lưu ngay trên trình duyệt này (localStorage).
                  Không dùng máy chung/không chia sẻ key — ai mở được trình duyệt này đều
                  xem được key trong phần Cài đặt.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Mô hình AI (Model)</label>
                <select
                  value={modalModelInput}
                  onChange={(e) => setModalModelInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold"
                >
                  <option value="gemini-flash-latest">Mầm AI-flash-latest (Khuyên dùng - Chuẩn Google AI Studio)</option>
                  <option value="gemini-2.5-flash">Mầm AI-2.5-flash (Thế hệ mới 2.5 - Siêu tốc)</option>
                  <option value="gemini-2.0-flash">Mầm AI-2.0-flash (Ổn định & Thông minh)</option>
                  <option value="gemini-1.5-flash">Mầm AI-1.5-flash (Bản tiêu chuẩn)</option>
                  <option value="gemini-2.5-pro">Mầm AI-2.5-pro (Suy luận chuyên sâu cao cấp)</option>
                  <option value="gemini-1.5-pro">Mầm AI-1.5-pro (Ngữ văn phân tích sâu)</option>
                </select>
              </div>

              {keyTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    keyTestResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{keyTestResult.success ? '✓ Kết nối thành công!' : '✗ Lỗi kết nối!'}</span>
                    {keyTestResult.latencyMs > 0 && <span>{keyTestResult.latencyMs}ms</span>}
                  </div>
                  <p className="text-[11px] italic">"{keyTestResult.message}"</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E6DCC8]">
              <button
                type="button"
                onClick={async () => {
                  if (!modalKeyInput.trim()) {
                    alert('Vui lòng dán API Key trước khi kiểm tra.');
                    return;
                  }
                  setIsTestingKey(true);
                  setKeyTestResult(null);
                  try {
                    const res = await testGeminiApiKey(modalKeyInput.trim(), modalModelInput);
                    setKeyTestResult(res);
                  } catch (err: any) {
                    setKeyTestResult({ success: false, message: err.message, latencyMs: 0 });
                  } finally {
                    setIsTestingKey(false);
                  }
                }}
                disabled={isTestingKey || !modalKeyInput.trim()}
                className="px-3.5 py-2 rounded-xl border border-[#2F3E6B] text-[#2F3E6B] hover:bg-[#2F3E6B]/5 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isTestingKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Kiểm tra kết nối</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#8C7E6A] hover:bg-black/5"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeminiApiKey(modalKeyInput);
                    setGeminiModel(modalModelInput);
                    const keyValid = !!modalKeyInput.trim();
                    setHasApiKey(keyValid);
                    setActiveModel(modalModelInput);
                    setShowApiKeyModal(false);
                    showToast(keyValid ? 'Đã lưu API Key và kích hoạt Google AI Studio thật!' : 'Đã xóa API Key.');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Lưu & Kích hoạt AI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hộp thoại xác nhận xóa câu hỏi — giữa màn hình */}
      <ConfirmDialog
        isOpen={!!questionToDelete}
        title="Xóa câu hỏi"
        message="Thầy/cô có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng không?"
        confirmLabel="Xóa câu hỏi"
        variant="danger"
        onConfirm={confirmDeleteQuestion}
        onCancel={() => setQuestionToDelete(null)}
      />
    </div>
  );
};
