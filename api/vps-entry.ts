/**
 * Entry chạy trên VPS (deploy GĐ3/GĐ5, không dùng cho Vercel).
 * Gộp: app API từ ./index + phục vụ frontend tĩnh (dist/) + SPA fallback.
 * 404 của /api nằm trong createApp nên fallback chỉ chạm tới đường
 * không phải /api. DIST_DIR thắng mặc định <thư mục bundle>/dist.
 * PORT từ env, mặc định 3000 (khớp service mamvan trên VPS).
 */
import path from 'path';
import express from 'express';
import { createApp } from './index';

const distDir = process.env.DIST_DIR || path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 3000);
const app = createApp();

app.use(express.static(distDir, { index: 'index.html' }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`[mamvan] listening on :${port} (dist: ${distDir})`);
});
