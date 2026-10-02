/**
 * 数字人世界「言出法随」的服务端接口(core-api /api/core/world/*,都要登录)
 *
 * 素材目录(Poly Haven CC0 + 自己加工的)、摆放(个人空间 / 公共)、现取现做队列。
 * 数字人的 world_place 工具在服务端挑好素材,前端拿结果摆放、存到这里。
 */

import { accountClient } from '@/lib/api/client';
import { mediaUrl } from '@/lib/media';

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
  /** 老格式文件的大小(字节) */
  bytes?: number;
  /** 创世五期:三档文件(近 / 中 / 远,meshopt + KTX2);没有 = 只有 file 一份 */
  lods?: WorldAssetLod[];
  /** 创世五期:泼溅的精简档(≤ 40 万点,SPZ),流畅画质用 */
  lite?: string;
  /** 创世八期:缩略图(qq-media/world 下的相对路径,256px 透明底 PNG) */
  thumb?: string;
  /** Poly Haven 的类别(furniture / lighting / seating …),用户上传的是自己选的 */
  category?: string;
  /** 世界模型:摆出来默认是什么原型。空 = 按平台原型的 match 自动认(灯、座位……);'-' = 只是摆着看 */
  kindKey?: string;
}

/** qq-media/world 下的相对路径 → 能直接放进 <img> 的地址 */
export const worldFileUrl = (rel?: string | null) => (rel ? mediaUrl(`/qq-media/world/${rel}`) : '');

export interface WorldAssetLod {
  /** qq-media/world 下的相对路径 */
  file: string;
  tris: number;
  bytes: number;
  /** 转成 KTX2 的贴图张数 */
  ktx2?: number;
}

/** 一件素材摆进房间要下载多大(有分档按最近一档) */
export function assetBytes(a?: Pick<WorldAsset, 'bytes' | 'lods'> | null): number {
  if (!a) return 0;
  return a.lods?.[0]?.bytes || a.bytes || 0;
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
  // ── 世界模型(docs/WORLD-MODEL.md):有原型或规则的摆放就是「实体」 ──
  /** 原型 key */
  kind?: string;
  /** 状态(规则读写) */
  state?: Record<string, unknown>;
  /** 服务端按当前状态算好的属性:solid / emits / label / visible / zone / usable / sense … */
  props?: EntityProps;
  /** 外观:model(素材 key)或 shape(box / cylinder / sphere / disc)+ color + size(半宽 / 半高 / 半深) */
  look?: EntityLook;
  /** 这一个自己的规则 */
  rules?: WorldRule[];
  tags?: string[];
  /** 规则改了位置 / 朝向时的动画毫秒数 */
  anim?: number;
}

export interface EntityLook { model?: string; shape?: 'box' | 'cylinder' | 'sphere' | 'disc'; color?: string; size?: number[]; material?: number }
export interface EntityProps {
  solid?: boolean;
  walkable?: boolean;
  visible?: boolean;
  usable?: boolean;
  sense?: boolean;
  emits?: { color?: string; intensity?: number; radius?: number };
  label?: { text?: string } | string;
  zone?: { hx?: number; hy?: number; hz?: number };
  sittable?: unknown;
  [k: string]: unknown;
}
export interface WorldRule { on: string; if?: string; do: Record<string, unknown>[] }

/** 原型(平台的 ownerId = '0') */
export interface WorldKind {
  key: string;
  name?: string;
  extends?: string;
  look?: EntityLook;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
  rules?: WorldRule[];
  tags?: string[];
  ownerId: string;
  mine: boolean;
  visibility: 'public' | 'private';
}

