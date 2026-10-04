// 人生感悟专题 API client。后端见 qingqiuyue-go internal/handler/insight.go。
//
// ⚠️ contentClient 的响应拦截器已经把 body.data 剥出来了,这里直接返回结果。
// 主题下的作品是按字面命中取的(诗词看正文 / 诗题,其余看标签 / 标题),
// 页面文案说「与此相关」,不要说成「解读」。

import { contentClient } from '@/lib/api/client';
import type { EntityId } from '@/lib/id';
import { visitorId } from '@/lib/track';

/** 史书 / 诗文里的真实记载的白话转述,src 是原始出处 */
export interface InsightStory {
  /** 这个故事从哪个角度看人生,如「被看低的时候」 */
  angle: string;
  title: string;
  body: string;
  src: string;
}

export interface InsightTheme {
  key: string;
  name: string;
  group: string;
  /** 题记原句,出处见 lineSrc */
  line: string;
  lineSrc: string;
  /** 编者一问 */
  ask: string;
  /** 编者论第一段的开头(只在 overview 里有) */
  lead?: string;
  /** 编者论(观点,不是史料),只在 /insight/theme 里有 */
  essay?: string[];
  /** 不同角度的故事,只在 /insight/theme 里有 */
  stories?: InsightStory[];
}

/**
 * 站内能不能直接消费:play = 本站能看到画面;read = 站内直接能读 / 能看(诗词原文、有正文的文章)。
 * 空 = 只有资料,要去原站。
 */
export type InsightAvail = '' | 'play' | 'read';

export interface InsightGroup {
  key: string;
  name: string;
  intro: string;
  line: string;
  lineSrc: string;
  themes: InsightTheme[];
}

export interface InsightEraMeta {
  key: string;
  name: string;
  poetry: boolean;
}

export interface InsightItem {
  /** 超 2^53 的 id 是字符串,原样透传 */
  id: EntityId;
  contentType: string;
  title: string;
  author?: string;
  cover?: string;
  excerpt?: string;
  year?: number;
  dynasty?: string;
  rating?: number;
  avail?: InsightAvail;
  /** 内容层(心境):1 照见 / 2 体味 / 3 参悟,按作品形式定 */
  layer?: 1 | 2 | 3;
}

export interface InsightSection {
  contentType: string;
  /** 内容层(心境):1 照见 / 2 体味 / 3 参悟 */
  layer?: 1 | 2 | 3;
  total: number;
  items: InsightItem[];
}

export interface InsightEra extends InsightEraMeta {
  total: number;
  items: InsightItem[];
}

export interface InsightDaily {
  date: string;
  theme: InsightTheme;
  poem?: { id: EntityId; title: string; author?: string; dynasty?: string; text: string };
  work?: InsightItem;
}

export const overview = (): Promise<{ groups: InsightGroup[]; eras: InsightEraMeta[] }> =>
  contentClient.get('/insight/overview');

export const theme = (
  key: string,
  avail: InsightAvail = '',
): Promise<{
  theme: InsightTheme;
  sections: InsightSection[];
  /** 不筛时才有:两个筛选各有多少(粗数) */
  availTotals?: { play: number; read: number };
}> => contentClient.get('/insight/theme', { params: { key, avail: avail || undefined } });

export const timeline = (key: string, avail: InsightAvail = ''): Promise<{ theme: InsightTheme; eras: InsightEra[] }> =>
  contentClient.get('/insight/timeline', { params: { key, avail: avail || undefined } });

export const items = (params: {
  key: string;
  type?: string;
  era?: string;
  avail?: InsightAvail;
  page?: number;
  size?: number;
}): Promise<{ list: InsightItem[]; total: number; page: number; pageSize: number }> =>
  contentClient.get('/insight/items', { params });

export const daily = (): Promise<InsightDaily> => contentClient.get('/insight/daily');

// ── 本机记忆:最近参悟过的主题、写给自己的手记。只存在本机,不上传。 ──

