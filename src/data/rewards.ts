import { RewardTier } from '../types.ts';

/**
 * Danh mục Rương Quà Bí Mật do Giáo viên trao
 * QUY TẮC BẢO MẬT:
 * - Học sinh KHÔNG được biết trước nội dung của `secret` (name, description).
 * - Trường `secret` CHỈ được phép hiển thị sau khi giáo viên đã trao (GIVEN) và học sinh bấm "Mở rương" (OPENED).
 * - Mọi thẻ, đường lên rương, tooltip, aria-label và thông báo trước khi mở rương đều chỉ dùng `tierKey` và `teaserDescription`.
 */
/**
 * GỘP DANH MỤC QUÀ (hướng c, 24/10 — user chốt "gộp cả hai nguồn lại"):
 * danh mục mặc định + mốc giáo viên tự tạo trong kho.
 * - Khử trùng theo id: mốc trong kho thắng khi trùng id với mốc mặc định
 *   (mốc kho là bản tùy biến đang có hiệu lực của giáo viên đó).
 * - Sắp xếp theo XP yêu cầu tăng dần (thứ tự rương hiển thị).
 */
export function mergeRewardTiers(dbRewards: RewardTier[]): RewardTier[] {
  const byId = new Map<string, RewardTier>();
  for (const tier of REWARDS_CATALOG) byId.set(tier.id, tier);
  for (const tier of dbRewards) byId.set(tier.id, tier);
  return [...byId.values()].sort(
    (a, b) => (a.requiredXp ?? a.xpCost) - (b.requiredXp ?? b.xpCost)
  );
}

/**
 * Lọc mốc trong kho theo giáo viên — KHÔNG bao giờ mở rộng phạm vi:
 * - teacherId đã biết: giữ mốc chưa gắn dấu (tương thích ngược) + mốc của chính GV đó.
 * - teacherId chưa biết (null/undefined): chỉ giữ mốc chưa gắn dấu.
 */
export function filterDbRewardsForOwner(
  dbRewards: RewardTier[],
  teacherId: string | null | undefined
): RewardTier[] {
  if (teacherId) return dbRewards.filter((r) => !r.teacherId || r.teacherId === teacherId);
  return dbRewards.filter((r) => !r.teacherId);
}

export const REWARDS_CATALOG: RewardTier[] = [
  {
    id: 'reward_bookmark',
    requiredXp: 280,
    xpCost: 280,
    requiredAttendanceDays: 4,
    tierKey: 'HAT',
    teaserDescription: 'Một món quà nhỏ xinh cho bước khởi đầu chăm chỉ.',
    secret: {
      name: 'Bookmark Mầm Mực thủ công',
      description: 'Thẻ kẹp sách vẽ tay hình Mầm Mực ép plastic bền đẹp, giáo viên đề tặng tên em.',
    },
    isPhysical: true,
  },
  {
    id: 'reward_reading_choice',
    requiredXp: 320,
    xpCost: 320,
    requiredAttendanceDays: 4,
    tierKey: 'LA',
    teaserDescription: 'Món quà bất ngờ cho một tuần học đều đặn.',
    secret: {
      name: 'Quyền chọn bài đọc cho cả lớp',
      description: 'Em được chọn bài thơ hoặc đoạn trích văn học yêu thích để cô giáo đọc mẫu ở đầu giờ học tới.',
    },
    isPhysical: false,
  },
  {
    id: 'reward_pen',
    requiredXp: 450,
    xpCost: 450,
    requiredAttendanceDays: 5,
    tierKey: 'LA',
    teaserDescription: 'Món quà bất ngờ và hữu ích cho những trang văn nắn nót.',
    secret: {
      name: 'Bút mực xanh Giấy & Mực',
      description: 'Chiếc bút máy nét hoa mực xanh cổ điển dành cho bài viết văn tròn trịa.',
    },
    isPhysical: true,
  },
  {
    id: 'reward_notebook',
    requiredXp: 650,
    xpCost: 650,
    requiredAttendanceDays: 5,
    tierKey: 'HOA',
    teaserDescription: 'Quà đặc biệt dành cho bạn bền bỉ và tiến bộ vượt bậc.',
    secret: {
      name: 'Sổ tay Giấy & Mực bìa cứng',
      description: 'Cuốn sổ ghi chép trích dẫn văn học 120 trang giấy kem kẻ ngang ấm áp.',
    },
    isPhysical: true,
    stock: 25,
    isActive: true,
  },
  {
    id: 'reward_golden_box',
    requiredXp: 750,
    xpCost: 750,
    requiredAttendanceDays: 6,
    tierKey: 'VANG',
    teaserDescription: 'Phần quà danh giá nhất, dành cho người học kiên trì và xuất sắc nhất tuần.',
    secret: {
      name: 'Bút mài nét hoa & Bộ quà lưu niệm Mầm Văn',
      description: 'Hộp bút mài ngòi kim tinh mạ vàng cùng bộ huy hiệu kẹp sách giới hạn có khắc tên em.',
    },
    isPhysical: true,
    stock: 10,
    isActive: true,
  },
];
