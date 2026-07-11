import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 爬虫管理。真接口:health/stats(服务健康 · N 引擎运行中 + 抓取页/发现链接/入库条目)。
 */
test.describe('创作者中心 · 爬虫管理', () => {
  test('1 · 渲染骨架（标题 + 健康状态 + 三项统计 + 类型 Tabs)', async ({ page }) => {
    await gotoContentView(page, '爬虫管理');
    await expect(page.getByText('爬虫管理中心').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/服务健康 · \d+ 引擎运行中/)).toBeVisible({ timeout: 10_000 });
    for (const t of ['抓取页', '发现链接', '入库条目']) {
      await expect(page.getByText(t).first()).toBeVisible();
    }
    // 类型 Tabs 至少一个
    await expect(page.getByRole('tab').first()).toBeVisible();
  });
});
