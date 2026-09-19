/**
 * 内容类型目录 —— 全站唯一一份事实源。
 *
 * 后端 module_content_type 字典表里只列了 11 个大类,PICTURE / WALLPAPER /
 * SHORT_DRAMA / PERSON 等实际有内容的类型不在表里,所以前端要自己维护一份
 * 全集(15 个),按这里的中文名 + 一句话说明 + 可播放性默认,统一供给:
 *
 *   - 首页引导弹窗 (FirstRunGuide)
 *   - /welcome 欢迎页「内容类型一览」
 *   - 首页频道管理 (SectionManagerDialog)「内容分类」组的副文案
 *   - 任何后续接入的"按类型速查"场景(详情页头部 / 搜索类型下拉 ...)
 *
 * 字典里有的项(name 字段),以后台为准:运营改了字典,前端展示也跟着升级,
 * 只在字典里没填 description 时用这里兜底的一句话。
 *
 * 关于 playability 七种状态(sectionPrefs 的注释里写过):
 *   playable          本站可直接读 / 看 / 听
 *   pending_repair    内容存在但播放链路待修(老源失效、版权下线)
 *   not_applicable    实体本身不能播放(人物主页、纯文本索引)
 *   live_offline      直播源当前离线
 *   bandwidth_limited 内容存在但带宽受限(影视长视频大多如此)
 *   embeddable        由用户设备直连第三方,本站只提供入口
 *   unknown           状态依赖源 / 实时判定
 *
 * 注意:NOVEL/MUSIC 这种"类型"整体默认 playable,但具体某条记录可能因为播放
 * 链断了变成 pending_repair —— 这个层级的状态由卡片渲染时按 record.playStatus
 * 判断,目录里只给"类型默认"。
 */

import { TYPE_LABEL } from './contentType.gen';

export type PlayabilityStatus =
  | 'playable'
  | 'pending_repair'
  | 'not_applicable'
  | 'live_offline'
  | 'bandwidth_limited'
  | 'embeddable'
  | 'unknown';

export interface ContentCatalogEntry {
  /** 内容类型 code,与后端 module_content.contentType 对齐 */
  code: string;
  /** 中文名:以字典表为准;字典没填时用这里的 label 兜底 */
  label: string;
  /** 一句话说明,用于引导 / 一览 / 频道管理卡片副文案 */
  shortDesc: string;
  /** 站点首页预置页签 id(对应 BUILTIN_TYPE_SECTIONS / homeSections.ts) */
  sectionId: string;
  /** 默认可播放性;具体记录可在详情页用真实 status 覆盖 */
  playability: PlayabilityStatus;
  /** 引导弹窗"选 1 ~ 5 项"时是否推荐(高频用户意图:小说/音乐/影视/... 都默认推) */
  recommendOnboarding?: boolean;
}

