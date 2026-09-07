import { describe, expect, it } from 'vitest';
import { mediaUrl, normalizeMediaUrls } from './media';

// jsdom 下 window.location.origin 是 http://localhost:3000,
// NEXT_PUBLIC_API_BASE_URL 未设 → GATEWAY 为空串(同源部署那一档)。
describe('mediaUrl', () => {
  it('空值原样返回空串', () => {
    expect(mediaUrl(undefined)).toBe('');
    expect(mediaUrl(null)).toBe('');
    expect(mediaUrl('   ')).toBe('');
  });

  it('MinIO 内网直链改写成同源 bucket 路径', () => {
    expect(mediaUrl('http://10.9.1.2:10000/qq-media/image/2026/09/05/abc.jpg'))
      .toBe('/qq-media/image/2026/09/05/abc.jpg');
    expect(mediaUrl('http://10.9.1.2:10000/qq-video/v/1.mp4')).toBe('/qq-video/v/1.mp4');
  });

  it('保留 MinIO 直链上的 query(presign 之外的普通参数)', () => {
    expect(mediaUrl('http://10.9.1.2:10000/qq-media/a.jpg?v=2')).toBe('/qq-media/a.jpg?v=2');
  });

  it('外站图片包成 /api/proxy,由后端补 Referer', () => {
    expect(mediaUrl('http://i2.hdslb.com/bfs/archive/x.jpg'))
      .toBe('/api/proxy?url=' + encodeURIComponent('http://i2.hdslb.com/bfs/archive/x.jpg'));
  });

  it('private bucket 的 presigned URL 原样返回(签名绑死 Host)', () => {
    const signed = 'https://qingqiuyue.com/qq-avatar/raw/a.mp4?X-Amz-Signature=deadbeef';
    expect(mediaUrl(signed)).toBe(signed);
    expect(mediaUrl('https://qingqiuyue.com/qq-tmp/x.bin?X-Amz-Signature=1')).toBe(
      'https://qingqiuyue.com/qq-tmp/x.bin?X-Amz-Signature=1',
    );
  });

  it('同源地址不动', () => {
    expect(mediaUrl('http://localhost:3000/qq-media/a.jpg')).toBe('http://localhost:3000/qq-media/a.jpg');
  });

  it('相对路径:bucket 路径与本地静态资源都不被破坏', () => {
    expect(mediaUrl('/qq-media/a.jpg')).toBe('/qq-media/a.jpg');
    expect(mediaUrl('/images/logo.png')).toBe('/images/logo.png');
  });

  it('data/blob 原样返回', () => {
    expect(mediaUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(mediaUrl('blob:http://localhost:3000/abc')).toBe('blob:http://localhost:3000/abc');
  });
});

describe('normalizeMediaUrls', () => {
  it('深度改写 MinIO 直链,任意字段名/任意嵌套', () => {
    const payload = {
      list: [
        { cover: 'http://10.9.1.2:10000/qq-media/a.jpg', author: { avatar: 'http://10.9.1.2:10000/qq-media/b.png' } },
      ],
      banner: { images: ['http://10.9.1.2:10000/qq-media/c.webp'] },
    };
    normalizeMediaUrls(payload);
    expect(payload.list[0].cover).toBe('/qq-media/a.jpg');
    expect(payload.list[0].author.avatar).toBe('/qq-media/b.png');
    expect(payload.banner.images[0]).toBe('/qq-media/c.webp');
  });

  it('不碰外站地址 —— sourceUrl 要留给播放器解析', () => {
    const payload = {
      sourceUrl: 'https://www.bilibili.com/video/BV1xx',
      cover: 'http://i2.hdslb.com/bfs/a.jpg',
    };
    normalizeMediaUrls(payload);
    expect(payload.sourceUrl).toBe('https://www.bilibili.com/video/BV1xx');
    expect(payload.cover).toBe('http://i2.hdslb.com/bfs/a.jpg');
  });

  it('不碰 private bucket 的 presigned URL', () => {
    const signed = 'http://10.9.1.2:10000/qq-avatar/raw/a.mp4?X-Amz-Signature=abc';
    const payload = { url: signed };
    normalizeMediaUrls(payload);
    expect(payload.url).toBe(signed);
  });

  it('非 URL 字符串与标量原样保留', () => {
    const payload = { title: '推荐', count: 12, ok: true, empty: null };
    normalizeMediaUrls(payload);
    expect(payload).toEqual({ title: '推荐', count: 12, ok: true, empty: null });
  });

  it('环形引用不炸(深度上限保护)', () => {
    const a: any = { cover: 'http://10.9.1.2:10000/qq-media/a.jpg' };
    a.self = a;
    expect(() => normalizeMediaUrls(a)).not.toThrow();
    expect(a.cover).toBe('/qq-media/a.jpg');
  });
});
