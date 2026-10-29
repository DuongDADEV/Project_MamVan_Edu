import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Clock, CheckCircle2, Circle, ChevronRight, Eye } from 'lucide-react';
import { Topic, Quiz, TEST_QUIZ_KINDS } from '../types.ts';
import { getStudentAssignments } from '../services/api/biClient.ts';
import { formatScore } from '../utils/scoreFormat.ts';

// 29/10, chủ dự án: gộp thành 1 trang — kiểm tra (làm 1 lần), BTVN nội dung
// (kind 'homework') và bài tập BI đều hiện chung 1 danh sách, xếp theo hạn nộp.
// Quy tắc làm lại theo từng loại vẫn giữ (kiểm tra làm xong chỉ xem lại).
export const TEST_KINDS = TEST_QUIZ_KINDS;

interface AssignmentsScreenProps {
  quizzes: Quiz[];
  topics: Topic[];
  studentId: string;
  completedQuizIds: string[];
  onSelectQuiz: (quizId: string) => void;
  onOpenAssignment: (assignmentId: string) => void;
}

type ListItem =
  | {
      source: 'quiz';
      id: string;
      title: string;
      topicName: string;
      questionCount: number;
      dueMs: number | null;
      isTimed: boolean;
      timeLimitMinutes?: number;
      done: boolean;
      kindLabel: string;
      kind: Quiz['kind'];
    }
  | {
      source: 'assignment';
      id: string;
      title: string;
      topicName: string;
      questionCount: number;
      dueMs: number | null;
      isTimed: boolean;
      timeLimitMinutes?: number;
      done: boolean;
      bestScoreText: string | null;
    };

