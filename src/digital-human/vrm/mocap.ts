/**
 * vrm/mocap.ts — 真人动捕的走 / 跑 / 待机(CMU 动捕库,重定向到 VRM 规范化骨骼)
 *
 * 数据是离线转好的循环(scratchpad mocap/bvh2vrm.mjs):public/mocap/{walk,run,idle}.json
 *   bones[骨骼] = 每帧一个局部四元数(xyzw);hipsY = 髋的上下起伏(以腿长为单位);
 *   stride = 一个循环走多远(以腿长为单位) —— 走路时按「实际走过的距离」推进,脚不打滑。
 * 走和跑的循环都从「左大腿往前摆过中线」开始,同一个进度可以直接交叉混合。
 */

import type * as THREE from 'three';

export interface MocapClip {
  kind: string;
  fps: number;
  frames: number;
  duration: number;
  stride: number;
  hipsHeight: number;
  bones: Record<string, number[]>;
  hipsY: number[];
}

export type MocapSet = { walk: MocapClip; run: MocapClip; idle: MocapClip };

/**
 * 去掉动捕的逐帧抖:每根骨骼的四元数按时间做一遍高斯平滑(σ≈1.5 帧,30fps 下 50 毫秒)。
 * 原始 CMU 数据每帧带零点几度的噪声,帧间线性插值会原样保留,站着时整个人在细抖。
 * loop = 循环片段(首尾接着算),否则两头夹住。只在下载后做一次,结果写回 clip。
 */
export function smoothClip(clip: MocapClip, loop: boolean, sigma = 1.5): MocapClip {
  const r = Math.ceil(sigma * 2.5);
  const w: number[] = [];
  for (let d = -r; d <= r; d++) w.push(Math.exp(-(d * d) / (2 * sigma * sigma)));
  const n = clip.frames;
  const at = (i: number) => (loop ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)));
  for (const bone of Object.keys(clip.bones)) {
    const src = clip.bones[bone];
    if (!src || src.length < n * 4) continue;
    const out = new Array<number>(n * 4);
    for (let i = 0; i < n; i++) {
      const cx = src[i * 4], cy = src[i * 4 + 1], cz = src[i * 4 + 2], cw = src[i * 4 + 3];
      let x = 0, y = 0, z = 0, ww = 0;
      for (let d = -r; d <= r; d++) {
        const j = at(i + d) * 4;
        let qx = src[j], qy = src[j + 1], qz = src[j + 2], qw = src[j + 3];
        if (qx * cx + qy * cy + qz * cz + qw * cw < 0) { qx = -qx; qy = -qy; qz = -qz; qw = -qw; } // 同一半球再平均
        const k = w[d + r];
        x += qx * k; y += qy * k; z += qz * k; ww += qw * k;
      }
      const len = Math.hypot(x, y, z, ww) || 1;
      out[i * 4] = x / len; out[i * 4 + 1] = y / len; out[i * 4 + 2] = z / len; out[i * 4 + 3] = ww / len;
    }
    clip.bones[bone] = out;
  }
  if (clip.hipsY?.length === n) {
    const src = clip.hipsY;
    clip.hipsY = src.map((_, i) => {
      let s = 0, ks = 0;
      for (let d = -r; d <= r; d++) { s += src[at(i + d)] * w[d + r]; ks += w[d + r]; }
      return s / ks;
    });
  }
  return clip;
}

let pending: Promise<MocapSet | null> | null = null;

/** 三段动作只下一次(约 110 KB,随前端发) */
export function loadMocap(base = '/mocap'): Promise<MocapSet | null> {
  if (!pending) {
    const get = (n: string) => fetch(`${base}/${n}.json`).then((r) => (r.ok ? r.json() as Promise<MocapClip> : Promise.reject(new Error(n))));
    pending = Promise.all([get('walk'), get('run'), get('idle')])
      .then(([walk, run, idle]) => ({ walk: smoothClip(walk, true), run: smoothClip(run, true), idle: smoothClip(idle, true) }))
      .catch(() => null);
  }
  return pending;
}

/** 在循环里取进度 u(0..1)处的四元数,帧间球面插值;结果写进 out */
export function sampleBone(THREE_NS: typeof THREE, clip: MocapClip, bone: string, u: number, out: THREE.Quaternion, tmp: THREE.Quaternion): boolean {
  const arr = clip.bones[bone];
  if (!arr) return false;
  const f = (((u % 1) + 1) % 1) * clip.frames;
  const i0 = Math.floor(f) % clip.frames;
  const i1 = (i0 + 1) % clip.frames;
  const k = f - Math.floor(f);
  out.set(arr[i0 * 4], arr[i0 * 4 + 1], arr[i0 * 4 + 2], arr[i0 * 4 + 3]);
  tmp.set(arr[i1 * 4], arr[i1 * 4 + 1], arr[i1 * 4 + 2], arr[i1 * 4 + 3]);
  out.slerp(tmp, k);
  void THREE_NS;
  return true;
}

export function sampleHipsY(clip: MocapClip, u: number): number {
  const f = (((u % 1) + 1) % 1) * clip.frames;
  const i0 = Math.floor(f) % clip.frames;
  const i1 = (i0 + 1) % clip.frames;
  const k = f - Math.floor(f);
  return clip.hipsY[i0] * (1 - k) + clip.hipsY[i1] * k;
}

/**
 * 哪些动作有真人动捕:鞠躬(CMU 111_02)、说话比划(CMU 18_08 里手臂动得最多的 6 秒,循环)。
 * upper = 只用上半身(CMU 的鞠躬是舞台谢幕式的,一条腿往后伸得很远 —— 腿留着站姿,只借弯腰和手臂);
 * strength = 叠上去的强度(1 = 原样)。
 */
export const MOCAP_ACTIONS: Record<string, { file: string; loop: boolean; upper?: boolean; strength?: number }> = {
  bow: { file: 'bow', loop: false, upper: true, strength: 0.75 },
  greet: { file: 'bow', loop: false, upper: true, strength: 0.6 },
  talk: { file: 'talk', loop: true },
  explain: { file: 'talk', loop: true },
};
const actionCache = new Map<string, Promise<MocapClip | null>>();
/** 动作片段按需下载(各 50–90 KB) */
export function loadActionClip(name: string, base = '/mocap'): Promise<MocapClip | null> {
  const a = MOCAP_ACTIONS[name];
  if (!a) return Promise.resolve(null);
  let p = actionCache.get(a.file);
  if (!p) {
    p = fetch(`${base}/${a.file}.json`).then((r) => (r.ok ? r.json() as Promise<MocapClip> : null)).then((c) => (c ? smoothClip(c, a.loop) : null)).catch(() => null);
    actionCache.set(a.file, p);
  }
  return p;
}

export const MOCAP_UPPER = new Set(['spine', 'chest', 'neck', 'head', 'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand']);

export const MOCAP_BONES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
] as const;
