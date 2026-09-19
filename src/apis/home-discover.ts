import { contentClient } from '@/lib/api/client';
import { API_PREFIX } from '@/lib/api/prefix';

// 数据的全部读 Doris module_content,Phase 3 启用后,24 类均有真实数据
// (站内热度榜 /home/hot 已并入排行榜,见 apis/leaderboard.ts)

// 推荐流(fetchRecommend)与详情 related 的列表项形状。
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

// GET /api/content/recommend/feed?types=&size=&genre=&page=   多类型混合推荐(可选 genre 子分类)
export async function fetchRecommend(params: { types?: string; size?: number; genre?: string; page?: number; watchable?: 1 } = {}) {
  // 走同源 /api/content/*,由 nginx / APISIX 转发到 content-api。
  // (这里曾经打的是 Next.js 侧的同名 route.ts —— 那个代理层在前端改成静态
  //  导出时就删掉了,拼装 sourceUrl 和播放性判定现在都在 Go 侧完成。)
  const resp = await fetch(API_PREFIX + `/api/content/recommend/feed?${new URLSearchParams(params as Record<string, string>).toString()}`, {
    cache: 'no-store',
  });
  const body = await resp.json().catch(() => null);
  // 裸 fetch 没有拦截器帮忙剥壳,这里自己剥:调用方一律拿到业务数据层,和其它 api 同口径。
  return body && typeof body === 'object' && 'code' in body && 'data' in body ? body.data : body;
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

// =================== 标签聚合(自定义频道候选) ===================
// GET /api/content/dict/tags?type=&limit=  出现最多的内容标签,按频次降序。
// 返回两份:list = 话题标签(剧情/都市/搞笑…),sources = 来源名(QQ音乐/B站番剧…)。
// 标签行里出现最多的其实是来源,混在一起会把话题挤没,所以后端分开返回。
// 首页「频道管理」用它列出可以直接加成频道的标签;取内容时都对应 ?tag=。
// 不用 facets?field=genre:那一列存的是逗号串,JSON_CONTAINS 查不出东西。
export async function fetchContentTags(params: { type?: string; limit?: number } = {}) {
  return contentClient('/dict/tags', { params });
}