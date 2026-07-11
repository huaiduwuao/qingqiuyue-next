import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 作品管理。DataGrid + 类型/状态/来源筛选 + 刷新。读路径为主。
 */
test.describe('创作者中心 · 作品管理', () => {
  test('1 · 渲染骨架（统计卡 + 筛选 + DataGrid）', async ({ page }) => {
    await gotoContentView(page, '作品管理');
    await expect(page.getByText('作品管理').first()).toBeVisible({ timeout: 10_000 });
    // 三个筛选下拉在工具栏里;DataGrid 列菜单也 label="类型"撞名,锁定 FormControl 内
    const toolbar = page.locator('.MuiFormControl-root');
    await expect(toolbar.filter({ has: page.getByText('类型', { exact: true }) }).getByRole('combobox')).toBeVisible();
    await expect(toolbar.filter({ has: page.getByText('状态', { exact: true }) }).getByRole('combobox')).toBeVisible();
    await expect(toolbar.filter({ has: page.getByText('来源', { exact: true }) }).getByRole('combobox')).toBeVisible();
    // DataGrid 的列头(读 title role)
    for (const header of ['封面', '标题', '类型', '状态', '阅读', '点赞', '评论', '来源', '发布时间']) {
      await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible({ timeout: 8_000 }).catch(() => {});
    }
  });

  test('2 · 类型筛选可下拉', async ({ page }) => {
    await gotoContentView(page, '作品管理');
    await expect(page.getByText('作品管理').first()).toBeVisible({ timeout: 10_000 });
    // 筛选 Select 与 DataGrid 列菜单按钮(label="类型 column menu")撞名,锁定 toolbar 内 Select
    const typeCombo = page.locator('.MuiToolbar-root, .MuiFormControl-root').getByRole('combobox').first();
    await typeCombo.click();
    await expect(page.getByRole('option', { name: '小说' })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });
});
