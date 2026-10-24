/**
 * Phần dưới banner của tab Tổng quan — dựng lại trang "Tổng quan" của file
 * Power BI Dashboard_MamVan__1.pbix: bộ lọc + 4 KPI + 2 bảng + 3 biểu đồ.
 * Mọi con số do computePbixDashboard tính từ dữ liệu Supabase thật bằng đúng
 * công thức DAX (xem pbixDashboard.ts). KHÔNG hardcode số từ ảnh pbix.
 *
 * Bố cục bám trang pbix (desktop rộng): hàng KPI trên cùng; tiếp theo là
 * bảng học sinh + bảng bài giao + biểu đồ luồng; cuối là biểu đồ mức tư duy
 * + biểu đồ đường đăng nhập theo ngày. Màu: thanh cam đào + đường xanh dương
 * theo ảnh pbix; thẻ trắng trên nền be của app.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Users,
  BookOpenCheck,
  Hourglass,
  Target,
  BarChart3,
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
import type { ClassItem } from '../../../services/types.ts';
import type { PbixRawData } from '../../../analytics/pbixDashboardData.ts';
import {
  computePbixDashboard,
  flowName,
  formatOneDecimalPercent,
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
  /** flow_type đang chọn, hoặc null = tất cả các luồng. */
  flow: string | null;
}

