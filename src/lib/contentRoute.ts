import { useRouter } from 'next/navigation';


// TYPE_TO_ROUTE / TYPE_LABEL 现在从生成物再导出,不再在这里手写一份。
// 这两张表以前和后端 internal/crawler 的常量各写各的,靠注释提醒同步 ——
// 结果 VSHOW 在这里被标成「短剧」,而后端 VSHOW 的源是芒果TV综艺/爱奇艺综艺,
// 线上 59 条综艺内容一直挂着「短剧」标签展示给用户。
// 现在唯一事实来源是 qingqiuyue-go 的 contracts/content_type.yaml,
// 两侧生成物由 make check-contract 校验,漂不了。
export { TYPE_TO_ROUTE, TYPE_LABEL, CONTENT_TYPES } from './contentType.gen';
export type { ContentType } from './contentType.gen';

import { TYPE_TO_ROUTE, TYPE_LABEL } from './contentType.gen';

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
  'short-drama': 'SHORT_DRAMA',
  'teleplay': 'TELEPLAY',
  'film': 'FILM',
  'animation': 'ANIMATION',
  'live': 'LIVE',
};

/**
 * chip 的展示名。**从 TYPE_LABEL 推导,不再手写第二份。**
 *
 * 手写的那份漂过一次,而且漂在创作者能看见的地方:'vshow' 标的是「短剧」,
 * 但它发布出去的是 VSHOW(综艺)。这正是 contracts/content_type.yaml 要消灭的
 * 情况 —— 文件上面刚说完"唯一事实来源是契约生成物",下面就又写了一份。
 *
 * 只有后端没有对应类型的 chip('all' 和两个图文别名)才在这里显式列出。
 */
const PUBLISH_HUB_EXTRA_LABEL: Record<string, string> = {
  'all': '全部',
  'picture-mv': '图片 MV',
};

export const PUBLISH_HUB_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(PUBLISH_HUB_TYPE_TO_CONTENT_TYPE).map(([chip, code]) => [
    chip,
    PUBLISH_HUB_EXTRA_LABEL[chip] ?? TYPE_LABEL[code] ?? chip,
  ]),
);

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
