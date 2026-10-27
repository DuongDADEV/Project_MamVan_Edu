/**
 * Điểm tập kết Services của ứng dụng Mầm Văn.
 * Đóng gói và xuất ra các Repository Interface chuẩn.
 *
 * GĐ3 (VPS-only, MySQL): toàn bộ repository nghiệp vụ đi qua API server
 * (src/services/api/*) — không còn Supabase client. Chỉ audit/setting
 * vẫn là mock local (chưa có endpoint server tương ứng, theo khảo sát
 * §6.3); essay rubric/sample/config/accuracy cũng giữ local qua
 * mockEssayRepo bên trong ApiEssayRepository (dữ liệu chỉ ở local).
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
import { apiAuthRepo } from './api/authRepository.ts';
import {
  apiClassRepo,
  apiStudentRepo,
  apiAttemptRepo,
  apiEssayRepo,
  apiRewardRepo,
  apiTeacherRepo,
} from './api/repositories.ts';
import { ApiContentRepository, ApiQuizRepository } from './api/contentClient.ts';
import { syncEventBus } from './mock/eventBus.ts';

// Xuất các repository instances (API server MySQL trên VPS)
export const authService: AuthRepository = apiAuthRepo;
export const authRepository: AuthRepository = apiAuthRepo;
export const teacherService: TeacherRepository = apiTeacherRepo;
export const teacherRepository: TeacherRepository = apiTeacherRepo;
export const classService: ClassRepository = apiClassRepo;
export const classRepository: ClassRepository = apiClassRepo;
export const studentService: StudentRepository = apiStudentRepo;
export const studentRepository: StudentRepository = apiStudentRepo;
export const contentService: ContentRepository = new ApiContentRepository();
export const contentRepository: ContentRepository = contentService;
export const quizService: QuizRepository = new ApiQuizRepository();
export const quizRepository: QuizRepository = quizService;
export const attemptService: AttemptRepository = apiAttemptRepo;
export const attemptRepository: AttemptRepository = apiAttemptRepo;
export const essayService: EssayRepository = apiEssayRepo;
export const essayRepository: EssayRepository = apiEssayRepo;
export const rewardService: RewardRepository = apiRewardRepo;
export const rewardRepository: RewardRepository = apiRewardRepo;
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
