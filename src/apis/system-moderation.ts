/**
 * 系统审核管理 API 客户端
 *
 * 给 admin 页面的审核管理模块(reports / sensitive-words)用
 * 后端: core-api /api/core/moderation/*(moderationapp.RegisterAdminRoutes)。
 * 此前写成 /system/moderation/*,后端没有这个前缀,新增/删除敏感词全是 404。
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
  adminClient('/moderation/reports', { params })

export const reviewReport = (id: number, body: { status: 'resolved' | 'rejected'; reviewNote?: string }) =>
  adminClient(`/moderation/reports/${id}/review`, { method: 'POST', data: body })


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
  adminClient('/moderation/sensitive-words', { params })

export const addSensitiveWord = (body: { word: string; category?: string; level?: number }) =>
  adminClient('/moderation/sensitive-words', { method: 'POST', data: body })

export const deleteSensitiveWord = (id: number) =>
  adminClient(`/moderation/sensitive-words/${id}`, { method: 'DELETE' })