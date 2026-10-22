/**
 * Hệ thống hằng số nghiệp vụ cho Mầm Văn (Ngữ văn 7)
 * Dễ dàng tùy chỉnh cấu hình XP, thời gian, ngưỡng Mastery và các giai đoạn Cây
 */

export const APP_NAME = 'Mầm Văn';
export const MASCOT_NAME = 'Mầm Văn';

// XP Cấu hình
// LƯU Ý: mô hình XP hiện hành (chủ dự án chốt 21–22/10) KHÔNG còn trần XP
// ngày/tuần — các hằng trần cũ (130/150/900) đã gỡ hẳn để không nơi nào còn
// hiển thị/áp dụng giới hạn đã bãi bỏ. XP chỉ còn: điểm danh ngày (dưới đây),
// quỹ XP của chủ đề và XP của từng bài kiểm tra/bài được giao.
export const XP_CONFIG = {
  // Điểm danh
  ATTENDANCE_DAILY_XP: 2,

  // Luồng Video
  VIDEO_WATCH_80_PERCENT_XP: 5,
  VIDEO_SUMMARY_READ_XP: 2,
  VIDEO_PRACTICE_COMPLETED_XP: 5,
  VIDEO_QUICK_TEST_XP: 8,
  VIDEO_MASTERY_CHECK_XP: 8,
  VIDEO_FULL_COMPLETION_XP: 20, // Tổng video luồng hoàn chỉnh = 48 XP

  // Luồng Lý thuyết
  THEORY_READ_UNDERSTOOD_XP: 10,
  THEORY_PRACTICE_COMPLETED_XP: 5,
  THEORY_TEST_XP: 8,
  THEORY_TEST_2_XP: 8,
  THEORY_FULL_COMPLETION_XP: 10, // Tổng lý thuyết luồng hoàn chỉnh = 41 XP

  // BTVN & Ôn tập
  HOMEWORK_COMPLETED_XP: 20,
  REVIEW_WEAK_AREA_XP: 3, // Thưởng khi ôn lại phần yếu và nâng cao điểm (tối đa 1 lần/chủ đề)
};

// Tổng XP tối đa của một luồng học Video hoàn chỉnh
export const TOTAL_VIDEO_XP =
  XP_CONFIG.VIDEO_WATCH_80_PERCENT_XP +
  XP_CONFIG.VIDEO_SUMMARY_READ_XP +
  XP_CONFIG.VIDEO_PRACTICE_COMPLETED_XP +
  XP_CONFIG.VIDEO_QUICK_TEST_XP +
  XP_CONFIG.VIDEO_MASTERY_CHECK_XP +
  XP_CONFIG.VIDEO_FULL_COMPLETION_XP; // 48 XP

// Cấu hình thời gian
export const TIME_CONFIG = {
  // Đo thời gian học tích cực
  IDLE_LIMIT_SECONDS: 240, // 4 phút (240s) không thao tác thì tự tạm dừng bộ đếm
  BREAK_REMINDER_MINUTES: 45, // 45 phút học tích cực liên tục thì nhắc nghỉ nhẹ nhàng
  
  // Thời gian đọc tối thiểu
  MIN_THEORY_READ_SECONDS: 25, // Tối thiểu 25s trước khi nút "Đã hiểu" bật
  MIN_SUMMARY_READ_SECONDS: 15, // Tối thiểu 15s đọc tóm tắt trọng tâm
  
  // Kiểm tra thời lượng mặc định
  QUICK_TEST_MINUTES: 7, // 5 câu / 7 phút
  MASTERY_CHECK_MINUTES: 15, // 10 câu / 15 phút
  
  // Thời gian chờ giáo viên chấm bài viết (hiển thị ước tính)
  ESSAY_REVIEW_ESTIMATED_HOURS: 48,
};

