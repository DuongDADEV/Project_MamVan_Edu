/**
 * Bundle Express VPS-only cho Mầm Văn (GĐ3).
 *
 * Mount tất cả router nhóm A/B tại /api + 6 route cũ (Vercel-style cũ đã
 * viết lại thành Router với route '/') tại đúng path cũ + phục vụ thư
 * mục /files/ tĩnh cho video (xem api/_lib/filesStatic.ts).
 *
 * Chạy: `npm run server` (tsx api/server.ts) hoặc nhúng `app` vào entry
 * của VPS. Biến env cần có: MYSQL_* (xem api/_lib/mysql.ts), JWT_SECRET,
 * FILES_DIR (mặc định C:\mamvan\files trên win32, ./files nơi khác).
 * Không hardcode secret nào ở đây — mọi secret đọc từ env qua lib.
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { mountFiles } from './_lib/filesStatic';
import { authRouter } from './routes/auth';
import { adminUsersRouter } from './routes/adminUsers';
import { classesRouter } from './routes/classes';
import { studentsRouter } from './routes/students';
import { contentRouter } from './routes/content';
import { mediaRouter } from './routes/media';
import { attemptsRouter } from './routes/attempts';
import { essaysRouter } from './routes/essays';
import { rewardsRouter } from './routes/rewards';
import { dashboardRouter } from './routes/dashboard';
import { chatRouter } from './routes/chat';
import { teachersRouter } from './routes/teachers';
import aiChatRouter from './ai/chat';
import aiSettingsRouter from './admin/ai-settings';
import aiTestRouter from './admin/ai-test';
import geminiModelsRouter from './admin/gemini-models';
import geminiProbeRouter from './admin/gemini-probe';
import healthRouter from './health';

export function createApp(): express.Express {
  const app = express();
  // Payload JSON có thể lớn (nội dung lý thuyết) — 10mb thay vì 100kb mặc định.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // LOG CHẨN ĐOÁN TẠM THỜI (28/10, vụ reload văng đăng nhập): chỉ ghi
  // các request /api/auth/* và mọi response 401 — KHÔNG ghi token, mật
  // khẩu hay nội dung body. Đủ để thấy trình duyệt sau reload có gọi
  // /me không, có gửi Authorization không, và server trả gì. XÓA sau
  // khi chẩn đoán xong.
  app.use((req, res, next) => {
    res.on('finish', () => {
      try {
        const p = req.path || '';
        if (p.startsWith('/api/auth/') || res.statusCode === 401) {
          const hasAuth = req.headers.authorization ? 'auth-present' : 'auth-absent';
          console.log(`[authlog] ${req.method} ${p} -> ${res.statusCode} ${hasAuth}`);
        }
      } catch {
        /* bỏ qua lỗi log */
      }
    });
    next();
  });

  // Thư mục file tĩnh (video đã dời về VPS ở GĐ2: /files/videos/...).
  mountFiles(app);

  // Router nhóm A/B — mỗi router tự gắn requireAuth (trừ authRouter
  // tự xử lý từng route: sign-in/refresh public, còn lại cần JWT).
  app.use('/api', authRouter);
  app.use('/api', adminUsersRouter);
  app.use('/api', classesRouter);
  app.use('/api', studentsRouter);
  app.use('/api', contentRouter);
  app.use('/api', mediaRouter);
  app.use('/api', attemptsRouter);
  app.use('/api', essaysRouter);
  app.use('/api', rewardsRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', chatRouter);
  app.use('/api', teachersRouter);

  // Route cũ giữ nguyên path (đã viết lại ruột MySQL + JWT ở GĐ3).
  app.use('/api/ai/chat', aiChatRouter);
  app.use('/api/admin/ai-settings', aiSettingsRouter);
  app.use('/api/admin/ai-test', aiTestRouter);
  app.use('/api/admin/gemini-models', geminiModelsRouter);
  app.use('/api/admin/gemini-probe', geminiProbeRouter);
  app.use('/api/health', healthRouter);

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });

  // Lỗi cuối: không trả stack trace ra client.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api]', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'SERVER_ERROR' });
  });

  return app;
}

export const app = createApp();
export default app;
