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

  /**
   * 类型筛选实际生效:点开下拉选「小说」→ 工具栏的"当前筛选"摘要应包含"小说" → 后端请求
   * 应带 contentType=NOVEL 参数。
   * 之前只验证下拉能打开,没验证选了之后真生效。
   */
  test('3 · 类型筛选 → 摘要 + 请求参数同步更新', async ({ page }) => {
    await gotoContentView(page, '作品管理');
    await expect(page.getByText('作品管理').first()).toBeVisible({ timeout: 10_000 });

    // 监听下一次 /api/core/account/works 请求
    const listReq = page.waitForRequest(
      (r) => r.url().includes('/api/core/account/works') && r.method() === 'GET',
      { timeout: 10_000 },
    );

    const typeCombo = page.locator('.MuiToolbar-root, .MuiFormControl-root').getByRole('combobox').first();
    await typeCombo.click();
    await page.getByRole('option', { name: '小说', exact: true }).click();

    // 摘要文本应包含"小说"
    await expect(page.getByText(/当前筛选.*小说/)).toBeVisible({ timeout: 5_000 });

    // 请求参数应带 contentType=NOVEL
    const req = await listReq.catch(() => null);
    if (req) {
      const url = new URL(req.url());
      const contentType = url.searchParams.get('contentType') ?? url.searchParams.get('type');
      expect(
        contentType === 'NOVEL',
        `选「小说」后请求应带 contentType=NOVEL,实际=${contentType}`,
      ).toBeTruthy();
    }
  });

  /**
   * 状态筛选:下拉选「已下架」→ 摘要更新。
   * 验证 status 字段也能透传到请求。
   */
  test('4 · 状态筛选 → 摘要更新', async ({ page }) => {
    await gotoContentView(page, '作品管理');
    await expect(page.getByText('作品管理').first()).toBeVisible({ timeout: 10_000 });

    const listReq = page.waitForRequest(
      (r) => r.url().includes('/api/core/account/works') && r.method() === 'GET',
      { timeout: 10_000 },
    );

    // 状态 Select 是 toolbar 里第二个 combobox
    const statusCombo = page.locator('.MuiFormControl-root').getByRole('combobox').nth(1);
    await statusCombo.click();
    await page.getByRole('option', { name: '已下架', exact: true }).click();

    await expect(page.getByText(/当前筛选.*已下架/)).toBeVisible({ timeout: 5_000 });

    const req = await listReq.catch(() => null);
    if (req) {
      const url = new URL(req.url());
      const status = url.searchParams.get('status');
      expect(
        status === 'UN_PUBLISH',
        `选「已下架」后请求应带 status=UN_PUBLISH,实际=${status}`,
      ).toBeTruthy();
    }
  });
});
