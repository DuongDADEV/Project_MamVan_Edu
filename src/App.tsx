import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StudentProfile,
  StudentState,
  QuestionResult,
  EssaySubmission,
  ThemeId,
  Topic,
} from './types.ts';
import {
  DEMO_STUDENTS,
  createInitialStateHs001,
  createInitialStateHs002,
  VIDEOS,
  QUIZZES,
  QUESTIONS_BANK,
} from './data/mockData.ts';
import { XP_CONFIG, ATTENDANCE_CONFIG, TIME_CONFIG } from './config.ts';
import { awardXP } from './logic/xpEngine.ts';
import { useActiveLearningTimer } from './logic/useActiveLearningTimer.ts';
import { Navbar, NavTab } from './components/Navbar.tsx';
import { DevPanel } from './components/DevPanel.tsx';
import { BreakReminderModal } from './components/BreakReminderModal.tsx';
import { ThemeSelectorModal } from './components/ThemeSelectorModal.tsx';
import { QuizRunner } from './components/QuizRunner.tsx';
import { QuizResult } from './components/QuizResult.tsx';
import { Palette } from 'lucide-react';

// Services & Shared Repositories
import {
  authService,
  attemptService,
  contentService,
  quizService,
  essayRepository,
  QuizWithMeta,
  QuestionWithMeta,
  syncEventBus,
  useLiveQuery,
  AuthSession,
  TeacherProfile,
  AdminProfile,
} from './services/index.ts';

// Screens
import { LoginScreen } from './screens/LoginScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { LearnScreen } from './screens/LearnScreen.tsx';
import { TreeScreen } from './screens/TreeScreen.tsx';
import { RewardsScreen } from './screens/RewardsScreen.tsx';
import { ProfileScreen } from './screens/ProfileScreen.tsx';
import { VideoLessonScreen } from './screens/VideoLessonScreen.tsx';
import { TheoryLessonScreen } from './screens/TheoryLessonScreen.tsx';
import { TeacherPortal } from './screens/TeacherPortal.tsx';
import { AdminPortal } from './screens/admin/AdminPortal.tsx';

const USER_STORAGE_KEY = 'vo_muc_active_user';
const STATE_STORAGE_PREFIX = 'vo_muc_student_state_';

