'use client';

/**
 * 章内分页:把一章正文按"屏幕"切成若干页。
 *
 * 为什么不用 CSS Column:实测(2026-09-23)长段落跨列时,后续段落的首字符列会
 * "回退"到长段落占用的列,导致"段落起点列 = 页号"的映射错乱 —— 丢字 165/2138。
 * 这里**自己控制分页**:维护一个和真实阅读区同尺寸/字体的离屏页容器,
 * 逐段往里塞,读容器实际高度判断是否超页;超了就二分找能塞下的前缀,剩下的开新页。
 *
 * 算法(已验证:页数正确、不丢字、不重复、超长段正确切开):
 *  1. 建离屏页容器(宽 = pageWidth,字体/字号/行高与真实阅读区一致);
 *  2. 逐段 appendChild,读容器 getBoundingClientRect().height;
 *  3. 整段塞得下 → 留下;塞不下 → removeChild,二分找最大可容纳前缀,塞前缀,剩余开新页;
 *  4. 跨页段落的"后半段"标记 continuation=true(渲染时不加首行缩进,视觉上是上一段的延续)。
 */

/** 一页里的一个文本片段。continuation=true 表示它是上一页某段被切断后的续文。 */
export interface PageSegment {
  text: string;
  continuation: boolean;
}

/** 正文按换行拆段;去掉源站自带的段首空格(全角/半角),缩进统一交给 text-indent。 */
export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/^[\s　 ]+|[\s　 ]+$/g, ''))
    .filter(Boolean);
}

/** 章正文 fetch 协议 */
export interface ChapterBody {
  content?: string;
  body?: string;
  locked?: boolean;
}
export type FetchChapterBody = (chapterId: string) => Promise<ChapterBody>;

export interface PaginateOptions {
  paragraphs: string[];
  pageWidth: number;
  pageHeight: number;
  fontFamily: string;
  fontSize: string;
  /** 第一页顶部要预留的标题块高度(px) */
  titleReserve?: number;
}

export function paginateChapter(opts: PaginateOptions): PageSegment[][] {
  const { paragraphs, pageWidth, pageHeight, fontFamily, fontSize, titleReserve = 0 } = opts;
  if (paragraphs.length === 0) return [];
  if (pageWidth <= 0 || pageHeight <= 0) return [[{ text: paragraphs.join('\n'), continuation: false }]];

  // SSR 期没有 DOM,返回单页兜底( hydration 后再重算)
  if (typeof document === 'undefined') return [[{ text: paragraphs.join('\n'), continuation: false }]];

  // 离屏容器:放真实页 DOM。页本身不限高,靠读高度判断是否超页
  const host = document.createElement('div');
  host.style.cssText = [
    'position:absolute', 'visibility:hidden', 'left:-99999px', 'top:0',
    `width:${pageWidth}px`, 'box-sizing:border-box',
    `font-family:${fontFamily}`, `font-size:${fontSize}`, 'line-height:1.8',
  ].join(';');
  document.body.appendChild(host);

  const pageEl = document.createElement('div');
  pageEl.style.cssText = `width:${pageWidth}px;box-sizing:border-box;overflow:hidden;`;
  host.appendChild(pageEl);

  const addPara = (text: string, isContinuation: boolean) => {
    const el = document.createElement('p');
    el.style.cssText =
      'margin:0;margin-top:0.8em;text-align:justify;overflow-wrap:anywhere;' +
      (isContinuation ? '' : 'text-indent:2em;');
    el.textContent = text;
    pageEl.appendChild(el);
    return el;
  };
  const pageHeightNow = () => pageEl.getBoundingClientRect().height;

  const pages: PageSegment[][] = [];
  let current: PageSegment[] = [];
  // 第一页顶部给标题块留位置(只在第一页加 padding-top)
  let reservePending = titleReserve;

  for (let i = 0; i < paragraphs.length; i++) {
    let text = paragraphs[i];
    let isFirstPiece = true;
    while (text.length > 0) {
      if (reservePending > 0) {
        pageEl.style.paddingTop = `${reservePending}px`;
        reservePending = 0;
      }
      // 先整段试塞
      const el = addPara(text, !isFirstPiece);
      if (pageHeightNow() <= pageHeight) {
        current.push({ text, continuation: !isFirstPiece });
        text = '';
      } else {
        // 整段塞不下:回退,二分找能塞下的前缀
        pageEl.removeChild(el);
        let lo = 0;
        let hi = text.length;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          const probe = addPara(text.slice(0, mid), !isFirstPiece);
          const ok = pageHeightNow() <= pageHeight;
          pageEl.removeChild(probe);
          if (ok) lo = mid;
          else hi = mid - 1;
        }
        if (lo === 0) {
          // 一页连一个字都塞不下(理论上不该发生,防御死循环)
          if (current.length) pages.push(current);
          current = [];
          pageEl.innerHTML = '';
          pageEl.style.paddingTop = '0';
          const forced = text.slice(0, 1);
          addPara(forced, !isFirstPiece);
          current.push({ text: forced, continuation: !isFirstPiece });
          text = text.slice(1);
          isFirstPiece = false;
          continue;
        }
        const head = text.slice(0, lo);
        addPara(head, !isFirstPiece);
        current.push({ text: head, continuation: !isFirstPiece });
        text = text.slice(lo);
        isFirstPiece = false;
        // 当前页满了,开新页
        pages.push(current);
        current = [];
        pageEl.innerHTML = '';
        pageEl.style.paddingTop = '0';
      }
    }
  }
  if (current.length) pages.push(current);

  host.removeChild(pageEl);
  document.body.removeChild(host);

  return pages.length ? pages : [[{ text: paragraphs.join('\n'), continuation: false }]];
}

/** 量标题块在给定宽度/字号下的高度,分页时给首页扣掉 */
export function measureTitleHeight(opts: {
  pageWidth: number;
  fontFamily: string;
  fontSize: string;
  chapterTitle: string;
  bookTitle?: string;
  author?: string;
  wordCount?: number;
}): number {
  const { pageWidth, fontFamily, fontSize, chapterTitle, bookTitle, author, wordCount } = opts;
  if (pageWidth <= 0 || !chapterTitle || typeof document === 'undefined') return 0;
  const host = document.createElement('div');
  host.style.cssText = `position:absolute;visibility:hidden;left:-99999px;top:0;width:${pageWidth}px;box-sizing:border-box;font-family:${fontFamily};font-size:${fontSize};line-height:1.35;`;
  host.innerHTML = `
    <div style="font-size:1.3em;font-weight:500;word-break:break-all;">${escapeHtml(chapterTitle)}</div>
    ${bookTitle || author ? `<div style="margin-top:4px;font-size:13px;line-height:1.5;">${escapeHtml([bookTitle, author, wordCount ? `${wordCount}字` : ''].filter(Boolean).join('　'))}</div>` : ''}
  `;
  document.body.appendChild(host);
  const h = host.getBoundingClientRect().height;
  document.body.removeChild(host);
  return Math.round(h) + 32; // 下边框 + 下间距
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}