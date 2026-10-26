/**
 * Định dạng điểm số để hiển thị: làm tròn 1 chữ số thập phân, bỏ ".0" thừa.
 * Tránh lỗi số thực kiểu 7.200000000000001 khi cộng điểm tiêu chí.
 */
export function formatScore(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
