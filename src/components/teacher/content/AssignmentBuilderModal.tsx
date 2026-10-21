import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPlus, Search, Timer, X } from 'lucide-react';
import { ClassItem, StudentAccount, TeacherProfile } from '../../../services/types.ts';
import { quizService, studentService } from '../../../services/index.ts';
import { Question } from '../../../types.ts';
import { createAssignment } from '../../../services/supabase/biRepository.ts';

interface AssignmentBuilderModalProps {
  teacher: TeacherProfile;
  classes: ClassItem[];
  onClose: () => void;
  onCreated?: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  single: 'TN 1 đáp án',
  multi: 'TN nhiều đáp án',
  fill: 'Điền khuyết',
  essay: 'Tự luận',
};

export const AssignmentBuilderModal: React.FC<AssignmentBuilderModalProps> = ({
  teacher,
  classes,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState<string>(classes[0]?.id || '');
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [pickedStudents, setPickedStudents] = useState<Set<string>>(new Set());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pickedQuestions, setPickedQuestions] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [isTimed, setIsTimed] = useState(false);
  const [minutes, setMinutes] = useState('30');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneInfo, setDoneInfo] = useState<{ students: number; questions: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [qs, sts] = await Promise.all([
          quizService.getQuestions(),
          studentService.getStudents(),
        ]);
        setQuestions(Object.values(qs || {}) as Question[]);
        setStudents(sts || []);
      } catch {
        setError('Không tải được danh sách câu hỏi / học sinh.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const classStudents = useMemo(
    () => students.filter((s) => s.class_id === classId),
    [students, classId]
  );

  useEffect(() => {
    setPickedStudents(new Set(classStudents.map((s) => s.id)));
  }, [classId, classStudents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleQuestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return questions.filter((x) => !q || x.prompt.toLowerCase().includes(q));
  }, [questions, query]);

  const toggleQuestion = (id: string) =>
    setPickedQuestions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleStudent = (id: string) =>
    setPickedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSave =
    title.trim().length > 0 && pickedQuestions.length > 0 && pickedStudents.size > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await createAssignment({
        teacherId: teacher.id,
        classId: classId || null,
        title: title.trim(),
        questionIds: pickedQuestions,
        studentIds: [...pickedStudents],
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        isTimed,
        timeLimitMinutes: isTimed ? Math.max(1, parseInt(minutes || '30', 10) || 30) : null,
      });
      setDoneInfo({ students: pickedStudents.size, questions: pickedQuestions.length });
      onCreated?.();
    } catch (e: any) {
      setError('Giao bài thất bại: ' + (e?.message || 'lỗi không rõ'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-3">
      <div className="bg-[#FFFDF8] w-full max-w-3xl max-h-[92vh] rounded-3xl border border-[#E6DCC8] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E6DCC8] bg-[#FAF5EB]">
          <ClipboardPlus className="text-[#E2704A]" size={20} />
          <h3 className="font-black text-[#2F3E6B] flex-1">Thêm bài tập & đánh giá</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white" title="Đóng">
            <X size={18} />
          </button>
        </div>

        {doneInfo ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
            <p className="font-black text-[#2F3E6B] text-lg">Đã giao bài thành công!</p>
            <p className="text-sm text-[#6B7280]">
              Bài "{title}" gồm {doneInfo.questions} câu hỏi đã được giao cho {doneInfo.students}{' '}
              học sinh. Các em sẽ thấy bài ở mục "Bài tập được giao" trên trang chủ; tiến độ nộp và
              câu chờ chấm hiện ở màn "Tiến độ bài làm".
            </p>
            <button
              onClick={onClose}
              className="bg-[#2F3E6B] text-white font-bold px-6 py-2.5 rounded-xl"
            >
              Đóng
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {error && (
                <p className="text-sm font-semibold bg-red-50 text-red-600 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              <div>
                <label className="text-xs font-black uppercase tracking-wide text-[#2F3E6B]">
                  Tên bài tập
                </label>
                <input
                  className="mt-1.5 w-full border border-[#E6DCC8] rounded-xl px-3 py-2.5 text-sm bg-white"
                  placeholder="Ví dụ: Ôn tập thơ bốn chữ — tuần này"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-[#2F3E6B]">
                    Hạn nộp
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1.5 w-full border border-[#E6DCC8] rounded-xl px-3 py-2.5 text-sm bg-white"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-[#2F3E6B] flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isTimed}
                      onChange={(e) => setIsTimed(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <Timer size={14} /> Giới hạn thời gian làm bài
                  </label>
                  {isTimed && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        className="w-24 border border-[#E6DCC8] rounded-xl px-3 py-2.5 text-sm bg-white"
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                      />
                      <span className="text-sm text-[#6B7280]">phút (hết giờ tự nộp)</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-[#2F3E6B]">
                  Giao cho lớp
                </label>
                <select
                  className="mt-1.5 w-full border border-[#E6DCC8] rounded-xl px-3 py-2.5 text-sm bg-white"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {classes.length === 0 && <option value="">— Chưa có lớp —</option>}
                </select>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {classStudents.map((s) => {
                    const on = pickedStudents.has(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleStudent(s.id)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-full border transition ${
                          on
                            ? 'bg-[#2F3E6B] text-white border-[#2F3E6B]'
                            : 'bg-white text-[#6B7280] border-[#E6DCC8]'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                  {classStudents.length === 0 && (
                    <span className="text-xs text-[#6B7280]">Lớp này chưa có học sinh.</span>
                  )}
                </div>
                <p className="text-xs text-[#6B7280] mt-1">
                  Đã chọn {pickedStudents.size}/{classStudents.length} học sinh (bấm để bỏ chọn từng em).
                </p>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-[#2F3E6B]">
                  Chọn câu hỏi từ ngân hàng ({pickedQuestions.length} câu đã chọn)
                </label>
                <div className="relative mt-1.5">
                  <Search size={15} className="absolute left-3 top-3 text-[#6B7280]" />
                  <input
                    className="w-full border border-[#E6DCC8] rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white"
                    placeholder="Tìm câu hỏi…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {loading ? (
                    <p className="text-sm text-[#6B7280] py-3 text-center">Đang tải ngân hàng câu hỏi…</p>
                  ) : (
                    visibleQuestions.map((q) => {
                      const on = pickedQuestions.includes(q.id);
                      const noOptions =
                        (q.type === 'single' || q.type === 'multi') &&
                        (!q.options || q.options.length === 0);
                      return (
                        <button
                          key={q.id}
                          onClick={() => toggleQuestion(q.id)}
                          className={`w-full text-left border rounded-xl px-3 py-2.5 text-sm transition ${
                            on
                              ? 'border-[#2F3E6B] bg-[#2F3E6B]/5'
                              : 'border-[#E6DCC8] bg-white hover:border-[#2F3E6B]/50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`w-4.5 h-4.5 min-w-4 min-h-4 rounded border flex items-center justify-center text-[10px] ${
                                on ? 'bg-[#2F3E6B] text-white border-[#2F3E6B]' : 'border-[#C9BBA0]'
                              }`}
                            >
                              {on ? '✓' : ''}
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#E2704A]/10 text-[#E2704A] whitespace-nowrap">
                              {TYPE_LABEL[q.type] || q.type} · {q.points ?? 10}đ
                            </span>
                            <span className="flex-1 font-medium text-[#374151] line-clamp-2">
                              {q.prompt}
                            </span>
                          </span>
                          {noOptions && (
                            <span className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700">
                              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                              Câu này chưa có văn bản các lựa chọn — học sinh sẽ chọn theo ký tự
                              A/B/C/D.
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                  {!loading && visibleQuestions.length === 0 && (
                    <p className="text-sm text-[#6B7280] py-3 text-center">
                      Không có câu hỏi nào. Hãy tạo câu hỏi ở mục Ngân hàng câu hỏi trước.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#E6DCC8] bg-[#FAF5EB] flex items-center gap-3">
              <p className="flex-1 text-xs text-[#6B7280]">
                Bài sẽ hiện ngay ở trang chủ của học sinh được giao. Câu trắc nghiệm/điền khuyết có
                đáp án đúng sẽ tự chấm; câu tự luận vào hàng chờ chấm.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E6DCC8] bg-white font-bold text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="px-5 py-2.5 rounded-xl bg-[#E2704A] hover:bg-[#d1633c] text-white font-black text-sm disabled:opacity-40"
              >
                {saving ? 'Đang giao…' : 'Giao bài'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
