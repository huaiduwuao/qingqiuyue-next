import { adminClient } from '@/lib/api/client';

// 规则信息
export interface RuleInfo {
  id: number;
  name: string;
  type?: string;
  content?: string;
  status?: number;
  createTime?: string;
}

// 规则查询参数
export interface RuleQuery {
  page?: number;
  pageSize?: number;
}

// 规则列表响应
export interface RuleListResp {
  list: RuleInfo[];
  total: number;
}

// 获取规则列表
export async function listRules(params?: RuleQuery) {
  return adminClient<RuleListResp>('/rule/list', {
    method: 'GET',
    params,
  });
}

// 获取规则详情
export async function getRule(id: number) {
  return adminClient<RuleInfo>(`/api/rule/${id}`, {
    method: 'GET',
  });
}

// 创建规则
export async function createRule(data: any) {
  return adminClient<RuleInfo>('/rule', {
    method: 'POST',
    data,
  });
}

// 更新规则
export async function updateRule(id: number, data: any) {
  return adminClient<RuleInfo>(`/api/rule/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除规则
export async function deleteRule(id: number) {
  return adminClient(`/api/rule/${id}`, {
    method: 'DELETE',
  });
}
