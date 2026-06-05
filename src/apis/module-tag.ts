// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export interface ModuleTagItem {
  id: number;
  moduleId: number;
  title: string;
  sort?: number;
  updateTime?: string;
}

const mockTags: ModuleTagItem[] = [
  { id: 1, moduleId: 1, title: '标签1', sort: 1, updateTime: '2026-05-20T10:00:00Z' },
  { id: 2, moduleId: 1, title: '标签2', sort: 2, updateTime: '2026-05-21T10:00:00Z' },
  { id: 3, moduleId: 2, title: '标签3', sort: 3, updateTime: '2026-05-22T10:00:00Z' },
  { id: 4, moduleId: 1, title: '标签4', sort: 4, updateTime: '2026-05-23T10:00:00Z' },
];

export async function page(params: { pageNumber?: number; pageSize?: number; moduleId?: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    let list = [...mockTags];
    if (params.moduleId) list = list.filter(t => t.moduleId === params.moduleId);
    return { code: 200, success: true, data: { records: list, totalRow: list.length } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/tag/page', { params });
}

export async function save(params: any) {
  await delay(300);
  if (MOCK_ENABLED) {
    const newItem: ModuleTagItem = {
      id: mockTags.length + 1,
      moduleId: params.moduleId,
      title: params.title,
      sort: params.sort || 0,
      updateTime: new Date().toISOString(),
    };
    mockTags.unshift(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/tag', { method: 'POST', data: params });
}

export async function update(params: ModuleTagItem) {
  await delay(300);
  if (MOCK_ENABLED) {
    const index = mockTags.findIndex(t => t.id === params.id);
    if (index > -1) mockTags[index] = { ...mockTags[index], ...params, updateTime: new Date().toISOString() };
    return { code: 200, data: mockTags[index] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient(`/module/tag/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockTags.findIndex(t => t.id === id);
      if (index > -1) mockTags.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/tag/removeByIds', { method: 'DELETE', data: ids });
}