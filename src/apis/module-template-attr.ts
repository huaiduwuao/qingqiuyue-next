// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export interface ModuleTemplateAttrItem {
  id: number;
  templateId: number;
  name: string;
  type?: string;
  code?: string;
  remark?: string;
  updateTime?: string;
}

const mockAttrs: ModuleTemplateAttrItem[] = [
  { id: 1, templateId: 1, name: '属性1', type: 'string', code: 'attr1', remark: '备注1', updateTime: '2026-05-20T10:00:00Z' },
  { id: 2, templateId: 1, name: '属性2', type: 'number', code: 'attr2', remark: '备注2', updateTime: '2026-05-21T10:00:00Z' },
  { id: 3, templateId: 2, name: '属性3', type: 'boolean', code: 'attr3', remark: '备注3', updateTime: '2026-05-22T10:00:00Z' },
];

export async function page(params: { pageNumber?: number; pageSize?: number; templateId: number }) {
  await delay(300);
  if (MOCK_ENABLED) {
    let list = mockAttrs.filter(a => a.templateId === params.templateId);
    return { code: 200, success: true, data: { records: list, totalRow: list.length } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/template/attr/page', { params });
}

export async function save(params: any) {
  await delay(300);
  if (MOCK_ENABLED) {
    const newItem: ModuleTemplateAttrItem = {
      id: mockAttrs.length + 1,
      templateId: params.templateId,
      name: params.name,
      type: params.type,
      code: params.code,
      remark: params.remark,
      updateTime: new Date().toISOString(),
    };
    mockAttrs.unshift(newItem);
    return { code: 200, data: newItem };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/template/attr', { method: 'POST', data: params });
}

export async function update(params: ModuleTemplateAttrItem) {
  await delay(300);
  if (MOCK_ENABLED) {
    const index = mockAttrs.findIndex(a => a.id === params.id);
    if (index > -1) mockAttrs[index] = { ...mockAttrs[index], ...params, updateTime: new Date().toISOString() };
    return { code: 200, data: mockAttrs[index] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient(`/module/template/attr/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  await delay(300);
  if (MOCK_ENABLED) {
    ids.forEach(id => {
      const index = mockAttrs.findIndex(a => a.id === id);
      if (index > -1) mockAttrs.splice(index, 1);
    });
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient('/module/template/attr/removeByIds', { method: 'DELETE', data: ids });
}