import { expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import { waitList } from './api';
import { S } from './selectors';

/**
 * 进入悬赏中心某视图。reward 是客户端单页（tabKey 切视图，无 deep link），只能：
 *   goto /account/reward[?owner=1] → 点 sidebar item → 等 Suspense fallback 消失
 *
 * label 取 S.tabXxx（'赏金广场' / '需求管理' / ...）。
 */
export async function gotoRewardView(page: Page, label: string, { owner = false }: { owner?: boolean } = {}) {
  await page.goto(`/account/reward${owner ? '?owner=1' : ''}`);
  await page.getByRole('button', { name: label }).first().click();
  // 等懒加载 chunk（Suspense fallback「加载中…」）消失
  await expect(page.getByText('加载中…')).toBeHidden({ timeout: 15_000 }).catch(() => {});
}

/**
 * taskboard 是 owner 视角触发「新建任务」按钮 + 看板列展示，单独封装一下 owner=1。
 * 显式按 seed project 选择项目（其它 spec 里写的 E2E-Project-{ts} 会污染 projects[0]
 * 默认选中,导致看板任务列表是别人刚建的空项目 → 找不到种子任务）。
 */
export async function gotoTaskboard(page: Page, { owner = true }: { owner?: boolean } = {}) {
  await gotoRewardView(page, S.tabTaskboard, { owner });
  await expect(page.getByRole('button', { name: '我的任务', exact: true })).toBeVisible({ timeout: 15_000 });
  // 选 seed 项目（来自 seed.json.projectName）
  let projectName = 'E2E-Project';
  try {
    const seed = JSON.parse(fs.readFileSync('e2e/.auth/seed.json', 'utf-8'));
    if (seed?.projectName) projectName = seed.projectName;
  } catch { /* 用默认 */ }
  // 工具栏里 3 个 Select:项目 / 优先级 / 负责人;项目 FormControl 含「选择项目」/ 或当前项目名。
  const projectFC = page.locator('.MuiFormControl-root').filter({
    hasText: /^(选择项目|E2E-Project)/,
  }).first();
  if (await projectFC.count() > 0) {
    await projectFC.getByRole('combobox').click().catch(() => {});
    await page.getByRole('option', { name: projectName, exact: true }).first().click().catch(() => {});
  }
  await waitList(page).catch(() => {});
}
