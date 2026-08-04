/**
 * vrm/config/types.ts — VRM 数字人配置系统的所有 TypeScript 接口
 *
 * 这些类型同时是：
 *   1. 前端 runtime 内存里的对象形状
 *   2. seed JSON 文件的 schema（手写校验）
 *   3. Phase 2 后端 Go API + Postgres JSONB 的 schema
 *
 * 所有配置都是 per-model 的（modelId 外键）。model 可换，配置跟着换。
 */

// ============================================================================
// 角色模型
// ============================================================================

export interface VrmModelConfig {
  id: string;                                 // uuid
  name: string;                               // "小秋"
  url: string;                                // .vrm 文件 URL
  scale: number;                              // 默认 1.0
  footOffsetY: number;                        // 模型自然原点偏移（贴地用）
  capsule: { height: number; radius: number }; // 物理碰撞胶囊
  /** ARKit 52 维 → 模型实际 expression 名（VRM 0.0 兼容映射） */
  expressionMap: Record<string, string>;
  /** OVRLipSync 14 → 模型实际 viseme 名 */
  visemeMap: Record<string, string>;
  /** camelCase → PascalCase（VRM 0.0 骨骼名兼容） */
  boneMap: Record<string, string>;
  isDefault: boolean;
}

// ============================================================================
// 动作
// ============================================================================

export type ActionCategory =
  | 'greeting' | 'emote' | 'performance' | 'thought' | 'rest' | 'neutral' | 'locomotion';

export interface ActionConfig {
  id: string;
  modelId: string;
  name: string;                               // 'wave' | 'bow' | 'groove' ...
  label: string;                              // 中文："挥手"
  category: ActionCategory;
  description: string;
  triggers: string[];                         // LLM 路由关键词：['你好', 'hi', 'hello']
  /** 静态骨骼旋转（easeOut 后最终态） */
  boneRotations: Record<string, [number, number, number]>;
  /** ms, 0 = loopable */
  duration: number;
  loopable: boolean;
  /**
   * 可选 JS 表达式。参数：(t, blend) => boneRotation[bone] = [x, y, z]
   * - t: 从 action 开始经过的秒数
   * - blend: 0-1 blend factor（默认 1）
   * 如果有 formula，忽略 boneRotations，每帧 eval
   * 安全：用 new Function 沙箱，不传 window/document
   */
  formula?: string;
}

// ============================================================================
// 舞蹈风格
// ============================================================================

export type DanceStyleCategory = 'idle_bounce' | 'wave' | 'walk' | 'run' | 'pose_hold';

export interface DanceStyleConfig {
  id: string;
  modelId: string;
  name: string;                               // 'groove' | 'idol' | 'walk' | 'run'
  label: string;                              // 中文
  category: DanceStyleCategory;
  bpm: number;
  /** JS 表达式，参数：(t, b, A, bass, phase) => boneRotations object
   *  - t:   elapsed seconds
   *  - b:   beat 数（每拍 +1）
   *  - A:   当前 amplitude (0-1)
   *  - bass: 低频能量
   *  - phase: 行走相位（用于步频）
   * 返回：Record<bones, [x, y, z]>
   */
  formula: string;
  /** 公式用到的常量（如 swingAmp, bounceAmp） */
  params: Record<string, number>;
  description: string;
}

// ============================================================================
// 姿势（静态目标姿态）
// ============================================================================

export interface PoseConfig {
  id: string;
  modelId: string;
  name: string;                               // 'wave' | 'bothUp' | 'idle'
  label: string;
  description: string;
  boneRotations: Record<string, [number, number, number]>;
}

// ============================================================================
// 表情预设（ARKit 52 维）
// ============================================================================

export interface ExpressionPresetConfig {
  id: string;
  modelId: string;
  name: string;                               // 'happy' | 'sad' | 'relaxed' ...
  label: string;                              // 中文
  emoji: string;
  intensity: number;                          // 0-1
  blendshapes: Record<string, number>;
  description: string;
}

// ============================================================================
// 口型
// ============================================================================

export interface VisemeConfig {
  id: string;
  modelId: string;
  name: string;                               // 'aa' | 'ih' | 'ou' ...
  label: string;
  blendshapes: Record<string, number>;
}

// ============================================================================
// 光源
// ============================================================================

export type LightType = 'ambient' | 'directional' | 'point' | 'spot' | 'hemisphere';

export interface LightConfig {
  id: string;
  type: LightType;
  color: number;                               // 0xRRGGBB
  intensity: number;
  position?: [number, number, number];
  target?: [number, number, number];
  distance?: number;
  angle?: number;                              // spot
  penumbra?: number;                           // spot
  decay?: number;                              // point/spot
  castShadow?: boolean;
  shadowMapSize?: number;                      // 1024 / 2048
  groundColor?: number;                        // hemisphere
}

// ============================================================================
// 装饰物（场景里非光源、非地面、非粒子的 mesh）
// ============================================================================

export type DecorationType =
  | 'truss' | 'backdrop' | 'tree' | 'flower' | 'box' | 'mirror' | 'column' | 'screen';

export type ColliderShape = 'capsule' | 'box' | 'cylinder' | 'none';

export interface DecorationConfig {
  id: string;
  type: DecorationType;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  /** type-specific params（颜色、数量、尺寸等） */
  params?: Record<string, number | string | boolean>;
  collider?: ColliderShape;
  /** collider = box: [w, h, d]; capsule/cylinder: number (radius) */
  colliderSize?: [number, number, number] | number;
}

// ============================================================================
// 地面
// ============================================================================

