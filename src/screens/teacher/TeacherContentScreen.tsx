import React, { useState, useEffect } from 'react';
import {
  contentService,
  quizService,
  classService,
  useLiveQuery,
  TopicWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  QuizWithMeta,
  QuestionWithMeta,
  ClassItem,
  TeacherProfile,
} from '../../services/index.ts';
import { PageHeader } from '../../components/teacher/ui/PageHeader.tsx';
import { TopicTreeSidebar, SelectedContentItem, ContentItemType } from '../../components/teacher/content/TopicTreeSidebar.tsx';
import { ConfirmDialog } from '../../components/teacher/ui/ConfirmDialog.tsx';
import { VideoLessonEditor } from '../../components/teacher/content/VideoLessonEditor.tsx';
import { TheoryLessonEditor } from '../../components/teacher/content/TheoryLessonEditor.tsx';
import { QuizBuilder } from '../../components/teacher/content/QuizBuilder.tsx';
import { TopicModal } from '../../components/teacher/content/TopicModal.tsx';
import { AssignmentBuilderModal } from '../../components/teacher/content/AssignmentBuilderModal.tsx';
import { TopicFlowStrip } from '../../components/teacher/content/TopicFlowStrip.tsx';
import {
  FlowItemType,
  deriveFlowItems,
  flowKeyOf,
  flowKeys,
} from '../../logic/flowOrder.ts';
import { PublishModal } from '../../components/teacher/content/PublishModal.tsx';
import { AiContentStudioModal } from '../../components/teacher/ai/AiContentStudioModal.tsx';
import { StudentPreviewModal } from '../../components/teacher/content/StudentPreviewModal.tsx';
import {
  Plus,
  Sparkles,
  Video,
  BookOpen,
  FileQuestion,
  ChevronDown,
  Layers,
  UploadCloud,
  CheckCircle2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { MamMuc } from '../../components/MamMuc.tsx';

interface TeacherContentScreenProps {
  teacher?: TeacherProfile;
  classes?: ClassItem[];
  selectedClassId?: string;
  onRefreshData?: () => void;
}

export const TeacherContentScreen: React.FC<TeacherContentScreenProps> = ({
  teacher,
  classes: propClasses,
  selectedClassId = 'all',
  onRefreshData,
}) => {
  const teacherId = teacher?.id || 'gv001';

  // 1. Nạp dữ liệu đồng bộ qua useLiveQuery
  const { data: rawTopics } = useLiveQuery<TopicWithMeta[]>(
    () => contentService.getTopics(selectedClassId === 'all' ? undefined : selectedClassId, false),
    ['content']
  );
  const { data: rawVideos } = useLiveQuery<VideoLessonWithMeta[]>(
    () => contentService.getVideoLessons(selectedClassId === 'all' ? undefined : selectedClassId, false),
    ['content']
  );
  const { data: rawTheories } = useLiveQuery<TheoryLessonWithMeta[]>(
    () => contentService.getTheoryLessons(selectedClassId === 'all' ? undefined : selectedClassId, false),
    ['content']
  );
  const { data: rawQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(selectedClassId === 'all' ? undefined : selectedClassId, false),
    ['quiz']
  );
  const { data: rawQuestions } = useLiveQuery<Record<string, QuestionWithMeta>>(
    () => quizService.getQuestions(),
    ['quiz']
  );
  const { data: rawClasses } = useLiveQuery<ClassItem[]>(
    () => (propClasses && propClasses.length > 0 ? Promise.resolve(propClasses) : classService.getClasses(teacherId)),
    ['class']
  );

  const topics = rawTopics ?? [];
  const videos = rawVideos ?? [];
  const theories = rawTheories ?? [];
  const quizzes = rawQuizzes ?? [];
  const questions = rawQuestions ?? {};
  const classes = rawClasses ?? [];

  // 2. Mục đang được chọn để chỉnh sửa bên phải
  const [selectedItem, setSelectedItem] = useState<SelectedContentItem | null>(null);

  // Mặc định chọn video đầu tiên nếu chưa chọn mục nào
  useEffect(() => {
    if (!selectedItem && videos.length > 0) {
      setSelectedItem({ type: 'video', id: videos[0].id });
    }
  }, [videos.length, selectedItem]);

  // 3. Quản lý các Modal
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  // Tab mở đầu của QuizBuilder: 'settings' khi vừa tạo Bài tập mới (Cài đặt trước)
  const [quizInitialTab, setQuizInitialTab] = useState<'questions' | 'settings'>('questions');
  // Thứ tự luồng hiển thị tức thời theo chủ đề (kéo–thả trên dải) trước khi dữ liệu kịp nạp lại
  const [localFlow, setLocalFlow] = useState<Record<string, string[]>>({});
  const [topicToDelete, setTopicToDelete] = useState<{ id: string; warn: string } | null>(null);
  // Bài gốc (video/lý thuyết) vừa rời khỏi để vào trình tạo bài tập liên kết —
  // nút "Quay lại" trong trình tạo bài tập phải trở về đúng bài này.
  const [quizReturnTo, setQuizReturnTo] = useState<SelectedContentItem | null>(null);
  const [isTopicAddMenuOpen, setIsTopicAddMenuOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicWithMeta | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalTarget, setAiModalTarget] = useState('bài giảng');

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<{
    id: string;
    type: 'topic' | 'video' | 'theory' | 'quiz';
    title: string;
    classIds: string[];
    version: number;
    hasStudentAttempts: boolean;
    warnings: string[];
  } | null>(null);

  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    type: 'video' | 'theory' | 'quiz';
    video?: VideoLessonWithMeta | null;
    theory?: TheoryLessonWithMeta | null;
    quiz?: QuizWithMeta | null;
    quizQuestions?: QuestionWithMeta[];
  }>({
    isOpen: false,
    type: 'video',
  });

  // Dropdown "+ Tạo mới"
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);

  // ==========================================
  // THAO TÁC TRÊN CHỦ ĐỀ (TOPIC)
  // ==========================================

  const handleOpenCreateTopic = () => {
    setEditingTopic(null);
    setIsTopicModalOpen(true);
  };

  const handleEditTopic = (topic: TopicWithMeta) => {
    setEditingTopic(topic);
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = async (topicData: Partial<TopicWithMeta>) => {
    const isCreating = !topicData.id;
    const saved = await contentService.saveTopic({
      ...topicData,
      class_ids: topicData.class_ids || ['all', 'class_7a2'],
    });
    // VỪA TẠO CHỦ ĐỀ MỚI: chủ đề TRỐNG (không tự sinh video nháp như trước —
    // theo yêu cầu chủ dự án 22/10). Chỉ chọn chủ đề vừa tạo; giáo viên bấm
    // "Thêm vào chủ đề" / nút + trên dải luồng để tạo bài đầu tiên.
    if (isCreating && saved?.id) {
      setSelectedItem({ type: 'topic', id: saved.id });
    }
  };

  // Tạo 1 bản nháp video trong chủ đề chỉ định, gắn vào chủ đề và mở trình soạn
  const createVideoDraftInTopic = async (targetTopicId: string, topicOverride?: TopicWithMeta) => {
    const newVid = await contentService.saveVideoLesson({
      topicId: targetTopicId,
      title: 'Bài giảng Video mới',
      durationSec: 600,
      subtopics: [],
      summaryPoints: [{ title: 'Khái niệm trọng tâm', content: '', example: '' }],
      practiceQuizId: '',
      quickTestId: '',
      masteryCheckId: '',
      status: 'draft',
      class_ids: ['all', 'class_7a2'],
    });
    // Tự động gắn vào topic một cách an toàn
    const topic = topicOverride || topics.find((t) => t.id === targetTopicId);
    if (topic) {
      const currentVideoIds = Array.isArray(topic.videoIds) ? topic.videoIds : [];
      if (!currentVideoIds.includes(newVid.id)) {
        await contentService.saveTopic({
          ...topic,
          videoIds: [...currentVideoIds, newVid.id],
          flowOrder: [
            ...(Array.isArray(topic.flowOrder) ? topic.flowOrder : []),
            flowKeyOf('video', newVid.id),
          ],
        });
      }
    }
    setSelectedItem({ type: 'video', id: newVid.id });
    return newVid;
  };

  const handleDeleteTopic = async (topicId: string) => {
    const childCount =
      videos.filter((v) => v.topicId === topicId).length +
      theories.filter((th) => th.topicId === topicId).length +
      quizzes.filter((q) => q.topicId === topicId).length;
    const warn =
      childCount > 0
        ? `Chủ đề này đang có ${childCount} bài học/bài tập liên quan — chúng sẽ bị gỡ khỏi chủ đề khi xóa. `
        : '';
    setTopicToDelete({ id: topicId, warn });
  };

  const confirmDeleteTopic = async () => {
    if (!topicToDelete) return;
    await contentService.deleteTopic(topicToDelete.id, teacherId);
    if (selectedItem?.id === topicToDelete.id) {
      setSelectedItem(null);
    }
    setTopicToDelete(null);
  };

  // Kéo-thả đổi thứ tự: sidebar trả về danh sách id đã sắp xếp lại
  const handleReorderTopics = async (orderedIds: string[]) => {
    await contentService.reorderTopics(orderedIds);
  };

  // ==========================================
  // THAO TÁC TRÊN ITEM (VIDEO / LÝ THUYẾT / QUIZ)
  // ==========================================

  const handleDuplicateItem = async (type: ContentItemType, id: string) => {
    if (type === 'quiz') {
      const cloned = await quizService.duplicateQuiz(id, teacherId);
      setSelectedItem({ type: 'quiz', id: cloned.id });
    } else {
      const cloned = await contentService.duplicateContent(type as any, id, teacherId);
      setSelectedItem({ type, id: cloned.id });
    }
  };

  const handleDeleteItem = async (type: ContentItemType, id: string) => {
    const ownerTopicId =
      type === 'video'
        ? videos.find((v) => v.id === id)?.topicId
        : type === 'theory'
          ? theories.find((th) => th.id === id)?.topicId
          : quizzes.find((q) => q.id === id)?.topicId;
    if (type === 'video') {
      await contentService.deleteVideoLesson(id, teacherId);
    } else if (type === 'theory') {
      await contentService.deleteTheoryLesson(id, teacherId);
    } else if (type === 'quiz') {
      await quizService.deleteQuiz(id, teacherId);
    }
    // Gỡ mục khỏi thứ tự luồng của chủ đề chứa nó
    const ownerTopic = ownerTopicId ? topics.find((t) => t.id === ownerTopicId) : null;
    if (ownerTopic && Array.isArray(ownerTopic.flowOrder)) {
      const key = flowKeyOf(type as FlowItemType, id);
      if (ownerTopic.flowOrder.includes(key)) {
        await contentService.saveTopic({
          ...ownerTopic,
          flowOrder: ownerTopic.flowOrder.filter((k) => k !== key),
        });
      }
    }
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  // Gắn một mục mới vào CUỐI thứ tự luồng của chủ đề chứa nó
  const appendToFlowOrder = async (topicId: string, type: FlowItemType, itemId: string) => {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    const key = flowKeyOf(type, itemId);
    const current = Array.isArray(topic.flowOrder) ? topic.flowOrder : [];
    if (current.includes(key)) return;
    await contentService.saveTopic({ ...topic, flowOrder: [...current, key] });
  };

  // Tạo mới thủ công từng loại. Menu đã hợp nhất còn 3 mục (Video / Lý thuyết /
  // Bài tập): 'quiz' = tạo Bài tập mặc định dạng Luyện tập — loại cụ thể đổi
  // trong màn Cài đặt bài của QuizBuilder (mở trước khi tạo mới).
  const handleCreateNewManual = async (
    rawType:
      | 'video'
      | 'theory'
      | 'quiz'
      | 'practice'
      | 'quick'
      | 'mastery'
      | 'reading'
      | 'final'
      | 'homework',
    topicIdOverride?: string
  ) => {
    const type = rawType === 'quiz' ? 'practice' : rawType;
    setIsCreateDropdownOpen(false);
    if (topics.length === 0) {
      alert('Thầy/Cô vui lòng tạo Chủ đề trước khi tạo bài giảng hoặc câu hỏi nhé!');
      setIsTopicModalOpen(true);
      return;
    }
    // Ưu tiên chủ đề được chỉ định (từ cây/dải luồng), rồi chủ đề đang chọn,
    // cuối cùng là chủ đề đầu tiên
    const targetTopicId =
      topicIdOverride ||
      (selectedItem?.type === 'topic' ? selectedItem.id : '') ||
      topics[0]?.id ||
      '';

    try {
      if (type === 'video') {
        await createVideoDraftInTopic(targetTopicId);
      } else if (type === 'theory') {
        const newTheory = await contentService.saveTheoryLesson({
          topicId: targetTopicId,
          title: 'Bài Lý thuyết mới',
          minReadSeconds: 25,
          kind: 'general_topic',
          sections: [],
          blocks: [
            { id: 'b_1', type: 'heading', level: 2, content: '1. Khái niệm và nhận diện' },
            { id: 'b_2', type: 'paragraph', content: 'Gõ nội dung lý thuyết tại đây...' },
          ],
          practiceQuizId: '',
          testQuizId: '',
          status: 'draft',
          class_ids: ['all', 'class_7a2'],
        });
        await appendToFlowOrder(targetTopicId, 'theory', newTheory.id);
        setSelectedItem({ type: 'theory', id: newTheory.id });
      } else {
        // Quiz
        const newQ = await quizService.saveQuestion({
          type: 'single',
          level: 'THONG_HIEU',
          difficulty: 'TB',
          prompt: 'Đề bài câu hỏi số 1...',
          topicId: targetTopicId,
          options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
          answer: 'Lựa chọn A',
          explanation: '',
          status: 'draft',
          class_ids: ['all', 'class_7a2'],
        });

        const newQuiz = await quizService.saveQuiz({
          title:
            type === 'homework'
              ? 'Bài tập về nhà mới (+20 XP)'
              : type === 'quick'
              ? 'Kiểm tra nhanh mới (5 câu / 7 phút)'
              : type === 'mastery'
              ? 'Mastery Check mới (10 câu / 15 phút)'
              : 'Bài luyện tập mới',
          kind: type as any,
          topicId: targetTopicId,
          timeLimitMinutes: type === 'quick' ? 7 : type === 'mastery' ? 15 : 20,
          xp: type === 'homework' ? 20 : 15,
          questionIds: [newQ.id],
          status: 'draft',
          class_ids: ['all', 'class_7a2'],
        });
        await appendToFlowOrder(targetTopicId, 'quiz', newQuiz.id);
        // Tạo Bài tập mới → QuizBuilder mở thẳng màn CÀI ĐẶT BÀI trước
        setQuizInitialTab('settings');
        setSelectedItem({ type: 'quiz', id: newQuiz.id });
      }
    } catch (err) {
      console.error('Lỗi khi tạo mới nội dung:', err);
      alert('Không thể tạo nội dung mới lúc này. Vui lòng thử lại!');
    }
  };

  // Tạo liên kết quiz từ editor video hoặc lý thuyết:
  // quiz thuộc CHỦ ĐỀ của bài đang sửa (không phải chủ đề đầu tiên) và
  // id của nó được GHI NGƯỢC vào trường liên kết của bài gốc,
  // nếu không luồng học của học sinh sẽ không bao giờ chạy tới quiz này.
  const handleCreateLinkedQuiz = async (kind: 'practice' | 'quick' | 'mastery') => {
    const sourceVideo =
      selectedItem?.type === 'video' ? videos.find((v) => v.id === selectedItem.id) : null;
    const sourceTheory =
      selectedItem?.type === 'theory' ? theories.find((th) => th.id === selectedItem.id) : null;
    const source = sourceVideo || sourceTheory;
    const targetTopicId = source?.topicId || topics[0]?.id || 'topic_tho_bon_nam';
    const newQuiz = await quizService.saveQuiz({
      title: `${kind === 'practice' ? 'Luyện tập' : kind === 'quick' ? 'Kiểm tra nhanh' : 'Mastery Check'} mới`,
      kind,
      topicId: targetTopicId,
      timeLimitMinutes: kind === 'quick' ? 7 : kind === 'mastery' ? 15 : undefined,
      xp: kind === 'mastery' ? 20 : 10,
      questionIds: [],
      status: 'draft',
      class_ids: ['all', 'class_7a2'],
    });

    try {
      if (sourceVideo) {
        const field =
          kind === 'practice'
            ? 'practiceQuizId'
            : kind === 'quick'
              ? 'quickTestId'
              : 'masteryCheckId';
        await contentService.saveVideoLesson({ ...sourceVideo, [field]: newQuiz.id } as any);
      } else if (sourceTheory) {
        const field = kind === 'practice' ? 'practiceQuizId' : 'testQuizId';
        await contentService.saveTheoryLesson({ ...sourceTheory, [field]: newQuiz.id } as any);
      }
    } catch (err) {
      console.error('Lỗi ghi liên kết quiz vào bài gốc:', err);
    }

    // Ghi nhớ bài gốc để nút Quay lại trong trình tạo bài tập trở về đúng bài đó
    if (sourceVideo) setQuizReturnTo({ type: 'video', id: sourceVideo.id });
    else if (sourceTheory) setQuizReturnTo({ type: 'theory', id: sourceTheory.id });
    setSelectedItem({ type: 'quiz', id: newQuiz.id });
  };

  // Mở modal tạo với AI (Mầm AI Studio style)
  const [aiInitialType, setAiInitialType] = useState<'video' | 'theory' | 'quiz'>('quiz');
  const handleOpenAiModal = (target: string) => {
    setIsCreateDropdownOpen(false);
    setAiModalTarget(target);
    if (target.includes('video')) setAiInitialType('video');
    else if (target.includes('thuyết')) setAiInitialType('theory');
    else setAiInitialType('quiz');
    setIsAiModalOpen(true);
  };

  // Áp dụng bản nháp từ AI đưa thẳng vào trình soạn thảo thủ công
  const handleApplyAiDraft = async (payload: { type: 'video' | 'theory' | 'quiz'; data: any }) => {
    const targetTopicId = topics[0]?.id || 'topic_tho_bon_nam';
    if (payload.type === 'video') {
      const saved = await contentService.saveVideoLesson({
        ...payload.data,
        topicId: targetTopicId,
        status: 'draft',
        class_ids: ['all', 'class_7a2'],
      });
      setSelectedItem({ type: 'video', id: saved.id });
    } else if (payload.type === 'theory') {
      const saved = await contentService.saveTheoryLesson({
        ...payload.data,
        topicId: targetTopicId,
        status: 'draft',
        class_ids: ['all', 'class_7a2'],
      });
      setSelectedItem({ type: 'theory', id: saved.id });
    } else {
      const qs = payload.data.questions || [];
      const savedQIds: string[] = [];
      for (const q of qs) {
        const savedQ = await quizService.saveQuestion({
          ...q,
          topicId: targetTopicId,
          status: 'draft',
          class_ids: ['all', 'class_7a2'],
        });
        savedQIds.push(savedQ.id);
      }
      const savedQuiz = await quizService.saveQuiz({
        title: payload.data.title,
        kind: payload.data.kind || 'quick',
        topicId: targetTopicId,
        timeLimitMinutes: payload.data.timeLimitMinutes,
        xp: payload.data.xp,
        questionIds: savedQIds,
        status: 'draft',
        class_ids: ['all', 'class_7a2'],
      });
      setSelectedItem({ type: 'quiz', id: savedQuiz.id });
    }
  };

  // ==========================================
  // XUẤT BẢN ("CẬP NHẬT LÊN WEB HỌC SINH")
  // ==========================================

  const handleOpenPublishModalForCurrent = async () => {
    if (!selectedItem) return;

    if (selectedItem.type === 'video') {
      const v = videos.find((item) => item.id === selectedItem.id);
      if (!v) return;
      const warnings: string[] = [];
      if (!v.practiceQuizId) warnings.push('Video này chưa gắn bài luyện tập đi kèm.');
      setPublishTarget({
        id: v.id,
        type: 'video',
        title: v.title,
        classIds: v.class_ids || ['all'],
        version: v.version || 1,
        hasStudentAttempts: false,
        warnings,
      });
      setIsPublishModalOpen(true);
    } else if (selectedItem.type === 'theory') {
      const th = theories.find((item) => item.id === selectedItem.id);
      if (!th) return;
      setPublishTarget({
        id: th.id,
        type: 'theory',
        title: th.title,
        classIds: th.class_ids || ['all'],
        version: th.version || 1,
        hasStudentAttempts: false,
        warnings: [],
      });
      setIsPublishModalOpen(true);
    } else if (selectedItem.type === 'quiz') {
      const q = quizzes.find((item) => item.id === selectedItem.id);
      if (!q) return;
      const hasAttempts = await quizService.hasStudentAttempts(q.id);
      const warnings: string[] = [];
      if (q.questionIds.length < 3) warnings.push('Bài kiểm tra có ít hơn 3 câu hỏi.');

      setPublishTarget({
        id: q.id,
        type: 'quiz',
        title: q.title,
        classIds: q.class_ids || ['all'],
        version: q.version || 1,
        hasStudentAttempts: hasAttempts,
        warnings,
      });
      setIsPublishModalOpen(true);
    }
  };

  const handleConfirmPublish = async (options: { classIds: string[]; notifyStudent: boolean }) => {
    if (!publishTarget) return;

    if (publishTarget.type === 'quiz') {
      await quizService.publishQuiz(publishTarget.id, options, teacherId);
    } else {
      await contentService.publishContent(publishTarget.type, publishTarget.id, options, teacherId);
    }
  };

  // ==========================================
  // XEM TRƯỚC NHƯ HỌC SINH
  // ==========================================

  const handlePreviewStudent = (
    type: 'video' | 'theory' | 'quiz',
    draftQuiz?: QuizWithMeta,
    draftQuestions?: QuestionWithMeta[]
  ) => {
    if (type === 'video') {
      const v = videos.find((item) => item.id === selectedItem?.id);
      setPreviewModal({
        isOpen: true,
        type: 'video',
        video: v,
      });
    } else if (type === 'theory') {
      const th = theories.find((item) => item.id === selectedItem?.id);
      setPreviewModal({
        isOpen: true,
        type: 'theory',
        theory: th,
      });
    } else if (type === 'quiz') {
      const q = draftQuiz || quizzes.find((item) => item.id === selectedItem?.id);
      const qList =
        draftQuestions ||
        (q ? (q.questionIds.map((id) => questions[id]).filter(Boolean) as QuestionWithMeta[]) : []);
      setPreviewModal({
        isOpen: true,
        type: 'quiz',
        quiz: q,
        quizQuestions: qList,
      });
    }
  };

  // Xác định mục đang chọn để render editor tương ứng
  const currentVideo =
    selectedItem?.type === 'video' ? videos.find((v) => v.id === selectedItem.id) : null;
  const currentTheory =
    selectedItem?.type === 'theory' ? theories.find((th) => th.id === selectedItem.id) : null;
  const currentQuiz =
    selectedItem?.type === 'quiz' ? quizzes.find((q) => q.id === selectedItem.id) : null;
  const currentTopic =
    selectedItem?.type === 'topic' ? topics.find((t) => t.id === selectedItem.id) : null;

  // ===== DẢI LUỒNG HỌC: chủ đề của mục đang mở + các bài theo đúng thứ tự =====
  const stripTopic =
    currentTopic ||
    (currentVideo ? topics.find((t) => t.id === currentVideo.topicId) : null) ||
    (currentTheory ? topics.find((t) => t.id === currentTheory.topicId) : null) ||
    (currentQuiz ? topics.find((t) => t.id === currentQuiz.topicId) : null) ||
    null;
  const stripItems = stripTopic
    ? deriveFlowItems(
        localFlow[stripTopic.id] ?? stripTopic.flowOrder,
        [
          ...(stripTopic.videoIds || []).filter((id) => videos.some((v) => v.id === id)),
          ...videos
            .filter((v) => v.topicId === stripTopic.id && !(stripTopic.videoIds || []).includes(v.id))
            .map((v) => v.id),
        ],
        theories.filter((th) => th.topicId === stripTopic.id).map((th) => th.id),
        quizzes.filter((q) => q.topicId === stripTopic.id).map((q) => q.id)
      ).map((item) => {
        const src =
          item.type === 'video'
            ? videos.find((v) => v.id === item.id)
            : item.type === 'theory'
              ? theories.find((th) => th.id === item.id)
              : quizzes.find((q) => q.id === item.id);
        return {
          key: flowKeyOf(item.type, item.id),
          type: item.type,
          id: item.id,
          title: (src as any)?.title || 'Bài học',
          status: (src as any)?.status as string | undefined,
        };
      })
    : [];
  const activeFlowKey =
    selectedItem && selectedItem.type !== 'topic'
      ? flowKeyOf(selectedItem.type as FlowItemType, selectedItem.id)
      : null;

  const handleFlowReorder = async (keys: string[]) => {
    if (!stripTopic) return;
    setLocalFlow((prev) => ({ ...prev, [stripTopic.id]: keys }));
    await contentService.saveTopic({ ...stripTopic, flowOrder: keys });
  };

  // Dọn bản thứ tự tạm khi dữ liệu nạp lại đã khớp
  useEffect(() => {
    setLocalFlow((prev) => {
      const ids = Object.keys(prev);
      if (!ids.length) return prev;
      const next = { ...prev };
      let changed = false;
      for (const id of ids) {
        const t = topics.find((x) => x.id === id);
        if (t && (t.flowOrder || []).join('|') === prev[id].join('|')) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [topics]);

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 w-full max-w-full min-w-0">
      {/* Page Header with Main "+ Tạo mới" Dropdown */}
      <PageHeader
        title="Nội dung học"
        subtitle="Quản lý chuyên đề, bài giảng video, lý thuyết tóm tắt và ngân hàng đề luyện tập"
        actions={
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCreateDropdownOpen((prev) => !prev)}
              className="px-4 py-2.5 rounded-2xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo mới</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* Menu Dropdown: Video, Lý thuyết, Bài luyện tập, Bài kiểm tra, BTVN */}
            {isCreateDropdownOpen && (
              <>
              {/* Lớp phủ trong suốt: bấm ra ngoài là đóng menu */}
              <div
                className="fixed inset-0 z-20"
                onClick={() => setIsCreateDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl shadow-xl z-30 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                {/* 1. Video */}
                <div className="p-2 rounded-xl hover:bg-[#FAF5EB] transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Video className="w-3.5 h-3.5 text-[#E2704A]" />
                    <span className="text-xs font-bold text-[#2F3E6B]">Bài giảng Video</span>
                  </div>
                  <div className="flex items-center gap-2 pl-5">
                    <button
                      type="button"
                      onClick={() => handleCreateNewManual('video')}
                      className="text-[11px] text-[#2F3E6B] hover:text-[#E2704A] hover:underline font-medium"
                    >
                      • Tạo thủ công
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAiModal('Video bài giảng')}
                      className="text-[11px] text-[#4F46E5] hover:underline font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Tạo với AI (sắp có)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Lý thuyết */}
                <div className="p-2 rounded-xl hover:bg-[#FAF5EB] transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span className="text-xs font-bold text-[#2F3E6B]">Lý thuyết</span>
                  </div>
                  <div className="flex items-center gap-2 pl-5">
                    <button
                      type="button"
                      onClick={() => handleCreateNewManual('theory')}
                      className="text-[11px] text-[#2F3E6B] hover:text-[#7C3AED] hover:underline font-medium"
                    >
                      • Tạo thủ công
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAiModal('Lý thuyết')}
                      className="text-[11px] text-[#4F46E5] hover:underline font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Tạo với AI (sắp có)</span>
                    </button>
                  </div>
                </div>

                {/* 3. Bài tập (hợp nhất: loại cụ thể chọn trong Cài đặt bài) */}
                <div className="p-2 rounded-xl hover:bg-[#FAF5EB] transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <FileQuestion className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span className="text-xs font-bold text-[#2F3E6B]">Bài tập</span>
                  </div>
                  <div className="flex items-center gap-2 pl-5">
                    <button
                      type="button"
                      onClick={() => handleCreateNewManual('quiz')}
                      className="text-[11px] text-[#2F3E6B] hover:text-[#0D9488] hover:underline font-medium"
                    >
                      • Tạo thủ công
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAiModal('Bài tập')}
                      className="text-[11px] text-[#4F46E5] hover:underline font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Tạo với AI (sắp có)</span>
                    </button>
                  </div>
                </div>

              </div>
              </>
            )}
          </div>
        }
      />

      {/* Main Two-Pane Area: Left (Topic Tree) + Right (Editor) */}
      <div className="flex flex-col md:flex-row gap-0 items-stretch flex-1 min-h-0 w-full max-w-full min-w-0 overflow-hidden">
        {/* Left Pane: Topic Tree Sidebar */}
        <TopicTreeSidebar
          topics={topics}
          videos={videos}
          theories={theories}
          quizzes={quizzes}
          selectedItem={selectedItem}
          onSelectItem={(item) => {
            setQuizReturnTo(null);
            if (item.type === 'quiz') setQuizInitialTab('questions');
            setSelectedItem(item);
          }}
          onCreateItemInTopic={(topicId, kind) => handleCreateNewManual(kind, topicId)}
          onOpenCreateTopic={handleOpenCreateTopic}
          onAddAssignment={() => setIsAssignmentModalOpen(true)}
          onEditTopic={handleEditTopic}
          onDeleteTopic={handleDeleteTopic}
          onReorderTopics={handleReorderTopics}
          onDuplicateItem={handleDuplicateItem}
          onDeleteItem={handleDeleteItem}
        />

        {/* Right Pane: dải luồng học + Selected Item Editor */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {stripTopic && (
            <TopicFlowStrip
              topicTitle={stripTopic.title}
              items={stripItems}
              activeKey={activeFlowKey}
              onSelect={(item) => {
                if (item.type === 'quiz') setQuizInitialTab('questions');
                setSelectedItem({ type: item.type, id: item.id });
              }}
              onAdd={(kind) => handleCreateNewManual(kind, stripTopic.id)}
              onReorder={handleFlowReorder}
            />
          )}
        {currentVideo ? (
          <VideoLessonEditor
            video={currentVideo}
            topics={topics}
            quizzes={quizzes}
            onSave={async (updated) => {
              await contentService.saveVideoLesson(updated);
            }}
            onPublish={handleOpenPublishModalForCurrent}
            onPreviewStudent={() => handlePreviewStudent('video')}
            onCreateLinkedQuiz={handleCreateLinkedQuiz}
            onBack={() => setSelectedItem({ type: 'topic', id: currentVideo.topicId })}
          />
        ) : currentTheory ? (
          <TheoryLessonEditor
            theory={currentTheory}
            topics={topics}
            quizzes={quizzes}
            onSave={async (updated) => {
              await contentService.saveTheoryLesson(updated);
            }}
            onPublish={handleOpenPublishModalForCurrent}
            onPreviewStudent={() => handlePreviewStudent('theory')}
            onCreateLinkedQuiz={handleCreateLinkedQuiz}
            onBack={() => setSelectedItem({ type: 'topic', id: currentTheory.topicId })}
          />
        ) : currentQuiz ? (
          <QuizBuilder
            key={currentQuiz.id}
            initialTab={quizInitialTab}
            quiz={currentQuiz}
            allQuestions={questions}
            topics={topics}
            classes={classes}
            onSaveQuiz={async (updatedQuiz, updatedQuestions) => {
              for (const q of updatedQuestions) {
                await quizService.saveQuestion(q);
              }
              await quizService.saveQuiz(updatedQuiz);
            }}
            onPublish={(warnings, isBlocked) => {
              if (isBlocked) {
                alert('Vui lòng sửa các lỗi nghiêm trọng được cảnh báo trước khi xuất bản!');
                return;
              }
              handleOpenPublishModalForCurrent();
            }}
            onPreviewStudent={(draftQuiz, draftQuestions) =>
              handlePreviewStudent('quiz', draftQuiz, draftQuestions)
            }
            onBack={() => {
              if (quizReturnTo) {
                setSelectedItem(quizReturnTo);
                setQuizReturnTo(null);
              } else {
                setSelectedItem({ type: 'topic', id: currentQuiz.topicId });
              }
            }}
          />
        ) : currentTopic ? (
          /* Khối thông tin chi tiết của chủ đề đang chọn */
          <div
            className="flex-1 min-h-0 overflow-y-auto p-8 rounded-2xl md:rounded-l-none border shadow-xs flex flex-col items-center justify-center text-center space-y-4"
            style={{
              backgroundColor: `${currentTopic.colorScheme || '#2F3E6B'}0F`,
              borderColor: `${currentTopic.colorScheme || '#2F3E6B'}59`,
            }}
          >
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-md text-white font-lora font-bold text-2xl"
              style={{ backgroundColor: currentTopic.colorScheme || '#2F3E6B' }}
            >
              {currentTopic.title.slice(0, 1)}
            </div>
            <div className="max-w-md space-y-1">
              {currentTopic.tag && currentTopic.tag.trim() !== '' && currentTopic.tag.trim() !== 'Ngữ văn 7' && (
                <span className="text-xs font-bold text-[#E2704A]">{currentTopic.tag}</span>
              )}
              <h3 className="font-lora font-bold text-3xl text-[#2F3E6B]">
                {currentTopic.title}
              </h3>
              <p className="text-xs text-[#8C7E6A] leading-relaxed">
                {currentTopic.shortDesc}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleEditTopic(currentTopic)}
                className="px-4 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-xs font-bold text-[#2F3E6B]"
              >
                Chỉnh sửa chủ đề
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTopicAddMenuOpen((prev) => !prev)}
                  className="px-4 py-2 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm vào chủ đề</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {isTopicAddMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsTopicAddMenuOpen(false)}
                    />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl shadow-xl z-30 p-2 space-y-1 text-left">
                      {[
                        { type: 'video' as const, label: 'Bài giảng Video', icon: Video, color: 'text-[#E2704A]', hover: 'hover:text-[#E2704A]', ai: 'Video bài giảng' },
                        { type: 'theory' as const, label: 'Lý thuyết', icon: BookOpen, color: 'text-[#7C3AED]', hover: 'hover:text-[#7C3AED]', ai: 'Lý thuyết' },
                        { type: 'quiz' as const, label: 'Bài tập', icon: FileQuestion, color: 'text-[#0D9488]', hover: 'hover:text-[#0D9488]', ai: 'Bài tập' },
                      ].map((row) => (
                        <div key={row.type} className="p-2 rounded-xl hover:bg-[#FAF5EB] transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <row.icon className={`w-3.5 h-3.5 ${row.color}`} />
                            <span className="text-xs font-bold text-[#2F3E6B]">{row.label}</span>
                          </div>
                          <div className="flex items-center gap-2 pl-5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsTopicAddMenuOpen(false);
                                handleCreateNewManual(row.type);
                              }}
                              className={`text-[11px] text-[#2F3E6B] ${row.hover} hover:underline font-medium`}
                            >
                              • Tạo thủ công
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsTopicAddMenuOpen(false);
                                handleOpenAiModal(row.ai);
                              }}
                              className="text-[11px] text-[#4F46E5] hover:underline font-bold flex items-center gap-1"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Tạo với AI (sắp có)</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty State khi chưa chọn mục nào */
          <div className="flex-1 min-h-0 overflow-y-auto p-8 bg-[#FFFDF8] rounded-2xl md:rounded-l-none border border-[#E6DCC8] shadow-xs flex flex-col items-center justify-center text-center space-y-3">
            <MamMuc mood="waiting" size="md" />
            <h4 className="font-lora font-bold text-base text-[#2F3E6B]">
              Chọn một bài giảng hoặc bài tập ở cây bên trái
            </h4>
            <p className="text-xs text-[#8C7E6A] max-w-sm">
              Bạn có thể nhấn vào bất kỳ mục nào trên cây chủ đề để chỉnh sửa, hoặc bấm nút "+ Tạo mới" ở góc trên để thêm bài giảng.
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Modals */}
      {isAssignmentModalOpen && teacher && (
        <AssignmentBuilderModal
          teacher={teacher}
          classes={propClasses || []}
          onClose={() => setIsAssignmentModalOpen(false)}
        />
      )}

      <TopicModal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        onSave={handleSaveTopic}
        initialData={editingTopic}
      />

      <AiContentStudioModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        targetTypeInitial={aiInitialType}
        topicId={topics[0]?.id || 'topic_tho_bon_nam'}
        topicTitle={topics[0]?.title || 'Thơ bốn chữ, năm chữ'}
        onApplyDraft={handleApplyAiDraft}
      />

      {publishTarget && (
        <PublishModal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          itemTitle={publishTarget.title}
          itemType={publishTarget.type}
          classes={classes}
          currentClassIds={publishTarget.classIds}
          hasStudentAttempts={publishTarget.hasStudentAttempts}
          currentVersion={publishTarget.version}
          warnings={publishTarget.warnings}
          onConfirmPublish={handleConfirmPublish}
        />
      )}

      <StudentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal((prev) => ({ ...prev, isOpen: false }))}
        previewType={previewModal.type}
        videoData={previewModal.video}
        theoryData={previewModal.theory}
        quizData={previewModal.quiz}
        quizQuestions={previewModal.quizQuestions}
      />

      {/* Hộp thoại xác nhận xóa chủ đề — giữa màn hình */}
      <ConfirmDialog
        isOpen={!!topicToDelete}
        title="Xóa chủ đề"
        message={topicToDelete ? `${topicToDelete.warn}Bạn có chắc chắn muốn xóa chủ đề này?` : ''}
        confirmLabel="Xóa chủ đề"
        variant="danger"
        onConfirm={confirmDeleteTopic}
        onCancel={() => setTopicToDelete(null)}
      />
    </div>
  );
};
