// ĐỢT 7 (26/10): bảng rộng trong bong bóng chat hẹp — bảng quá 3 cột mà
// giữ dạng bảng ngang thì kiểu gì cũng tràn hoặc bóp dúm, nên khung chat tự
// đổi nó thành thẻ dọc: cột đầu làm tiêu đề thẻ, các cột còn lại thành dòng
// 'Nhãn: giá trị'. Không phụ thuộc model chịu đổi cách trình bày — render
// tự xếp lại nên bảng nào cũng vừa khung, không tràn, không cần kéo ngang.

export function textOf(node: any): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object' && node.props) return textOf(node.props.children);
  return '';
}

export function childrenToArray(children: any): any[] {
  if (children == null) return [];
  return Array.isArray(children) ? children : [children];
}

// Đọc tiêu đề + các hàng từ cây phần tử bảng của react-markdown. Đi theo vị
// trí (phần tử đầu = thead, thứ hai = tbody) chứ không theo tên thẻ, vì các
// ô có thể đã qua override thành phần khác. Trích xuất thất bại -> null để
// nút render quay về dạng bảng thường.
export function extractTable(children: any): { headers: string[]; rows: string[][] } | null {
  const parts = childrenToArray(children);
  const thead = parts[0];
  const tbody = parts[1];
  if (!thead?.props || !tbody?.props) return null;
  const headRow = childrenToArray(thead.props.children)[0];
  if (!headRow?.props) return null;
  const headers = childrenToArray(headRow.props.children).map(textOf);
  const rows = childrenToArray(tbody.props.children).map((tr: any) =>
    childrenToArray(tr?.props?.children).map(textOf)
  );
  if (headers.length === 0 || rows.length === 0) return null;
  return { headers, rows };
}

export interface CardLine {
  label: string;
  value: string;
}

export interface CardData {
  title: string;
  lines: CardLine[];
}

// Cột đầu thành tiêu đề thẻ, các cột còn lại thành dòng 'Nhãn: giá trị'.
export function toCards(headers: string[], rows: string[][]): CardData[] {
  return rows.map((r) => ({
    title: r[0] ?? '',
    lines: headers.slice(1).map((h, i) => ({ label: h, value: r[i + 1] ?? '' })),
  }));
}

// Ngưỡng đổi sang thẻ dọc: bảng 4 cột trở lên trong bong bóng hẹp kiểu gì
// cũng tràn; bảng 3 cột trở xuống giữ dạng bảng thường là vừa.
export function shouldStack(headers: string[]): boolean {
  return headers.length > 3;
}
