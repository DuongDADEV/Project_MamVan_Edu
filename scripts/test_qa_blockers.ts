// Đợt QA 26/10: 8 blocker — source-guard cho các fix (không chạy app, chỉ
// đọc mã nguồn để khóa hành vi đã sửa khỏi bị hồi quy lặng lẽ).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) {
    pass++;
    console.log(`  PASS: ${name}`);
  } else {
    fail++;
    console.log(`  FAIL: ${name}`, extra ?? '');
  }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');
const contentSrc = read('src/screens/teacher/TeacherContentScreen.tsx');
const bankSrc = read('src/screens/teacher/TeacherQuestionBankScreen.tsx');
const studentsSrv = read('api/routes/students.ts');
const attemptsSrv = read('api/routes/attempts.ts');
const essaysSrv = read('api/routes/essays.ts');
const apiEssay = read('src/services/api/repositories.ts');
const apiAttempt = read('src/services/api/repositories.ts');
const contentClientSrc = read('src/services/api/contentClient.ts');
const httpSrc = read('src/services/api/http.ts');
const aiIndexSrc = read('src/services/ai/index.ts');
const geminiSrc = read('src/services/ai/GeminiAIService.ts');
const trainingSrc = read('src/components/teacher/grading/AiTrainingStudio.tsx');
const videoSrc = read('src/screens/VideoLessonScreen.tsx');
const theorySrc = read('src/screens/TheoryLessonScreen.tsx');
const chatSrc = read('api/ai/chat.ts');
const aiLibSrc = read('api/_lib/ai.ts');
const aiTestSrc = read('api/admin/ai-test.ts');

console.log('=== Blocker 1: Studio màn Nội dung gắn đúng chủ đề ===');
check('ContentScreen có aiTopic memo (chủ đề đang chọn > chủ đề của bài đang mở > topics[0])', contentSrc.includes('const aiTopic = useMemo'));
check('Modal Studio nhận topicId từ aiTopic, không còn topics[0]', contentSrc.includes('topicId={aiTopic?.id') && !contentSrc.includes("topicId={topics[0]?.id"));
check('handleApplyAiDraft dùng aiTopic?.id', contentSrc.includes('aiTopic?.id || topics[0]?.id'));

console.log('=== Blocker 2: Studio Ngân hàng không lưu với topic rỗng ===');
check('Bank có effect mặc định formTopicId 1 lần từ topics[0]', bankSrc.includes('topicDefaultedRef') && bankSrc.includes('setFormTopicId(topics[0].id)'));
check('Effect mặc định bị chặn khi đang duyệt nháp (draftOpenRequest)', bankSrc.includes('|| draftOpenRequest) return;'));
check('Selector có option placeholder rỗng', bankSrc.includes('— Chọn chủ đề —'));
check('Lưu video bị chặn khi formTopicId rỗng', bankSrc.includes("Hãy chọn chủ đề trước khi lưu — bài giảng chưa được lưu"));
check('Lưu lý thuyết bị chặn khi formTopicId rỗng', bankSrc.includes("Hãy chọn chủ đề trước khi lưu — lý thuyết chưa được lưu"));
check('Lưu câu hỏi bị chặn khi cả draft lẫn form đều rỗng topic', bankSrc.includes("Hãy chọn chủ đề trước khi lưu — câu hỏi chưa được lưu"));
check('Fix 984dc5f còn nguyên: handleReviewDraftInStudio set formTopicId vô điều kiện', bankSrc.includes("setFormTopicId(topicId === 'global' ? '' : topicId)"));

console.log('=== Blocker 3: lỗi đọc nháp hiện banner, không ngụy trang empty ===');
check('readQuestionDraftSets trả { sets, readError }', bankSrc.includes('function readQuestionDraftSets(): { sets: QuestionDraftSet[]; readError: boolean }'));
check('readTheoryDrafts trả { items, readError }', bankSrc.includes('function readTheoryDrafts(): { items: TheoryDraftItem[]; readError: boolean }'));
check('Lỗi đọc từng khóa đặt readError = true (không văng cả hàm)', bankSrc.includes('readError = true;'));
check('Tab nháp có banner lỗi đọc', bankSrc.includes('Không đọc được một phần bản nháp đã lưu'));
check('Câu "không có nháp" bị ẩn khi có lỗi đọc', bankSrc.includes('!draftReadError && questionDraftSets.length === 0'));

console.log('=== Blocker 4: chain AI dưới maxDuration 60s ===');
check('tryChain có tham số totalBudgetMs', aiLibSrc.includes('totalBudgetMs'));
check('tryChain dừng khi hết ngân sách (remaining <= 0 → break)', aiLibSrc.includes('if (remaining <= 0) break;'));
check('Timeout mỗi nấc = min(timeoutPerLegMs, remaining)', aiLibSrc.includes('Math.min(timeoutPerLegMs, remaining)'));
check('chat.ts gọi tryChain với 12s/nấc + ngân sách 50s', chatSrc.includes('12000,') && chatSrc.includes('50000'));
check('ai-test.ts dùng 12s/nấc (không còn 15000)', aiTestSrc.includes('12000,') && !aiTestSrc.includes('15000,'));
check('ai-test.ts không còn comment timeout 30s/nấc', !aiTestSrc.includes('timeout 30s/nấc'));

