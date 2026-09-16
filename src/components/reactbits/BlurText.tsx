'use client';

import React, { useMemo } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';
import { motion, useReducedMotion } from 'motion/react';

interface Props extends Omit<BoxProps, 'children'> {
  text: string;
  /** 按字还是按词(中文按字) */
  animateBy?: 'chars' | 'words';
  /** 每片段间隔(ms) */
  delay?: number;
  /** 起始方向 */
  direction?: 'top' | 'bottom';
  /** 时长(秒) */
  duration?: number;
}

/**
 * BlurText(React Bits)—— 文字从模糊渐显。副标题 / 描述用。
 */
export default function BlurText({
  text,
  animateBy = 'chars',
  delay = 30,
  direction = 'top',
  duration = 0.5,
  sx,
  ...rest
}: Props) {
  const reduced = useReducedMotion();
  const pieces = useMemo(
    () => (animateBy === 'words' ? text.split(/(\s+)/) : Array.from(text)),
    [text, animateBy],
  );
  const y = direction === 'top' ? -10 : 10;

  return (
    <Box component="span" aria-label={text} {...rest} sx={{ display: 'inline-block', ...sx }}>
      {pieces.map((p, i) => (
        <motion.span
          key={`${i}-${p}`}
          aria-hidden
          initial={reduced ? false : { opacity: 0, filter: 'blur(8px)', y }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration, delay: (i * delay) / 1000, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'inline-block', whiteSpace: p.trim() === '' ? 'pre' : 'normal' }}
        >
          {p}
        </motion.span>
      ))}
    </Box>
  );
}
