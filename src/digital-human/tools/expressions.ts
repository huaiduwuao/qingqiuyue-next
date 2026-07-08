/**
 * 数字人表情预设库 — 从 ConfigBundle 动态生成
 *
 * Phase 1.5：从 src/data/seed/expressions/character.json 加载，
 * 原本硬编码的 20 个预设改为自动生成。
 * Phase 2 后端 API 接入时只需把 loader 换成 fetch 即可。
 *
 * 行为完全兼容：EXPRESSION_PRESETS 和 EXPRESSION_PRESET_LABELS 的形状不变，
 * 调用方（dispatcher.ts / VrmStage）不需要改。
 */

import { loadConfigBundle, buildLookups } from '../vrm/config/loader';
import type { ExpressionTemplateName, BlendshapeDict } from '../vrm/config/types';

// 静态类型（Phase 2 后端返回更灵活的类型时再扩）
export type { ExpressionTemplateName, BlendshapeDict };

// 模块加载时一次性生成（Phase 1 静态 JSON；Phase 2 改为 async）
const _bundle = loadConfigBundle();
const _lookups = buildLookups(_bundle);

function buildExpressionPresets(): Record<ExpressionTemplateName, BlendshapeDict> {
  const out: Partial<Record<ExpressionTemplateName, BlendshapeDict>> = {};
  for (const e of _bundle.expressions) {
    if (e.name === 'neutral') out.neutral = {};
    else out[e.name as ExpressionTemplateName] = { ...e.blendshapes };
  }
  // 中性表情（空）兜底
  if (!out.neutral) out.neutral = {};
  return out as Record<ExpressionTemplateName, BlendshapeDict>;
}

function buildExpressionLabels(): Record<ExpressionTemplateName, string> {
  const out: Partial<Record<ExpressionTemplateName, string>> = {};
  for (const e of _bundle.expressions) {
    out[e.name as ExpressionTemplateName] = e.label || e.name;
  }
  return out as Record<ExpressionTemplateName, string>;
}

export const EXPRESSION_PRESETS: Record<ExpressionTemplateName, BlendshapeDict> = buildExpressionPresets();
export const EXPRESSION_PRESET_LABELS: Record<ExpressionTemplateName, string> = buildExpressionLabels();

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
  if (t % 11 > 10.7) out.sorrow = 0.1;
  return out;
}
