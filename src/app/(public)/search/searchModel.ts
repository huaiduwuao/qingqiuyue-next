// 搜索页的类型、常量与纯函数(从 page.tsx 拆出,无 React 依赖)。
import type { SuggestCreator, SuggestTopic } from '@/apis/search';

// 搜索结果来自 GET /api/content/search(@/apis/search);以下是前端类型与纯函数。
export type SearchContentItemContentType =
  | 'NOVEL' | 'FILM' | 'MUSIC' | 'VIDEO' | 'COMICS'
  | 'TELEPLAY' | 'ARTICLE' | 'ANIMATION' | 'NEWS' | 'VSHOW'
  | 'POETRY';
/**
 * 与后端 recommendapp.searchRow 对齐(content-api /api/content/search):
 * Doris module_content 主表 + availability 注释。views/likes/comments
 * 之类交互数据 /search 不返回,前端不要伪造显示。
 */
export interface SearchContentItem {
  id: number;
  title: string;
  subtitle?: string;
  contentType: SearchContentItemContentType;
  /** 封面图 URL;空则用类型渐变兜底。 */
  cover?: string;
  author: string;
  /** 文本相关度 0~1,Doris sim 值。 */
  score?: number;
  /** playability 状态:playable / pending / partial / playable_read / blocked / unknown。 */
  availability?: string;
  /** 站内能不能看/能读,只有 true 才不会出现"打不开"详情。 */
  usable?: boolean;
  /** 已就绪章节数(小说/剧集)。 */
  readyItems?: number;
  /** 总章节数。 */
  totalItems?: number;
  /** 命中位置,前端根据后端返回或本地推断(title/subtitle/author)决定高亮哪段。 */
  matchField?: 'title' | 'subtitle' | 'author';
  /** §15.11 这条结果为什么出现:title-exact / alias-match / pinyin-match / hot-score-boost / auto-indexed … */
  reason?: string;
  /** >1:同一部作品被几个数据源各收录了一条,后端并成了这一张卡(代表行优先选能看的) */
  mergedCount?: number;
  /** 被并进来的其余几条 */
  variants?: { id: number | string; contentType: string; sourceLabel?: string; usable?: boolean }[];
}
export interface SearchCreatorItem {
  id: number;
  name: string;
  bio: string;
  avatarGradient: string;
  followers: number;
  works: number;
  verified: boolean;
  tags: string[];
}
export interface SearchTopicItem {
  id: number;
  title: string;
  description: string;
  discussCount: number;
  viewCount: number;
  hot: boolean;
  gradient: string;
}
export function formatNumber(n: number): string { return n.toString(); }

export type ResultTab = 'all' | 'content' | 'creator' | 'topic';

export const TYPE_LABEL: Record<SearchContentItem['contentType'], string> = {
  NOVEL: '小说',
  FILM: '电影',
  MUSIC: '音乐',
  VIDEO: '视频',
  COMICS: '漫画',
  TELEPLAY: '剧集',
  ARTICLE: '文章',
  ANIMATION: '动画',
  NEWS: '资讯',
  VSHOW: '综艺',
  POETRY: '古诗',
};

export const TYPE_ACCENT: Record<SearchContentItem['contentType'], string> = {
  NOVEL: '#FE2C55',
  FILM: '#8B5CF6',
  MUSIC: '#D4AF37',
  VIDEO: '#25F4EE',
  COMICS: '#5B8DEF',
  TELEPLAY: '#FF8A3D',
  ARTICLE: '#FFB400',
  ANIMATION: '#F472B6',
  NEWS: '#C5C8D6',
  VSHOW: '#FE2C55',
  POETRY: '#7C3AED',
};

/** §15.11 后端 reason 的中文说明(对应后端 reasonHints)。 */
export const REASON_HINT: Record<string, string> = {
  'title-exact': '标题完全匹配',
  'title-prefix': '标题前缀匹配',
  'title-partial': '标题包含关键词',
  'pinyin-match': '拼音匹配',
  'author-match': '作者/主演匹配',
  'alias-match': '别名匹配',
  'original-title': '原名匹配',
  'hot-score-boost': '热门内容',
  'auto-indexed': '全网自动收录',
  'alias-or-original': '别名/原名匹配',
};

