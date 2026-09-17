/**
 * 场景显示器上「放什么」的纯逻辑:页面分到哪块屏、每块屏自己的前进/后退栈。
 *
 * 屏幕里的页面是 iframe。浏览器的历史栈是整个标签页共用的(joint session history):
 * 在某块屏里调 history.back(),退的可能是另一块屏,甚至把数字人页面本身退走。
 * 所以每块屏自己记一份访问栈,后退 = 让 iframe 直接去栈里的上一个地址。
 */

import type { IframeOpenTarget } from '../virtual-browser';
import { isDisplaySlot, type DisplaySlot } from '../vrm/sceneDisplays';

export interface DisplayPage {
  /** iframe 实际加载的地址 */
  url: string;
  title?: string;
  /** site=站内页面(同源,能读地址/标题);web=外站网页;video=直链视频 */
  kind: 'site' | 'web' | 'video';
  /** 新标签打开用的原始地址 */
  rawUrl: string;
  /** 外站是否确认能内嵌;不确定时屏幕底部给「代理/新标签」兜底条 */
  embeddable: boolean;
  /** 每次打开递增:同一个地址再开一次也要重新加载 */
  seq: number;
}

export type DisplayPages = Partial<Record<DisplaySlot, DisplayPage>>;

let seq = 0;

/** 站内地址:/ 开头的路径,或和当前页同源的绝对地址 */
export function toSitePath(url: string, origin?: string): string | null {
  const u = (url || '').trim();
  if (!u) return null;
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  if (base && u.startsWith(`${base}/`)) return u.slice(base.length);
  return null;
}

const MEDIA_FILE_RE = /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i;

const LANDSCAPE_DETAIL = new Set(['film', 'teleplay', 'animation', 'video', 'vshow', 'live', 'topic']);
const PORTRAIT_DETAIL = new Set(['novel', 'comics', 'article', 'news', 'person', 'image', 'music']);

/** 按页面类型挑屏幕:看的东西上大屏,读的东西上竖屏,其它上副屏 */
export function slotForUrl(url: string): DisplaySlot {
  const path = toSitePath(url);
  if (path === null) return MEDIA_FILE_RE.test(url) ? 'wall' : 'desk';
  const m = /^\/detail\/([a-z]+)-detail/.exec(path);
  if (m) {
    if (LANDSCAPE_DETAIL.has(m[1])) return 'wall';
    if (PORTRAIT_DETAIL.has(m[1])) return 'kiosk';
  }
  if (/^\/(playlist|u\/)/.test(path)) return 'kiosk';
  return 'desk';
}

export function sitePage(path: string, title?: string): DisplayPage {
  return { url: path, title, kind: 'site', rawUrl: path, embeddable: true, seq: ++seq };
}

/** 数字人的「打开网页/放视频」指令(虚拟浏览器解析器的产物)→ 屏幕上的一页 */
export function pageFromTarget(target: IframeOpenTarget, title?: string): DisplayPage {
  const site = toSitePath(target.rawUrl || target.url);
  if (site) return sitePage(site, title);
  const direct = MEDIA_FILE_RE.test(target.url);
  return {
    url: target.url,
    title,
    kind: direct ? 'video' : 'web',
    rawUrl: target.rawUrl || target.url,
    // 映射成官方外链播放器的(B 站等)一定能嵌
    embeddable: direct || target.support === 'yes' || target.url !== target.rawUrl,
    seq: ++seq,
  };
}

/** 模型/调用方给的屏幕名(中英文都认),认不出返回 null 由 slotForUrl 决定 */
export function parseSlot(v: unknown): DisplaySlot | null {
  if (isDisplaySlot(v)) return v;
  const s = typeof v === 'string' ? v.trim() : '';
  if (/大屏|电视|main|tv/i.test(s)) return 'wall';
  if (/副屏|side|second/i.test(s)) return 'desk';
  if (/竖屏|手机|portrait|phone/i.test(s)) return 'kiosk';
  return null;
}

/** 地址栏里敲的东西 → 要打开的地址:站内路径 / 网址 / 其余当搜索词 */
export function resolveDisplayInput(input: string): string {
  const v = input.trim();
  const site = toSitePath(v);
  if (site) return site;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return `https://${v}`;
  return `/search?q=${encodeURIComponent(v)}`;
}

// ---------------------------------------------------------------------------
// 每块屏自己的访问栈
// ---------------------------------------------------------------------------

export interface NavStack {
  entries: string[];
  index: number;
}

export const emptyNav = (): NavStack => ({ entries: [], index: -1 });

/**
 * iframe 里的地址变了(用户点了页面里的链接,或我们自己让它前进/后退)。
 * 变成栈里相邻的地址算前进/后退,否则截断后面的、压入新地址。
 */
export function navObserve(nav: NavStack, href: string): NavStack {
  if (!href || nav.entries[nav.index] === href) return nav;
  if (nav.index > 0 && nav.entries[nav.index - 1] === href) return { ...nav, index: nav.index - 1 };
  if (nav.entries[nav.index + 1] === href) return { ...nav, index: nav.index + 1 };
  const entries = [...nav.entries.slice(0, nav.index + 1), href].slice(-50);
  return { entries, index: entries.length - 1 };
}

export const navCanBack = (nav: NavStack) => nav.index > 0;
export const navCanForward = (nav: NavStack) => nav.index >= 0 && nav.index < nav.entries.length - 1;

/** 屏幕内页面(同源 iframe)发给外层的消息:页面里的「返回」交给屏幕自己的栈处理 */
export const EMBED_MESSAGE = 'qq-scene-display';
export interface EmbedMessage {
  source: typeof EMBED_MESSAGE;
  action: 'back';
}
export function isEmbedMessage(v: unknown): v is EmbedMessage {
  return !!v && typeof v === 'object' && (v as EmbedMessage).source === EMBED_MESSAGE;
}
