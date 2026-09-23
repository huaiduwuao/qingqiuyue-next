'use client';

/**
 * 章内分页:把一章正文按"屏幕"切成若干页。
 *
 * 为什么不用 CSS Column:实测(2026-09-23)长段落跨列时,后续段落的首字符列会
 * "回退"到长段落占用的列,导致"段落起点列 = 页号"的映射错乱 —— 丢字 165/2138。
 * 这里**自己控制分页**:维护一个和真实阅读区同尺寸/字体的离屏页容器,
 * 逐段往里塞,读容器实际高度判断是否超页;超了就二分找能塞下的前缀,剩下的开新页。
 *
 * 量出来的页必须和渲染出来的页一模一样,否则多出的行会被 overflow:hidden 吃掉(丢字)。
 * 所以页边距(PAGE_PADDING)、标题块样式(TITLE_STYLE)、段落样式(paraStyle)
 * 都在这里定义一次,PaginatedReader 渲染和这里的测量共用同一份。
 */

import type { CSSProperties } from 'react';

/** 一页里的一个文本片段。continuation=true 表示它是上一页某段被切断后的续文。 */
export interface PageSegment {
  text: string;
  continuation: boolean;
}

/** 页内边距(px):上边让开进度条,下边让开页码。 */
export const PAGE_PADDING = { x: 20, top: 24, bottom: 36 } as const;

export const LINE_HEIGHT = 1.8;

/** 每章第一页顶部的标题块。测量和渲染共用,改这里两边一起变。 */
export const TITLE_STYLE: Record<'wrap' | 'title' | 'meta', CSSProperties> = {
  wrap: { marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px dashed transparent' },
  title: { margin: '0', fontSize: '1.3em', lineHeight: '1.35', fontWeight: 500, wordBreak: 'break-all' },
  meta: { marginTop: '4px', fontSize: '13px', lineHeight: '1.5', display: 'flex', flexWrap: 'wrap', columnGap: '16px' },
};
/** wrap 的 marginBottom,getBoundingClientRect 不含 margin,要单独加 */
const TITLE_MARGIN_BOTTOM = 16;

/** 段落样式:首段不留上边距(与页顶齐平),续文不缩进 */
export function paraStyle(first: boolean, continuation: boolean): CSSProperties {
  return {
    margin: '0',
    marginTop: first ? '0' : '0.8em',
    textAlign: 'justify',
    overflowWrap: 'anywhere',
    textIndent: continuation ? '0' : '2em',
  };
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
  /** 整页尺寸(含 PAGE_PADDING) */
  pageWidth: number;
  pageHeight: number;
  fontFamily: string;
  /** px */
  fontSize: number;
  /** 第一页顶部标题块高度(px),见 measureTitleHeight */
  titleReserve?: number;
  /** 离屏测量节点挂在哪:传阅读容器,继承到的字体设置(letter-spacing 等)才和真实渲染一致 */
  mountIn?: HTMLElement | null;
}

function applyStyle(el: HTMLElement, style: CSSProperties) {
  Object.assign(el.style, style);
}

function makeHost(mountIn: HTMLElement | null | undefined, width: number, fontFamily: string, fontSize: number) {
  const host = document.createElement('div');
  applyStyle(host, {
    position: 'absolute', visibility: 'hidden', pointerEvents: 'none', left: '-99999px', top: '0',
    width: `${width}px`, boxSizing: 'border-box', fontFamily, fontSize: `${fontSize}px`, lineHeight: String(LINE_HEIGHT),
  });
  (mountIn ?? document.body).appendChild(host);
  return host;
}

export function paginateChapter(opts: PaginateOptions): PageSegment[][] {
  const { paragraphs, pageWidth, pageHeight, fontFamily, fontSize, titleReserve = 0, mountIn } = opts;
  if (paragraphs.length === 0) return [[]];
  const contentWidth = pageWidth - PAGE_PADDING.x * 2;
  const contentHeight = pageHeight - PAGE_PADDING.top - PAGE_PADDING.bottom;
  // SSR 期没有 DOM / 尺寸还没量出来:单页兜底
  if (contentWidth <= 0 || contentHeight <= 0 || typeof document === 'undefined') {
    return [paragraphs.map((text) => ({ text, continuation: false }))];
  }

  const host = makeHost(mountIn, contentWidth, fontFamily, fontSize);
  const pageEl = document.createElement('div');
  // display:flow-root 防止首段 margin 穿透出去导致高度读小
  applyStyle(pageEl, { width: `${contentWidth}px`, boxSizing: 'border-box', display: 'flow-root' });
  host.appendChild(pageEl);

  const addPara = (text: string, continuation: boolean) => {
    const el = document.createElement('p');
    applyStyle(el, paraStyle(pageEl.childElementCount === 0, continuation));
    el.textContent = text;
    pageEl.appendChild(el);
    return el;
  };

  const pages: PageSegment[][] = [];
  let current: PageSegment[] = [];
  let limit = contentHeight - titleReserve; // 第一页要给标题块让位
  const fits = () => pageEl.getBoundingClientRect().height <= limit + 0.5;
  const newPage = () => {
    pages.push(current);
    current = [];
    pageEl.textContent = '';
    limit = contentHeight;
  };

  for (const para of paragraphs) {
    let text = para;
    let continuation = false;
    while (text.length > 0) {
      const el = addPara(text, continuation);
      if (fits()) {
        current.push({ text, continuation });
        break;
      }
      pageEl.removeChild(el);
      // 二分找能塞下的最长前缀
      let lo = 0;
      let hi = text.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        const probe = addPara(text.slice(0, mid), continuation);
        const ok = fits();
        pageEl.removeChild(probe);
        if (ok) lo = mid;
        else hi = mid - 1;
      }
      if (lo === 0) {
        if (current.length > 0) {
          // 本页已有内容,剩余空间连一个字都放不下:换页再试
          newPage();
          continue;
        }
        // 空页也放不下一个字(字号大到离谱):硬塞一个字,防死循环
        lo = 1;
      }
      current.push({ text: text.slice(0, lo), continuation });
      text = text.slice(lo);
      continuation = true;
      newPage();
    }
  }
  if (current.length > 0) pages.push(current);

  host.remove();
  return pages.length ? pages : [[]];
}

