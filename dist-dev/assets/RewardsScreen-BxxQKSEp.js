import { t as Award } from "./award-DtoLRYRA.js";
import { n as Calendar, t as History } from "./history-C6V8Yeeb.js";
import { At as Clock, D as studentService, Et as Flame, Ft as CircleCheck, It as CircleCheckBig, J as require_jsx_dev_runtime, K as MamMuc, Lt as CircleAlert, Rt as Check, T as rewardService, Tt as Gift, Z as X, an as REWARDS_CATALOG, b as classService, ct as Sprout, dt as Send, h as ChestIllustration, k as useLiveQuery, lt as Sparkles, on as filterDbRewardsForOwner, pn as __toESM, qt as getChestTierConfig, sn as mergeRewardTiers, un as require_react, xt as Lock } from "./index-CQnUoV8k.js";
//#region src/components/rewards/RewardTrack.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_dev_runtime = require_jsx_dev_runtime();
var _jsxFileName$5 = "/home/hatch/workspace/Project_MamVan_Edu/src/components/rewards/RewardTrack.tsx";
/**
* Component "Đường lên rương" (RewardTrack):
* - Biểu diễn hành trình tích lũy XP tuần từ 0 đến mốc cao nhất
* - Đặt các rương nhỏ tại các mốc XP tương ứng
* - Cột mốc hình mầm cây nhỏ chỉ vị trí XP tuần hiện tại của học sinh
* - Rương đã đạt mốc XP thì sáng, chưa đạt thì mờ
* - Bấm vào rương trên đường sẽ cuộn mượt tới thẻ tương ứng
*/
var RewardTrack = ({ currentXp, currentAttendanceDays, rewards, onSelectReward }) => {
	const sortedRewards = [...rewards].sort((a, b) => a.requiredXp - b.requiredXp);
	const maxXp = Math.max(750, ...sortedRewards.map((r) => r.requiredXp));
	const currentPercent = Math.min(100, Math.max(0, currentXp / maxXp * 100));
	const handleChestClick = (rewardId) => {
		if (onSelectReward) onSelectReward(rewardId);
		else {
			const el = document.getElementById(`chest-card-${rewardId}`);
			if (el) el.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
		}
	};
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "bg-[#FFFDF8] rounded-3xl p-5 sm:p-7 border border-[#E6DCC8] shadow-sm relative overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFF5F0] text-[#2D5A3D] text-[11px] font-bold border border-[#D4E2D7] mb-1",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sprout, { className: "w-3.5 h-3.5 text-[#4D8F5A]" }, void 0, false, {
						fileName: _jsxFileName$5,
						lineNumber: 50,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Hành trình tuần" }, void 0, false, {
						fileName: _jsxFileName$5,
						lineNumber: 51,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$5,
					lineNumber: 49,
					columnNumber: 11
				}, void 0),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
					className: "text-base sm:text-lg font-extrabold text-[#2F3E6B]",
					children: "Đường lên rương kho báu"
				}, void 0, false, {
					fileName: _jsxFileName$5,
					lineNumber: 53,
					columnNumber: 11
				}, void 0),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-xs text-[#5C6A79]",
					children: "Tích lũy XP tuần để tiến bước tới các rương quà lớn hơn"
				}, void 0, false, {
					fileName: _jsxFileName$5,
					lineNumber: 56,
					columnNumber: 11
				}, void 0)
			] }, void 0, true, {
				fileName: _jsxFileName$5,
				lineNumber: 48,
				columnNumber: 9
			}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-center gap-2 self-start sm:self-auto",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "px-3.5 py-1.5 rounded-2xl bg-[#FAF5EB] border border-[#EADBBE] text-center shadow-xs",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "text-[10px] uppercase font-bold text-[#7A6A55] block",
						children: "XP Tuần này"
					}, void 0, false, {
						fileName: _jsxFileName$5,
						lineNumber: 64,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "text-base font-mono font-black text-[#2F3E6B]",
						children: [
							currentXp,
							" / ",
							maxXp,
							" XP"
						]
					}, void 0, true, {
						fileName: _jsxFileName$5,
						lineNumber: 65,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$5,
					lineNumber: 63,
					columnNumber: 11
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "px-3.5 py-1.5 rounded-2xl bg-[#EFF5F0] border border-[#D4E2D7] text-center shadow-xs",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "text-[10px] uppercase font-bold text-[#2D5A3D] block",
						children: "Chuyên cần"
					}, void 0, false, {
						fileName: _jsxFileName$5,
						lineNumber: 70,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
						className: "text-base font-mono font-black text-[#2D5A3D]",
						children: [currentAttendanceDays, "/5 ngày"]
					}, void 0, true, {
						fileName: _jsxFileName$5,
						lineNumber: 71,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$5,
					lineNumber: 69,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$5,
				lineNumber: 62,
				columnNumber: 9
			}, void 0)]
		}, void 0, true, {
			fileName: _jsxFileName$5,
			lineNumber: 47,
			columnNumber: 7
		}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "relative pt-12 pb-6 px-4 sm:px-8 select-none",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "relative h-3 bg-[#EFE9DF] rounded-full overflow-visible border border-[#E2D8C7]",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out",
					style: {
						width: `${currentPercent}%`,
						background: "linear-gradient(90deg, #7FA88A 0%, #E2704A 50%, #F2B84B 100%)"
					}
				}, void 0, false, {
					fileName: _jsxFileName$5,
					lineNumber: 83,
					columnNumber: 11
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-700 pointer-events-none",
					style: { left: `${Math.min(97, Math.max(3, currentPercent))}%` },
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap animate-[bounce_2.5s_ease-in-out_infinite] motion-reduce:animate-none",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "px-2.5 py-1 rounded-full bg-[#1E5238] text-white text-[11px] font-bold shadow-md shadow-[#1E5238]/20 flex items-center gap-1 border border-[#3B7D4E]",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sprout, { className: "w-3.5 h-3.5 text-[#A8D6AF]" }, void 0, false, {
								fileName: _jsxFileName$5,
								lineNumber: 99,
								columnNumber: 17
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [
								"Em ở đây: ",
								currentXp,
								" XP"
							] }, void 0, true, {
								fileName: _jsxFileName$5,
								lineNumber: 100,
								columnNumber: 17
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName$5,
							lineNumber: 98,
							columnNumber: 15
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "w-2 h-2 bg-[#1E5238] rotate-45 mx-auto -mt-1" }, void 0, false, {
							fileName: _jsxFileName$5,
							lineNumber: 103,
							columnNumber: 15
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName$5,
						lineNumber: 97,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "w-6 h-6 rounded-full bg-white border-2 border-[#1E5238] shadow-md flex items-center justify-center",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: "w-2.5 h-2.5 rounded-full bg-[#1E5238]" }, void 0, false, {
							fileName: _jsxFileName$5,
							lineNumber: 108,
							columnNumber: 15
						}, void 0)
					}, void 0, false, {
						fileName: _jsxFileName$5,
						lineNumber: 107,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$5,
					lineNumber: 92,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$5,
				lineNumber: 81,
				columnNumber: 9
			}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "relative w-full mt-3 h-24",
				children: sortedRewards.map((reward) => {
					const tierConfig = getChestTierConfig(reward.requiredXp, reward.tierKey);
					const posPercent = Math.min(96, Math.max(4, reward.requiredXp / maxXp * 100));
					const isReached = currentXp >= reward.requiredXp;
					return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "absolute top-0 -translate-x-1/2 flex flex-col items-center cursor-pointer group",
						style: { left: `${posPercent}%` },
						onClick: () => handleChestClick(reward.id),
						title: `Bấm để xem ${tierConfig.name} (${reward.requiredXp} XP)`,
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { className: `w-1 h-3 -mt-6 rounded-full transition-colors ${isReached ? "bg-[#1E5238]" : "bg-[#C2B7A3]"}` }, void 0, false, {
								fileName: _jsxFileName$5,
								lineNumber: 131,
								columnNumber: 17
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: `mt-2 p-1.5 rounded-2xl transition-all duration-300 transform group-hover:scale-110 ${isReached ? "bg-white border-2 border-[#7FA88A] shadow-md shadow-[#7FA88A]/20 opacity-100" : "bg-[#FAF5EB]/90 border border-[#E2D8C7] opacity-65 group-hover:opacity-90"}`,
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChestIllustration, {
									tier: reward.tierKey,
									state: isReached ? "eligible" : "locked",
									size: 42,
									animationsEnabled: false
								}, void 0, false, {
									fileName: _jsxFileName$5,
									lineNumber: 145,
									columnNumber: 19
								}, void 0), isReached && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[#2F6B4F] text-white flex items-center justify-center text-[10px] shadow-xs",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Check, { className: "w-3 h-3 stroke-[3]" }, void 0, false, {
										fileName: _jsxFileName$5,
										lineNumber: 155,
										columnNumber: 23
									}, void 0)
								}, void 0, false, {
									fileName: _jsxFileName$5,
									lineNumber: 154,
									columnNumber: 21
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName$5,
								lineNumber: 138,
								columnNumber: 17
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-[11px] font-bold text-[#2F3E6B] mt-1.5 text-center leading-tight",
								children: tierConfig.name
							}, void 0, false, {
								fileName: _jsxFileName$5,
								lineNumber: 161,
								columnNumber: 17
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "text-[10px] font-mono font-semibold text-[#8C7A65]",
								children: [reward.requiredXp, " XP"]
							}, void 0, true, {
								fileName: _jsxFileName$5,
								lineNumber: 164,
								columnNumber: 17
							}, void 0)
						]
					}, reward.id, true, {
						fileName: _jsxFileName$5,
						lineNumber: 123,
						columnNumber: 15
					}, void 0);
				})
			}, void 0, false, {
				fileName: _jsxFileName$5,
				lineNumber: 115,
				columnNumber: 9
			}, void 0)]
		}, void 0, true, {
			fileName: _jsxFileName$5,
			lineNumber: 79,
			columnNumber: 7
		}, void 0)]
	}, void 0, true, {
		fileName: _jsxFileName$5,
		lineNumber: 45,
		columnNumber: 5
	}, void 0);
};
//#endregion
//#region src/components/rewards/ChestCard.tsx
var _jsxFileName$4 = "/home/hatch/workspace/Project_MamVan_Edu/src/components/rewards/ChestCard.tsx";
/**
* Component Thẻ Rương Quà Bí Mật:
* - Tuyệt đối KHÔNG hiển thị tên món quà thật hay hình/icon của món quà thật
* - Hiển thị tên rương, nhãn kích cỡ quà, mô tả gợi mở và thanh tiến độ
* - Nút tương ứng 7 trạng thái của luồng nhận quà
*/
var ChestCard = ({ reward, currentXp, currentAttendanceDays, activeRequest, onRequestReward, onOpenChest, animationsEnabled = true }) => {
	const tierConfig = getChestTierConfig(reward.requiredXp, reward.tierKey);
	const xpNeeded = Math.max(0, reward.requiredXp - currentXp);
	const daysNeeded = Math.max(0, reward.requiredAttendanceDays - currentAttendanceDays);
	const isXpMet = currentXp >= reward.requiredXp;
	const isDaysMet = currentAttendanceDays >= reward.requiredAttendanceDays;
	const isEligible = isXpMet && isDaysMet;
	const reqStatus = activeRequest?.status;
	const isPending = reqStatus === "PENDING_APPROVAL";
	const isApproved = reqStatus === "APPROVED";
	const isGiven = reqStatus === "GIVEN";
	const isOpened = reqStatus === "OPENED";
	const isRejected = reqStatus === "REJECTED";
	let visualState = "locked";
	if (isOpened) visualState = "opened";
	else if (isGiven) visualState = "given";
	else if (isApproved) visualState = "approved";
	else if (isPending) visualState = "pending";
	else if (isEligible) visualState = "eligible";
	const xpProgressRatio = Math.min(1, currentXp / reward.requiredXp);
	const daysProgressRatio = Math.min(1, currentAttendanceDays / reward.requiredAttendanceDays);
	const totalProgressPercent = Math.round((xpProgressRatio + daysProgressRatio) / 2 * 100);
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		id: `chest-card-${reward.id}`,
		className: `bg-[#FFFDF8] rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between h-full select-none ${visualState === "eligible" || visualState === "given" ? "border-[#E2704A]/60 shadow-md shadow-[#E2704A]/10 hover:-translate-y-1" : visualState === "approved" ? "border-[#F2B84B]/70 shadow-md shadow-[#F2B84B]/15" : "border-[#E6DCC8] shadow-xs hover:border-[#D4C4A8]"}`,
		"aria-label": `${tierConfig.name} - ${tierConfig.sizeLabel}`,
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-center justify-between gap-2 mb-3",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs",
					style: {
						backgroundColor: tierConfig.badgeBg,
						color: tierConfig.badgeText,
						borderColor: tierConfig.borderColor
					},
					children: tierConfig.sizeLabel
				}, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 84,
					columnNumber: 11
				}, void 0), isOpened ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFF5F0] text-[#2D5A3D] border border-[#D4E2D7]",
					children: "Đã mở rương"
				}, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 97,
					columnNumber: 13
				}, void 0) : isGiven ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF8EC] text-[#9A6B12] border border-[#F8DE9F] animate-pulse",
					children: "Đã trao · Sẵn sàng mở!"
				}, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 101,
					columnNumber: 13
				}, void 0) : isApproved ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EDF1F7] text-[#2F3E6B] border border-[#C7D3E5]",
					children: "Thầy/cô đã duyệt"
				}, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 105,
					columnNumber: 13
				}, void 0) : isPending ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
					className: "text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF5EB] text-[#7A6A55] border border-[#EADBBE]",
					children: "Đang chờ duyệt"
				}, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 109,
					columnNumber: 13
				}, void 0) : null]
			}, void 0, true, {
				fileName: _jsxFileName$4,
				lineNumber: 83,
				columnNumber: 9
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex justify-center items-center py-4 my-1",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChestIllustration, {
					tier: reward.tierKey,
					state: visualState,
					size: tierConfig.baseSizePx,
					animationsEnabled
				}, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 117,
					columnNumber: 11
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName$4,
				lineNumber: 116,
				columnNumber: 9
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "text-center mt-2 mb-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h4", {
					className: "text-lg font-bold text-[#2F3E6B]",
					style: { fontFamily: "'Lora', Georgia, serif" },
					children: tierConfig.name
				}, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 127,
					columnNumber: 11
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-xs text-[#5C6A79] leading-relaxed mt-1 px-1",
					children: reward.teaserDescription || tierConfig.defaultTeaser
				}, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 133,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$4,
				lineNumber: 126,
				columnNumber: 9
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-center justify-center gap-2 mb-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FEF8EC] text-[#9A6B12] border border-[#F8DE9F] text-xs font-bold font-mono",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Flame, { className: "w-3.5 h-3.5 text-[#F2B84B]" }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 141,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [reward.requiredXp, " XP"] }, void 0, true, {
						fileName: _jsxFileName$4,
						lineNumber: 142,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$4,
					lineNumber: 140,
					columnNumber: 11
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#EFF5F0] text-[#2D5A3D] border border-[#D4E2D7] text-xs font-bold font-mono",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Calendar, { className: "w-3.5 h-3.5 text-[#4D8F5A]" }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 145,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: [reward.requiredAttendanceDays, " ngày"] }, void 0, true, {
						fileName: _jsxFileName$4,
						lineNumber: 146,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$4,
					lineNumber: 144,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$4,
				lineNumber: 139,
				columnNumber: 9
			}, void 0)
		] }, void 0, true, {
			fileName: _jsxFileName$4,
			lineNumber: 81,
			columnNumber: 7
		}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "pt-4 border-t border-[#EFE9DF] mt-2 space-y-3",
			children: [
				!isEligible && !isPending && !isApproved && !isGiven && !isOpened && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "space-y-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex justify-between items-center text-[11px] font-semibold text-[#7A6A55]",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Tiến độ mở khóa:" }, void 0, false, {
								fileName: _jsxFileName$4,
								lineNumber: 157,
								columnNumber: 15
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
								className: "font-mono font-bold text-[#2F3E6B]",
								children: [
									currentXp,
									"/",
									reward.requiredXp,
									" XP · ",
									currentAttendanceDays,
									"/",
									reward.requiredAttendanceDays,
									" ngày"
								]
							}, void 0, true, {
								fileName: _jsxFileName$4,
								lineNumber: 158,
								columnNumber: 15
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName$4,
							lineNumber: 156,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "w-full h-2 bg-[#EFE9DF] rounded-full overflow-hidden",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "h-full rounded-full transition-all duration-500",
								style: {
									width: `${totalProgressPercent}%`,
									background: "linear-gradient(90deg, #7FA88A 0%, #E2704A 100%)"
								}
							}, void 0, false, {
								fileName: _jsxFileName$4,
								lineNumber: 164,
								columnNumber: 15
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName$4,
							lineNumber: 163,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							disabled: true,
							className: "w-full py-2.5 px-3 rounded-2xl bg-[#FAF5EB] border border-[#EADBBE] text-[#8C7A65] text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80",
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Lock, { className: "w-3.5 h-3.5 text-[#A69782]" }, void 0, false, {
								fileName: _jsxFileName$4,
								lineNumber: 177,
								columnNumber: 15
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: xpNeeded > 0 && daysNeeded > 0 ? `Còn thiếu ${xpNeeded} XP & ${daysNeeded} ngày` : xpNeeded > 0 ? `Còn thiếu ${xpNeeded} XP tuần` : `Cần điểm danh thêm ${daysNeeded} ngày` }, void 0, false, {
								fileName: _jsxFileName$4,
								lineNumber: 178,
								columnNumber: 15
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName$4,
							lineNumber: 173,
							columnNumber: 13
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName$4,
					lineNumber: 155,
					columnNumber: 11
				}, void 0),
				isEligible && (!activeRequest || isRejected) && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "space-y-2",
					children: [isRejected && activeRequest?.rejectReason && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "p-2.5 rounded-xl bg-[#FAF5EB] border border-[#EADBBE] text-[11px] text-[#7A6A55] flex items-start gap-1.5 leading-snug",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleAlert, { className: "w-3.5 h-3.5 text-[#E2704A] shrink-0 mt-0.5" }, void 0, false, {
							fileName: _jsxFileName$4,
							lineNumber: 194,
							columnNumber: 17
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: ["Lời nhắn: ", activeRequest.rejectReason] }, void 0, true, {
							fileName: _jsxFileName$4,
							lineNumber: 195,
							columnNumber: 17
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName$4,
						lineNumber: 193,
						columnNumber: 15
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
						onClick: () => onRequestReward(reward.id),
						className: "w-full py-3 px-4 rounded-2xl text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-[0.99]",
						style: {
							backgroundColor: "#E2704A",
							boxShadow: "0 4px 12px rgba(226, 112, 74, 0.28)"
						},
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Send, { className: "w-3.5 h-3.5" }, void 0, false, {
							fileName: _jsxFileName$4,
							lineNumber: 206,
							columnNumber: 15
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Gửi yêu cầu mở rương tới thầy/cô" }, void 0, false, {
							fileName: _jsxFileName$4,
							lineNumber: 207,
							columnNumber: 15
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName$4,
						lineNumber: 198,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$4,
					lineNumber: 191,
					columnNumber: 11
				}, void 0),
				isPending && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "w-full py-3 px-4 rounded-2xl bg-[#FAF5EB] border border-[#EADBBE] text-[#7A6A55] text-xs font-bold text-center flex items-center justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Clock, { className: "w-4 h-4 text-[#C98A2C] animate-spin" }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 215,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Đang chờ thầy/cô duyệt..." }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 216,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$4,
					lineNumber: 214,
					columnNumber: 11
				}, void 0),
				isApproved && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "w-full py-3 px-4 rounded-2xl bg-[#FEF8EC] border border-[#F8DE9F] text-[#9A6B12] text-xs font-bold text-center flex items-center justify-center gap-2 shadow-xs",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "w-4 h-4 text-[#F2B84B] animate-pulse" }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 223,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Đã duyệt! Chờ thầy/cô trao rương" }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 224,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$4,
					lineNumber: 222,
					columnNumber: 11
				}, void 0),
				isGiven && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					onClick: () => onOpenChest(reward, activeRequest),
					className: "w-full py-3.5 px-4 rounded-2xl text-white text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] animate-[pulse_2s_infinite]",
					style: {
						background: "linear-gradient(135deg, #E2704A 0%, #F2B84B 100%)",
						boxShadow: "0 6px 18px rgba(242, 184, 75, 0.35)"
					},
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Gift, { className: "w-4 h-4 text-[#FFFDF8]" }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 238,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Mở rương ngay!" }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 239,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$4,
					lineNumber: 230,
					columnNumber: 11
				}, void 0),
				isOpened && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "w-full py-2.5 px-3 rounded-2xl bg-[#EFF5F0] border border-[#D4E2D7] text-[#2D5A3D] text-xs font-bold text-center flex items-center justify-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "w-3.5 h-3.5 text-[#4D8F5A]" }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 246,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Đã nhận quà · Xem trong bộ sưu tập" }, void 0, false, {
						fileName: _jsxFileName$4,
						lineNumber: 247,
						columnNumber: 13
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$4,
					lineNumber: 245,
					columnNumber: 11
				}, void 0)
			]
		}, void 0, true, {
			fileName: _jsxFileName$4,
			lineNumber: 152,
			columnNumber: 7
		}, void 0)]
	}, void 0, true, {
		fileName: _jsxFileName$4,
		lineNumber: 69,
		columnNumber: 5
	}, void 0);
};
//#endregion
//#region src/components/rewards/ChestOpeningModal.tsx
var _jsxFileName$3 = "/home/hatch/workspace/Project_MamVan_Edu/src/components/rewards/ChestOpeningModal.tsx";
/**
* Hiệu ứng âm thanh procedural chuông reo vui tai khi mở rương
*/
function playChestFanfare() {
	try {
		const AudioCtx = window.AudioContext || window.webkitAudioContext;
		if (!AudioCtx) return;
		const ctx = new AudioCtx();
		[
			523.25,
			659.25,
			783.99,
			1046.5
		].forEach((freq, idx) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "triangle";
			osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * .09);
			gain.gain.setValueAtTime(.18, ctx.currentTime + idx * .09);
			gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + idx * .09 + .5);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(ctx.currentTime + idx * .09);
			osc.stop(ctx.currentTime + idx * .09 + .55);
		});
	} catch {}
}
/**
* Modal hoạt ảnh "Mở Rương Bí Mật":
* - Nắp rương bật mở, ánh sáng và tia sao tỏa ra
* - Mầm Mực chúc mừng (cheer)
* - ĐÂY LÀ NƠI DUY NHẤT VÀ LẦN ĐẦU TIÊN món quà thật (secret) được tiết lộ cho học sinh!
*/
var ChestOpeningModal = ({ reward, request, isOpen, onClose, onConfirmClaim, soundEnabled = true, animationsEnabled = true }) => {
	const [phase, setPhase] = (0, import_react.useState)("opening");
	const tierConfig = getChestTierConfig(reward.requiredXp, reward.tierKey);
	(0, import_react.useEffect)(() => {
		if (isOpen) {
			setPhase("opening");
			if (soundEnabled) playChestFanfare();
			const timer = setTimeout(() => {
				setPhase("revealed");
			}, animationsEnabled ? 950 : 200);
			return () => clearTimeout(timer);
		}
	}, [
		isOpen,
		soundEnabled,
		animationsEnabled
	]);
	if (!isOpen) return null;
	const handleCollect = () => {
		onConfirmClaim(reward.id, request.id);
		onClose();
	};
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "chest-reveal-title",
		className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B4B]/60 backdrop-blur-md animate-[fadeIn_0.2s_ease]",
		children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "relative w-full max-w-lg bg-[#FFFDF8] rounded-3xl p-6 sm:p-8 border-2 border-[#E6DCC8] shadow-2xl overflow-hidden text-[#1E1B4B] text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40",
					style: { background: tierConfig.glowColor }
				}, void 0, false, {
					fileName: _jsxFileName$3,
					lineNumber: 91,
					columnNumber: 9
				}, void 0),
				/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
					onClick: phase === "revealed" ? handleCollect : onClose,
					className: "absolute top-4 right-4 p-2 rounded-full text-[#7A6A55] hover:bg-[#FAF5EB] transition-colors",
					title: "Đóng",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(X, { className: "w-5 h-5" }, void 0, false, {
						fileName: _jsxFileName$3,
						lineNumber: 103,
						columnNumber: 11
					}, void 0)
				}, void 0, false, {
					fileName: _jsxFileName$3,
					lineNumber: 98,
					columnNumber: 9
				}, void 0),
				phase === "opening" && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "py-8 flex flex-col items-center justify-center space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "relative",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChestIllustration, {
								tier: reward.tierKey,
								state: "opened",
								size: 150,
								animationsEnabled
							}, void 0, false, {
								fileName: _jsxFileName$3,
								lineNumber: 110,
								columnNumber: 15
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName$3,
							lineNumber: 109,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
							className: "text-xl font-black text-[#2F3E6B] animate-pulse",
							children: [
								"Đang mở ",
								tierConfig.name,
								"..."
							]
						}, void 0, true, {
							fileName: _jsxFileName$3,
							lineNumber: 117,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-xs text-[#5C6A79]",
							children: "Điều bất ngờ chuẩn bị xuất hiện!"
						}, void 0, false, {
							fileName: _jsxFileName$3,
							lineNumber: 120,
							columnNumber: 13
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName$3,
					lineNumber: 108,
					columnNumber: 11
				}, void 0),
				phase === "revealed" && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "py-2 flex flex-col items-center space-y-5 animate-[scaleUp_0.4s_ease]",
					children: [
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "flex items-center justify-center",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MamMuc, {
								mood: "cheer",
								size: "md"
							}, void 0, false, {
								fileName: _jsxFileName$3,
								lineNumber: 129,
								columnNumber: 15
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName$3,
							lineNumber: 128,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF8EC] text-[#9A6B12] border border-[#F8DE9F] text-xs font-bold mb-2 shadow-2xs",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "w-3.5 h-3.5 text-[#F2B84B]" }, void 0, false, {
									fileName: _jsxFileName$3,
									lineNumber: 135,
									columnNumber: 17
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Bí mật đã được bật mí!" }, void 0, false, {
									fileName: _jsxFileName$3,
									lineNumber: 136,
									columnNumber: 17
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName$3,
								lineNumber: 134,
								columnNumber: 15
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
								id: "chest-reveal-title",
								className: "text-2xl font-black text-[#2F3E6B] tracking-tight",
								style: { fontFamily: "'Lora', Georgia, serif" },
								children: "Chúc mừng em đã nhận quà!"
							}, void 0, false, {
								fileName: _jsxFileName$3,
								lineNumber: 138,
								columnNumber: 15
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-xs text-[#5C6A79] mt-0.5",
								children: [
									"Phần quà từ ",
									tierConfig.name,
									" do thầy/cô gửi tặng"
								]
							}, void 0, true, {
								fileName: _jsxFileName$3,
								lineNumber: 145,
								columnNumber: 15
							}, void 0)
						] }, void 0, true, {
							fileName: _jsxFileName$3,
							lineNumber: 133,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "w-full p-5 rounded-2xl bg-[#FAF5EB] border-2 border-[#EADBBE] shadow-xs text-left relative overflow-hidden",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex items-start gap-3.5",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "w-12 h-12 rounded-2xl bg-white border border-[#E6DCC8] flex items-center justify-center shrink-0 shadow-2xs",
									children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Award, { className: "w-6 h-6 text-[#E2704A]" }, void 0, false, {
										fileName: _jsxFileName$3,
										lineNumber: 154,
										columnNumber: 19
									}, void 0)
								}, void 0, false, {
									fileName: _jsxFileName$3,
									lineNumber: 153,
									columnNumber: 17
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
									className: "flex-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
											className: "text-[10px] uppercase font-bold text-[#E2704A] tracking-wider block mb-0.5",
											children: "Món quà của em:"
										}, void 0, false, {
											fileName: _jsxFileName$3,
											lineNumber: 157,
											columnNumber: 19
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h4", {
											className: "text-base sm:text-lg font-bold text-[#2F3E6B]",
											style: { fontFamily: "'Lora', Georgia, serif" },
											children: reward.secret.name
										}, void 0, false, {
											fileName: _jsxFileName$3,
											lineNumber: 160,
											columnNumber: 19
										}, void 0),
										/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
											className: "text-xs text-[#5C6A79] leading-relaxed mt-1",
											children: reward.secret.description
										}, void 0, false, {
											fileName: _jsxFileName$3,
											lineNumber: 166,
											columnNumber: 19
										}, void 0)
									]
								}, void 0, true, {
									fileName: _jsxFileName$3,
									lineNumber: 156,
									columnNumber: 17
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName$3,
								lineNumber: 152,
								columnNumber: 15
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName$3,
							lineNumber: 151,
							columnNumber: 13
						}, void 0),
						/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
							onClick: handleCollect,
							className: "w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-[0.99]",
							style: {
								backgroundColor: "#2D6846",
								boxShadow: "0 4px 14px rgba(45, 104, 70, 0.3)"
							},
							children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheckBig, { className: "w-4 h-4" }, void 0, false, {
								fileName: _jsxFileName$3,
								lineNumber: 182,
								columnNumber: 15
							}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Đưa vào bộ sưu tập \"Rương đã mở\"" }, void 0, false, {
								fileName: _jsxFileName$3,
								lineNumber: 183,
								columnNumber: 15
							}, void 0)]
						}, void 0, true, {
							fileName: _jsxFileName$3,
							lineNumber: 174,
							columnNumber: 13
						}, void 0)
					]
				}, void 0, true, {
					fileName: _jsxFileName$3,
					lineNumber: 126,
					columnNumber: 11
				}, void 0)
			]
		}, void 0, true, {
			fileName: _jsxFileName$3,
			lineNumber: 89,
			columnNumber: 7
		}, void 0)
	}, void 0, false, {
		fileName: _jsxFileName$3,
		lineNumber: 83,
		columnNumber: 5
	}, void 0);
};
//#endregion
//#region src/components/rewards/OpenedChestsCollection.tsx
var _jsxFileName$2 = "/home/hatch/workspace/Project_MamVan_Edu/src/components/rewards/OpenedChestsCollection.tsx";
/**
* Mục "Rương đã mở" (Bộ sưu tập quà tặng đã tiết lộ):
* - Hiển thị các rương học sinh đã nhận và đã mở
* - Tiết lộ tên món quà thật, ngày nhận và biểu tượng rương đã mở
*/
var OpenedChestsCollection = ({ openedRequests }) => {
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "bg-[#FFFDF8] rounded-3xl p-6 sm:p-7 border border-[#E6DCC8] shadow-xs",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex items-center justify-between mb-4 pb-3 border-b border-[#EFE9DF]",
			children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "w-8 h-8 rounded-xl bg-[#EFF5F0] border border-[#D4E2D7] flex items-center justify-center text-[#2D5A3D]",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "w-4 h-4 text-[#4D8F5A]" }, void 0, false, {
						fileName: _jsxFileName$2,
						lineNumber: 28,
						columnNumber: 13
					}, void 0)
				}, void 0, false, {
					fileName: _jsxFileName$2,
					lineNumber: 27,
					columnNumber: 11
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
					className: "text-base sm:text-lg font-bold text-[#2F3E6B]",
					style: { fontFamily: "'Lora', Georgia, serif" },
					children: [
						"Rương đã mở (",
						openedRequests.length,
						")"
					]
				}, void 0, true, {
					fileName: _jsxFileName$2,
					lineNumber: 31,
					columnNumber: 13
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
					className: "text-xs text-[#5C6A79]",
					children: "Bộ sưu tập những món quà em đã khám phá và nhận từ thầy/cô"
				}, void 0, false, {
					fileName: _jsxFileName$2,
					lineNumber: 37,
					columnNumber: 13
				}, void 0)] }, void 0, true, {
					fileName: _jsxFileName$2,
					lineNumber: 30,
					columnNumber: 11
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 26,
				columnNumber: 9
			}, void 0)
		}, void 0, false, {
			fileName: _jsxFileName$2,
			lineNumber: 25,
			columnNumber: 7
		}, void 0), openedRequests.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "text-center py-8 px-4 flex flex-col items-center justify-center",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(MamMuc, {
				mood: "thinking",
				size: "md",
				className: "mb-2"
			}, void 0, false, {
				fileName: _jsxFileName$2,
				lineNumber: 46,
				columnNumber: 11
			}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "text-xs text-[#7A6A55] font-medium",
				children: "Em chưa mở rương quà nào. Hãy tích lũy XP tuần này và xin thầy/cô trao rương nhé!"
			}, void 0, false, {
				fileName: _jsxFileName$2,
				lineNumber: 47,
				columnNumber: 11
			}, void 0)]
		}, void 0, true, {
			fileName: _jsxFileName$2,
			lineNumber: 45,
			columnNumber: 9
		}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "grid grid-cols-1 sm:grid-cols-2 gap-3.5",
			children: openedRequests.map(({ request, reward }) => {
				const tierConfig = getChestTierConfig(reward.requiredXp, reward.tierKey);
				const dateStr = new Date(request.openedAt || request.givenAt || request.requestedAt).toLocaleDateString("vi-VN");
				return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "p-4 rounded-2xl bg-[#FAF5EB] border border-[#EADBBE] flex items-center gap-3.5 shadow-2xs hover:border-[#D8C6A5] transition-all",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "w-14 h-14 rounded-2xl bg-white border border-[#E6DCC8] flex items-center justify-center shrink-0 shadow-xs",
						children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChestIllustration, {
							tier: reward.tierKey,
							state: "opened",
							size: 48,
							animationsEnabled: false
						}, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 64,
							columnNumber: 19
						}, void 0)
					}, void 0, false, {
						fileName: _jsxFileName$2,
						lineNumber: 63,
						columnNumber: 17
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex-1 min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
								className: "flex items-center gap-1.5 mb-1",
								children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-[10px] font-bold px-2 py-0.2 rounded-md border",
									style: {
										backgroundColor: tierConfig.badgeBg,
										color: tierConfig.badgeText,
										borderColor: tierConfig.borderColor
									},
									children: tierConfig.name
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 75,
									columnNumber: 21
								}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "text-[10px] text-[#8C7A65] flex items-center gap-0.5 font-mono",
									children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Calendar, { className: "w-3 h-3 text-[#A69782]" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 86,
										columnNumber: 23
									}, void 0), dateStr]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 85,
									columnNumber: 21
								}, void 0)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 74,
								columnNumber: 19
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h4", {
								className: "text-sm font-bold text-[#2F3E6B] truncate",
								style: { fontFamily: "'Lora', Georgia, serif" },
								children: reward.secret.name
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 91,
								columnNumber: 19
							}, void 0),
							/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
								className: "text-xs text-[#5C6A79] truncate mt-0.5",
								children: reward.secret.description
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 97,
								columnNumber: 19
							}, void 0)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 73,
						columnNumber: 17
					}, void 0)]
				}, request.id, true, {
					fileName: _jsxFileName$2,
					lineNumber: 58,
					columnNumber: 15
				}, void 0);
			})
		}, void 0, false, {
			fileName: _jsxFileName$2,
			lineNumber: 52,
			columnNumber: 9
		}, void 0)]
	}, void 0, true, {
		fileName: _jsxFileName$2,
		lineNumber: 24,
		columnNumber: 5
	}, void 0);
};
//#endregion
//#region src/components/rewards/RequestHistory.tsx
var _jsxFileName$1 = "/home/hatch/workspace/Project_MamVan_Edu/src/components/rewards/RequestHistory.tsx";
var RequestHistory = ({ requests, rewards, onOpenChest }) => {
	const getStatusBadge = (status, req, reward) => {
		switch (status) {
			case "OPENED": return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
				className: "px-3 py-1 rounded-full text-xs font-bold bg-[#EFF5F0] border border-[#D4E2D7] text-[#2D5A3D] flex items-center gap-1.5 shadow-2xs",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleCheck, { className: "w-3.5 h-3.5 text-[#4D8F5A]" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 23,
					columnNumber: 13
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Đã mở rương" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 24,
					columnNumber: 13
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$1,
				lineNumber: 22,
				columnNumber: 11
			}, void 0);
			case "GIVEN": return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("button", {
				onClick: () => reward && onOpenChest?.(reward, req),
				className: "px-3.5 py-1.5 rounded-full text-xs font-extrabold text-white flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95 animate-pulse",
				style: { background: "linear-gradient(135deg, #E2704A 0%, #F2B84B 100%)" },
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Gift, { className: "w-3.5 h-3.5" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 36,
					columnNumber: 13
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Mở rương ngay!" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 37,
					columnNumber: 13
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$1,
				lineNumber: 29,
				columnNumber: 11
			}, void 0);
			case "APPROVED": return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
				className: "px-3 py-1 rounded-full text-xs font-bold bg-[#FEF8EC] border border-[#F8DE9F] text-[#9A6B12] flex items-center gap-1.5 shadow-2xs",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Sparkles, { className: "w-3.5 h-3.5 text-[#F2B84B]" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 43,
					columnNumber: 13
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Đã duyệt (Chờ trao)" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 44,
					columnNumber: 13
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$1,
				lineNumber: 42,
				columnNumber: 11
			}, void 0);
			case "PENDING_APPROVAL": return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
				className: "px-3 py-1 rounded-full text-xs font-bold bg-[#FAF5EB] border border-[#EADBBE] text-[#7A6A55] flex items-center gap-1.5 shadow-2xs",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(Clock, { className: "w-3.5 h-3.5 text-[#C98A2C]" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 50,
					columnNumber: 13
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Chờ thầy/cô duyệt" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 51,
					columnNumber: 13
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$1,
				lineNumber: 49,
				columnNumber: 11
			}, void 0);
			case "REJECTED": return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
				className: "px-3 py-1 rounded-full text-xs font-bold bg-[#FAF5EB] border border-[#EADBBE] text-[#8C7A65] flex items-center gap-1.5 shadow-2xs",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(CircleAlert, { className: "w-3.5 h-3.5 text-[#E2704A]" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 57,
					columnNumber: 13
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Cần cố gắng thêm" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 58,
					columnNumber: 13
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$1,
				lineNumber: 56,
				columnNumber: 11
			}, void 0);
			default: return null;
		}
	};
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "bg-[#FFFDF8] rounded-3xl p-6 sm:p-7 border border-[#E6DCC8] shadow-xs",
		children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "flex items-center gap-2 mb-4 pb-3 border-b border-[#EFE9DF]",
			children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "w-8 h-8 rounded-xl bg-[#FAF5EB] border border-[#EADBBE] flex items-center justify-center text-[#7A6A55]",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(History, { className: "w-4 h-4 text-[#8C7A65]" }, void 0, false, {
					fileName: _jsxFileName$1,
					lineNumber: 70,
					columnNumber: 11
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName$1,
				lineNumber: 69,
				columnNumber: 9
			}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
				className: "text-base sm:text-lg font-bold text-[#2F3E6B]",
				style: { fontFamily: "'Lora', Georgia, serif" },
				children: [
					"Lịch sử đề xuất nhận quà (",
					requests.length,
					")"
				]
			}, void 0, true, {
				fileName: _jsxFileName$1,
				lineNumber: 73,
				columnNumber: 11
			}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
				className: "text-xs text-[#5C6A79]",
				children: "Theo dõi trạng thái duyệt và trao quà của giáo viên"
			}, void 0, false, {
				fileName: _jsxFileName$1,
				lineNumber: 79,
				columnNumber: 11
			}, void 0)] }, void 0, true, {
				fileName: _jsxFileName$1,
				lineNumber: 72,
				columnNumber: 9
			}, void 0)]
		}, void 0, true, {
			fileName: _jsxFileName$1,
			lineNumber: 68,
			columnNumber: 7
		}, void 0), requests.length === 0 ? /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "text-center py-6 text-xs text-[#8C7A65] italic",
			children: "Em chưa gửi yêu cầu nhận quà nào. Hãy tích lũy đủ XP và ngày học để gửi thầy/cô nhé!"
		}, void 0, false, {
			fileName: _jsxFileName$1,
			lineNumber: 86,
			columnNumber: 9
		}, void 0) : /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
			className: "space-y-3",
			children: requests.map((req) => {
				const reward = rewards.find((r) => r.id === req.rewardId);
				const tierConfig = reward ? getChestTierConfig(reward.requiredXp, reward.tierKey) : null;
				const isOpened = req.status === "OPENED";
				const titleDisplay = isOpened ? reward?.secret.name || "Quà tặng" : `Quà bí mật (${tierConfig?.name || "Rương quà"})`;
				return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "p-4 rounded-2xl border border-[#EADBBE] bg-[#FAF5EB]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:bg-[#FAF5EB] transition-colors",
					children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center gap-3.5",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "w-11 h-11 rounded-xl bg-white border border-[#E6DCC8] flex items-center justify-center shrink-0 shadow-xs",
							children: reward && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChestIllustration, {
								tier: reward.tierKey,
								state: isOpened ? "opened" : req.status === "APPROVED" ? "approved" : req.status === "GIVEN" ? "given" : "locked",
								size: 36,
								animationsEnabled: false
							}, void 0, false, {
								fileName: _jsxFileName$1,
								lineNumber: 111,
								columnNumber: 23
							}, void 0)
						}, void 0, false, {
							fileName: _jsxFileName$1,
							lineNumber: 109,
							columnNumber: 19
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h4", {
							className: "text-sm font-bold text-[#2F3E6B]",
							style: { fontFamily: "'Lora', Georgia, serif" },
							children: titleDisplay
						}, void 0, false, {
							fileName: _jsxFileName$1,
							lineNumber: 120,
							columnNumber: 21
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
							className: "text-[11px] text-[#7A6A55] mt-0.5",
							children: [
								"Gửi lúc: ",
								new Date(req.requestedAt).toLocaleDateString("vi-VN"),
								req.rejectReason && req.status === "REJECTED" && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", {
									className: "block text-[#B84E2A] mt-0.5 font-medium",
									children: ["Lời nhắn: ", req.rejectReason]
								}, void 0, true, {
									fileName: _jsxFileName$1,
									lineNumber: 129,
									columnNumber: 25
								}, void 0)
							]
						}, void 0, true, {
							fileName: _jsxFileName$1,
							lineNumber: 126,
							columnNumber: 21
						}, void 0)] }, void 0, true, {
							fileName: _jsxFileName$1,
							lineNumber: 119,
							columnNumber: 19
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName$1,
						lineNumber: 108,
						columnNumber: 17
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "flex items-center gap-3 self-end sm:self-auto",
						children: getStatusBadge(req.status, req, reward)
					}, void 0, false, {
						fileName: _jsxFileName$1,
						lineNumber: 137,
						columnNumber: 17
					}, void 0)]
				}, req.id, true, {
					fileName: _jsxFileName$1,
					lineNumber: 104,
					columnNumber: 15
				}, void 0);
			})
		}, void 0, false, {
			fileName: _jsxFileName$1,
			lineNumber: 90,
			columnNumber: 9
		}, void 0)]
	}, void 0, true, {
		fileName: _jsxFileName$1,
		lineNumber: 67,
		columnNumber: 5
	}, void 0);
};
//#endregion
//#region src/screens/RewardsScreen.tsx
var _jsxFileName = "/home/hatch/workspace/Project_MamVan_Edu/src/screens/RewardsScreen.tsx";
/**
* Màn hình "Rương Quà Bí Mật" (RewardsScreen)
* - Phong cách Giấy & Mực
* - Học sinh không được biết trước món quà thật
* - Mỗi mốc quà là một chiếc rương với hình ảnh, tên và kích thước tăng dần
* - Hiển thị "Đường lên rương", lưới rương bí mật, bộ sưu tập "Rương đã mở" và lịch sử đề xuất
*/
var RewardsScreen = ({ state, onRequestReward, onClaimRewardChest }) => {
	const { data: dbRewards } = useLiveQuery(() => rewardService.getRewards(), ["reward"]);
	const [studentTeacherId, setStudentTeacherId] = (0, import_react.useState)(void 0);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		(async () => {
			try {
				const classId = (await studentService.getStudentById(state.profile.id))?.class_id;
				if (!classId) {
					if (!cancelled) setStudentTeacherId(null);
					return;
				}
				const classes = await classService.getClasses();
				if (!cancelled) setStudentTeacherId(classes.find((c) => c.id === classId)?.teacherId ?? null);
			} catch {
				if (!cancelled) setStudentTeacherId(null);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [state.profile.id]);
	const sortedRewards = (0, import_react.useMemo)(() => {
		if (studentTeacherId === void 0) return [...REWARDS_CATALOG].sort((a, b) => a.requiredXp - b.requiredXp);
		return mergeRewardTiers(filterDbRewardsForOwner(dbRewards || [], studentTeacherId));
	}, [dbRewards, studentTeacherId]);
	const [openingTarget, setOpeningTarget] = (0, import_react.useState)(null);
	const handleOpenChest = (reward, request) => {
		setOpeningTarget({
			reward,
			request
		});
	};
	const handleConfirmClaim = (rewardId, requestId) => {
		if (onClaimRewardChest) onClaimRewardChest(rewardId, requestId);
	};
	const openedRequests = state.rewardRequests.filter((req) => req.status === "OPENED").map((req) => ({
		request: req,
		reward: sortedRewards.find((r) => r.id === req.rewardId) || {
			id: req.rewardId,
			requiredXp: 0,
			xpCost: 0,
			requiredAttendanceDays: 0,
			tierKey: "HAT",
			teaserDescription: "",
			secret: {
				name: "Phần quà từ thầy/cô",
				description: "Món quà đặc biệt do thầy/cô trao tặng."
			},
			isPhysical: false
		}
	}));
	return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
		className: "w-full max-w-5xl mx-auto py-6 px-4 sm:px-8 space-y-7 text-[#1E1B4B]",
		children: [
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6DCC8] pb-5",
				children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
						className: "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF5EB] border border-[#EADBBE] text-xs font-bold text-[#7A6A55] mb-2 shadow-2xs",
						children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChestIllustration, {
							tier: "HAT",
							state: "eligible",
							size: 18,
							animationsEnabled: false
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 106,
							columnNumber: 13
						}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("span", { children: "Phần thưởng bí mật của Thầy/Cô" }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 107,
							columnNumber: 13
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 104,
						columnNumber: 11
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h2", {
						className: "text-2xl sm:text-3xl font-extrabold text-[#2F3E6B] tracking-tight",
						style: { fontFamily: "'Lora', Georgia, serif" },
						children: "Rương quà bí mật"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 109,
						columnNumber: 11
					}, void 0),
					/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-xs sm:text-sm text-[#5C6A79] mt-1",
						children: "Học đều mỗi tuần để mở những món quà bất ngờ từ thầy/cô."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 115,
						columnNumber: 11
					}, void 0)
				] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 103,
					columnNumber: 9
				}, void 0)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 102,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(RewardTrack, {
				currentXp: state.xpWeek,
				currentAttendanceDays: state.attendanceDaysThisWeek,
				rewards: sortedRewards
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 122,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "flex items-center justify-between",
					children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", { children: [/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("h3", {
						className: "text-lg sm:text-xl font-bold text-[#2F3E6B]",
						style: { fontFamily: "'Lora', Georgia, serif" },
						children: "Các cấp rương tuần này"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 132,
						columnNumber: 13
					}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("p", {
						className: "text-xs text-[#5C6A79]",
						children: "Mốc XP càng cao, rương càng lộng lẫy và chứa đựng món quà càng giá trị!"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 138,
						columnNumber: 13
					}, void 0)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 131,
						columnNumber: 11
					}, void 0)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 130,
					columnNumber: 9
				}, void 0), /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch",
					children: sortedRewards.map((reward) => {
						const activeRequest = state.rewardRequests.find((r) => r.rewardId === reward.id && r.status !== "REJECTED") || state.rewardRequests.find((r) => r.rewardId === reward.id);
						return /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)("div", {
							className: "h-full flex flex-col",
							children: /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChestCard, {
								reward,
								currentXp: state.xpWeek,
								currentAttendanceDays: state.attendanceDaysThisWeek,
								activeRequest,
								onRequestReward,
								onOpenChest: handleOpenChest,
								animationsEnabled: state.animationsEnabled
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 154,
								columnNumber: 17
							}, void 0)
						}, reward.id, false, {
							fileName: _jsxFileName,
							lineNumber: 153,
							columnNumber: 15
						}, void 0);
					})
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 145,
					columnNumber: 9
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 129,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(OpenedChestsCollection, { openedRequests }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 170,
				columnNumber: 7
			}, void 0),
			/* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(RequestHistory, {
				requests: state.rewardRequests,
				rewards: sortedRewards,
				onOpenChest: handleOpenChest
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 173,
				columnNumber: 7
			}, void 0),
			openingTarget && /* @__PURE__ */ (0, import_jsx_dev_runtime.jsxDEV)(ChestOpeningModal, {
				reward: openingTarget.reward,
				request: openingTarget.request,
				isOpen: true,
				onClose: () => setOpeningTarget(null),
				onConfirmClaim: handleConfirmClaim,
				soundEnabled: state.soundEnabled,
				animationsEnabled: state.animationsEnabled
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 181,
				columnNumber: 9
			}, void 0)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 100,
		columnNumber: 5
	}, void 0);
};
//#endregion
export { RewardsScreen, RewardsScreen as default };
