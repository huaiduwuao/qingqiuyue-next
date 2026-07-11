import { test, expect } from '@playwright/test';

/**
 * 首页（公开）smoke。一级跳转 landing → /home/recommend（main 包内的 home 子路由）。
 * 内容由 HERMES 推荐 / HotRankingBar / RecommendBoard 等组件拼装，至少验证能进得去 +
 * 一些关键文案存在。
 */
test.describe('首页 smoke', () => {
  test('1 · landing → /home/recommend 加载', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    // 顶级 page.tsx 重定向到 /home/recommend
    await page.waitForURL(/\/home\/recommend/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/home\/recommend/);
  });

  test('2 · recommend 页有 hero / 列表渲染', async ({ page }) => {
    await page.goto('http://localhost:3000/home/recommend');
    // 不要绑死文案（推荐位每周变），验首屏至少有 5 个可点击的卡片（推荐/排行榜/分类）
    const cards = page.locator('a, [role="button"], [class*="Card"]').filter({ hasNotText: '' });
    expect(await cards.count()).toBeGreaterThanOrEqual(5);
  });
});
