/**
 * Phần dưới banner của tab Tổng quan — dựng lại trang "Tổng quan" của file
 * Power BI Dashboard_MamVan__1.pbix: bộ lọc + 4 KPI + 3 bảng + 2 biểu đồ.
 * Mọi con số do computePbixDashboard tính từ dữ liệu Supabase thật bằng đúng
 * công thức DAX (xem pbixDashboard.ts). KHÔNG hardcode số từ ảnh pbix.
 *
 * Bố cục bám trang pbix (desktop rộng): hàng KPI trên cùng; tiếp theo là
 * bảng học sinh + bảng bài giao + bảng chủ đề; cuối là biểu đồ mức tư duy
 * + biểu đồ đường đăng nhập theo ngày. Màu: thanh cam đào + đường xanh dương
 * theo ảnh pbix; thẻ trắng trên nền be của app.
 *
 * Cross-filter (25/10): bấm một dòng trong bảng học sinh để xem riêng em đó
 * trên mọi panel còn lại (KPI nộp bài / điểm đạt / chờ chấm, bảng bài giao,
 * bảng chủ đề, 2 biểu đồ); KPI Hoạt động 7 ngày giữ mức toàn lớp vì công
 * thức pbix đếm DISTINCT học sinh.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  BookOpenCheck,
  Hourglass,
  Target,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  LabelList,
} from 'recharts';
import type { ClassItem, TopicWithMeta, QuizWithMeta } from '../../../services/types.ts';
import type { Question, StudentState } from '../../../types.ts';
import type { PbixRawData } from '../../../analytics/pbixDashboardData.ts';
import {
  computePbixDashboard,
  computeTopicCompletionTable,
  formatOneDecimalPercent,
  formatScore1dp,
  formatVNDate,
  formatVNDateTime,
  formatWholePercent,
  saigonDateKey,
} from '../../../analytics/pbixDashboard.ts';

export interface PbixOverviewFilters {
  /** id lớp trong props (rỗng = tất cả các lớp của giáo viên). */
  classIds: string[];
  /** YYYY-MM-DD hoặc null = không giới hạn. */
  dateFrom: string | null;
  dateTo: string | null;
}

interface Props {
  raw: PbixRawData;
  classes: ClassItem[];
  filters: PbixOverviewFilters;
  onFiltersChange: (f: PbixOverviewFilters) => void;
  loading: boolean;
  /** Chủ đề + quiz + câu hỏi + states của portal (để tính bảng chủ đề). */
  topics: TopicWithMeta[];
  quizzes: QuizWithMeta[];
  questions: Record<string, Question>;
  studentStates: Record<string, StudentState>;
}

const BAR_PEACH = '#E0957A';
const LINE_BLUE = '#118DFF';

function KpiCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
        {props.icon}
        <span>{props.label}</span>
      </div>
      <div className="mt-2 text-3xl font-bold text-[#2F3E6B]">{props.value}</div>
      <div className="mt-1 text-xs text-stone-500">{props.sub}</div>
    </div>
  );
}

function CardTitle(props: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="text-base font-bold text-[#2F3E6B]">{props.children}</h3>
      {props.right}
    </div>
  );
}

function EmptyNote(props: { children: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-sm text-stone-500">{props.children}</div>
  );
}

/**
 * Chiều cao vùng cuộn cho đúng 7 dòng: đo từ render thực tế (chiều cao
 * thead + chiều cao dòng lớn nhất trong 7 dòng đầu), không giả định số px
 * — vì chiều cao header thay đổi theo số dòng xuống dòng của tiêu đề cột
 * theo độ rộng thẻ, và chiều cao dòng thay đổi theo font/border. Khi ≤ 7
 * dòng thì không giới hạn (cao tự nhiên, không cuộn). Đo lại khi số dòng
 * đổi, khi bảng/thẻ đổi kích thước (ResizeObserver) và khi cửa sổ resize.
 */
