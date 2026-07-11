import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 工作台(默认 /account/content,DashboardHomePage)。
 * 整页只读：Hero + 4 步区块（灵感/创作/数据/作品管理）。无写路径，验证关键模块骨架。
 */
test.describe('创作者中心 · 工作台', () => {
  test('1 · 渲染骨架（4 大分区标题可见）', async ({ page }) => {
    await page.goto('/account/content');
    // 关键分区标题
    for (const title of ['灵感发现', '开始创作', '数据洞察', '作品管理']) {
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('2 · 侧栏切换其它视图', async ({ page }) => {
    await gotoContentView(page, '高清发布');
    // 高清发布是独立视图,不应继续显示「灵感发现」
    await expect(page.getByText('灵感发现').first()).not.toBeVisible();
  });
});
