import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E —— 跑真实界面（Next dev + 真后端网关）。
 * 前置：
 *  - .env.development.local 已配 API_PROXY_TARGET=http://10.9.1.2:10005（next dev 自读，勿在此覆盖）
 *  - .env.local 配 E2E_OWNER_NAME / E2E_OWNER_PASSWORD（owner 账号，本地不入库）
 *  - NEXT_PUBLIC_USE_MOCK=0（默认；为 1 会卡 providers.tsx 的 mockReady 白屏）
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000, // 单用例上限：链路用例含多次请求+刷新+MUI 动画，给足
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1, // 切片期串行，避免共享项目/任务互相污染
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 }, // MUI md+：sidebar 常驻，避开移动端抽屉
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts$/ },
    { name: 'smoke', testMatch: /.*\.smoke\.ts$/ }, // 无登录、无 storageState：仅验证 webServer+chromium 通路
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/storageState.json' },
      dependencies: ['setup'],
    },
  ],

  // Playwright 自启干净 next dev（已授权 kill 旧的崩坏实例 PID 32844）。
  // 自动读 .env.development.local 的 API_PROXY_TARGET=http://10.9.1.2:10005。
  webServer: {
    command: 'npm run dev',
    cwd: '.',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, NEXT_PUBLIC_USE_MOCK: '0' },
  },
});
