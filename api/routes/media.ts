import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { requireAuth, httpErr } from '../_lib/auth';
import { resolveFilesDir } from '../_lib/filesStatic';

/**
 * POST /media/upload (multipart, field `file`, kèm field `folder`).
 * Mount tại /api. Trả { url: '/files/{folder}/{name}' }.
 *
 * Mirror uploadLessonMedia gốc (storage.ts):
 * - folder whitelist: videos | thumbnails | images | attachments.
 * - tên file: {Date.now()}_{random6}.{ext} (ext làm sạch, mặc định mp4
 *   cho videos, jpg cho còn lại như code gốc).
 * - upsert: false — không ghi đè: nếu tên đã tồn tại (praktisch không
 *   xảy ra nhờ timestamp + random) thì sinh suffix mới cho tới khi tên
 *   trống.
 * - giới hạn 500MB (theo task GĐ3; khác fallback DataURL 5MB phía client
 *   — fallback đó vẫn ở client khi upload lỗi, không thuộc route này).
 * - chỉ teacher/admin (học sinh → 403).
 *
 * KHÔNG có endpoint xóa file: code hiện tại không có đường xóa storage
 * (khảo sát §2.8/§6.4 đã ghi "chưa rõ — cần rà thêm"; rà code storage.ts
 * xác nhận chỉ có upload + getPublicUrl, không có remove). Thêm DELETE
 * /api/media sẽ gây link chết cho payload đang tham chiếu file nên
 * KHÔNG tự thêm — xem báo cáo.
 */

const FOLDERS = new Set(['videos', 'thumbnails', 'images', 'attachments']);
const MAX_BYTES = 500 * 1024 * 1024; // 500MB

function random6(): string {
  return randomBytes(4).toString('hex').slice(0, 6);
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // Multer đọc field theo thứ tự form gửi lên: client PHẢI gửi field
    // `folder` trước field `file` để destination thấy được folder. Folder
    // không hợp lệ → abort trước khi ghi đĩa (không để file mồ côi).
    const folder = String((req.body as any)?.folder || '');
    if (!FOLDERS.has(folder)) {
      cb(new Error('INVALID_FOLDER'), '');
      return;
    }
    const dir = join(resolveFilesDir(), folder);
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const folder = String((req.body as any)?.folder || '');
    const safeFolder = FOLDERS.has(folder) ? folder : 'images';
    const rawExt = (file.originalname.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ext = rawExt || (safeFolder === 'videos' ? 'mp4' : 'jpg');
    const dir = join(resolveFilesDir(), safeFolder);
    let name = `${Date.now()}_${random6()}.${ext}`;
    // Không ghi đè: trùng tên thì sinh suffix mới.
    while (existsSync(join(dir, name))) {
      name = `${Date.now()}_${random6()}.${ext}`;
    }
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
});

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

mediaRouter.post('/media/upload', (req: Request, res: Response) => {
  const caller: any = (req as any).caller;
  const role = String(caller?.role || '');
  if (role !== 'teacher' && role !== 'admin') {
    return httpErr(res, 403, 'FORBIDDEN');
  }
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return httpErr(res, 413, 'FILE_TOO_LARGE');
      }
      if (err.message === 'INVALID_FOLDER') {
        return httpErr(res, 400, 'BAD_INPUT');
      }
      return httpErr(res, 400, 'UPLOAD_FAILED');
    }
    const folder = String((req.body as any)?.folder || '');
    if (!FOLDERS.has(folder)) {
      return httpErr(res, 400, 'BAD_INPUT');
    }
    const file = (req as any).file;
    if (!file?.filename) {
      return httpErr(res, 400, 'BAD_INPUT');
    }
    return res.status(200).json({ url: `/files/${folder}/${file.filename}`, name: file.filename });
  });
});