export default function App() {
  // 1. Quản lý Phiên đăng nhập (Session) - Hỗ trợ student, teacher, admin
  const [currentSession, setCurrentSession] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem('mam_van_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          parsed.user &&
          (parsed.role === 'student' || parsed.role === 'teacher' || parsed.role === 'admin')
        ) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // State lưu thông tin admin khi đang impersonate giáo viên
  const [impersonatingFromAdmin, setImpersonatingFromAdmin] = useState<AdminProfile | null>(null);

  // 1b. Quản lý Route URL (/admin, /teacher hoặc /)
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const h = window.location.hash;
      if (p === '/admin' || h === '#/admin' || h === '#admin') return '/admin';
      if (p === '/teacher' || h === '#/teacher' || h === '#teacher') return '/teacher';
    }
    return '/';
  });

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      const target = path === '/admin' ? '/admin' : path === '/teacher' ? '/teacher' : '/';
      if (window.location.pathname !== target) {
        window.history.pushState(null, '', target);
      }
    }
  }, []);

  // Lắng nghe popstate (nút Back/Forward của trình duyệt)
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      const h = window.location.hash;
      if (p === '/admin' || h === '#/admin' || h === '#admin') {
        setCurrentPath('/admin');
      } else if (p === '/teacher' || h === '#/teacher' || h === '#teacher') {
        setCurrentPath('/teacher');
      } else {
        setCurrentPath('/');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Route Guard hai chiều & đồng bộ URL
  useEffect(() => {
    if (!currentSession) {
      if (currentPath === '/teacher' || currentPath === '/admin') {
        navigateTo('/');
      }
    } else if (currentSession.role === 'admin') {
      if (currentPath !== '/admin') {
        navigateTo('/admin');
      }
    } else if (currentSession.role === 'teacher') {
      if (currentPath !== '/teacher') {
        navigateTo('/teacher');
      }
    } else if (currentSession.role === 'student') {
      // Học sinh không vào được khu giáo viên hay admin
      if (currentPath === '/teacher' || currentPath === '/admin') {
        navigateTo('/');
      }
    }
  }, [currentSession, currentPath, navigateTo]);

  // 2. Quản lý State học sinh (Lưu qua Kho Dữ Liệu AttemptRepository)
  const currentStudentId = currentSession?.role === 'student' ? currentSession.user.id : 'hs001';

  const [studentState, setStudentState] = useState<StudentState>(() => {
    try {
      const allStates = JSON.parse(localStorage.getItem('mam_van_student_states') || '{}');
      if (allStates[currentStudentId]) {
        return allStates[currentStudentId];
      }
      const legacySaved = localStorage.getItem(STATE_STORAGE_PREFIX + currentStudentId);
      if (legacySaved) return JSON.parse(legacySaved);
      return currentStudentId === 'hs002' ? createInitialStateHs002() : createInitialStateHs001();
    } catch {
      return createInitialStateHs001();
    }
  });

  // SourceId riêng của instance App để tránh vòng lặp phản xạ chính mình
  const appSourceId = useRef('app-root-' + Math.random().toString(36).substring(2, 9)).current;
  const studentStateRef = useRef<StudentState>(studentState);
  studentStateRef.current = studentState;

  const lastSavedStateJsonRef = useRef<string>('');
  const saveTimeoutRef = useRef<any>(null);

  // Nạp lại State khi đổi học sinh
  useEffect(() => {
    if (currentSession?.role === 'student') {
      attemptService.getStudentState(currentSession.user.id).then((st) => {
        const currentJson = JSON.stringify(studentStateRef.current);
        const freshJson = JSON.stringify(st);
        if (currentJson !== freshJson) {
          lastSavedStateJsonRef.current = freshJson;
          setStudentState(st);
        }
      });
    }
  }, [currentSession?.user?.id, currentSession?.role]);

  // Lưu state vào repository & localStorage khi học sinh thao tác
  useEffect(() => {
    if (studentState) {
      const stateJson = JSON.stringify(studentState);
      // Nếu trạng thái chưa hề thay đổi so với bản đã lưu -> bỏ qua hoàn toàn!
      if (stateJson === lastSavedStateJsonRef.current) {
        return;
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        lastSavedStateJsonRef.current = stateJson;
        attemptService.saveStudentState(currentStudentId, studentState, appSourceId);
        try {
          localStorage.setItem(
            STATE_STORAGE_PREFIX + currentStudentId,
            stateJson
          );
          const allStates = JSON.parse(localStorage.getItem('mam_van_student_states') || '{}');
          allStates[currentStudentId] = studentState;
          localStorage.setItem('mam_van_student_states', JSON.stringify(allStates));
        } catch (e) {
          console.error('Lỗi khi lưu localStorage:', e);
        }
      }, 300);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentStudentId, studentState, appSourceId]);

  // Lắng nghe đồng bộ đa tab (Multi-tab Live Sync)
  useEffect(() => {
    const unsubState = syncEventBus.subscribe(
      'state',
      (payload, sourceId) => {
        // Bỏ qua nếu sự kiện do chính instance này phát
        if (sourceId === appSourceId) return;

        if (currentSession?.role === 'student') {
          if (!payload?.studentId || payload.studentId === currentSession.user.id) {
            attemptService.getStudentState(currentSession.user.id).then((fresh) => {
              const currentJson = JSON.stringify(studentStateRef.current);
              const freshJson = JSON.stringify(fresh);
              // CHỈ setState khi dữ liệu đọc lại KHÁC trạng thái hiện tại
              if (currentJson !== freshJson) {
                lastSavedStateJsonRef.current = freshJson;
                setStudentState(fresh);
              }
            });
          }
        }
      },
      appSourceId
    );

    const unsubAuth = syncEventBus.subscribe(
      'auth',
      (session, sourceId) => {
        if (sourceId === appSourceId) return;
        const currentJson = JSON.stringify(currentSession);
        const nextJson = JSON.stringify(session);
        if (currentJson !== nextJson) {
          setCurrentSession(session);
          if (session?.role === 'admin') {
            navigateTo('/admin');
          } else if (session?.role === 'teacher') {
            navigateTo('/teacher');
          } else if (session?.role === 'student') {
            navigateTo('/');
          }
        }
      },
      appSourceId
    );

    return () => {
      unsubState();
      unsubAuth();
    };
  }, [currentSession, appSourceId, navigateTo]);

  // Nạp danh sách chủ đề được xuất bản từ Kho chung
  const { data: rawTopics } = useLiveQuery<Topic[]>(
    () => contentService.getTopics(studentState.profile.grade, true),
    ['content']
  );
  const publishedTopics = rawTopics ?? [];

  // Nạp danh sách bài kiểm tra & câu hỏi từ Kho chung
  const { data: rawQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(studentState.profile.grade, true),
    ['quizzes', 'content']
  );
  const { data: rawQuestions } = useLiveQuery<Record<string, QuestionWithMeta>>(
    () => quizService.getQuestions(),
    ['questions', 'content']
  );

  // Đồng bộ Cỡ chữ hiển thị lên toàn bộ giao diện thông qua thẻ html gốc
  useEffect(() => {
    const pref = studentState.fontSizePreference || 'normal';
    document.documentElement.setAttribute('data-font-size', pref);
    if (pref === 'larger') {
      document.documentElement.style.fontSize = '20px';
    } else if (pref === 'large') {
      document.documentElement.style.fontSize = '18px';
    } else {
      document.documentElement.style.fontSize = '16px';
    }
  }, [studentState.fontSizePreference]);

  // 3. Quản lý Điều hướng màn hình học sinh
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [activeFlow, setActiveFlow] = useState<
    | null
    | { type: 'video'; videoId: string }
    | { type: 'theory'; theoryId: string }
    | { type: 'homework'; homeworkQuizId?: string }
  >(null);

  // 4. Quản lý Popup nhắc nghỉ & Modal chọn Theme
  const [isBreakReminderOpen, setIsBreakReminderOpen] = useState(false);
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  // 5. Quản lý Toast thông báo nhỏ
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // 6. Hook đo Active Learning Time
  const {
    activeMinutesToday,
    continuousMinutes,
    resetContinuousTimer,
  } = useActiveLearningTimer({
    initialSecondsToday: studentState.activeSecondsToday,
    multiplier: studentState.devTimeMultiplier || 1,
    isVideoPlaying: activeFlow?.type === 'video',
    onTick: (activeSecondsToday) => {
      setStudentState((prev) => ({
        ...prev,
        activeSecondsToday,
        lastActiveTimestamp: Date.now(),
      }));
    },
    onBreakReminder: () => {
      setIsBreakReminderOpen(true);
    },
  });

  // 7. Xử lý Đăng nhập & Đổi người dùng
  const handleLoginSuccess = (session: AuthSession) => {
    setCurrentSession(session);
    try {
      sessionStorage.removeItem('mam_van_watered_session_' + session.user.id);
    } catch {}
    if (session.role === 'admin') {
      navigateTo('/admin');
    } else if (session.role === 'teacher') {
      navigateTo('/teacher');
    } else if (session.role === 'student') {
      navigateTo('/');
      attemptService.getStudentState(session.user.id).then((fresh) => {
        lastSavedStateJsonRef.current = JSON.stringify(fresh);
        setStudentState(fresh);
      });
      setCurrentTab('home');
      setActiveFlow(null);
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('mam_van_auth_session');
    setCurrentSession(null);
    navigateTo('/');
  };

  const handleSwitchToStudentView = async () => {
    // Chuyển sang trải nghiệm học sinh với tài khoản hs001
    const res = await authService.signIn('student', 'hs001', '123456');
    if (res.session) {
      setCurrentSession(res.session);
      try {
        sessionStorage.removeItem('mam_van_watered_session_hs001');
      } catch {}
      const st = await attemptService.getStudentState('hs001');
      lastSavedStateJsonRef.current = JSON.stringify(st);
      setStudentState(st);
      setCurrentTab('home');
      setActiveFlow(null);
      navigateTo('/');
      showToast('Đang ở góc xem trước Học sinh (hs001)');
    }
  };

  // 8. Đặt lại dữ liệu demo
  const handleResetData = (targetId?: 'hs001' | 'hs002') => {
    const id = targetId || (currentSession?.role === 'student' ? currentSession.user.id : 'hs001');
    const fresh = id === 'hs002' ? createInitialStateHs002() : createInitialStateHs001();
    setStudentState(fresh);
    attemptService.saveStudentState(id, fresh);
    showToast('Đã đặt lại dữ liệu demo thành công!');
  };

  // 9. Điểm danh hôm nay (+2 XP và tưới cây)
  const handleAttendanceCheckIn = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (studentState.lastAttendanceDate === todayStr) {
      showToast('Hôm nay bạn đã điểm danh rồi!');
      return;
    }

    const xpRes = awardXP(
      studentState,
      `attendance:${todayStr}`,
      XP_CONFIG.ATTENDANCE_DAILY_XP,
      'Điểm danh hằng ngày',
      true
    );

    const nextDays = (studentState.attendanceDaysThisWeek || 0) + 1;
    let newBadges = [...(studentState.unlockedBadgeIds || [])];
    if (nextDays >= 3 && !newBadges.includes('badge_streak_3')) {
      newBadges.push('badge_streak_3');
      showToast('🎉 Nhận được huy hiệu: Chăm chỉ 3 ngày!');
    }
    if (nextDays >= 5 && !newBadges.includes('badge_streak_full')) {
      newBadges.push('badge_streak_full');
      showToast('🌟 Nhận được huy hiệu: Tuần trọn vẹn!');
    }

    const updatedState: StudentState = {
      ...studentState,
      ...xpRes.updatedState,
      lastAttendanceDate: todayStr,
      attendanceDaysThisWeek: nextDays,
      attendanceHistory: [todayStr, ...(studentState.attendanceHistory || [])],
      unlockedBadgeIds: newBadges,
    };

    lastSavedStateJsonRef.current = JSON.stringify(updatedState);
    setStudentState(updatedState);

    // Lưu bền vững tức thời vào Repository & LocalStorage (không sợ reload trang)
    try {
      attemptService.saveStudentState(currentStudentId, updatedState, appSourceId);
      localStorage.setItem(STATE_STORAGE_PREFIX + currentStudentId, JSON.stringify(updatedState));
      const allStates = JSON.parse(localStorage.getItem('mam_van_student_states') || '{}');
      allStates[currentStudentId] = updatedState;
      localStorage.setItem('mam_van_student_states', JSON.stringify(allStates));
    } catch (e) {
      console.error('Lỗi lưu điểm danh vào storage:', e);
    }

    showToast('🌱 Điểm danh thành công: +2 XP & Tưới cây!');
  };

  // 10. Tiếp tục học dở (Nút Học tiếp)
  const handleResumeLearning = (targetVideoId?: string) => {
    if (targetVideoId) {
      setActiveFlow({ type: 'video', videoId: targetVideoId });
      return;
    }
    if (studentState.currentProgress) {
      if (studentState.currentProgress.type === 'video') {
        setActiveFlow({
          type: 'video',
          videoId: studentState.currentProgress.itemId,
        });
        return;
      }
      if (studentState.currentProgress.type === 'theory') {
        setActiveFlow({
          type: 'theory',
          theoryId: studentState.currentProgress.itemId,
        });
        return;
      }
    }
    // Mặc định video đầu tiên từ chủ đề xuất bản
    const firstVidId = publishedTopics[0]?.videoIds?.[0] || 'video_tho_1';
    setActiveFlow({ type: 'video', videoId: firstVidId });
  };

  // 11. Xin nhận quà (mở rương)
  const handleRequestReward = (rewardId: string) => {
    setStudentState((prev) => ({
      ...prev,
      rewardRequests: [
        {
          id: 'req_' + Date.now(),
          rewardId,
          requestedAt: Date.now(),
          status: 'PENDING_APPROVAL',
        },
        ...prev.rewardRequests,
      ],
    }));
    showToast('Đã gửi yêu cầu mở rương tới thầy/cô! Hãy dùng Dev Panel để duyệt rương nhanh nhé.');
  };

  // 11b. Mở rương và thu thập vào bộ sưu tập
  const handleClaimRewardChest = (rewardId: string, requestId: string) => {
    setStudentState((prev) => ({
      ...prev,
      rewardRequests: prev.rewardRequests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'OPENED', openedAt: Date.now() }
          : r
      ),
    }));
    showToast('🎉 Chúc mừng em đã mở rương và nhận món quà bí mật!');
  };

  // ==========================================
  // ĐIỀU HƯỚNG THEO PHÂN QUYỀN (ROUTE GUARD)
  // ==========================================

  // Chưa đăng nhập -> Hiện Màn hình Đăng nhập
  if (!currentSession) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Vai trò ADMIN -> Cổng Quản Trị Hệ Thống
  if (currentSession.role === 'admin') {
    return (
      <AdminPortal
        admin={currentSession.user as AdminProfile}
        onLogout={handleLogout}
        onImpersonateTeacher={(teacher) => {
          setImpersonatingFromAdmin(currentSession.user as AdminProfile);
          handleLoginSuccess({
            user: teacher,
            role: 'teacher',
            signedInAt: Date.now(),
          });
        }}
        onSwitchToStudentView={handleSwitchToStudentView}
      />
    );
  }

  // Vai trò GIÁO VIÊN -> Không gian Giáo viên (Giấy & Mực)
  if (currentSession.role === 'teacher') {
    return (
      <div className="flex flex-col min-h-screen">
        {impersonatingFromAdmin && (
          <div className="bg-[#7C3AED] text-white px-4 sm:px-8 py-2.5 text-xs font-bold flex items-center justify-between sticky top-0 z-50 shadow-md">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-full bg-white/20 uppercase tracking-wider text-[10px]">
                🛡️ Xem dưới quyền GV
              </span>
              <span>
                Đang truy cập với tư cách: {(currentSession.user as TeacherProfile).name} (
                <span className="font-mono">{(currentSession.user as TeacherProfile).username}</span>)
              </span>
            </div>
            <button
              onClick={() => {
                const adminProfile = impersonatingFromAdmin;
                setImpersonatingFromAdmin(null);
                handleLoginSuccess({
                  user: adminProfile,
                  role: 'admin',
                  signedInAt: Date.now(),
                });
              }}
              className="px-3 py-1 bg-white text-[#7C3AED] hover:bg-white/90 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1 active:scale-[0.98]"
            >
              <span>← Quay lại trang Admin</span>
            </button>
          </div>
        )}
        <TeacherPortal
          teacher={currentSession.user as TeacherProfile}
          onLogout={handleLogout}
          onSwitchToStudentView={handleSwitchToStudentView}
        />
      </div>
    );
  }

  // Vai trò HỌC SINH -> Góc học tập Mầm Văn (Bảo lưu nguyên vẹn 100%)
  return (
    <div
      data-theme={studentState.themePreference || 'creative_edtech'}
      data-font-size={studentState.fontSizePreference || 'normal'}
      className="min-h-screen edtech-dot-bg flex flex-col md:flex-row text-[#1E1B4B] font-sans transition-all duration-200"
    >
      {/* THANH ĐIỀU HƯỚNG (Sidebar Desktop & Bottom Nav Mobile) */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setActiveFlow(null);
          setCurrentTab(tab);
        }}
        state={studentState}
        topicsCount={publishedTopics.length}
        onOpenThemeSelector={() => setIsThemeSelectorOpen(true)}
      />

      {/* KHÔNG GIAN NỘI DUNG CHÍNH (Main Content Area) */}
      <main className="flex-1 min-h-screen pb-24 md:pb-12 overflow-y-auto">
        {/* NẾU ĐANG TRONG LUỒNG BÀI HỌC HOẶC BTVN */}
        {activeFlow?.type === 'video' ? (
          <VideoLessonScreen
            videoId={activeFlow.videoId}
            state={studentState}
            onUpdateState={setStudentState}
            onBackToList={() => setActiveFlow(null)}
          />
        ) : activeFlow?.type === 'theory' ? (
          <TheoryLessonScreen
            theoryId={activeFlow.theoryId}
            state={studentState}
            onUpdateState={setStudentState}
            onBackToList={() => setActiveFlow(null)}
          />
        ) : activeFlow?.type === 'homework' ? (
          /* Luồng làm BTVN cô giao */
          (() => {
            const targetQuiz =
              (rawQuizzes || []).find((q) => q.id === activeFlow.homeworkQuizId) ||
              QUIZZES[activeFlow.homeworkQuizId || 'quiz_homework_special'] ||
              QUIZZES.quiz_homework_special;

            const qList = (targetQuiz.questionIds || [])
              .map((id) => (rawQuestions ? rawQuestions[id] : null) || (QUESTIONS_BANK as any)[id])
              .filter(Boolean);

            const xpEarned = targetQuiz.xp || XP_CONFIG.HOMEWORK_COMPLETED_XP || 20;

            return (
              <div className="w-full max-w-2xl mx-auto py-6 px-4">
                <QuizRunner
                  quiz={targetQuiz}
                  questions={qList.length > 0 ? qList : undefined}
                  onComplete={(results, essays, earned, max) => {
                    if (essays && essays.length > 0) {
                      essays.forEach((e) => {
                        essayRepository.createSubmission({
                          studentId: currentStudentId,
                          studentName: studentState.profile?.name || 'Học sinh',
                          classId: (studentState.profile as any)?.classId,
                          className: studentState.profile?.grade || '7A1',
                          questionId: e.questionId,
                          quizId: targetQuiz.id,
                          content: e.content,
                          wordCount: e.wordCount,
                          status: 'PENDING_TEACHER',
                          promptTitle: e.promptTitle || targetQuiz.title || 'Bài tập làm văn',
                          quizTitle: `BTVN: ${targetQuiz.title}`,
                          skillLevel: 'VAN_DUNG',
                        }).catch((err: any) => console.error('Lỗi lưu bài tự luận BTVN:', err));
                      });
                    }

                    setStudentState((prev) => {
                      const xpRes = awardXP(
                        prev,
                        `quiz_completed:${targetQuiz.id}`,
                        xpEarned,
                        `BTVN: ${targetQuiz.title}`
                      );
                      return {
                        ...prev,
                        ...xpRes.updatedState,
                        completedSteps: [...(prev.completedSteps || []), `quiz_completed:${targetQuiz.id}`],
                        questionResults: [...results, ...(prev.questionResults || [])],
                        essaySubmissions: [...(essays || []), ...(prev.essaySubmissions || [])],
                      };
                    });
                    showToast(`🎉 Xuất sắc! Em đã hoàn thành BTVN và nhận +${xpEarned} XP!`);
                    setActiveFlow(null);
                  }}
                  onExit={() => setActiveFlow(null)}
                />
              </div>
            );
          })()
        ) : (
          /* CÁC TAB CHÍNH */
          <>
            {currentTab === 'home' && (
              <HomeScreen
                state={studentState}
                topics={publishedTopics}
                onCheckIn={handleAttendanceCheckIn}
                onResumeLearning={handleResumeLearning}
                onSelectTopic={(tId) => {
                  setCurrentTab('learn');
                }}
                onSelectVideo={(vId) => setActiveFlow({ type: 'video', videoId: vId })}
                onSelectTheory={(thId) => setActiveFlow({ type: 'theory', theoryId: thId })}
                onSelectHomework={(hwId) => setActiveFlow({ type: 'homework', homeworkQuizId: hwId })}
                onNavigateTab={(tab) => setCurrentTab(tab)}
              />
            )}

            {currentTab === 'learn' && (
              <LearnScreen
                state={studentState}
                topics={publishedTopics}
                onSelectVideo={(vId) => setActiveFlow({ type: 'video', videoId: vId })}
                onSelectTheory={(thId) => setActiveFlow({ type: 'theory', theoryId: thId })}
              />
            )}

            {currentTab === 'tree' && (
              <TreeScreen
                state={studentState}
                topics={publishedTopics}
                onCheckIn={handleAttendanceCheckIn}
                onSelectTopic={(tId) => {
                  setCurrentTab('learn');
                }}
              />
            )}

            {currentTab === 'rewards' && (
              <RewardsScreen
                state={studentState}
                onRequestReward={handleRequestReward}
                onClaimRewardChest={handleClaimRewardChest}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileScreen
                state={studentState}
                onUpdateState={setStudentState}
                onResetData={() => handleResetData()}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* POPUP NHẮC NGHỈ KHI HỌC 45 PHÚT LIÊN TỤC */}
      {isBreakReminderOpen && (
        <BreakReminderModal
          continuousMinutes={continuousMinutes}
          onTakeBreak={() => {
            resetContinuousTimer();
            setIsBreakReminderOpen(false);
            showToast('Nghỉ ngơi thật tốt bạn nhé!');
          }}
          onContinue={() => {
            resetContinuousTimer();
            setIsBreakReminderOpen(false);
          }}
        />
      )}

      {/* NÚT ĐỔI GIAO DIỆN TRÊN MOBILE (Nổi góc dưới bên trái) */}
      <button
        onClick={() => setIsThemeSelectorOpen(true)}
        className="md:hidden fixed bottom-20 left-4 z-40 p-2.5 rounded-full bg-white border border-slate-200 text-[#4F46E5] shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        title="Đổi phong cách màu sắc giao diện"
      >
        <Palette className="w-4 h-4 text-[#8B5CF6]" />
      </button>

      {/* MODAL CHỌN PHONG CÁCH BẢNG MÀU GIAO DIỆN */}
      <ThemeSelectorModal
        isOpen={isThemeSelectorOpen}
        onClose={() => setIsThemeSelectorOpen(false)}
        currentTheme={studentState.themePreference || 'creative_edtech'}
        onSelectTheme={(tId) => {
          setStudentState((prev) => ({
            ...prev,
            themePreference: tId,
          }));
          setIsThemeSelectorOpen(false);
          showToast('Đã đổi phong cách giao diện thành công!');
        }}
      />

      {/* DEV PANEL (BẢNG THỬ NGHIỆM ĐỂ TEST NHANH MỌI LUỒNG) */}
      <DevPanel
        state={studentState}
        onUpdateState={setStudentState}
        onResetData={handleResetData}
      />

      {/* TOAST THÔNG BÁO NHẸ NHÀNG */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] text-white text-xs sm:text-sm font-bold shadow-xl shadow-indigo-500/25 border border-indigo-300/30 animate-[slideUp_0.2s_ease] backdrop-blur-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
