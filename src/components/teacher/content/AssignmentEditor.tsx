import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Plus,
  Search,
  Send,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { ClassItem, StudentAccount, TeacherProfile } from '../../../services/types.ts';
import { quizService, studentService } from '../../../services/index.ts';
import { Question } from '../../../types.ts';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { CollapsedToolbarBar } from './TopicFlowStrip.tsx';

import {
  deleteAssignmentCompletely,
  getAssignmentForEdit,
  updateAssignment,
} from '../../../services/api/biClient.ts';
import {
  BLANK_TOKEN,
  countBlanks,
  blankContexts,
  createBlankFromSelection,
  deleteBlank,
} from '../../../logic/fillBlank.ts';

interface AssignmentEditorProps {
  assignmentId: string;
  teacher: TeacherProfile;
  classes: ClassItem[];
  /** Sau khi lưu/xóa để cây nội dung nạp lại danh sách bài */
  onChanged: () => void;
  onDeleted: () => void;
  /** Thu gọn đầu màn soạn (nút 2/3 trên dải luồng) */
  toolbarCollapsed?: boolean;
  onExpandToolbar?: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  single: 'TN 1 đáp án',
  multi: 'TN nhiều đáp án',
  fill: 'Điền khuyết',
  essay: 'Tự luận',
};

const toLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Màn SOẠN BÀI TẬP & ĐÁNH GIÁ — bài kiểm tra độc lập là một MỤC RIÊNG ngang
 * hàng chủ đề: tạo mục trước (nháp), soạn tiêu đề/cài đặt/câu hỏi/đối tượng
 * ngay trong màn này như soạn một bài kiểm tra, bấm "Giao bài" mới hiện với
 * học sinh được chọn.
 */
