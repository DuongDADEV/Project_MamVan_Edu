import type { RewardRequest } from '../services/types.ts';

/**
 * Gộp yêu cầu đổi quà từ máy chủ với yêu cầu chỉ có ở máy khách (29/10):
 * màn học sinh trước đây chỉ đọc state học sinh — mà state máy chủ không
 * kèm yêu cầu — nên tải lại là mất dấu yêu cầu. Nay màn học sinh lấy thêm
 * danh sách từ API; gộp theo id, bản máy chủ thắng (trạng thái mới nhất),
 * yêu cầu chỉ có ở máy khách (vừa gửi, API chưa kịp trả lại) được giữ.
 * Sắp xếp mới nhất trước để khớp thứ tự máy chủ trả về.
 */
export function mergeRewardRequests(
  serverRequests: RewardRequest[],
  localRequests: RewardRequest[]
): RewardRequest[] {
  const byId = new Map<string, RewardRequest>();
  for (const r of localRequests) byId.set(r.id, r);
  for (const r of serverRequests) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0));
}
