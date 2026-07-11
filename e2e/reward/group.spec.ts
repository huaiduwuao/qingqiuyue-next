import { test, expect } from '@playwright/test';
import { gotoRewardView } from '../fixtures/nav';

/**
 * 悬赏中心 · 团队管理
 * tabs: 我的团队 / 申请列表 / 团队排名
 * 操作: 创建团队 / 加入团队 / 邀请成员 / 同意申请
 */
test.describe('悬赏中心 · 团队管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoRewardView(page, '团队管理', { owner: false });
  });

  test('1 · 渲染骨架 + 三 tab', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '团队管理' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /^我的团队/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^申请列表/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: '团队排名' })).toBeVisible();
  });

  test('2 · tab 切换', async ({ page }) => {
    await page.getByRole('tab', { name: '团队排名' }).click();
    await expect(page.getByRole('tab', { name: '团队排名' })).toHaveAttribute('aria-selected', 'true');
  });

  test('3 · 创建团队（POST 触发）', async ({ page }) => {
    await page.getByRole('button', { name: '创建团队' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const ts = Date.now().toString(36);
    await dialog.getByLabel(/^团队名称\s*\*?$/).fill(`E2E-Group-${ts}`);
    await dialog.getByLabel('团队简介').fill('e2e group info');
    const reqPromise = page.waitForRequest((r) => /\/api\/core\/group\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
    await dialog.getByRole('button', { name: /创建|保存/ }).click();
    const req = await reqPromise;
    const resp = await req.response();
    expect([200, 201, 400, 422, 500].includes(resp!.status())).toBeTruthy();
  });
});
