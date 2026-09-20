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

/**
 * 小说详情不该一次拉全本目录。
 * - 不带 chapter 参数进入时,useContentItems 用 untilChapterId 截断,只发 1 次 page 请求。
 * - 带 chapter 参数时,如果目标章节在第 1 页就停,最多 2 次请求。
 *
 * 用 page.route 拦截 novel-chapter/page,断言请求次数 <= 2,而不是默认的 6 次翻页。
 */
test.describe('公开 · 小说详情按需拉目录', () => {
  test('不带 chapter 进入,目录请求次数不超过 1', async ({ page }) => {
    const calls: number[] = [];
    await page.route('**/api/client-content/novel-chapter/page**', async (route) => {
      const url = new URL(route.request().url());
      calls.push(Number(url.searchParams.get('page') ?? '0'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ list: [], total: 0, backfilling: false }),
      });
    });
    await page.route('**/api/client-content/detail**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto('http://localhost:3000/detail/novel-detail?id=test-novel-id');
    await expect(page.locator('body')).toBeVisible({ timeout: 5_000 });
    // 等目录请求落地
    await page.waitForTimeout(500);
    expect(calls.length).toBeLessThanOrEqual(1);
  });

  test('目标章节在第 1 页内,翻页次数不超过 2', async ({ page }) => {
    const calls: number[] = [];
    // 构造 600 章的目录,目标 chapter id 在第 1 页(500 条内)
    const targetChapterId = 'chapter-100';
    const buildList = (startSort: number, endSort: number) =>
      Array.from({ length: endSort - startSort + 1 }, (_, k) => {
        const sort = startSort + k;
        return {
          id: `chapter-${sort}`,
          title: `第 ${sort} 章`,
          sort,
        };
      });
    await page.route('**/api/client-content/novel-chapter/page**', async (route) => {
      const url = new URL(route.request().url());
      const pageNum = Number(url.searchParams.get('page') ?? '1');
      calls.push(pageNum);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          list: buildList((pageNum - 1) * 500 + 1, pageNum * 500),
          total: 600,
          backfilling: false,
        }),
      });
    });
    await page.route('**/api/client-content/detail**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto(`http://localhost:3000/detail/novel-detail?id=test-novel-id&chapter=${targetChapterId}`);
    await expect(page.locator('body')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(500);
    expect(calls.length).toBeLessThanOrEqual(2);
    // 直到 break 后没有 page=2 的请求(因为第 1 页就含目标章节)
    expect(calls).not.toContain(2);
  });
});
