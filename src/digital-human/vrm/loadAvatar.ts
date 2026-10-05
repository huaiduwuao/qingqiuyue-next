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
 *
 * 缓存:小 LRU + 引用计数(以前是只增不减的 Map,换过几次装后所有模型的几何/贴图都常驻显存)。
 *   - acquireAvatar 取模型并 +1 引用;组件卸载时先把 scene 从自己的场景摘下,再 releaseAvatar。
 *   - 超过 AVATAR_CACHE_CAPACITY 时,只淘汰引用为 0 的最久未用条目并 VRMUtils.deepDispose;
 *     还被引用(在某个场景里)的模型绝不释放,哪怕暂时超出容量。
 *   - 同一页面里反复挂载同一个模型仍然直接复用(引用为 0 的条目留在缓存里,直到被挤出)。
 */

import type * as THREE from 'three';
import type { GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE_VRM from '@pixiv/three-vrm';

type MorphEntry = { mesh: THREE.Mesh; indices: Record<string, number> };

export type Cached = {
  url: string;
  scene: THREE.Group;
  vrm: THREE_VRM.VRM;
  morphs: Record<string, MorphEntry>;
  expressionManager: THREE_VRM.VRMExpressionManager | undefined;
  humanoid: THREE_VRM.VRMHumanoid;
  animations: THREE.AnimationClip[];
};

/** 引用为 0 时最多留几个模型在缓存里(常见场景:当前模型 + 刚换下的一个) */
export const AVATAR_CACHE_CAPACITY = 2;

type Entry = {
  data: Cached;
  /** 正在使用它的组件数 */
  refs: number;
  /** 已被 clearAvatarCache 移出缓存,最后一个使用者释放时 dispose */
  stale: boolean;
  disposed: boolean;
};

/** Map 的插入顺序即 LRU 顺序:最久未用的在最前 */
const cache = new Map<string, Entry>();
const byData = new Map<Cached, Entry>();
const inflight = new Map<string, Promise<Entry>>();

function disposeEntry(e: Entry) {
  if (e.disposed) return;
  e.disposed = true;
  byData.delete(e.data);
  try {
    THREE_VRM.VRMUtils.deepDispose(e.data.scene);
  } catch (err) {
    console.warn('[loadAvatar] deepDispose failed', err);
  }
}

/** 超出容量时从最久未用的开始淘汰,只动引用为 0 的 */
function evict() {
  if (cache.size <= AVATAR_CACHE_CAPACITY) return;
  for (const [k, e] of cache) {
    if (cache.size <= AVATAR_CACHE_CAPACITY) break;
    if (e.refs > 0) continue;
    cache.delete(k);
    disposeEntry(e);
  }
}

export interface LoadAvatarOptions {
  /**
   * VRM 0.0 模型需要绕 Y 轴 180° 才正面朝相机。
   * 默认 false：项目 character.vrm 实际朝向就是 +Z（虽然注释写 0.0），强制 rotate 会把模型转成背对相机。
   * 如果你换了一个真正 VRM 0.0 且朝 -Z 的模型，把这个开关打开。
   */
  rotateVRM0?: boolean;
  /** 去除冗余关节（默认 true） */
  removeUnnecessaryJoints?: boolean;
}

/**
 * 取模型并占用一个引用。用完(卸载、换模型)必须先从场景摘下 scene,再 releaseAvatar(返回值);
 * 拿到时组件已取消的,也要立刻 release。
 */
export async function acquireAvatar(url: string, opts: LoadAvatarOptions = {}): Promise<Cached> {
  const { rotateVRM0 = false, removeUnnecessaryJoints = true } = opts;
  const cacheKey = `${url}::r${rotateVRM0 ? 1 : 0}::j${removeUnnecessaryJoints ? 1 : 0}`;

  for (;;) {
    let entry = cache.get(cacheKey);
    if (!entry) {
      let p = inflight.get(cacheKey);
      if (!p) {
        p = loadEntry(url, cacheKey, rotateVRM0, removeUnnecessaryJoints);
        inflight.set(cacheKey, p);
        const clear = () => inflight.delete(cacheKey);
        p.then(clear, clear);
      }
      entry = await p;
      // await 期间(引用还是 0)可能被别人的 release 挤出缓存并释放了:重新取
      if (entry.disposed) continue;
    }
    entry.refs += 1;
    if (!entry.stale) {
      // 挪到 LRU 队尾
      cache.delete(cacheKey);
      cache.set(cacheKey, entry);
    }
    evict();
    return entry.data;
  }
}

/** 释放 acquireAvatar 占用的引用。调用前 scene 必须已经从场景里摘下。 */
export function releaseAvatar(data: Cached | null | undefined) {
  if (!data) return;
  const e = byData.get(data);
  if (!e || e.refs <= 0) return;
  e.refs -= 1;
  if (e.refs === 0 && e.stale) disposeEntry(e);
  evict();
}

async function loadEntry(url: string, cacheKey: string, rotateVRM0: boolean, removeUnnecessaryJoints: boolean): Promise<Entry> {
  if (!url.endsWith('.vrm')) {
    throw new Error(`loadAvatar: 只支持 .vrm 格式 (${url} 不是)。请把角色放到 public/avatars/character.vrm`);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
  const loader = new GLTFLoader();
  loader.register((parser: GLTFParser) => new THREE_VRM.VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(buf.buffer, '');
  const vrm = gltf.userData.vrm as THREE_VRM.VRM | undefined;
  if (!vrm) throw new Error(`VRM 解析失败: ${url}`);

  // 检测 VRM 版本（仅打 log，不强制旋转 — 实际朝向以模型文件为准）
  const metaVersion: string = vrm.meta?.metaVersion || 'unknown';
  console.log('[loadAvatar] VRM metaVersion:', metaVersion, '| rotateVRM0:', rotateVRM0);

  if (rotateVRM0) {
    try { THREE_VRM.VRMUtils.rotateVRM0(vrm); } catch (e) { console.warn('[loadAvatar] rotateVRM0 failed', e); }
  }
  if (removeUnnecessaryJoints) {
    try { THREE_VRM.VRMUtils.removeUnnecessaryJoints(vrm.scene); }
    catch (e) { console.warn('[loadAvatar] removeUnnecessaryJoints failed (deprecated in 3.x)', e); }
  }

  // 索引 morphTargetDictionary（兼容 0.0 老格式 / 非 VRM 表情通道的 morph）
  const morphs: Record<string, MorphEntry> = {};
  vrm.scene.traverse((o) => {
    const obj = o as THREE.Mesh & { isSkinnedMesh?: boolean };
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
  const entry: Entry = { data: result, refs: 0, stale: false, disposed: false };
  cache.set(cacheKey, entry);
  byData.set(result, entry);
  return entry;
}

/**
 * 清空缓存（用于"重新加载模型"按钮）:下次 acquire 重新下载解析。
 * 没人用的立刻释放;还在场景里的只移出缓存,等最后一个使用者 release 时再释放。
 */
export function clearAvatarCache(url?: string) {
  for (const [k, e] of cache) {
    if (url && !k.startsWith(url + '::')) continue;
    cache.delete(k);
    if (e.refs === 0) disposeEntry(e);
    else e.stale = true;
  }
}