interface Props {
  raw: PbixRawData;
  classes: ClassItem[];
  filters: PbixOverviewFilters;
  onFiltersChange: (f: PbixOverviewFilters) => void;
  loading: boolean;
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

export const PbixOverviewSection: React.FC<Props> = ({
  raw,
  classes,
  filters,
  onFiltersChange,
  loading,
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
          flow: filters.flow,
        },
        todayKey,
      }),
    [scopedStudents, raw, filters.dateFrom, filters.dateTo, filters.flow, todayKey],
  );

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

  const flowOptions = dashboard.flowOptions;
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
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-600">Theo luồng</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`px-3 py-2 rounded-lg border text-sm ${
                filters.flow === null
                  ? 'bg-[#2F3E6B] text-white border-[#2F3E6B]'
                  : 'bg-white border-stone-300'
              }`}
              onClick={() => onFiltersChange({ ...filters, flow: null })}
            >
              Tất cả các luồng
            </button>
            {flowOptions.map((f) => (
              <button
                key={f.flowType}
                type="button"
                className={`px-3 py-2 rounded-lg border text-sm ${
                  filters.flow === f.flowType
                    ? 'bg-[#2F3E6B] text-white border-[#2F3E6B]'
                    : 'bg-white border-stone-300'
                }`}
                onClick={() => onFiltersChange({ ...filters, flow: f.flowType })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

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
          value={formatWholePercent(dashboard.submissionRate)}
          sub={
            dashboard.totalTargets > 0
              ? `${dashboard.submittedTargets}/${dashboard.totalTargets} lượt giao đã nộp`
              : 'Chưa có bài được giao'
          }
        />
        <KpiCard
          icon={<Hourglass size={16} />}
          label="Câu trả lời chờ chấm"
          value={String(dashboard.pendingAnswers)}
          sub="Câu trả lời đang chờ chấm"
        />
        <KpiCard
          icon={<Target size={16} />}
          label="Tỷ lệ điểm đạt"
          value={formatWholePercent(dashboard.passRate)}
          sub={
            dashboard.passRate !== null
              ? `${dashboard.gradedScoreSum}/${dashboard.gradedMaxSum} điểm (câu đã chấm)`
              : 'Chưa có câu trả lời đã chấm'
          }
        />
      </div>

      {/* Hàng 2: bảng học sinh + bảng bài giao + biểu đồ luồng */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 lg:col-span-5">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 border-b">
                    <th className="py-2 pr-3 font-semibold">Họ tên</th>
                    <th className="py-2 pr-3 font-semibold">Hoạt động gần nhất</th>
                    <th className="py-2 pr-3 font-semibold text-right">Số bài chưa nộp</th>
                    <th className="py-2 pr-3 font-semibold text-right">Tỷ lệ đạt điểm cá nhân</th>
                    <th className="py-2 font-semibold">Gợi ý theo dõi</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.studentsTable.map((r) => (
                    <tr key={r.studentId} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatVNDateTime(r.lastLoginAt)}
                      </td>
                      <td className="py-2 pr-3 text-right">{r.unsubmitted}</td>
                      <td className="py-2 pr-3 text-right">
                        {formatOneDecimalPercent(r.personalRate)}
                      </td>
                      <td className="py-2">{r.suggestion}</td>
                    </tr>
                  ))}
                  {dashboard.studentsTotal && (
                    <tr className="font-bold bg-stone-50">
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
                      <td className="py-2">{dashboard.studentsTotal.suggestion}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 lg:col-span-4">
          <CardTitle>Tiến độ bài được giao</CardTitle>
          {dashboard.assignmentsTable.length === 0 ? (
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
                  {dashboard.assignmentsTable.map((r) => (
                    <tr key={r.assignmentId} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.title}</td>
                      <td className="py-2 pr-3 text-right">{r.assigned}</td>
                      <td className="py-2 pr-3 text-right">{r.submitted}</td>
                      <td className="py-2 pr-3 text-right">{r.unsubmitted}</td>
                      <td className="py-2 text-right">{formatWholePercent(r.rate)}</td>
                    </tr>
                  ))}
                  {dashboard.assignmentsTotal && (
                    <tr className="font-bold bg-stone-50">
                      <td className="py-2 pr-3">Tổng cộng</td>
                      <td className="py-2 pr-3 text-right">
                        {dashboard.assignmentsTotal.assigned}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {dashboard.assignmentsTotal.submitted}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {dashboard.assignmentsTotal.unsubmitted}
                      </td>
                      <td className="py-2 text-right">
                        {formatWholePercent(dashboard.assignmentsTotal.rate)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 lg:col-span-3">
          <CardTitle
            right={
              filters.flow ? (
                <span className="text-xs text-stone-500">{flowName(filters.flow)}</span>
              ) : undefined
            }
          >
            Tiến độ học theo luồng
          </CardTitle>
          {!dashboard.hasProgressData ? (
            <div className="py-6 text-center">
              <BarChart3 size={28} className="mx-auto text-stone-300" />
              <p className="mt-2 text-sm font-semibold text-stone-600">
                Chưa có dữ liệu tiến độ luồng
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                Bảng tiến độ bước học (student_activity_progress) chưa tồn tại
                trong Supabase nên chưa tính được tỉ lệ hoàn thành từng bước
                luồng. Dữ liệu này chỉ có trong file Power BI/Excel mẫu, chưa
                từng được nạp lên Supabase. Khi app ghi nhận tiến độ bước học,
                biểu đồ sẽ tự hiện — không dùng lượt làm bài thay thế vì làm
                bài khác với hoàn thành bước học.
              </p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={dashboard.flowChart} layout="vertical" margin={{ left: 8, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    domain={[0, 1]}
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  />
                  <YAxis type="category" dataKey="stepLabel" width={130} />
                  <Tooltip
                    formatter={(value: any) => [`${Math.round(Number(value) * 100)}%`, 'Tỷ lệ hoàn thành']}
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
      </div>

      {/* Hàng 3: mức tư duy + đường đăng nhập theo ngày */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 lg:col-span-5">
          <CardTitle>Tỷ lệ điểm đạt theo mức tư duy</CardTitle>
          {dashboard.thinkingChart.length === 0 ? (
            <EmptyNote>Chưa có câu trả lời đã chấm trong phạm vi đang lọc.</EmptyNote>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={dashboard.thinkingChart} layout="vertical" margin={{ left: 8, right: 40 }}>
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
          {dashboard.dailyChart.length === 0 ? (
            <EmptyNote>Chưa có phiên đăng nhập trong phạm vi đang lọc.</EmptyNote>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={dashboard.dailyChart} margin={{ left: 8, right: 24, top: 12 }}>
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
