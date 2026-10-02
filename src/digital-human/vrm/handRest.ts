/**
 * vrm/handRest.ts — 手指自然放松
 *
 * VRM 的手默认是 T 字站姿里绷直张开的五指,垂着手站的时候看着像假手。这里给每根手指一个放松时的微弯
 * (规范化骨骼:左臂沿 +X、掌心朝 -Y,往掌心弯 = 绕 Z 负转;右手反过来),拇指往掌心收一点。
 * 每帧在 idle 之后、动作之前写一遍(是「设」不是「加」,不会越叠越弯);动作要摆手指的照样能盖过去。
 */

type Node = { rotation: { x: number; y: number; z: number } } | null | undefined;

// [近节, 中节, 远节] 弯多少(弧度);小指无名指弯得多一点,食指少一点
const CURL: Record<string, [number, number, number]> = {
  Index: [0.18, 0.28, 0.2],
  Middle: [0.24, 0.36, 0.24],
  Ring: [0.3, 0.42, 0.28],
  Little: [0.36, 0.46, 0.3],
};
const SEG = ['Proximal', 'Intermediate', 'Distal'] as const;

/** amount 0..1:1 = 完全放松的弯度 */
export function relaxHands(bone: (name: string) => Node, amount = 1) {
  if (amount <= 0) return;
  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1;
    for (const [finger, curl] of Object.entries(CURL)) {
      SEG.forEach((seg, i) => {
        const n = bone(`${side}${finger}${seg}`);
        if (n) { n.rotation.x = 0; n.rotation.y = 0; n.rotation.z = sign * curl[i] * amount; }
      });
    }
    // 拇指:往掌心收、微弯
    const tp = bone(`${side}ThumbProximal`), td = bone(`${side}ThumbDistal`), tm = bone(`${side}ThumbMetacarpal`);
    if (tm) { tm.rotation.x = 0; tm.rotation.y = sign * -0.25 * amount; tm.rotation.z = 0; }
    if (tp) { tp.rotation.x = 0; tp.rotation.y = sign * -0.15 * amount; tp.rotation.z = sign * 0.1 * amount; }
    if (td) { td.rotation.x = 0; td.rotation.y = sign * -0.2 * amount; td.rotation.z = 0; }
  }
}
