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
check('Hàng đợi được set ngay khi submissions về', gradingSrc.includes('const subs = await essayRepository.getSubmissions({ classId: selectedClassId });') && gradingSrc.includes('setSubmissions(subs);'));
check('Phần còn lại set tiến triển qua .then (rubric/mẫu/cấu hình/metrics/topics/quizzes/questions)', gradingSrc.includes('.then(setRubricTemplates)') && gradingSrc.includes('.then(setGradedSamples)') && gradingSrc.includes('.then(setAiConfig)') && gradingSrc.includes('.then(setAccuracyMetrics)') && gradingSrc.includes('.then((t) => setTopics(t || []))') && gradingSrc.includes('.then((q) => setQuizzes(q || []))') && gradingSrc.includes('.then((m) => setQuestionsMap(m || {}))'));
check('Chỉ lần tải đầu mới đặt cờ loading (tải lại giữ danh sách cũ)', gradingSrc.includes('didFirstLoadRef') && gradingSrc.includes('if (!didFirstLoadRef.current) setIsLoadingSubmissions(true);'));
check('Có dòng "Đang tải hàng đợi chấm…" khi submissions đầu tiên chưa về', gradingSrc.includes('Đang tải hàng đợi chấm…'));

console.log('=== 3. Không phá điều hướng next/prev + luồng chấm ===');
check('handleNext đi theo mảng submissions', gradingSrc.includes('setSelectedSubmissionId(submissions[currentIndex + 1].id)'));
check('handlePrev đi theo mảng submissions', gradingSrc.includes('setSelectedSubmissionId(submissions[currentIndex - 1].id)'));
check('gradeSubmission còn nguyên', gradingSrc.includes('essayRepository.gradeSubmission('));
check('Lọc phạm vi giáo viên trong getSubmissions còn nguyên (scopeClassIds/scopeStudentIds)', supaSrc.includes('scopeClassIds') && supaSrc.includes('scopeStudentIds'));
check('Gộp review:<id> còn nguyên', supaSrc.includes('`review:${r.reviewId}`'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
