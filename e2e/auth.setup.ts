import { test as setup, expect, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginViaApi, buildStorageState } from './fixtures/auth';
import { ensureGroup, ensureProject, seedTask } from './fixtures/api';

// Playwright 测试进程不自动读 Next 的 .env.local；显式注入 E2E_OWNER_NAME/PASSWORD。
process.loadEnvFile('.env.local');

const AUTH_FILE = 'e2e/.auth/storageState.json';

/**
 * setup 项目：登录拿 token → 写 storageState(cookie+localStorage 双写) → 自检未被踢回登录 → 幂等 seed。
 * 凭据从 E2E_OWNER_NAME / E2E_OWNER_PASSWORD 读（在 qingqiuyue-next/.env.local 配置，本地不入库）。
 */
setup('authenticate + seed', async ({ request, browser }) => {
  const name = process.env.E2E_OWNER_NAME;
  const password = process.env.E2E_OWNER_PASSWORD;
  if (!name || !password) {
    throw new Error('缺少 E2E_OWNER_NAME / E2E_OWNER_PASSWORD：请在 qingqiuyue-next/.env.local 配置 owner 账号');
  }

  const token = await loginViaApi(request, { name, password });

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(buildStorageState(token)));

  // 自检 1：localStorage 守卫 —— 带 storageState 进 account 不应被踢到 /user/login
  const ctx = await browser.newContext({ storageState: AUTH_FILE });
  const page = await ctx.newPage();
  await page.goto('/account/reward?owner=1');
  await expect(page).toHaveURL(/\/account\/reward/, { timeout: 10_000 }); // 若被踢走会变 /user/login → 超时失败
  await ctx.close();

  // 自检 2 + seed：用 owner token 建最小 project/group（不存在才建）。
  // seed 失败不阻断 setup：读路径用例（导航/列表）仍可跑；写路径用例若因缺 project 或后端缺陷而红，即真实发现。
  const api = await pwRequest.newContext({
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  try {
    // createTask 后端原样存小写 status(reward_task.go:148)；前端 OPEN/CLAIMED 是显示归一化结果，seed 必须用 'pending'
    // 用静态名 E2E-Group / E2E-Project：现在 SetupReward 挂 JWT + R6 修 CreateUser 后，
    // ClientPageGroup/Project 按 userID=1 filter，老的 create_user=0 历史记录不会再冒头，
    // 同名也不会撞；任务标题保留时间戳后缀避免旧任务遗重。
    const groupName = 'E2E-Group';
    const projectName = 'E2E-Project';
    const ts = Date.now().toString(36);
    const linkTitle = `E2E-链路-Seed-${ts}`;
    const deleteTitle = `E2E-删除-Seed-${ts}`;
    const groupId = await ensureGroup(api, groupName);
    const projectId = await ensureProject(api, groupId, projectName);
    await seedTask(api, { projectId, groupId, title: linkTitle, status: 'pending' });
    await seedTask(api, { projectId, groupId, title: deleteTitle, status: 'pending' });
    fs.writeFileSync(
      'e2e/.auth/seed.json',
      JSON.stringify({ groupId, groupName, projectId, projectName, linkTitle, deleteTitle }),
    );
  } catch (e) {
    console.warn('[seed] 跳过（后端创建接口异常，写路径用例可能受影响）:', (e as Error).message);
  } finally {
    await api.dispose();
  }
});
