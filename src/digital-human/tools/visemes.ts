/**
 * Viseme 表 — OVRLipSync 标准对齐
 *
 * 14 个 viseme: sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, I, O, U
 * 加上 closed (sil 的别名)
 *
 * 每个 viseme 是多个 ARKit blendshape 的组合 — 因为 VRM 用 viseme_* 前缀,
 * 我们同时设两边, 让任意 VRM 模型都能找到对应 channel。
 */

import type { BlendshapeDict } from './expressions';

export type VisemeName =
  | 'sil' | 'PP' | 'FF' | 'TH' | 'DD' | 'kk' | 'CH' | 'SS' | 'nn' | 'RR'
  | 'aa' | 'E' | 'I' | 'O' | 'U' | 'closed';

export const VISEME_NAMES: VisemeName[] = [
  'sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR',
  'aa', 'E', 'I', 'O', 'U', 'closed',
];

/** Viseme → ARKit blendshape 组合 */
export const VISEME_BLENDSHAPES: Record<VisemeName, BlendshapeDict> = {
  sil: { viseme_sil: 1.0, mouthClose: 1.0 },
  PP: { viseme_PP: 1.0, mouthPressLeft: 0.5, mouthPressRight: 0.5, mouthClose: 0.4 },
  FF: { viseme_FF: 1.0, mouthLowerDownLeft: 0.4, mouthLowerDownRight: 0.4 },
  TH: { viseme_TH: 1.0, tongueOut: 0.5, mouthOpen: 0.2 },
  DD: { viseme_DD: 1.0, mouthOpen: 0.3, tongueOut: 0.3 },
  kk: { viseme_kk: 1.0, mouthOpen: 0.4 },
  CH: { viseme_CH: 1.0, mouthFunnel: 0.5, mouthOpen: 0.3 },
  SS: { viseme_SS: 1.0, mouthStretchLeft: 0.3, mouthStretchRight: 0.3 },
  nn: { viseme_nn: 1.0, mouthOpen: 0.3 },
  RR: { viseme_RR: 1.0, mouthOpen: 0.4, mouthRollLower: 0.3 },
  aa: { viseme_aa: 1.0, jawOpen: 0.6, mouthOpen: 0.5 },
  E:  { viseme_E: 1.0, mouthStretchLeft: 0.4, mouthStretchRight: 0.4 },
  I:  { viseme_I: 1.0, mouthStretchLeft: 0.5, mouthStretchRight: 0.5 },
  O:  { viseme_O: 1.0, jawOpen: 0.7, mouthFunnel: 0.4 },
  U:  { viseme_U: 1.0, mouthPucker: 0.6, mouthFunnel: 0.3 },
  closed: { mouthClose: 1.0 },
};

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
