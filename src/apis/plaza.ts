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

export async function plazaHeartbeat(body: { x: number; z: number; yaw: number; zone?: string | null; scene?: string; moving?: boolean; refresh?: boolean }): Promise<PresenceReply | null> {
  return accountClient.post<PresenceReply>('/plaza/presence', { ...body, zone: body.zone ?? '' });
}

export async function leavePlaza(): Promise<void> {
  await accountClient.delete('/plaza/presence');
}

/** 实时推送里的广场事件类型(与 Go plazaapp.EventWish / EventBless 一致) */
export const PLAZA_EVENT_WISH = 'plaza.wish';
export const PLAZA_EVENT_BLESS = 'plaza.bless';

// ==================== 场景与人物(后台 /system/plaza 维护) ====================

export interface PlazaLandmark {
  id: string;
  label: string;
  emoji: string;
  hint: string;
  actionLabel: string;
  x: number;
  z: number;
  radius: number;
  solidRadius: number;
  color: string;
  prop: string;
  feed: string;
  themeKey?: string;
  prompt?: string;
}

export interface PlazaScene {
  id: string;
  key: string;
  name: string;
  intro: string;
  kind: 'plaza' | 'insight';
  group: string;
  stage: string;
  /** 配色 + 环境:time = auto/dawn/day/dusk/night,weather = none/petals/leaves/rain/snow/fireflies */
  palette: { ground?: string; path?: string; accent?: string; time?: string; weather?: string; grass?: boolean; style?: 'stylized' | 'realistic' };
  landmarks: PlazaLandmark[];
  status: 'published' | 'draft';
  sort: number;
}

export interface PlazaCharacter {
  id: string;
  sceneKey: string;
  name: string;
  title: string;
  kind: 'poet' | 'guide';
  poet: string;
  themeKey: string;
  groupKey: string;
  lines: string[];
  x: number;
  z: number;
  color: string;
  status: 'published' | 'draft';
  sort: number;
}

export interface PlazaScenesReply { scenes: PlazaScene[]; characters: PlazaCharacter[] }

/** 用户:已发布的场景和人物。回包形状不对时抛错,调用方用默认的星光广场 */
export async function listPlazaScenes(): Promise<PlazaScenesReply> {
  const r = await accountClient<PlazaScenesReply>('/plaza/scenes');
  if (!r || !Array.isArray(r.scenes) || !Array.isArray(r.characters)) throw new Error('场景暂时连不上');
  return r;
}

/** 后台:全部场景和人物(含草稿) */
export async function adminListPlazaScenes(): Promise<PlazaScenesReply> {
  const r = await accountClient<PlazaScenesReply>('/admin/plaza/scenes');
  return { scenes: r?.scenes ?? [], characters: r?.characters ?? [] };
}
export const adminSavePlazaScene = (s: Partial<PlazaScene>) =>
  s.id ? accountClient.put<PlazaScene>(`/admin/plaza/scenes/${s.id}`, s) : accountClient.post<PlazaScene>('/admin/plaza/scenes', s);
export const adminDeletePlazaScene = (id: string) => accountClient.delete(`/admin/plaza/scenes/${id}`);
export const adminSavePlazaCharacter = (c: Partial<PlazaCharacter>) =>
  c.id ? accountClient.put<PlazaCharacter>(`/admin/plaza/characters/${c.id}`, c) : accountClient.post<PlazaCharacter>('/admin/plaza/characters', c);
export const adminDeletePlazaCharacter = (id: string) => accountClient.delete(`/admin/plaza/characters/${id}`);
