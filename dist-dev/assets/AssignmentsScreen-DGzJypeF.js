import { t as ChevronRight } from "./chevron-right-BS4SWgtJ.js";
import { At as Clock, Ct as House, Ft as CircleCheck, J as require_jsx_dev_runtime, Ot as FileCheck, Wt as createLucideIcon, cn as TEST_QUIZ_KINDS, d as getStudentAssignments, jt as ClipboardList, kt as Eye, pn as __toESM, un as require_react } from "./index-CQnUoV8k.js";
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Circle = createLucideIcon("circle", [["circle", {
	cx: "12",
	cy: "12",
	r: "10",
	key: "1mglay"
}]]);
//#endregion
//#region src/screens/AssignmentsScreen.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/home/hatch/workspace/Project_MamVan_Edu/src/screens/AssignmentsScreen.tsx";
var TEST_KINDS = TEST_QUIZ_KINDS;
function toMs(value) {
	if (!value) return null;
	const ms = new Date(value).getTime();
	return Number.isNaN(ms) ? null : ms;
}
function fmtDue(ms) {
	if (ms === null) return "Không hạn nộp";
	const d = new Date(ms);
	return `Hạn nộp: ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
var KIND_LABEL = {
	quick: "Kiểm tra nhanh",
	mastery: "Kiểm tra thành thạo",
	final: "Kiểm tra cuối kỳ",
	homework: "Bài tập về nhà",
	practice: "Luyện tập",
	reading: "Đọc hiểu"
};
function sortByDue(a, b) {
	if (a.dueMs === null && b.dueMs === null) return a.title.localeCompare(b.title);
	if (a.dueMs === null) return 1;
	if (b.dueMs === null) return -1;
	return a.dueMs - b.dueMs;
}
var AssignmentsScreen = ({ quizzes, topics, studentId, completedQuizIds, onSelectQuiz, onOpenAssignment }) => {
	const [tab, setTab] = (0, import_react.useState)("test");
	const [biItems, setBiItems] = (0, import_react.useState)([]);
	const [biLoaded, setBiLoaded] = (0, import_react.useState)(false);
	const topicName = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		(topics || []).forEach((t) => map.set(t.id, t.title));
		return map;
	}, [topics]);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		setBiLoaded(false);
		getStudentAssignments(studentId).then((rows) => {
			if (cancelled) return;
			const items = (rows || []).map((r) => {
				const attempts = r.attempts || [];
				const done = r.status === "SUBMITTED" || attempts.length > 0;
				let bestScoreText = null;
				if (attempts.length > 0) {
					const scored = attempts.filter((a) => a.score_awarded != null && a.max_score != null);
					if (scored.length > 0) {
						const best = scored.reduce((acc, cur) => Number(cur.score_awarded) / Number(cur.max_score) > Number(acc.score_awarded) / Number(acc.max_score) ? cur : acc);
						bestScoreText = `Điểm cao nhất: ${best.score_awarded}/${best.max_score}`;
					}
				}
				return {
					source: "assignment",
					id: r.assignmentId,
					title: r.title,
					topicName: "Bài tập cô giao",
					questionCount: r.questionCount || 0,
					dueMs: toMs(r.dueAt),
					isTimed: !!r.isTimed,
					timeLimitMinutes: r.timeLimitMinutes ?? void 0,
					done,
					bestScoreText
				};
			});
			setBiItems(items);
			setBiLoaded(true);
		}).catch(() => {
			if (!cancelled) {
				setBiItems([]);
				setBiLoaded(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [studentId]);
	const testItems = (0, import_react.useMemo)(() => (quizzes || []).filter((q) => TEST_KINDS.includes(q.kind)).map((q) => ({
		source: "quiz",
		id: q.id,
		title: q.title,
		topicName: topicName.get(q.topicId) || "Chủ đề",
		questionCount: (q.questionIds || []).length,
		dueMs: toMs(q.dueDate),
		isTimed: q.timeLimitMinutes !== void 0,
		timeLimitMinutes: q.timeLimitMinutes,
		done: completedQuizIds.includes(q.id),
		kindLabel: KIND_LABEL[q.kind] || "Kiểm tra"
	})).sort(sortByDue), [
		quizzes,
		topicName,
		completedQuizIds
	]);
	const homeworkItems = (0, import_react.useMemo)(() => [...(quizzes || []).filter((q) => q.kind === "homework").map((q) => ({
		source: "quiz",
		id: q.id,
		title: q.title,
		topicName: topicName.get(q.topicId) || "Chủ đề",
		questionCount: (q.questionIds || []).length,
		dueMs: toMs(q.dueDate),
		isTimed: q.timeLimitMinutes !== void 0,
		timeLimitMinutes: q.timeLimitMinutes,
		done: completedQuizIds.includes(q.id),
		kindLabel: KIND_LABEL.homework
	})), ...biItems].sort(sortByDue), [
		quizzes,
		topicName,
		completedQuizIds,
		biItems
	]);
	const items = tab === "test" ? testItems : homeworkItems;
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "max-w-5xl mx-auto px-4 py-6 space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h1", {
				className: "text-2xl font-black text-[#2F3E6B] flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ClipboardList, { className: "w-6 h-6 text-[#E2704A]" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 186,
					columnNumber: 11
				}, void 0), " Bài tập"]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 185,
				columnNumber: 9
			}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "text-sm text-[#8C7E6A] mt-1",
				children: "Bài kiểm tra làm 1 lần — làm xong vẫn xem lại được nhưng không tính điểm mới. Bài tập về nhà làm lại không giới hạn."
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 188,
				columnNumber: 9
			}, void 0)] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 184,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					type: "button",
					onClick: () => setTab("test"),
					className: `flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition ${tab === "test" ? "bg-[#2F3E6B] text-white shadow" : "bg-white border border-[#E6DCC8] text-[#2F3E6B]"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(FileCheck, { className: "w-4 h-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 202,
							columnNumber: 11
						}, void 0),
						" Kiểm tra (",
						testItems.length,
						")"
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 195,
					columnNumber: 9
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					type: "button",
					onClick: () => setTab("homework"),
					className: `flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition ${tab === "homework" ? "bg-[#2F3E6B] text-white shadow" : "bg-white border border-[#E6DCC8] text-[#2F3E6B]"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(House, { className: "w-4 h-4" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 211,
							columnNumber: 11
						}, void 0),
						" Về nhà (",
						homeworkItems.length,
						")"
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 204,
					columnNumber: 9
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 194,
				columnNumber: 7
			}, void 0),
			tab === "homework" && !biLoaded && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "text-sm text-[#8C7E6A] italic",
				children: "Đang tải bài tập cô giao…"
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 216,
				columnNumber: 9
			}, void 0),
			items.length === 0 && (tab === "test" || biLoaded) ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "bg-white border border-[#E6DCC8] rounded-2xl p-8 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "font-bold text-[#2F3E6B]",
					children: tab === "test" ? "Chưa có bài kiểm tra nào." : "Chưa có bài tập về nhà nào."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 221,
					columnNumber: 11
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-sm text-[#8C7E6A] mt-1",
					children: "Khi cô giao bài mới, bài sẽ hiện ở đây theo hạn nộp."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 224,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 220,
				columnNumber: 9
			}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "space-y-3",
				children: items.map((item) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					type: "button",
					onClick: () => item.source === "quiz" ? onSelectQuiz(item.id) : onOpenAssignment(item.id),
					className: "w-full text-left bg-white border border-[#E6DCC8] rounded-2xl p-4 hover:border-[#2F3E6B] transition flex items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "shrink-0 w-10 h-10 rounded-xl bg-[#FAF5EB] border border-[#E6DCC8] flex items-center justify-center",
							children: item.done ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "w-5 h-5 text-[#2F6B4F]" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 239,
								columnNumber: 19
							}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Circle, { className: "w-5 h-5 text-[#8C7E6A]" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 241,
								columnNumber: 19
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 237,
							columnNumber: 15
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "flex-1 min-w-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "block font-bold text-[#2F3E6B] truncate",
									children: item.title
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 245,
									columnNumber: 17
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "block text-xs text-[#8C7E6A] mt-0.5",
									children: [
										item.topicName,
										" • ",
										item.questionCount,
										" câu",
										item.isTimed && item.timeLimitMinutes ? ` • ${item.timeLimitMinutes} phút` : "",
										item.source === "quiz" ? ` • ${item.kindLabel}` : ""
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 246,
									columnNumber: 17
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "flex items-center gap-1 text-xs text-[#8C7E6A] mt-0.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Clock, { className: "w-3.5 h-3.5" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 252,
											columnNumber: 19
										}, void 0),
										" ",
										fmtDue(item.dueMs),
										item.source === "assignment" && item.bestScoreText && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "font-bold text-[#2F6B4F]",
											children: [
												" ",
												"• ",
												item.bestScoreText
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 255,
											columnNumber: 23
										}, void 0)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 251,
									columnNumber: 17
								}, void 0)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 244,
							columnNumber: 15
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "shrink-0 flex items-center gap-1 text-xs font-bold text-[#2F3E6B]",
							children: [item.done && tab === "test" ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Eye, { className: "w-4 h-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 265,
								columnNumber: 21
							}, void 0), " Xem lại"] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 264,
								columnNumber: 19
							}, void 0) : item.done ? "Đã nộp" : "Làm bài", /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronRight, { className: "w-4 h-4" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 272,
								columnNumber: 17
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 262,
							columnNumber: 15
						}, void 0)
					]
				}, `${item.source}:${item.id}`, true, {
					fileName: _jsxFileName,
					lineNumber: 229,
					columnNumber: 13
				}, void 0))
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 227,
				columnNumber: 9
			}, void 0)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 183,
		columnNumber: 5
	}, void 0);
};
//#endregion
export { AssignmentsScreen };
