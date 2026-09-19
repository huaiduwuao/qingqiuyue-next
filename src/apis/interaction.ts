import { contentClient } from '@/lib/api/client';
import type { EntityId } from '@/lib/id';

/**
 * 当前用户对一条内容的互动状态 + 库里的计数(content-api GET /interaction)。
 * 赞 / 踩存在 PG module_content_action,收藏存在 Doris user_content_collect。
 */
export interface Interaction {
  contentId: string;
  loggedIn: boolean;
  liked: boolean;
  disliked: boolean;
  collected: boolean;
  agreeNum: number;
  collectNum: number;
}

export async function getInteraction(contentId: EntityId): Promise<Interaction> {
  const res: any = await contentClient('/interaction', { params: { contentId } });
  const d = res;
  return {
    contentId: String(d?.contentId ?? contentId),
    loggedIn: !!d?.loggedIn,
    liked: !!d?.liked,
    disliked: !!d?.disliked,
    collected: !!d?.collected,
    agreeNum: Number(d?.agreeNum) || 0,
    collectNum: Number(d?.collectNum) || 0,
  };
}

// 三个写接口都是「设成目标状态」(幂等):重复点、页面状态过期都不会反向操作。

export function setLike(contentId: EntityId, on: boolean) {
  return contentClient('/module/content/action', {
    method: 'POST',
    data: { contentId, action: on ? 'agree' : 'cancel_agree' },
  });
}

export function setDislike(contentId: EntityId, on: boolean) {
  return contentClient('/module/content/action', {
    method: 'POST',
    data: { contentId, action: on ? 'disagree' : 'cancel_disagree' },
  });
}

export function setCollect(contentId: EntityId, on: boolean) {
  return contentClient('/collect', { method: 'POST', data: { contentId, on } });
}
