// Tối ưu tải màn chấm (26/10, cùng đợt QA 8 blocker): source-guard cho
// bulk lookup + tải tiến triển ở TeacherGradingScreen.
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
const gradingSrc = read('src/screens/teacher/TeacherGradingScreen.tsx');
const biSrc = read('src/services/supabase/biRepository.ts');
const typesSrc = read('src/services/types.ts');
const mockSrc = read('src/services/mock/mockRepositories.ts');
const typesApp = read('src/types.ts');
const workspaceSrc = read('src/components/teacher/grading/SplitGradingWorkspace.tsx');

console.log('=== 1. Bulk lookup thay N+1 ===');
check('Có helper lookupRealQuestionsBulk', supaSrc.includes('lookupRealQuestionsBulk'));
check('Bulk dùng .in(\'id\', chunk) 1 query cho nhiều id', supaSrc.includes(".in('id', chunk)"));
check('Bulk chia nhỏ mỗi 200 id', supaSrc.includes('i += 200'));
check('Bulk select đủ id để map theo id', supaSrc.includes(".select('id, topic_id, level, payload')"));
check('getSubmissions dùng bulk cho danh sách essay', supaSrc.includes('lookupRealQuestionsBulk((data || []).map((e: any) => e.question_id))'));
check('getSubmissions không còn await lookupRealQuestion từng dòng essay', !supaSrc.includes('const qInfo = await this.lookupRealQuestion(e.question_id)'));
check('Đường gộp review dùng bulk cho mọi phiếu', supaSrc.includes('lookupRealQuestionsBulk(reviews.map(({ r }) => r.questionId))'));
check('Đường gộp review không còn nạp lười từng câu hỏi', !supaSrc.includes('qCache.set(r.questionId, await this.lookupRealQuestion'));
check('lookupRealQuestion đơn lẻ vẫn còn cho đường đơn (chấm/lưu nháp)', supaSrc.includes('private async lookupRealQuestion('));

console.log('=== 2. Tải tiến triển ở màn chấm ===');
check('loadData không còn Promise.all 8 thứ chặn chung', !gradingSrc.includes('await Promise.all(['));
check('Giai đoạn 1 gọi getSubmissions với includeReviews:false + includeReviewText:false rồi set ngay', gradingSrc.includes("getSubmissions({ classId: selectedClassId, includeReviews: false, includeReviewText: false })") && gradingSrc.includes('setSubmissions(subs);'));
check('Phần còn lại set tiến triển qua .then (rubric/mẫu/cấu hình/metrics/topics/quizzes/questions)', gradingSrc.includes('.then(setRubricTemplates)') && gradingSrc.includes('.then(setGradedSamples)') && gradingSrc.includes('.then(setAiConfig)') && gradingSrc.includes('.then(setAccuracyMetrics)') && gradingSrc.includes('.then((t) => setTopics(t || []))') && gradingSrc.includes('.then((q) => setQuizzes(q || []))') && gradingSrc.includes('.then((m) => setQuestionsMap(m || {}))'));
check('Chỉ lần tải đầu mới đặt cờ loading (tải lại giữ danh sách cũ)', gradingSrc.includes('didFirstLoadRef') && gradingSrc.includes('if (!didFirstLoadRef.current) setIsLoadingSubmissions(true);'));
check('Có dòng "Đang tải hàng đợi chấm…" khi submissions đầu tiên chưa về', gradingSrc.includes('Đang tải hàng đợi chấm…'));

console.log('=== 3. Không phá điều hướng next/prev + luồng chấm ===');
check('handleNext đi theo mảng submissions', gradingSrc.includes('setSelectedSubmissionId(submissions[currentIndex + 1].id)'));
check('handlePrev đi theo mảng submissions', gradingSrc.includes('setSelectedSubmissionId(submissions[currentIndex - 1].id)'));
check('gradeSubmission còn nguyên', gradingSrc.includes('essayRepository.gradeSubmission('));
check('Lọc phạm vi giáo viên trong getSubmissions còn nguyên (scopeClassIds/scopeStudentIds)', supaSrc.includes('scopeClassIds') && supaSrc.includes('scopeStudentIds'));
check('Gộp review:<id> còn nguyên', supaSrc.includes('`review:${r.reviewId}`'));

