import {
  Badge,
  Question,
  Quiz,
  RewardItem,
  StudentProfile,
  StudentState,
  TheoryLesson,
  Topic,
  VideoLesson,
} from '../types.ts';

// Danh sách 4 chủ đề Ngữ văn 7
export const TOPICS: Topic[] = [
  {
    id: 'topic_tho_bon_nam',
    title: 'Thơ bốn chữ, năm chữ',
    shortDesc: 'Tìm hiểu đặc điểm số tiếng, cách gieo vần, ngắt nhịp và hình ảnh cảm xúc trong thơ.',
    tag: 'Thơ ca',
    videoIds: ['video_tho_1', 'video_tho_2'],
    theoryId: 'theory_tho_bon_nam',
    colorScheme: '#2F3E6B',
  },
  {
    id: 'topic_tu_lay_so_sanh',
    title: 'Từ láy và biện pháp tu từ so sánh',
    shortDesc: 'Nhận biết từ láy toàn bộ, từ láy bộ phận và phân tích sức gợi hình của phép so sánh.',
    tag: 'Tiếng Việt',
    videoIds: ['video_tulay_1', 'video_tulay_2'],
    theoryId: 'theory_tu_lay_so_sanh',
    colorScheme: '#7FA88A',
  },
  {
    id: 'topic_truyen_ngan',
    title: 'Truyện ngắn: Đọc hiểu nhân vật',
    shortDesc: 'Khám phá thế giới nội tâm, tính cách nhân vật qua ngoại hình, lời nói và hành động.',
    tag: 'Văn xuôi',
    videoIds: ['video_truyen_1', 'video_truyen_2'],
    theoryId: 'theory_truyen_ngan',
    colorScheme: '#E2704A',
  },
  {
    id: 'topic_doan_van',
    title: 'Viết đoạn văn cảm nghĩ',
    shortDesc: 'Rèn luyện kĩ năng viết đoạn văn ghi lại cảm xúc về một bài thơ hoặc trải nghiệm ý nghĩa.',
    tag: 'Tập làm văn',
    videoIds: ['video_van_1'],
    theoryId: 'theory_doan_van',
    colorScheme: '#F2B84B',
  },
];

