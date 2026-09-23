import { describe, it, expect, afterEach, vi } from 'vitest';
import { PAGE_PADDING, pageOfPosition, paginateChapter, surrogateSafeCut, type PageSegment } from './pagination';

const seg = (para: number, offset: number, text = 'x'): PageSegment => ({ text, continuation: offset > 0, para, offset });

describe('surrogateSafeCut', () => {
  const s = 'ab😀cd'; // 😀 占 [2, 4)
  it('切点落在代理对中间时往前退一格', () => {
    expect(surrogateSafeCut(s, 3)).toBe(2);
  });
  it('切点在代理对前后不动', () => {
    expect(surrogateSafeCut(s, 2)).toBe(2);
    expect(surrogateSafeCut(s, 4)).toBe(4);
  });
  it('边界值原样返回', () => {
    expect(surrogateSafeCut(s, 0)).toBe(0);
    expect(surrogateSafeCut(s, s.length)).toBe(s.length);
  });
});

describe('pageOfPosition', () => {
  const pages: PageSegment[][] = [
    [seg(0, 0), seg(1, 0)],
    [seg(1, 40), seg(2, 0)],
    [seg(3, 0)],
  ];
  it('找到最后一个起点不晚于该位置的页', () => {
    expect(pageOfPosition(pages, 0, 0)).toBe(0);
    expect(pageOfPosition(pages, 1, 39)).toBe(0);
    expect(pageOfPosition(pages, 1, 40)).toBe(1);
    expect(pageOfPosition(pages, 2, 5)).toBe(1);
    expect(pageOfPosition(pages, 9, 0)).toBe(2);
  });
  it('空章([[]])落在第 0 页', () => {
    expect(pageOfPosition([[]], 3, 10)).toBe(0);
  });
});

describe('paginateChapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * jsdom 不排版:把「高度」模拟成容器里的 UTF-16 单元数 × 10px,
   * 内容高 100px 就是每页最多 10 个单元。
   */
  const mockHeightByLength = () =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const h = (this.textContent ?? '').length * 10;
      return { height: h, width: 100, top: 0, left: 0, right: 100, bottom: h, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
  const opts = (paragraphs: string[]) => ({
    paragraphs,
    pageWidth: 200,
    pageHeight: 100 + PAGE_PADDING.top + PAGE_PADDING.bottom,
    fontFamily: 'serif',
    fontSize: 16,
  });
  const hasLoneSurrogate = (t: string) => /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(t);

  it('空章返回一页空页', () => {
    expect(paginateChapter(opts([]))).toEqual([[]]);
  });

  it('长段落跨页:续文标记、段落下标和偏移都对,拼回去一字不差', () => {
    mockHeightByLength();
    const para = 'abcdefghijklmnopqrstuvwxy'; // 25 个单元 → 10 + 10 + 5
    const pages = paginateChapter(opts([para]));
    expect(pages.map((p) => p.map((s) => s.text))).toEqual([['abcdefghij'], ['klmnopqrst'], ['uvwxy']]);
    expect(pages.map((p) => [p[0].para, p[0].offset, p[0].continuation])).toEqual([
      [0, 0, false],
      [0, 10, true],
      [0, 20, true],
    ]);
  });

  it('页尾不把代理对劈开(emoji / CJK 扩展 B)', () => {
    mockHeightByLength();
    // 第 10、11 个单元是 😀 的两半:按 10 个单元切会把它劈开
    const para = '123456789😀𠀀abcdefgh';
    const pages = paginateChapter(opts([para]));
    const texts = pages.flatMap((p) => p.map((s) => s.text));
    for (const t of texts) expect(hasLoneSurrogate(t)).toBe(false);
    expect(texts.join('')).toBe(para);
    expect(texts[0]).toBe('123456789');
    // 偏移按 UTF-16 单元算,和切下来的文本一致
    const segs = pages.flat();
    for (const s of segs) expect(para.slice(s.offset, s.offset + s.text.length)).toBe(s.text);
  });

  it('多段落:每段记录自己的下标', () => {
    mockHeightByLength();
    const pages = paginateChapter(opts(['aaaa', 'bbbb', 'cccccc']));
    const segs = pages.flat();
    expect(segs.map((s) => [s.text, s.para, s.offset])).toEqual([
      ['aaaa', 0, 0],
      ['bbbb', 1, 0],
      ['cc', 2, 0],
      ['cccc', 2, 2],
    ]);
  });
});
