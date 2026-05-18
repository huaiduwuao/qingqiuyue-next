import { contentClient } from '@/lib/api/client';

// 模块信息
export interface ModuleInfo {
  id: number;
  name: string;
  code?: string;
  description?: string;
  status?: number;
}

// 模块查询参数
export interface ModuleQuery {
  page?: number;
  pageSize?: number;
}

// 模块列表响应
export interface ModuleListResp {
  list: ModuleInfo[];
  total: number;
}

// 获取模块列表 - GET /api/content/module/list
export async function listModules(params?: ModuleQuery) {
  return contentClient<ModuleListResp>('/module/list', {
    method: 'GET',
    params,
  });
}

// 获取模块详情 - GET /api/content/module/{id}
export async function getModule(id: number) {
  return contentClient<ModuleInfo>(`/module/${id}`, {
    method: 'GET',
  });
}

// 创建模块 - POST /api/content/module
export async function createModule(data: any) {
  return contentClient<ModuleInfo>('/module', {
    method: 'POST',
    data,
  });
}

// 更新模块 - PUT /api/content/module/{id}
export async function updateModule(id: number, data: any) {
  return contentClient<ModuleInfo>(`/module/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除模块 - DELETE /api/content/module/{id}
export async function deleteModule(id: number) {
  return contentClient(`/module/${id}`, {
    method: 'DELETE',
  });
}
