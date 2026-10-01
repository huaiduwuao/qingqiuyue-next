// 文明图谱 API client。后端见 qingqiuyue-go internal/handler/civ.go。
//
// ⚠️ contentClient 的响应拦截器已经把 body.data 剥出来了,这里直接返回结果。
// 节点 key 可以直接当主题 key 用(/insight/theme、/insight/items、/insight/timeline 都认),
// 作品区与人生感悟共用 components/insight/ThemeWorks。

import { contentClient } from '@/lib/api/client';
import type { InsightBranchEvidence, InsightItem } from '@/apis/insight';

/** editorial = 编辑搭的支架;hot / search = 跟着热搜 / 搜索长出来的;user = 用户嫁接的 */
export type CivOrigin = 'editorial' | 'hot' | 'search' | 'user';
/** pending = 用户接的枝,站内作品还不够,等内容长出来 */
export type CivStatus = 'open' | 'pending' | 'closed' | 'blocked';

export interface CivNode {
  key: string;
  parent: string;
  /** 0 领域,1 门类,2 起是长出来的分支 */
  depth: number;
  domain: string;
  name: string;
  intro?: string;
  cues: string[];
  origin: CivOrigin;
  status: CivStatus;
  /** 站内相关作品数(非诗词) */
  works: number;
  heat: number;
  hotHits: number;
  searchUsers: number;
  lastSignal: number;
  openedAt: number;
  createdAt: number;
  headline?: string;
  hotCount?: number;
  /** 只在 map 的门类上:下面开着的分支数 */
  branches?: number;
  /** 只在 map 的分支预览上 */
  parentName?: string;
  /** 只在 node 的子节点上:它自己的子节点数 */
  children?: number;
}

export interface CivMap {
  /** 领域:works 是门类作品数之和;branches 是最近长出的分支(开着的) */
  domains: (Omit<CivNode, 'branches'> & { fields: CivNode[]; branches: CivNode[] })[];
  stats: { domains: number; fields: number; open: number; pending: number; grafted: number; works: number };
  /** 最近一轮热搜的归置:多少条、归了多少、哪些没地方挂 */
  round: { at: number; total: number; placed: number; harm: number; unplaced: InsightBranchEvidence[] };
}

export const civMap = (): Promise<CivMap> => contentClient.get('/civ/map');

export const civNode = (
  key: string,
): Promise<{
  node: CivNode;
  path: { key: string; name: string; depth: number }[];
  children: CivNode[];
  evidence: InsightBranchEvidence[];
  now: InsightItem[];
}> => contentClient.get('/civ/node', { params: { key } });

/** 在某个门类 / 分支下接一枝。要登录;名字与词过审核。 */
export const graft = (body: { parent: string; name: string; cues: string[]; intro?: string }): Promise<{ node: CivNode; existed?: boolean }> =>
  contentClient.post('/civ/graft', body);

/** 运营:封 / 解封节点 */
export const blockCiv = (key: string, block: boolean): Promise<{ key: string; status: string }> =>
  contentClient.post('/civ/block', { key, block });
