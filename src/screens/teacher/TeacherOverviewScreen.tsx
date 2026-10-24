import React, { useEffect, useState } from 'react';
import { Sparkles, PlusCircle } from 'lucide-react';
import { TeacherNavTab } from '../../components/teacher/TeacherSidebar.tsx';
import { AuditLog, ClassItem, StudentAccount } from '../../services/types.ts';
import { StudentState, EssaySubmission, RewardRequest } from '../../types.ts';
import { MamMuc } from '../../components/MamMuc.tsx';
import {
  PbixOverviewSection,
  PbixOverviewFilters,
} from '../../components/teacher/analytics/PbixOverviewSection.tsx';
import {
  fetchPbixDashboardRows,
  PbixRawData,
} from '../../analytics/pbixDashboardData.ts';

interface TeacherOverviewScreenProps {
  teacherName: string;
  classes: ClassItem[];
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  topics: Array<{ id: string; title: string; videoIds?: string[]; theoryId?: string }>;
  quizzes?: Array<{ id: string; topicId?: string }>;
  essays: EssaySubmission[];
  rewards: RewardRequest[];
  auditLogs: AuditLog[];
  onNavigateTab: (tab: TeacherNavTab) => void;
  onOpenAddStudentModal: () => void;
  onOpenStudentDossier: (studentId: string) => void;
  /** id giáo viên (để nạp bài/hoạt động đúng GV từ Supabase). */
  teacherId?: string;
}

const FILTERS_STORAGE_KEY = 'mam_van_pbix_overview_filters';

function loadInitialFilters(): PbixOverviewFilters {
  const fallback: PbixOverviewFilters = {
    classIds: [],
    dateFrom: null,
    dateTo: null,
    flow: null,
  };
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      classIds: Array.isArray(parsed.classIds)
        ? parsed.classIds.filter((x: unknown) => typeof x === 'string')
        : [],
      dateFrom: typeof parsed.dateFrom === 'string' ? parsed.dateFrom : null,
      dateTo: typeof parsed.dateTo === 'string' ? parsed.dateTo : null,
      flow: 'flow' in parsed ? (typeof parsed.flow === 'string' ? parsed.flow : null) : null,
    };
  } catch {
    return fallback;
  }
}

export const TeacherOverviewScreen: React.FC<TeacherOverviewScreenProps> = ({
  teacherName,
  classes,
  students,
  onOpenAddStudentModal,
  teacherId,
}) => {
  // Bộ lọc pbix (lớp / khoảng ngày / luồng) — banner đọc filters.classIds
  // như cũ nên chip "Tổng quan toàn trường / Đang lọc: …" giữ nguyên.
  const [filters, setFilters] = useState<PbixOverviewFilters>(loadInitialFilters);
  const [raw, setRaw] = useState<PbixRawData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPbixDashboardRows({ teacherId, appStudents: students, appClasses: classes })
      .then((data) => {
        if (!cancelled) {
          setRaw(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teacherId, students, classes]);

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // Bỏ qua khi sessionStorage không ghi được.
    }
  }, [filters]);

  return (
    <div className="space-y-6 pb-12">
      {/* LỜI CHÀO & BANNER GIẤY & MỰC */}
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#7FA88A]/10 via-[#F2B84B]/10 to-transparent rounded-bl-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF5EB] border border-[#E6DCC8] text-xs font-semibold text-[#2F3E6B] mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#E2704A]" />
              <span>
                {filters.classIds.length === 0
                  ? 'Tổng quan toàn trường'
                  : `Đang lọc: ${filters.classIds
                      .map((id: string) => classes.find((c) => c.id === id)?.name || id)
                      .join(', ')}`}
              </span>
            </div>

            <h1 className="font-lora text-2xl sm:text-3xl font-extrabold text-[#2F3E6B] tracking-tight leading-snug">
              Chào thầy {teacherName}!
            </h1>
            <p className="text-sm text-[#4B5563] mt-2 leading-relaxed font-normal">
              Chào mừng thầy trở lại bàn làm việc. Dưới đây là bức tranh toàn cảnh 6 tuần học tập của các em học sinh, được tổng hợp tức thì từ từng câu hỏi, bài viết và phút học tích cực.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <MamMuc mood="happy" size="md" className="hidden sm:block" />
            <button
              onClick={onOpenAddStudentModal}
              className="px-5 py-3 rounded-2xl bg-[#E2704A] hover:bg-[#D45E36] text-white font-bold text-sm shadow-md shadow-[#E2704A]/25 transition-all flex items-center gap-2 active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm học sinh mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD THEO FILE POWER BI (25/10, lệnh chủ dự án: sửa hết phần
          dưới banner theo pbix) — 3 slicer + 4 KPI + 2 bảng + 3 biểu đồ,
          mọi số tính từ Supabase bằng đúng công thức DAX. Các tab khác của
          Phân tích (điểm số, câu hỏi, trợ lý AI + bubble) không đụng tới. */}
      <PbixOverviewSection
        raw={
          raw ?? {
            students: [],
            sessions: [],
            targets: [],
            assignments: [],
            attempts: [],
            answers: [],
            questionLevels: {},
            activities: [],
            progress: [],
            progressAvailable: false,
            classMap: {},
            loaded: false,
          }
        }
        classes={classes}
        filters={filters}
        onFiltersChange={setFilters}
        loading={loading}
      />
    </div>
  );
};
