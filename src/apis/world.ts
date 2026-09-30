/**
 * 数字人世界「言出法随」的服务端接口(core-api /api/core/world/*,都要登录)
 *
 * 素材目录(Poly Haven CC0 + 自己加工的)、摆放(个人空间 / 公共)、现取现做队列。
 * 数字人的 world_place 工具在服务端挑好素材,前端拿结果摆放、存到这里。
 */

import { accountClient } from '@/lib/api/client';

export interface WorldAsset {
  key: string;
  nameZh: string;
  nameEn?: string;
  /** ready = 能直接摆;processing = 正在现做;available = 目录里有、还没加工;failed = 做失败了 */
  status: 'ready' | 'processing' | 'available' | 'failed' | 'hidden';
  /** qq-media/world 下的相对路径(models/xxx.glb;用户上传的还没加工完时是 uploads/<key>/src.glb) */
  file: string;
  height: number;
  footprint: number;
  isSet?: boolean;
  /** polyhaven / upload / … */
  source?: string;
  kind?: 'model' | 'avatar' | 'splat';
}

export interface WorldPlacement {
  id: string;
  ownerId: string;
  sceneKey: string;
  assetKey: string;
  label: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  public: boolean;
  asset?: WorldAsset;
}

export async function listPlacements(scene: string): Promise<WorldPlacement[]> {
  const r = await accountClient.get<{ placements: WorldPlacement[] }>('/world/placements', { params: { scene } });
  return Array.isArray(r?.placements) ? r.placements : [];
}

export interface PlacementInput {
  scene: string;
  asset: string;
  label?: string;
  x: number;
  y?: number;
  z: number;
  rotY?: number;
  scale?: number;
}

/** public = 摆到公共场景(只有有 system:plaza:manage 的人能成功) */
export async function createPlacement(p: PlacementInput, isPublic = false): Promise<WorldPlacement> {
  return accountClient.post<WorldPlacement>(isPublic ? '/admin/world/placements' : '/world/placements', p);
}

export async function updatePlacement(id: string, p: Partial<PlacementInput>, isPublic = false): Promise<WorldPlacement> {
  return accountClient.put<WorldPlacement>(`${isPublic ? '/admin/world' : '/world'}/placements/${encodeURIComponent(id)}`, p);
}

export async function deletePlacement(id: string, isPublic = false): Promise<void> {
  await accountClient.delete(`${isPublic ? '/admin/world' : '/world'}/placements/${encodeURIComponent(id)}`);
}

export async function getAsset(key: string): Promise<WorldAsset | null> {
  return (await accountClient.get<WorldAsset>(`/world/assets/${encodeURIComponent(key)}`)) ?? null;
}

// ───────────────────────── 创世:房间、形象、上传 ─────────────────────────

export type AssetKind = 'model' | 'avatar' | 'splat';

/** 素材库里的一件(平台目录 / 自己传的 / 别人公开的) */
export interface WorldAssetFull extends WorldAsset {
  kind: AssetKind;
  ownerId: string;
  visibility: 'public' | 'private';
  source: string;
  category: string;
  tagsZh?: string;
  bytes: number;
  polycount?: number;
  splats?: number;
  srcFile?: string;
  error?: string;
  createdAt?: string;
}

/** 房间外壳模板 */
export type RoomTemplate = 'study' | 'courtyard' | 'loft' | 'empty' | 'splat';

export interface ShellAlign { x: number; y: number; z: number; scale: number; rotX: number; rotY: number; rotZ: number }

export interface WorldRoom {
  ownerId: string;
  name: string;
  intro: string;
  template: RoomTemplate;
  splatKey: string;
  shell: ShellAlign;
  palette: { time?: string; weather?: string };
  visibility: 'public' | 'private';
  version: number;
  visits: number;
  items: number;
  mine: boolean;
  owner: { id: string; nickname: string; avatar?: string };
  splat?: WorldAssetFull;
  updatedAt?: string;
  /** 此刻房里有几个人 */
  online?: number;
  /** 三期:AI 管家开着 */
  butler?: boolean;
}

// ── 三期:AI 进入房间 ──

export interface AIAgentOption { agentId: string; name: string; description: string; avatarUrl?: string }
export interface AIMember { id: string; key: string; name: string; butler?: boolean; expiresAt?: string }

