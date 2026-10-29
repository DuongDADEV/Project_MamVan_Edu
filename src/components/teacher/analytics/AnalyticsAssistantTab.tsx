import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send,
  Trash2,
  Loader2,
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
import { MamMuc } from '../../MamMuc.tsx';
import { StudentAccount, ClassItem } from '../../../services/types.ts';
import { AnalyticsFilter } from '../../../analytics/types.ts';
import {
  askAnalyticsAssistant,
  filterFollowupsByRealClasses,
  AssistantContext,
  AssistantToolRun,
  AssistantChart,
} from '../../../services/ai/analyticsAssistant.ts';

interface AnalyticsAssistantTabProps {
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  classes: ClassItem[];
  topics: Array<{ id: string; title: string; videoIds?: string[]; theoryId?: string }>;
  quizzes?: Array<{ id: string; topicId?: string }>;
  essays: EssaySubmission[];
  rewards: RewardRequest[];
  questions: Record<string, Question>;
  filters: AnalyticsFilter;
  teacherId?: string;
  /** Dạng gọn cho bong bóng chat nổi: bỏ thẻ giới thiệu, khung chat chiếm toàn bộ chiều cao. */
  compact?: boolean;
}

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractTable, toCards, shouldStack } from './tableCards.ts';
import {
  useAssistantChat,
  appendAssistantMsg,
  setAssistantBusy,
  clearAssistantChat,
  initAssistantChatSync,
  type ChatMsg,
} from './assistantChatStore.ts';

const STARTERS = [
  'Tổng quan lớp trong 6 tuần qua thế nào?',
  'Chủ đề nào học sinh đang yếu nhất?',
  'Phổ điểm của lớp ra sao?',
  'Câu hỏi nào nhiều em làm sai hoặc cần xem lại?',
  'Học sinh nào cần chú ý nhất lúc này?',
  'Tình hình điểm danh và nộp bài tập gần đây thế nào?',
];


