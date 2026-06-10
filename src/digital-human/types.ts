/**
 * 数字人系统共享类型。
 *
 * 架构(对应方案):
 *   语音/文本输入 → AgentController(ASR→LLM(工具)→TTS)
 *     → 输出 { 文本, 情感, 动作, 工具调用 }
 *     → ActionStateMachine 切换动作 clip + 口型
 *     → IAvatarStage 渲染(aholo-viewer)
 */

// 数字人身体动作(对应公众号文章的"多动作编排")
export type AvatarAction =
  | 'enter'      // 进入屏幕
  | 'idle'       // 站立 + 微眨眼点头
  | 'thinking'   // 思考(LLM 回复前)
  | 'speaking'   // 讲话手势(循环)
  | 'greet'      // 打招呼
  | 'wave'       // 挥手
  | 'point'      // 指向(配合 pointAt 高亮目标)
  | 'walk'       // 走动(配合 CSS 位移过渡,需 loop)
  | 'dance'      // 跳舞
  | 'sing'       // 唱歌
  | 'sit'        // 坐下
  | 'leave';     // 离开屏幕

// 表情/情感
export type AvatarEmotion = 'neutral' | 'happy' | 'sad' | 'surprised' | 'thinking';

// 关键词 → 动作 映射(状态机用)
export const KEYWORD_ACTIONS: { test: RegExp; action: AvatarAction }[] = [
  { test: /你好|您好|hi|hello|嗨/i, action: 'greet' },
  { test: /再见|拜拜|bye|结束/i, action: 'leave' },
  { test: /跳.{0,2}舞|舞蹈|dance/i, action: 'dance' },
  { test: /唱.{0,2}歌|歌曲|sing/i, action: 'sing' },
  { test: /坐.{0,2}下|坐会|坐一/i, action: 'sit' },
  { test: /挥手|招手/i, action: 'wave' },
  { test: /指.{0,3}这|指.{0,3}那|看这|点这里|打开那个|点那个/i, action: 'point' },
  { test: /走过|靠近|过来|到这|到那/i, action: 'walk' },
];

// 情感关键词
export const EMOTION_KEYWORDS: { test: RegExp; emotion: AvatarEmotion }[] = [
  { test: /开心|高兴|太好了|棒|哈哈|😄|😊/i, emotion: 'happy' },
  { test: /伤心|难过|遗憾|抱歉|😢/i, emotion: 'sad' },
  { test: /惊讶|天啊|哇|没想到/i, emotion: 'surprised' },
];

// 每帧驱动数据(可由本地或服务端 WebSocket 下发)
export interface DrivingFrame {
  action: AvatarAction;
  emotion: AvatarEmotion;
  // 口型张合 0~1(由音频幅度/viseme 实时驱动)
  mouthOpen: number;
  // 可选:细粒度脸部 blendshape / FLAME 系数(接 audio2face 时填)
  blendshapes?: Record<string, number>;
  // 可选:全身 SMPL-X 姿态(接全身实时驱动时填)
  pose?: number[];
}

// ─── LLM 工具(function calling)───
export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  params: ToolParam[];
  // 实际执行
  run: (args: Record<string, any>) => Promise<any>;
}

// LLM 一次回复的结构化结果
export interface AgentReply {
  text: string;                 // 给用户的话(会 TTS)
  emotion?: AvatarEmotion;
  action?: AvatarAction;        // 显式指定动作(优先于关键词推断)
  toolCalls?: { name: string; args: Record<string, any> }[];
}

// Agent 事件(驱动 UI / 状态机 / 日志)
export type AgentEvent =
  | { type: 'asr'; text: string; final: boolean }
  | { type: 'thinking' }
  | { type: 'reply'; reply: AgentReply }
  | { type: 'tool'; name: string; args: any; result?: any; error?: string }
  | { type: 'speaking'; mouthOpen: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

// 渲染舞台接口(aholo / 任意 GS 渲染器都可实现)
export interface IAvatarStage {
  mount(container: HTMLElement): Promise<void>;
  loadScene(sceneUrl: string): Promise<void>;
  loadAvatar(avatarUrl: string): Promise<void>;
  // 应用一帧驱动(动作/表情/口型)
  applyFrame(frame: DrivingFrame): void;
  dispose(): void;
  readonly available: boolean; // WebGPU/资源是否就绪
}
