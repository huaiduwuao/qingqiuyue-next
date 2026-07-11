import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 活动管理。数据:getActivityList(真接口)。
 * 写路径:立即报名 → 报名弹窗 → 勾选同意规则 → 确认报名(POST /api/core/activity/signup)
 * → snack「已成功报名《…》」。
 */
const RX_SIGNUP = /\/api\/core\/activity\/signup(\?|$)/;

test.describe('创作者中心 · 活动管理', () => {
  test('1 · 渲染骨架（标题 + 搜索 + 排序）', async ({ page }) => {
    await gotoContentView(page, '活动管理');
    await expect(page.getByText('活动管理').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder('搜索活动名称 / 主办方')).toBeVisible();
    await expect(page.getByText('浏览平台活动 · 报名参与 · 投稿作品 · 查看获奖')).toBeVisible();
  });

  test('2 · 立即报名 → 勾选规则 → 确认报名 → POST + snack', async ({ page }) => {
    await gotoContentView(page, '活动管理');
    // 报名是单向持久化:全部报过名就没有「立即报名」了 → 幂等 skip
    const signupBtn = page.getByRole('button', { name: '立即报名' }).first();
    const hasSignup = await signupBtn.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
    test.skip(!hasSignup, '当前账号所有可报名活动均已报名,无「立即报名」入口');
    await signupBtn.dispatchEvent('click'); // 数字人聊天气泡可能拦截,绕开

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/^报名《/)).toBeVisible({ timeout: 5_000 });
    // 未勾选规则 → 确认报名 disabled
    const confirmBtn = dialog.getByRole('button', { name: '确认报名' });
    await expect(confirmBtn).toBeDisabled();
    await dialog.getByText('我已阅读并同意以上规则,自愿参与本活动').click();
    await expect(confirmBtn).toBeEnabled();

    const signupReq = page.waitForRequest((r) => r.method() === 'POST' && RX_SIGNUP.test(r.url()), { timeout: 10_000 });
    await confirmBtn.click();
    const req = await signupReq.catch(() => null);
    expect(req, '确认报名应发出 POST /api/core/activity/signup').toBeTruthy();

    await expect(page.getByText(/^已成功报名《/)).toBeVisible({ timeout: 8_000 });
  });
});