const RECENT_KEY = 'qq-insight-recent';
const NOTE_KEY = (k: string) => `qq-insight-note:${k}`;

export function readRecentThemes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function pushRecentTheme(key: string) {
  try {
    const next = [key, ...readRecentThemes().filter((k) => k !== key)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式下写不进去就算了 */
  }
}

export function readNote(key: string): string {
  try {
    return localStorage.getItem(NOTE_KEY(key)) || '';
  } catch {
    return '';
  }
}

export function writeNote(key: string, text: string) {
  try {
    if (text.trim()) localStorage.setItem(NOTE_KEY(key), text);
    else localStorage.removeItem(NOTE_KEY(key));
  } catch {
    /* ignore */
  }
}

/** 某位诗人写某个主题的原句(只取语料原文,不改写)。author 用语料里的写法(繁体) */
export interface InsightVoiceLine { poemId: string; title: string; line: string; author: string }
export const voice = (key: string, author: string, limit = 3): Promise<{ key: string; author: string; lines: InsightVoiceLine[] }> =>
  contentClient.get('/insight/voice', { params: { key, author, limit } });

/** 哪些名家写这个主题最多(人物选角用) */
export const themePoets = (key: string): Promise<{ key: string; list: { author: string; poems: number }[] }> =>
  contentClient.get('/insight/poets', { params: { key } });

// ── 分支:跟着实时热点和大家的心事自动开、自动收。后端见 handler/insight_branch.go。 ──
// 分支 key 可以直接当主题 key 用:theme / items / timeline 都认,作品区与主题页同一套组件。

export interface InsightBranch {
  key: string;
  /** 线索词,如「外卖」「妈妈」—— 分支的名字 */
  cue: string;
  status: 'open' | 'closed';
  /** 父主题 */
  theme: string;
  themeName: string;
  group: string;
  /** 最近一次命中热搜时的热度 */
  heat: number;
  /** 近 14 天写到这个词的人数 */
  needUsers: number;
  /** 近 14 天搜过这个词的人数 */
  searchUsers: number;
  /** 站内相关的非诗词作品数 */
  works: number;
  firstSeen: number;
  lastSignal: number;
  openedAt: number;
  /** 最近一条热搜原题 */
  headline?: string;
  hotCount?: number;
  /** 与这个人的偏好很近(画像标签 / 常看的主题) */
  forYou?: boolean;
}

/** 分支的凭据:哪条热搜、什么时候 */
export interface InsightBranchEvidence {
  word: string;
  desc?: string;
  url?: string;
  img?: string;
  hot?: number;
  rank?: number;
  source: string;
  at: number;
  /** semantic = 字面没认出来、按向量相似归的位 */
  via?: 'semantic';
  sim?: number;
  /** 没归位的热点:语义上最近的门类(给嫁接参考) */
  suggest?: string;
  suggestName?: string;
}

/** 开着的分支按真实反馈 + 个人偏好排(登录用户用画像,游客用访客 id 的浏览历史) */
export const branches = (
  params: { theme?: string; status?: 'open' | 'closed'; limit?: number } = {},
): Promise<{ list: InsightBranch[]; personalized?: boolean }> =>
  contentClient.get('/insight/branches', { params: { ...params, vid: visitorId() || undefined } });

export const branch = (
  key: string,
): Promise<{ branch: InsightBranch; parent: InsightTheme; evidence: InsightBranchEvidence[]; now: InsightItem[] }> =>
  contentClient.get('/insight/branch', { params: { key } });

/** 「此刻在想什么」:返回相近的主题与分支。登录时只记命中了哪些词,原话不存。 */
export const need = (
  text: string,
): Promise<{
  hits: { theme: string; cue: string; branch?: string }[];
  themes: InsightTheme[];
  branches: InsightBranch[];
  recorded: boolean;
}> => contentClient.post('/insight/need', { text });

/** 运营:封 / 解封一个分支 */
export const blockBranch = (key: string, block: boolean): Promise<{ key: string; status: string }> =>
  contentClient.post('/insight/branch/block', { key, block });