// Ngân hàng câu hỏi phong phú phủ đủ 4 mức năng lực và 4 dạng câu
export const QUESTIONS_BANK: Record<string, Question> = {
  // --- CHỦ ĐỀ 1: THƠ BỐN CHỮ, NĂM CHỮ ---
  q_tho_01: {
    id: 'q_tho_01',
    type: 'single',
    level: 'NHAN_BIET',
    difficulty: 'DE',
    prompt: 'Thể thơ bốn chữ và thể thơ năm chữ có đặc điểm nổi bật nhất về hình thức là gì?',
    options: [
      'Mỗi dòng có lần lượt 4 hoặc 5 tiếng (chữ)',
      'Bắt buộc phải có đúng 4 dòng trong một khổ',
      'Chỉ được gieo vần bằng, không gieo vần trắc',
      'Được gieo vần tự do và không bao giờ ngắt nhịp',
    ],
    answer: 'Mỗi dòng có lần lượt 4 hoặc 5 tiếng (chữ)',
    explanation: 'Thể thơ bốn chữ có mỗi dòng gồm 4 tiếng, thể thơ năm chữ có mỗi dòng gồm 5 tiếng. Số câu trong bài thường không giới hạn.',
    topicId: 'topic_tho_bon_nam',
  },
  q_tho_02: {
    id: 'q_tho_02',
    type: 'single',
    level: 'NHAN_BIET',
    difficulty: 'DE',
    prompt: 'Nhịp ngắt phổ biến nhất trong thể thơ bốn chữ là nhịp nào?',
    options: ['Nhịp 2/2', 'Nhịp 1/3', 'Nhịp 3/1', 'Nhịp 1/1/2'],
    answer: 'Nhịp 2/2',
    explanation: 'Thể thơ bốn chữ thường có nhịp chẵn, phổ biến nhất là nhịp 2/2, tạo âm điệu nhịp nhàng, gần với đồng dao.',
    topicId: 'topic_tho_bon_nam',
  },
  q_tho_03: {
    id: 'q_tho_03',
    type: 'multi',
    level: 'THONG_HIEU',
    difficulty: 'TB',
    prompt: 'Trong bài thơ năm chữ, những kiểu ngắt nhịp nào sau đây là thường gặp? (Chọn 2 đáp án)',
    options: [
      'Nhịp 3/2 (ngắt sau tiếng thứ 3)',
      'Nhịp 2/3 (ngắt sau tiếng thứ 2)',
      'Nhịp 1/4 (ngắt sau tiếng thứ 1)',
      'Nhịp 4/1 (ngắt sau tiếng thứ 4)',
    ],
    answer: ['Nhịp 3/2 (ngắt sau tiếng thứ 3)', 'Nhịp 2/3 (ngắt sau tiếng thứ 2)'],
    explanation: 'Thơ năm chữ thường ngắt nhịp linh hoạt giữa 3/2 và 2/3 tùy thuộc vào cảm xúc và nội dung diễn đạt.',
    topicId: 'topic_tho_bon_nam',
  },
  q_tho_04: {
    id: 'q_tho_04',
    type: 'fill',
    level: 'THONG_HIEU',
    difficulty: 'TB',
    prompt: 'Điền từ thích hợp vào chỗ trống: Vần được gieo ở cuối dòng thơ gọi là vần [chân], còn vần gieo ở giữa dòng gọi là vần [lưng].',
    fillBlanksCount: 2,
    answer: ['chân', 'lưng'],
    explanation: 'Vần chân đặt ở vị trí cuối câu thơ; vần lưng đặt ở vị trí giữa câu thơ để tạo sự kết nối âm điệu.',
    topicId: 'topic_tho_bon_nam',
  },
  q_tho_05: {
    id: 'q_tho_05',
    type: 'single',
    level: 'PHAN_TICH',
    difficulty: 'TB',
    prompt: 'Đọc khổ thơ sau:\n"Mầm non mắt lim dim\nĐang nằm chờ đón nắng\nThấy gió về se lạnh\nKhẽ cựa mình rung rinh"\nBiện pháp nhân hóa "mắt lim dim", "nằm chờ", "cựa mình" có tác dụng gì?',
    options: [
      'Khiến mầm non trở nên sinh động, hồn nhiên như một đứa trẻ nhỏ',
      'Mô tả chính xác cấu tạo sinh học của hạt giống dưới mặt đất',
      'Nhấn mạnh nỗi buồn tẻ, cô đơn của vạn vật trong mùa đông',
      'Làm cho câu thơ mang âm hưởng trang nghiêm, kì bí',
    ],
    answer: 'Khiến mầm non trở nên sinh động, hồn nhiên như một đứa trẻ nhỏ',
    explanation: 'Nhân hóa mang lại sức sống cho thế giới thiên nhiên, khiến mầm non mang dáng vẻ ngộ nghĩnh, đáng yêu.',
    topicId: 'topic_tho_bon_nam',
  },
  q_tho_06: {
    id: 'q_tho_06',
    type: 'essay',
    level: 'VAN_DUNG',
    difficulty: 'KHO',
    prompt: 'Viết một đoạn văn ngắn (khoảng 5-8 câu) chia sẻ cảm xúc của em về một hình ảnh thơ bốn chữ hoặc năm chữ mà em yêu thích nhất.',
    rubric: [
      { name: 'Nội dung ý', maxScore: 4, description: 'Chỉ rõ được hình ảnh thơ và bộc lộ cảm xúc chân thành, sâu sắc' },
      { name: 'Bố cục liên kết', maxScore: 2, description: 'Đủ mở - thân - kết, mạch cảm xúc tự nhiên, liên kết câu chặt chẽ' },
      { name: 'Dùng từ đặt câu', maxScore: 2, description: 'Dùng từ gợi cảm, câu văn trong sáng, không sai ngữ pháp' },
      { name: 'Sáng tạo cảm xúc', maxScore: 2, description: 'Có liên hệ bản thân tinh tế, giọng văn ấm áp' },
    ],
    sampleEssay: 'Em rất yêu thích hình ảnh "Mầm non mắt lim dim" trong bài thơ mầm non. Nhà thơ đã khéo léo dùng phép nhân hóa để biến hạt mầm nhỏ bé thành một em bé ngoan đang say giấc ngủ. Đọc câu thơ, em như cảm nhận được hơi thở ấm áp của mùa xuân đang len lỏi vào từng tấc đất. Hình ảnh thơ gợi cho em niềm trân trọng sự sống quanh mình, dẫu bắt đầu từ những điều nhỏ nhoi nhất.',
    explanation: 'Bài viết cần thể hiện rõ hình ảnh thơ đã chọn, cảm xúc của người đọc và bài học rút ra.',
    topicId: 'topic_tho_bon_nam',
  },

  // --- CHỦ ĐỀ 2: TỪ LÁY & SO SÁNH ---
  q_lay_01: {
    id: 'q_lay_01',
    type: 'single',
    level: 'NHAN_BIET',
    difficulty: 'DE',
    prompt: 'Trong các từ sau, từ nào là từ láy toàn bộ?',
    options: ['Xanh xanh', 'Long lanh', 'Rì rào', 'Thấp thoáng'],
    answer: 'Xanh xanh',
    explanation: '"Xanh xanh" lặp lại toàn bộ cả âm đầu, vần và thanh điệu, nên là từ láy toàn bộ.',
    topicId: 'topic_tu_lay_so_sanh',
  },
  q_lay_02: {
    id: 'q_lay_02',
    type: 'multi',
    level: 'NHAN_BIET',
    difficulty: 'DE',
    prompt: 'Những từ nào dưới đây là từ láy bộ phận (láy phụ âm đầu)? (Chọn 2 đáp án)',
    options: ['Mấp mô', 'Róc rách', 'Liêu xiêu', 'Thoang thoảng'],
    answer: ['Mấp mô', 'Róc rách'],
    explanation: '"Mấp mô" láy âm m; "Róc rách" láy âm r. Còn "Liêu xiêu" là láy vần, "Thoang thoảng" biến đổi thanh điệu.',
    topicId: 'topic_tu_lay_so_sanh',
  },
  q_lay_03: {
    id: 'q_lay_03',
    type: 'single',
    level: 'THONG_HIEU',
    difficulty: 'TB',
    prompt: 'Câu nào dưới đây sử dụng phép so sánh ngang bằng?',
    options: [
      'Công cha như núi Thái Sơn, nghĩa mẹ như nước trong nguồn chảy ra',
      'Ngôi nhà của tôi cao hơn ngôi nhà đối diện',
      'Mặt trời mùa hè không gay gắt bằng mặt trời sa mạc',
      'Bông hoa hồng này đẹp nhất trong cả khu vườn',
    ],
    answer: 'Công cha như núi Thái Sơn, nghĩa mẹ như nước trong nguồn chảy ra',
    explanation: 'Từ so sánh "như" biểu thị mối quan hệ so sánh tương đương, ngang bằng.',
    topicId: 'topic_tu_lay_so_sanh',
  },
  q_lay_04: {
    id: 'q_lay_04',
    type: 'fill',
    level: 'THONG_HIEU',
    difficulty: 'TB',
    prompt: 'Cấu trúc thông thường của một phép so sánh gồm 4 yếu tố: Vế A (sự vật được so sánh) - Phương diện so sánh - [Từ] so sánh - Vế B (sự vật dùng để so sánh).',
    fillBlanksCount: 1,
    answer: ['Từ'],
    explanation: 'Bốn yếu tố chuẩn gồm: Vế A, Phương diện so sánh, Từ so sánh (như, là, tày, chẳng bằng...) và Vế B.',
    topicId: 'topic_tu_lay_so_sanh',
  },
  q_lay_05: {
    id: 'q_lay_05',
    type: 'single',
    level: 'PHAN_TICH',
    difficulty: 'TB',
    prompt: 'Tác dụng của từ láy "thoang thoảng" trong câu "Hương sen thoang thoảng bay trong gió sớm" là gì?',
    options: [
      'Gợi tả mùi hương nhẹ nhàng, tinh khiết, kín đáo lan tỏa trong không gian',
      'Nhấn mạnh mùi hương nồng nàn, gay gắt khiến ai cũng chú ý',
      'Gợi tả sự biến mất nhanh chóng của hương thơm hoa sen',
      'Làm câu văn có nhịp điệu dồn dập, hồi hộp',
    ],
    answer: 'Gợi tả mùi hương nhẹ nhàng, tinh khiết, kín đáo lan tỏa trong không gian',
    explanation: '"Thoang thoảng" là từ láy giảm nghĩa, gợi tả độ thoang nhẹ, dịu dàng, tạo cảm giác thanh thản, dễ chịu.',
    topicId: 'topic_tu_lay_so_sanh',
  },
  q_lay_06: {
    id: 'q_lay_06',
    type: 'single',
    level: 'PHAN_TICH',
    difficulty: 'KHO',
    prompt: 'Trong câu thơ: "Tiếng chim hót rộn rã như một dàn đồng ca mùa hạ", tác giả đã so sánh âm thanh với hình ảnh gì và nhằm mục đích gì?',
    options: [
      'So sánh âm thanh cụ thể với dàn đồng ca để làm nổi bật sự náo nức, hòa hợp và giàu sức sống',
      'So sánh âm thanh với màu sắc để gợi cảnh tượng huyền ảo',
      'So sánh chim muông với con người để chê bai sự ồn ào',
      'So sánh âm thanh với thời gian để thể hiện sự vội vã',
    ],
    answer: 'So sánh âm thanh cụ thể với dàn đồng ca để làm nổi bật sự náo nức, hòa hợp và giàu sức sống',
    explanation: 'Hình ảnh "dàn đồng ca" giúp người đọc hình dung được sự đồng thanh, đa sắc điệu và tươi vui của thiên nhiên.',
    topicId: 'topic_tu_lay_so_sanh',
  },
  q_lay_07: {
    id: 'q_lay_07',
    type: 'essay',
    level: 'VAN_DUNG',
    difficulty: 'KHO',
    prompt: 'Viết đoạn văn ngắn (5-7 câu) miêu tả một buổi sáng sớm ở quê hương em, trong đó có sử dụng ít nhất 01 từ láy và 01 phép so sánh.',
    rubric: [
      { name: 'Nội dung ý', maxScore: 4, description: 'Miêu tả cảnh buổi sáng rõ nét, có hồn, đúng yêu cầu đề bài' },
      { name: 'Dùng từ tu từ', maxScore: 3, description: 'Sử dụng chính xác, tự nhiên ít nhất 1 từ láy và 1 phép so sánh' },
      { name: 'Diễn đạt liên kết', maxScore: 3, description: 'Đoạn văn mạch lạc, không mắc lỗi câu từ' },
    ],
    sampleEssay: 'Sáng sớm hôm nay, bầu trời quê em trong vắt như một tấm gương khổng lồ. Những giọt sương đêm còn đọng lấp lánh trên từng ngọn cỏ ven đường làng. Xa xa, tiếng gà gáy râm ran báo hiệu một ngày mới bắt đầu. Gió sớm nhè nhẹ thổi qua rặng tre xanh, mang theo hương lúa non thoang thoảng ngọt ngào. Em hít một hơi thật sâu, cảm thấy lòng mình tràn ngập niềm vui và tình yêu với quê hương thân thương.',
    explanation: 'Yêu cầu có sử dụng từ láy (lấp lánh, râm ran, nhè nhẹ, thoang thoảng) và phép so sánh (bầu trời trong vắt như một tấm gương khổng lồ).',
    topicId: 'topic_tu_lay_so_sanh',
  },

  // --- CHỦ ĐỀ 3: TRUYỆN NGẮN: ĐỌC HIỂU NHÂN VẬT ---
  q_truyen_01: {
    id: 'q_truyen_01',
    type: 'single',
    level: 'NHAN_BIET',
    difficulty: 'DE',
    prompt: 'Để tìm hiểu một nhân vật trong truyện ngắn, người đọc thường căn cứ vào những phương diện nào?',
    options: [
      'Ngoại hình, cử chỉ, hành động, ngôn ngữ, nội tâm và mối quan hệ với các nhân vật khác',
      'Chỉ căn cứ vào độ tuổi và nghề nghiệp của nhân vật được tác giả ghi rõ',
      'Chỉ căn cứ vào lời giới thiệu trực tiếp ở đầu câu chuyện',
      'Chỉ dựa vào cảm xúc riêng của người đọc mà không cần bằng chứng trong văn bản',
    ],
    answer: 'Ngoại hình, cử chỉ, hành động, ngôn ngữ, nội tâm và mối quan hệ với các nhân vật khác',
    explanation: 'Nhân vật được khắc họa toàn diện qua ngoại hình, lời nói, hành động, ý nghĩ và cách ứng xử với xung quanh.',
    topicId: 'topic_truyen_ngan',
  },
  q_truyen_02: {
    id: 'q_truyen_02',
    type: 'single',
    level: 'THONG_HIEU',
    difficulty: 'DE',
    prompt: 'Trong truyện "Bầy chim chìa vôi" (Nguyễn Quang Thiều), hai anh em Mên và Mon trằn trọc không ngủ được vì điều gì?',
    options: [
      'Lo lắng cho bầy chim chìa vôi non ở bãi cát giữa sông bị nước mưa ngập chìm',
      'Sợ tiếng sấm chớp lớn ngoài trời làm hỏng mái nhà',
      'Háo hức vì ngày mai được bố mẹ cho đi chơi xa',
      'Tiếc nuối vì không bắt được con cá bống dưới mép sông',
    ],
    answer: 'Lo lắng cho bầy chim chìa vôi non ở bãi cát giữa sông bị nước mưa ngập chìm',
    explanation: 'Tấm lòng nhân hậu, yêu thương động vật của hai đứa trẻ được thể hiện qua nỗi âu lo xuyên đêm cho bầy chim non.',
    topicId: 'topic_truyen_ngan',
  },
  q_truyen_03: {
    id: 'q_truyen_03',
    type: 'multi',
    level: 'THONG_HIEU',
    difficulty: 'TB',
    prompt: 'Những hành động nào sau đây thể hiện tình cảm nhân hậu, trong sáng của hai đứa trẻ đối với bầy chim? (Chọn 2 đáp án)',
    options: [
      'Cùng nhau thức dậy giữa đêm mưa to để bàn cách cứu chim chìa vôi',
      'Dũng cảm chèo đò ra bãi cát ngập nước lúc rạng sáng',
      'Bắt những con chim non đem về nhà nuôi trong lồng kính',
      'Đứng trên bờ nhìn chim bay đi rồi hối hận vì không bắt lại',
    ],
    answer: [
      'Cùng nhau thức dậy giữa đêm mưa to để bàn cách cứu chim chìa vôi',
      'Dũng cảm chèo đò ra bãi cát ngập nước lúc rạng sáng',
    ],
    explanation: 'Hai đứa trẻ thể hiện tình yêu thương tự nhiên, không vụ lợi: chỉ muốn cứu giúp và xúc động ngắm bầy chim tự cất cánh.',
    topicId: 'topic_truyen_ngan',
  },
  q_truyen_04: {
    id: 'q_truyen_04',
    type: 'single',
    level: 'PHAN_TICH',
    difficulty: 'TB',
    prompt: 'Chi tiết hai anh em Mên và Mon "khóc trong im lặng" khi chứng kiến bầy chim chìa vôi non vỗ cánh bay lên thể hiện điều gì?',
    options: [
      'Những giọt nước mắt của niềm vui sướng nghẹn ngào, sự nhẹ nhõm và rung động trước vẻ đẹp kì diệu của sự sống',
      'Nỗi đau buồn vì bầy chim đã bay mất và không thể tìm lại được',
      'Sự hoảng sợ vì dòng nước sông đang dâng lên quá nhanh',
      'Nỗi thất vọng vì chuyến đi đêm không đạt được kết quả như ý',
    ],
    answer: 'Những giọt nước mắt của niềm vui sướng nghẹn ngào, sự nhẹ nhõm và rung động trước vẻ đẹp kì diệu của sự sống',
    explanation: 'Nước mắt ấy là minh chứng cho sự thăng hoa của tâm hồn trẻ thơ khi thấy sinh linh bé bỏng vượt qua thử thách thiên nhiên.',
    topicId: 'topic_truyen_ngan',
  },
  q_truyen_05: {
    id: 'q_truyen_05',
    type: 'fill',
    level: 'VAN_DUNG',
    difficulty: 'TB',
    prompt: 'Qua câu chuyện "Bầy chim chìa vôi", tác giả gửi gắm thông điệp: Con người cần sống [gần gũi] và biết [yêu thương] bảo vệ thiên nhiên.',
    fillBlanksCount: 2,
    answer: ['gần gũi', 'yêu thương'],
    explanation: 'Tình yêu thương trân trọng thiên nhiên và muôn loài là thông điệp nhân văn cốt lõi của tác phẩm.',
    topicId: 'topic_truyen_ngan',
  },

  // --- CHỦ ĐỀ 4: VIẾT ĐOẠN VĂN CẢM NGHĨ ---
  q_van_01: {
    id: 'q_van_01',
    type: 'single',
    level: 'NHAN_BIET',
    difficulty: 'DE',
    prompt: 'Một đoạn văn ghi lại cảm nghĩ về một bài thơ thông thường gồm mấy phần chính?',
    options: [
      '3 phần: Mở đoạn, Thân đoạn, Kết đoạn',
      '2 phần: Nêu dẫn chứng và Bày tỏ cảm xúc',
      '4 phần: Đặt vấn đề, Giải quyết vấn đề, Mở rộng vấn đề, Kết thúc',
      '1 phần duy nhất không cần phân biệt cấu trúc',
    ],
    answer: '3 phần: Mở đoạn, Thân đoạn, Kết đoạn',
    explanation: 'Cấu trúc đoạn văn chuẩn mực luôn gồm: Mở đoạn (giới thiệu bài thơ/cảm xúc chung), Thân đoạn (trình bày cảm xúc cụ thể), Kết đoạn (khái quát lại ấn tượng).',
    topicId: 'topic_doan_van',
  },
  q_van_02: {
    id: 'q_van_02',
    type: 'single',
    level: 'THONG_HIEU',
    difficulty: 'DE',
    prompt: 'Nhiệm vụ trọng tâm của phần Thân đoạn trong đoạn văn cảm nghĩ là gì?',
    options: [
      'Trình bày chi tiết những cảm xúc, suy nghĩ sâu sắc về nội dung và nghệ thuật của bài thơ',
      'Chỉ chép lại nguyên văn bài thơ từ đầu đến cuối',
      'Giới thiệu năm sinh, năm mất và quê quán của tác giả',
      'Đưa ra những lời khuyên cho tác giả cách sửa đổi bài thơ',
    ],
    answer: 'Trình bày chi tiết những cảm xúc, suy nghĩ sâu sắc về nội dung và nghệ thuật của bài thơ',
    explanation: 'Thân đoạn là nơi người viết soi chiếu các hình ảnh, biện pháp tu từ độc đáo và bộc lộ cảm xúc tương ứng.',
    topicId: 'topic_doan_van',
  },
  q_van_03: {
    id: 'q_van_03',
    type: 'multi',
    level: 'PHAN_TICH',
    difficulty: 'TB',
    prompt: 'Những yếu tố nào sau đây giúp đoạn văn cảm nghĩ thêm sinh động và thuyết phục? (Chọn 2 đáp án)',
    options: [
      'Dẫn chứng từ ngữ, hình ảnh thơ tiêu biểu kèm lời bình cảm xúc',
      'Sử dụng các từ ngữ bộc lộ trực tiếp cảm xúc (yêu mến, xúc động, ấn tượng...)',
      'Dùng thật nhiều thuật ngữ phức tạp ít người hiểu',
      'Kể lan man sang những câu chuyện cá nhân không liên quan',
    ],
    answer: [
      'Dẫn chứng từ ngữ, hình ảnh thơ tiêu biểu kèm lời bình cảm xúc',
      'Sử dụng các từ ngữ bộc lộ trực tiếp cảm xúc (yêu mến, xúc động, ấn tượng...)',
    ],
    explanation: 'Đoạn văn biểu cảm cần sự kết hợp hài hòa giữa dẫn chứng thơ cụ thể và giọng điệu cảm xúc chân thành.',
    topicId: 'topic_doan_van',
  },
  q_van_04: {
    id: 'q_van_04',
    type: 'essay',
    level: 'VAN_DUNG',
    difficulty: 'KHO',
    prompt: 'Em hãy viết một đoạn văn (khoảng 8-10 câu) ghi lại cảm xúc của em về bài thơ "Tiếng gà trưa" của Xuân Quỳnh.',
    rubric: [
      { name: 'Nội dung ý', maxScore: 4, description: 'Nêu được ấn tượng sâu đậm về tiếng gà trưa và tình bà cháu ấm áp' },
      { name: 'Bố cục liên kết', maxScore: 2, description: 'Đủ 3 phần Mở - Thân - Kết, chuyển ý mượt mà' },
      { name: 'Dùng từ biểu cảm', maxScore: 2, description: 'Sử dụng từ ngữ bộc lộ cảm xúc tinh tế, trân trọng' },
      { name: 'Sáng tạo cảm xúc', maxScore: 2, description: 'Liên hệ chân thành với tình cảm gia đình của chính em' },
    ],
    sampleEssay: 'Bài thơ "Tiếng gà trưa" của nhà thơ Xuân Quỳnh đã để lại trong em những rung động sâu xa về tình bà cháu thiêng liêng. Âm thanh "tiếng gà trưa" vang lên trên đường hành quân như một nốt nhạc diệu kì đánh thức bao kỉ niệm tuổi thơ bên bà. Hình ảnh người bà chắt chiu từng quả trứng hồng, lo đàn gà toi khi gió mùa đông bắc tràn về khiến em vô cùng xúc động. Tình yêu thương bình dị, bao la của bà chính là điểm tựa tinh thần vững chắc cho người cháu cầm súng bảo vệ quê hương. Đọc bài thơ, em thêm thấu hiểu và trân quý tình cảm gia đình, nguyện cố gắng học tập thật tốt để đền đáp công ơn cha mẹ, ông bà.',
    explanation: 'Bài viết cần thể hiện tình cảm bà cháu, vẻ đẹp của kỉ niệm tuổi thơ và lòng biết ơn nguồn cội.',
    topicId: 'topic_doan_van',
  },
};

