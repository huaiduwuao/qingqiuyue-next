import { contentClient } from '@/lib/api/client';
import type { EntityId } from '@/lib/id';

/**
 * 收藏夹类型
 * playlist: 歌单
 * album: 图集
 * topic: 专题
 * bookshelf: 书架
 */
export type MyListType = 'playlist' | 'album' | 'topic' | 'bookshelf';

// 收藏夹基本信息
// 收藏夹存在 PostgreSQL(自增 id),里面的内容 id 是后端 idgen 发的 BIGINT(> 2^53),
// 响应里是字符串,调用这里的函数时原样回传,不要 Number()。见 lib/id.ts。
export interface MyListItem {
  id: EntityId;
  userId: number;
  name: string;
  description: string;
  coverUrl: string;
  /** 前几项的封面 —— 没单独设封面时拼宫格 */
  covers: string[];
  type: MyListType;
  itemCount: number;
  isPublic: boolean;
  /** 是不是当前登录用户自己的(别人公开的歌单只能看和播) */
  mine: boolean;
  /** 平台编排的歌单(internal/playlistcurator),没有作者,谁都改不了 */
  official?: boolean;
  /** 别人公开歌单的作者昵称(广场才给) */
  ownerName?: string;
  createTime: string;
  updateTime: string;
}

// 收藏夹中的内容项
export interface MyListContentItem {
  id: EntityId;
  contentId: EntityId;
  title: string;
  coverUrl: string;
  type: string;
  author: string;
  views: number;
  likes: number;
  addTime: string;
}

// 收藏夹列表响应
export interface MyListPageResponse {
  list: MyListItem[];
  total: number;
}

// 收藏夹内容响应
export interface MyListContentResponse {
  list: MyListContentItem[];
  total: number;
}

// 获取用户所有收藏夹列表
export async function getMyLists(listType?: MyListType): Promise<MyListPageResponse> {
  const params = listType ? { type: listType } : undefined;
  const res = await contentClient('/my-list/page', { params });
  return (res as any)?.data ?? res;
}

/**
 * 歌单广场:平台编排的歌单 + 用户设为公开的歌单,不需要登录。
 *
 * 首页频道的「歌单」候选、音乐频道的歌单架、/playlist 的「发现」都读这里。
 * 空歌单不会出现在广场上(后端过滤)。
 */
export async function getPublicLists(params: {
  type?: MyListType;
  keyword?: string;
  sort?: 'hot' | 'new';
  /** 只要平台编排的 */
  official?: boolean;
  page?: number;
  size?: number;
} = {}): Promise<MyListPageResponse & { page: number; size: number }> {
  const res = await contentClient('/my-list/square', {
    params: {
      type: params.type ?? 'playlist',
      ...(params.keyword ? { keyword: params.keyword } : {}),
      ...(params.sort ? { sort: params.sort } : {}),
      ...(params.official ? { official: 1 } : {}),
      page: params.page ?? 1,
      size: params.size ?? 24,
    },
  });
  return (res as any)?.data ?? res;
}

// 单个收藏夹(自己的,或别人公开的)
export async function getMyListDetail(id: EntityId): Promise<MyListItem> {
  const res = await contentClient('/my-list/detail', { params: { id } });
  return (res as any)?.data ?? res;
}

// 创建收藏夹;带 contentIds 可一步建好(「把播放队列存为歌单」)
export async function createMyList(data: {
  name: string;
  description?: string;
  coverUrl?: string;
  type: MyListType;
  isPublic?: boolean;
  contentIds?: EntityId[];
}): Promise<{ ok: boolean; id: EntityId; added: number }> {
  const res = await contentClient('/my-list', {
    method: 'POST',
    data,
  });
  return (res as any)?.data ?? res;
}

// 更新收藏夹
export async function updateMyList(
  id: EntityId,
  data: {
    name?: string;
    description?: string;
    coverUrl?: string;
    isPublic?: boolean;
  }
): Promise<{ ok: boolean }> {
  const res = await contentClient(`/my-list/${id}`, {
    method: 'PUT',
    data,
  });
  return (res as any)?.data ?? res;
}

// 删除收藏夹
export async function deleteMyList(id: EntityId): Promise<{ ok: boolean }> {
  const res = await contentClient(`/my-list/${id}`, {
    method: 'DELETE',
  });
  return (res as any)?.data ?? res;
}

// 获取收藏夹内容列表
export async function getMyListContent(listId: EntityId): Promise<MyListContentResponse> {
  const res = await contentClient('/my-list/content/page', {
    params: { listId },
  });
  return (res as any)?.data ?? res;
}

// 添加内容到收藏夹
export async function addToMyList(
  listId: EntityId,
  contentIds: EntityId[]
): Promise<{ ok: boolean; added: number }> {
  const res = await contentClient('/my-list/content/add', {
    method: 'POST',
    data: { listId, contentIds },
  });
  return (res as any)?.data ?? res;
}

// 从收藏夹移除内容
export async function removeFromMyList(
  listId: EntityId,
  contentId: EntityId
): Promise<{ ok: boolean }> {
  const res = await contentClient('/my-list/content/remove', {
    method: 'POST',
    data: { listId, contentId },
  });
  return (res as any)?.data ?? res;
}

// 调整顺序:contentIds 是排好之后的完整顺序
export async function reorderMyList(listId: EntityId, contentIds: EntityId[]): Promise<{ ok: boolean }> {
  const res = await contentClient('/my-list/content/reorder', {
    method: 'POST',
    data: { listId, contentIds },
  });
  return (res as any)?.data ?? res;
}

// 快捷收藏(自动归类到对应收藏夹)
export async function quickCollect(
  contentId: EntityId,
  contentType: string
): Promise<{ ok: boolean; collected: boolean; listId?: EntityId }> {
  const res = await contentClient('/quick-collect', {
    method: 'POST',
    data: { contentId, type: contentType },
  });
  return (res as any)?.data ?? res;
}

// 检查内容是否已收藏
export async function checkCollected(contentId: EntityId): Promise<{ collected: boolean }> {
  const res = await contentClient('/is-collected', {
    params: { contentId },
  });
  return (res as any)?.data ?? res;
}

// 收藏夹类型对应的默认名称
export const LIST_TYPE_NAMES: Record<MyListType, string> = {
  playlist: '我的歌单',
  album: '我的图集',
  topic: '我的专题',
  bookshelf: '我的书架',
};

// 收藏夹类型对应的图标
export const LIST_TYPE_ICONS: Record<MyListType, string> = {
  playlist: '🎵',
  album: '🖼️',
  topic: '📌',
  bookshelf: '📚',
};
