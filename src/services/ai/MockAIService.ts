/**
 * Cài đặt mặc định MockAIService
 * Sinh nội dung giả lập chất lượng cao bám sát nguồn tài liệu ngữ văn.
 * Có độ trễ giả lập 1–2.5 giây để thể hiện trạng thái xử lý AI trong giao diện.
 */

import {
  AIService,
  AISource,
  AIKeySummaryOptions,
  AITheoryOptions,
  AIQuestionsOptions,
  AIRubricCriterion,
  AIEssayGradingOptions,
  AIEssayGradingResult,
  AIChatResponse,
  AIChatCitation,
  AIExtractedSource,
} from './AIService.ts';
import { Question, KeyPoint, TheoryBlock, QuestionType, SkillLevel, Difficulty } from '../../types.ts';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export class MockAIService implements AIService {
  /**
   * Tóm tắt kiến thức trọng tâm sau video/văn bản
   */
  async generateKeySummary(sources: AISource[], options?: AIKeySummaryOptions): Promise<KeyPoint[]> {
    await delay(1500);
    const activeSources = sources.filter((s) => s.isEnabled);
    const combinedText = activeSources.map((s) => s.content).join('\n\n');
    const sourceTitle = activeSources[0]?.title || 'Văn bản nguồn';

    // Phân tích sơ bộ nội dung nguồn
    const isPoetry = /thơ|vần|khổ|nhịp|bốn chữ|năm chữ/i.test(combinedText);
    const isStory = /nhân vật|truyện|chi tiết|tâm trạng|hành động/i.test(combinedText);

    if (isPoetry) {
      return [
        {
          title: 'Đặc trưng thể thơ và cách ngắt nhịp',
          content: 'Bài thơ sử dụng thể thơ giàu nhạc điệu, ngắt nhịp linh hoạt (2/2 hoặc 3/2) tạo âm hưởng trầm bổng, thiết tha.',
          example: 'Trích câu thơ tiêu biểu: "Tiếng gà trưa / Ổ rơm hồng những trứng..." (nhịp 3/2 bộc lộ niềm bồi hồi).',
        },
        {
          title: 'Hình tượng nghệ thuật xuyên suốt',
          content: 'Hình tượng trung tâm vừa mang tính hiện thực vừa giàu sức gợi cảm, là biểu tượng thiêng liêng cho tình cảm gia đình và quê hương.',
          example: 'Âm thanh tiếng gà là sợi dây kết nối quá khứ êm đềm với hiện tại người chiến sĩ trên đường hành quân.',
        },
        {
          title: 'Biện pháp tu từ và mạch cảm xúc',
          content: 'Phép điệp từ kết hợp hình ảnh ẩn dụ làm nổi bật tình bà cháu đằm thắm và chiều sâu triết lý nhân sinh.',
        },
      ];
    }

    if (isStory) {
      return [
        {
          title: 'Khắc họa ngoại hình và tính cách nhân vật',
          content: 'Nhân vật được khắc họa sắc nét qua diện mạo, nét mặt và những chuyển biến tinh tế trong cử chỉ, hành động.',
          example: 'Chi tiết ánh mắt, nụ cười nghẹn ngào bộc lộ nỗi đau đớn và tình thương con da diết.',
        },
        {
          title: 'Diễn biến tâm lý qua độc thoại nội tâm',
          content: 'Tác giả đi sâu miêu tả dòng suy nghĩ thầm kín, bộc lộ sự giằng xé nội tâm trước nghịch cảnh nghiệt ngã.',
          example: 'Những dằn vặt xót xa khi phải đưa ra quyết định đau lòng nhưng chan chứa tình thương.',
        },
        {
          title: 'Tư tưởng nhân đạo sâu sắc của tác phẩm',
          content: 'Tác phẩm ca ngợi phẩm giá cao đẹp của con người lao động trong hoàn cảnh éo le, đồng thời gián tiếp phê phán xã hội bất công.',
        },
      ];
    }

    // Mặc định văn bản nghị luận / lý thuyết
    return [
      {
        title: 'Khái niệm và phạm vi nhận diện',
        content: `Khái quát từ ${sourceTitle}: Nắm vững đặc trưng cốt lõi của đơn vị kiến thức và phương pháp phân tích chuẩn mực.`,
        example: 'Xác định nhanh dấu hiệu nhận biết thông qua cấu trúc ngữ pháp và ngữ cảnh cụ thể.',
      },
      {
        title: 'Phương pháp vận dụng vào bài làm',
        content: 'Kết hợp linh hoạt giữa phân tích ngữ liệu với việc liên hệ, so sánh để bài viết đạt chiều sâu thẩm mĩ.',
        example: 'Đưa dẫn chứng từ tác phẩm kinh điển kết hợp đánh giá tác dụng biểu đạt của tác giả.',
      },
      {
        title: 'Lưu ý tránh các lỗi diễn đạt thường gặp',
        content: 'Tránh sa vào kể lể tóm tắt nội dung đơn thuần; cần tập trung làm sáng tỏ giá trị nghệ thuật và thông điệp tư tưởng.',
      },
    ];
  }

  /**
   * Sinh lý thuyết chi tiết theo khối kèm ví dụ
   */
  async generateTheory(sources: AISource[], options?: AITheoryOptions): Promise<TheoryBlock[]> {
    await delay(1800);
    const activeSources = sources.filter((s) => s.isEnabled);
    const title = options?.topicTitle || activeSources[0]?.title || 'Chuyên đề kiến thức';

    const blocks: TheoryBlock[] = [
      {
        id: generateId('blk'),
        type: 'heading',
        level: 2,
        content: `I. KHÁI QUÁT VÀ NGUYÊN TẮC TIẾP CẬN: ${title.toUpperCase()}`,
      },
      {
        id: generateId('blk'),
        type: 'paragraph',
        content:
          'Để cảm thụ trọn vẹn giá trị tác phẩm, người đọc cần thấu suốt mạch cảm xúc tự nhiên, sự kết hợp tài hoa giữa phương thức biểu đạt chính và các thủ pháp nghệ thuật nâng đỡ.',
      },
      {
        id: generateId('blk'),
        type: 'takeaway',
        content:
          '📌 ĐIỀU CỐT LÕI: Luôn đặt chi tiết nghệ thuật trong chỉnh thể tác phẩm và hoàn cảnh sáng tác để tránh suy diễn chủ quan lệch lạc.',
      },
      {
        id: generateId('blk'),
        type: 'heading',
        level: 2,
        content: 'II. CÁC ĐẶC TRƯNG TIÊU BIỂU VÀ PHƯƠNG THỨC KHAI THÁC',
      },
      {
        id: generateId('blk'),
        type: 'list',
        items: [
          '1. Nhận diện hình tượng nghệ thuật qua hệ thống ngôn từ giàu hình ảnh, nhịp điệu.',
          '2. Phân tích tác dụng của các biện pháp tu từ then chốt (so sánh, nhân hóa, điệp từ, ẩn dụ).',
          '3. Khám phá thông điệp tình cảm, triết lý sống mà tác giả gửi gắm qua từng trang viết.',
        ],
      },
      {
        id: generateId('blk'),
        type: 'example',
        content:
          'Minh họa điển hình: Khi phân tích chi tiết "chiếc lá cuối cùng", ta không chỉ thấy vẻ đẹp của bức vẽ kiệt tác mà còn cảm nhận tấm lòng hy sinh cao cả của người nghệ sĩ già vì sự sống của đồng loại.',
      },
      {
        id: generateId('blk'),
        type: 'takeaway',
        content:
          '💡 GHI NHỚ LÀM BÀI: Khi viết đoạn văn phân tích, hãy tuân thủ cấu trúc "Tổng - Phân - Hợp", có trích dẫn từ ngữ tiêu biểu và đánh giá cảm xúc chân thành.',
      },
    ];

    return blocks;
  }

  /**
   * Sinh bộ câu hỏi theo các dạng và 4 mức năng lực
   */
  async generateQuestions(sources: AISource[], options?: AIQuestionsOptions): Promise<Question[]> {
    await delay(2000);
    const activeSources = sources.filter((s) => s.isEnabled);
    const sourceText = activeSources.map((s) => s.content).join('\n\n');
    const sourceTitle = activeSources[0]?.title || 'Tài liệu nguồn';

    // Trích đoạn câu ngắn từ nguồn làm context snippet
    const sentences = sourceText
      .split(/[.!?\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25);
    const sampleSnippet1 = sentences[0] || 'Hình ảnh quê hương gắn liền với tình cảm gia đình tha thiết.';
    const sampleSnippet2 = sentences[1] || 'Tác giả khéo léo sử dụng các biện pháp tu từ độc đáo.';
    const sampleSnippet3 = sentences[2] || 'Tâm trạng nhân vật trải qua nhiều cung bậc cảm xúc mãnh liệt.';

    const total = options?.totalQuestions || 5;
    const questions: Question[] = [];

    // 1. Câu Trắc nghiệm 1 đáp án - Nhận biết
    questions.push({
      id: generateId('q_ai'),
      topicId: 'topic_tho_bon_nam',
      type: 'single',
      level: 'NHAN_BIET',
      difficulty: 'DE',
      points: 2,
      prompt: `Dựa vào ngữ liệu từ "${sourceTitle}", biện pháp nghệ thuật nào nổi bật nhất được sử dụng trong văn bản?`,
      passage: sampleSnippet1,
      options: [
        'Biện pháp so sánh và điệp từ giàu nhạc tính',
        'Biện pháp nói quá và nói giảm nói tránh',
        'Liệt kê số liệu thống kê khoa học',
        'Sử dụng thuần thục thuật ngữ chuyên môn',
      ],
      answer: 'A',
      explanation: 'Văn bản sử dụng hình ảnh so sánh kết hợp điệp từ gợi nhắc cảm xúc gần gũi, ấm áp.',
      aiSourceSnippet: sampleSnippet1.slice(0, 120),
      isAiGenerated: true,
      isTeacherReviewed: false,
    });

    // 2. Câu Chọn nhiều đáp án (chấm điểm từng phần) - Thông hiểu
    if (questions.length < total) {
      questions.push({
        id: generateId('q_ai'),
        topicId: 'topic_tho_bon_nam',
        type: 'multi',
        level: 'THONG_HIEU',
        difficulty: 'TB',
        points: 2,
        allowPartialCredit: true,
        prompt: `Những chi tiết hoặc nhận định nào sau đây thể hiện ĐÚNG nội dung ý nghĩa của văn bản? (Chọn tất cả đáp án đúng)`,
        passage: sampleSnippet2,
        options: [
          'Tình cảm yêu thương, gắn bó son sắt với người thân yêu',
          'Hình tượng thơ/truyện giàu sức gợi cảm và tính biểu tượng',
          'Thái độ thờ ơ, lạnh nhạt trước các biến cố đời thường',
          'Mạch cảm xúc đi từ ký ức tuổi thơ đến hiện thực cuộc sống',
        ],
        answer: ['A', 'B', 'D'],
        explanation: 'Các phương án đúng làm nổi bật trọn vẹn chủ đề tình cảm gia đình và nghệ thuật biểu đạt.',
        aiSourceSnippet: sampleSnippet2.slice(0, 120),
        isAiGenerated: true,
        isTeacherReviewed: false,
      });
    }

    // 3. Câu Điền vào ô trống - Phân tích
    if (questions.length < total) {
      questions.push({
        id: generateId('q_ai'),
        topicId: 'topic_tho_bon_nam',
        type: 'fill',
        level: 'PHAN_TICH',
        difficulty: 'TB',
        points: 2,
        prompt: 'Điền từ ngữ thích hợp vào các vị trí trống để hoàn thiện nhận định phân tích sau:',
        passage: 'Qua ngòi bút tinh tế, tác giả đã làm nổi bật [chiều sâu] cảm xúc và thông điệp nhân văn [cao đẹp] gửi gắm đến bạn đọc.',
        answer: ['chiều sâu', 'cao đẹp'],
        fillBlanksCount: 2,
        explanation: 'Cần điền các từ ngữ thể hiện đúng quy mô tư tưởng và phẩm chất tình cảm trong nhận định.',
        aiSourceSnippet: sampleSnippet3.slice(0, 120),
        isAiGenerated: true,
        isTeacherReviewed: false,
      });
    }

    // 4. Câu Trắc nghiệm - Vận dụng
    if (questions.length < total) {
      questions.push({
        id: generateId('q_ai'),
        topicId: 'topic_tho_bon_nam',
        type: 'single',
        level: 'VAN_DUNG',
        difficulty: 'KHO',
        points: 2,
        prompt: 'Từ bài học và cảm xúc trong văn bản trên, thông điệp sống tích cực nào có ý nghĩa thiết thực nhất đối với học sinh ngày nay?',
        passage: sampleSnippet1,
        options: [
          'Biết trân quý tình cảm gia đình và nỗ lực rèn luyện để đền đáp công ơn cha mẹ, thầy cô',
          'Chỉ nên quan tâm đến thành tích học tập trước mắt, bỏ qua các giá trị truyền thống',
          'Tránh tiếp xúc với văn học vì không liên quan trực tiếp đến các môn khoa học tự nhiên',
          'Dành toàn bộ thời gian cho thế giới ảo trên mạng xã hội',
        ],
        answer: 'A',
        explanation: 'Ý nghĩa nhân văn của văn học hướng con người tới lối sống biết ơn, yêu thương và trách nhiệm.',
        aiSourceSnippet: sampleSnippet1.slice(0, 120),
        isAiGenerated: true,
        isTeacherReviewed: false,
      });
    }

    // 5. Câu Viết đoạn văn (Tự luận Rubric) - Vận dụng cao
    if (questions.length < total) {
      questions.push({
        id: generateId('q_ai'),
        topicId: 'topic_tho_bon_nam',
        type: 'essay',
        level: 'VAN_DUNG',
        difficulty: 'KHO',
        points: 2,
        minWords: 80,
        maxWords: 150,
        enableAiGrading: true,
        prompt: `Viết một đoạn văn ngắn (khoảng 100 - 150 chữ) ghi lại cảm nghĩ của em về một hình ảnh thơ hoặc chi tiết nghệ thuật đắt giá trong văn bản vừa học.`,
        passage: sampleSnippet1,
        rubric: [
          { name: 'Nội dung ý & Cảm thụ', description: 'Gọi tên đúng chi tiết và chỉ ra ý nghĩa biểu cảm sâu sắc', maxScore: 4 },
          { name: 'Bố cục & Liên kết', description: 'Đảm bảo cấu trúc đoạn văn, mở đoạn thân đoạn kết đoạn mạch lạc', maxScore: 2 },
          { name: 'Dùng từ đặt câu', description: 'Diễn đạt trong sáng, không sai lỗi chính tả và ngữ pháp', maxScore: 2 },
          { name: 'Sáng tạo cảm xúc', description: 'Có giọng điệu riêng, thể hiện sự rung động chân thành', maxScore: 2 },
        ],
        sampleEssay:
          'Trong văn bản, chi tiết hình ảnh đắt giá nhất đã để lại trong em niềm xúc động sâu sắc chính là... Hình ảnh ấy không chỉ gợi lên bức tranh cuộc sống chân thực mà còn bộc lộ tấm lòng son sắt của nhân vật...',
        explanation: 'Đoạn văn cần bám sát yêu cầu thể thức, phân tích được vẻ đẹp của chi tiết nghệ thuật và liên hệ bản thân.',
        aiSourceSnippet: sampleSnippet1.slice(0, 120),
        isAiGenerated: true,
        isTeacherReviewed: false,
      });
    }

    // Nếu người dùng yêu cầu nhiều hơn 5 câu (ví dụ 10 câu, 15 câu), tự động sinh thêm các câu hỏi chất lượng cao
    const extraPrompts = [
      {
        prompt: `Trong văn bản "${sourceTitle}", nét đặc sắc nhất về cách gieo vần và ngắt nhịp là gì?`,
        type: 'single' as const,
        level: 'THONG_HIEU' as const,
        options: [
          'Ngắt nhịp linh hoạt 2/3 hoặc 3/2, vần chân giàu sức gợi',
          'Chỉ dùng vần lưng và không ngắt nhịp',
          'Ngắt nhịp đều đặn 4/4 như thơ tám chữ',
          'Không tuân theo quy luật vần nhịp nào',
        ],
        answer: 'A',
        explanation: 'Cách ngắt nhịp biến hóa kết hợp vần chân giúp tạo nên âm hưởng tha thiết, gần gũi.',
      },
      {
        prompt: `Từ ngữ nào trong ngữ liệu thể hiện trực tiếp trạng thái cảm xúc của tác giả/nhân vật trữ tình?`,
        type: 'single' as const,
        level: 'NHAN_BIET' as const,
        options: [
          'Các từ ngữ miêu tả xúc động, bồi hồi, tha thiết',
          'Các thuật ngữ khoa học chính xác',
          'Các khẩu hiệu kêu gọi hành động',
          'Các từ ngữ trừu tượng khó hiểu',
        ],
        answer: 'A',
        explanation: 'Hệ thống từ ngữ cảm thán và từ láy tượng hình trực tiếp bộc lộ thế giới nội tâm nhân vật.',
      },
      {
        prompt: `Xác định tác dụng của chi tiết nghệ thuật đắt giá trong đoạn trích đối với việc thể hiện tư tưởng chủ đề:`,
        type: 'single' as const,
        level: 'PHAN_TICH' as const,
        options: [
          'Gợi mở chiều sâu tư tưởng và làm nổi bật chủ đề tình cảm gia đình, quê hương',
          'Làm cho văn bản thêm dài dòng, phức tạp',
          'Khiến người đọc phân tâm khỏi chủ đề chính',
          'Chỉ có tác dụng trang trí hình thức cho câu văn',
        ],
        answer: 'A',
        explanation: 'Chi tiết nghệ thuật đóng vai trò là điểm sáng thẩm mỹ, kết nối mạch cảm xúc toàn bài.',
      },
      {
        prompt: `Đánh giá thông điệp nhân văn mà tác giả gửi gắm qua ngữ liệu "${sourceTitle}":`,
        type: 'multi' as const,
        level: 'VAN_DUNG' as const,
        options: [
          'Trân trọng những giá trị bình dị, thân thương trong cuộc sống',
          'Lòng biết ơn sâu sắc đối với những người đã nuôi dưỡng, chở che ta khôn lớn',
          'Ý thức trách nhiệm của mỗi cá nhân đối với gia đình và xã hội',
          'Chỉ theo đuổi ước mơ cá nhân mà quên đi cội nguồn',
        ],
        answer: ['A', 'B', 'C'],
        explanation: 'Ba phương án A, B, C phản ánh trọn vẹn giá trị giáo dục nhân cách cao đẹp của tác phẩm.',
      },
      {
        prompt: `Từ ngữ liệu trên, em rút ra được bài học gì về cách quan sát và miêu tả thế giới xung quanh?`,
        type: 'single' as const,
        level: 'VAN_DUNG' as const,
        options: [
          'Cần quan sát bằng cả tấm lòng yêu thương và sự rung động tinh tế',
          'Chỉ cần sao chép máy móc những gì nhìn thấy',
          'Không cần quan sát thực tế, chỉ cần tưởng tượng',
          'Chỉ chú ý đến những sự việc to lớn, vĩ mô',
        ],
        answer: 'A',
        explanation: 'Văn học đòi hỏi người viết phải quan sát tinh tế bằng trái tim để phát hiện vẻ đẹp ẩn sâu.',
      },
    ];

    let extraIndex = 0;
    while (questions.length < total) {
      const template = extraPrompts[extraIndex % extraPrompts.length];
      const snippet = sentences[extraIndex % sentences.length] || sampleSnippet1;
      questions.push({
        id: generateId('q_ai'),
        topicId: 'topic_tho_bon_nam',
        type: template.type,
        level: template.level,
        difficulty: options?.difficulty || 'TB',
        points: 2,
        prompt: template.prompt,
        passage: snippet,
        options: template.options,
        answer: template.answer,
        explanation: template.explanation,
        aiSourceSnippet: snippet.slice(0, 120),
        isAiGenerated: true,
        isTeacherReviewed: false,
      });
      extraIndex++;
    }

    return questions.slice(0, total);
  }

  /**
   * Gợi ý chấm bài viết đoạn văn theo Rubric
   */
  async suggestEssayGrade(
    essayText: string,
    rubric: AIRubricCriterion[],
    sampleEssays?: any[],
    options?: AIEssayGradingOptions
  ): Promise<AIEssayGradingResult> {
    await delay(1600);
    const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length;
    const strictness = options?.strictness || 3; // 1..5
    const tone = options?.tone || 'encouraging';

    // Đánh giá sơ bộ về nội dung
    const hasGoodLength = wordCount >= 70 && wordCount <= 220;
    const hasEmotionWords = /cảm xúc|xúc động|rung cảm|thiết tha|sâu sắc|yêu thương|bồi hồi|ý nghĩa/i.test(essayText);
    const hasQuotes = /"|“|”|chi tiết|hình ảnh|tác giả|câu thơ/i.test(essayText);
    const hasConnectors = /trước hết|bên cạnh đó|không chỉ vậy|tóm lại|hơn nữa|qua đó/i.test(essayText);

    // Tính điểm theo từng tiêu chí trong Rubric
    let weightedTotal = 0;
    const rubricScores = rubric.map((crit) => {
      let ratio = 0.8; // Cơ sở 80%

      if (/nội dung/i.test(crit.name)) {
        if (hasEmotionWords && hasQuotes) ratio = 0.88;
        else if (!hasQuotes) ratio = 0.72;
      } else if (/bố cục|liên kết/i.test(crit.name)) {
        if (hasConnectors) ratio = 0.9;
        else ratio = 0.75;
      } else if (/dùng từ|chính tả|ngữ pháp/i.test(crit.name)) {
        if (hasGoodLength) ratio = 0.85;
        else ratio = 0.7;
      } else if (/sáng tạo|cảm xúc/i.test(crit.name)) {
        if (hasEmotionWords) ratio = 0.85;
        else ratio = 0.7;
      }

      // Điều chỉnh theo độ nghiêm khắc (-0.05 nếu strictness cao, +0.05 nếu nhẹ tay)
      const strictnessAdjustment = (3 - strictness) * 0.04;
      ratio = Math.max(0.4, Math.min(1.0, ratio + strictnessAdjustment));

      const maxScore = crit.maxScore || (crit.weight ? (crit.weight / 100) * 10 : 2.5);
      const suggestedScore = Math.round(maxScore * ratio * 10) / 10;
      weightedTotal += suggestedScore;

      let reason = '';
      if (ratio >= 0.85) {
        reason = `Thể hiện rất tốt yêu cầu ${crit.name.toLowerCase()}, diễn đạt tự nhiên và thuyết phục.`;
      } else if (ratio >= 0.7) {
        reason = `Đáp ứng cơ bản tiêu chuẩn ${crit.name.toLowerCase()}, nên trau chuốt thêm để nổi bật hơn.`;
      } else {
        reason = `Còn thiếu sót ở phần ${crit.name.toLowerCase()}, cần chú ý dẫn chứng và cách liên kết câu.`;
      }

      return {
        criterionId: crit.id,
        criterionName: crit.name,
        suggestedScore,
        maxScore,
        reason,
        comment: reason,
      };
    });

    const finalTotal = Math.round(Math.min(10, Math.max(1, weightedTotal)) * 10) / 10;

    let overallComment = '';
    if (tone === 'encouraging') {
      overallComment = `Thầy/cô khen ngợi em đã hoàn thành bài viết đúng thời hạn và có nhiều cảm xúc chân thành (${wordCount} từ). Bài viết có dẫn chứng và nắm được tinh thần của đoạn trích. Điểm sáng của em là khả năng cảm thụ tự nhiên; nếu em chú ý rèn thêm cách chuyển câu cho mượt mà hơn nữa thì đoạn văn sẽ đạt điểm xuất sắc!`;
    } else if (tone === 'strict') {
      overallComment = `Bài viết đạt độ dài cơ bản (${wordCount} từ) và có bám sát đề. Tuy nhiên em cần phân tích sâu hơn về nghệ thuật thay vì kể lại nội dung; chú ý tránh một số lỗi diễn đạt lặp từ ở phần thân đoạn.`;
    } else {
      overallComment = `Đoạn văn có kết cấu rõ ràng, đúng dung lượng quy định. Em đã làm nổi bật được chi tiết nghệ thuật trọng tâm và có bày tỏ cảm nghĩ cá nhân. Cần phát huy ở các bài viết tiếp theo.`;
    }

    return {
      rubricScores,
      totalScore: finalTotal,
      overallComment,
      confidenceScore: 0.92,
    };
  }

  /**
   * Hỏi đáp với tài liệu nguồn (NotebookLM chat)
   */
  async chatWithSources(
    sources: AISource[],
    message: string,
    history?: { role: 'user' | 'assistant'; text: string }[]
  ): Promise<AIChatResponse> {
    await delay(1200);
    const activeSources = sources.filter((s) => s.isEnabled !== false);

    if (activeSources.length === 0) {
      return {
        reply: 'Hiện tại chưa có nguồn tài liệu nào được kích hoạt. Thầy/cô vui lòng bật ít nhất một nguồn bên cột trái để tôi có thể tra cứu và trả lời chính xác.',
        citations: [],
      };
    }

    const firstSource = activeSources[0];
    const words = message.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const matchedLines = firstSource.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 15 && words.some((w) => l.toLowerCase().includes(w)));

    const snippet = matchedLines[0] || firstSource.content.slice(0, 180);
    const citations: AIChatCitation[] = [
      {
        sourceId: firstSource.id,
        sourceTitle: firstSource.title,
        snippet: snippet.length > 150 ? snippet.slice(0, 150) + '...' : snippet,
      },
    ];

    let reply = '';
    if (/từ láy|biện pháp|tu từ|so sánh|nhân hóa/i.test(message)) {
      reply = `Dựa trên tài liệu "${firstSource.title}", tác giả sử dụng các biện pháp tu từ tiêu biểu kết hợp với từ ngữ giàu giá trị tạo hình. Điểm cốt lõi là làm nổi bật tình cảm chân thành và âm hưởng thiết tha của tác phẩm.`;
    } else if (/nhân vật|tâm trạng|hành động/i.test(message)) {
      reply = `Theo nguồn trích dẫn, tâm lý nhân vật được khắc họa sâu sắc qua những chuyển biến tinh tế trong cử chỉ và độc thoại nội tâm. Chi tiết nghệ thuật tiêu biểu thể hiện rõ nét phẩm chất chịu thương chịu khó và giàu tình yêu thương.`;
    } else {
      reply = `Từ nội dung tài liệu nguồn "${firstSource.title}", vấn đề thầy/cô quan tâm được thể hiện rõ nét qua các dẫn chứng tiêu biểu. Chi tiết trong bài giúp làm sáng tỏ mạch cảm xúc tự nhiên và thông điệp tư tưởng của tác giả.`;
    }

    return {
      reply,
      citations,
    };
  }

  /**
   * Trích xuất nội dung từ liên kết video/trang web (Mock)
   */
  async extractContentFromUrl(url: string): Promise<AIExtractedSource> {
    await delay(1500);
    const cleanUrl = url.trim();
    const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(cleanUrl);

    if (isYouTube) {
      const content = `[Lời thoại & Phụ đề bài giảng YouTube: Phân tích văn bản Ngữ văn 7]
1. Đặt vấn đề và giới thiệu chung về tác giả, hoàn cảnh sáng tác bài thơ/tác phẩm.
2. Phân tích chi tiết:
- Khổ 1 và khổ 2: Không gian làng quê êm đềm, âm thanh thân quen của tiếng gà nhảy ổ gợi nhắc ký ức tuổi thơ.
- Khổ 3 và khổ 4: Tình cảm bà cháu thiêng liêng, hình ảnh người bà tần tảo chắt chiu từng quả trứng hồng cho cháu.
- Khổ kết: Mục đích chiến đấu và lý tưởng cao đẹp của người lính trẻ bắt nguồn từ tình yêu bà, yêu xóm làng quê hương.
3. Tổng kết nghệ thuật: Thể thơ năm chữ tự nhiên, nhịp thơ linh hoạt, điệp từ "nghe" tạo ấn tượng cảm xúc dạt dào.
4. Bài học liên hệ: Lòng biết ơn gia đình, cội nguồn nâng bước con người trên mọi nẻo đường đời.`;

      return {
        title: 'Video bài giảng: Phân tích vẻ đẹp hình tượng và nghệ thuật thơ',
        content,
        wordCount: content.split(/\s+/).filter(Boolean).length,
        type: 'video',
        url: cleanUrl,
      };
    }

    const content = `[Tài liệu trích xuất từ trang web: Kiến thức Ngữ văn 7 chuẩn GDPT 2018]
- Thể loại: Thơ trữ tình / Văn bản thông tin.
- Đặc trưng thi pháp: Số chữ trong dòng, cách gieo vần, ngắt nhịp và hình ảnh biểu tượng.
- Hệ thống câu hỏi đọc hiểu rèn luyện 4 mức độ: Nhận biết chi tiết nghệ thuật, thông hiểu tâm trạng nhân vật trữ tình, phân tích tác dụng biện pháp tu từ, và vận dụng liên hệ bài học cuộc sống.`;

    return {
      title: 'Tài liệu hướng dẫn đọc hiểu và ngữ liệu chuyên sâu',
      content,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      type: 'website',
      url: cleanUrl,
    };
  }
}
