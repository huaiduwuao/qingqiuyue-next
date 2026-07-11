import { test, expect } from '@playwright/test';

/**
 * 详情页 smoke（公开路由，未登录态测试）。详情页依赖 searchParams `id`/`novelId` 等,
 * 没参数时大部分会显示「暂无内容」占位。这种状况也属于路径通：进入页面 + 不崩。
 * 完整内容/章节上传后的 E2E 留待 Phase 3 爬虫链路完成后做。
 */
const DETAIL_ROUTES: Array<{ path: string; key: string }> = [
  { path: '/detail/novel-detail', key: 'novel' },
  { path: '/detail/video-detail', key: 'video' },
  { path: '/detail/live-detail', key: 'live' },
  { path: '/detail/music-detail', key: 'music' },
  { path: '/detail/news-detail', key: 'news' },
  { path: '/detail/article-detail', key: 'article' },
  { path: '/detail/film-detail', key: 'film' },
  { path: '/detail/teleplay-detail', key: 'teleplay' },
  { path: '/detail/animation-detail', key: 'animation' },
  { path: '/detail/comics-detail', key: 'comics' },
  { path: '/detail/vshow-detail', key: 'vshow' },
];

test.describe('公开 · 详情页 smoke', () => {
  for (const route of DETAIL_ROUTES) {
    test(`${route.key} · ${route.path} 进入不崩`, async ({ page }) => {
      const resp = await page.goto(`http://localhost:3000${route.path}`);
      expect(resp).toBeTruthy();
      // 没崩 + 进入页面（不强制 200,允许 200/3xx/4xx,只要渲染出页面体即可）
      const status = resp!.status();
      expect([200, 304].includes(status) || status < 500).toBeTruthy();
      // 页面至少有 html/head/body
      await expect(page.locator('body')).toBeVisible({ timeout: 5_000 });
    });
  }
});
