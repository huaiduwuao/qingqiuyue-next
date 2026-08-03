import { contentClient } from '@/lib/api/client';

// 行为上报 → content-api POST /api/content/behavior
export const reportBehavior = (data: {
  userId?: number; itemId: number; itemType?: string; action?: string; duration?: number;
}) => contentClient('/behavior', { method: 'POST', data });

// 推荐内容项
export interface FeedItem {
  id: number;
  title: string;
  cover: string;
  author: string;
  contentType: string;
  score: number;
  reason: string; // recall: i2i / hot
}

// 个性化 feed → GET /api/content/recommend/feed
export const recommendFeed = (params: { userId?: number; type?: string; size?: number }) =>
  contentClient('/recommend/feed', { params });

// 获取个性化推荐（增强版）→ GET /api/content/recommend/personal
// 使用多路召回（User-CF + Item-CF + 热门 + 冷启动策略）
export const getPersonalFeed = (params: { userId: number; type?: string; size?: number }) =>
  contentClient('/recommend/personal', { params });

// 获取热榜 → GET /api/content/analytics/hot
export const getHotRanking = (params: { type?: string; period?: string; limit?: number }) =>
  contentClient('/analytics/hot', { params });

// 推荐反馈 → POST /api/content/recommend/feedback
export const reportRecommendFeedback = (params: { userId: number; itemId: number; action: string }) =>
  contentClient('/recommend/feedback', { method: 'POST', data: params });
