import { getDetailRoute } from '@/lib/contentRoute';

/**
 * 系统消息(notice 表 type=system)的展示投影。
 *
 * 后端返回的是原始 NoticeEntity:title / content / info(JSON 字符串)/ status / createTime,
 * 没有 link / time / typeName / level。此前页面直接读这四个字段:时间空白、标签空白,
 * 点哪条都只弹一个 toast —— 作品下架、审核结论、开播提醒都点不进对应页面。
 * 这里按各业务写入 info 的字段(见后端 repository.SystemNotice 的调用方)推导出来。
 */
export interface SystemNoticeView {
  /** 站内路径(以 / 开头,router.push)或外链(openExternal) */
  link: string | null;
  time: string;
  typeName: string;
  level: 'success' | 'warning' | 'error' | 'info';
}

/** info 是 JSON 字符串;Doris 的 id 可能超过 2^53,先把长整数加上引号再解析,避免精度丢失。 */
export function parseNoticeInfo(info: unknown): Record<string, unknown> {
  if (info && typeof info === 'object') return info as Record<string, unknown>;
  if (typeof info !== 'string' || !info.trim().startsWith('{')) return {};
  try {
    return JSON.parse(info.replace(/:\s*(-?\d{16,})(?=\s*[,}])/g, ':"$1"')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const idOf = (v: unknown): string | null => {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return String(v);
  if (typeof v === 'string' && /^\d+$/.test(v) && v !== '0') return v;
  return null;
};

function levelOf(title: string): SystemNoticeView['level'] {
  if (/未通过|失败|下架|移除|驳回/.test(title)) return 'warning';
  if (/通过|恭喜|获奖|开播|上线|已处理/.test(title)) return 'success';
  return 'info';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function systemNoticeView(item: any): SystemNoticeView {
  const title = String(item?.title ?? '');
  const info = parseNoticeInfo(item?.info);
  const time = String(item?.time ?? item?.createTime ?? '');
  // 运营后台发的系统通知若自带 link,原样保留
  let link: string | null = typeof item?.link === 'string' && item.link ? item.link : typeof info.link === 'string' ? info.link : null;
  let typeName = typeof item?.typeName === 'string' && item.typeName ? item.typeName : '系统通知';

  const contentId = idOf(info.contentId);
  if (!link) {
    if (info.kind === 'share_task_failed') {
      link = '/account/content?tab=share';
      typeName = '分发';
    } else if (idOf(info.reviewId)) {
      link = '/account/content?tab=hd-publish';
      typeName = '审核';
    } else if (idOf(info.activityId)) {
      link = '/account/content?tab=activity';
      typeName = '活动';
    } else if (idOf(info.reportId)) {
      typeName = '举报';
    } else if (contentId) {
      const type = typeof info.contentType === 'string' ? info.contentType : '';
      // 没带类型时用按 id 取详情的通用页
      link = (type && getDetailRoute(type, contentId)) || `/share/module-content-detail?id=${contentId}`;
      typeName = type === 'LIVE' ? '直播' : '作品';
    }
  }
  return { link, time, typeName, level: (item?.level as SystemNoticeView['level']) || levelOf(title) };
}
