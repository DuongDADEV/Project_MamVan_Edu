import { supabase, isSupabaseReady } from './client.ts';

export const LESSON_MEDIA_BUCKET = 'lesson-media';

/**
 * Tải file (video / ảnh bìa) lên Supabase Storage và trả về đường dẫn công khai (public URL).
 * Đường dẫn này được lưu vào database nên không mất khi tải lại trang.
 */
export async function uploadLessonMedia(
  file: File,
  folder: 'videos' | 'thumbnails'
): Promise<string> {
  if (!isSupabaseReady()) {
    throw new Error('Chưa cấu hình Supabase nên không thể tải file lên.');
  }

  const rawExt = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = rawExt || (folder === 'videos' ? 'mp4' : 'jpg');
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(LESSON_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    throw new Error(error.message || 'Tải file lên Supabase Storage thất bại.');
  }

  const { data } = supabase.storage.from(LESSON_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
