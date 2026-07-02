import { rewardClient } from '@/lib/api/client';
import type { ProjectItem } from '@/beans/reward';

// 项目信息(API 返回的完整字段 = ProjectItem 视图的全部可选字段)
export interface ProjectInfo extends ProjectItem {
  id: number;
  name: string;
  description?: string;
}

// 项目查询参数
export interface ProjectQuery {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  status?: string;
  groupId?: number;
}

// 项目列表响应
export interface ProjectListResp {
  list: ProjectInfo[];
  records?: ProjectInfo[];
  total: number;
  totalRow?: number;
  data?: ProjectListResp;
  success?: boolean;
}

// 获取项目列表
export async function listProjects(params?: ProjectQuery) {
  return rewardClient<ProjectListResp>('/project/client/page', {
    method: 'GET',
    params,
  });
}

// 分页获取项目 (page alias)
export const projectPage = (params?: ProjectQuery) => listProjects(params);

// 获取项目详情
export async function getProject(id: number) {
  return rewardClient<ProjectInfo>(`/project/${id}`, {
    method: 'GET',
  });
}

// 创建项目
export async function createProject(data: unknown) {
  return rewardClient<ProjectInfo>('/project', {
    method: 'POST',
    data,
  });
}

// 更新项目
export async function updateProject(id: number, data: unknown) {
  return rewardClient<ProjectInfo>(`/project/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除项目
export async function deleteProject(id: number) {
  return rewardClient(`/project/${id}`, {
    method: 'DELETE',
  });
}

// Aliases for missing exports
export const myPage = listProjects;
export const projectDetail = (params: { id: number } | number) => {
  if (typeof params === 'number') {
    return getProject(params);
  }
  return getProject(params.id);
};

// Wrapper for remove that accepts an array or single id
export const remove = (ids: number | number[]) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  return deleteProject(id);
};

// Wrapper for save that accepts an object
export const save = (data: unknown) => createProject(data);

// Wrapper for update that accepts an object with id
export const update = (data: { id?: number; _id?: number } & Record<string, unknown>) => {
  if (data.id) {
    return updateProject(data.id, data as any);
  }
  return updateProject(data._id!, data as any);
};
