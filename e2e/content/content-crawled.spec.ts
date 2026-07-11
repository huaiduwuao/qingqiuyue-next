import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 抓取内容(直接复用 (main)/crawled 页)。DataGrid + 来源统计。
 */
test.describe('创作者中心 · 抓取内容', () => {
  test('1 · 渲染骨架（标题 + DataGrid 列头）', async ({ page }) => {
    await gotoContentView(page, '抓取内容');
    await expect(page.getByRole('heading', { name: '抓取内容' })).toBeVisible({ timeout: 10_000 });
    // DataGrid 至少渲染出表头区
    await expect(page.getByRole('columnheader').first()).toBeVisible({ timeout: 10_000 });
  });
});
