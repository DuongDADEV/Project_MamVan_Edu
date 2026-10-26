// Chọn các bài Luyện tập cho luồng lý thuyết của học sinh.
//
// Trước 26/10, luồng chỉ hiện ĐÚNG 1 bài luyện tập (bài gắn làm Luyện tập,
// hoặc bài practice đầu tiên trong chủ đề) — bài luyện tập thứ 2 trở đi vô
// hình dù đã xuất bản và đã nằm trong thứ tự luồng của chủ đề (ca 26/10:
// chủ đề "Bài 1: Văn nghị luận xã hội" có 2 bài Luyện tập mà luồng học sinh
// chỉ thấy bài giữa).
//
// Quy tắc mới (26/10):
//  1. Bài gắn làm Luyện tập của chính lý thuyết này luôn đứng trước (kể cả
//     khi loại của nó không phải practice — giữ hành vi cũ).
//  2. Các bài practice còn lại trong chủ đề đều thành bước Luyện tập, xếp
//     theo đúng thứ tự luồng của chủ đề (flowOrder); bài chưa có trong
//     flowOrder xếp cuối theo thứ tự danh sách.
//  3. Không lấy bài đã gắn làm Kiểm tra của chính lý thuyết này (nó hiện ở
//     bước Kiểm tra), và không lấy bài đã gắn cho lý thuyết KHÁC trong cùng
//     chủ đề (tránh bài của lý thuyết này lọt sang luồng lý thuyết kia).
//  4. Bài gắn làm Kiểm tra 2 (test2) vẫn chưa có bước vẽ trong luồng học
//     sinh nên không bị loại ở đây — nó hiện như một bước Luyện tập còn hơn
//     vô hình hoàn toàn (xem ghi chú ở node sơ đồ 2.4).

export interface PracticePickInput<T extends { id: string; kind: string }> {
  linkedPracticeId?: string;
  explicitTestQuizId?: string;
  topicQuizzes: T[];
  flowOrder?: string[];
  excludedQuizIds?: string[];
}

export function selectTheoryPracticeQuizzes<T extends { id: string; kind: string }>(
  input: PracticePickInput<T>
): T[] {
  const { linkedPracticeId, explicitTestQuizId, topicQuizzes, flowOrder, excludedQuizIds } =
    input;
  const byId = new Map(topicQuizzes.map((q) => [q.id, q]));
  const excluded = new Set(excludedQuizIds || []);

  // Bài gắn làm Luyện tập thắng mọi loại trừ, trừ khi chính nó cũng là bài
  // gắn làm Kiểm tra (khi đó bước Kiểm tra thắng).
  const linked =
    linkedPracticeId && linkedPracticeId !== explicitTestQuizId
      ? byId.get(linkedPracticeId)
      : undefined;

  const orderIndex = new Map<string, number>();
  (flowOrder || []).forEach((key, idx) => {
    if (!orderIndex.has(key)) orderIndex.set(key, idx);
  });
  const rank = (q: T): number => {
    const idx = orderIndex.get(`quiz:${q.id}`);
    return idx === undefined ? Number.POSITIVE_INFINITY : idx;
  };

  const others = topicQuizzes
    .filter(
      (q) =>
        q.kind === 'practice' &&
        q.id !== linked?.id &&
        q.id !== explicitTestQuizId &&
        !excluded.has(q.id)
    )
    .sort((a, b) => rank(a) - rank(b));

  return linked ? [linked, ...others] : others;
}
