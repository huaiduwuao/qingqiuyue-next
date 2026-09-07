'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { fallbackImg as DEFAULT_FALLBACK } from '@/lib/utils';
import { mediaUrl } from '@/lib/media';

type CoverImageProps = {
  /** 图片地址;组件内部按真值取,空串/null/undefined 直接走 fallback。 */
  src?: string | null;
  alt?: string;
  /** 加载失败或 src 为空时的兜底图,默认项目通用 fallbackImg。 */
  fallback?: string;
  /** 尺寸/圆角/objectFit 等走 sx(与 MUI Box component="img" 一致),objectFit 默认 cover。 */
  sx?: SxProps<Theme>;
  /** 默认 no-referrer:绕开常见防盗链(外链封面 referer 被挡会裂图)。 */
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>['referrerPolicy'];
  loading?: 'lazy' | 'eager';
};

/**
 * 统一封面图组件:字段归一(由调用方传入已归一的 src)+ 失败兜底 + 防盗链。
 * 替换全项目散落的 <img> / <Box component="img">,集中治理裂图。
 * 不替换场景:<Avatar src>、CSS background:url、next/image、VideoPlayer poster、logo/小图标。
 */
export function CoverImage({
  src,
  alt = '',
  fallback = DEFAULT_FALLBACK,
  sx,
  referrerPolicy = 'no-referrer',
  loading = 'lazy',
}: CoverImageProps) {
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  // mediaUrl:MinIO 内网直链(10.9.1.2:10000,外网不可达)改成同源 /qq-media/...,
  // 外站封面包成 /api/proxy?url=——两者都经 APISIX,线上只有它对外暴露。
  const resolved = mediaUrl(src);
  // 若 src 加载失败用 fallback;fallback 也失败则用纯色占位
  const url = !resolved || failed
    ? fallbackFailed
      ? null
      : fallback
    : resolved;

  if (!url) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: 'var(--bg-input, rgba(255,255,255,0.04))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...sx,
        }}
      />
    );
  }

  return (
    <Box
      component="img"
      src={url}
      alt={alt}
      loading={loading}
      referrerPolicy={referrerPolicy}
      onError={() => {
        if (!failed) setFailed(true);
        else if (!fallbackFailed) setFallbackFailed(true);
      }}
      sx={{ objectFit: 'cover', display: 'block', ...sx }}
    />
  );
}

export default CoverImage;
