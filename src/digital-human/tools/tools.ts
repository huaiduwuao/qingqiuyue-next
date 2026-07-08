/**
 * 数字人工具集 — Hermes 协议 (OpenAI function_calling 兼容)
 *
 * 所有工具是 LLM/Hermes 可调用的, 也可被前端代码直接 dispatch。
 * 工具分四组:
 *   face.*   — 表情 / 下颚
 *   mouth.*  — 口型 / 说话
 *   body.*   — 动作 / 移动
 *   camera.* — 相机控制
 *
 * 设计原则:
 *   1. 工具 ID 即 action 名, 不带 namespace 也可直接调用
 *   2. param 数量越少越好 (LLM 容易出错), 用 enum 收紧可选值
 *   3. 每个工具都允许自定义覆盖 — 高级用户能精确控制
 */

import type { ActionName } from './actions';
import { ALL_ACTIONS } from './actions';
import type { ExpressionTemplateName } from './expressions';
import { EXPRESSION_PRESETS } from './expressions';
import type { VisemeName } from './visemes';
import { VISEME_NAMES } from './visemes';

export interface ToolParamSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  enum?: (string | number)[];
  description: string;
  minimum?: number;
  maximum?: number;
  default?: any;
  properties?: Record<string, ToolParamSchema>;
  items?: ToolParamSchema;
}

export interface ToolDefinition<Params = Record<string, any>> {
  name: string;
  description: string;
  category: 'face' | 'mouth' | 'body' | 'camera' | 'system';
  parameters: {
    type: 'object';
    properties: Record<string, ToolParamSchema>;
    required?: string[];
    additionalProperties?: boolean;
  };
  /**
   * 实际执行逻辑 (前端 dispatch 时调用).
   * 返回一个对象, 可传给 LLM / 上报 Hermes.
   */
  handler: (params: Params, ctx: ToolContext) => Promise<any> | any;
}

export interface ToolContext {
  /** 当前 agent id */
  agentId: string;
  /** LLM 一句话文本 (调用 setEmotion 之后用作朗读文本的引子) */
  text?: string;
}

/* ────────────── face.* 工具 ────────────── */

export const faceSetExpression: ToolDefinition<{
  template?: ExpressionTemplateName;
  intensity?: number;
  blendshapes?: Record<string, number>;
  durationMs?: number;
}> = {
  name: 'face.setExpression',
  category: 'face',
  description: [
    '设置数字人的面部表情。可以使用预设模板, 也可以细粒度覆写 52 维 ARKit blendshape。',
    '用法:`{"template": "happy"}` 或 `{"template": "angry", "intensity": 0.7}` 或 `{"blendshapes": {"mouthSmileLeft": 1.0}}`。',
    '预设模板:' + Object.keys(EXPRESSION_PRESETS).map(k => `\`${k}\``).join(', ') + '。',
  ].join('\n'),
  parameters: {
    type: 'object',
    properties: {
      template: {
        type: 'string',
        enum: Object.keys(EXPRESSION_PRESETS) as any,
        description: '预设模板名',
        default: 'neutral',
      },
      intensity: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: '强度缩放 (0-1)',
        default: 1,
      },
      blendshapes: {
        type: 'object',
        description: '细粒度覆写 52 维 ARKit blendshape (0-1)',
      },
      durationMs: {
        type: 'integer',
        minimum: 0,
        description: '持续时长 (毫秒), 0=永久直到下次调用',
        default: 0,
      },
    },
    required: [],
  },
  handler: ({ template = 'neutral', intensity = 1, blendshapes = {}, durationMs = 0 }) => {
    return { applied: { template, intensity, blendshapes, durationMs } };
  },
};

export const faceMouthOpen: ToolDefinition<{ value: number }> = {
  name: 'face.mouthOpen',
  category: 'face',
  description: '直接控制下颚张开程度 (0=闭合, 1=完全张开)。实时覆盖, 用于手动控制口型幅度。',
  parameters: {
    type: 'object',
    properties: {
      value: { type: 'number', minimum: 0, maximum: 1, description: '0-1', default: 0 },
    },
    required: ['value'],
  },
  handler: ({ value }) => ({ value }),
};

/* ────────────── mouth.* 工具 ────────────── */

export const mouthSetViseme: ToolDefinition<{ shape: VisemeName; weight?: number }> = {
  name: 'mouth.setViseme',
  category: 'mouth',
  description: '单帧设置口型 (OVRLipSync 标准 14 个 viseme + closed)。',
  parameters: {
    type: 'object',
    properties: {
      shape: {
        type: 'string',
        enum: VISEME_NAMES as unknown as string[],
        description: '音素口型',
        default: 'closed',
      },
      weight: { type: 'number', minimum: 0, maximum: 1, description: '权重', default: 1 },
    },
    required: ['shape'],
  },
  handler: ({ shape, weight = 1 }) => ({ shape, weight }),
};

export const mouthSpeak: ToolDefinition<{ text: string; audioUrl?: string; speed?: number }> = {
  name: 'mouth.speak',
  category: 'mouth',
  description: '让数字人说一句话。同时生成 viseme 序列, 自动驱动口型;可选 TTS 音频源。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要说的话' },
      audioUrl: { type: 'string', description: '可选, TTS 音频 URL (会自动播放)' },
      speed: { type: 'number', minimum: 0.5, maximum: 2, description: '语速', default: 1 },
    },
    required: ['text'],
  },
  handler: ({ text, audioUrl, speed = 1 }) => ({ text, audioUrl, speed }),
};

