import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StudentProfile,
  StudentState,
  QuestionResult,
  EssaySubmission,
  ThemeId,
  Topic,
  TEST_QUIZ_KINDS,
} from './types.ts';
import { createFreshStudentState } from './services/mock/seedData.ts';
import { REWARDS_CATALOG } from './data/rewards.ts';
import { XP_CONFIG, ATTENDANCE_CONFIG, TIME_CONFIG, getEffectiveXpConfig } from './config.ts';
import { awardXP, XP_KEYS } from './logic/xpEngine.ts';
import { tryAwardTopicCompletion } from './logic/topicCompletion.ts';
import { getLocalTodayStr, rolloverStudentState } from './logic/studentStateUtils.ts';
import { useActiveLearningTimer } from './logic/useActiveLearningTimer.ts';
import { Navbar, NavTab } from './components/Navbar.tsx';
import {
  buildStudentNotifications,
  StudentNotification,
} from './logic/studentNotifications.ts';
import { DevPanel } from './components/DevPanel.tsx';
import { BreakReminderModal } from './components/BreakReminderModal.tsx';
import { ThemeSelectorModal } from './components/ThemeSelectorModal.tsx';
import { QuizRunner } from './components/QuizRunner.tsx';
import { QuizReviewScreen } from './components/QuizReviewScreen.tsx';
import { QuizResult } from './components/QuizResult.tsx';
import { Palette } from 'lucide-react';

// Services & Shared Repositories
import {
  authService,
  attemptService,
  classService,
  contentService,
  quizService,
  rewardService,
  studentService,
  essayRepository,
  QuizWithMeta,
  QuestionWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  syncEventBus,
  useLiveQuery,
  AuthSession,
  TeacherProfile,
  AdminProfile,
} from './services/index.ts';

// Screens
import { LoginScreen } from './screens/LoginScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { AssignmentAttemptScreen } from './screens/AssignmentAttemptScreen.tsx';
// Các màn hình còn lại được tải lười (lazy) để chia nhỏ gói JS ban đầu
const LearnScreen = React.lazy(() =>
  import('./screens/LearnScreen.tsx').then((m) => ({ default: m.LearnScreen }))
);
const TreeScreen = React.lazy(() =>
  import('./screens/TreeScreen.tsx').then((m) => ({ default: m.TreeScreen }))
);
const AssignmentsScreen = React.lazy(() =>
  import('./screens/AssignmentsScreen.tsx').then((m) => ({ default: m.AssignmentsScreen }))
);
const LearningResultsScreen = React.lazy(() =>
  import('./screens/LearningResultsScreen.tsx').then((m) => ({ default: m.LearningResultsScreen }))
);
const RewardsScreen = React.lazy(() =>
  import('./screens/RewardsScreen.tsx').then((m) => ({ default: m.RewardsScreen }))
);
const ProfileScreen = React.lazy(() =>
  import('./screens/ProfileScreen.tsx').then((m) => ({ default: m.ProfileScreen }))
);
import { VideoLessonScreen } from './screens/VideoLessonScreen.tsx';
import { TheoryLessonScreen } from './screens/TheoryLessonScreen.tsx';
const TeacherPortal = React.lazy(() =>
  import('./screens/TeacherPortal.tsx').then((m) => ({ default: m.TeacherPortal }))
);
import { AdminPortal } from './screens/admin/AdminPortal.tsx';

const USER_STORAGE_KEY = 'vo_muc_active_user';
const STATE_STORAGE_PREFIX = 'vo_muc_student_state_';

