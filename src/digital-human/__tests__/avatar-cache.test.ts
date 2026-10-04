import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deepDispose = vi.hoisted(() => vi.fn());

vi.mock('@pixiv/three-vrm', () => ({
  VRMLoaderPlugin: class {},
  VRMUtils: { deepDispose, rotateVRM0: vi.fn(), removeUnnecessaryJoints: vi.fn() },
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader', () => ({
  GLTFLoader: class {
    register() {}
    async parseAsync() {
      const scene = { traverse() {} };
      return { userData: { vrm: { scene, meta: {} } }, animations: [] };
    }
  },
}));

import { acquireAvatar, releaseAvatar, clearAvatarCache, AVATAR_CACHE_CAPACITY } from '../vrm/loadAvatar';

describe('loadAvatar LRU + 引用计数', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })));
  });
  afterEach(() => {
    clearAvatarCache();
    deepDispose.mockClear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('同一模型复用同一份,并发请求只加载一次', async () => {
    const [a, b] = await Promise.all([acquireAvatar('/x.vrm'), acquireAvatar('/x.vrm')]);
    expect(a).toBe(b);
    expect(fetch).toHaveBeenCalledTimes(1);
    releaseAvatar(a);
    releaseAvatar(b);
    expect(await acquireAvatar('/x.vrm')).toBe(a);
  });

  it('只淘汰引用为 0 的最久未用条目,在用的绝不释放', async () => {
    expect(AVATAR_CACHE_CAPACITY).toBe(2);
    const a = await acquireAvatar('/a.vrm');
    const b = await acquireAvatar('/b.vrm');
    const c = await acquireAvatar('/c.vrm');
    // 三个都在用:超容量也不释放
    expect(deepDispose).not.toHaveBeenCalled();
    releaseAvatar(b);
    // b 没人用了且超容量 → 释放 b(a 虽然更旧,但还在用)
    expect(deepDispose).toHaveBeenCalledTimes(1);
    expect(deepDispose).toHaveBeenCalledWith(b.scene);
    releaseAvatar(a);
    // 剩 a、c 两个,不超容量:a 留在缓存里供下次复用
    expect(deepDispose).toHaveBeenCalledTimes(1);
    expect(await acquireAvatar('/a.vrm')).toBe(a);
    releaseAvatar(a);
    releaseAvatar(c);
  });

  it('clearAvatarCache:在用的等最后一个使用者释放后才 dispose,下次重新加载', async () => {
    const a = await acquireAvatar('/a.vrm');
    clearAvatarCache('/a.vrm');
    expect(deepDispose).not.toHaveBeenCalled();
    const a2 = await acquireAvatar('/a.vrm');
    expect(a2).not.toBe(a);
    releaseAvatar(a);
    expect(deepDispose).toHaveBeenCalledWith(a.scene);
    releaseAvatar(a2);
    // 重复释放无副作用
    releaseAvatar(a2);
    expect(deepDispose).toHaveBeenCalledTimes(1);
  });
});
