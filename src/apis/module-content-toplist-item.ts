// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export interface ModuleContentToplistItem {
  id: number;
  toplistId: number;
  moduleContentId: number;
  title: string;
  subtitle?: string;
  updateTime?: string;
  content?: any;
}

const mockToplistItems: ModuleContentToplistItem[] = [
  { id: 1, toplistId: 1, moduleContentId: 1, title: '榜单条目1', subtitle: '副标题1', updateTime: '2026-05-20T10:00:00Z', content: { title: '内容1' } },
  { id: 2, toplistId: 1, moduleContentId: 2, title: '榜单条目2', subtitle: '副标题2', updateTime: '2026-05-21T10:00:00Z', content: { title: '内容2' } },
  { id: 3, toplistId: 2, moduleContentId: 3, title: '榜单条目3', subtitle: '副标题3', updateTime: '2026-05-22T10:00:00Z', content: { title: '内容3' } },
];

export async function page(params: { pageNumber?: number; pageSize?: number; toplistId: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    let list = mockToplistItems.filter(t => t.toplistId === params.toplistId);
    return { code: 200, success: true, data: { records: list, totalRow: list.length } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/toplist/item/page', { params });
}

export async function save(params: { moduleContentId: number; toplistId: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    const newItem: ModuleContentToplistItem = {
      id: mockToplistItems.length + 1,
      toplistId: params.toplistId,
      moduleContentId: params.moduleContentId,
      title: `条目${mockToplistItems.length + 1}`,
      updateTime: new Date().toISOString(),
    };
    mockToplistItems.unshift(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/toplist/item', { method: 'POST', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockToplistItems.findIndex(t => t.id === id);
      if (index > -1) mockToplistItems.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/toplist/item/removeByIds', { method: 'DELETE', data: ids });
}