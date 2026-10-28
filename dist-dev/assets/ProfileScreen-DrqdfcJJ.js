import { $ as Volume2, J as require_jsx_dev_runtime, Jt as countLearningSteps, Q as VolumeX, Rt as Check, Wt as createLucideIcon, Y as THEMES_LIST, bt as LogOut, lt as Sparkles, un as require_react, vt as Palette } from "./index-CQnUoV8k.js";
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Type = createLucideIcon("type", [
	["path", {
		d: "M12 4v16",
		key: "1654pz"
	}],
	["path", {
		d: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2",
		key: "e0r10z"
	}],
	["path", {
		d: "M9 20h6",
		key: "s66wpe"
	}]
]);
require_react();
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName = "/home/hatch/workspace/Project_MamVan_Edu/src/screens/ProfileScreen.tsx";
var ProfileScreen = ({ state, onUpdateState, onLogout }) => {
	const currentTheme = state.themePreference || "creative_edtech";
	const selectTheme = (themeId) => {
		onUpdateState((prev) => ({
			...prev,
			themePreference: themeId
		}));
	};
	const toggleSound = () => {
		onUpdateState((prev) => ({
			...prev,
			soundEnabled: !prev.soundEnabled
		}));
	};
	const toggleAnimations = () => {
		onUpdateState((prev) => ({
			...prev,
			animationsEnabled: !prev.animationsEnabled
		}));
	};
	const setFontSize = (size) => {
		onUpdateState((prev) => ({
			...prev,
			fontSizePreference: size
		}));
	};
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "w-full max-w-2xl mx-auto py-6 px-4 sm:px-8 space-y-6 text-[#1E1B4B]",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "border-b border-slate-100 pb-5",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
					className: "text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] tracking-tight",
					children: "Hồ sơ học tập"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 66,
					columnNumber: 9
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-xs sm:text-sm text-slate-500 mt-1",
					children: "Thông tin cá nhân và tùy chỉnh trải nghiệm học tập"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 69,
					columnNumber: 9
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 65,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm flex items-center gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#4F46E5] to-[#8B5CF6] p-0.5 shadow-md shadow-indigo-500/20 shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "w-full h-full bg-white rounded-[14px] flex items-center justify-center font-extrabold text-[#4F46E5] text-xl",
						children: state.profile.name.split(" ").map((n) => n[0]).slice(-2).join("")
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 77,
						columnNumber: 11
					}, void 0)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 76,
					columnNumber: 9
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
						className: "font-extrabold text-xl text-[#1E1B4B]",
						children: state.profile.name
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 87,
						columnNumber: 11
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-xs text-slate-500 mt-0.5",
						children: [
							"Mã học sinh: ",
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("strong", {
								className: "text-[#1E1B4B]",
								children: state.profile.username
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 91,
								columnNumber: 26
							}, void 0),
							" · ",
							state.profile.grade
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 90,
						columnNumber: 11
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-xs text-slate-400 mt-0.5",
						children: state.profile.school
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 93,
						columnNumber: 11
					}, void 0)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 86,
					columnNumber: 9
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 75,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "grid grid-cols-3 gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "bg-white rounded-2xl p-4 border border-slate-100 shadow-xs text-center",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1",
							children: "Tổng XP"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 100,
							columnNumber: 11
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-xl sm:text-2xl font-black text-[#4F46E5] font-mono tabular-nums",
							children: state.totalXp
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 101,
							columnNumber: 11
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 99,
						columnNumber: 9
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "bg-white rounded-2xl p-4 border border-slate-100 shadow-xs text-center",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1",
							children: "Chuyên cần"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 107,
							columnNumber: 11
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-xl sm:text-2xl font-black text-emerald-600 font-mono tabular-nums",
							children: [state.attendanceDaysThisWeek, "/5"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 108,
							columnNumber: 11
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 106,
						columnNumber: 9
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "bg-white rounded-2xl p-4 border border-slate-100 shadow-xs text-center",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1",
							children: "Hoạt động"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 114,
							columnNumber: 11
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
							className: "text-xl sm:text-2xl font-black text-[#8B5CF6] font-mono tabular-nums",
							children: countLearningSteps(state.completedSteps)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 115,
							columnNumber: 11
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 113,
						columnNumber: 9
					}, void 0)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 98,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
						className: "text-sm font-extrabold text-[#1E1B4B] uppercase tracking-wider",
						children: "Tùy chỉnh giao diện & Âm thanh"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 123,
						columnNumber: 9
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "w-9 h-9 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center",
								children: state.soundEnabled ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Volume2, { className: "w-4 h-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 131,
									columnNumber: 37
								}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(VolumeX, { className: "w-4 h-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 131,
									columnNumber: 71
								}, void 0)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 130,
								columnNumber: 13
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-bold text-[#1E1B4B]",
								children: "Hiệu ứng âm thanh"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 134,
								columnNumber: 15
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-xs text-slate-400",
								children: "Tiếng chúc mừng khi hoàn thành bài"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 135,
								columnNumber: 15
							}, void 0)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 133,
								columnNumber: 13
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 129,
							columnNumber: 11
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							onClick: toggleSound,
							className: `w-12 h-6.5 rounded-full transition-colors relative p-0.5 ${state.soundEnabled ? "bg-[#4F46E5]" : "bg-slate-200"}`,
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: `w-5.5 h-5.5 rounded-full bg-white transition-transform shadow-xs ${state.soundEnabled ? "translate-x-5.5" : "translate-x-0"}` }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 145,
								columnNumber: 13
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 139,
							columnNumber: 11
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 128,
						columnNumber: 9
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "w-9 h-9 rounded-xl bg-purple-50 text-[#8B5CF6] flex items-center justify-center",
								children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "w-4 h-4" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 157,
									columnNumber: 15
								}, void 0)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 156,
								columnNumber: 13
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-sm font-bold text-[#1E1B4B]",
								children: "Hiệu ứng chuyển động (Animation)"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 160,
								columnNumber: 15
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-xs text-slate-400",
								children: "Hoạt ảnh tưới cây và Mầm Mực nhấp nháy"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 161,
								columnNumber: 15
							}, void 0)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 159,
								columnNumber: 13
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 155,
							columnNumber: 11
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							onClick: toggleAnimations,
							className: `w-12 h-6.5 rounded-full transition-colors relative p-0.5 ${state.animationsEnabled ? "bg-[#4F46E5]" : "bg-slate-200"}`,
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: `w-5.5 h-5.5 rounded-full bg-white transition-transform shadow-xs ${state.animationsEnabled ? "translate-x-5.5" : "translate-x-0"}` }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 171,
								columnNumber: 13
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 165,
							columnNumber: 11
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 154,
						columnNumber: 9
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "space-y-3 pt-2 border-t border-slate-100",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center",
										children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Type, { className: "w-4 h-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 184,
											columnNumber: 17
										}, void 0)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 183,
										columnNumber: 15
									}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-sm font-bold text-[#1E1B4B]",
										children: "Cỡ chữ hiển thị"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 187,
										columnNumber: 17
									}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-xs text-slate-400",
										children: "Điều chỉnh độ lớn chữ đọc bài trên toàn hệ thống"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 188,
										columnNumber: 17
									}, void 0)] }, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 186,
										columnNumber: 15
									}, void 0)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 182,
									columnNumber: 13
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl",
									children: [
										{
											key: "normal",
											label: "Chuẩn",
											scale: "100%"
										},
										{
											key: "large",
											label: "Lớn",
											scale: "112%"
										},
										{
											key: "larger",
											label: "Rất lớn",
											scale: "125%"
										}
									].map((s) => {
										const isActive = (state.fontSizePreference || "normal") === s.key;
										return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
											onClick: () => setFontSize(s.key),
											className: `px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? "bg-white text-[#4F46E5] shadow-xs" : "text-slate-600 hover:text-[#1E1B4B]"}`,
											children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: s.label }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 209,
												columnNumber: 21
											}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
												className: `text-[10px] font-mono ${isActive ? "text-indigo-400" : "text-slate-400"}`,
												children: s.scale
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 210,
												columnNumber: 21
											}, void 0)]
										}, s.key, true, {
											fileName: _jsxFileName,
											lineNumber: 200,
											columnNumber: 19
										}, void 0);
									})
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 192,
									columnNumber: 13
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 181,
								columnNumber: 11
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "space-y-3 pt-2 border-t border-slate-100",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
										className: "w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center",
										children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Palette, { className: "w-4 h-4" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 223,
											columnNumber: 15
										}, void 0)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 222,
										columnNumber: 13
									}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-sm font-bold text-[#1E1B4B]",
										children: "Giao diện hiển thị"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 226,
										columnNumber: 15
									}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
										className: "text-xs text-slate-400",
										children: "Chọn bộ màu chủ đạo cho không gian học của em"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 227,
										columnNumber: 15
									}, void 0)] }, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 225,
										columnNumber: 13
									}, void 0)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 221,
									columnNumber: 11
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "grid grid-cols-1 sm:grid-cols-2 gap-2.5",
									children: THEMES_LIST.map((theme) => {
										const isActive = currentTheme === theme.id;
										return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
											onClick: () => selectTheme(theme.id),
											className: `text-left p-3.5 rounded-2xl border transition-all ${isActive ? "border-[#4F46E5] ring-2 ring-indigo-100 bg-indigo-50/40" : "border-slate-200 hover:border-indigo-200 bg-white"}`,
											children: [
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
													className: "flex items-center justify-between gap-2 mb-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
														className: "text-xs font-extrabold text-[#1E1B4B]",
														children: theme.name
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 245,
														columnNumber: 21
													}, void 0), isActive && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Check, { className: "w-4 h-4 text-[#4F46E5]" }, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 246,
														columnNumber: 34
													}, void 0)]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 244,
													columnNumber: 19
												}, void 0),
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
													className: "text-[11px] text-slate-500 mb-2.5",
													children: theme.subtitle
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 248,
													columnNumber: 19
												}, void 0),
												/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
													className: "flex items-center gap-1.5",
													children: [
														theme.palette.primaryTitle,
														theme.palette.accentAction,
														theme.palette.successSage,
														theme.palette.backgroundPage
													].map((color, i) => /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
														className: "w-5 h-5 rounded-full border border-black/10",
														style: { backgroundColor: color }
													}, i, false, {
														fileName: _jsxFileName,
														lineNumber: 256,
														columnNumber: 23
													}, void 0))
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 249,
													columnNumber: 19
												}, void 0)
											]
										}, theme.id, true, {
											fileName: _jsxFileName,
											lineNumber: 235,
											columnNumber: 17
										}, void 0);
									})
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 231,
									columnNumber: 11
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 220,
								columnNumber: 9
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex items-center justify-between text-xs text-slate-500 font-medium",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "flex items-center gap-1.5 font-bold text-slate-700",
										children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "w-3.5 h-3.5 text-[#FBBF24]" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 273,
											columnNumber: 17
										}, void 0), "Xem trước đoạn văn mẫu:"]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 272,
										columnNumber: 15
									}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
										className: "text-[11px] px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-50 text-[#4F46E5]",
										children: (state.fontSizePreference || "normal") === "larger" ? "Cỡ Rất lớn — Chống mỏi mắt khi đọc lâu" : (state.fontSizePreference || "normal") === "large" ? "Cỡ Lớn — Dễ đọc, rõ nét" : "Cỡ Chuẩn — Mặc định ban đầu"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 276,
										columnNumber: 15
									}, void 0)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 271,
									columnNumber: 13
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
									className: "text-slate-800 leading-relaxed italic font-serif text-sm",
									children: "\"Tre xanh xanh tự bao giờ? Chuyện ngày xưa đã có bờ tre xanh. Thân gầy guộc, lá mong manh, mà sao nên lũy nên thành tre ơi...\""
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 284,
									columnNumber: 13
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 270,
								columnNumber: 11
							}, void 0)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 180,
						columnNumber: 9
					}, void 0)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 122,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-3",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					onClick: onLogout,
					className: "w-full py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center justify-center gap-2 transition-colors",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(LogOut, { className: "w-4 h-4" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 298,
						columnNumber: 11
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Đăng xuất khỏi ứng dụng" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 299,
						columnNumber: 11
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 294,
					columnNumber: 9
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 292,
				columnNumber: 7
			}, void 0)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 63,
		columnNumber: 5
	}, void 0);
};
//#endregion
export { ProfileScreen };
