import {
  ClassItem,
  StudentAccount,
  TeacherProfile,
  TopicWithMeta,
  VideoLessonWithMeta,
  TheoryLessonWithMeta,
  QuizWithMeta,
  QuestionWithMeta,
  AuditLog,
} from '../types.ts';
import {
  TOPICS,
  VIDEOS,
  THEORIES,
  QUIZZES,
  QUESTIONS_BANK,
  createInitialStateHs001,
  createInitialStateHs002,
} from '../../data/mockData.ts';
import { REWARDS_CATALOG } from '../../data/rewards.ts';
import {
  EssaySubmission,
  RewardItem,
  RewardRequest,
  StudentState,
  RubricTemplate,
  GradedSampleEssay,
  AIGradingConfig,
} from '../../types.ts';

export const SEED_TEACHERS: TeacherProfile[] = [
  {
    id: 'gv001',
    name: 'Thầy Nguyễn Văn An',
    username: 'gv001',
    role: 'teacher',
    email: 'nguyenvanan.van7@mamvan.edu.vn',
    subject: 'Ngữ văn 7',
    school: 'THCS Giấy & Mực',
    classIds: ['class_7a2', 'class_7a3'],
    avatarUrl: '',
    phone: '0912 345 678',
    status: 'active',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'gv002',
    name: 'Cô Trần Thị Mai',
    username: 'gv002',
    role: 'teacher',
    email: 'tranmai.van7@mamvan.edu.vn',
    subject: 'Ngữ văn 7',
    school: 'THCS Chu Văn An',
    classIds: [],
    avatarUrl: '',
    phone: '0988 765 432',
    status: 'trial',
    trialDays: 3,
    trialExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    notes: 'Đăng ký dùng thử 3 ngày từ Zalo lớp',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'gv003',
    name: 'Thầy Lê Hoàng Nam',
    username: 'gv003',
    role: 'teacher',
    email: 'lehoangnam@thcs.edu.vn',
    subject: 'Ngữ văn 7',
    school: 'THCS Lương Thế Vinh',
    classIds: [],
    avatarUrl: '',
    phone: '0903 112 233',
    status: 'locked',
    notes: 'Tạm khóa do hết hạn dùng thử',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const SEED_CLASSES: ClassItem[] = [
  {
    id: 'class_7a2',
    name: '7A2',
    grade: 'Lớp 7',
    schoolYear: '2026-2027',
    teacherId: 'gv001',
    description: 'Lớp chọn văn học - Buổi sáng',
    studentCount: 2,
    active7DaysCount: 2,
    status: 'active',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'class_7a3',
    name: '7A3',
    grade: 'Lớp 7',
    schoolYear: '2026-2027',
    teacherId: 'gv001',
    description: 'Lớp Ngữ văn cơ bản - Buổi chiều',
    studentCount: 0,
    active7DaysCount: 0,
    status: 'active',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const SEED_STUDENTS: StudentAccount[] = [
  {
    id: 'hs001',
    name: 'Nguyễn Minh Anh',
    username: 'hs001',
    // KHÔNG lưu mật khẩu thô ở production. Trong mock để demo đăng nhập.
    password_hash: '123456',
    class_id: 'class_7a2',
    student_code: 'HS7A2-01',
    dob: '2013-05-15',
    status: 'active',
    has_logged_in: true,
    last_active_at: Date.now() - 3600000,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'hs002',
    name: 'Trần Gia Bảo',
    username: 'hs002',
    // KHÔNG lưu mật khẩu thô ở production. Trong mock để demo đăng nhập.
    password_hash: '123456',
    class_id: 'class_7a2',
    student_code: 'HS7A2-02',
    dob: '2013-08-20',
    status: 'active',
    has_logged_in: false,
    last_active_at: null,
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function getSeedTopics(): TopicWithMeta[] {
  const now = new Date().toISOString();
  return TOPICS.map((t) => ({
    ...t,
    created_at: now,
    updated_at: now,
    status: 'published',
    class_ids: ['all', 'class_7a2'],
    version: 1,
    has_unpublished_edits: false,
  }));
}

export function getSeedVideos(): VideoLessonWithMeta[] {
  const now = new Date().toISOString();
  const publishedVideos: VideoLessonWithMeta[] = Object.values(VIDEOS).map((v) => ({
    ...v,
    created_at: now,
    updated_at: now,
    status: 'published',
    class_ids: ['all', 'class_7a2'],
    version: 1,
    has_unpublished_edits: false,
  }));

  // Thêm video Bản nháp để thử nghiệm quy trình Xuất bản
  const draftVideo: VideoLessonWithMeta = {
    id: 'video_tho_draft',
    topicId: 'topic_tho_bon_nam',
    title: 'Bài 3 (Dự thảo): Phân tích nhạc điệu và cách hiệp vần độc đáo',
    durationSec: 540,
    sampleUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    subtopics: ['Vần trắc vần bằng', 'Nhịp 1/3 phá cách'],
    summaryPoints: [
      {
        title: 'Quy luật nhạc điệu',
        content: 'Nhịp điệu trong thơ bốn chữ tạo nên giọng điệu vui tươi, hồn nhiên hoặc lắng đọng tâm tư.',
        example: '"Chú bé loắt choắt / Cái xắc xinh xinh" (nhịp 2/2 vui tươi)',
      },
    ],
    practiceQuizId: 'quiz_tho1_practice',
    quickTestId: 'quiz_tho1_quick',
    masteryCheckId: 'quiz_tho1_mastery',
    created_at: now,
    updated_at: now,
    status: 'draft',
    class_ids: ['class_7a2'],
    version: 1,
    has_unpublished_edits: false,
  };

  return [...publishedVideos, draftVideo];
}

export function getSeedTheories(): TheoryLessonWithMeta[] {
  const now = new Date().toISOString();
  const publishedTheories: TheoryLessonWithMeta[] = Object.values(THEORIES).map((t) => ({
    ...t,
    created_at: now,
    updated_at: now,
    status: 'published',
    class_ids: ['all', 'class_7a2'],
    version: 1,
    has_unpublished_edits: false,
  }));

  // Thêm lý thuyết Bản nháp để thử nghiệm xuất bản
  const draftTheory: TheoryLessonWithMeta = {
    id: 'theory_draft_nang_cao',
    topicId: 'topic_tu_lay_so_sanh',
    title: 'Cẩm nang mở rộng: Biện pháp tu từ ẩn dụ và hoán dụ trong thơ 7',
    minReadSeconds: 30,
    kind: 'general_topic',
    sections: [
      {
        id: 'sec_draft_01',
        title: '1. Khái niệm và nhận diện',
        body: ['Ẩn dụ là gọi tên sự vật, hiện tượng này bằng tên sự vật, hiện tượng khác có nét tương đồng.'],
        takeaway: 'Ghi nhớ: Ẩn dụ bản chất là so sánh ngầm.',
      },
    ],
    blocks: [
      {
        id: 'b1',
        type: 'heading',
        level: 2,
        content: '1. Khái niệm và nhận diện biện pháp ẩn dụ',
      },
      {
        id: 'b2',
        type: 'paragraph',
        content: 'Ẩn dụ là cách gọi tên sự vật, hiện tượng này bằng tên sự vật, hiện tượng khác có nét tương đồng với nó nhằm tăng sức gợi hình, gợi cảm.',
      },
      {
        id: 'b3',
        type: 'example',
        exampleText: 'Người Cha mái tóc bạc / Đốt lửa cho anh nằm',
        exampleAnalysis: 'Hình ảnh "Người Cha" ẩn dụ chỉ Bác Hồ kính yêu với tấm lòng bao la ấm áp.',
      },
      {
        id: 'b4',
        type: 'takeaway',
        takeawayText: 'Ghi nhớ trọng tâm: Ẩn dụ là so sánh ngầm không có từ so sánh (như, là).',
      },
    ],
    practiceQuizId: 'quiz_lay_practice',
    testQuizId: 'quiz_lay_quick',
    created_at: now,
    updated_at: now,
    status: 'draft',
    class_ids: ['class_7a2'],
    version: 1,
    has_unpublished_edits: false,
  };

  return [...publishedTheories, draftTheory];
}

export function getSeedQuizzes(): QuizWithMeta[] {
  const now = new Date().toISOString();
  const publishedQuizzes: QuizWithMeta[] = Object.values(QUIZZES).map((q) => ({
    ...q,
    created_at: now,
    updated_at: now,
    status: 'published',
    class_ids: ['all', 'class_7a2'],
    version: 1,
    has_unpublished_edits: false,
  }));

  // Thêm bài kiểm tra Bản nháp
  const draftQuiz: QuizWithMeta = {
    id: 'quiz_draft_kt_nhanh',
    title: 'Kiểm tra nhanh dự thảo: Phép so sánh và từ láy',
    kind: 'quick',
    topicId: 'topic_tu_lay_so_sanh',
    timeLimitMinutes: 7,
    questionIds: ['q_lay_01', 'q_lay_02', 'q_lay_03', 'q_lay_04', 'q_lay_05'],
    xp: 15,
    created_at: now,
    updated_at: now,
    status: 'draft',
    class_ids: ['class_7a2'],
    version: 1,
    has_unpublished_edits: false,
  };

  return [...publishedQuizzes, draftQuiz];
}

export function getSeedQuestions(): Record<string, QuestionWithMeta> {
  const now = new Date().toISOString();
  const res: Record<string, QuestionWithMeta> = {};
  for (const [k, q] of Object.entries(QUESTIONS_BANK)) {
    res[k] = {
      ...q,
      created_at: now,
      updated_at: now,
      status: 'published',
      class_ids: ['all', 'class_7a2'],
      version: 1,
      has_unpublished_edits: false,
    };
  }
  return res;
}

export function getSeedRewards(): RewardItem[] {
  return [...REWARDS_CATALOG];
}

export function getSeedStudentStates(): Record<string, StudentState> {
  return {
    hs001: createInitialStateHs001(),
    hs002: createInitialStateHs002(),
  };
}

export function createFreshStudentState(account: StudentAccount, className = 'Lớp 7A2'): StudentState {
  return {
    profile: {
      id: account.id,
      name: account.name,
      username: account.username,
      role: 'student',
      grade: className,
      school: 'THCS Giấy & Mực',
      avatarSeed: account.username,
    },
    xpToday: 0,
    xpWeek: 0,
    totalXp: 0,
    activeSecondsToday: 0,
    activeSecondsContinuous: 0,
    lastActiveTimestamp: Date.now(),
    lastAttendanceDate: '',
    attendanceDaysThisWeek: 0,
    attendanceHistory: [],
    consecutiveWeeks: 0,
    exemptDaysUsedThisWeek: 0,
    completedSteps: [],
    questionResults: [],
    flaggedNeedReviewTopicIds: [],
    essaySubmissions: [],
    rewardRequests: [],
    unlockedBadgeIds: [],
    xpLogs: [],
    soundEnabled: true,
    animationsEnabled: true,
    fontSizePreference: 'normal',
    themePreference: 'creative_edtech',
    devTimeMultiplier: 1,
    devDateOffsetDays: 0,
  };
}

export const SEED_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit_01',
    actor_id: 'gv001',
    actor_name: 'Thầy Nguyễn Văn An',
    actor_role: 'teacher',
    action: 'CREATE_CLASS',
    target_type: 'class',
    target_id: 'class_7a2',
    target_name: 'Lớp 7A2 (Năm học 2026-2027)',
    details: { grade: 'Lớp 7', schoolYear: '2026-2027' },
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'audit_02',
    actor_id: 'gv001',
    actor_name: 'Thầy Nguyễn Văn An',
    actor_role: 'teacher',
    action: 'PUBLISH_CONTENT',
    target_type: 'content',
    target_id: 'topic_all',
    target_name: 'Xuất bản 4 chuyên đề Ngữ văn 7',
    details: { topicsCount: 4, videosCount: 7 },
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'audit_03',
    actor_id: 'gv001',
    actor_name: 'Thầy Nguyễn Văn An',
    actor_role: 'teacher',
    action: 'CREATE_STUDENT',
    target_type: 'student',
    target_id: 'hs001',
    target_name: 'Nguyễn Minh Anh (hs001)',
    details: { class_id: 'class_7a2' },
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

export const SEED_RUBRIC_TEMPLATES: RubricTemplate[] = [
  {
    id: 'rubric_cam_nghi_tho',
    title: 'Đoạn văn ghi lại cảm nghĩ về một bài thơ / đoạn thơ',
    category: 'cam_nghi',
    description: 'Chuẩn đánh giá năng lực cảm thụ thơ 4 chữ, 5 chữ theo GDPT 2018',
    isDefault: true,
    criteria: [
      { id: 'crit_1', name: 'Nội dung ý & Cảm thụ', description: 'Gọi tên đúng hình ảnh/từ ngữ đắt giá và phân tích được ý nghĩa biểu cảm', weight: 40 },
      { id: 'crit_2', name: 'Bố cục & Liên kết', description: 'Có mở đoạn, thân đoạn, kết đoạn mạch lạc; chuyển ý tự nhiên', weight: 20 },
      { id: 'crit_3', name: 'Dùng từ & Chính tả', description: 'Không sai lỗi chính tả, dùng từ gợi cảm, câu văn gãy gọn', weight: 20 },
      { id: 'crit_4', name: 'Sáng tạo & Cảm xúc', description: 'Có giọng điệu riêng, thể hiện sự rung động chân thành', weight: 20 },
    ],
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'rubric_phan_tich_nhan_vat',
    title: 'Đoạn văn phân tích đặc điểm nhân vật văn học',
    category: 'phan_tich_nhan_vat',
    description: 'Đánh giá kỹ năng đọc hiểu nhân vật qua ngoại hình, hành động, tâm lý',
    criteria: [
      { id: 'crit_nv1', name: 'Nhận diện lai lịch & Ngoại hình', description: 'Nêu đúng hoàn cảnh sống và nét đặc trưng diện mạo nhân vật', weight: 30 },
      { id: 'crit_nv2', name: 'Diễn biến tâm trạng & Hành động', description: 'Phân tích chiều sâu tâm lí qua lời nói, cử chỉ và độc thoại nội tâm', weight: 30 },
      { id: 'crit_nv3', name: 'Nghệ thuật xây dựng nhân vật', description: 'Chỉ ra bút pháp miêu tả, nghệ thuật tương phản hoặc chi tiết đắt giá', weight: 20 },
      { id: 'crit_nv4', name: 'Đánh giá tư tưởng & Liên hệ', description: 'Khái quát phẩm chất nhân vật và rút ra bài học cho bản thân', weight: 20 },
    ],
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'rubric_tu_tu_so_sanh',
    title: 'Đoạn văn phân tích tác dụng của biện pháp tu từ',
    category: 'tu_tu_so_sanh',
    description: 'Đánh giá khả năng cảm thụ biện pháp so sánh, điệp từ, nhân hóa',
    criteria: [
      { id: 'crit_tt1', name: 'Chỉ ra dấu hiệu tu từ', description: 'Xác định chính xác từ ngữ, vế so sánh hoặc mô hình điệp', weight: 30 },
      { id: 'crit_tt2', name: 'Phân tích tác dụng biểu đạt', description: 'Làm rõ hình ảnh trở nên sinh động, gợi cảm như thế nào', weight: 40 },
      { id: 'crit_tt3', name: 'Hình thức & Diễn đạt', description: 'Đảm bảo cấu trúc đoạn văn, dùng từ trong sáng', weight: 15 },
      { id: 'crit_tt4', name: 'Tình cảm của người viết', description: 'Bộc lộ thái độ trân trọng cái đẹp của ngôn ngữ', weight: 15 },
    ],
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];

export const SEED_GRADED_SAMPLES: GradedSampleEssay[] = [
  {
    id: 'sample_01_tot',
    title: 'Bài mẫu Tốt (9.5 điểm) - Cảm nghĩ về Tiếng gà trưa',
    topicPrompt: 'Viết đoạn văn ngắn ghi lại cảm nghĩ về âm thanh tiếng gà trưa trong bài thơ của Xuân Quỳnh.',
    studentContent: 'Âm thanh "tiếng gà trưa" trong bài thơ của Xuân Quỳnh là một nốt nhạc trong trẻo đã khơi dậy cả một miền ký ức tuổi thơ tươi đẹp trong tâm hồn người lính trẻ. Giữa cái nắng ban trưa gay gắt trên đường hành quân xa, tiếng gà "cục... cục tác cục ta" cất lên bất chợt làm dịu đi bao nỗi nhọc nhằn, mỏi mệt. Đằng sau tiếng gà quen thuộc ấy là cả một trời thương nhớ: có ổ rơm hồng êm ái, có đàn gà nhỏ xinh và trên hết là hình bóng người bà tần tảo, chắt chiu từng quả trứng hồng cho cháu chiếc áo mới ngày Tết. Điệp từ "tiếng gà trưa" được nhắc lại nhiều lần như một điệp khúc của tình yêu thương, kết nối bền chặt tình cảm bà cháu thiêng liêng với tình yêu Tổ quốc rộng lớn. Đoạn thơ đã để lại trong em bài học sâu sắc về lòng biết ơn đối với những người thân yêu.',
    levelGrade: 'excellent',
    totalScore: 9.5,
    rubricScores: [
      { criterionName: 'Nội dung ý & Cảm thụ', score: 3.8, maxScore: 4.0, comment: 'Cảm thụ rất sâu sắc, làm nổi bật được hai bình diện ký ức và hiện tại.' },
      { criterionName: 'Bố cục & Liên kết', score: 2.0, maxScore: 2.0, comment: 'Chuyển ý tự nhiên, kết cấu Tổng - Phân - Hợp hoàn hảo.' },
      { criterionName: 'Dùng từ & Chính tả', score: 1.9, maxScore: 2.0, comment: 'Ngôn từ giàu chất thơ, diễn đạt truyền cảm.' },
      { criterionName: 'Sáng tạo & Cảm xúc', score: 1.8, maxScore: 2.0, comment: 'Giọng điệu thiết tha, có liên hệ bài học chân thành.' },
    ],
    teacherFeedback: 'Bài viết rất xuất sắc! Em nắm chắc tinh thần thơ Xuân Quỳnh và diễn đạt đầy cảm xúc.',
    isFromStudentSubmission: false,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'sample_02_kha',
    title: 'Bài mẫu Khá (7.5 điểm) - Cảm nghĩ về Tiếng gà trưa',
    topicPrompt: 'Viết đoạn văn ngắn ghi lại cảm nghĩ về âm thanh tiếng gà trưa trong bài thơ của Xuân Quỳnh.',
    studentContent: 'Đọc bài thơ Tiếng gà trưa của tác giả Xuân Quỳnh, em vô cùng xúc động trước âm thanh tiếng gà trưa quen thuộc ở làng quê. Khi người lính dừng chân bên xóm nhỏ, nghe tiếng gà nhảy ổ cất lên, anh nhớ ngay về người bà thân thương của mình. Bà đã chăm sóc đàn gà vất vả để mua quần áo mới cho cháu. Tiếng gà trưa đã nhắc nhở người lính về quê hương và tiếp thêm sức mạnh cho anh trên đường ra trận bảo vệ đất nước. Đoạn thơ rất hay và có ý nghĩa giáo dục sâu sắc đối với học sinh chúng em.',
    levelGrade: 'good',
    totalScore: 7.5,
    rubricScores: [
      { criterionName: 'Nội dung ý & Cảm thụ', score: 3.0, maxScore: 4.0, comment: 'Nắm được ý chính nhưng còn thiên về tóm tắt sự việc.' },
      { criterionName: 'Bố cục & Liên kết', score: 1.6, maxScore: 2.0, comment: 'Có mở đoạn và kết đoạn rõ ràng.' },
      { criterionName: 'Dùng từ & Chính tả', score: 1.5, maxScore: 2.0, comment: 'Câu cú đúng ngữ pháp nhưng chưa nhiều từ ngữ gợi cảm.' },
      { criterionName: 'Sáng tạo & Cảm xúc', score: 1.4, maxScore: 2.0, comment: 'Cảm xúc thật thà, cần trau chuốt thêm.' },
    ],
    teacherFeedback: 'Bài viết đạt mức Khá. Em cần đi sâu phân tích từ ngữ nghệ thuật thay vì chỉ kể lại nội dung.',
    isFromStudentSubmission: false,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'sample_03_trungbinh',
    title: 'Bài mẫu Trung bình (5.5 điểm) - Cảm nghĩ đoạn thơ',
    topicPrompt: 'Viết đoạn văn ngắn ghi lại cảm nghĩ về âm thanh tiếng gà trưa trong bài thơ của Xuân Quỳnh.',
    studentContent: 'Bài thơ Tiếng gà trưa nói về một chú lính đi hành quân mệt quá ngồi nghỉ. Xong chú nghe thấy tiếng gà cục tác cục ta. Chú nhớ tới bà nuôi gà đẻ trứng bán lấy tiền mua áo mới. Tiếng gà làm cho chú lính không mệt nữa và tiếp tục đi chiến đấu. Em rất thích bài thơ này vì nó hay và cảm động.',
    levelGrade: 'average',
    totalScore: 5.5,
    rubricScores: [
      { criterionName: 'Nội dung ý & Cảm thụ', score: 2.2, maxScore: 4.0, comment: 'Kể lại chuyện như văn xuôi, chưa có cảm thụ nghệ thuật thơ.' },
      { criterionName: 'Bố cục & Liên kết', score: 1.2, maxScore: 2.0, comment: 'Dùng nhiều từ nối khẩu ngữ "Xong chú...".' },
      { criterionName: 'Dùng từ & Chính tả', score: 1.1, maxScore: 2.0, comment: 'Từ ngữ nôm na, thiếu sự trang trọng cần thiết.' },
      { criterionName: 'Sáng tạo & Cảm xúc', score: 1.0, maxScore: 2.0, comment: 'Cảm nghĩ còn sơ sài ở câu kết.' },
    ],
    teacherFeedback: 'Bài làm ở mức Trung bình. Em cần đọc kỹ văn bản, tránh dùng ngôn ngữ nói đời thường trong đoạn văn văn học.',
    isFromStudentSubmission: false,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'sample_04_kem',
    title: 'Bài mẫu Kém (3.5 điểm) - Đoạn văn chưa đạt yêu cầu',
    topicPrompt: 'Viết đoạn văn ngắn ghi lại cảm nghĩ về âm thanh tiếng gà trưa trong bài thơ của Xuân Quỳnh.',
    studentContent: 'Tiếng gà trưa của Xuân Quỳnh rất hay. Nuôi gà rất có lợi vì có trứng ăn và bán lấy tiền. Em ở quê nhà em cũng có nuôi gà trống và gà mái. Em thích ăn trứng gà.',
    levelGrade: 'poor',
    totalScore: 3.5,
    rubricScores: [
      { criterionName: 'Nội dung ý & Cảm thụ', score: 1.2, maxScore: 4.0, comment: 'Lạc đề, chuyển sang kể chuyện chăn nuôi đời thường.' },
      { criterionName: 'Bố cục & Liên kết', score: 0.8, maxScore: 2.0, comment: 'Đoạn văn quá ngắn, câu rời rạc.' },
      { criterionName: 'Dùng từ & Chính tả', score: 1.0, maxScore: 2.0, comment: 'Không có lỗi chính tả nhưng câu văn vụn vặt.' },
      { criterionName: 'Sáng tạo & Cảm xúc', score: 0.5, maxScore: 2.0, comment: 'Chưa bộc lộ rung cảm văn học.' },
    ],
    teacherFeedback: 'Bài làm chưa đạt yêu cầu. Em cần tập trung phân tích bài thơ thay vì nói về kinh nghiệm cá nhân.',
    isFromStudentSubmission: false,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

export const SEED_AI_GRADING_CONFIG: AIGradingConfig = {
  tone: 'encouraging',
  strictness: 3,
  mentionGoodPointsFirst: true,
  commentLength: 'medium',
  maxResponseHoursThreshold: 24,
};

