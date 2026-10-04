import { COMMON, LEADERBOARD, LIVE, novel } from './fixtures';
import { expect, installMocks, page$, test } from './mock';

test.describe('首页', () => {
  test('推荐页加载,侧栏切换排行榜 / 直播(动态面板按需加载)', async ({ page, errors }) => {
    const api = await installMocks(page, { rules: [...COMMON, ...LEADERBOARD, ...LIVE] });
    await page.goto('/home/recommend');
    const nav = page.locator('nav');
    await expect(nav.getByText('推荐', { exact: true })).toBeVisible();

    await nav.getByText('排行榜', { exact: true }).click();
    await expect(page).toHaveURL(/tab=rank/);
    await expect(page.getByText('E2E 榜单作品').first()).toBeVisible();

    await nav.getByText('直播', { exact: true }).click();
    await expect(page).toHaveURL(/tab=live/);
    await expect(page.getByText('E2E 直播间').first()).toBeVisible();

    expect(api.unmatched, '有接口没登记 fixture').toEqual([]);
    expect(errors).toEqual([]);
  });

  test('分类页滚动到底自动拉下一页', async ({ page, errors }) => {
    const PAGE_SIZE = 12;
    const pagesAsked: number[] = [];
    await installMocks(page, {
      rules: [
        ...COMMON,
        {
          path: /^\/content\/module\/content\/list$/,
          body: (_req, url) => {
            const p = Number(url.searchParams.get('page') || 1);
            pagesAsked.push(p);
            const list = Array.from({ length: PAGE_SIZE }, (_, i) => novel((p - 1) * PAGE_SIZE + i + 1));
            return page$(list, PAGE_SIZE * 3, p, PAGE_SIZE);
          },
        },
      ],
    });
    await page.goto('/home/recommend?tab=novel');
    await expect(page.getByText('E2E 小说 1', { exact: true })).toBeVisible();
    expect(pagesAsked).toEqual([1]);

    await page.getByText('E2E 小说 1', { exact: true }).hover();
    await expect(async () => {
      await page.mouse.wheel(0, 4000);
      expect(pagesAsked).toContain(2);
    }).toPass({ timeout: 10_000 });
    await expect(page.getByText(`E2E 小说 ${PAGE_SIZE + 1}`, { exact: true })).toBeAttached();
    expect(errors).toEqual([]);
  });
});
