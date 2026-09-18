import { homeClient } from '@/lib/api/client';

/**
 * 筛选器目录 —— 由后端按当前库存现算,前端不再写死任何分类知识。
 *
 * 以前这些常量写在各个面板里:放映厅写死 6 个地区、7 个年份、4 档评分,
 * 短剧写死 6 个题材。问题不是"要维护两份",而是那两份和库里的内容对不上 ——
 * 前端列了"韩国"(库里 5 条)却没列"英国"(库里 37 条),点进去是空的,
 * 用户读到的是"这站没内容"。
 *
 * 现在每一项都带 count,一条都没有的项后端根本不返回。
 */
export type FacetOption = {
  /** 提交回后端的值。题材/地区是归一化码,年份是 "2025" 或 "-2019"(及以前)。 */
  value: string;
  label: string;
  count: number;
};

export type FacetCatalog = {
  categories: FacetOption[];
  genres: FacetOption[];
  regions: FacetOption[];
  years: FacetOption[];
  ratings: FacetOption[];
  total: number;
};

const EMPTY: FacetCatalog = {
  categories: [],
  genres: [],
  regions: [],
  years: [],
  ratings: [],
  total: 0,
};

/**
 * 取某个面板的筛选器目录。
 *
 * @param scope  'theater' | 'drama' | 单个 contentType(如 'NOVEL')
 * @param category  放映厅的当前分类;传了就只统计该分类下的可选项
 */
export async function getFacets(scope: string, category?: string): Promise<FacetCatalog> {
  const params = new URLSearchParams({ scope });
  if (category && category !== 'all') params.set('category', category);
  const data = await homeClient
    .get<FacetCatalog>(`/facets?${params.toString()}`)
    .then((r) => r)
    .catch(() => null);
  // 目录拿不到时退回空目录而不是抛错:筛选器少一排,总比整个面板白屏好。
  return data ? { ...EMPTY, ...data } : EMPTY;
}