export const AssignmentEditor: React.FC<AssignmentEditorProps> = ({
  assignmentId,
  teacher,
  classes,
  onChanged,
  onDeleted,
  toolbarCollapsed,
  onExpandToolbar,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [published, setPublished] = useState(false);
  const [classId, setClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [pickedStudents, setPickedStudents] = useState<Set<string>>(new Set());
  const [bank, setBank] = useState<Question[]>([]);
  const [pickedQuestions, setPickedQuestions] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [isTimed, setIsTimed] = useState(false);
  const [minutes, setMinutes] = useState('30');
  const [xpReward, setXpReward] = useState('0');
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Đợt sửa 24/10: tạo câu hỏi THỦ CÔNG ngay trong màn soạn bài tập & đánh giá
  // (trước đây chỉ chọn được từ ngân hàng). Câu mới lưu vào ngân hàng của
  // chính giáo viên đang đăng nhập (quizService tự đóng dấu teacher_id) và
  // được đưa thẳng vào đề này; bấm "Lưu/Giao bài" mới ghi nhận vào bài.
  const [manualType, setManualType] = useState<'single' | 'multi' | 'fill' | 'essay'>('single');
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualOptions, setManualOptions] = useState<string[]>(['', '', '', '']);
  const [manualSingleAnswer, setManualSingleAnswer] = useState('A');
  const [manualMultiAnswers, setManualMultiAnswers] = useState<Set<string>>(new Set(['A']));
  const [manualFillAnswers, setManualFillAnswers] = useState<string[]>([]);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const manualPromptRef = useRef<HTMLTextAreaElement | null>(null);

  /** Gõ đề bài: số ô trống tăng thì thêm đáp án rỗng cho đủ (không cắt
      bớt khi gõ, để khỏi mất đáp án; lúc lưu sẽ căn theo số ô trống). */
  const handleManualPromptChange = (value: string) => {
    setManualPrompt(value);
    if (manualType === 'fill') {
      const blanks = countBlanks(value);
      setManualFillAnswers((prev) => {
        const next = [...prev];
        while (next.length < blanks) next.push('');
        return next;
      });
    }
  };

  const handleAddManualQuestion = async () => {
    const prompt = manualPrompt.trim();
    if (!prompt) {
      setManualError('Nhập nội dung câu hỏi trước.');
      return;
    }
    let options: string[] | undefined;
    let answer: string | string[] | undefined;
    if (manualType === 'single' || manualType === 'multi') {
      options = manualOptions.map((o) => o.trim());
      if (options.some((o) => !o)) {
        setManualError('Nhập đủ 4 phương án A–D.');
        return;
      }
      if (manualType === 'single') {
        answer = manualSingleAnswer;
      } else {
        if (manualMultiAnswers.size === 0) {
          setManualError('Chọn ít nhất 1 đáp án đúng.');
          return;
        }
        answer = [...manualMultiAnswers].sort();
      }
    } else if (manualType === 'fill') {
      const blanks = countBlanks(prompt);
      const aligned = [...manualFillAnswers];
      while (aligned.length < blanks) aligned.push('');
      const finalAnswers = aligned.slice(0, blanks);
      if (blanks === 0 || finalAnswers.some((a) => !a.trim())) {
        setManualError('Tạo ít nhất 1 ô trống trong câu (bôi đen đoạn văn rồi bấm Tạo ô trống) và nhập đủ đáp án cho từng ô.');
        return;
      }
      answer = finalAnswers;
    }
    setManualSaving(true);
    setManualError(null);
    try {
      const saved = await quizService.saveQuestion({
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type: manualType,
        level: 'THONG_HIEU',
        difficulty: 'TB',
        prompt,
        // Bài tập & đánh giá không gắn chủ đề cụ thể; câu vẫn vào ngân hàng
        // riêng của giáo viên và hiện ở bộ lọc "Tất cả chủ đề".
        topicId: '',
        options,
        answer,
        explanation: '',
        points: 10,
        minWords: manualType === 'essay' ? 120 : undefined,
      } as any);
      setBank((prev) => [...prev, saved as unknown as Question]);
      setPickedQuestions((prev) => [...prev, saved.id]);
      setManualPrompt('');
      setManualOptions(['', '', '', '']);
      setManualSingleAnswer('A');
      setManualMultiAnswers(new Set(['A']));
      setManualFillAnswers([]);
      setSavedNote('Đã thêm câu hỏi mới vào đề (và vào ngân hàng của thầy/cô).');
    } catch (e: any) {
      setManualError('Tạo câu hỏi thất bại: ' + (e?.message || 'lỗi không rõ'));
    } finally {
      setManualSaving(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rec, qs, sts] = await Promise.all([
          getAssignmentForEdit(assignmentId),
          quizService.getQuestions(),
          studentService.getStudents(),
        ]);
        if (!rec) {
          setError('Không tìm thấy bài tập & đánh giá này.');
          return;
        }
        const allStudents = (sts || []) as StudentAccount[];
        const cid = rec.classId || classes[0]?.id || '';
        setTitle(rec.title);
        setPublished(rec.published);
        setClassId(cid);
        setStudents(allStudents);
        setBank(Object.values(qs || {}) as Question[]);
        setPickedQuestions(rec.questionIds);
        setDueAt(toLocalInput(rec.dueAt));
        setIsTimed(rec.isTimed);
        setMinutes(rec.timeLimitMinutes ? String(rec.timeLimitMinutes) : '30');
        setXpReward(String(rec.xpReward ?? 0));
        // Chưa từng chọn đối tượng (bản nháp mới) → mặc định chọn cả lớp
        setPickedStudents(
          rec.studentIds.length
            ? new Set(rec.studentIds)
            : new Set(allStudents.filter((s) => s.class_id === cid).map((s) => s.id))
        );
      } catch {
        setError('Không tải được dữ liệu bài. Thầy/Cô thử tải lại trang nhé.');
      } finally {
        setLoading(false);
      }
    })();
  }, [assignmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const bankMap = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);
  const classStudents = useMemo(
    () => students.filter((s) => s.class_id === classId),
    [students, classId]
  );
  const visibleBank = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bank.filter((x) => !q || x.prompt.toLowerCase().includes(q));
  }, [bank, query]);

  const handleClassChange = (cid: string) => {
    setClassId(cid);
    setPickedStudents(new Set(students.filter((s) => s.class_id === cid).map((s) => s.id)));
  };

  const toggleStudent = (id: string) =>
    setPickedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleQuestion = (id: string) =>
    setPickedQuestions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const moveQuestion = (idx: number, dir: -1 | 1) =>
    setPickedQuestions((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const doSave = async (publish: boolean) => {
    if (!title.trim()) {
      setError('Thầy/Cô nhập tiêu đề bài trước khi lưu nhé.');
      return;
    }
    if (publish && (pickedQuestions.length === 0 || pickedStudents.size === 0)) {
      setError('Muốn giao bài cần ít nhất 1 câu hỏi và 1 học sinh được giao.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateAssignment(assignmentId, {
        title: title.trim(),
        classId: classId || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        isTimed,
        timeLimitMinutes: isTimed ? Math.max(1, parseInt(minutes || '30', 10) || 30) : null,
        xpReward: Math.max(0, parseInt(xpReward || '0', 10) || 0),
        questionIds: pickedQuestions,
        studentIds: [...pickedStudents],
        publish,
      });
      if (publish) setPublished(true);
      setSavedNote(
        publish
          ? `Đã giao bài cho ${pickedStudents.size} học sinh (${pickedQuestions.length} câu hỏi).`
          : 'Đã lưu bản nháp.'
      );
      onChanged();
    } catch (e: any) {
      setError('Lưu thất bại: ' + (e?.message || 'lỗi không rõ'));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    setSaving(true);
    try {
      await deleteAssignmentCompletely(assignmentId);
      onChanged();
      onDeleted();
    } catch (e: any) {
      setError('Xóa thất bại: ' + (e?.message || 'lỗi không rõ'));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-8 bg-[#FFFDF8] rounded-2xl md:rounded-l-none border border-[#E6DCC8] shadow-xs flex items-center justify-center text-sm text-[#8C7E6A]">
        Đang mở bài tập & đánh giá…
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-0 bg-[#FFFDF8] rounded-2xl md:rounded-l-none border border-[#E6DCC8] shadow-xs">
      {toolbarCollapsed ? (
        <CollapsedToolbarBar
          label="Bài tập & đánh giá"
          detail={title}
          onExpand={onExpandToolbar || (() => {})}
          className="-mx-5 -mt-5 px-5"
        />
      ) : (
      <>
      {/* Đầu màn soạn */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-2xl bg-[#B45309]/15 text-[#B45309] flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#B45309]">
              Bài tập & đánh giá
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {published ? 'Đã giao cho học sinh' : 'Bản nháp — học sinh chưa thấy'}
              </span>
              {isTimed && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#2F3E6B]/10 text-[#2F3E6B] flex items-center gap-1">
                  <Timer className="w-3 h-3" /> {minutes} phút
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Xóa bài này
        </button>
      </div>
      </>
      )}

      {/* Tiêu đề */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề bài kiểm tra…"
        className="mt-4 w-full bg-[#FAF5EB] border border-[#E6DCC8] rounded-2xl px-4 py-3 font-lora font-bold text-lg text-[#2F3E6B] outline-none focus:border-[#B45309]"
      />

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {savedNote && !error && (
        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {savedNote}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4 mt-4">
        {/* Cột cài đặt + đối tượng: ghim ở đầu khi cuộn cột phải để khỏi
            để lại khoảng trắng lớn dưới cột trái. */}
        <div className="lg:col-span-2 space-y-4 self-start lg:sticky lg:top-0">
          <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#2F3E6B]">Cài đặt bài</h4>
            <div>
              <label className="text-xs font-bold text-[#2F3E6B] block mb-1">Hạn nộp</label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#B45309]"
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-[#2F3E6B] cursor-pointer">
              <input
                type="checkbox"
                checked={isTimed}
                onChange={(e) => setIsTimed(e.target.checked)}
                className="w-4 h-4 accent-[#B45309]"
              />
              Giới hạn thời gian làm bài
            </label>
            {isTimed && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="w-24 bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#B45309]"
                />
                <span className="text-xs text-[#8C7E6A]">phút — hết giờ hệ thống tự nộp bài</span>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-[#2F3E6B] block mb-1">
                XP thưởng khi nộp bài
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={xpReward}
                  onChange={(e) => setXpReward(e.target.value)}
                  className="w-24 bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#B45309]"
                />
                <span className="text-xs font-bold text-[#8C7E6A]">XP</span>
                <span className="text-[11px] text-[#8C7E6A] leading-snug">
                  Học sinh nộp bài là nhận (1 lần), không cần làm đúng hết. Để 0 = không thưởng.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#2F3E6B]">
              Giao cho học sinh
            </h4>
            <select
              value={classId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="mt-2 w-full bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#B45309]"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Lớp {c.name}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-[#8C7E6A]">
                Đã chọn {pickedStudents.size}/{classStudents.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPickedStudents(new Set(classStudents.map((s) => s.id)))}
                  className="text-[11px] font-bold text-[#B45309] hover:underline"
                >
                  Chọn cả lớp
                </button>
                <button
                  type="button"
                  onClick={() => setPickedStudents(new Set())}
                  className="text-[11px] font-bold text-[#8C7E6A] hover:underline"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto space-y-1 pr-1">
              {classStudents.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#FAF5EB] cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={pickedStudents.has(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    className="w-4 h-4 accent-[#B45309]"
                  />
                  <span className="font-medium text-[#2F3E6B]">{s.name}</span>
                  <span className="text-[11px] text-[#8C7E6A] font-mono">{s.username}</span>
                </label>
              ))}
              {classStudents.length === 0 && (
                <p className="text-xs text-[#8C7E6A] italic">Lớp này chưa có học sinh.</p>
              )}
            </div>
          </div>
        </div>

        {/* Cột câu hỏi */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#2F3E6B]">
              Đề gồm {pickedQuestions.length} câu
            </h4>
            <div className="mt-2 space-y-2">
              {pickedQuestions.map((qid, idx) => {
                const q = bankMap.get(qid);
                return (
                  <div
                    key={qid}
                    className="flex items-start gap-2 bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl px-3 py-2"
                  >
                    <span className="text-xs font-black text-[#B45309] mt-0.5">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#2F3E6B] line-clamp-2">{q?.prompt || qid}</p>
                      <span className="text-[10px] font-bold text-[#8C7E6A]">
                        {TYPE_LABEL[q?.type || 'essay'] || q?.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveQuestion(idx, -1)}
                        className="p-1 rounded hover:bg-black/5 text-[#8C7E6A]"
                        title="Lên"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(idx, 1)}
                        className="p-1 rounded hover:bg-black/5 text-[#8C7E6A]"
                        title="Xuống"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleQuestion(qid)}
                        className="p-1 rounded hover:bg-black/5 text-red-500"
                        title="Bỏ khỏi đề"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {pickedQuestions.length === 0 && (
                <p className="text-xs text-[#8C7E6A] italic">
                  Chưa có câu nào — tạo câu mới thủ công hoặc chọn từ ngân hàng câu hỏi bên dưới.
                </p>
              )}
            </div>
          </div>

          {/* Tạo câu hỏi mới thủ công (không cần qua ngân hàng trước) */}
          <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#2F3E6B] flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#E2704A]" /> Tạo câu hỏi mới (thủ công)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(['single', 'multi', 'fill', 'essay'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setManualType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    manualType === t
                      ? 'bg-[#2F3E6B] text-white border-[#2F3E6B]'
                      : 'bg-white text-[#2F3E6B] border-[#E6DCC8] hover:border-[#2F3E6B]'
                  }`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <textarea
              ref={manualPromptRef}
              value={manualPrompt}
              onChange={(e) => handleManualPromptChange(e.target.value)}
              placeholder="Nhập nội dung câu hỏi…"
              rows={3}
              className="w-full bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl px-3 py-2 text-sm text-[#2F3E6B] outline-none focus:border-[#B45309]"
            />
            {(manualType === 'single' || manualType === 'multi') && (
              <div className="space-y-1.5">
                {manualOptions.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi);
                  const checked =
                    manualType === 'single'
                      ? manualSingleAnswer === letter
                      : manualMultiAnswers.has(letter);
                  return (
                    <label key={oi} className="flex items-center gap-2">
                      <input
                        type={manualType === 'single' ? 'radio' : 'checkbox'}
                        name="manual-answer"
                        checked={checked}
                        onChange={() => {
                          if (manualType === 'single') setManualSingleAnswer(letter);
                          else {
                            setManualMultiAnswers((prev) => {
                              const next = new Set(prev);
                              if (next.has(letter)) next.delete(letter);
                              else next.add(letter);
                              return next;
                            });
                          }
                        }}
                        className="shrink-0 accent-[#2F3E6B]"
                      />
                      <span className="text-xs font-bold text-[#2F3E6B] w-4 shrink-0">{letter}.</span>
                      <input
                        value={opt}
                        onChange={(e) =>
                          setManualOptions((prev) => {
                            const next = [...prev];
                            next[oi] = e.target.value;
                            return next;
                          })
                        }
                        placeholder={`Phương án ${letter}`}
                        className="flex-1 bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl px-3 py-1.5 text-sm text-[#2F3E6B] outline-none focus:border-[#B45309]"
                      />
                    </label>
                  );
                })}
                <p className="text-[11px] text-[#8C7E6A]">Tích chọn đáp án đúng.</p>
              </div>
            )}
            {manualType === 'fill' && (
              <div className="space-y-2 rounded-xl bg-emerald-50/60 border border-emerald-200 p-3">
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Gõ câu đầy đủ vào ô đề bài, <b>bôi đen</b> đoạn muốn thành ô trống rồi bấm nút dưới
                  — đoạn đó tự thành đáp án và chỗ đó thành ô trống cho học sinh điền. Chấm từng ô,
                  điểm từng phần; không phân biệt hoa thường, dấu tiếng Việt, dấu câu cuối câu.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const ta = manualPromptRef.current;
                      if (!ta) return;
                      const made = createBlankFromSelection(
                        manualPrompt,
                        [...manualFillAnswers],
                        ta.selectionStart ?? 0,
                        ta.selectionEnd ?? 0
                      );
                      if (!made) {
                        setManualError('Không tạo được ô trống: vùng chọn chạm vào ô trống đã có. Hãy chọn đoạn chữ khác.');
                        return;
                      }
                      setManualError(null);
                      setManualPrompt(made.sentence);
                      setManualFillAnswers(made.answers);
                      ta.focus();
                    }}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    ＋ Tạo ô trống từ đoạn bôi đen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const sep = manualPrompt && !manualPrompt.endsWith(' ') ? ' ' : '';
                      setManualPrompt(manualPrompt + sep + BLANK_TOKEN);
                      setManualFillAnswers([...manualFillAnswers, '']);
                    }}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    ＋ Thêm ô trống ở cuối câu
                  </button>
                  <span className="text-[11px] text-emerald-700">
                    Đang có {countBlanks(manualPrompt)} ô trống
                  </span>
                </div>
                <div className="space-y-2">
                  {blankContexts(manualPrompt).map((ctx, ansIdx) => (
                    <div key={ansIdx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 shrink-0">
                        Ô [{ansIdx + 1}] <span className="font-normal italic">({ctx})</span>:
                      </span>
                      <input
                        value={manualFillAnswers[ansIdx] ?? ''}
                        onChange={(e) => {
                          const next = [...manualFillAnswers];
                          while (next.length <= ansIdx) next.push('');
                          next[ansIdx] = e.target.value;
                          setManualFillAnswers(next);
                        }}
                        placeholder="Đáp án… (nhiều cách chấp nhận thì cách nhau bằng |)"
                        className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-sm text-[#2F3E6B] outline-none"
                      />
                      <button
                        type="button"
                        title="Xóa ô này và trả lại chữ gốc vào câu"
                        onClick={() => {
                          const made = deleteBlank(manualPrompt, manualFillAnswers, ansIdx);
                          setManualPrompt(made.sentence);
                          setManualFillAnswers(made.answers);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {countBlanks(manualPrompt) === 0 && (
                    <p className="text-[11px] text-amber-700 italic">
                      Chưa có ô trống nào — bôi đen một đoạn trong đề bài rồi bấm “Tạo ô trống từ đoạn bôi đen”.
                    </p>
                  )}
                </div>
              </div>
            )}
            {manualType === 'essay' && (
              <p className="text-[11px] text-[#8C7E6A]">
                Tự luận: học sinh viết bài, cô chấm theo thang 10 (tối thiểu 120 từ).
              </p>
            )}
            {manualError && <p className="text-xs font-bold text-red-600">{manualError}</p>}
            <button
              type="button"
              onClick={handleAddManualQuestion}
              disabled={manualSaving}
              className="px-4 py-2 rounded-full bg-[#E2704A] text-white text-xs font-bold hover:opacity-90 active:scale-95 transition disabled:opacity-50"
            >
              {manualSaving ? 'Đang thêm…' : 'Thêm câu hỏi này vào đề'}
            </button>
          </div>

          <div className="bg-white border border-[#E6DCC8] rounded-2xl p-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#2F3E6B]">
              Ngân hàng câu hỏi
            </h4>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7E6A]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm câu hỏi…"
                className="w-full bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#B45309]"
              />
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto space-y-1 pr-1">
              {visibleBank.map((q) => {
                const picked = pickedQuestions.includes(q.id);
                const noOptions =
                  (q.type === 'single' || q.type === 'multi') && !(q.options || []).length;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => toggleQuestion(q.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                      picked
                        ? 'bg-[#B45309]/10 border-[#B45309]/50'
                        : 'bg-white border-[#E6DCC8] hover:bg-[#FAF5EB]'
                    }`}
                  >
                    <span className="block text-sm text-[#2F3E6B] line-clamp-2">{q.prompt}</span>
                    <span className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-[#8C7E6A]">
                        {TYPE_LABEL[q.type] || q.type}
                      </span>
                      {picked && (
                        <span className="text-[10px] font-bold text-[#B45309]">✓ Đã vào đề</span>
                      )}
                      {noOptions && (
                        <span className="text-[10px] font-bold text-amber-600">
                          ⚠ Chưa có nội dung đáp án — học sinh chọn theo ký tự A–D
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              {visibleBank.length === 0 && (
                <p className="text-xs text-[#8C7E6A] italic">Không có câu hỏi nào khớp.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Thanh hành động: chân trang tràn viền của khung soạn (không còn
          dải trống dưới thanh khi cuộn; z-20 đúng tầng với thanh công cụ). */}
      <div className="sticky bottom-0 z-20 -mx-5 px-5 mt-4 bg-[#FFFDF8]/95 backdrop-blur border-t border-[#E6DCC8] py-3 flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          disabled={saving}
          onClick={() => doSave(false)}
          className="px-3.5 py-2 rounded-xl bg-white border border-[#E6DCC8] hover:border-[#2F3E6B] text-[#2F3E6B] text-xs font-bold disabled:opacity-50"
        >
          Lưu nháp
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => doSave(true)}
          className="px-3.5 py-2 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
        >
          <Send className="w-3.5 h-3.5" />
          {published ? 'Cập nhật bài đã giao' : 'Giao bài cho học sinh'}
        </button>
        <span className="text-[11px] text-[#8C7E6A]">
          Giao bài = học sinh được chọn thấy bài ngay ở mục "Bài tập được giao".
        </span>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Xóa bài tập & đánh giá"
        message={`Bạn có chắc chắn muốn xóa bài "${title}" không? Mọi lượt làm bài của học sinh thuộc bài này cũng bị xóa. Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};
