import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/** 创作者中心 · 变现中心。读路径:收益总览 + 余额(wallet_tx 流水)。 */
test.describe('创作者中心 · 变现中心', () => {
  test('1 · 渲染骨架（收益总览 + 当前余额）', async ({ page }) => {
    await gotoContentView(page, '变现中心');
    await expect(page.getByText('收益总览')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('当前余额 (元)')).toBeVisible();
    await expect(page.getByText(/^¥[\d,]+\.\d{2}$/).first()).toBeVisible();
  });
});
