import React, { useState } from 'react';
import {
  TeacherSidebar,
  TeacherNavTab,
} from '../components/teacher/TeacherSidebar.tsx';
import { TeacherTopbar } from '../components/teacher/TeacherTopbar.tsx';
import { TeacherOverviewScreen } from './teacher/TeacherOverviewScreen.tsx';
import { ClassesAndStudentsScreen } from './teacher/ClassesAndStudentsScreen.tsx';
import { TeacherContentScreen } from './teacher/TeacherContentScreen.tsx';
import { TeacherQuestionBankScreen } from './teacher/TeacherQuestionBankScreen.tsx';
import { TeacherGradingScreen } from './teacher/TeacherGradingScreen.tsx';
import { TeacherProgressScreen } from './teacher/TeacherProgressScreen.tsx';
import { TeacherRewardsScreen } from './teacher/TeacherRewardsScreen.tsx';
import { TeacherAnalyticsScreen, AnalyticsTabKey } from './teacher/TeacherAnalyticsScreen.tsx';
import { TeacherSettingsScreen } from './teacher/TeacherSettingsScreen.tsx';
import {
  classService,
  studentService,
  contentService,
  essayService,
  rewardService,
  auditService,
  attemptService,
  useLiveQuery,
  TeacherProfile,
  ClassItem,
  StudentAccount,
  AuditLog,
} from '../services/index.ts';
import { StudentState, EssaySubmission, RewardRequest } from '../types.ts';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { MamMuc } from '../components/MamMuc.tsx';

interface TeacherPortalProps {
  teacher: TeacherProfile;
  onLogout: () => void;
  onSwitchToStudentView: () => void;
}

interface TeacherPortalData {
  classes: ClassItem[];
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  topics: any[];
  allEssays: EssaySubmission[];
  allRewards: RewardRequest[];
  auditLogs: AuditLog[];
}

