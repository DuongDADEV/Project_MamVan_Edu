// Audit localStorage đợt 3 (26/10, luật mới của user: dữ liệu nghiệp vụ đã có
// trên server thì server là nguồn thật duy nhất — localStorage KHÔNG được
// gộp/đè lên dữ liệu server ở bất kỳ danh sách nào; local chỉ còn là fallback
// khi query lỗi). Source-guard cùng mẫu test_grading_load.ts.
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
const contentClientSrc = read('src/services/api/contentClient.ts');
const apiEssay = read('src/services/api/repositories.ts');
const httpSrc = read('src/services/api/http.ts');
const theorySrc = read('src/screens/TheoryLessonScreen.tsx');
const videoSrc = read('src/screens/VideoLessonScreen.tsx');
const quizRunnerSrc = read('src/components/QuizRunner.tsx');

// Cắt thân hàm theo mốc để guard không bắt nhầm hàm khác dùng cùng helper.
function body(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a < 0) return '';
  return b > a ? src.slice(a, b) : src.slice(a);
}

console.log('=== 1. getQuestions (GĐ3): server-thắng, không gộp local, lỗi thì ném ===');
// GĐ3: payloadStore/supabaseRepositories đã xóa; getQuestions nằm ở
// contentClient. Luật mới (quyết đã duyệt): API lỗi thì NÉM, không fallback
// lặng sang mock/local — các check fallback cũ được ĐẢO NGƯỢC.
const qBody = body(contentClientSrc, 'async getQuestions', 'async getQuestionById');
check('getQuestions trả map từ server, không gộp local', qBody.includes('return out') && !qBody.includes('readLocalList'));
check('getQuestions không còn ghi cache kiểu cũ (không setItem mam_van_questions)', !qBody.includes('mam_van_questions'));
check('Query lỗi ném (không catch trả cache, không fallback local)', !qBody.includes('catch'));
check('Không còn đường mock cho dữ liệu server', !contentClientSrc.includes('mockQuizRepo') && !contentClientSrc.includes('mockContentRepo'));

console.log('=== 2. fetchCollection (GĐ3, thay syncPayloadCollection): server-only ===');
const syncBody = body(contentClientSrc, 'async function fetchCollection', 'async function fetchOne');
check('Đường đọc không còn đọc local để gộp (không readLocalList trong fetch)', !syncBody.includes('readLocalList'));
check('Không còn tự đẩy local-only lên server trong đường đọc (không saveItem/push)', !syncBody.includes('saveItem') && !syncBody.includes('pushLocal'));
check('Vẫn ghi đè cache bằng server rows + trả list server', syncBody.includes('writeLocalList(cacheKey, list)') && syncBody.includes('return list'));
check('Query lỗi ném, không trả null để caller fallback cache (luật GĐ3 mới)', !syncBody.includes('catch') && !syncBody.includes('return null'));
check('Đường đẩy tường minh còn nguyên (saveItem/deleteItem)', contentClientSrc.includes('async function saveItem') && contentClientSrc.includes('async function deleteItem'));

console.log('=== 3. getTopics (GĐ3): server-only qua fetchCollection ===');
const topicsBody = body(contentClientSrc, 'async getTopics(', 'async getTopicById(');
check('Không còn gộp chủ đề chỉ-có-ở-local (không localOnly)', !topicsBody.includes('localOnly'));
check('Không còn tự đẩy trong đường đọc (không pushTopicRecord trong getTopics)', !topicsBody.includes('pushTopicRecord'));
check('Trả list server qua fetchCollection (ghi đè cache)', topicsBody.includes('fetchCollection'));
check('Query lỗi ném, không fallback mock (luật GĐ3 mới)', !topicsBody.includes('mockContentRepo'));
check('Đường lưu tường minh còn nguyên (saveItem qua apiFetch, lỗi thì ném)', contentClientSrc.includes('async function saveItem') && contentClientSrc.includes('await apiFetch'));

console.log('=== 4. Màn bài học: questionsMap không lót cache local ===');
check('TheoryLessonScreen không còn đọc cache câu hỏi', !theorySrc.includes("localStorage.getItem('mam_van_questions')"));
check('VideoLessonScreen không còn đọc cache câu hỏi', !videoSrc.includes("localStorage.getItem('mam_van_questions')"));
check('Cả 2 màn dùng đúng liveQuestions từ máy chủ', theorySrc.includes('return liveQuestions || {};') && videoSrc.includes('return liveQuestions || {};'));

console.log('=== 5. Hồi quy: các luật server-thắng cũ vẫn giữ (dạng GĐ3) ===');
check('getSubmissions không gộp local (không cleanLocalList)', !apiEssay.includes('cleanLocalList'));
check('getSubmissions lỗi thì ném (luật GĐ3 mới: không fallback local lặng)', httpSrc.includes('throw new ApiError'));

console.log('=== 6. localStorage được GIỮ lại có lý do (fallback / local-only) ===');
check('QuizRunner giữ cache làm fallback khi không có questions qua props (không gộp)', quizRunnerSrc.includes("localStorage.getItem('mam_van_questions')") && quizRunnerSrc.includes('customQuestions && customQuestions.length > 0'));
check('Nháp chấm (mam_van_review_drafts) vẫn local-only (chưa có cột nháp trên DB)', apiEssay.includes("localStorage.getItem('mam_van_review_drafts')"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
