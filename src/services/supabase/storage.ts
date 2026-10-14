import { supabase, isSupabaseReady } from './client.ts';

export const LESSON_MEDIA_BUCKET = 'lesson-media';

/**
 * Tải file (video / ảnh bìa / hình ảnh minh họa) lên Supabase Storage và trả về đường dẫn công khai (public URL).
 * Có cơ chế tự động fallback sang Data URL nếu mất mạng hoặc bucket chưa sẵn sàng.
 */
export async function uploadLessonMedia(
  file: File,
  folder: 'videos' | 'thumbnails' | 'images' | 'attachments'
): Promise<string> {
  const fileToDataUrl = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  };

  if (!isSupabaseReady()) {
    return fileToDataUrl(file);
  }

  const rawExt = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = rawExt || (folder === 'videos' ? 'mp4' : 'jpg');
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const { error } = await supabase.storage.from(LESSON_MEDIA_BUCKET).upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || undefined,
    });

    if (error) {
      console.warn('[SupabaseStorage] Lỗi tải file lên bucket, chuyển sang DataURL dự phòng:', error.message);
      return fileToDataUrl(file);
    }

    const { data } = supabase.storage.from(LESSON_MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err: any) {
    console.warn('[SupabaseStorage] Ngoại lệ khi upload, fallback sang DataURL:', err?.message);
    return fileToDataUrl(file);
  }
}
