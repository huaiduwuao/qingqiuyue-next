import { contentClient } from '@/lib/api/client';

/**
 * 内容轻量标记(后端 Doris user_content_collect,按 type 区分):
 *   watchlater 稍后再看 —— 任意内容,列表在个人中心「稍后再看」
 *   reserve    开播预约 —— 仅直播间,列表在个人中心「我的预约」
 */
export type MarkKind = 'watchlater' | 'reserve';

export type MarkStatus = Record<MarkKind, boolean>;

export async function getMarkStatus(contentId: number): Promise<MarkStatus> {
  const res: any = await contentClient('/mark/status', { params: { contentId } });
  const d = res?.data ?? res;
  return { watchlater: !!d?.watchlater, reserve: !!d?.reserve };
}

/** 幂等:on=true 加上标记,on=false 去掉。 */
export async function setMark(contentId: number, kind: MarkKind, on: boolean) {
  return contentClient('/mark', { method: 'POST', data: { contentId, kind, on } });
}
