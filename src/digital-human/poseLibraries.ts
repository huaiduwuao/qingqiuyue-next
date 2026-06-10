/**
 * 动作姿态库 —— 把 AvatarAction 映射到 SMPL-X axis-angle 关键帧序列。
 *
 * 关键帧格式: [t, joint0_rotX, joint0_rotY, joint0_rotZ, joint1_rotX, ...]
 *   - t: 时间(秒,从动作开始计)
 *   - 每个 keyJoint 一组 [rx, ry, rz](axis-angle 弧度)
 *   - 未列出的关节保持 0(rest 姿态)
 *
 * 当前仅驱动 5 个关键关节(全身 24 个动作里 5 个最显眼):
 *   0 pelvis(整体朝向)   6 spine2(上身侧倾)  9 spine3(上身俯仰)
 *   12 neck(头)          16 right_shoulder/upper_arm(右臂)  18 right_forearm(右前臂)
 *   SMPL-X 标准 55 关节;pose 数组总长 = jointCount * 3 = 165
 *
 * 轴-角方向约定(以 z 朝前、y 朝上为标准 SMPL):
 *   - 绕 X 抬头/低头(spine3 rx > 0 抬头)
 *   - 绕 Y 整体左右转(pelvis ry > 0 转向身体左)
 *   - 绕 Z 侧倾(spine2 rz > 0 身体向右倾)
 *
 * 注:实际值是经验值,要更准得用对应数据集拟合;这里追求"肉眼可见"。
 */
import type { AvatarAction } from './types';

export type KeyJoint = 0 | 6 | 9 | 12 | 16 | 18;
const KEY_JOINTS: KeyJoint[] = [0, 6, 9, 12, 16, 18];
const JOINT_COUNT = 55;

export interface PoseKeyframe {
  t: number;
  /** 仅 KEY_JOINTS 的 rx,ry,rz(按 KEY_JOINTS 顺序) */
  rot: number[];
}
export interface ActionPoseClip {
  loop: boolean;
  keyframes: PoseKeyframe[];
  /** 给定 t,返回完整 165 维 axis-angle 数组 */
  sample(t: number): number[];
}

function makeSampler(keyframes: PoseKeyframe[], loop: boolean): (t: number) => number[] {
  if (keyframes.length === 0) return () => new Array(JOINT_COUNT * 3).fill(0);
  return (t: number) => {
    const n = keyframes.length;
    let i = 0;
    if (loop && keyframes[n - 1].t > 0) {
      const T = keyframes[n - 1].t;
      t = ((t % T) + T) % T;
    }
    while (i < n - 1 && keyframes[i + 1].t < t) i++;
    const a = keyframes[i];
    const b = keyframes[Math.min(i + 1, n - 1)];
    const span = b.t - a.t;
    const u = span > 0 ? Math.max(0, Math.min(1, (t - a.t) / span)) : 0;
    // 线性插值每个 KEY_JOINT 的 rx/ry/rz
    const out = new Array(JOINT_COUNT * 3).fill(0);
    for (let k = 0; k < KEY_JOINTS.length; k++) {
      const j = KEY_JOINTS[k];
      for (let c = 0; c < 3; c++) {
        const va = a.rot[k * 3 + c] ?? 0;
        const vb = b.rot[k * 3 + c] ?? 0;
        out[j * 3 + c] = va + (vb - va) * u;
      }
    }
    return out;
  };
}

/** 静态姿态(单帧 1.2s,然后保持)— 用于 greet / point / sit / thinking / dance / sing */
const STATIC: ActionPoseClip = {
  loop: false,
  keyframes: [{ t: 0, rot: new Array(KEY_JOINTS.length * 3).fill(0) }],
  sample: () => new Array(JOINT_COUNT * 3).fill(0),
};

