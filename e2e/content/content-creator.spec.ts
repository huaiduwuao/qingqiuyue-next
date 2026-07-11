import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/** 创作者中心 · 等级勋章。读路径:等级卡 + 进度 + 勋章。 */
test.describe('创作者中心 · 等级勋章', () => {
  test('1 · 渲染骨架（等级 + 进度条）', async ({ page }) => {
    await gotoContentView(page, '等级勋章');
    await expect(page.getByText('距离下一等级')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/已创作 \d+ 天/)).toBeVisible();
  });
});
