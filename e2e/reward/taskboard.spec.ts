import { test, expect, type Page } from '@playwright/test';
import { gotoTaskboard } from '../fixtures/nav';
import { waitCreate, waitList, waitAction, waitDelete } from '../fixtures/api';
import { S, uniqueTitle } from '../fixtures/selectors';

/** 在新建弹窗里填标题 + 选第一个团队（MUI 多选 Select）。 */
async function fillNewTaskDialog(page: Page, title: string) {
  await page.getByLabel(S.title).fill(title);
  // 所属团队（多选）：展开 → 选第一项 → 关闭
  await page.getByRole('combobox', { name: S.groups }).click();
  await page.getByRole('option').first().click();
  await page.keyboard.press('Escape');
}

test.describe('悬赏中心 · 协作看板', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTaskboard(page); // owner=true，看板 owner 视角
  });

  test('1 · 导航进入看板且 owner 可新建', async ({ page }) => {
    for (const label of [S.viewMine, S.viewAll, S.viewTeam, S.viewProject]) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(page).toHaveURL(/\/account\/reward/); // 无 deep link，URL 不变
    await expect(page.getByRole('button', { name: S.newTask })).toBeEnabled(); // owner 对齐代理信号
  });

  test.describe.serial('链路 · 新建 → 认领 → 提交 → 审稿', () => {
    const title = uniqueTitle('E2E-链路');

    test('2 · 新建任务', async ({ page }) => {
      await page.getByRole('button', { name: S.newTask }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await fillNewTaskDialog(page, title);

      const [req] = await Promise.all([waitCreate(page), page.getByRole('button', { name: S.save }).click()]);
      expect(req.method()).toBe('POST');
      await expect(page.getByText(S.saved)).toBeVisible({ timeout: 5000 });
      await waitList(page); // invalidateQueries 刷新
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
    });

    test('4 · 认领 → 提交 → 审稿', async ({ page }) => {
      // 打开详情
      await page.getByText(title).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // 认领（OPEN 且无负责人时显示「我来认领」）
      if (await dialog.getByRole('button', { name: S.claim }).isVisible().catch(() => false)) {
        await Promise.all([waitAction(page, 'claim'), dialog.getByRole('button', { name: S.claim }).click()]);
        await expect(page.getByText(S.opSuccess)).toBeVisible({ timeout: 5000 });
        await waitList(page);
      }

      // 提交（负责人可见交付物输入 + 提交）
      const deliverable = dialog.getByPlaceholder('交付物链接 / 文本说明');
      await expect(deliverable).toBeVisible({ timeout: 5000 });
      await deliverable.fill('e2e-deliverable');
      await Promise.all([waitAction(page, 'submit'), dialog.getByRole('button', { name: S.submit }).click()]);
      await expect(page.getByText(S.opSuccess)).toBeVisible({ timeout: 5000 });
      await waitList(page);

      // 审稿通过（owner）
      await expect(dialog.getByRole('button', { name: S.approve })).toBeVisible({ timeout: 5000 });
      await Promise.all([waitAction(page, 'review'), dialog.getByRole('button', { name: S.approve }).click()]);
      await expect(page.getByText(S.opSuccess)).toBeVisible({ timeout: 5000 });
      await waitList(page);
    });
  });

  test('7 · 删除任务', async ({ page }) => {
    const title = uniqueTitle('E2E-删除');
    await page.getByRole('button', { name: S.newTask }).click();
    await fillNewTaskDialog(page, title);
    await Promise.all([waitCreate(page), page.getByRole('button', { name: S.save }).click()]);
    await expect(page.getByText(S.saved)).toBeVisible({ timeout: 5000 });
    await waitList(page);

    await page.getByText(title).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    page.once('dialog', (d) => d.accept()); // 删除用 window.confirm，默认 dismiss 会取消 → 必须 accept
    await Promise.all([waitDelete(page), dialog.getByRole('button', { name: S.delete }).click()]);
    await expect(page.getByText(S.deleted)).toBeVisible({ timeout: 5000 });
    await waitList(page);
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 });
  });
});