// State TRỐNG trung tính dùng khi khởi tạo / sau đăng xuất, trong lúc chờ
// dữ liệu thật từ máy chủ: mọi số liệu = 0, hồ sơ lấy từ phiên đăng nhập đã
// lưu (nếu khớp tài khoản). TUYỆT ĐỐI không dùng state mẫu — dữ liệu demo
// đã gỡ khỏi dự án (theo yêu cầu chủ dự án 22/10: mọi con số trên màn hình
// phải truy được nguồn trong cơ sở dữ liệu).
function buildEmptyStudentState(studentId: string): StudentState {
  let name = 'Học sinh';
  let username = studentId;
  let grade = '';
  try {
    const raw = localStorage.getItem('mam_van_auth_session');
    const sess = raw ? JSON.parse(raw) : null;
    if (sess?.user && (sess.user.id === studentId || sess.user.username === studentId)) {
      name = sess.user.name || name;
      username = sess.user.username || username;
      grade = sess.user.grade || '';
    }
  } catch {}
  const st = createFreshStudentState(
    {
      id: studentId,
      name,
      username,
      class_id: '',
      status: 'active',
      has_logged_in: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any,
    grade || 'Lớp'
  );
  return { ...st, profile: { ...st.profile, grade } };
}

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

  // Phiên gốc của GV/Admin trước khi vào "Xem góc Học sinh" (để thoát về đúng phiên)
  const [previewReturnSession, setPreviewReturnSession] = useState<AuthSession | null>(() => {
    try {
      const raw = sessionStorage.getItem('mam_van_preview_return');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Tự chữa phiên đăng nhập khi mở app (26/10): phiên local cũ (id legacy
  // 'gv001', JWT mất) khiến mọi lần lưu video/lý thuyết bị RLS chặn (403)
  // mà màn hình chỉ báo "lỗi" chung chung. getSession() đã có sẵn: JWT còn
  // thì dựng lại phiên từ hồ sơ thật (id UUID), JWT mất thì xóa phiên cũ
  // để về màn đăng nhập; không xác minh được thì giữ nguyên phiên, tránh
  // đăng xuất oan. Chỉ chạy 1 lần khi mở app — xem trước học sinh không
  // ghi phiên vào localStorage nên không bị ảnh hưởng.
  useEffect(() => {
    let cancelled = false;
    const initial = currentSession;
    authService.getSession().then((healed) => {
      if (cancelled) return;
      if (JSON.stringify(healed) !== JSON.stringify(initial)) {
        setCurrentSession(healed);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const navigateTo = useCallback((path: string, replace = false) => {
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      const target = path === '/admin' ? '/admin' : path === '/teacher' ? '/teacher' : '/';
      if (window.location.pathname !== target) {
        // replace: dùng cho điều hướng ép buộc của Route Guard để nút Back
        // không kẹt trong vòng lặp pushState (vào /teacher -> bị đẩy về / -> Back lại vào /teacher)
        if (replace) window.history.replaceState(null, '', target);
        else window.history.pushState(null, '', target);
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
        navigateTo('/', true);
      }
    } else if (currentSession.role === 'admin') {
      if (currentPath !== '/admin') {
        navigateTo('/admin', true);
      }
    } else if (currentSession.role === 'teacher') {
      if (currentPath !== '/teacher') {
        navigateTo('/teacher', true);
      }
    } else if (currentSession.role === 'student') {
      // Học sinh không vào được khu giáo viên hay admin
      if (currentPath === '/teacher' || currentPath === '/admin') {
        navigateTo('/', true);
      }
    }
  }, [currentSession, currentPath, navigateTo]);

  // 2. Quản lý State học sinh (Lưu qua Kho Dữ Liệu AttemptRepository)
  const currentStudentId = currentSession?.role === 'student' ? currentSession.user.id : 'hs001';

  const [studentState, setStudentState] = useState<StudentState>(() => {
    try {
      const allStates = JSON.parse(localStorage.getItem('mam_van_student_states') || '{}');
      if (allStates[currentStudentId]) {
        return rolloverStudentState(allStates[currentStudentId]);
      }
      const legacySaved = localStorage.getItem(STATE_STORAGE_PREFIX + currentStudentId);
      if (legacySaved) return rolloverStudentState(JSON.parse(legacySaved));
      return buildEmptyStudentState(currentStudentId);
    } catch {
      return buildEmptyStudentState(currentStudentId);
    }
  });

  // SourceId riêng của instance App để tránh vòng lặp phản xạ chính mình
  const appSourceId = useRef('app-root-' + Math.random().toString(36).substring(2, 9)).current;
  const studentStateRef = useRef<StudentState>(studentState);
  studentStateRef.current = studentState;

  const lastSavedStateJsonRef = useRef<string>('');
  const saveTimeoutRef = useRef<any>(null);
  // Học sinh mà state của em đã được nạp xong từ kho dữ liệu (cổng chống ghi
  // bản khởi tạo/mẫu lên DB trước khi nạp xong)
  const stateLoadedForRef = useRef<string>('');

  // Nạp lại State khi đổi học sinh
  useEffect(() => {
    if (currentSession?.role === 'student') {
      attemptService.getStudentState(currentSession.user.id).then((st) => {
        const rolled = rolloverStudentState(st);
        const currentJson = JSON.stringify(studentStateRef.current);
        const freshJson = JSON.stringify(rolled);
        // Đánh dấu đã nạp xong cho học sinh này — hiệu ứng lưu chỉ được ghi
        // SAU mốc này, tránh ghi bản khởi tạo/mẫu lên DB trong lúc chờ nạp
        stateLoadedForRef.current = currentSession.user.id;
        if (currentJson !== freshJson) {
          lastSavedStateJsonRef.current = freshJson;
          setStudentState(rolled);
        }
      });
    }
  }, [currentSession?.user?.id, currentSession?.role]);

  // Lưu state vào repository & localStorage khi học sinh thao tác
  useEffect(() => {
    if (studentState) {
      // Chưa nạp xong state thật của học sinh hiện tại thì TUYỆT ĐỐI không ghi
      if (
        currentSession?.role === 'student' &&
        stateLoadedForRef.current !== currentSession.user.id
      ) {
        return;
      }
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

  // MÔ HÌNH XP MỚI — QUỸ XP CHỦ ĐỀ: mỗi khi tiến độ học thay đổi (xem xong
  // video, xong lý thuyết, nộp bài…), rà soát các chủ đề đã xuất bản: chủ đề
  // nào vừa hoàn thành TOÀN BỘ và chưa trao quỹ XP thì trao ngay + chúc mừng.
  const topicXpToastRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!studentState?.profile?.id) return;
    for (const topic of publishedTopics || []) {
      const out = tryAwardTopicCompletion(
        studentStateRef.current,
        topic as any,
        (rawQuizzes || []) as any,
        (rawQuestions || {}) as any
      );
      if (out) {
        setStudentState(out.state);
        if (!topicXpToastRef.current.has(topic.id)) {
          topicXpToastRef.current.add(topic.id);
          showToast(
            `🌟 Hoàn thành toàn bộ chủ đề "${topic.title}" — nhận +${out.awardedXp} XP!`
          );
        }
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentState.completedSteps, studentState.questionResults, publishedTopics]);

  // Nạp video & lý thuyết đã xuất bản (phục vụ cả thông báo bài mới)
  const { data: rawVideos } = useLiveQuery<VideoLessonWithMeta[]>(
    () => contentService.getVideoLessons(studentState.profile.grade, true),
    ['content']
  );
  const { data: rawTheories } = useLiveQuery<TheoryLessonWithMeta[]>(
    () => contentService.getTheoryLessons(studentState.profile.grade, true),
    ['content']
  );

  // Nạp danh sách bài kiểm tra & câu hỏi từ Kho chung
  const { data: rawQuizzes } = useLiveQuery<QuizWithMeta[]>(
    () => quizService.getQuizzes(studentState.profile.grade, true),
    ['quiz', 'content']
  );
  const { data: rawQuestions } = useLiveQuery<Record<string, QuestionWithMeta>>(
    () => quizService.getQuestions(),
    ['quiz', 'content']
  );

  // Đồng bộ Cỡ chữ hiển thị: phóng toàn cục bằng zoom để MỌI chữ đều lớn lên.
  // (Cách cũ đổi font-size của thẻ html chỉ tác động chữ cỡ rem, trong khi phần
  // lớn giao diện dùng cỡ px cố định nên chọn "Lớn" mà chữ không nhúc nhích.)
  useEffect(() => {
    const pref = studentState.fontSizePreference || 'normal';
    document.documentElement.setAttribute('data-font-size', pref);
    const zoom = pref === 'larger' ? '1.25' : pref === 'large' ? '1.12' : '1';
    document.body.style.setProperty('zoom', zoom);
  }, [studentState.fontSizePreference]);

  // THÔNG BÁO BÀI MỚI: suy ra từ nội dung thầy/cô vừa xuất bản (published_at).
  // Đã đọc lưu trong state nên đồng bộ theo tài khoản qua Supabase.
  const studentNotifications = useMemo(
    () =>
      buildStudentNotifications({
        videos: rawVideos || [],
        theories: rawTheories || [],
        quizzes: rawQuizzes || [],
        topics: (publishedTopics || []) as any,
        classId: (currentSession?.user as any)?.class_id,
        className: studentState.profile.grade,
      }),
    [rawVideos, rawTheories, rawQuizzes, publishedTopics, currentSession, studentState.profile.grade]
  );
  const unreadNotifications = useMemo(
    () =>
      studentNotifications.filter(
        (n) => !(studentState.seenNotificationIds || []).includes(n.id)
      ),
    [studentNotifications, studentState.seenNotificationIds]
  );

  const markNotificationSeen = (id: string) => {
    setStudentState((prev) => {
      const seen = prev.seenNotificationIds || [];
      if (seen.includes(id)) return prev;
      return { ...prev, seenNotificationIds: [...seen, id].slice(-200) };
    });
  };

  const handleOpenNotification = (n: StudentNotification) => {
    markNotificationSeen(n.id);
    if (n.kind === 'video') {
      setActiveFlow({ type: 'video', videoId: n.itemId });
    } else if (n.kind === 'theory') {
      setActiveFlow({ type: 'theory', theoryId: n.itemId });
    } else if (n.quizKind === 'homework') {
      setActiveFlow({ type: 'homework', homeworkQuizId: n.itemId });
    } else {
      const quiz = (rawQuizzes || []).find((q) => q.id === n.itemId);
      if (quiz?.topicId) setLearnFocusTopicId(quiz.topicId);
      setActiveFlow(null);
      setCurrentTab('learn');
    }
  };

  const handleMarkAllNotificationsRead = () => {
    setStudentState((prev) => {
      const seen = new Set(prev.seenNotificationIds || []);
      studentNotifications.forEach((n) => seen.add(n.id));
      return { ...prev, seenNotificationIds: Array.from(seen).slice(-200) };
    });
  };

  // 3. Quản lý Điều hướng màn hình học sinh
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [learnFocusTopicId, setLearnFocusTopicId] = useState<string | null>(null);
  const [activeFlow, setActiveFlow] = useState<
    | null
    | { type: 'video'; videoId: string }
    | { type: 'theory'; theoryId: string }
    | { type: 'homework'; homeworkQuizId?: string }
    | { type: 'assignment'; assignmentId: string }
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
      // Chỉ tính giờ học khi người dùng hiện tại thực sự là học sinh —
      // tránh cộng giờ học ảo vào hs001 khi GV/Admin đang làm việc
      if (currentSession?.role !== 'student') return;
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
    try {
      sessionStorage.removeItem('mam_van_preview_return');
    } catch {}
    setPreviewReturnSession(null);
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
    try {
      sessionStorage.removeItem('mam_van_preview_return');
    } catch {}
    setPreviewReturnSession(null);
    setImpersonatingFromAdmin(null);
    // Hủy lần lưu đang chờ để state của người vừa đăng xuất không bị ghi
    // chéo sang tài khoản mặc định sau khi phiên đã đổi
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const fresh = buildEmptyStudentState(currentStudentId);
    lastSavedStateJsonRef.current = JSON.stringify(fresh);
    setStudentState(fresh);
    setActiveFlow(null);
    setCurrentSession(null);
    navigateTo('/');
  };

  const handleSwitchToStudentView = async () => {
    // Lưu phiên GV/Admin hiện tại để thoát xem thử quay về đúng phiên
    if (currentSession && currentSession.role !== 'student') {
      try {
        sessionStorage.setItem('mam_van_preview_return', JSON.stringify(currentSession));
      } catch {}
      setPreviewReturnSession(currentSession);
    }
    // Xem trước KHÔNG đổi phiên Supabase Auth (đợt 25/10): giữ JWT giáo viên
    // để lúc thoát không kẹt JWT học sinh (RLS sẽ chặn truy vấn giáo viên).
    // Hồ sơ hs001 đọc bằng quyền giáo viên (hs001 thuộc lớp của gv001);
    // xem trước chỉ xem, không ghi bài (ghi cần JWT học sinh nên RLS chặn).
    // Giáo viên khác lớp hs001: getStudentById rơi về mock (id không phải
    // UUID) → báo rõ chứ không hiển thị dữ liệu mẫu đội lốt thật.
    try {
      const stu = await studentService.getStudentById('hs001');
      if (!stu || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stu.id)) {
        showToast('Góc xem trước chỉ dùng được cho học sinh lớp mình (hs001 không thuộc lớp của thầy/cô)');
        return;
      }
      let grade = 'Lớp 7';
      try {
        const cls = await classService.getClassById(stu.class_id);
        if (cls?.grade) grade = cls.grade;
      } catch {}
      const previewSession: AuthSession = {
        user: {
          id: stu.id,
          name: stu.name,
          username: stu.username,
          role: 'student',
          grade,
          school: 'THCS Giấy & Mực',
          avatarSeed: stu.username,
        },
        role: 'student',
        signedInAt: Date.now(),
      };
      setCurrentSession(previewSession);
      try {
        sessionStorage.removeItem('mam_van_watered_session_hs001');
      } catch {}
      const st = await attemptService.getStudentState('hs001');
      lastSavedStateJsonRef.current = JSON.stringify(st);
      setStudentState(st);
      setCurrentTab('home');
      setActiveFlow(null);
      navigateTo('/');
      showToast('Đang ở góc xem trước Học sinh (hs001) — chỉ xem, không ghi bài');
    } catch {
      showToast('Không vào được góc xem trước Học sinh (tài khoản hs001 chưa sẵn sàng)');
    }
  };

  const handleExitStudentPreview = () => {
    const origin = previewReturnSession;
    try {
      sessionStorage.removeItem('mam_van_preview_return');
    } catch {}
    setPreviewReturnSession(null);
    if (origin) {
      setCurrentSession(origin);
      navigateTo(origin.role === 'admin' ? '/admin' : origin.role === 'teacher' ? '/teacher' : '/');
      showToast('Đã thoát góc xem trước Học sinh');
    } else {
      handleLogout();
    }
  };

  // 9. Điểm danh hôm nay (+2 XP và tưới cây)
  const handleAttendanceCheckIn = () => {
    const todayStr = getLocalTodayStr();
    const baseState = rolloverStudentState(studentState);
    if (baseState.lastAttendanceDate === todayStr) {
      showToast('Hôm nay bạn đã điểm danh rồi!');
      return;
    }

    const xpRes = awardXP(
      baseState,
      `attendance:${todayStr}`,
      getEffectiveXpConfig().ATTENDANCE_DAILY_XP,
      'Điểm danh hằng ngày',
      true
    );

    const nextDays = (baseState.attendanceDaysThisWeek || 0) + 1;
    let newBadges = [...(baseState.unlockedBadgeIds || [])];
    if (nextDays >= 3 && !newBadges.includes('badge_streak_3')) {
      newBadges.push('badge_streak_3');
      showToast('🎉 Nhận được huy hiệu: Chăm chỉ 3 ngày!');
    }
    if (nextDays >= 5 && !newBadges.includes('badge_streak_full')) {
      newBadges.push('badge_streak_full');
      showToast('🌟 Nhận được huy hiệu: Tuần trọn vẹn!');
    }

    const updatedState: StudentState = {
      ...baseState,
      ...xpRes.updatedState,
      lastAttendanceDate: todayStr,
      attendanceDaysThisWeek: nextDays,
      attendanceHistory: [todayStr, ...(baseState.attendanceHistory || [])],
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

    if (xpRes.actualXp > 0) {
      showToast(`🌱 Điểm danh thành công: +${xpRes.actualXp} XP & Tưới cây!`);
    } else {
      showToast('🌱 Điểm danh thành công & đã tưới cây! (XP hôm nay đã đạt trần nên lần này không cộng thêm)');
    }
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

  // 11. Xin nhận quà (mở rương) — đổi quà TRỪ vào TỔNG XP của tài khoản
  // (chốt 18/10/2026: XP của acc là XP vĩnh viễn, chỉ giảm khi xin quà);
  // bị thầy/cô từ chối sẽ được hoàn lại đầy đủ vào tổng XP.
  const handleRequestReward = async (rewardId: string) => {
    const existing = (studentStateRef.current.rewardRequests || []).find(
      (r) => r.rewardId === rewardId && r.status !== 'REJECTED'
    );
    if (existing) {
      showToast('Em đã có yêu cầu cho phần quà này rồi — chờ thầy/cô duyệt nhé!');
      return;
    }

    // Giá XP lấy theo danh mục hợp nhất học sinh NHÌN THẤY (mặc định +
    // mốc GV, hướng c 24/10); tra catalog trước rồi kho DB dự phòng — 2 nguồn
    // không trùng id qua UI nên thứ tự tra không ảnh hưởng giá.
    let requiredXp = REWARDS_CATALOG.find((r) => r.id === rewardId)?.requiredXp || 0;
    if (!requiredXp) {
      try {
        const rewards = await rewardService.getRewards();
        requiredXp = rewards.find((r) => r.id === rewardId)?.requiredXp || 0;
      } catch {}
    }

    const base = rolloverStudentState(studentStateRef.current);
    if (requiredXp > 0 && (base.totalXp || 0) < requiredXp) {
      showToast(
        `Chưa đủ XP để xin phần quà này (cần ${requiredXp} XP, em đang có ${base.totalXp || 0} XP)`
      );
      return;
    }

    setStudentState((prev) => {
      const rolled = rolloverStudentState(prev);
      return {
        ...rolled,
        totalXp: Math.max(0, (rolled.totalXp || 0) - requiredXp),
        rewardRequests: [
          {
            id: 'req_' + Date.now(),
            rewardId,
            requestedAt: Date.now(),
            status: 'PENDING_APPROVAL' as const,
            deductedXp: requiredXp,
          },
          ...rolled.rewardRequests,
        ],
      };
    });
    showToast(
      requiredXp > 0
        ? `Đã gửi yêu cầu mở rương tới thầy/cô! (Trừ ${requiredXp} XP — nếu bị từ chối sẽ hoàn lại)`
        : 'Đã gửi yêu cầu mở rương tới thầy/cô!'
    );
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
        <React.Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-[#2F3E6B]">
              Đang tải không gian giáo viên...
            </div>
          }
        >
          <TeacherPortal
            teacher={currentSession.user as TeacherProfile}
            onLogout={handleLogout}
            onSwitchToStudentView={handleSwitchToStudentView}
          />
        </React.Suspense>
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
        notifications={studentNotifications}
        unreadNotificationCount={unreadNotifications.length}
        seenNotificationIds={studentState.seenNotificationIds || []}
        onOpenNotification={handleOpenNotification}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
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
            onOpenFlowItem={(type, id) =>
              setActiveFlow(
                type === 'video'
                  ? { type: 'video', videoId: id }
                  : type === 'theory'
                    ? { type: 'theory', theoryId: id }
                    : { type: 'homework', homeworkQuizId: id }
              )
            }
          />
        ) : activeFlow?.type === 'theory' ? (
          <TheoryLessonScreen
            theoryId={activeFlow.theoryId}
            state={studentState}
            onUpdateState={setStudentState}
            onBackToList={() => setActiveFlow(null)}
            onOpenFlowItem={(type, id) =>
              setActiveFlow(
                type === 'video'
                  ? { type: 'video', videoId: id }
                  : type === 'theory'
                    ? { type: 'theory', theoryId: id }
                    : { type: 'homework', homeworkQuizId: id }
              )
            }
          />
        ) : activeFlow?.type === 'homework' ? (
          /* Luồng làm BTVN cô giao */
          (() => {
            // CHỈ dùng bài tập THẬT từ máy chủ — không còn bài mẫu chết cứng
            // để thay thế khi không tìm thấy (đã gỡ mockData).
            const targetQuiz = (rawQuizzes || []).find((q) => q.id === activeFlow.homeworkQuizId);

            if (!targetQuiz) {
              return (
                <div className="w-full max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
                  <p className="font-bold text-[#2F3E6B]">Bài tập này không còn tồn tại hoặc đang được tải lại.</p>
                  <button
                    onClick={() => setActiveFlow(null)}
                    className="px-5 py-2.5 rounded-full bg-[#2F3E6B] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition"
                  >
                    Quay lại
                  </button>
                </div>
              );
            }

            const qList = (targetQuiz.questionIds || [])
              .map((id) => (rawQuestions ? rawQuestions[id] : null))
              .filter((q): q is NonNullable<typeof q> => !!q);

            const xpEarned = Math.max(0, Math.floor(targetQuiz.xp || 0));

            // Quy tắc kiểm tra 1 lần (đợt sửa 24/10): bài kiểm tra (quick/mastery/
            // final) đã hoàn thành thì chỉ cho xem lại — không mở QuizRunner mới,
            // không ghi thêm questionResults, không cộng XP. BTVN không giới hạn.
            // Điểm chặn đặt ở đây nên mọi lối vào (Học bài, Bài tập, Trang chủ)
            // đều đi qua cùng một cửa.
            const isTestKind = TEST_QUIZ_KINDS.includes(targetQuiz.kind);
            const alreadyDone = (studentState.completedSteps || []).includes(
              `quiz_completed:${targetQuiz.id}`
            );
            if (isTestKind && alreadyDone) {
              return (
                <QuizReviewScreen
                  quiz={targetQuiz}
                  questions={qList}
                  results={studentState.questionResults || []}
                  essaySubmissions={studentState.essaySubmissions || []}
                  onBack={() => setActiveFlow(null)}
                />
              );
            }

            return (
              <div className="w-full max-w-2xl mx-auto py-6 px-4">
                <QuizRunner
                  quiz={targetQuiz}
                  studentId={currentStudentId}
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

                    // Mô hình XP mới: nộp bài là nhận đúng số XP đã cấu hình
                    // trên bài (không mặc định, không trần). XP = 0 thì chỉ
                    // ghi nhận hoàn thành — vẫn tính cho quỹ XP của chủ đề.
                    const base = studentStateRef.current;
                    const xpRes =
                      xpEarned > 0
                        ? awardXP(base, XP_KEYS.quizCompleted(targetQuiz.id), xpEarned, `Hoàn thành bài: ${targetQuiz.title}`)
                        : null;
                    setStudentState((prev) => {
                      const withXp = xpRes ? { ...prev, ...xpRes.updatedState } : prev;
                      const steps = withXp.completedSteps.includes(`quiz_completed:${targetQuiz.id}`)
                        ? withXp.completedSteps
                        : [...withXp.completedSteps, `quiz_completed:${targetQuiz.id}`];
                      return {
                        ...withXp,
                        completedSteps: steps,
                        questionResults: [...results, ...(prev.questionResults || [])],
                        essaySubmissions: [...(essays || []), ...(prev.essaySubmissions || [])],
                      };
                    });
                    if (xpRes && xpRes.actualXp > 0) {
                      showToast(`🎉 Xuất sắc! Em đã hoàn thành bài và nhận +${xpRes.actualXp} XP!`);
                    } else if (xpEarned > 0) {
                      showToast('🎉 Em đã hoàn thành bài! (XP của bài này em đã nhận ở lần làm trước)');
                    } else {
                      showToast('🎉 Em đã hoàn thành bài!');
                    }
                    setActiveFlow(null);
                  }}
                  onExit={() => setActiveFlow(null)}
                />
              </div>
            );
          })()
        ) : activeFlow?.type === 'assignment' ? (
          /* Luồng làm BÀI TẬP ĐỘC LẬP giáo viên giao (assignments/targets) */
          <AssignmentAttemptScreen
            assignmentId={activeFlow.assignmentId}
            studentId={currentStudentId}
            onBack={() => setActiveFlow(null)}
            onSubmitted={(info) => {
              if (info.xpReward > 0) {
                const res = awardXP(
                  studentStateRef.current,
                  XP_KEYS.assignmentSubmitted(info.assignmentId),
                  info.xpReward,
                  `Nộp bài: ${info.title}`
                );
                if (res.actualXp > 0) {
                  setStudentState((prev) => ({ ...prev, ...res.updatedState }));
                  showToast(`🎉 Đã nộp bài "${info.title}" — nhận +${res.actualXp} XP!`);
                }
              }
            }}
          />
        ) : (
          /* CÁC TAB CHÍNH */
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center py-24 text-sm font-semibold text-[#2F3E6B]">
                Đang tải nội dung...
              </div>
            }
          >
            {currentTab === 'home' && (
              <HomeScreen
                state={studentState}
                topics={publishedTopics}
                onCheckIn={handleAttendanceCheckIn}
                onResumeLearning={handleResumeLearning}
                onSelectTopic={(tId) => {
                  setLearnFocusTopicId(tId);
                  setCurrentTab('learn');
                }}
                onSelectVideo={(vId) => setActiveFlow({ type: 'video', videoId: vId })}
                onSelectTheory={(thId) => setActiveFlow({ type: 'theory', theoryId: thId })}
                onSelectHomework={(hwId) => setActiveFlow({ type: 'homework', homeworkQuizId: hwId })}
                onOpenAssignment={(aId) => setActiveFlow({ type: 'assignment', assignmentId: aId })}
                onNavigateTab={(tab) => setCurrentTab(tab)}
                latestNotification={unreadNotifications[0] || null}
                onOpenNotification={handleOpenNotification}
              />
            )}

            {currentTab === 'learn' && (
              <LearnScreen
                state={studentState}
                topics={publishedTopics}
                focusTopicId={learnFocusTopicId}
                onSelectVideo={(vId) => setActiveFlow({ type: 'video', videoId: vId })}
                onSelectTheory={(thId) => setActiveFlow({ type: 'theory', theoryId: thId })}
                onSelectQuiz={(qId) => setActiveFlow({ type: 'homework', homeworkQuizId: qId })}
              />
            )}

            {currentTab === 'assignments' && (
              <AssignmentsScreen
                quizzes={rawQuizzes || []}
                topics={publishedTopics}
                studentId={currentStudentId}
                completedQuizIds={(studentState.completedSteps || [])
                  .filter((s) => s.startsWith('quiz_completed:'))
                  .map((s) => s.replace('quiz_completed:', ''))}
                onSelectQuiz={(qId) => setActiveFlow({ type: 'homework', homeworkQuizId: qId })}
                onOpenAssignment={(aId) => setActiveFlow({ type: 'assignment', assignmentId: aId })}
              />
            )}

            {currentTab === 'tree' && (
              <TreeScreen
                state={studentState}
                topics={publishedTopics}
                onCheckIn={handleAttendanceCheckIn}
                onSelectTopic={(tId) => {
                  setLearnFocusTopicId(tId);
                  setCurrentTab('learn');
                }}
              />
            )}

            {currentTab === 'results' && (
              <LearningResultsScreen
                state={studentState}
                topics={publishedTopics}
                onSelectTopic={(tId) => {
                  setLearnFocusTopicId(tId);
                  setCurrentTab('learn');
                }}
                questions={rawQuestions || {}}
                studentId={currentStudentId}
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
                onLogout={handleLogout}
              />
            )}
          </React.Suspense>
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

      {/* BANNER XEM THỬ HỌC SINH: hiện rõ đang xem thử + đường thoát về phiên GV/Admin */}
      {previewReturnSession && currentSession?.role === 'student' && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
          <span className="text-xs sm:text-sm font-bold">
            Đang xem thử góc Học sinh (hs001) — thao tác tại đây lưu vào dữ liệu thật của hs001
          </span>
          <button
            onClick={handleExitStudentPreview}
            className="shrink-0 px-3 py-1 rounded-full bg-white text-amber-700 text-xs font-extrabold hover:bg-amber-50 active:scale-95 transition"
          >
            Thoát xem thử
          </button>
        </div>
      )}

      {/* DEV PANEL: chỉ tồn tại ở bản development — bản production không được
          chứa công cụ tự cộng XP / tự duyệt quà / tự chấm bài cho học sinh */}
      {import.meta.env.DEV && (
        <DevPanel
          state={studentState}
          onUpdateState={setStudentState}
        />
      )}

      {/* TOAST THÔNG BÁO NHẸ NHÀNG */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] text-white text-xs sm:text-sm font-bold shadow-xl shadow-indigo-500/25 border border-indigo-300/30 animate-[slideUp_0.2s_ease] backdrop-blur-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
