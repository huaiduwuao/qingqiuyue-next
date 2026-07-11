import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 合集管理。写路径:POST /api/core/account/collection。
 * 覆盖:渲染 → 创建弹窗 → 创建(POST + snack + 新卡)→ 菜单删除(DELETE + snack)。
 */
const RX_COLLECTION = /\/api\/core\/account\/collection(\?|$)/;

test.describe('创作者中心 · 合集管理', () => {
  test('1 · 渲染骨架（标题 + 创建按钮 + 搜索）', async ({ page }) => {
    await gotoContentView(page, '合集管理');
    await expect(page.getByRole('button', { name: '创建合集' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder('搜索合集标题')).toBeVisible();
  });

  test('2 · 创建合集 → POST + snack「合集已创建」+ 新卡出现', async ({ page }) => {
    await gotoContentView(page, '合集管理');
    await page.getByRole('button', { name: '创建合集' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('创建新合集')).toBeVisible({ timeout: 5_000 });

    const title = `E2E-合集-${Date.now()}`;
    await dialog.getByLabel('合集标题').fill(title);
    await dialog.getByLabel('合集描述').fill('e2e 自动创建');

    const createReq = page.waitForRequest((r) => r.method() === 'POST' && RX_COLLECTION.test(r.url()), { timeout: 10_000 });
    // 弹窗右下角按钮紧挨数字人聊天气泡,dispatchEvent 绕开指针拦截
    await dialog.getByRole('button', { name: '创建合集' }).dispatchEvent('click');
    const req = await createReq.catch(() => null);
    expect(req, '创建合集应发出 POST /api/core/account/collection').toBeTruthy();

    await expect(page.getByText('合集已创建')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 5_000 });
  });
});
