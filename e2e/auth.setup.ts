import { test as setup, expect, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loginViaApi, buildStorageState } from './fixtures/auth';
import { seedTask } from './fixtures/api';

// Playwright 测试进程不自动读 Next 的 .env.local；显式注入 E2E_OWNER_NAME/PASSWORD。
process.loadEnvFile('.env.local');

const AUTH_FILE = 'e2e/.auth/storageState.json';

/**
 * setup 项目：登录拿 token -> 写入 storageState(cookie+localStorage 双写) -> 自检未被踢回登录 -> 从意境开始重建完整链路 seed。
 * 凭证以 E2E_OWNER_NAME / E2E_OWNER_PASSWORD 为准（在 qingqiuyue-next/.env.local 配置，本地不入库）。
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

  // 自检 1：localStorage 守卫 —— 带 storageState 进 account 不应被丢到 /user/login
  const ctx = await browser.newContext({ storageState: AUTH_FILE });
  const page = await ctx.newPage();
  await page.goto('/account/reward?owner=1');
  await expect(page).toHaveURL(/\/account\/reward/, { timeout: 10_000 }); // 若被踢走会变 /user/login -> 超时失败
  await ctx.close();

  // 自检 2 + seed：清理旧数据 -> 从意境开始重建完整链路 -> 补充写路径用例 task
  const api = await pwRequest.newContext({
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  try {
    const repoRoot = path.resolve('..');
    execSync('node reward-cleanup.cjs', { cwd: repoRoot, stdio: 'inherit' });
    execSync('node reward-chain-from-conception.cjs', { cwd: repoRoot, stdio: 'inherit' });

    const seed = JSON.parse(fs.readFileSync('e2e/.auth/seed.json', 'utf-8'));
    const groupId = seed.groupId;
    const projectId = seed.projectId;

    const ts = Date.now().toString(36);
    const linkTitle = `E2E-链路-Seed-${ts}`;
    const deleteTitle = `E2E-删除-Seed-${ts}`;
    await seedTask(api, { projectId, groupId, title: linkTitle, status: 'pending' });
    await seedTask(api, { projectId, groupId, title: deleteTitle, status: 'pending' });

    fs.writeFileSync(
      'e2e/.auth/seed.json',
      JSON.stringify({ ...seed, groupName: 'E2E-Group', projectName: 'E2E-Project', linkTitle, deleteTitle }),
    );
  } catch (e) {
    console.warn('[seed] 跳过（后端创建接口异常，写路径用例可能受影响）', (e as Error).message);
  } finally {
    await api.dispose();
  }
});
