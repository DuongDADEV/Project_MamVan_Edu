import { t as Award } from "./award-DtoLRYRA.js";
import { Ft as CircleCheck, J as require_jsx_dev_runtime, Mt as CircleX, Ot as FileCheck, S as essayRepository, U as calculateAllMastery, Wt as createLucideIcon, X as Zap, Z as X, c as getGradedReviews, d as getStudentAssignments, it as TrendingUp, l as getPendingReviews, pn as __toESM, s as getAttemptsWithAnswers, un as require_react, xt as Lock, yt as MessageSquareText } from "./index-CQnUoV8k.js";
import { t as formatScore } from "./scoreFormat-DKVuT_4n.js";
import { t as BADGES_CATALOG } from "./badges-CehLVedp.js";
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Trophy = createLucideIcon("trophy", [
	["path", {
		d: "M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978",
		key: "1n3hpd"
	}],
	["path", {
		d: "M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978",
		key: "rfe1zi"
	}],
	["path", {
		d: "M18 9h1.5a1 1 0 0 0 0-5H18",
		key: "7xy6bh"
	}],
	["path", {
		d: "M4 22h16",
		key: "57wxv0"
	}],
	["path", {
		d: "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",
		key: "1mhfuq"
	}],
	["path", {
		d: "M6 9H4.5a1 1 0 0 1 0-5H6",
		key: "tex48p"
	}]
]);
//#endregion
//#region src/screens/LearningResultsScreen.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/home/hatch/workspace/Project_MamVan_Edu/src/screens/LearningResultsScreen.tsx";
var ONE_WEEK = 6048e5;
var STATUS_META = {
	SOLID: {
		label: "Đã hoàn thành",
		chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
		bar: "#16A34A"
	},
	PROGRESSING: {
		label: "Đang học",
		chip: "bg-sky-50 text-sky-700 border-sky-200",
		bar: "#38BDF8"
	},
	NEEDS_REVIEW: {
		label: "Cần ôn lại",
		chip: "bg-amber-50 text-amber-700 border-amber-200",
		bar: "#FBBF24"
	},
	INSUFFICIENT_DATA: {
		label: "Chưa học",
		chip: "bg-slate-100 text-slate-500 border-slate-200",
		bar: "#CBD5E1"
	}
};
var MCQ_TYPES = /* @__PURE__ */ new Set([
	"single",
	"multi",
	"fill"
]);
var ESSAY_PASS_SCORE = 5;
var BATCH_GAP_MS = 2e3;
function groupIntoBatches(results) {
	const sorted = [...results].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
	const batches = [];
	for (const r of sorted) {
		const last = batches[batches.length - 1];
		if (last && (r.timestamp || 0) - (last.results[last.results.length - 1].timestamp || 0) <= BATCH_GAP_MS) {
			last.results.push(r);
			last.end = r.timestamp || 0;
		} else batches.push({
			start: r.timestamp || 0,
			end: r.timestamp || 0,
			results: [r]
		});
	}
	return batches.reverse();
}
function fmtDateTime(ms) {
	const d = new Date(ms);
	return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function isUuidLike(value) {
	return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
/**
* Màn "Kết quả học tập" của học sinh (đợt sửa 24/10):
* - BỎ hiển thị 4 mức nhớ/hiểu/phân tích/vận dụng ở phía học sinh (4 mức vẫn
*   giữ nguyên phía giáo viên + AI; hàm calculateAllMastery KHÔNG bị sửa, chỉ
*   còn dùng để tính chip trạng thái tổng quát của chủ đề).
* - Điểm theo từng chủ đề = trắc nghiệm (đúng/tổng câu, điểm TB) + tự luận
*   (thang 10, đạt/chưa đạt, đã chấm/chưa chấm) + lịch sử lần làm + popup chi
*   tiết toàn bộ bài đã làm (trắc nghiệm → tự luận) kèm nhận xét của cô.
* - Điểm theo từng bài kiểm tra = bài tập BI cô giao (điểm attempts, trạng thái
*   chấm) + popup chi tiết (đáp án + nhận xét). Bài kiểm tra nội dung xem lại
*   qua màn Bài tập (QuizReviewScreen).
*/
var LearningResultsScreen = ({ state, topics, onSelectTopic, questions = {}, studentId }) => {
	const results = state.questionResults || [];
	const [essays, setEssays] = (0, import_react.useState)(state.essaySubmissions || []);
	(0, import_react.useEffect)(() => {
		setEssays(state.essaySubmissions || []);
		if (!studentId || !isUuidLike(studentId)) return;
		let cancelled = false;
		essayRepository.getSubmissions({ studentId }).then((rows) => {
			if (cancelled) return;
			setEssays((prev) => {
				const byId = /* @__PURE__ */ new Map();
				for (const e of prev) byId.set(e.id, e);
				for (const r of rows || []) {
					const old = byId.get(r.id);
					byId.set(r.id, old ? {
						...old,
						status: r.status,
						totalScore: r.totalScore,
						teacherFeedback: r.teacherFeedback,
						gradedAt: r.gradedAt
					} : r);
				}
				return [...byId.values()];
			});
		}).catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [studentId, state.essaySubmissions]);
	(0, import_react.useMemo)(() => {
		const total = results.length;
		const correct = results.filter((r) => r.isCorrect).length;
		const avgScore = total > 0 ? Math.round(results.reduce((acc, r) => acc + r.scoreRatio, 0) / total * 100) / 10 : 0;
		return {
			total,
			correctRate: total > 0 ? Math.round(correct / total * 100) : 0,
			avgScore
		};
	}, [results]);
	const topicRows = (0, import_react.useMemo)(() => topics.map((t) => {
		const topicResults = results.filter((r) => r.topicId === t.id);
		const mcq = topicResults.filter((r) => {
			const q = questions[r.questionId];
			return !q || MCQ_TYPES.has(q.type);
		});
		const mcqCorrect = mcq.filter((r) => r.isCorrect).length;
		const mcqAvg = mcq.length > 0 ? Math.round(mcq.reduce((acc, r) => acc + r.scoreRatio, 0) / mcq.length * 100) / 10 : null;
		const topicQuestionIds = new Set(Object.values(questions).filter((q) => q.topicId === t.id).map((q) => q.id));
		const topicEssays = essays.filter((e) => topicQuestionIds.has(e.questionId));
		const graded = topicEssays.filter((e) => e.status === "GRADED" && e.totalScore != null);
		const pending = topicEssays.filter((e) => e.status !== "GRADED");
		const essayAvg = graded.length > 0 ? Math.round(graded.reduce((acc, e) => acc + (e.totalScore || 0), 0) / graded.length * 10) / 10 : null;
		const essayPassed = graded.filter((e) => (e.totalScore || 0) >= ESSAY_PASS_SCORE).length;
		const batches = groupIntoBatches(topicResults);
		const mastery = calculateAllMastery(results, t.id);
		const avg = Math.round((mastery.NHAN_BIET.percentage + mastery.THONG_HIEU.percentage + mastery.PHAN_TICH.percentage + mastery.VAN_DUNG.percentage) / 4);
		let status = "INSUFFICIENT_DATA";
		if (mastery.NHAN_BIET.totalQuestionsAttempted >= 3) {
			if (avg >= 80) status = "SOLID";
			else if (avg >= 50) status = "PROGRESSING";
			else status = "NEEDS_REVIEW";
		}
		return {
			topic: t,
			mcq,
			mcqCorrect,
			mcqAvg,
			topicEssays,
			graded,
			pending,
			essayAvg,
			essayPassed,
			batches,
			attempts: topicResults.length,
			status
		};
	}), [
		topics,
		results,
		questions,
		essays
	]);
	const weeklyData = (0, import_react.useMemo)(() => {
		const now = Date.now();
		const weeks = [];
		for (let w = 5; w >= 0; w--) {
			const start = now - (w + 1) * ONE_WEEK;
			const end = now - w * ONE_WEEK;
			const inWeek = results.filter((r) => r.timestamp >= start && r.timestamp < end);
			const avg = inWeek.length > 0 ? Math.round(inWeek.reduce((acc, r) => acc + r.scoreRatio, 0) / inWeek.length * 100) / 10 : null;
			weeks.push({
				weekLabel: w === 0 ? "Tuần này" : w === 1 ? "Tuần trước" : `${w} tuần trước`,
				diemTB: avg,
				soCau: inWeek.length
			});
		}
		return weeks;
	}, [results]);
	const hasWeeklyData = weeklyData.some((w) => w.soCau > 0);
	const unlockedCount = (state.unlockedBadgeIds || []).length;
	const [biAssignments, setBiAssignments] = (0, import_react.useState)([]);
	const [biLoaded, setBiLoaded] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!studentId) {
			setBiLoaded(true);
			return;
		}
		let cancelled = false;
		setBiLoaded(false);
		getStudentAssignments(studentId).then((rows) => {
			if (!cancelled) {
				setBiAssignments(rows || []);
				setBiLoaded(true);
			}
		}).catch(() => {
			if (!cancelled) {
				setBiAssignments([]);
				setBiLoaded(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [studentId]);
	const [detailTopicId, setDetailTopicId] = (0, import_react.useState)(null);
	const [detailTestId, setDetailTestId] = (0, import_react.useState)(null);
	const [testAttempts, setTestAttempts] = (0, import_react.useState)([]);
	const [testReviews, setTestReviews] = (0, import_react.useState)([]);
	const [testDetailLoading, setTestDetailLoading] = (0, import_react.useState)(false);
	const detailTopic = topicRows.find((r) => r.topic.id === detailTopicId) || null;
	const detailTest = biAssignments.find((a) => a.assignmentId === detailTestId) || null;
	(0, import_react.useEffect)(() => {
		if (!detailTest || !studentId) {
			setTestAttempts([]);
			setTestReviews([]);
			return;
		}
		let cancelled = false;
		setTestDetailLoading(true);
		Promise.all([
			getAttemptsWithAnswers([studentId]),
			getPendingReviews([studentId]),
			getGradedReviews([studentId])
		]).then(([atts, pending, graded]) => {
			if (cancelled) return;
			const mine = (atts || []).filter((a) => a.sourceType === "assignment" && a.sourceTitle === detailTest.title).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
			setTestAttempts(mine);
			const attIds = new Set(mine.map((a) => a.id));
			setTestReviews([...pending || [], ...graded || []].filter((r) => attIds.has(r.attemptId)));
			setTestDetailLoading(false);
		}).catch(() => {
			if (!cancelled) {
				setTestAttempts([]);
				setTestReviews([]);
				setTestDetailLoading(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [detailTest, studentId]);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
				className: "font-lora font-bold text-2xl text-[#1E1B4B] flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(TrendingUp, { className: "w-6 h-6 text-[#E2704A]" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 320,
					columnNumber: 11
				}, void 0), "Kết quả học tập"]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 319,
				columnNumber: 9
			}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "text-sm text-slate-500 mt-1",
				children: "Hành trình tiến bộ của em qua từng chủ đề — học đều mỗi ngày để cây tri thức lớn nhanh nhé!"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 323,
				columnNumber: 9
			}, void 0)] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 318,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "bg-white rounded-2xl border border-[#E8DFD1] p-4 shadow-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Zap, { className: "w-3.5 h-3.5 text-amber-500" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 332,
								columnNumber: 13
							}, void 0), " Tổng XP tích lũy"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 331,
							columnNumber: 11
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "text-2xl font-black text-[#1E1B4B]",
							children: [
								state.totalXp,
								" ",
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-xs font-bold text-slate-400",
									children: "XP"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 335,
									columnNumber: 29
								}, void 0)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 334,
							columnNumber: 11
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "text-[11px] text-slate-400 mt-0.5",
							children: [
								"Hôm nay +",
								state.xpToday,
								" XP"
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 337,
							columnNumber: 11
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 330,
					columnNumber: 9
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "bg-white rounded-2xl border border-[#E8DFD1] p-4 shadow-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Trophy, { className: "w-3.5 h-3.5 text-purple-500" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 341,
								columnNumber: 13
							}, void 0), " Huy hiệu đạt được"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 340,
							columnNumber: 11
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "text-2xl font-black text-[#1E1B4B]",
							children: [unlockedCount, /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-xs font-bold text-slate-400",
								children: [" /", BADGES_CATALOG.length]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 345,
								columnNumber: 13
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 343,
							columnNumber: 11
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "text-[11px] text-slate-400 mt-0.5",
							children: [
								"Điểm danh tuần này ",
								state.attendanceDaysThisWeek,
								" ngày"
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 347,
							columnNumber: 11
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 339,
					columnNumber: 9
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 329,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5 space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
					className: "font-lora font-bold text-base text-[#1E1B4B]",
					children: "Điểm theo từng chủ đề"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 355,
					columnNumber: 9
				}, void 0), topicRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-sm text-slate-400 text-center py-4",
					children: "Chưa có chủ đề nào được công bố. Khi thầy cô mở bài mới, kết quả của em sẽ hiện ở đây."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 357,
					columnNumber: 11
				}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "space-y-4",
					children: topicRows.map((row) => {
						const meta = STATUS_META[row.status];
						const lastBatch = row.batches[0];
						return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "border rounded-2xl p-4",
							style: {
								backgroundColor: `${row.topic.colorScheme || "#2F3E6B"}26`,
								borderColor: `${row.topic.colorScheme || "#2F3E6B"}80`
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex flex-wrap items-center justify-between gap-2 mb-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
										type: "button",
										onClick: () => onSelectTopic && onSelectTopic(row.topic.id),
										className: "font-bold text-sm text-[#1E1B4B] hover:text-[#E2704A] transition-colors text-left",
										title: "Tới bài học của chủ đề này",
										children: row.topic.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 375,
										columnNumber: 21
									}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: `text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.chip}`,
										children: meta.label
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 383,
										columnNumber: 21
									}, void 0)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 374,
									columnNumber: 19
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "space-y-1.5 text-sm text-[#1E1B4B]",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "font-bold",
											children: "Trắc nghiệm: "
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 391,
											columnNumber: 23
										}, void 0), row.mcq.length > 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
											"đúng ",
											row.mcqCorrect,
											"/",
											row.mcq.length,
											" câu",
											row.mcqAvg !== null && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "text-slate-500",
												children: [
													" • Điểm TB ",
													row.mcqAvg,
													"/10"
												]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 396,
												columnNumber: 29
											}, void 0)
										] }, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 393,
											columnNumber: 25
										}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "text-slate-400 italic",
											children: "chưa làm câu trắc nghiệm nào"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 400,
											columnNumber: 25
										}, void 0)] }, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 390,
											columnNumber: 21
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "font-bold",
											children: "Tự luận: "
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 404,
											columnNumber: 23
										}, void 0), row.topicEssays.length > 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
											row.graded.length,
											" đã chấm",
											row.essayAvg !== null && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "text-slate-500",
												children: [
													" (ĐTB ",
													row.essayAvg,
													"/10)"
												]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 409,
												columnNumber: 29
											}, void 0),
											` • ${row.essayPassed} đạt • ${row.pending.length} chưa chấm`
										] }, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 406,
											columnNumber: 25
										}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "text-slate-400 italic",
											children: "chưa nộp bài tự luận nào"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 414,
											columnNumber: 25
										}, void 0)] }, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 403,
											columnNumber: 21
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-xs text-slate-500",
											children: [
												"Lịch sử: ",
												row.batches.length,
												" lần làm",
												lastBatch ? ` • Gần nhất ${fmtDateTime(lastBatch.start)}` : "",
												` • Tổng ${row.attempts} câu đã làm`
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 417,
											columnNumber: 21
										}, void 0)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 389,
									columnNumber: 19
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "mt-3",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
										type: "button",
										onClick: () => setDetailTopicId(row.topic.id),
										className: "px-4 py-2 rounded-full bg-[#2F3E6B] text-white text-xs font-bold hover:opacity-90 active:scale-95 transition",
										children: "Xem chi tiết"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 424,
										columnNumber: 21
									}, void 0)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 423,
									columnNumber: 19
								}, void 0)
							]
						}, row.topic.id, true, {
							fileName: _jsxFileName,
							lineNumber: 366,
							columnNumber: 17
						}, void 0);
					})
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 361,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 354,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5 space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
					className: "font-lora font-bold text-base text-[#1E1B4B] flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(FileCheck, { className: "w-5 h-5 text-[#E2704A]" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 442,
						columnNumber: 11
					}, void 0), " Điểm theo từng bài kiểm tra"]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 441,
					columnNumber: 9
				}, void 0), !biLoaded ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-sm text-slate-400 italic",
					children: "Đang tải bài kiểm tra cô giao…"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 445,
					columnNumber: 11
				}, void 0) : biAssignments.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-sm text-slate-400 text-center py-4",
					children: "Chưa có bài kiểm tra nào cô giao. Bài kiểm tra nội dung em xem lại ở mục Bài tập."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 447,
					columnNumber: 11
				}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "space-y-3",
					children: biAssignments.map((a) => {
						const attempts = a.attempts || [];
						const scored = attempts.filter((x) => x.score_awarded != null && x.max_score != null);
						const best = scored.length ? scored.reduce((acc, cur) => Number(cur.score_awarded) / Number(cur.max_score) > Number(acc.score_awarded) / Number(acc.max_score) ? cur : acc) : null;
						const latest = attempts[0];
						return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "border border-[#E6DCC8] rounded-2xl p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex flex-wrap items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "font-bold text-sm text-[#1E1B4B]",
										children: a.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 467,
										columnNumber: 21
									}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-xs font-bold text-slate-500",
										children: attempts.length > 0 ? `${attempts.length} lần nộp` : "Chưa nộp"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 468,
										columnNumber: 21
									}, void 0)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 466,
									columnNumber: 19
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-sm text-[#1E1B4B] mt-1",
									children: best ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [
										"Điểm cao nhất: ",
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "font-bold text-[#2F6B4F]",
											children: [
												best.score_awarded,
												"/",
												best.max_score
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 475,
											columnNumber: 40
										}, void 0),
										latest?.grading_status && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "text-slate-500",
											children: [" • Trạng thái chấm: ", latest.grading_status]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 477,
											columnNumber: 27
										}, void 0)
									] }, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 474,
										columnNumber: 23
									}, void 0) : attempts.length > 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-amber-600 font-bold",
										children: "Đã nộp — cô giáo chưa chấm"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 481,
										columnNumber: 23
									}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-slate-400 italic",
										children: "Chưa nộp bài"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 483,
										columnNumber: 23
									}, void 0)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 472,
									columnNumber: 19
								}, void 0),
								attempts.length > 0 && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
									type: "button",
									onClick: () => setDetailTestId(a.assignmentId),
									className: "mt-2 px-4 py-2 rounded-full bg-[#2F3E6B] text-white text-xs font-bold hover:opacity-90 active:scale-95 transition",
									children: "Xem chi tiết"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 487,
									columnNumber: 21
								}, void 0)
							]
						}, a.assignmentId, true, {
							fileName: _jsxFileName,
							lineNumber: 465,
							columnNumber: 17
						}, void 0);
					})
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 451,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 440,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-start justify-between gap-3 mb-5",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
						className: "font-lora font-bold text-base text-[#1E1B4B]",
						children: "Biểu đồ tiến bộ (6 tuần gần nhất)"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 506,
						columnNumber: 11
					}, void 0), hasWeeklyData && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "text-right shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-[11px] font-semibold text-slate-400",
							children: [
								"Tổng ",
								weeklyData.reduce((acc, w) => acc + w.soCau, 0),
								" câu · Tuần này:",
								" ",
								weeklyData[5].soCau,
								" câu",
								weeklyData[5].diemTB !== null && ` · ĐTB ${formatScore(weeklyData[5].diemTB)}`
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 511,
							columnNumber: 15
						}, void 0)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 510,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 505,
					columnNumber: 9
				}, void 0), hasWeeklyData ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "relative px-1 pt-1 pb-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "absolute left-[8%] right-[8%] top-[27px] h-1.5 rounded-full bg-slate-100" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 522,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "absolute left-[8%] top-[27px] h-1.5 rounded-full bg-gradient-to-r from-indigo-200 via-indigo-300 to-[#E2704A]",
							style: { width: "84%" }
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 523,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "relative flex items-start",
							children: weeklyData.map((w, i) => {
								const isCurrent = i === weeklyData.length - 1;
								const hasData = w.soCau > 0 && w.diemTB !== null;
								return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex-1 flex flex-col items-center text-center min-w-0",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
											className: `rounded-full flex items-center justify-center font-extrabold border-4 border-white shadow-sm ${isCurrent ? "w-14 h-14 text-sm text-white bg-gradient-to-br from-[#E2704A] to-[#F59E0B] ring-4 ring-orange-100" : hasData ? "w-11 h-11 mt-[5px] text-xs text-white bg-gradient-to-br from-[#4F46E5] to-[#7C3AED]" : "w-11 h-11 mt-[5px] text-xs text-slate-300 bg-slate-100"}`,
											title: hasData ? `ĐTB ${formatScore(w.diemTB)} — ${w.soCau} câu` : "Chưa làm bài",
											children: hasData ? formatScore(w.diemTB) : "—"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 533,
											columnNumber: 21
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: `mt-2 text-[11px] leading-tight ${isCurrent ? "font-extrabold text-[#1E1B4B]" : "font-semibold text-slate-500"}`,
											children: w.weekLabel
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 545,
											columnNumber: 21
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-[10px] text-slate-400 leading-tight",
											children: w.soCau > 0 ? `${w.soCau} câu` : "Chưa học"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 552,
											columnNumber: 21
										}, void 0)
									]
								}, i, true, {
									fileName: _jsxFileName,
									lineNumber: 532,
									columnNumber: 19
								}, void 0);
							})
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 527,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "mt-4 text-[11px] text-slate-400 text-center",
							children: "Số trong mỗi mốc là điểm trung bình của tuần đó (thang 10)."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 559,
							columnNumber: 13
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 520,
					columnNumber: 11
				}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-sm text-slate-400 text-center py-8",
					children: "Em chưa làm bài trong 6 tuần gần đây. Làm vài câu hỏi hôm nay để biểu đồ tiến bộ bắt đầu nhích lên nhé!"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 564,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 504,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "bg-white rounded-2xl border border-[#E8DFD1] shadow-xs p-5",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
					className: "font-lora font-bold text-base text-[#1E1B4B] mb-3 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Award, { className: "w-5 h-5 text-purple-500" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 574,
						columnNumber: 11
					}, void 0), " Thành tích & Huy hiệu"]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 573,
					columnNumber: 9
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3",
					children: BADGES_CATALOG.map((badge) => {
						const unlocked = (state.unlockedBadgeIds || []).includes(badge.id);
						return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: `p-3.5 rounded-2xl border flex gap-3 ${unlocked ? "bg-purple-50/60 border-purple-200" : "bg-slate-50 border-slate-200 opacity-70"}`,
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: `w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${unlocked ? "bg-purple-100 text-purple-600" : "bg-slate-200 text-slate-400"}`,
								children: unlocked ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Award, { className: "w-5 h-5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 593,
									columnNumber: 31
								}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Lock, { className: "w-4.5 h-4.5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 593,
									columnNumber: 63
								}, void 0)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 588,
								columnNumber: 17
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: `text-xs font-bold ${unlocked ? "text-purple-900" : "text-slate-500"}`,
										children: badge.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 596,
										columnNumber: 19
									}, void 0),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-[11px] text-slate-500 leading-snug mt-0.5",
										children: badge.desc
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 599,
										columnNumber: 19
									}, void 0),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: `inline-block mt-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${unlocked ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-500"}`,
										children: unlocked ? "Đã đạt ✓" : "Chưa đạt"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 600,
										columnNumber: 19
									}, void 0)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 595,
								columnNumber: 17
							}, void 0)]
						}, badge.id, true, {
							fileName: _jsxFileName,
							lineNumber: 580,
							columnNumber: 15
						}, void 0);
					})
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 576,
					columnNumber: 9
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 572,
				columnNumber: 7
			}, void 0),
			detailTopic && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4",
				onClick: () => setDetailTopicId(null),
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4",
					onClick: (e) => e.stopPropagation(),
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
							className: "font-bold text-lg text-[#1E1B4B]",
							children: detailTopic.topic.title
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 624,
							columnNumber: 17
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-xs text-slate-500 mt-0.5",
							children: [
								"Trắc nghiệm đúng ",
								detailTopic.mcqCorrect,
								"/",
								detailTopic.mcq.length,
								" câu",
								detailTopic.mcqAvg !== null && ` • ĐTB ${detailTopic.mcqAvg}/10`,
								" • Tự luận",
								" ",
								detailTopic.topicEssays.length,
								" bài (",
								detailTopic.graded.length,
								" đã chấm,",
								" ",
								detailTopic.pending.length,
								" chưa chấm)"
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 625,
							columnNumber: 17
						}, void 0)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 623,
							columnNumber: 15
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							type: "button",
							onClick: () => setDetailTopicId(null),
							className: "p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 shrink-0",
							"aria-label": "Đóng",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(X, { className: "w-4 h-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 638,
								columnNumber: 17
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 632,
							columnNumber: 15
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 622,
						columnNumber: 13
					}, void 0), detailTopic.batches.length === 0 && detailTopic.topicEssays.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-sm text-slate-400 italic",
						children: "Em chưa làm bài nào ở chủ đề này."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 643,
						columnNumber: 15
					}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [detailTopic.batches.map((batch, bi) => {
						const batchMcq = batch.results.filter((r) => {
							const q = questions[r.questionId];
							return !q || MCQ_TYPES.has(q.type);
						});
						const batchMcqCorrect = batchMcq.filter((r) => r.isCorrect).length;
						const batchEssays = detailTopic.topicEssays.filter((e) => e.submittedAt >= batch.start - BATCH_GAP_MS && e.submittedAt <= batch.end + BATCH_GAP_MS);
						return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "border border-[#E6DCC8] rounded-2xl p-4 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "font-bold text-sm text-[#2F3E6B]",
									children: [
										"Lần làm ",
										detailTopic.batches.length - bi,
										" • ",
										fmtDateTime(batch.start),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "font-normal text-slate-500",
											children: [
												" ",
												"• Trắc nghiệm đúng ",
												batchMcqCorrect,
												"/",
												batchMcq.length,
												" câu"
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 659,
											columnNumber: 25
										}, void 0)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 657,
									columnNumber: 23
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "space-y-2",
									children: batch.results.filter((r) => {
										const q = questions[r.questionId];
										return !q || MCQ_TYPES.has(q.type);
									}).map((r) => {
										const q = questions[r.questionId];
										return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
											className: "flex items-start gap-2 text-sm",
											children: [r.isCorrect ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "w-4 h-4 text-[#2F6B4F] shrink-0 mt-0.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 676,
												columnNumber: 35
											}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleX, { className: "w-4 h-4 text-red-500 shrink-0 mt-0.5" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 678,
												columnNumber: 35
											}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "text-[#1E1B4B]",
												children: [q?.prompt || "Câu hỏi (đã gỡ khỏi ngân hàng)", /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
													className: "text-slate-500",
													children: [
														" ",
														"• ",
														r.isCorrect ? "Đúng" : "Sai",
														" • Điểm ",
														Math.round(r.scoreRatio * 100),
														"%"
													]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 682,
													columnNumber: 35
												}, void 0)]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 680,
												columnNumber: 33
											}, void 0)]
										}, r.questionId, true, {
											fileName: _jsxFileName,
											lineNumber: 674,
											columnNumber: 31
										}, void 0);
									})
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 665,
									columnNumber: 23
								}, void 0),
								batchEssays.map((e) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl p-3 space-y-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-xs font-bold text-slate-500",
											children: ["Tự luận • ", questions[e.questionId]?.prompt || e.promptTitle || "Bài viết tự luận"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 694,
											columnNumber: 27
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-sm text-[#1E1B4B] line-clamp-6",
											children: e.content
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 697,
											columnNumber: 27
										}, void 0),
										e.status === "GRADED" && e.totalScore != null ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-sm font-bold text-[#2F6B4F]",
											children: [
												"Đã chấm: ",
												e.totalScore,
												"/10"
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 699,
											columnNumber: 29
										}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-sm font-bold text-amber-600",
											children: "Cô giáo chưa chấm"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 701,
											columnNumber: 29
										}, void 0),
										e.teacherFeedback && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-sm text-[#1E1B4B] bg-white border border-[#2F6B4F]/20 rounded-xl p-3 flex gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageSquareText, { className: "w-4 h-4 shrink-0 mt-0.5 text-[#2F6B4F]" }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 705,
												columnNumber: 31
											}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "font-bold",
												children: "Nhận xét của cô: "
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 707,
												columnNumber: 33
											}, void 0), e.teacherFeedback] }, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 706,
												columnNumber: 31
											}, void 0)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 704,
											columnNumber: 29
										}, void 0)
									]
								}, e.id, true, {
									fileName: _jsxFileName,
									lineNumber: 693,
									columnNumber: 25
								}, void 0)),
								batchEssays.length === 0 && batch.results.some((r) => questions[r.questionId]?.type === "essay") && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-xs text-slate-400 italic",
									children: "Bài tự luận của lần này không còn gắn được với lần làm (đã nộp từ thiết bị khác)."
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 716,
									columnNumber: 27
								}, void 0)
							]
						}, bi, true, {
							fileName: _jsxFileName,
							lineNumber: 656,
							columnNumber: 21
						}, void 0);
					}), detailTopic.topicEssays.filter((e) => !detailTopic.batches.some((b) => e.submittedAt >= b.start - BATCH_GAP_MS && e.submittedAt <= b.end + BATCH_GAP_MS)).map((e) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "bg-[#FAF5EB] border border-[#E6DCC8] rounded-xl p-3 space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-xs font-bold text-slate-500",
								children: ["Tự luận (không gắn lần làm) • ", questions[e.questionId]?.prompt || e.promptTitle || "Bài viết tự luận"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 731,
								columnNumber: 21
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm text-[#1E1B4B] line-clamp-6",
								children: e.content
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 734,
								columnNumber: 21
							}, void 0),
							e.status === "GRADED" && e.totalScore != null ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-bold text-[#2F6B4F]",
								children: [
									"Đã chấm: ",
									e.totalScore,
									"/10"
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 736,
								columnNumber: 23
							}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-bold text-amber-600",
								children: "Cô giáo chưa chấm"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 738,
								columnNumber: 23
							}, void 0),
							e.teacherFeedback && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm text-[#1E1B4B] bg-white border border-[#2F6B4F]/20 rounded-xl p-3 flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageSquareText, { className: "w-4 h-4 shrink-0 mt-0.5 text-[#2F6B4F]" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 742,
									columnNumber: 25
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "font-bold",
									children: "Nhận xét của cô: "
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 744,
									columnNumber: 27
								}, void 0), e.teacherFeedback] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 743,
									columnNumber: 25
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 741,
								columnNumber: 23
							}, void 0)
						]
					}, e.id, true, {
						fileName: _jsxFileName,
						lineNumber: 730,
						columnNumber: 19
					}, void 0))] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 645,
						columnNumber: 15
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 618,
					columnNumber: 11
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 617,
				columnNumber: 9
			}, void 0),
			detailTest && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4",
				onClick: () => setDetailTestId(null),
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4",
					onClick: (e) => e.stopPropagation(),
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
							className: "font-bold text-lg text-[#1E1B4B]",
							children: detailTest.title
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 766,
							columnNumber: 17
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-xs text-slate-500 mt-0.5",
							children: [(detailTest.attempts || []).length, " lần nộp"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 767,
							columnNumber: 17
						}, void 0)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 765,
							columnNumber: 15
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							type: "button",
							onClick: () => setDetailTestId(null),
							className: "p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 shrink-0",
							"aria-label": "Đóng",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(X, { className: "w-4 h-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 777,
								columnNumber: 17
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 771,
							columnNumber: 15
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 764,
						columnNumber: 13
					}, void 0), testDetailLoading ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-sm text-slate-400 italic",
						children: "Đang tải bài làm…"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 782,
						columnNumber: 15
					}, void 0) : testAttempts.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-sm text-slate-400 italic",
						children: "Chưa tải được chi tiết lần làm (bài có thể nộp từ trước khi hệ thống ghi attempts)."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 784,
						columnNumber: 15
					}, void 0) : testAttempts.map((att) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "border border-[#E6DCC8] rounded-2xl p-4 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "font-bold text-sm text-[#2F3E6B]",
								children: [
									"Lần ",
									att.attemptNo ?? "—",
									att.submittedAt && ` • ${fmtDateTime(new Date(att.submittedAt).getTime())}`,
									att.score != null && att.maxScore != null && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-[#2F6B4F]",
										children: [
											" • Điểm ",
											att.score,
											"/",
											att.maxScore
										]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 794,
										columnNumber: 23
									}, void 0),
									att.gradingStatus && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "font-normal text-slate-500",
										children: [" • ", att.gradingStatus]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 797,
										columnNumber: 23
									}, void 0)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 790,
								columnNumber: 19
							}, void 0),
							(att.answers || []).map((ans) => {
								const review = testReviews.find((r) => r.answerId === ans.id);
								return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "space-y-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-sm text-[#1E1B4B]",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "font-bold",
											children: ans.prompt
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 805,
											columnNumber: 27
										}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "text-slate-500",
											children: [
												" ",
												"• Trả lời: ",
												ans.responseText || "(trống)",
												ans.isCorrect === true && " • Đúng",
												ans.isCorrect === false && " • Sai",
												ans.score != null && ans.maxScore != null && ` • ${ans.score}/${ans.maxScore}`,
												ans.gradingStatus === "PENDING" && " • Cô giáo chưa chấm"
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 806,
											columnNumber: 27
										}, void 0)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 804,
										columnNumber: 25
									}, void 0), review?.feedback && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-sm text-[#1E1B4B] bg-[#FAF5EB] border border-[#2F6B4F]/20 rounded-xl p-3 flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MessageSquareText, { className: "w-4 h-4 shrink-0 mt-0.5 text-[#2F6B4F]" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 817,
											columnNumber: 29
										}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [
											/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "font-bold",
												children: "Nhận xét của cô: "
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 819,
												columnNumber: 31
											}, void 0),
											review.feedback,
											review.scoreAwarded != null && ` (Điểm câu: ${review.scoreAwarded})`
										] }, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 818,
											columnNumber: 29
										}, void 0)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 816,
										columnNumber: 27
									}, void 0)]
								}, ans.id, true, {
									fileName: _jsxFileName,
									lineNumber: 803,
									columnNumber: 23
								}, void 0);
							}),
							(att.answers || []).length === 0 && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-xs text-slate-400 italic",
								children: "Lần này không còn đáp án chi tiết."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 829,
								columnNumber: 21
							}, void 0)
						]
					}, att.id, true, {
						fileName: _jsxFileName,
						lineNumber: 789,
						columnNumber: 17
					}, void 0))]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 760,
					columnNumber: 11
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 759,
				columnNumber: 9
			}, void 0)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 316,
		columnNumber: 5
	}, void 0);
};
//#endregion
export { LearningResultsScreen };
