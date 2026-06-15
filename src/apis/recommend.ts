import { contentClient } from '@/lib/api/client';

// 行为上报 → content-api POST /api/content/behavior
export const reportBehavior = (data: {
  userId?: number; itemId: number; itemType?: string; action?: string; duration?: number;
}) => contentClient('/behavior', { method: 'POST', data });

// 个性化 feed → GET /api/content/recommend/feed
export const recommendFeed = (params: { userId?: number; type?: string; size?: number }) =>
  contentClient('/recommend/feed', { params });
