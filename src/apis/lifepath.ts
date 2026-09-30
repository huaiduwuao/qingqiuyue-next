// 心路 API client。后端见 qingqiuyue-go internal/handler/lifepath.go。
//
// ⚠️ contentClient 的响应拦截器已经把 body.data 剥出来了,这里直接返回结果。
// 全部要登录 —— 心路是自己的东西。五个维度是产品定的说法,不是心理学量表,
// 文案说「偏向哪一面」,不说「测出你是什么人」。

import { contentClient } from '@/lib/api/client';

export type LifeAxis = 'heart' | 'spine' | 'edge' | 'silence' | 'smile';

export const LIFE_AXES: LifeAxis[] = ['heart', 'spine', 'edge', 'silence', 'smile'];

export interface LifeAxisMeta {
  key: LifeAxis;
  name: string;
  hint: string;
}

export interface LifePathNode {
  id: number;
  kind: 'journey' | 'moment';
  axis: LifeAxis | '';
  feel: string;
  text: string;
  createdAt: number;
  scriptKey?: string;
  scriptTitle?: string;
  theme?: string;
  ending?: string;
  refType?: string;
  refId?: string;
}

export interface LifeProfile {
  axes: Record<LifeAxis, number>;
  nodes: number;
  public: boolean;
}

export interface LifePeer {
  userId: string;
  nickname: string;
  avatar: string;
  /** 侧写方向相似度 0..1 */
  sim: number;
  profile: LifeProfile;
  shared?: { scriptKey: string; ending: string; title?: string; endingTitle?: string }[];
}

export const axes = (): Promise<{ list: LifeAxisMeta[] }> => contentClient.get('/path/axes');

export const mine = (): Promise<{ list: LifePathNode[]; profile: LifeProfile; axesMeta: LifeAxisMeta[] }> =>
  contentClient.get('/path/mine');

export const addMoment = (body: { text: string; axis?: LifeAxis | ''; refType?: string; refId?: string }): Promise<LifePathNode> =>
  contentClient.post('/path/moment', body);

export const deleteNode = (id: number): Promise<{ id: number }> => contentClient.post('/path/node/delete', { id });

export const setVisibility = (pub: boolean): Promise<{ public: boolean }> =>
  contentClient.post('/path/visibility', { public: pub });

export const peers = (): Promise<{ list: LifePeer[]; reason: '' | 'empty' | 'private' }> => contentClient.get('/path/peers');
