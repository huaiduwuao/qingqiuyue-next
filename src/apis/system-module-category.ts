import { contentClient } from '@/lib/api/client';

// 模块分类信息
export interface ModuleCategoryInfo {
  id: number;
  moduleId: number;
  name: string;
  sort?: number;
  status?: number;
}

// 获取模块分类
export async function getModuleCategories(moduleId: number) {
  return contentClient<ModuleCategoryInfo[]>(`/module/category/module/${moduleId}`, {
    method: 'GET',
  });
}

// 创建模块分类
export async function createModuleCategory(data: any) {
  return contentClient<ModuleCategoryInfo>('/module/category', {
    method: 'POST',
    data,
  });
}

// 更新模块分类
export async function updateModuleCategory(id: number, data: any) {
  return contentClient<ModuleCategoryInfo>(`/module/category/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除模块分类
export async function deleteModuleCategory(id: number) {
  return contentClient(`/module/category/${id}`, {
    method: 'DELETE',
  });
}