// Cấu hình Mastery (Năng lực)
export const MASTERY_CONFIG = {
  MIN_QUESTIONS_REQUIRED: 5, // Cần tối thiểu 5 câu mỗi mức mới kết luận
  WEIGHT_DECAY_FACTOR: 0.88, // Hệ số giảm dần cho các lần làm trước (gần nhất quan trọng hơn)
  
  // Ngưỡng phân loại
  THRESHOLD_NEEDS_REVIEW: 50,  // < 50%: Cần ôn lại
  THRESHOLD_PROGRESSING: 80,   // 50% - 79%: Đang tiến bộ; >= 80%: Vững
  
  // Điều kiện Chủ đề đạt "Vững"
  TOPIC_SOLID_REMEMBER_UNDERSTAND: 80, // Nhận biết và Thông hiểu >= 80%
  TOPIC_SOLID_ANALYZE_APPLY: 60,       // VÀ Phân tích và Vận dụng >= 60%
};

// Cấu hình Giai đoạn của Cây (Growth Tree)
// Dựa trên số bước học hoàn thành thật lần đầu (không phụ thuộc trần XP)
export const TREE_STAGES_CONFIG = [
  { stage: 0, name: 'Hạt mầm', minSteps: 0, desc: 'Hạt mầm nhỏ đang ấp ủ dưới lớp đất văn chương màu mỡ' },
  { stage: 1, name: 'Nảy mầm', minSteps: 3, desc: 'Mầm Mực nhú lên với chiếc lá xanh non đầu tiên' },
  { stage: 2, name: 'Chồi non', minSteps: 8, desc: 'Các cành lá bắt đầu vươn dài theo từng bài học' },
  { stage: 3, name: 'Cây con', minSteps: 18, desc: 'Cây đã vững vàng với nhiều tán lá tri thức xanh biếc' },
  { stage: 4, name: 'Cây ra hoa', minSteps: 32, desc: 'Những nụ hoa nở rộ báo hiệu năng lực cảm thụ chín muồi' },
  { stage: 5, name: 'Cây kết trái', minSteps: 50, desc: 'Vườn Văn đơm hoa kết trái ngọt ngào thành công' },
];

// Cấu hình Điểm danh & Chuỗi
export const ATTENDANCE_CONFIG = {
  EXEMPT_ABSENT_DAYS_PER_WEEK: 1, // 1 ngày nghỉ được miễn / tuần không mất chuỗi
  WILTING_INACTIVE_DAYS: 3,        // Vắng 3 ngày cây hơi ủ rũ (học lại thì tươi ngay)
};

// Cấu hình tính năng
export const FEATURE_FLAGS = {
  ENABLE_THEORY_TEST_2: true, // Cho phép bước Kiểm tra 2 trong luồng Lý thuyết
  ENABLE_SOUND_EFFECTS: true,  // Bật âm thanh mặc định
  ENABLE_ANIMATIONS: true,     // Bật hiệu ứng mượt
};

// ================= CẤU HÌNH RƯƠNG QUÀ BÍ MẬT (CHEST TIERS) =================
export type ChestTierKey = 'HAT' | 'LA' | 'HOA' | 'VANG';

export interface ChestTierConfig {
  key: ChestTierKey;
  name: string;
  sizeLabel: 'Quà nhỏ' | 'Quà vừa' | 'Quà lớn' | 'Quà đặc biệt';
  minXp: number;
  maxXp: number;
  visualDesc: string;
  primaryColor: string;    // Màu chủ đạo
  secondaryColor: string;  // Màu bổ trợ
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  glowColor: string;
  defaultTeaser: string;
  baseSizePx: number;      // Kích thước trực quan tăng dần: 88 -> 104 -> 120 -> 140
}

