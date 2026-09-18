import { adminClient } from '@/lib/api/client';

/**
 * 应用提交资料 —— 各应用商店上架表单要填的内容(后端 internal/handler/app_submission.go)。
 * 与「微信配置」不同:那边是运行时凭据(AppID/AppSecret),这边是填表用的资料。
 */

export interface AppSubmissionField {
  key: string;
  label: string;
  value: string;
  /** 这一项从哪来 / 怎么算出来的 */
  hint?: string;
  required?: boolean;
  multiline?: boolean;
}

export interface AppSubmissionChannel {
  id: number;
  channel: string;
  title: string;
  note: string;
  sort: number;
  updatedAt: number;
  updatedBy: number;
  fields: AppSubmissionField[];
}

export async function listAppSubmission() {
  const r = await adminClient<{ data?: { list?: AppSubmissionChannel[] } }>('/appSubmission/list');
  // 拦截器已把 axios 的 body({code,msg,data:{list}})直接作为返回值,
  // 所以这里只取一层 .data,跟 kf/admin-shop 等其他接口一致。多写一层会一直拿到 []。
  return r?.data?.list ?? [];
}

export async function saveAppSubmission(channel: string, fields: AppSubmissionField[], note?: string) {
  return adminClient(`/appSubmission/${encodeURIComponent(channel)}`, {
    method: 'PUT',
    data: { fields, ...(note === undefined ? {} : { note }) },
  });
}
