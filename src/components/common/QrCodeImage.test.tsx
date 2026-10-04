import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrCodeImage } from './QrCodeImage';

describe('QrCodeImage', () => {
  it('在本地生成 data URL,不请求第三方二维码服务', async () => {
    render(<QrCodeImage value="weixin://wxpay/bizpayurl?pr=abc" alt="支付二维码" size={120} />);
    const img = await waitFor(() => {
      const el = screen.getByAltText('支付二维码') as HTMLImageElement;
      expect(el.tagName).toBe('IMG');
      return el;
    });
    expect(img.src.startsWith('data:image/png;base64,')).toBe(true);
    expect(img.src).not.toContain('qrserver');
  });
});