// Danh sách các bài Quizzes
export const QUIZZES: Record<string, Quiz> = {
  // Video 1 Tho: Practice & Tests
  quiz_tho1_practice: {
    id: 'quiz_tho1_practice',
    title: 'Luyện tập: Thể thơ bốn chữ & năm chữ',
    kind: 'practice',
    topicId: 'topic_tho_bon_nam',
    questionIds: ['q_tho_01', 'q_tho_02', 'q_tho_03'],
    xp: 5,
  },
  quiz_tho1_quick: {
    id: 'quiz_tho1_quick',
    title: 'Kiểm tra nhanh: Thơ bốn chữ, năm chữ',
    kind: 'quick',
    topicId: 'topic_tho_bon_nam',
    timeLimitMinutes: 7,
    questionIds: ['q_tho_01', 'q_tho_02', 'q_tho_03', 'q_tho_04', 'q_tho_05'],
    xp: 8,
  },
  quiz_tho1_mastery: {
    id: 'quiz_tho1_mastery',
    title: 'Mastery Check: Cảm thụ thơ bốn chữ, năm chữ',
    kind: 'mastery',
    topicId: 'topic_tho_bon_nam',
    timeLimitMinutes: 15,
    questionIds: ['q_tho_01', 'q_tho_02', 'q_tho_03', 'q_tho_04', 'q_tho_05', 'q_tho_06'],
    xp: 8,
  },

  // Video 1 Tu lay: Practice & Tests
  quiz_tulay1_practice: {
    id: 'quiz_tulay1_practice',
    title: 'Luyện tập: Phân biệt từ láy',
    kind: 'practice',
    topicId: 'topic_tu_lay_so_sanh',
    questionIds: ['q_lay_01', 'q_lay_02', 'q_lay_03'],
    xp: 5,
  },
  quiz_tulay1_quick: {
    id: 'quiz_tulay1_quick',
    title: 'Kiểm tra nhanh: Từ láy & Biện pháp so sánh',
    kind: 'quick',
    topicId: 'topic_tu_lay_so_sanh',
    timeLimitMinutes: 7,
    questionIds: ['q_lay_01', 'q_lay_02', 'q_lay_03', 'q_lay_04', 'q_lay_05'],
    xp: 8,
  },
  quiz_tulay1_mastery: {
    id: 'quiz_tulay1_mastery',
    title: 'Mastery Check: Năng lực tu từ học',
    kind: 'mastery',
    topicId: 'topic_tu_lay_so_sanh',
    timeLimitMinutes: 15,
    questionIds: ['q_lay_01', 'q_lay_02', 'q_lay_03', 'q_lay_04', 'q_lay_05', 'q_lay_06', 'q_lay_07'],
    xp: 8,
  },

  // Video 1 Truyen: Practice & Tests
  quiz_truyen1_practice: {
    id: 'quiz_truyen1_practice',
    title: 'Luyện tập: Đọc hiểu nhân vật truyện ngắn',
    kind: 'practice',
    topicId: 'topic_truyen_ngan',
    questionIds: ['q_truyen_01', 'q_truyen_02', 'q_truyen_03'],
    xp: 5,
  },
  quiz_truyen1_quick: {
    id: 'quiz_truyen1_quick',
    title: 'Kiểm tra nhanh: Thế giới nội tâm nhân vật',
    kind: 'quick',
    topicId: 'topic_truyen_ngan',
    timeLimitMinutes: 7,
    questionIds: ['q_truyen_01', 'q_truyen_02', 'q_truyen_03', 'q_truyen_04', 'q_truyen_05'],
    xp: 8,
  },
  quiz_truyen1_mastery: {
    id: 'quiz_truyen1_mastery',
    title: 'Mastery Check: Phân tích nhân vật Mên & Mon',
    kind: 'mastery',
    topicId: 'topic_truyen_ngan',
    timeLimitMinutes: 15,
    questionIds: ['q_truyen_01', 'q_truyen_02', 'q_truyen_03', 'q_truyen_04', 'q_truyen_05'],
    xp: 8,
  },

  // Video Doan van: Practice & Tests
  quiz_van1_practice: {
    id: 'quiz_van1_practice',
    title: 'Luyện tập: Cấu trúc đoạn văn cảm nghĩ',
    kind: 'practice',
    topicId: 'topic_doan_van',
    questionIds: ['q_van_01', 'q_van_02'],
    xp: 5,
  },
  quiz_van1_quick: {
    id: 'quiz_van1_quick',
    title: 'Kiểm tra nhanh: Viết đoạn văn biểu cảm',
    kind: 'quick',
    topicId: 'topic_doan_van',
    timeLimitMinutes: 7,
    questionIds: ['q_van_01', 'q_van_02', 'q_van_03'],
    xp: 8,
  },
  quiz_van1_mastery: {
    id: 'quiz_van1_mastery',
    title: 'Mastery Check: Thực hành viết đoạn văn',
    kind: 'mastery',
    topicId: 'topic_doan_van',
    timeLimitMinutes: 15,
    questionIds: ['q_van_01', 'q_van_02', 'q_van_03', 'q_van_04'],
    xp: 8,
  },

  // Bài tập về nhà do giáo viên giao riêng (+20 XP)
  quiz_homework_special: {
    id: 'quiz_homework_special',
    title: 'BTVN Tuần 4: Ôn tập tổng hợp Thơ và Tu từ',
    kind: 'homework',
    topicId: 'topic_tu_lay_so_sanh',
    timeLimitMinutes: 20,
    questionIds: ['q_tho_05', 'q_lay_05', 'q_lay_06', 'q_truyen_04'],
    xp: 20,
  },
};