console.log('=== 4. Tải 2 giai đoạn: bài nộp trước, phiếu review sau ===');
check('Filter getSubmissions có cờ includeReviews (tùy chọn)', supaSrc.includes('includeReviews?: boolean'));
check('Khối gộp review chỉ chạy khi includeReviews !== false', supaSrc.includes('if (filter?.includeReviews !== false) {'));
check('Không truyền cờ thì vẫn gộp review như cũ (mặc định giữ hành vi)', supaSrc.includes('if (filter?.includeReviews !== false) {') && supaSrc.includes('`review:${r.reviewId}`'));
check('Khối hợp nhất định danh + khử trùng vẫn nằm sau khối gộp (chạy cả 2 giai đoạn)', supaSrc.indexOf('HỢP NHẤT ĐỊNH DANH HỌC SINH') > supaSrc.indexOf('Bỏ qua gộp phiếu chấm vào hàng đợi'));
check('Giai đoạn 2 gọi getSubmissions đầy đủ (có review, chỉ hoãn text) rồi thay toàn bộ danh sách', gradingSrc.includes('const full = await essayRepository.getSubmissions({ classId: selectedClassId, includeReviewText: false });') && gradingSrc.includes('setSubmissions(full);'));
check('Giai đoạn 2 lỗi thì giữ danh sách giai đoạn 1 (không xóa trắng)', gradingSrc.includes("console.error('Lỗi nạp phiếu chấm từ bài tập:'") && !gradingSrc.includes('setSubmissions([])'));
check('Chống lần tải cũ ghi đè lần mới (loadSeqRef + kiểm tra seq trước khi set)', gradingSrc.includes('loadSeqRef') && gradingSrc.includes('if (seq !== loadSeqRef.current) return;'));
check('Có chỉ báo riêng khi giai đoạn 2 đang tải', gradingSrc.includes('Đang tải thêm phiếu chấm từ bài tập…'));
check('Bài đang chọn xác định theo id (không nhảy khi giai đoạn 2 thay mảng)', gradingSrc.includes('submissions.find((s) => s.id === selectedSubmissionId)'));

console.log('=== 5. Đợt 3: song song hóa + hoãn full bài văn ở đường review ===');
check('Vòng 1 song song: names + attempts + reviews trong 1 Promise.all', biSrc.includes('const [names, { data: atts }, { data: reviews }] = await Promise.all(['));
check('Vòng 2 song song: answers + assignments + activities trong 1 Promise.all', biSrc.includes('const [{ data: answers }, { data: asgs }, { data: acts }] = await Promise.all(['));
check('Questions select nằm SAU vòng 2 (phụ thuộc answers)', biSrc.indexOf("from('questions').select('id, prompt, type')") > biSrc.indexOf('const [{ data: answers }'));
check('Đường list hoãn text: select cột cụ thể, không response_json khi flag false', biSrc.includes(".select('answer_id, attempt_id, question_id, is_correct, score_awarded, max_score, grading_status, grading_method, response_time_seconds')"));
check('Nhánh mặc định vẫn select * (hành vi cũ cho nơi gọi khác)', biSrc.includes("? supabase.from('attempt_answers').select('*')"));
check('responseText = \'\' khi hoãn', biSrc.includes("responseText: includeResponseText ? renderResponse(ans.response_json) : ''"));
check('Mặc định opts vắng = full text (không đổi hành vi cũ)', biSrc.includes('const includeResponseText = opts?.includeResponseText !== false;'));
check('getPendingReviews/getGradedReviews nhận opts', biSrc.includes('getPendingReviews(studentIds: string[], opts?: { includeResponseText?: boolean })') && biSrc.includes('getGradedReviews(studentIds: string[], opts?: { includeResponseText?: boolean })'));
check('getReviewAnswerContent tồn tại ở biRepository, select response_json theo answer_id', biSrc.includes('export async function getReviewAnswerContent(answerId: string)') && biSrc.includes(".eq('answer_id', answerId)"));
check('Interface EssayRepository có getReviewAnswerContent', typesSrc.includes('getReviewAnswerContent(answerId: string): Promise<string>;'));
check('Supabase class delegate getReviewAnswerContent', supaSrc.includes('async getReviewAnswerContent(answerId: string): Promise<string>'));
check('Mock có getReviewAnswerContent (trả rỗng, mock đã có content sẵn)', mockSrc.includes('async getReviewAnswerContent(_answerId: string)'));
check('getSubmissions filter có includeReviewText + truyền xuống cả 2 đường review', supaSrc.includes('includeReviewText?: boolean') && supaSrc.includes('getPendingReviews(reviewStudentIds, { includeResponseText: includeReviewText })') && supaSrc.includes('getGradedReviews(reviewStudentIds, { includeResponseText: includeReviewText })'));
check('Dedup có fallback || sub.id (2 phiếu hoãn text không sập vào nhau)', supaSrc.includes("const contentKey = (sub.content || '').trim().slice(0, 120) || sub.id;"));
check('EssaySubmission có answerId để detail fetch', typesApp.includes('answerId?: string;'));
check('Review item gộp mang answerId', supaSrc.includes('answerId: r.answerId,'));
check('Màn chấm: cả 2 giai đoạn đều truyền includeReviewText:false', gradingSrc.includes('includeReviews: false, includeReviewText: false') && gradingSrc.includes('includeReviewText: false });'));
check('Detail fetch: chỉ review: + content rỗng + có answerId mới fetch', gradingSrc.includes("sel.id.startsWith('review:')") && gradingSrc.includes('essayRepository.getReviewAnswerContent(answerId)'));
check('Detail fetch ghi lại content + wordCount vào đúng id', gradingSrc.includes('content: text, wordCount:'));
check('Workspace nhận contentLoading và hiện "Đang tải bài làm…" thay vì "nộp bài trắng"', gradingSrc.includes('contentLoading={detailContentLoadingId === selectedSubmission.id}') && workspaceSrc.includes('contentLoading?: boolean;') && workspaceSrc.includes('Đang tải bài làm…'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
