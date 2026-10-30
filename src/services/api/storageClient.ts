/**
 * Upload media bài giảng qua API VPS (GĐ3) — thay storage.ts (Supabase
 * Storage bucket 'lesson-media').
 *
 * - POST /api/media/upload, multipart FormData với field 'file' + 'folder'
 *   (folder: 'videos' | 'thumbnails' | 'images' | 'attachments'), kèm
 *   Bearer từ http.ts (getAccessToken). Trả về URL /files/... của server.
 * - KHÔNG import supabase, KHÔNG hardcode URL Supabase.
 * - Thất bại (mất mạng, HTTP lỗi) → fallback DataURL base64, cap 5 MB như
 *   cũ; file lớn hơn 5 MB mà upload lỗi thì báo lỗi rõ, không phình
 *   localStorage.
 */
import { API_BASE_URL, getAccessToken } from './http.ts';

export type LessonMediaFolder = 'videos' | 'thumbnails' | 'images' | 'attachments';

const MAX_DATAURL_BYTES = 5 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  // DataURL dự phòng bị giới hạn 5MB: file lớn hơn sẽ phình localStorage
  // và làm trình duyệt treo — thà báo lỗi rõ ràng để GV dùng file nhỏ hơn.
  // Thông báo phải nói rõ nguyên nhân thật (tải lên máy chủ thất bại) chứ
  // không để người đọc tưởng 5MB là giới hạn chung của hệ thống.
  if (file.size > MAX_DATAURL_BYTES) {
    return Promise.reject(
      new Error(
        `Không tải được file "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB) lên máy chủ, mà chế độ lưu dự phòng chỉ nhận file tới 5MB. Hãy kiểm tra mạng, đăng nhập lại rồi thử tải lại, hoặc nén file nhỏ hơn.`
      )
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resolveUploadUrl(): string {
  const base = API_BASE_URL || '';
  return `${base}/api/media/upload`;
}

export async function uploadLessonMedia(
  file: File,
  folder: LessonMediaFolder
): Promise<string> {
  const form = new FormData();
  // QUAN TRỌNG (GĐ3 tích hợp): multer ở server cần field 'folder' TRƯỚC
  // field 'file' để chọn thư mục đích trước khi ghi đĩa — gửi ngược thứ
  // tự sẽ bị từ chối folder không hợp lệ.
  form.append('folder', folder);
  form.append('file', file);

  try {
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(resolveUploadUrl(), {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) {
      console.warn(
        '[ApiStorage] Lỗi tải file lên /api/media/upload (HTTP',
        res.status,
        '), chuyển sang DataURL dự phòng.'
      );
      return fileToDataUrl(file);
    }
    const text = await res.text().catch(() => '');
    let url: string | undefined;
    if (text) {
      try {
        const json = JSON.parse(text);
        if (typeof json === 'string') url = json;
        else if (json && typeof json === 'object') {
          url = json.url || json.path || json.fileUrl || json.location || undefined;
        }
      } catch {
        // Trả về text thuần (chính là URL).
        url = text.trim();
      }
    }
    if (url && (url.startsWith('/files/') || /^https?:\/\//i.test(url))) return url;
    // Upload thành công nhưng server không trả về URL dùng được: không
    // lặng lẽ đổi sang DataURL (sẽ lệch tham chiếu file) — báo lỗi rõ.
    throw new Error('Máy chủ đã nhận file nhưng không trả về đường dẫn /files/ dùng được.');
  } catch (err: any) {
    if (err instanceof Error && /không trả về đường dẫn/.test(err.message)) throw err;
    console.warn('[ApiStorage] Ngoại lệ khi upload, fallback sang DataURL:', err?.message);
    return fileToDataUrl(file);
  }
}
