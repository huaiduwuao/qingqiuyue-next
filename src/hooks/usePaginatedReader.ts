'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ContentItem } from '@/hooks/useContentItems';
import {
  paginateChapter,
  measureTitleHeight,
  pageOfPosition,
  type PageSegment,
} from '@/components/novel-reader/pagination';
import {
  CHAPTER_STALE_MS,
  chapterQueryKey,
  extractParagraphs,
  splitParagraphs,
  type FetchChapterBody,
} from '@/components/novel-reader/chapterText';

/** 整章给不出正文时的提示:付费未解锁 / 正文拉取失败(可重试) */
export type ChapterNotice = 'locked' | 'error';

export interface ReaderPage {
  chapterIdx: number;
  pageIdx: number;
  segments: PageSegment[];
  ready: boolean;
  notice?: ChapterNotice;
}

/** 跨章往回翻时还不知道上一章有几页:先给这个值,排版完成后被夹到末页 */
export const LAST_PAGE = Number.MAX_SAFE_INTEGER;

/** 窗口拖动 / 地址栏伸缩时 ResizeObserver 每帧都报,停下来这么久才重排 */
const RESIZE_DEBOUNCE_MS = 150;

/** 有提示的章节只占一页(没有正文可排) */
const NOTICE_PAGES: PageSegment[][] = [[]];

/** 排版实现,测试时可以换掉(jsdom 量不出真实高度) */
export interface LayoutEngine {
  paginate: typeof paginateChapter;
  measureTitle: typeof measureTitleHeight;
}
const DEFAULT_ENGINE: LayoutEngine = { paginate: paginateChapter, measureTitle: measureTitleHeight };

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
  /** 章内页码被纠正(越界 / LAST_PAGE / 重排后找回原位置)时回调 */
  onPageChange: (page: number) => void;
  onChapterChange: (chapterIdx: number, page: number) => void;
  layoutEngine?: LayoutEngine;
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
  /** 正文拉取失败的章节重新拉 */
  retry: (chapterIdx: number) => void;
}

/** 排版结果:只保留当前尺寸 / 字体(suffix)下的,换尺寸就整批作废 */
interface Layouts {
  suffix: string;
  byChapter: ReadonlyMap<string, PageSegment[][]>;
}

/** 当前读到的位置:换尺寸 / 字号后按 (para, offset) 找回同一段文字 */
interface Anchor {
  chapterId: string;
  suffix: string;
  page: number;
  para: number;
  offset: number;
}

/**
 * 页级阅读器状态机。
 *
 *  1) 量容器尺寸(ResizeObserver,旋转屏 / 改窗口会重排;连续变化时防抖)
 *  2) 当前章 + 前后两章:拉正文(与滚动模式共用 react-query 缓存)→ 排版,
 *     结果按「尺寸 + 字体」整批缓存,换尺寸就丢掉旧的
 *  3) 由缓存直接算出 prev / current / next 三页 —— 不存派生状态,
 *     切章瞬间也不会拿上一章的页去渲染
 *  4) 页码越界(URL 带来的、LAST_PAGE)→ onPageChange 纠正;
 *     重排后按重排前的阅读位置找回页码,而不是停在同一个页号上
 */
