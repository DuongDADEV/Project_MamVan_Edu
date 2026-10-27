import express from 'express';

/**
 * GĐ3 — phục vụ file lesson-media từ đĩa VPS (thay Supabase Storage
 * bucket `lesson-media`). Route upload của worker khác ghi vào cùng
 * thư mục này qua resolveFilesDir() — 1 nguồn thật duy nhất cho
 * đường dẫn gốc, tránh lệch giữa static và upload.
 *
 * FILES_DIR (env) thắng mọi mặc định. Không có env thì:
 *  - Windows (VPS thật): C:\mamvan\files
 *  - còn lại (dev Linux/macOS): ./files
 */

export function resolveFilesDir(): string {
  const env = process.env.FILES_DIR;
  if (env && env.trim()) return env;
  return process.platform === 'win32' ? 'C:\\mamvan\\files' : './files';
}

/**
 * Gắn static tại /files lên app Express. Tương đương URL public của
 * bucket cũ (không yêu cầu auth — đúng §2.8 khảo sát):
 *  - dotfiles: 'deny' — không phục vụ file ẩn.
 *  - index: false — không liệt kê thư mục.
 *  - express.static tự chặn path traversal (mọi đường dẫn được resolve
 *    trong root, `..` thoát root sẽ bị từ chối).
 * File không tồn tại sẽ fall-through sang handler tiếp theo của app
 * (worker route nên kết thúc bằng 404) thay vì tự trả lỗi tại đây.
 */
export function mountFiles(app: any): void {
  app.use('/files', express.static(resolveFilesDir(), { dotfiles: 'deny', index: false }));
}
