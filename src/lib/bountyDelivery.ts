/**
 * 悬赏任务 → 创作 → 交付 的跨中心衔接。
 *
 * 奖励中心的任务弹层「去创作交付」带着任务上下文跳到创作者中心发布页:
 *   /account/content?tab=hd-publish&task=<taskId>&taskTitle=<…>&demand=<demandId>&ptype=<发布类型>
 * 发布页读一次这些参数(读完从地址栏去掉),发布成功后问一句要不要直接用新作品交付,
 * 交付后回到 /account/reward?tab=board&demand=<demandId>&task=<taskId>,看板直接打开那个任务。
 *
 * 两个中心的子页面状态(tabParams 等)只活在各自的 React 树里,跨页只能靠 URL。
 */

/**
 * 需求分类(reward 需求表单的 category)→ 发布页类型(PublishHubType)。
 *
 *   video 短视频 → video          视频上传
 *   image 图文   → picture-album  多图 + 短文
 *   art   画作   → picture-album  画作也是图片作品(PICTURE)
 *   novel 小说   → novel
 *   music 音乐   → music
 *   voice 配音   → music          配音交的是音频,音乐表单是唯一的音频上传入口
 *   film  短剧   → teleplay       多集分集剧情;short-drama 在发布页没有表单
 *   live  直播   → live
 *   空 / 未知    → video          与需求表单「空 = 短视频」一致
 */
export const BOUNTY_CATEGORY_TO_PUBLISH_TYPE: Readonly<Record<string, string>> = {
  video: 'video',
  image: 'picture-album',
  art: 'picture-album',
  novel: 'novel',
  music: 'music',
  voice: 'music',
  film: 'teleplay',
  live: 'live',
};

export function publishTypeForBountyCategory(category?: string | null): string {
  const key = (category || '').trim().toLowerCase();
  return BOUNTY_CATEGORY_TO_PUBLISH_TYPE[key] ?? 'video';
}

export interface TaskDeliveryContext {
  /** 任务 id(PG 自增,按字符串透传,提交时再转 number) */
  taskId: string;
  taskTitle: string;
  /** 所属需求;独立任务为空 */
  demandId?: string;
  /** 预选的发布类型(PublishHubType);空 = 让用户自己挑 */
  ptype?: string;
}

const PARAM_KEYS = ['task', 'taskTitle', 'demand', 'ptype'] as const;

/** 从任务弹层跳到发布页的地址。 */
export function buildTaskCreateHref(ctx: TaskDeliveryContext): string {
  const q = new URLSearchParams({ tab: 'hd-publish', task: ctx.taskId, taskTitle: ctx.taskTitle || '' });
  if (ctx.demandId) q.set('demand', ctx.demandId);
  if (ctx.ptype) q.set('ptype', ctx.ptype);
  return `/account/content?${q.toString()}`;
}

/** 回到奖励中心看板并打开这个任务(看板认 ?task=,奖励中心认 ?demand=)。 */
export function rewardTaskHref(taskId: string, demandId?: string): string {
  const q = new URLSearchParams({ tab: 'board' });
  if (demandId) q.set('demand', demandId);
  if (taskId) q.set('task', taskId);
  return `/account/reward?${q.toString()}`;
}

/**
 * 发布页 mount 时调用一次:读出任务上下文并从地址栏去掉这些参数(保留 ?tab=),
 * 刷新 / 返回不会再次进入任务模式。没有任务参数时返回 null,地址栏不动。
 */
export function takeTaskDeliveryParams(): TaskDeliveryContext | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const taskId = (url.searchParams.get('task') || '').trim();
  if (!/^[1-9]\d*$/.test(taskId)) return null;
  const ctx: TaskDeliveryContext = {
    taskId,
    taskTitle: url.searchParams.get('taskTitle') || '',
    demandId: /^[1-9]\d*$/.test(url.searchParams.get('demand') || '') ? url.searchParams.get('demand')! : undefined,
    ptype: url.searchParams.get('ptype') || undefined,
  };
  PARAM_KEYS.forEach((k) => url.searchParams.delete(k));
  window.history.replaceState(window.history.state, '', url.toString());
  return ctx;
}
