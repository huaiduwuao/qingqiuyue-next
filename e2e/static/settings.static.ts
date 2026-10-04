import { COMMON } from './fixtures';
import { expect, installMocks, ok, test, USER, type MockRule } from './mock';
import type { Page } from '@playwright/test';

async function openSettings(page: Page, user: Record<string, unknown>) {
  const bodies: Array<Record<string, unknown>> = [];
  const rules: MockRule[] = [
    ...COMMON,
    { path: /^\/core\/user\/current$/, body: ok(user) },
    {
      method: 'PUT',
      path: /^\/core\/user\/profile$/,
      body: (req) => {
        bodies.push(req.postDataJSON());
        return ok(null);
      },
    },
  ];
  const api = await installMocks(page, { authed: true, rules });
  await page.goto('/account/settings');
  await expect(page.getByLabel('昵称')).toHaveValue(String(user.nickname));
  return { api, bodies };
}

test.describe('设置 · 保存资料', () => {
  test('没动简介:请求里不带 info(后端约定不带 = 不改),不会把简介清空', async ({ page, errors }) => {
    // /user/current 没给 info(老会话缓存 / 字段缺省)时,表单里简介是空串
    const { info: _omit, ...userWithoutInfo } = USER;
    const { api, bodies } = await openSettings(page, userWithoutInfo);
    await page.getByLabel('昵称').fill('新昵称');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible();

    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ nickname: '新昵称' });
    expect(bodies[0]).not.toHaveProperty('info');
    expect(api.unmatched).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('改了简介(包括清空):带上 info', async ({ page, errors }) => {
    const { bodies } = await openSettings(page, { ...USER, info: '原来的简介' });
    await expect(page.getByLabel('个人简介')).toHaveValue('原来的简介');
    await page.getByLabel('个人简介').fill('');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ info: '' });
    expect(errors).toEqual([]);
  });
});
