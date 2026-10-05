// 「我的」页的类型、常量与纯函数(从 MyHomePage.tsx 拆出,无 React 依赖)。

export type ContentType = 'NOVEL' | 'MUSIC' | 'FILM' | 'TELEPLAY' | 'ANIMATION' | 'COMICS' | 'VIDEO' | 'VSHOW' | 'DOCUMENTARY' | 'LIVE' | 'ARTICLE' | 'NEWS';

export type MyItem = {
  id: number;
  title: string;
  cover: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  collectNum: number;
  durationSec: number;
  // 毫秒时间戳。作品是发布时间,收藏/历史/稍后再看是"加进来的时间"。
  // 后端取不到时给 0,所以渲染前要挡一下 —— 以前这个字段压根没返回,
  // formatRelativeTime(undefined) 把卡片上的时间渲染成了 Invalid Date。
  postedAt?: number;
  contentType: ContentType;
  // status 是 module_content 的原值(PUBLISH / active / UN_PUBLISH / REVIEWING …);
  // 判"公不公开"用后端归一化好的 visibility,别再拿 status 跟字面量比 —— 以前这里写的是
  // 'public' / 'private' / 'draft',一条都匹配不上,所以锁标和「设为私密」入口从没出现过。
  status?: string;
  visibility?: WorkVisibility;
};

// 作品可见性,取值与后端 meWorkVisibility 一一对应。
export type WorkVisibility = 'public' | 'private' | 'reviewing' | 'rejected' | 'restricted';

// 卡片左上角的角标;public 不打角标。
export const VISIBILITY_BADGE: Record<Exclude<WorkVisibility, 'public'>, { label: string; color: string }> = {
  private: { label: '🔒 私密', color: 'warning.main' },
  reviewing: { label: '审核中', color: 'info.main' },
  rejected: { label: '未过审', color: 'error.main' },
  restricted: { label: '限定可见', color: 'secondary.main' },
};

// 能被「设为私密 / 设为公开」这个开关改的只有两种状态:已公开的可以收起来,
// 自己收起来的可以再放出去。审核中 / 未过审 / 限定可见不归隐私开关管。
export function privacyActionOf(it: MyItem): 'hide' | 'show' | null {
  if (it.visibility === 'public') return 'hide';
  if (it.visibility === 'private') return 'show';
  return null;
}

export type MyCollectionGroup = {
  id: number;
  title: string;
  cover: string;
  count: number;
  updatedAt: number;
};

export type ListResp = {
  list: (MyItem | MyCollectionGroup)[];
  total: number;
  tab: string;
  sub?: string;
  /** 后端 SuccessPageEx 带的;false 时被 omitempty 吃掉,所以只能当"有"用,不能当"没有"用 */
  hasMore?: boolean;
};

export const SUB_TABS: { key: string; label: string }[] = [
  { key: 'works', label: '作品' },
  { key: 'private', label: '私密作品' },
  { key: 'collection', label: '合集' },
  { key: 'drama', label: '短剧' },
];

// 返回合集卡片(而不是内容卡片)的页签:自建收藏夹,以及「作品 → 合集」。
// 书架不在其中 —— 它是一串小说/漫画(user_content_collect),按内容卡片出。
export const GROUP_TABS = new Set(['playlist', 'collection']);

/** 列表计数里数字后面那截:「共 3 个歌单」「共 2 本书」。 */
export const TAB_UNIT: Record<string, string> = {
  playlist: ' 个歌单', collection: ' 个合集', bookshelf: ' 本书',
  works: ' 个作品', private: ' 个私密作品', drama: ' 部短剧',
};

export const DATE_RANGES = [
  { key: 'all', label: '全部时间' },
  { key: '7d', label: '最近 7 天' },
  { key: '30d', label: '最近 30 天' },
  { key: '90d', label: '最近 3 个月' },
  { key: 'year', label: '最近一年' },
];

export function formatRelativeTime(ts?: number): string {
  if (!ts) return '未知时间';
  const diff = Date.now() - ts;
  if (diff < 0) return '刚刚';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

export function isMyItem(x: any): x is MyItem {
  return x && typeof x === 'object' && 'contentType' in x && 'cover' in x;
}

export function isMyGroup(x: any): x is MyCollectionGroup {
  return x && typeof x === 'object' && 'count' in x && 'updatedAt' in x && !('contentType' in x);
}

export const ME_FILTER_DEFAULTS = { mainTab: 'works', sub: 'works', kw: '', range: 'all' };

/** 电脑端快捷入口右上角的小徽标:每个入口从对应接口取真实数据,没有就不显示。 */
export function quickLinkBadge(
  key: string,
  d: { wallet?: any; point?: any; order?: any; vip?: any },
): { badge: string | null; badgeColor: 'warning' | 'default' } {
  let badge: string | null = null;
  let badgeColor: 'warning' | 'default' = 'default';
  if (key === 'wallet') {
    // /me/wallet 的 balance 是钻石(currency = "DIAMOND")
    const diamonds = d.wallet?.balance ?? 0;
    badge = diamonds > 0 ? `💎 ${diamonds.toLocaleString()}` : null;
  } else if (key === 'points') {
    const pts = d.point?.points ?? 0;
    badge = pts > 0 ? pts.toLocaleString() : null;
  } else if (key === 'order') {
    // /me/orders?size=1 只拉一条,records.length 最多是 1;有 total 用 total
    const cnt = d.order?.total ?? d.order?.records?.length ?? d.order?.list?.length ?? 0;
    badge = cnt > 0 ? String(cnt) : null;
  } else if (key === 'vip') {
    const vip = d.vip as any;
    if (vip?.tiers?.some((t: any) => t.active)) {
      badge = 'VIP';
      badgeColor = 'warning';
    }
  }
  return { badge, badgeColor };
}