function useSevenRowMaxHeight(rowCount: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const table = container.querySelector('table');
      const thead = table?.querySelector('thead');
      const rows = table?.querySelectorAll('tbody tr');
      if (!table || !thead || !rows || rows.length === 0) return;
      if (rows.length <= 7) {
        setMaxHeight((prev) => (prev === undefined ? prev : undefined));
        return;
      }
      let rowH = 0;
      for (let i = 0; i < 7; i++) {
        rowH = Math.max(rowH, (rows[i] as HTMLElement).offsetHeight);
      }
      const next = thead.offsetHeight + rowH * 7;
      setMaxHeight((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    const table = container.querySelector('table');
    if (table) ro.observe(table);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [rowCount]);
  return { containerRef, maxHeight };
}

export const PbixOverviewSection: React.FC<Props> = ({
  raw,
  classes,
  filters,
  onFiltersChange,
  loading,
  topics,
  quizzes,
  questions,
  studentStates,
}) => {
  // Học sinh trong phạm vi lớp đang chọn (lớp áp cho mọi visual).
  const scopedStudents = useMemo(() => {
    if (filters.classIds.length === 0) return raw.students;
    const mapped = new Set(filters.classIds.map((id) => raw.classMap[id] ?? id));
    return raw.students.filter(
      (s) => mapped.has(s.supaClassId) || filters.classIds.includes(s.appClassId),
    );
  }, [raw.students, raw.classMap, filters.classIds]);

  const todayKey = useMemo(() => saigonDateKey(new Date().toISOString()), []);
  const dashboard = useMemo(
    () =>
      computePbixDashboard({
        students: scopedStudents,
        sessions: raw.sessions,
        targets: raw.targets,
        assignments: raw.assignments,
        attempts: raw.attempts,
        answers: raw.answers,
        questionLevels: raw.questionLevels,
        activities: raw.activities,
        progress: raw.progress,
        filters: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        },
        todayKey,
      }),
    [scopedStudents, raw, filters.dateFrom, filters.dateTo, todayKey],
  );

  // Cross-filter: bấm một dòng học sinh để xem riêng em đó trên mọi panel
  // còn lại (kiểu cross-filter của Power BI). Bảng học sinh vẫn hiện đủ
  // các dòng để đổi sang em khác. KPI "Hoạt động 7 ngày" giữ mức toàn lớp
  // vì công thức pbix đếm DISTINCT học sinh — "số ngày em đó đăng nhập"
  // là một chỉ số khác, không phải công thức gốc nên không tự đổi.
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const selectedStudent = useMemo(
    () => scopedStudents.find((s) => s.supaId === selectedStudentId) ?? null,
    [scopedStudents, selectedStudentId],
  );
  // Đổi lớp lọc làm học sinh đang chọn ra khỏi phạm vi → tự bỏ chọn.
  useEffect(() => {
    if (selectedStudentId && !selectedStudent) setSelectedStudentId(null);
  }, [selectedStudentId, selectedStudent]);
  // Chạy tính toán lần 2 với đúng 1 học sinh cho mọi panel trừ bảng học sinh
  // và KPI Hoạt động 7 ngày (giữ mức toàn lớp). Không chọn ai thì dùng chung
  // kết quả toàn lớp, không tính thừa.
  const dashboardSel = useMemo(() => {
    if (!selectedStudent) return dashboard;
    return computePbixDashboard({
      students: [selectedStudent],
      sessions: raw.sessions,
      targets: raw.targets,
      assignments: raw.assignments,
      attempts: raw.attempts,
      answers: raw.answers,
      questionLevels: raw.questionLevels,
      activities: raw.activities,
      progress: raw.progress,
      filters: {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
      todayKey,
    });
  }, [selectedStudent, dashboard, raw, filters.dateFrom, filters.dateTo, todayKey]);

  // Bảng chủ đề: chỉ chịu lọc lớp (qua scopedStudents); trạng thái hoàn
  // thành không gắn ngày nên không chịu lọc ngày, và trải mọi luồng nên
  // không chịu lọc luồng. State tra theo cả 2 khóa (supaId/appId). Khi đã
  // chọn một học sinh, bảng tính riêng cho em đó (tổng số = 1, mỗi chủ đề
  // 0% hoặc 100%).
  const topicTable = useMemo(() => {
    const list = selectedStudent ? [selectedStudent] : scopedStudents;
    const states = list
      .map((s) => studentStates[s.supaId] ?? studentStates[s.appId])
      .filter((st): st is StudentState => Boolean(st));
    return computeTopicCompletionTable(topics, quizzes, questions, states);
  }, [selectedStudent, scopedStudents, topics, quizzes, questions, studentStates]);

  // Vùng cuộn 7 dòng cho bảng học sinh + bảng chủ đề (đo từ render thực tế).
  const studentsScroll = useSevenRowMaxHeight(dashboard.studentsTable.length);
  const topicsScroll = useSevenRowMaxHeight(topicTable.length);

  // Mặc định khoảng ngày = khoảng dữ liệu thật (áp một lần khi nạp xong; sau
  // đó người dùng tự chỉnh, không tự ghi đè lại).
  const dateDefaultsApplied = useRef(false);
  useEffect(() => {
    if (dateDefaultsApplied.current) return;
    if (!raw.loaded || !dashboard.sessionDateRange) return;
    dateDefaultsApplied.current = true;
    if (filters.dateFrom === null && filters.dateTo === null) {
      onFiltersChange({
        ...filters,
        dateFrom: dashboard.sessionDateRange.min,
        dateTo: dashboard.sessionDateRange.max,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw.loaded, dashboard.sessionDateRange]);

  const selectedClassValue =
    filters.classIds.length === 0 ? '__ALL__' : filters.classIds[0];

  return (
    <div className="space-y-4">
      {/* Bộ lọc — đúng 3 slicer của trang pbix */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-600">Lớp học</span>
          <select
            className="border border-stone-300 rounded-lg px-3 py-2 bg-white min-w-[200px]"
            value={selectedClassValue}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                classIds: e.target.value === '__ALL__' ? [] : [e.target.value],
              })
            }
          >
            <option value="__ALL__">Tất cả các lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-600">Khoảng thời gian (từ ngày)</span>
          <input
            type="date"
            className="border border-stone-300 rounded-lg px-3 py-2 bg-white"
            value={filters.dateFrom ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, dateFrom: e.target.value || null })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-600">Khoảng thời gian (đến ngày)</span>
          <input
            type="date"
            className="border border-stone-300 rounded-lg px-3 py-2 bg-white"
            value={filters.dateTo ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, dateTo: e.target.value || null })
            }
          />
        </label>
      </div>

      {/* Chỉ báo cross-filter: đang xem riêng một học sinh */}
      {selectedStudent && (
        <div className="bg-indigo-50 rounded-2xl border border-indigo-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[#2F3E6B]">
            Đang xem: {selectedStudent.name}
            <button
              type="button"
              aria-label="Bỏ chọn học sinh"
              onClick={() => setSelectedStudentId(null)}
              className="w-6 h-6 rounded-full bg-white border border-indigo-200 text-[#2F3E6B] text-sm leading-none hover:bg-indigo-100 cursor-pointer"
            >
              ✕
            </button>
          </span>
          <span className="text-xs text-stone-600">
            Các panel dưới đây chỉ hiện dữ liệu của em này (trừ KPI Hoạt động 7
            ngày vẫn tính toàn lớp). Bấm lại vào dòng em đó trong bảng học sinh
            hoặc bấm ✕ để trở về xem toàn bộ.
          </span>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 text-sm text-stone-500">
          Đang tải dữ liệu dashboard…
        </div>
      )}
      {!loading && !raw.loaded && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm p-5 text-sm text-amber-800">
          Chưa kết nối được dữ liệu BI (Supabase chưa sẵn sàng hoặc chưa có dữ
          liệu) — các bảng và biểu đồ bên dưới sẽ trống.
        </div>
      )}

      {/* 4 thẻ KPI — đúng nhãn + đúng công thức pbix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users size={16} />}
          label="Hoạt động 7 ngày"
          value={String(dashboard.activeLast7)}
          sub={
            dashboard.anchorDate
              ? `Học sinh đăng nhập trong 7 ngày tới ${formatVNDate(dashboard.anchorDate)}`
              : 'Chưa có dữ liệu đăng nhập'
          }
        />
        <KpiCard
          icon={<BookOpenCheck size={16} />}
          label="Tỷ lệ nộp bài"
          value={formatWholePercent(dashboardSel.submissionRate)}
          sub={
            dashboardSel.totalTargets > 0
              ? `${dashboardSel.submittedTargets}/${dashboardSel.totalTargets} lượt giao đã nộp`
              : 'Chưa có bài được giao'
          }
        />
        <KpiCard
          icon={<Hourglass size={16} />}
          label="Câu trả lời chờ chấm"
          value={String(dashboardSel.pendingAnswers)}
          sub="Câu trả lời đang chờ chấm"
        />
        <KpiCard
          icon={<Target size={16} />}
          label="Tỷ lệ điểm đạt"
          value={formatWholePercent(dashboardSel.passRate)}
          sub={
            dashboardSel.passRate !== null
              ? `${formatScore1dp(dashboardSel.gradedScoreSum)}/${formatScore1dp(dashboardSel.gradedMaxSum)} điểm (câu đã chấm)`
              : 'Chưa có câu trả lời đã chấm'
          }
        />
      </div>

      {/* Hàng 2: bảng học sinh + bảng bài giao + bảng chủ đề */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 lg:col-span-5 flex flex-col self-start">
          <CardTitle
            right={
              <span className="text-xs text-stone-500">
                {dashboard.studentsTable.length} học sinh
              </span>
            }
          >
            Học sinh cần quan tâm
          </CardTitle>
          {dashboard.studentsTable.length === 0 ? (
            <EmptyNote>Chưa có học sinh trong phạm vi đang lọc.</EmptyNote>
          ) : (
            <>
            <div
              ref={studentsScroll.containerRef}
              className="flex-1 min-h-0 overflow-x-auto overflow-y-auto"
              style={studentsScroll.maxHeight !== undefined ? { maxHeight: studentsScroll.maxHeight } : undefined}
            >
              {/* Chiều cao đo từ render thực tế (thead + 7 dòng đầu): lúc chưa
                  cuộn thấy đúng 7 dòng học sinh, từ dòng thứ 8 trở đi chỉ
                  thấy khi cuộn trong bảng. */}
              <table className="w-full text-sm table-fixed border-separate border-spacing-0">
                <colgroup>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '30%' }} />
                </colgroup>
                <thead>
                  <tr className="text-left text-stone-500">
                    <th className="py-2 pr-3 font-semibold sticky top-0 z-10 bg-white border-b">Họ tên</th>
                    <th className="py-2 pr-3 font-semibold sticky top-0 z-10 bg-white border-b">Hoạt động gần nhất</th>
                    <th className="py-2 pr-3 font-semibold text-right sticky top-0 z-10 bg-white border-b">Số bài chưa nộp</th>
                    <th className="py-2 pr-3 font-semibold text-right sticky top-0 z-10 bg-white border-b">Tỷ lệ đạt điểm cá nhân</th>
                    <th className="py-2 font-semibold sticky top-0 z-10 bg-white border-b">Gợi ý theo dõi</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.studentsTable.map((r, rowIdx) => {
                    const cellBorder =
                      rowIdx === dashboard.studentsTable.length - 1
                        ? ''
                        : 'border-b border-stone-100';
                    return (
                    <tr
                      key={r.studentId}
                      onClick={() =>
                        setSelectedStudentId(
                          selectedStudentId === r.studentId ? null : r.studentId,
                        )
                      }
                      title="Bấm để xem riêng học sinh này trên mọi panel (bấm lại để bỏ chọn)"
                      className={`cursor-pointer hover:bg-indigo-50/60 ${
                        selectedStudentId === r.studentId ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <td className={`py-2 pr-3 font-medium truncate ${cellBorder}`} title={r.name}>{r.name}</td>
                      <td className={`py-2 pr-3 whitespace-nowrap ${cellBorder}`}>
                        {formatVNDateTime(r.lastLoginAt)}
                      </td>
                      <td className={`py-2 pr-3 text-right ${cellBorder}`}>{r.unsubmitted}</td>
                      <td className={`py-2 pr-3 text-right ${cellBorder}`}>
                        {formatOneDecimalPercent(r.personalRate)}
                      </td>
                      <td className={`py-2 truncate ${cellBorder}`} title={r.suggestion}>{r.suggestion}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {dashboard.studentsTotal && (
              <div className="shrink-0 overflow-x-auto border-t border-stone-200">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '30%' }} />
                  </colgroup>
                  <tbody>
                    <tr className="font-bold">
                      <td className="py-2 pr-3">Tổng cộng</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatVNDateTime(dashboard.studentsTotal.lastLoginAt)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {dashboard.studentsTotal.unsubmitted}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatOneDecimalPercent(dashboard.studentsTotal.overallRate)}
                      </td>
                      <td className="py-2 truncate" title={dashboard.studentsTotal.suggestion}>{dashboard.studentsTotal.suggestion}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 lg:col-span-4">
          <CardTitle>Tiến độ bài được giao</CardTitle>
          {dashboardSel.assignmentsTable.length === 0 ? (
            <EmptyNote>Chưa có bài được giao cho lớp đang lọc.</EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 border-b">
                    <th className="py-2 pr-3 font-semibold">Bài tập</th>
                    <th className="py-2 pr-3 font-semibold text-right">Được giao</th>
                    <th className="py-2 pr-3 font-semibold text-right">Đã nộp</th>
                    <th className="py-2 pr-3 font-semibold text-right">Chưa nộp</th>
                    <th className="py-2 font-semibold text-right">Tỷ lệ nộp bài</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardSel.assignmentsTable.map((r) => (
                    <tr key={r.assignmentId} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.title}</td>
                      <td className="py-2 pr-3 text-right">{r.assigned}</td>
                      <td className="py-2 pr-3 text-right">{r.submitted}</td>
                      <td className="py-2 pr-3 text-right">{r.unsubmitted}</td>
                      <td className="py-2 text-right">{formatWholePercent(r.rate)}</td>
                    </tr>
                  ))}
                  {dashboardSel.assignmentsTotal && (
                    <tr className="font-bold bg-stone-50">
                      <td className="py-2 pr-3">Tổng cộng</td>
                      <td className="py-2 pr-3 text-right">
                        {dashboardSel.assignmentsTotal.assigned}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {dashboardSel.assignmentsTotal.submitted}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {dashboardSel.assignmentsTotal.unsubmitted}
                      </td>
                      <td className="py-2 text-right">
                        {formatWholePercent(dashboardSel.assignmentsTotal.rate)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 lg:col-span-3 flex flex-col self-start">
          <CardTitle
            right={
              <span className="text-xs text-stone-500">{topicTable.length} chủ đề</span>
            }
          >
            Tiến độ hoàn thành luồng theo chủ đề
          </CardTitle>
          {topics.length === 0 ? (
            <EmptyNote>Chưa có chủ đề trong phạm vi đang lọc.</EmptyNote>
          ) : topicTable.length > 0 && topicTable[0].total === 0 ? (
            <EmptyNote>
              {selectedStudent
                ? 'Chưa có dữ liệu trạng thái của học sinh đang chọn.'
                : 'Chưa có học sinh trong phạm vi đang lọc.'}
            </EmptyNote>
          ) : (
            <>
              <div
                ref={topicsScroll.containerRef}
                className="flex-1 min-h-0 overflow-x-auto overflow-y-auto"
                style={topicsScroll.maxHeight !== undefined ? { maxHeight: topicsScroll.maxHeight } : undefined}
              >
                {/* Chiều cao đo từ render thực tế (thead + 7 dòng đầu): lúc chưa
                    cuộn thấy đúng 7 chủ đề, từ chủ đề thứ 8 trở đi chỉ thấy
                    khi cuộn trong bảng; header dính đầu khi cuộn. Bảng dùng
                    table-fixed + colgroup cộng đúng 100% nên vừa chiều rộng
                    thẻ, không còn thanh cuộn ngang ở desktop. */}
                <table className="w-full text-sm table-fixed border-separate border-spacing-0">
                  <colgroup>
                    <col style={{ width: '34%' }} />
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '18%' }} />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-xs text-stone-500">
                      <th className="py-2 pr-2 font-semibold sticky top-0 z-10 bg-white border-b">Chủ đề</th>
                      <th className="py-2 px-1 font-semibold text-right sticky top-0 z-10 bg-white border-b">Học sinh hoàn thành</th>
                      <th className="py-2 px-1 font-semibold text-right sticky top-0 z-10 bg-white border-b">Tổng số học sinh</th>
                      <th className="py-2 pl-1 font-semibold text-right sticky top-0 z-10 bg-white border-b">% hoàn thành</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicTable.map((row, rowIdx) => {
                      const cellBorder =
                        rowIdx === topicTable.length - 1
                          ? ''
                          : 'border-b border-stone-100';
                      return (
                      <tr key={row.topicId}>
                        <td className={`py-2 pr-2 truncate ${cellBorder}`} title={row.title}>
                          {row.title}
                        </td>
                        <td className={`py-2 px-1 text-right ${cellBorder}`}>{row.completed}</td>
                        <td className={`py-2 px-1 text-right ${cellBorder}`}>{row.total}</td>
                        <td className={`py-2 pl-1 text-right font-semibold ${cellBorder}`}>
                          {formatWholePercent(row.rate)}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hàng 3: mức tư duy + đường đăng nhập theo ngày */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 lg:col-span-5">
          <CardTitle>Tỷ lệ điểm đạt theo mức tư duy</CardTitle>
          {dashboardSel.thinkingChart.length === 0 ? (
            <EmptyNote>Chưa có câu trả lời đã chấm trong phạm vi đang lọc.</EmptyNote>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={dashboardSel.thinkingChart} layout="vertical" margin={{ left: 8, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    domain={[0, 1]}
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                    label={{ value: 'Tỷ lệ điểm đạt', position: 'insideBottom', offset: -2 }}
                  />
                  <YAxis type="category" dataKey="label" width={110} />
                  <Tooltip
                    formatter={(value: any, _name: any, props: any) => [
                      `${Math.round(Number(value) * 100)}% (${props?.payload?.gradedCount ?? 0} câu đã chấm)`,
                      'Tỷ lệ điểm đạt',
                    ]}
                  />
                  <Bar dataKey="rate" fill={BAR_PEACH}>
                    <LabelList
                      dataKey="rate"
                      position="right"
                      formatter={(v: any) => `${Math.round(Number(v) * 100)}%`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 lg:col-span-7">
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Info size={16} className="text-stone-400" />
              Số học sinh đăng nhập theo ngày
            </span>
          </CardTitle>
          {dashboardSel.dailyChart.length === 0 ? (
            <EmptyNote>Chưa có phiên đăng nhập trong phạm vi đang lọc.</EmptyNote>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={dashboardSel.dailyChart} margin={{ left: 8, right: 24, top: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => formatVNDate(d).slice(0, 5)}
                    label={{ value: 'Ngày', position: 'insideBottomRight', offset: -2 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    label={{ value: 'Số học sinh', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value} học sinh`, 'Số học sinh']}
                    labelFormatter={(d: any) => `Ngày ${formatVNDate(String(d))}`}
                  />
                  <Line
                    type="linear"
                    dataKey="students"
                    stroke={LINE_BLUE}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  >
                    <LabelList dataKey="students" position="top" />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
