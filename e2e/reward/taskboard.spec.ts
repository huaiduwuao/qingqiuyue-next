import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import { gotoTaskboard } from '../fixtures/nav';
import { waitList, waitAction, waitDelete, RX } from '../fixtures/api';
import { S } from '../fixtures/selectors';

function readSeed() {
  try {
    return JSON.parse(fs.readFileSync('e2e/.auth/seed.json', 'utf-8'));
  } catch {
    return { linkTitle: 'E2E-链路-Seed', deleteTitle: 'E2E-删除-Seed' };
  }
}
const SEED = readSeed();

async function openTaskDetail(page: Page, title: string) {
  await page.getByText(title).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

test.describe('悬赏中心 · 协作看板', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTaskboard(page); // owner=true，默认 project 视图（projects[0] 即 E2E-Project）
  });

  test('1 · 导航进入看板且 owner 可新建', async ({ page }) => {
    for (const label of [S.viewMine, S.viewAll, S.viewTeam, S.viewProject]) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(page).toHaveURL(/\/account\/reward/); // 无 deep link，URL 不变
    await expect(page.getByRole('button', { name: S.newTask })).toBeEnabled(); // owner 对齐代理信号
  });

  test('2 · 新建任务表单（弹窗/标题/团队下拉列 E2E-Group）', async ({ page }) => {
    await page.getByRole('button', { name: S.newTask }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(S.title)).toBeVisible();
    // 团队下拉能列出 seed 的 E2E-Group（验证 groups 数据通路）
    const teamFC = dialog.locator('.MuiFormControl-root').filter({ hasText: '所属团队' });
    await teamFC.getByRole('combobox').click();
    await expect(page.getByRole('option', { name: 'E2E-Group' })).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: S.cancel }).click(); // 不保存（创建由 seed 覆盖，绕开多选 Select 保存）
  });

  test('4 · 链路 · 认领 → 提交 → 审稿', async ({ page }) => {
    const dialog = await openTaskDetail(page, SEED.linkTitle);

    // 认领（OPEN 且未分配 →「我来认领」）
    const claimBtn = dialog.getByRole('button', { name: S.claim });
    await expect(claimBtn).toBeVisible({ timeout: 5000 });
    // 同时等 LIST 的 invalidate 触发的 GET —— 比按钮点击更早挂监听才能抓到微任务内的 refetch
    const listRefetch = page.waitForResponse((r) => RX.taskList.test(r.url()), { timeout: 8_000 });
    const [claimResp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/core\/task\/\d+\/claim/.test(r.url())),
      claimBtn.click(),
    ]);
    const claimBody = await claimResp.json().catch(() => ({} as any));
    console.log('[diag] claim resp', claimResp.status(), JSON.stringify(claimBody));
    await expect(page.getByText(S.opSuccess)).toBeVisible({ timeout: 5000 });
    // 后端响应后 handleTaskChanged → invalidateQueries 触发列表 refetch；在窗口内必到，故容忍竞争
    await listRefetch.catch(() => { /* 已发过的请求略过 */ });

    // 提交（负责人可见交付物输入 + 提交）
    const deliverable = dialog.getByPlaceholder('交付物链接 / 文本说明');
    await expect(deliverable).toBeVisible({ timeout: 5000 });
    const listRefetch2 = page.waitForResponse((r) => RX.taskList.test(r.url()), { timeout: 8_000 });
    await Promise.all([waitAction(page, 'submit'), dialog.getByRole('button', { name: S.submit }).click()]);
    await expect(page.getByText(S.opSuccess)).toBeVisible({ timeout: 5000 });
    await listRefetch2.catch(() => {});

    // 审稿通过（owner）
    await expect(dialog.getByRole('button', { name: S.approve })).toBeVisible({ timeout: 5000 });
    const listRefetch3 = page.waitForResponse((r) => RX.taskList.test(r.url()), { timeout: 8_000 });
    await Promise.all([waitAction(page, 'review'), dialog.getByRole('button', { name: S.approve }).click()]);
    await expect(page.getByText(S.opSuccess)).toBeVisible({ timeout: 5000 });
    await listRefetch3.catch(() => {});
  });

  test('7 · 删除任务', async ({ page }) => {
    const dialog = await openTaskDetail(page, SEED.deleteTitle);
    page.once('dialog', (d) => d.accept()); // 删除用 window.confirm，默认 dismiss 会取消 → 必须 accept
    const listRefetch = page.waitForResponse((r) => RX.taskList.test(r.url()), { timeout: 8_000 });
    await Promise.all([waitDelete(page), dialog.getByRole('button', { name: S.delete }).click()]);
    await expect(page.getByText(S.deleted)).toBeVisible({ timeout: 5000 });
    await listRefetch.catch(() => {});
    await expect(page.getByText(SEED.deleteTitle)).toHaveCount(0, { timeout: 10_000 });
  });
});
