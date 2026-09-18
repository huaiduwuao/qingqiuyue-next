'use client';

/**
 * 首页(精选)频道模型。
 *
 * 频道就是顶部那排页签,URL 上是 ?section=<id>。以前这排是写死的 15 项,
 * 现在除「推荐」外全部由用户自己增删排序(见 lib/sectionPrefs),
 * 所以每个页签要能自我描述"这一格该取什么内容":
 *
 *   recommend  多类型交错的聚合流(固定第一项,不可删)
 *   type       一个内容大类,可再带一个题材(contentType + genre)
 *   tag        module_content.tags 里的一个标签(后端 ?tag=)
 *   topic      一个专题 / 话题(community topics,含 topiccurator 自动生成的)
 *   playlist   一张歌单(user_my_list:平台编排的或别人公开的)—— 歌单就是一种专题
 *   keyword    用户自己输的词,标题或标签命中即可(后端 ?keyword=)
 *
 * id 是稳定主键:进 URL、进 localStorage、做 react-query 的 queryKey。
 * 预置类型频道沿用老的 section 名('novel' / 'game' / …),这样收藏夹里
 * /home/recommend?section=game 这种旧链接照样能打开。
 */

export type HomeSectionKind = 'recommend' | 'type' | 'tag' | 'topic' | 'playlist' | 'keyword';

export interface HomeSection {
  /** 稳定唯一键,同时是 ?section= 的值 */
  id: string;
  label: string;
  kind: HomeSectionKind;
  /** kind=type:内容大类(NOVEL/FILM/…);kind=tag 可选,限定在某个大类里找标签 */
  contentType?: string;
  /** kind=type:题材子分类 code(字典表 module_subcategory.code) */
  genre?: string;
  /** 题材的中文名(「仙侠」)。取内容时用它,见 sectionQueryParams */
  genreLabel?: string;
  /** kind=tag */
  tag?: string;
  /** kind=topic */
  topicId?: string | number;
  /** kind=playlist:歌单 id(user_my_list);'liked' 这类内置歌单不进频道 */
  listId?: string | number;
  /** kind=keyword */
  keyword?: string;
  /** 预置目录里的项(用户仍可删,只是能在「更多频道」里找回) */
  builtin?: boolean;
}

/** 固定第一项:聚合推荐流,不可删、不可移动。 */
export const RECOMMEND_SECTION: HomeSection = {
  id: 'recommend',
  label: '推荐',
  kind: 'recommend',
  builtin: true,
};

/**
 * 预置类型频道。id 沿用旧 section 名(旧链接/旧 localStorage 还认得),
 * 每项都能映射到一个内容大类。
 *
 * 比原来的 15 项多出短剧、直播、公开课、人物等 —— 这些内容类型早就有了,
 * 只是页签写死时没给位置。真正的全集从 /dict/types 动态拉(见 useSectionCatalog),
 * 这里是首屏和离线兜底。
 */
export const BUILTIN_TYPE_SECTIONS: HomeSection[] = [
  { id: 'novel', label: '小说', kind: 'type', contentType: 'NOVEL', builtin: true },
  { id: 'comics', label: '漫画', kind: 'type', contentType: 'COMICS', builtin: true },
  { id: 'film', label: '影视', kind: 'type', contentType: 'FILM', builtin: true },
  { id: 'teleplay', label: '小剧场', kind: 'type', contentType: 'TELEPLAY', builtin: true },
  { id: 'drama', label: '短剧', kind: 'type', contentType: 'SHORT_DRAMA', builtin: true },
  { id: 'entertainment', label: '综艺', kind: 'type', contentType: 'VSHOW', builtin: true },
  { id: 'music', label: '音乐', kind: 'type', contentType: 'MUSIC', builtin: true },
  { id: 'anime', label: '二次元', kind: 'type', contentType: 'ANIMATION', builtin: true },
  { id: 'news', label: '资讯', kind: 'type', contentType: 'NEWS', builtin: true },
  { id: 'live', label: '直播', kind: 'type', contentType: 'LIVE', builtin: true },
  { id: 'video', label: '视频', kind: 'type', contentType: 'VIDEO', builtin: true },
  { id: 'article', label: '文章', kind: 'type', contentType: 'ARTICLE', builtin: true },
  { id: 'person', label: '人物', kind: 'type', contentType: 'PERSON', builtin: true },
  // 图集(PICTURE,用户/机器人发布的图片集,content 里是 {"images":[…]})和
  // 单图(WALLPAPER,爬虫图源,cover_url 就是图本身)是两个独立内容类型,别混成"图文"。
  { id: 'picture', label: '图集', kind: 'type', contentType: 'PICTURE', builtin: true },
  { id: 'wallpaper', label: '单图', kind: 'type', contentType: 'WALLPAPER', builtin: true },
  // 下面几项没有独立内容类型,靠标签/关键词过滤(老页签 food/game/... 就是这些)。
  // 它们在旧代码里都映射到 VIDEO 或 ARTICLE,结果几个页签内容一模一样;
  // 现在按标签取,至少各不相同。
  { id: 'game', label: '游戏', kind: 'tag', tag: '游戏', builtin: true },
  { id: 'food', label: '美食', kind: 'tag', tag: '美食', builtin: true },
  { id: 'tech', label: '科技', kind: 'tag', tag: '科技', builtin: true },
  { id: 'knowledge', label: '知识', kind: 'tag', tag: '知识', builtin: true },
  { id: 'sports', label: '体育', kind: 'tag', tag: '体育', builtin: true },
  { id: 'finance', label: '财经', kind: 'tag', tag: '财经', builtin: true },
];