// Danh sách các bài giảng Video
export const VIDEOS: Record<string, VideoLesson> = {
  video_tho_1: {
    id: 'video_tho_1',
    topicId: 'topic_tho_bon_nam',
    title: 'Bài 1: Đặc điểm hình thức thể thơ bốn chữ, năm chữ',
    durationSec: 650, // ~10 phút 50 giây (< 20 phút)
    sampleUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    subtopics: ['Số tiếng mỗi dòng', 'Cách gieo vần chân, vần lưng', 'Nhịp thơ 2/2 và 3/2'],
    summaryPoints: [
      {
        title: 'Quy tắc số tiếng',
        content: 'Thơ bốn chữ mỗi dòng có 4 tiếng, thơ năm chữ mỗi dòng có 5 tiếng. Số câu không bị ràng buộc khắt khe như thơ Đường luật.',
        example: '"Hạt gạo làng ta / Có vị phù sa..." (4 chữ)',
      },
      {
        title: 'Cách ngắt nhịp tự nhiên',
        content: 'Thơ bốn chữ thường ngắt nhịp 2/2 (hoặc 1/3). Thơ năm chữ ngắt nhịp 3/2 hoặc 2/3 linh hoạt để tạo cảm xúc.',
        example: '"Mầm non / mắt lim dim (2/3) - Đang nằm / chờ đón nắng (2/3)"',
      },
      {
        title: 'Nghệ thuật gieo vần',
        content: 'Vần chân đặt ở cuối dòng; vần lưng đặt ở giữa dòng. Vần liền gieo ở các dòng liên tiếp, vần cách gieo cách quãng.',
      },
    ],
    practiceQuizId: 'quiz_tho1_practice',
    quickTestId: 'quiz_tho1_quick',
    masteryCheckId: 'quiz_tho1_mastery',
  },
  video_tho_2: {
    id: 'video_tho_2',
    topicId: 'topic_tho_bon_nam',
    title: 'Bài 2: Hình ảnh thiên nhiên và tình cảm gia đình trong thơ',
    durationSec: 720, // 12 phút
    sampleUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    subtopics: ['Hình ảnh thơ gợi cảm', 'Tình bà cháu trong "Tiếng gà trưa"'],
    summaryPoints: [
      {
        title: 'Hình tượng tiếng gà trưa',
        content: 'Tiếng gà trưa không chỉ là âm thanh của làng quê mà còn là chiếc chìa khóa gợi mở kí ức tuổi thơ ấm áp bên bà.',
      },
      {
        title: 'Tình cảm gia đình thiêng liêng',
        content: 'Tình yêu quê hương, đất nước bắt nguồn từ tình yêu những người thân thương nhất như bà, mẹ, mái nhà quen thuộc.',
      },
    ],
    practiceQuizId: 'quiz_tho1_practice',
    quickTestId: 'quiz_tho1_quick',
    masteryCheckId: 'quiz_tho1_mastery',
  },
  video_tulay_1: {
    id: 'video_tulay_1',
    topicId: 'topic_tu_lay_so_sanh',
    title: 'Bài 1: Phân biệt từ láy toàn bộ và từ láy bộ phận',
    durationSec: 580, // ~9 phút 40 giây
    sampleUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    subtopics: ['Khái niệm từ láy', 'Láy âm đầu, láy vần, láy toàn bộ', 'Tác dụng gợi hình, gợi cảm'],
    summaryPoints: [
      {
        title: 'Từ láy toàn bộ',
        content: 'Các tiếng lặp lại hoàn toàn (xanh xanh, ào ào) hoặc có biến đổi thanh điệu hay phụ âm cuối (thoang thoảng, đèm đẹp).',
      },
      {
        title: 'Từ láy bộ phận',
        content: 'Chỉ lặp lại âm đầu (nhấp nhô, long lanh) hoặc lặp lại phần vần (liêu xiêu, chênh vênh).',
      },
      {
        title: 'Giá trị biểu cảm',
        content: 'Từ láy giúp bức tranh thiên nhiên và tâm trạng con người hiện lên sống động, có đường nét, màu sắc và âm thanh.',
      },
    ],
    practiceQuizId: 'quiz_tulay1_practice',
    quickTestId: 'quiz_tulay1_quick',
    masteryCheckId: 'quiz_tulay1_mastery',
  },
  video_tulay_2: {
    id: 'video_tulay_2',
    topicId: 'topic_tu_lay_so_sanh',
    title: 'Bài 2: Biện pháp tu từ so sánh và sức mạnh gợi hình',
    durationSec: 640,
    sampleUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    subtopics: ['Mô hình so sánh A - B', 'So sánh ngang bằng và hơn kém', 'Phân tích tác dụng văn chương'],
    summaryPoints: [
      {
        title: 'Mô hình phép so sánh',
        content: 'Vế A (được so sánh) + Phương diện so sánh + Từ so sánh + Vế B (chuẩn so sánh).',
        example: '"Mặt trời (A) đỏ rực (phương diện) như (từ) quả cầu lửa (B)"',
      },
      {
        title: 'Hai kiểu so sánh',
        content: 'So sánh ngang bằng (dùng từ: như, là, tựa...) và so sánh hơn kém (dùng từ: hơn, chẳng bằng, kém...).',
      },
    ],
    practiceQuizId: 'quiz_tulay1_practice',
    quickTestId: 'quiz_tulay1_quick',
    masteryCheckId: 'quiz_tulay1_mastery',
  },
  video_truyen_1: {
    id: 'video_truyen_1',
    topicId: 'topic_truyen_ngan',
    title: 'Bài 1: Khám phá nhân vật qua hành động và tâm lí',
    durationSec: 840, // 14 phút
    sampleUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    subtopics: ['Đặc trưng truyện ngắn', 'Phân tích nhân vật Mên và Mon'],
    summaryPoints: [
      {
        title: 'Bức chân dung nhân vật',
        content: 'Được dựng nên từ lời nói ngây thơ, hành động quyết đoán và những âu lo xuyên đêm dành cho bầy chim non.',
      },
      {
        title: 'Tâm hồn trẻ thơ',
        content: 'Ngây thơ, trong trẻo, giàu lòng trắc ẩn và tình yêu thiên nhiên cuộc sống.',
      },
    ],
    practiceQuizId: 'quiz_truyen1_practice',
    quickTestId: 'quiz_truyen1_quick',
    masteryCheckId: 'quiz_truyen1_mastery',
  },
  video_truyen_2: {
    id: 'video_truyen_2',
    topicId: 'topic_truyen_ngan',
    title: 'Bài 2: Nghệ thuật miêu tả thiên nhiên và kết thúc truyện',
    durationSec: 600,
    sampleUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    subtopics: ['Khung cảnh bãi cát sông', 'Ý nghĩa hình ảnh chim bay lên'],
    summaryPoints: [
      {
        title: 'Khung cảnh thiên nhiên thử thách',
        content: 'Dòng sông dâng nước cao, bãi cát sắp ngập chìm đối lập với đôi cánh bé bỏng của bầy chìa vôi.',
      },
      {
        title: 'Giọt nước mắt xúc động',
        content: 'Mên và Mon khóc vì hạnh phúc nghẹn ngào khi thấy sự sống kiên cường chiến thắng thử thách.',
      },
    ],
    practiceQuizId: 'quiz_truyen1_practice',
    quickTestId: 'quiz_truyen1_quick',
    masteryCheckId: 'quiz_truyen1_mastery',
  },
  video_van_1: {
    id: 'video_van_1',
    topicId: 'topic_doan_van',
    title: 'Bài 1: Kĩ năng viết đoạn văn cảm nghĩ về bài thơ',
    durationSec: 750,
    sampleUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    subtopics: ['Cấu trúc 3 phần', 'Cách trích dẫn thơ', 'Bộc lộ cảm xúc chân thành'],
    summaryPoints: [
      {
        title: 'Mở đoạn',
        content: 'Giới thiệu tên bài thơ, tác giả và nêu khái quát ấn tượng hoặc cảm xúc nổi bật nhất.',
      },
      {
        title: 'Thân đoạn',
        content: 'Chọn 1-2 hình ảnh/từ ngữ thơ đặc sắc nhất để phân tích và bày tỏ cảm nghĩ chi tiết.',
      },
      {
        title: 'Kết đoạn',
        content: 'Khái quát lại giá trị của bài thơ và bài học hoặc liên hệ tình cảm với bản thân.',
      },
    ],
    practiceQuizId: 'quiz_van1_practice',
    quickTestId: 'quiz_van1_quick',
    masteryCheckId: 'quiz_van1_mastery',
  },
};

