import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 共创中心。四个 tab:我的共创 / 邀请我的 / 我邀请的 / 推荐合作。
 * 注意:后端 /api/core/co-create/{recommend,invites,collabs} 目前 404(未部署),
 * 推荐列表恒空,邀请写路径暂时无法真测 —— 见 test.fixme。
 */
test.describe('创作者中心 · 共创中心', () => {
  test('1 · 渲染骨架（标题 + 四 Tabs + 发起共创）', async ({ page }) => {
    await gotoContentView(page, '共创中心');
    await expect(page.getByText('共创中心').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /^我的共创/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^邀请我的/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^我邀请的/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: '推荐合作' })).toBeVisible();
    await expect(page.getByRole('button', { name: '发起共创' })).toBeVisible();
  });

  test('2 · 推荐合作 tab:搜索框可输入,接口空载不崩', async ({ page }) => {
    await gotoContentView(page, '共创中心');
    await page.getByRole('tab', { name: '推荐合作' }).click();
    const search = page.getByPlaceholder('搜索创作者名称或领域');
    await expect(search).toBeVisible({ timeout: 10_000 });
    await search.fill('测试');
    await search.fill('');
    // 页面仍稳定(标题在)
    await expect(page.getByText('共创中心').first()).toBeVisible();
  });

  test.fixme('3 · 邀请共创写路径(待后端 /api/core/co-create/* 部署)', async ({ page }) => {
    await gotoContentView(page, '共创中心');
    await page.getByRole('tab', { name: '推荐合作' }).click();
    const inviteBtn = page.getByRole('button', { name: '邀请共创' }).first();
    await expect(inviteBtn).toBeVisible({ timeout: 10_000 });
    await inviteBtn.dispatchEvent('click');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('邀请共创')).toBeVisible({ timeout: 5_000 });
    const sendBtn = dialog.getByRole('button', { name: '发送邀请' });
    await expect(sendBtn).toBeDisabled();
    await dialog.getByLabel('项目 ID').fill(`e2e-collab-${Date.now()}`);
    await dialog.getByLabel('角色').fill('拍摄');
    await dialog.getByLabel('共创说明 / 合作意向').fill('e2e 自动邀请');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();
    await expect(page.getByText(/已向 @.+ 发送共创邀请/)).toBeVisible({ timeout: 8_000 });
  });
});
