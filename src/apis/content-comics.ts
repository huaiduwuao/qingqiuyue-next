import { contentClient } from '@/lib/api/client';

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 内容类型
export type ContentType = 'music' | 'novel' | 'video' | 'film' | 'teleplay' | 'animation' | 'comics' | 'article' | 'news' | 'picture-album' | 'picture-detail' | 'live' | 'website' | 'pan' | 'vshow' | 'animation-item' | 'teleplay-item' | 'comics-item' | 'film-item' | 'vshow-item';

// 通用内容项
export interface ContentItem {
  id: number;
  title?: string;
  name?: string;
  cover?: string;
  info?: string;
  content?: string;
  contentType?: string;
  status?: string;
  moduleContentStatus?: string;
  moduleContentId?: number;
  moduleContentPreviewId?: number;
  moduleContentSearch?: boolean;
  createUser?: number;
  createTime?: string;
  updateTime?: string;
  groupId?: number;
}

// 通用分页参数
export interface ContentPageParams {
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  current?: number;
  groupId?: number;
  status?: string;
  keyword?: string;
}

// Mock data for comics content type
const mockData: ContentItem[] = [
  { id: 1, title: "Comics Title 1", name: "Comics 1", cover: "https://example.com/comics1.jpg", info: "Comics info 1", content: "Comics content 1", contentType: "comics", status: "published", createUser: 1, createTime: "2024-01-01", updateTime: "2024-01-01", groupId: 1 },
  { id: 2, title: "Comics Title 2", name: "Comics 2", cover: "https://example.com/comics2.jpg", info: "Comics info 2", content: "Comics content 2", contentType: "comics", status: "published", createUser: 1, createTime: "2024-01-02", updateTime: "2024-01-02", groupId: 1 },
  { id: 3, title: "Comics Title 3", name: "Comics 3", cover: "https://example.com/comics3.jpg", info: "Comics info 3", content: "Comics content 3", contentType: "comics", status: "draft", createUser: 1, createTime: "2024-01-03", updateTime: "2024-01-03", groupId: 1 },
];

// 分页获取内容
export async function page(contentType: ContentType, params: ContentPageParams) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient(`client-content/${contentType}/page`, {
    method: 'GET',
    params,
  });
}

// 获取内容详情
export async function detail(contentType: ContentType, params: { id: number } | number) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  const id = typeof params === 'number' ? params : params.id;
  return contentClient(`client-content/${contentType}/detail`, {
    method: 'GET',
    params: { id },
  });
}

// 处理内容状态
export async function process(contentType: ContentType, params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient(`client-content/${contentType}/process`, {
    method: 'POST',
    data: params,
  });
}

// 保存或更新内容
export async function saveOrUpdate(contentType: ContentType, params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient(`client-content/${contentType}/saveOrUpdate`, {
    method: 'POST',
    data: params,
  });
}

// 更新并发布
export async function updateAndPublish(contentType: ContentType, params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient(`client-content/${contentType}/updateAndPublish`, {
    method: 'POST',
    data: params,
  });
}

// 删除内容
export async function remove(contentType: ContentType, ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient(`client-content/${contentType}/removeByIds`, {
    method: 'DELETE',
    data: ids,
  });
}

// Aliases
export const save = (contentType: ContentType, data: any) => saveOrUpdate(contentType, data);
export const update = (contentType: ContentType, data: any) => saveOrUpdate(contentType, data);
export const myPage = (contentType: ContentType, params: ContentPageParams) => page(contentType, params);
