// Tiện ích cho trình soạn văn bản kiểu Word dùng chung (30/10/2026):
// thay block editor của Lý thuyết + mục Ý trọng tâm của Video bằng 1 định
// dạng HTML duy nhất. Dữ liệu cũ (blocks / summaryPoints) không xóa — khi
// mở bài cũ chưa có HTML thì convert 1 lần sang HTML để soạn; màn học sinh
// ưu tiên HTML mới, fallback về dạng cũ nếu chưa có.

import type { TheoryBlock, VideoFocusPoint } from '../services/types.ts';

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Convert blocks lý thuyết cũ -> HTML (bỏ khối rỗng, giống luật ẩn khối rỗng
// ở màn học sinh: đoạn/tiêu đề rỗng, ví dụ rỗng cả 2, ghi nhớ rỗng, ảnh
// không URL đều không render).
export function blocksToHtml(blocks: TheoryBlock[] | undefined | null): string {
  if (!blocks || blocks.length === 0) return '';
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === 'heading') {
      if (!(b.content || '').trim()) continue;
      const tag = b.level === 3 ? 'h3' : 'h2';
      out.push(`<${tag}>${escapeHtml(b.content!.trim())}</${tag}>`);
    } else if (b.type === 'paragraph') {
      if (!(b.content || '').trim()) continue;
      out.push(`<p>${escapeHtml(b.content!.trim())}</p>`);
    } else if (b.type === 'list') {
      const items = (b.items || []).map((it) => it.trim()).filter(Boolean);
      if (items.length === 0) continue;
      out.push(`<ul>${items.map((it) => `<li>${escapeHtml(it)}</li>`).join('')}</ul>`);
    } else if (b.type === 'example') {
      if (!(b.exampleText || '').trim() && !(b.exampleAnalysis || '').trim()) continue;
      let html = `<div class="callout-example"><p><strong>Ví dụ thực tế:</strong></p>`;
      if ((b.exampleText || '').trim()) html += `<p><em>"${escapeHtml(b.exampleText!.trim())}"</em></p>`;
      if ((b.exampleAnalysis || '').trim()) html += `<p><strong>Phân tích:</strong> ${escapeHtml(b.exampleAnalysis!.trim())}</p>`;
      html += `</div>`;
      out.push(html);
    } else if (b.type === 'takeaway') {
      if (!(b.takeawayText || '').trim()) continue;
      out.push(`<div class="callout-takeaway"><p><strong>Ghi nhớ trọng tâm</strong></p><p>${escapeHtml(b.takeawayText!.trim())}</p></div>`);
    } else if (b.type === 'image') {
      if (!b.imageUrl) continue;
      const cap = (b.caption || '').trim();
      out.push(`<figure><img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(cap || 'Minh họa')}" />${cap ? `<figcaption>${escapeHtml(cap)}</figcaption>` : ''}</figure>`);
    }
  }
  return out.join('\n');
}

// Convert ý trọng tâm video cũ -> HTML.
export function summaryPointsToHtml(points: VideoFocusPoint[] | undefined | null): string {
  if (!points || points.length === 0) return '';
  const out: string[] = [];
  for (const pt of points) {
    const title = (pt.title || '').trim();
    const content = (pt.content || '').trim();
    const example = (pt.example || '').trim();
    if (!title && !content && !example) continue;
    if (title) out.push(`<h3>${escapeHtml(title)}</h3>`);
    if (content) out.push(`<p>${escapeHtml(content)}</p>`);
    if (example) out.push(`<p><em>Ví dụ minh họa: ${escapeHtml(example)}</em></p>`);
  }
  return out.join('\n');
}

// Text thuần từ HTML (đếm từ, kiểm tra rỗng, ước tính thời gian đọc).
export function htmlToText(html: string | undefined | null): string {
  if (!html) return '';
  return String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasHtmlContent(html: string | undefined | null): boolean {
  return htmlToText(html).length > 0;
}

// Lấy tiêu đề H2/H3 từ HTML để làm mục lục (bỏ tag con bên trong tiêu đề).
export function extractHeadings(html: string | undefined | null): { level: 2 | 3; text: string }[] {
  if (!html) return [];
  const out: { level: 2 | 3; text: string }[] = [];
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(html))) !== null) {
    const text = htmlToText(m[2]);
    if (text) out.push({ level: m[1] === '3' ? 3 : 2, text });
  }
  return out;
}

const FONT_PX: Record<string, string> = {
  '1': '12px',
  '2': '13px',
  '3': '15px',
  '4': '18px',
  '5': '24px',
  '6': '32px',
  '7': '48px',
};

// Chuẩn hóa HTML do execCommand sinh ra (font/b/i) về dạng sạch thống nhất.
export function normalizeEditorHtml(html: string): string {
  return String(html || '')
    .replace(/<font\s+size="(\d)"[^>]*>([\s\S]*?)<\/font>/gi, (_m, size, inner) => {
      const px = FONT_PX[size] || '15px';
      return `<span style="font-size: ${px};">${inner}</span>`;
    })
    .replace(/<font\s+color="([^"]+)"[^>]*>([\s\S]*?)<\/font>/gi, (_m, color, inner) => {
      return `<span style="color: ${color};">${inner}</span>`;
    })
    .replace(/<b(\s[^>]*)?>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i(\s[^>]*)?>/gi, '<em>')
    .replace(/<\/i>/gi, '</em>');
}

