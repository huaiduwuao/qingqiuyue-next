'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';
import { gsap } from 'gsap';

interface Props extends Omit<BoxProps, 'children'> {
  text: string;
  /** 按字还是按词切(中文按字) */
  splitType?: 'chars' | 'words';
  /** 每个片段的间隔(ms) */
  delay?: number;
  duration?: number;
  ease?: string;
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  /** 进入视口再播(默认 true) */
  onView?: boolean;
  onComplete?: () => void;
}

/**
 * SplitText(React Bits)—— 标题逐字/逐词飞入。
 * 不依赖 gsap SplitText 插件:这里自己按字切 span,中文标题按字切最自然。
 * 尊重 prefers-reduced-motion:直接显示不动画。
 */
export default function SplitText({
  text,
  splitType = 'chars',
  delay = 40,
  duration = 0.7,
  ease = 'power3.out',
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-rb-piece]'));
    if (targets.length === 0) return;
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      gsap.set(targets, { ...to, clearProps: 'filter' });
      return;
    }
    let tween: gsap.core.Tween | null = null;
    const play = () => {
      tween = gsap.fromTo(targets, { ...from }, {
        ...to,
        duration,
        ease,
        stagger: delay / 1000,
        onComplete: () => {
          gsap.set(targets, { clearProps: 'filter,willChange' });
          onComplete?.();
        },
      });
    };
    gsap.set(targets, { ...from, willChange: 'transform, opacity' });
    // 兜底:标签页在后台加载时 rAF/IO 都不跑,标题不能一直停在 opacity:0;
    // 超时后直接落到终态(只是少了一次入场动画)。
    const budget = duration * 1000 + (delay * targets.length) + 2500;
    const fallback = window.setTimeout(() => {
      tween?.kill();
      gsap.set(targets, { ...to, clearProps: 'filter,willChange' });
    }, budget);
    if (!onView || typeof IntersectionObserver === 'undefined') {
      play();
      return () => {
        window.clearTimeout(fallback);
        tween?.kill();
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          play();
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
      tween?.kill();
    };
    // 文案变化时重播;其余参数视为静态配置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

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
          key={`${i}-${p}`}
          component="span"
          data-rb-piece
          aria-hidden
          sx={{ display: 'inline-block', whiteSpace: p.trim() === '' ? 'pre' : 'normal' }}
        >
          {p}
        </Box>
      ))}
    </Box>
  );
}
