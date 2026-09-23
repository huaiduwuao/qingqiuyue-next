import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LAST_PAGE, usePaginatedReader, type LayoutEngine } from './usePaginatedReader';
import type { ContentItem } from './useContentItems';
import type { ChapterBody } from '@/components/novel-reader/chapterText';
import type { PageSegment } from '@/components/novel-reader/pagination';

/**
 * jsdom 量不出排版高度,这里换一个假排版:每段一页。
 * 于是「一章几段 = 几页」,测的是状态机本身(取正文、缓存、跨章、纠正页码)。
 */
const onePagePerParagraph: LayoutEngine = {
  measureTitle: () => 0,
  paginate: ({ paragraphs }) =>
    paragraphs.length === 0
      ? [[]]
      : paragraphs.map((text, para): PageSegment[] => [{ text, continuation: false, para, offset: 0 }]),
};

class MockResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}
let origRO: typeof ResizeObserver | undefined;
beforeAll(() => {
  origRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});
afterAll(() => {
  if (origRO) globalThis.ResizeObserver = origRO;
});

function container(w = 400, h = 600) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: w });
  Object.defineProperty(el, 'clientHeight', { value: h });
  return { current: el };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Props {
  chapterIdx: number | null;
  pageIdx: number;
  fontSize?: number;
}

function setup(
  chapters: ContentItem[],
  fetchBody: (id: string) => Promise<ChapterBody>,
  initial: Props,
  layoutEngine: LayoutEngine = onePagePerParagraph,
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const onPageChange = vi.fn();
  const onChapterChange = vi.fn();
  const containerRef = container();
  // 和页面一样:onPageChange 纠正的页码回写成下一次的 pageIdx;rerender 传入新 pageIdx 时以传入的为准
  const hook = renderHook(
    ({ chapterIdx, pageIdx, fontSize = 18 }: Props) => {
      const [page, setPage] = React.useState(pageIdx);
      const [fromProps, setFromProps] = React.useState(pageIdx);
      if (fromProps !== pageIdx) {
        setFromProps(pageIdx);
        setPage(pageIdx);
      }
      return usePaginatedReader({
        chapter: chapterIdx != null ? chapters[chapterIdx] ?? null : null,
        chapterIdx,
        pageIdx: page,
        chapters,
        fetchBody,
        fontSize,
        fontFamily: 'serif',
        containerRef,
        onPageChange: (p) => {
          onPageChange(p);
          setPage(p);
        },
        onChapterChange,
        layoutEngine,
      });
    },
    { wrapper, initialProps: initial },
  );
  return { ...hook, onPageChange, onChapterChange };
}

const withContent = (id: string, paras: number): ContentItem => ({
  id,
  title: id,
  content: Array.from({ length: paras }, (_, i) => `${id}-p${i}`).join('\n'),
});

