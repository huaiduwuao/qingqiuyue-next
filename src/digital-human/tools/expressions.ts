/**
 * 数字人表情预设库 — 52 维 ARKit Blendshape
 *
 * 这是 LLM/Hermes 工具调用 `face.setExpression` 的可选项。
 * 预设都是 0-1 权重的字典;可以整体套用 (按 intensity 缩放),
 * 也可以细粒度覆写 (customBlendshapes)。
 *
 * 设计要点:
 *   - 14 个一级情绪,涵盖最常用场景
 *   - 每个预设都用 BlenderAvatar 现有的 EXPRESSION_MAP 通过 (因为 ARKit 名 = VRM 名)
 *   - 不依赖具体 VRM 模型 — 调用方按需融合自身 ARKit 名
 */

export type ExpressionTemplateName =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'shy'
  | 'cry'
  | 'laugh'
  | 'love'
  | 'thinking'
  | 'confused'
  | 'fearful'
  | 'disgusted'
  | 'sleepy'
  | 'sleepy_tired'
  | 'smug'
  | 'worried'
  | 'excited'
  | 'bored';

export type BlendshapeDict = Record<string, number>;

export const EXPRESSION_PRESETS: Record<ExpressionTemplateName, BlendshapeDict> = {
  neutral: {},

  happy: {
    mouthSmileLeft: 0.8, mouthSmileRight: 0.8,
    cheekSquintLeft: 0.4, cheekSquintRight: 0.4,
    eyeSquintLeft: 0.3, eyeSquintRight: 0.3,
    browOuterUpLeft: 0.2, browOuterUpRight: 0.2,
    mouthDimpleLeft: 0.3, mouthDimpleRight: 0.3,
  },

  sad: {
    mouthFrownLeft: 0.7, mouthFrownRight: 0.7,
    browInnerUp: 0.6,
    eyeLookDownLeft: 0.4, eyeLookDownRight: 0.4,
    mouthStretchLeft: 0.3, mouthStretchRight: 0.3,
    browDownLeft: 0.2, browDownRight: 0.2,
  },

  angry: {
    browDownLeft: 0.8, browDownRight: 0.8,
    eyeSquintLeft: 0.5, eyeSquintRight: 0.5,
    noseSneerLeft: 0.3, noseSneerRight: 0.3,
    mouthPressLeft: 0.4, mouthPressRight: 0.4,
    jawForward: 0.2,
  },

  surprised: {
    eyeWideLeft: 0.9, eyeWideRight: 0.9,
    browOuterUpLeft: 0.8, browOuterUpRight: 0.8,
    jawOpen: 0.5,
    mouthStretchLeft: 0.4, mouthStretchRight: 0.4,
  },

  shy: {
    mouthSmileLeft: 0.5, mouthSmileRight: 0.5,
    eyeLookDownLeft: 0.6, eyeLookDownRight: 0.6,
    cheekSquintLeft: 0.2, cheekSquintRight: 0.2,
    mouthPucker: 0.2,
  },

  cry: {
    mouthFrownLeft: 0.85, mouthFrownRight: 0.85,
    browInnerUp: 0.9,
    eyeLookDownLeft: 0.7, eyeLookDownRight: 0.7,
    mouthStretchLeft: 0.6, mouthStretchRight: 0.6,
    mouthLowerDownLeft: 0.4, mouthLowerDownRight: 0.4,
    eyeSquintLeft: 0.2, eyeSquintRight: 0.2,
  },

  laugh: {
    mouthSmileLeft: 1.0, mouthSmileRight: 1.0,
    mouthOpen: 0.5,
    cheekSquintLeft: 0.7, cheekSquintRight: 0.7,
    eyeSquintLeft: 0.5, eyeSquintRight: 0.5,
    browOuterUpLeft: 0.3, browOuterUpRight: 0.3,
    mouthUpperUpLeft: 0.3, mouthUpperUpRight: 0.3,
  },

  love: {
    mouthSmileLeft: 0.7, mouthSmileRight: 0.7,
    mouthPucker: 0.4,
    browOuterUpLeft: 0.3, browOuterUpRight: 0.3,
    eyeWideLeft: 0.2, eyeWideRight: 0.2,
    cheekPuff: 0.2,
  },

  thinking: {
    eyeLookOutLeft: 0.4, eyeLookOutRight: 0.4,
    browInnerUp: 0.3,
    mouthPucker: 0.2,
  },

  confused: {
    browDownLeft: 0.4, browDownRight: 0.4,
    browInnerUp: 0.3,
    mouthFrownLeft: 0.2, mouthFrownRight: 0.2,
    eyeSquintLeft: 0.2, eyeSquintRight: 0.2,
    mouthLeft: 0.2,
  },

  fearful: {
    eyeWideLeft: 1.0, eyeWideRight: 1.0,
    browInnerUp: 0.9, browOuterUpLeft: 0.5, browOuterUpRight: 0.5,
    mouthStretchLeft: 0.5, mouthStretchRight: 0.5,
    jawOpen: 0.3,
  },

  disgusted: {
    noseSneerLeft: 0.8, noseSneerRight: 0.8,
    mouthFrownLeft: 0.5, mouthFrownRight: 0.5,
    browDownLeft: 0.3, browDownRight: 0.3,
    mouthUpperUpLeft: 0.4, mouthUpperUpRight: 0.4,
  },

  sleepy: {
    eyeBlinkLeft: 0.4, eyeBlinkRight: 0.4,
    mouthOpen: 0.2,
    browInnerUp: 0.2,
  },

  sleepy_tired: {
    eyeBlinkLeft: 0.7, eyeBlinkRight: 0.7,
    mouthOpen: 0.3,
  },

  smug: {
    mouthSmileLeft: 0.6, mouthSmileRight: 0.4,        // 歪嘴笑
    mouthLeft: 0.5,
    browOuterUpLeft: 0.3, browDownRight: 0.2,
    eyeSquintLeft: 0.3,
    cheekSquintLeft: 0.3,
  },

  worried: {
    browInnerUp: 0.7,
    browDownLeft: 0.3, browDownRight: 0.3,
    mouthFrownLeft: 0.4, mouthFrownRight: 0.4,
    eyeWideLeft: 0.2, eyeWideRight: 0.2,
  },

  excited: {
    eyeWideLeft: 0.7, eyeWideRight: 0.7,
    browOuterUpLeft: 0.6, browOuterUpRight: 0.6,
    mouthSmileLeft: 0.9, mouthSmileRight: 0.9,
    mouthOpen: 0.3,
    cheekPuff: 0.2,
  },

  bored: {
    eyeBlinkLeft: 0.3, eyeBlinkRight: 0.3,
    eyeLookDownLeft: 0.5, eyeLookDownRight: 0.5,
    mouthOpen: 0.15,
    browInnerUp: 0.1,
  },
};