/** 能请来做客的 AI(后台上架的数字员工) */
export async function listAIAgents(): Promise<AIAgentOption[]> {
  const r = await accountClient.get<{ list: AIAgentOption[] }>('/world/ai/agents');
  return Array.isArray(r?.list) ? r.list : [];
}

/** 我房间里此刻的 AI + 管家开没开 */
export async function getMyRoomAI(): Promise<{ butler: boolean; members: AIMember[] }> {
  const r = await accountClient.get<{ butler: boolean; members: AIMember[] }>('/world/rooms/mine/ai');
  return { butler: !!r?.butler, members: Array.isArray(r?.members) ? r.members : [] };
}

export async function inviteAI(agentId: string): Promise<AIMember> {
  return accountClient.post<AIMember>('/world/rooms/mine/ai', { agentId });
}

export async function dismissAI(id: string): Promise<void> {
  await accountClient.delete(`/world/rooms/mine/ai/${encodeURIComponent(id)}`);
}

export interface RoomVisitor { userId: string; times: number; lastAt: string; user: { id: string; nickname: string; avatar?: string } }

/** 最近来我房间串门的人 */
export async function listMyVisitors(): Promise<RoomVisitor[]> {
  const r = await accountClient.get<{ list: RoomVisitor[] }>('/world/rooms/mine/visitors');
  return Array.isArray(r?.list) ? r.list : [];
}

export const roomSceneKey = (ownerId: string | number) => `room:${ownerId}`;
export const roomOwnerOf = (sceneKey: string) => (sceneKey.startsWith('room:') ? sceneKey.slice(5) : null);

export async function getMyRoom(): Promise<WorldRoom> {
  return accountClient.get<WorldRoom>('/world/rooms/mine');
}

export async function getRoom(ownerId: string): Promise<WorldRoom> {
  return accountClient.get<WorldRoom>(`/world/rooms/${encodeURIComponent(ownerId)}`);
}

export type RoomPatch = Partial<Pick<WorldRoom, 'name' | 'intro' | 'template' | 'splatKey' | 'shell' | 'palette' | 'visibility' | 'butler'>>;

export async function updateMyRoom(p: RoomPatch): Promise<WorldRoom> {
  return accountClient.put<WorldRoom>('/world/rooms/mine', p);
}

export async function listPublicRooms(limit = 30): Promise<WorldRoom[]> {
  const r = await accountClient.get<{ list: WorldRoom[] }>('/world/rooms', { params: { limit } });
  return Array.isArray(r?.list) ? r.list : [];
}

export async function visitRoom(ownerId: string): Promise<void> {
  await accountClient.post(`/world/rooms/${encodeURIComponent(ownerId)}/visit`);
}

export interface BrowseParams { kind?: AssetKind; category?: string; q?: string; mine?: boolean; page?: number; size?: number }

export async function browseAssets(p: BrowseParams = {}): Promise<{ list: WorldAssetFull[]; total: number }> {
  const r = await accountClient.get<{ list: WorldAssetFull[]; total: number }>('/world/assets/browse', {
    params: { kind: p.kind ?? 'model', category: p.category || undefined, q: p.q || undefined, mine: p.mine ? 1 : undefined, page: p.page ?? 1, size: p.size ?? 40 },
  });
  return { list: Array.isArray(r?.list) ? r.list : [], total: Number(r?.total) || 0 };
}

export async function myAssets(kind?: AssetKind): Promise<WorldAssetFull[]> {
  const r = await accountClient.get<{ list: WorldAssetFull[] }>('/world/assets/mine', { params: { kind } });
  return Array.isArray(r?.list) ? r.list : [];
}

export async function updateMyAsset(key: string, p: { nameZh?: string; tagsZh?: string; category?: string; visibility?: 'public' | 'private' }): Promise<WorldAssetFull> {
  return accountClient.put<WorldAssetFull>(`/world/assets/${encodeURIComponent(key)}`, p);
}

export async function deleteMyAsset(key: string): Promise<void> {
  await accountClient.delete(`/world/assets/${encodeURIComponent(key)}`);
}

export interface UploadInput { file: Blob; filename: string; name?: string; category?: string; tags?: string; visibility?: 'public' | 'private' }

