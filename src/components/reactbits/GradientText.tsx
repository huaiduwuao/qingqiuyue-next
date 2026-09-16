'use client';

import React from 'react';
import Box, { type BoxProps } from '@mui/material/Box';

interface Props extends Omit<BoxProps, 'children'> {
  children: React.ReactNode;
  /** 渐变色停靠点 */
  colors?: string[];
  /** 循环时长(秒) */
  animationSpeed?: number;
  /** 是否同时给一圈渐变描边 */
  showBorder?: boolean;
}

/**
 * GradientText(React Bits)—— 流动的多色渐变文字。
 * 默认用站点品牌色(抖音红 → 琥珀 → 青 → 紫)。
 */
export default function GradientText({
  children,
  colors = ['#FE2C55', '#FFB400', '#25F4EE', '#8B5CF6', '#FE2C55'],
  animationSpeed = 8,
  showBorder = false,
  sx,
  ...rest
}: Props) {
  const gradient = `linear-gradient(90deg, ${colors.join(', ')})`;
  return (
    <Box
      component="span"
      {...rest}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: showBorder ? 999 : 0,
        px: showBorder ? 1.5 : 0,
        py: showBorder ? 0.25 : 0,
        overflow: showBorder ? 'hidden' : 'visible',
        ...(showBorder && {
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            backgroundImage: gradient,
            backgroundSize: '300% 100%',
            animation: `rb-gradient ${animationSpeed}s linear infinite`,
            zIndex: 0,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 1,
            borderRadius: 'inherit',
            bgcolor: 'var(--bg-body, #000)',
            zIndex: 0,
          },
        }),
        ...sx,
      }}
    >
      <Box
        component="span"
        sx={{
          position: 'relative',
          zIndex: 1,
          backgroundImage: gradient,
          backgroundSize: '300% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
          animation: `rb-gradient ${animationSpeed}s linear infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
