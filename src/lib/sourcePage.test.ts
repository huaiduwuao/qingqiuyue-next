import { describe, expect, it } from 'vitest';
import { originOnlyPlatform, sourcePageOf } from './sourcePage';

describe('originOnlyPlatform', () => {
  it('names licensed long-video platforms that can only be watched at the source', () => {
    expect(originOnlyPlatform('https://www.bilibili.com/bangumi/play/ep1113959?theme=movie')).toBe('哔哩哔哩');
    expect(originOnlyPlatform('https://www.bilibili.com/bangumi/play/ss101758')).toBe('哔哩哔哩');
    expect(originOnlyPlatform('https://www.iqiyi.com/v_19rr7pm7rc.html')).toBe('爱奇艺');
    expect(originOnlyPlatform('https://v.qq.com/x/cover/mzc002001f5siqp/n0047co551x.html')).toBe('腾讯视频');
    expect(originOnlyPlatform('https://v.youku.com/v_show/id_XNTAyNzQxOTM2.html')).toBe('优酷');
    expect(originOnlyPlatform('https://www.mgtv.com/b/693453/21776996.html')).toBe('芒果TV');
    expect(originOnlyPlatform('https://www.360kan.com/m/hbjbVyeM.html')).toBe('360影视');
  });

  it('leaves rule-resolvable pages and everything else alone', () => {
    for (const url of [
      // 有解析规则:本站播放器播
      'https://www.bilibili.com/video/BV117Yj6rEG4',
      'https://www.bilibili.com/video/av7915086',
      'https://www.acfun.cn/v/ac48868360',
      // B 站其它形态不归这里管
      'https://live.bilibili.com/1234',
      'https://www.douyin.com/video/7686432847778982833',
      'https://upos-sz-estgoss.bilivideo.com/upgcxcode/01/83/1.mp4',
      '',
      undefined,
    ]) {
      expect(originOnlyPlatform(url), url).toBeNull();
    }
  });
});

describe('sourcePageOf', () => {
  const bv = 'https://www.bilibili.com/video/BV117Yj6rEG4';
  const cdn = 'https://upos-sz-estgoss.bilivideo.com/upgcxcode/01/83/1.mp4?deadline=1';
  it('recovers the page URL from metadata when sourceUrl is a stale CDN link', () => {
    expect(sourcePageOf(cdn, JSON.stringify({ sourceUrl: bv }))).toBe(bv);
    expect(sourcePageOf(cdn, JSON.stringify({ source_url: 'https://www.iqiyi.com/v_19rr7pm7rc.html' }))).toBe('https://www.iqiyi.com/v_19rr7pm7rc.html');
  });
  it('keeps the given URL when it is already a page or metadata is useless', () => {
    expect(sourcePageOf(bv, JSON.stringify({ sourceUrl: 'https://example.com/x' }))).toBe(bv);
    expect(sourcePageOf(cdn, '{"sourceUrl":"https://example.com/x"}')).toBe(cdn);
    expect(sourcePageOf(cdn, '{"sourceUrl":')).toBe(cdn);
    expect(sourcePageOf(undefined, null)).toBe('');
  });
});
