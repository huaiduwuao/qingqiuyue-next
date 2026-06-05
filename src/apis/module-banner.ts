// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface ModuleBannerItem {
  id: number;
  moduleId: number;
  moduleName?: string;
  title: string;
  subtitle?: string;
  link?: string;
  url?: string;
  type?: string;
  sort?: number;
  status?: string;
  updateTime?: string;
}

// Mock data
const mockBanners: ModuleBannerItem[] = [
  { id: 1, moduleId: 1, moduleName: '首页模块', title: 'Banner 1', subtitle: '副标题1', link: 'https://example.com/1', url: 'https://picsum.photos/200/100', sort: 1, updateTime: '2026-05-20T10:00:00Z' },
  { id: 2, moduleId: 1, moduleName: '首页模块', title: 'Banner 2', subtitle: '副标题2', link: 'https://example.com/2', url: 'https://picsum.photos/200/100', sort: 2, updateTime: '2026-05-21T10:00:00Z' },
  { id: 3, moduleId: 2, moduleName: '详情模块', title: 'Banner 3', subtitle: '副标题3', link: 'https://example.com/3', url: 'https://picsum.photos/200/100', sort: 3, updateTime: '2026-05-22T10:00:00Z' },
];

export async function page(params: { pageNumber?: number; pageSize?: number; moduleId?: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    let list = [...mockBanners];
    if (params.moduleId) {
      list = list.filter(b => b.moduleId === params.moduleId);
    }
    return {
      code: 200,
      success: true,
      data: { records: list, totalRow: list.length },
    };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/banner/page', { params });
}

export async function save(params: any) {
  await delay(300);
  if (MOCK_ENABLED) {
    const newItem: ModuleBannerItem = {
      id: mockBanners.length + 1,
      moduleId: params.moduleId,
      title: params.title,
      subtitle: params.subtitle,
      link: params.link,
      url: params.url,
      sort: params.sort || 0,
      updateTime: new Date().toISOString(),
    };
    mockBanners.unshift(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/banner', { method: 'POST', data: params });
}

export async function update(params: ModuleBannerItem) {
  await delay(300);
  if (MOCK_ENABLED) {
    const index = mockBanners.findIndex(b => b.id === params.id);
    if (index > -1) {
      mockBanners[index] = { ...mockBanners[index], ...params, updateTime: new Date().toISOString() };
    }
    return { code: 200, data: mockBanners[index] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient(`/module/banner/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockBanners.findIndex(b => b.id === id);
      if (index > -1) mockBanners.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/banner/removeByIds', { method: 'DELETE', data: ids });
}