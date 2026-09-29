// 回廊(专题的互动影像形式)API client。后端见 qingqiuyue-go internal/handler/journey.go,
// 剧本的形状见 internal/journey/schema.go。
//
// ⚠️ contentClient 的响应拦截器已经把 body.data 剥出来了,这里直接返回结果。
// 读接口公开;choose / writeNote / finish / restart 要登录 —— 没登录也能走完一条回廊,
// 只是不计入回声、落笔只留在本机。

import { contentClient } from '@/lib/api/client';
import type { EntityId } from '@/lib/id';
import type { InsightItem } from '@/apis/insight';

export type JourneyNodeType = 'scene' | 'choice' | 'reveal' | 'echo' | 'note' | 'ending';

export interface JourneyOption {
  key: string;
  label: string;
  /** 感受词,如「不甘」「珍惜」「放下」 */
  feel?: string;
  next: string;
}

export interface JourneyEnding {
  title: string;
  /** 编者按(观点,不是史料) */
  insight: string[];
  line?: string;
  lineSrc?: string;
  companions?: boolean;
}

/** 字段按 type 取用,其余为空。 */
export interface JourneyNode {
  id: string;
  type: JourneyNodeType;
  next?: string;
  // scene
  line?: string;
  lineSrc?: string;
  caption?: string;
  media?: { contentId?: EntityId };
  // choice / note
  prompt?: string;
  options?: JourneyOption[];
  // reveal
  title?: string;
  hint?: string;
  // echo
  of?: string;
  /** {pct} 占位当前读者所选的比例 */
  text?: string;
  // note
  placeholder?: string;
  visibility?: 'private' | 'echo';
  // ending
  ending?: JourneyEnding;
}

export interface JourneyScript {
  key: string;
  title: string;
  subtitle?: string;
  theme?: string;
  minutes?: number;
  opening: { situation: string; line?: string; lineSrc?: string; ambient?: string };
  start: string;
  nodes: JourneyNode[];
}

export interface JourneyMeta {
  key: string;
  title: string;
  subtitle: string;
  theme: string;
  minutes: number;
  situation: string;
  line: string;
  lineSrc: string;
  endings: number;
}

/** 我在这条回廊上留下的东西(登录时才有) */
export interface JourneyMine {
  choices: Record<string, string>;
  notes: Record<string, string>;
  ending: string;
  finishedAt: number;
}

export interface JourneyEchoOption {
  key: string;
  label: string;
  feel?: string;
  count: number;
  pct: number;
}

/** 一个节点现查出来的数据,按节点类型只有其中一部分 */
export interface JourneyNodeData {
  type: JourneyNodeType;
  media?: InsightItem | null;
  items?: InsightItem[];
  of?: string;
  total?: number;
  options?: JourneyEchoOption[];
  notes?: string[];
  reached?: number;
}

export interface JourneyPathStep {
  node: string;
  option: string;
  label: string;
  feel?: string;
}

export const list = (theme?: string): Promise<{ list: JourneyMeta[] }> =>
  contentClient.get('/journey/list', { params: { theme: theme || undefined } });

export const script = (key: string): Promise<{ script: JourneyScript; mine?: JourneyMine }> =>
  contentClient.get('/journey/script', { params: { key } });

export const nodeData = (key: string, node: string): Promise<JourneyNodeData> =>
  contentClient.get('/journey/node', { params: { key, node } });

export const choose = (key: string, node: string, option: string): Promise<{ node: string; option: string }> =>
  contentClient.post('/journey/choice', { key, node, option });

/** shared = 这条落笔过了审核,会匿名出现在别人的回声里 */
export const writeNote = (key: string, node: string, text: string): Promise<{ node: string; shared: boolean }> =>
  contentClient.post('/journey/note', { key, node, text });

export const deleteNote = (key: string, node: string): Promise<{ node: string }> =>
  contentClient.post('/journey/note/delete', { key, node });

export const finish = (key: string, ending: string): Promise<{ ending: string; path: JourneyPathStep[] }> =>
  contentClient.post('/journey/finish', { key, ending });

export const restart = (key: string): Promise<{ key: string }> => contentClient.post('/journey/restart', { key });

// ── 本机进度:走到哪一拍、选了什么、没登录时写的落笔。 ──
// 中途点进一部作品再回来,要能接着走,所以进度每一拍都存。

export interface JourneyLocal {
  /** 走过的节点 id,最后一个是当前这一拍 */
  trail: string[];
  choices: Record<string, string>;
  notes: Record<string, string>;
}

const LOCAL_KEY = (k: string) => `qq-journey:${k}`;

export function readLocal(key: string): JourneyLocal | null {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL_KEY(key)) || 'null');
    if (!v || !Array.isArray(v.trail)) return null;
    return { trail: v.trail, choices: v.choices || {}, notes: v.notes || {} };
  } catch {
    return null;
  }
}

export function writeLocal(key: string, v: JourneyLocal) {
  try {
    localStorage.setItem(LOCAL_KEY(key), JSON.stringify(v));
  } catch {
    /* 隐私模式下写不进去就算了 */
  }
}

export function clearLocal(key: string) {
  try {
    localStorage.removeItem(LOCAL_KEY(key));
  } catch {
    /* ignore */
  }
}
