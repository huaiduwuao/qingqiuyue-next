import { describe, it, expect } from 'vitest';
import { LIST_PAGE_SIZE, nextMeListPage, type MeListPage } from './meListPaging';

const page = (n: number, total: number): MeListPage => ({
  list: Array.from({ length: n }, (_, i) => i),
  total,
});

describe('nextMeListPage', () => {
  it('作品上万时第一页之后还要继续翻 —— 这就是「共 136316 个作品」却只出 24 条的那个 bug', () => {
    const first = page(LIST_PAGE_SIZE, 136_316);
    expect(nextMeListPage(first, [first])).toBe(2);
  });

  it('按已加载条数累加,不是按页数猜', () => {
    const pages = [page(LIST_PAGE_SIZE, 60), page(LIST_PAGE_SIZE, 60)];
    expect(nextMeListPage(pages[1], pages)).toBe(3);
  });

  it('加载够 total 就到底', () => {
    const pages = [page(LIST_PAGE_SIZE, 48), page(LIST_PAGE_SIZE, 48)];
    expect(nextMeListPage(pages[1], pages)).toBeUndefined();
  });

  it('最后一页没装满也到底', () => {
    const pages = [page(LIST_PAGE_SIZE, 30), page(6, 30)];
    expect(nextMeListPage(pages[1], pages)).toBeUndefined();
  });

  it('空页(未登录 / 未实现的页签)不再请求下一页', () => {
    const empty: MeListPage = { list: [], total: 0 };
    expect(nextMeListPage(empty, [empty])).toBeUndefined();
    expect(nextMeListPage(undefined, [])).toBeUndefined();
  });

  it('total 缺失时退回「页满就继续」', () => {
    const full: MeListPage = { list: Array.from({ length: LIST_PAGE_SIZE }, (_, i) => i) };
    expect(nextMeListPage(full, [full])).toBe(2);
    const partial: MeListPage = { list: [1, 2, 3] };
    expect(nextMeListPage(partial, [partial])).toBeUndefined();
  });
});
