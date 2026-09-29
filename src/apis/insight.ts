// 人生感悟专题 API client。后端见 qingqiuyue-go internal/handler/insight.go。
//
// ⚠️ contentClient 的响应拦截器已经把 body.data 剥出来了,这里直接返回结果。
// 主题下的作品是按字面命中取的(诗词看正文 / 诗题,其余看标签 / 标题),
// 页面文案说「与此相关」,不要说成「解读」。

import { contentClient } from '@/lib/api/client';
import type { EntityId } from '@/lib/id';

export interface InsightTheme {
  key: string;
  name: string;
  group: string;
  /** 题记原句,出处见 lineSrc */
  line: string;
  lineSrc: string;
  /** 编者一问 */
  ask: string;
}

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
}

export interface InsightSection {
  contentType: string;
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

export const theme = (key: string): Promise<{ theme: InsightTheme; sections: InsightSection[] }> =>
  contentClient.get('/insight/theme', { params: { key } });

export const timeline = (key: string): Promise<{ theme: InsightTheme; eras: InsightEra[] }> =>
  contentClient.get('/insight/timeline', { params: { key } });

export const items = (params: {
  key: string;
  type?: string;
  era?: string;
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
