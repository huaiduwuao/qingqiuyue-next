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

let pending: Promise<MocapSet | null> | null = null;

/** 三段动作只下一次(约 110 KB,随前端发) */
export function loadMocap(base = '/mocap'): Promise<MocapSet | null> {
  if (!pending) {
    const get = (n: string) => fetch(`${base}/${n}.json`).then((r) => (r.ok ? r.json() as Promise<MocapClip> : Promise.reject(new Error(n))));
    pending = Promise.all([get('walk'), get('run'), get('idle')])
      .then(([walk, run, idle]) => ({ walk, run, idle }))
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

export const MOCAP_BONES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
] as const;
