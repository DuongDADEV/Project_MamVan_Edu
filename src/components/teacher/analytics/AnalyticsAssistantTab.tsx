import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send,
  Sparkles,
  Loader2,
  KeyRound,
  Database,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { StudentState, EssaySubmission, RewardRequest, Question } from '../../../types.ts';
import { StudentAccount, ClassItem } from '../../../services/types.ts';
import { AnalyticsFilter } from '../../../analytics/types.ts';
import { getGeminiApiKey } from '../../../services/ai/index.ts';
import {
  askAnalyticsAssistant,
  AssistantContext,
  AssistantToolRun,
  AssistantChart,
} from '../../../services/ai/analyticsAssistant.ts';

interface AnalyticsAssistantTabProps {
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  classes: ClassItem[];
  topics: Array<{ id: string; title: string }>;
  essays: EssaySubmission[];
  rewards: RewardRequest[];
  questions: Record<string, Question>;
  filters: AnalyticsFilter;
  teacherId?: string;
  /** Dạng gọn cho bong bóng chat nổi: bỏ thẻ giới thiệu, khung chat chiếm toàn bộ chiều cao. */
  compact?: boolean;
}

interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  toolRuns?: AssistantToolRun[];
  chart?: AssistantChart;
  followups?: string[];
  isError?: boolean;
}

const STARTERS = [
  'Tổng quan lớp trong 6 tuần qua thế nào?',
  'Chủ đề nào học sinh đang yếu nhất?',
  'Phổ điểm của lớp ra sao?',
  'Câu hỏi nào nhiều em làm sai hoặc cần xem lại?',
  'Học sinh nào cần chú ý nhất lúc này?',
  'Tình hình điểm danh và nộp bài tập gần đây thế nào?',
];

let msgSeq = 1;

/** Render nhẹ markdown của trợ lý (đậm **, tiêu đề #, ##, ###, gạch đầu dòng)
 *  — tránh thêm thư viện ngoài cho một nhu cầu hiển thị nhỏ. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-bold text-[#2F3E6B]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={`${keyPrefix}-${i}`} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function renderRichText(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;
    const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      return (
        <div key={i} className="font-lora font-bold text-[#2F3E6B] mt-1.5 first:mt-0">
          {renderInline(heading[1].replace(/\*\*/g, ''), `h${i}`)}
        </div>
      );
    }
    if (/^[-•]\s+/.test(trimmed)) {
      return (
        <div key={i} className="flex gap-1.5 pl-1">
          <span className="text-[#2F3E6B] font-bold">•</span>
          <span className="flex-1">{renderInline(trimmed.replace(/^[-•]\s+/, ''), `b${i}`)}</span>
        </div>
      );
    }
    return <div key={i}>{renderInline(trimmed, `p${i}`)}</div>;
  });
}

