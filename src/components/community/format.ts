import type { TopicKind } from '@/apis/community';

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(t).toLocaleDateString('zh-CN');
}

export function compactCount(n?: number): string {
  if (!n || n < 0) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return String(n);
}

export const FEED_VERB: Record<string, string> = {
  publish: '发布了作品',
  like: '赞了',
  collect: '收藏了',
  comment: '评论了',
  follow: '关注了',
};

export const TOPIC_KIND_LABEL: Record<TopicKind, string> = {
  collection: '合集',
  topic: '话题',
};

export const CONTENT_TYPE_LABEL: Record<string, string> = {
  VIDEO: '视频',
  FILM: '电影',
  TELEPLAY: '剧集',
  ANIMATION: '动画',
  VSHOW: '综艺',
  COMICS: '漫画',
  MUSIC: '音乐',
  NOVEL: '小说',
  SHORT_DRAMA: '短剧',
  ARTICLE: '文章',
  LIVE: '直播',
  NEWS: '资讯',
  WALLPAPER: '壁纸',
};

/** 没有封面时按标题给一个稳定的渐变色 */
export function topicGradient(seed: string): string {
  const palette = [
    ['#FE2C55', '#FF8A3D'],
    ['#5B8DEF', '#25F4EE'],
    ['#8B5CF6', '#EC4899'],
    ['#10B981', '#5DDB96'],
    ['#F59E0B', '#FE2C55'],
    ['#0EA5E9', '#8B5CF6'],
  ];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = palette[h % palette.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export const topicHref = (id: string | number) => `/detail/topic-detail?id=${id}`;
