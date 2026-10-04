/**
 * vrm/world/interact.ts — 点一件东西会怎样(世界模型里的两条「定律」)
 *
 *   - interactOf:按服务端算好的属性 —— sittable(seat 原型,椅子、凳子、沙发……哪些素材默认是座位是原型上的 match 数据)
 *     就坐下;usable(挂着 use 规则,灯的开关也是规则)就交给服务端跑规则。两个都有:坐下,同时触发 use;
 *   - 坐姿:规范化骨骼上直接摆(upperLeg X− = 大腿往前抬,lowerLeg X+ = 屈膝,手搭在腿上),
 *     髋往下沉到座面上;自己(useVrmAnimation)和同伴(peerAvatars)用同一份;
 *   - 选座位:一件摆设可能有好几个座位(长沙发、长椅),挑离点的地方最近、没人坐的那个。
 *
 * 坐着时位置帧里 a = 'sit'、y = 座面离地多高;同伴那边把人放在座面高度,照着画坐姿。
 */

import type * as THREE from 'three';

/** seat 能坐(sittable)/ use 点了交给服务端跑规则(usable) */
export type Interact = 'seat' | 'use';

/** 这件东西点了会怎样(null = 只是摆着看) */
export function interactOf(props: { sittable?: unknown; usable?: unknown } | null | undefined): Interact | null {
  if (props?.sittable) return 'seat';
  if (props?.usable) return 'use';
  return null;
}

/** 一个座位:人坐下时脚下(根)的位置、朝向,座面离地多高;approach = 走过去时停在哪 */
export interface SeatSpot {
  x: number;
  z: number;
  /** 座面离地(米) */
  y: number;
  yaw: number;
  approach: { x: number; z: number };
}

/** 有人坐着的位置(同伴 a = 'sit') */
export interface Sitter { x: number; z: number }

/** 挑一个座位:没人坐的里面离 near 最近的;都坐满了返回 null */
export function pickSeat(spots: readonly SeatSpot[], sitters: readonly Sitter[], near: { x: number; z: number }): SeatSpot | null {
  let best: SeatSpot | null = null;
  let bestD = Infinity;
  for (const s of spots) {
    if (sitters.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < 0.3)) continue;
    const d = Math.hypot(s.x - near.x, s.z - near.z);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/** 一件摆设横着能坐几个人(宽度 → 每人 0.55 米,最多 4 个) */
export function seatCount(width: number): number {
  if (width < 1.1) return 1;
  return Math.max(1, Math.min(4, Math.floor(width / 0.55)));
}

/** 射线量不到座面时按高度估:矮的(凳子、脚凳)座面就是顶,高的取四成五,夹在 0.38–0.52 米 */
export function guessSeatHeight(height: number): number {
  if (height <= 0.65) return Math.max(0.15, height);
  return Math.max(0.38, Math.min(0.52, height * 0.45));
}

/** 坐姿(规范化骨骼的欧拉角,弧度) */
const SIT_POSE: Record<string, [number, number, number]> = {
  leftUpperLeg: [-1.48, 0, 0.06],
  rightUpperLeg: [-1.48, 0, -0.06],
  leftLowerLeg: [1.5, 0, 0],
  rightLowerLeg: [1.5, 0, 0],
  leftFoot: [-0.05, 0, 0],
  rightFoot: [-0.05, 0, 0],
  spine: [-0.04, 0, 0],
  chest: [0.02, 0, 0],
  leftUpperArm: [-0.6, 0, -1.35],
  rightUpperArm: [-0.6, 0, 1.35],
  leftLowerArm: [0, -0.55, 0],
  rightLowerArm: [0, 0.55, 0],
};
export const SIT_BONES = Object.keys(SIT_POSE);

const quatCache = new WeakMap<object, Map<string, THREE.Quaternion>>();
function sitQuat(THREE_NS: typeof THREE, bone: string): THREE.Quaternion {
  let m = quatCache.get(THREE_NS);
  if (!m) {
    m = new Map();
    for (const [b, [x, y, z]] of Object.entries(SIT_POSE)) m.set(b, new THREE_NS.Quaternion().setFromEuler(new THREE_NS.Euler(x, y, z, 'XYZ')));
    quatCache.set(THREE_NS, m);
  }
  return m.get(bone)!;
}

/** 把骨骼往坐姿上拧 w(0 = 不动,1 = 完全坐下) */
export function applySitPose(THREE_NS: typeof THREE, bone: (name: string) => THREE.Object3D | null | undefined, w: number) {
  if (w <= 0.001) return;
  for (const b of SIT_BONES) {
    const node = bone(b);
    if (node) node.quaternion.slerp(sitQuat(THREE_NS, b), Math.min(1, w));
  }
}

/** 坐下时髋要往下沉多少(米,世界单位):站着时髋离脚底 hipHeight,坐下后髋在座面上方 8 厘米 */
export function sitDrop(hipHeight: number, seatAboveRoot: number): number {
  return Math.max(0, hipHeight - seatAboveRoot - 0.08);
}
