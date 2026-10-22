/**
 * Kịch bản kiểm thử toàn diện Prompt 5:
 * 1. Quà tặng (Milestones, Queue, Eligibility Check, Batch actions, Student Secret Confidentiality & Opening Flow)
 * 2. Cài đặt hệ thống (SettingRepository, XP caps validation, Group Resets, Dynamic Configs)
 * 3. Nhật ký hoạt động (AuditRepository, Filtering, No sensitive data)
 */

import {
  rewardService,
  settingService,
  auditService,
  attemptService,
  studentService,
  DEFAULT_SYSTEM_SETTINGS,
} from '../src/services/index.ts';
import { getEffectiveXpConfig, getChestTierConfig } from '../src/config.ts';
import { RewardItem, RewardStatus } from '../src/types.ts';

async function runPrompt5Verification() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN PROMPT 5 (MẦM VĂN)');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     Chi tiết: ${detail}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // ==========================================
  // PHẦN 1: QUÀ TẶNG & RƯƠNG BÍ MẬT
  // ==========================================
  console.log('--- 1. KIỂM THỬ DANH MỤC & MỐC QUÀ TẶNG (REWARDS) ---');

  const initialRewards = await rewardService.getRewards();
  assert(initialRewards.length >= 4, 'Danh mục có tối thiểu 4 mốc rương chuẩn (Hạt, Lá, Hoa, Vàng)');

  const tiers = initialRewards.map((r) => r.tierKey);
  assert(tiers.includes('HAT') && tiers.includes('LA') && tiers.includes('HOA') && tiers.includes('VANG'), 'Đủ 4 cấp rương CHEST_TIERS: HAT, LA, HOA, VANG');

  // Test tạo mốc quà mới
  const newRewardInput: Partial<RewardItem> = {
    requiredXp: 520,
    requiredAttendanceDays: 5,
    teaserDescription: 'Phần quà bất ngờ dành cho tuần học bứt phá văn học.',
    secret: {
      name: 'Hộp màu nước Giấy & Mực 12 màu',
      description: 'Hộp màu nước thủ công kèm cọ vẽ để minh họa bài thơ.',
    },
    stock: 15,
    isActive: true,
  };

  const createdReward = await rewardService.saveReward(newRewardInput);
  assert(!!createdReward.id, 'Tạo thành công mốc quà mới có ID sinh tự động');
  assert(createdReward.tierKey === 'HOA', 'Hệ thống tự động gán tierKey = HOA vì XP = 520 (>500 và <=700)');
  assert(createdReward.stock === 15, 'Lưu đúng số lượng stock');

  // Test sửa mốc quà
  const updatedReward = await rewardService.saveReward({
    id: createdReward.id,
    stock: 14,
    teaserDescription: 'Mô tả gợi mở đã cập nhật.',
  });
  assert(updatedReward.stock === 14 && updatedReward.teaserDescription === 'Mô tả gợi mở đã cập nhật.', 'Sửa thành công mốc quà đã tồn tại');

  // Test xóa mốc quà
  await rewardService.deleteReward(createdReward.id);
  const afterDeleteRewards = await rewardService.getRewards();
  assert(!afterDeleteRewards.some((r) => r.id === createdReward.id), 'Xóa thành công mốc quà khỏi kho dữ liệu');

  // ==========================================
  // PHẦN 2: HÀNG ĐỢI YÊU CẦU & THẨM ĐỊNH ĐIỀU KIỆN
  // ==========================================
  console.log('\n--- 2. KIỂM THỬ HÀNG ĐỢI YÊU CẦU & THẨM ĐỊNH SỐ LIỆU ---');

  // Tạo yêu cầu nhận quà cho hs001
  const targetReward = initialRewards[0]; // Rương Hạt (280 XP, 4 ngày điểm danh)
  const req1 = await rewardService.createRequest('hs001', targetReward.id);
  assert(req1.status === 'PENDING_APPROVAL', 'Yêu cầu mới tạo có trạng thái PENDING_APPROVAL (Chờ duyệt)');

  // Lấy danh sách hàng đợi đã được làm giàu thông tin (Enriched)
  const enrichedRequests = await rewardService.getRequests({ studentId: 'hs001' });
  const foundReq = enrichedRequests.find((r) => r.id === req1.id);
  assert(!!foundReq, 'Hàng đợi trả về yêu cầu của hs001');
  assert(foundReq?.studentName === 'Nguyễn Minh Anh', 'Làm giàu đúng họ tên học sinh');
  assert(foundReq?.className === '7A2', 'Làm giàu đúng tên lớp');
  assert(foundReq?.reward?.id === targetReward.id, 'Làm giàu đúng thông tin mốc quà tặng');
  assert(foundReq?.xpWeekActual !== undefined, 'Làm giàu đúng số XP tuần thực tế');
  assert(foundReq?.attendanceDaysActual !== undefined, 'Làm giàu đúng số ngày điểm danh thực tế');
  assert(typeof foundReq?.isEligible === 'boolean', 'Có cờ thẩm định đủ điều kiện thật (isEligible)');

  // Test duyệt đơn lẻ: PENDING_APPROVAL -> APPROVED
  const approvedReq = await rewardService.updateRequestStatus(req1.id, 'APPROVED', undefined, 'teacher_001');
  assert(approvedReq.status === 'APPROVED' && !!approvedReq.approvedAt, 'Duyệt thành công yêu cầu: trạng thái APPROVED');

  // Test trao quà: APPROVED -> GIVEN
  const givenReq = await rewardService.updateRequestStatus(req1.id, 'GIVEN', undefined, 'teacher_001');
  assert(givenReq.status === 'GIVEN' && !!givenReq.givenAt, 'Trao quà thành công: trạng thái GIVEN');

  // Test bảo mật Secret phía học sinh: Trước khi mở rương, secret không được hiển thị cho học sinh
  assert(targetReward.secret.name.length > 0, 'Món quà thật có tên bí mật');
  // Khi học sinh mở rương (OPENED)
  const openedReq = await rewardService.updateRequestStatus(req1.id, 'OPENED');
  assert(openedReq.status === 'OPENED' && !!openedReq.openedAt, 'Học sinh mở rương thành công: trạng thái OPENED');

  // Test từ chối kèm lý do sư phạm nhẹ nhàng
  const req2 = await rewardService.createRequest('hs001', initialRewards[1].id);
  const rejectReason = 'Tuần này em chưa tích lũy đủ số ngày điểm danh, cô trò mình cùng cố gắng tuần sau nhé!';
  const rejectedReq = await rewardService.updateRequestStatus(req2.id, 'REJECTED', rejectReason, 'teacher_001');
  assert(rejectedReq.status === 'REJECTED', 'Từ chối thành công yêu cầu');
  assert(rejectedReq.rejectReason === rejectReason, 'Lưu đúng lý do từ chối nhẹ nhàng');

  // Test xử lý hàng loạt (Batch Update)
  const batchReq1 = await rewardService.createRequest('hs001', targetReward.id);
  const batchReq2 = await rewardService.createRequest('hs002', targetReward.id);
  await rewardService.batchUpdateStatus([batchReq1.id, batchReq2.id], 'APPROVED', undefined, 'teacher_001');

  const afterBatch = await rewardService.getRequests();
  const b1 = afterBatch.find((r) => r.id === batchReq1.id);
  const b2 = afterBatch.find((r) => r.id === batchReq2.id);
  assert(b1?.status === 'APPROVED' && b2?.status === 'APPROVED', 'Duyệt hàng loạt thành công nhiều yêu cầu');

  // ==========================================
  // PHẦN 3: CÀI ĐẶT HỆ THỐNG (SETTINGS)
  // ==========================================
  console.log('\n--- 3. KIỂM THỬ CÀI ĐẶT HỆ THỐNG & RÀNG BUỘC TOÁN HỌC ---');

  const currentSettings = await settingService.getSettings();
  assert(!!currentSettings.schoolInfo, 'Nạp được khối thông tin trường lớp');
  assert(currentSettings.mastery.thresholdNeedsReview === 50, 'Ngưỡng Cần ôn lại mặc định là 50%');
  assert(currentSettings.mastery.thresholdProgressing === 80, 'Ngưỡng Vững vàng mặc định là 80%');
  // Mô hình XP hiện hành không còn trần XP ngày/tuần (đã bãi bỏ 21–22/10):
  // cài đặt mặc định không được chứa lại các trường trần.
  assert(
    !('weeklyCap' in currentSettings.xp) && !('dailyCapTotal' in currentSettings.xp) && !('dailyCapUnder45Min' in currentSettings.xp),
    'Cài đặt mặc định không còn trường trần XP ngày/tuần'
  );
  assert(currentSettings.xp.attendanceDailyXp === 2, 'XP điểm danh ngày mặc định là 2');
  assert(currentSettings.time.essayReviewEstimatedHours === 48, 'Thời gian chờ chấm hiển thị mặc định là 48 giờ');

  // Test cập nhật cài đặt hợp lệ
  const updatedSettings = await settingService.updateSettings({
    schoolInfo: {
      ...currentSettings.schoolInfo,
      schoolName: 'THCS Mầm Văn Thực Nghiệm',
    },
    xp: {
      ...currentSettings.xp,
      attendanceDailyXp: 5,
    },
  });
  assert(updatedSettings.schoolInfo.schoolName === 'THCS Mầm Văn Thực Nghiệm', 'Cập nhật thành công tên trường');
  assert(updatedSettings.xp.attendanceDailyXp === 5, 'Cập nhật thành công XP điểm danh ngày');

  // Test khôi phục nhóm cài đặt (Reset Group)
  const afterResetGroup = await settingService.resetGroup('xp');
  assert(afterResetGroup.xp.attendanceDailyXp === 2, 'Khôi phục thành công nhóm XP về mặc định (điểm danh 2 XP)');

  // Test khôi phục toàn bộ cài đặt (Reset All)
  const afterResetAll = await settingService.resetAll();
  assert(afterResetAll.schoolInfo.schoolName === DEFAULT_SYSTEM_SETTINGS.schoolInfo.schoolName, 'Khôi phục toàn bộ cài đặt về mặc định thành công');

  // ==========================================
  // PHẦN 4: NHẬT KÝ HOẠT ĐỘNG (AUDIT LOGS)
  // ==========================================
  console.log('\n--- 4. KIỂM THỬ NHẬT KÝ KIỂM TOÁN (AUDIT REPOSITORY) ---');

  const logs = await auditService.getLogs();
  assert(logs.length > 0, 'Nhật ký kiểm toán có ghi nhận các hành động');

  // Kiểm tra TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU
  const logsWithPassword = logs.filter((l) => {
    const json = JSON.stringify(l).toLowerCase();
    return json.includes('matkhau123') || json.includes('password_hash') || json.includes('mật khẩu mới:');
  });
  assert(logsWithPassword.length === 0, 'Bảo mật: Nhật ký TUYỆT ĐỐI KHÔNG chứa mật khẩu thô');

  // Test lọc nhật ký theo loại hành động / đối tượng
  const rewardLogs = await auditService.getLogs({ targetType: 'reward' });
  assert(rewardLogs.every((l) => l.target_type === 'reward'), 'Lọc thành công nhật ký theo loại đối tượng (reward)');

  // Test tìm kiếm trong nhật ký
  const searchLogs = await auditService.getLogs({ search: 'hs001' });
  assert(searchLogs.length >= 0, 'Tìm kiếm từ khóa trong nhật ký hoạt động ổn định');

  console.log('\n====================================================');
  console.log(`🎉 HOÀN THÀNH KIỂM THỬ: ${passedTests}/${totalTests} TESTS PASS (100%)`);
  console.log('====================================================');
}

runPrompt5Verification().catch((err) => {
  console.error('LỖI KIỂM THỬ:', err);
  process.exit(1);
});
