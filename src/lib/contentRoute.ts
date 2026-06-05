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
  ARTICLE: '/detail/article-detail',
  NEWS: '/detail/news-detail',
};

export const TYPE_LABEL: Record<string, string> = {
  NOVEL: '小说', MUSIC: '音乐', FILM: '电影', TELEPLAY: '电视剧',
  ANIMATION: '动漫', COMICS: '漫画', VIDEO: '视频', VSHOW: '综艺',
  ARTICLE: '文章', NEWS: '新闻',
};

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