export interface FloorConfig {
  type: 'circle' | 'plane' | 'none';
  radius?: number;                            // circle
  width?: number;                             // plane
  depth?: number;                             // plane
  color: number;
  roughness: number;
  metalness: number;
  receiveShadow: boolean;
  /** 物理碰撞体形状 */
  collider: 'plane' | 'cuboid';
}

// ============================================================================
// 相机预设
// ============================================================================

export interface CameraPresetConfig {
  name: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

// ============================================================================
// 场景
// ============================================================================

export interface SceneConfig {
  id: string;
  name: string;                               // 'concert' | 'garden' ...
  label: string;                              // 中文
  description: string;
  background: {
    type: 'sky_dome' | 'color';
    skyTopColor?: number;
    skyBottomColor?: number;
    color?: number;
  };
  floor: FloorConfig;
  lights: LightConfig[];
  decorations: DecorationConfig[];
  cameraPresets: CameraPresetConfig[];
  particles?: {
    count: number;
    area: number;
    palette: number[];
  };
  physics: {
    gravity: number;                          // -9.81
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  };
  isDefault: boolean;
}

// ============================================================================
// 角色会话状态（持久化）
// ============================================================================

// ============================================================================
// 一次拉齐的完整配置包（前端 mount 时一锅端）
// ============================================================================

export interface ConfigBundle {
  model: VrmModelConfig;
  scenes: SceneConfig[];
  actions: ActionConfig[];
  danceStyles: DanceStyleConfig[];
  poses: PoseConfig[];
  expressions: ExpressionPresetConfig[];
  visemes: VisemeConfig[];
}

// ============================================================================
// 工具调用规格（保持兼容现有 tools.ts）
// ============================================================================

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
  handler: (params: Params, ctx: ToolContext) => Promise<any> | any;
}

export interface ToolContext {
  agentId: string;
  text?: string;
}

// ============================================================================
// 适配规则（Phase 5：动作/口型/表情/物理 联动）
// ============================================================================

/**
 * Action → auto emotion/viseme 映射
 * 当 character 跑某个 action 时，自动套用对应的 emotion/viseme baseline
 * 用户可以手动覆盖
 */
export interface ActionAutoExpressionMap {
  /** action name → 触发的 expression preset name */
  [actionName: string]: {
    expression?: ExpressionTemplateName;
    viseme?: VisemeName;
    /** 强度 (0-1) */
    intensity?: number;
  };
}

/** 全局默认映射（在 loader.ts 里填默认值） */
export const DEFAULT_ACTION_EXPRESSION_MAP: ActionAutoExpressionMap = {
  // 表演类
  dance: { expression: 'happy', intensity: 0.7 },
  sing: { expression: 'excited', viseme: 'aa', intensity: 0.8 },
  laugh: { expression: 'laugh', intensity: 0.9 },
  jump: { expression: 'surprised', viseme: 'oh', intensity: 0.7 },
  // 情绪类
  cry: { expression: 'cry', intensity: 0.9 },
  think: { expression: 'thinking', intensity: 0.6 },
  // 互动类
  wave: { expression: 'happy', intensity: 0.5 },
  greet: { expression: 'happy', intensity: 0.6 },
  kiss: { expression: 'love', intensity: 0.7 },
  // 安静类
  sleep: { expression: 'sleepy_tired', intensity: 0.9 },
  sit: { expression: 'relaxed', intensity: 0.4 },
  explain: { expression: 'thinking', intensity: 0.4 },
  talk: { viseme: 'aa', intensity: 0.3 },
  // 走路 / 跑步：维持中性
  walk: {},
  run: {},
  idle: {},
};

export function lookupAutoExpression(actionName: string): { expression?: ExpressionTemplateName; viseme?: VisemeName; intensity?: number } {
  return DEFAULT_ACTION_EXPRESSION_MAP[actionName] || {};
}

// ============================================================================
// 兼容导出（给老 tools/{expressions,actions,visemes}.ts 用）
// ============================================================================

/** 20 个表情预设名（兼容 ExpressionTemplateName） */
export type ExpressionTemplateName =
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy' | 'cry' | 'laugh'
  | 'love' | 'thinking' | 'confused' | 'fearful' | 'disgusted' | 'sleepy' | 'sleepy_tired'
  | 'smug' | 'worried' | 'excited' | 'bored' | 'relaxed';

export type BlendshapeDict = Record<string, number>;

/** Viseme 名（OVRLipSync 标准 17 个，加 oh/ih/ou） */
export type VisemeName =
  | 'sil' | 'PP' | 'FF' | 'TH' | 'DD' | 'kk' | 'CH' | 'SS' | 'nn' | 'RR'
  | 'aa' | 'E' | 'I' | 'O' | 'U' | 'oh' | 'ih' | 'ou' | 'closed';

/** 29 个动作名（兼容旧 ActionName） */
export type ActionName =
  | 'idle' | 'wave' | 'bow' | 'nod' | 'shake'
  | 'clap' | 'cheer' | 'jump' | 'walk' | 'run'
  | 'dance' | 'sing' | 'laugh' | 'cry' | 'think'
  | 'point' | 'sit' | 'sleep' | 'stretch' | 'greet'
  | 'salute' | 'kiss' | 'shrug' | 'talk' | 'explain'
  | 'listen' | 'pray'
  | 'groove' | 'idol';

// ============================================================================
// 类型守卫
// ============================================================================

export function isScenePresetConfig(c: any): c is SceneConfig {
  return c && typeof c === 'object' && c.name && Array.isArray(c.lights);
}

export function isActionConfig(c: any): c is ActionConfig {
  return c && typeof c === 'object' && c.name && c.boneRotations !== undefined;
}