console.log('=== Blocker 5: chấm/trích xuất không fallback mock im lặng ===');
check('suggestEssayGrade không còn gọi mock.suggestEssayGrade', !aiIndexSrc.includes('return this.mock.suggestEssayGrade'));
check('suggestEssayGrade ném lỗi khi chưa có Gemini', aiIndexSrc.includes('Chưa cấu hình dịch vụ AI — không thể chấm tự luận'));
check('extractContentFromUrl không còn gọi mock.extractContentFromUrl', !aiIndexSrc.includes('mock.extractContentFromUrl'));
check('GeminiAIService không còn đoạn văn mẫu bịa', !geminiSrc.includes('Tư liệu cung cấp góc nhìn chuyên sâu') && !geminiSrc.includes('const fallbackText'));
check('GeminiAIService ném lỗi khi không có nội dung thật', geminiSrc.includes('Không trích xuất được nội dung thật từ liên kết này'));
check('AiTrainingStudio có state sandboxError + banner lỗi', trainingSrc.includes('sandboxError') && trainingSrc.includes('AI chấm lỗi — chưa có điểm gợi ý'));

console.log('=== Blocker 6 (GĐ3): server là nguồn thật duy nhất, không gộp local ===');
// GĐ3: Supabase client đã xóa; phạm vi + server-thắng nằm ở route server
// và client API. Luật mới (quyết đã duyệt): API lỗi thì NÉM, không fallback
// lặng sang mock/local — nên check fallback-local cũ được ĐẢO NGƯỢC.
check('getStudents phạm vi GV ở server (teacherClassIds)', studentsSrv.includes('teacherClassIds'));
check('getStudentState lấy XP từ server qua getTotals (không Math.max với local)', attemptsSrv.includes('getTotals') && !apiAttempt.includes('Math.max(data.xp_today') && !apiAttempt.includes('Math.max(data.total_xp'));
check('getAllStates bắt đầu từ map rỗng (không seed local)', apiAttempt.includes('const map: Record<string, StudentState> = {};'));
check('getAllStates không còn seed scopedFallback vào map', !apiAttempt.includes('scopedFallback'));
check('getSubmissions không còn gộp cleanLocalList vào merged', !apiEssay.includes('cleanLocalList'));
check('getSubmissions scope rỗng trả [] (không rơi về local)', essaysSrv.includes('if (!classIds.length) return { studentIds: [], classIds: [] };'));
check('getSubmissions lỗi thì NÉM (luật GĐ3 mới: không fallback local lặng)', httpSrc.includes('throw new ApiError') && !apiEssay.includes('cleanLocalList'));

console.log('=== Blocker 7: /api/ai/chat role gate + giới hạn đầu vào ===');
check('chat.ts chặn role khác teacher/admin bằng 403 (middleware requireRole)', chatSrc.includes("requireRole('teacher', 'admin')"));
check('chat.ts giới hạn contents ≤ 50', chatSrc.includes('contents.length > 50'));
check('chat.ts giới hạn systemInstruction ≤ 20000 ký tự', chatSrc.includes('systemInstruction.length > 20000'));
check('chat.ts giới hạn tools JSON ≤ 50000 ký tự', chatSrc.includes('JSON.stringify(body.tools).length > 50000'));

console.log('=== Blocker 8: lỗi im lặng → toast/banner + service ném lỗi ===');
check('ContentScreen có toastMessage + showToast', contentSrc.includes('toastMessage') && contentSrc.includes('const showToast'));
check('handleSaveTopic ném lại để TopicModal giữ modal mở', contentSrc.includes('Lưu chủ đề lỗi:') && contentSrc.includes('throw err;'));
check('confirmDeleteTopic chỉ đóng dialog khi xóa thành công', contentSrc.includes('Xóa chủ đề lỗi:'));
check('saveTopic ném lỗi thay vì trả savedMock (saveItem qua apiFetch, không mock)', contentClientSrc.includes('async function saveItem') && contentClientSrc.includes('await apiFetch') && !contentClientSrc.includes('savedMock'));
check('deleteTopic ném lỗi thay vì warn (deleteItem qua apiFetch)', contentClientSrc.includes('async function deleteItem') && contentClientSrc.includes('await apiFetch'));
check('reorderTopics 1 request duy nhất, lỗi thì ném (apiFetch)', contentClientSrc.includes("'/api/topics/reorder'") && contentClientSrc.includes('await apiFetch'));
check('createSubmission ném lỗi khi API lỗi (apiFetch, không fallback local)', apiEssay.includes('async createSubmission(') && apiEssay.includes('apiFetch') && !apiEssay.includes('cleanLocalList'));
check('VideoLessonScreen có failedEssays + banner Gửi lại', videoSrc.includes('failedEssays') && videoSrc.includes('Gửi lại'));
check('TheoryLessonScreen có failedEssays + banner Gửi lại', theorySrc.includes('failedEssays') && theorySrc.includes('Gửi lại'));
check('VideoLessonScreen không còn .catch(console.error) nuốt lỗi essay', !videoSrc.includes("console.error('Lỗi lưu bài essay:'"));
check('TheoryLessonScreen không còn .catch(console.error) nuốt lỗi essay', !theorySrc.includes("console.error('Lỗi gửi bài tự luận:'"));

console.log('=== Điều tra publish topic (QA E2E TEST-QA-26-10) ===');
check('publishQuiz ném lỗi khi push quiz thất bại (apiFetch)', contentClientSrc.includes('async publishQuiz(') && contentClientSrc.includes('await apiFetch'));
check('publishQuiz tự xuất bản chủ đề cha nếu chưa published', contentClientSrc.includes('Quiz publish TỰ publish topic cha') && contentClientSrc.includes('/publish'));
check('publishContent mở public để dùng chung', contentClientSrc.includes('async publishContent('));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
