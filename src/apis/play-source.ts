import { contentClient } from '@/lib/api/client';

/**
 * 网友补充的「观看入口」(后端 internal/handler/play_source.go)。
 *
 * 提交即上线、被举报才人工裁决;后端只收正规内容平台的链接,名单外的域名直接拒收。
 * 永远只是跳转链接 —— 不进播放器。
 */
export interface PlaySource {
  id: number;
  /** 内容 id 是雪花 int64,超过 2^53,前后端都用字符串 */
  contentId: string;
  platform: string;
  url: string;
  episode?: string;
  vip: boolean;
  note?: string;
  /** 是不是当前登录用户自己补的(可撤回) */
  mine: boolean;
  createdAt: number;
}

export interface PlaySourceList {
  list: PlaySource[];
  /** 后端接受的平台名,给提交框做提示 */
  platforms: string[];
}

export async function listPlaySources(contentId: string): Promise<PlaySourceList> {
  const data = (await contentClient('/play-source', { params: { contentId } })) ?? {};
  return {
    list: Array.isArray(data.list) ? data.list : [],
    platforms: Array.isArray(data.platforms) ? data.platforms : [],
  };
}

export async function addPlaySource(input: { contentId: string; url: string; episode?: string; vip?: boolean; note?: string }) {
  return contentClient('/play-source', { method: 'POST', data: input });
}

export async function removePlaySource(id: number) {
  return contentClient(`/play-source/${id}`, { method: 'DELETE' });
}

/** kind=copyright 是权利人投诉:链接会先被隐藏,再等管理员裁决。 */
export async function reportPlaySource(id: number, input: { kind?: 'copyright'; reason?: string }) {
  return contentClient(`/play-source/${id}/report`, { method: 'POST', data: input });
}
