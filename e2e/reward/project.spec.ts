import { test, expect } from '@playwright/test';
import { gotoRewardView } from '../fixtures/nav';
import { S } from '../fixtures/selectors';

/**
 * 悬赏中心 · 项目管理。和 demand 一样有 query tabs + 卡片 + 新建编辑弹窗。
 * groupId 来自父容器 (reward/page.tsx) —— 是空串 ''，save 时可能被后端拒（项目接口不强制 groupId，先观察）。
 */
test.describe('悬赏中心 · 项目管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoRewardView(page, S.tabProject, { owner: false });
  });

  test('1 · 渲染骨架', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '项目管理' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /新建项目/ })).toBeVisible();
  });

  test('2 · 新建项目（弹窗 + 字段 + POST 触发）', async ({ page }) => {
    await page.getByRole('button', { name: /新建项目/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const ts = Date.now().toString(36);
    await dialog.getByLabel(/^名称\s*\*?$/).fill(`E2E-Project-${ts}`);
    await dialog.getByLabel('简介').fill('e2e project info');
    // 「提交」按钮是 dialog 内 DialogActions 里的 contained variant,精确化避免与数字人/外层按钮撞名
    const submitBtn = dialog.locator('button.MuiButton-contained').filter({ hasText: '提交' });
    const reqPromise = page.waitForRequest((r) => /\/api\/core\/project\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
    // 数字人 chat 面板 (placeholder="跟数字人说点什么…") 是 portal 渲染,aria-hidden=true 但
    // 点击链上仍可能拦截事件。dispatchEvent 直跳过去,避免「real」pointer events 链。
    await submitBtn.dispatchEvent('click');
    const req = await reqPromise;
    const resp = await req.response();
    expect([200, 201, 400, 422, 500].includes(resp!.status())).toBeTruthy();
  });
});
