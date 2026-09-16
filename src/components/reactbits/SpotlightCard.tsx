'use client';

import React, { useCallback, useRef } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';

interface Props extends BoxProps {
  /** 聚光灯颜色(带透明度) */
  spotlightColor?: string;
  /** 光斑半径(px) */
  spotlightSize?: number;
}

/**
 * SpotlightCard(React Bits)—— 跟随鼠标的聚光灯高光卡片。
 * 触屏设备没有 hover,光斑固定在卡片右上,不做跟随。
 * 通过 CSS 变量驱动,不触发 React 重渲染。
 */
export default function SpotlightCard({
  children,
  spotlightColor = 'rgba(255, 255, 255, 0.18)',
  spotlightSize = 260,
  sx,
  onMouseMove,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--rb-x', `${e.clientX - rect.left}px`);
        el.style.setProperty('--rb-y', `${e.clientY - rect.top}px`);
        el.style.setProperty('--rb-o', '1');
      }
      onMouseMove?.(e);
    },
    [onMouseMove],
  );

  const handleLeave = useCallback(() => {
    ref.current?.style.setProperty('--rb-o', '0');
  }, []);

  return (
    <Box
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...rest}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        '--rb-x': '80%',
        '--rb-y': '0%',
        '--rb-o': '0',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          borderRadius: 'inherit',
          opacity: 'var(--rb-o)',
          transition: 'opacity 0.4s ease',
          background: `radial-gradient(${spotlightSize}px circle at var(--rb-x) var(--rb-y), ${spotlightColor}, transparent 70%)`,
          zIndex: 5,
        },
        '@media (hover: none)': {
          '&::after': { opacity: 0.35 },
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
