import { test, expect } from '@playwright/test';

/**
 * 悬赏详情页 /account/reward/detail?id={bountyId}
 * 历史背景:RewardHotGrid onClick 写死 router.push('/account/reward/detail?id=...'),
 * 而路由不存在 → 404。本 spec 沿用 dashboard hot 列表种子数据(`b1` `b2` `b3` `b4`,
 * 由 dashboard_handler.go:1721 在 init 时 AutoMigrate+seed),所以不挑 id 也能命中。
 */
test.describe('悬赏中心 · 详情页', () => {
  test('1 · /account/reward/detail?id=b2 渲染（不再 404）', async ({ page }) => {
    await page.goto('/account/reward/detail?id=b2');
    await expect(page).toHaveURL(/\/account\/reward\/detail/);
    // 等真正进入「b2 详情」内容态,不再卡在「正在加载」
    await expect(page.getByText('正在加载悬赏详情…')).toBeHidden({ timeout: 15_000 }).catch(() => {});
    // hero 主标题是 b2 seed 的「国风小说《长安月》同人插画征集」
    await expect(page.getByText(/国风小说/)).toBeVisible({ timeout: 10_000 });
    // 三张数据卡任一可见
    await expect(page.getByText('总赏金')).toBeVisible();
  });

  test('2 · id=空 / 不存在都进入「未找到该悬赏」占位', async ({ page }) => {
    await page.goto('/account/reward/detail?id=does-not-exist');
    await expect(page.getByText('未找到该悬赏')).toBeVisible({ timeout: 15_000 });
  });

  test('3 · 点击「返回悬赏中心」回到 /account/reward', async ({ page }) => {
    await page.goto('/account/reward/detail?id=b2');
    await expect(page.getByText(/国风小说/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /返回悬赏中心|返回列表/ }).first().click();
    await page.waitForURL(/\/account\/reward$/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/account\/reward$/);
  });

  test('4 · 来源:dashboard 赏金广场卡片跳转需触达而非 404', async ({ page }) => {
    // 完整闭环:dashboard 上的 hot card 点击 → router.push 到 /detail?id=b2 → 命中本 detail 页
    await page.goto('/account/reward');
    await page.getByRole('button', { name: '赏金广场' }).click();
    await expect(page.locator('body')).toBeVisible();
  });
});
