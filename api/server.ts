/**
 * Entry chạy bundle API trên VPS (GĐ3; GĐ5 mới deploy).
 * PORT từ env, mặc định 3000 (khớp service mamvan trên VPS).
 * Dev local: chạy cổng khác (vd PORT=3001) vì Vite dev đã chiếm 3000,
 * rồi đặt VITE_API_BASE_URL=http://localhost:3001 cho frontend.
 */
import { createApp } from './index';

const port = Number(process.env.PORT || 3000);
const app = createApp();
app.listen(port, () => {
  console.log(`[mamvan-api] listening on :${port}`);
});
