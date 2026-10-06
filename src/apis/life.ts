// 人生轮回 API client。后端见 qingqiuyue-go internal/lifeapp(规范 docs/LIFE-CYCLE.md),都在 /api/core/life/*。
//
// ⚠️ accountClient 的响应拦截器已经把 body.data 剥出来了,这里直接返回结果。

import { accountClient } from '@/lib/api/client';

export interface LifeUniverseBrief {
  key: string;
  name: string;
  era?: string;
  summary?: string;
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
  life: LifeView;
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
  choices?: { q: string; label: string; axis?: string; feel?: string; auto?: boolean }[];
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
}

export const listUniverses = () => accountClient.get<{ list: LifeUniverseBrief[] }>('/life/universes');

export const getUniverse = (key: string) => accountClient.get<LifeUniverse>(`/life/universes/${encodeURIComponent(key)}`);

export const lifeMe = () =>
  accountClient.get<{ runs: LifeRun[]; marks: LifeMark[]; lives: number; shadeOff: boolean }>('/life/me');

export const setShadeOff = (shadeOff: boolean) => accountClient.put<{ shadeOff: boolean }>('/life/me/settings', { shadeOff });

export const deleteRun = (id: string) => accountClient.delete(`/life/me/runs/${id}`);

export const deleteMark = (key: string) => accountClient.delete(`/life/me/marks/${encodeURIComponent(key)}`);

export const startRun = (universe: string, picks: Record<string, string>) =>
  accountClient.post<{ run: LifeRun; says?: string[]; life?: LifeView; resumed?: boolean }>('/life/runs', { universe, picks });

export const getRun = (id: string) => accountClient.get<{ run: LifeRun; life: LifeView; frame?: LifeFrame }>(`/life/runs/${id}`);

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
