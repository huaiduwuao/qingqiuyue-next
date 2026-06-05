// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export interface ModuleSourceItem {
  id: number;
  groupId?: number;
  name: string;
  domain: string;
  url?: string;
  category: string[];
  updateTime?: string;
}

const mockSources: ModuleSourceItem[] = [
  { id: 1, groupId: 1, name: '来源1', domain: 'source1.com', url: 'https://source1.com', category: ['NOVEL', 'ARTICLE'], updateTime: '2026-05-20T10:00:00Z' },
  { id: 2, groupId: 1, name: '来源2', domain: 'source2.com', url: 'https://source2.com', category: ['VIDEO'], updateTime: '2026-05-21T10:00:00Z' },
  { id: 3, groupId: 2, name: '来源3', domain: 'source3.com', url: 'https://source3.com', category: ['MUSIC', 'FILM'], updateTime: '2026-05-22T10:00:00Z' },
];

export async function page(params: { pageNumber?: number; pageSize?: number; groupId?: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    let list = [...mockSources];
    if (params.groupId) list = list.filter(s => s.groupId === params.groupId);
    return { code: 200, success: true, data: { records: list, totalRow: list.length } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/moduleSource/client/page', { params });
}

export async function saveOrUpdate(params: ModuleSourceItem) {
  await delay(300);
  if (MOCK_ENABLED) {
    if (params.id) {
      const index = mockSources.findIndex(s => s.id === params.id);
      if (index > -1) mockSources[index] = { ...mockSources[index], ...params, updateTime: new Date().toISOString() };
      return { code: 200, data: mockSources[index] };
    }
    const newItem: ModuleSourceItem = {
      id: mockSources.length + 1,
      name: params.name,
      domain: params.domain,
      url: params.url,
      category: params.category,
      updateTime: new Date().toISOString(),
    };
    mockSources.unshift(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/moduleSource/client/saveOrUpdate', { method: 'POST', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockSources.findIndex(s => s.id === id);
      if (index > -1) mockSources.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/moduleSource/removeByIds', { method: 'DELETE', data: ids });
}