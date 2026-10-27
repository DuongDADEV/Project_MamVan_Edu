import React, { useState, useEffect, useRef } from 'react';
import {
  VideoLessonWithMeta,
  TopicWithMeta,
  QuizWithMeta,
  VideoFocusPoint,
} from '../../../services/types.ts';
import { StatusBadge } from './StatusBadge.tsx';
import {
  ArrowLeft,
  Video,
  Upload,
  Link as LinkIcon,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Eye,
  UploadCloud,
  Save,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  FileQuestion,
  Layers,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { uploadLessonMedia } from '../../../services/api/storageClient.ts';

interface VideoLessonEditorProps {
  video: VideoLessonWithMeta;
  topics: TopicWithMeta[];
  quizzes: QuizWithMeta[];
  onSave: (updated: Partial<VideoLessonWithMeta>) => Promise<void>;
  onPublish: () => void;
  onPreviewStudent: () => void;
  onCreateLinkedQuiz: (kind: 'practice' | 'quick' | 'mastery') => void;
  onBack?: () => void;
}

export const VideoLessonEditor: React.FC<VideoLessonEditorProps> = ({
  video,
  topics,
  quizzes,
  onSave,
  onPublish,
  onPreviewStudent,
  onCreateLinkedQuiz,
  onBack,
}) => {
  const [title, setTitle] = useState(video.title || '');
  const [description, setDescription] = useState(video.description || '');
  const [topicId, setTopicId] = useState(video.topicId || topics[0]?.id || '');
  const [durationSec, setDurationSec] = useState<number>(video.durationSec || 600);
  const [sampleUrl, setSampleUrl] = useState(video.sampleUrl || '');

  const [subtopicsText, setSubtopicsText] = useState(video.subtopics?.join(', ') || '');
  const [summaryPoints, setSummaryPoints] = useState<VideoFocusPoint[]>(
    video.summaryPoints && video.summaryPoints.length > 0
      ? video.summaryPoints
      : [{ title: 'Khái niệm trọng tâm', content: '', example: '' }]
  );
  const [practiceQuizId, setPracticeQuizId] = useState(video.practiceQuizId || '');
  const [quickTestId, setQuickTestId] = useState(video.quickTestId || '');
  const [masteryCheckId, setMasteryCheckId] = useState(video.masteryCheckId || '');

  // Giả lập tiến độ tải video lên
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Trạng thái lưu
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Bản nháp hiện tại + bản đã lưu gần nhất (autosave chỉ ghi khi đổi).
  // videoRef giữ prop mới nhất cho các closure chạy sau unmount.
  const videoRef = useRef(video);
  videoRef.current = video;
  const draftRef = useRef({
    title: video.title || '',
    description: video.description || '',
    topicId: video.topicId || topics[0]?.id || '',
    durationSec: video.durationSec || 600,
    sampleUrl: video.sampleUrl || '',
    subtopicsText: video.subtopics?.join(', ') || '',
    summaryPoints: video.summaryPoints && video.summaryPoints.length > 0
      ? video.summaryPoints
      : [{ title: 'Khái niệm trọng tâm', content: '', example: '' }],
    practiceQuizId: video.practiceQuizId || '',
    quickTestId: video.quickTestId || '',
    masteryCheckId: video.masteryCheckId || '',
  });
  const savedJsonRef = useRef<string>(JSON.stringify(draftRef.current));
  const savingRef = useRef(false);

  // Hidden file inputs
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const videoProbeRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setTitle(video.title || '');
    setDescription(video.description || '');
    setTopicId(video.topicId || topics[0]?.id || '');
    setDurationSec(video.durationSec || 600);
    setSampleUrl(video.sampleUrl || '');

    setSubtopicsText(video.subtopics?.join(', ') || '');
    setSummaryPoints(
      video.summaryPoints && video.summaryPoints.length > 0
        ? video.summaryPoints
        : [{ title: 'Khái niệm trọng tâm', content: '', example: '' }]
    );
    setPracticeQuizId(video.practiceQuizId || '');
    setQuickTestId(video.quickTestId || '');
    setMasteryCheckId(video.masteryCheckId || '');
    setIsUploading(false);
    setUploadProgress(0);
    draftRef.current = {
      title: video.title || '',
      description: video.description || '',
      topicId: video.topicId || topics[0]?.id || '',
      durationSec: video.durationSec || 600,
      sampleUrl: video.sampleUrl || '',
      subtopicsText: video.subtopics?.join(', ') || '',
      summaryPoints: video.summaryPoints && video.summaryPoints.length > 0
        ? video.summaryPoints
        : [{ title: 'Khái niệm trọng tâm', content: '', example: '' }],
      practiceQuizId: video.practiceQuizId || '',
      quickTestId: video.quickTestId || '',
      masteryCheckId: video.masteryCheckId || '',
    };
    savedJsonRef.current = JSON.stringify(draftRef.current);
    setSaveError(null);
  }, [video.id]);

  // Tải file video lên Supabase Storage (lưu vĩnh viễn, không mất khi tải lại trang)
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(10);

    // Tự đọc thời lượng qua probe video (dùng blob tạm, chỉ để đo thời lượng)
    const probeUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = probeUrl;
    tempVideo.onloadedmetadata = () => {
      if (tempVideo.duration && !isNaN(tempVideo.duration)) {
        setDurationSec(Math.round(tempVideo.duration));
      }
      URL.revokeObjectURL(probeUrl);
    };

    // Thanh tiến độ ước lượng trong lúc tải
    const interval = setInterval(() => {
      setUploadProgress((p) => (p < 90 ? p + 5 : p));
    }, 400);

    try {
      const publicUrl = await uploadLessonMedia(file, 'videos');
      setUploadProgress(100);
      setSampleUrl(publicUrl);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err: any) {
      console.error('Lỗi tải video lên Supabase:', err);
      setUploadError(
        (err?.message || 'Không tải được video lên.') +
          ' (Gói miễn phí Supabase giới hạn ~50MB/file. Có thể dán đường dẫn video thay thế.)'
      );
    } finally {
      clearInterval(interval);
      setTimeout(() => setIsUploading(false), 300);
    }
  };

  // Thêm / sửa / xóa / đổi thứ tự ý trọng tâm
  const handleAddPoint = () => {
    setSummaryPoints((prev) => [
      ...prev,
      { title: `Ý trọng tâm ${prev.length + 1}`, content: '', example: '' },
    ]);
  };

  const handleUpdatePoint = (index: number, field: keyof VideoFocusPoint, val: string) => {
    setSummaryPoints((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleDeletePoint = (index: number) => {
    setSummaryPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMovePoint = (index: number, direction: 'up' | 'down') => {
    setSummaryPoints((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // ---- TỰ LƯU NHÁP (26/10, cùng ca mất nội dung như trình soạn Lý thuyết) ----
  // Nội dung soạn chỉ sống trong state, rời bước là unmount -> mất phần chưa
  // lưu. Nay: gõ xong 2s tự lưu 1 lần (chỉ khi đổi so với lần lưu trước),
  // và khi rời trình soạn thì đẩy nốt phần còn dở dang.
  const buildPayloadFromDraft = (d: typeof draftRef.current) => ({
    id: videoRef.current.id,
    title: d.title.trim(),
    description: d.description.trim(),
    topicId: d.topicId,
    durationSec: d.durationSec,
    sampleUrl: d.sampleUrl.trim(),
    subtopics: d.subtopicsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    summaryPoints: d.summaryPoints,
    practiceQuizId: d.practiceQuizId,
    quickTestId: d.quickTestId,
    masteryCheckId: d.masteryCheckId,
  });

  const saveDraft = async (d: typeof draftRef.current, silent: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    if (!silent) setIsSaving(true);
    try {
      await onSave(buildPayloadFromDraft(d));
      savedJsonRef.current = JSON.stringify(d);
      if (!silent) {
        setSaveError(null);
        const now = new Date();
        setLastSavedTime(
          `${now.getHours().toString().padStart(2, '0')}:${now
            .getMinutes()
            .toString()
            .padStart(2, '0')}`
        );
      }
    } catch (err) {
      console.error('Lỗi khi lưu video:', err);
      if (!silent) setSaveError('Lưu chưa được — kiểm tra mạng rồi bấm Lưu nháp lại.');
    } finally {
      savingRef.current = false;
      if (!silent) setIsSaving(false);
    }
  };

  // Lưu nháp (nút bấm)
  const handleSaveDraft = async () => {
    await saveDraft(draftRef.current, false);
  };

  // Đồng bộ ref theo state + hẹn tự lưu sau 2s không gõ nữa
  useEffect(() => {
    draftRef.current = { title, description, topicId, durationSec, sampleUrl, subtopicsText, summaryPoints, practiceQuizId, quickTestId, masteryCheckId };
    const t = setTimeout(() => {
      if (JSON.stringify(draftRef.current) !== savedJsonRef.current) {
        void saveDraft(draftRef.current, true);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [title, description, topicId, durationSec, sampleUrl, subtopicsText, summaryPoints, practiceQuizId, quickTestId, masteryCheckId]);

  // Rời trình soạn: đẩy nốt phần chưa lưu (im lặng, không setState sau unmount)
  useEffect(() => {
    return () => {
      if (JSON.stringify(draftRef.current) !== savedJsonRef.current) {
        void saveDraft(draftRef.current, true);
      }
    };
  }, []);

  // Cảnh báo nếu video >= 20 phút (1200 giây)
  const isDurationOver20Mins = durationSec >= 1200;
  const durationMinutes = Math.floor(durationSec / 60);
  const durationRemainingSec = durationSec % 60;

  // Lọc quiz theo chủ đề hiện tại
  const topicQuizzes = quizzes.filter((q) => !topicId || q.topicId === topicId);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#FFFDF8] rounded-2xl md:rounded-l-none overflow-y-auto overflow-x-hidden shadow-xs">
      {/* Top Action Bar — dính chặt phía trên khi thân trình soạn cuộn */}
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
          <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#E2704A] flex items-center justify-center shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-lora font-bold text-sm text-[#2F3E6B] truncate">
                Chỉnh sửa bài giảng Video
              </h3>
              <StatusBadge
                status={video.status}
                hasUnpublishedEdits={video.has_unpublished_edits}
                size="sm"
              />
            </div>
            {lastSavedTime && (
              <p className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Đã lưu nháp lúc {lastSavedTime}</span>
              </p>
            )}
            {saveError && (
              <p className="text-[10px] text-red-600 font-medium mt-0.5">{saveError}</p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPreviewStudent}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs"
            title="Mô phỏng trải nghiệm học sinh khi xem bài giảng"
          >
            <Eye className="w-3.5 h-3.5 text-[#2F3E6B]" />
            <span>Xem trước</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:bg-black/5 text-[#2F3E6B] text-xs font-bold transition-all shadow-2xs"
          >
            <Save className="w-3.5 h-3.5 text-[#8C7E6A]" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu nháp'}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              // Tự động lưu bản đang soạn trước khi xuất bản để không mất dữ liệu
              await handleSaveDraft();
              onPublish();
            }}
            disabled={isSaving || isUploading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
            title="Cập nhật lên web học sinh"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Cập nhật lên web</span>
          </button>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* 1. KHU TẢI & NHẬP VIDEO */}
        <div className="p-5 rounded-3xl bg-[#FAF5EB]/60 border border-[#E6DCC8] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-[#2F3E6B] uppercase tracking-wider flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-[#E2704A]" />
                <span>Nguồn phát Video</span>
              </h4>
              <p className="text-[11px] text-[#8C7E6A] mt-0.5">
                Khuyến nghị video &lt; 20 phút và tập trung 1–2 chủ đề để học sinh tiếp thu tốt nhất
              </p>
            </div>

            {/* Honey-yellow alert if duration >= 20 mins */}
            {isDurationOver20Mins && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Thời lượng dài ({durationMinutes}p {durationRemainingSec}s) ≥ 20 phút</span>
              </div>
            )}
          </div>

          {/* Upload Box or URL input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Box chọn file */}
            <div
              onClick={() => videoFileInputRef.current?.click()}
              className="p-5 rounded-2xl border-2 border-dashed border-[#E6DCC8] hover:border-[#E2704A] bg-white cursor-pointer flex flex-col items-center justify-center text-center gap-2 transition-all group"
            >
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-2xl bg-orange-50 group-hover:bg-[#E2704A] group-hover:text-white text-[#E2704A] flex items-center justify-center transition-colors">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-[#2F3E6B]">
                Bấm để chọn file video từ máy tính
              </p>
              <p className="text-[10px] text-[#8C7E6A]">
                Hỗ trợ định dạng MP4, WebM — video được lưu vĩnh viễn trên máy chủ
              </p>
            </div>

            {/* Nhập URL thay thế */}
            <div className="p-4 rounded-2xl bg-white border border-[#E6DCC8] flex flex-col justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-[#2F3E6B] mb-1 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-[#8C7E6A]" />
                  <span>Vui lòng dán đường dẫn video như một cách nhập thay thế:</span>
                </label>
                <input
                  type="text"
                  value={sampleUrl}
                  onChange={(e) => setSampleUrl(e.target.value)}
                  placeholder="https://... /video.mp4"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] placeholder-[#8C7E6A]/50 focus:outline-none focus:border-[#2F3E6B]"
                />
              </div>

              {/* Progress bar nếu đang tải */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-[#E2704A]">
                    <span>Đang tải video lên máy chủ...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E2704A] transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {uploadError}
                </div>
              )}

              {/* Duration input */}
              <div className="flex items-center gap-3 pt-1 border-t border-[#E6DCC8]/60">
                <div className="flex items-center gap-1.5 text-xs text-[#8C7E6A]">
                  <Clock className="w-3.5 h-3.5 text-[#2F3E6B]" />
                  <span className="font-medium">Thời lượng (giây):</span>
                </div>
                <input
                  type="number"
                  min="1"
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-24 px-2.5 py-1 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] text-center"
                />
                <span className="text-xs text-[#8C7E6A] font-mono">
                  ({Math.floor(durationSec / 60)} phút {durationSec % 60} giây)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. THÔNG TIN CƠ BẢN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
              Tiêu đề bài giảng Video <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Bài 1: Đặc điểm hình thức thể thơ bốn chữ, năm chữ..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
              Thuộc chủ đề nào? <span className="text-rose-500">*</span>
            </label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.tag})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
              Mô tả ngắn gọn nội dung video
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tóm tắt 1 câu giúp học sinh nắm được bài học..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] text-xs text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2F3E6B] mb-1.5">
              1–2 chủ đề nhỏ (phân cách bằng dấu phẩy)
            </label>
            <input
              type="text"
              value={subtopicsText}
              onChange={(e) => setSubtopicsText(e.target.value)}
              placeholder="VD: Số tiếng mỗi dòng, Cách gieo vần, Ngắt nhịp"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E6DCC8] text-xs text-[#2F3E6B] focus:outline-none focus:border-[#2F3E6B]"
            />
          </div>

        </div>

        {/* 3. KIẾN THỨC TRỌNG TÂM DƯỚI VIDEO (TÓM TẮT SAU VIDEO) */}
        <div className="space-y-3 pt-3 border-t border-[#E6DCC8]">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-[#2F3E6B] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F2B84B]" />
                <span>Kiến thức trọng tâm dưới video (Tóm tắt sau mỗi video)</span>
              </h4>
              <p className="text-[11px] text-[#8C7E6A] mt-0.5">
                Trình soạn thảo danh sách các ý ngắn gọn kèm ví dụ trực quan cho học sinh đọc sau video
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddPoint}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-[#2F3E6B] text-xs font-bold shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#E2704A]" />
              <span>Thêm ý trọng tâm</span>
            </button>
          </div>

          <div className="space-y-3">
            {summaryPoints.map((point, index) => (
              <div
                key={index}
                className="p-4 rounded-2xl bg-white border border-[#E6DCC8] shadow-2xs space-y-2.5 relative group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-5 h-5 rounded-full bg-[#FAF5EB] text-[#2F3E6B] text-[11px] font-bold flex items-center justify-center shrink-0 border border-[#E6DCC8]">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={point.title}
                      onChange={(e) => handleUpdatePoint(index, 'title', e.target.value)}
                      placeholder="Tiêu đề ý trọng tâm (VD: Quy tắc số tiếng, Cách ngắt nhịp...)"
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-bold text-[#2F3E6B]"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMovePoint(index, 'up')}
                      className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] disabled:opacity-30"
                      title="Di chuyển lên"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === summaryPoints.length - 1}
                      onClick={() => handleMovePoint(index, 'down')}
                      className="p-1 rounded hover:bg-black/5 text-[#8C7E6A] disabled:opacity-30"
                      title="Di chuyển xuống"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePoint(index)}
                      className="p-1 rounded hover:bg-rose-50 text-[#8C7E6A] hover:text-rose-600"
                      title="Xóa ý này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    rows={2}
                    value={point.content}
                    onChange={(e) => handleUpdatePoint(index, 'content', e.target.value)}
                    placeholder="Nội dung giải thích chi tiết ý trọng tâm này..."
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B] resize-none"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={point.example || ''}
                    onChange={(e) => handleUpdatePoint(index, 'example', e.target.value)}
                    placeholder="Ví dụ minh họa (tùy chọn, VD: 'Hạt gạo làng ta / Có vị phù sa...')"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-[11px] text-[#2F3E6B] italic placeholder-[#8C7E6A]/50"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. LIÊN KẾT BÀI ĐI KÈM */}
        <div className="space-y-3 pt-3 border-t border-[#E6DCC8]">
          <div>
            <h4 className="text-xs font-bold text-[#2F3E6B] uppercase tracking-wider flex items-center gap-1.5">
              <FileQuestion className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span>Liên kết bài đi kèm video này</span>
            </h4>
            <p className="text-[11px] text-[#8C7E6A] mt-0.5">
              Học sinh sau khi xem video và đọc tóm tắt sẽ lần lượt làm Bài luyện tập → Kiểm tra 1 → Kiểm tra 2
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Luyện tập */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E6DCC8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2F3E6B]">Bài luyện tập</span>
                <button
                  type="button"
                  onClick={async () => { await handleSaveDraft(); onCreateLinkedQuiz('practice'); }}
                  className="text-[10px] text-[#E2704A] hover:underline font-bold"
                >
                  + Tạo mới
                </button>
              </div>
              <select
                value={practiceQuizId}
                onChange={(e) => setPracticeQuizId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
              >
                <option value="">-- Chưa gắn bài --</option>
                {topicQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.questionIds.length} câu)
                  </option>
                ))}
              </select>
            </div>

            {/* Kiểm tra 1 */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E6DCC8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2F3E6B]">Kiểm tra 1 (Nhanh)</span>
                <button
                  type="button"
                  onClick={async () => { await handleSaveDraft(); onCreateLinkedQuiz('quick'); }}
                  className="text-[10px] text-[#E2704A] hover:underline font-bold"
                >
                  + Tạo mới
                </button>
              </div>
              <select
                value={quickTestId}
                onChange={(e) => setQuickTestId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
              >
                <option value="">-- Chưa gắn bài --</option>
                {topicQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.questionIds.length} câu)
                  </option>
                ))}
              </select>
            </div>

            {/* Kiểm tra 2 (Mastery Check) */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E6DCC8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2F3E6B]">Kiểm tra 2 (Mastery)</span>
                <button
                  type="button"
                  onClick={async () => { await handleSaveDraft(); onCreateLinkedQuiz('mastery'); }}
                  className="text-[10px] text-[#E2704A] hover:underline font-bold"
                >
                  + Tạo mới
                </button>
              </div>
              <select
                value={masteryCheckId}
                onChange={(e) => setMasteryCheckId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs text-[#2F3E6B]"
              >
                <option value="">-- Chưa gắn bài --</option>
                {topicQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.questionIds.length} câu)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