/** 新装/重置时默认摆出来的频道(推荐在外,单独置顶)。 */
export const DEFAULT_SECTION_IDS = [
  'novel', 'comics', 'film', 'teleplay', 'entertainment', 'music', 'anime', 'news', 'game',
];

const BUILTIN_BY_ID = new Map(BUILTIN_TYPE_SECTIONS.map((s) => [s.id, s]));

export function builtinSection(id: string): HomeSection | undefined {
  if (id === RECOMMEND_SECTION.id) return RECOMMEND_SECTION;
  return BUILTIN_BY_ID.get(id);
}

/** 每种动态频道的 id 规则,保证同一个来源加两次还是同一格。 */
export function typeSectionId(contentType: string, genre?: string): string {
  return genre ? `t:${contentType}:${genre}` : `t:${contentType}`;
}
export function tagSectionId(tag: string, contentType?: string): string {
  return contentType ? `tag:${contentType}:${tag}` : `tag:${tag}`;
}
export function topicSectionId(topicId: string | number): string {
  return `topic:${topicId}`;
}
export function playlistSectionId(listId: string | number): string {
  return `pl:${listId}`;
}
export function keywordSectionId(keyword: string): string {
  return `kw:${keyword.trim()}`;
}

export function makeTypeSection(contentType: string, label: string, genre?: string, genreLabel?: string): HomeSection {
  return {
    id: typeSectionId(contentType, genre),
    label: genre ? `${label}·${genreLabel || genre}` : label,
    kind: 'type',
    contentType,
    genre: genre || undefined,
    genreLabel: genre ? genreLabel || genre : undefined,
  };
}
export function makeTagSection(tag: string, contentType?: string): HomeSection {
  return { id: tagSectionId(tag, contentType), label: tag, kind: 'tag', tag, contentType };
}
export function makeTopicSection(topicId: string | number, title: string): HomeSection {
  return { id: topicSectionId(topicId), label: title, kind: 'topic', topicId };
}
export function makePlaylistSection(listId: string | number, name: string): HomeSection {
  return { id: playlistSectionId(listId), label: name, kind: 'playlist', listId };
}
export function makeKeywordSection(keyword: string): HomeSection {
  const kw = keyword.trim();
  return { id: keywordSectionId(kw), label: kw, kind: 'keyword', keyword: kw };
}

/**
 * 从 URL 上的 ?section= 反推出一个可用的频道描述。
 *
 * 用户自己的频道列表里找不到时也要能渲染(别人分享的链接、收藏夹里的旧地址),
 * 所以这里按 id 规则解析出一个临时频道,页签上单独显示并给「加入我的频道」。
 */
export function parseSectionId(id: string): HomeSection | null {
  if (!id) return null;
  const builtin = builtinSection(id);
  if (builtin) return builtin;
  if (id.startsWith('topic:')) {
    const topicId = id.slice('topic:'.length);
    return topicId ? { id, label: '意境', kind: 'topic', topicId } : null;
  }
  if (id.startsWith('pl:')) {
    // 歌单名从歌单详情里补(见 FeedPanel),这里只保证链接能打开。
    const listId = id.slice('pl:'.length);
    return listId ? { id, label: '歌单', kind: 'playlist', listId } : null;
  }
  if (id.startsWith('kw:')) {
    const keyword = id.slice('kw:'.length);
    return keyword ? makeKeywordSection(keyword) : null;
  }
  if (id.startsWith('tag:')) {
    const rest = id.slice('tag:'.length);
    // tag:<TYPE>:<标签> 或 tag:<标签>;大类一律大写,以此区分两种形状。
    const sep = rest.indexOf(':');
    if (sep > 0) {
      const contentType = rest.slice(0, sep);
      const tag = rest.slice(sep + 1);
      if (contentType === contentType.toUpperCase() && tag) return makeTagSection(tag, contentType);
    }
    return rest ? makeTagSection(rest) : null;
  }
  if (id.startsWith('t:')) {
    const [contentType, genre] = id.slice('t:'.length).split(':');
    if (!contentType) return null;
    return {
      id,
      label: genre ? `${contentType}·${genre}` : contentType,
      kind: 'type',
      contentType,
      genre: genre || undefined,
      // 只有 id 时拿不到中文题材名,页面会用字典表里的名字补上(见 FeedPanel)
      genreLabel: undefined,
    };
  }
  return null;
}

/**
 * 传给 /module/content/list 的筛选参数(不含分页和排序)。
 *
 * 题材走 tag 而不是 genre:线上 metadata.genre 存的是「言情,喜剧,剧情」这样的
 * 逗号串,后端 genre 分支用的 JSON_CONTAINS 对它恒为假(所有题材都查不到东西);
 * tag 分支是 tags 列和 metadata.genre 的文本并集,用中文题材名才取得到内容。
 */
export function sectionQueryParams(section: HomeSection): Record<string, string> {
  const params: Record<string, string> = {};
  if (section.contentType) params.contentType = section.contentType;
  if (section.genre) params.tag = section.genreLabel || section.genre;
  if (section.tag) params.tag = section.tag;
  if (section.keyword) params.keyword = section.keyword;
  return params;
}
