// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export interface ModuleTemplateItem {
  id: number;
  sourceId?: number;
  type?: string;
  category?: string;
  name?: string;
  attrs?: any[];
  updateTime?: string;
}

const mockTemplates: ModuleTemplateItem[] = [
  { id: 1, sourceId: 1, type: 'NOVEL', category: '小说', name: '模板1', attrs: [], updateTime: '2026-05-20T10:00:00Z' },
  { id: 2, sourceId: 1, type: 'VIDEO', category: '视频', name: '模板2', attrs: [], updateTime: '2026-05-21T10:00:00Z' },
  { id: 3, sourceId: 2, type: 'MUSIC', category: '音乐', name: '模板3', attrs: [], updateTime: '2026-05-22T10:00:00Z' },
];

export async function list(params: { sourceId?: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    let list = [...mockTemplates];
    if (params.sourceId) list = list.filter(t => t.sourceId === params.sourceId);
    return { code: 200, success: true, data: list };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/template/list', { params });
}

export async function itemList(params: { templateId: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    const template = mockTemplates.find(t => t.id === params.templateId);
    return { code: 200, success: true, data: template?.attrs || [] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/template/itemList', { params });
}

export async function saveOrUpdate(params: ModuleTemplateItem) {
  await delay(300);
  if (MOCK_ENABLED) {
    if (params.id) {
      const index = mockTemplates.findIndex(t => t.id === params.id);
      if (index > -1) mockTemplates[index] = { ...mockTemplates[index], ...params, updateTime: new Date().toISOString() };
      return { code: 200, data: mockTemplates[index] };
    }
    const newItem: ModuleTemplateItem = {
      id: mockTemplates.length + 1,
      sourceId: params.sourceId,
      type: params.type,
      category: params.category,
      name: params.name,
      attrs: [],
      updateTime: new Date().toISOString(),
    };
    mockTemplates.unshift(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/template', { method: 'POST', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockTemplates.findIndex(t => t.id === id);
      if (index > -1) mockTemplates.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/template/removeByIds', { method: 'DELETE', data: ids });
}