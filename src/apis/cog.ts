// 作品解析引擎(认知库)API client。后端见 qingqiuyue-go internal/cognition(docs/COGNITION.md),都在 /api/content/cog/*。
//
// 一部作品拆成:一个世界(定律、地方、势力)、一群人(关系)、一条条人生(处境 → 选择 → 后果)、一句句感悟。
// ⚠️ contentClient 的响应拦截器已经把 body.data 剥出来了,这里直接返回结果。

import { contentClient } from '@/lib/api/client';

export type CogAxis = 'heart' | 'spine' | 'edge' | 'silence' | 'smile' | '';

export interface CogWorld {
  id: string;
  canonKey: string;
  /** real / historical / fictional / mythic */
  kind: string;
  genre: string;
  name: string;
  era: string;
  region: string;
  summary: string;
  workCount: number;
  lawCount: number;
}

export interface CogLaw {
  id: string;
  worldId: string;
  /** nature / society / ethics / power / economy / fate / mind */
  domain: string;
  kind: string;
  text: string;
  /** 几部作品说过 */
  support: number;
  /** 用户补的(没有 = 从作品里拆的) */
  authorId?: string;
  /** 几个人认同 */
  endorse?: number;
}

export interface CogNamed {
  id: string;
  name: string;
  kind: string;
  description: string;
  support: number;
}

export interface CogCharacter {
  id: string;
  worldId: string;
  contentId: string;
  name: string;
  aliases: string;
  /** lead / support / minor */
  role: string;
  identity: string;
  persona: string;
  arc: string;
}

export interface CogRelation {
  id: string;
  aId: string;
  bId: string;
  kind: string;
  note: string;
}

export interface CogEvent {
  id: string;
  characterId: string;
  contentId: string;
  seq: number;
  /** childhood / youth / young / middle / late */
  stage: string;
  ageHint: string;
  situation: string;
  choice: string;
  /** JSON 数组:本可以怎么选 */
  alternatives: string;
  consequence: string;
  axis: CogAxis;
  feel: string;
  returnsTo: string;
}

export interface CogInsight {
  id: string;
  contentId: string;
  characterId: string;
  eventId: string;
  text: string;
  quote: string;
  theme: string;
  group: string;
  axis: CogAxis;
  /** 1 照见 / 2 体味 / 3 参悟 */
  layer: number;
  stance: string;
  authorId?: string;
  endorse?: number;
}

export interface CogWork {
  contentId: string;
  contentType: string;
  title: string;
  worldId: string;
  sourceKind: string;
  logline: string;
  tone: string;
}

export interface CogBrief {
  id: string;
  title: string;
  contentType: string;
  coverUrl: string;
  author: string;
}

export const STAGE_NAME: Record<string, string> = { childhood: '童年', youth: '少年', young: '青年', middle: '中年', late: '暮年' };
export const LAYER_NAME: Record<number, string> = { 1: '照见', 2: '体味', 3: '参悟' };
export const DOMAIN_NAME: Record<string, string> = {
  nature: '自然',
  society: '社会',
  ethics: '伦理',
  power: '力量',
  economy: '生计',
  fate: '命运',
  mind: '心',
};
export const WORLD_KIND_NAME: Record<string, string> = { real: '现实', historical: '历史', fictional: '虚构', mythic: '神话' };
export const REL_NAME: Record<string, string> = { kin: '亲', love: '爱', friend: '友', mentor: '师徒', enemy: '敌', master: '主仆', other: '' };

export const alternativesOf = (e: CogEvent): string[] => {
  try {
    const v = JSON.parse(e.alternatives || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export type CogWorkResult =
  | { analyzed: false }
  | {
      analyzed: true;
      work: CogWork;
      world: CogWorld;
      laws: CogLaw[];
      characters: CogCharacter[];
      relations: CogRelation[];
      events: CogEvent[];
      insights: CogInsight[];
    };

export const cogWork = (id: string) => contentClient.get<CogWorkResult>('/cog/work', { params: { id } });

export const cogWorld = (id: string) =>
  contentClient.get<{
    world: CogWorld;
    laws: CogLaw[];
    places: CogNamed[];
    groups: CogNamed[];
    works: CogWork[];
    characters: CogCharacter[];
    briefs: Record<string, CogBrief>;
    /** 这个世界组装出的宇宙(发布了才有),可以到人生轮回里活一世 */
    universe?: string;
  }>('/cog/world', { params: { id } });

export const cogCharacter = (id: string) =>
  contentClient.get<{ character: CogCharacter; events: CogEvent[]; insights: CogInsight[]; relations: CogRelation[]; work?: CogBrief }>(
    '/cog/character',
    { params: { id } },
  );

export const cogInsights = (q: { theme?: string; axis?: string; layer?: number; limit?: number; before?: string }) =>
  contentClient.get<{ list: { insight: CogInsight; work: CogBrief }[] }>('/cog/insights', { params: q });

export const cogWorlds = (q: { kind?: string; genre?: string } = {}) => contentClient.get<{ list: CogWorld[] }>('/cog/worlds', { params: q });

// ── 共创:用户完善世界(后端 internal/cognition/cocreate.go,要登录) ──

export type CogAssistKind = 'law' | 'place' | 'group' | 'character' | 'event' | 'insight';

export const addLaw = (worldId: string, text: string, domain: string) =>
  contentClient.post<{ law: CogLaw; points: number }>(`/cog/world/${worldId}/law`, { text, domain });
export const addPlace = (worldId: string, kind: 'place' | 'group', body: { name: string; kind?: string; description?: string }) =>
  contentClient.post<{ points: number }>(`/cog/world/${worldId}/${kind}`, body);
export const addCharacter = (worldId: string, body: { name: string; identity?: string; persona?: string; arc?: string }) =>
  contentClient.post<{ character: CogCharacter; points: number }>(`/cog/world/${worldId}/character`, body);
export const addEvent = (
  characterId: string,
  body: { stage: string; ageHint?: string; situation: string; choice: string; alternatives?: string[]; consequence?: string; axis?: string; feel?: string },
) => contentClient.post<{ event: CogEvent; points: number }>(`/cog/character/${characterId}/event`, body);
export const addInsight = (body: { worldId?: string; contentId?: string; characterId?: string; text: string; theme?: string; axis?: string; layer?: number }) =>
  contentClient.post<{ insight: CogInsight; points: number }>('/cog/insight', body);
export const removeMine = (kind: string, id: string) => contentClient.delete(`/cog/mine/${kind}/${id}`);
export const endorse = (kind: 'law' | 'insight', id: string, on: boolean) =>
  contentClient.post<{ endorse: number; on: boolean }>('/cog/endorse', { kind, id, on });
export const cogAssist = (worldId: string, kind: CogAssistKind, hint: string, characterId?: string) =>
  contentClient.post<{ items: Record<string, unknown>[] }>('/cog/assist', { worldId, kind, hint, characterId });
