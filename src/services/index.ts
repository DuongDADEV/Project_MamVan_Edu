/**
 * Điểm tập kết Services của ứng dụng Mầm Văn.
 * Đóng gói và xuất ra các Repository Interface chuẩn.
 * Hiện tại mặc định sử dụng Mock Repository (localStorage + multi-tab BroadcastChannel).
 * Sau này chuyển sang Supabase chỉ cần thay đổi implementation tại file này.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AuthRepository,
  ClassRepository,
  StudentRepository,
  ContentRepository,
  QuizRepository,
  AttemptRepository,
  EssayRepository,
  RewardRepository,
  AuditRepository,
  SettingRepository,
  TeacherRepository,
} from './types.ts';
import {
  authRepo,
  classRepo,
  studentRepo,
  contentRepo,
  quizRepo,
  attemptRepo,
  essayRepo,
  rewardRepo,
  auditRepo,
  settingRepo,
  teacherRepo,
  resetAllDemoData,
  bootstrapStorage,
  STORAGE_SCHEMA_VERSION,
  DEFAULT_SYSTEM_SETTINGS,
} from './mock/mockRepositories.ts';
import {
  supabaseAuthRepo,
  supabaseClassRepo,
  supabaseStudentRepo,
  supabaseAttemptRepo,
  supabaseEssayRepo,
  supabaseRewardRepo,
  supabaseTeacherRepo,
  supabaseQuizRepo,
  supabaseContentRepo,
} from './supabase/supabaseRepositories.ts';
import { syncEventBus } from './mock/eventBus.ts';

// Xuất các repository instances (Kết nối Supabase trực tiếp)
export const authService: AuthRepository = supabaseAuthRepo;
export const authRepository: AuthRepository = supabaseAuthRepo;
export const teacherService: TeacherRepository = supabaseTeacherRepo;
export const teacherRepository: TeacherRepository = supabaseTeacherRepo;
export const classService: ClassRepository = supabaseClassRepo;
export const classRepository: ClassRepository = supabaseClassRepo;
export const studentService: StudentRepository = supabaseStudentRepo;
export const studentRepository: StudentRepository = supabaseStudentRepo;
export const contentService: ContentRepository = supabaseContentRepo;
export const contentRepository: ContentRepository = supabaseContentRepo;
export const quizService: QuizRepository = supabaseQuizRepo;
export const quizRepository: QuizRepository = supabaseQuizRepo;
export const attemptService: AttemptRepository = supabaseAttemptRepo;
export const attemptRepository: AttemptRepository = supabaseAttemptRepo;
export const essayService: EssayRepository = supabaseEssayRepo;
export const essayRepository: EssayRepository = supabaseEssayRepo;
export const rewardService: RewardRepository = supabaseRewardRepo;
export const rewardRepository: RewardRepository = supabaseRewardRepo;
export const auditService: AuditRepository = auditRepo;
export const auditRepository: AuditRepository = auditRepo;
export const settingService: SettingRepository = settingRepo;
export const settingRepository: SettingRepository = settingRepo;
export { aiService } from './ai/index.ts';
export * from './ai/index.ts';

export { resetAllDemoData, bootstrapStorage, STORAGE_SCHEMA_VERSION, DEFAULT_SYSTEM_SETTINGS, syncEventBus };
export * from './types.ts';

/**
 * Hook `useLiveQuery`: Tự động nạp dữ liệu và đăng ký lắng nghe thay đổi
 * để UI luôn cập nhật tức thì (ngay cả khi thao tác ở tab khác).
 * 
 * Cải tiến ổn định:
 * - Chỉ loading = true ở lần tải ĐẦU TIÊN; các lần cập nhật nền không đổi trạng thái loading.
 * - Chỉ gọi setData khi dữ liệu thật sự thay đổi (so sánh sâu JSON).
 * - Gắn subscriberId để tránh phản xạ lại các event cùng nguồn.
 * - Hủy đăng ký an toàn khi component unmount.
 */
export function useLiveQuery<T>(
  queryFn: () => Promise<T>,
  watchEntities: string[] = ['*'],
  deps: any[] = []
): { data: T | null; loading: boolean; error: Error | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const currentDataRef = useRef<T | null>(null);
  currentDataRef.current = data;

  const isMountedRef = useRef(true);
  const isFirstLoadRef = useRef(true);
  const hookSourceId = useRef('live-query-' + Math.random().toString(36).substring(2, 9)).current;

  const execute = useCallback(async (isBackground = false) => {
    if (!isMountedRef.current) return;
    if (!isBackground && isFirstLoadRef.current) {
      setLoading(true);
    }
    try {
      const res = await queryFnRef.current();
      if (!isMountedRef.current) return;

      // So sánh dữ liệu mới và cũ bằng JSON để tránh re-render không cần thiết
      const oldJson = JSON.stringify(currentDataRef.current);
      const newJson = JSON.stringify(res);

      if (oldJson !== newJson) {
        setData(res);
      }
      setError(null);
    } catch (err: any) {
      if (isMountedRef.current) {
        console.error('Lỗi khi thực thi useLiveQuery:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMountedRef.current && isFirstLoadRef.current) {
        setLoading(false);
        isFirstLoadRef.current = false;
      }
    }
  }, deps);

  // Chạy khi deps thay đổi
  useEffect(() => {
    isMountedRef.current = true;
    execute(false);
    return () => {
      isMountedRef.current = false;
    };
  }, [execute]);

  // Đăng ký lắng nghe các entity đúng một lần, hủy khi unmount
  const watchKey = watchEntities.join(',');
  useEffect(() => {
    const unsubscribers = watchEntities.map((ent) =>
      syncEventBus.subscribe(
        ent,
        () => {
          // Cập nhật nền, không bật lại spinner loading
          execute(true);
        },
        hookSourceId
      )
    );

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [watchKey, execute, hookSourceId]);

  return { data, loading, error, refresh: () => execute(false) };
}
