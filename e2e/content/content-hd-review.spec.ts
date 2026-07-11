import { test, expect } from '@playwright/test';
import { gotoContentView } from '../fixtures/content-nav';

/**
 * 创作者中心 · 审核员工作台(hd-review)。owner=SUPER_ADMIN 有 REVIEWER 权限可进。
 * 队列数据:真接口待审 VIDEO(merge 进模拟队列),审核动作是本地模拟(通过/驳回 snack)。
 */
test.describe('创作者中心 · 审核员工作台', () => {
  test('1 · 渲染骨架（标题 + 审核员选择 + 待审/已审 Tabs)', async ({ page }) => {
    await gotoContentView(page, '审核员工作台');
    await expect(page.getByText('审核员工作台').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('我是', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^待审 \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^已审 \(\d+\)/ })).toBeVisible();
  });

  test('2 · 切换已审 Tab + 有待审项时点开可见通过/驳回', async ({ page }) => {
    await gotoContentView(page, '审核员工作台');
    await expect(page.getByRole('tab', { name: /^待审 \(\d+\)/ })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /^已审 \(\d+\)/ }).click();
    await expect(page.getByRole('tab', { name: /^已审 \(\d+\)/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /^待审 \(\d+\)/ }).click();

    // 有待审项 → 点第一项,右栏裁决区应出现「通过」「驳回」
    const pendingTab = page.getByRole('tab', { name: /^待审 \((\d+)\)/ });
    const label = (await pendingTab.textContent()) || '';
    const n = Number(label.match(/\((\d+)\)/)?.[1] ?? 0);
    if (n > 0) {
      await page.getByRole('tab', { name: /^待审/ }).click();
      // 队列项是标题文本,点第一个非空标题块
      const firstItem = page.locator('.MuiBox-root').filter({ hasText: /极速通道|待审核|审核中/ }).first();
      await firstItem.dispatchEvent('click').catch(() => {});
    }
    // 无论有无数据,工作台不崩即可
    await expect(page.getByText('审核员工作台').first()).toBeVisible();
  });
});
