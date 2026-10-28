// Trích chữ từ file tài liệu thành nguồn Mầm AI Studio — chạy hoàn toàn trên
// trình duyệt, KHÔNG tải file lên máy chủ. Hỗ trợ .txt (đọc trực tiếp),
// .pdf (pdf.js, trích lớp chữ từng trang) và .docx (mammoth, trích raw text).
// Thư viện nặng (pdf.js, mammoth) chỉ nạp khi người dùng thật sự chọn đúng loại
// file đó (dynamic import), nên lần mở xưởng bình thường không bị đội bundle.
//
// Giới hạn (báo rõ cho giáo viên, không cắt lặng):
// - File tối đa 10MB (tránh phình localStorage — nguồn xưởng lưu theo
//   giáo viên + chủ đề trong localStorage, xem studioKey).
// - Chữ trích ra tối đa 100.000 ký tự; file dài hơn thì giữ đầu + báo đã cắt.
// - PDF quét ảnh (không có lớp chữ) trích ra rỗng -> báo lỗi, không lưu nguồn rỗng.

import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export const MAX_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARS = 100_000;

export type DocumentExtractResult = {
  text: string;
  truncated: boolean;
};

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function isSupportedDocument(name: string): boolean {
  return extOf(name) === '.txt' || extOf(name) === '.pdf' || extOf(name) === '.docx';
}

async function extractPdf(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = workerSrc;
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  return pages.join('\n\n');
}

async function extractDocx(file: File): Promise<string> {
  const { default: mammoth } = await import('mammoth');
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

export async function extractDocumentText(file: File): Promise<DocumentExtractResult> {
  if (file.size > MAX_DOCUMENT_FILE_BYTES) {
    throw new Error(
      `File "${file.name}" nặng ${(file.size / 1048576).toFixed(1)}MB, vượt giới hạn 10MB.`
    );
  }
  const ext = extOf(file.name);
  let text: string;
  if (ext === '.txt') {
    text = await file.text();
  } else if (ext === '.pdf') {
    text = await extractPdf(file);
  } else if (ext === '.docx') {
    text = await extractDocx(file);
  } else {
    throw new Error(
      `Định dạng "${file.name}" chưa được hỗ trợ. Hiện tại dùng file .txt, .pdf hoặc .docx.`
    );
  }
  text = text.replace(/\u0000/g, '').trim();
  if (!text) {
    throw new Error(
      `Không trích xuất được chữ từ "${file.name}" (file PDF quét ảnh không có lớp chữ sẽ cho kết quả rỗng — hãy dùng bản PDF có chữ hoặc dán nội dung trực tiếp).`
    );
  }
  const truncated = text.length > MAX_EXTRACTED_CHARS;
  return { text: truncated ? text.slice(0, MAX_EXTRACTED_CHARS) : text, truncated };
}
