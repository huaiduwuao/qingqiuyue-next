import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, defineConfig, devices } from '@playwright/test';

/**
 * 静态冒烟 —— 不需要后端,能在 CI 里跑。
 *
 * 跑的是 `pnpm build:static` 产出的 out/(线上同一份产物),由 scripts/serve-static.mjs 按
 * nginx 的 try_files 规则伺服;所有 /api/** 在用例里用 page.route 回 fixture(见 e2e/static/mock.ts)。
 * 和 playwright.config.ts(next dev + 真后端)互不干扰:用例在 e2e/static/,后缀 .static.ts。
 *
 *   pnpm build:static && pnpm test:e2e:static
 */
const PORT = Number(process.env.STATIC_PORT || 4173);

/**
 * 本机沙箱只预装了 /opt/pw-browsers 下的某一版 Chromium,版本可能对不上当前 @playwright/test;
 * 默认位置的浏览器不存在时退到那里。CI 上 `playwright install chromium` 装的是匹配版本,走默认。
 */
function fallbackChromium(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    /* 未安装 */
  }
  const root = '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
  for (const d of dirs) {
    const bin = path.join(root, d, 'chrome-linux', 'chrome');
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

const executablePath = fallbackChromium();

export default defineConfig({
  testDir: './e2e/static',
  testMatch: /.*\.static\.ts$/,
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-static' }]] : [['list']],
  outputDir: 'test-results-static',

  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },

  webServer: {
    command: `node scripts/serve-static.mjs out ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
