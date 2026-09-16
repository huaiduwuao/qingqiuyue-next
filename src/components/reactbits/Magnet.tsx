'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';

interface Props extends BoxProps {
  /** 吸附感应范围(px):鼠标进入元素外这个距离内就开始吸附 */
  padding?: number;
  /** 位移强度:越大越"软",1 = 跟手 */
  magnetStrength?: number;
  disabled?: boolean;
  /** 吸附中的过渡 */
  activeTransition?: string;
  /** 回弹过渡 */
  inactiveTransition?: string;
}

/**
 * Magnet(React Bits)—— 子元素被鼠标"吸"过去,离开后弹回。
 * 触屏设备自动禁用(没有 hover 概念,只会让点击目标乱跑)。
 */
export default function Magnet({
  children,
  padding = 60,
  magnetStrength = 3,
  disabled = false,
  activeTransition = 'transform 0.25s ease-out',
  inactiveTransition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
  sx,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    setTouch(typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches);
  }, []);

  const onMove = useCallback(
    (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = Math.abs(cx - e.clientX);
      const dy = Math.abs(cy - e.clientY);
      if (dx < r.width / 2 + padding && dy < r.height / 2 + padding) {
        setActive(true);
        setOffset({ x: (e.clientX - cx) / magnetStrength, y: (e.clientY - cy) / magnetStrength });
      } else {
        setActive(false);
        setOffset({ x: 0, y: 0 });
      }
    },
    [padding, magnetStrength],
  );

  useEffect(() => {
    if (disabled || touch) return;
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [disabled, touch, onMove]);

  return (
    <Box ref={ref} {...rest} sx={{ display: 'inline-block', ...sx }}>
      <Box
        sx={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
          transition: active ? activeTransition : inactiveTransition,
          willChange: 'transform',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
