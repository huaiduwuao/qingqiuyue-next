/**
 * vrm/loadAvatar.ts — VRM 加载层（解耦复用）
 *
 * 把 BlenderAvatar 的 module-level cache + loadAvatar 抽出来。
 * VrmStage 复用同一份缓存与加载逻辑。
 *
 * 关键改动（相对原 BlenderAvatar:119-158）:
 *   - opts.rotateVRM0 默认 true（修 BlenderAvatar 对 VRM 0.0 的潜在 bug）
 *   - opts.removeUnnecessaryJoints 默认 true（去除冗余关节，性能更好）
 *   - 错误信息中性化（不只是 BlenderAvatar 用，VrmStage 也要用）
 */

import * as THREE_VRM from '@pixiv/three-vrm';

type MorphEntry = { mesh: any; indices: Record<string, number> };

export type Cached = {
  url: string;
  scene: any;
  vrm: any;
  morphs: Record<string, MorphEntry>;
  expressionManager: any;
  humanoid: any;
  animations: any[];
};

const cache = new Map<string, Cached>();
let inflight: { url: string; promise: Promise<Cached> } | null = null;

export interface LoadAvatarOptions {
  /** VRM 0.0 模型需要绕 Y 轴 180° 才正面朝相机（默认 true） */
  rotateVRM0?: boolean;
  /** 去除冗余关节（默认 true） */
  removeUnnecessaryJoints?: boolean;
}

export async function loadAvatar(url: string, opts: LoadAvatarOptions = {}): Promise<Cached> {
  const { rotateVRM0 = true, removeUnnecessaryJoints = true } = opts;

  const cacheKey = `${url}::r${rotateVRM0 ? 1 : 0}::j${removeUnnecessaryJoints ? 1 : 0}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  if (inflight && inflight.url === cacheKey) return inflight.promise;

  const promise = (async () => {
    if (!url.endsWith('.vrm')) {
      throw new Error(`loadAvatar: 只支持 .vrm 格式 (${url} 不是)。请把角色放到 public/avatars/character.vrm`);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
    const loader = new GLTFLoader();
    loader.register((parser: any) => new THREE_VRM.VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(buf.buffer, '');
    const vrm = gltf.userData.vrm;
    if (!vrm) throw new Error(`VRM 解析失败: ${url}`);

    // 检测 VRM 版本
    const metaVersion: string = (vrm.meta as any)?.metaVersion || '1';
    const isVRM0 = String(metaVersion).startsWith('0');
    console.log('[loadAvatar] VRM 版本:', metaVersion, isVRM0 ? '(0.0 — 需要 rotateVRM0)' : '(1.0+ — 不旋转)');

    // 仅当确实是 VRM 0.0 时才 rotateVRM0（VRM 1.0 自然朝 +Z）
    if (rotateVRM0 && isVRM0) {
      try { THREE_VRM.VRMUtils.rotateVRM0(vrm); } catch (e) { console.warn('[loadAvatar] rotateVRM0 failed', e); }
    }
    if (removeUnnecessaryJoints) {
      try { THREE_VRM.VRMUtils.removeUnnecessaryJoints(vrm.scene); }
      catch (e) { console.warn('[loadAvatar] removeUnnecessaryJoints failed (deprecated in 3.x)', e); }
    }

    // 索引 morphTargetDictionary（兼容 0.0 老格式 / 非 VRM 表情通道的 morph）
    const morphs: Record<string, MorphEntry> = {};
    vrm.scene.traverse((obj: any) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        const dict = obj.morphTargetDictionary;
        if (dict) morphs[obj.name] = { mesh: obj, indices: { ...dict } };
      }
    });

    const result: Cached = {
      url,
      scene: vrm.scene,
      vrm,
      morphs,
      expressionManager: vrm.expressionManager,
      humanoid: vrm.humanoid,
      animations: gltf.animations || [],
    };
    cache.set(cacheKey, result);
    return result;
  })();

  inflight = { url: cacheKey, promise };
  try { return await promise; }
  finally { inflight = null; }
}

/** 清空缓存（用于"重新加载模型"按钮） */
export function clearAvatarCache(url?: string) {
  if (!url) { cache.clear(); return; }
  for (const k of cache.keys()) {
    if (k.startsWith(url + '::')) cache.delete(k);
  }
}
