import { test, expect, request as pwRequest, type Page, type APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import { S } from '../fixtures/selectors';

/**
 * 悬赏中心 · 全流程真实交互测试(保留数据)
 * --------------------------------------------------------------
 * 团队 → 项目 → 5 个需求(5 种状态)→ 7 个任务(5 种状态)→ 自动待结账 →
 * 结账 → 意境 ×2 → 实现 ×2 → 赏金广场验证。
 *
 * 全程真实点击,不清理任何数据;实体名带时间戳,跑完后:
 *  - e2e/.auth/fullflow-result.json 记录全部实体 id/最终状态(后端回查)
 *  - test-results/fullflow/*.png 每个阶段截图
 *
 * 前置:core-api 已含需求状态机修复(process body 绑定 / SETTLED 大写 /
 * ReviewTask 通过自动 COMPLETED),且 reward/page.tsx 已注入真实 groupId。
 */

const TS = Date.now().toString(36);
const RESULT_FILE = 'e2e/.auth/fullflow-result.json';
const SHOT_DIR = 'test-results/fullflow';

const N = {
  group: `E2E-全链-团队-${TS}`,
  project: `E2E-全链-项目-${TS}`,
  demandPending: `E2E-全链-需求-待发布-${TS}`,
  demandPublished: `E2E-全链-需求-进行中-${TS}`,
  demandClosed: `E2E-全链-需求-已关闭-${TS}`,
  demandSettled: `E2E-全链-需求-已结算-${TS}`,
  demandCompleted: `E2E-全链-需求-待结账-${TS}`,
  taskOpen: `E2E-全链-任务-待领-${TS}`,
  taskClaimed: `E2E-全链-任务-进行中-${TS}`,
  taskSubmitted: `E2E-全链-任务-待验收-${TS}`,
  taskApprovedA: `E2E-全链-任务-已通过甲-${TS}`,
  taskApprovedB: `E2E-全链-任务-已通过乙-${TS}`,
  taskForCompleted: `E2E-全链-任务-待结账需求用-${TS}`,
  taskRejected: `E2E-全链-任务-已驳回-${TS}`,
  conceptionA: `E2E-全链-意境-甲-${TS}`,
  conceptionB: `E2E-全链-意境-乙-${TS}`,
  realizationA: `E2E-全链-实现-甲-${TS}`,
  realizationB: `E2E-全链-实现-乙-${TS}`,
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 真实封面图(picsum 按 seed 出图;即使网络不通,URL 本身也是真实数据流) */
const COVER = (seed: string) => `https://picsum.photos/seed/qqy-${TS}-${seed}/400/225`;

/** 各需求的分类/封面/酬劳 —— 广场真实数据 + 分类过滤的验证基础 */
const DEMAND_OPTS: Record<string, { categoryLabel: string; cover: string; pay: number }> = {
  [N.demandPending]: { categoryLabel: '图文', cover: COVER('pending'), pay: 100 },
  [N.demandPublished]: { categoryLabel: '图文', cover: COVER('published'), pay: 800 },
  [N.demandClosed]: { categoryLabel: '小说', cover: COVER('closed'), pay: 300 },
  [N.demandSettled]: { categoryLabel: '短视频', cover: COVER('settled'), pay: 600 },
  [N.demandCompleted]: { categoryLabel: '画作', cover: COVER('completed'), pay: 900 },
};

/**
 * 健壮导航:reward 是客户端单页,sidebar 点击可能被数字人 canvas 拦截或赶上
 * 懒加载丢点击(已实测两次翻车)。这里 goto 后用 dispatchEvent 点 sidebar,
 * 并以「视图标志按钮出现」为成功信号,最多重试 4 次。
 */
async function gotoView(
  page: Page,
  label: string,
  marker: { role: 'button'; name: string | RegExp; exact?: boolean } | { role: 'text'; text: string | RegExp },
  { owner = false }: { owner?: boolean } = {}
) {
  await page.goto(`/account/reward${owner ? '?owner=1' : ''}`);
  const visible = async () => {
    if (marker.role === 'button') {
      await expect(page.getByRole('button', { name: marker.name, exact: marker.exact }).first()).toBeVisible({ timeout: 8_000 });
    } else {
      await expect(page.getByText(marker.text).first()).toBeVisible({ timeout: 8_000 });
    }
  };
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: label }).first().dispatchEvent('click');
    // 等懒加载 chunk
    await expect(page.getByText('加载中…')).toBeHidden({ timeout: 10_000 }).catch(() => {});
    try {
      await visible();
      return;
    } catch { /* 重试 */ }
  }
  await visible(); // 最后一次,报错抛出
}

