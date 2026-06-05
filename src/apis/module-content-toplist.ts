// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export interface ModuleContentToplist {
  id: number;
  groupId: number;
  title: string;
  subtitle?: string;
  type: string;
  updateTime?: string;
}

const mockToplists: ModuleContentToplist[] = [
  { id: 1, groupId: 1, title: '榜单1', subtitle: '副标题1', type: 'VIDEO', updateTime: '2026-05-20T10:00:00Z' },
  { id: 2, groupId: 1, title: '榜单2', subtitle: '副标题2', type: 'NOVEL', updateTime: '2026-05-21T10:00:00Z' },
  { id: 3, groupId: 2, title: '榜单3', subtitle: '副标题3', type: 'FILM', updateTime: '2026-05-22T10:00:00Z' },
];

export async function myPage(params: { pageNumber?: number; pageSize?: number; groupId?: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    let list = [...mockToplists];
    if (params.groupId) list = list.filter(t => t.groupId === params.groupId);
    return { code: 200, success: true, data: { records: list, totalRow: list.length } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/toplist/myPage', { params });
}

export async function save(params: any) {
  await delay(300);
  if (MOCK_ENABLED) {
    const newItem: ModuleContentToplist = {
      id: mockToplists.length + 1,
      groupId: params.groupId,
      title: params.title,
      subtitle: params.subtitle,
      type: params.type,
      updateTime: new Date().toISOString(),
    };
    mockToplists.unshift(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/toplist', { method: 'POST', data: params });
}

export async function update(params: ModuleContentToplist) {
  await delay(300);
  if (MOCK_ENABLED) {
    const index = mockToplists.findIndex(t => t.id === params.id);
    if (index > -1) mockToplists[index] = { ...mockToplists[index], ...params, updateTime: new Date().toISOString() };
    return { code: 200, data: mockToplists[index] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient(`/module/toplist/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockToplists.findIndex(t => t.id === id);
      if (index > -1) mockToplists.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/toplist/removeByIds', { method: 'DELETE', data: ids });
}

export async function sync(params: { id: number; type: string }) {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: ['同步项1', '同步项2', '同步项3'] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient(`/module/toplist/${params.id}/sync`, { method: 'POST', data: params });
}

export async function addItem(params: { topListId: number; contentType: string; title: string }) {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/toplist/item', { method: 'POST', data: params });
}