/**
 * 数字人星光广场的服务端接口(core-api /api/core/plaza/*,都要登录)
 *
 * 进度、许愿墙、祝福、谁在广场。许愿和给别人祝福会在服务端记每日任务(plaza_wish / plaza_bless)发积分。
 */

import { accountClient } from '@/lib/api/client';

export interface PlazaProgress {
  day: string;
  xp: number;
  orbsTotal: number;
  quests: Record<string, number>;
  done: string[];
  visited: string[];
}

export interface PlazaUser {
  id: string;
  nickname: string;
  avatar: string;
  /** 戴着的广场光环:颜色值,或 'rainbow' */
  aura?: string;
}

export interface PlazaWish {
  id: string;
  userId: string;
  text: string;
  blessings: number;
  createdAt: string;
  user: PlazaUser;
  blessed: boolean;
  mine: boolean;
}

export interface PlazaPeer extends PlazaUser {
  x: number;
  z: number;
  yaw: number;
  zone?: string;
  moving?: boolean;
  ts: number;
}

export async function getPlazaProgress(): Promise<{ progress: PlazaProgress; exists: boolean } | null> {
  return accountClient<{ progress: PlazaProgress; exists: boolean }>('/plaza/progress');
}

export async function savePlazaProgress(p: PlazaProgress): Promise<PlazaProgress | null> {
  return (await accountClient.put<{ progress: PlazaProgress }>('/plaza/progress', p))?.progress ?? null;
}

/** 回包不是预期的形状(服务没上线、被网关拦了)时抛错,调用方显示「连不上」而不是「许完了」 */
export async function listPlazaWishes(limit = 30): Promise<{ list: PlazaWish[]; leftToday: number }> {
  const r = await accountClient<{ list: PlazaWish[]; leftToday: number }>('/plaza/wishes', { params: { limit } });
  if (!r || !Array.isArray(r.list) || typeof r.leftToday !== 'number') throw new Error('许愿墙暂时连不上');
  return { list: r.list, leftToday: r.leftToday };
}

export async function makePlazaWish(text: string): Promise<{ wish: PlazaWish; leftToday: number }> {
  return accountClient.post<{ wish: PlazaWish; leftToday: number }>('/plaza/wishes', { text });
}

export async function blessPlazaWish(id: string): Promise<{ blessings: number; blessed: boolean }> {
  return accountClient.post<{ blessings: number; blessed: boolean }>(`/plaza/wishes/${encodeURIComponent(id)}/bless`, {});
}

export interface PresenceReply { peers: PlazaPeer[]; online: number; self: PlazaUser }

export async function plazaHeartbeat(body: { x: number; z: number; yaw: number; zone?: string | null; moving?: boolean; refresh?: boolean }): Promise<PresenceReply | null> {
  return accountClient.post<PresenceReply>('/plaza/presence', { ...body, zone: body.zone ?? '' });
}

export async function leavePlaza(): Promise<void> {
  await accountClient.delete('/plaza/presence');
}

/** 实时推送里的广场事件类型(与 Go plazaapp.EventWish / EventBless 一致) */
export const PLAZA_EVENT_WISH = 'plaza.wish';
export const PLAZA_EVENT_BLESS = 'plaza.bless';
