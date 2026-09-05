import { useRouter } from 'next/navigation';


// TYPE_TO_ROUTE / TYPE_LABEL 现在从生成物再导出,不再在这里手写一份。
// 这两张表以前和后端 internal/crawler 的常量各写各的,靠注释提醒同步 ——
// 结果 VSHOW 在这里被标成「短剧」,而后端 VSHOW 的源是芒果TV综艺/爱奇艺综艺,
// 线上 59 条综艺内容一直挂着「短剧」标签展示给用户。
// 现在唯一事实来源是 qingqiuyue-go 的 contracts/content_type.yaml,
// 两侧生成物由 make check-contract 校验,漂不了。
export { TYPE_TO_ROUTE, TYPE_LABEL, CONTENT_TYPES } from './contentType.gen';
export type { ContentType } from './contentType.gen';

import { TYPE_TO_ROUTE } from './contentType.gen';

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