// Danh sách các bài Lý thuyết chung chi tiết
export const THEORIES: Record<string, TheoryLesson> = {
  theory_tho_bon_nam: {
    id: 'theory_tho_bon_nam',
    topicId: 'topic_tho_bon_nam',
    title: 'Lý thuyết toàn diện: Thơ bốn chữ và năm chữ',
    minReadSeconds: 25,
    sections: [
      {
        id: 'sec_1',
        title: '1. Khái niệm và nguồn gốc thể thơ',
        body: [
          'Thơ bốn chữ là thể thơ mỗi dòng có 4 tiếng, bắt nguồn sâu xa từ ca dao, đồng dao và vè dân gian của người Việt.',
          'Thơ năm chữ là thể thơ mỗi dòng có 5 tiếng, còn có tên gọi truyền thống là thể thơ ngũ ngôn, có khả năng diễn đạt cảm xúc sâu lắng, trữ tình.',
        ],
        takeaway: 'Cả hai thể thơ đều gần gũi với nhịp điệu tâm hồn người Việt, dễ nhớ, dễ thuộc và giàu nhạc tính.',
      },
      {
        id: 'sec_2',
        title: '2. Cách ngắt nhịp và gieo vần',
        body: [
          'Nhịp thơ: Thơ bốn chữ phổ biến nhất là nhịp 2/2. Thơ năm chữ ngắt nhịp 3/2 hoặc 2/3 linh hoạt theo từng dòng.',
          'Gieo vần: Thường gieo vần chân (cuối dòng). Có thể gieo vần liền (hai dòng kề nhau bắt vần) hoặc vần cách (dòng 1 bắt vần với dòng 3, dòng 2 với dòng 4).',
        ],
        example: {
          text: '"Mầm non mắt lim dim / Đang nằm chờ đón nắng / Thấy gió về se lạnh / Khẽ cựa mình rung rinh"',
          analysis: 'Dòng 2 "nắng" bắt vần cách với dòng 3 "lạnh" (vần trắc); nhịp 2/2 tạo nhịp điệu nhẹ nhàng như hơi thở sự sống.',
        },
        svgDiagramType: 'tho_bon_nam',
        takeaway: 'Nhịp ngắt và cách gieo vần tạo nên nhạc điệu êm ả, dẫn dắt cảm xúc người đọc.',
      },
      {
        id: 'sec_3',
        title: '3. Hình ảnh và cảm xúc trong thơ',
        body: [
          'Hình ảnh trong thơ bốn chữ, năm chữ thường cô đọng, giàu sức gợi hình và gợi cảm.',
          'Các tác giả thường dùng biện pháp nhân hóa, so sánh để thiên nhiên trở nên sinh động, mang linh hồn và tâm trạng như con người.',
        ],
        takeaway: 'Đọc thơ bốn chữ, năm chữ cần lắng nghe nhạc điệu và hình dung vẻ đẹp hình ảnh qua lăng kính cảm xúc.',
      },
    ],
    practiceQuizId: 'quiz_tho1_practice',
    testQuizId: 'quiz_tho1_quick',
    test2QuizId: 'quiz_tho1_mastery',
  },
  theory_tu_lay_so_sanh: {
    id: 'theory_tu_lay_so_sanh',
    topicId: 'topic_tu_lay_so_sanh',
    title: 'Lý thuyết chuyên sâu: Từ láy và Phép so sánh tu từ',
    minReadSeconds: 25,
    sections: [
      {
        id: 'sec_1',
        title: '1. Bản chất và phân loại từ láy',
        body: [
          'Từ láy là từ phức có sự hòa phối âm thanh giữa các tiếng theo quy luật ngữ âm nhất định.',
          'Từ láy toàn bộ: lặp lại hoàn toàn âm, vần và thanh (xanh xanh) hoặc hòa phối thanh điệu nhẹ (thoang thoảng, nhè nhẹ).',
          'Từ láy bộ phận: gồm láy phụ âm đầu (long lanh, róc rách) và láy vần (liêu xiêu, chênh vênh).',
        ],
        svgDiagramType: 'tu_lay',
        takeaway: 'Từ láy tạo nên giá trị gợi hình (miêu tả sự vật) và gợi cảm (bộc lộ cảm xúc sâu sắc).',
      },
      {
        id: 'sec_2',
        title: '2. Phép tu từ so sánh trong văn bản',
        body: [
          'So sánh là đối chiếu sự vật, hiện tượng này với sự vật, hiện tượng khác có nét tương đồng để làm tăng sức gợi hình, gợi cảm.',
          'Cấu trúc hoàn chỉnh gồm 4 vế: A (sự vật được so sánh) - Phương diện so sánh - Từ so sánh - B (sự vật dùng để so sánh).',
        ],
        example: {
          text: '"Những giọt sương mai đọng trên lá sen trong suốt như những viên ngọc bích."',
          analysis: 'A = giọt sương mai, Phương diện = trong suốt, Từ so sánh = như, B = những viên ngọc bích.',
        },
        svgDiagramType: 'so_sanh',
        takeaway: 'So sánh làm cho sự vật trở nên cụ thể, giàu hình khối và sắc màu thẩm mĩ.',
      },
    ],
    practiceQuizId: 'quiz_tulay1_practice',
    testQuizId: 'quiz_tulay1_quick',
    test2QuizId: 'quiz_tulay1_mastery',
  },
  theory_truyen_ngan: {
    id: 'theory_truyen_ngan',
    topicId: 'topic_truyen_ngan',
    title: 'Lý thuyết đọc hiểu: Thế giới nhân vật trong truyện ngắn',
    minReadSeconds: 25,
    sections: [
      {
        id: 'sec_1',
        title: '1. Khái niệm nhân vật trong truyện ngắn',
        body: [
          'Nhân vật là con người hoặc con vật được tác giả miêu tả trong tác phẩm văn học, mang tư tưởng và thông điệp thẩm mĩ của nhà văn.',
          'Khác với tiểu thuyết dung lượng lớn, truyện ngắn khắc họa nhân vật qua một vài lát cắt, sự kiện nổi bật nhưng giàu ý nghĩa khái quát.',
        ],
        takeaway: 'Nhân vật chính là linh hồn của câu chuyện, là nơi tác giả gửi gắm tình cảm và quan niệm về cuộc đời.',
      },
      {
        id: 'sec_2',
        title: '2. Các phương diện phân tích nhân vật',
        body: [
          'Ngoại hình: vóc dáng, gương mặt, ánh mắt, trang phục (phản ánh hoàn cảnh và một phần tính cách).',
          'Hành động & cử chỉ: cách ứng xử trước các tình huống bất ngờ (bộc lộ bản chất bên trong).',
          'Ngôn ngữ: lời thoại đối thoại với người khác và độc thoại nội tâm.',
        ],
        takeaway: 'Cần nhìn nhận nhân vật đa chiều, đặt nhân vật trong mối liên hệ với hoàn cảnh và các nhân vật xung quanh.',
      },
    ],
    practiceQuizId: 'quiz_truyen1_practice',
    testQuizId: 'quiz_truyen1_quick',
    test2QuizId: 'quiz_truyen1_mastery',
  },
  theory_doan_van: {
    id: 'theory_doan_van',
    topicId: 'topic_doan_van',
    title: 'Quy trình và kĩ năng viết đoạn văn cảm nghĩ',
    minReadSeconds: 25,
    sections: [
      {
        id: 'sec_1',
        title: '1. Yêu cầu về hình thức của một đoạn văn',
        body: [
          'Đoạn văn được mở đầu bằng chữ viết hoa lùi đầu dòng và kết thúc bằng dấu chấm xuống dòng.',
          'Dung lượng thường từ 8 đến 12 câu, diễn đạt tập trung vào một chủ đề duy nhất, không xuống dòng tùy tiện ở giữa đoạn.',
        ],
        svgDiagramType: 'doan_van',
        takeaway: 'Đảm bảo sự thống nhất về chủ đề và liên kết hình thức chặt chẽ giữa các câu.',
      },
      {
        id: 'sec_2',
        title: '2. Cấu trúc nội dung 3 phần',
        body: [
          'Mở đoạn: Giới thiệu tác phẩm, tác giả và nêu khái quát cảm xúc bao trùm.',
          'Thân đoạn: Chọn lọc chi tiết nghệ thuật, hình ảnh đắt giá để phân tích cảm nghĩ chân thật.',
          'Kết đoạn: Khẳng định ý nghĩa bài thơ đối với tâm hồn người đọc và rút ra liên hệ bản thân.',
        ],
        takeaway: 'Lời văn cần tự nhiên, trong sáng, tránh sáo rỗng hoặc sao chép văn mẫu.',
      },
    ],
    practiceQuizId: 'quiz_van1_practice',
    testQuizId: 'quiz_van1_quick',
    test2QuizId: 'quiz_van1_mastery',
  },
};

