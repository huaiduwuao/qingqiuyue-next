/**
 * 虚拟浏览器 — iframe 指令统一解析器
 *
 * 后端 AG-UI 数字人模板的 iframe 指令只有一种形状:
 *   <ui:{"type":"iframe","url":"https://...","title":"..."}/>
 *
 * 但用户实际要看的网页分三类, 前端需要统一识别:
 *   1. 普通网页   (百度/知乎/维基…)   → iframe 直接嵌
 *   2. 视频       (B站/抖音…)          → 映射到站内嵌入播放器 URL 自动播
 *   3. 禁止嵌入站 (X-Frame-Options)    → fallback: 新标签 / 换嵌入 URL
 *
 * LLM 可能用自定义 scheme 把三类写清楚:
 *   <ui:{"type":"iframe","url":"video:https://...","title":"视频"}/>      ← 强制视频模式
 *   <ui:{"type":"iframe","url":"tab:https://...","title":"站点"}/>        ← 强制 iframe 模式
 *   <ui:{"type":"iframe","url":"normal:https://...","title":"网页"}/>     ← 按支持度自动选
 *   裸 URL (不带前缀) 等同 normal。
 *
 * 本模块把 scheme 统一 + 支持度判定 + 嵌入 URL 映射收拢成一小组纯函数,
 * 供 Immersive / Floating 两个数字人入口共用, 避免各自解析漂移。
 */

export type IframeDisplayMode = 'normal' | 'video' | 'tab'

export interface IframeOpenTarget {
  /** 解析出的最终可嵌入 URL */
  url: string
  /** 展示模式(告诉显示器怎么渲染) */
  mode: IframeDisplayMode
  /** 原始(未加前缀)URL, 用于新标签打开 */
  rawUrl: string
  /** 是否判定为「能直接嵌入」 */
  support: 'yes' | 'no' | 'unknown'
  /** 建议的展示方式(当用户没指定时) */
  upgrade?: IframeDisplayMode
}

const PREFIX_RE = /^\s*(video|tab|normal):([\s\S]*)$/

/** 去掉 video:/tab:/normal: 前缀, 返回干净的原始 URL */
export function stripIframePrefix(url: string): { raw: string; mode?: IframeDisplayMode } {
  const m = PREFIX_RE.exec(url || '')
  if (!m) return { raw: (url || '').trim() }
  return {
    raw: m[2].trim(),
    mode: m[1] === 'video' ? 'video' : m[1] === 'tab' ? 'tab' : 'normal',
  }
}

/** 支持 iframe 嵌入的域名白名单(后端提示「优先选支持嵌入的站」的落点) */
const EMBED_OK_HOSTS: Array<string | RegExp> = [
  'player.bilibili.com',
  'bilibili.com',
  'douyin.com',
  'zhihu.com',
  'baidu.com',
  'baike.baidu.com',
  'github.com',
  'wikipedia.org',
  'google.com',
  'bing.com',
  'qq.com',
  '163.com',
  'youku.com',
  'sohu.com',
  'cntv.cn',
  'youtube.com',
  'youtu.be',
  /\.gov\.cn$/,
]

/** 判定裸 URL 能否直接嵌入(命中白名单 → yes, 未知域名 → unknown) */
export function isEmbeddable(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return EMBED_OK_HOSTS.some((h) => (typeof h === 'string' ? host === h || host.endsWith('.' + h) : h.test(host)))
  } catch {
    return false
  }
}

/** B站 URL → 站内嵌入播放器 URL (BV/BV 短链/space 都行) */
function toBilibiliEmbed(url: string): string | null {
  const bvid = url.match(/(BV[0-9A-Za-z]{10})/)?.[1]
  if (!bvid) return null
  return `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1&high_quality=1`
}

/** 抖音分享 URL → 站内嵌入页(无官方 embed, 直接透传, 加载失败走 fallback) */
function toDouyinEmbed(url: string): string {
  if (/douyin\.com/.test(url) && !/\bvideo\b/.test(url)) {
    const m = url.match(/(\d{15,})/)
    if (m) return `https://www.douyin.com/video/${m[1]}`
  }
  return url
}

/**
 * 把「网页 URL」映射成可嵌入的播放器 URL(当前只处理能映射的)。
 * 返回 null 表示无法映射 → 原样当 iframe 用(失败走 fallback)。
 */
export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host.includes('bilibili.com')) return toBilibiliEmbed(u.href)
    if (host.includes('douyin.com')) return toDouyinEmbed(u.href)
  } catch {
    /* 不是合法 URL, 原样返回 */
  }
  return null
}

/** 嵌入被拒时的代理中转(经公共 CORS 代理剥掉 X-Frame-Options, 可嵌入白屏站) */
export function toProxyUrl(url: string): string {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
}

/**
 * 统一解析一条 iframe 指令, 产出显示器可用的目标。
 *
 * @param ui url/title 来自 LLM 的 iframe 指令 (url 可带 video:/tab:/normal: 前缀)
 * @param opts.forceMode 用户/调用方强制指定模式(手动切换时用)
 */
export function resolveIframeUrl(
  ui: { url: string; title?: string },
  opts: { forceMode?: IframeDisplayMode } = {},
): IframeOpenTarget {
  const { raw, mode } = stripIframePrefix(ui.url || '')
  const force = opts.forceMode
  let m: IframeDisplayMode = force || mode || 'normal'
  let targetUrl = raw

  if (m === 'video') {
    targetUrl = toEmbedUrl(raw) || raw
  } else if (m === 'normal') {
    // 普通 URL: 若能映射到视频播放器则自动升级 video 模式(如 B站 BV→player.bilibili.com)
    const embed = toEmbedUrl(raw)
    if (embed) {
      targetUrl = embed
      m = 'video'
    }
  }

  return {
    url: targetUrl,
    mode: m,
    rawUrl: raw,
    support: m === 'tab' ? 'no' : isEmbeddable(raw) ? 'yes' : 'unknown',
    upgrade: m === 'normal' && !isEmbeddable(raw) ? 'video' : undefined,
  }
}

/**
 * 解析 LLM 的 iframe 指令(从 <ui:{json}/> 解出的对象), 返回可渲染目标。
 * 不是 iframe 指令 → 返回 null。
 */
export function parseIframeUI(ui: any): IframeOpenTarget | null {
  if (!ui || typeof ui !== 'object' || ui.type !== 'iframe' || !ui.url) return null
  return resolveIframeUrl({ url: ui.url, title: ui.title })
}

/** 工具调用 (Hermes tool_call 形状, 兼容 params/args 两种字段) */
export interface IframeToolCallLike {
  name: string
  params?: Record<string, any>
  args?: Record<string, any>
}

const IFRAME_TOOL_NAMES = new Set([
  'browser.open', 'browser.openUrl', 'openUrl',
  'browser.watch', 'video.open', 'video.watch', 'video.play',
  'browser.browse', 'web.open', 'web.browse',
])

/**
 * 从 tool_call 里识别「打开网页/看视频」工具, 转成显示器目标。
 * 非 iframe 工具 → 返回 null。
 */
export function iframeToolToTarget(call: IframeToolCallLike): IframeOpenTarget | null {
  if (!call || typeof call !== 'object') return null
  if (!IFRAME_TOOL_NAMES.has(call.name)) return null
  const p = (call.params || call.args || {}) as Record<string, any>
  const url = p.url || p.target || p.link || ''
  if (!url) return null
  return resolveIframeUrl({ url, title: p.title })
}
