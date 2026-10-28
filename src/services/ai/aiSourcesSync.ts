/**
 * Đồng bộ nguồn tài liệu của Mầm AI Studio với database (28/10).
 *
 * Lúc đầu chỉ nguồn FILE (tải pdf/docx/txt lên) lưu database; theo lệnh
 * chủ dự án sau đó mở rộng ra TẤT CẢ nguồn: dán văn bản, bản ghi, file.
 * Bảng ai_sources trên máy chủ, theo giáo viên + chủ đề.
 *
 * Luật hợp nhất khi mở Studio: nguồn trên máy chủ là chuẩn; nguồn ở local
 * mà máy chủ chưa có (thêm vào lúc mất mạng) thì giữ lại và đẩy bù; nguồn
 * đã xóa ở nơi khác không bị đẩy lại (nhờ dấu đã-đồng-bộ).
 * Lỗi mạng không chặn dùng Studio — nguồn vẫn dùng được ở local, lần mở
 * sau sẽ đồng bộ lại.
 */
import type { AISource } from './AIService.ts';
import { apiFetch, apiPost } from '../api/http.ts';

function encodeTopic(topicId: string): string {
  return encodeURIComponent(topicId);
}

function validType(t: any): AISource['type'] {
  return t === 'text' || t === 'file' || t === 'transcript' ? t : 'file';
}

/** Lấy toàn bộ nguồn của chủ đề từ máy chủ (rỗng nếu chưa có/không có quyền). */
export async function fetchServerSources(topicId: string): Promise<AISource[]> {
  const rows = await apiFetch<any[]>(`/api/ai-sources?topicId=${encodeTopic(topicId)}`);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r.id === 'string' && typeof r.content === 'string')
    .map((r) => ({
      id: r.id,
      title: typeof r.title === 'string' ? r.title : 'Tài liệu chưa đặt tên',
      type: validType(r.type),
      content: r.content,
      wordCount: typeof r.wordCount === 'number' ? r.wordCount : 0,
      isEnabled: r.isEnabled !== false,
      fileName: typeof r.fileName === 'string' ? r.fileName : undefined,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    }));
}

/** Đẩy (upsert) một nguồn lên máy chủ. Lỗi thì ném để phía gọi báo rõ. */
export async function pushSource(topicId: string, src: AISource): Promise<void> {
  await apiPost('/api/ai-sources', {
    id: src.id,
    topicId,
    title: src.title,
    type: src.type,
    content: src.content,
    fileName: src.fileName || null,
    wordCount: src.wordCount,
    isEnabled: src.isEnabled,
  });
}

/** Đổi trạng thái bật/tắt của một nguồn trên máy chủ (best-effort). */
export async function patchSourceEnabled(id: string, isEnabled: boolean): Promise<void> {
  await apiFetch(`/api/ai-sources/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isEnabled }),
  });
}

/** Xóa một nguồn khỏi máy chủ (best-effort). */
export async function deleteSource(id: string): Promise<void> {
  await apiFetch(`/api/ai-sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
