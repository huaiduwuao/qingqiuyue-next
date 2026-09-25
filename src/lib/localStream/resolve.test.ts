/**
 * 规则执行器端到端(离线):用假源站响应把 B 站(JSON 步骤 + wbi 签名 + DASH 挑轨)和
 * AcFun(网页正则 + 内嵌 JSON 字符串 + HLS)跑一遍;再验证服务端解析和选路。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { url: string; headers: Record<string, string> }[] = [];
let nativeFails = false;

vi.mock('./native', () => ({
  nativeAvailable: () => true,
  nativeFetch: async (url: string, init: { headers?: Record<string, string> } = {}) => {
    if (nativeFails) throw new Error('原生请求失败');
    calls.push({ url, headers: init.headers ?? {} });
    return fakeOrigin(url);
  },
}));

vi.mock('./dash', async (orig) => ({
  ...(await orig<typeof import('./dash')>()),
  // jsdom 没有 MediaSource:假装本机只解 AVC + AAC
  mediaSourceCtor: () => ({ ctor: { isTypeSupported: (t: string) => /avc1|mp4a/.test(t) } as unknown as typeof MediaSource, managed: false }),
}));

vi.mock('./rules', async (orig) => {
  const m = await orig<typeof import('./rules')>();
  return { ...m, loadRules: async () => m.DEFAULT_RULES };
});

import { resolveLocalStream, resolveServerStream, resolveStream } from './engine';

const acfunPage = () => {
  const ks = JSON.stringify({
    adaptationSet: [
      {
        representation: [
          { url: 'https://tx/1080.m3u8', backupUrl: ['https://ali/1080.m3u8'], height: 1080 },
          { url: 'https://tx/720.m3u8', backupUrl: ['https://ali/720.m3u8'], height: 720 },
          { url: 'https://tx/480.m3u8', height: 480 },
        ],
      },
    ],
  });
  const info = { currentVideoInfo: { id: 37245600, durationMillis: 11594, ksPlayJson: ks }, title: 'x' };
  return `<html><script>window.pageInfo = window.videoInfo = ${JSON.stringify(info)};\n</script></html>`;
};

function fakeOrigin(url: string): Response {
  const u = new URL(url);
  const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
  if (u.pathname === '/x/frontend/finger/spi') return json({ code: 0, data: { b_3: 'B3', b_4: 'B/4=' } });
  if (u.pathname === '/x/web-interface/nav') {
    return json({ code: -101, data: { wbi_img: { img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png', sub_url: 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png' } } });
  }
  if (u.pathname === '/x/player/pagelist') return json({ code: 0, data: [{ cid: 137649199 }] });
  if (u.pathname === '/x/player/wbi/playurl') {
    if (!u.searchParams.get('w_rid') || u.searchParams.get('cid') !== '137649199') return new Response('<html>403</html>', { status: 403 });
    if (u.searchParams.get('platform') === 'html5' && u.searchParams.get('fnval') === '1') {
      return json({ code: 0, data: { quality: 64, format: 'mp4720', timelength: 213000, durl: [{ order: 1, url: 'https://cn-jstz-cu-01-04.bilivideo.com/x.mp4?deadline=1', backup_url: ['https://upos-sz-mirrorcos.bilivideo.com/x.mp4?deadline=1'] }] } });
    }
    const seg = { Initialization: '0-100', indexRange: '101-200' };
    return json({
      code: 0,
      data: {
        dash: {
          duration: 213,
          video: [
            { id: 80, height: 1080, baseUrl: 'https://cdn/v1080', mimeType: 'video/mp4', codecs: 'avc1.64002A', SegmentBase: seg },
            { id: 64, height: 720, baseUrl: 'https://cdn/v720hev', mimeType: 'video/mp4', codecs: 'hev1.1.6.L120.90', SegmentBase: seg },
            { id: 64, height: 720, baseUrl: 'https://cdn/v720', backupUrl: ['https://cdn2/v720'], mimeType: 'video/mp4', codecs: 'avc1.64001F', SegmentBase: seg },
            { id: 32, height: 480, baseUrl: 'https://cdn/v480', mimeType: 'video/mp4', codecs: 'avc1.64001F', SegmentBase: seg },
          ],
          audio: [{ id: 30280, baseUrl: 'https://cdn/a', mimeType: 'audio/mp4', codecs: 'mp4a.40.2', SegmentBase: { Initialization: '0-50', indexRange: '51-90' } }],
        },
      },
    });
  }
  if (u.hostname === 'www.acfun.cn' && u.pathname.startsWith('/v/ac')) return new Response(acfunPage(), { status: 200 });
  return new Response('<html>risk control</html>', { status: 412 });
}

beforeEach(() => {
  calls.length = 0;
  nativeFails = false;
});

describe('resolveLocalStream', () => {
  it('bilibili: 走完 spi→nav→pagelist→wbi playurl(html5),带 Origin/Cookie,输出音视频合一的整段 mp4', async () => {
    const st = await resolveLocalStream('https://www.bilibili.com/video/BV1GJ411x7h7');
    expect(st.kind).toBe('progressive');
    if (st.kind !== 'progressive') return;
    expect(st.provider).toBe('bilibili');
    expect(st.duration).toBe(213);
    expect(st.source).toBe('local');
    expect(st.urls).toEqual(['https://cn-jstz-cu-01-04.bilivideo.com/x.mp4?deadline=1', 'https://upos-sz-mirrorcos.bilivideo.com/x.mp4?deadline=1']);
    // html5 的 mp4 不校验 Referer:媒体请求不需要任何自定义头
    expect(st.mediaHeaders).toEqual({});

    const nav = calls.find((c) => c.url.includes('/x/web-interface/nav'))!;
    // Tauri 的 http 插件会给没带 Origin 的请求补上应用自己的来源,B 站对陌生 Origin 回 403 —— 必须显式带
    expect(nav.headers.Origin).toBe('https://www.bilibili.com');
    expect(nav.headers.Cookie).toContain('buvid3=B3');
    expect(nav.headers.Cookie).toContain('buvid4=B%2F4%3D');
    const play = new URL(calls.find((c) => c.url.includes('/x/player/wbi/playurl'))!.url);
    expect(play.searchParams.get('platform')).toBe('html5');
    expect(play.searchParams.get('fnval')).toBe('1');
    expect(play.searchParams.get('w_rid')).toMatch(/^[0-9a-f]{32}$/);

    // 结果缓存:同一条不再发请求;另一条视频复用 spi/nav(只多发 pagelist + playurl)
    calls.length = 0;
    await resolveLocalStream('https://www.bilibili.com/video/BV1GJ411x7h7');
    expect(calls).toHaveLength(0);
    await resolveLocalStream('https://www.bilibili.com/video/BV1GJ411x7h8');
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(['/x/player/pagelist', '/x/player/wbi/playurl']);
  });

  it('bilibili av 号:pagelist 用 aid,playurl 用 avid', async () => {
    const st = await resolveLocalStream('https://www.bilibili.com/video/av7915086');
    expect(st.provider).toBe('bilibili-av');
    const pages = new URL(calls.find((c) => c.url.includes('/x/player/pagelist'))!.url);
    expect(pages.searchParams.get('aid')).toBe('7915086');
    expect(pages.searchParams.get('bvid')).toBeNull();
    const play = new URL(calls.find((c) => c.url.includes('/x/player/wbi/playurl'))!.url);
    expect(play.searchParams.get('avid')).toBe('7915086');
    expect(play.searchParams.get('aid')).toBeNull();
  });

  it('acfun: 网页正则 + ksPlayJson 字符串 + hls 输出,按 maxHeight 挑 720', async () => {
    const st = await resolveLocalStream('https://www.acfun.cn/v/ac47031567_2');
    expect(st.kind).toBe('hls');
    if (st.kind !== 'hls') return;
    expect(calls[0].url).toBe('https://www.acfun.cn/v/ac47031567_2');
    expect(calls[0].headers.Origin).toBe('https://www.acfun.cn');
    expect(st.urls).toEqual(['https://tx/720.m3u8', 'https://ali/720.m3u8']);
    expect(st.duration).toBeCloseTo(11.594, 3);
  });

  it('没有规则的地址直接报错', async () => {
    await expect(resolveLocalStream('https://www.bilibili.com/bangumi/play/ep1')).rejects.toThrow('没有匹配的解析规则');
  });
});

describe('resolveServerStream / resolveStream', () => {
  it('服务端结果里的候选轨由本机挑第一条能解的', async () => {
    const seg = { init: [0, 100], index: [101, 200] };
    const payload = {
      kind: 'dash',
      provider: 'bilibili',
      duration: 100,
      video: { urls: ['https://cdn/hev'], mime: 'video/mp4', codecs: 'hev1.1.6.L120.90', height: 720, ...seg },
      videos: [
        { urls: ['https://cdn/hev'], mime: 'video/mp4', codecs: 'hev1.1.6.L120.90', height: 720, ...seg },
        { urls: ['https://cdn/avc'], mime: 'video/mp4', codecs: 'avc1.64001F', height: 720, ...seg },
      ],
      audio: { urls: ['https://cdn/a'], mime: 'audio/mp4', codecs: 'mp4a.40.2', init: [0, 50], index: [51, 90] },
      mediaHeaders: { Referer: 'https://www.bilibili.com/' },
      source: 'server',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0, data: payload })));
    try {
      const st = await resolveServerStream('https://www.bilibili.com/video/BV1serverAAA', { signal: new AbortController().signal });
      expect(st.kind).toBe('dash');
      if (st.kind !== 'dash') return;
      expect(st.video.urls).toEqual(['https://cdn/avc']);
      expect(st.source).toBe('server');
      expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/content/stream/rules/resolve?url=https%3A%2F%2Fwww.bilibili.com%2Fvideo%2FBV1serverAAA');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('服务端 code≠0 时报它的 message', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 1, message: 'bilibili/nav: 非 JSON 响应(HTTP 403)' })));
    try {
      await expect(resolveServerStream('https://www.bilibili.com/video/BV1serverBBB', { signal: new AbortController().signal })).rejects.toThrow('bilibili/nav');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('客户端本地失败退到服务端;都失败时两个原因都带上', async () => {
    nativeFails = true;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 1, message: '服务器也不行' })));
    try {
      await expect(resolveStream('https://www.bilibili.com/video/BV1serverCCC', { signal: new AbortController().signal })).rejects.toThrow(/原生请求失败;服务端:服务器也不行/);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