/**
 * 进入依赖 groupId 的视图(项目/需求/意境/实现)。
 * 父页 reward/page.tsx 异步拉团队列表注入 groupId;团队切换器「当前团队」
 * 渲染即代表 groups 已就绪,否则子模块会拿到空 groupId → 列表不加载/创建 400。
 */
async function gotoGroupView(page: Page, label: string, marker: Parameters<typeof gotoView>[2], opts: { owner?: boolean } = {}) {
  await gotoView(page, label, marker, opts);
  await expect(page.getByText('当前团队')).toBeVisible({ timeout: 15_000 });
}

async function shot(page: Page, name: string) {
  await fs.promises.mkdir(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true }).catch(() => {});
}

/** 数字人 chat overlay 会拦截指针事件,统一用 dispatchEvent 直跳(既有 spec 已验证)。 */
async function clickContained(dialog: ReturnType<Page['getByRole']>, name: string | RegExp) {
  await dialog.locator('button.MuiButton-contained').filter({ hasText: name }).first().dispatchEvent('click');
}

/** 同上,但不限 variant(text/warning 按钮同样会被 overlay 拦截,如「关闭需求」)。 */
async function dispatchClick(dialog: ReturnType<Page['getByRole']>, name: string | RegExp) {
  await dialog.getByRole('button', { name }).first().dispatchEvent('click');
}

/** 打开 MUI Select(按 FormControl 内文案定位)并选 option。multi 时会校验 chip 出现。 */
async function selectOption(page: Page, dialog: ReturnType<Page['getByRole']>, fcText: string, optionName: string | RegExp, expectChip?: string) {
  const fc = dialog.locator('.MuiFormControl-root').filter({ hasText: fcText });
  await fc.getByRole('combobox').click();
  const opt = page.getByRole('option', { name: optionName }).first();
  await expect(opt, `下拉选项未出现: ${fcText} / ${optionName}`).toBeVisible({ timeout: 5_000 });
  // multi-select 的选项可能已被默认值选中(如看板团队下拉默认带当前团队),
  // 再点会变成「取消选择」——已选中则跳过点击,直接关菜单。
  const selected = (await opt.getAttribute('aria-selected')) === 'true';
  if (!selected) {
    await opt.dispatchEvent('click');
  }
  await page.keyboard.press('Escape');
  if (expectChip) {
    await expect(
      dialog.locator('.MuiChip-root').filter({ hasText: expectChip }),
      `团队 chip 未出现,选项点击未生效: ${expectChip}`
    ).toBeVisible({ timeout: 5_000 });
  }
}