export const CHEST_TIERS: Record<ChestTierKey, ChestTierConfig> = {
  HAT: {
    key: 'HAT',
    name: 'Rương Hạt',
    sizeLabel: 'Quà nhỏ',
    minXp: 0,
    maxXp: 300,
    visualDesc: 'Hộp quà nhỏ, một dải nơ mềm mại có ổ khóa mầm non',
    primaryColor: '#7FA88A',   // Xanh sage
    secondaryColor: '#FAF5EB', // Kem
    accentColor: '#4A7A57',
    badgeBg: '#EFF5F0',
    badgeText: '#2D5A3D',
    borderColor: '#D4E2D7',
    glowColor: 'rgba(127, 168, 138, 0.25)',
    defaultTeaser: 'Một món quà nhỏ xinh cho bước khởi đầu chăm chỉ.',
    baseSizePx: 88,
  },
  LA: {
    key: 'LA',
    name: 'Rương Lá',
    sizeLabel: 'Quà vừa',
    minXp: 301,
    maxXp: 500,
    visualDesc: 'Hộp quà lớn hơn, nơ to có chiếc lá nhỏ rủ xuống',
    primaryColor: '#2F3E6B',   // Xanh mực
    secondaryColor: '#7FA88A', // Xanh sage
    accentColor: '#E2704A',
    badgeBg: '#EDF1F7',
    badgeText: '#23325B',
    borderColor: '#C7D3E5',
    glowColor: 'rgba(47, 62, 107, 0.25)',
    defaultTeaser: 'Món quà bất ngờ cho một tuần học đều đặn.',
    baseSizePx: 104,
  },
  HOA: {
    key: 'HOA',
    name: 'Rương Hoa',
    sizeLabel: 'Quà lớn',
    minXp: 501,
    maxXp: 700,
    visualDesc: 'Rương gỗ có khóa chạm trổ, họa tiết hoa văn mềm mại',
    primaryColor: '#E2704A',   // Cam đất
    secondaryColor: '#EBDDC4', // Be nâu
    accentColor: '#8C4325',
    badgeBg: '#FDF1EB',
    badgeText: '#B84E2A',
    borderColor: '#F3CFBE',
    glowColor: 'rgba(226, 112, 74, 0.28)',
    defaultTeaser: 'Quà đặc biệt dành cho bạn bền bỉ và tiến bộ.',
    baseSizePx: 120,
  },
  VANG: {
    key: 'VANG',
    name: 'Rương Vàng',
    sizeLabel: 'Quà đặc biệt',
    minXp: 701,
    maxXp: Infinity,
    visualDesc: 'Rương lớn viền vàng, tỏa ánh hào quang và tia lấp lánh',
    primaryColor: '#F2B84B',   // Vàng mật
    secondaryColor: '#FAF5EB', // Kem
    accentColor: '#C4881C',
    badgeBg: '#FEF8EC',
    badgeText: '#9A6B12',
    borderColor: '#F8DE9F',
    glowColor: 'rgba(242, 184, 75, 0.35)',
    defaultTeaser: 'Phần quà lớn nhất, dành cho người học kiên trì nhất tuần.',
    baseSizePx: 140,
  },
};

/**
 * Xác định cấp rương theo ngưỡng XP hoặc theo tierKey
 */
export function getChestTierConfig(xp: number, tierKey?: ChestTierKey): ChestTierConfig {
  if (tierKey && CHEST_TIERS[tierKey]) {
    return CHEST_TIERS[tierKey];
  }
  if (xp <= 300) return CHEST_TIERS.HAT;
  if (xp <= 500) return CHEST_TIERS.LA;
  if (xp <= 700) return CHEST_TIERS.HOA;
  return CHEST_TIERS.VANG;
}

/**
 * Đọc cấu hình tùy biến từ Kho Cài Đặt (SettingRepository / localStorage).
 * Nếu chưa tùy biến thì tự động trả về giá trị mặc định chuẩn.
 */
export function getSavedSystemSettings(): any {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('mam_van_system_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
  }
  return null;
}