/** 后端 /search 的 list → 结果卡片数据;第一页和「加载更多」共用。 */
/** 后端 /search 单条结果的原始字段(各数据源字段名不统一) */
interface SearchHitRaw {
  id?: number;
  contentType?: string;
  type?: string;
  title?: string;
  name?: string;
  subtitle?: string;
  info?: string;
  description?: string;
  cover?: string;
  coverUrl?: string;
  author?: string;
  username?: string;
  userName?: string;
  score?: unknown;
  availability?: string;
  usable?: unknown;
  readyItems?: unknown;
  totalItems?: unknown;
  reason?: unknown;
  mergedCount?: unknown;
  variants?: unknown;
}

export function toSearchItems(res: unknown, q: string): SearchContentItem[] {
  const list = (res as { list?: unknown } | null | undefined)?.list || res || [];
  const lq = q.toLowerCase();
  return (Array.isArray(list) ? list : []).map((it: SearchHitRaw) => {
    const type = (it.contentType || it.type || 'VIDEO').toUpperCase() as SearchContentItem['contentType'];
    // 命中位置:后端没显式给 matchField,前端按"关键词是否在 title/author 里"推断,
    // 让卡片右下角那个"标题/描述/作者命中"标签有意义。
    let matchField: SearchContentItem['matchField'] = 'title';
    if (it.title && lq && it.title.toLowerCase().includes(lq)) matchField = 'title';
    else if (it.author && lq && it.author.toLowerCase().includes(lq)) matchField = 'author';
    else matchField = 'subtitle';
    return {
      id: it.id ?? 0,
      title: it.title || it.name || '未命名',
      subtitle: it.subtitle || it.info || it.description,
      contentType: type,
      cover: it.cover || it.coverUrl || undefined,
      author: it.author || it.username || it.userName || '清秋月',
      score: typeof it.score === 'number' ? it.score : undefined,
      availability: it.availability,
      usable: Boolean(it.usable),
      readyItems: typeof it.readyItems === 'number' ? it.readyItems : undefined,
      totalItems: typeof it.totalItems === 'number' ? it.totalItems : undefined,
      matchField,
      // §15.11 后端算的 reason(为什么这条结果出现);后端没给就 undefined
      reason: typeof it.reason === 'string' ? it.reason : undefined,
      mergedCount: typeof it.mergedCount === 'number' ? it.mergedCount : undefined,
      variants: Array.isArray(it.variants) ? it.variants : undefined,
    } as SearchContentItem;
  });
}

// 全网检索进行中每 2.5 秒重搜一次,最多约 40 秒。
export const DISCOVER_POLL_INTERVAL = 2500;
/** 全网检索推送(SSE)触发重搜的最小间隔。 */
export const SEARCH_STREAM_REFETCH_GAP = 2000;
export const DISCOVER_MAX_POLLS = 16;

export function parseResultTab(v: string | null): ResultTab {
  return v === 'content' || v === 'creator' || v === 'topic' ? v : 'all';
}

/** filterQs:页签 + 结构化筛选,换关键词 / 换模式时一并带上,不让它们从 URL 里掉出去。 */
export function searchHref(q: string, ai: boolean, filterQs = ''): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (ai) params.set('mode', 'ai');
  new URLSearchParams(filterQs).forEach((v, k) => params.set(k, v));
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}

/** 创作者联想(suggestCreators)→ 结果卡片数据。 */
export function toCreatorItems(creatorList: SuggestCreator[]): SearchCreatorItem[] {
  return creatorList.map((c) => ({
    id: c.id,
    name: c.name || c.nickname || '创作者',
    bio: c.bio || '',
    avatarGradient:
      c.avatar
        ? `url(${c.avatar})`
        : 'linear-gradient(135deg, #FE2C55, #8B5CF6)',
    followers: c.followers ?? 0,
    works: 0,
    verified: Boolean(c.verified),
    tags: [],
  })) as SearchCreatorItem[];
}

/** 话题联想(suggestTopics)→ 结果卡片数据。 */
export function toTopicItems(topicList: SuggestTopic[]): SearchTopicItem[] {
  return topicList.map((t) => ({
    id: t.id,
    title: t.title || t.name || '话题',
    description: t.description || '',
    discussCount: t.discussCount ?? 0,
    viewCount: t.viewCount ?? 0,
    hot: Boolean(t.hot),
    gradient: t.coverGradient || 'linear-gradient(135deg, #FE2C55, #FFB400)',
  })) as SearchTopicItem[];
}
