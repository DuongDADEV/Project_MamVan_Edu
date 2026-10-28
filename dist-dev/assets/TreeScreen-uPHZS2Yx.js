import { t as Award } from "./award-DtoLRYRA.js";
import { t as ChartColumn } from "./chart-column-DLd7rNny.js";
import { Ft as CircleCheck, H as SKILL_METADATA, Ht as ArrowRight, J as require_jsx_dev_runtime, Jt as countLearningSteps, Kt as TREE_STAGES_CONFIG, U as calculateAllMastery, Wt as createLucideIcon, Yt as getLocalTodayStr, ct as Sprout, g as GrowthTree, lt as Sparkles, pn as __toESM, un as require_react, xt as Lock } from "./index-CQnUoV8k.js";
import { t as BADGES_CATALOG } from "./badges-CehLVedp.js";
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Droplets = createLucideIcon("droplets", [["path", {
	d: "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z",
	key: "1ptgy4"
}], ["path", {
	d: "M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",
	key: "1sl1rz"
}]]);
//#endregion
//#region src/screens/TreeScreen.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/home/hatch/workspace/Project_MamVan_Edu/src/screens/TreeScreen.tsx";
var TreeScreen = ({ state, topics, onSelectTopic, onCheckIn }) => {
	const [activeTab, setActiveTab] = (0, import_react.useState)("tree");
	const [selectedLeafTopicId, setSelectedLeafTopicId] = (0, import_react.useState)(null);
	const [isWatering, setIsWatering] = (0, import_react.useState)(false);
	const [wateringFeedback, setWateringFeedback] = (0, import_react.useState)(null);
	const todayStr = getLocalTodayStr();
	const [hasWateredThisSession, setHasWateredThisSession] = (0, import_react.useState)(() => {
		try {
			const studentKey = state.profile?.id || "hs001";
			return sessionStorage.getItem("mam_van_watered_session_" + studentKey) === todayStr || state.lastAttendanceDate === todayStr;
		} catch {
			return state.lastAttendanceDate === todayStr;
		}
	});
	const handleWaterTree = () => {
		if (hasWateredThisSession || isWatering) return;
		setIsWatering(true);
		setHasWateredThisSession(true);
		try {
			const studentKey = state.profile?.id || "hs001";
			sessionStorage.setItem("mam_van_watered_session_" + studentKey, todayStr);
		} catch {}
		if (onCheckIn) onCheckIn();
		setWateringFeedback("💧 Bạn đã tưới nước cho Cây Mầm Mực! Hạt mầm văn chương đang lớn lên từng ngày 🌱✨");
		setTimeout(() => {
			setIsWatering(false);
		}, 1800);
		setTimeout(() => {
			setWateringFeedback(null);
		}, 3500);
	};
	const activeTopics = topics || [];
	const topicLeavesData = activeTopics.map((t) => {
		const tMastery = calculateAllMastery(state.questionResults || [], t.id);
		const avg = Math.round((tMastery.NHAN_BIET.percentage + tMastery.THONG_HIEU.percentage + tMastery.PHAN_TICH.percentage + tMastery.VAN_DUNG.percentage) / 4);
		let status = "INSUFFICIENT_DATA";
		if (tMastery.NHAN_BIET.totalQuestionsAttempted >= 3) {
			if (avg >= 80) status = "SOLID";
			else if (avg >= 50) status = "PROGRESSING";
			else status = "NEEDS_REVIEW";
		}
		return {
			topicId: t.id,
			topicTitle: t.title,
			masteryStatus: status,
			percentage: avg
		};
	});
	const allMastery = calculateAllMastery(state.questionResults);
	const renderBadgeIcon = (iconType, isUnlocked) => {
		const strokeColor = isUnlocked ? "#8B5CF6" : "#94A3B8";
		const fillColor = isUnlocked ? "#F5F3FF" : "#F1F5F9";
		switch (iconType) {
			case "streak_fire": return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("svg", {
				width: "36",
				height: "36",
				viewBox: "0 0 24 24",
				fill: fillColor,
				stroke: isUnlocked ? "#F59E0B" : strokeColor,
				strokeWidth: "2",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("path", { d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 99,
					columnNumber: 13
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 98,
				columnNumber: 11
			}, void 0);
			case "analysis_feather": return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("svg", {
				width: "36",
				height: "36",
				viewBox: "0 0 24 24",
				fill: fillColor,
				stroke: isUnlocked ? "#4F46E5" : strokeColor,
				strokeWidth: "2",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("path", { d: "M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 105,
						columnNumber: 13
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("line", {
						x1: "16",
						y1: "8",
						x2: "2",
						y2: "22"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 106,
						columnNumber: 13
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("line", {
						x1: "17.5",
						y1: "15",
						x2: "9",
						y2: "15"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 107,
						columnNumber: 13
					}, void 0)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 104,
				columnNumber: 11
			}, void 0);
			case "solid_tree": return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("svg", {
				width: "36",
				height: "36",
				viewBox: "0 0 24 24",
				fill: fillColor,
				stroke: isUnlocked ? "#10B981" : strokeColor,
				strokeWidth: "2",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("path", { d: "M12 10v12" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 113,
					columnNumber: 13
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("path", { d: "M12 2a5 5 0 0 0-5 5c0 1.5.6 2.8 1.6 3.8L5 14h14l-3.6-3.2A5 5 0 0 0 12 2z" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 114,
					columnNumber: 13
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 112,
				columnNumber: 11
			}, void 0);
			case "overcome_mountain": return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("svg", {
				width: "36",
				height: "36",
				viewBox: "0 0 24 24",
				fill: fillColor,
				stroke: isUnlocked ? "#EC4899" : strokeColor,
				strokeWidth: "2",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("path", { d: "m8 3 4 8 5-5 5 15H2L8 3z" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 120,
					columnNumber: 13
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 119,
				columnNumber: 11
			}, void 0);
			default: return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("svg", {
				width: "36",
				height: "36",
				viewBox: "0 0 24 24",
				fill: fillColor,
				stroke: isUnlocked ? "#06B6D4" : strokeColor,
				strokeWidth: "2",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("path", { d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 127,
						columnNumber: 13
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("path", { d: "M6 6h10" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 128,
						columnNumber: 13
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("path", { d: "M6 10h10" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 129,
						columnNumber: 13
					}, void 0)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 126,
				columnNumber: 11
			}, void 0);
		}
	};
	const selectedTopic = activeTopics.find((t) => t.id === selectedLeafTopicId);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "w-full max-w-4xl mx-auto py-6 px-4 sm:px-8 space-y-6 text-[#1E1B4B]",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700 mb-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sprout, { className: "w-3.5 h-3.5" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 143,
							columnNumber: 13
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Khu vườn năng lực" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 144,
							columnNumber: 13
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 142,
						columnNumber: 11
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] tracking-tight",
						children: "Cây Văn & Năng lực"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 146,
						columnNumber: 11
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-xs sm:text-sm text-slate-500 mt-1",
						children: "Theo dõi sự lớn lên của Cây tri thức và 4 mức độ tư duy Ngữ văn"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 149,
						columnNumber: 11
					}, void 0)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 141,
					columnNumber: 9
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 self-start sm:self-auto shadow-inner",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							onClick: () => setActiveTab("tree"),
							className: `flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "tree" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-[#1E1B4B]"}`,
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sprout, { className: "w-4 h-4 text-emerald-600" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 164,
								columnNumber: 13
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Cây tri thức" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 165,
								columnNumber: 13
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 156,
							columnNumber: 11
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							onClick: () => setActiveTab("mastery"),
							className: `flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "mastery" ? "bg-white text-[#4F46E5] shadow-sm" : "text-slate-600 hover:text-[#1E1B4B]"}`,
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChartColumn, { className: "w-4 h-4 text-[#4F46E5]" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 176,
								columnNumber: 13
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Ma trận năng lực" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 177,
								columnNumber: 13
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 168,
							columnNumber: 11
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							onClick: () => setActiveTab("badges"),
							className: `flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "badges" ? "bg-white text-[#8B5CF6] shadow-sm" : "text-slate-600 hover:text-[#1E1B4B]"}`,
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Award, { className: "w-4 h-4 text-[#8B5CF6]" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 188,
								columnNumber: 13
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Huy hiệu" }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 189,
								columnNumber: 13
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 180,
							columnNumber: 11
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 155,
					columnNumber: 9
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 140,
				columnNumber: 7
			}, void 0),
			activeTab === "tree" && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "space-y-6 animate-[fadeIn_0.3s_ease]",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col items-center relative overflow-hidden",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "w-full flex items-center justify-between mb-4",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1",
								children: "Tiến trình sinh trưởng"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 201,
								columnNumber: 17
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
								className: "text-lg sm:text-xl font-extrabold text-[#1E1B4B]",
								children: "Vườn Văn Mầm Mực"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 204,
								columnNumber: 17
							}, void 0)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 200,
								columnNumber: 15
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "text-right",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-xs text-slate-500 font-medium block",
									children: "Đã tích lũy:"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 209,
									columnNumber: 17
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "font-extrabold text-[#4F46E5] font-mono text-sm sm:text-base",
									children: [countLearningSteps(state.completedSteps), " hoạt động học"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 210,
									columnNumber: 17
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 208,
								columnNumber: 15
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 199,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(GrowthTree, {
							completedStepsCount: countLearningSteps(state.completedSteps),
							topicLeaves: topicLeavesData,
							isWatering,
							onWaterComplete: () => setIsWatering(false),
							onLeafClick: (tId) => setSelectedLeafTopicId(tId),
							className: "my-4"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 217,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "w-full flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 my-2 text-[11px] font-semibold text-slate-600",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "w-3 h-3 rounded-full border",
										style: {
											backgroundColor: "#16A34A",
											borderColor: "#14532D"
										}
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 229,
										columnNumber: 17
									}, void 0), "≥80% • Đã hoàn thành"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 228,
									columnNumber: 15
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "w-3 h-3 rounded-full border",
										style: {
											backgroundColor: "#38BDF8",
											borderColor: "#0369A1"
										}
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 233,
										columnNumber: 17
									}, void 0), "50–79% • Đang học"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 232,
									columnNumber: 15
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "w-3 h-3 rounded-full border",
										style: {
											backgroundColor: "#FBBF24",
											borderColor: "#D97706"
										}
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 237,
										columnNumber: 17
									}, void 0), "<50% • Cần ôn lại"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 236,
									columnNumber: 15
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "w-3 h-3 rounded-full border",
										style: {
											backgroundColor: "#E2E8F0",
											borderColor: "#94A3B8"
										}
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 241,
										columnNumber: 17
									}, void 0), "Chưa học"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 240,
									columnNumber: 15
								}, void 0)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 227,
							columnNumber: 13
						}, void 0),
						activeTopics.length === 0 && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "w-full text-center py-3 px-4 my-2 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 font-medium",
							children: "🌱 Thầy/Cô chưa công bố chủ đề nào cho lớp. Các chồi lá tri thức sẽ trổ sinh ngay khi có bài học mới được xuất bản!"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 248,
							columnNumber: 15
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "w-full mt-2 mb-4 p-4 bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-emerald-50/80 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex items-center gap-3 w-full sm:w-auto",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "w-10 h-10 rounded-2xl bg-white shadow-xs border border-indigo-100 flex items-center justify-center text-xl shrink-0",
									children: hasWateredThisSession ? "🌱" : "💧"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 256,
									columnNumber: 17
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h4", {
									className: "text-xs font-bold text-[#1E1B4B] flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Nước tưới Mầm Mực" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 261,
										columnNumber: 21
									}, void 0), hasWateredThisSession ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700",
										children: "Đã tưới nước ✓"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 263,
										columnNumber: 23
									}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700",
										children: "Sẵn sàng"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 267,
										columnNumber: 23
									}, void 0)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 260,
									columnNumber: 19
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-[11px] text-slate-500",
									children: hasWateredThisSession ? "Cây Mầm Mực đã nhận đủ dưỡng chất! Hãy quay lại tưới nước ở lần đăng nhập tiếp theo nhé." : "Tưới nước mỗi ngày để kích thích mầm cây vươn chồi và trổ lá tri thức!"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 272,
									columnNumber: 19
								}, void 0)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 259,
									columnNumber: 17
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 255,
								columnNumber: 15
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								type: "button",
								onClick: handleWaterTree,
								disabled: isWatering || hasWateredThisSession,
								className: `w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shrink-0 ${hasWateredThisSession ? "bg-emerald-50 border border-emerald-200 text-emerald-700 opacity-90 cursor-not-allowed shadow-none" : "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] disabled:opacity-60 text-white shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"}`,
								children: hasWateredThisSession ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "w-4 h-4 text-emerald-600" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 292,
									columnNumber: 21
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Đã tưới nước xong ✓" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 293,
									columnNumber: 21
								}, void 0)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 291,
									columnNumber: 19
								}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(import_jsx_dev_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Droplets, { className: `w-4 h-4 text-cyan-200 ${isWatering ? "animate-bounce" : ""}` }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 297,
									columnNumber: 21
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: isWatering ? "Đang tưới nước..." : "Tưới nước cho cây (+XP)" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 298,
									columnNumber: 21
								}, void 0)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 296,
									columnNumber: 19
								}, void 0)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 280,
								columnNumber: 15
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 254,
							columnNumber: 13
						}, void 0),
						wateringFeedback && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mb-4 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-4 py-2.5 rounded-xl text-center animate-[fadeIn_0.3s_ease] w-full shadow-xs",
							children: wateringFeedback
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 305,
							columnNumber: 15
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "mt-2 pt-4 border-t border-slate-100 w-full flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-600",
							children: [
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: "w-3 h-3 rounded-full bg-[#10B981]" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 313,
										columnNumber: 17
									}, void 0), " Vững (≥80%)"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 312,
									columnNumber: 15
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: "w-3 h-3 rounded-full bg-[#22D3EE]" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 316,
										columnNumber: 17
									}, void 0), " Đang tiến bộ (50–79%)"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 315,
									columnNumber: 15
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: "w-3 h-3 rounded-full bg-[#FBBF24]" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 319,
										columnNumber: 17
									}, void 0), " Cần ôn lại (<50%)"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 318,
									columnNumber: 15
								}, void 0),
								/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { className: "w-3 h-3 rounded-full bg-slate-300" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 322,
										columnNumber: 17
									}, void 0), " Chưa học"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 321,
									columnNumber: 15
								}, void 0)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 311,
							columnNumber: 13
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 198,
					columnNumber: 11
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "bg-white rounded-3xl p-6 border border-slate-100 shadow-sm",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h4", {
						className: "text-sm font-extrabold text-[#1E1B4B] mb-4 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "w-4 h-4 text-[#FBBF24]" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 330,
							columnNumber: 15
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "6 Mốc sinh trưởng của Cây:" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 331,
							columnNumber: 15
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 329,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3",
						children: TREE_STAGES_CONFIG.map((stage, idx) => {
							const isReached = countLearningSteps(state.completedSteps) >= stage.minSteps;
							return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: `p-3.5 rounded-2xl border text-center transition-all ${isReached ? "border-emerald-200 bg-emerald-50/50 shadow-xs" : "border-slate-100 bg-slate-50 opacity-60"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-xl block mb-1",
										children: idx === 0 ? "🌰" : idx === 1 ? "🌱" : idx === 2 ? "🌿" : idx === 3 ? "🪴" : idx === 4 ? "🌸" : "🍎"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 346,
										columnNumber: 21
									}, void 0),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h5", {
										className: "text-xs font-bold text-[#1E1B4B] mb-0.5",
										children: stage.name
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 349,
										columnNumber: 21
									}, void 0),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-[10px] text-slate-500 font-mono block",
										children: [stage.minSteps, " bước"]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 350,
										columnNumber: 21
									}, void 0)
								]
							}, stage.stage, true, {
								fileName: _jsxFileName,
								lineNumber: 338,
								columnNumber: 19
							}, void 0);
						})
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 333,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 328,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 196,
				columnNumber: 9
			}, void 0),
			activeTab === "mastery" && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "space-y-6 animate-[fadeIn_0.3s_ease]",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "bg-white rounded-3xl p-6 border border-slate-100 shadow-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
							className: "text-base sm:text-lg font-extrabold text-[#1E1B4B] mb-1",
							children: "Đánh giá theo 4 mức độ nhận thức"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 365,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-xs text-slate-500 mb-6",
							children: "Hệ thống tính điểm có trọng số giảm dần theo thời gian (kết quả gần nhất phản ánh đúng nhất năng lực hiện tại của bạn)"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 368,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "grid grid-cols-1 md:grid-cols-2 gap-4",
							children: [
								{
									key: "NHAN_BIET",
									color: "emerald",
									bar: "from-emerald-400 to-teal-500"
								},
								{
									key: "THONG_HIEU",
									color: "indigo",
									bar: "from-indigo-500 to-blue-600"
								},
								{
									key: "PHAN_TICH",
									color: "purple",
									bar: "from-purple-500 to-indigo-600"
								},
								{
									key: "VAN_DUNG",
									color: "amber",
									bar: "from-amber-400 to-orange-500"
								}
							].map(({ key, bar }) => {
								const info = SKILL_METADATA[key];
								const data = allMastery[key];
								let statusBadge = /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold",
									children: "Chưa đủ dữ liệu (<3 câu)"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 385,
									columnNumber: 19
								}, void 0);
								if (data.status === "SOLID") statusBadge = /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold",
									children: [
										"✓ Đạt vững (",
										data.percentage,
										"%)"
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 392,
									columnNumber: 21
								}, void 0);
								else if (data.status === "PROGRESSING") statusBadge = /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-bold",
									children: [
										"Đang tiến bộ (",
										data.percentage,
										"%)"
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 398,
									columnNumber: 21
								}, void 0);
								else if (data.status === "NEEDS_REVIEW") statusBadge = /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold",
									children: [
										"Cần ôn lại (",
										data.percentage,
										"%)"
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 404,
									columnNumber: 21
								}, void 0);
								return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "p-5 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-3 hover:border-indigo-100 transition-colors",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
											className: "flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "text-[11px] font-mono text-slate-400 font-semibold block",
												children: key
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 417,
												columnNumber: 25
											}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h4", {
												className: "text-base font-extrabold text-[#1E1B4B]",
												children: info.displayName
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 420,
												columnNumber: 25
											}, void 0)] }, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 416,
												columnNumber: 23
											}, void 0), statusBadge]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 415,
											columnNumber: 21
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-xs text-slate-600 leading-relaxed",
											children: info.shortDesc
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 427,
											columnNumber: 21
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
											className: "space-y-1",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
												className: "w-full h-2.5 bg-slate-100 rounded-full overflow-hidden",
												children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
													className: `h-full bg-gradient-to-r ${bar} rounded-full transition-all duration-500`,
													style: { width: `${data.percentage}%` }
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 434,
													columnNumber: 25
												}, void 0)
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 433,
												columnNumber: 23
											}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
												className: "flex justify-between text-[11px] text-slate-400 font-mono",
												children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [
													"Đã làm: ",
													data.totalQuestionsAttempted,
													" câu"
												] }, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 440,
													columnNumber: 25
												}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [
													"Mức đạt: ",
													data.percentage,
													"%"
												] }, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 441,
													columnNumber: 25
												}, void 0)]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 439,
												columnNumber: 23
											}, void 0)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 432,
											columnNumber: 21
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
											className: "pt-2 border-t border-slate-100 text-xs text-slate-600",
											children: [
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("strong", { children: "Kỹ năng rèn luyện:" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 447,
													columnNumber: 23
												}, void 0),
												" ",
												info.exampleSkill
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 446,
											columnNumber: 21
										}, void 0)
									]
								}, key, true, {
									fileName: _jsxFileName,
									lineNumber: 411,
									columnNumber: 19
								}, void 0);
							})
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 372,
							columnNumber: 13
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 364,
					columnNumber: 11
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 363,
				columnNumber: 9
			}, void 0),
			activeTab === "badges" && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "space-y-6 animate-[fadeIn_0.3s_ease]",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "bg-white rounded-3xl p-6 border border-slate-100 shadow-sm",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center justify-between mb-6",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
							className: "text-base sm:text-lg font-extrabold text-[#1E1B4B]",
							children: "Huy hiệu thành tích"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 463,
							columnNumber: 17
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-xs text-slate-500",
							children: "Những cột mốc ghi nhận nỗ lực rèn luyện của bạn cùng Mầm Mực"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 466,
							columnNumber: 17
						}, void 0)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 462,
							columnNumber: 15
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-xs font-extrabold px-3 py-1.5 rounded-full bg-purple-50 text-[#8B5CF6] border border-purple-100",
							children: [
								"Đã đạt: ",
								state.unlockedBadgeIds.length,
								" / ",
								BADGES_CATALOG.length
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 470,
							columnNumber: 15
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 461,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
						children: BADGES_CATALOG.map((b) => {
							const isUnlocked = state.unlockedBadgeIds.includes(b.id);
							return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: `p-4 rounded-2xl border flex items-start gap-4 transition-all ${isUnlocked ? "bg-gradient-to-br from-white to-purple-50/40 border-purple-100 shadow-xs" : "bg-slate-50 border-slate-200/70 opacity-65"}`,
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: `w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${isUnlocked ? "bg-white border-purple-200 shadow-sm" : "bg-slate-100 border-slate-200 text-slate-400"}`,
									children: renderBadgeIcon(b.iconType, isUnlocked)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 488,
									columnNumber: 21
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
											className: "flex items-center justify-between gap-1 mb-1",
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h4", {
												className: "text-sm font-extrabold text-[#1E1B4B]",
												children: b.title
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 500,
												columnNumber: 25
											}, void 0), isUnlocked ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5",
												children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "w-3 h-3" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 503,
													columnNumber: 29
												}, void 0), " Đã đạt"]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 502,
												columnNumber: 27
											}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 flex items-center gap-0.5",
												children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Lock, { className: "w-3 h-3" }, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 507,
													columnNumber: 29
												}, void 0), " Chưa mở"]
											}, void 0, true, {
												fileName: _jsxFileName,
												lineNumber: 506,
												columnNumber: 27
											}, void 0)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 499,
											columnNumber: 23
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-xs text-slate-600 leading-relaxed mb-2",
											children: b.desc
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 512,
											columnNumber: 23
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "text-[11px] font-medium text-slate-400 block capitalize",
											children: ["Phân loại: ", b.category]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 516,
											columnNumber: 23
										}, void 0)
									]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 498,
									columnNumber: 21
								}, void 0)]
							}, b.id, true, {
								fileName: _jsxFileName,
								lineNumber: 480,
								columnNumber: 19
							}, void 0);
						})
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 475,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 460,
					columnNumber: 11
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 459,
				columnNumber: 9
			}, void 0),
			selectedTopic && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "bg-white border border-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-[scaleIn_0.2s_ease]",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center justify-between mb-3",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#4F46E5] font-bold",
								children: selectedTopic.tag
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 533,
								columnNumber: 15
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								onClick: () => setSelectedLeafTopicId(null),
								className: "text-xs text-slate-400 hover:text-slate-700 font-bold p-1",
								children: "✕ Đóng"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 536,
								columnNumber: 15
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 532,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
							className: "text-lg font-extrabold text-[#1E1B4B] mb-2",
							children: selectedTopic.title
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 544,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-xs text-slate-600 leading-relaxed mb-4",
							children: selectedTopic.shortDesc
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 547,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 mb-5",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-xs font-bold text-slate-700 block",
								children: "Nội dung trong chủ đề này:"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 552,
								columnNumber: 15
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("ul", {
								className: "text-xs text-slate-600 space-y-1 list-disc pl-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", { children: [
										"Gồm ",
										(selectedTopic.videoIds || []).length,
										" bài giảng video của thầy/cô"
									] }, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 556,
										columnNumber: 17
									}, void 0),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", { children: "1 chuyên đề lý thuyết tổng hợp chi tiết" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 557,
										columnNumber: 17
									}, void 0),
									/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("li", { children: "Hệ thống bài tập kiểm tra 4 mức độ năng lực" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 558,
										columnNumber: 17
									}, void 0)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 555,
								columnNumber: 15
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 551,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex gap-2",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
								onClick: () => {
									setSelectedLeafTopicId(null);
									onSelectTopic(selectedTopic.id);
								},
								className: "flex-1 py-3 rounded-2xl gradient-primary text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/25 hover:brightness-105 active:scale-95 transition-all",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Vào ôn luyện chủ đề này" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 570,
									columnNumber: 17
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ArrowRight, { className: "w-3.5 h-3.5" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 571,
									columnNumber: 17
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 563,
								columnNumber: 15
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 562,
							columnNumber: 13
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 531,
					columnNumber: 11
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 530,
				columnNumber: 9
			}, void 0)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 138,
		columnNumber: 5
	}, void 0);
};
//#endregion
export { TreeScreen };
