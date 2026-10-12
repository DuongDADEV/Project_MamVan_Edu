import React, { useState } from 'react';
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
  BookOpen,
  Sliders,
  Check,
  RefreshCw,
  Quote,
} from 'lucide-react';
import { AISource, aiService } from '../../../services/index.ts';
import { MamMuc } from '../../MamMuc.tsx';
import { SkillLevel, Difficulty, QuestionType } from '../../../types.ts';

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

export const AiContentStudioModal: React.FC<AiContentStudioModalProps> = ({
  isOpen,
  onClose,
  targetTypeInitial = 'quiz',
  topicId = 'topic_tho_bon_nam',
  topicTitle = 'Thơ bốn chữ, năm chữ',
  isEmbedded = false,
  onApplyDraft,
}) => {
  // 1. STATE NGUỒN TÀI LIỆU (VÙNG TRÁI)
  const [sources, setSources] = useState<AISource[]>([
    {
      id: 'src_demo_01',
      title: 'Văn bản "Tiếng gà trưa" - Xuân Quỳnh',
      type: 'text',
      content: `Trên đường hành quân xa
Dừng chân bên xóm nhỏ
Tiếng gà ai nhảy ổ:
"Cục... cục tác cục ta"
Nghe xao động nắng trưa
Nghe bàn chân đỡ mỏi
Nghe gọi về tuổi thơ.

Tiếng gà trưa
Ổ rơm hồng những trứng
Này con gà mái mơ
Khắp mình hoa đốm trắng
Này con gà mái vàng
Lông óng như màu nắng.

Tiếng gà trưa
Mang bao nhiêu hạnh phúc
Đêm cháu về nằm mơ
Giấc ngủ hồng sắc trứng.

Cháu chiến đấu hôm nay
Vì lòng yêu Tổ quốc
Vì xóm làng thân thuộc
Bà ơi, cũng vì bà
Vì tiếng gà cục tác
Ổ trứng hồng tuổi thơ.`,
      wordCount: 96,
      isEnabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'src_demo_02',
      title: 'Ghi chú bài giảng: Đặc trưng thể thơ 5 chữ',
      type: 'transcript',
      content: `Thể thơ năm chữ (ngũ ngôn) mỗi dòng có 5 tiếng, nhịp thơ linh hoạt thường là 3/2 hoặc 2/3. Thơ năm chữ thích hợp để vừa kể chuyện vừa bộc lộ cảm xúc tâm tình tha thiết, gần gũi như lời tâm sự chân thành. Vần thơ có thể là vần liền hoặc vần cách, giàu tính nhạc.`,
      wordCount: 62,
      isEnabled: true,
      createdAt: new Date().toISOString(),
    },
  ]);

  const [activeTabSourceInput, setActiveTabSourceInput] = useState<'paste' | 'file' | 'video'>('paste');
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [showAddSourceForm, setShowAddSourceForm] = useState(false);
  const [unsupportedFileNotice, setUnsupportedFileNotice] = useState<string | null>(null);

  // 2. STATE TRÒ CHUYỆN VỚI NGUỒN (VÙNG GIỮA)
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; text: string; citations?: { sourceTitle: string; snippet: string }[] }[]
  >([
    {
      role: 'assistant',
      text: 'Xin chào thầy/cô! Tôi đã đọc các tài liệu nguồn bên trái. Thầy/cô có thể đặt câu hỏi để kiểm tra nội dung hoặc yêu cầu tôi trích dẫn các ý quan trọng trước khi tạo bài.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // 3. STATE XƯỞNG TẠO (VÙNG PHẢI)
  const [outputType, setOutputType] = useState<'video' | 'theory' | 'quiz'>(targetTypeInitial);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [targetQuizKind, setTargetQuizKind] = useState<'quick' | 'mastery' | 'practice'>('quick');

  // Số lượng từng dạng câu hỏi
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

  // Tỉ lệ mức năng lực (tổng 100%)
  const [skillRatios, setSkillRatios] = useState({
    nhanBiet: 30,
    thongHieu: 30,
    phanTich: 20,
    vanDung: 20,
  });

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

  // Trò chuyện với nguồn
  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
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
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Xin lỗi, không thể tra cứu lúc này. Vui lòng kiểm tra lại các nguồn tài liệu đã bật.',
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

    setIsGenerating(true);
    setGenerationStep('Đang phân tích cấu trúc văn bản nguồn...');

    try {
      if (outputType === 'video') {
        setGenerationStep('Đang trích xuất các ý kiến thức trọng tâm và ví dụ minh họa...');
        const keyPoints = await aiService.generateKeySummary(activeSources, {
          focusTopic: topicTitle,
          includeExamples: true,
        });

        setGenerationStep('Hoàn tất! Đang đưa vào trình chỉnh sửa video...');
        setTimeout(() => {
          setIsGenerating(false);
          onApplyDraft({
            type: 'video',
            data: {
              title: `Bài giảng: Tìm hiểu ${topicTitle} (Bản nháp AI)`,
              description: `Video bài giảng bám sát ngữ liệu: ${activeSources[0].title}.`,
              durationSec: 12 * 60,
              subtopics: [topicTitle, 'Đặc trưng thể loại'],
              summaryPoints: keyPoints,
              isAiGenerated: true,
              isTeacherReviewed: false,
            },
          });
          onClose();
        }, 800);
      } else if (outputType === 'theory') {
        setGenerationStep('Đang xây dựng khối lý thuyết theo chuẩn GDPT 2018...');
        const blocks = await aiService.generateTheory(activeSources, {
          topicTitle,
          depth: 'detailed',
          includeExamples: true,
        });

        setGenerationStep('Hoàn tất! Đang chuyển sang trình soạn thảo lý thuyết...');
        setTimeout(() => {
          setIsGenerating(false);
          onApplyDraft({
            type: 'theory',
            data: {
              title: `Lý thuyết chuyên sâu: ${topicTitle} (Bản nháp AI)`,
              kind: 'general_topic',
              minReadSeconds: 180,
              blocks,
              isAiGenerated: true,
              isTeacherReviewed: false,
            },
          });
          onClose();
        }, 800);
      } else {
        setGenerationStep(`Đang sinh bộ câu hỏi 4 mức năng lực (${totalQuestions} câu)...`);
        const questions = await aiService.generateQuestions(activeSources, {
          topicTitle,
          totalQuestions,
          difficulty,
        });

        // Đảm bảo gắn cờ AI và nguồn tham chiếu
        const processedQuestions = questions.map((q) => ({
          ...q,
          isAiGenerated: true,
          isTeacherReviewed: false,
          aiSourceSnippet: q.aiSourceSnippet || activeSources[0].content.slice(0, 100),
        }));

        setGenerationStep('Hoàn tất! Đang đưa vào trình tạo bài tập...');
        setTimeout(() => {
          setIsGenerating(false);
          onApplyDraft({
            type: 'quiz',
            data: {
              title: `${targetQuizKind === 'quick' ? 'Kiểm tra nhanh' : targetQuizKind === 'mastery' ? 'Mastery Check' : 'Luyện tập'}: ${topicTitle} (Bản nháp AI)`,
              kind: targetQuizKind,
              topicId,
              timeLimitMinutes: targetQuizKind === 'quick' ? 7 : 15,
              xp: targetQuizKind === 'quick' ? 25 : 50,
              questions: processedQuestions,
              isAiGenerated: true,
              isTeacherReviewed: false,
            },
          });
          onClose();
        }, 800);
      }
    } catch (e) {
      console.error('Lỗi sinh bản nháp AI:', e);
      alert('Đã xảy ra lỗi khi tạo nội dung với AI. Vui lòng thử lại.');
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
            <div className="flex items-center gap-2">
              <h2 className="font-lora font-bold text-lg text-[#2F3E6B]">
                Xưởng Sáng Tạo AI Mầm Văn
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF5EB] text-[#E2704A] border border-[#E2704A]/30">
                NotebookLM Style
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
        {!isEmbedded && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8C7E6A] hover:text-[#2F3E6B] hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        {/* NỘI DUNG 3 VÙNG */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#E6DCC8]">
          {/* ========================================================= */}
          {/* VÙNG 1: NGUỒN TÀI LIỆU (BÊN TRÁI ~ 310px) */}
          {/* ========================================================= */}
          <div className="w-full md:w-[320px] lg:w-[340px] flex flex-col shrink-0 bg-[#FAF5EB]/50">
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
                className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#E2704A] hover:bg-[#FAF5EB] transition-colors"
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
                    Bản ghi video
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
                      <span className="text-[10px] text-[#8C7E6A]">(.docx / .pdf sắp hỗ trợ)</span>
                      <input
                        type="file"
                        accept=".txt,.docx,.pdf"
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
                  <textarea
                    rows={4}
                    placeholder={
                      activeTabSourceInput === 'video'
                        ? 'Dán phụ đề hoặc bản ghi âm lời giảng video vào đây...'
                        : 'Dán bài thơ, truyện ngắn, trích đoạn văn bản vào đây...'
                    }
                    value={newSourceContent}
                    onChange={(e) => setNewSourceContent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] outline-none focus:border-[#E2704A] resize-none"
                  />
                )}

                {activeTabSourceInput !== 'file' && (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddSourceForm(false)}
                      className="px-3 py-1 rounded-xl text-xs text-[#8C7E6A] hover:bg-black/5"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSource}
                      disabled={!newSourceContent.trim()}
                      className="px-3.5 py-1 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors"
                    >
                      Lưu nguồn
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Danh sách nguồn */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {sources.map((src) => (
                <div
                  key={src.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    src.isEnabled
                      ? 'bg-white border-[#E6DCC8] shadow-xs'
                      : 'bg-[#FAF5EB]/40 border-dashed border-[#E6DCC8] opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={src.isEnabled}
                        onChange={(e) => {
                          setSources(
                            sources.map((s) => (s.id === src.id ? { ...s, isEnabled: e.target.checked } : s))
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
                    <button
                      type="button"
                      onClick={() => setSources(sources.filter((s) => s.id !== src.id))}
                      className="text-[#8C7E6A] hover:text-rose-600 p-1 transition-colors"
                      title="Xóa nguồn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8C7E6A] mt-2 line-clamp-2 italic bg-[#FAF5EB] p-2 rounded-xl">
                    "{src.content.slice(0, 100)}..."
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================= */}
          {/* VÙNG 2: TRÒ CHUYỆN VỚI NGUỒN (Ở GIỮA) */}
          {/* ========================================================= */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            <div className="p-4 border-b border-[#E6DCC8] flex items-center justify-between bg-[#FAF5EB]/30">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#0D9488]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#2F3E6B]">
                  2. Trò chuyện & Tra cứu tài liệu
                </h3>
              </div>
              <span className="text-[10px] text-[#8C7E6A] italic">
                AI chỉ trả lời dựa trên các nguồn đã bật
              </span>
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
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Chú thích nguồn tham chiếu */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-[#E6DCC8] space-y-1">
                        <p className="text-[10px] font-bold text-[#8C7E6A] uppercase flex items-center gap-1">
                          <Quote className="w-3 h-3 text-[#E2704A]" />
                          <span>Nguồn tham chiếu:</span>
                        </p>
                        {msg.citations.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="bg-white/70 p-1.5 rounded-lg border border-[#E6DCC8] text-[11px] text-[#2F3E6B]"
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
                <div className="flex gap-2 items-center text-xs text-[#8C7E6A] italic">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0D9488]" />
                  <span>AI đang tra cứu tài liệu nguồn...</span>
                </div>
              )}
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
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isChatLoading}
                className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0B7A70] disabled:opacity-40 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Hỏi</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* VÙNG 3: XƯỞNG TẠO (BÊN PHẢI ~ 380px) */}
          {/* ========================================================= */}
          <div className="w-full md:w-[380px] lg:w-[410px] flex flex-col shrink-0 bg-[#FAF5EB]/70 overflow-y-auto">
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
              {/* Chọn loại đầu ra */}
              <div>
                <label className="text-xs font-bold text-[#2F3E6B] block mb-1.5">
                  Loại nội dung cần tạo:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'quiz', label: 'Bộ câu hỏi', icon: HelpCircle },
                    { id: 'video', label: 'Ý trọng tâm video', icon: Video },
                    { id: 'theory', label: 'Lý thuyết chi tiết', icon: BookOpen },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setOutputType(t.id as any)}
                      className={`p-2.5 rounded-2xl border text-center transition-all ${
                        outputType === t.id
                          ? 'bg-white border-[#E2704A] text-[#E2704A] shadow-xs ring-1 ring-[#E2704A]'
                          : 'bg-white/60 border-[#E6DCC8] text-[#8C7E6A] hover:bg-white'
                      }`}
                    >
                      <t.icon className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-[11px] font-bold block">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tùy chỉnh chi tiết nếu chọn BỘ CÂU HỎI */}
              {outputType === 'quiz' && (
                <div className="space-y-4 bg-white p-4 rounded-2xl border border-[#E6DCC8]">
                  {/* Loại bài đích */}
                  <div>
                    <label className="text-xs font-bold text-[#2F3E6B] block mb-1">
                      Loại bài kiểm tra đích:
                    </label>
                    <select
                      value={targetQuizKind}
                      onChange={(e) => {
                        const kind = e.target.value as any;
                        setTargetQuizKind(kind);
                        if (kind === 'quick') setTotalQuestions(5);
                        else if (kind === 'mastery') setTotalQuestions(10);
                        else setTotalQuestions(5);
                      }}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
                    >
                      <option value="quick">Kiểm tra nhanh (mặc định 5 câu / 7 phút)</option>
                      <option value="mastery">Mastery Check (mặc định 10 câu / 15 phút)</option>
                      <option value="practice">Luyện tập sau video</option>
                    </select>
                  </div>

                  {/* Số lượng câu */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-[#2F3E6B]">Tổng số câu:</span>
                      <span className="font-bold text-[#E2704A]">{totalQuestions} câu</span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={12}
                      value={totalQuestions}
                      onChange={(e) => setTotalQuestions(Number(e.target.value))}
                      className="w-full accent-[#E2704A]"
                    />
                  </div>

                  {/* Phân bổ dạng câu */}
                  <div>
                    <label className="text-xs font-bold text-[#2F3E6B] block mb-1">
                      Dạng câu hỏi dự kiến:
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] flex items-center justify-between">
                        <span>Trắc nghiệm (1 đáp án):</span>
                        <input
                          type="number"
                          min={0}
                          max={totalQuestions}
                          value={typeCounts.single}
                          onChange={(e) => setTypeCounts({ ...typeCounts, single: Number(e.target.value) })}
                          className="w-10 px-1 py-0.5 rounded bg-white text-center font-bold"
                        />
                      </div>
                      <div className="p-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] flex items-center justify-between">
                        <span>Chọn nhiều đáp án:</span>
                        <input
                          type="number"
                          min={0}
                          max={totalQuestions}
                          value={typeCounts.multi}
                          onChange={(e) => setTypeCounts({ ...typeCounts, multi: Number(e.target.value) })}
                          className="w-10 px-1 py-0.5 rounded bg-white text-center font-bold"
                        />
                      </div>
                      <div className="p-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] flex items-center justify-between">
                        <span>Điền vào ô trống:</span>
                        <input
                          type="number"
                          min={0}
                          max={totalQuestions}
                          value={typeCounts.fill}
                          onChange={(e) => setTypeCounts({ ...typeCounts, fill: Number(e.target.value) })}
                          className="w-10 px-1 py-0.5 rounded bg-white text-center font-bold"
                        />
                      </div>
                      <div className="p-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] flex items-center justify-between">
                        <span>Viết đoạn văn (rubric):</span>
                        <input
                          type="number"
                          min={0}
                          max={totalQuestions}
                          value={typeCounts.essay}
                          onChange={(e) => setTypeCounts({ ...typeCounts, essay: Number(e.target.value) })}
                          className="w-10 px-1 py-0.5 rounded bg-white text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4 Mức năng lực GDPT 2018 */}
                  <div>
                    <label className="text-xs font-bold text-[#2F3E6B] block mb-1">
                      Phân bổ 4 mức năng lực:
                    </label>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-sky-700 font-bold">Nhận biết:</span>
                        <span>{skillRatios.nhanBiet}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                        <div style={{ width: `${skillRatios.nhanBiet}%` }} className="bg-sky-500" />
                        <div style={{ width: `${skillRatios.thongHieu}%` }} className="bg-emerald-500" />
                        <div style={{ width: `${skillRatios.phanTich}%` }} className="bg-amber-500" />
                        <div style={{ width: `${skillRatios.vanDung}%` }} className="bg-rose-500" />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#8C7E6A] pt-1">
                        <span className="text-sky-600 font-medium">NB: {skillRatios.nhanBiet}%</span>
                        <span className="text-emerald-600 font-medium">TH: {skillRatios.thongHieu}%</span>
                        <span className="text-amber-600 font-medium">PT: {skillRatios.phanTich}%</span>
                        <span className="text-rose-600 font-medium">VD: {skillRatios.vanDung}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Độ khó */}
                  <div>
                    <label className="text-xs font-bold text-[#2F3E6B] block mb-1">
                      Độ khó tổng thể:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'DE', label: 'Dễ' },
                        { id: 'TB', label: 'Trung bình' },
                        { id: 'KHO', label: 'Khó' },
                      ].map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDifficulty(d.id as Difficulty)}
                          className={`py-1 text-xs rounded-xl border font-bold transition-colors ${
                            difficulty === d.id
                              ? 'bg-[#2F3E6B] text-white border-[#2F3E6B]'
                              : 'bg-[#FAF5EB] text-[#8C7E6A] border-[#E6DCC8]'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Thông tin quy tắc cam kết */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-[#2F3E6B] space-y-1.5">
                <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Quy tắc sư phạm Mầm Văn:</span>
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Kết quả do AI tạo sẽ là <strong>bản nháp</strong>. Hệ thống sẽ gắn nhãn <em>"Tạo bởi AI – cần giáo viên duyệt"</em> và trích đoạn nguồn tham chiếu để thầy/cô đối chiếu, chỉnh sửa trước khi xuất bản lên web học sinh.
                </p>
              </div>
            </div>

            {/* Nút hành động chính */}
            <div className="p-4 border-t border-[#E6DCC8] bg-white space-y-2">
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={isGenerating || sources.filter((s) => s.isEnabled).length === 0}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#E2704A] to-[#D45E36] hover:from-[#D45E36] hover:to-[#C34F28] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{generationStep || 'Đang tạo nội dung...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Tạo bản nháp với AI</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-[#8C7E6A]">
                Sau khi tạo, bản nháp sẽ mở trực tiếp trong trình biên tập thủ công.
              </p>
          </div>
        </div>
      </div>
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
