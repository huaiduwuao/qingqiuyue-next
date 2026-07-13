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

// GET /api/content/home/recommend?types=&size=&genre=   多类型混合推荐(可选 genre 子分类)
export async function fetchRecommend(params: { types?: string; size?: number; genre?: string } = {}) {
  return contentClient('/home/recommend', { params });
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