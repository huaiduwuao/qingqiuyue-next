/**
 * 场景状态上报(3D 场景动作协议 v1 的「观察」半边)。
 *
 * 每轮对话把这份 JSON 随 AG-UI 请求的 scene_state 字段发给后端,后端塞进 system prompt
 * (tagent/scene_state.go)。模型据此知道:有哪些锚点/动作/表情/场景/机位可用,自己现在
 * 站在哪、在做什么、身边挂着什么面板;上一轮 scene_act 的结果也在这里体现。
 *
 * 只放模型决策需要的东西:名字清单 + 当前值。不放 blendshape 数值、不放 DOM。
 */

import { ALL_ACTIONS } from './tools/actions';
import { ALL_EXPRESSION_TEMPLATE_NAMES } from './tools/expressions';
import { CAMERA_PRESET_NAMES, SCENE_PRESET_NAMES } from './tools/tools';

/** 舞台上可以走到的锚点(body.move 认的字符串目标)。 */
export const SCENE_ANCHORS = ['left', 'right', 'center', 'forward', 'back'] as const;

export interface SceneSnapshot {
  action?: string;
  expression?: string;
  scene?: string;
  camera?: string;
  /** 最近一次走位的目标:锚点名或坐标 */
  position?: string | { x: number; z?: number };
  panel?: { kind: string; title: string } | null;
  browser?: string | null;
  model?: string;
}

export interface SceneState {
  version: 1;
  anchors: readonly string[];
  actions: readonly string[];
  expressions: readonly string[];
  scenes: readonly string[];
  cameras: readonly string[];
  avatar: { action: string; expression: string; position: SceneSnapshot['position']; model?: string };
  scene: string;
  camera: string;
  panel: SceneSnapshot['panel'];
  browser: string | null;
}

export function buildSceneState(s: SceneSnapshot): SceneState {
  return {
    version: 1,
    anchors: SCENE_ANCHORS,
    actions: ALL_ACTIONS,
    expressions: ALL_EXPRESSION_TEMPLATE_NAMES,
    scenes: SCENE_PRESET_NAMES,
    cameras: CAMERA_PRESET_NAMES,
    avatar: {
      action: s.action || 'idle',
      expression: s.expression || 'neutral',
      position: s.position ?? 'center',
      model: s.model,
    },
    scene: s.scene || 'concert',
    camera: s.camera || 'front',
    panel: s.panel ?? null,
    browser: s.browser ?? null,
  };
}

/**
 * 从 dispatcher 的执行结果里更新快照:只有前端真的执行了的指令才算数,
 * 这样模型下一轮看到的就是实际状态,而不是它自己以为的。
 */
export function applyDispatchResults(
  snap: SceneSnapshot,
  results: Array<{ ok: boolean; toolName: string; result?: any }>,
): SceneSnapshot {
  const next = { ...snap };
  for (const r of results) {
    if (!r.ok || !r.result) continue;
    switch (r.toolName) {
      case 'body.playAction':
        next.action = r.result.name;
        break;
      case 'face.setExpression':
        next.expression = r.result.applied;
        break;
      case 'body.move':
        next.position = r.result.target;
        break;
      case 'scene.change':
        if (r.result.applied) next.scene = r.result.name;
        break;
      case 'camera.preset':
        if (r.result.applied) next.camera = r.result.name;
        break;
    }
  }
  return next;
}
