import { describe, it, expect, vi } from 'vitest';
import {
  canCancel,
  isTerminal,
  missingCapabilities,
  pickMethod,
  clipsUrlFor,
  clipList,
  unwrapRealtime,
  needsHint,
  fetchClipList,
  type StudioCapabilities,
} from './avatarStudio';

const caps = (over: Partial<StudioCapabilities> = {}): StudioCapabilities => ({
  trainCmd: false,
  ffmpeg: true,
  storage: true,
  methods: [
    { key: 'ExAvatar', label: 'ExAvatar', mode: '3dgs', needsGpu: true, available: false, reason: '需要 GPU', needs: 'AVATAR_TRAIN_CMD' },
    { key: 'Gaussian', label: 'Gaussian', mode: '3dgs', needsGpu: true, available: false, reason: '需要 GPU', needs: 'AVATAR_TRAIN_CMD' },
    { key: 'Clip2D', label: '真人片段', mode: '2d', needsGpu: false, available: true, reason: '', needs: '' },
  ],
  ...over,
});

describe('avatarStudio', () => {
  it('queued 和 running 可以取消,终态不行', () => {
    expect(canCancel('queued')).toBe(true);
    expect(canCancel('running')).toBe(true);
    for (const s of ['done', 'failed', 'canceled'] as const) {
      expect(canCancel(s)).toBe(false);
      expect(isTerminal(s)).toBe(true);
    }
  });

  it('缺失项去重并给出说明', () => {
    const m = missingCapabilities(caps({ ffmpeg: false }));
    expect(m.map((x) => x.key)).toEqual(['AVATAR_TRAIN_CMD', 'ffmpeg']);
    expect(m[0].text).toContain('AVATAR_TRAIN_CMD');
    expect(missingCapabilities(caps({ trainCmd: true, methods: [] }))).toEqual([]);
    expect(missingCapabilities(null)).toEqual([]);
    expect(needsHint('XYZ')).toBe('缺少 XYZ');
    expect(needsHint('')).toBe('');
  });

  it('默认训练方式落到可用的', () => {
    expect(pickMethod(caps(), 'ExAvatar')).toBe('Clip2D');
    expect(pickMethod(caps(), 'Clip2D')).toBe('Clip2D');
    const none = caps({ methods: caps().methods.map((m) => ({ ...m, available: false })) });
    expect(pickMethod(none, 'Gaussian')).toBe('Gaussian');
    expect(pickMethod(undefined, 'ExAvatar')).toBe('ExAvatar');
  });

  it('2D 资产拼 clips.json 地址', () => {
    expect(clipsUrlFor({ mode: '2d', assetUrl: 'https://x/avatar/assets/j1/' })).toBe('https://x/avatar/assets/j1/clips.json');
    expect(clipsUrlFor({ mode: '2d', assetUrl: 'https://x/a' })).toBe('https://x/a/clips.json');
    expect(clipsUrlFor({ mode: '3dgs', assetUrl: 'https://x/a/' })).toBe('');
  });

  it('片段表按动作顺序排列,跳过 _note', () => {
    const list = clipList({ _note: 'x', wave: { url: 'w.mp4' }, idle: { url: 'i.mp4', loop: true }, zz: 'z.mp4', speaking: 's.mp4' });
    expect(list.map((c) => c.key)).toEqual(['idle', 'speaking', 'wave', 'zz']);
    expect(list[0].loop).toBe(true);
    expect(list[2].loop).toBe(false);
  });

  it('解包 realtime 回包:200+code 1 也算失败', () => {
    expect(unwrapRealtime(200, { code: 200, msg: 'OK', data: { a: 1 } }, 'x')).toEqual({ a: 1 });
    expect(() => unwrapRealtime(200, { code: 1, msg: '存储未初始化' }, '上传素材失败')).toThrow('上传素材失败:存储未初始化');
    expect(() => unwrapRealtime(500, { code: 500, msg: 'db down' }, '获取失败')).toThrow('db down');
    expect(() => unwrapRealtime(502, null, '获取失败')).toThrow('获取失败(502)');
  });

  it('fetchClipList 读资产目录', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ idle: { url: 'u', loop: true } }), { status: 200 }));
    const list = await fetchClipList({ mode: '2d', assetUrl: 'https://x/a/' }, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledWith('https://x/a/clips.json', { cache: 'no-store' });
    expect(list).toEqual([{ key: 'idle', url: 'u', loop: true }]);
    const bad = vi.fn(async () => new Response('nope', { status: 404 }));
    await expect(fetchClipList({ mode: '2d', assetUrl: 'https://x/a/' }, bad as unknown as typeof fetch)).rejects.toThrow('404');
  });
});
