import { contentClient } from '@/lib/api/client';

// 数据的全部读 Doris module_content,Phase 3 启用后,24 类均有真实数据
// GET /api/content/home/hot?type=&size=&genre=   某类型的热门 topN(可选 genre 子分类)
export interface HotItem {
  id: number;
  title: string;
  cover?: string;
  category: string;
  source?: string;
  views?: number;
  likes?: number;
  author?: string;
  createdAt?: string;
}

export async function fetchHot(params: { type?: string; size?: number; genre?: string } = {}) {
  return contentClient('/home/hot', { params });
}

// GET /api/content/recommend/feed?types=&size=&genre=&page=   多类型混合推荐(可选 genre 子分类)
export async function fetchRecommend(params: { types?: string; size?: number; genre?: string; page?: number } = {}) {
  // 直接调用本地的 API route（会自动包装并添加 sourceUrl）
  const resp = await fetch(`/api/content/recommend/feed?${new URLSearchParams(params as Record<string, string>).toString()}`, {
    cache: 'no-store',
  });
  return resp.json();
}

// GET /api/content/home/detail?id=   单条详情 catch-all(供详情页)
export async function fetchDetailByID(id: number) {
  return contentClient('/home/detail', { params: { id } });
}

// =================== 数据字典:子分类(题材) ===================
// 推荐流二级分类:选了"小说"后,前端拿到 NOVEL 的子分类(奇幻/仙侠/...);
// 选了"电影"则拿到 FILM 的子分类(动作/喜剧/爱情/...)。全部从 Doris 字典表读。
export interface SubcategoryItem {
  id: number;
  parentType: string;   // NOVEL/FILM/COMICS/...
  code: string;         // fantasy/xianxia/...
  name: string;         // 奇幻/仙侠/...
  sort: number;
}

// 拉单个父类下的子分类(parent=ALL 返回全部分组)
export async function fetchSubcategories(parent: string = 'all') {
  return contentClient('/dict/subcategory', { params: { parent } });
}

// =================== 筛选条件配置(可维护) ===================

// 内容类型大类:前端 SECTIONS/tab、搜索类型下拉的选项来源,后台可维护。
export interface ContentTypeItem {
  id: number;
  name: string;   // 电影/电视剧/动漫...
  code: string;   // FILM/TELEPLAY/...
  icon?: string;
  color?: string;
  sort: number;
}

// GET /api/content/dict/types —— 启用类型列表
export async function fetchContentTypes() {
  return contentClient('/dict/types');
}

// 动态筛选聚合项(演员/歌手/导演从内容 metadata 自动聚合,按频次降序)
export interface FacetItem {
  name: string;
  count: number;
}

// GET /api/content/dict/facets?type=&field=&limit=
// field: cast(演员)/director(导演)/artist(歌手)/album(专辑)/author(作者)/genre(类型)
export async function fetchFacets(params: { type?: string; field?: string; limit?: number } = {}) {
  return contentClient('/dict/facets', { params });
}