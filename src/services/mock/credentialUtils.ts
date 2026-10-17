/**
 * Tiện ích sinh Tên đăng nhập và Mật khẩu theo chuẩn:
 * - Tên đăng nhập: không dấu, chữ thường, quy tắc: [tên] + [chữ cái đầu họ và tên đệm] + [2 chữ số]
 *   Ví dụ: "Nguyễn Minh Anh" -> "anhnm27"
 * - Mật khẩu: 8 ký tự dễ đọc, loại trừ ký tự dễ nhầm lẫn (0, O, 1, l, I).
 */

// Bảng xóa dấu tiếng Việt
export function removeVietnameseTones(str: string): string {
  let res = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  res = res.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  return res;
}

/**
 * Sinh username theo quy tắc: tên + chữ đầu họ đệm + 2 số
 * Nguyễn Minh Anh -> "anh" + "n" + "m" + "27" = "anhnm27"
 */
// Số ngẫu nhiên an toàn (crypto) cho mật khẩu/UUID — Math.random đoán được
function secureRandomInt(maxExclusive: number): number {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return arr[0] % maxExclusive;
    }
  } catch {
    /* rơi xuống fallback */
  }
  return Math.floor(Math.random() * maxExclusive);
}

export function generateUsername(fullName: string, existingUsernames: string[] = []): string {
  const cleanName = removeVietnameseTones(fullName.trim().toLowerCase());
  const parts = cleanName.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    // Cũng phải qua vòng kiểm tra trùng bên dưới như tên thường
    const taken = new Set(existingUsernames.map((u) => u.toLowerCase()));
    for (let num = 10; num <= 9999; num++) {
      const candidate = `hocsinh${num}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `hocsinh${Date.now()}`;
  }

  const firstName = parts[parts.length - 1]; // Tên chính (vd: Anh -> anh)
  const initialLetters = parts
    .slice(0, parts.length - 1)
    .map((p) => p.charAt(0))
    .join(''); // Họ và đệm (vd: Nguyen Minh -> nm)

  const baseUsername = `${firstName}${initialLetters}`;

  // Sinh hậu tố số XÁC ĐỊNH (không ngẫu nhiên): chọn số nhỏ nhất chưa bị dùng.
  // Cách này bảo đảm không bao giờ trùng khi danh sách hiện có đầy đủ,
  // kể cả khi thêm nhiều học sinh trùng tên trong cùng một lần.
  const taken = new Set(existingUsernames.map((u) => u.toLowerCase()));
  for (let num = 10; num <= 9999; num++) {
    const candidate = `${baseUsername}${num}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `${baseUsername}${Date.now()}`;
}

/**
 * Sinh Mã HS tự động dạng HS + 4 chữ số (HS0001, HS0002, ...):
 * chọn số nhỏ nhất chưa bị dùng trong danh sách hiện có.
 */
export function generateStudentCode(existingCodes: (string | undefined | null)[] = []): string {
  const taken = new Set(
    existingCodes.filter(Boolean).map((c) => String(c).toUpperCase())
  );
  for (let num = 1; num <= 9999; num++) {
    const candidate = `HS${String(num).padStart(4, '0')}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  return `HS${Date.now()}`;
}

/**
 * Sinh mật khẩu 8 ký tự dễ đọc:
 * Loại bỏ ký tự dễ nhầm (0, O, o, 1, l, I)
 */
export function generateFriendlyPassword(length = 8): string {
  const chars = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  let password = '';
  for (let i = 0; i < length; i++) {
    const idx = secureRandomInt(chars.length);
    password += chars.charAt(idx);
  }
  return password;
}

/**
 * Tạo UUID đơn giản cho mock
 */
export function generateUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* rơi xuống fallback */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = secureRandomInt(16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
