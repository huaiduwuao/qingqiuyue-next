import { describe, it, expect, vi } from 'vitest';
import {
  contentItemsQueryKey,
  fetchContentItemsAll,
} from './useContentItems';

/**
 * 单元测试 fetchContentItemsAll + queryKey 行为,不引入 React/TestProvider
 * —— 这些都是纯函数,跑得快、不依赖 react-query。
 */

describe('useContentItems · queryKey', () => {
  it('lite + untilChapterId 都进 key', () => {
    expect(contentItemsQueryKey('novel', 'abc', { lite: true, untilChapterId: 'ch-1' }))
      .toEqual(['detail', 'novel', 'abc', 'items', 'lite', 'ch-1']);
  });

  it('没传 untilChapterId 用 "all" 占位', () => {
    expect(contentItemsQueryKey('novel', 'abc', { lite: true }))
      .toEqual(['detail', 'novel', 'abc', 'items', 'lite', 'all']);
  });

  it('没传 lite 也是 "full"', () => {
    expect(contentItemsQueryKey('novel', 'abc'))
      .toEqual(['detail', 'novel', 'abc', 'items', 'full', 'all']);
  });
});

describe('fetchContentItemsAll', () => {
  it('一页就够就不翻第二页', async () => {
    const fetchPage = vi.fn(async () => ({
      list: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
      total: 2,
    }));
    const r = await fetchContentItemsAll(fetchPage as never, 'content-1', { lite: true });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ moduleContentId: 'content-1', page: 1, page_size: 500, lite: 1 });
    expect(r.items).toHaveLength(2);
    expect(r.total).toBe(2);
    expect(r.backfilling).toBe(false);
  });

  it('翻到 total 满足为止', async () => {
    let page = 1;
    const fetchPage = vi.fn(async () => {
      const list = Array.from({ length: 500 }, (_, k) => ({ id: `p${page}-${k}`, title: `${page}-${k}` }));
      page += 1;
      return { list, total: 1200 };
    });
    const r = await fetchContentItemsAll(fetchPage as never, 'content-1', { lite: true });
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(r.items).toHaveLength(1500);
    expect(r.total).toBe(1200);
  });

  it('空目录不报错', async () => {
    const fetchPage = vi.fn(async () => ({ list: [], total: 0 }));
    const r = await fetchContentItemsAll(fetchPage as never, 'content-1');
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
  });
});