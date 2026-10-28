import React, { useState, useEffect, useRef } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import {
  Sparkles,
  X,
  FileText,
  Upload,
  Video,
  Trash2,
  Send,
  MessageSquare,
  Wand2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
  Sliders,
  Check,
  RefreshCw,
  Quote,
  Eye,
  Lightbulb,
  RotateCcw,
  Link2,
} from 'lucide-react';
import { AISource, aiService } from '../../../services/index.ts';
import {
  getLastAiFallback,
  clearLastAiFallback,
} from '../../../services/ai/index.ts';
import { MamMuc } from '../../MamMuc.tsx';
import { SkillLevel, Difficulty, QuestionType, Question, TheoryBlock } from '../../../types.ts';
import { studioKey } from '../../../logic/teacherScope.ts';
import { extractDocumentText, MAX_EXTRACTED_CHARS } from '../../../logic/extractDocumentText.ts';
import { isValidGeneratedQuestion } from '../../../logic/validateAiQuestions.ts';
import {
  fetchServerFileSources,
  pushFileSource,
  patchFileSourceEnabled,
  deleteFileSource,
} from '../../../services/ai/aiSourcesSync.ts';

interface AiContentStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTypeInitial?: 'video' | 'theory' | 'quiz';
  topicId?: string;
  topicTitle?: string;
  isEmbedded?: boolean;
  autoOpenDraftKind?: 'questions' | 'theory' | null;
  autoOpenDraftNonce?: number;
  // Đợt sửa 24/10: đóng dấu người tạo lên bản nháp để chỉ chính giáo viên
  // tạo ra nó mới được chuyển vào ngân hàng (ngân hàng riêng từng giáo viên).
  teacherId?: string;
  onApplyDraft: (payload: {
    type: 'video' | 'theory' | 'quiz';
    data: any;
  }) => void;
}

/**
 * Component định dạng Markdown và dọn dẹp các mã ID kỹ thuật [src_...] trong câu trả lời của AI
 */
const FormattedChatMessage: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  // 1. Dọn dẹp triệt để các mã kỹ thuật [src_...], [Tài liệu ...] khỏi câu chữ
  const sanitized = text
    .replace(/\s*\[src_[^\]]+\]/g, '')
    .replace(/\s*\[Tài liệu\s+\d+[^\]]*\]/g, '')
    .replace(/\s*\[id\s*:\s*[^\]]+\]/gi, '')
    .trim();

  // Helper phân tích các thẻ in đậm (**), in nghiêng (*), code (`)
  const renderInline = (str: string, keyPrefix: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong
            key={`${keyPrefix}-${i}`}
            className={isUser ? 'font-bold text-white' : 'font-bold text-[#2F3E6B]'}
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={`${keyPrefix}-${i}`}
            className="px-1.5 py-0.5 rounded bg-black/10 text-[11px] font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={`${keyPrefix}-${i}`} className="italic font-medium">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
    });
  };

  const lines = sanitized.split('\n');

  return (
    <div className="space-y-1.5 text-xs">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-1" />;
        }

        // Tiêu đề Markdown: #, ##, ###
        const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const content = headingMatch[2];
          return (
            <div
              key={lineIdx}
              className={`font-bold ${
                isUser ? 'text-white' : 'text-[#2F3E6B]'
              } ${
                level === 1
                  ? 'text-sm mt-3 mb-1'
                  : level === 2
                  ? 'text-xs mt-2.5 mb-1'
                  : 'text-xs mt-2 mb-0.5'
              }`}
            >
              {renderInline(content, `h-${lineIdx}`)}
            </div>
          );
        }

        // Gạch đầu dòng danh sách: * hoặc - hoặc •
        const bulletMatch = line.match(/^(\s*)([*•-])\s+(.+)$/);
        if (bulletMatch) {
          const indentSpaces = bulletMatch[1].length;
          const content = bulletMatch[3];
          const isSubBullet = indentSpaces >= 2;

          return (
            <div
              key={lineIdx}
              className={`flex items-start gap-2 ${
                isSubBullet ? 'pl-4 sm:pl-5 text-[11.5px]' : 'pl-0.5 text-xs'
              }`}
            >
              <span
                className={`shrink-0 select-none mt-1 ${
                  isUser
                    ? 'text-white/80'
                    : isSubBullet
                    ? 'text-[#8C7E6A] text-[9px]'
                    : 'text-[#0D9488] font-bold text-[12px]'
                }`}
              >
                {isSubBullet ? '◦' : '•'}
              </span>
              <div className="flex-1 min-w-0 leading-relaxed">
                {renderInline(content, `b-${lineIdx}`)}
              </div>
            </div>
          );
        }

        // Đoạn văn thông thường
        return (
          <p key={lineIdx} className="leading-relaxed">
            {renderInline(line, `p-${lineIdx}`)}
          </p>
        );
      })}
    </div>
  );
};