/**
 * 应用一个表情预设 + 强度 + 覆写
 */
export function buildExpressionFromPreset(
  template: ExpressionTemplateName,
  intensity = 1,
  customBlendshapes: BlendshapeDict = {},
): BlendshapeDict {
  const base = EXPRESSION_PRESETS[template] || EXPRESSION_PRESETS.neutral;
  const merged: BlendshapeDict = {};
  for (const [k, v] of Object.entries(base)) {
    merged[k] = v * intensity;
  }
  for (const [k, v] of Object.entries(customBlendshapes)) {
    merged[k] = Math.max(merged[k] || 0, v);
  }
  return merged;
}

/** 自然微表情 — 每隔几秒叠一个若有若无的笑/眨眼 */
export function getMicroExpressionAt(t: number): BlendshapeDict {
  const out: BlendshapeDict = {};
  // 7.3s 周期一次微笑
  if (t % 7.3 > 6.9) out.joy = 0.15;
  // 5.7s 周期眨眼
  if (t % 5.7 > 5.55) out.blink = 1.0;
  // 11s 周期微皱眉
  if (t % 11 > 10.5) out.sorrow = 0.2;
  return out;
}

/** 模板中文名映射 — 用于 UI/管理界面 */
export const EXPRESSION_PRESET_LABELS: Record<ExpressionTemplateName, string> = {
  neutral: '中性',
  happy: '开心',
  sad: '难过',
  angry: '生气',
  surprised: '惊讶',
  shy: '害羞',
  cry: '哭泣',
  laugh: '大笑',
  love: '喜爱',
  thinking: '思考中',
  confused: '疑惑',
  fearful: '害怕',
  disgusted: '厌恶',
  sleepy: '犯困',
  sleepy_tired: '困倦',
  smug: '得意',
  worried: '担忧',
  excited: '激动',
  bored: '无聊',
};