export async function listKinds(): Promise<WorldKind[]> {
  const r = await accountClient.get<{ list: WorldKind[] }>('/world/kinds');
  return Array.isArray(r?.list) ? r.list : [];
}
/** 新建 / 改我的原型:def 是原型的 JSON(key 会自动加 u<我的 uid>. 前缀);规则写错了服务端会拒并说哪里错 */
export async function saveKind(def: Record<string, unknown>, opts: { key?: string; visibility?: 'public' | 'private' } = {}): Promise<WorldKind> {
  const body = { def, visibility: opts.visibility ?? 'private' };
  return opts.key ? accountClient.put<WorldKind>(`/world/kinds/${encodeURIComponent(opts.key)}`, body) : accountClient.post<WorldKind>('/world/kinds', body);
}
export async function deleteKind(key: string): Promise<void> {
  await accountClient.delete(`/world/kinds/${encodeURIComponent(key)}`);
}

// ── 整间房的规则(空间级):join / part / say / 自定义事件……和空间状态 ──
export interface SpaceRules { rules: WorldRule[]; state: Record<string, unknown> }
export async function getSpaceRules(): Promise<SpaceRules> {
  const r = await accountClient.get<SpaceRules>('/world/rooms/mine/rules');
  return { rules: Array.isArray(r?.rules) ? r.rules : [], state: r?.state ?? {} };
}
export async function saveSpaceRules(p: { rules?: WorldRule[]; state?: Record<string, unknown> }): Promise<SpaceRules> {
  return accountClient.put<SpaceRules>('/world/rooms/mine/rules', p);
}

// ── 「一句话交给 AI」:人话 → 原型 / 规则的草稿(不存;人看过、改过再走正常的保存) ──
export type ComposeTarget = 'kind' | 'entity' | 'space';
export interface ComposeDraft {
  explain: string;
  kind?: Omit<WorldKind, 'ownerId' | 'mine' | 'visibility'>;
  rules?: WorldRule[];
  state?: Record<string, unknown>;
  tags?: string[];
  /** AI 写的没通过校验的地方(已经让它改过一次);人自己改 */
  errors?: string[];
}
export async function composeWorld(text: string, target: ComposeTarget, current?: unknown): Promise<ComposeDraft> {
  return accountClient.post<ComposeDraft>('/world/ai/compose', { text, target, current }, { timeout: 100000 });
}

// ── 后台「造物」:平台原型、物质、下架玩家公开的原型 / 蓝图 ──
export interface AdminWorldKind extends Omit<WorldKind, 'mine'> {
  owner?: { id: string; nickname: string; avatar: string };
  edited?: boolean;
  updatedAt: string;
  match?: Record<string, unknown>;
}
export async function adminListKinds(scope: 'platform' | 'public' | 'all', q = ''): Promise<AdminWorldKind[]> {
  const r = await accountClient.get<{ list: AdminWorldKind[] }>('/admin/world/kinds', { params: { scope, q } });
  return Array.isArray(r?.list) ? r.list : [];
}
/** 平台原型:key 不存在就新建;玩家的原型只能改 visibility(private = 下架) */
export async function adminSaveKind(p: { key?: string; def?: Record<string, unknown>; visibility?: 'public' | 'private' }): Promise<void> {
  if (p.key) await accountClient.put(`/admin/world/kinds/${encodeURIComponent(p.key)}`, { def: p.def, visibility: p.visibility });
  else await accountClient.post('/admin/world/kinds', { def: p.def });
}
export async function adminDeleteKind(key: string): Promise<void> {
  await accountClient.delete(`/admin/world/kinds/${encodeURIComponent(key)}`);
}
export interface AdminWorldPrefab extends WorldLayout { owner?: { id: string; nickname: string; avatar: string }; updatedAt: string }
export async function adminListPrefabs(q = '', all = false): Promise<AdminWorldPrefab[]> {
  const r = await accountClient.get<{ list: AdminWorldPrefab[] }>('/admin/world/prefabs', { params: { q, all: all ? 1 : undefined } });
  return Array.isArray(r?.list) ? r.list : [];
}
export async function adminSetPrefabVisibility(key: string, visibility: 'public' | 'private'): Promise<void> {
  await accountClient.put(`/admin/world/prefabs/${encodeURIComponent(key)}`, { visibility });
}
export async function adminListMaterials(): Promise<WorldMaterial[]> {
  const r = await accountClient.get<{ list: WorldMaterial[] }>('/world/materials', { params: { all: 1 } });
  return Array.isArray(r?.list) ? r.list : [];
}
export async function adminSaveMaterial(id: number, def: Record<string, unknown>): Promise<void> {
  await accountClient.put(`/admin/world/materials/${id}`, { def });
}
export async function adminHideMaterial(id: number): Promise<void> {
  await accountClient.delete(`/admin/world/materials/${id}`);
}

