/**
 * Reward-task MSW handlers。
 *
 * reward task 已接真实后端(/api/core/task/*,持久化到 reward_task 表),
 * 移除 mock 避免双端假数据。保留空导出以兼容 handlers/index.ts 的引用。
 */
import type { RequestHandler } from 'msw';

export const rewardTaskHandlers: RequestHandler[] = [];