// Danh mục quà tặng do giáo viên trao (Rương quà bí mật)
export { REWARDS_CATALOG } from './rewards.ts';

// Danh mục huy hiệu
export const BADGES_CATALOG: Badge[] = [
  {
    id: 'badge_xp_100',
    title: 'Hạt mầm tri thức',
    desc: 'Đạt mốc tích lũy 100 XP đầu tiên trên hành trình học tập',
    category: 'xp',
    iconType: 'book_sprout',
  },
  {
    id: 'badge_xp_300',
    title: 'Mầm xanh cứng cáp',
    desc: 'Đạt mốc tích lũy 300 XP qua các bài học và luyện tập',
    category: 'xp',
    iconType: 'star_ink',
  },
  {
    id: 'badge_xp_1000',
    title: 'Cây tri thức nở hoa',
    desc: 'Đạt mốc tích lũy 1.000 XP xuất sắc',
    category: 'xp',
    iconType: 'solid_tree',
  },
  {
    id: 'badge_streak_3',
    title: 'Chăm chỉ 3 ngày',
    desc: 'Điểm danh liên tiếp 3 ngày trong cùng một tuần',
    category: 'attendance',
    iconType: 'streak_fire',
  },
  {
    id: 'badge_streak_full',
    title: 'Tuần trọn vẹn',
    desc: 'Điểm danh đủ 5/5 ngày học trong tuần lễ',
    category: 'attendance',
    iconType: 'streak_fire',
  },
  {
    id: 'badge_analyzer',
    title: 'Người phân tích',
    desc: 'Đạt mức năng lực Phân tích được từ 80% trở lên',
    category: 'mastery',
    iconType: 'analysis_feather',
  },
  {
    id: 'badge_solid_topic',
    title: 'Vững vàng chủ đề',
    desc: 'Đạt chuẩn "Vững" toàn diện ở ít nhất 01 chủ đề văn học',
    category: 'mastery',
    iconType: 'solid_tree',
  },
  {
    id: 'badge_overcome_self',
    title: 'Vượt qua chính mình',
    desc: 'Ôn lại phần kiến thức yếu và nâng cao điểm năng lực thành công',
    category: 'progress',
    iconType: 'overcome_mountain',
  },
];