function toMs(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function fmtDue(ms: number | null): string {
  if (ms === null) return 'Không hạn nộp';
  const d = new Date(ms);
  return `Hạn nộp: ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const KIND_LABEL: Record<string, string> = {
  quick: 'Kiểm tra nhanh',
  mastery: 'Kiểm tra thành thạo',
  final: 'Kiểm tra cuối kỳ',
  homework: 'Bài tập về nhà',
  practice: 'Luyện tập',
  reading: 'Đọc hiểu',
};

function sortByDue(a: ListItem, b: ListItem): number {
  if (a.dueMs === null && b.dueMs === null) return a.title.localeCompare(b.title);
  if (a.dueMs === null) return 1;
  if (b.dueMs === null) return -1;
  return a.dueMs - b.dueMs;
}

export const AssignmentsScreen: React.FC<AssignmentsScreenProps> = ({
  quizzes,
  topics,
  studentId,
  completedQuizIds,
  onSelectQuiz,
  onOpenAssignment,
}) => {
  const [biItems, setBiItems] = useState<ListItem[]>([]);
  const [biLoaded, setBiLoaded] = useState(false);

  const topicName = useMemo(() => {
    const map = new Map<string, string>();
    (topics || []).forEach((t) => map.set(t.id, t.title));
    return map;
  }, [topics]);

  useEffect(() => {
    let cancelled = false;
    setBiLoaded(false);
    getStudentAssignments(studentId)
      .then((rows) => {
        if (cancelled) return;
        const items: ListItem[] = (rows || []).map((r: any) => {
          const attempts = r.attempts || [];
          const done = r.status === 'SUBMITTED' || attempts.length > 0;
          let bestScoreText: string | null = null;
          if (attempts.length > 0) {
            const scored = attempts.filter((a: any) => a.score_awarded != null && a.max_score != null);
            if (scored.length > 0) {
              const best = scored.reduce((acc: any, cur: any) =>
                Number(cur.score_awarded) / Number(cur.max_score) > Number(acc.score_awarded) / Number(acc.max_score) ? cur : acc
              );
              bestScoreText = `Điểm cao nhất: ${formatScore(Number(best.score_awarded))}/${formatScore(Number(best.max_score))}`;
            }
          }
          return {
            source: 'assignment',
            id: r.assignmentId,
            title: r.title,
            topicName: 'Bài tập cô giao',
            questionCount: r.questionCount || 0,
            dueMs: toMs(r.dueAt),
            isTimed: !!r.isTimed,
            timeLimitMinutes: r.timeLimitMinutes ?? undefined,
            done,
            bestScoreText,
          } as ListItem;
        });
        setBiItems(items);
        setBiLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setBiItems([]);
          setBiLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const testItems = useMemo<ListItem[]>(
    () =>
      (quizzes || [])
        .filter((q) => TEST_KINDS.includes(q.kind))
        .map((q) => ({
          source: 'quiz' as const,
          id: q.id,
          title: q.title,
          topicName: topicName.get(q.topicId) || 'Chủ đề',
          questionCount: (q.questionIds || []).length,
          dueMs: toMs(q.dueDate),
          isTimed: q.timeLimitMinutes !== undefined,
          timeLimitMinutes: q.timeLimitMinutes,
          done: completedQuizIds.includes(q.id),
          kindLabel: KIND_LABEL[q.kind] || 'Kiểm tra',
          kind: q.kind,
        }))
        .sort(sortByDue),
    [quizzes, topicName, completedQuizIds]
  );

  const homeworkItems = useMemo<ListItem[]>(
    () =>
      [
        ...(quizzes || [])
          .filter((q) => q.kind === 'homework')
          .map((q) => ({
            source: 'quiz' as const,
            id: q.id,
            title: q.title,
            topicName: topicName.get(q.topicId) || 'Chủ đề',
            questionCount: (q.questionIds || []).length,
            dueMs: toMs(q.dueDate),
            isTimed: q.timeLimitMinutes !== undefined,
            timeLimitMinutes: q.timeLimitMinutes,
            done: completedQuizIds.includes(q.id),
            kindLabel: KIND_LABEL.homework,
            kind: q.kind,
          })),
        ...biItems,
      ].sort(sortByDue),
    [quizzes, topicName, completedQuizIds, biItems]
  );

  const items = useMemo<ListItem[]>(
    () => [...testItems, ...homeworkItems].sort(sortByDue),
    [testItems, homeworkItems]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-[#2F3E6B] flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-[#E2704A]" /> Bài tập
        </h1>
        <p className="text-sm text-[#8C7E6A] mt-1">
          Bài kiểm tra làm 1 lần — làm xong vẫn xem lại được nhưng không tính điểm mới. Bài tập về nhà làm lại không giới hạn.
        </p>
      </div>

      {!biLoaded && (
        <p className="text-sm text-[#8C7E6A] italic">Đang tải bài tập cô giao…</p>
      )}

      {items.length === 0 && biLoaded ? (
        <div className="bg-white border border-[#E6DCC8] rounded-2xl p-8 text-center">
          <p className="font-bold text-[#2F3E6B]">Chưa có bài tập nào.</p>
          <p className="text-sm text-[#8C7E6A] mt-1">Khi cô giao bài mới, bài sẽ hiện ở đây theo hạn nộp.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={`${item.source}:${item.id}`}
              type="button"
              onClick={() =>
                item.source === 'quiz' ? onSelectQuiz(item.id) : onOpenAssignment(item.id)
              }
              className="w-full text-left bg-white border border-[#E6DCC8] rounded-2xl p-4 hover:border-[#2F3E6B] transition flex items-center gap-3"
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] flex items-center justify-center">
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-[#2F6B4F]" />
                ) : (
                  <Circle className="w-5 h-5 text-[#8C7E6A]" />
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-[#2F3E6B] truncate">{item.title}</span>
                <span className="block text-xs text-[#8C7E6A] mt-0.5">
                  {item.topicName} • {item.questionCount} câu
                  {item.isTimed && item.timeLimitMinutes ? ` • ${item.timeLimitMinutes} phút` : ''}
                  {item.source === 'quiz' ? ` • ${(item as Extract<ListItem, { source: 'quiz' }>).kindLabel}` : ''}
                </span>
                <span className="flex items-center gap-1 text-xs text-[#8C7E6A] mt-0.5">
                  <Clock className="w-3.5 h-3.5" /> {fmtDue(item.dueMs)}
                  {item.source === 'assignment' &&
                    (item as Extract<ListItem, { source: 'assignment' }>).bestScoreText && (
                      <span className="font-bold text-[#2F6B4F]">
                        {' '}
                        • {(item as Extract<ListItem, { source: 'assignment' }>).bestScoreText}
                      </span>
                    )}
                </span>
              </span>
              <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-[#2F3E6B]">
                {item.done &&
                item.source === 'quiz' &&
                TEST_KINDS.includes((item as Extract<ListItem, { source: 'quiz' }>).kind) ? (
                  <>
                    <Eye className="w-4 h-4" /> Xem lại
                  </>
                ) : item.done ? (
                  'Đã nộp'
                ) : (
                  'Làm bài'
                )}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
