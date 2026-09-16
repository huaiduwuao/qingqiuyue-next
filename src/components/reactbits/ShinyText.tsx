'use client';

import React from 'react';
import Box, { type BoxProps } from '@mui/material/Box';

interface Props extends Omit<BoxProps, 'children'> {
  text?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  /** 一次扫光的时长(秒) */
  speed?: number;
  /** 扫光颜色,默认半透明白 */
  shineColor?: string;
  /** 底色(文字本色),默认继承 */
  color?: string;
}

/**
 * ShinyText(React Bits)—— 文字上周期性扫过一道高光。
 * 纯 CSS,keyframes 在 globals.css(rb-shine)。
 */
export default function ShinyText({
  text,
  children,
  disabled = false,
  speed = 3,
  shineColor = 'rgba(255,255,255,0.85)',
  color = 'currentColor',
  sx,
  ...rest
}: Props) {
  return (
    <Box
      component="span"
      {...rest}
      sx={{
        display: 'inline-block',
        color,
        backgroundImage: `linear-gradient(120deg, transparent 40%, ${shineColor} 50%, transparent 60%)`,
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        animation: disabled ? 'none' : `rb-shine ${speed}s linear infinite`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        ...sx,
      }}
    >
      {children ?? text}
    </Box>
  );
}
