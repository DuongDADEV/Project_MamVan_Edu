/**
 * Thứ tự LUỒNG HỌC trong một chủ đề: danh sách hỗn hợp Video / Lý thuyết /
 * Bài tập theo đúng trình tự giáo viên sắp xếp (dải nút tròn ở đầu trang
 * Nội dung học + trang chủ đề phía học sinh đều đọc từ đây).
 * Lưu trên bản ghi chủ đề ở dạng khóa chuỗi: "video:<id>", "theory:<id>", "quiz:<id>".
 */

export type FlowItemType = 'video' | 'theory' | 'quiz';

export interface FlowItem {
  type: FlowItemType;
  id: string;
}

export function flowKeyOf(type: FlowItemType, id: string): string {
  return `${type}:${id}`;
}

/**
 * Chèn khóa mới NGAY SAU khóa neo (bài đang mở lúc bấm Tạo mới) — quy tắc của
 * chủ dự án: đang ở vị trí nào thì bài mới nằm ngay sau vị trí đó.
 * Không có neo (hoặc neo không còn trong danh sách) → gắn vào cuối.
 */
export function insertFlowKeyAfter(
  keys: string[],
  newKey: string,
  afterKey?: string | null
): string[] {
  if (keys.includes(newKey)) return keys;
  if (afterKey) {
    const idx = keys.indexOf(afterKey);
    if (idx >= 0) {
      const next = [...keys];
      next.splice(idx + 1, 0, newKey);
      return next;
    }
  }
  return [...keys, newKey];
}

export function parseFlowKey(key: string): FlowItem | null {
  const idx = key.indexOf(':');
  if (idx <= 0) return null;
  const type = key.slice(0, idx);
  const id = key.slice(idx + 1);
  if ((type === 'video' || type === 'theory' || type === 'quiz') && id) {
    return { type, id };
  }
  return null;
}

/**
 * Suy ra thứ tự luồng hiệu lực: lấy các mục còn tồn tại theo thứ tự đã lưu,
 * rồi bổ sung các mục chưa có vào cuối theo thứ tự dự phòng
 * (video theo videoIds của chủ đề → lý thuyết → bài tập).
 */
export function deriveFlowItems(
  stored: string[] | undefined,
  videoIdsInOrder: string[],
  theoryIdsInOrder: string[],
  quizIdsInOrder: string[]
): FlowItem[] {
  const valid = new Map<string, FlowItem>();
  for (const id of videoIdsInOrder) valid.set(flowKeyOf('video', id), { type: 'video', id });
  for (const id of theoryIdsInOrder) valid.set(flowKeyOf('theory', id), { type: 'theory', id });
  for (const id of quizIdsInOrder) valid.set(flowKeyOf('quiz', id), { type: 'quiz', id });

  const out: FlowItem[] = [];
  const used = new Set<string>();
  for (const key of stored || []) {
    const item = parseFlowKey(key);
    if (item && valid.has(key) && !used.has(key)) {
      out.push(item);
      used.add(key);
    }
  }
  for (const [key, item] of valid) {
    if (!used.has(key)) out.push(item);
  }
  return out;
}

export function flowKeys(items: FlowItem[]): string[] {
  return items.map((i) => flowKeyOf(i.type, i.id));
}
