import { contentClient } from '@/lib/api/client';

/**
 * 收藏夹类型
 * playlist: 歌单
 * album: 图集
 * topic: 专题
 * bookshelf: 书架
 */
export type MyListType = 'playlist' | 'album' | 'topic' | 'bookshelf';

// 收藏夹基本信息
export interface MyListItem {
  id: number;
  userId: number;
  name: string;
  description: string;
  coverUrl: string;
  type: MyListType;
  itemCount: number;
  totalViews: number;
  isPublic: boolean;
  createTime: string;
  updateTime: string;
}

// 收藏夹中的内容项
export interface MyListContentItem {
  id: number;
  contentId: number;
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

// 创建收藏夹
export async function createMyList(data: {
  name: string;
  description?: string;
  coverUrl?: string;
  type: MyListType;
  isPublic?: boolean;
}): Promise<{ ok: boolean; id: number }> {
  const res = await contentClient('/my-list', {
    method: 'POST',
    data,
  });
  return (res as any)?.data ?? res;
}

// 更新收藏夹
export async function updateMyList(
  id: number,
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
export async function deleteMyList(id: number): Promise<{ ok: boolean }> {
  const res = await contentClient(`/my-list/${id}`, {
    method: 'DELETE',
  });
  return (res as any)?.data ?? res;
}

// 获取收藏夹内容列表
export async function getMyListContent(listId: number): Promise<MyListContentResponse> {
  const res = await contentClient('/my-list/content/page', {
    params: { listId },
  });
  return (res as any)?.data ?? res;
}

// 添加内容到收藏夹
export async function addToMyList(
  listId: number,
  contentIds: number[]
): Promise<{ ok: boolean; added: number }> {
  const res = await contentClient('/my-list/content/add', {
    method: 'POST',
    data: { listId, contentIds },
  });
  return (res as any)?.data ?? res;
}

// 从收藏夹移除内容
export async function removeFromMyList(
  listId: number,
  contentId: number
): Promise<{ ok: boolean }> {
  const res = await contentClient('/my-list/content/remove', {
    method: 'POST',
    data: { listId, contentId },
  });
  return (res as any)?.data ?? res;
}

// 快捷收藏(自动归类到对应收藏夹)
export async function quickCollect(
  contentId: number,
  contentType: string
): Promise<{ ok: boolean; collected: boolean; listId?: number }> {
  const res = await contentClient('/quick-collect', {
    method: 'POST',
    data: { contentId, type: contentType },
  });
  return (res as any)?.data ?? res;
}

// 检查内容是否已收藏
export async function checkCollected(contentId: number): Promise<{ collected: boolean }> {
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
