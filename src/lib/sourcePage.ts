/**
 * 源站页面地址的分类:哪些只能去原站看、推荐流/榜单条目的页面地址从哪儿来。
 * (以前叫 lib/embedPlayer,还负责映射官方外链 iframe 播放器;2026-09-26 起不再嵌 iframe ——
 * 有解析规则的源站一律走本站播放器,见 lib/localStream。)
 */

import { canResolveLocally } from '@/lib/localStream/engine';

/**
 * 正版长视频平台的页面(B 站番剧、爱奇艺、腾讯、优酷、芒果):流要么校验 Referer、要么带 DRM,
 * 也没有解析规则 —— 只能去原站看。返回平台名;不是这类页面返回 null。
 *
 * 播放器拿到这类地址时直接给「去 XX 观看」,不再白等一次最长 30 秒、结局毫无悬念的流解析,
 * 也不把它当故障上报。口径与后端 internal/playability 的 originOnlyPages 一致,只是这里
 * 连系列页也算 —— 对用户来说系列页同样是个能点过去看的入口。
 */
const ORIGIN_ONLY: Array<[RegExp, string]> = [
  [/(^|\.)bilibili\.com$/, '哔哩哔哩'],
  [/(^|\.)iqiyi\.com$/, '爱奇艺'],
  [/^v\.qq\.com$/, '腾讯视频'],
  [/(^|\.)youku\.com$/, '优酷'],
  [/(^|\.)mgtv\.com$/, '芒果TV'],
  // 360 影视是各平台的聚合索引页,本身没有片源(后端 internal/discover 从它这儿收录书目)。
  [/(^|\.)360kan\.com$/, '360影视'],
];

export function originOnlyPlatform(pageUrl?: string | null): string | null {
  const raw = (pageUrl || '').trim();
  if (!raw || canResolveLocally(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  // B 站只有番剧/影视算;其余形态(直播间、动态、专栏…)不归这里管。
  if (/(^|\.)bilibili\.com$/.test(host) && !u.pathname.startsWith('/bangumi/')) return null;
  return ORIGIN_ONLY.find(([re]) => re.test(host))?.[1] ?? null;
}

/** 面向用户的提示,与后端 playability.OriginOnlyNotice 一致。 */
export const ORIGIN_ONLY_NOTICE = '该平台的正版内容仅支持在原站观看';

/**
 * 推荐流 / 榜单条目的源站页面地址。
 *
 * 正常情况下就是接口给的 sourceUrl。但旧的播放性结论会把 sourceUrl 换成解析出来的 CDN
 * 直链(B 站的 bilivideo 签名地址:已过期、且校验 Referer),页面地址只剩在 metadata 里 ——
 * 这时解析规则和「去原站」都无从判断。metadata 里的页面地址有规则可解或属于只能去原站的平台时,
 * 以它为准。
 */
export function sourcePageOf(sourceUrl?: string | null, metadata?: string | null): string {
  const given = (sourceUrl || '').trim();
  if (canResolveLocally(given) || originOnlyPlatform(given)) return given;
  let page = '';
  try {
    const m = metadata ? JSON.parse(metadata) : null;
    page = String(m?.sourceUrl || m?.source_url || '').trim();
  } catch {
    /* 存量 metadata 里有被截断的 JSON */
  }
  return page && (canResolveLocally(page) || originOnlyPlatform(page)) ? page : given;
}
