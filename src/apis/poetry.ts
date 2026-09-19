// 诗词频道 API client。后端见 internal/handler/poetry.go。
//
// ⚠️ contentClient 的响应拦截器已经把 body.data 剥出来了 —— 这里直接返回结果,
// 不要再 .data 一层(诗词详情页就是这么白过一次的)。

import { contentClient } from '@/lib/api/client';

/** 朝代 / 体裁 / 词牌 / 意象 的计数项,后端统一用这个形状。 */
export interface FacetItem {
  value: string;
  count: number;
}

export interface PoetCard {
  id: number | string;
  name: string;
  subtitle?: string;
  brief?: string;
  dynasty?: string;
  birthYear?: number;
  deathYear?: number;
  poemCount?: number;
}

export interface PoemCard {
  id: number | string;
  title: string;
  subtitle?: string;
  author?: string;
  excerpt?: string;
}

export interface PoetryOverview {
  total: number;
  poetTotal: number;
  dynasties: FacetItem[];
  forms: FacetItem[];
  topPoets: PoetCard[];
  sourceLabel?: string;
}

export interface PoetDetail {
  id: number | string;
  name: string;
  subtitle?: string;
  /** 小传原文。来自 chinese-poetry 仓,是史料不是生成内容,原样展示。 */
  bio?: string;
  /**
   * 版本校勘说明。全宋诗作者表里不少小传后面接了一整段"用了哪些底本、参校了
   * 哪些刻本",后端按全角空格切出来 —— 它不是生平,但也是原文,收进折叠区不丢。
   */
  bioNotes?: string;
  dynasty?: string;
  birthYear?: number;
  deathYear?: number;
  sourceLabel?: string;
  works: PoemCard[];
  worksTotal: number;
  page: number;
  pageSize: number;
  forms?: FacetItem[];
  rhythmics?: FacetItem[];
  /** 意象词频:某个字出现在他多少首作品里。total 是分母(他的作品总数)。 */
  imagery?: { items: FacetItem[]; total: number };
  /**
   * 生平时间线。后端从 metadata.timeline 透出,数据源是中文维基 REST
   *(见 internal/crawler/poet_timeline.go)。无数据时字段不返回,前端不渲染。
   */
  timeline?: { year: number; event: string }[];
  /**
   * 诗人心境分期解读。后端 LLM 生成后写进 metadata.mood,永久缓存。
   * 必须带 source: 'llm' 用于前端渲染 AI 标签(合规要求)。
   */
  mood?: {
    label: string;
    summary: string;
    source?: 'llm';
    model?: string;
    generatedAt?: string;
  }[];
}

export function overview() {
  return contentClient<PoetryOverview>('poetry/overview');
}

export function poets(params: { dynasty?: string; q?: string; page?: number; size?: number }) {
  return contentClient<{ list: PoetCard[]; total: number; page: number; pageSize: number }>('poetry/poets', { params });
}

export function poet(params: { id?: string | number; name?: string; page?: number; size?: number }) {
  return contentClient<PoetDetail>('poetry/poet', { params });
}

export function poems(params: {
  dynasty?: string;
  form?: string;
  author?: string;
  rhythmic?: string;
  q?: string;
  page?: number;
  size?: number;
}) {
  return contentClient<{ list: PoemCard[]; total: number; page: number; pageSize: number }>('poetry/poems', { params });
}

/** 生卒年渲染。只有一头的就只写一头,两头都没有就不显示。 */
export function lifespanText(birth?: number, death?: number): string {
  if (birth && death) return `${birth}—${death}`;
  if (birth) return `${birth}—`;
  if (death) return `—${death}`;
  return '';
}
