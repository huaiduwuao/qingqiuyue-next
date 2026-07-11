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

  test('3 · 作品管理「发布作品」→ 切 tab 不跳转路由', async ({ page }) => {
    await page.goto('/account/content');
    const btn = page.getByRole('button', { name: '发布作品' }).first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    // 进入高清发布视图,URL 保持 /account/content(hd-publish 不是路由)
    await expect(page.getByText('灵感发现').first()).not.toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/account\/content$/);
  });
});