/** 量标题块在给定宽度/字号下占的高度(含下边距),分页时给首页扣掉 */
export function measureTitleHeight(opts: {
  pageWidth: number;
  fontFamily: string;
  fontSize: number;
  chapterTitle: string;
  bookTitle?: string;
  author?: string;
  mountIn?: HTMLElement | null;
}): number {
  const { pageWidth, fontFamily, fontSize, chapterTitle, bookTitle, author, mountIn } = opts;
  const contentWidth = pageWidth - PAGE_PADDING.x * 2;
  if (contentWidth <= 0 || typeof document === 'undefined') return 0;
  const host = makeHost(mountIn, contentWidth, fontFamily, fontSize);
  const wrap = document.createElement('div');
  applyStyle(wrap, TITLE_STYLE.wrap);
  const h1 = document.createElement('h1');
  applyStyle(h1, TITLE_STYLE.title);
  h1.textContent = chapterTitle;
  wrap.appendChild(h1);
  if (bookTitle || author) {
    const meta = document.createElement('div');
    applyStyle(meta, TITLE_STYLE.meta);
    for (const s of [bookTitle, author]) {
      if (!s) continue;
      const span = document.createElement('span');
      span.textContent = s;
      meta.appendChild(span);
    }
    wrap.appendChild(meta);
  }
  host.appendChild(wrap);
  const h = wrap.getBoundingClientRect().height;
  host.remove();
  return Math.ceil(h) + TITLE_MARGIN_BOTTOM;
}
