/**
 * 系统审核管理 API 客户端
 *
 * 给 admin 页面的审核管理模块(reports / sensitive-words)用
 * 实际后端: /api/system/moderation/* 路由
 *
 * 注: 这是 stub, 真后端路由可能还没实现 — 真实部署前要补 server 端
 */

import { adminClient } from '@/lib/api/client'

// ── 举报审核 ─────────────────────────────────────

export interface ReportItem {
  id: number
  reporterId: number
  targetType: string
  targetId: number
  reason: string
  status: 'pending' | 'resolved' | 'rejected'
  reviewerId?: number
  reviewNote?: string
  reviewedAt?: string
  createdAt: string
}

export interface ListReportsParams {
  page?: number
  pageSize?: number
  status?: 'pending' | 'resolved' | 'rejected'
}

export const listReports = (params: ListReportsParams = {}) =>
  adminClient('/system/moderation/reports', { params })

export const reviewReport = (id: number, body: { status: 'resolved' | 'rejected'; reviewNote?: string }) =>
  adminClient(`/system/moderation/reports/${id}/review`, { method: 'POST', data: body })


// ── 敏感词管理 ───────────────────────────────────

export interface SensitiveWordItem {
  id: number
  word: string
  level: number
  category: string
  status: string
  createdAt: string
}

export const listSensitiveWords = (params: { page?: number; pageSize?: number } = {}) =>
  adminClient('/system/moderation/sensitive-words', { params })

export const addSensitiveWord = (body: { word: string; category?: string; level?: number }) =>
  adminClient('/system/moderation/sensitive-words', { method: 'POST', data: body })

export const deleteSensitiveWord = (id: number) =>
  adminClient(`/system/moderation/sensitive-words/${id}`, { method: 'DELETE' })