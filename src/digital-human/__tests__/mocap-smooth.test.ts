import { describe, expect, it } from 'vitest';
import { smoothClip, type MocapClip } from '../vrm/mocap';
import { relaxHands } from '../vrm/handRest';

// 一根骨骼绕 X 慢慢转,每帧再加 ±0.6° 的噪声(像原始动捕)
function noisyClip(n = 60): MocapClip {
  const q: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.sin((i / n) * Math.PI * 2) * 0.3 + (i % 2 ? 0.01 : -0.01);
    q.push(Math.sin(a / 2), 0, 0, Math.cos(a / 2));
  }
  return { kind: 'idle', fps: 30, frames: n, duration: n / 30, stride: 0, hipsHeight: 1, bones: { hips: q }, hipsY: Array.from({ length: n }, (_, i) => (i % 2 ? 0.01 : -0.01)) };
}
const angle = (c: MocapClip, i: number) => 2 * Math.asin(c.bones.hips[i * 4]);
const jitter = (c: MocapClip) => {
  let e = 0;
  for (let i = 1; i < c.frames - 1; i++) e += Math.abs(angle(c, i + 1) - 2 * angle(c, i) + angle(c, i - 1));
  return e / (c.frames - 2);
};

describe('mocap smoothing', () => {
  it('takes the per-frame noise out but keeps the motion', () => {
    const raw = noisyClip();
    const before = jitter(raw);
    const s = smoothClip(noisyClip(), true);
    expect(jitter(s)).toBeLessThan(before / 5);
    // 慢动作还在:峰值没被抹平太多
    const peak = Math.max(...Array.from({ length: s.frames }, (_, i) => angle(s, i)));
    expect(peak).toBeGreaterThan(0.25);
    // 循环:首尾接得上(第 0 帧和最后一帧的差和中间相邻帧一个量级)
    expect(Math.abs(angle(s, 0) - angle(s, s.frames - 1))).toBeLessThan(0.05);
    // 四元数还是单位长度
    const [x, y, z, w] = s.bones.hips.slice(0, 4);
    expect(Math.hypot(x, y, z, w)).toBeCloseTo(1, 6);
    expect(Math.max(...s.hipsY.map(Math.abs))).toBeLessThan(0.005);
  });

  it('relaxes the fingers toward the palm, left and right mirrored', () => {
    const bones: Record<string, { rotation: { x: number; y: number; z: number } }> = {};
    const get = (n: string) => (bones[n] ??= { rotation: { x: 0.5, y: 0.5, z: 0 } });
    relaxHands(get);
    expect(bones.leftIndexProximal.rotation.z).toBeLessThan(0);
    expect(bones.rightIndexProximal.rotation.z).toBeGreaterThan(0);
    expect(bones.leftLittleIntermediate.rotation.z).toBeLessThan(bones.leftIndexIntermediate.rotation.z); // 小指弯得多
    expect(bones.leftIndexProximal.rotation.x).toBe(0); // 是「设」不是「加」
  });
});
