'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Zoom from '@mui/material/Zoom';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

interface FloatingNavProps {
  /** 滚动超过多少像素才浮现,默认一屏(600)。 */
  threshold?: number;
  /** 是否显示「返回上一页」,默认 true。 */
  showBack?: boolean;
}

/**
 * FloatingNav —— 详情页/阅读页的悬浮导航:返回上一页 + 返回顶部。
 *
 * 长页面滚过一屏后从右下浮出,避免读者一路滚回顶部找返回键。
 * 用 Zoom 做进入动画,颜色跟随主题(paper + 主色描边),Dark/Light 都清晰。
 */
export function FloatingNav({ threshold = 600, showBack = true }: FloatingNavProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <Zoom in={visible}>
      <Box
        sx={{
          position: 'fixed',
          right: { xs: 'max(var(--sar, 0px), 16px)', md: 24 },
          bottom: { xs: 'calc(var(--bottom-nav-inset, 0px) + 24px)', md: 32 },
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {showBack && (
          <Tooltip title="返回上一页" placement="left">
            <Fab
              size="medium"
              aria-label="返回上一页"
              onClick={() => router.back()}
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.9),
                backdropFilter: 'blur(8px)',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 3,
                '&:hover': { bgcolor: 'background.paper' },
              }}
            >
              <ArrowBackIcon />
            </Fab>
          </Tooltip>
        )}
        <Tooltip title="返回顶部" placement="left">
          <Fab
            size="medium"
            color="primary"
            aria-label="返回顶部"
            onClick={scrollTop}
            sx={{ boxShadow: 3 }}
          >
            <KeyboardArrowUpIcon />
          </Fab>
        </Tooltip>
      </Box>
    </Zoom>
  );
}

export default FloatingNav;
