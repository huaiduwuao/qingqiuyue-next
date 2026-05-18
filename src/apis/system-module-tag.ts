import { contentClient } from '@/lib/api/client';

// 模块标签信息
export interface ModuleTagInfo {
  id: number;
  moduleId: number;
  name: string;
  color?: string;
}

// 获取模块标签
export async function getModuleTags(moduleId: number) {
  return contentClient<ModuleTagInfo[]>(`/module/tag/module/${moduleId}`, {
    method: 'GET',
  });
}

// 创建模块标签
export async function createModuleTag(data: any) {
  return contentClient<ModuleTagInfo>('/module/tag', {
    method: 'POST',
    data,
  });
}

// 删除模块标签
export async function deleteModuleTag(id: number) {
  return contentClient(`/module/tag/${id}`, {
    method: 'DELETE',
  });
}
