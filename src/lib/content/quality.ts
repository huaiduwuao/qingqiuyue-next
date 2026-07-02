/**
 * content/quality.ts — 内容质量评分
 *
 * 两层评分:
 *   1. 规则层: 标题长度、内容长度、格式规范、重复度
 *   2. LLM 层 (可选): 用轻量模型判断内容相关性/可读性
 */

export interface ContentQualityInput {
  title?: string
  content?: string
  author?: string
  category?: string
  images?: number
  url?: string
}

export interface QualityScore {
  total: number // 0-100
  rules: number // 0-100
  llm?: number  // 0-100
  reasons: string[]
}

function ruleScore(input: ContentQualityInput): { score: number; reasons: string[] } {
  const { title, content } = input
  let score = 0
  const reasons: string[] = []

  // 标题长度
  const titleLen = (title || '').trim().length
  if (titleLen >= 5 && titleLen <= 50) {
    score += 25
  } else {
    reasons.push(titleLen < 5 ? '标题过短' : '标题过长')
  }

  // 内容长度
  const contentLen = (content || '').trim().length
  if (contentLen >= 100) {
    score += 35
  } else if (contentLen >= 50) {
    score += 20
    reasons.push('内容偏短')
  } else {
    reasons.push('内容过短')
  }

  // 重复字符检测
  if (contentLen > 0) {
    const uniqueChars = new Set(content).size
    const ratio = uniqueChars / contentLen
    if (ratio > 0.3) {
      score += 20
    } else {
      reasons.push('内容重复字符过多')
    }
  }

  // 垃圾关键词
  const spamWords = ['刷单', '兼职', '日赚', '博彩', '澳门']
  const hasSpam = spamWords.some((w) => content?.includes(w) || title?.includes(w))
  if (!hasSpam) {
    score += 20
  } else {
    reasons.push('包含垃圾关键词')
  }

  return { score: Math.min(100, Math.max(0, score)), reasons }
}

export function scoreContent(input: ContentQualityInput): QualityScore {
  const { score, reasons } = ruleScore(input)
  return {
    total: score,
    rules: score,
    reasons,
  }
}

/** 可选: 调用 LLM 对内容质量打分 (异步) */
export async function scoreContentWithLLM(
  input: ContentQualityInput,
  opts: { baseUrl?: string; apiKey?: string; model?: string } = {},
): Promise<QualityScore> {
  const base = scoreContent(input)
  const baseUrl = opts.baseUrl || process.env.OPENAI_BASE_URL
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY
  if (!baseUrl || !apiKey) {
    return base
  }

  try {
    const prompt = `请对以下内容质量打分(0-100),只返回 JSON: {"score": 整数, "reason": "简短理由"}
标题: ${input.title || '无'}
内容: ${(input.content || '').slice(0, 500)}
分类: ${input.category || '未分类'}`

    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: opts.model || process.env.OPENAI_MODEL || 'qwen-plus',
        messages: [
          { role: 'system', content: '你是内容质量评估助手,只返回 JSON。' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    if (!r.ok) return base
    const j = await r.json()
    const text = j?.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(text)
    const llmScore = Math.max(0, Math.min(100, Number(parsed.score) || 0))
    const total = Math.round(base.rules * 0.6 + llmScore * 0.4)
    return {
      total,
      rules: base.rules,
      llm: llmScore,
      reasons: parsed.reason ? [...base.reasons, `LLM: ${parsed.reason}`] : base.reasons,
    }
  } catch {
    return base
  }
}

/** 判断内容是否可入库 */
export function isAcceptable(score: QualityScore, minTotal = 60): boolean {
  return score.total >= minTotal
}