export async function listPlacements(scene: string): Promise<WorldPlacement[]> {
  const r = await accountClient.get<{ placements: WorldPlacement[] }>('/world/placements', { params: { scene } });
  return Array.isArray(r?.placements) ? r.placements : [];
}

export interface PlacementInput {
  scene: string;
  /** 素材(按原型放时可以不填,用原型的外观) */
  asset?: string;
  /** 世界模型:按原型放 / 改实体 */
  kind?: string;
  state?: Record<string, unknown>;
  rules?: WorldRule[];
  props?: Record<string, unknown>;
  tags?: string[];
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
  /** 六期:我关注了房主 */
  followed?: boolean;
  /** 六期:我上次来是什么时候(串门面板「最近」栏) */
  lastVisit?: string;
  /** 六期:门牌上的活动(正在进行的,或 7 天内最近的一场) */
  event?: WorldRoomEvent;
  /** 四期:房主关了房间语音 */
  voiceOff?: boolean;
  /** 八期:房间封面(qq-media/world 下的相对路径,房主在布置模式里截的) */
  cover?: string;
  /** 十一期:房主不让别人「照着布置」 */
  noCopy?: boolean;
  /** 十二期:谁能一起搭积木:owner 只有房主 / friends 房主关注的人 / anyone 进得来的人 */
  buildPolicy?: 'owner' | 'friends' | 'anyone';
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

export type RoomPatch = Partial<Pick<WorldRoom, 'name' | 'intro' | 'template' | 'splatKey' | 'shell' | 'palette' | 'visibility' | 'butler' | 'voiceOff' | 'noCopy' | 'buildPolicy'>>;

// ── 十二期:积木 ──
/** 一间房的积木:blocks 是打包的二进制(每块 12 字节)再 base64,用 vrm/world/blocks.ts decodeBlocks 解 */
/** 这间房自己的物质(id 200–255);房主整份换掉 */
export async function saveRoomMaterials(list: WorldMaterial[]): Promise<{ list: WorldMaterial[] }> {
  return accountClient.put<{ list: WorldMaterial[] }>('/world/rooms/mine/materials', { list });
}
/** 清空这间房里所有人身上的状态(分数、背包……重开一局) */
export async function resetRoomPlayers(): Promise<{ cleared: number }> {
  return accountClient.delete<{ cleared: number }>('/world/rooms/mine/players');
}

export async function getBlocks(owner: string): Promise<{ blocks: string; n: number; version: number; canBuild: boolean; materials?: WorldMaterial[] }> {
  return accountClient.get(`/world/rooms/${encodeURIComponent(owner)}/blocks`);
}
/** 改积木:[1, x, y, z, shape, mat, color, rot] 放 / [0, x, y, z] 拆,一次最多 512 条 */
export async function editBlocks(owner: string, ops: number[][]): Promise<{ applied: number }> {
  return accountClient.post(`/world/rooms/${encodeURIComponent(owner)}/blocks`, { ops });
}

// ── 物质(积木的材质):外观 + 物理属性,全是数据(go worldapp/materials.go) ──
export interface WorldMaterial {
  /** 积木里存的那个字节 */
  id: number;
  key: string;
  name: string;
  /** 默认颜色 #rrggbb */
  color: string;
  /** pattern 纹理样式(plain / speckle / wood / brick / brushed / tile / cloth)、opacity、roughness、metalness、unlit */
  look?: { pattern?: string; opacity?: number; roughness?: number; metalness?: number; unlit?: boolean; n?: number; lo?: number; hi?: number; size?: number };
  /** solid 挡人、walkable 顶上能站、transparent 透光、emits 发光、liquid {slow} 人在里面走得慢 */
  props?: { solid?: boolean; walkable?: boolean; transparent?: number; emits?: { intensity?: number; radius?: number }; liquid?: { slow?: number; float?: boolean; flow?: number; spread?: number; breath?: number } };
  /** 人踩上 / 走进这种积木时做什么(只认 enter / leave / touch 和自定义信号) */
  rules?: WorldRule[];
  hidden?: boolean;
}

export async function listMaterials(): Promise<WorldMaterial[]> {
  const r = await accountClient.get<{ list: WorldMaterial[] }>('/world/materials');
  return Array.isArray(r?.list) ? r.list : [];
}

// ── 蓝图(原来十一期的样板间):平台的、我存的、别人公开的 ──
export interface WorldLayout {
  key: string;
  name: string;
  intro: string;
  template: RoomTemplate;
  items: number;
  /** 现在就能摆出来的件数(其余还没做好,套用时跳过) */
  ready: number;
  /** 带着几块积木 */
  blocks?: number;
  /** 用到的几件素材的缩略图 */
  thumbs: string[];
  /** '0' = 平台的 */
  ownerId: string;
  mine?: boolean;
  visibility: 'public' | 'private';
}
export interface ApplyLayoutResult { placed: number; skipped: number; blocks?: number; canUndo: boolean }

/** 把我现在的房间(摆设、机关、积木、外壳)存成一份蓝图 */
export async function savePrefab(p: { name: string; intro?: string; visibility: 'public' | 'private' }): Promise<WorldLayout> {
  return accountClient.post<WorldLayout>('/world/prefabs', p);
}

export async function updatePrefab(key: string, p: { name?: string; intro?: string; visibility?: 'public' | 'private' }): Promise<void> {
  await accountClient.put(`/world/prefabs/${encodeURIComponent(key)}`, p);
}

export async function deletePrefab(key: string): Promise<void> {
  await accountClient.delete(`/world/prefabs/${encodeURIComponent(key)}`);
}

export async function listLayouts(): Promise<WorldLayout[]> {
  const r = await accountClient.get<{ list: WorldLayout[] }>('/world/layouts');
  return Array.isArray(r?.list) ? r.list : [];
}

/** 套样板间(template)或照着某人的房间(from = 房主 uid);replace = 整个换掉(能撤销一次),add = 往里加 */
export async function applyLayout(p: { template?: string; from?: string; mode: 'replace' | 'add' }): Promise<ApplyLayoutResult> {
  return accountClient.post<ApplyLayoutResult>('/world/rooms/mine/layout', p);
}

export async function undoLayout(): Promise<ApplyLayoutResult> {
  return accountClient.post<ApplyLayoutResult>('/world/rooms/mine/layout/undo', {});
}

export async function updateMyRoom(p: RoomPatch): Promise<WorldRoom> {
  return accountClient.put<WorldRoom>('/world/rooms/mine', p);
}

/** 八期:换房间封面(JPEG / PNG / WebP,≤ 800KB);返回新封面的相对路径 */
export async function uploadRoomCover(img: Blob): Promise<{ cover: string }> {
  const fd = new FormData();
  fd.append('file', img, 'cover.jpg');
  return accountClient.post<{ cover: string }>('/world/rooms/mine/cover', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 });
}

