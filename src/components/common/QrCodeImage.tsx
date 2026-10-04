'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * 本地生成二维码 data URL。
 *
 * 以前用 api.qrserver.com 现画:支付 code_url / 主页链接会被发给第三方,
 * 且该域名在大陆经常加载失败(二维码区域空白,用户没法付款)。
 * qrcode 库按需 dynamic import,只有展示二维码的页面才会下载。
 */
export function useQrDataUrl(text: string | null | undefined, size = 240, margin = 2): string | null {
  const [result, setResult] = useState<{ key: string; url: string } | null>(null);
  const key = text ? `${size}|${margin}|${text}` : '';

  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    import('qrcode')
      .then((QR) => QR.toDataURL(text, { width: size, margin, errorCorrectionLevel: 'M' }))
      .then((url) => {
        if (!cancelled) setResult({ key, url });
      })
      .catch(() => {
        // 生成失败(文本超长等)保持 null,调用方显示占位
      });
    return () => {
      cancelled = true;
    };
  }, [text, size, margin, key]);

  return result && result.key === key ? result.url : null;
}

type QrCodeImageProps = {
  /** 要编码进二维码的文本(支付 code_url / 链接) */
  value: string;
  alt?: string;
  /** 生成的位图边长(px) */
  size?: number;
  margin?: number;
  sx?: SxProps<Theme>;
};

/** 本地渲染的二维码图片;生成完成前显示加载占位,尺寸由 sx 决定。 */
export function QrCodeImage({ value, alt = '二维码', size = 240, margin = 2, sx }: QrCodeImageProps) {
  const dataUrl = useQrDataUrl(value, size, margin);
  if (!dataUrl) {
    return (
      <Box
        role="img"
        aria-label={alt}
        aria-busy="true"
        sx={[
          { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }
  return <Box component="img" src={dataUrl} alt={alt} sx={sx} />;
}