const ALLOWED_TAGS = new Set([
  'P', 'H2', 'H3', 'STRONG', 'EM', 'U', 'S', 'STRIKE',
  'UL', 'OL', 'LI', 'BR', 'SPAN', 'A', 'IMG',
  'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'DIV',
]);
const CALLOUT_CLASSES = new Set(['callout-example', 'callout-takeaway']);

function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:|#)/i.test(h)) return h;
  if (h.startsWith('/files/') || h.startsWith('/')) return h;
  return null;
}

function safeImgSrc(src: string): string | null {
  const s = src.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/files/') || s.startsWith('/')) return s;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s)) return s;
  return null;
}

function safeStyle(style: string): string | null {
  const kept: string[] = [];
  for (const decl of style.split(';')) {
    const [propRaw, ...valParts] = decl.split(':');
    if (!propRaw || valParts.length === 0) continue;
    const prop = propRaw.trim().toLowerCase();
    const val = valParts.join(':').trim();
    if (prop === 'color' && /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-z]+)$/i.test(val)) {
      kept.push(`color: ${val}`);
    } else if (prop === 'font-size' && /^\d+(\.\d+)?(px|pt|em|rem|%)$/.test(val)) {
      kept.push(`font-size: ${val}`);
    } else if (prop === 'text-align' && /^(left|center|right|justify)$/.test(val)) {
      kept.push(`text-align: ${val}`);
    }
  }
  return kept.length > 0 ? kept.join('; ') : null;
}

// Sanitize HTML trước khi render cho học sinh (và trước khi chèn nội dung
// dán từ Word): chỉ giữ tag/attr trong allowlist, còn lại unwrap (giữ chữ).
export function sanitizeHtml(dirty: string | undefined | null): string {
  if (!dirty) return '';
  const raw = normalizeEditorHtml(String(dirty));
  if (typeof DOMParser === 'undefined') {
    return raw
      .replace(/<(script|style|iframe|object|embed|form|video|audio)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, (tag) => (/^<\/?(p|h2|h3|strong|em|u|s|ul|ol|li|br|blockquote)\b/i.test(tag) ? tag : ' '));
  }
  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return '';

  const clean = (node: Node): void => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }
      const el = child as HTMLElement;
      const tag = el.tagName;
      if (!ALLOWED_TAGS.has(tag)) {
        // Tag lạ: unwrap (giữ nội dung chữ bên trong, bỏ vỏ).
        clean(el);
        while (el.firstChild) node.insertBefore(el.firstChild, el);
        el.remove();
        continue;
      }
      // DIV thường -> P (giữ đoạn văn); chỉ DIV callout mới giữ nguyên vỏ.
      if (tag === 'DIV') {
        const cls = (el.getAttribute('class') || '').split(/\s+/).filter((c) => CALLOUT_CLASSES.has(c));
        if (cls.length === 0) {
          const p = doc.createElement('p');
          while (el.firstChild) p.appendChild(el.firstChild);
          node.replaceChild(p, el);
          clean(p);
          continue;
        }
        el.setAttribute('class', cls.join(' '));
        clean(el);
        continue;
      }
      // Attr allowlist theo tag.
      const keepAttrs: Record<string, (v: string) => string | null> = {};
      if (tag === 'A') keepAttrs.href = safeHref;
      if (tag === 'IMG') {
        keepAttrs.src = safeImgSrc;
        keepAttrs.alt = (v) => v.slice(0, 200);
      }
      if (tag === 'SPAN') keepAttrs.style = safeStyle;
      for (const attr of Array.from(el.attributes)) {
        const fn = keepAttrs[attr.name];
        if (!fn) {
          el.removeAttribute(attr.name);
          continue;
        }
        const kept = fn(attr.value);
        if (kept === null) el.removeAttribute(attr.name);
        else el.setAttribute(attr.name, kept);
      }
      if (tag === 'A' && !el.getAttribute('href')) {
        clean(el);
        while (el.firstChild) node.insertBefore(el.firstChild, el);
        el.remove();
        continue;
      }
      if (tag === 'IMG' && !el.getAttribute('src')) {
        el.remove();
        continue;
      }
      clean(el);
    }
  };
  clean(root);
  return root.innerHTML;
}

// Gắn id neo toc-0, toc-1... vào các H2/H3 trong HTML đã sanitize (để mục lục
// bấm vào nhảy tới đúng đoạn).
export function addHeadingAnchors(sanitizedHtml: string): string {
  let i = 0;
  return sanitizedHtml.replace(/<(h[23])([^>]*)>/gi, (_m, tag, attrs) => {
    const cleanAttrs = String(attrs || '').replace(/\s+id="[^"]*"/gi, '');
    return `<${tag}${cleanAttrs} id="toc-${i++}">`;
  });
}