/** 串门面板的栏:热门 / 我关注的人 / 我最近去过的 */
export type RoomTab = 'hot' | 'follow' | 'recent';

export async function listPublicRooms(limit = 30, tab: RoomTab = 'hot'): Promise<WorldRoom[]> {
  const r = await accountClient.get<{ list: WorldRoom[] }>('/world/rooms', { params: { limit, tab } });
  return Array.isArray(r?.list) ? r.list : [];
}

// ── 六期:房间活动 ──

export interface WorldRoomEvent {
  id: string;
  ownerId: string;
  title: string;
  intro: string;
  startAt: string;
  endAt: string;
  status: 'scheduled' | 'cancelled';
  rsvps: number;
  joined: boolean;
  live: boolean;
  room?: { ownerId: string; name: string; ownerName: string; online: number };
}

export async function listRoomEvents(scope: 'upcoming' | 'joined' | 'mine' = 'upcoming'): Promise<WorldRoomEvent[]> {
  const r = await accountClient.get<{ list: WorldRoomEvent[] }>('/world/events', { params: { scope } });
  return Array.isArray(r?.list) ? r.list : [];
}

export async function createRoomEvent(p: { title: string; intro?: string; startAt: string; minutes: number }): Promise<WorldRoomEvent> {
  return accountClient.post<WorldRoomEvent>('/world/rooms/mine/events', p);
}

