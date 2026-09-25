import { describe, expect, it } from 'vitest';
import { originOnlyPlatform, resolveEmbedPlayer, sourcePageOf, withAutoplay } from './embedPlayer';

// 用例与后端 internal/embedplayer/embedplayer_test.go 对齐:两边规则必须一致。
describe('resolveEmbedPlayer', () => {
  it('maps bilibili user uploads to the official embed player', () => {
    expect(resolveEmbedPlayer('https://www.bilibili.com/video/BV117Yj6rEG4')?.url).toBe(
      'https://player.bilibili.com/player.html?bvid=BV117Yj6rEG4&autoplay=0&high_quality=1&danmaku=0',
    );
    expect(resolveEmbedPlayer('https://www.bilibili.com/video/BV117Yj6rEG4/?spm_id_from=333.1007')?.url).toContain('bvid=BV117Yj6rEG4');
    expect(resolveEmbedPlayer('https://www.bilibili.com/video/BV117Yj6rEG4?p=3')?.url).toContain('&p=3&');
    expect(resolveEmbedPlayer('https://www.bilibili.com/video/av7915086')?.url).toContain('aid=7915086');
    expect(resolveEmbedPlayer('m.bilibili.com/video/BV1Zs41187TW')?.providerLabel).toBe('哔哩哔哩');
  });

  it('refuses shapes the embed player cannot play', () => {
    for (const url of [
      // 番剧/影视:外链播放器只放 error.mp4
      'https://www.bilibili.com/bangumi/play/ep1113959?theme=movie',
      'https://www.bilibili.com/bangumi/play/ss101758',
      'https://www.douyin.com/lvdetail/6533092664210883076',
      'https://v.qq.com/x/cover/mzc002001f5siqp/n0047co551x.html',
      'https://v.youku.com/v_show/id_XNTAyNzQxOTM2.html',
      'https://www.iqiyi.com/v_19rr7pm7rc.html',
      // 已解析出的 CDN 直链不是页面地址
      'https://upos-sz-estgoss.bilivideo.com/upgcxcode/01/83/1.mp4',
      // 域名仿冒
      'https://www.bilibili.com.evil.example/video/BV117Yj6rEG4',
      'https://example.com/?u=bilibili.com/video/BV117Yj6rEG4',
      '',
      undefined,
    ]) {
      expect(resolveEmbedPlayer(url)).toBeNull();
    }
  });

  it('turns autoplay on only when asked', () => {
    const e = resolveEmbedPlayer('https://www.bilibili.com/video/BV117Yj6rEG4')!;
    expect(e.url).toContain('autoplay=0');
    expect(withAutoplay(e.url)).toContain('autoplay=1');
  });
});

describe('resolveEmbedPlayer · AcFun', () => {
  it('maps AcFun uploads to its player, same rules as internal/embedplayer', () => {
    expect(resolveEmbedPlayer('https://www.acfun.cn/v/ac48868360')?.url).toBe('https://www.acfun.cn/player/ac48868360?autoplay=0');
    expect(resolveEmbedPlayer('https://www.acfun.cn/v/ac48868360_2')?.url).toBe('https://www.acfun.cn/player/ac48868360_2?autoplay=0');
    expect(resolveEmbedPlayer('https://m.acfun.cn/v/ac48868360/')?.provider).toBe('acfun');
    expect(resolveEmbedPlayer('https://www.acfun.cn/bangumi/aa6002917')).toBeNull();
  });
});

describe('resolveEmbedPlayer · 抖音', () => {
  it('maps Douyin works to the open-platform player, same rules as internal/embedplayer', () => {
    const want = 'https://open.douyin.com/player/video?vid=7686432847778982833&autoplay=0';
    expect(resolveEmbedPlayer('https://www.douyin.com/video/7686432847778982833')?.url).toBe(want);
    expect(resolveEmbedPlayer('https://www.iesdouyin.com/share/video/7686432847778982833/')?.url).toBe(want);
    for (const url of [
      'https://www.douyin.com/search/%E5%A4%A7%E5%8F%B8%E9%A9%AC',
      'https://www.douyin.com/lvdetail/6950112124290990622',
      'https://v.douyin.com/iRNBho6u/',
      'https://www.douyin.com.evil.example/video/7686432847778982833',
    ]) {
      expect(resolveEmbedPlayer(url)).toBeNull();
    }
  });
});

describe('originOnlyPlatform', () => {
  it('names licensed long-form platforms that can only be watched at the origin', () => {
    expect(originOnlyPlatform('https://www.bilibili.com/bangumi/play/ep1113959?theme=movie')).toBe('哔哩哔哩');
    expect(originOnlyPlatform('https://www.bilibili.com/bangumi/play/ss101758')).toBe('哔哩哔哩');
    expect(originOnlyPlatform('https://www.iqiyi.com/v_19rr7pm7rc.html')).toBe('爱奇艺');
    expect(originOnlyPlatform('https://v.qq.com/x/cover/mzc002001f5siqp/n0047co551x.html')).toBe('腾讯视频');
    expect(originOnlyPlatform('https://v.youku.com/v_show/id_XNTAyNzQxOTM2.html')).toBe('优酷');
    expect(originOnlyPlatform('https://www.mgtv.com/b/693453/21776996.html')).toBe('芒果TV');
  });

  it('leaves embeddable, resolvable and unknown pages alone', () => {
    for (const url of [
      'https://www.bilibili.com/video/BV117Yj6rEG4', // 有外链播放器
      'https://live.bilibili.com/22', // 直播间不归这里管
      'https://www.douyin.com/video/7123456789',
      'https://y.qq.com/n/ryqq/songDetail/1', // qq.com 下只认 v.qq.com
      'https://www.iqiyi.com.evil.example/v_1.html',
      '',
    ]) {
      expect(originOnlyPlatform(url)).toBeNull();
    }
  });
});

describe('sourcePageOf', () => {
  const bv = 'https://www.bilibili.com/video/BV117Yj6rEG4';
  const cdn = 'https://upos-sz-estgoss.bilivideo.com/upgcxcode/01/83/1.mp4?deadline=1';

  it('recovers the page url from metadata when the api hands back a cdn link', () => {
    expect(sourcePageOf(cdn, JSON.stringify({ sourceUrl: bv }))).toBe(bv);
    expect(sourcePageOf('', JSON.stringify({ source_url: 'https://www.iqiyi.com/v_19rr7pm7rc.html' }))).toBe('https://www.iqiyi.com/v_19rr7pm7rc.html');
  });

  it('keeps what the api gave otherwise', () => {
    expect(sourcePageOf(bv, '{"sourceUrl":"https://example.com/x"}')).toBe(bv);
    expect(sourcePageOf(cdn, '{"sourceUrl":"https://www.douyin.com/video/7123456789"}')).toBe(cdn);
    expect(sourcePageOf(cdn, '{"sourceUrl":"https://www.bili')).toBe(cdn);
    expect(sourcePageOf(undefined, undefined)).toBe('');
  });
});