export const AnalyticsAssistantTab: React.FC<AnalyticsAssistantTabProps> = ({
  students,
  studentStates,
  classes,
  topics,
  quizzes,
  essays,
  rewards,
  questions,
  filters,
  teacherId,
  compact = false,
}) => {
  const { messages, busy } = useAssistantChat();
  const [input, setInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  // Mã lượt gửi tăng dần: để timer timeout và khối finally của một lượt cũ
  // không bao giờ chạm vào trạng thái của lượt gửi mới hơn (sau khi timeout
  // thoát busy, người dùng có thể gửi câu mới trong khi lượt cũ vẫn treo).
  const sendSeq = useRef(0);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 6000);
    return () => clearTimeout(t);
  }, [confirmClear]);
  // Đồng bộ lịch sử chat với server (đợt 4): tab và bong bóng
  // nổi đều render component này nên một chỗ móc là đủ cho cả hai.
  useEffect(() => {
    initAssistantChatSync(teacherId);
  }, [teacherId]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ctx: AssistantContext = useMemo(
    () => ({
      students,
      studentStates,
      classes,
      topics,
      quizzes,
      essays,
      rewards,
      questions,
      filters,
      teacherId,
    }),
    [students, studentStates, classes, topics, quizzes, essays, rewards, questions, filters, teacherId]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || busy) return;
    const history = messages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, text: m.text }));
    history.push({ role: 'user', text });
    appendAssistantMsg({ role: 'user', text });
    setInput('');
    setAssistantBusy(true);
    // Thoát kẹt (25/10): đường truy vấn + chờ Gemini hiện KHÔNG có
    // timeout/abort nào nên model/mạng treo là bong bóng xoay mãi. Mốc 180
    // giây: quá mốc thì tự thoát busy + báo lỗi trong khung chat để người
    // dùng hỏi lại được. Không đổi prompt, tools hay cách truy vấn — chỉ
    // thêm cơ chế thoát kẹt; request cũ về muộn sau mốc sẽ bị bỏ qua.
    const mySeq = ++sendSeq.current;
    let timedOut = false;
    const timer = setTimeout(() => {
      if (sendSeq.current !== mySeq) return;
      timedOut = true;
      appendAssistantMsg({
        role: 'assistant',
        text: 'Truy vấn quá lâu (quá 180 giây), em chưa nhận được kết quả. Thầy/cô thử hỏi lại giúp em.',
        isError: true,
      });
      setAssistantBusy(false);
    }, 180000);
    try {
      const reply = await askAnalyticsAssistant(history, ctx);
      if (!timedOut) {
        appendAssistantMsg({
          role: 'assistant',
          text: reply.text,
          toolRuns: reply.toolRuns,
          chart: reply.chart,
          followups: reply.followups,
        });
      }
    } catch (err: any) {
      if (!timedOut) {
        appendAssistantMsg({
          role: 'assistant',
          text: `Em chưa truy vấn được lúc này (${err?.message || 'lỗi kết nối'}). Thầy/cô thử gửi lại câu hỏi giúp em.`,
          isError: true,
        });
      }
    } finally {
      clearTimeout(timer);
      if (sendSeq.current === mySeq && !timedOut) setAssistantBusy(false);
    }
  };

  return (
    <div className={compact ? 'h-full flex flex-col' : 'space-y-4'}>
      {/* Thẻ giới thiệu + nguyên tắc số liệu (ẩn ở dạng bong bóng gọn) */}
      {!compact && (
      <div className="bg-[#2F3E6B] text-white rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center">
        {/* 29/10: biểu tượng trợ lý đổi từ tia sáng sang mascot Mầm Mực */}
        <MamMuc size="sm" animate={false} className="shrink-0" />
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
                    {m.role === 'assistant' && !m.isError ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                          strong: ({ children }) => (
                            <strong className="font-bold text-[#2F3E6B]">{children}</strong>
                          ),
                          em: ({ children }) => <em className="italic">{children}</em>,
                          h1: ({ children }) => (
                            <div className="font-lora font-bold text-[#2F3E6B] mt-2 first:mt-0 mb-1">{children}</div>
                          ),
                          h2: ({ children }) => (
                            <div className="font-lora font-bold text-[#2F3E6B] mt-2 first:mt-0 mb-1">{children}</div>
                          ),
                          h3: ({ children }) => (
                            <div className="font-lora font-bold text-[#2F3E6B] mt-2 first:mt-0 mb-1">{children}</div>
                          ),
                          h4: ({ children }) => (
                            <div className="font-lora font-bold text-[#2F3E6B] mt-2 first:mt-0 mb-1">{children}</div>
                          ),
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-1.5 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-1.5 space-y-0.5">{children}</ol>,
                          li: ({ children }) => <li>{children}</li>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-[#C9BFA9] pl-3 my-1.5 text-stone-600">{children}</blockquote>
                          ),
                          a: ({ children, href }) => (
                            <a href={href} target="_blank" rel="noreferrer" className="underline text-[#2F3E6B]">
                              {children}
                            </a>
                          ),
                          code: ({ children }) => (
                            <code className="bg-[#FAF5EB] border border-[#E6DCC8] rounded px-1 text-[13px]">{children}</code>
                          ),
                          // ĐỢT 7 (26/10): bảng rộng tự đổi thành thẻ dọc —
                          // bảng quá 3 cột trong bong bóng hẹp kiểu gì cũng
                          // tràn nên cột đầu thành tiêu đề thẻ, các cột còn
                          // lại thành dòng 'Nhãn: giá trị'; bảng hẹp giữ
                          // dạng bảng thường có cuộn ngang dự phòng.
                          table: ({ children }) => {
                            const extracted = extractTable(children);
                            if (extracted && shouldStack(extracted.headers)) {
                              const cards = toCards(extracted.headers, extracted.rows);
                              return (
                                <div className="space-y-2 my-1.5">
                                  {cards.map((c, i) => (
                                    <div key={i} className="bg-white border border-[#E6DCC8] rounded-xl p-2">
                                      <div className="font-bold text-[#2F3E6B] text-xs mb-1">{c.title}</div>
                                      {c.lines.map((l, j) => (
                                        <div key={j} className="text-xs text-stone-700 leading-relaxed">
                                          <span className="text-stone-500">{l.label}: </span>
                                          {l.value}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <div className="overflow-x-auto my-1.5 -mx-1 px-1">
                                <table className="w-full text-xs border-collapse">{children}</table>
                              </div>
                            );
                          },
                          th: ({ children }) => (
                            <th className="border border-[#E6DCC8] bg-[#FAF5EB] px-2 py-1 text-left font-bold text-[#2F3E6B] whitespace-nowrap">{children}</th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-[#E6DCC8] px-2 py-1 align-top break-words">{children}</td>
                          ),
                          // ĐỢT 7 (26/10): câu trả lời trợ lý KHÔNG bao giờ hiện ảnh
                          // markdown — biểu đồ duy nhất là chart Recharts từ
                          // render_chart; ảnh markdown do model chèn (vd ảnh
                          // hỏng 'Biểu đồ đăng nhập') chỉ hiện icon vỡ + nhấp
                          // nháy khi khung chat re-render nên bỏ hẳn nút này.
                          img: () => null,
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    ) : (
                      m.text
                    )}
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
                  {m.followups && filterFollowupsByRealClasses(m.followups, classes.map((c) => c.name)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {/* Lọc lần nữa ở tầng hiện: tin cũ đã lưu (vd gợi ý 7A5/7A6 bịa) cũng biến mất khỏi màn hình mà không cần xóa lịch sử. */}
                      {filterFollowupsByRealClasses(m.followups, classes.map((c) => c.name)).map((q) => (
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
          {messages.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirmClear) {
                  clearAssistantChat();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                }
              }}
              className={`shrink-0 h-11 rounded-2xl border flex items-center justify-center gap-1.5 transition disabled:opacity-40 ${
                confirmClear
                  ? 'px-3 bg-red-600 border-red-600 text-white text-xs font-bold'
                  : 'w-11 border-[#E6DCC8] text-[#78716C] hover:bg-[#FAF5EB] hover:text-red-700'
              }`}
              aria-label="Xóa lịch sử trò chuyện"
              title="Xóa lịch sử trò chuyện (áp dụng cho cả tab và bong bóng chat)"
            >
              <Trash2 className="w-5 h-5" />
              {confirmClear && <span>Xóa hết?</span>}
            </button>
          )}
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