/* ────────────── body.* 工具 ────────────── */

export const bodyPlayAction: ToolDefinition<{
  name: ActionName;
  speed?: number;
  repeat?: number;
}> = {
  name: 'body.playAction',
  category: 'body',
  description: '播放数字人完整身体动作。可指定速度、循环次数。' + '\n可用动作: ' + ALL_ACTIONS.join(', '),
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', enum: ALL_ACTIONS as unknown as string[], description: '动作名' },
      speed: { type: 'number', minimum: 0.3, maximum: 2, default: 1, description: '速度倍率 (0.3-2)' },
      repeat: { type: 'integer', minimum: 1, maximum: 10, default: 1, description: '循环次数 (1-10)' },
    },
    required: ['name'],
  },
  handler: ({ name, speed = 1, repeat = 1 }) => ({ name, speed, repeat }),
};

export const bodyMove: ToolDefinition<{
  target: { x: number; y?: number; z?: number } | 'left' | 'right' | 'center';
  durationMs?: number;
  style?: 'walk' | 'run' | 'teleport';
}> = {
  name: 'body.move',
  category: 'body',
  description: '数字人在舞台上移动到目标位置 (x 范围约 -3 ~ 3)。',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'object',
        description: '{x, y?, z?} 或字符串 "left" | "right" | "center"',
      },
      durationMs: { type: 'integer', minimum: 200, maximum: 6000, default: 1500, description: '移动时长 (毫秒)' },
      style: { type: 'string', enum: ['walk', 'run', 'teleport'], default: 'walk', description: '移动风格' },
    },
    required: ['target'],
  },
  handler: ({ target, durationMs = 1500, style = 'walk' }) => ({ target, durationMs, style }),
};

/* ────────────── camera.* 工具 ────────────── */

export const cameraControl: ToolDefinition<{ action: 'zoomIn' | 'zoomOut' | 'orbit' | 'face' | 'full' | 'reset' }> = {
  name: 'camera.control',
  category: 'camera',
  description: '控制相机角度 (face=中景人脸, zoomIn=半身, zoomOut=远景, full=全身, reset=默认)。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['zoomIn', 'zoomOut', 'orbit', 'face', 'full', 'reset'],
        description: '相机动作',
      },
    },
    required: ['action'],
  },
  handler: ({ action }) => ({ action }),
};

/* ────────────── scene.* 工具（VRM 舞台新增）────────────── */

export const SCENE_PRESET_NAMES = ['concert', 'idol', 'garden', 'neon', 'studio'] as const;
export type ScenePresetToolName = typeof SCENE_PRESET_NAMES[number];

export const sceneChange: ToolDefinition<{ name: ScenePresetToolName }> = {
  name: 'scene.change',
  category: 'system',
  description: '切换 VRM 舞台背景场景。concert=演唱会主舞台, idol=偶像练习室, garden=月光花园, neon=赛博霓虹, studio=摄影棚白底。',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        enum: SCENE_PRESET_NAMES as unknown as string[],
        description: '场景名',
      },
    },
    required: ['name'],
  },
  handler: ({ name }) => ({ name }),
};

export const CAMERA_PRESET_NAMES = ['front', 'three', 'side', 'low', 'top', 'back'] as const;
export type CameraPresetToolName = typeof CAMERA_PRESET_NAMES[number];

export const cameraPreset: ToolDefinition<{ name: CameraPresetToolName }> = {
  name: 'camera.preset',
  category: 'camera',
  description: '切换 VRM 舞台相机视角预设：front=正面, three=3/4 视角, side=侧面, low=仰视, top=顶视, back=背面。',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        enum: CAMERA_PRESET_NAMES as unknown as string[],
        description: '视角名',
      },
    },
    required: ['name'],
  },
  handler: ({ name }) => ({ name }),
};

/* ────────────── 全量注册 ────────────── */

export const ALL_TOOLS: ToolDefinition<any>[] = [
  faceSetExpression,
  faceMouthOpen,
  mouthSetViseme,
  mouthSpeak,
  bodyPlayAction,
  bodyMove,
  cameraControl,
  sceneChange,
  cameraPreset,
];

export const TOOLS_BY_NAME: Record<string, ToolDefinition> = Object.fromEntries(
  ALL_TOOLS.map(t => [t.name, t])
);

/** 工具元数据 (LLM 兼容格式 + UI 用) */
export interface ToolSummary {
  name: string;
  category: string;
  description: string;
  params: string[];
}

export function summarizeTools(): ToolSummary[] {
  return ALL_TOOLS.map(t => ({
    name: t.name,
    category: t.category,
    description: t.description.split('\n').pop() || t.description,
    params: Object.keys(t.parameters.properties),
  }));
}

/**
 * 用一句中文写出所有工具的"人话"清单 — 给 LLM prompt 当 hint 用
 */
export function buildToolsHint(): string {
  return ALL_TOOLS.map(t => {
    const params = Object.entries(t.parameters.properties)
      .map(([k, v]) => `${k}${v.enum ? `∈[${v.enum.slice(0, 6).join('/')}${v.enum.length > 6 ? '/...' : ''}]` : ''}`)
      .join(', ');
    return `- **${t.name}**(${params}) — ${t.description.split('\n')[0]}`;
  }).join('\n');
}
