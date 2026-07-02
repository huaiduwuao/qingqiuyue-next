/**
 * content/fingerprint.ts — 内容指纹去重
 *
 * 算法: SimHash (局部敏感哈希)
 * 用途: 判断两篇内容是否相似, 用于爬虫去重
 *
 * 流程:
 *   1. 文本分词 (中文按字符/2-gram, 英文按空格)
 *   2. 每个词 hash 并加权
 *   3. 合并得到 64 位指纹
 *   4. 海明距离 < 阈值判定重复
 */

export const DEFAULT_HAMMING_THRESHOLD = 3

function djb2Hash(s: string): number {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i)
    hash |= 0
  }
  return hash
}

function md5LikeHash(s: string): bigint {
  // 用两个 djb2 变种生成 64 位指纹的两个 32 位半区
  let h1 = 5381
  let h2 = 52711
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = ((h1 << 5) + h1) + c
    h1 |= 0
    h2 = ((h2 << 5) + h2) + (c ^ 0x5a)
    h2 |= 0
  }
  // 组合成 64 位 (用 BigInt)
  const unsigned = (n: number) => BigInt(n >>> 0)
  return (unsigned(h1) << BigInt(32)) | unsigned(h2)
}

function tokens(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[\s\n\r\t]+/g, ' ')
    .replace(/[^一-龥a-z0-9\s]/g, ' ')
    .trim()
  if (!cleaned) return []

  const out: string[] = []
  // 中文 2-gram
  for (let i = 0; i < cleaned.length - 1; i++) {
    const ch = cleaned[i]
    const next = cleaned[i + 1]
    if (/[一-龥]/.test(ch)) {
      out.push(ch + next)
    }
  }
  // 英文/数字词
  for (const word of cleaned.split(/\s+/)) {
    if (word.length >= 2) out.push(word)
  }
  return out
}

export function simHash(text: string): bigint {
  const toks = tokens(text)
  if (toks.length === 0) return BigInt(0)

  const bits = new Array(64).fill(0)
  for (const t of toks) {
    const h = md5LikeHash(t)
    const weight = Math.sqrt(t.length)
    for (let i = 0; i < 64; i++) {
      const bit = (h >> BigInt(i)) & BigInt(1)
      bits[i] += bit === BigInt(1) ? weight : -weight
    }
  }

  let fingerprint = BigInt(0)
  for (let i = 0; i < 64; i++) {
    if (bits[i] > 0) {
      fingerprint |= BigInt(1) << BigInt(i)
    }
  }
  return fingerprint
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b
  let dist = 0
  while (x > 0) {
    dist++
    x &= x - BigInt(1)
  }
  return dist
}

export function isDuplicate(a: string, b: string, threshold = DEFAULT_HAMMING_THRESHOLD): boolean {
  const ha = simHash(a)
  const hb = simHash(b)
  return hammingDistance(ha, hb) <= threshold
}

export interface FingerprintIndex {
  add(text: string, id: string): boolean // true = 已存在相似, false = 新内容
  check(text: string): { duplicate: boolean; nearestId?: string; distance?: number }
  size(): number
}

/** 内存指纹索引 (适合前端/小数据量) */
export function createFingerprintIndex(threshold = DEFAULT_HAMMING_THRESHOLD): FingerprintIndex {
  const store = new Map<string, bigint>()

  return {
    add(text, id) {
      const h = simHash(text)
      for (const [existingId, existingHash] of store) {
        if (hammingDistance(h, existingHash) <= threshold) {
          return true
        }
      }
      store.set(id, h)
      return false
    },
    check(text) {
      const h = simHash(text)
      let nearestId: string | undefined
      let minDist = Infinity
      for (const [id, existingHash] of store) {
        const d = hammingDistance(h, existingHash)
        if (d < minDist) {
          minDist = d
          nearestId = id
        }
      }
      return {
        duplicate: minDist <= threshold,
        nearestId,
        distance: minDist === Infinity ? undefined : minDist,
      }
    },
    size() {
      return store.size
    },
  }
}

/** 简化 MinHash (用于长文本集合相似度) */
export function minHashSignatures(text: string, numHashes = 16): number[] {
  const toks = tokens(text)
  const sig: number[] = []
  for (let i = 0; i < numHashes; i++) {
    let min = Infinity
    for (const t of toks) {
      const h = djb2Hash(t + i)
      const u = h >>> 0
      if (u < min) min = u
    }
    sig.push(min === Infinity ? 0 : min)
  }
  return sig
}

export function minHashSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let same = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) same++
  }
  return same / a.length
}
