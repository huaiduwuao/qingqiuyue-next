'use client';

import React, { useEffect, useRef, useState } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';
import { animate, useInView } from 'motion/react';

interface Props extends Omit<BoxProps, 'children'> {
  to: number;
  from?: number;
  /** 时长(秒) */
  duration?: number;
  /** 小数位 */
  decimals?: number;
  /** 千分位 */
  separator?: string;
  prefix?: string;
  suffix?: string;
  /** 进入视口才开始(默认 true) */
  startOnView?: boolean;
}

function format(n: number, decimals: number, separator: string) {
  const fixed = n.toFixed(decimals);
  if (!separator) return fixed;
  const [int, frac] = fixed.split('.');
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return frac ? `${withSep}.${frac}` : withSep;
}

/**
 * CountUp(React Bits)—— 数字滚动到目标值。统计 / 余额 / 榜单数值用。
 */
export default function CountUp({
  to,
  from = 0,
  duration = 1.2,
  decimals = 0,
  separator = ',',
  prefix = '',
  suffix = '',
  startOnView = true,
  sx,
  ...rest
}: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (startOnView && !inView) return;
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setValue(to);
      return;
    }
    const controls = animate(from, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [to, from, duration, inView, startOnView]);

  return (
    <Box ref={ref} component="span" {...rest} sx={{ fontVariantNumeric: 'tabular-nums', ...sx }}>
      {prefix}
      {format(value, decimals, separator)}
      {suffix}
    </Box>
  );
}
