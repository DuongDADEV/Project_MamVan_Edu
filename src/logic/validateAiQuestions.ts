// Kiểm chứng câu hỏi do AI sinh ra trước khi đưa vào bản nháp.
//
// Bối cảnh (28/10): AI có lúc trả về ít câu hơn số đã chọn, hoặc trả về câu
// thiếu trường (không có đề bài, không có loại/mức/độ khó). Trước đây không có
// lớp kiểm chứng nào: màn duyệt dùng nhãn dự phòng ("Tự luận"/"Vận dụng"/
// "Khó") nên câu thiếu trường vẫn hiện ra như câu lành, rồi lúc lưu máy chủ
// đắp mặc định (trắc nghiệm 1 đáp án / Nhận biết / Dễ / "Câu hỏi chưa có
// tiêu đề") — thành 2 câu hỏng trong ngân hàng thật. Từ nay câu không đủ
// trường bị loại NGAY tại đây, và phía gọi phải báo rõ số thiếu thay vì
// lặng lẽ trình 2 câu như thể đủ 5.

import type { Question } from '../types.ts';

const VALID_TYPES = ['single', 'multi', 'fill', 'essay'] as const;
const VALID_LEVELS = ['NHAN_BIET', 'THONG_HIEU', 'PHAN_TICH', 'VAN_DUNG'] as const;
const VALID_DIFFICULTIES = ['DE', 'TB', 'KHO'] as const;

type RawQuestion = Partial<Question> & Record<string, any>;

function hasAnswer(q: RawQuestion): boolean {
  if (q.type === 'single') {
    return typeof q.answer === 'string' && q.answer.trim().length > 0;
  }
  if (q.type === 'multi') {
    return Array.isArray(q.answer) && q.answer.length > 0;
  }
  if (q.type === 'fill') {
    if (Array.isArray(q.answer)) return q.answer.some((a) => String(a ?? '').trim().length > 0);
    return typeof q.answer === 'string' && q.answer.trim().length > 0;
  }
  // essay: chấm bằng rubric của giáo viên nên không đòi đáp án sẵn.
  return true;
}

/** Câu AI sinh ra chỉ được vào nháp khi đủ: đề bài, loại, mức, độ khó, đáp án (trừ tự luận). */
export function isValidGeneratedQuestion(q: RawQuestion | null | undefined): q is Question {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.prompt !== 'string' || q.prompt.trim().length === 0) return false;
  if (typeof q.type !== 'string' || !(VALID_TYPES as readonly string[]).includes(q.type)) return false;
  if (typeof q.level !== 'string' || !(VALID_LEVELS as readonly string[]).includes(q.level)) return false;
  if (typeof q.difficulty !== 'string' || !(VALID_DIFFICULTIES as readonly string[]).includes(q.difficulty)) return false;
  if ((q.type === 'single' || q.type === 'multi') && (!Array.isArray(q.options) || q.options.length < 2)) {
    return false;
  }
  return hasAnswer(q);
}

/** Lọc giữ câu hợp lệ, giữ nguyên thứ tự. */
export function filterValidQuestions(questions: RawQuestion[] | null | undefined): Question[] {
  if (!Array.isArray(questions)) return [];
  return questions.filter(isValidGeneratedQuestion);
}

export type TypeCounts = { single: number; multi: number; fill: number; essay: number };

/** Tính số câu còn thiếu theo từng loại (phục vụ lần gọi bù đúng loại). */
export function missingTypeCounts(
  requested: TypeCounts,
  got: Question[]
): { counts: TypeCounts; total: number } {
  const have: TypeCounts = { single: 0, multi: 0, fill: 0, essay: 0 };
  for (const q of got) {
    if (q.type === 'single') have.single += 1;
    else if (q.type === 'multi') have.multi += 1;
    else if (q.type === 'fill') have.fill += 1;
    else if (q.type === 'essay') have.essay += 1;
  }
  const counts: TypeCounts = {
    single: Math.max(0, requested.single - have.single),
    multi: Math.max(0, requested.multi - have.multi),
    fill: Math.max(0, requested.fill - have.fill),
    essay: Math.max(0, requested.essay - have.essay),
  };
  return { counts, total: counts.single + counts.multi + counts.fill + counts.essay };
}
