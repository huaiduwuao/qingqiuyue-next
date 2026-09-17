/**
 * 源站播放页 URL → 源站**官方外链播放器**的 iframe 地址。
 *
 * 本站不替源站付视频带宽,而大平台的流地址一律校验 Referer(见后端 internal/streamaccess),
 * 官方外链播放器是第三条路:带宽源站出、用户留在本站页面里。
 *
 * 规则与后端 internal/embedplayer 保持一致 —— 改一边要改另一边。只收实测能在第三方
 * iframe 里播的形态(2026-09-17 逐个验过):
 *   - B 站 UP 主投稿 /video/BV… /video/av… —— 能播。
 *   - B 站番剧/影视 /bangumi/play/ep… ss… —— 不行:episodeId、seasonId、分集 bvid、aid+cid
 *     都试过,外链播放器只放 17 秒的 error.mp4。版权内容 B 站不给外嵌,别加回来。
 *   - 腾讯 / 优酷的 iframe 播放器没验出真能出画面;抖音库里存的是搜索页,没有视频 id。
 *
 * 数字人「虚拟浏览器」里另有一份宽松的 toEmbedUrl(任意含 BV 号的地址都映射、自动播放),
 * 那是给"随便打开一个网页"用的,口径不同,不要合并。
 */

export interface EmbedPlayer {
  provider: 'bilibili';
  /** 署名用的平台名 */
  providerLabel: string;
  /** iframe src(autoplay=0) */
  url: string;
}

const BILI_BV = /^\/video\/(BV[0-9A-Za-z]{10})\/?$/;
const BILI_AV = /^\/video\/av(\d+)\/?$/;

export function resolveEmbedPlayer(pageUrl?: string | null): EmbedPlayer | null {
  const raw = (pageUrl || '').trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host === 'bilibili.com' || host.endsWith('.bilibili.com')) return bilibili(u);
  return null;
}

function bilibili(u: URL): EmbedPlayer | null {
  const q = new URLSearchParams();
  const bv = BILI_BV.exec(u.pathname);
  const av = BILI_AV.exec(u.pathname);
  if (bv) q.set('bvid', bv[1]);
  else if (av) q.set('aid', av[1]);
  else return null;
  // 多 P 视频:?p=3 要带过去,否则永远播第 1P。
  const p = parseInt(u.searchParams.get('p') || '', 10);
  if (p > 1) q.set('p', String(p));
  q.set('autoplay', '0');
  q.set('high_quality', '1');
  q.set('danmaku', '0');
  return { provider: 'bilibili', providerLabel: '哔哩哔哩', url: `https://player.bilibili.com/player.html?${q}` };
}

/** 用户点了播放(或推荐流里划到这一条)之后用的地址:同一个播放器,打开自动播放。 */
export function withAutoplay(embedUrl: string): string {
  return embedUrl.replace('autoplay=0', 'autoplay=1');
}
