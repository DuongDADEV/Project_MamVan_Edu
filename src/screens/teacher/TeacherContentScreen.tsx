import React, { useState, useEffect, useMemo } from 'react';
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
import { AssignmentEditor } from '../../components/teacher/content/AssignmentEditor.tsx';
import {
  TeacherAssignmentSummary,
  createEmptyAssignment,
  deleteAssignmentCompletely,
  getTeacherAssignments,
} from '../../services/api/biClient.ts';
import { TopicFlowStrip } from '../../components/teacher/content/TopicFlowStrip.tsx';
import {
  FlowItemType,
  deriveFlowItems,
  flowKeyOf,
  flowKeys,
  insertFlowKeyAfter,
} from '../../logic/flowOrder.ts';
import { PublishModal } from '../../components/teacher/content/PublishModal.tsx';
import { AiContentStudioModal } from '../../components/teacher/ai/AiContentStudioModal.tsx';
import { StudentPreviewModal } from '../../components/teacher/content/StudentPreviewModal.tsx';
import {
  Plus,
  Sparkles,
  Play,
  BookOpen,
  PenLine,
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

  // Đợt sửa 24/10: khi mở trình soạn (video/lý thuyết/quiz/bài tập) thì cây trái
  // thu gọn thành rail để vùng soạn chiếm toàn bộ khung phải; thoát soạn thì
  // cây trở lại. Cô vẫn mở lại cây bằng nút trên rail bất cứ lúc nào.
  const editorOpen =
    selectedItem?.type === 'video' ||
    selectedItem?.type === 'theory' ||
    selectedItem?.type === 'quiz' ||
    selectedItem?.type === 'assignment';
  const [treeUserExpanded, setTreeUserExpanded] = useState(false);
  // Thu gọn panel cây bằng nút "Thu gọn" ở tiêu đề panel (24/10 theo yêu cầu
  // chủ dự án): tái dùng đúng rail khi mở trình soạn; bấm mở lại thì cây trở
  // lại đầy đủ. Trạng thái này chỉ sống trong phiên xem trang (không ghi đè
  // persist đóng/mở từng chủ đề theo giáo viên đã có từ đợt 1).
  const [treeManualCollapsed, setTreeManualCollapsed] = useState(false);
  useEffect(() => {
    setTreeUserExpanded(false);
  }, [selectedItem?.id, selectedItem?.type]);
  const treeCollapsed = (editorOpen || treeManualCollapsed) && !treeUserExpanded;

  // Toast lỗi chung cho màn Nội dung (đợt QA 26/10, blocker 8): các thao tác
  // lưu/xóa/sắp xếp/xuất bản trước đây await trần — lỗi chỉ vào console.
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'error' | 'success'>('error');
  const showToast = (msg: string, tone: 'error' | 'success' = 'error') => {
    setToastMessage(msg);
    setToastTone(tone);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Chủ đề ĐANG LÀM VIỆC cho Mầm AI Studio (đợt QA 26/10, blocker 1): trước
  // đây Studio luôn gắn topics[0] bất kể giáo viên đang mở chủ đề nào — nội
  // dung AI sinh ra rơi nhầm chủ đề. Nay: chủ đề đang chọn > chủ đề của bài
  // đang mở > chủ đề đầu tiên.
  const aiTopic = useMemo(() => {
    if (selectedItem?.type === 'topic') {
      return topics.find((t) => t.id === selectedItem.id) || null;
    }
    if (selectedItem?.type === 'video' || selectedItem?.type === 'theory' || selectedItem?.type === 'quiz') {
      const ownerId =
        selectedItem.type === 'video'
          ? videos.find((v) => v.id === selectedItem.id)?.topicId
          : selectedItem.type === 'theory'
            ? theories.find((th) => th.id === selectedItem.id)?.topicId
            : quizzes.find((q) => q.id === selectedItem.id)?.topicId;
      if (ownerId) return topics.find((t) => t.id === ownerId) || null;
    }
    return topics[0] || null;
  }, [selectedItem, topics, videos, theories, quizzes]);

  // Mặc định chọn video đầu tiên nếu chưa chọn mục nào
  useEffect(() => {
    if (!selectedItem && videos.length > 0) {
      setSelectedItem({ type: 'video', id: videos[0].id });
    }
  }, [videos.length, selectedItem]);

  // 3. Quản lý các Modal
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  // Bài tập & đánh giá: các MỤC RIÊNG ngang hàng chủ đề trong cây
  const [assignmentSummaries, setAssignmentSummaries] = useState<TeacherAssignmentSummary[]>([]);
  const loadAssignmentSummaries = async () => {
    if (!teacher?.id) return;
    try {
      setAssignmentSummaries(await getTeacherAssignments(teacher.id));
    } catch (e) {
      console.error('Không tải được danh sách bài tập & đánh giá:', e);
    }
  };
  useEffect(() => {
    loadAssignmentSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher?.id]);

  // Bấm "Thêm bài tập & đánh giá" = tạo NGAY một mục nháp mới ngang hàng chủ
  // đề rồi mở màn soạn bài kiểm tra của mục đó (như thêm chủ đề).
  const handleAddAssignment = async () => {
    if (!teacher?.id) return;
    try {
      const id = await createEmptyAssignment(teacher.id);
      await loadAssignmentSummaries();
      setSelectedItem({ type: 'assignment', id });
    } catch (e) {
      console.error('Không tạo được bài tập & đánh giá:', e);
      alert('Không tạo được bài tập & đánh giá mới. Vui lòng thử lại!');
    }
  };
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

  // (Đã bỏ nút "+ Tạo mới" ở đầu trang theo yêu cầu chủ dự án — tạo bài ngay
  // trong cây / chi tiết chủ đề / dải luồng học.)

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
    let saved;
    try {
      saved = await contentService.saveTopic({
        ...topicData,
        class_ids: topicData.class_ids || ['all', 'class_7a2'],
      });
    } catch (err: any) {
      // Ném lại để TopicModal hiện lỗi tại chỗ và giữ modal mở; toast để lỗi
      // không chìm khi modal đóng.
      showToast(`Lưu chủ đề lỗi: ${err?.message || 'không rõ nguyên nhân'}. Chủ đề chưa được lưu lên máy chủ.`);
      throw err;
    }
    // VỪA TẠO CHỦ ĐỀ MỚI: chủ đề TRỐNG (không tự sinh video nháp như trước —
    // theo yêu cầu chủ dự án 22/10). Chỉ chọn chủ đề vừa tạo; giáo viên bấm
    // "Thêm vào chủ đề" / nút + trên dải luồng để tạo bài đầu tiên.
    if (isCreating && saved?.id) {
      setSelectedItem({ type: 'topic', id: saved.id });
      showToast(`Đã tạo chủ đề “${saved.title || topicData.title || 'mới'}”.`, 'success');
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
    // Tự động gắn vào topic một cách an toàn; vị trí trong luồng: NGAY SAU
    // bài đang mở (neo), không có neo thì vào cuối
    const topic = topicOverride || topics.find((t) => t.id === targetTopicId);
    if (topic) {
      const currentVideoIds = Array.isArray(topic.videoIds) ? topic.videoIds : [];
      if (!currentVideoIds.includes(newVid.id)) {
        try {
          await contentService.saveTopic({
            ...topic,
            videoIds: [...currentVideoIds, newVid.id],
            flowOrder: insertFlowKeyAfter(
              effectiveFlowKeys(topic),
              flowKeyOf('video', newVid.id),
              flowAnchorKeyFor(targetTopicId)
            ),
          });
        } catch (err: any) {
          showToast(`Gắn bài giảng vào chủ đề lỗi: ${err?.message || 'không rõ nguyên nhân'}. Bài giảng đã tạo nhưng chưa gắn vào luồng chủ đề.`);
        }
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
    try {
      await contentService.deleteTopic(topicToDelete.id, teacherId);
    } catch (err: any) {
      showToast(`Xóa chủ đề lỗi: ${err?.message || 'không rõ nguyên nhân'}. Chủ đề chưa được xóa khỏi máy chủ.`);
      return;
    }
    if (selectedItem?.id === topicToDelete.id) {
      setSelectedItem(null);
    }
    setTopicToDelete(null);
  };

  // Kéo-thả đổi thứ tự: sidebar trả về danh sách id đã sắp xếp lại
  const handleReorderTopics = async (orderedIds: string[]) => {
    try {
      await contentService.reorderTopics(orderedIds);
    } catch (err: any) {
      showToast(`Sắp xếp chủ đề lỗi: ${err?.message || 'không rõ nguyên nhân'}. Thứ tự chưa được lưu lên máy chủ.`);
    }
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
    if (type === 'assignment') {
      await deleteAssignmentCompletely(id);
      await loadAssignmentSummaries();
      if (selectedItem?.type === 'assignment' && selectedItem.id === id) setSelectedItem(null);
      return;
    }
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
        try {
          await contentService.saveTopic({
            ...ownerTopic,
            flowOrder: ownerTopic.flowOrder.filter((k) => k !== key),
          });
        } catch (err: any) {
          showToast(`Cập nhật luồng chủ đề sau khi xóa lỗi: ${err?.message || 'không rõ nguyên nhân'}. Mục đã xóa nhưng thứ tự luồng chưa được lưu.`);
        }
      }
    }
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  // Khóa luồng của bài ĐANG MỞ thuộc về chủ đề topicId (neo chèn) — quy tắc
  // của chủ dự án: đang ở vị trí nào bấm Tạo mới thì bài mới nằm NGAY SAU vị
  // trí đó. Bài đang mở thuộc chủ đề khác / đang xem chủ đề → không có neo.
  const flowAnchorKeyFor = (topicId: string): string | null => {
    if (
      !selectedItem ||
      (selectedItem.type !== 'video' &&
        selectedItem.type !== 'theory' &&
        selectedItem.type !== 'quiz')
    ) {
      return null;
    }
    const ownerTopicId =
      selectedItem.type === 'video'
        ? videos.find((v) => v.id === selectedItem.id)?.topicId
        : selectedItem.type === 'theory'
          ? theories.find((th) => th.id === selectedItem.id)?.topicId
          : quizzes.find((q) => q.id === selectedItem.id)?.topicId;
    return ownerTopicId === topicId
      ? flowKeyOf(selectedItem.type as FlowItemType, selectedItem.id)
      : null;
  };

  // Thứ tự luồng HIỆU LỰC hiện tại của một chủ đề (kể cả các bài chưa kịp ghi
  // vào flowOrder đã lưu, vd bài liên kết) — cùng cách suy ra như dải luồng.
  const effectiveFlowKeys = (topic: TopicWithMeta): string[] =>
    flowKeys(
      deriveFlowItems(
        topic.flowOrder,
        [
          ...(topic.videoIds || []).filter((id) => videos.some((v) => v.id === id)),
          ...videos
            .filter((v) => v.topicId === topic.id && !(topic.videoIds || []).includes(v.id))
            .map((v) => v.id),
        ],
        theories.filter((th) => th.topicId === topic.id).map((th) => th.id),
        quizzes.filter((q) => q.topicId === topic.id).map((q) => q.id)
      )
    );

  // Đặt một mục mới vào luồng của chủ đề: NGAY SAU bài đang mở (neo), không
  // có neo thì vào cuối. Ghi lại cả thứ tự hiệu lực để các bài liên kết trước
  // đây chưa được ghi thứ tự cũng chốt luôn vị trí.
  const placeInFlowOrder = async (topicId: string, type: FlowItemType, itemId: string) => {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    const key = flowKeyOf(type, itemId);
    const keys = effectiveFlowKeys(topic);
    if (keys.includes(key)) return;
    try {
      await contentService.saveTopic({
        ...topic,
        flowOrder: insertFlowKeyAfter(keys, key, flowAnchorKeyFor(topicId)),
      });
    } catch (err: any) {
      showToast(`Đặt mục vào luồng lỗi: ${err?.message || 'không rõ nguyên nhân'}. Vị trí luồng chưa được lưu.`);
    }
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
            { id: 'b_2', type: 'paragraph', content: '' },
          ],
          practiceQuizId: '',
          testQuizId: '',
          status: 'draft',
          class_ids: ['all', 'class_7a2'],
        });
        await placeInFlowOrder(targetTopicId, 'theory', newTheory.id);
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
        await placeInFlowOrder(targetTopicId, 'quiz', newQuiz.id);
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
      // Chỉ ghi đúng trường liên kết — KHÔNG spread nguyên bài gốc từ state
      // cha (26/10: state cha có thể còn bản cũ, spread sẽ ghi đè nội dung
      // mới soạn trong editor chưa kịp lưu; merge trong repo giữ lại mọi
      // trường còn lại từ bản đã lưu).
      if (sourceVideo) {
        const field =
          kind === 'practice'
            ? 'practiceQuizId'
            : kind === 'quick'
              ? 'quickTestId'
              : 'masteryCheckId';
        await contentService.saveVideoLesson({ id: sourceVideo.id, [field]: newQuiz.id } as any);
      } else if (sourceTheory) {
        const field = kind === 'practice' ? 'practiceQuizId' : 'testQuizId';
        await contentService.saveTheoryLesson({ id: sourceTheory.id, [field]: newQuiz.id } as any);
      }
    } catch (err) {
      console.error('Lỗi ghi liên kết quiz vào bài gốc:', err);
    }

    // Bài liên kết mới chèn NGAY SAU bài gốc trong luồng học (quy tắc vị trí
    // của chủ dự án) — trước đây nó chỉ hiện ở cuối nhờ thứ tự suy ra tạm.
    try {
      await placeInFlowOrder(targetTopicId, 'quiz', newQuiz.id);
    } catch (err) {
      console.error('Lỗi đặt bài liên kết vào luồng học:', err);
    }

    // Ghi nhớ bài gốc để nút Quay lại trong trình tạo bài tập trở về đúng bài đó
    if (sourceVideo) setQuizReturnTo({ type: 'video', id: sourceVideo.id });
    else if (sourceTheory) setQuizReturnTo({ type: 'theory', id: sourceTheory.id });
    setSelectedItem({ type: 'quiz', id: newQuiz.id });
  };

  // Mở modal tạo với AI (Mầm AI Studio style)
  const [aiInitialType, setAiInitialType] = useState<'video' | 'theory' | 'quiz'>('quiz');
  const handleOpenAiModal = (target: string) => {
    setAiModalTarget(target);
    if (target.includes('video')) setAiInitialType('video');
    else if (target.includes('thuyết')) setAiInitialType('theory');
    else setAiInitialType('quiz');
    setIsAiModalOpen(true);
  };

  // Áp dụng bản nháp từ AI đưa thẳng vào trình soạn thảo thủ công
  const handleApplyAiDraft = async (payload: { type: 'video' | 'theory' | 'quiz'; data: any }) => {
    const targetTopicId = aiTopic?.id || topics[0]?.id || 'topic_tho_bon_nam';
    try {
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
    } catch (err: any) {
      showToast(`Áp dụng bản nháp AI lỗi: ${err?.message || 'không rõ nguyên nhân'}. Nội dung chưa được lưu.`);
    }
  };

  // ==========================================
  // XUẤT BẢN ("CẬP NHẬT LÊN WEB HỌC SINH")
  // ==========================================

  const handleOpenPublishModalForCurrent = async () => {
    if (!selectedItem) return;

    if (selectedItem.type === 'topic') {
      const t = topics.find((item) => item.id === selectedItem.id);
      if (!t) return;
      const itemCount =
        videos.filter((v) => v.topicId === t.id).length +
        theories.filter((th) => th.topicId === t.id).length +
        quizzes.filter((q) => q.topicId === t.id).length;
      const warnings: string[] = [];
      if (itemCount === 0)
        warnings.push('Chủ đề chưa có bài nào — học sinh sẽ thấy một chủ đề trống.');
      setPublishTarget({
        id: t.id,
        type: 'topic',
        title: t.title,
        classIds: ['all'],
        version: 1,
        hasStudentAttempts: false,
        warnings,
      });
      setIsPublishModalOpen(true);
    } else if (selectedItem.type === 'video') {
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

    try {
      if (publishTarget.type === 'quiz') {
        await quizService.publishQuiz(publishTarget.id, options, teacherId);
      } else {
        await contentService.publishContent(publishTarget.type, publishTarget.id, options, teacherId);
      }
    } catch (err: any) {
      // Ném lại để PublishModal giữ modal mở; toast để lỗi không chìm.
      showToast(`Xuất bản lỗi: ${err?.message || 'không rõ nguyên nhân'}. Nội dung chưa được xuất bản lên máy chủ.`);
      throw err;
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
  const stripTopicFromList =
    currentTopic ||
    (currentVideo ? topics.find((t) => t.id === currentVideo.topicId) : null) ||
    (currentTheory ? topics.find((t) => t.id === currentTheory.topicId) : null) ||
    (currentQuiz ? topics.find((t) => t.id === currentQuiz.topicId) : null) ||
    null;
  // Dự phòng: bài đang mở có topicId nhưng chủ đề đó chưa có trong danh sách
  // của tab này (tab nạp từ trước khi chủ đề được tạo, hoặc lần nạp danh sách
  // bị lỗi thoáng qua) thì lấy thẳng chủ đề theo id — dải luồng học không
  // được phép biến mất chỉ vì danh sách chưa kịp nạp.
  const openItemTopicId =
    currentVideo?.topicId || currentTheory?.topicId || currentQuiz?.topicId || null;
  const [fallbackTopic, setFallbackTopic] = useState<TopicWithMeta | null>(null);
  useEffect(() => {
    if (!openItemTopicId || topics.some((t) => t.id === openItemTopicId)) {
      setFallbackTopic(null);
      return;
    }
    let cancelled = false;
    contentService
      .getTopicById(openItemTopicId)
      .then((t) => {
        if (!cancelled) setFallbackTopic(t);
      })
      .catch(() => {
        if (!cancelled) setFallbackTopic(null);
      });
    return () => {
      cancelled = true;
    };
  }, [openItemTopicId, topics]);
  const stripTopic = stripTopicFromList || fallbackTopic;
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
    try {
      await contentService.saveTopic({ ...stripTopic, flowOrder: keys });
    } catch (err: any) {
      // Giữ thứ tự vừa kéo ở local để giáo viên thấy và thử lại; chỉ báo lỗi.
      showToast(`Lưu thứ tự luồng lỗi: ${err?.message || 'không rõ nguyên nhân'}. Thứ tự chưa được lưu lên máy chủ.`);
    }
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
    <div className="flex flex-col gap-0 flex-1 min-h-0 w-full max-w-full min-w-0">
      {/* gap-0 + PageHeader flush: điểm tiếp giáp tiêu đề -> dải luồng phải
          SÁT 0 theo yêu cầu chủ dự án 25/10 (không còn khe trắng đã khoanh).
          Các con còn lại của cột này đều là modal (fixed/null khi đóng) nên
          gap-0 không ảnh hưởng chúng; khoảng dưới dải (mb-3 của strip) và
          các khoảng khác giữ nguyên. */}
      {/* Page Header — nút "+ Tạo mới" ở đầu trang đã BỎ theo yêu cầu chủ
          dự án: tạo bài ngay trong cây / chi tiết chủ đề / dải luồng học */}
      <PageHeader
        flush
        title="Nội dung học"
        subtitle="Quản lý chuyên đề, bài giảng video, lý thuyết tóm tắt và ngân hàng đề luyện tập"
      />

      {/* Main Two-Pane Area: Left (Topic Tree) + Right (Editor) */}
      <div className="flex flex-col md:flex-row gap-0 items-stretch flex-1 min-h-0 w-full max-w-full min-w-0 overflow-hidden">
        {/* Left Pane: Topic Tree Sidebar */}
        <TopicTreeSidebar
          teacherId={teacherId}
          collapsed={treeCollapsed}
          onExpandTree={() => {
            setTreeUserExpanded(true);
            setTreeManualCollapsed(false);
          }}
          onCollapseTree={() => {
            setTreeManualCollapsed(true);
            setTreeUserExpanded(false);
          }}
          topics={topics}
          videos={videos}
          theories={theories}
          quizzes={quizzes}
          assignments={assignmentSummaries}
          selectedItem={selectedItem}
          onSelectItem={(item) => {
            setQuizReturnTo(null);
            if (item.type === 'quiz') setQuizInitialTab('questions');
            setSelectedItem(item);
          }}
          onCreateItemInTopic={(topicId, kind) => handleCreateNewManual(kind, topicId)}
          onOpenCreateTopic={handleOpenCreateTopic}
          onAddAssignment={handleAddAssignment}
          onEditTopic={handleEditTopic}
          onDeleteTopic={handleDeleteTopic}
          onReorderTopics={handleReorderTopics}
          onDuplicateItem={handleDuplicateItem}
          onDeleteItem={handleDeleteItem}
        />

        {/* Right Pane: dải luồng học TRÊN CÙNG, trên cả hàng công cụ của trình
            soạn (đổi 25/10 theo vạch đen chủ dự án vẽ ở mép trên; 24/10 dải nằm
            dưới trình soạn). Dải render ở shell chung nên mọi trình soạn
            (video/lý thuyết/quiz/bài tập) đều thấy cùng một vị trí; menu
            '+ Thêm bài' (z-50) vẫn phủ lên thanh công cụ sticky (z-20) bên dưới. */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Dải luồng học — TRÊN CÙNG khung phải, trên cả hàng công cụ.
            Đầy đủ chức năng: bấm nút tròn mở đúng bài, kéo-thả đổi thứ tự,
            '+ Thêm bài' mở menu 3 loại. */}
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
        {selectedItem?.type === 'assignment' && teacher ? (
          <AssignmentEditor
            key={selectedItem.id}
            assignmentId={selectedItem.id}
            teacher={teacher}
            classes={classes}
            onChanged={loadAssignmentSummaries}
            onDeleted={() => setSelectedItem(null)}
          />
        ) : currentVideo ? (
          <VideoLessonEditor
            key={currentVideo.id}
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
            key={currentTheory.id}
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
            onPublish={handleOpenPublishModalForCurrent}
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
            className="flex-1 min-h-0 overflow-y-auto p-8 rounded-2xl md:rounded-l-none border shadow-xs flex flex-col items-center justify-start text-center space-y-4"
            style={{
              backgroundColor: `${currentTopic.colorScheme || '#2F3E6B'}26`,
              borderColor: `${currentTopic.colorScheme || '#2F3E6B'}80`,
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
              {/* Xuất bản CHỦ ĐỀ — trước đây thiếu hẳn nút này nên chủ đề mới
                  tạo kẹt ở Bản nháp và học sinh không bao giờ thấy */}
              <button
                type="button"
                onClick={handleOpenPublishModalForCurrent}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                  currentTopic.status === 'published'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-[#2F3E6B] hover:bg-[#28355c] text-white'
                }`}
                title="Xuất bản chủ đề để học sinh nhìn thấy trên web học"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>
                  {currentTopic.status === 'published'
                    ? 'Đã xuất bản — cập nhật lại'
                    : 'Cập nhật lên web học sinh'}
                </span>
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
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl shadow-xl z-30 p-1.5 text-left">
                      {[
                        { type: 'video' as const, label: 'Bài giảng Video', icon: Play, ai: 'Video bài giảng' },
                        { type: 'theory' as const, label: 'Lý thuyết', icon: BookOpen, ai: 'Lý thuyết' },
                        { type: 'quiz' as const, label: 'Bài tập', icon: PenLine, ai: 'Bài tập' },
                      ].map((row) => (
                        <div
                          key={row.type}
                          className="group flex items-center gap-1 rounded-xl hover:bg-[#FAF5EB] transition-colors pr-1"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsTopicAddMenuOpen(false);
                              handleCreateNewManual(row.type);
                            }}
                            className="flex-1 flex items-center gap-2.5 px-2.5 py-2 text-left"
                            title={`Tạo ${row.label} thủ công`}
                          >
                            <row.icon className="w-4 h-4 text-[#E2704A]" />
                            <span className="text-xs font-bold text-[#2F3E6B]">{row.label}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsTopicAddMenuOpen(false);
                              handleOpenAiModal(row.ai);
                            }}
                            className="p-1.5 rounded-lg text-[#4F46E5] hover:bg-[#4F46E5]/10 transition-colors"
                            title={`Tạo ${row.label} với AI`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
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
              Bạn có thể nhấn vào bất kỳ mục nào trên cây chủ đề để chỉnh sửa, hoặc bấm dòng "+ Tạo mới" ngay dưới mỗi chủ đề trên cây để thêm bài giảng.
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Modals */}
      {toastMessage && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] px-4 py-3 rounded-2xl ${toastTone === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white text-sm font-semibold shadow-xl`}>
          {toastMessage}
        </div>
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
        topicId={aiTopic?.id || 'topic_tho_bon_nam'}
        topicTitle={aiTopic?.title || 'Thơ bốn chữ, năm chữ'}
        teacherId={teacherId}
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
