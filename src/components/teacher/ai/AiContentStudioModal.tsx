import React, { useState, useEffect } from 'react';
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
  KeyRound,
  Zap,
  ExternalLink,
  Lightbulb,
  RotateCcw,
  Link2,
} from 'lucide-react';
import { AISource, aiService } from '../../../services/index.ts';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  getGeminiModel,
  setGeminiModel,
  testGeminiApiKey,
  getLastAiFallback,
  clearLastAiFallback,
} from '../../../services/ai/index.ts';
import { MamMuc } from '../../MamMuc.tsx';
import { SkillLevel, Difficulty, QuestionType, Question } from '../../../types.ts';

interface AiContentStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTypeInitial?: 'video' | 'theory' | 'quiz';
  topicId?: string;
  topicTitle?: string;
  isEmbedded?: boolean;
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
}) => {
  // 1. TRẠNG THÁI API KEY & AI THẬT
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

  // Nguồn ngữ liệu mặc định: Bài thơ "Cây dừa" (Trần Đăng Khoa)
  const DEFAULT_CAY_DUA_SOURCE: AISource = {
    id: 'src_cay_dua_default',
    title: 'Bài thơ: Cây dừa (Trần Đăng Khoa)',
    type: 'text',
    content: `Cây dừa xanh toả nhiều tàu,
Dang tay đón gió, gật đầu gọi trăng.
Thân dừa bạc phếch tháng năm,
Quả dừa – đàn lợn con nằm trên cao.

Đêm hè hoa nở cùng sao,
Tàu dừa – chiếc lược chải vào mây xanh.
Ai mang nước ngọt, nước lành,
Ai đeo bao hũ rượu quanh cổ dừa.

Tiếng dừa làm dịu nắng trưa,
Gọi đàn gió đến cùng dừa múa reo.
Trời trong đầy tiếng rì rào,
Đàn cò đánh nhịp bay vào bay ra...

Đứng canh trời đất bao la,
Mà dừa đủng đỉnh như là đứng chơi.`,
    wordCount: 104,
    isEnabled: true,
    createdAt: new Date().toISOString(),
  };

  // 2. STATE NGUỒN TÀI LIỆU (VÙNG TRÁI) - LƯU LOCALSTORAGE THEO CHỦ ĐỀ
  const sourcesStorageKey = `mamvan_ai_sources_${topicId}`;
  const [sources, setSources] = useState<AISource[]>(() => {
    try {
      const saved = localStorage.getItem(`mamvan_ai_sources_${topicId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc nguồn tài liệu từ localStorage:', e);
    }
    return [DEFAULT_CAY_DUA_SOURCE];
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
      const saved = localStorage.getItem(`mamvan_ai_sources_${topicId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSources(parsed);
          return;
        }
      }
      setSources([DEFAULT_CAY_DUA_SOURCE]);
    } catch (e) {
      console.warn(e);
    }
  }, [topicId]);

  const [activeTabSourceInput, setActiveTabSourceInput] = useState<'paste' | 'file' | 'video'>('paste');
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [showAddSourceForm, setShowAddSourceForm] = useState(false);
  const [unsupportedFileNotice, setUnsupportedFileNotice] = useState<string | null>(null);
  const [previewingSource, setPreviewingSource] = useState<AISource | null>(null);

  // 3. STATE TRÒ CHUYỆN VỚI NGUỒN (VÙNG GIỮA) - LƯU LOCALSTORAGE THEO CHỦ ĐỀ
  const chatStorageKey = `mamvan_ai_chat_history_${topicId}`;
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; text: string; citations?: { sourceTitle: string; snippet: string }[] }[]
  >(() => {
    try {
      const saved = localStorage.getItem(`mamvan_ai_chat_history_${topicId}`);
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
        text: 'Xin chào thầy/cô! Tôi là trợ lý Mầm AI Studio. Tôi đã đọc các tài liệu nguồn bên trái. Thầy/cô có thể đặt câu hỏi hoặc chọn các câu hỏi gợi ý bên dưới để tra cứu chi tiết.',
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

  // STATE XEM TRƯỚC VÀ PHÊ DUYỆT BỘ CÂU HỎI AI VỪA TẠO
  const [reviewDraftQuestions, setReviewDraftQuestions] = useState<Question[] | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);

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

  // Đọc file .txt
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        setSources([
          ...sources,
          {
            id: 'src_file_' + Date.now(),
            title: file.name.replace('.txt', ''),
            type: 'file',
            content: text,
            wordCount,
            isEnabled: true,
            fileName: file.name,
            createdAt: new Date().toISOString(),
          },
        ]);
        setUnsupportedFileNotice(null);
      };
      reader.readAsText(file);
    } else {
      setUnsupportedFileNotice(`Định dạng "${file.name}" sắp được hỗ trợ. Hiện tại vui lòng dùng file .txt hoặc dán nội dung trực tiếp.`);
    }
  };

  // Xoá lịch sử trò chuyện của chủ đề hiện tại
  const handleClearChatHistory = () => {
    if (window.confirm('Thầy/cô có muốn xoá toàn bộ lịch sử trò chuyện của chủ đề này để làm mới cuộc hội thoại không?')) {
      const initialChat = [
        {
          role: 'assistant' as const,
          text: 'Xin chào thầy/cô! Tôi là trợ lý Mầm AI Studio. Tôi đã đọc các tài liệu nguồn bên trái. Thầy/cô có thể đặt câu hỏi hoặc chọn các câu hỏi gợi ý bên dưới để tra cứu chi tiết.',
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
    const questionsToSave = reviewDraftQuestions.filter((q) => selectedDraftIds.includes(q.id));
    if (questionsToSave.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 câu hỏi để lưu vào Ngân hàng câu hỏi.');
      return;
    }

    onApplyDraft({
      type: 'quiz',
      data: {
        title: `Bộ câu hỏi: ${topicTitle} (Sinh bởi Gemini AI)`,
        kind: 'quick',
        topicId,
        timeLimitMinutes: Math.max(7, questionsToSave.length),
        xp: questionsToSave.length * 5,
        questions: questionsToSave,
        isAiGenerated: true,
        isTeacherReviewed: true,
      },
    });

    setReviewDraftQuestions(null);
    onClose();
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

  // Lưu API Key từ Modal Quick
  const handleSaveModalKey = () => {
    setGeminiApiKey(modalKeyInput);
    setGeminiModel(modalModelInput);
    const keyValid = !!modalKeyInput.trim();
    setHasApiKey(keyValid);
    setActiveModel(modalModelInput);
    setShowApiKeyModal(false);
    alert(
      keyValid
        ? 'Đã kích hoạt Google AI Studio (Gemini) thật! Bây giờ AI sẽ đọc ngữ liệu và sinh nội dung trực tiếp.'
        : 'Đã xóa API Key.'
    );
  };

  // Kiểm tra kết nối trong Modal Quick
  const handleTestModalKey = async () => {
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
      setKeyTestResult({
        success: false,
        message: err.message || 'Lỗi mạng khi kiểm tra.',
        latencyMs: 0,
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Sinh bản nháp từ AI
  const handleGenerateDraft = async () => {
    const activeSources = sources.filter((s) => s.isEnabled);
    if (activeSources.length === 0) {
      alert('Vui lòng bật ít nhất 1 nguồn tài liệu bên cột trái để AI làm căn cứ tạo nội dung.');
      return;
    }

    // Kiểm tra xem đã có API Key chưa
    if (!getGeminiApiKey()) {
      alert('⚠️ Chưa cấu hình Google AI Studio API Key! Vui lòng dán API Key để kích hoạt AI thật sinh câu hỏi theo đúng ngữ liệu của thầy/cô.');
      setShowApiKeyModal(true);
      return;
    }

    clearLastAiFallback();
    setIsGenerating(true);
    setGenerationStep('Gemini AI đang đọc và phân tích cấu trúc văn bản nguồn...');

    try {
      if (outputType === 'video') {
        setGenerationStep('Đang trích xuất các ý kiến thức trọng tâm bài giảng và ví dụ minh họa...');
        const keyPoints = await aiService.generateKeySummary(activeSources, {
          focusTopic: topicTitle,
          includeExamples: true,
        });

        const fbVideo = getLastAiFallback();
        if (fbVideo) {
          alert(`⚠️ Gemini AI lỗi (${fbVideo.reason}). Nội dung vừa tạo là BẢN DỰ PHÒNG mẫu, chưa bám ngữ liệu nguồn — thầy/cô kiểm tra kỹ hoặc thử lại sau.`);
        }
        setGenerationStep('Hoàn tất! Đang đưa vào trình chỉnh sửa video...');
        setTimeout(() => {
          setIsGenerating(false);
          onApplyDraft({
            type: 'video',
            data: {
              title: `Bài giảng: Tìm hiểu ${topicTitle} ${fbVideo ? '(Bản dự phòng — Gemini lỗi)' : '(Sinh bởi Gemini AI)'}`,
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
          alert(`⚠️ Gemini AI lỗi (${fbTheory.reason}). Nội dung vừa tạo là BẢN DỰ PHÒNG mẫu, chưa bám ngữ liệu nguồn — thầy/cô kiểm tra kỹ hoặc thử lại sau.`);
        }
        setGenerationStep('Hoàn tất! Đang chuyển sang trình soạn thảo lý thuyết...');
        setTimeout(() => {
          setIsGenerating(false);
          onApplyDraft({
            type: 'theory',
            data: {
              title: `Lý thuyết chuyên sâu: ${topicTitle} ${fbTheory ? '(Bản dự phòng — Gemini lỗi)' : '(Sinh bởi Gemini AI)'}`,
              kind: 'general_topic',
              minReadSeconds: 180,
              blocks,
              isAiGenerated: true,
              isTeacherReviewed: false,
            },
          });
          onClose();
        }, 600);
      } else {
        setGenerationStep(`Gemini AI đang soạn bộ câu hỏi 4 mức năng lực (${totalQuestions} câu)...`);
        const questions = await aiService.generateQuestions(activeSources, {
          topicTitle,
          totalQuestions,
          typeCounts,
          difficulty,
        });

        const fbQuestions = getLastAiFallback();
        if (fbQuestions) {
          alert(`⚠️ Gemini AI lỗi (${fbQuestions.reason}). Bộ câu hỏi vừa tạo là BẢN DỰ PHÒNG mẫu, chưa bám ngữ liệu nguồn — thầy/cô duyệt kỹ từng câu trước khi lưu.`);
        }

        const processedQuestions = questions.map((q) => ({
          ...q,
          isAiGenerated: true,
          isTeacherReviewed: false,
          aiSourceSnippet: q.aiSourceSnippet || activeSources[0].content.slice(0, 100),
        }));

        setGenerationStep('Hoàn tất! Đang mở bản xem trước...');
        setTimeout(() => {
          setIsGenerating(false);
          setReviewDraftQuestions(processedQuestions);
          setSelectedDraftIds(processedQuestions.map((q) => q.id));
        }, 400);
      }
    } catch (e: any) {
      console.error('Lỗi sinh bản nháp AI:', e);
      alert(`⚠️ Lỗi sinh nội dung AI: ${e.message || 'Lỗi mạng hoặc API Key chưa hợp lệ'}. Vui lòng bấm vào nút cấu hình API Key để kiểm tra lại.`);
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
                Xưởng Sáng Tạo AI Mầm Văn
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF5EB] text-[#E2704A] border border-[#E2704A]/30">
                Mầm AI Studio
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0D9488]/10 text-[#0D9488]">
                Chủ đề: {topicTitle}
              </span>
            </div>
            <p className="text-xs text-[#8C7E6A]">
              Tải lên nguồn ngữ liệu, đối chiếu trích dẫn và sinh bản nháp chuẩn sư phạm Ngữ văn 7
            </p>
          </div>
        </div>

        {/* NÚT TRẠNG THÁI AI & ĐÓNG MODAL */}
        <div className="flex items-center gap-2">
          {hasApiKey ? (
            <button
              type="button"
              onClick={() => {
                setModalKeyInput(getGeminiApiKey());
                setModalModelInput(getGeminiModel());
                setKeyTestResult(null);
                setShowApiKeyModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cấu hình Google AI Studio API Key"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
              <span>🟢 Gemini AI Thật ({activeModel})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setModalKeyInput(getGeminiApiKey());
                setModalModelInput(getGeminiModel());
                setKeyTestResult(null);
                setShowApiKeyModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer animate-pulse"
              title="Bấm để kích hoạt AI thật bằng API Key của bạn"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>🔑 Kích hoạt AI Thật (Nhập Key)</span>
            </button>
          )}

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

      {/* NỘI DUNG 3 VÙNG CHUẨN NOTEBOOKLM HOẶC MÀN HÌNH DUYỆT BẢN NHÁP CÂU HỎI */}
      {reviewDraftQuestions ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#FAF5EB]/30">
          {/* Thanh công cụ xem trước */}
          <div className="px-6 py-3.5 bg-white border-b border-[#E6DCC8] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReviewDraftQuestions(null)}
                className="px-3 py-1.5 rounded-xl bg-[#FAF5EB] hover:bg-[#E6DCC8]/50 text-xs font-bold text-[#2F3E6B] border border-[#E6DCC8] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                <span>Quay lại xưởng</span>
              </button>
              <div>
                <h3 className="text-sm font-bold text-[#2F3E6B] flex items-center gap-2">
                  <span>Duyệt bộ câu hỏi AI vừa tạo</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#E2704A]/10 text-[#E2704A] border border-[#E2704A]/20">
                    {reviewDraftQuestions.length} câu hỏi
                  </span>
                </h3>
                <p className="text-[11px] text-[#8C7E6A]">
                  Kiểm tra nội dung các câu hỏi vừa tạo, tích chọn những câu ưng ý để lưu vào Ngân hàng.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
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
                          : 'Tự luận'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0D9488]/10 text-[#0D9488]">
                        {q.level === 'NHAN_BIET'
                          ? 'Nhận biết'
                          : q.level === 'THONG_HIEU'
                          ? 'Thông hiểu'
                          : q.level === 'PHAN_TICH'
                          ? 'Phân tích'
                          : 'Vận dụng'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {q.difficulty === 'DE' ? 'Dễ' : q.difficulty === 'TB' ? 'Trung bình' : 'Khó'}
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

                  {/* Đề bài */}
                  <p className="text-xs font-bold text-[#2F3E6B] leading-relaxed mb-2.5">{q.prompt}</p>

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
              onClick={() => setReviewDraftQuestions(null)}
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
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#2F3E6B] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#E2704A]" />
                <span>1. Nguồn tài liệu ({sources.length})</span>
              </h3>
              <p className="text-[11px] text-[#8C7E6A] mt-0.5">
                Đã bật {sources.filter((s) => s.isEnabled).length}/{sources.length} nguồn ({totalEnabledWords} từ)
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
                  Tải file (.txt)
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
                    <span className="text-xs font-bold text-[#2F3E6B]">Chọn tệp văn bản (.txt)</span>
                    <span className="text-[10px] text-[#8C7E6A]">Hỗ trợ file .txt chứa văn bản bài học</span>
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
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
                  <button
                    type="button"
                    onClick={() => setSources([DEFAULT_CAY_DUA_SOURCE])}
                    className="px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-[#2F3E6B] text-xs font-bold hover:bg-black/5 transition-colors"
                  >
                    Khôi phục bài thơ "Cây dừa"
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
                      }}
                      className="mt-0.5 rounded text-[#E2704A] focus:ring-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#2F3E6B] truncate">{src.title}</p>
                      <p className="text-[10px] text-[#8C7E6A] flex items-center gap-1.5 mt-0.5">
                        <span>{src.wordCount} từ</span>
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
                      onClick={() => setSources(sources.filter((s) => s.id !== src.id))}
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
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#2F3E6B]">
                2. Trò chuyện & Tra cứu tài liệu (RAG Grounding)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#8C7E6A] italic hidden sm:inline">
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
                <span>Gemini AI đang đọc tài liệu nguồn và trích xuất câu trả lời...</span>
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
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#2F3E6B] flex items-center gap-1.5">
              <Wand2 className="w-4 h-4 text-[#E2704A]" />
              <span>3. Xưởng tạo đầu ra</span>
            </h3>
            <p className="text-[11px] text-[#8C7E6A] mt-0.5">
              Cấu hình định dạng và tiêu chí sinh tự động
            </p>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* LỰA CHỌN LOẠI ĐẦU RA */}
            <div>
              <label className="text-xs font-bold text-[#2F3E6B] block mb-1.5">Loại nội dung cần tạo:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOutputType('quiz')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
                    outputType === 'quiz'
                      ? 'bg-white border-[#E2704A] text-[#E2704A] font-bold shadow-xs'
                      : 'bg-white/50 border-[#E6DCC8] text-[#8C7E6A]'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-[11px]">Bộ câu hỏi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOutputType('video')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
                    outputType === 'video'
                      ? 'bg-white border-[#E2704A] text-[#E2704A] font-bold shadow-xs'
                      : 'bg-white/50 border-[#E6DCC8] text-[#8C7E6A]'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span className="text-[11px]">Ý trọng tâm video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOutputType('theory')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
                    outputType === 'theory'
                      ? 'bg-white border-[#E2704A] text-[#E2704A] font-bold shadow-xs'
                      : 'bg-white/50 border-[#E6DCC8] text-[#8C7E6A]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="text-[11px]">Lý thuyết chi tiết</span>
                </button>
              </div>
            </div>

            {/* CẤU HÌNH BỘ CÂU HỎI */}
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
                    <span>{generationStep || 'Gemini AI đang làm việc...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Tạo bản nháp với Gemini AI Thật</span>
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
      {showApiKeyModal && (
        <div className="fixed inset-0 z-60 bg-[#1E1B4B]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-2xl p-6 space-y-4 text-[#2F3E6B] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DCC8]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E2704A]/10 text-[#E2704A] flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-lora font-bold text-base">Cấu hình Google AI Studio API Key</h3>
                  <p className="text-[11px] text-[#8C7E6A]">Kích hoạt Gemini AI thật cho toàn hệ thống Mầm Văn</p>
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
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Mô hình AI (Model)</label>
                <select
                  value={modalModelInput}
                  onChange={(e) => setModalModelInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold"
                >
                  <option value="gemini-flash-latest">gemini-flash-latest (Khuyên dùng - Chuẩn Google AI Studio)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Thế hệ mới 2.5 - Siêu tốc)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (Ổn định & Thông minh)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Bản tiêu chuẩn)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (Suy luận chuyên sâu cao cấp)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Ngữ văn phân tích sâu)</option>
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
                onClick={handleTestModalKey}
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
                  onClick={handleSaveModalKey}
                  className="px-4 py-2 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Lưu & Kích hoạt AI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-[10px] text-[#8C7E6A]">{previewingSource.wordCount} từ • Loại: {previewingSource.type}</p>
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