export async function cancelRoomEvent(id: string): Promise<WorldRoomEvent> {
  return accountClient.delete<WorldRoomEvent>(`/world/rooms/mine/events/${encodeURIComponent(id)}`);
}

export async function rsvpRoomEvent(id: string, join: boolean): Promise<WorldRoomEvent> {
  const url = `/world/events/${encodeURIComponent(id)}/rsvp`;
  return join ? accountClient.post<WorldRoomEvent>(url) : accountClient.delete<WorldRoomEvent>(url);
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
    // 客户端默认 Content-Type 是 JSON,axios 会把 FormData 转成 JSON 发出去;显式写 multipart,浏览器自己补 boundary
    headers: { 'Content-Type': 'multipart/form-data' },
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

/** 九期:集线器运行状况(GET /admin/world/live) */
export interface WorldLiveStats {
  sockets: number;
  users: number;
  inRooms: number;
  rooms: number;
  bots: number;
  listening: number;
  speaking: number;
  captions: number;
  asrDown: boolean;
  ttsBusy: number;
  scenes: Record<string, { line: number; n: number }[]>;
  busiestRoom?: { ownerId: string; n: number };
  window: {
    seconds: number; msgsInPerSec: number; framesOutPerSec: number; kbOutPerSec: number; voiceInPerSec: number; voiceOutPerSec: number;
    voiceDrop: number; slowDrops: number; joins: number; joinFull: number; tickAvgMs: number; tickWaitAvgMs: number; tickMaxMs: number; endedAt: number;
  };
  at: number;
}

export async function adminWorldLive(): Promise<WorldLiveStats> {
  return accountClient.get<WorldLiveStats>('/admin/world/live');
}

export async function adminWorldStats(): Promise<AdminWorldStats> {
  return accountClient.get<AdminWorldStats>('/admin/world/stats');
}

export async function adminUpdateWorldAsset(key: string, p: { nameZh?: string; tagsZh?: string; tagsEn?: string; category?: string; visibility?: string; status?: string; kindKey?: string }) {
  return accountClient.put<WorldAssetFull>(`/admin/world/assets/${encodeURIComponent(key)}`, p);
}

export async function adminDeleteWorldAsset(key: string, force = false) {
  await accountClient.delete(`/admin/world/assets/${encodeURIComponent(key)}`, { params: force ? { force: 1 } : undefined });
}

/** 创世五期:给还没有分档的已上架素材(和没抽精简档的大泼溅)排加工 */
export async function adminRelodWorldAssets(limit = 100) {
  return accountClient.post<{ queued: number; keys: string[] }>('/admin/world/assets/relod', undefined, { params: { limit } });
}

export async function adminRetryWorldAsset(key: string) {
  return accountClient.post<{ key: string; queued: boolean }>(`/admin/world/assets/${encodeURIComponent(key)}/retry`);
}

/** 目录里有、还没加工的素材:排进现做队列(每人每天 12 件),返回最新状态 */
export async function fetchWorldAsset(key: string): Promise<WorldAsset> {
  return accountClient.post<WorldAsset>(`/world/assets/${encodeURIComponent(key)}/fetch`);
}
