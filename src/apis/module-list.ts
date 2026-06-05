// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export interface ModuleItem {
  id: number;
  groupId?: number;
  title: string;
  subtitle?: string;
  icon?: string;
  templateCode?: string;
  type?: string;
  sort?: number;
  search?: boolean;
  updateTime?: string;
}

const mockModules: ModuleItem[] = [
  { id: 1, groupId: 1, title: '模块1', subtitle: '副标题1', icon: 'icon1', templateCode: 'T1', type: '1', sort: 1, search: true, updateTime: '2026-05-20T10:00:00Z' },
  { id: 2, groupId: 1, title: '模块2', subtitle: '副标题2', icon: 'icon2', templateCode: 'T2', type: '2', sort: 2, search: true, updateTime: '2026-05-21T10:00:00Z' },
  { id: 3, groupId: 2, title: '模块3', subtitle: '副标题3', icon: 'icon3', templateCode: 'T3', type: '1', sort: 3, search: false, updateTime: '2026-05-22T10:00:00Z' },
];

export async function myPage(params: { pageNumber?: number; pageSize?: number; type?: string; groupId?: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    let list = [...mockModules];
    if (params.type) list = list.filter(m => m.type === params.type);
    if (params.groupId) list = list.filter(m => m.groupId === params.groupId);
    return { code: 200, success: true, data: { records: list, totalRow: list.length } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/list/myPage', { params });
}

export async function save(params: any) {
  await delay(300);
  if (MOCK_ENABLED) {
    const newItem: ModuleItem = {
      id: mockModules.length + 1,
      groupId: params.groupId,
      title: params.title,
      subtitle: params.subtitle,
      icon: params.icon,
      templateCode: params.templateCode,
      type: params.type,
      sort: params.sort || 0,
      updateTime: new Date().toISOString(),
    };
    mockModules.unshift(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/list', { method: 'POST', data: params });
}

export async function update(params: ModuleItem) {
  await delay(300);
  if (MOCK_ENABLED) {
    const index = mockModules.findIndex(m => m.id === params.id);
    if (index > -1) mockModules[index] = { ...mockModules[index], ...params, updateTime: new Date().toISOString() };
    return { code: 200, data: mockModules[index] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient(`/module/list/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockModules.findIndex(m => m.id === id);
      if (index > -1) mockModules.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/list/removeByIds', { method: 'DELETE', data: ids });
}