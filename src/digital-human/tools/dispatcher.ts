/**
 * 数字人工具执行器 — 把 LLM 的 tool_call 串到 BlenderAvatar 上
 *
 * 设计:
 *   - `dispatchToolCall(call, sinks)` 调用工具的 handler, 然后把结果推到 sinks
 *   - sinks 是 React 端的一组回调 (setEmotion / setAction / setViseme / speakAudio / cameraMove / move)
 *   - 这样 BlenderAvatar 与 LLM 解耦: 渲染端只关心最后的状态
 *
 * 用法:
 *   const sinks = useDigitalHumanSinks(avatarProps);
 *   const result = dispatchToolCall(call, sinks);
 */

import { TOOLS_BY_NAME, type ToolDefinition } from './tools';
import { ALL_ACTIONS, type ActionController } from './actions';
import { buildExpressionFromPreset, EXPRESSION_PRESETS } from './expressions';
import type { BlendshapeDict, ExpressionTemplateName } from './expressions';
import type { VisemeName } from './visemes';
import { ALL_VISEME_NAMES, textToVisemeTimeline } from './visemes';

/**
 * tool_call (LLM 输出格式)
 *
 * ⚠️ 历史坑:调用方有两套字段名 —— 本地工具目录用 `params`,AG-UI / Hermes 事件流
 * 用 `args`。之前 dispatcher 只读 `params`,而运行时两个入口(parseAvatarDirectives、
 * aguiChatOnce 的 onToolCall)传的都是 `args`,还都被 `as unknown as ToolCall` 强转
 * 骗过了编译器。结果:每个 body.playAction 都读到 undefined 退化成 'idle',
 * 每个 face.setExpression 都退化成 'neutral',而且照样返回 ok:true —— 数字人
 * 从 AG-UI 收到的表情/动作一个都没生效过,还查不出错。
 *
 * 现在两个名字都接受,由 readParams() 统一取。
 */
export interface ToolCall {
  name: string;
  params?: Record<string, any>;
  args?: Record<string, any>;
}

/** 取工具参数:兼容 params / args 两种字段名。 */
function readParams(call: ToolCall): Record<string, any> {
  return call.params ?? call.args ?? {};
}

/**
 * 这个工具名归前端管吗?
 *
 * AG-UI 的工具事件是「后端执行了什么」的全量回显 —— 里面既有该由浏览器驱动形象的
 * 工具(face.setExpression / body.playAction 等),也有纯在服务端跑完的(resource_search / shell_exec /
 * workflow_execute…)。后者本来就不该进 dispatcher。
 *
 * 之前没有这道判断:每个后端工具都会落到 default 分支返回
 * `handler not registered: xxx`,调用方再把它当错误贴进聊天记录,
 * 用户搜一次资源就看见一条「⚠️ unknown tool: resource_search」。
 * 现在由调用方先用这个函数过滤,只把形象类工具交给 dispatcher。
 */
export function isAvatarTool(name: string): boolean {
  return name in TOOLS_BY_NAME;
}

export interface DigitalHumanSinks {
  /** 设置 52 维 blendshape 字典 */
  setEmotion: (blendshapes: BlendshapeDict) => void;
  /** 单帧 viseme */
  setViseme: (shape: VisemeName, weight: number) => void;
  /** 跑一段 viseme 时间线 */
  setVisemeTimeline: (frames: { t: number; shape: VisemeName; weight: number }[]) => void;
  /** 设置下颚开度 */
  setJawOpen: (value: number) => void;
  /** 播放动作 */
  setAction: (name: string) => void;
  /** 让数字人说话 (TTS + 嘴型) */
  speak: (text: string, audioUrl?: string) => void;
  /** 移动到目标 */
  move: (target: { x: number; y?: number; z?: number } | 'left' | 'right' | 'center', opts?: { durationMs?: number; style?: 'walk' | 'run' | 'teleport' }) => void;
  /** 相机（旧） */
  camera: (action: 'zoomIn' | 'zoomOut' | 'orbit' | 'face' | 'full' | 'reset') => void;
  /** 场景切换（VRM 舞台新增，旧的 BlenderAvatar 实现是 noop） */
  setScene?: (name: 'concert' | 'idol' | 'garden' | 'neon' | 'studio') => void;
  /** 相机预设（VRM 舞台新增，6 个机位平滑切换） */
  setCameraPreset?: (name: 'front' | 'three' | 'side' | 'low' | 'top' | 'back') => void;
  /** 舞蹈风格（VRM 舞台新增） */
  setDanceStyle?: (style: 'groove' | 'idol') => void;
  /** 动作幅度 */
  setDanceAmp?: (value: number) => void;
  /** BPM */
  setBpm?: (value: number) => void;
  /** 开/关跳舞 */
  setDancing?: (on: boolean) => void;
  /** 姿势（VRM 舞台新增，独立于动作系统） */
  setPose?: (name: string) => void;
  /** 换装:切换到指定 VRM 模型。返回 boolean/Promise<boolean> 表示是否找到模型 */
  setModel?: (modelId: string) => boolean | Promise<boolean>;
}

export interface DispatchResult {
  ok: boolean;
  toolName: string;
  result?: any;
  error?: string;
}

