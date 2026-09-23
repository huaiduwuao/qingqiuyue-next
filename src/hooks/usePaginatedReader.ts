'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ContentItem } from '@/hooks/useContentItems';
import {
  splitParagraphs,
  paginateChapter,
  measureTitleHeight,
  type PageSegment,
  type FetchChapterBody,
} from '@/components/novel-reader/pagination';

export interface ReaderPage {
  chapterIdx: number;
  pageIdx: number;
  segments: PageSegment[];
  ready: boolean;
}

/** 跨章往回翻时还不知道上一章有几页:先给这个值,排版完成后被夹到末页 */
export const LAST_PAGE = Number.MAX_SAFE_INTEGER;

interface UsePaginatedReaderOpts {
  chapter: ContentItem | null;
  /** null = 不在分页阅读态(scroll 模式 / 详情态) */
  chapterIdx: number | null;
  pageIdx: number;
  chapters: ContentItem[];
  fetchBody: FetchChapterBody;
  fontSize: number;
  fontFamily: string;
  containerRef: React.RefObject<HTMLElement | null>;
  bookTitle?: string;
  author?: string;
  /** 章内页码被纠正(越界 / LAST_PAGE)时回调 */
  onPageChange: (page: number) => void;
  onChapterChange: (chapterIdx: number, page: number) => void;
}

export interface UsePaginatedReaderResult {
  prev: ReaderPage | null;
  current: ReaderPage;
  next: ReaderPage | null;
  /** 当前章的总页数(未排好时为 0) */
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  goNext: () => void;
  goPrev: () => void;
  goToPage: (p: number) => void;
}

/**
 * 从 chapter.content 提取段落数组。两种格式:
 *  1. JSON 字符串:`{"chapters":[{"body":"..."}, ...]}` —— legacy 整本存一行的书
 *  2. 普通正文:换行分段
 */
function extractParagraphs(content: string): string[] {
  const s = content.trim();
  if (s.startsWith('{') && s.includes('"chapters"')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed?.chapters)) {
        return parsed.chapters
          .map((c: { body?: string }) => (typeof c?.body === 'string' ? c.body : ''))
          .filter(Boolean)
          .flatMap(splitParagraphs);
      }
    } catch {
      // JSON 解析失败,降级为普通正文
    }
  }
  return splitParagraphs(content);
}

/**
 * 页级阅读器状态机。
 *
 *  1) 量容器尺寸(ResizeObserver,旋转屏 / 改窗口会重排)
 *  2) 当前章 + 前后两章:拉正文 → 排版,结果按「章 id + 尺寸 + 字体」缓存
 *  3) 由缓存直接算出 prev / current / next 三页 —— 不存派生状态,
 *     切章瞬间也不会拿上一章的页去渲染
 *  4) 页码越界(URL 带来的、LAST_PAGE)→ onPageChange 纠正
 */
