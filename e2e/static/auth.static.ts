import { COMMON } from './fixtures';
import { expect, installMocks, test } from './mock';

test.describe('登录与路由守卫', () => {
  test('登录页可渲染', async ({ page, errors }) => {
    const api = await installMocks(page, { rules: COMMON });
    await page.goto('/user/login');
    await expect(page.getByText('清秋月', { exact: true })).toBeVisible();
    await expect(page.getByLabel('用户名')).toBeVisible();
    await expect(page.getByLabel(/^密码/).first()).toBeVisible();
    expect(api.unmatched).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('未登录打开后台页 → 跳登录页,回跳地址只保留站内路径', async ({ page, errors }) => {
    await installMocks(page, { rules: COMMON });
    await page.goto('/system/recharge-records?status=paid');
    await expect(page).toHaveURL(/\/user\/login\?redirect=/);
    const redirect = new URL(page.url()).searchParams.get('redirect');
    expect(redirect).toBe('/system/recharge-records?status=paid');
    await expect(page.getByLabel('用户名')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('带开放跳转的登录链接:登录后不跳到外站', async ({ page, errors }) => {
    let loggedIn = false;
    await installMocks(page, {
      rules: [
        ...COMMON,
        {
          method: 'POST',
          path: /^\/core\/login$/,
          body: () => {
            loggedIn = true;
            return { code: 200, msg: 'success', data: { session_id: 'e2e-session-0001', user: { id: 10001, name: 'e2e_user' } } };
          },
        },
      ],
    });
    await page.goto('/user/login?redirect=' + encodeURIComponent('//evil.example.com/x'));
    await page.getByLabel('用户名').fill('e2e_user');
    await page.getByLabel(/^密码/).first().fill('secret-123');
    await page.keyboard.press('Enter');
    await expect.poll(() => loggedIn).toBe(true);
    // 不安全的 redirect 被丢弃,落到默认首页
    await expect(page).toHaveURL(/\/home\/recommend/);
    expect(new URL(page.url()).host).toBe(new URL(test.info().project.use.baseURL!).host);
    expect(errors).toEqual([]);
  });
});