export function usePaginatedReader(opts: UsePaginatedReaderOpts): UsePaginatedReaderResult {
  const {
    chapter, chapterIdx, pageIdx, chapters, fetchBody, fontSize, fontFamily, containerRef, bookTitle, author,
    onPageChange, onChapterChange, layoutEngine = DEFAULT_ENGINE,
  } = opts;
  const active = chapterIdx != null && !!chapter;
  const queryClient = useQueryClient();

  const [size, setSize] = useState({ w: 0, h: 0 });
  const suffix = `${size.w}x${size.h}|${fontSize}|${fontFamily}|${bookTitle ?? ''}|${author ?? ''}`;
  // 异步排版回来时对照「现在的」尺寸 / 字体,过期的结果直接丢
  const suffixRef = useRef(suffix);
  useEffect(() => {
    suffixRef.current = suffix;
  }, [suffix]);
  const [layouts, setLayouts] = useState<Layouts>(() => ({ suffix: '', byChapter: new Map() }));
  const layoutsRef = useRef(layouts);
  // 章节级提示(与尺寸无关):付费未解锁 / 拉取失败。失败的不缓存正文,retry 清掉后重拉
  const [notices, setNotices] = useState<ReadonlyMap<string, ChapterNotice>>(() => new Map());
  // 正在排版的「章 id + suffix」,避免同一章被并发排两遍
  const inflight = useRef(new Set<string>());
  const [anchor, setAnchor] = useState<Anchor | null>(null);

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
    // 首次立即量;之后的变化(拖窗口、移动端地址栏伸缩)等停下来再重排,
    // 否则每一帧都要同步排三章
    measure();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, RESIZE_DEBOUNCE_MS);
    });
    ro.observe(el);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [active, containerRef]);

  const pagesOf = (idx: number): PageSegment[][] | undefined => {
    const c = chapters[idx];
    if (!c) return undefined;
    if (notices.has(c.id)) return NOTICE_PAGES;
    return layouts.suffix === suffix ? layouts.byChapter.get(c.id) : undefined;
  };
  const noticeOf = (idx: number): ChapterNotice | undefined => {
    const c = chapters[idx];
    return c ? notices.get(c.id) : undefined;
  };

  // ── 2. 排版当前章和相邻两章 ─────────────────────────────────────
  useEffect(() => {
    if (!active || chapterIdx == null || size.w <= 0 || size.h <= 0) return;
    let cancelled = false;
    const layoutSuffix = suffix;
    const setNotice = (id: string, n: ChapterNotice) =>
      setNotices((m) => (m.get(id) === n ? m : new Map(m).set(id, n)));
    const ensure = async (idx: number) => {
      const c = chapters[idx];
      if (!c || notices.has(c.id)) return;
      const cur = layoutsRef.current;
      if (cur.suffix === layoutSuffix && cur.byChapter.has(c.id)) return;
      const key = `${c.id}|${layoutSuffix}`;
      if (inflight.current.has(key)) return;
      inflight.current.add(key);
      try {
        let paras: string[];
        if (c.content) paras = extractParagraphs(c.content);
        else if (c.locked) return setNotice(c.id, 'locked');
        else {
          try {
            const body = await queryClient.ensureQueryData({
              queryKey: chapterQueryKey(c.id),
              queryFn: () => fetchBody(c.id),
              staleTime: CHAPTER_STALE_MS,
            });
            if (body?.locked) return setNotice(c.id, 'locked');
            paras = splitParagraphs(body?.content || body?.body || '');
          } catch {
            // 拉取失败不缓存成「本章无正文」,标记出错,由页面给重试按钮
            return setNotice(c.id, 'error');
          }
        }
        // 注意:这里不看 cancelled。排版结果只和「章 + 尺寸 + 字体」有关,跟是哪次 effect
        // 发起的无关;要是丢掉,正好在等这一章的新 effect 因为 inflight 已经跳过了它,
        // 页面就会一直停在「正在加载…」(预取上一章时按 ← 就能复现)。
        // 只有尺寸 / 字体已经变了,这份结果才没人要。
        if (suffixRef.current !== layoutSuffix) return;
        const mountIn = containerRef.current;
        const titleReserve = layoutEngine.measureTitle({
          pageWidth: size.w, fontFamily, fontSize,
          chapterTitle: c.title || `第 ${idx + 1} 章`,
          bookTitle, author, mountIn,
        });
        const pages = layoutEngine.paginate({
          paragraphs: paras, pageWidth: size.w, pageHeight: size.h, fontFamily, fontSize, titleReserve, mountIn,
        });
        const prev = layoutsRef.current;
        const byChapter = new Map(prev.suffix === layoutSuffix ? prev.byChapter : undefined).set(c.id, pages);
        layoutsRef.current = { suffix: layoutSuffix, byChapter };
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
    // suffix 已经涵盖 size / 字体 / 书名作者
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, chapterIdx, chapters, suffix, notices, fetchBody, containerRef, queryClient, layoutEngine]);

  const curPages = active && chapterIdx != null ? pagesOf(chapterIdx) : undefined;
  const pageCount = curPages?.length ?? 0;
  const clamped = pageCount > 0 ? Math.min(Math.max(0, pageIdx), pageCount - 1) : Math.max(0, Math.min(pageIdx, LAST_PAGE));

  // 换了尺寸 / 字号,当前章刚按新参数排好:按重排前的阅读位置找页,而不是沿用旧页号
  const relocateTo =
    curPages && chapter && anchor && anchor.chapterId === chapter.id && anchor.suffix !== suffix
      ? pageOfPosition(curPages, anchor.para, anchor.offset)
      : null;
  const shown = relocateTo ?? clamped;

  // ── 3. 页码纠正 + 记录阅读位置 ───────────────────────────────────
  useEffect(() => {
    if (!curPages || !chapter) return;
    if (relocateTo != null) {
      // 位置本身不变(重复换尺寸也不会一点点往前漂),只换到新的排版
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 排版结果到了才知道新页码
      setAnchor((a) => (a ? { ...a, suffix, page: relocateTo } : a));
      if (relocateTo !== pageIdx) onPageChange(relocateTo);
      return;
    }
    if (clamped !== pageIdx) {
      onPageChange(clamped);
      return;
    }
    if (anchor && anchor.chapterId === chapter.id && anchor.suffix === suffix && anchor.page === clamped) return;
    const first = curPages[clamped]?.[0];
    setAnchor({ chapterId: chapter.id, suffix, page: clamped, para: first?.para ?? 0, offset: first?.offset ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPageChange 是父组件内联函数
  }, [curPages, chapter, suffix, relocateTo, clamped, pageIdx, anchor]);

  // ── 4. 三页窗口(纯派生) ─────────────────────────────────────────
  const ci = chapterIdx ?? 0;
  const current: ReaderPage = {
    chapterIdx: ci,
    pageIdx: shown,
    segments: curPages?.[shown] ?? [],
    ready: !!curPages,
    notice: noticeOf(ci),
  };

  let prev: ReaderPage | null = null;
  let next: ReaderPage | null = null;
  if (active && curPages) {
    if (shown > 0) {
      prev = { chapterIdx: ci, pageIdx: shown - 1, segments: curPages[shown - 1], ready: true };
    } else if (ci > 0) {
      const p = pagesOf(ci - 1);
      prev = p
        ? { chapterIdx: ci - 1, pageIdx: p.length - 1, segments: p[p.length - 1], ready: true, notice: noticeOf(ci - 1) }
        : { chapterIdx: ci - 1, pageIdx: LAST_PAGE, segments: [], ready: false };
    }
    if (shown < curPages.length - 1) {
      next = { chapterIdx: ci, pageIdx: shown + 1, segments: curPages[shown + 1], ready: true };
    } else if (ci < chapters.length - 1) {
      const p = pagesOf(ci + 1);
      next = { chapterIdx: ci + 1, pageIdx: 0, segments: p?.[0] ?? [], ready: !!p, notice: noticeOf(ci + 1) };
    }
  }

  // ── 5. 翻页动作 ─────────────────────────────────────────────────
  const goToPage = useCallback((p: number) => {
    if (chapterIdx == null || pageCount === 0) return;
    const target = Math.min(Math.max(0, p), pageCount - 1);
    if (target !== shown) onChapterChange(chapterIdx, target);
  }, [chapterIdx, pageCount, shown, onChapterChange]);

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

  const retry = useCallback((idx: number) => {
    const c = chapters[idx];
    if (!c) return;
    setNotices((m) => {
      if (m.get(c.id) !== 'error') return m;
      const n = new Map(m);
      n.delete(c.id);
      return n;
    });
  }, [chapters]);

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
    retry,
  };
}