export function usePaginatedReader(opts: UsePaginatedReaderOpts): UsePaginatedReaderResult {
  const { chapter, chapterIdx, pageIdx, chapters, fetchBody, fontSize, fontFamily, containerRef, bookTitle, author, onPageChange, onChapterChange } = opts;
  const active = chapterIdx != null && !!chapter;

  const [size, setSize] = useState({ w: 0, h: 0 });
  // 排版结果:key = 章 id + 尺寸 + 字体(见 layoutKey)
  const [layouts, setLayouts] = useState<ReadonlyMap<string, PageSegment[][]>>(() => new Map());
  const layoutsRef = useRef(layouts);
  const parasCache = useRef(new Map<string, string[]>());
  const inflight = useRef(new Set<string>());
  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  // ── 1. 容器尺寸 ────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!active || !el) {
      setSize((s) => (s.w === 0 && s.h === 0 ? s : { w: 0, h: 0 }));
      return;
    }
    const measure = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, containerRef]);

  const layoutKey = useCallback(
    (c: ContentItem) => `${c.id}|${size.w}x${size.h}|${fontSize}|${fontFamily}|${bookTitle ?? ''}|${author ?? ''}`,
    [size.w, size.h, fontSize, fontFamily, bookTitle, author],
  );
  const pagesOf = (idx: number): PageSegment[][] | undefined => {
    const c = chapters[idx];
    return c ? layouts.get(layoutKey(c)) : undefined;
  };

  // ── 2. 排版当前章和相邻两章 ─────────────────────────────────────
  useEffect(() => {
    if (!active || chapterIdx == null || size.w <= 0 || size.h <= 0) return;
    let cancelled = false;
    const ensure = async (idx: number) => {
      const c = chapters[idx];
      if (!c) return;
      const key = layoutKey(c);
      if (layoutsRef.current.has(key) || inflight.current.has(key)) return;
      inflight.current.add(key);
      try {
        let paras = parasCache.current.get(c.id);
        if (!paras) {
          if (c.content) paras = extractParagraphs(c.content);
          else if (c.locked) paras = [];
          else {
            try {
              const body = await fetchBody(c.id);
              paras = splitParagraphs(body.content || body.body || '');
            } catch {
              paras = [];
            }
          }
          parasCache.current.set(c.id, paras);
        }
        if (cancelled) return;
        const mountIn = containerRef.current;
        const titleReserve = measureTitleHeight({
          pageWidth: size.w, fontFamily, fontSize,
          chapterTitle: c.title || `第 ${idx + 1} 章`,
          bookTitle, author, mountIn,
        });
        const pages = paginateChapter({
          paragraphs: paras, pageWidth: size.w, pageHeight: size.h, fontFamily, fontSize, titleReserve, mountIn,
        });
        layoutsRef.current = new Map(layoutsRef.current).set(key, pages);
        setLayouts(layoutsRef.current);
      } finally {
        inflight.current.delete(key);
      }
    };
    // 当前章先排,相邻章随后预排
    void ensure(chapterIdx).then(() => {
      if (cancelled) return;
      void ensure(chapterIdx + 1);
      void ensure(chapterIdx - 1);
    });
    return () => { cancelled = true; };
  }, [active, chapterIdx, chapters, size.w, size.h, fontFamily, fontSize, bookTitle, author, layoutKey, fetchBody, containerRef]);

  const curPages = active && chapterIdx != null ? pagesOf(chapterIdx) : undefined;
  const pageCount = curPages?.length ?? 0;
  const clamped = pageCount > 0 ? Math.min(Math.max(0, pageIdx), pageCount - 1) : Math.max(0, Math.min(pageIdx, LAST_PAGE));

  // ── 3. 页码纠正 ─────────────────────────────────────────────────
  useEffect(() => {
    if (pageCount > 0 && clamped !== pageIdx) onPageChange(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPageChange 是父组件内联函数
  }, [pageCount, clamped, pageIdx]);

  // ── 4. 三页窗口(纯派生) ─────────────────────────────────────────
  const ci = chapterIdx ?? 0;
  const current: ReaderPage = {
    chapterIdx: ci,
    pageIdx: clamped,
    segments: curPages?.[clamped] ?? [],
    ready: !!curPages,
  };

  let prev: ReaderPage | null = null;
  let next: ReaderPage | null = null;
  if (active && curPages) {
    if (clamped > 0) {
      prev = { chapterIdx: ci, pageIdx: clamped - 1, segments: curPages[clamped - 1], ready: true };
    } else if (ci > 0) {
      const p = pagesOf(ci - 1);
      prev = p
        ? { chapterIdx: ci - 1, pageIdx: p.length - 1, segments: p[p.length - 1], ready: true }
        : { chapterIdx: ci - 1, pageIdx: LAST_PAGE, segments: [], ready: false };
    }
    if (clamped < curPages.length - 1) {
      next = { chapterIdx: ci, pageIdx: clamped + 1, segments: curPages[clamped + 1], ready: true };
    } else if (ci < chapters.length - 1) {
      const p = pagesOf(ci + 1);
      next = { chapterIdx: ci + 1, pageIdx: 0, segments: p?.[0] ?? [], ready: !!p };
    }
  }

  // ── 5. 翻页动作 ─────────────────────────────────────────────────
  const goToPage = useCallback((p: number) => {
    if (chapterIdx == null || pageCount === 0) return;
    const target = Math.min(Math.max(0, p), pageCount - 1);
    if (target !== clamped) onChapterChange(chapterIdx, target);
  }, [chapterIdx, pageCount, clamped, onChapterChange]);

  const nextCi = next?.chapterIdx ?? -1;
  const nextPi = next?.pageIdx ?? -1;
  const prevCi = prev?.chapterIdx ?? -1;
  const prevPi = prev?.pageIdx ?? -1;
  const goNext = useCallback(() => {
    if (nextCi >= 0) onChapterChange(nextCi, nextPi);
  }, [nextCi, nextPi, onChapterChange]);
  const goPrev = useCallback(() => {
    if (prevCi >= 0) onChapterChange(prevCi, prevPi);
  }, [prevCi, prevPi, onChapterChange]);

  return {
    prev,
    current,
    next,
    pageCount,
    pageWidth: size.w,
    pageHeight: size.h,
    goNext,
    goPrev,
    goToPage,
  };
}