export function getEffectiveXpConfig() {
  const settings = getSavedSystemSettings();
  if (settings?.xp) {
    return {
      ...XP_CONFIG,
      ATTENDANCE_DAILY_XP: Number(settings.xp.attendanceDailyXp) || XP_CONFIG.ATTENDANCE_DAILY_XP,
      VIDEO_WATCH_80_PERCENT_XP: Number(settings.xp.videoWatchXp) || XP_CONFIG.VIDEO_WATCH_80_PERCENT_XP,
      VIDEO_SUMMARY_READ_XP: Number(settings.xp.videoSummaryReadXp) || XP_CONFIG.VIDEO_SUMMARY_READ_XP,
      VIDEO_PRACTICE_COMPLETED_XP: Number(settings.xp.videoPracticeXp) || XP_CONFIG.VIDEO_PRACTICE_COMPLETED_XP,
      VIDEO_QUICK_TEST_XP: Number(settings.xp.videoQuickTestXp) || XP_CONFIG.VIDEO_QUICK_TEST_XP,
      VIDEO_MASTERY_CHECK_XP: Number(settings.xp.videoMasteryCheckXp) || XP_CONFIG.VIDEO_MASTERY_CHECK_XP,
      THEORY_READ_UNDERSTOOD_XP: Number(settings.xp.theoryReadXp) || XP_CONFIG.THEORY_READ_UNDERSTOOD_XP,
      THEORY_PRACTICE_COMPLETED_XP: Number(settings.xp.theoryPracticeXp) || XP_CONFIG.THEORY_PRACTICE_COMPLETED_XP,
      THEORY_TEST_XP: Number(settings.xp.theoryTestXp) || XP_CONFIG.THEORY_TEST_XP,
      HOMEWORK_COMPLETED_XP: Number(settings.xp.homeworkCompletedXp) || XP_CONFIG.HOMEWORK_COMPLETED_XP,
      REVIEW_WEAK_AREA_XP: Number(settings.xp.reviewWeakAreaXp) || XP_CONFIG.REVIEW_WEAK_AREA_XP,
    };
  }
  return XP_CONFIG;
}

export function getEffectiveTimeConfig() {
  const settings = getSavedSystemSettings();
  if (settings?.time) {
    return {
      ...TIME_CONFIG,
      IDLE_LIMIT_SECONDS: (Number(settings.time.idleLimitMinutes) || 4) * 60,
      BREAK_REMINDER_MINUTES: Number(settings.time.breakReminderMinutes) || TIME_CONFIG.BREAK_REMINDER_MINUTES,
      MIN_THEORY_READ_SECONDS: Number(settings.time.minTheoryReadSeconds) || TIME_CONFIG.MIN_THEORY_READ_SECONDS,
      MIN_SUMMARY_READ_SECONDS: Number(settings.time.minSummaryReadSeconds) || TIME_CONFIG.MIN_SUMMARY_READ_SECONDS,
      ESSAY_REVIEW_ESTIMATED_HOURS: Number(settings.time.essayReviewEstimatedHours) || TIME_CONFIG.ESSAY_REVIEW_ESTIMATED_HOURS,
    };
  }
  return TIME_CONFIG;
}

export function getEffectiveMasteryConfig() {
  const settings = getSavedSystemSettings();
  if (settings?.mastery) {
    return {
      ...MASTERY_CONFIG,
      MIN_QUESTIONS_REQUIRED: Number(settings.mastery.minQuestionsRequired) || MASTERY_CONFIG.MIN_QUESTIONS_REQUIRED,
      THRESHOLD_NEEDS_REVIEW: Number(settings.mastery.thresholdNeedsReview) || MASTERY_CONFIG.THRESHOLD_NEEDS_REVIEW,
      THRESHOLD_PROGRESSING: Number(settings.mastery.thresholdProgressing) || MASTERY_CONFIG.THRESHOLD_PROGRESSING,
      WEIGHT_DECAY_FACTOR: Number(settings.mastery.weightDecayFactor) || MASTERY_CONFIG.WEIGHT_DECAY_FACTOR,
    };
  }
  return MASTERY_CONFIG;
}


