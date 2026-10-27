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
// SQL trong file route nằm trong template literal nên backtick bị escape (\`) —
// chuẩn hóa trước khi so khớp chuỗi truy vấn.
const deesc = (x: string) => x.replace(/\\/g, '');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');
const essaysSrv = read('api/routes/essays.ts');
const apiEssay = read('src/services/api/repositories.ts');
const gradingSrc = read('src/screens/teacher/TeacherGradingScreen.tsx');
const biClientSrc = read('src/services/api/biClient.ts');
const dashboardSrv = read('api/routes/dashboard.ts');
const typesSrc = read('src/services/types.ts');
const mockSrc = read('src/services/mock/mockRepositories.ts');
const typesApp = read('src/types.ts');
const workspaceSrc = read('src/components/teacher/grading/SplitGradingWorkspace.tsx');

console.log('=== 1. Bulk lookup thay N+1 (GĐ3: SQL IN ở server, không query từng dòng) ===');
// GĐ3: lookupRealQuestionsBulk (Supabase client) đã xóa; bulk nằm ở route
// server: 1 query IN cho nhiều id, không còn vòng lặp await từng câu.
check('Câu hỏi lookup 1 query IN theo id (essays server)', deesc(essaysSrv).includes('FROM `questions` WHERE `id` IN ('));
check('Dashboard attempts: answers 1 query IN theo attempt', deesc(dashboardSrv).includes('FROM `attempt_answers` WHERE `attempt_id` IN ('));
check('Dashboard attempts: questions 1 query IN theo id', deesc(dashboardSrv).includes('FROM `questions` WHERE `id` IN ('));
check('Đường đơn vẫn có getReviewAnswerContent (client + route server)', apiEssay.includes('async getReviewAnswerContent(answerId: string)') && essaysSrv.includes("get('/reviews/:answerId'"));

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
check('Lọc phạm vi giáo viên trong getSubmissions còn nguyên (teacherClassIds/canAccessStudent ở server)', essaysSrv.includes('teacherClassIds') && essaysSrv.includes('canAccessStudent'));
check('Gộp review:<id> còn nguyên', essaysSrv.includes('`review:${r.review_id}`'));

console.log('=== 4. Tải 2 giai đoạn: bài nộp trước, phiếu review sau ===');
check('Filter getSubmissions có cờ includeReviews (tùy chọn)', apiEssay.includes('includeReviews?: boolean'));
check('Khối gộp review chỉ chạy khi includeReviews !== false (server)', essaysSrv.includes("q.includeReviews !== 'false'"));
check('Không truyền cờ thì vẫn gộp review như cũ (mặc định giữ hành vi)', essaysSrv.includes("q.includeReviews !== 'false'") && essaysSrv.includes('`review:${r.review_id}`'));
check('Khối hợp nhất + khử trùng còn nguyên ở client (contentKey fallback || sub.id)', apiEssay.includes('const contentKey') && apiEssay.includes('|| sub.id;'));
check('Giai đoạn 2 gọi getSubmissions đầy đủ (có review, chỉ hoãn text) rồi thay toàn bộ danh sách', gradingSrc.includes('const full = await essayRepository.getSubmissions({ classId: selectedClassId, includeReviewText: false });') && gradingSrc.includes('setSubmissions(full);'));
check('Giai đoạn 2 lỗi thì giữ danh sách giai đoạn 1 (không xóa trắng)', gradingSrc.includes("console.error('Lỗi nạp phiếu chấm từ bài tập:'") && !gradingSrc.includes('setSubmissions([])'));
check('Chống lần tải cũ ghi đè lần mới (loadSeqRef + kiểm tra seq trước khi set)', gradingSrc.includes('loadSeqRef') && gradingSrc.includes('if (seq !== loadSeqRef.current) return;'));
check('Có chỉ báo riêng khi giai đoạn 2 đang tải', gradingSrc.includes('Đang tải thêm phiếu chấm từ bài tập…'));
check('Bài đang chọn xác định theo id (không nhảy khi giai đoạn 2 thay mảng)', gradingSrc.includes('submissions.find((s) => s.id === selectedSubmissionId)'));