/** 上传素材(不审核):GLB 模型 / VRM 形象 / 泼溅。admin = 以平台名义传(后台) */
export async function uploadWorldAsset(u: UploadInput, onProgress?: (ratio: number) => void, admin = false): Promise<WorldAssetFull> {
  const fd = new FormData();
  fd.append('file', u.file, u.filename);
  if (u.name) fd.append('name', u.name);
  if (u.category) fd.append('category', u.category);
  if (u.tags) fd.append('tags', u.tags);
  if (u.visibility) fd.append('visibility', u.visibility);
  return accountClient.post<WorldAssetFull>(admin ? '/admin/world/uploads' : '/world/uploads', fd, {
    timeout: 0,
    onUploadProgress: (e) => { if (onProgress && e.total) onProgress(e.loaded / e.total); },
  });
}

// ── 形象(捏人 / 捏脸) ──

/** 捏人参数:前端实时套在 VRM 上,不重新烘模型。所有字段可缺省 */
export interface AvatarParams {
  /** 身材(骨骼缩放,1 = 原样) */
  body?: { height?: number; head?: number; neck?: number; shoulders?: number; arms?: number; legs?: number; torso?: number; build?: number };
  /** 脸:眼睛大小(眼骨缩放) + 写实底模的 qq_face_* 形变(-1..1) */
  face?: Record<string, number>;
  /** 颜色(#rrggbb,乘到对应材质上;空 = 原色) */
  colors?: { skin?: string; hair?: string; eyes?: string; outfit?: string; accent?: string };
}

export interface WorldAvatar {
  userId: string;
  /** 底模:/avatars/x.vrm(站内)或 qq-media/world 下的相对路径 */
  base: string;
  baseName: string;
  params: AvatarParams;
  version: number;
}

export async function getMyAvatar(): Promise<WorldAvatar> {
  return accountClient.get<WorldAvatar>('/world/avatars/me');
}

export async function getUserAvatar(uid: string): Promise<WorldAvatar> {
  return accountClient.get<WorldAvatar>(`/world/avatars/${encodeURIComponent(uid)}`);
}

export async function saveMyAvatar(a: { base: string; baseName?: string; params: AvatarParams }): Promise<WorldAvatar> {
  return accountClient.put<WorldAvatar>('/world/avatars/me', a);
}

// ── 后台素材库 ──

export interface AdminWorldAsset extends WorldAssetFull { owner?: { id: string; nickname: string }; uses: number; tagsEn?: string; license?: string; updatedAt?: string }

export async function adminListWorldAssets(p: { kind?: string; status?: string; source?: string; owner?: string; q?: string; sort?: string; page?: number; size?: number }) {
  const r = await accountClient.get<{ list: AdminWorldAsset[]; total: number }>('/admin/world/assets', { params: p });
  return { list: Array.isArray(r?.list) ? r.list : [], total: Number(r?.total) || 0 };
}

export interface AdminWorldStats {
  assets: { kind: string; status: string; n: number; bytes: number }[];
  jobs: { status: string; n: number }[];
  recentFailed: { id: string; assetKey: string; error?: string; updatedAt: string }[];
  rooms: number;
  publicRooms: number;
  avatars: number;
  uploads: number;
}

export async function adminWorldStats(): Promise<AdminWorldStats> {
  return accountClient.get<AdminWorldStats>('/admin/world/stats');
}

export async function adminUpdateWorldAsset(key: string, p: { nameZh?: string; tagsZh?: string; tagsEn?: string; category?: string; visibility?: string; status?: string }) {
  return accountClient.put<WorldAssetFull>(`/admin/world/assets/${encodeURIComponent(key)}`, p);
}

export async function adminDeleteWorldAsset(key: string, force = false) {
  await accountClient.delete(`/admin/world/assets/${encodeURIComponent(key)}`, { params: force ? { force: 1 } : undefined });
}

export async function adminRetryWorldAsset(key: string) {
  return accountClient.post<{ key: string; queued: boolean }>(`/admin/world/assets/${encodeURIComponent(key)}/retry`);
}

/** 目录里有、还没加工的素材:排进现做队列(每人每天 12 件),返回最新状态 */
export async function fetchWorldAsset(key: string): Promise<WorldAsset> {
  return accountClient.post<WorldAsset>(`/world/assets/${encodeURIComponent(key)}/fetch`);
}
