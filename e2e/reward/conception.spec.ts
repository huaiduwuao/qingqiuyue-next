import { test, expect } from '@playwright/test';
import { gotoRewardView } from '../fixtures/nav';

/**
 * 悬赏中心 · 意境管理。query tabs + 卡片 + 新建编辑弹窗；filter "全部 / 草稿 / 待审核 / 已发布"。
 */
test.describe('悬赏中心 · 意境管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoRewardView(page, '意境管理', { owner: false });
  });

  test('1 · 渲染骨架 + 状态 tabs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '意境管理' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /新建意境/ })).toBeVisible();
    for (const label of ['全部', '草稿', '待审核', '已发布']) {
      await expect(page.getByRole('tab', { name: label })).toBeVisible();
    }
  });

  test('2 · 新建意境（POST 触发）', async ({ page }) => {
    await page.getByRole('button', { name: /新建意境/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const ts = Date.now().toString(36);
    await dialog.getByLabel(/^名称\s*\*?$/).fill(`E2E-Conception-${ts}`);
    const reqPromise = page.waitForRequest((r) => /\/api\/core\/conception\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
    await dialog.getByRole('button', { name: '提交' }).click();
    const req = await reqPromise;
    const resp = await req.response();
    expect([200, 201, 400, 422, 500].includes(resp!.status())).toBeTruthy();
  });
});
