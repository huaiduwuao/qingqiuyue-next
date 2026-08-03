import { contentClient } from '@/lib/api/client';

// 后台筛选条件维护:类型大类 + 题材子分类 CRUD
// 走 content-api /api/content/dict/*(与 C 端面板同一套字典)。

// ===== 类型大类(module_content_type) =====
export interface ContentTypeRow {
  id: number;
  name: string;
  code: string;
  icon?: string;
  color?: string;
  sort: number;
  status: number;
}

export async function pageContentTypes(params: { page?: number; pageSize?: number } = {}) {
  return contentClient('/dict/type/page', { params });
}

export async function saveContentType(body: Partial<ContentTypeRow>) {
  return contentClient('/dict/type/saveOrUpdate', { method: 'POST', data: body });
}

export async function removeContentTypes(ids: number[]) {
  return contentClient('/dict/type/removeByIds', { method: 'DELETE', data: { ids } });
}

// ===== 题材子分类(module_subcategory) =====
export interface SubcategoryRow {
  id: number;
  parentType: string;
  code: string;
  name: string;
  sort: number;
  status: number;
}

export async function pageSubcategories(params: { page?: number; pageSize?: number; parentType?: string } = {}) {
  return contentClient('/dict/subcategory/page', { params });
}

export async function saveSubcategory(body: Partial<SubcategoryRow>) {
  return contentClient('/dict/subcategory/saveOrUpdate', { method: 'POST', data: body });
}

export async function removeSubcategories(ids: number[]) {
  return contentClient('/dict/subcategory/removeByIds', { method: 'DELETE', data: { ids } });
}
