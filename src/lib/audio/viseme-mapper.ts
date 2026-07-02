/**
 * Viseme Mapper — 拼音首字母 → OVRLipSync 标准 viseme
 *
 * Qwen3-TTS 输出 WAV, 然后 ASR 强制对齐返回每个汉字的 start/end 时间
 * 用 pinyin 库转拼音, 取首字母, 映射到 14 种标准 viseme
 *
 * 同时保留闭口 (silence/closed) 时间槽 (segments 之间的空隙)
 */

import { pinyin } from 'pinyin-pro'

// ARKit/OVRLipSync 14 种 viseme:
// 'sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR',
// 'aa', 'E', 'I', 'O', 'U'
//
// 简化映射 (汉字拼音首字母 → viseme):
const VISEME_BY_INITIAL: Record<string, string> = {
  // 元音
  a: 'aa', o: 'O', e: 'E', i: 'I', u: 'U', v: 'U', ü: 'U',
  // 双元音/三元音开头取第一个
  ai: 'aa', ei: 'E', ui: 'U', ao: 'aa', ou: 'O', iu: 'U',
  ie: 'E', ve: 'E', er: 'E',
  // 辅音
  b: 'PP', p: 'PP', m: 'PP',                    // 双唇音
  f: 'FF',
  d: 'DD', t: 'DD', n: 'nn', l: 'nn',
  g: 'kk', k: 'kk', h: 'kk',
  j: 'CH', q: 'CH', x: 'CH',
  zh: 'CH', ch: 'CH', sh: 'CH', r: 'RR',
  z: 'SS', c: 'SS', s: 'SS',
  y: 'I', w: 'U',
}

function charToViseme(ch: string): string {
  if (/[\s，。！？、；：""''（）,.!?;:"'()]/.test(ch)) return 'sil'  // 标点 → 静音
  try {
    const py = pinyin(ch, { pattern: 'first', toneType: 'none', type: 'array' })
    const initial = (py[0]?.[0] || '').toLowerCase()
    return VISEME_BY_INITIAL[initial] || VISEME_BY_INITIAL[initial[0]] || 'sil'
  } catch {
    return 'sil'
  }
}

export interface VisemeFrame {
  t: number           // 开始时间 (秒)
  shape: string       // viseme 名
  weight: number      // 强度 0-1
}

export interface AlignedSegment {
  text: string
  start: number
  end: number
}

/**
 * 把 ASR 对齐的 segments + 原文 → viseme 时间轴
 *
 * 对每个 segment:
 *   - 字符时长 = (end - start) / 字符数
 *   - 每字符中间点放一个 viseme 帧, 边界处加 closed 帧
 *   - segments 之间的空隙也加 closed 帧
 */
export function segmentsToVisemes(
  segments: AlignedSegment[],
  totalDuration = 0
): VisemeFrame[] {
  const out: VisemeFrame[] = []
  let cursor = 0

  for (const seg of segments) {
    // 段前空隙 (closed)
    if (seg.start > cursor + 0.05) {
      out.push({ t: cursor, shape: 'sil', weight: 1 })
    }

    const chars = Array.from(seg.text)
    if (chars.length === 0) continue
    const charDur = (seg.end - seg.start) / chars.length

    chars.forEach((ch, i) => {
      const t = seg.start + i * charDur
      // 静音字符 (标点)
      if (/\s/.test(ch) || /[，。！？、；：""''（）,.!?;:"'()]/.test(ch)) {
        out.push({ t, shape: 'sil', weight: 1 })
      } else {
        const shape = charToViseme(ch)
        out.push({ t, shape, weight: shape === 'sil' ? 0.6 : 1 })
      }
    })

    cursor = seg.end
  }

  // 尾部 closed
  if (totalDuration > cursor + 0.05) {
    out.push({ t: cursor, shape: 'sil', weight: 1 })
  }

  return out
}

/**
 * 简化版: 字符均匀分布 (无对齐, 兜底用)
 */
export function textToUniformVisemes(text: string, totalDuration = 0): VisemeFrame[] {
  const chars = Array.from(text.replace(/[\s，。！？、；：""''（）,.!?;:"'()]/g, ''))
  if (chars.length === 0) return []
  const dur = totalDuration / chars.length || 0.15
  return chars.map((ch, i) => ({
    t: i * dur,
    shape: charToViseme(ch),
    weight: 1,
  }))
}