// Danh sách tài khoản mẫu
export const DEMO_STUDENTS: StudentProfile[] = [
  {
    id: 'hs001',
    name: 'Nguyễn Minh Anh',
    username: 'hs001',
    role: 'student',
    grade: 'Lớp 7A2',
    school: 'THCS Giấy & Mực',
    avatarSeed: 'minhanh',
  },
  {
    id: 'hs002',
    name: 'Trần Gia Bảo',
    username: 'hs002',
    role: 'student',
    grade: 'Lớp 7A2',
    school: 'THCS Giấy & Mực',
    avatarSeed: 'giabao',
  },
];

/**
 * Trạng thái ban đầu cho học sinh hs001 (đã có chút tiến độ để demo)
 */
export function createInitialStateHs001(): StudentState {
  const todayStr = new Date().toISOString().split('T')[0];

  return {
    profile: DEMO_STUDENTS[0],
    xpToday: 48,
    xpWeek: 310,
    totalXp: 310,
    activeSecondsToday: 28 * 60, // 28 phút tích cực
    activeSecondsContinuous: 28 * 60,
    lastActiveTimestamp: Date.now(),
    lastAttendanceDate: todayStr,
    attendanceDaysThisWeek: 4,
    attendanceHistory: [todayStr],
    consecutiveWeeks: 2,
    exemptDaysUsedThisWeek: 0,
    completedSteps: [
      'video_watch:video_tho_1',
      'summary_read:video_tho_1',
      'quiz_completed:quiz_tho1_practice',
      'attendance:' + todayStr,
    ],
    questionResults: [
      { questionId: 'q_tho_01', level: 'NHAN_BIET', isCorrect: true, scoreRatio: 1, timestamp: Date.now() - 3600000 * 24, topicId: 'topic_tho_bon_nam' },
      { questionId: 'q_tho_02', level: 'NHAN_BIET', isCorrect: true, scoreRatio: 1, timestamp: Date.now() - 3600000 * 20, topicId: 'topic_tho_bon_nam' },
      { questionId: 'q_lay_01', level: 'NHAN_BIET', isCorrect: true, scoreRatio: 1, timestamp: Date.now() - 3600000 * 18, topicId: 'topic_tu_lay_so_sanh' },
      { questionId: 'q_truyen_01', level: 'NHAN_BIET', isCorrect: true, scoreRatio: 1, timestamp: Date.now() - 3600000 * 15, topicId: 'topic_truyen_ngan' },
      { questionId: 'q_van_01', level: 'NHAN_BIET', isCorrect: true, scoreRatio: 1, timestamp: Date.now() - 3600000 * 10, topicId: 'topic_doan_van' },
      
      { questionId: 'q_tho_03', level: 'THONG_HIEU', isCorrect: true, scoreRatio: 1, timestamp: Date.now() - 3600000 * 8, topicId: 'topic_tho_bon_nam' },
      { questionId: 'q_tho_04', level: 'THONG_HIEU', isCorrect: true, scoreRatio: 1, timestamp: Date.now() - 3600000 * 7, topicId: 'topic_tho_bon_nam' },
      { questionId: 'q_lay_03', level: 'THONG_HIEU', isCorrect: true, scoreRatio: 1, timestamp: Date.now() - 3600000 * 6, topicId: 'topic_tu_lay_so_sanh' },
      { questionId: 'q_truyen_02', level: 'THONG_HIEU', isCorrect: false, scoreRatio: 0, timestamp: Date.now() - 3600000 * 5, topicId: 'topic_truyen_ngan' },
      { questionId: 'q_van_02', level: 'THONG_HIEU', isCorrect: true, scoreRatio: 1, timestamp: Date.now() - 3600000 * 4, topicId: 'topic_doan_van' },

      { questionId: 'q_tho_05', level: 'PHAN_TICH', isCorrect: false, scoreRatio: 0.5, timestamp: Date.now() - 3600000 * 3, topicId: 'topic_tho_bon_nam' },
      { questionId: 'q_lay_05', level: 'PHAN_TICH', isCorrect: false, scoreRatio: 0, timestamp: Date.now() - 3600000 * 2, topicId: 'topic_tu_lay_so_sanh' },
    ],
    flaggedNeedReviewTopicIds: ['topic_tu_lay_so_sanh'],
    essaySubmissions: [],
    rewardRequests: [
      {
        id: 'req_01',
        rewardId: 'reward_bookmark',
        requestedAt: Date.now() - 3600000 * 48,
        status: 'PENDING_APPROVAL',
      },
    ],
    unlockedBadgeIds: ['badge_xp_100', 'badge_streak_3'],
    xpLogs: [
      {
        id: 'log_01',
        timestamp: Date.now() - 3600000 * 2,
        actionName: 'Xem bài giảng Thơ bốn chữ, năm chữ',
        rawXp: 5,
        actualXp: 5,
        reason: 'Xem >= 80% bài giảng',
      },
      {
        id: 'log_02',
        timestamp: Date.now() - 3600000 * 1.5,
        actionName: 'Đọc tóm tắt kiến thức trọng tâm',
        rawXp: 2,
        actualXp: 2,
        reason: 'Đọc tóm tắt sau video',
      },
      {
        id: 'log_03',
        timestamp: Date.now() - 3600000 * 1,
        actionName: 'Điểm danh ngày',
        rawXp: 2,
        actualXp: 2,
        reason: 'Điểm danh hằng ngày',
      },
    ],
    soundEnabled: true,
    animationsEnabled: true,
    fontSizePreference: 'normal',
    themePreference: 'creative_edtech',
    currentProgress: {
      type: 'video',
      topicId: 'topic_tho_bon_nam',
      itemId: 'video_tho_1',
      stepIndex: 3, // Đang ở bước Luyện tập
      videoSeconds: 520,
    },
    devTimeMultiplier: 1,
    devDateOffsetDays: 0,
  };
}

/**
 * Trạng thái ban đầu cho học sinh hs002 (học sinh mới bắt đầu)
 */
export function createInitialStateHs002(): StudentState {
  return {
    profile: DEMO_STUDENTS[1],
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