export const AnalyticsAssistantTab: React.FC<AnalyticsAssistantTabProps> = ({
  students,
  studentStates,
  classes,
  topics,
  essays,
  rewards,
  questions,
  filters,
  teacherId,
  compact = false,
}) => {
  const [hasKey, setHasKey] = useState<boolean>(() => !!getGeminiApiKey());
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ctx: AssistantContext = useMemo(
    () => ({
      students,
      studentStates,
      classes,
      topics,
      essays,
      rewards,
      questions,
      filters,
      teacherId,
    }),
    [students, studentStates, classes, topics, essays, rewards, questions, filters, teacherId]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || busy) return;
    if (!getGeminiApiKey()) {
      setHasKey(false);
      return;
    }
    const history = messages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, text: m.text }));
    history.push({ role: 'user', text });
    setMessages((prev) => [...prev, { id: msgSeq++, role: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      const reply = await askAnalyticsAssistant(history, ctx);
      setMessages((prev) => [
        ...prev,
        {
          id: msgSeq++,
          role: 'assistant',
          text: reply.text,
          toolRuns: reply.toolRuns,
          chart: reply.chart,
          followups: reply.followups,
        },
      ]);
    } catch (err: any) {
      if (err?.message === 'NO_API_KEY') {
        setHasKey(false);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: msgSeq++,
          role: 'assistant',
          text:
            err?.message === 'NO_API_KEY'
              ? 'Chưa có khóa Gemini nên em chưa trả lời được. Thầy/cô nhập khóa ở mục Cài đặt → Mô hình Mầm AI rồi quay lại đây nhé.'
              : `Em chưa truy vấn được lúc này (${err?.message || 'lỗi kết nối'}). Thầy/cô thử gửi lại câu hỏi giúp em.`,
          isError: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!hasKey) {
    return (
      <div
        className={`bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-8 text-center space-y-4 ${
          compact ? 'h-full overflow-y-auto flex flex-col justify-center' : ''
        }`}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#2F3E6B] text-white flex items-center justify-center">
          <KeyRound className="w-7 h-7" />
        </div>
        <h3 className="font-lora font-bold text-lg text-[#2F3E6B]">
          Trợ lý phân tích cần khóa Gemini
        </h3>
        <p className="text-sm text-[#78716C] max-w-xl mx-auto leading-relaxed">
          Trợ lý dùng Gemini để hiểu câu hỏi, nhưng <b>mọi con số đều do hệ thống tính từ
          dữ liệu thật</b> trong các lớp của thầy/cô. Hãy nhập Google AI Studio API Key ở mục{' '}
          <b>Cài đặt → Mô hình Mầm AI</b> (cùng khóa đang dùng cho AI Studio và gợi ý chấm bài),
          rồi quay lại tab này.
        </p>
        <button
          type="button"
          onClick={() => setHasKey(!!getGeminiApiKey())}
          className="px-5 py-2.5 rounded-2xl bg-[#2F3E6B] text-white text-xs font-bold hover:opacity-90 transition"
        >
          Tôi đã nhập khóa — kiểm tra lại
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? 'h-full flex flex-col' : 'space-y-4'}>
      {/* Thẻ giới thiệu + nguyên tắc số liệu (ẩn ở dạng bong bóng gọn) */}
      {!compact && (
      <div className="bg-[#2F3E6B] text-white rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-lora font-bold text-base">Trợ lý phân tích học tập</h3>
          <p className="text-xs text-white/80 leading-relaxed flex items-start gap-1.5">
            <Database className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Thầy/cô cứ hỏi bằng lời thường — trợ lý tự truy vấn đúng dữ liệu, trình bày bằng
              chứng và đề xuất bước tiếp theo. Mọi con số do hệ thống tính từ dữ liệu thật;
              AI chỉ diễn đạt, không tự sinh số và không tự giao bài/đổi điểm.
            </span>
          </p>
        </div>
      </div>
      )}

      {/* Khung hội thoại */}
      <div
        className={`bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl overflow-hidden ${
          compact ? 'flex-1 flex flex-col min-h-0' : ''
        }`}
      >
        <div
          ref={scrollRef}
          className={
            compact
              ? 'flex-1 min-h-0 overflow-y-auto p-4 space-y-4'
              : 'max-h-[560px] overflow-y-auto p-4 sm:p-6 space-y-4'
          }
        >
          {messages.length === 0 && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-[#78716C] text-center">
                Thầy/cô muốn biết điều gì về lớp mình? Chọn một câu gợi ý hoặc tự đặt câu hỏi:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="px-3.5 py-2 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-semibold text-[#2F3E6B] hover:bg-[#F1E9D8] transition text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] sm:max-w-[70%] bg-[#2F3E6B] text-white rounded-3xl rounded-br-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div
                  className={`max-w-[92%] sm:max-w-[80%] rounded-3xl rounded-bl-md px-4 py-3.5 space-y-3 border ${
                    m.isError
                      ? 'bg-red-50 border-red-200'
                      : 'bg-[#FAF5EB] border-[#E6DCC8]'
                  }`}
                >
                  {m.isError && (
                    <div className="flex items-center gap-1.5 text-red-700 text-xs font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Chưa trả lời được
                    </div>
                  )}
                  {m.toolRuns && m.toolRuns.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.toolRuns.map((t, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-[#E6DCC8] text-[10px] font-bold text-[#2F3E6B]"
                        >
                          <Database className="w-3 h-3" /> {t.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-sm text-stone-800 leading-relaxed">
                    {m.role === 'assistant' && !m.isError ? renderRichText(m.text) : m.text}
                  </div>
                  {m.chart && m.chart.rows.length > 0 && (
                    <div className="bg-white border border-[#E6DCC8] rounded-2xl p-3">
                      <div className="text-xs font-bold text-[#2F3E6B] mb-2">{m.chart.title}</div>
                      <ResponsiveContainer width="100%" height={250}>
                        {m.chart.type === 'line' ? (
                          <LineChart data={m.chart.rows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" vertical={false} />
                            <XAxis dataKey={m.chart.xKey} tick={{ fontSize: 11, fill: '#78716C' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#FFFDF8', borderColor: '#E6DCC8', borderRadius: '12px', fontSize: '12px' }}
                              formatter={(val: any) => [val, m.chart!.yLabel]}
                            />
                            <Line type="monotone" dataKey={m.chart.yKey} stroke="#2F3E6B" strokeWidth={3} dot={{ r: 4, fill: '#2F3E6B' }} />
                          </LineChart>
                        ) : (
                          <BarChart data={m.chart.rows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E6DCC8" vertical={false} />
                            <XAxis dataKey={m.chart.xKey} tick={{ fontSize: 11, fill: '#78716C' }} interval={0} angle={-18} textAnchor="end" height={56} />
                            <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#FFFDF8', borderColor: '#E6DCC8', borderRadius: '12px', fontSize: '12px' }}
                              formatter={(val: any) => [val, m.chart!.yLabel]}
                            />
                            <Bar dataKey={m.chart.yKey} fill="#2F3E6B" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                  {m.toolRuns && m.toolRuns.length > 0 && (
                    <div className="text-[11px] text-[#8C7E6A] border-t border-[#E6DCC8] pt-2">
                      Bằng chứng: {m.toolRuns.map((t) => t.evidence).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}
                    </div>
                  )}
                  {m.followups && m.followups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.followups.map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={busy}
                          onClick={() => send(q)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white border border-[#E6DCC8] text-[11px] font-semibold text-[#2F3E6B] hover:bg-[#FAF5EB] transition disabled:opacity-50"
                        >
                          <Lightbulb className="w-3 h-3" /> {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {busy && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 bg-[#FAF5EB] border border-[#E6DCC8] rounded-3xl rounded-bl-md px-4 py-3 text-xs font-semibold text-[#78716C]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang truy vấn dữ liệu thật của lớp…
              </div>
            </div>
          )}
        </div>

        {/* Ô nhập câu hỏi */}
        <div className="border-t border-[#E6DCC8] p-3 sm:p-4 flex items-end gap-2 bg-white">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder="Hỏi về lớp của thầy/cô… (Enter để gửi, Shift+Enter xuống dòng)"
            className="flex-1 resize-none rounded-2xl border border-[#E6DCC8] bg-[#FFFDF8] px-4 py-3 text-sm outline-none focus:border-[#2F3E6B] transition"
          />
          <button
            type="button"
            disabled={busy || !input.trim()}
            onClick={() => send(input)}
            className="shrink-0 w-11 h-11 rounded-2xl bg-[#2F3E6B] text-white flex items-center justify-center hover:opacity-90 transition disabled:opacity-40"
            aria-label="Gửi câu hỏi"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
