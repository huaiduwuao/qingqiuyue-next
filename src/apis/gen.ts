/**
 * AI 视频生成(gen-api)。
 *
 * 之前 `/video-gen` 和 `/account/content/_views/shortdrama-gen` 两个页面各自
 * 直接 `fetch('/api/video/generate')`,并用 `/api/tasks/:id/events` 收 SSE。
 * 这三条路径在网关上都是 404 —— 后端从来没有提供过它们:
 *
 *   前端以为的            实际的
 *   POST /api/video/generate        POST /api/ai/generate/video
 *   GET  /api/tasks/:id/events      GET  /api/ai/generate/jobs/:id/events
 *   DELETE /api/tasks/:id           (不存在,后端没有取消接口)
 *
 * 请求体也对不上:前端发 {kind, positivePrompt, width, height, frames, steps, cfg},
 * 后端要的是 {workflowName, prompt, negativePrompt, params}。
 * 尺寸/帧数这类参数在后端是塞进 params 透传给 ComfyUI 工作流的,
 * 不是顶层字段 —— 能不能生效取决于工作流里有没有对应的占位节点。
 */

import { aiClient, API_BASE } from '@/lib/api/client';

/** 后端 GenerationWorkflow(gen-api /generate/workflows) */
export interface GenWorkflow {
  id: number;
  name: string;
  description: string;
  contentType: string;
  workflowJson: string;
  previewUrl: string;
  costCredits: number;
  status: string;
  sortOrder: number;
}

/** 后端 GenerationJob */
export interface GenJob {
  id: number;
  userId: number;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  prompt: string;
  negativePrompt: string;
  workflowName: string;
  costCredits: number;
  resultUrls?: string;
  errorMsg?: string;
}

/**
 * 可用工作流模板。公开接口,无需登录。
 *
 * 注意:预置的三个模板 `workflowJson` 还是占位内容,后端已把它们 seed 成
 * `status=draft`,所以这里通常返回空列表 —— 那表示「还没有配置好可用的工作流」,
 * 不是接口坏了。
 */
export async function listWorkflows(): Promise<GenWorkflow[]> {
  const res = await aiClient('/generate/workflows');
  return (res?.data ?? []) as GenWorkflow[];
}

/**
 * 提交生成任务。返回 jobId。
 *
 * ⚠️ 这个接口会**先扣费**(工作流的 costCredits,150~200 钻或一次会员每日额度)
 * 再异步执行。任务失败时后端会按原路退回(genapp.QuotaService.Refund)。
 */
export async function createVideoJob(body: {
  workflowName: string;
  prompt: string;
  negativePrompt?: string;
  /** 透传给 ComfyUI 工作流的参数,键名需与工作流里的占位一致 */
  params?: Record<string, string>;
}): Promise<{ jobId: number }> {
  const res = await aiClient('/generate/video', { method: 'POST', data: body });
  return res?.data as { jobId: number };
}

export async function getJob(jobId: number | string): Promise<GenJob> {
  const res = await aiClient(`/generate/jobs/${jobId}`);
  return res?.data as GenJob;
}

/** SSE 进度流地址。后端事件名:status(含 jobId/status/progress/errorMsg)。 */
export function jobEventsURL(jobId: number | string): string {
  return `${API_BASE.ai}/generate/jobs/${jobId}/events`;
}
