import { a as ChevronDown, i as ChevronUp, n as Layers, r as Funnel, t as PenLine } from "./pen-line-CctdXn8o.js";
import { $t as countTopicFlowDone, Bt as BookOpen, G as isTopicSolid, Ht as ArrowRight, J as require_jsx_dev_runtime, U as calculateAllMastery, gt as Play, k as useLiveQuery, pn as __toESM, tn as deriveFlowItems, un as require_react, w as quizService, x as contentService } from "./index-CQnUoV8k.js";
//#region src/screens/LearnScreen.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/home/hatch/workspace/Project_MamVan_Edu/src/screens/LearnScreen.tsx";
var LearnScreen = ({ state, topics, focusTopicId, onSelectVideo, onSelectTheory, onSelectQuiz }) => {
	const [expandedTopics, setExpandedTopics] = (0, import_react.useState)({});
	const [filter, setFilter] = (0, import_react.useState)("all");
	const activeTopics = topics ?? [];
	import_react.useEffect(() => {
		if (!focusTopicId) return;
		setFilter("all");
		setExpandedTopics((prev) => ({
			...prev,
			[focusTopicId]: true
		}));
		const t = setTimeout(() => {
			document.getElementById("learn-topic-" + focusTopicId)?.scrollIntoView({
				behavior: "smooth",
				block: "start"
			});
		}, 80);
		return () => clearTimeout(t);
	}, [focusTopicId]);
	const { data: liveVideos } = useLiveQuery(() => contentService.getVideoLessons(void 0, true), ["content"]);
	const { data: liveTheories } = useLiveQuery(() => contentService.getTheoryLessons(void 0, true), ["content"]);
	const { data: liveQuizzes } = useLiveQuery(() => quizService.getQuizzes(void 0, true), ["content"]);
	const { data: liveQuestions } = useLiveQuery(() => quizService.getQuestions(void 0), ["content"]);
	const getTopicProgress = (topic) => {
		const isSolid = isTopicSolid(state.questionResults, topic.id);
		const mastery = calculateAllMastery(state.questionResults, topic.id);
		const hasAttempted = Object.values(mastery).some((m) => m.totalQuestionsAttempted > 0);
		const isFlagged = state.flaggedNeedReviewTopicIds.includes(topic.id);
		const hasReview = Object.values(mastery).some((m) => m.status === "NEEDS_REVIEW") || isFlagged;
		let status = "Chưa học";
		let statusClass = "bg-slate-100 text-slate-600 border-slate-200";
		if (isSolid) {
			status = "Vững";
			statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
		} else if (hasReview) {
			status = "Cần ôn";
			statusClass = "bg-amber-50 text-amber-700 border-amber-200";
		} else if (hasAttempted) {
			status = "Đang học";
			statusClass = "bg-indigo-50 text-[#4F46E5] border-indigo-200";
		}
		const topicQs = (liveQuizzes || []).filter((q) => q.topicId === topic.id);
		const { done: doneItems, total: totalItems } = countTopicFlowDone(topic, topicQs, liveQuestions || {}, state.completedSteps || [], state.questionResults || []);
		const progressPercent = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0;
		return {
			status,
			statusClass,
			progressPercent,
			hasAttempted,
			isSolid,
			hasReview
		};
	};
	const filteredTopics = activeTopics.filter((t) => {
		const p = getTopicProgress(t);
		if (filter === "unlearned") return p.status === "Chưa học";
		if (filter === "needs_review") return p.status === "Cần ôn";
		return true;
	});
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "w-full max-w-4xl mx-auto py-6 px-4 sm:px-8 space-y-6 text-[#1E1B4B]",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-[#4F46E5] mb-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Layers, { className: "w-3.5 h-3.5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 121,
							columnNumber: 13
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Kho học liệu Ngữ văn 7" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 122,
							columnNumber: 13
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 120,
						columnNumber: 11
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] tracking-tight",
						children: "Bài học & Rèn luyện"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 124,
						columnNumber: 11
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-xs sm:text-sm text-slate-500 mt-1",
						children: "Bấm nút Học bài ở từng chủ đề để học đúng thứ tự cô đã xếp — chỉ những bài cô đã đẩy mới hiện ở đây."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 127,
						columnNumber: 11
					}, void 0)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 119,
					columnNumber: 9
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 118,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-center gap-2 overflow-x-auto pb-1 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "text-slate-500 flex items-center gap-1 font-semibold mr-1",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Funnel, { className: "w-3.5 h-3.5 text-slate-400" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 136,
						columnNumber: 11
					}, void 0), " Lọc theo:"]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 135,
					columnNumber: 9
				}, void 0), [
					{
						key: "all",
						label: "Tất cả chủ đề"
					},
					{
						key: "unlearned",
						label: "Chưa học"
					},
					{
						key: "needs_review",
						label: "Cần ôn lại"
					}
				].map((f) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					onClick: () => setFilter(f.key),
					className: `px-3.5 py-1.5 rounded-full border transition-all font-semibold whitespace-nowrap ${filter === f.key ? "bg-[#4F46E5] text-white border-[#4F46E5] shadow-xs" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`,
					children: f.label
				}, f.key, false, {
					fileName: _jsxFileName,
					lineNumber: 143,
					columnNumber: 11
				}, void 0))]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 134,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "space-y-5",
				children: filteredTopics.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-100",
					children: "Không có chủ đề nào phù hợp với bộ lọc hiện tại."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 160,
					columnNumber: 11
				}, void 0) : filteredTopics.map((topic) => {
					const prog = getTopicProgress(topic);
					const isExpanded = !!expandedTopics[topic.id];
					return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						id: "learn-topic-" + topic.id,
						className: `bg-white rounded-3xl p-6 border shadow-sm hover:shadow-md transition-all ${focusTopicId === topic.id ? "border-indigo-300 ring-2 ring-indigo-200" : "border-slate-100 hover:border-indigo-100"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-center gap-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-xs px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-[#4F46E5] font-bold",
										children: topic.tag
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 181,
										columnNumber: 21
									}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
										className: "text-lg sm:text-xl font-extrabold text-[#1E1B4B]",
										children: topic.title
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 184,
										columnNumber: 21
									}, void 0)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 180,
									columnNumber: 19
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-center gap-2 self-start sm:self-auto",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: `text-xs px-3 py-1 rounded-full border font-bold ${prog.statusClass}`,
										children: prog.status
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 191,
										columnNumber: 21
									}, void 0)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 190,
									columnNumber: 19
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 179,
								columnNumber: 17
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-xs sm:text-sm text-slate-600 leading-relaxed mb-4",
								children: topic.shortDesc
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 199,
								columnNumber: 17
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "w-full bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-5",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex justify-between items-center text-xs mb-1.5 font-medium",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-slate-500",
										children: "Tiến độ bài học:"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 206,
										columnNumber: 21
									}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "font-bold text-[#4F46E5] font-mono",
										children: [prog.progressPercent, "%"]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 207,
										columnNumber: 21
									}, void 0)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 205,
									columnNumber: 19
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "w-full h-2 bg-slate-200 rounded-full overflow-hidden",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "h-full gradient-primary rounded-full transition-all duration-300",
										style: { width: `${prog.progressPercent}%` }
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 210,
										columnNumber: 21
									}, void 0)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 209,
									columnNumber: 19
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 204,
								columnNumber: 17
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								type: "button",
								onClick: () => setExpandedTopics((prev) => ({
									...prev,
									[topic.id]: !prev[topic.id]
								})),
								className: "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#2F3E6B] text-white text-sm font-bold hover:opacity-90 active:scale-[0.99] transition",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Play, { className: "w-4 h-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 225,
										columnNumber: 19
									}, void 0),
									isExpanded ? "Thu gọn" : "Học bài",
									isExpanded ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronUp, { className: "w-4 h-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 228,
										columnNumber: 21
									}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChevronDown, { className: "w-4 h-4" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 230,
										columnNumber: 21
									}, void 0)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 218,
								columnNumber: 17
							}, void 0),
							isExpanded && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "space-y-2 mt-4",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-[11px] font-bold uppercase tracking-wider text-slate-400",
									children: "Luồng học của chủ đề — học theo thứ tự từ trên xuống"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 237,
									columnNumber: 21
								}, void 0), (() => {
									const vids = (liveVideos || []).filter((v) => topic.videoIds.includes(v.id));
									const ths = (liveTheories || []).filter((t) => t.topicId === topic.id);
									const qzs = (liveQuizzes || []).filter((q) => q.topicId === topic.id);
									const items = deriveFlowItems(topic.flowOrder, topic.videoIds.filter((id) => vids.some((v) => v.id === id)), ths.map((t) => t.id), qzs.map((q) => q.id));
									if (items.length === 0) return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "p-6 rounded-2xl bg-[#FFFDF8] border border-[#E6DCC8] border-dashed text-center",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "font-bold text-[#2F3E6B] text-sm",
											children: "Thầy/cô chưa đăng bài cho chủ đề này"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 253,
											columnNumber: 29
										}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-xs text-slate-500 mt-1",
											children: "Các bài học sẽ sớm được cập nhật vào kho học liệu!"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 256,
											columnNumber: 29
										}, void 0)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 252,
										columnNumber: 27
									}, void 0);
									return items.map((item, idx) => {
										const src = item.type === "video" ? vids.find((v) => v.id === item.id) : item.type === "theory" ? ths.find((t) => t.id === item.id) : qzs.find((q) => q.id === item.id);
										if (!src) return null;
										const meta = item.type === "video" ? `Video • ${Math.max(1, Math.round((src.durationSec || 0) / 60))} phút` : item.type === "theory" ? "Lý thuyết • Đọc và ghi nhớ" : `Bài tập • ${src.questionIds?.length || 0} câu`;
										return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
											type: "button",
											onClick: () => item.type === "video" ? onSelectVideo(item.id) : item.type === "theory" ? onSelectTheory(item.id) : onSelectQuiz?.(item.id),
											className: "w-full flex items-center gap-3 bg-white border border-slate-200 hover:border-[#E2704A]/60 hover:shadow-sm rounded-2xl px-3.5 py-3 text-left transition-all",
											children: [
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
													className: "w-7 h-7 rounded-full bg-[#2F3E6B] text-white text-xs font-black flex items-center justify-center shrink-0",
													children: idx + 1
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 289,
													columnNumber: 29
												}, void 0),
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
													className: `w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${item.type === "video" ? "bg-orange-50 text-[#E2704A]" : item.type === "theory" ? "bg-purple-50 text-[#7C3AED]" : "bg-indigo-50 text-[#4F46E5]"}`,
													children: item.type === "video" ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Play, { className: "w-4 h-4" }, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 302,
														columnNumber: 33
													}, void 0) : item.type === "theory" ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(BookOpen, { className: "w-4 h-4" }, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 304,
														columnNumber: 33
													}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(PenLine, { className: "w-4 h-4" }, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 306,
														columnNumber: 33
													}, void 0)
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 292,
													columnNumber: 29
												}, void 0),
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
													className: "flex-1 min-w-0",
													children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
														className: "block font-bold text-sm text-[#1E1B4B] truncate",
														children: src.title
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 310,
														columnNumber: 31
													}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
														className: "block text-[11px] text-slate-500",
														children: meta
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 313,
														columnNumber: 31
													}, void 0)]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 309,
													columnNumber: 29
												}, void 0),
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowRight, { className: "w-4 h-4 text-slate-300 shrink-0" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 315,
													columnNumber: 29
												}, void 0)
											]
										}, item.type + ":" + item.id, true, {
											fileName: _jsxFileName,
											lineNumber: 277,
											columnNumber: 27
										}, void 0);
									});
								})()]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 236,
								columnNumber: 19
							}, void 0)
						]
					}, topic.id, true, {
						fileName: _jsxFileName,
						lineNumber: 169,
						columnNumber: 15
					}, void 0);
				})
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 158,
				columnNumber: 7
			}, void 0)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 116,
		columnNumber: 5
	}, void 0);
};
//#endregion
export { LearnScreen };
