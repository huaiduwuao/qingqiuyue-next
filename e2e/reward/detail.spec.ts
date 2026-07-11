import { test, expect } from '@playwright/test';

/**
 * 悬赏中心 · 页内弹层（不跳转路由）。
 * 背景:/account/reward/detail?id=b2 独立路由已按需求移除,详情/全部列表/完整榜单
 * 全部改为 dashboard 内弹层(BountyDetailDialog / BountyListDialog / RankingListDialog),
 * URL 全程保持在 /account/reward。seed:b1~b4 hot bounty(后端 init seed,
 * b2 =「国风小说《长安月》同人插画征集」)。
 */
test.describe('悬赏中心 · 页内弹层（不跳转）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/account/reward');
    await expect(page.getByText('热门悬赏')).toBeVisible({ timeout: 15_000 });
  });

  test('1 · 点击热门悬赏卡 → 详情弹层，URL 不变', async ({ page }) => {
    const card = page.getByText(/国风小说/).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // exact:true ——「正在加载悬赏详情…」含子串「悬赏详情」会撞 strict mode
    await expect(dialog.getByText('悬赏详情', { exact: true })).toBeVisible();
    await expect(dialog.getByText('总赏金')).toBeVisible();
    await expect(dialog.getByText('已接悬赏')).toBeVisible();
    await expect(page).toHaveURL(/\/account\/reward$/);
  });

  test('2 · 详情弹层可关闭且不离开当前页', async ({ page }) => {
    await page.getByText(/国风小说/).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: '关闭' }).first().click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/account\/reward$/);
  });

  test('3 · 查看全部 → 列表弹层 → 行点击进详情弹层', async ({ page }) => {
    await page.getByText('查看全部').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('全部悬赏')).toBeVisible();
    await expect(page).toHaveURL(/\/account\/reward$/);
    // 行点击 → 详情弹层叠在列表之上,取最后一个 dialog
    await dialog.getByText(/国风小说/).first().click();
    await expect(page.getByRole('dialog').last().getByText('悬赏详情', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/account\/reward$/);
  });

  test('4 · 达人榜「查看完整榜单」→ 榜单弹层', async ({ page }) => {
    await page.getByText('查看完整榜单 →').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('悬赏达人榜 · 完整榜单')).toBeVisible();
    await expect(page).toHaveURL(/\/account\/reward$/);
  });
});
