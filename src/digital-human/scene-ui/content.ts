/**
 * 作品引用:数字人界面里「一条能直接操作的作品」。
 *
 * 旧的 list / grid 面板条目只有标题和一句自然语言 action,点了只能再问一遍模型;
 * 模型手里又没有「打开页面」「放歌」的工具,于是搜到的东西看得见、点不开。
 * 作品引用带 id + contentType,前端自己就知道怎么打开、怎么播 —— 不用再绕模型。
 *
 * 两个来源(形状一致,见后端 engine/tools_business.go 的 ContentRef):
 *   - AG-UI CUSTOM 事件 content_results:resource_search 的完整结果(带封面、作者)
 *   - ui_show_content / media_play 工具参数:模型挑出来的几条,只有 id / contentType / title / note
 * 后者缺的字段从前者留下的缓存里补,模型不用把一长串封面地址再抄一遍。
 */
import { TYPE_LABEL, TYPE_TO_ROUTE } from '@/lib/contentType.gen';

export interface ContentRef {
  id: string;
  contentType: string;
  title: string;
  cover?: string;
  author?: string;
  /** 模型给的一句推荐语 / 入选理由 */
  note?: string;
  score?: number;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' || typeof v === 'bigint' ? String(v) : '';
}

/** 本次页面会话里见过的作品,按 id 存。只为补全字段,丢了也无妨,所以不持久化、封顶 500 条。 */
const seen = new Map<string, ContentRef>();

export function rememberContentRefs(items: ContentRef[]) {
  for (const it of items) {
    const prev = seen.get(it.id);
    const next: ContentRef = { ...prev, ...it };
    // 新来的这份缺字段时(模型只抄了 id 和标题),别把之前知道的封面/作者冲掉
    if (prev) {
      next.cover = it.cover || prev.cover;
      next.author = it.author || prev.author;
      next.contentType = it.contentType || prev.contentType;
    }
    seen.delete(it.id); // 重新插入 = 挪到最新
    seen.set(it.id, next);
  }
  while (seen.size > 500) seen.delete(seen.keys().next().value as string);
}

/** 宽松地把未知输入规整成作品引用;缺 id 的丢掉,缺的字段尽量从缓存补。 */
export function normalizeContentRefs(raw: unknown): ContentRef[] {
  if (!Array.isArray(raw)) return [];
  const out: ContentRef[] = [];
  const dup = new Set<string>();
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = str(o.id);
    if (!id || dup.has(id)) continue;
    dup.add(id);
    const known = seen.get(id);
    const contentType = (str(o.contentType) || str(o.type) || known?.contentType || '').toUpperCase();
    const title = str(o.title) || known?.title || '';
    if (!title) continue;
    const score = Number(o.score);
    out.push({
      id,
      contentType,
      title,
      cover: str(o.cover) || str(o.image) || str(o.coverUrl) || known?.cover || undefined,
      author: str(o.author) || str(o.artist) || known?.author || undefined,
      note: str(o.note) || str(o.subtitle) || undefined,
      score: Number.isFinite(score) && score > 0 ? score : known?.score,
    });
  }
  return out;
}

export const isMusic = (r: ContentRef) => r.contentType === 'MUSIC';

export function contentTypeLabel(r: ContentRef): string {
  return TYPE_LABEL[r.contentType] || '';
}

export function contentHref(r: ContentRef): string | null {
  const route = TYPE_TO_ROUTE[r.contentType];
  return route ? `${route}?id=${encodeURIComponent(r.id)}` : null;
}

/** 卡片长什么样由类型决定:海报 / 方形唱片 / 横版画面 / 纯文字 / 头像 */
export type CardShape = 'poster' | 'square' | 'wide' | 'text' | 'avatar';

export function cardShape(r: ContentRef): CardShape {
  switch (r.contentType) {
    case 'MUSIC':
      return 'square';
    case 'VIDEO':
    case 'LIVE':
    case 'VSHOW':
      return 'wide';
    case 'NEWS':
    case 'ARTICLE':
      return r.cover ? 'wide' : 'text';
    case 'PERSON':
      return 'avatar';
    default:
      return 'poster';
  }
}

/** 点开一个作品时按钮上写什么 */
export function openVerb(r: ContentRef): string {
  switch (r.contentType) {
    case 'NOVEL':
    case 'COMICS':
    case 'ARTICLE':
    case 'NEWS':
      return '去阅读';
    case 'MUSIC':
      return '歌曲页';
    case 'LIVE':
      return '进直播间';
    case 'PERSON':
    case 'WALLPAPER':
      return '查看';
    default:
      return '去观看';
  }
}

// ---------------------------------------------------------------------------
// 对话里的快捷选项(后端 ui_show_choices)
// ---------------------------------------------------------------------------

export interface ChatChoice {
  label: string;
  /** 点了之后替用户说的话 */
  send: string;
}

export interface ChatChoices {
  prompt?: string;
  options: ChatChoice[];
}

export function normalizeChoices(args: Record<string, unknown> | undefined): ChatChoices | null {
  const raw = args?.options;
  if (!Array.isArray(raw)) return null;
  const options: ChatChoice[] = [];
  for (const x of raw) {
    const label = typeof x === 'string' ? x.trim() : str((x as Record<string, unknown>)?.label);
    if (!label) continue;
    const send = typeof x === 'string' ? label : str((x as Record<string, unknown>)?.send) || label;
    options.push({ label: label.slice(0, 24), send });
    if (options.length >= 6) break;
  }
  if (options.length < 2) return null;
  return { prompt: str(args?.prompt) || undefined, options };
}
