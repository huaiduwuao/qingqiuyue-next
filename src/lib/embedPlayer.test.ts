import { describe, expect, it } from 'vitest';
import { resolveEmbedPlayer, withAutoplay } from './embedPlayer';

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
