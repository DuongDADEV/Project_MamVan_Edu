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
const supaSrc = read('src/services/supabase/supabaseRepositories.ts');
const payloadSrc = read('src/services/supabase/payloadStore.ts');
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

console.log('=== 1. getQuestions: DB-thắng (vụ ngân hàng 38 vs 22 câu) ===');
check('DB thành công trả đúng server rows (không còn biến mergedQuestions)', supaSrc.includes('return supabaseMap;') && !supaSrc.includes('mergedQuestions'));
check('Ghi đè cache bằng server rows để câu ma tự biến mất khi tải lại', supaSrc.includes("localStorage.setItem('mam_van_questions', JSON.stringify(supabaseMap))"));
check('Fallback local khi query lỗi vẫn còn (error + catch)', supaSrc.split('return ownLocalQuestions()').length >= 3);
check('Offline vẫn dùng mock (không đổi)', supaSrc.includes('if (!isSupabaseReady())') && supaSrc.includes('mockQuizRepo.getQuestions(topicId)'));

console.log('=== 2. syncPayloadCollection: server-only (quizzes/videos/theories) ===');
const syncBody = body(payloadSrc, 'export async function syncPayloadCollection', 'export function filterContentItems');
check('Đường đọc không còn đọc local để gộp (không readLocalList trong sync)', !syncBody.includes('readLocalList'));
check('Không còn tự đẩy local-only lên server trong đường đọc (không toPush)', !syncBody.includes('toPush'));
check('Vẫn ghi đè cache bằng server rows + trả list server', syncBody.includes('writeLocalList(storageKey, list)') && syncBody.includes('return list'));
check('Query lỗi vẫn trả null để caller fallback cache', syncBody.includes('return null'));
check('Đường đẩy tường minh còn nguyên (save/delete dùng pushLocalById)', payloadSrc.includes('export async function pushLocalById'));

console.log('=== 3. getTopics: server-only ===');
const topicsBody = body(supaSrc, 'async getTopics(', 'async saveTopic(');
check('Không còn gộp chủ đề chỉ-có-ở-local (không localOnly)', !topicsBody.includes('localOnly'));
check('Không còn tự đẩy trong đường đọc (không pushTopicRecord trong getTopics)', !topicsBody.includes('pushTopicRecord'));
check('Trả đúng remoteTopics + ghi đè cache bằng server rows', topicsBody.includes('const topics: TopicWithMeta[] = remoteTopics;') && topicsBody.includes('writeLocalList(TOPIC_CACHE_KEY, topics)'));
check('Query lỗi vẫn fallback mock', topicsBody.includes('mockContentRepo.getTopics(classId, onlyPublished)'));
check('Đường lưu tường minh còn nguyên (saveTopic upsert + ném khi lỗi)', supaSrc.includes("from('topics')") && supaSrc.includes('Không lưu được chủ đề lên máy chủ'));

console.log('=== 4. Màn bài học: questionsMap không lót cache local ===');
check('TheoryLessonScreen không còn đọc cache câu hỏi', !theorySrc.includes("localStorage.getItem('mam_van_questions')"));
check('VideoLessonScreen không còn đọc cache câu hỏi', !videoSrc.includes("localStorage.getItem('mam_van_questions')"));
check('Cả 2 màn dùng đúng liveQuestions từ máy chủ', theorySrc.includes('return liveQuestions || {};') && videoSrc.includes('return liveQuestions || {};'));

console.log('=== 5. Hồi quy: các luật DB-thắng cũ vẫn giữ ===');
check('getSubmissions DB thành công chỉ dùng remoteList (không gộp cleanLocalList)', supaSrc.includes('let merged = [...remoteList]') && !supaSrc.includes('[...remoteList, ...cleanLocalList]'));
check('getSubmissions lỗi vẫn fallback local', supaSrc.includes('[SupabaseEssay] Lỗi getSubmissions Supabase, dùng fallback local:'));

console.log('=== 6. localStorage được GIỮ lại có lý do (fallback / local-only) ===');
check('QuizRunner giữ cache làm fallback khi không có questions qua props (không gộp)', quizRunnerSrc.includes("localStorage.getItem('mam_van_questions')") && quizRunnerSrc.includes('customQuestions && customQuestions.length > 0'));
check('Nháp chấm (mam_van_review_drafts) vẫn local-only (chưa có cột nháp trên DB)', supaSrc.includes("localStorage.getItem('mam_van_review_drafts')"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
