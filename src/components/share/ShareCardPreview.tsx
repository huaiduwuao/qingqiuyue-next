'use client';

/**
 * 分享卡预览:封面 + 标题 + 简介 + 二维码。
 *
 * 调用方:
 *   - 通过 ref 拿到 DOM 节点
 *   - 用 html-to-image / html2canvas 把它转 PNG(本组件不内置依赖,调用方自己装)
 *   - 转图后下载/复制到剪贴板
 *
 * 设计原则:
 *   - 比例固定 4:3(小红书图文 1:1 / 3:4 也兼容)
 *   - 文字截断,溢出加 ellipsis
 *   - 二维码占右下角,扫码能看详情
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import QrCodeRoundedIcon from '@mui/icons-material/QrCodeRounded';

const PLACEHOLDER_COVER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjwvc3ZnPg==';

export interface ShareCardData {
  title: string;
  subtitle?: string;
  desc?: string;
  cover: string;
  url: string;       // 二维码扫描后落地 URL
  platform?: 'douyin' | 'kuaishou' | 'xiaohongshu' | 'link';
  brand?: string;
}

export interface ShareCardPreviewProps extends ShareCardData {
  /** 外部 ref,用于 html-to-image 调用 */
  previewRef?: React.RefObject<HTMLDivElement | null>;
  width?: number;
  height?: number;
}

const PLATFORM_BRAND: Record<string, { label: string; color: string }> = {
  douyin:      { label: '抖音', color: '#FE2C55' },
  kuaishou:    { label: '快手', color: '#FFA836' },
  xiaohongshu: { label: '小红书', color: '#FF2442' },
  link:        { label: '清秋月', color: '#07C160' },
};

export default function ShareCardPreview(props: ShareCardPreviewProps) {
  const {
    title, subtitle, desc, cover, url, platform, brand,
    previewRef, width = 360, height = 480,
  } = props;

  const plat = platform ? PLATFORM_BRAND[platform] : PLATFORM_BRAND.link;
  const brandText = brand || plat.label;

  return (
    <Box
      ref={previewRef}
      sx={{
        width,
        height,
        bgcolor: '#fff',
        borderRadius: 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      }}
    >
      {/* 封面区(占比 60%) */}
      <Box
        sx={{
          position: 'relative',
          height: '60%',
          bgcolor: '#000',
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src={cover || PLACEHOLDER_COVER}
          alt={title}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            bgcolor: plat.color,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {brandText}
        </Box>
      </Box>

      {/* 文案区(占比 28%) */}
      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 700,
            color: '#1a1a1a',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: 12, color: '#888' }} noWrap>
            {subtitle}
          </Typography>
        )}
        {desc && (
          <Typography
            sx={{
              fontSize: 13,
              color: '#555',
              lineHeight: 1.5,
              mt: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {desc}
          </Typography>
        )}
      </Box>

      {/* 二维码区(占比 12%) */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderTop: '1px dashed #eee',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1,
            bgcolor: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <QrCodeRoundedIcon sx={{ fontSize: 32, color: '#999' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, color: '#888' }}>扫码查看完整内容</Typography>
          <Typography
            sx={{
              fontSize: 10,
              color: '#aaa',
              mt: 0.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {url}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}