export const TeacherPortal: React.FC<TeacherPortalProps> = ({
  teacher,
  onLogout,
  onSwitchToStudentView,
}) => {
  const [currentTab, setCurrentTab] = useState<TeacherNavTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [openAddStudentInitially, setOpenAddStudentInitially] = useState(false);
  const [analyticsInitialTab, setAnalyticsInitialTab] = useState<AnalyticsTabKey>('score');
  const [analyticsInitialStudentId, setAnalyticsInitialStudentId] = useState<string | undefined>(undefined);

  // Gộp các truy vấn dùng chung thành 1 Promise.all tối ưu
  const {
    data: portalData,
    loading: isPortalLoading,
    error: portalError,
    refresh: refreshPortalData,
  } = useLiveQuery<TeacherPortalData>(
    async () => {
      const [
        classes,
        students,
        studentStates,
        topics,
        allEssays,
        allRewards,
        auditLogs,
      ] = await Promise.all([
        classService.getClasses(teacher.id),
        studentService.getStudents(),
        attemptService.getAllStates(),
        contentService.getTopics(undefined, false),
        essayService.getSubmissions({ status: 'ALL' }),
        rewardService.getRequests(),
        auditService.getLogs({ limit: 100 }),
      ]);
      return {
        classes: classes || [],
        students: students || [],
        studentStates: studentStates || {},
        topics: topics || [],
        allEssays: allEssays || [],
        allRewards: allRewards || [],
        auditLogs: auditLogs || [],
      };
    },
    ['class', 'student', 'state', 'content', 'essay', 'reward', 'audit'],
    [teacher.id]
  );

  const classes = portalData?.classes ?? [];
  const students = portalData?.students ?? [];
  const studentStates = portalData?.studentStates ?? {};
  const topics = portalData?.topics ?? [];
  const allEssays = portalData?.allEssays ?? [];
  const allRewards = portalData?.allRewards ?? [];
  const auditLogs = portalData?.auditLogs ?? [];

  const pendingEssays = allEssays.filter(
    (e) => e.status === 'PENDING_TEACHER' || e.status === 'AI_SUGGESTED'
  );
  const pendingRewards = allRewards.filter((r) => r.status === 'PENDING_APPROVAL');

  // Tính số liệu cho lớp đang chọn
  const filteredStudents = (students || []).filter(
    (s) => selectedClassId === 'all' || s.class_id === selectedClassId
  );

  // 1. TRẠNG THÁI LỖI (Hiển thị thông báo + nút Thử lại)
  if (portalError) {
    return (
      <div className="min-h-screen bg-[#FAF5EB] text-[#2F3E6B] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl p-8 text-center shadow-md">
          <MamMuc mood="thinking" size="lg" className="mx-auto mb-4" />
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-lora text-xl font-bold text-[#2F3E6B] mb-2">
            Không thể tải dữ liệu giáo viên
          </h3>
          <p className="text-xs text-[#4B5563] leading-relaxed mb-6">
            Đã xảy ra lỗi: {portalError.message || 'Không xác định'}. Vui lòng thử lại.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => refreshPortalData()}
              className="px-5 py-2.5 rounded-2xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Thử lại</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="px-5 py-2.5 rounded-2xl border border-[#E6DCC8] text-[#2F3E6B] text-xs font-bold hover:bg-[#FAF5EB] transition-all"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. TRẠNG THÁI SKELETON KHI LOADING LẦN ĐẦU
  if (isPortalLoading && !portalData) {
    return (
      <div className="min-h-screen bg-[#FAF5EB] text-[#2F3E6B] flex flex-col font-sans antialiased animate-pulse">
        <div className="flex-1 flex overflow-hidden">
          {/* Skeleton Sidebar */}
          <aside className="w-64 bg-[#FFFDF8] border-r border-[#E6DCC8] p-5 hidden md:block shrink-0 space-y-4">
            <div className="h-10 bg-slate-200/70 rounded-2xl w-3/4 mb-8" />
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-11 bg-slate-200/50 rounded-2xl w-full" />
              ))}
            </div>
          </aside>

          {/* Skeleton Content */}
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-16 bg-[#FFFDF8] border-b border-[#E6DCC8] px-6 flex items-center justify-between">
              <div className="h-8 bg-slate-200/60 rounded-xl w-40" />
              <div className="h-8 bg-slate-200/60 rounded-xl w-48" />
            </header>

            <main className="p-6 space-y-6">
              <div className="h-36 bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 bg-[#FFFDF8] border border-[#E6DCC8] rounded-2xl" />
                ))}
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // 3. GIAO DIỆN CHÍNH
  return (
    <div className="h-screen bg-[#FAF5EB] text-[#2F3E6B] flex flex-col font-sans antialiased overflow-hidden">
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* SIDEBAR BÊN TRÁI */}
        <TeacherSidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={onLogout}
          onSwitchToStudentView={onSwitchToStudentView}
          pendingGradingCount={pendingEssays.length}
          pendingRewardCount={pendingRewards.length}
        />

        {/* NỘI DUNG CHÍNH + THANH TRÊN CÙNG */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <TeacherTopbar
            teacher={teacher}
            classes={classes || []}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            pendingGradingCount={pendingEssays.length}
            pendingRewardCount={pendingRewards.length}
            onNavigateToGrading={() => setCurrentTab('grading')}
            onNavigateToRewards={() => setCurrentTab('rewards')}
            onLogout={onLogout}
          />

          <main
            className={
              currentTab === 'content'
                ? 'flex-1 overflow-hidden flex flex-col p-4 sm:p-6 lg:p-8 bg-[#FAF5EB]'
                : 'flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF5EB]'
            }
          >
            <div
              className={
                currentTab === 'content'
                  ? 'max-w-7xl mx-auto w-full min-w-0 flex-1 min-h-0 flex flex-col'
                  : 'max-w-7xl mx-auto w-full min-w-0'
              }
            >
              {currentTab === 'overview' && (
                <TeacherOverviewScreen
                  teacherName={teacher.name}
                  classes={classes || []}
                  students={students || []}
                  studentStates={studentStates || {}}
                  topics={topics || []}
                  essays={allEssays || []}
                  rewards={allRewards || []}
                  auditLogs={auditLogs || []}
                  onNavigateTab={setCurrentTab}
                  onOpenAddStudentModal={() => {
                    setCurrentTab('classes_students');
                    setOpenAddStudentInitially(true);
                  }}
                  onOpenStudentDossier={(studentId) => {
                    setAnalyticsInitialTab('profile');
                    setAnalyticsInitialStudentId(studentId);
                    setCurrentTab('analytics');
                  }}
                />
              )}

              {currentTab === 'classes_students' && (
                <ClassesAndStudentsScreen
                  teacherId={teacher.id}
                  classes={classes || []}
                  students={students || []}
                  studentStates={studentStates || {}}
                  selectedClassId={selectedClassId}
                  onSelectClassId={setSelectedClassId}
                  onRefreshData={refreshPortalData}
                  isAddModalOpenInitially={openAddStudentInitially}
                  onCloseAddModalInitial={() => setOpenAddStudentInitially(false)}
                />
              )}

              {currentTab === 'content' && (
                <TeacherContentScreen
                  teacher={teacher}
                  classes={classes || []}
                  selectedClassId={selectedClassId}
                  onRefreshData={refreshPortalData}
                />
              )}

              {currentTab === 'question_bank' && (
                <TeacherQuestionBankScreen
                  teacher={teacher}
                  classes={classes || []}
                  selectedClassId={selectedClassId}
                  onRefreshData={refreshPortalData}
                />
              )}

              {currentTab === 'grading' && (
                <TeacherGradingScreen
                  classes={classes || []}
                  selectedClassId={selectedClassId}
                  pendingCount={pendingEssays.length}
                  onRefreshData={refreshPortalData}
                />
              )}

              {currentTab === 'progress' && (
                <TeacherProgressScreen
                  teacher={teacher}
                  classes={classes || []}
                  students={students || []}
                />
              )}

              {currentTab === 'rewards' && (
                <TeacherRewardsScreen
                  pendingCount={pendingRewards.length}
                  selectedClassId={selectedClassId}
                />
              )}

              {currentTab === 'analytics' && (
                <TeacherAnalyticsScreen
                  classes={classes || []}
                  students={students || []}
                  studentStates={studentStates || {}}
                  topics={topics || []}
                  essays={allEssays || []}
                  rewards={allRewards || []}
                  initialTab={analyticsInitialTab}
                  initialStudentId={analyticsInitialStudentId}
                  onRefreshData={refreshPortalData}
                />
              )}

              {currentTab === 'settings' && (
                <TeacherSettingsScreen
                  teacher={teacher}
                  auditLogs={auditLogs || []}
                  onRefreshData={refreshPortalData}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
