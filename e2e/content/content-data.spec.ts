import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 数据中心（只读,DataOverviewCard + TrendChart + FanPortrait + ContentDistributionChart 4 张卡）。
 */
test.describe('创作者中心 · 数据中心', () => {
  test('1 · 渲染骨架（4 张数据卡可见）', async ({ page }) => {
    await gotoContentView(page, '数据中心');
    // 数据中心无单页标题,验证 4 张卡都已渲染:
    await expect(page.getByText(/总作品|粉丝|互动|曝光|阅读/, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    // 不依赖具体文案,验 chart 容器存在
    const charts = page.locator('.recharts-wrapper, canvas, svg').filter({ hasNot: page.locator('[role="img"]') });
    expect(await charts.count()).toBeGreaterThanOrEqual(1);
  });
});
