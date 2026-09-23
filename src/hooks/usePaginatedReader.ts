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

interface UsePaginatedReaderOpts {
  chapter: ContentItem | null;
  chapterIdx: number | null;
  pageIdx: number;
  chapters: ContentItem[];
  fetchBody: FetchChapterBody;
  fontSize: number;
  fontFamily: string;
  containerRef: React.RefObject<HTMLElement | null>;
  bookTitle?: string;
  author?: string;
  onPageChange: (page: number) => void;
  onChapterChange: (chapterIdx: number, page: number) => void;
}

export interface UsePaginatedReaderResult {
  prev: ReaderPage | null;
  current: ReaderPage;
  next: ReaderPage | null;
  /** 当前章节的所有页;flipbook 模式需要整章传入 */
  allPages: PageSegment[][];
  pageWidth: number;
  pageHeight: number;
  goNext: () => void;
  goPrev: () => void;
  goToPage: (p: number) => void;
  prevLoading: boolean;
  nextLoading: boolean;
}

/** 跨页用文字兜底 */
const FALLBACK_PARAGRAPHS = (text: string) => [[{ text, continuation: false }]];

/**
 * 从 chapter.content 提取段落数组。两种格式:
 *  1. JSON 字符串:`{"chapters":[{"body":"..."}, ...]}` —— 解出每章 body 拼成一个数组
 *  2. 普通正文:换行分段
 *
 * JSON 检测:`trim().startsWith('{')` 且包含 `"chapters"` 字段。
 * legacy 章节(content 是章节 JSON)走这条;新章节(API 直接返回正文)走另一条。
 */
function extractParagraphs(content: string): string[] {
  const s = content.trim();
  if (s.startsWith('{') && s.includes('"chapters"')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed?.chapters)) {
        return parsed.chapters
          .map((c: { body?: string }) => typeof c?.body === 'string' ? c.body : '')
          .filter(Boolean);
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
 * 职责:
 *  1) 锁容器尺寸(进阅读态时)
 *  2) 拉当前章正文 → 切段落 → 测标题块高度 → paginateChapter 切页
 *  3) 维护三页窗口 prev/next;跨章异步预排版
 *  4) 章末越界 → onChapterChange 切章
 *
 * UI 拿 ReaderPage.segments + allPages 自行决定怎么渲染。
 */
