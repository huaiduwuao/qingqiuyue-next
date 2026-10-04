'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';

/** 片段的起止状态(取代以前的 gsap.TweenVars;只支持这几项,够标题入场用) */
export interface SplitTextState {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  filter?: string;
}

interface Props extends Omit<BoxProps, 'children'> {
  text: string;
  /** 按字还是按词切(中文按字) */
  splitType?: 'chars' | 'words';
  /** 每个片段的间隔(ms) */
  delay?: number;
  /** 时长(秒) */
  duration?: number;
  /** CSS 缓动函数;默认约等于 gsap 的 power3.out */
  ease?: string;
  from?: SplitTextState;
  to?: SplitTextState;
  /** 进入视口再播(默认 true) */
  onView?: boolean;
  onComplete?: () => void;
}

/** 起始状态经 CSS 变量传进来,一份 keyframes 覆盖所有 from 组合;终态就是片段自身的样式 */
const pieceIn = keyframes`
  from {
    opacity: var(--rb-o0);
    transform: translate(var(--rb-x0), var(--rb-y0)) scale(var(--rb-s0));
    filter: var(--rb-f0);
  }
`;

function transformOf(s: SplitTextState) {
  return `translate(${s.x ?? 0}px, ${s.y ?? 0}px) scale(${s.scale ?? 1})`;
}

/**
 * SplitText(React Bits)—— 标题逐字/逐词飞入。
 * 自己按字切 span(中文标题按字切最自然),每个片段一条 CSS 动画、按下标错开 delay。
 * 以前用 gsap 做补间,全站只有这一处用 gsap;CSS 动画效果相同,还省掉整个依赖。
 * 尊重 prefers-reduced-motion:直接显示不动画。
 */
export default function SplitText({
  text,
  splitType = 'chars',
  delay = 40,
  duration = 0.7,
  ease = 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  from = { opacity: 0, y: 24, filter: 'blur(6px)' },
  to = { opacity: 1, y: 0, filter: 'blur(0px)' },
  onView = true,
  onComplete,
  sx,
  ...rest
}: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const pieces = useMemo(
    () => (splitType === 'words' ? text.split(/(\s+)/) : Array.from(text)),
    [text, splitType],
  );
  // 不等视口时直接播;否则先停在起始状态(动画 paused + fill backwards),滚进视口再放
  const [running, setRunning] = useState(!onView);

  useEffect(() => {
    if (running) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRunning(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRunning(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    // 兜底:IO 在个别老 WebView / 隐藏标签页里不回调,标题不能一直停在 opacity:0
    const fallback = window.setTimeout(() => setRunning(true), 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [running]);

  const fromVars = {
    '--rb-o0': String(from.opacity ?? to.opacity ?? 1),
    '--rb-x0': `${from.x ?? 0}px`,
    '--rb-y0': `${from.y ?? 0}px`,
    '--rb-s0': String(from.scale ?? 1),
    '--rb-f0': from.filter ?? 'none',
  };
  // 终态里的 blur(0px) 等同 none,不留 filter(以前 gsap 播完也会 clearProps filter)
  const endFilter = to.filter && !/^blur\(0(px)?\)$/.test(to.filter.trim()) ? to.filter : undefined;
  const last = pieces.length - 1;

  return (
    <Box
      ref={ref}
      component="span"
      aria-label={text}
      {...rest}
      sx={{ display: 'inline-block', whiteSpace: 'pre-wrap', ...sx }}
    >
      {pieces.map((p, i) => (
        <Box
          // 文案变化时片段重新挂载,动画重播
          key={`${text}-${i}-${p}`}
          component="span"
          aria-hidden
          onAnimationEnd={i === last && onComplete ? () => onComplete() : undefined}
          style={fromVars as React.CSSProperties}
          sx={{
            display: 'inline-block',
            whiteSpace: p.trim() === '' ? 'pre' : 'normal',
            opacity: to.opacity ?? 1,
            transform: transformOf(to),
            filter: endFilter,
            animation: `${pieceIn} ${duration}s ${ease} ${i * delay}ms both`,
            animationPlayState: running ? 'running' : 'paused',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          {p}
        </Box>
      ))}
    </Box>
  );
}