/** API context(读 storageState 里的 token,走 next dev 代理)。 */
async function apiCtx(): Promise<APIRequestContext> {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/storageState.json', 'utf-8'));
  const token = state?.origins?.[0]?.localStorage?.find((kv: any) => kv.name === 'token')?.value;
  return pwRequest.newContext({
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

async function fetchRecords(api: APIRequestContext, path: string, params: Record<string, string | number> = { pageSize: 100 }) {
  const res = await api.get(path, { params });
  const j = await res.json();
  const d = j?.data ?? j;
  return (d?.records || d?.list || (Array.isArray(d) ? d : [])) as any[];
}

// ---------- 各模块 UI 操作 ----------

async function createDemand(
  page: Page,
  title: string,
  opts: { category?: string; categoryLabel?: string; cover?: string; pay?: number } = {}
) {
  await page.getByRole('button', { name: /新建需求/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^标题\s*\*?$/).fill(title);
  await dialog.getByLabel('详细内容').fill(`全流程 e2e 自动创建 · ${title}`);
  if (opts.pay) {
    await dialog.getByLabel('酬劳积分').fill(String(opts.pay));
  }
  if (opts.categoryLabel) {
    // 分类是 TextField select:combobox 点开 → 按中文 label 选
    await dialog.getByLabel('分类').click();
    await page.getByRole('option', { name: opts.categoryLabel, exact: true }).dispatchEvent('click');
  }
  if (opts.cover) {
    await dialog.getByLabel('封面图URL').fill(opts.cover);
  }
  const reqP = page.waitForRequest((r) => /\/api\/core\/demand\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
  await clickContained(dialog, '提交');
  const resp = await (await reqP).response();
  expect(resp!.status(), `创建需求失败: ${title}`).toBe(200);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

async function openDemandDetail(page: Page, title: string) {
  await page.getByText(title, { exact: true }).first().dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(title, { exact: true })).toBeVisible({ timeout: 10_000 });
  return dialog;
}

async function createTaskOnBoard(page: Page, title: string, demandTitle?: string) {
  await page.getByRole('button', { name: S.newTask }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(S.title).fill(title);
  await dialog.getByLabel(S.description).fill(`全流程 e2e · ${title}`);
  // 所属团队(可多选) —— 必选,否则前端校验短路
  await selectOption(page, dialog, '所属团队', N.group, N.group);
  if (demandTitle) {
    await selectOption(page, dialog, '所属需求', new RegExp(escapeRegExp(demandTitle)));
  }
  const reqP = page.waitForRequest((r) => /\/api\/core\/task\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
  await dialog.getByRole('button', { name: S.save }).dispatchEvent('click');
  const resp = await (await reqP).response();
  expect(resp!.status(), `创建任务失败: ${title}`).toBe(200);
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

async function openTaskDetail(page: Page, title: string) {
  await page.getByText(title, { exact: true }).first().dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(title, { exact: true })).toBeVisible({ timeout: 10_000 });
  return dialog;
}

async function claimTask(page: Page, dialog: ReturnType<Page['getByRole']>) {
  const btn = dialog.getByRole('button', { name: S.claim });
  await expect(btn).toBeVisible({ timeout: 5_000 });
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/api\/core\/task\/\d+\/claim/.test(r.url())),
    btn.dispatchEvent('click'),
  ]);
  expect(resp.status(), '认领失败').toBe(200);
  await expect(page.getByText(S.opSuccess)).toBeVisible({ timeout: 5_000 }).catch(() => {});
}

async function submitTask(page: Page, dialog: ReturnType<Page['getByRole']>) {
  const deliverable = dialog.getByPlaceholder('交付物链接 / 文本说明');
  await expect(deliverable).toBeVisible({ timeout: 5_000 });
  await deliverable.fill(`https://e2e.example.com/deliverable/${TS}`);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/api\/core\/task\/\d+\/submit/.test(r.url())),
    dialog.getByRole('button', { name: S.submit }).dispatchEvent('click'),
  ]);
  expect(resp.status(), '提交失败').toBe(200);
  await expect(page.getByText(S.opSuccess)).toBeVisible({ timeout: 5_000 }).catch(() => {});
}

async function reviewTask(page: Page, dialog: ReturnType<Page['getByRole']>, approve: boolean) {
  const btn = dialog.getByRole('button', { name: approve ? S.approve : S.reject });
  await expect(btn).toBeVisible({ timeout: 5_000 });
  const note = dialog.getByPlaceholder('审稿意见(可选)');
  if (await note.isVisible().catch(() => false)) {
    await note.fill(approve ? '全流程 e2e 验收通过' : '全流程 e2e 驳回:交付物不达标');
  }
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/api\/core\/task\/\d+\/review/.test(r.url())),
    btn.dispatchEvent('click'),
  ]);
  expect(resp.status(), '审稿失败').toBe(200);
  await expect(page.getByText(S.opSuccess)).toBeVisible({ timeout: 5_000 }).catch(() => {});
}

async function closeDialog(dialog: ReturnType<Page['getByRole']>) {
  await dialog.getByRole('button', { name: S.close }).dispatchEvent('click').catch(() => {});
  await expect(dialog).toBeHidden({ timeout: 5_000 }).catch(() => {});
}

