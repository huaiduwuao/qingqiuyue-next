// 心境 API client。后端见 qingqiuyue-go internal/handler/mind.go。
//
// ⚠️ contentClient 的响应拦截器已经把 body.data 剥出来了,这里直接返回结果。
// 内容分层按作品形式定(1 照见 / 2 体味 / 3 参悟),境界只决定默认展开到哪一层,不锁内容。
// 境界由修习现算,跟积分 / 钻石 / 用户等级无关;文案说「修到哪」,不说「你是什么人」。

import { contentClient } from '@/lib/api/client';
import type { InsightItem, InsightTheme } from '@/apis/insight';
import type { LifeAxis } from '@/apis/lifepath';

export type MindLayer = 1 | 2 | 3;
export type MindStepKey = 'see' | 'taste' | 'grasp' | 'ask';

export interface MindStage {
  level: number;
  name: string;
  /** 原句片段,出处见 stageSrc */
  line: string;
  intro: string;
  /** 默认展开到哪一层 */
  layer: MindLayer;
}

export interface MindNeed {
  key: string;
  label: string;
  need: number;
  have: number;
}

export interface MindLayerMeta {
  layer: MindLayer;
  name: string;
  hint: string;
}

export interface MindStepMeta {
  key: MindStepKey;
  name: string;
  hint: string;
  score: number;
}

export interface MindThemeProgress {
  steps: Partial<Record<MindStepKey, boolean>>;
  journey: boolean;
}

export interface MindMe {
  loggedIn: boolean;
  stage: MindStage;
  next?: MindStage;
  needs?: MindNeed[];
  stageSrc: string;
  stages: MindStage[];
  layers: MindLayerMeta[];
  steps: MindStepMeta[];
  today: { date: string; theme: InsightTheme; answered: boolean };
  themes?: Record<string, MindThemeProgress>;
  counts?: Record<string, number>;
  streak?: number;
}

export interface MindForYou {
  loggedIn: boolean;
  stage: MindStage;
  continue: { theme: InsightTheme; steps: MindThemeProgress['steps']; next: MindStepKey | ''; items?: InsightItem[] }[];
  explore: (InsightTheme & { why?: string })[];
}

export const MIND_ME_KEY = ['mind', 'me'];

export const me = (): Promise<MindMe> => contentClient.get('/mind/me');

export const forYou = (): Promise<MindForYou> => contentClient.get('/mind/foryou');

export const answer = (body: { theme: string; text: string; axis?: LifeAxis | '' }): Promise<{ id: number }> =>
  contentClient.post('/mind/answer', body);

/** 后端没回来时也要能分层(和 mind.go 的 mindLayerOf 同一张表)。 */
const LAYER_OF: Record<string, MindLayer> = {
  MUSIC: 1,
  VIDEO: 1,
  SHORT_DRAMA: 1,
  VSHOW: 1,
  PICTURE: 1,
  WALLPAPER: 1,
  POETRY: 3,
};
export const layerOf = (contentType: string): MindLayer => LAYER_OF[contentType] ?? 2;

export const LAYER_FALLBACK: MindLayerMeta[] = [
  { layer: 1, name: '照见', hint: '音乐、短视频、短剧:几分钟里，先认出这种心情' },
  { layer: 2, name: '体味', hint: '电影、剧集、书与文章:走进别人的处境，陪他走一段' },
  { layer: 3, name: '参悟', hint: '诗词、编者论与史书故事:千百年前的人怎么说，看见规律' },
];
