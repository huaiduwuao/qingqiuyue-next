import { describe, expect, it } from 'vitest';
import { isVideoResponse, probeClips } from '../clip-avatar';

function fakeFetch(table: Record<string, { status: number; type?: string; body?: unknown }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = table[url];
    if (!hit) throw new Error('network');
    return new Response(hit.body === undefined ? '' : JSON.stringify(hit.body), {
      status: hit.status,
      headers: { 'content-type': hit.type || 'application/json' },
    });
  }) as typeof fetch;
}

describe('2D clip probe', () => {
  it('only accepts real video responses', () => {
    expect(isVideoResponse(200, 'video/mp4')).toBe(true);
    expect(isVideoResponse(206, 'video/webm')).toBe(true);
    // 静态站找不到文件时回退 index.html
    expect(isVideoResponse(200, 'text/html')).toBe(false);
    expect(isVideoResponse(404, 'video/mp4')).toBe(false);
  });

  it('reports why 2D is unusable', async () => {
    const table = { idle: { url: '/c/idle.mp4', loop: true } };
    expect(await probeClips('/c.json', fakeFetch({ '/c.json': { status: 200, body: table }, '/c/idle.mp4': { status: 200, type: 'video/mp4' } }))).toBeNull();
    expect(await probeClips('/c.json', fakeFetch({ '/c.json': { status: 200, body: table }, '/c/idle.mp4': { status: 200, type: 'text/html' } }))).toContain('不存在');
    expect(await probeClips('/c.json', fakeFetch({ '/c.json': { status: 404 } }))).toContain('HTTP 404');
    expect(await probeClips('/c.json', fakeFetch({ '/c.json': { status: 200, body: { _note: 'x' } } }))).toBe('片段表是空的');
    expect(await probeClips('/c.json', fakeFetch({}))).toContain('读取失败');
  });
});