console.log('=== 5. Đợt 3 (GĐ3): số query cố định ở server + hoãn full bài văn ở đường review ===');
// GĐ3: song song Promise.all ở client Supabase đã thay bằng route server:
// dashboard attempts chạy đúng 6 query cố định (attempts/answers/questions/
// students/assignments/activities), không N+1 theo lượt làm.
check('Dashboard attempts: đủ 6 query cố định, không N+1', deesc(dashboardSrv).includes('FROM `attempts`') && deesc(dashboardSrv).includes('FROM `attempt_answers` WHERE `attempt_id` IN (') && deesc(dashboardSrv).includes('FROM `questions` WHERE `id` IN (') && deesc(dashboardSrv).includes('FROM `students`') && deesc(dashboardSrv).includes('FROM `assignments` WHERE `id` IN (') && deesc(dashboardSrv).includes('FROM `learning_activities` WHERE `id` IN ('));
check('Đường review hoãn text ở server (includeResponseText=false → responseText rỗng)', essaysSrv.includes("includeResponseText ? renderResponse(ans.response_json, parseJson) : ''"));
check('Server reviews tôn trọng cờ includeResponseText qua query', essaysSrv.includes("req.query.includeResponseText !== 'false'"));
check('Mặc định opts vắng = full text (client chỉ cắt khi flag false)', biClientSrc.includes('if (opts?.includeResponseText === false)'));
check('getPendingReviews/getGradedReviews nhận opts', biClientSrc.includes('export async function getPendingReviews(') && biClientSrc.includes('opts?: { includeResponseText?: boolean }') && biClientSrc.includes('export async function getGradedReviews('));
check('getReviewAnswerContent tồn tại ở biClient (route /reviews/:answerId)', biClientSrc.includes('export async function getReviewAnswerContent(answerId: string)') && essaysSrv.includes("get('/reviews/:answerId'"));
check('Interface EssayRepository có getReviewAnswerContent', typesSrc.includes('getReviewAnswerContent(answerId: string): Promise<string>;'));
check('Client ApiEssay delegate getReviewAnswerContent', apiEssay.includes('async getReviewAnswerContent(answerId: string)'));
check('Mock có getReviewAnswerContent (trả rỗng, mock đã có content sẵn)', mockSrc.includes('async getReviewAnswerContent(_answerId: string)'));
check('getSubmissions filter có includeReviewText + truyền xuống server', apiEssay.includes('includeReviewText?: boolean') && apiEssay.includes('include_review_text:'));
check('Dedup có fallback || sub.id (2 phiếu hoãn text không sập vào nhau)', apiEssay.includes("const contentKey = (sub.content || '').trim().slice(0, 120) || sub.id;"));
check('EssaySubmission có answerId để detail fetch', typesApp.includes('answerId?: string;'));
check('Review item gộp mang answerId', apiEssay.includes('answerId: r.answerId'));
check('Màn chấm: cả 2 giai đoạn đều truyền includeReviewText:false', gradingSrc.includes('includeReviews: false, includeReviewText: false') && gradingSrc.includes('includeReviewText: false });'));
check('Detail fetch: chỉ review: + content rỗng + có answerId mới fetch', gradingSrc.includes("sel.id.startsWith('review:')") && gradingSrc.includes('essayRepository.getReviewAnswerContent(answerId)'));
check('Detail fetch ghi lại content + wordCount vào đúng id', gradingSrc.includes('content: text, wordCount:'));
check('Workspace nhận contentLoading và hiện "Đang tải bài làm…" thay vì "nộp bài trắng"', gradingSrc.includes('contentLoading={detailContentLoadingId === selectedSubmission.id}') && workspaceSrc.includes('contentLoading?: boolean;') && workspaceSrc.includes('Đang tải bài làm…'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
