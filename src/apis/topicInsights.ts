// 专题看板 API client。后端见 qingqiuyue-go internal/handler/topic_insights.go(只给内容运营)。
// ⚠️ contentClient 的响应拦截器已经把 body.data 剥出来了。

import { contentClient } from '@/lib/api/client';
import type { InsightBranchEvidence } from '@/apis/insight';

export interface TopicKPI {
  people: number;
  impressions: number;
  opens: number;
  openPeople: number;
  works: number;
  /** 人均停留分钟(有停留记录的人) */
  dwellMin: number;
  /** 打开 / 曝光 */
  ctr: number;
}

export interface TopicNodeRow {
  key: string;
  name: string;
  /** 「文明图谱 › 民生 › 吃」 */
  path: string;
  kind: 'civ' | 'insight' | '';
  origin?: string;
  status?: string;
  domain: string;
  domainName: string;
  openedAt?: number;
  people: number;
  opens: number;
  impressions: number;
  ctr: number;
  works: number;
  dwellMin: number;
  opens24: number;
  dailyAvg: number;
  rise: number;
}

export interface TopicInsights {
  days: number;
  now: number;
  kpi: { cur: TopicKPI; prev: TopicKPI };
  daily: { day: string; people: number; opens: number; works: number; impressions: number }[];
  top: TopicNodeRow[];
  rising: TopicNodeRow[];
  ignored: TopicNodeRow[];
  works: { id: string; title: string; contentType: string; node: string; nodeName: string; nodePath: string; clicks: number; people: number }[];
  domains: { domain: string; name: string; kind: string; opens: number; nodes: number }[];
  grown: { key: string; name: string; path: string; origin?: string; status?: string; openedAt: number; people: number; opens: number }[];
  semantic: { word: string; url?: string; at: number; sim: number; node: string; nodeName: string }[];
  round?: { at: number; total: number; placed: number; harm: number; unplaced: InsightBranchEvidence[] };
}

export const topicInsights = (days: number): Promise<TopicInsights> =>
  contentClient.get('/topic/insights', { params: { days } });
