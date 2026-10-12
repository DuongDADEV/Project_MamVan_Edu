import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://mktrtiqawvhettiwcels.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_ZBfzRL5pOM_wH5c9ZBL1AQ_pjgdzyOS';

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabasePublishableKey: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Kiểm tra xem cấu hình có hợp lệ hay không
const isConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  !supabasePublishableKey.toLowerCase().includes('placeholder')
);

/**
 * Singleton Supabase Client instance dùng chung cho toàn bộ ứng dụng.
 * Được khởi tạo với URL và Publishable Anon Key an toàn.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Kiểm tra trạng thái sẵn sàng của cấu hình Supabase Client.
 */
export function isSupabaseReady(): boolean {
  return isConfigured;
}

/**
 * Trả về thông tin trạng thái cấu hình (đã che thông tin nhạy cảm).
 */
export function getSupabaseConfigStatus(): {
  isReady: boolean;
  url: string | undefined;
  hasPublishableKey: boolean;
} {
  return {
    isReady: isConfigured,
    url: supabaseUrl,
    hasPublishableKey: Boolean(
      supabasePublishableKey && !supabasePublishableKey.toLowerCase().includes('placeholder')
    ),
  };
}

export default supabase;