export const AiContentStudioModal: React.FC<AiContentStudioModalProps> = ({
  isOpen,
  onClose,
  targetTypeInitial = 'quiz',
  topicId = 'topic_tho_bon_nam',
  topicTitle = 'Thơ bốn chữ, năm chữ',
  isEmbedded = false,
  onApplyDraft,
  autoOpenDraftKind,
  autoOpenDraftNonce,
  teacherId,
}) => {
  // Đợt 25/10: AI chạy qua proxy admin — không còn trạng thái key/model ở đây.


  // 2. STATE NGUỒN TÀI LIỆU (VÙNG TRÁI) - LƯU LOCALSTORAGE THEO GIÁO VIÊN + CHỦ ĐỀ (26/10)
  const sourcesStorageKey = studioKey(teacherId, topicId, 'sources');
  const [sources, setSources] = useState<AISource[]>(() => {
    try {
      const saved = localStorage.getItem(sourcesStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Đã có dữ liệu lưu (kể cả danh sách RỖNG) = GV đã chủ động xóa hết
        // nguồn — phải tôn trọng; chưa có dữ liệu thì bắt đầu TRỐNG (26/10:
        // bài mẫu Cây dừa đã bỏ, không nạp sẵn cho giáo viên mới nữa).
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc nguồn tài liệu từ localStorage:', e);
    }
    return [];
  });

  // Tự động lưu nguồn tài liệu vào localStorage khi thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(sourcesStorageKey, JSON.stringify(sources));
    } catch (e) {
      console.warn('Lỗi lưu nguồn tài liệu vào localStorage:', e);
    }
  }, [sources, sourcesStorageKey]);

  // Cập nhật khi topicId thay đổi
  useEffect(() => {
    try {
      const saved = localStorage.getItem(sourcesStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Như trên: danh sách rỗng đã lưu = GV đã xóa hết — không nạp lại bài mẫu
        if (Array.isArray(parsed)) {
          setSources(parsed);
          return;
        }
      }
      setSources([]);
    } catch (e) {
      console.warn(e);
    }
  }, [topicId]);

  // 28/10: nguồn FILE còn lưu ở database — báo rõ khi đồng bộ lên/xuống máy
  // chủ gặp lỗi (nguồn vẫn dùng được ở trình duyệt này, lần mở sau sẽ thử lại).
  const [dbSyncNotice, setDbSyncNotice] = useState<string | null>(null);
  // Id nguồn file đã đẩy thành công lên máy chủ — để phân biệt "chưa từng
  // đồng bộ" (giữ lại + đẩy bù) với "đã xóa ở nơi khác" (không đẩy lại,
  // tránh hồi sinh nguồn đã xóa như lỗi sync localStorage cũ).
  const syncedFileIdsKey = `${sourcesStorageKey}::synced`;
  const readSyncedFileIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem(syncedFileIdsKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  };
  const markFileSynced = (id: string) => {
    try {
      const ids = readSyncedFileIds();
      ids.add(id);
      localStorage.setItem(syncedFileIdsKey, JSON.stringify([...ids]));
    } catch {
      // Bỏ qua
    }
  };
  const unmarkFileSynced = (id: string) => {
    try {
      const ids = readSyncedFileIds();
      ids.delete(id);
      localStorage.setItem(syncedFileIdsKey, JSON.stringify([...ids]));
    } catch {
      // Bỏ qua
    }
  };
  // Tải nguồn file từ máy chủ về hợp nhất khi mở Studio/đổi chủ đề. Chỉ chạy
  // 1 lần cho mỗi (giáo viên, chủ đề); nguồn dán văn bản/bản ghi không thuộc
  // phạm vi database nên giữ nguyên từ local.
  const serverSourcesLoadedFor = useRef<string>('');
  useEffect(() => {
    if (!teacherId || !topicId) return;
    const key = `${teacherId}::${topicId}`;
    if (serverSourcesLoadedFor.current === key) return;
    serverSourcesLoadedFor.current = key;
    const loadTopicId = topicId;
    const loadKey = sourcesStorageKey;
    fetchServerFileSources(loadTopicId)
      .then(async (server) => {
        if (serverSourcesLoadedFor.current !== `${teacherId}::${loadTopicId}`) return;
        const serverIds = new Set(server.map((s) => s.id));
        const synced = readSyncedFileIds();
        let local: AISource[] = [];
        try {
          const saved = localStorage.getItem(loadKey);
          const parsed = saved ? JSON.parse(saved) : null;
          if (Array.isArray(parsed)) local = parsed;
        } catch {
          // Giữ local rỗng
        }
        const pending = local.filter(
          (s) => s.type === 'file' && !serverIds.has(s.id) && !synced.has(s.id)
        );
        for (const src of pending) {
          try {
            await pushFileSource(loadTopicId, src);
            markFileSynced(src.id);
          } catch {
            // Lần mở sau đẩy lại
          }
        }
        setSources([
          ...local.filter((s) => s.type !== 'file'),
          ...server,
          ...pending,
        ]);
      })
      .catch((e) => {
        console.warn('Không tải được nguồn file từ máy chủ, dùng nguồn ở trình duyệt này:', e);
        setDbSyncNotice(
          'Không tải được nguồn file từ máy chủ — đang dùng nguồn lưu ở trình duyệt này. Kiểm tra mạng rồi mở lại Studio để đồng bộ.'
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, topicId, sourcesStorageKey]);

  const [activeTabSourceInput, setActiveTabSourceInput] = useState<'paste' | 'file' | 'video'>('paste');
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [showAddSourceForm, setShowAddSourceForm] = useState(false);
  const [unsupportedFileNotice, setUnsupportedFileNotice] = useState<string | null>(null);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  // 28/10: AI có lúc trả thiếu câu so với số đã chọn — báo rõ trong màn duyệt
  // thay vì lặng lẽ trình thiếu như thể đủ.
  const [generationShortfall, setGenerationShortfall] = useState<string | null>(null);
  const [previewingSource, setPreviewingSource] = useState<AISource | null>(null);

  // 3. STATE TRÒ CHUYỆN VỚI NGUỒN (VÙNG GIỮA) - LƯU LOCALSTORAGE THEO GIÁO VIÊN + CHỦ ĐỀ (26/10)
  const chatStorageKey = studioKey(teacherId, topicId, 'chat_history');
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; text: string; citations?: { sourceTitle: string; snippet: string }[] }[]
  >(() => {
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc lịch sử chat:', e);
    }
    return [
      {
        role: 'assistant',
        text: 'Xin chào thầy/cô! Tôi là trợ lý Mầm AI. Tôi đã đọc các tài liệu nguồn bên trái. Thầy/cô có thể đặt câu hỏi hoặc chọn các câu hỏi gợi ý bên dưới để tra cứu chi tiết.',
      },
    ];
  });

  // Tự động lưu lịch sử trò chuyện khi thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(chatMessages));
    } catch (e) {
      console.warn('Lỗi ghi lịch sử chat:', e);
    }
  }, [chatMessages, chatStorageKey]);

  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Gợi ý câu hỏi nhanh chuẩn Mầm AI Studio
  const suggestedPrompts = [
    'Tóm tắt các ý chính trong văn bản',
    'Biện pháp tu từ và tác dụng nghệ thuật',
    'Ý nghĩa hình tượng tiếng gà trưa và thông điệp',
    'Gợi ý 4 câu hỏi đọc hiểu 4 mức năng lực',
  ];

  // 4. STATE XƯỞNG TẠO (VÙNG PHẢI)
  const [outputType, setOutputType] = useState<'video' | 'theory' | 'quiz'>(targetTypeInitial);
  // Panel phải (Xưởng tạo) neo cuộn lên đầu mỗi khi đổi loại nội dung — cùng
  // với vùng cấu hình chiều cao cố định, panel không còn nhảy lên/xuống nữa.
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    rightPanelRef.current?.scrollTo({ top: 0 });
  }, [outputType]);

  // STATE XEM TRƯỚC VÀ PHÊ DUYỆT BỘ CÂU HỎI AI VỪA TẠO — đồng thời là BẢN NHÁP:
  // bộ câu AI tạo xong được tự lưu nháp (localStorage theo giáo viên + chủ đề), đóng xưởng
  // rồi quay lại vẫn còn nguyên để duyệt dần, chưa cần đưa vào Ngân hàng vội.
  const draftStorageKey = studioKey(teacherId, topicId, 'question_draft');
  const [reviewDraftQuestions, setReviewDraftQuestions] = useState<Question[] | null>(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
          return parsed.questions;
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc bản nháp câu hỏi AI:', e);
    }
    return null;
  });
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
          const ids = (parsed.questions as Question[]).map((q) => q.id);
          const savedIds = Array.isArray(parsed.selectedIds) ? parsed.selectedIds : ids;
          return savedIds.filter((id: string) => ids.includes(id));
        }
      }
    } catch (e) {
      /* bỏ qua */
    }
    return [];
  });
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
          return parsed.savedAt || null;
        }
      }
    } catch (e) {
      /* bỏ qua */
    }
    return null;
  });
  // Màn duyệt đang mở hay đang ở xưởng (đóng màn duyệt KHÔNG xoá nháp)
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isDiscardDraftOpen, setIsDiscardDraftOpen] = useState(false);

  // Tự lưu nháp mỗi khi bộ câu / lựa chọn thay đổi; rỗng thì xoá nháp
  useEffect(() => {
    try {
      if (reviewDraftQuestions && reviewDraftQuestions.length > 0) {
        const nowIso = new Date().toISOString();
        localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            questions: reviewDraftQuestions,
            selectedIds: selectedDraftIds,
            savedAt: nowIso,
            topicTitle: topicTitle || '',
            teacherId: teacherId || undefined,
            // 28/10: lưu luôn topicId thật — trước đây nháp không có trường
            // này nên Ngân hàng phải đoán topic từ tên khóa localStorage và
            // đoán sai (lấy cả teacherId dính vào), khiến câu đẩy từ nháp
            // vào ngân hàng mang topicId giả.
            topicId: topicId || undefined,
          })
        );
        setDraftSavedAt(nowIso);
      } else {
        localStorage.removeItem(draftStorageKey);
        setDraftSavedAt(null);
      }
    } catch (e) {
      console.warn('Lỗi lưu bản nháp câu hỏi AI:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewDraftQuestions, selectedDraftIds, draftStorageKey]);

  // BẢN NHÁP LÝ THUYẾT: lý thuyết AI tạo xong vào màn DUYỆT trước (đọc hết
  // nội dung rồi mới quyết định lưu), đồng thời tự lưu nháp để quay lại sau.
  const theoryDraftStorageKey = studioKey(teacherId, topicId, 'theory_draft');
  const [reviewTheoryDraft, setReviewTheoryDraft] = useState<{
    title: string;
    blocks: TheoryBlock[];
    isFallback: boolean;
  } | null>(() => {
    try {
      const saved = localStorage.getItem(theoryDraftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.data?.blocks?.length > 0) return parsed.data;
      }
    } catch (e) {
      console.warn('Lỗi đọc bản nháp lý thuyết AI:', e);
    }
    return null;
  });
  const [theoryDraftSavedAt, setTheoryDraftSavedAt] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(theoryDraftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.data?.blocks?.length > 0) return parsed.savedAt || null;
      }
    } catch (e) {
      /* bỏ qua */
    }
    return null;
  });
  const [isTheoryReviewOpen, setIsTheoryReviewOpen] = useState(false);
  const [isDiscardTheoryDraftOpen, setIsDiscardTheoryDraftOpen] = useState(false);

  useEffect(() => {
    try {
      if (reviewTheoryDraft && reviewTheoryDraft.blocks.length > 0) {
        const nowIso = new Date().toISOString();
        localStorage.setItem(
          theoryDraftStorageKey,
          JSON.stringify({
            data: reviewTheoryDraft,
            savedAt: nowIso,
            teacherId: teacherId || undefined,
            topicId: topicId || undefined,
          })
        );
        setTheoryDraftSavedAt(nowIso);
      } else {
        localStorage.removeItem(theoryDraftStorageKey);
        setTheoryDraftSavedAt(null);
      }
    } catch (e) {
      console.warn('Lỗi lưu bản nháp lý thuyết AI:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewTheoryDraft, theoryDraftStorageKey]);

  const handleDiscardTheoryDraft = () => {
    setReviewTheoryDraft(null);
    setIsTheoryReviewOpen(false);
    setIsDiscardTheoryDraftOpen(false);
  };

  const handleApplyTheoryDraft = () => {
    if (!reviewTheoryDraft) return;
    onApplyDraft({
      type: 'theory',
      data: {
        title: reviewTheoryDraft.title,
        kind: 'general_topic',
        minReadSeconds: 180,
        blocks: reviewTheoryDraft.blocks,
        isAiGenerated: true,
        isTeacherReviewed: true,
      },
    });
    // Xóa khóa nháp NGAY tại đây (không trông chờ effect autosave chạy khi
    // modal đóng — đóng modal cùng nhịp state có thể khiến effect xóa khóa
    // không bao giờ chạy, nháp đã duyệt vẫn nằm lại mục Bản nháp).
    try {
      localStorage.removeItem(theoryDraftStorageKey);
    } catch {
      // Bỏ qua
    }
    setReviewTheoryDraft(null);
    setIsTheoryReviewOpen(false);
    onClose();
  };

  // Mở thẳng màn duyệt khi thầy/cô bấm "Duyệt" từ mục Bản nháp ở Ngân hàng
  useEffect(() => {
    if (!autoOpenDraftNonce) return;
    // Nháp mở từ Ngân hàng là nháp đã lưu từ trước, không phải kết quả của
    // lần sinh vừa rồi nên không hiện cảnh báo thiếu câu của lần sinh đó.
    setGenerationShortfall(null);
    if (autoOpenDraftKind === 'questions' && reviewDraftQuestions?.length) {
      setIsReviewOpen(true);
    }
    if (autoOpenDraftKind === 'theory' && reviewTheoryDraft?.blocks?.length) {
      setIsTheoryReviewOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenDraftNonce]);

  const handleDiscardDraft = () => {
    setReviewDraftQuestions(null);
    setSelectedDraftIds([]);
    setIsReviewOpen(false);
    setIsDiscardDraftOpen(false);
  };

  const [typeCounts, setTypeCounts] = useState<{
    single: number;
    multi: number;
    fill: number;
    essay: number;
  }>({
    single: 2,
    multi: 1,
    fill: 1,
    essay: 1,
  });

  // Tổng số câu dự kiến = cộng dồn theo từng loại câu hỏi (theo thiết kế Figma)
  const totalQuestions = typeCounts.single + typeCounts.multi + typeCounts.fill + typeCounts.essay;

  const adjustTypeCount = (key: 'single' | 'multi' | 'fill' | 'essay', delta: number) => {
    setTypeCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(20, prev[key] + delta)),
    }));
  };

  // --- PANEL KÉO/THU (theo ghi chú Figma: kéo ra, thu vào, chỉnh độ rộng) ---
  const [isWide, setIsWide] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [panelWidths, setPanelWidths] = useState<{ left: number; right: number }>(() => {
    try {
      const raw = localStorage.getItem('mamvan_ai_studio_panel_widths');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.left === 'number' && typeof parsed.right === 'number') return parsed;
      }
    } catch {}
    return { left: 330, right: 395 };
  });
  const [collapsedPanels, setCollapsedPanels] = useState<{ left: boolean; right: boolean }>(() => {
    try {
      const raw = localStorage.getItem('mamvan_ai_studio_panel_collapsed');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { left: false, right: false };
  });
  useEffect(() => {
    try { localStorage.setItem('mamvan_ai_studio_panel_widths', JSON.stringify(panelWidths)); } catch {}
  }, [panelWidths]);
  useEffect(() => {
    try { localStorage.setItem('mamvan_ai_studio_panel_collapsed', JSON.stringify(collapsedPanels)); } catch {}
  }, [collapsedPanels]);
  const startPanelResize = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === 'left' ? panelWidths.left : panelWidths.right;
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const next = side === 'left' ? startW + delta : startW - delta;
      const clamped = Math.max(240, Math.min(620, next));
      setPanelWidths((prev) => ({ ...prev, [side]: clamped }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const [difficulty, setDifficulty] = useState<Difficulty>('TB');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');

  if (!isOpen && !isEmbedded) return null;

  // Xử lý thêm nguồn mới
  const handleAddSource = () => {
    if (!newSourceContent.trim()) return;
    const wordCount = newSourceContent.trim().split(/\s+/).filter(Boolean).length;
    const newSrc: AISource = {
      id: 'src_' + Date.now(),
      title: newSourceTitle.trim() || `Tài liệu nguồn #${sources.length + 1}`,
      type: activeTabSourceInput === 'video' ? 'transcript' : 'text',
      content: newSourceContent.trim(),
      wordCount,
      isEnabled: true,
      createdAt: new Date().toISOString(),
    };
    setSources([...sources, newSrc]);
    setNewSourceTitle('');
    setNewSourceContent('');
    setShowAddSourceForm(false);
  };

  // Đọc file tài liệu (.txt / .pdf / .docx) — trích chữ ngay trên trình duyệt,
  // không tải file lên máy chủ (xem src/logic/extractDocumentText.ts).
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input để chọn lại cùng 1 file vẫn kích hoạt onChange.
    e.target.value = '';
    if (!file || isExtractingFile) return;
    setIsExtractingFile(true);
    setUnsupportedFileNotice(null);
    try {
      const { text, truncated } = await extractDocumentText(file);
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const newSrc: AISource = {
        id: 'src_file_' + Date.now(),
        title: file.name.replace(/\.(txt|pdf|docx)$/i, ''),
        type: 'file',
        content: text,
        wordCount,
        isEnabled: true,
        fileName: file.name,
        createdAt: new Date().toISOString(),
      };
      setSources([...sources, newSrc]);
      // 28/10: nguồn file phải nằm trong database — đẩy lên máy chủ ngay khi
      // tải lên (best-effort: lỗi thì nguồn vẫn dùng được ở trình duyệt này,
      // lần mở Studio sau sẽ đẩy bù nhờ cơ chế pending).
      if (topicId) {
        pushFileSource(topicId, newSrc)
          .then(() => markFileSynced(newSrc.id))
          .catch((err) => {
            console.warn('Chưa lưu được nguồn file lên máy chủ:', err);
            setDbSyncNotice(
              `Nguồn "${file.name}" đã thêm vào trình duyệt này nhưng chưa lưu được lên máy chủ — mở ở máy khác sẽ chưa thấy. Kiểm tra mạng rồi tải lại file sau.`
            );
          });
      }
      setUnsupportedFileNotice(
        truncated
          ? `File "${file.name}" dài hơn giới hạn nên chỉ giữ ${MAX_EXTRACTED_CHARS.toLocaleString('vi-VN')} ký tự đầu làm nguồn.`
          : null
      );
    } catch (err: any) {
      setUnsupportedFileNotice(err?.message || `Không đọc được file "${file.name}".`);
    } finally {
      setIsExtractingFile(false);
    }
  };

  // Xoá lịch sử trò chuyện của chủ đề hiện tại
  const handleClearChatHistory = () => {
    if (window.confirm('Thầy/cô có muốn xoá toàn bộ lịch sử trò chuyện của chủ đề này để làm mới cuộc hội thoại không?')) {
      const initialChat = [
        {
          role: 'assistant' as const,
          text: 'Xin chào thầy/cô! Tôi là trợ lý Mầm AI. Tôi đã đọc các tài liệu nguồn bên trái. Thầy/cô có thể đặt câu hỏi hoặc chọn các câu hỏi gợi ý bên dưới để tra cứu chi tiết.',
        },
      ];
      setChatMessages(initialChat);
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(initialChat));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // Phê duyệt và lưu bộ câu hỏi vào Ngân hàng
  const handleSaveReviewedQuestions = () => {
    if (!reviewDraftQuestions) return;
    const selected = reviewDraftQuestions.filter((q) => selectedDraftIds.includes(q.id));
    if (selected.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 câu hỏi để lưu vào Ngân hàng câu hỏi.');
      return;
    }
    // 28/10: nháp cũ (tạo trước khi có lớp kiểm chứng) có thể chứa câu thiếu
    // đề bài/loại — loại khỏi lần lưu này thay vì để máy chủ đắp mặc định
    // thành câu hỏng trong ngân hàng.
    const questionsToSave = selected.filter(isValidGeneratedQuestion);
    if (questionsToSave.length < selected.length) {
      alert(
        `Có ${selected.length - questionsToSave.length} câu thiếu đề bài hoặc loại nên không được lưu (câu lỗi do AI trả về trước đây). Chỉ ${questionsToSave.length} câu hợp lệ được lưu vào Ngân hàng.`
      );
    }
    if (questionsToSave.length === 0) return;

    onApplyDraft({
      type: 'quiz',
      data: {
        title: `Bộ câu hỏi: ${topicTitle} (Sinh bởi Mầm AI)`,
        kind: 'quick',
        topicId,
        timeLimitMinutes: Math.max(7, questionsToSave.length),
        xp: questionsToSave.length * 5,
        questions: questionsToSave,
        isAiGenerated: true,
        isTeacherReviewed: true,
      },
    });

    // Câu chưa tích chọn ở lại BẢN NHÁP để duyệt tiếp lúc khác; câu thiếu
    // trường đã bị loại ở trên cũng rời khỏi nháp (đã báo rõ); chỉ khi không
    // còn câu nào mới đóng xưởng.
    const savedIds = new Set(questionsToSave.map((q) => q.id));
    const skippedIds = new Set(selected.filter((q) => !savedIds.has(q.id)).map((q) => q.id));
    const remaining = reviewDraftQuestions.filter((q) => !savedIds.has(q.id) && !skippedIds.has(q.id));
    if (remaining.length > 0) {
      setReviewDraftQuestions(remaining);
      setSelectedDraftIds([]);
    } else {
      // 28/10: xóa khóa nháp NGAY tại đây như handleApplyTheoryDraft đã làm
      // — không trông chờ effect autosave chạy khi modal đóng, vì đóng modal
      // cùng nhịp state (đặc biệt khi xưởng nhúng trong Ngân hàng chuyển tab)
      // có thể khiến effect xóa khóa không bao giờ chạy, nháp đã lưu vẫn nằm
      // lại mục Bản nháp.
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        // Bỏ qua
      }
      setReviewDraftQuestions(null);
      setIsReviewOpen(false);
      onClose();
    }
  };

  const handleToggleSelectAllDrafts = () => {
    if (!reviewDraftQuestions) return;
    if (selectedDraftIds.length === reviewDraftQuestions.length) {
      setSelectedDraftIds([]);
    } else {
      setSelectedDraftIds(reviewDraftQuestions.map((q) => q.id));
    }
  };

  const handleToggleDraftId = (id: string) => {
    setSelectedDraftIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteDraftQuestion = (id: string) => {
    if (!reviewDraftQuestions) return;
    setReviewDraftQuestions((prev) => (prev ? prev.filter((q) => q.id !== id) : null));
    setSelectedDraftIds((prev) => prev.filter((item) => item !== id));
  };

  // Trò chuyện với nguồn (Gửi tin nhắn)
  const handleSendMessage = async (textToSend?: string) => {
    const userMsg = (textToSend || chatInput).trim();
    if (!userMsg || isChatLoading) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const response = await aiService.chatWithSources(sources, userMsg);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response.reply,
          citations: response.citations,
        },
      ]);
    } catch (e: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ Lỗi khi kết nối AI: ${e.message || 'Không thể tra cứu'}. Vui lòng kiểm tra lại API Key.`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Sinh bản nháp từ AI
  const handleGenerateDraft = async () => {
    const activeSources = sources.filter((s) => s.isEnabled);
    if (activeSources.length === 0) {
      alert('Vui lòng bật ít nhất 1 nguồn tài liệu bên cột trái để AI làm căn cứ tạo nội dung.');
      return;
    }

    clearLastAiFallback();
    setIsGenerating(true);
    setGenerationStep('Mầm AI đang đọc và phân tích cấu trúc văn bản nguồn...');

    try {
      if (outputType === 'video') {
        setGenerationStep('Đang trích xuất các ý kiến thức trọng tâm bài giảng và ví dụ minh họa...');
        const keyPoints = await aiService.generateKeySummary(activeSources, {
          focusTopic: topicTitle,
          includeExamples: true,
        });

        const fbVideo = getLastAiFallback();
        if (fbVideo) {
          alert(`⚠️ Mầm AI lỗi (${fbVideo.reason}). Nội dung vừa tạo là BẢN DỰ PHÒNG mẫu, chưa bám ngữ liệu nguồn — thầy/cô kiểm tra kỹ hoặc thử lại sau.`);
        }
        setGenerationStep('Hoàn tất! Đang đưa vào trình chỉnh sửa video...');
        setTimeout(() => {
          setIsGenerating(false);
          onApplyDraft({
            type: 'video',
            data: {
              title: `Bài giảng: Tìm hiểu ${topicTitle} ${fbVideo ? '(Bản dự phòng — Mầm AI lỗi)' : '(Sinh bởi Mầm AI)'}`,
              description: `Video bài giảng bám sát ngữ liệu: ${activeSources[0].title}.`,
              durationSec: 12 * 60,
              subtopics: [topicTitle, 'Đặc trưng thể loại'],
              summaryPoints: keyPoints,
              isAiGenerated: true,
              isTeacherReviewed: false,
            },
          });
          onClose();
        }, 600);
      } else if (outputType === 'theory') {
        setGenerationStep('Đang xây dựng khối lý thuyết chuyên sâu theo chuẩn GDPT 2018...');
        const blocks = await aiService.generateTheory(activeSources, {
          topicTitle,
          depth: 'detailed',
          includeExamples: true,
        });

        const fbTheory = getLastAiFallback();
        if (fbTheory) {
          alert(`⚠️ Mầm AI lỗi (${fbTheory.reason}). Nội dung vừa tạo là BẢN DỰ PHÒNG mẫu, chưa bám ngữ liệu nguồn — thầy/cô kiểm tra kỹ hoặc thử lại sau.`);
        }
        setGenerationStep('Hoàn tất! Đang mở bản duyệt lý thuyết...');
        setTimeout(() => {
          setIsGenerating(false);
          setReviewTheoryDraft({
            title: `Lý thuyết chuyên sâu: ${topicTitle} ${fbTheory ? '(Bản dự phòng — Mầm AI lỗi)' : '(Sinh bởi Mầm AI)'}`,
            blocks,
            isFallback: !!fbTheory,
          });
          setIsTheoryReviewOpen(true);
        }, 600);
      } else {
        setGenerationStep(`Mầm AI đang soạn bộ câu hỏi 4 mức năng lực (${totalQuestions} câu)...`);
        const questions = await aiService.generateQuestions(activeSources, {
          topicTitle,
          totalQuestions,
          typeCounts,
          difficulty,
        });

        const fbQuestions = getLastAiFallback();
        if (fbQuestions) {
          alert(`⚠️ Mầm AI lỗi (${fbQuestions.reason}). Bộ câu hỏi vừa tạo là BẢN DỰ PHÒNG mẫu, chưa bám ngữ liệu nguồn — thầy/cô duyệt kỹ từng câu trước khi lưu.`);
        }

        const processedQuestions = questions.map((q) => ({
          ...q,
          isAiGenerated: true,
          isTeacherReviewed: false,
          aiSourceSnippet: q.aiSourceSnippet || activeSources[0].content.slice(0, 100),
        }));

        setGenerationStep('Hoàn tất! Đang mở bản xem trước...');
        // 28/10: báo rõ khi AI trả thiếu (kể cả sau 1 lần gọi bù trong service).
        setGenerationShortfall(
          processedQuestions.length < totalQuestions
            ? `AI chỉ tạo được ${processedQuestions.length}/${totalQuestions} câu hợp lệ (câu thiếu trường đã bị loại, không đưa vào nháp). Thầy/cô có thể bấm "Tạo lại" để thử đủ số.`
            : null
        );
        setTimeout(() => {
          setIsGenerating(false);
          setReviewDraftQuestions(processedQuestions);
          setSelectedDraftIds(processedQuestions.map((q) => q.id));
          setIsReviewOpen(true);
        }, 400);
      }
    } catch (e: any) {
      console.error('Lỗi sinh bản nháp AI:', e);
      alert(`⚠️ Lỗi sinh nội dung AI: ${e.message || 'Lỗi mạng'}. Vui lòng thử lại sau ít phút.`);
      setIsGenerating(false);
    }
  };

  const totalEnabledWords = sources
    .filter((s) => s.isEnabled)
    .reduce((acc, curr) => acc + curr.wordCount, 0);

  const studioBody = (
    <div className={`w-full ${isEmbedded ? 'h-[780px] rounded-3xl border border-[#E6DCC8] shadow-xs' : 'max-w-7xl h-[92vh] max-h-[880px] rounded-3xl border border-[#E6DCC8] shadow-2xl'} bg-[#FFFDF8] flex flex-col overflow-hidden text-[#2F3E6B]`}>
      {/* THANH TIÊU ĐỀ STUDIO */}
      <div className="px-6 py-4 bg-[#FAF5EB] border-b border-[#E6DCC8] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#E2704A] to-[#F2B84B] text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-lora font-bold text-lg text-[#2F3E6B]">
                Xưởng Sáng Tạo Mầm AI Studio
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0D9488]/10 text-[#0D9488]">
                Chủ đề: {topicTitle}
              </span>
            </div>
            <p className="text-xs text-[#8C7E6A]">
              Tải lên nguồn ngữ liệu, đối chiếu trích dẫn và sinh bản nháp chuẩn sư phạm
            </p>
          </div>
        </div>

        {/* Trạng thái AI: chạy qua proxy admin, giáo viên không nhập key */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Mầm AI</span>
          </span>

          {!isEmbedded && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#8C7E6A] hover:text-[#2F3E6B] hover:bg-black/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Thanh BẢN NHÁP: có bộ câu AI chưa lưu vào Ngân hàng đang chờ duyệt */}
      {!isReviewOpen && reviewDraftQuestions && reviewDraftQuestions.length > 0 && (
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <p className="text-xs font-bold text-amber-800 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-amber-200/70 border border-amber-300 text-[10px] font-extrabold">
              BẢN NHÁP
            </span>
            Có {reviewDraftQuestions.length} câu hỏi AI chưa lưu vào Ngân hàng
            {draftSavedAt &&
              ` · Lưu nháp lúc ${new Date(draftSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(draftSavedAt).toLocaleDateString('vi-VN')}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Xem & duyệt bản nháp
            </button>
            <button
              type="button"
              onClick={() => setIsDiscardDraftOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 transition-colors cursor-pointer"
            >
              Xóa nháp
            </button>
          </div>
        </div>
      )}

      {/* Thanh BẢN NHÁP LÝ THUYẾT chưa duyệt */}
      {!isTheoryReviewOpen && reviewTheoryDraft && reviewTheoryDraft.blocks.length > 0 && (
        <div className="px-6 py-2.5 bg-violet-50 border-b border-violet-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <p className="text-xs font-bold text-violet-800 flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-full bg-violet-200/70 border border-violet-300 text-[10px] font-extrabold shrink-0">
              BẢN NHÁP LÝ THUYẾT
            </span>
            <span className="truncate">{reviewTheoryDraft.title}</span>
            {theoryDraftSavedAt &&
              ` · Lưu nháp lúc ${new Date(theoryDraftSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(theoryDraftSavedAt).toLocaleDateString('vi-VN')}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTheoryReviewOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Xem & duyệt lý thuyết
            </button>
            <button
              type="button"
              onClick={() => setIsDiscardTheoryDraftOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 transition-colors cursor-pointer"
            >
              Xóa nháp
            </button>
          </div>
        </div>
      )}

      {/* NỘI DUNG 3 VÙNG CHUẨN NOTEBOOKLM HOẶC MÀN HÌNH DUYỆT BẢN NHÁP CÂU HỎI */}
      {isTheoryReviewOpen && reviewTheoryDraft ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#FAF5EB]/30">
          {/* Thanh công cụ duyệt lý thuyết */}
          <div className="px-6 py-3.5 bg-white border-b border-[#E6DCC8] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsTheoryReviewOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-[#FAF5EB] hover:bg-[#E6DCC8]/50 text-xs font-bold text-[#2F3E6B] border border-[#E6DCC8] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                <span>Quay lại xưởng</span>
              </button>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#2F3E6B] flex items-center gap-2">
                  <span>Duyệt lý thuyết AI vừa tạo</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                    BẢN NHÁP
                  </span>
                </h3>
                <p className="text-[11px] text-[#8C7E6A] truncate">
                  {reviewTheoryDraft.title} — đọc kỹ toàn bộ nội dung bên dưới rồi mới quyết định lưu.
                  {theoryDraftSavedAt &&
                    ` Đã lưu nháp lúc ${new Date(theoryDraftSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(theoryDraftSavedAt).toLocaleDateString('vi-VN')}.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsDiscardTheoryDraftOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 transition-colors cursor-pointer"
              >
                Xóa bản nháp
              </button>
              <button
                type="button"
                onClick={handleApplyTheoryDraft}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Lưu lý thuyết vào học liệu</span>
              </button>
            </div>
          </div>

          {/* Xem trước nội dung lý thuyết (đúng dạng học sinh sẽ đọc) */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-[#E6DCC8] p-6 sm:p-8">
              <h2 className="font-lora text-xl font-bold text-[#1E1B4B] mb-4">{reviewTheoryDraft.title}</h2>
              <div className="space-y-1">
                {reviewTheoryDraft.blocks.map((b, bIdx) => (
                  <div key={b.id || bIdx}>
                    {b.type === 'heading' && (
                      <h3 className={`font-extrabold text-[#1E1B4B] mt-5 mb-2 ${b.level === 3 ? 'text-base' : 'text-lg'}`}>
                        {b.content}
                      </h3>
                    )}
                    {b.type === 'paragraph' && (
                      <p className="text-sm text-slate-700 leading-relaxed mb-3">{b.content}</p>
                    )}
                    {b.type === 'list' && (
                      <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 mb-3 pl-2">
                        {(b.items || []).map((it, itIdx) => (
                          <li key={itIdx}>{it}</li>
                        ))}
                      </ul>
                    )}
                    {b.type === 'example' && (
                      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1.5 my-3">
                        <strong className="text-xs font-bold text-[#4F46E5] block">Ví dụ thực tế:</strong>
                        <p className="text-sm text-slate-800 italic">"{b.exampleText}"</p>
                        {b.exampleAnalysis && (
                          <p className="text-xs text-slate-600 pt-1 border-t border-indigo-100">
                            <strong>Phân tích:</strong> {b.exampleAnalysis}
                          </p>
                        )}
                      </div>
                    )}
                    {b.type === 'takeaway' && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-1 my-3">
                        <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                          Ghi nhớ trọng tâm
                        </span>
                        <p className="text-sm font-bold text-slate-800">{b.takeawayText}</p>
                      </div>
                    )}
                    {b.type === 'image' && b.imageUrl && (
                      <div className="my-3 text-center space-y-1">
                        <img
                          src={b.imageUrl}
                          alt={b.caption || 'Minh họa'}
                          className="max-h-72 rounded-2xl mx-auto object-contain border border-slate-200"
                        />
                        {b.caption && <p className="text-xs text-slate-500 italic">{b.caption}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : isReviewOpen && reviewDraftQuestions ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#FAF5EB]/30">
          {/* Thanh công cụ xem trước */}
          <div className="px-6 py-3.5 bg-white border-b border-[#E6DCC8] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-[#FAF5EB] hover:bg-[#E6DCC8]/50 text-xs font-bold text-[#2F3E6B] border border-[#E6DCC8] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                <span>Quay lại xưởng</span>
              </button>
              <div>
                <h3 className="text-sm font-bold text-[#2F3E6B] flex items-center gap-2">
                  <span>Duyệt bộ câu hỏi AI vừa tạo</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                    BẢN NHÁP
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#E2704A]/10 text-[#E2704A] border border-[#E2704A]/20">
                    {reviewDraftQuestions.length} câu hỏi
                  </span>
                </h3>
                <p className="text-[11px] text-[#8C7E6A]">
                  Bản nháp được tự lưu — thầy/cô cứ đóng xưởng, quay lại duyệt tiếp lúc khác cũng không mất.
                  {draftSavedAt &&
                    ` Đã lưu nháp lúc ${new Date(draftSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(draftSavedAt).toLocaleDateString('vi-VN')}.`}
                </p>
                {generationShortfall && (
                  <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 mt-1">
                    ⚠️ {generationShortfall}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsDiscardDraftOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 transition-colors cursor-pointer"
              >
                Xóa bản nháp
              </button>
              <button
                type="button"
                onClick={handleToggleSelectAllDrafts}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:bg-[#FAF5EB] text-xs font-bold text-[#2F3E6B] transition-colors cursor-pointer"
              >
                {selectedDraftIds.length === reviewDraftQuestions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
              <button
                type="button"
                onClick={handleSaveReviewedQuestions}
                disabled={selectedDraftIds.length === 0}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#E2704A] to-[#D45E36] hover:from-[#D45E36] hover:to-[#C34F28] disabled:opacity-40 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Lưu {selectedDraftIds.length} câu đã chọn vào Ngân hàng</span>
              </button>
            </div>
          </div>

          {/* Danh sách các câu hỏi mới tạo */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {reviewDraftQuestions.map((q, idx) => {
              const isSelected = selectedDraftIds.includes(q.id);
              return (
                <div
                  key={q.id || idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-white border-[#E2704A]/50 shadow-xs ring-1 ring-[#E2704A]/20'
                      : 'bg-white/60 border-[#E6DCC8] opacity-60'
                  }`}
                >
                  {/* Tiêu đề & tag câu */}
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#E6DCC8]">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleDraftId(q.id)}
                          className="w-4 h-4 accent-[#E2704A] rounded cursor-pointer"
                        />
                        <span className="font-bold text-xs text-[#2F3E6B]">Câu {idx + 1}</span>
                      </label>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF5EB] text-[#2F3E6B] border border-[#E6DCC8]">
                        {q.type === 'single'
                          ? 'Trắc nghiệm 1 đáp án'
                          : q.type === 'multi'
                          ? 'Chọn nhiều đáp án'
                          : q.type === 'fill'
                          ? 'Điền từ'
                          : q.type === 'essay'
                          ? 'Tự luận'
                          : 'Chưa rõ loại'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0D9488]/10 text-[#0D9488]">
                        {q.level === 'NHAN_BIET'
                          ? 'Nhận biết'
                          : q.level === 'THONG_HIEU'
                          ? 'Thông hiểu'
                          : q.level === 'PHAN_TICH'
                          ? 'Phân tích'
                          : q.level === 'VAN_DUNG'
                          ? 'Vận dụng'
                          : 'Chưa rõ mức'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {q.difficulty === 'DE' ? 'Dễ' : q.difficulty === 'TB' ? 'Trung bình' : q.difficulty === 'KHO' ? 'Khó' : 'Chưa rõ độ khó'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteDraftQuestion(q.id)}
                      className="p-1 rounded-lg text-[#8C7E6A] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Xóa câu này khỏi danh sách"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Đề bài — 28/10: không để trống lặng lẽ; câu thiếu đề phải hiện rõ là lỗi */}
                  <p className="text-xs font-bold text-[#2F3E6B] leading-relaxed mb-2.5">
                    {q.prompt || '— Câu hỏi này thiếu đề bài (do AI trả về lỗi, không nên lưu) —'}
                  </p>

                  {/* Đoạn ngữ liệu trích dẫn */}
                  {(q.passage || q.aiSourceSnippet) && (
                    <div className="p-2.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-[11px] text-[#8C7E6A] italic mb-3">
                      <span className="font-bold text-[#E2704A] not-italic mr-1">Ngữ liệu căn cứ:</span>
                      "{q.passage || q.aiSourceSnippet}"
                    </div>
                  )}

                  {/* Phương án trắc nghiệm */}
                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      {q.options.map((opt, oIdx) => {
                        const optLetter = String.fromCharCode(65 + oIdx);
                        const isCorrect = Array.isArray(q.answer)
                          ? q.answer.includes(optLetter)
                          : q.answer === optLetter;
                        return (
                          <div
                            key={oIdx}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                                : 'bg-[#FFFDF8] border-[#E6DCC8] text-[#2F3E6B]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-[#FAF5EB] text-[#8C7E6A]'
                                }`}
                              >
                                {optLetter}
                              </span>
                              <span className="truncate">{opt}</span>
                            </div>
                            {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Đáp án điền từ */}
                  {q.type === 'fill' && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 font-bold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Đáp án cần điền: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</span>
                    </div>
                  )}

                  {/* Lời giải thích */}
                  {q.explanation && (
                    <div className="p-2.5 rounded-xl bg-[#0D9488]/5 border border-[#0D9488]/20 text-[11px] text-[#2F3E6B]">
                      <span className="font-bold text-[#0D9488] mr-1">💡 Lời giải thích:</span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Thanh chân trang chốt lưu */}
          <div className="p-4 bg-white border-t border-[#E6DCC8] flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => setIsDiscardDraftOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#8C7E6A] hover:bg-black/5"
            >
              Hủy bỏ & Tạo lại
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#8C7E6A]">
                Đã chọn: <strong className="text-[#E2704A]">{selectedDraftIds.length}</strong> / {reviewDraftQuestions.length} câu
              </span>
              <button
                type="button"
                onClick={handleSaveReviewedQuestions}
                disabled={selectedDraftIds.length === 0}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#E2704A] to-[#D45E36] hover:from-[#D45E36] hover:to-[#C34F28] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác nhận lưu {selectedDraftIds.length} câu vào Ngân hàng câu hỏi</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#E6DCC8]">
        {/* ========================================================= */}
        {/* VÙNG 1: NGUỒN TÀI LIỆU (BÊN TRÁI ~ 330px) */}
        {/* ========================================================= */}
        <div
          className="w-full flex flex-col shrink-0 bg-[#FAF5EB]/50 overflow-hidden"
          style={isWide ? { width: collapsedPanels.left ? 46 : panelWidths.left } : undefined}
        >
          {collapsedPanels.left ? (
            <button
              type="button"
              onClick={() => setCollapsedPanels((p) => ({ ...p, left: false }))}
              className="flex-1 flex flex-col items-center gap-2 py-4 text-[#8C7E6A] hover:text-[#2F3E6B] transition-colors"
              title="Mở panel Nguồn tài liệu"
            >
              <ChevronsRight className="w-4 h-4" />
              <span className="[writing-mode:vertical-rl] text-[11px] font-bold uppercase tracking-wider">1. Nguồn tài liệu</span>
            </button>
          ) : (
            <>
          <div className="p-4 border-b border-[#E6DCC8] flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-[13px] uppercase tracking-wider text-[#1E1B4B] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#E2704A]" />
                <span>1. Nguồn tài liệu ({sources.length})</span>
              </h3>
              <p className="text-[11px] text-[#6B5D4F] mt-0.5">
                Đã bật {sources.filter((s) => s.isEnabled).length}/{sources.length} nguồn ({totalEnabledWords})
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddSourceForm(!showAddSourceForm)}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#E2704A] hover:bg-[#FAF5EB] transition-colors cursor-pointer"
            >
              + Thêm nguồn
            </button>
          </div>
          {dbSyncNotice && (
            <p className="mx-4 mt-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
              ⚠️ {dbSyncNotice}
            </p>
          )}

          {/* Form thêm nguồn */}
          {showAddSourceForm && (
            <div className="p-4 bg-white border-b border-[#E6DCC8] space-y-3 animate-in slide-in-from-top duration-150">
              <div className="flex rounded-xl bg-[#FAF5EB] p-1 border border-[#E6DCC8]">
                <button
                  type="button"
                  onClick={() => setActiveTabSourceInput('paste')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                    activeTabSourceInput === 'paste' ? 'bg-white text-[#2F3E6B] shadow-xs' : 'text-[#8C7E6A]'
                  }`}
                >
                  Dán văn bản
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabSourceInput('file')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                    activeTabSourceInput === 'file' ? 'bg-white text-[#2F3E6B] shadow-xs' : 'text-[#8C7E6A]'
                  }`}
                >
                  Tải file (.txt, .pdf, .docx)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabSourceInput('video')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                    activeTabSourceInput === 'video' ? 'bg-white text-[#2F3E6B] shadow-xs' : 'text-[#8C7E6A]'
                  }`}
                >
                  Ghi chú / Lời giảng
                </button>
              </div>

              <input
                type="text"
                placeholder="Tiêu đề tài liệu nguồn..."
                value={newSourceTitle}
                onChange={(e) => setNewSourceTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
              />

              {activeTabSourceInput === 'file' ? (
                <div className="space-y-2">
                  <label className="border-2 border-dashed border-[#E6DCC8] hover:border-[#E2704A] rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#FAF5EB]">
                    <Upload className="w-5 h-5 text-[#8C7E6A] mb-1" />
                    <span className="text-xs font-bold text-[#2F3E6B]">Chọn tệp tài liệu (.txt, .pdf, .docx)</span>
                    <span className="text-[10px] text-[#8C7E6A]">Trích chữ ngay trên trình duyệt, tối đa 10MB; PDF quét ảnh không có lớp chữ sẽ không trích xuất được</span>
                    <input
                      type="file"
                      accept=".txt,.pdf,.docx"
                      disabled={isExtractingFile}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {isExtractingFile && (
                      <span className="text-[11px] font-bold text-[#E2704A]">⏳ Đang đọc file, vui lòng chờ...</span>
                    )}
                  </label>
                  {unsupportedFileNotice && (
                    <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-200">
                      {unsupportedFileNotice}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    placeholder={
                      activeTabSourceInput === 'video'
                        ? 'Dán lời giảng bài học, ghi chép nội dung video hoặc transcript tại đây...'
                        : 'Dán đoạn trích tác phẩm văn học, bài thơ hoặc tài liệu tham khảo bài dạy...'
                    }
                    value={newSourceContent}
                    onChange={(e) => setNewSourceContent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A]"
                  />
                  <p className="text-[10px] text-[#8C7E6A] italic">
                    💡 Thầy/cô chỉ cần dán trực tiếp đoạn văn bản, thơ ca hoặc lời giảng vào đây rồi bấm "Lưu nguồn".
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddSourceForm(false)}
                  className="px-3 py-1 rounded-xl text-xs font-bold text-[#8C7E6A] hover:bg-black/5"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddSource}
                  disabled={!newSourceContent.trim()}
                  className="px-3 py-1 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Lưu nguồn
                </button>
              </div>
            </div>
          )}

          {/* Danh sách nguồn tài liệu */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {sources.length === 0 ? (
              <div className="p-4 text-center space-y-3 bg-white rounded-2xl border border-dashed border-[#E6DCC8]">
                <p className="text-xs text-[#8C7E6A] italic">
                  Chưa có nguồn tài liệu nào được thêm.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSourceForm(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#E2704A] text-white text-xs font-bold hover:bg-[#D45E36] transition-colors shadow-2xs"
                  >
                    + Thêm nguồn tài liệu mới
                  </button>
                </div>
              </div>
            ) : (
              sources.map((src) => (
              <div
                key={src.id}
                className={`p-3 rounded-2xl border transition-all ${
                  src.isEnabled
                    ? 'bg-white border-[#E6DCC8] shadow-2xs'
                    : 'bg-[#FAF5EB]/50 border-dashed border-[#E6DCC8] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={src.isEnabled}
                      onChange={(e) => {
                        setSources(
                          sources.map((s) =>
                            s.id === src.id ? { ...s, isEnabled: e.target.checked } : s
                          )
                        );
                        // Nguồn file đồng bộ trạng thái bật/tắt lên database.
                        if (src.type === 'file' && topicId) {
                          patchFileSourceEnabled(src.id, e.target.checked).catch((err) => {
                            console.warn('Chưa đồng bộ được trạng thái nguồn lên máy chủ:', err);
                            setDbSyncNotice(
                              'Chưa đồng bộ được trạng thái bật/tắt của nguồn lên máy chủ — lần mở sau có thể trở lại trạng thái cũ.'
                            );
                          });
                        }
                      }}
                      className="mt-0.5 rounded text-[#E2704A] focus:ring-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#2F3E6B] truncate">{src.title}</p>
                      <p className="text-[10px] text-[#8C7E6A] flex items-center gap-1.5 mt-0.5">
                        <span>{src.wordCount}</span>
                        <span>•</span>
                        <span className="capitalize">{src.type === 'transcript' ? 'Bản ghi' : src.type}</span>
                      </p>
                    </div>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewingSource(src)}
                      className="text-[#8C7E6A] hover:text-[#2F3E6B] p-1 transition-colors cursor-pointer"
                      title="Xem toàn văn nguồn tài liệu"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSources(sources.filter((s) => s.id !== src.id));
                        // Nguồn file xóa khỏi cả database (kèm dọn dấu đã đồng bộ).
                        if (src.type === 'file' && topicId) {
                          unmarkFileSynced(src.id);
                          deleteFileSource(src.id).catch((err) => {
                            console.warn('Chưa xóa được nguồn file khỏi máy chủ:', err);
                            setDbSyncNotice(
                              'Chưa xóa được nguồn khỏi máy chủ — lần mở sau nguồn có thể hiện lại. Thử xóa lại sau.'
                            );
                          });
                        }
                      }}
                      className="text-[#8C7E6A] hover:text-rose-600 p-1 transition-colors cursor-pointer"
                      title="Xóa nguồn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[#8C7E6A] mt-2 line-clamp-2 italic bg-[#FAF5EB] p-2 rounded-xl">
                  "{src.content.slice(0, 100)}..."
                </p>
              </div>
            )))}
          </div>
            </>
          )}
        </div>
        {isWide && !collapsedPanels.left && (
          <div
            onMouseDown={startPanelResize('left')}
            className="w-1.5 shrink-0 cursor-col-resize bg-[#E6DCC8]/50 hover:bg-[#E2704A]/40 transition-colors relative"
            title="Kéo để chỉnh độ rộng panel"
          >
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setCollapsedPanels((p) => ({ ...p, left: true }))}
              className="absolute top-2 -left-2 z-10 w-5 h-5 rounded-full bg-white border border-[#E6DCC8] shadow-xs flex items-center justify-center text-[#8C7E6A] hover:text-[#2F3E6B]"
              title="Thu gọn panel Nguồn tài liệu"
            >
              <ChevronsLeft className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* VÙNG 2: TRÒ CHUYỆN VỚI NGUỒN (Ở GIỮA) */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <div className="p-4 border-b border-[#E6DCC8] flex items-center justify-between bg-[#FAF5EB]/30">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0D9488]" />
              <h3 className="font-extrabold text-[13px] uppercase tracking-wider text-[#1E1B4B]">
                2. Trò chuyện & Tra cứu tài liệu
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6B5D4F] italic hidden sm:inline">
                AI trả lời từ nguồn đã bật
              </span>
              <button
                type="button"
                onClick={handleClearChatHistory}
                className="px-2 py-1 rounded-lg text-[#8C7E6A] hover:text-rose-600 hover:bg-rose-50 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                title="Xoá lịch sử trò chuyện để bắt đầu lại"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Làm mới chat</span>
              </button>
            </div>
          </div>

          {/* Danh sách tin nhắn chat */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#2F3E6B] text-white rounded-br-xs'
                      : 'bg-[#FAF5EB] text-[#2F3E6B] border border-[#E6DCC8] rounded-bl-xs'
                  }`}
                >
                  <FormattedChatMessage text={msg.text} isUser={msg.role === 'user'} />

                  {/* Chú thích nguồn tham chiếu */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#E6DCC8] space-y-1">
                      <p className="text-[10px] font-bold text-[#8C7E6A] uppercase flex items-center gap-1">
                        <Quote className="w-3 h-3 text-[#E2704A]" />
                        <span>Trích dẫn đối chiếu từ nguồn:</span>
                      </p>
                      {msg.citations.map((c, cIdx) => (
                        <div
                          key={cIdx}
                          className="bg-white/80 p-2 rounded-lg border border-[#E6DCC8] text-[11px] text-[#2F3E6B]"
                        >
                          <span className="font-bold text-[#E2704A]">[{c.sourceTitle}]</span>: "{c.snippet}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex gap-2 items-center text-xs text-[#8C7E6A] italic p-2 bg-[#FAF5EB] rounded-xl w-fit">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0D9488]" />
                <span>Mầm AI đang đọc tài liệu nguồn và trích xuất câu trả lời...</span>
              </div>
            )}
          </div>

          {/* GỢI Ý CÂU HỎI NHANH CHUẨN NOTEBOOKLM */}
          <div className="px-3 pt-2 pb-1.5 border-t border-[#E6DCC8] bg-[#FAF5EB]/30 flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[10px] font-bold text-[#8C7E6A] shrink-0 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-[#E2704A]" /> Gợi ý:
            </span>
            {suggestedPrompts.map((pText, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => handleSendMessage(pText)}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#E6DCC8] hover:border-[#0D9488] hover:text-[#0D9488] text-[11px] text-[#2F3E6B] font-medium shrink-0 transition-colors cursor-pointer"
              >
                {pText}
              </button>
            ))}
          </div>

          {/* Ô gõ tin nhắn */}
          <div className="p-3 border-t border-[#E6DCC8] bg-[#FAF5EB]/40 flex gap-2">
            <input
              type="text"
              placeholder="Hỏi AI về từ ngữ, biện pháp tu từ hoặc chi tiết trong văn bản..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#0D9488]"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!chatInput.trim() || isChatLoading}
              className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0B7A70] disabled:opacity-40 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Hỏi</span>
            </button>
          </div>
        </div>

        {isWide && !collapsedPanels.right && (
          <div
            onMouseDown={startPanelResize('right')}
            className="w-1.5 shrink-0 cursor-col-resize bg-[#E6DCC8]/50 hover:bg-[#E2704A]/40 transition-colors relative"
            title="Kéo để chỉnh độ rộng panel"
          >
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setCollapsedPanels((p) => ({ ...p, right: true }))}
              className="absolute top-2 -right-2 z-10 w-5 h-5 rounded-full bg-white border border-[#E6DCC8] shadow-xs flex items-center justify-center text-[#8C7E6A] hover:text-[#2F3E6B]"
              title="Thu gọn panel Xưởng tạo đầu ra"
            >
              <ChevronsRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* VÙNG 3: XƯỞNG TẠO (BÊN PHẢI ~ 380px) */}
        {/* ========================================================= */}
        <div
          ref={rightPanelRef}
          className="w-full flex flex-col shrink-0 bg-[#FAF5EB]/70 overflow-y-auto overflow-x-hidden"
          style={isWide ? { width: collapsedPanels.right ? 46 : panelWidths.right } : undefined}
        >
          {collapsedPanels.right ? (
            <button
              type="button"
              onClick={() => setCollapsedPanels((p) => ({ ...p, right: false }))}
              className="flex-1 flex flex-col items-center gap-2 py-4 text-[#8C7E6A] hover:text-[#2F3E6B] transition-colors"
              title="Mở panel Xưởng tạo đầu ra"
            >
              <ChevronsLeft className="w-4 h-4" />
              <span className="[writing-mode:vertical-rl] text-[11px] font-bold uppercase tracking-wider">3. Xưởng tạo đầu ra</span>
            </button>
          ) : (
            <>
          <div className="p-4 border-b border-[#E6DCC8]">
            <h3 className="font-extrabold text-[13px] uppercase tracking-wider text-[#1E1B4B] flex items-center gap-1.5">
              <Wand2 className="w-4 h-4 text-[#E2704A]" />
              <span>3. Xưởng tạo đầu ra</span>
            </h3>
            <p className="text-[11px] text-[#6B5D4F] mt-0.5">
              Cấu hình định dạng và tiêu chí sinh tự động
            </p>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* LỰA CHỌN LOẠI ĐẦU RA */}
            <div>
              <label className="text-xs font-bold text-[#2F3E6B] block mb-1.5">Loại nội dung cần tạo:</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setOutputType('quiz')}
                  className={`h-[68px] px-1 py-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-colors overflow-hidden ${
                    outputType === 'quiz'
                      ? 'bg-white border-[#E2704A] text-[#E2704A] shadow-xs'
                      : 'bg-white/50 border-[#E6DCC8] text-[#8C7E6A] hover:border-[#E2704A]/50'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-[10.5px] font-bold tracking-tight whitespace-nowrap">Bộ câu hỏi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOutputType('video')}
                  className={`h-[68px] px-1 py-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-colors overflow-hidden ${
                    outputType === 'video'
                      ? 'bg-white border-[#E2704A] text-[#E2704A] shadow-xs'
                      : 'bg-white/50 border-[#E6DCC8] text-[#8C7E6A] hover:border-[#E2704A]/50'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span className="text-[10.5px] font-bold tracking-tight whitespace-nowrap">Ý trọng tâm video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOutputType('theory')}
                  className={`h-[68px] px-1 py-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-colors overflow-hidden ${
                    outputType === 'theory'
                      ? 'bg-white border-[#E2704A] text-[#E2704A] shadow-xs'
                      : 'bg-white/50 border-[#E6DCC8] text-[#8C7E6A] hover:border-[#E2704A]/50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="text-[10.5px] font-bold tracking-tight whitespace-nowrap">Lý thuyết chi tiết</span>
                </button>
              </div>
            </div>

            {/* CẤU HÌNH THEO LOẠI — vùng chiều cao CỐ ĐỊNH: trước đây chỉ loại
                Bộ câu hỏi có khối cấu hình cao ~330px, đổi sang Video/Lý thuyết
                là khối biến mất, panel cuộn bị sụt chiều cao và NỘI DUNG NHẢY
                LÊN/XUỐNG. Nay giữ nguyên chiều cao cho cả 3 loại. */}
            <div className="min-h-[332px]">
            {outputType === 'quiz' && (
              <div className="space-y-3 p-3.5 bg-white rounded-2xl border border-[#E6DCC8]">
                <div>
                  <label className="text-xs font-bold text-[#2F3E6B] block mb-1.5">Loại câu hỏi và số lượng:</label>
                  <div className="divide-y divide-[#E6DCC8]/70 rounded-xl border border-[#E6DCC8] overflow-hidden">
                    {([
                      { key: 'single', label: 'Chọn 1 đáp án' },
                      { key: 'multi', label: 'Chọn nhiều đáp án' },
                      { key: 'fill', label: 'Điền vào chỗ trống' },
                      { key: 'essay', label: 'Tự luận' },
                    ] as const).map((row) => (
                      <div key={row.key} className="flex items-center justify-between px-3 py-2 bg-[#FAF5EB]/60">
                        <span className="text-xs font-medium text-[#2F3E6B]">{row.label}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => adjustTypeCount(row.key, -1)}
                            disabled={typeCounts[row.key] === 0}
                            className="w-6 h-6 rounded-lg border border-[#E6DCC8] bg-white text-[#2F3E6B] font-bold text-sm leading-none disabled:opacity-35 hover:bg-[#FAF5EB] transition-colors"
                            aria-label={`Giảm số câu ${row.label}`}
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-[#2F3E6B]">{typeCounts[row.key]}</span>
                          <button
                            type="button"
                            onClick={() => adjustTypeCount(row.key, 1)}
                            className="w-6 h-6 rounded-lg border border-[#E6DCC8] bg-white text-[#2F3E6B] font-bold text-sm leading-none hover:bg-[#FAF5EB] transition-colors"
                            aria-label={`Tăng số câu ${row.label}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2 bg-[#2F3E6B]/5">
                      <span className="text-xs font-bold text-[#2F3E6B]">Tổng số câu dự kiến</span>
                      <span className="text-xs font-bold text-[#E2704A]">{totalQuestions} câu</span>
                    </div>
                  </div>
                  {totalQuestions === 0 && (
                    <p className="text-[11px] text-rose-500 mt-1.5">Hãy chọn ít nhất 1 câu hỏi để AI tạo bộ câu hỏi.</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2F3E6B] block mb-1">Độ khó tổng thể:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['DE', 'TB', 'KHO'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`py-1 rounded-xl text-xs font-bold border transition-all ${
                          difficulty === d
                            ? 'bg-[#2F3E6B] text-white border-[#2F3E6B]'
                            : 'bg-[#FAF5EB] text-[#8C7E6A] border-[#E6DCC8]'
                        }`}
                      >
                        {d === 'DE' ? 'Dễ' : d === 'TB' ? 'Trung bình' : 'Khó'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {outputType !== 'quiz' && (
              <div className="p-3.5 bg-white/60 rounded-2xl border border-dashed border-[#E6DCC8] text-[11px] leading-relaxed text-[#8C7E6A]">
                Loại nội dung này không cần cấu hình thêm — Mầm AI sẽ sinh theo
                đúng các nguồn thầy/cô đã bật ở cột giữa. Bấm nút cam bên dưới
                để tạo bản nháp.
              </div>
            )}
            </div>

            {/* NÚT SINH NỘI DUNG VỚI AI */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={isGenerating || sources.filter((s) => s.isEnabled).length === 0 || (outputType === 'quiz' && totalQuestions === 0)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#E2704A] to-[#D45E36] hover:from-[#D45E36] hover:to-[#C34F28] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{generationStep || 'Mầm AI đang làm việc...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Tạo bản nháp với Mầm AI</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-[#8C7E6A]">
                AI sẽ trích xuất từ các nguồn đã bật và hiển thị bản xem trước để thầy/cô kiểm tra từng câu hỏi.
              </p>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* ========================================================= */}
      {/* MODAL NHẬP QUICK API KEY TRỰC TIẾP TRÊN XƯỞNG AI        */}
      {/* ========================================================= */}
      <ConfirmDialog
        isOpen={isDiscardTheoryDraftOpen}
        title="Xóa bản nháp lý thuyết?"
        message="Toàn bộ nội dung lý thuyết trong bản nháp chưa lưu sẽ bị xóa và không khôi phục được."
        confirmLabel="Xóa bản nháp"
        variant="danger"
        onConfirm={handleDiscardTheoryDraft}
        onCancel={() => setIsDiscardTheoryDraftOpen(false)}
      />
      <ConfirmDialog
        isOpen={isDiscardDraftOpen}
        title="Xóa bản nháp câu hỏi?"
        message="Toàn bộ câu hỏi AI trong bản nháp chưa lưu sẽ bị xóa và không khôi phục được. Các câu đã lưu vào Ngân hàng không bị ảnh hưởng."
        confirmLabel="Xóa bản nháp"
        variant="danger"
        onConfirm={handleDiscardDraft}
        onCancel={() => setIsDiscardDraftOpen(false)}
      />
      {/* ========================================================= */}
      {/* MODAL XEM TOÀN VĂN TÀI LIỆU NGUỒN (SOURCE VIEWER)         */}
      {/* ========================================================= */}
      {previewingSource && (
        <div className="fixed inset-0 z-60 bg-[#1E1B4B]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#2F3E6B]">
            <div className="px-6 py-4 bg-[#FAF5EB] border-b border-[#E6DCC8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E2704A]/10 text-[#E2704A] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-lora font-bold text-sm">{previewingSource.title}</h3>
                  <p className="text-[10px] text-[#8C7E6A]">{previewingSource.wordCount} • Loại: {previewingSource.type}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingSource(null)}
                className="p-1 rounded-lg text-[#8C7E6A] hover:bg-black/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 font-lora text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-[#2F3E6B] bg-[#FAF5EB]/20">
              {previewingSource.content}
            </div>
            <div className="px-6 py-3 bg-[#FAF5EB] border-t border-[#E6DCC8] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPreviewingSource(null)}
                className="px-4 py-1.5 rounded-xl bg-[#2F3E6B] text-white text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isEmbedded) {
    return studioBody;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#1E1B4B]/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {studioBody}
    </div>
  );
};
