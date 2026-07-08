/**
 * Viseme 表 — 从 ConfigBundle 动态生成
 *
 * Phase 1.5：从 src/data/seed/visemes/character.json 加载。
 * 兼容：VISEME_NAMES / VISEME_BLENDSHAPES 形状不变。
 */

import { loadConfigBundle, buildLookups } from '../vrm/config/loader';
import type { BlendshapeDict, VisemeName as VName } from '../vrm/config/types';

export type VisemeName = VName;
export type { BlendshapeDict };

// 模块加载时一次性生成
const _bundle = loadConfigBundle();

/** viseme 名字数组（按 name 排） */
export const VISEME_NAMES: VisemeName[] = _bundle.visemes.map((v) => v.name as VisemeName);

/** Viseme → ARKit blendshape 组合 */
export const VISEME_BLENDSHAPES: Record<VisemeName, BlendshapeDict> = (() => {
  const out: Partial<Record<VisemeName, BlendshapeDict>> = {};
  for (const v of _bundle.visemes) {
    out[v.name as VisemeName] = { ...v.blendshapes };
  }
  // closed 默认值兜底（如果 seed JSON 没包含）
  if (!out.closed) out.closed = { mouthClose: 1.0 };
  return out as Record<VisemeName, BlendshapeDict>;
})();

/** 中文 → viseme (基于拼音首字母匹配) */
export function chineseCharToViseme(ch: string): VisemeName {
  if (!ch) return 'closed';
  if (/\s/.test(ch)) return 'sil';
  // 元音优先
  if (/[诶一]/u.test(ch) || /[eI]/i.test(ch)) return 'I';
  if (/[哦乌]/u.test(ch) || /[uU]/i.test(ch)) return 'U';
  if (/[喔]/u.test(ch) || /[o]/i.test(ch)) return 'O';
  if (/[啊]/u.test(ch) || /[a]/i.test(ch)) return 'aa';
  if (/[E]/i.test(ch)) return 'E';
  // 辅音
  const lower = ch.toLowerCase();
  if (/[mnl]/.test(lower)) return 'nn';
  if (/[bp]/.test(lower)) return 'PP';
  if (/[fv]/.test(lower)) return 'FF';
  if (/[dt]/.test(lower)) return 'DD';
  if (/[kg]/.test(lower)) return 'kk';
  if (/[chjqx]/.test(lower)) return 'CH';
  if (/[sz]/.test(lower)) return 'SS';
  if (/[r]/.test(lower)) return 'RR';
  if (/[th]/.test(lower)) return 'TH';
  return 'aa';
}

/** 文本 → viseme 时间线 */
export function textToVisemeTimeline(text: string, charMs = 150): { t: number; shape: VisemeName; weight: number }[] {
  const out: { t: number; shape: VisemeName; weight: number }[] = [];
  let tMs = 0;
  for (const ch of text) {
    const viseme = chineseCharToViseme(ch);
    out.push({ t: tMs / 1000, shape: viseme, weight: 1 });
    tMs += charMs;
  }
  // 末尾 closed
  out.push({ t: tMs / 1000, shape: 'closed', weight: 1 });
  return out;
}

/** 频谱能量 → viseme (驱动口型同步兜底) */
export function lipEnergyToViseme(rms: number, lastTone: VisemeName): VisemeName {
  if (rms < 0.01) return 'sil';
  const r = Math.random();
  if (rms < 0.03) return r < 0.5 ? 'E' : 'I';
  if (rms < 0.08) return r < 0.5 ? 'aa' : 'E';
  return r < 0.4 ? 'O' : (r < 0.7 ? 'U' : 'aa');
}
