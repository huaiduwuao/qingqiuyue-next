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
  status: 'ready' | 'processing' | 'available' | 'failed';
  /** qq-media/world 下的相对路径(models/xxx.glb) */
  file: string;
  height: number;
  footprint: number;
  isSet?: boolean;
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
