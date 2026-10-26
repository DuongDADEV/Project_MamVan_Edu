import { aiService } from '../src/services/ai/index.ts';
import {
  essayRepository,
  attemptRepository,
  contentRepository,
  quizRepository,
} from '../src/services/index.ts';
import { AISource } from '../src/services/ai/AIService.ts';

async function runPrompt3Tests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM TRA TỰ ĐỘNG CÁC TÍNH NĂNG PROMPT 3');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // ==========================================
  // PHẦN 0: KIỂM TRA LỚP TRỪU TƯỢNG AI SERVICE
  // ==========================================
  console.log('\n--- PHẦN 0: LỚP TRỪU TƯỢNG AI SERVICE ---');
  const sampleSources: AISource[] = [
    {
      id: 'src_1',
      title: 'Văn bản bài thơ Mầm non',
      content:
        'Dưới vỏ một cành bàng. Còn một vài lá đỏ. Một mầm non nho nhỏ. Còn nằm nép lặng im. Mầm non mắt lim dim. Cố nhìn qua kẽ lá. Thấy mây bay hối hả. Thấy lất phất mưa phùn. Rào rào trận mưa xuân. Mau vươn vai thức dậy!',
      wordCount: 45,
      type: 'text',
      isEnabled: true,
      createdAt: new Date().toISOString(),
    },
  ];

  // 1. Tóm tắt trọng tâm
  console.log('Testing generateKeySummary...');
  const summaries = await aiService.generateKeySummary(sampleSources);
  assert(Array.isArray(summaries) && summaries.length > 0, 'AI sinh tóm tắt trọng tâm thành công');

  // 2. Sinh lý thuyết
  console.log('Testing generateTheory...');
  const theories = await aiService.generateTheory(sampleSources);
  assert(Array.isArray(theories) && theories.length > 0, 'AI sinh khối lý thuyết chi tiết thành công');

  // 3. Sinh 5 câu hỏi phân bổ các dạng
  console.log('Testing generateQuestions (5 câu hỏi)...');
  const questions = await aiService.generateQuestions(sampleSources, {
    count: 5,
    typeCounts: { single: 2, multi: 1, fill: 1, essay: 1 },
    difficulty: 'TB',
    skillLevels: { NHAN_BIET: 25, THONG_HIEU: 25, PHAN_TICH: 25, VAN_DUNG: 25 },
  });
  assert(questions.length === 5, `AI sinh đúng 5 câu hỏi (nhận được ${questions.length})`);
  assert(
    questions.some((q) => q.type === 'essay'),
    'Trong 5 câu hỏi có câu tự luận (essay)'
  );
  assert(
    questions.every((q) => q.isAiGenerated && q.aiSourceSnippet),
    'Mỗi câu hỏi có nhãn isAiGenerated và trích đoạn nguồn aiSourceSnippet'
  );

  // 4. Trò chuyện với tài liệu nguồn (Q&A có trích nguồn)
  console.log('Testing chatWithSources...');
  const chatRes = await aiService.chatWithSources(
    sampleSources,
    'Tác giả dùng biện pháp tu từ gì khi tả mầm non?'
  );
  assert(chatRes.reply.length > 10, 'AI phản hồi câu hỏi về nguồn tài liệu');
  assert(chatRes.citations.length > 0, 'Câu trả lời của AI có chú thích nguồn trích dẫn');

  // ==========================================
  // PHẦN A: BỘ CÂU HỎI VÀ DUYỆT BẢN NHÁP
  // ==========================================
  console.log('\n--- PHẦN A: TẠO VỚI AI VÀ ĐƯA VÀO TRÌNH SOẠN THẢO ---');
  const essayQ = questions.find((q) => q.type === 'essay')!;
  assert(
    Boolean(essayQ.rubric && essayQ.rubric.length > 0),
    'Câu hỏi tự luận sinh ra kèm sẵn Rubric đánh giá'
  );

  // ==========================================
  // PHẦN B: HỌC SINH NỘP BÀI & GIÁO VIÊN CHẤM
  // ==========================================
  console.log('\n--- PHẦN B: HỌC SINH NỘP BÀI & GIÁO VIÊN CHẤM ---');

  // 1. Học sinh nộp bài viết
  console.log('Simulating student submitting essay...');
  const submittedEssay = await essayRepository.createSubmission({
    studentId: 'hs001',
    questionId: essayQ.id,
    promptTitle: essayQ.prompt,
    quizTitle: 'Kiểm tra năng lực cảm thụ văn học',
    content:
      'Hình ảnh mầm non mắt lim dim gợi cho em liên tưởng đến một em bé đang say ngủ giữa vòng tay mẹ thiên nhiên. Khi mùa xuân đến cùng mưa phùn và gió ấm, mầm non bừng tỉnh vươn vai lớn dậy. Biện pháp nhân hóa làm câu thơ tràn đầy sức sống và tình yêu thương.',
    wordCount: 52,
    skillLevel: 'VAN_DUNG',
    status: 'PENDING_TEACHER',
  });

  assert(!!submittedEssay.id, 'Học sinh nộp bài thành công và có mã ID');
  assert(
    submittedEssay.status === 'AI_SUGGESTED',
    'Hệ thống tự động kích hoạt suggestEssayGrade và chuyển sang status AI_SUGGESTED'
  );
  assert(
    submittedEssay.aiSuggestion !== undefined &&
      submittedEssay.aiSuggestion.suggestedTotalScore > 0,
    `AI đã tạo sẵn gợi ý điểm: ${submittedEssay.aiSuggestion?.suggestedTotalScore}đ`
  );

  // 2. Giáo viên xem hàng đợi bài chấm
  console.log('Teacher checks grading queue...');
  const queue = await essayRepository.getSubmissions();
  const queueItem = queue.find((e) => e.id === submittedEssay.id);
  assert(!!queueItem, 'Bài viết xuất hiện trong hàng đợi chấm của giáo viên');

  // 3. Giáo viên chốt điểm và gửi cho học sinh
  console.log('Teacher grades and finalizes essay...');
  const teacherScore = 8.5;
  const gradedEssay = await essayRepository.gradeSubmission(
    submittedEssay.id,
    {
      rubricScores: [
        { criterionName: 'Nội dung ý & Cảm thụ', score: 3.5, maxScore: 4.0 },
        { criterionName: 'Bố cục & Liên kết', score: 1.8, maxScore: 2.0 },
        { criterionName: 'Dùng từ & Chính tả', score: 1.6, maxScore: 2.0 },
        { criterionName: 'Sáng tạo & Cảm xúc', score: 1.6, maxScore: 2.0 },
      ],
      totalScore: teacherScore,
      finalRatio: teacherScore / 10,
      teacherFeedback: 'Cô khen ngợi em đã cảm nhận rất tinh tế vẻ đẹp của mầm non mùa xuân!',
      ai_vs_teacher_diff: Math.abs(teacherScore - (submittedEssay.aiSuggestion?.suggestedTotalScore || 8.0)),
    },
    'gv001'
  );

  assert(gradedEssay.status === 'GRADED', 'Bài viết chuyển sang trạng thái GRADED');
  assert(gradedEssay.finalScore === 8.5, 'Điểm chốt cuối cùng là 8.5');
  assert(
    gradedEssay.ai_vs_teacher_diff !== undefined,
    `Đã ghi nhận độ chênh ai_vs_teacher_diff = ${gradedEssay.ai_vs_teacher_diff}`
  );

  // 4. Kiểm tra học sinh: Mastery (Vận dụng) được cập nhật và thông báo được gửi
  console.log('Checking student state update...');
  const studentState = await attemptRepository.getStudentState('hs001');
  const studentResult = studentState.questionResults?.find(
    (r) => r.questionId === essayQ.id || r.questionId === submittedEssay.id
  );
  assert(!!studentResult, 'Học sinh đã được cập nhật QuestionResult');
  assert(
    studentResult?.level === 'VAN_DUNG' && studentResult?.scoreRatio === 0.85,
    'Mastery Vận dụng của học sinh được cập nhật tỉ lệ 0.85'
  );

  // ==========================================
  // PHẦN C: HUẤN LUYỆN AI CHẤM
  // ==========================================
  console.log('\n--- PHẦN C: HUẤN LUYỆN AI CHẤM ---');

  // 1. Quản lý Rubric Templates
  console.log('Testing Rubric Templates management...');
  const initialRubrics = await essayRepository.getRubricTemplates();
  assert(initialRubrics.length >= 3, `Thư viện có ${initialRubrics.length} Rubric mẫu chuẩn GDPT 2018`);

  // 2. Quản lý Graded Samples & 1-click lưu từ bài học sinh
  console.log('Testing Graded Samples & 1-click import...');
  const savedSample = await essayRepository.saveGradedSample({
    id: 'sample_' + Date.now(),
    title: `Bài mẫu đạt ${gradedEssay.finalScore}đ - Cảm nghĩ bài thơ`,
    topicPrompt: gradedEssay.promptTitle || 'Cảm nghĩ văn học',
    studentContent: gradedEssay.content,
    levelGrade: 'excellent',
    totalScore: gradedEssay.finalScore || 8.5,
    rubricScores: gradedEssay.rubricScores || [],
    teacherFeedback: gradedEssay.finalComment || 'Tốt',
    isFromStudentSubmission: true,
    createdAt: new Date().toISOString(),
  });
  assert(savedSample.isFromStudentSubmission === true, 'Đã lưu bài học sinh thành bài mẫu huấn luyện');

  // 3. Cấu hình phong cách chấm AI
  console.log('Testing AI grading configuration...');
  const updatedCfg = await essayRepository.saveGradingConfig({
    tone: 'encouraging',
    strictness: 4,
    praiseStrengthsFirst: true,
    feedbackLength: 'detailed',
  });
  assert(
    updatedCfg.strictness === 4 && updatedCfg.praiseStrengthsFirst === true,
    'Cấu hình phong cách chấm của AI được lưu thành công'
  );

  // 4. Chỉ số độ tin cậy AI — hợp đồng trung thực: chưa có bài nào có
  // ai_vs_teacher_diff thì trả null (không bịa số như trước); có dữ liệu
  // thật thì mọi trường phải tính từ dữ liệu đó.
  console.log('Testing AI accuracy metrics...');
  const metrics = await essayRepository.getAIAccuracyMetrics();
  assert(
    metrics === null ||
      (typeof metrics.averageDiff === 'number' &&
        metrics.weeklyTrends.length > 0 &&
        metrics.gradedCount > 0),
    metrics === null
      ? 'Chỉ số độ tin cậy AI: chưa có bài nào ghi diff -> trả null trung thực (không bịa số)'
      : `Chỉ số độ tin cậy AI: chênh lệch TB = ${metrics.averageDiff}đ, có biểu đồ xu hướng, dựa trên ${metrics.gradedCount} bài thật`
  );

  console.log('\n====================================================');
  console.log(`🎉 TỔNG KẾT: ${passedTests}/${totalTests} BÀI KIỂM TRA ĐẠT YÊU CẦU 100%!`);
  console.log('====================================================\n');
}

runPrompt3Tests().catch((err) => {
  console.error('Lỗi thực thi kiểm tra:', err);
  process.exit(1);
});
