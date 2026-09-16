'use client';

import React from 'react';
import Box, { type BoxProps } from '@mui/material/Box';

interface Props extends BoxProps {
  /** 光点颜色 */
  color?: string;
  /** 一圈流光的时长,如 '6s' */
  speed?: string;
  /** 边框厚度(px) */
  thickness?: number;
  /** 内层背景(默认深色玻璃) */
  innerBg?: string;
  /** 内层圆角(px) */
  radius?: number;
}

/**
 * StarBorder(React Bits)—— 沿边框流动的光点,包住任意内容(按钮/卡片/头像)。
 */
export default function StarBorder({
  children,
  color = '#FE2C55',
  speed = '6s',
  thickness = 1,
  innerBg = 'linear-gradient(135deg, rgba(20,22,32,0.96), rgba(5,6,11,0.96))',
  radius = 20,
  sx,
  ...rest
}: Props) {
  return (
    <Box
      {...rest}
      sx={{
        position: 'relative',
        display: 'inline-block',
        overflow: 'hidden',
        borderRadius: `${radius}px`,
        padding: `${thickness}px 0`,
        ...sx,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: '300%',
          height: '50%',
          opacity: 0.7,
          bottom: -11,
          right: '-250%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animation: `rb-star-movement-bottom ${speed} linear infinite alternate`,
          zIndex: 0,
          pointerEvents: 'none',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: '300%',
          height: '50%',
          opacity: 0.7,
          top: -10,
          left: '-250%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animation: `rb-star-movement-top ${speed} linear infinite alternate`,
          zIndex: 0,
          pointerEvents: 'none',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          background: innerBg,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: `${radius}px`,
          color: '#fff',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