export const CONTENT_CATALOG: ContentCatalogEntry[] = [
  {
    code: 'NOVEL',
    label: '小说',
    shortDesc: '网络小说连载追更,按书名 / 标签聚合,可在线阅读',
    sectionId: 'novel',
    playability: 'playable',
    recommendOnboarding: true,
  },
  {
    code: 'MUSIC',
    label: '音乐',
    shortDesc: '单曲 / 专辑 / 歌单,可在线收听,可自建或关注别人歌单',
    sectionId: 'music',
    playability: 'playable',
    recommendOnboarding: true,
  },
  {
    code: 'COMICS',
    label: '漫画',
    shortDesc: '连载 / 完结漫画,通常跳转到来源平台阅读',
    sectionId: 'comics',
    playability: 'embeddable',
  },
  {
    code: 'FILM',
    label: '电影',
    shortDesc: '院线 / 经典长片,大多为第三方平台入口',
    sectionId: 'film',
    playability: 'bandwidth_limited',
    recommendOnboarding: true,
  },
  {
    code: 'TELEPLAY',
    label: '电视剧',
    shortDesc: '国产 / 海外连续剧,按集聚合,跳站观看为主',
    sectionId: 'teleplay',
    playability: 'bandwidth_limited',
  },
  {
    code: 'SHORT_DRAMA',
    label: '短剧',
    shortDesc: '竖屏短剧,每集 1~3 分钟,聚合多平台热门',
    sectionId: 'drama',
    playability: 'playable',
  },
  {
    code: 'ANIMATION',
    label: '动漫',
    shortDesc: '番剧 / 剧场版 / 国创,跳转到来源平台',
    sectionId: 'anime',
    playability: 'embeddable',
  },
  {
    code: 'VIDEO',
    label: '短视频',
    shortDesc: '抖音 / 快手 / B站等短视频聚合,跳站观看',
    sectionId: 'video',
    playability: 'embeddable',
  },
  {
    code: 'VSHOW',
    label: '综艺',
    shortDesc: '综艺片段 / 整季,按节目名聚合',
    sectionId: 'entertainment',
    playability: 'embeddable',
  },
  {
    code: 'LIVE',
    label: '直播',
    shortDesc: '各平台直播入口,状态依赖源实时性',
    sectionId: 'live',
    playability: 'unknown',
  },
  {
    code: 'ARTICLE',
    label: '文章',
    shortDesc: '图文长文 / 资讯深度稿,可站内阅读',
    sectionId: 'article',
    playability: 'playable',
  },
  {
    code: 'NEWS',
    label: '资讯',
    shortDesc: '全网热点资讯聚合,按主题分类',
    sectionId: 'news',
    playability: 'playable',
  },
  {
    code: 'WALLPAPER',
    label: '壁纸 / 单图',
    shortDesc: '高清壁纸 / 单图,可下载收藏',
    sectionId: 'wallpaper',
    playability: 'playable',
  },
  {
    code: 'PICTURE',
    label: '图集',
    shortDesc: '用户 / 机器人发布的多图集合,封面 + 内页图片',
    sectionId: 'picture',
    playability: 'playable',
  },
  {
    code: 'PERSON',
    label: '人物',
    shortDesc: '演员 / 歌手 / 作者 / 导演主页,聚合其相关作品',
    sectionId: 'person',
    playability: 'not_applicable',
  },
  {
    code: 'POETRY',
    label: '诗词',
    shortDesc: '古诗词原文 + 译文 + 赏析,33 万首可在站内通读',
    sectionId: 'poetry',
    playability: 'playable',
  },
];

const BY_CODE: Map<string, ContentCatalogEntry> = new Map(
  CONTENT_CATALOG.map((e) => [e.code, e]),
);

/**
 * 按 code 取一条目录项。优先用字典返回的 name(运营可能改成更准的译名),
 * 这里只补 shortDesc / playability / sectionId 等字典表里没有的字段。
 */
export function getContentEntry(code: string, dictName?: string): ContentCatalogEntry | undefined {
  const e = BY_CODE.get(code);
  if (!e) return undefined;
  if (dictName && dictName !== e.label) {
    return { ...e, label: dictName };
  }
  return e;
}

/** 与字典合并后的最终目录(给欢迎页 / 引导弹窗用),自动用 TYPE_LABEL 兜底 label */
export function listCatalogEntries(): ContentCatalogEntry[] {
  return CONTENT_CATALOG.map((e) => ({
    ...e,
    label: TYPE_LABEL[e.code] || e.label,
  }));
}

/** 引导弹窗要重点推荐的几项(首页默认页签不一定都有,这里显式标) */
export function recommendOnboardingEntries(): ContentCatalogEntry[] {
  return CONTENT_CATALOG.filter((e) => e.recommendOnboarding);
}

const PLAYABILITY_BADGE: Record<PlayabilityStatus, { label: string; tone: 'good' | 'warn' | 'neutral' | 'bad' }> = {
  playable: { label: '可读 / 可播', tone: 'good' },
  pending_repair: { label: '链路维护中', tone: 'warn' },
  not_applicable: { label: '纯索引页', tone: 'neutral' },
  live_offline: { label: '直播离线', tone: 'bad' },
  bandwidth_limited: { label: '带宽受限,可能跳站', tone: 'warn' },
  embeddable: { label: '跳第三方平台', tone: 'neutral' },
  unknown: { label: '状态依赖源', tone: 'neutral' },
};

export function describePlayability(s: PlayabilityStatus): { label: string; tone: 'good' | 'warn' | 'neutral' | 'bad' } {
  return PLAYABILITY_BADGE[s];
}
