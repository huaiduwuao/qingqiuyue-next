import { COMMON, RECHARGE } from './fixtures';
import { expect, installMocks, ok, test } from './mock';

test('充值:下单后支付二维码在本地生成,不请求第三方二维码服务', async ({ page, errors }) => {
  const orders: unknown[] = [];
  const api = await installMocks(page, {
    authed: true,
    rules: [
      ...COMMON,
      ...RECHARGE,
      {
        method: 'POST',
        path: /^\/core\/payment\/orders$/,
        body: (req) => {
          orders.push(req.postDataJSON());
          return ok({ orderNo: 'E2E202610040001', amount: 3000, payParams: { code_url: 'weixin://wxpay/bizpayurl?pr=e2eTest' } });
        },
      },
    ],
  });

  await page.goto('/recharge');
  // 折扣最大的档位(300 钻,¥30)默认选中
  const pay = page.getByRole('button', { name: /确认支付 ¥ 30/ });
  await expect(pay).toBeEnabled();
  await pay.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('订单号 E2E202610040001', { exact: false })).toBeVisible();
  const qr = dialog.getByRole('img', { name: '支付二维码' });
  await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(dialog.getByText('请使用微信支付扫码支付')).toBeVisible();

  expect(orders).toEqual([{ orderType: 'diamond', productId: 2, channel: 'wechat' }]);
  // 支付 code_url 不能发给第三方二维码服务
  expect(api.requests.filter((u) => /qrserver\.com/.test(u))).toEqual([]);
  expect(api.requests.filter((u) => u.includes(encodeURIComponent('weixin://')))).toEqual([]);
  expect(api.unmatched).toEqual([]);
  expect(errors).toEqual([]);
});
