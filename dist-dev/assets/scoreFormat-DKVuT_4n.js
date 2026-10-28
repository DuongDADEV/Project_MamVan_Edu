//#region src/utils/scoreFormat.ts
/**
* Định dạng điểm số để hiển thị: làm tròn 1 chữ số thập phân, bỏ ".0" thừa.
* Tránh lỗi số thực kiểu 7.200000000000001 khi cộng điểm tiêu chí.
*/
function formatScore(n) {
	if (n === null || n === void 0 || Number.isNaN(n)) return "—";
	const r = Math.round(n * 10) / 10;
	return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
//#endregion
export { formatScore as t };
