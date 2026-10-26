import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  HelpCircle,
  Clock,
  User,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/teacher/ui/PageHeader.tsx';
import { GlobalAnalyticsFilter } from '../../analytics/types.ts';
import { AnalyticsFilterBar } from '../../components/teacher/analytics/AnalyticsFilterBar.tsx';
import { ScoreAnalyticsTab } from '../../components/teacher/analytics/ScoreAnalyticsTab.tsx';
import { MasteryAnalyticsTab } from '../../components/teacher/analytics/MasteryAnalyticsTab.tsx';
import { QuestionAnalyticsTab } from '../../components/teacher/analytics/QuestionAnalyticsTab.tsx';
import { EngagementAnalyticsTab } from '../../components/teacher/analytics/EngagementAnalyticsTab.tsx';
import { StudentProfileTab } from '../../components/teacher/analytics/StudentProfileTab.tsx';
import { AnalyticsAssistantTab } from '../../components/teacher/analytics/AnalyticsAssistantTab.tsx';
import { ClassItem, StudentAccount } from '../../services/types.ts';
import { StudentState, EssaySubmission, RewardRequest, Question } from '../../types.ts';

export type AnalyticsTabKey = 'assistant' | 'score' | 'mastery' | 'questions' | 'engagement' | 'profile';

interface TeacherAnalyticsScreenProps {
  classes: ClassItem[];
  students: StudentAccount[];
  studentStates: Record<string, StudentState>;
  topics: Array<{ id: string; title: string; videoIds?: string[]; theoryId?: string }>;
  quizzes?: Array<{ id: string; topicId?: string }>;
  essays: EssaySubmission[];
  rewards: RewardRequest[];
  questions?: Record<string, Question>;
  teacherId?: string;
  initialTab?: AnalyticsTabKey;
  initialStudentId?: string;
  onRefreshData?: () => void;
  onOpenQuestionEditor?: (questionId: string) => void;
}

const DEFAULT_FILTERS: GlobalAnalyticsFilter = {
  classIds: [],
  timeRange: '6w',
  topicId: 'all',
  studentIds: [],
  skillLevels: ['NHAN_BIET', 'THONG_HIEU', 'PHAN_TICH', 'VAN_DUNG'],
  activityType: 'all',
};

export const TeacherAnalyticsScreen: React.FC<TeacherAnalyticsScreenProps> = ({
  classes,
  students,
  studentStates,
  topics,
  quizzes,
  essays,
  rewards,
  questions,
  teacherId,
  initialTab = 'assistant',
  initialStudentId,
  onRefreshData,
  onOpenQuestionEditor,
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTabKey>(initialTab);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || (students[0]?.id ?? '')
  );

  // Bộ lọc chung lưu trong sessionStorage
  const [filters, setFilters] = useState<GlobalAnalyticsFilter>(() => {
    try {
      const saved = sessionStorage.getItem('mam_van_analytics_filters');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_FILTERS;
  });

  const handleUpdateFilters = (newFilters: GlobalAnalyticsFilter) => {
    setFilters(newFilters);
    try {
      sessionStorage.setItem('mam_van_analytics_filters', JSON.stringify(newFilters));
    } catch (e) {
      // ignore
    }
  };

  const handleResetFilters = () => {
    handleUpdateFilters(DEFAULT_FILTERS);
  };

  // Chuyển sang Tab 5 (Hồ sơ học sinh) khi click từ tab khác
  const handleSelectStudentDossier = (studentId: string) => {
    setSelectedStudentId(studentId);
    setActiveTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const TABS = [
    { key: 'assistant' as AnalyticsTabKey, label: 'Trợ lý phân tích AI', icon: Sparkles },
    { key: 'score' as AnalyticsTabKey, label: 'Điểm số', icon: TrendingUp },
    { key: 'mastery' as AnalyticsTabKey, label: 'Kỹ năng / Mastery 4 mức', icon: Award },
    { key: 'questions' as AnalyticsTabKey, label: 'Phân tích câu hỏi', icon: HelpCircle },
    { key: 'engagement' as AnalyticsTabKey, label: 'Tương tác & Thời gian học', icon: Clock },
    { key: 'profile' as AnalyticsTabKey, label: 'Hồ sơ học sinh', icon: User },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER TRANG PHÂN TÍCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-lora text-2xl font-extrabold text-[#2F3E6B]">
            Phân tích & Thống kê chuyên sâu
          </h1>
          <p className="text-xs text-[#78716C] mt-1">
            Theo dõi phân bố năng lực học tập, thời gian tích cực và mức độ tiến bộ qua từng bài học
          </p>
        </div>
      </div>

      {/* BỘ LỌC CHUNG CỐ ĐỊNH PHÍA TRÊN */}
      <div className="print:hidden">
        <AnalyticsFilterBar
          classes={classes}
          students={students}
          topics={topics}
          filters={filters}
          onChangeFilters={handleUpdateFilters}
          onResetFilters={handleResetFilters}
        />
      </div>

      {/* THANH CHỌN TAB NỘI DUNG */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#E6DCC8] print:hidden">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-[#2F3E6B] text-white shadow-xs'
                  : 'bg-[#FFFDF8] text-[#78716C] border border-[#E6DCC8] hover:bg-[#FAF5EB] hover:text-[#2F3E6B]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* NỘI DUNG TỪNG TAB */}
      <div>
        {activeTab === 'assistant' && (
          <AnalyticsAssistantTab
            students={students}
            studentStates={studentStates}
            classes={classes}
            topics={topics}
            quizzes={quizzes}
            essays={essays}
            rewards={rewards}
            questions={questions ?? {}}
            filters={filters}
            teacherId={teacherId}
          />
        )}

        {activeTab === 'score' && (
          <ScoreAnalyticsTab
            students={students}
            studentStates={studentStates}
            classes={classes}
            topics={topics}
            filters={filters}
            onSelectStudentDossier={handleSelectStudentDossier}
          />
        )}

        {activeTab === 'mastery' && (
          <MasteryAnalyticsTab
            classes={classes}
            students={students}
            studentStates={studentStates}
            topics={topics}
            filters={filters}
            onSelectStudentDossier={handleSelectStudentDossier}
          />
        )}

        {activeTab === 'questions' && (
          <QuestionAnalyticsTab
            students={students}
            studentStates={studentStates}
            questions={questions}
            filters={filters}
            onOpenQuestionEditor={onOpenQuestionEditor}
          />
        )}

        {activeTab === 'engagement' && (
          <EngagementAnalyticsTab
            students={students}
            studentStates={studentStates}
            classes={classes}
            filters={filters}
            onSelectStudentDossier={handleSelectStudentDossier}
          />
        )}

        {activeTab === 'profile' && (
          <StudentProfileTab
            students={students}
            studentStates={studentStates}
            classes={classes}
            topics={topics}
            essays={essays}
            rewards={rewards}
            questions={questions}
            selectedStudentId={selectedStudentId}
            onSelectStudentId={setSelectedStudentId}
            onRefreshData={onRefreshData}
          />
        )}
      </div>
    </div>
  );
};