export function dispatchToolCall(call: ToolCall, sinks: DigitalHumanSinks): DispatchResult {
  const tool = TOOLS_BY_NAME[call.name];
  if (!tool) {
    return { ok: false, toolName: call.name, error: `unknown tool: ${call.name}` };
  }
  const p = readParams(call);

  try {
    switch (call.name) {
      case 'face.setExpression': {
        // `template` 是工具 schema 的字段名;`name` 是 <emotion:x/> 指令的字段名。
        // 两边都收,否则文本指令来的表情永远落到 neutral。
        const template = (p.template || p.name || 'neutral') as ExpressionTemplateName;
        if (!EXPRESSION_PRESETS[template]) {
          return { ok: false, toolName: 'face.setExpression', error: `unknown expression template: ${template}` };
        }
        const built = buildExpressionFromPreset(
          template,
          p.intensity ?? 1,
          p.blendshapes || {},
        );
        sinks.setEmotion(built);
        if (p.durationMs && p.durationMs > 0) {
          setTimeout(() => sinks.setEmotion({}), p.durationMs);
        }
        return { ok: true, toolName: 'face.setExpression', result: { applied: template } };
      }

      case 'face.mouthOpen': {
        const v = p.value ?? 0;
        sinks.setJawOpen(v);
        return { ok: true, toolName: 'face.mouthOpen', result: { value: v } };
      }

      case 'mouth.setViseme': {
        const shape = (p.shape || 'closed') as VisemeName;
        if (!ALL_VISEME_NAMES.includes(shape)) {
          return { ok: false, toolName: 'mouth.setViseme', error: `unknown viseme: ${shape}` };
        }
        const weight = p.weight ?? 1;
        sinks.setViseme(shape, weight);
        return { ok: true, toolName: 'mouth.setViseme', result: { shape, weight } };
      }

      case 'mouth.speak': {
        const text = p.text || '';
        const audioUrl = p.audioUrl;
        if (text) {
          const timeline = textToVisemeTimeline(text);
          sinks.setVisemeTimeline(timeline);
        }
        if (audioUrl) {
          sinks.speak(text, audioUrl);
        }
        return { ok: true, toolName: 'mouth.speak', result: { text, frames: text.length } };
      }

      case 'body.playAction': {
        const name = p.name || 'idle';
        if (!ALL_ACTIONS.includes(name)) {
          return { ok: false, toolName: 'body.playAction', error: `unknown action: ${name}` };
        }
        const speed = p.speed ?? 1;
        const repeat = p.repeat ?? 1;
        sinks.setAction(name);
        return { ok: true, toolName: 'body.playAction', result: { name, speed, repeat } };
      }

      case 'body.move': {
        const target = p.target || { x: 0 };
        // 校验 target 参数
        if (typeof target === 'string') {
          const validTargets = ['left', 'right', 'center', 'forward', 'back'];
          if (!validTargets.includes(target)) {
            return { ok: false, toolName: 'body.move', error: `invalid target string: "${target}". Must be one of: ${validTargets.join(', ')}` };
          }
        } else if (typeof target === 'object') {
          if (typeof target.x !== 'number' || isNaN(target.x)) {
            return { ok: false, toolName: 'body.move', error: 'target.x must be a number' };
          }
          if (target.z !== undefined && (typeof target.z !== 'number' || isNaN(target.z))) {
            return { ok: false, toolName: 'body.move', error: 'target.z must be a number' };
          }
        }
        const durationMs = p.durationMs ?? 1500;
        const style = p.style ?? 'walk';
        sinks.move(target, { durationMs, style });
        return { ok: true, toolName: 'body.move', result: { target, durationMs, style } };
      }

      case 'camera.control': {
        const action = p.action || 'reset';
        sinks.camera(action);
        return { ok: true, toolName: 'camera.control', result: { action } };
      }

      case 'scene.change': {
        const name = p.name || 'concert';
        if (sinks.setScene) sinks.setScene(name);
        else console.warn('[dispatcher] scene.change: sinks.setScene 未实现 (旧 BlenderAvatar)');
        return { ok: true, toolName: 'scene.change', result: { name, applied: !!sinks.setScene } };
      }

      case 'camera.preset': {
        const name = p.name || 'front';
        if (sinks.setCameraPreset) sinks.setCameraPreset(name);
        else console.warn('[dispatcher] camera.preset: sinks.setCameraPreset 未实现 (旧 BlenderAvatar)');
        return { ok: true, toolName: 'camera.preset', result: { name, applied: !!sinks.setCameraPreset } };
      }

      case 'avatar.swapModel': {
        const modelId = p.modelId || '';
        if (!sinks.setModel) {
          return { ok: false, toolName: 'avatar.swapModel', error: 'setModel 未实现,当前环境不支持换装' };
        }
        // setModel 可能同步返回 boolean 或异步返回 Promise<boolean>
        const ret = sinks.setModel(modelId);
        if (ret && typeof (ret as Promise<boolean>).then === 'function') {
          return { ok: true, toolName: 'avatar.swapModel', result: { modelId, pending: true } };
        }
        return {
          ok: ret as boolean,
          toolName: 'avatar.swapModel',
          result: ret ? { modelId, swapped: true } : { modelId, error: `no model: ${modelId}` },
        };
      }

      default:
        return { ok: false, toolName: call.name, error: `handler not registered: ${call.name}` };
    }
  } catch (e: any) {
    return { ok: false, toolName: call.name, error: e?.message || String(e) };
  }
}

/**
 * 把 LLM 一次回复的工具调用序列推给 sinks
 * (处理顺序: 先 setEmotion, 再 setAction, 最后 speak)
 */
export function dispatchToolCalls(calls: ToolCall[], sinks: DigitalHumanSinks): DispatchResult[] {
  // 只派发形象类工具:后端自己跑完的业务工具(搜索/发悬赏/shell/工作流)不归这里管,
  // 混进来只会变成一条「unknown tool」错误贴到聊天记录里。
  return calls.filter(c => isAvatarTool(c.name)).map(c => dispatchToolCall(c, sinks));
}
