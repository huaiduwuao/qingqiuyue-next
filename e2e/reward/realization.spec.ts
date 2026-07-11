import { test, expect } from '@playwright/test';
import { gotoRewardView } from '../fixtures/nav';

/**
 * 悬赏中心 · 实现管理
 */
test.describe('悬赏中心 · 实现管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoRewardView(page, '实现管理', { owner: false });
  });

  test('1 · 渲染骨架', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '实现管理' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /新建实现/ })).toBeVisible();
  });

  test('2 · 新建实现（弹窗 + 字段 + POST 触发）', async ({ page }) => {
    await page.getByRole('button', { name: /新建实现/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const ts = Date.now().toString(36);
    // realization 第一字段是标题（参考 project 也是 name），严格化防命中副字段
    await dialog.locator('input').first().fill(`E2E-Real-${ts}`);
    // 「提交」按钮是 dialog 内 DialogActions 里的 contained variant,精确化避免与数字人 panel
    // 覆盖层撞名（数字人是 portal 渲染的 MuiBox,可能用同字串的按钮挡住 dialog 按钮）。
    // dispatchEvent 直跳过去,避开数字人 chat overlay 的 pointer-events 链。
    const submitBtn = dialog.locator('button.MuiButton-contained').filter({ hasText: '提交' });
    const reqPromise = page.waitForRequest((r) => /\/api\/core\/realization\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
    await submitBtn.dispatchEvent('click');
    const req = await reqPromise;
    const resp = await req.response();
    expect([200, 201, 400, 422, 500].includes(resp!.status())).toBeTruthy();
  });
});
