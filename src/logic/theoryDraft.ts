// Logic thuần cho trình soạn Lý thuyết — tách khỏi component để test được
// và để dùng chung giữa khởi tạo state, reset khi đổi bài, và autosave.
// (26/10: ca mất nội dung khi chuyển bước — khối soạn phải suy ra đúng từ
// bài đang mở, không được giữ khối của bài trước.)
import type { TheoryBlock, TheoryLessonWithMeta } from '../services/types.ts';

// Mẫu 4 khối mặc định khi bài chưa có blocks lẫn sections (giữ nguyên mẫu cũ
// của TheoryLessonEditor).
export function defaultTheoryBlocks(): TheoryBlock[] {
  return [
    { id: 'b_1', type: 'heading', level: 2, content: '1. Khái niệm và đặc điểm chung' },
    { id: 'b_2', type: 'paragraph', content: '' },
    {
      id: 'b_3',
      type: 'example',
      exampleText: '',
      exampleAnalysis: '',
    },
    { id: 'b_4', type: 'takeaway', takeawayText: '' },
  ];
}

// Khối khởi tạo cho trình soạn: ưu tiên blocks đã lưu, rồi convert từ
// sections cũ, cuối cùng là mẫu mặc định.
export function initialBlocksFor(theory: TheoryLessonWithMeta): TheoryBlock[] {
  if (theory.blocks && theory.blocks.length > 0) {
    return theory.blocks;
  }
  if (theory.sections && theory.sections.length > 0) {
    const generated: TheoryBlock[] = [];
    theory.sections.forEach((sec, i) => {
      generated.push({
        id: `b_${Date.now()}_${i}_h`,
        type: 'heading',
        level: 2,
        content: sec.title,
      });
      sec.body.forEach((p, j) => {
        generated.push({
          id: `b_${Date.now()}_${i}_p_${j}`,
          type: 'paragraph',
          content: p,
        });
      });
      if (sec.example) {
        generated.push({
          id: `b_${Date.now()}_${i}_ex`,
          type: 'example',
          exampleText: sec.example.text,
          exampleAnalysis: sec.example.analysis,
        });
      }
      if (sec.takeaway) {
        generated.push({
          id: `b_${Date.now()}_${i}_tk`,
          type: 'takeaway',
          takeawayText: sec.takeaway,
        });
      }
    });
    return generated;
  }
  return defaultTheoryBlocks();
}

// Convert blocks -> sections để tương thích ngược (giữ nguyên logic cũ của
// handleSaveDraft: mỗi heading thành 1 section, body gom TẤT CẢ paragraph,
// takeaway lấy cái đầu tiên). Lưu ý: chuyển đổi này gộp đoạn văn — nguồn
// thật khi mở lại vẫn là blocks, sections chỉ là bản dự phòng.
export function theorySectionsFromBlocks(blocks: TheoryBlock[]) {
  return blocks
    .filter((b) => b.type === 'heading')
    .map((h, idx) => ({
      id: h.id,
      title: h.content || `Phần ${idx + 1}`,
      body: blocks
        .filter((b) => b.type === 'paragraph')
        .map((p) => p.content || ''),
      takeaway: blocks.find((b) => b.type === 'takeaway')?.takeawayText || '',
    }));
}
