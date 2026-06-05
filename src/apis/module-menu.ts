// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export interface ModuleMenuItem {
  id: number;
  moduleId: number;
  pid?: number | null;
  name: string;
  type: 'MENU' | 'PAGE';
  contentId?: number;
  children?: ModuleMenuItem[];
}

const mockMenuTree: ModuleMenuItem[] = [
  { id: 1, moduleId: 1, pid: null, name: '目录1', type: 'MENU', children: [
    { id: 2, moduleId: 1, pid: 1, name: '页面1', type: 'PAGE', contentId: 101 },
    { id: 3, moduleId: 1, pid: 1, name: '页面2', type: 'PAGE', contentId: 102 },
  ]},
  { id: 4, moduleId: 1, pid: null, name: '目录2', type: 'MENU', children: [
    { id: 5, moduleId: 1, pid: 4, name: '页面3', type: 'PAGE', contentId: 103 },
  ]},
  { id: 6, moduleId: 2, pid: null, name: '目录3', type: 'MENU' },
];

const mockMenus: ModuleMenuItem[] = [
  { id: 1, moduleId: 1, pid: null, name: '目录1', type: 'MENU' },
  { id: 2, moduleId: 1, pid: 1, name: '页面1', type: 'PAGE', contentId: 101 },
  { id: 3, moduleId: 1, pid: 1, name: '页面2', type: 'PAGE', contentId: 102 },
  { id: 4, moduleId: 1, pid: null, name: '目录2', type: 'MENU' },
  { id: 5, moduleId: 1, pid: 4, name: '页面3', type: 'PAGE', contentId: 103 },
  { id: 6, moduleId: 2, pid: null, name: '目录3', type: 'MENU' },
];

export async function clientTree(params: { moduleId: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: mockMenuTree };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/menu/clientTree', { params });
}

export async function list(params: { moduleId: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: mockMenus };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/menu/list', { params });
}

export async function save(params: { moduleId: number; name: string; pid?: number; type: string }) {
  await delay(300);
  if (MOCK_ENABLED) {
    const newItem: ModuleMenuItem = {
      id: mockMenus.length + 1,
      moduleId: params.moduleId,
      name: params.name,
      pid: params.pid,
      type: params.type as 'MENU' | 'PAGE',
    };
    mockMenus.push(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/menu', { method: 'POST', data: params });
}

export async function update(params: { id: number; name?: string; pid?: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    const item = mockMenus.find(m => m.id === params.id);
    if (item) {
      if (params.name) item.name = params.name;
      if (params.pid !== undefined) item.pid = params.pid;
    }
    return { code: 200, data: item };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient(`/module/menu/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockMenus.findIndex(m => m.id === id);
      if (index > -1) mockMenus.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/menu/removeByIds', { method: 'DELETE', data: ids });
}