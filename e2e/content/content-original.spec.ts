import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 原创保护。真接口(3 类维权数据,uid 隔离)。
 * Tabs:存证管理 / 侵权监测 / …(带计数)。渲染骨架 + tab 切换。
 */
test.describe('创作者中心 · 原创保护', () => {
  test('1 · 渲染骨架（标题 + 存证/监测 Tabs)', async ({ page }) => {
    await gotoContentView(page, '原创保护');
    await expect(page.getByText('原创保护中心')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /^存证管理/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^侵权监测/ })).toBeVisible();
  });

  test('2 · Tab 切换到侵权监测不崩', async ({ page }) => {
    await gotoContentView(page, '原创保护');
    const tab = page.getByRole('tab', { name: /^侵权监测/ });
    await expect(tab).toBeVisible({ timeout: 10_000 });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('原创保护中心')).toBeVisible();
  });
});
