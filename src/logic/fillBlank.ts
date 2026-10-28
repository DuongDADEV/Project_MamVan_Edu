/**
 * Điền vào chỗ trống — logic dùng chung cho giáo viên (soạn câu) và học
 * sinh (làm bài). Mô hình: câu hỏi (prompt) chứa token `___` đánh dấu vị
 * trí các ô trống, đáp án là mảng theo đúng thứ tự các ô (mỗi phần tử có
 * thể chứa nhiều cách chấp nhận, cách nhau bằng `|`).
 *
 * Phía máy chủ có bản sao của normFillText/gradeFillBlanks trong
 * api/routes/_shared.ts (hai bên không import lẫn nhau được) — sửa một
 * bên thì đối chiếu bên còn lại.
 */

export const BLANK_TOKEN = '___';

/** Tách câu thành các đoạn, ngăn cách bởi các ô trống. */
export function splitPromptBlanks(prompt: string): string[] {
  return String(prompt ?? '').split(BLANK_TOKEN);
}

/** Số ô trống trong câu. */
export function countBlanks(prompt: string): number {
  return Math.max(0, splitPromptBlanks(prompt).length - 1);
}

/** Nhãn ngữ cảnh cho từng ô (vài chữ ngay trước ô) để giáo viên đối chiếu. */
export function blankContexts(prompt: string): string[] {
  const parts = splitPromptBlanks(prompt);
  return parts.slice(0, -1).map((before) => {
    const tail = before.replace(/\s+$/g, '').slice(-14);
    return tail ? `sau “…${tail}”` : 'đầu câu';
  });
}

/**
 * Chuẩn hóa đáp án điền trống để so sánh thoáng: bỏ khoảng trắng thừa,
 * không phân biệt hoa/thường, không phân biệt dấu tiếng Việt, bỏ dấu câu
 * ở cuối. Học sinh gõ điện thoại hay gõ không dấu vẫn được tính đúng.
 */
export function normFillText(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"”’)\]]+$/g, '')
    .trim();
}

/** Các cách chấp nhận của một ô (tách theo `|`), đã chuẩn hóa, bỏ rỗng. */
export function blankVariants(keyEntry: unknown): string[] {
  return String(keyEntry ?? '')
    .split('|')
    .map((v) => normFillText(v))
    .filter(Boolean);
}

/**
 * Đoạn trích có lộ đáp án điền từ không (28/10): so sánh thoáng (không
 * hoa/thường, không dấu, dấu câu thành khoảng trắng) và khớp theo ranh
 * giới từ — đáp án "an" trong "lan" không tính là lộ. Dùng để quyết định
 * có ẩn đoạn trích ở màn học sinh hay không; màn duyệt của giáo viên vẫn
 * hiện đủ đoạn trích để đối chiếu.
 */
export function passageLeaksAnswer(passage: unknown, answers: unknown): boolean {
  const squash = (s: string): string =>
    normFillText(s)
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const text = squash(String(passage ?? ''));
  if (!text) return false;
  const padded = ` ${text} `;
  const keyArr: unknown[] = Array.isArray(answers) ? answers : answers != null ? [answers] : [];
  for (const k of keyArr) {
    for (const v of blankVariants(k)) {
      const needle = ` ${squash(v)} `;
      if (needle.trim() && padded.includes(needle)) return true;
    }
  }
  return false;
}

export interface FillGrade {
  /** Số ô có đáp án để chấm (ô nào đáp án rỗng thì bỏ qua). */
  gradeable: number;
  /** Số ô học sinh làm đúng. */
  matched: number;
  /** Tỉ lệ điểm (matched / gradeable, 0 khi không có ô nào chấm được). */
  scoreRatio: number;
  /** Đúng hoàn toàn (mọi ô chấm được đều đúng). */
  isCorrect: boolean;
}

/**
 * Chấm câu điền trống theo từng ô. keys: mảng đáp án (mỗi phần tử có thể
 * chứa `|`); student: mảng bài làm của học sinh (theo đúng thứ tự ô).
 * Câu cũ chỉ có 1 đáp án chuỗi thì gọi với keys = [chuỗi đó].
 */
export function gradeFillBlanks(keys: unknown, student: unknown): FillGrade {
  const keyArr: unknown[] = Array.isArray(keys) ? keys : keys != null ? [keys] : [];
  const stuArr: unknown[] = Array.isArray(student) ? student : [];
  let gradeable = 0;
  let matched = 0;
  keyArr.forEach((k, i) => {
    const variants = blankVariants(k);
    if (!variants.length) return;
    gradeable += 1;
    const mine = normFillText(stuArr[i]);
    if (mine && variants.includes(mine)) matched += 1;
  });
  return {
    gradeable,
    matched,
    scoreRatio: gradeable > 0 ? matched / gradeable : 0,
    isCorrect: gradeable > 0 && matched === gradeable,
  };
}

/**
 * Tạo ô trống từ đoạn bôi đen trong câu (hoặc từ vị trí con trỏ).
 * Trả về câu + đáp án mới; null khi vùng chọn bao qua ô trống đã có.
 * Đáp án được chèn đúng vị trí của ô mới (đếm số `___` trước điểm bắt đầu).
 */
export function createBlankFromSelection(
  sentence: string,
  answers: string[],
  selStart: number,
  selEnd: number
): { sentence: string; answers: string[] } | null {
  const s = String(sentence ?? '');
  const start = Math.max(0, Math.min(selStart, s.length));
  const end = Math.max(start, Math.min(selEnd, s.length));
  const before = s.slice(0, start);
  const selected = s.slice(start, end);
  const after = s.slice(end);
  // Từ chối khi vùng chọn chạm vào ô trống đã có (kể cả cắt ngang token):
  // tính vị trí từng `___` rồi kiểm tra giao nhau với [start, end).
  let pos = 0;
  while (true) {
    const idx = s.indexOf(BLANK_TOKEN, pos);
    if (idx === -1) break;
    const overlaps = start < idx + BLANK_TOKEN.length && idx < end;
    const inside = start === end && start > idx && start < idx + BLANK_TOKEN.length;
    if (overlaps || inside) return null;
    pos = idx + BLANK_TOKEN.length;
  }
  const blankIndex = before.split(BLANK_TOKEN).length - 1;
  const nextAnswers = [...answers];
  nextAnswers.splice(blankIndex, 0, selected);
  return { sentence: before + BLANK_TOKEN + after, answers: nextAnswers };
}

/**
 * Xóa ô trống thứ index: trả lại chữ gốc (cách chấp nhận đầu tiên) vào
 * đúng vị trí ô đó trong câu, đồng thời gỡ đáp án khỏi mảng.
 */
export function deleteBlank(
  sentence: string,
  answers: string[],
  index: number
): { sentence: string; answers: string[] } {
  const parts = splitPromptBlanks(sentence);
  if (index < 0 || index >= parts.length - 1) return { sentence, answers };
  const restore = String(answers[index] ?? '').split('|')[0] ?? '';
  const nextSentence =
    parts.slice(0, index + 1).join(BLANK_TOKEN) + restore + parts.slice(index + 1).join(BLANK_TOKEN);
  return { sentence: nextSentence, answers: answers.filter((_, i) => i !== index) };
}