// 各动作的姿态片段(数值都是经验值,角度以弧度计)
const CLIPS: Record<AvatarAction, ActionPoseClip | null> = {
  // 站立:轻微呼吸 + 头微动
  idle: {
    loop: true,
    keyframes: [
      { t: 0,  rot: [0, 0, 0,   0, 0, 0,    0.02, 0, 0,    0.02, 0, 0,    0, 0, 0,    0] },
      { t: 1.5, rot: [0, 0, 0,   0, 0, 0,   -0.02, 0, 0,   -0.02, 0, 0,   0, 0, 0,    0] },
      { t: 3.0, rot: [0, 0, 0,   0, 0, 0,    0.02, 0, 0,    0.02, 0, 0,    0, 0, 0,    0] },
    ],
    sample: makeSampler([
      { t: 0,    rot: [0, 0, 0,   0, 0, 0,    0.02, 0, 0,    0.02, 0, 0,    0, 0, 0,    0] },
      { t: 1.5,  rot: [0, 0, 0,   0, 0, 0,   -0.02, 0, 0,   -0.02, 0, 0,    0, 0, 0,    0] },
      { t: 3.0,  rot: [0, 0, 0,   0, 0, 0,    0.02, 0, 0,    0.02, 0, 0,    0, 0, 0,    0] },
    ], true),
  },
  // 讲话:跟 idle 差不多,头更活跃
  speaking: {
    loop: true,
    keyframes: [
      { t: 0,    rot: [0, 0, 0,    0, 0, 0,    0.03, 0, 0,     0.05, 0, 0,   0, 0, 0,    0] },
      { t: 0.4,  rot: [0, 0, 0,    0, 0, 0,   -0.02, 0, 0,    -0.03, 0, 0,   0, 0, 0,    0] },
      { t: 0.8,  rot: [0, 0, 0,    0, 0, 0,    0.04, 0, 0,     0.05, 0, 0,   0, 0, 0,    0] },
      { t: 1.2,  rot: [0, 0, 0,    0, 0, 0,   -0.03, 0, 0,    -0.05, 0, 0,   0, 0, 0,    0] },
    ],
    sample: makeSampler([
      { t: 0,    rot: [0, 0, 0,    0, 0, 0,    0.03, 0, 0,     0.05, 0, 0,   0, 0, 0,    0] },
      { t: 0.4,  rot: [0, 0, 0,    0, 0, 0,   -0.02, 0, 0,    -0.03, 0, 0,   0, 0, 0,    0] },
      { t: 0.8,  rot: [0, 0, 0,    0, 0, 0,    0.04, 0, 0,     0.05, 0, 0,   0, 0, 0,    0] },
      { t: 1.2,  rot: [0, 0, 0,    0, 0, 0,   -0.03, 0, 0,    -0.05, 0, 0,   0, 0, 0,    0] },
    ], true),
  },
  // 思考:头低、偏一侧
  thinking: {
    loop: false,
    keyframes: [
      { t: 0,   rot: [0, 0, 0,    0, 0, 0.08,    0.10, 0, 0,   0.15, 0.10, 0,   -0.3, -0.4, 0,    0.6] },
      { t: 1.5, rot: [0, 0, 0,    0, 0, 0.08,    0.10, 0, 0,   0.15, 0.10, 0,   -0.3, -0.4, 0,    0.6] },
    ],
    sample: makeSampler([
      { t: 0,   rot: [0, 0, 0,    0, 0, 0.08,    0.10, 0, 0,   0.15, 0.10, 0,   -0.3, -0.4, 0,    0.6] },
      { t: 1.5, rot: [0, 0, 0,    0, 0, 0.08,    0.10, 0, 0,   0.15, 0.10, 0,   -0.3, -0.4, 0,    0.6] },
    ], false),
  },
  // 打招呼:右臂抬起,轻微摆动
  greet: {
    loop: false,
    keyframes: [
      { t: 0,    rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.5, 0, 0,   -0.6] },
      { t: 0.5,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.4, 0.3, 0,  -0.5] },
      { t: 1.0,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.5, -0.3, 0, -0.5] },
      { t: 1.5,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.4, 0.3, 0,  -0.5] },
    ],
    sample: makeSampler([
      { t: 0,    rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.5, 0, 0,    -0.6] },
      { t: 0.5,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.4, 0.3, 0,  -0.5] },
      { t: 1.0,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.5, -0.3, 0, -0.5] },
      { t: 1.5,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.4, 0.3, 0,  -0.5] },
    ], false),
  },
  // 挥手:同 greet,但循环
  wave: {
    loop: true,
    keyframes: [
      { t: 0,    rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.5, 0, 0,    -0.6] },
      { t: 0.4,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.4, 0.6, 0,  -0.5] },
      { t: 0.8,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.5, -0.6, 0, -0.5] },
      { t: 1.2,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.4, 0.6, 0,  -0.5] },
    ],
    sample: makeSampler([
      { t: 0,    rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.5, 0, 0,    -0.6] },
      { t: 0.4,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.4, 0.6, 0,  -0.5] },
      { t: 0.8,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.5, -0.6, 0, -0.5] },
      { t: 1.2,  rot: [0, 0, 0,   0, 0, 0,    0, 0, 0,   0, 0, 0,    -1.4, 0.6, 0,  -0.5] },
    ], true),
  },
  // 指向:右臂前伸
  point: {
    loop: false,
    keyframes: [
      { t: 0,   rot: [0, 0, 0,    0, 0, 0,    0, 0, 0,    0.05, 0, 0,   -1.5, 0, 0,   -0.3] },
      { t: 0.3, rot: [0, 0, 0,    0, 0, 0,    0, 0, 0,    0.05, 0, 0,   -1.6, 0, 0,   -0.1] },
    ],
    sample: makeSampler([
      { t: 0,   rot: [0, 0, 0,    0, 0, 0,    0, 0, 0,    0.05, 0, 0,   -1.5, 0, 0,   -0.3] },
      { t: 0.3, rot: [0, 0, 0,    0, 0, 0,    0, 0, 0,    0.05, 0, 0,   -1.6, 0, 0,   -0.1] },
    ], false),
  },
  // 走路:左右胯交替 + 上下颠
  walk: {
    loop: true,
    keyframes: [
      { t: 0.0,  rot: [0, 0, 0.0,   0, 0, 0.05,   0, 0, 0,   0, 0, 0,    -0.2, 0, 0,    -0.2] },
      { t: 0.3,  rot: [0, 0, 0.0,   0, 0, -0.05,  0, 0, 0,   0, 0, 0,     0.2, 0, 0,     0.2] },
      { t: 0.6,  rot: [0, 0, 0.0,   0, 0, 0.05,   0, 0, 0,   0, 0, 0,    -0.2, 0, 0,    -0.2] },
    ],
    sample: makeSampler([
      { t: 0.0,  rot: [0, 0, 0.0,   0, 0, 0.05,   0, 0, 0,   0, 0, 0,    -0.2, 0, 0,    -0.2] },
      { t: 0.3,  rot: [0, 0, 0.0,   0, 0, -0.05,  0, 0, 0,   0, 0, 0,     0.2, 0, 0,     0.2] },
      { t: 0.6,  rot: [0, 0, 0.0,   0, 0, 0.05,   0, 0, 0,   0, 0, 0,    -0.2, 0, 0,    -0.2] },
    ], true),
  },
  // 跳舞:双肩上抬 + 身体扭
  dance: {
    loop: true,
    keyframes: [
      { t: 0,   rot: [0, 0, 0.15,   0, 0, 0.10,    0, 0, 0,    0, 0, 0,    -1.6, 0.4, 0,   -0.4] },
      { t: 0.5, rot: [0, 0, -0.15,  0, 0, -0.10,   0, 0, 0,    0, 0, 0,    -1.6, -0.4, 0,  -0.4] },
      { t: 1.0, rot: [0, 0, 0.15,   0, 0, 0.10,    0, 0, 0,    0, 0, 0,    -1.6, 0.4, 0,   -0.4] },
    ],
    sample: makeSampler([
      { t: 0,   rot: [0, 0, 0.15,   0, 0, 0.10,    0, 0, 0,    0, 0, 0,    -1.6, 0.4, 0,   -0.4] },
      { t: 0.5, rot: [0, 0, -0.15,  0, 0, -0.10,   0, 0, 0,    0, 0, 0,    -1.6, -0.4, 0,  -0.4] },
      { t: 1.0, rot: [0, 0, 0.15,   0, 0, 0.10,    0, 0, 0,    0, 0, 0,    -1.6, 0.4, 0,   -0.4] },
    ], true),
  },
  // 唱歌:头后仰 + 嘴部大动(让 mouthOpen 走 TTS 幅度)
  sing: {
    loop: true,
    keyframes: [
      { t: 0,   rot: [0, 0, 0,   0, 0, 0,    0, 0.05, 0,    0.20, 0, 0,   -0.4, 0.5, 0,   -0.2] },
      { t: 0.8, rot: [0, 0, 0,   0, 0, 0,    0, -0.05, 0,   0.10, 0, 0,   -0.4, -0.5, 0,  -0.2] },
    ],
    sample: makeSampler([
      { t: 0,   rot: [0, 0, 0,   0, 0, 0,    0, 0.05, 0,    0.20, 0, 0,   -0.4, 0.5, 0,   -0.2] },
      { t: 0.8, rot: [0, 0, 0,   0, 0, 0,    0, -0.05, 0,   0.10, 0, 0,   -0.4, -0.5, 0,  -0.2] },
    ], true),
  },
  // 坐下:整体降低(用 spine 俯角模拟弯腰)
  sit: {
    loop: false,
    keyframes: [
      { t: 0,   rot: [0, 0, 0,    0, 0, 0,    0.4, 0, 0,    0.1, 0, 0,    0, 0, 0,    0.5] },
    ],
    sample: makeSampler([
      { t: 0,   rot: [0, 0, 0,    0, 0, 0,    0.4, 0, 0,    0.1, 0, 0,    0, 0, 0,    0.5] },
    ], false),
  },
  // 进入:走路
  enter: {
    loop: true,
    keyframes: [
      { t: 0.0, rot: [0, 0, 0.0,   0, 0, 0.05,   0, 0, 0,   0, 0, 0,    -0.2, 0, 0,    -0.2] },
      { t: 0.3, rot: [0, 0, 0.0,   0, 0, -0.05,  0, 0, 0,   0, 0, 0,     0.2, 0, 0,     0.2] },
    ],
    sample: makeSampler([
      { t: 0.0, rot: [0, 0, 0.0,   0, 0, 0.05,   0, 0, 0,   0, 0, 0,    -0.2, 0, 0,    -0.2] },
      { t: 0.3, rot: [0, 0, 0.0,   0, 0, -0.05,  0, 0, 0,   0, 0, 0,     0.2, 0, 0,     0.2] },
    ], true),
  },
  // 离开:转身 + 走
  leave: {
    loop: false,
    keyframes: [
      { t: 0,    rot: [0, 1.5, 0,   0, 0, 0,   0, 0, 0,   0, 0, 0,    0, 0, 0,    0] },
    ],
    sample: makeSampler([
      { t: 0,    rot: [0, 1.5, 0,   0, 0, 0,   0, 0, 0,   0, 0, 0,    0, 0, 0,    0] },
    ], false),
  },
};

/** 取一个动作的 pose 片段(没有就 null,FSM 用全 0 兜底) */
export function getActionPose(action: AvatarAction): ActionPoseClip | null {
  return (CLIPS as any)[action] ?? null;
}