/**
 * 广场筛选栏内的分类 chip。注意:next.config.ts 开了 reactRemoveProperties:true,
 * 编译期会剥掉所有 data-*,所以不能用 data-testid;改为「含搜索框的最内层容器」
 * 作用域内按文案定位(分类行在容器外,不会撞)。
 */
function filterChip(page: Page, label: string) {
  const bar = page
    .locator('div')
    .filter({ has: page.getByPlaceholder('搜索悬赏关键词...') })
    .filter({ hasText: '排序:' })
    .last();
  return bar.getByText(label, { exact: true }).first();
}

/** 广场「悬赏分类」行内的分类卡(文案与 chip 相同,靠容器作用域区分)。 */
function categoryCard(page: Page, label: string) {
  // 同时含「悬赏分类」标题和目标分类卡的最内层 div = 分类行容器本身
  // (它的 header 子盒子只含标题、grid 子盒子只含卡片,都不同时含两者)
  const row = page.locator('div').filter({ hasText: '悬赏分类' }).filter({ hasText: label }).last();
  return row.getByText(label, { exact: true }).last();
}

// ---------- 全流程 ----------

test.describe.serial('悬赏中心 · 全流程真实交互(保留数据)', () => {
  test('1 · 团队管理:创建团队', async ({ page }) => {
    await gotoView(page, S.tabGroup, { role: 'button', name: '创建团队' });
    await page.getByRole('button', { name: '创建团队' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^团队名称\s*\*?$/).fill(N.group);
    await dialog.getByLabel('团队简介').fill('全流程 e2e 自动创建');
    const reqP = page.waitForRequest((r) => /\/api\/core\/group\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
    await clickContained(dialog, '创建');
    const resp = await (await reqP).response();
    expect(resp!.status(), '创建团队失败').toBe(200);
    await expect(page.getByText(N.group, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await shot(page, '01-group');
  });

  test('2 · 项目管理:新建项目', async ({ page }) => {
    await gotoGroupView(page, S.tabProject, { role: 'button', name: /新建项目/ });
    await page.getByRole('button', { name: /新建项目/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^名称\s*\*?$/).fill(N.project);
    await dialog.getByLabel('简介').fill('全流程 e2e 自动创建');
    const reqP = page.waitForRequest((r) => /\/api\/core\/project\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
    await clickContained(dialog, '提交');
    const resp = await (await reqP).response();
    expect(resp!.status(), '创建项目失败').toBe(200);
    await expect(page.getByText(N.project, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await shot(page, '02-project');
  });

  test('3 · 需求管理:建 5 个需求并驱动发布/关闭', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoGroupView(page, S.tabDemand, { role: 'button', name: /新建需求/ });
    for (const title of [N.demandPending, N.demandPublished, N.demandClosed, N.demandSettled, N.demandCompleted]) {
      await createDemand(page, title, DEMAND_OPTS[title]);
    }
    // #2 发布 → PUBLISHED(留着)
    let dialog = await openDemandDetail(page, N.demandPublished);
    let reqP = page.waitForRequest((r) => /\/api\/core\/demand\/process/.test(r.url()) && r.method() === 'POST');
    await dispatchClick(dialog, '发布');
    expect((await (await reqP).response())!.status(), '发布需求失败').toBe(200);
    await closeDialog(dialog);
    // #3 发布 → 关闭 → CLOSED(同弹窗内连续操作,handleStatusChange 会就地更新按钮)
    dialog = await openDemandDetail(page, N.demandClosed);
    reqP = page.waitForRequest((r) => /\/api\/core\/demand\/process/.test(r.url()) && r.method() === 'POST');
    await dispatchClick(dialog, '发布');
    expect((await (await reqP).response())!.status()).toBe(200);
    await expect(dialog.getByRole('button', { name: '关闭需求' })).toBeVisible({ timeout: 5_000 });
    reqP = page.waitForRequest((r) => /\/api\/core\/demand\/process/.test(r.url()) && r.method() === 'POST');
    await dispatchClick(dialog, '关闭需求');
    expect((await (await reqP).response())!.status(), '关闭需求失败').toBe(200);
    await closeDialog(dialog);
    // #4/#5 发布(待第 4 步任务全过后自动 COMPLETED)
    for (const title of [N.demandSettled, N.demandCompleted]) {
      dialog = await openDemandDetail(page, title);
      reqP = page.waitForRequest((r) => /\/api\/core\/demand\/process/.test(r.url()) && r.method() === 'POST');
      await dispatchClick(dialog, '发布');
      expect((await (await reqP).response())!.status(), `发布失败: ${title}`).toBe(200);
      await closeDialog(dialog);
    }
    await shot(page, '03-demands');
  });

  test('4 · 协作看板:建 7 个任务并驱动全部状态', async ({ page }) => {
    test.setTimeout(300_000);
    await gotoView(page, S.tabTaskboard, { role: 'button', name: '我的任务', exact: true }, { owner: true });
    await expect(page.getByRole('button', { name: S.newTask })).toBeVisible({ timeout: 15_000 });
    // 列表 DESC:新建的项目/团队自动成为看板默认选中,确认项目下拉命中
    await expect(
      page.locator('.MuiFormControl-root').filter({ hasText: N.project }).first()
    ).toBeVisible({ timeout: 10_000 });

    // 建任务:#4 需求挂 2 个(待结账用)、#5 需求挂 1 个,其余不关联
    await createTaskOnBoard(page, N.taskOpen);
    await createTaskOnBoard(page, N.taskClaimed);
    await createTaskOnBoard(page, N.taskSubmitted);
    await createTaskOnBoard(page, N.taskRejected);
    await createTaskOnBoard(page, N.taskApprovedA, N.demandSettled);
    await createTaskOnBoard(page, N.taskApprovedB, N.demandSettled);
    await createTaskOnBoard(page, N.taskForCompleted, N.demandCompleted);

    // 状态流转(任务详情弹窗内按钮,弹窗跨状态保持打开)
    // 进行中:仅认领
    let dialog = await openTaskDetail(page, N.taskClaimed);
    await claimTask(page, dialog);
    await closeDialog(dialog);
    // 待验收:认领 + 提交
    dialog = await openTaskDetail(page, N.taskSubmitted);
    await claimTask(page, dialog);
    await submitTask(page, dialog);
    await closeDialog(dialog);
    // 已驳回:认领 + 提交 + 驳回
    dialog = await openTaskDetail(page, N.taskRejected);
    await claimTask(page, dialog);
    await submitTask(page, dialog);
    await reviewTask(page, dialog, false);
    await closeDialog(dialog);
    // 已通过 ×2(挂需求 #4)+ ×1(挂需求 #5):认领 + 提交 + 通过
    for (const title of [N.taskApprovedA, N.taskApprovedB, N.taskForCompleted]) {
      dialog = await openTaskDetail(page, title);
      await claimTask(page, dialog);
      await submitTask(page, dialog);
      await reviewTask(page, dialog, true);
      await closeDialog(dialog);
    }
    await shot(page, '04-taskboard');
  });

  test('5 · 需求管理:自动待结账 → 结账;5 个状态 tab 各有数据', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoGroupView(page, S.tabDemand, { role: 'button', name: /新建需求/ });
    // #4 任务全过 → 自动 COMPLETED → 详情弹窗出现「结账」
    const dialog = await openDemandDetail(page, N.demandSettled);
    await expect(dialog.getByRole('button', { name: '结账' })).toBeVisible({ timeout: 10_000 });
    await dispatchClick(dialog, '结账');
    const settleDialog = page.getByRole('dialog').filter({ hasText: '确认结账' });
    await expect(settleDialog).toBeVisible({ timeout: 5_000 });
    const reqP = page.waitForRequest((r) => /\/api\/core\/demand\/\d+\/settle/.test(r.url()) && r.method() === 'POST');
    await clickContained(settleDialog, '确认结账');
    expect((await (await reqP).response())!.status(), '结账失败').toBe(200);
    await expect(page.getByText(S.demandSettled)).toBeVisible({ timeout: 5_000 }).catch(() => {});

    // 5 个筛选 tab 各命中对应需求
    const tabCases: Array<[string, string]> = [
      [S.demandFilterPending, N.demandPending],
      [S.demandFilterPublished, N.demandPublished],
      [S.demandFilterCompleted, N.demandCompleted],
      [S.demandFilterSettled, N.demandSettled],
      [S.demandFilterClosed, N.demandClosed],
    ];
    for (const [tab, title] of tabCases) {
      await page.getByRole('tab', { name: tab }).dispatchEvent('click');
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
      await shot(page, `05-demand-tab-${tab}`);
    }
  });

  test('6 · 意境管理:新建意境 ×2', async ({ page }) => {
    await gotoGroupView(page, S.tabConception, { role: 'button', name: /新建意境/ });
    for (const name of [N.conceptionA, N.conceptionB]) {
      await page.getByRole('button', { name: /新建意境/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByLabel(/^名称\s*\*?$/).fill(name);
      await dialog.getByLabel('简介').fill('全流程 e2e 自动创建');
      await dialog.getByLabel('封面图URL').fill(COVER(`conception-${name.slice(-2)}`));
      const reqP = page.waitForRequest((r) => /\/api\/core\/conception\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
      await clickContained(dialog, '提交');
      expect((await (await reqP).response())!.status(), `创建意境失败: ${name}`).toBe(200);
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    }
    await shot(page, '06-conception');
  });

  test('7 · 实现管理:新建实现 ×2', async ({ page }) => {
    await gotoGroupView(page, S.tabRealization, { role: 'button', name: /新建实现/ });
    for (const title of [N.realizationA, N.realizationB]) {
      await page.getByRole('button', { name: /新建实现/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByLabel(/^标题\s*\*?$/).fill(title);
      await dialog.getByLabel('详细内容').fill('全流程 e2e 自动创建 · 视频交付 https://www.w3schools.com/html/mov_bbb.mp4');
      await dialog.getByLabel('封面图URL').fill(COVER(`realization-${title.slice(-2)}`));
      const reqP = page.waitForRequest((r) => /\/api\/core\/realization\/?(\?|$)/.test(r.url()) && r.method() === 'POST');
      await clickContained(dialog, '提交');
      expect((await (await reqP).response())!.status(), `创建实现失败: ${title}`).toBe(200);
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    }
    await shot(page, '07-realization');
  });

  test('8 · 赏金广场:真实需求上榜 + 分类过滤生效 + 后端回查 + 结果文件', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoView(page, S.tabDashboard, { role: 'text', text: '热门悬赏' });

    // 数字人 chat overlay 偶尔展开遮住右侧热门卡 → 先按 ESC 收掉,再等热门区就绪
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    await expect(page.getByText('热门悬赏').first()).toBeVisible({ timeout: 5_000 });

    // --- 真实数据:进行中的需求必须上榜 ---
    // HotBountyList 接口 size=6 + 按 pay desc;库内已积累大量老需求,新创建的 5 条
    // 不一定排在 size=6 内 → 不在「全部」视图断言具体标题,改为「分类行点击后上榜」
    // 直接通过分类筛选缩小数据集,本轮需求必然上榜。
    // 非进行中状态(PENDING/CLOSED/SETTLED)不上榜:在「全部」视图下断言整个 DOM 中没有这些标题。
    await expect(page.getByText(N.demandPending, { exact: true })).toHaveCount(0);
    await expect(page.getByText(N.demandClosed, { exact: true })).toHaveCount(0);
    await expect(page.getByText(N.demandSettled, { exact: true })).toHaveCount(0);
    await shot(page, '08-dashboard-real-data');

    // --- 分类 chip 过滤:图文 → 只剩图文需求 ---
    await filterChip(page, '图文').dispatchEvent('click');
    await expect(page.getByText(N.demandPublished, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(N.demandCompleted, { exact: true })).toHaveCount(0);
    await shot(page, '08-dashboard-filter-image');
    // 画作 → 只剩画作需求
    await filterChip(page, '画作').dispatchEvent('click');
    await expect(page.getByText(N.demandCompleted, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(N.demandPublished, { exact: true })).toHaveCount(0);
    // 直播(无数据)→ 空态
    await filterChip(page, '直播').dispatchEvent('click');
    await expect(page.getByText('当前筛选条件下暂无悬赏')).toBeVisible({ timeout: 10_000 });
    // --- 分类行点击联动:回全部后点「图文」分类卡 → 同样过滤 ---
    await filterChip(page, '全部').dispatchEvent('click');
    await expect(page.getByText(N.demandCompleted, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await categoryCard(page, '图文').dispatchEvent('click');
    await expect(page.getByText(N.demandPublished, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(N.demandCompleted, { exact: true })).toHaveCount(0);
    await shot(page, '08-dashboard-category-row');

    const api = await apiCtx();
    try {
      const groups = await fetchRecords(api, '/api/core/group/client/page');
      const projects = await fetchRecords(api, '/api/core/project/client/page');
      const demands = await fetchRecords(api, '/api/core/demand/client/page');
      const tasks = await fetchRecords(api, '/api/core/task/page');
      const conceptions = await fetchRecords(api, '/api/core/conception/client/page');
      const realizations = await fetchRecords(api, '/api/core/realization/list');

      const pick = (arr: any[], field: string, value: string) => arr.find((x) => x?.[field] === value) || null;

      const result = {
        ts: TS,
        group: pick(groups, 'name', N.group),
        project: pick(projects, 'name', N.project),
        demands: {
          PENDING: pick(demands, 'title', N.demandPending),
          PUBLISHED: pick(demands, 'title', N.demandPublished),
          CLOSED: pick(demands, 'title', N.demandClosed),
          SETTLED: pick(demands, 'title', N.demandSettled),
          COMPLETED: pick(demands, 'title', N.demandCompleted),
        },
        tasks: {
          pending: pick(tasks, 'title', N.taskOpen),
          claimed: pick(tasks, 'title', N.taskClaimed),
          submitted: pick(tasks, 'title', N.taskSubmitted),
          approvedA: pick(tasks, 'title', N.taskApprovedA),
          approvedB: pick(tasks, 'title', N.taskApprovedB),
          approvedForCompleted: pick(tasks, 'title', N.taskForCompleted),
          rejected: pick(tasks, 'title', N.taskRejected),
        },
        conceptions: [pick(conceptions, 'name', N.conceptionA), pick(conceptions, 'name', N.conceptionB)],
        realizations: [pick(realizations, 'title', N.realizationA), pick(realizations, 'title', N.realizationB)],
      };

      // 后端落库状态断言(全流程的核心验证点)
      expect(result.group?.id, '团队未落库').toBeTruthy();
      expect(result.project?.id, '项目未落库').toBeTruthy();
      expect(result.demands.PENDING?.status).toBe('PENDING');
      expect(result.demands.PUBLISHED?.status).toBe('PUBLISHED');
      expect(result.demands.CLOSED?.status).toBe('CLOSED');
      expect(result.demands.SETTLED?.status, '任务全过后需求应自动待结账,结账后为 SETTLED').toBe('SETTLED');
      expect(result.demands.COMPLETED?.status, '任务全过后需求应自动 COMPLETED').toBe('COMPLETED');
      // 分类/酬劳/封面落库(广场真实数据 + 分类过滤的底座)
      expect(result.demands.PUBLISHED?.category).toBe('image');
      expect(result.demands.PUBLISHED?.pay).toBe(800);
      expect(result.demands.PUBLISHED?.cover).toContain('picsum');
      expect(result.demands.COMPLETED?.category).toBe('art');
      expect(result.demands.SETTLED?.category).toBe('video');
      expect(result.tasks.pending?.status).toBe('pending');
      expect(result.tasks.claimed?.status).toBe('claimed');
      expect(result.tasks.submitted?.status).toBe('submitted');
      expect(result.tasks.approvedA?.status).toBe('approved');
      expect(result.tasks.approvedB?.status).toBe('approved');
      expect(result.tasks.approvedForCompleted?.status).toBe('approved');
      expect(result.tasks.rejected?.status).toBe('rejected');
      expect(result.conceptions[0]?.id, '意境甲未落库').toBeTruthy();
      expect(result.conceptions[1]?.id, '意境乙未落库').toBeTruthy();
      expect(result.realizations[0]?.id, '实现甲未落库').toBeTruthy();
      expect(result.realizations[1]?.id, '实现乙未落库').toBeTruthy();

      fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2));
      console.log(`[fullflow] 结果已写入 ${RESULT_FILE}`);
    } finally {
      await api.dispose();
    }
  });
});
