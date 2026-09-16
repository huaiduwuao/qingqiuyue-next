'use client';

import React, { useEffect, useRef, useState } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';

interface Props extends BoxProps {
  /** 进入视口后是否只播一次 */
  once?: boolean;
  /** 延迟(ms) */
  delay?: number;
  /** 时长(ms) */
  duration?: number;
  /** 起始位移(px),0 = 纯淡入 */
  distance?: number;
  /** 起始模糊(px) */
  blur?: number;
  /** 方向 */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** 视口阈值 */
  threshold?: number;
}

/**
 * FadeContent / AnimatedContent(React Bits)—— 元素滚入视口时淡入 + 位移 + 去模糊。
 *
 * 用 IntersectionObserver 而不是 gsap ScrollTrigger:站内主滚动容器是各 layout 的
 * <main>(不是 window),ScrollTrigger 要逐个指定 scroller,IO 对任何滚动容器都直接生效。
 */
export default function FadeContent({
  children,
  once = true,
  delay = 0,
  duration = 600,
  distance = 18,
  blur = 0,
  direction = 'up',
  threshold = 0.1,
  sx,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) io.unobserve(el);
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold },
    );
    io.observe(el);
    // 兜底:IO 在个别老 WebView / 隐藏标签页里不回调,内容不能一直停在 opacity:0。
    // 超时后直接显示(此时未滚到的内容只是少了一次入场动画)。
    const fallback = window.setTimeout(() => setVisible(true), 1500 + delay);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [once, threshold, delay]);

  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
  const sign = direction === 'up' || direction === 'left' ? 1 : -1;
  const hiddenTransform = `translate${axis}(${sign * distance}px)`;

  return (
    <Box
      ref={ref}
      {...rest}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : hiddenTransform,
        filter: blur ? (visible ? 'blur(0px)' : `blur(${blur}px)`) : undefined,
        transition: `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, filter ${duration}ms ease ${delay}ms`,
        willChange: visible ? 'auto' : 'opacity, transform',
        '@media (prefers-reduced-motion: reduce)': { opacity: 1, transform: 'none', filter: 'none', transition: 'none' },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