describe('usePaginatedReader', () => {
  it('LAST_PAGE / 越界页码被夹到末页', async () => {
    const chapters = [withContent('c0', 3)];
    const { result, onPageChange } = setup(chapters, vi.fn(), { chapterIdx: 0, pageIdx: LAST_PAGE });
    await waitFor(() => expect(result.current.pageCount).toBe(3));
    expect(result.current.current.pageIdx).toBe(2);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('章首往前翻到上一章末页、章末往后翻到下一章首页', async () => {
    const chapters = [withContent('c0', 2), withContent('c1', 3), withContent('c2', 1)];
    const { result, rerender, onChapterChange } = setup(chapters, vi.fn(), { chapterIdx: 1, pageIdx: 0 });
    await waitFor(() => expect(result.current.prev?.ready).toBe(true));
    expect(result.current.prev).toMatchObject({ chapterIdx: 0, pageIdx: 1 });
    expect(result.current.next).toMatchObject({ chapterIdx: 1, pageIdx: 1 });
    act(() => result.current.goPrev());
    expect(onChapterChange).toHaveBeenLastCalledWith(0, 1);

    rerender({ chapterIdx: 1, pageIdx: 2 });
    await waitFor(() => expect(result.current.next?.ready).toBe(true));
    expect(result.current.next).toMatchObject({ chapterIdx: 2, pageIdx: 0 });
    act(() => result.current.goNext());
    expect(onChapterChange).toHaveBeenLastCalledWith(2, 0);
  });

  it('首章首页没有上一页,末章末页没有下一页', async () => {
    const chapters = [withContent('c0', 1)];
    const { result } = setup(chapters, vi.fn(), { chapterIdx: 0, pageIdx: 0 });
    await waitFor(() => expect(result.current.current.ready).toBe(true));
    expect(result.current.prev).toBeNull();
    expect(result.current.next).toBeNull();
  });

  it('预取上一章时翻过去,预取结果不会被丢掉(不会一直「正在加载」)', async () => {
    const chapters: ContentItem[] = [{ id: 'c0', title: 'c0' }, { id: 'c1', title: 'c1' }];
    const bodies = { c0: deferred<ChapterBody>(), c1: deferred<ChapterBody>() };
    const fetchBody = vi.fn((id: string) => bodies[id as 'c0' | 'c1'].promise);
    const { result, rerender } = setup(chapters, fetchBody, { chapterIdx: 1, pageIdx: 0 });

    await act(async () => bodies.c1.resolve({ content: 'x\ny' }));
    await waitFor(() => expect(result.current.current.ready).toBe(true));
    // 当前章排好后开始预取 c0,还没回来时用户按 ← 翻到 c0
    await waitFor(() => expect(fetchBody).toHaveBeenCalledWith('c0'));
    rerender({ chapterIdx: 0, pageIdx: LAST_PAGE });
    expect(result.current.current.ready).toBe(false);

    await act(async () => bodies.c0.resolve({ content: 'a\nb\nc' }));
    await waitFor(() => expect(result.current.current.ready).toBe(true));
    expect(result.current.pageCount).toBe(3);
    expect(fetchBody).toHaveBeenCalledTimes(2);
  });

  it('正文拉取失败:标记出错、不缓存成空章,retry 后重新拉', async () => {
    const chapters: ContentItem[] = [{ id: 'c0', title: 'c0' }];
    let fail = true;
    const fetchBody = vi.fn(async () => {
      if (fail) throw new Error('network');
      return { content: 'a\nb' };
    });
    const { result } = setup(chapters, fetchBody, { chapterIdx: 0, pageIdx: 0 });
    await waitFor(() => expect(result.current.current.notice).toBe('error'));
    expect(result.current.current.ready).toBe(true);
    expect(result.current.current.segments).toEqual([]);

    fail = false;
    act(() => result.current.retry(0));
    await waitFor(() => expect(result.current.pageCount).toBe(2));
    expect(result.current.current.notice).toBeUndefined();
    expect(fetchBody).toHaveBeenCalledTimes(2);
  });

  it('付费未解锁:目录标记的不去拉,正文接口返回 locked 的也显示锁定', async () => {
    const chapters: ContentItem[] = [{ id: 'c0', title: 'c0', locked: true }, { id: 'c1', title: 'c1' }];
    const fetchBody = vi.fn(async () => ({ locked: true }));
    const { result, rerender } = setup(chapters, fetchBody, { chapterIdx: 0, pageIdx: 0 });
    await waitFor(() => expect(result.current.current.notice).toBe('locked'));
    await waitFor(() => expect(result.current.next?.notice).toBe('locked'));
    expect(fetchBody).toHaveBeenCalledTimes(1);
    expect(fetchBody).toHaveBeenCalledWith('c1');
    rerender({ chapterIdx: 1, pageIdx: 0 });
    expect(result.current.current).toMatchObject({ chapterIdx: 1, ready: true, notice: 'locked' });
  });

  it('换字号重排后停在原来读到的那段,而不是同一个页号', async () => {
    // 字号 < 20 时一页两段,>= 20 时一页一段
    const byFont: LayoutEngine = {
      measureTitle: () => 0,
      paginate: ({ paragraphs, fontSize }) => {
        const per = fontSize >= 20 ? 1 : 2;
        const pages: PageSegment[][] = [];
        for (let i = 0; i < paragraphs.length; i += per) {
          pages.push(paragraphs.slice(i, i + per).map((text, k) => ({ text, continuation: false, para: i + k, offset: 0 })));
        }
        return pages;
      },
    };
    const chapters = [withContent('c0', 6)];
    const { result, rerender, onPageChange } = setup(chapters, vi.fn(), { chapterIdx: 0, pageIdx: 2, fontSize: 18 }, byFont);
    await waitFor(() => expect(result.current.pageCount).toBe(3));
    expect(result.current.current.segments[0].para).toBe(4);

    rerender({ chapterIdx: 0, pageIdx: 2, fontSize: 24 });
    await waitFor(() => expect(result.current.pageCount).toBe(6));
    // 第 4 段在新排版的第 4 页
    expect(result.current.current.pageIdx).toBe(4);
    expect(result.current.current.segments[0].para).toBe(4);
    expect(onPageChange).toHaveBeenLastCalledWith(4);

    // 调回去也回到含第 4 段的那页,不会越漂越远
    rerender({ chapterIdx: 0, pageIdx: 2, fontSize: 18 });
    await waitFor(() => expect(result.current.pageCount).toBe(3));
    expect(result.current.current.pageIdx).toBe(2);
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });
});
