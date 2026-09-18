'use client';

import { useMemo, useSyncExternalStore } from 'react';

import {
  DEFAULT_SECTION_IDS,
  HomeSection,
  RECOMMEND_SECTION,
  builtinSection,
} from './homeSections';

/**
 * 首页频道(顶部页签)的个人排布。
 *
 * 存本机 localStorage,和 aiPrefs / listLayoutPrefs 同一套模块级 store +
 * useSyncExternalStore:页签栏、频道管理弹窗、设置抽屉几处同时打开,改一处要处处
 * 立即生效,不能各自 useState 读 localStorage。
 *
 * 「推荐」永远是第一项且不可删 —— 存下来的只有它后面那串,读出来再把它顶上去,
 * 这样即使旧数据/脏数据里没有它也不会丢。
 *
 * 登录后这份列表还会同步到账号(PG user_home_section,见 lib/sectionSync):
 * 本机这层仍然是第一手 —— 未登录、离线、请求失败时页签照常能用,不等网络。
 */

const KEY = 'qq-home-sections';
const EVENT = 'qq-home-sections-change';

export interface HomeSectionPrefs {
  /** 「推荐」之后的频道,按显示顺序 */
  sections: HomeSection[];
  /** 用户动过频道列表(没动过时跟随默认值的升级,动过就以用户为准) */
  touched: boolean;
}

function defaultSections(): HomeSection[] {
  return DEFAULT_SECTION_IDS.map((id) => builtinSection(id)).filter(Boolean) as HomeSection[];
}

let cache: HomeSectionPrefs | null = null;

/** 存进去的可能是旧版本/手改过的数据,一律过一遍:去掉推荐、去重、补 label。 */
function normalize(list: unknown): HomeSection[] {
  if (!Array.isArray(list)) return [];
  const out: HomeSection[] = [];
  const seen = new Set<string>([RECOMMEND_SECTION.id]);
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Partial<HomeSection>;
    if (typeof s.id !== 'string' || !s.id || seen.has(s.id)) continue;
    // 预置项以代码为准(标签/映射改过版本后,存量数据跟着升级)
    const bi = builtinSection(s.id);
    if (bi) {
      seen.add(bi.id);
      out.push(bi);
      continue;
    }
    if (!s.kind || s.kind === 'recommend') continue;
    if (!s.label) continue;
    seen.add(s.id);
    out.push({
      id: s.id,
      label: s.label,
      kind: s.kind,
      contentType: s.contentType,
      genre: s.genre,
      // 中文题材名必须一起存:丢了它,刷新后这一格只剩 code(xianxia),
      // 而取内容要的是「仙侠」——会变成一个永远空的频道。
      genreLabel: s.genreLabel,
      tag: s.tag,
      topicId: s.topicId,
      keyword: s.keyword,
    });
  }
  return out;
}

function read(): HomeSectionPrefs {
  if (cache) return cache;
  let stored: any = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    /* 隐私模式 / 数据损坏:按默认值 */
  }
  if (stored && Array.isArray(stored.sections)) {
    cache = { sections: normalize(stored.sections), touched: !!stored.touched };
  } else {
    cache = { sections: defaultSections(), touched: false };
  }
  return cache;
}

function write(next: HomeSectionPrefs) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 写不进去也让本页生效 */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** SSR / 首帧用默认排布,挂载后换成本机偏好(避免 hydration 前后不一致)。 */
const SERVER_SNAPSHOT: HomeSectionPrefs = { sections: defaultSections(), touched: false };

/**
 * 用服务端(账号)的列表覆盖本机这份。
 *
 * 不标 touched:这不是"用户刚动过",而是"账号里本来就是这样"。标了的话下次
 * 登录会把它当成待上传的本地改动,反而盖掉别的设备刚改的。
 */
export function hydrateSections(list: HomeSection[]) {
  const cur = read();
  write({ sections: normalize(list), touched: cur.touched });
}

/** 当前这份频道(不含固定的推荐),给同步层往上推。 */
export function snapshotSections(): HomeSection[] {
  return read().sections;
}

/** 用户自己动过频道列表没有(决定首次登录要不要把本机这份迁上去)。 */
export function sectionsTouched(): boolean {
  return read().touched;
}

/** 订阅频道变化(同步层用;组件用 useHomeSections)。 */
export function subscribeSections(cb: () => void): () => void {
  return subscribe(cb);
}

export interface SectionPrefsApi {
  /** 加一个频道到末尾(已存在则原样返回) */
  add: (section: HomeSection) => void;
  /** 删一个频道(推荐删不掉) */
  remove: (id: string) => void;
  /** 把 id 移到第 index 位(0 = 紧跟推荐之后) */
  move: (id: string, index: number) => void;
  /** 整体替换(频道管理弹窗里拖完一次性存) */
  replaceAll: (sections: HomeSection[]) => void;
  /** 恢复默认 */
  reset: () => void;
  has: (id: string) => boolean;
}

/**
 * 返回 [完整频道列表(含固定的推荐), 操作 api]。
 * 列表第一项恒为「推荐」,调用方不用自己拼。
 */
export function useHomeSections(): [HomeSection[], SectionPrefsApi] {
  const prefs = useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);

  const sections = useMemo(() => [RECOMMEND_SECTION, ...prefs.sections], [prefs.sections]);

  const api = useMemo<SectionPrefsApi>(() => ({
    add: (section) => {
      const cur = read();
      if (section.id === RECOMMEND_SECTION.id) return;
      if (cur.sections.some((s) => s.id === section.id)) return;
      write({ sections: [...cur.sections, section], touched: true });
    },
    remove: (id) => {
      if (id === RECOMMEND_SECTION.id) return;
      const cur = read();
      write({ sections: cur.sections.filter((s) => s.id !== id), touched: true });
    },
    move: (id, index) => {
      const cur = read();
      const from = cur.sections.findIndex((s) => s.id === id);
      if (from < 0) return;
      const next = cur.sections.slice();
      const [item] = next.splice(from, 1);
      next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
      write({ sections: next, touched: true });
    },
    replaceAll: (list) => write({ sections: normalize(list), touched: true }),
    reset: () => write({ sections: defaultSections(), touched: false }),
    has: (id) => id === RECOMMEND_SECTION.id || read().sections.some((s) => s.id === id),
  }), []);

  return [sections, api];
}
