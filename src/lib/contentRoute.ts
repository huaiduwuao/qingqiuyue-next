import { useRouter } from 'next/navigation';

export const TYPE_TO_ROUTE: Record<string, string> = {
  NOVEL: '/detail/novel-detail',
  MUSIC: '/detail/music-detail',
  FILM: '/detail/film-detail',
  TELEPLAY: '/detail/teleplay-detail',
  ANIMATION: '/detail/animation-detail',
  COMICS: '/detail/comics-detail',
  VIDEO: '/detail/video-detail',
  VSHOW: '/detail/vshow-detail',
  LIVE: '/detail/live-detail',
  ARTICLE: '/detail/article-detail',
  NEWS: '/detail/news-detail',
  // 图集 / 图片 MV 还没有对应 detail 路由,先用占位;DetailDrawer 的「查看详情页」
  // 跳转若命中 null 会 fallback 到 window.open fallbackUrl(由 caller 决定)。
  PICTURE: '/detail/image-detail',
  PICTURE_ALBUM: '/detail/image-detail',
  PICTURE_MV: '/detail/image-detail',
};

// 已发布时实际写到后端的图片枚举是 PICTURE(PICTURE_ALBUM / PICTURE_MV 通过 content JSON 区分)。
// 统一列表 + Drawer 渲染时优先用 _label(contentType) 内部映射到本表更友好的中文。
export const TYPE_LABEL: Record<string, string> = {
  NOVEL: '小说', MUSIC: '音乐', FILM: '电影', TELEPLAY: '电视剧',
  ANIMATION: '动漫', COMICS: '漫画', VIDEO: '视频', VSHOW: '短剧',
  LIVE: '直播', ARTICLE: '文章', NEWS: '新闻', PICTURE: '图文',
  // 图集 / 图片 MV 是 image-publish 和 image-mv-publish 的内部细分,统一显示成「图文」。
  PICTURE_ALBUM: '图文', PICTURE_MV: '图文',
};

/**
 * 创作者中心 chip 上展示的「卡片 id」→ 后端 contentType 映射。
 * chip 这一层用的全是人类友好名(article / novel / ...),需要转换到后端枚举
 * 才能传给 myPage({ contentType }) 这种接口。
 */
export const PUBLISH_HUB_TYPE_TO_CONTENT_TYPE: Record<string, string> = {
  'all': '',           // 空 = 后端返回全部类型
  'video': 'VIDEO',
  'picture-album': 'PICTURE',
  'picture-mv': 'PICTURE',
  'article': 'ARTICLE',
  'novel': 'NOVEL',
  'news': 'NEWS',
  'music': 'MUSIC',
  'comics': 'COMICS',
  'vshow': 'VSHOW',
  'teleplay': 'TELEPLAY',
  'film': 'FILM',
  'animation': 'ANIMATION',
  'live': 'LIVE',
};

export const PUBLISH_HUB_TYPE_LABEL: Record<string, string> = {
  'all': '全部',
  'video': '视频',
  'picture-album': '图文',
  'picture-mv': '图片 MV',
  'article': '文章',
  'novel': '小说',
  'news': '新闻',
  'music': '音乐',
  'comics': '漫画',
  'vshow': '短剧',
  'teleplay': '电视剧',
  'film': '电影',
  'animation': '动画',
  'live': '直播',
};

export type PublishHubType = keyof typeof PUBLISH_HUB_TYPE_LABEL;

export function getDetailRoute(contentType: string, id: number | string): string | null {
  const route = TYPE_TO_ROUTE[contentType];
  if (!route) return null;
  return `${route}?id=${id}`;
}

export function useContentNavigate() {
  const router = useRouter();
  return (contentType: string, id: number | string, fallbackUrl?: string) => {
    const route = getDetailRoute(contentType, id);
    if (route) router.push(route);
    else if (fallbackUrl) window.open(fallbackUrl, '_blank');
  };
}
