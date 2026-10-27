/**
 * Két mật khẩu xem được (theo quyết định của chủ hệ thống 2026-10-27):
 * giáo viên bấm mắt là xem được mật khẩu hiện tại của học sinh lớp mình.
 *
 * - Mã hóa AES-256-GCM, khóa nằm DUY NHẤT trong env máy chủ
 *   (PASSWORD_VIEW_KEY = 64 ký tự hex = 32 byte, sinh trên VPS, không
 *   commit, không in ra). Mất khóa = không giải được dữ liệu cũ.
 * - Định dạng lưu: base64(iv 12B) + '.' + base64(authTag 16B) + '.' +
 *   base64(ciphertext). IV ngẫu nhiên mỗi lần mã hóa.
 * - Best-effort: chưa có khóa hợp lệ (hoặc DB chưa có cột) thì trả null,
 *   luồng tạo/reset/đăng nhập KHÔNG BAO GIỜ vì két mà hỏng — mắt chỉ
 *   báo "chưa lưu".
 * - Mật khẩu vẫn bcrypt như cũ để đăng nhập; két chỉ phục vụ xem lại.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer | null {
  const hex = (process.env.PASSWORD_VIEW_KEY || '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  try {
    return Buffer.from(hex, 'hex');
  } catch {
    return null;
  }
}

export function encryptPassword(plain: string): string | null {
  const key = getKey();
  if (!key || !plain) return null;
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
  } catch {
    return null;
  }
}

export function decryptPassword(stored: string): string | null {
  const key = getKey();
  if (!key || !stored) return null;
  try {
    const parts = stored.split('.');
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, ctB64] = parts;
    if (!ivB64 || !tagB64 || !ctB64) return null;
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]);
    return pt.toString('utf8');
  } catch {
    return null;
  }
}
