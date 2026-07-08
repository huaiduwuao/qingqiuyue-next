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
import type { ActionController } from './actions';
import { buildExpressionFromPreset } from './expressions';
import type { BlendshapeDict } from './expressions';
import type { VisemeName } from './visemes';
import { VISEME_BLENDSHAPES, textToVisemeTimeline } from './visemes';

/** tool_call (LLM 输出格式) */
export interface ToolCall {
  name: string;
  params: Record<string, any>;
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

  try {
    switch (call.name) {
      case 'face.setExpression': {
        const params = call.params || {};
        const built = buildExpressionFromPreset(
          params.template || 'neutral',
          params.intensity ?? 1,
          params.blendshapes || {},
        );
        sinks.setEmotion(built);
        if (params.durationMs && params.durationMs > 0) {
          setTimeout(() => sinks.setEmotion({}), params.durationMs);
        }
        return { ok: true, toolName: 'face.setExpression', result: { applied: params.template } };
      }

      case 'face.mouthOpen': {
        const v = call.params?.value ?? 0;
        sinks.setJawOpen(v);
        return { ok: true, toolName: 'face.mouthOpen', result: { value: v } };
      }

      case 'mouth.setViseme': {
        const shape = (call.params?.shape || 'closed') as VisemeName;
        const weight = call.params?.weight ?? 1;
        sinks.setViseme(shape, weight);
        return { ok: true, toolName: 'mouth.setViseme', result: { shape, weight } };
      }

      case 'mouth.speak': {
        const text = call.params?.text || '';
        const audioUrl = call.params?.audioUrl;
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
        const name = call.params?.name || 'idle';
        const speed = call.params?.speed ?? 1;
        const repeat = call.params?.repeat ?? 1;
        sinks.setAction(name);
        return { ok: true, toolName: 'body.playAction', result: { name, speed, repeat } };
      }

      case 'body.move': {
        const target = call.params?.target || { x: 0 };
        const durationMs = call.params?.durationMs ?? 1500;
        const style = call.params?.style ?? 'walk';
        sinks.move(target, { durationMs, style });
        return { ok: true, toolName: 'body.move', result: { target, durationMs, style } };
      }

      case 'camera.control': {
        const action = call.params?.action || 'reset';
        sinks.camera(action);
        return { ok: true, toolName: 'camera.control', result: { action } };
      }

      case 'scene.change': {
        const name = call.params?.name || 'concert';
        if (sinks.setScene) sinks.setScene(name);
        else console.warn('[dispatcher] scene.change: sinks.setScene 未实现 (旧 BlenderAvatar)');
        return { ok: true, toolName: 'scene.change', result: { name, applied: !!sinks.setScene } };
      }

      case 'camera.preset': {
        const name = call.params?.name || 'front';
        if (sinks.setCameraPreset) sinks.setCameraPreset(name);
        else console.warn('[dispatcher] camera.preset: sinks.setCameraPreset 未实现 (旧 BlenderAvatar)');
        return { ok: true, toolName: 'camera.preset', result: { name, applied: !!sinks.setCameraPreset } };
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
  return calls.map(c => dispatchToolCall(c, sinks));
}
