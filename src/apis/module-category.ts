// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export interface ModuleCategoryItem {
  id: number;
  moduleId: number;
  title: string;
  subtitle?: string;
  contentUrl?: string;
  url?: string;
  sort?: number;
  updateTime?: string;
}

const mockCategories: ModuleCategoryItem[] = [
  { id: 1, moduleId: 1, title: '分类1', subtitle: '副标题1', contentUrl: 'https://example.com/1', url: 'https://picsum.photos/100/100', sort: 1, updateTime: '2026-05-20T10:00:00Z' },
  { id: 2, moduleId: 1, title: '分类2', subtitle: '副标题2', contentUrl: 'https://example.com/2', url: 'https://picsum.photos/100/100', sort: 2, updateTime: '2026-05-21T10:00:00Z' },
  { id: 3, moduleId: 2, title: '分类3', subtitle: '副标题3', contentUrl: 'https://example.com/3', url: 'https://picsum.photos/100/100', sort: 3, updateTime: '2026-05-22T10:00:00Z' },
];

export async function page(params: { pageNumber?: number; pageSize?: number; moduleId?: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    let list = [...mockCategories];
    if (params.moduleId) {
      list = list.filter(c => c.moduleId === params.moduleId);
    }
    return { code: 200, success: true, data: { records: list, totalRow: list.length } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/category/page', { params });
}

export async function save(params: any) {
  await delay(300);
  if (MOCK_ENABLED) {
    const newItem: ModuleCategoryItem = {
      id: mockCategories.length + 1,
      moduleId: params.moduleId,
      title: params.title,
      subtitle: params.subtitle,
      contentUrl: params.contentUrl,
      url: params.url,
      sort: params.sort || 0,
      updateTime: new Date().toISOString(),
    };
    mockCategories.unshift(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/category', { method: 'POST', data: params });
}

export async function update(params: ModuleCategoryItem) {
  await delay(300);
  if (MOCK_ENABLED) {
    const index = mockCategories.findIndex(c => c.id === params.id);
    if (index > -1) {
      mockCategories[index] = { ...mockCategories[index], ...params, updateTime: new Date().toISOString() };
    }
    return { code: 200, data: mockCategories[index] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient(`/module/category/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockCategories.findIndex(c => c.id === id);
      if (index > -1) mockCategories.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/category/removeByIds', { method: 'DELETE', data: ids });
}