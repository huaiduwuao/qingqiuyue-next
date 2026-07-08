/**
 * vrm/types.ts — 共享类型
 */

import type { ScenePresetName } from './sceneBuilders';

export type { ScenePresetName };

export type CameraPresetName = 'front' | 'three' | 'side' | 'low' | 'top' | 'back';
export const CAMERA_PRESETS: CameraPresetName[] = ['front', 'three', 'side', 'low', 'top', 'back'];
export const CAMERA_LABELS: Record<CameraPresetName, string> = {
  front: '正面', three: '3/4', side: '侧面', low: '仰视', top: '顶视', back: '背面',
};

export type DanceStyle = 'groove' | 'idol';
export const DANCE_STYLES: DanceStyle[] = ['groove', 'idol'];
export const DANCE_LABELS: Record<DanceStyle, string> = { groove: '节奏律动', idol: '偶像挥手' };

export type PoseName = 'idle' | 'wave' | 'bothUp' | 'akimbo' | 'point' | 'pray';
export const POSE_NAMES: PoseName[] = ['idle', 'wave', 'bothUp', 'akimbo', 'point', 'pray'];
export const POSE_LABELS: Record<PoseName, string> = {
  idle: '自然站立', wave: '👋 单手挥手', bothUp: '🙌 双手举起',
  akimbo: '💪 叉腰', point: '👉 指向', pray: '🙏 比心',
};

/** 12 个表情通道（与 VrmStage 12 个 Slider 一一对应） */
export const EXPRESSION_CHANNELS = [
  { key: 'happy', label: '开心' },
  { key: 'angry', label: '生气' },
  { key: 'sad', label: '悲伤' },
  { key: 'relaxed', label: '放松' },
  { key: 'surprised', label: '惊讶' },
  { key: 'aa', label: '嘴 aa' },
  { key: 'ih', label: '嘴 ih' },
  { key: 'ou', label: '嘴 ou' },
  { key: 'ee', label: '嘴 ee' },
  { key: 'oh', label: '嘴 oh' },
  { key: 'blinkLeft', label: '左眼' },
  { key: 'blinkRight', label: '右眼' },
] as const;

/** 10 个情绪预设 chip（与 EXPRESSION_PRESETS 的 template name 对应） */
export const EMOTION_PRESETS: { id: string; emoji: string; label: string; template: string; intensity: number; blinkLeft?: number }[] = [
  { id: 'laugh',     emoji: '😄', label: '大笑',   template: 'laugh',     intensity: 1.0 },
  { id: 'smile',     emoji: '🙂', label: '微笑',   template: 'happy',     intensity: 0.6 },
  { id: 'angry',     emoji: '😠', label: '生气',   template: 'angry',     intensity: 0.9 },
  { id: 'sad',       emoji: '😢', label: '难过',   template: 'sad',       intensity: 0.9 },
  { id: 'surprised', emoji: '😲', label: '惊讶',   template: 'surprised', intensity: 1.0 },
  { id: 'relaxed',   emoji: '😌', label: '放松',   template: 'relaxed',   intensity: 1.0 },
  { id: 'wink',      emoji: '😉', label: '眨眼',   template: 'happy',     intensity: 0.3, blinkLeft: 0.9 },
  { id: 'thinking',  emoji: '🤔', label: '疑惑',   template: 'thinking',  intensity: 1.0 },
  { id: 'frustrated', emoji: '😤', label: '不甘',   template: 'angry',     intensity: 0.5 },
  { id: 'neutral',   emoji: '😐', label: '中性',   template: 'neutral',   intensity: 0.0 },
];
