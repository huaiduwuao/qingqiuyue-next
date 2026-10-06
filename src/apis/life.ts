// 人生轮回 API client。后端见 qingqiuyue-go internal/lifeapp(规范 docs/LIFE-CYCLE.md),都在 /api/core/life/*。
//
// ⚠️ accountClient 的响应拦截器已经把 body.data 剥出来了,这里直接返回结果。

import { accountClient } from '@/lib/api/client';

export interface LifeUniverseBrief {
  key: string;
  name: string;
  era?: string;
  summary?: string;
  /** 这个宇宙的定律(白话) */
  laws?: string[];
  /** 藏着几个奥秘 */
  secretTotal?: number;
}

export interface LifeOriginField {
  key: string;
  name: string;
  options?: string[];
  range?: [number, number];
  choosable?: boolean;
}

export interface LifeUniverse extends LifeUniverseBrief {
  origin: { fields: LifeOriginField[]; choosable: number };
  stages: { key: string; name: string; ages: [number, number] }[];
}

export type LifeRunStatus = 'alive' | 'dead' | 'done';

export interface LifeRun {
  id: string;
  universe: string;
  universeName: string;
  no: number;
  status: LifeRunStatus;
  age: number;
  origin?: Record<string, string | number>;
  cause?: string;
  words?: string;
  mark?: string;
  createdAt: number;
  endedAt: number;
}

export interface LifeView {
  no: number;
  age: number;
  stage: string;
  stageName: string;
  /** 看得见的状态:{名字: 值} */
  vars?: Record<string, number>;
  alive: boolean;
  cause?: string;
}

export interface LifeShot {
  id: string;
  tone?: string;
  image?: string;
  video?: string;
  caption?: string;
  line?: string;
  who?: string;
  whoName?: string;
  hasNext: boolean;
}

export interface LifeChoice {
  id: string;
  text: string;
  options: { label: string; axis?: string; feel?: string }[];
  /** 毫秒;0 = 不限时 */
  wait?: number;
  default?: number;
  /** 非空 = 可以用自己的话回答(输入框的提示) */
  free?: string;
}

export interface LifeReflect {
  id: string;
  text: string;
}

export interface LifeEcho {
  total: number;
  /** 选项下标 → 几个人(不含自己) */
  counts: Record<string, number>;
  mine: number;
  other?: { seatName: string; total: number; counts: Record<string, number> };
}

export interface LifeDeath {
  cause?: string;
  age: number;
}

export interface LifeFrame {
  juncture: string;
  name: string;
  seat: string;
  seatName: string;
  shot?: LifeShot;
  says?: string[];
  choice?: LifeChoice;
  reflect?: LifeReflect;
  echo?: LifeEcho;
  ended?: boolean;
  died?: LifeDeath;
  nextTimer?: number;
  /** 刚见到的奥秘 */
  unveiled?: LifeSecret[];
  /** 这里可以「自己做点什么」 */
  explore?: boolean;
  /** 两场之间自己来的地方 */
  place?: boolean;
  life: LifeView;
}

export interface LifeSecret {
  key: string;
  text?: string;
  all?: boolean;
}

export interface LifePlace {
  key: string;
  name: string;
  intro?: string;
}

export interface LifeMark {
  key: string;
  kind?: string;
  text?: string;
  life?: number;
  universe?: string;
}

export interface LifeHistEntry {
  j: string;
  name: string;
  seat: string;
  seatName: string;
  age: number;
  choices?: { q: string; label: string; axis?: string; feel?: string; auto?: boolean; free?: string }[];
  words?: { q: string; text: string }[];
}

export interface LifeStepResult {
  frame?: LifeFrame;
  run?: LifeRun;
  /** 进下一场之前年岁往前走时宇宙说的话 */
  says?: string[];
  /** 一生走完了(next 时没有下一场) */
  died?: LifeDeath;
  life?: LifeView;
  /** 他写的话里像是很难受:温和地给求助信息 */
  care?: boolean;
  /** 这场过去了:两场之间能去的地方 */
  places?: LifePlace[];
}

export const listUniverses = () => accountClient.get<{ list: LifeUniverseBrief[] }>('/life/universes');

export const getUniverse = (key: string) => accountClient.get<LifeUniverse>(`/life/universes/${encodeURIComponent(key)}`);

export const lifeMe = () =>
  accountClient.get<{
    runs: LifeRun[];
    marks: LifeMark[];
    lives: number;
    shadeOff: boolean;
    secrets: { universe: string; key: string; text?: string; life: number; deep: boolean }[];
    /** 宇宙 key → 见过几个奥秘('*' 是跨宇宙的) */
    found: Record<string, number>;
    /** 见过几个宇宙最深的那个奥秘 */
    deep: number;
    universes: number;
  }>('/life/me');

export const setShadeOff = (shadeOff: boolean) => accountClient.put<{ shadeOff: boolean }>('/life/me/settings', { shadeOff });

export const deleteRun = (id: string) => accountClient.delete(`/life/me/runs/${id}`);

export const deleteMark = (key: string) => accountClient.delete(`/life/me/marks/${encodeURIComponent(key)}`);

export const startRun = (universe: string, picks: Record<string, string>) =>
  accountClient.post<{ run: LifeRun; says?: string[]; life?: LifeView; resumed?: boolean }>('/life/runs', { universe, picks });

export const getRun = (id: string) => accountClient.get<{ run: LifeRun; life: LifeView; frame?: LifeFrame; places?: LifePlace[] }>(`/life/runs/${id}`);

export const lifeNext = (id: string) => accountClient.post<LifeStepResult>(`/life/runs/${id}/next`, {});
export const lifeTap = (id: string) => accountClient.post<LifeStepResult>(`/life/runs/${id}/tap`, {});
export const lifeTick = (id: string) => accountClient.post<LifeStepResult>(`/life/runs/${id}/tick`, {});
export const lifeChoose = (id: string, choice: string, index: number) =>
  accountClient.post<LifeStepResult>(`/life/runs/${id}/choose`, { id: choice, index });
/** text 空着 = 跳过这一问 */
export const lifeReflect = (id: string, q: string, text: string) =>
  accountClient.post<LifeStepResult>(`/life/runs/${id}/reflect`, { id: q, text });

export const lifeReview = (id: string) =>
  accountClient.get<{ run: LifeRun; life: LifeView; history: LifeHistEntry[]; marks: LifeMark[]; universe: LifeUniverseBrief }>(`/life/runs/${id}/review`);

export const lifeFinish = (id: string, text: string, mark: string) =>
  accountClient.post<{ run: LifeRun; care?: boolean }>(`/life/runs/${id}/finish`, { text, mark });

/** 用自己的话回答一道题(推演,要等模型想一想) */
export const lifeChooseFree = (id: string, choice: string, text: string) =>
  accountClient.post<LifeStepResult>(`/life/runs/${id}/choose`, { id: choice, text });

/** 在这里自己做点什么(推演) */
export const lifeExplore = (id: string, text: string) => accountClient.post<LifeStepResult>(`/life/runs/${id}/explore`, { text });

/** 两场之间去一个地方 */
export const lifePlace = (id: string, key: string) => accountClient.post<LifeStepResult>(`/life/runs/${id}/place`, { key });
