/**
 * Đồng bộ nguồn tài liệu FILE của Mầm AI Studio với database (28/10).
 *
 * Trước đây nguồn chỉ sống ở localStorage trình duyệt: đổi máy, xóa cache
 * hay lệch khóa là mất. Nay nguồn type 'file' (tải pdf/docx/txt lên) còn
 * được lưu ở bảng ai_sources trên máy chủ, theo giáo viên + chủ đề.
 * Nguồn dán văn bản và bản ghi KHÔNG thuộc phạm vi này — vẫn chỉ ở local.
 *
 * Luật hợp nhất khi mở Studio: nguồn file trên máy chủ là chuẩn; nguồn
 * file ở local mà máy chủ chưa có (tải lên lúc mất mạng) thì giữ lại và
 * đẩy bù lên; nguồn file ở local đã có trên máy chủ thì lấy bản máy chủ.
 * Lỗi mạng không chặn dùng Studio — nguồn vẫn dùng được ở local, lần mở
 * sau sẽ đồng bộ lại.
 */
import type { AISource } from './AIService.ts';
import { apiFetch, apiPost } from '../api/http.ts';

function encodeTopic(topicId: string): string {
  return encodeURIComponent(topicId);
}

/** Lấy toàn bộ nguồn file của chủ đề từ máy chủ (rỗng nếu chưa có/không có quyền). */
export async function fetchServerFileSources(topicId: string): Promise<AISource[]> {
  const rows = await apiFetch<any[]>(`/api/ai-sources?topicId=${encodeTopic(topicId)}`);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r.id === 'string' && typeof r.content === 'string')
    .map((r) => ({
      id: r.id,
      title: typeof r.title === 'string' ? r.title : 'Tài liệu chưa đặt tên',
      type: 'file' as const,
      content: r.content,
      wordCount: typeof r.wordCount === 'number' ? r.wordCount : 0,
      isEnabled: r.isEnabled !== false,
      fileName: typeof r.fileName === 'string' ? r.fileName : undefined,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    }));
}

/** Đẩy (upsert) một nguồn file lên máy chủ. Lỗi thì ném để phía gọi báo rõ. */
export async function pushFileSource(topicId: string, src: AISource): Promise<void> {
  await apiPost('/api/ai-sources', {
    id: src.id,
    topicId,
    title: src.title,
    content: src.content,
    fileName: src.fileName || null,
    wordCount: src.wordCount,
    isEnabled: src.isEnabled,
  });
}

/** Đổi trạng thái bật/tắt của một nguồn file trên máy chủ (best-effort). */
export async function patchFileSourceEnabled(id: string, isEnabled: boolean): Promise<void> {
  await apiFetch(`/api/ai-sources/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isEnabled }),
  });
}

/** Xóa một nguồn file khỏi máy chủ (best-effort). */
export async function deleteFileSource(id: string): Promise<void> {
  await apiFetch(`/api/ai-sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