export function usePaginatedReader(opts: UsePaginatedReaderOpts): UsePaginatedReaderResult {
  const { chapter, chapterIdx, pageIdx, chapters, fetchBody, fontSize, fontFamily, containerRef, bookTitle, author, onPageChange, onChapterChange } = opts;

  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [currentParagraphs, setCurrentParagraphs] = useState<string[]>([]);
  const [currentPages, setCurrentPages] = useState<PageSegment[][]>([]);
  const [currentReady, setCurrentReady] = useState(false);

  const [prevPage, setPrevPage] = useState<ReaderPage | null>(null);
  const [prevLoading, setPrevLoading] = useState(false);
  const [nextPage, setNextPage] = useState<ReaderPage | null>(null);
  const [nextLoading, setNextLoading] = useState(false);

  // 章节段落缓存(全局共享)
  const paragraphsCache = useRef<Map<string, string[]>>(new Map());

  // ── 1. 容器尺寸锁死 ────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (chapterIdx == null) {
      el.style.removeProperty('--page-width');
      el.style.removeProperty('--page-height');
      setPageWidth(0);
      setPageHeight(0);
      return;
    }
    const w = Math.round(el.clientWidth);
    const h = Math.round(el.clientHeight);
    el.style.setProperty('--page-width', `${w}px`);
    el.style.setProperty('--page-height', `${h}px`);
    setPageWidth(w);
    setPageHeight(h);
  }, [chapterIdx, containerRef]);

  // ── 2. 拉当前章正文 ─────────────────────────────────────────────
  useEffect(() => {
    if (chapterIdx == null || !chapter) {
      setCurrentReady(false);
      return;
    }
    const cached = paragraphsCache.current.get(chapter.id);
    if (cached) {
      setCurrentParagraphs(cached);
      setCurrentReady(true);
      return;
    }
    if (chapter.content) {
      const p = extractParagraphs(chapter.content);
      paragraphsCache.current.set(chapter.id, p);
      setCurrentParagraphs(p);
      setCurrentReady(true);
      return;
    }
    if (chapter.locked) {
      paragraphsCache.current.set(chapter.id, []);
      setCurrentParagraphs([]);
      setCurrentReady(true);
      return;
    }
    let cancelled = false;
    setCurrentReady(false);
    fetchBody(chapter.id).then((body) => {
      if (cancelled) return;
      const text = body.content || body.body || '';
      const p = splitParagraphs(text);
      paragraphsCache.current.set(chapter.id, p);
      setCurrentParagraphs(p);
      setCurrentReady(true);
    }).catch(() => {
      if (cancelled) return;
      paragraphsCache.current.set(chapter.id, []);
      setCurrentParagraphs([]);
      setCurrentReady(true);
    });
    return () => { cancelled = true; };
  }, [chapter, chapterIdx, fetchBody, paragraphsCache]);

  // ── 3. 排版算 currentPages ──────────────────────────────────────
  useEffect(() => {
    if (!currentReady || pageWidth <= 0 || pageHeight <= 0 || !chapter) {
      return;
    }
    if (currentParagraphs.length === 0) {
      setCurrentPages([[]]);
      return;
    }
    const titleReserve = measureTitleHeight({
      pageWidth,
      fontFamily,
      fontSize: `${fontSize}px`,
      chapterTitle: chapter.title || `第 ${(chapterIdx ?? 0) + 1} 章`,
      bookTitle,
      author,
      wordCount: currentParagraphs.reduce((a, s) => a + s.length, 0),
    });
    const pages = paginateChapter({
      paragraphs: currentParagraphs,
      pageWidth,
      pageHeight,
      fontFamily,
      fontSize: `${fontSize}px`,
      titleReserve: pageIdx === 0 ? titleReserve : 0,
    });
    setCurrentPages(pages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentReady, currentParagraphs, pageWidth, pageHeight, fontFamily, fontSize, chapter?.id]);

  // ── 4. clamp pageIdx + 通知父组件 ──────────────────────────────
  useEffect(() => {
    if (!currentReady) return;
    const total = Math.max(1, currentPages.length);
    const clamped = Math.min(Math.max(0, pageIdx), total - 1);
    if (clamped !== pageIdx && chapterIdx != null) {
      onChapterChange(chapterIdx, clamped);
    }
    onPageChange(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentReady, currentPages.length, pageIdx]);

  // ── 5. fillPrev / fillNext ───────────────────────────────────────
  useEffect(() => {
    if (!currentReady || chapterIdx == null) {
      setPrevPage(null);
      setNextPage(null);
      return;
    }
    const cur = chapters[chapterIdx];
    if (!cur) return;

    if (pageIdx > 0) {
      setPrevPage({
        chapterIdx,
        pageIdx: pageIdx - 1,
        segments: currentPages[pageIdx - 1] ?? [],
        ready: true,
      });
      setPrevLoading(false);
    } else if (chapterIdx > 0) {
      const prevCh = chapters[chapterIdx - 1];
      if (!prevCh) {
        setPrevPage(null);
        setPrevLoading(false);
      } else {
        setPrevPage({ chapterIdx: chapterIdx - 1, pageIdx: 0, segments: [], ready: false });
        setPrevLoading(true);
        scheduleCrossChapterLayout({
          chapter: prevCh,
          chapterIdx: chapterIdx - 1,
          pageWidth, pageHeight, fontFamily, fontSize,
          paragraphsCache: paragraphsCache.current,
          fetchBody, bookTitle, author,
          setLoading: setPrevLoading,
          onReady: (pages) => {
            setPrevPage({
              chapterIdx: chapterIdx - 1,
              pageIdx: Math.max(0, pages.length - 1),
              segments: pages[pages.length - 1] ?? [],
              ready: true,
            });
          },
        });
      }
    } else {
      setPrevPage(null);
      setPrevLoading(false);
    }

    if (pageIdx < currentPages.length - 1) {
      setNextPage({
        chapterIdx,
        pageIdx: pageIdx + 1,
        segments: currentPages[pageIdx + 1] ?? [],
        ready: true,
      });
      setNextLoading(false);
    } else if (chapterIdx < chapters.length - 1) {
      const nextCh = chapters[chapterIdx + 1];
      if (!nextCh) {
        setNextPage(null);
        setNextLoading(false);
      } else {
        setNextPage({ chapterIdx: chapterIdx + 1, pageIdx: 0, segments: [], ready: false });
        setNextLoading(true);
        scheduleCrossChapterLayout({
          chapter: nextCh,
          chapterIdx: chapterIdx + 1,
          pageWidth, pageHeight, fontFamily, fontSize,
          paragraphsCache: paragraphsCache.current,
          fetchBody, bookTitle, author,
          setLoading: setNextLoading,
          onReady: (pages) => {
            setNextPage({
              chapterIdx: chapterIdx + 1,
              pageIdx: 0,
              segments: pages[0] ?? [],
              ready: true,
            });
          },
        });
      }
    } else {
      setNextPage(null);
      setNextLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentReady, chapterIdx, currentPages.length, pageIdx, chapters]);

  // ── 6. goNext / goPrev / goToPage ───────────────────────────────
  const goToPage = useCallback((p: number) => {
    if (!currentReady || chapterIdx == null) return;
    const total = Math.max(1, currentPages.length);
    const clamped = Math.min(Math.max(0, p), total - 1);
    if (clamped === pageIdx) return;
    onChapterChange(chapterIdx, clamped);
  }, [currentReady, currentPages.length, chapterIdx, pageIdx, onChapterChange]);

  const goNext = useCallback(() => {
    if (!currentReady || chapterIdx == null) return;
    if (pageIdx + 1 < currentPages.length) {
      goToPage(pageIdx + 1);
      return;
    }
    if (chapterIdx + 1 < chapters.length) onChapterChange(chapterIdx + 1, 0);
  }, [currentReady, pageIdx, currentPages.length, chapterIdx, chapters.length, goToPage, onChapterChange]);

  const goPrev = useCallback(() => {
    if (!currentReady || chapterIdx == null) return;
    if (pageIdx - 1 >= 0) return goToPage(pageIdx - 1);
    if (chapterIdx > 0) onChapterChange(chapterIdx - 1, 0);
  }, [currentReady, pageIdx, chapterIdx, goToPage, onChapterChange]);

  return {
    prev: prevPage,
    current: {
      chapterIdx: chapterIdx ?? 0,
      pageIdx,
      segments: currentPages[pageIdx] ?? [],
      ready: currentReady,
    },
    next: nextPage,
    allPages: currentPages,
    pageWidth,
    pageHeight,
    goNext,
    goPrev,
    goToPage,
    prevLoading,
    nextLoading,
  };
}

/** 跨章异步拉正文 + 排版 */
function scheduleCrossChapterLayout(args: {
  chapter: ContentItem;
  chapterIdx: number;
  pageWidth: number;
  pageHeight: number;
  fontFamily: string;
  fontSize: number;
  paragraphsCache: Map<string, string[]>;
  fetchBody: FetchChapterBody;
  bookTitle?: string;
  author?: string;
  setLoading: (b: boolean) => void;
  onReady: (pages: PageSegment[][]) => void;
}) {
  const { chapter, chapterIdx, pageWidth, pageHeight, fontFamily, fontSize, paragraphsCache, fetchBody, bookTitle, author, setLoading, onReady } = args;
  if (pageWidth <= 0 || pageHeight <= 0) return;

  const run = async () => {
    try {
      let paras = paragraphsCache.get(chapter.id);
      if (!paras) {
        if (chapter.content) {
          paras = extractParagraphs(chapter.content);
        } else if (chapter.locked) {
          paras = [];
        } else {
          const body = await fetchBody(chapter.id);
          paras = splitParagraphs(body.content || body.body || '');
        }
        paragraphsCache.set(chapter.id, paras);
      }
      const titleReserve = measureTitleHeight({
        pageWidth,
        fontFamily,
        fontSize: `${fontSize}px`,
        chapterTitle: chapter.title || `第 ${chapterIdx + 1} 章`,
        bookTitle,
        author,
        wordCount: paras.reduce((a, s) => a + s.length, 0),
      });
      const pages = paginateChapter({
        paragraphs: paras,
        pageWidth,
        pageHeight,
        fontFamily,
        fontSize: `${fontSize}px`,
        titleReserve,
      });
      onReady(pages);
    } catch {
      onReady(FALLBACK_PARAGRAPHS(''));
    } finally {
      setLoading(false);
    }
  };
  void run();
}