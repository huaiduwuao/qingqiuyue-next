'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';

type State = 'pending' | 'active' | 'inactive' | 'unsupported';

/**
 * 调试徽章:显示当前页面的 MSW Service Worker 状态。
 * 排错"加载失败"用 —— SW 没注册成功时,会看到 ❌。
 *
 * 生产环境(NEXT_PUBLIC_USE_MOCK 未开启)整个徽章不渲染 —— 这套 SW
 * 机制是 dev-only 的 mock 工具,放在生产里只会给用户看「浏览器不
 * 支持 SW」之类的噪音。
 */
export function MockStatusBadge() {
  const [state, setState] = useState<State>('pending');

  // 生产环境(mock 关闭)直接不渲染;4 种状态(拦截中/未注册/不支持
  // SW/pending)对真实用户都没意义。
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_USE_MOCK === '1';

  useEffect(() => {
    if (!isDev) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setState('unsupported');
      return;
    }
    navigator.serviceWorker.getRegistration('/mockServiceWorker.js').then((reg) => {
      if (!reg) {
        setState('inactive');
        return;
      }
      if (reg.active) {
        setState('active');
      } else if (reg.installing || reg.waiting) {
        setState('pending');
      } else {
        setState('inactive');
      }
    });
  }, [isDev]);

  if (!isDev) return null;
  if (state === 'pending') return null;

  const { bg, color, icon, label } = (() => {
    if (state === 'active') {
      return {
        bg: 'rgba(93, 219, 150, 0.18)',
        color: 'success.main',
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />,
        label: 'MSW 拦截中',
      };
    }
    if (state === 'unsupported') {
      return {
        bg: 'rgba(255, 180, 0, 0.18)',
        color: 'warning.main',
        icon: <HelpOutlineRoundedIcon sx={{ fontSize: 14 }} />,
        label: '浏览器不支持 SW',
      };
    }
    return {
      bg: 'rgba(254, 44, 85, 0.18)',
      color: 'primary.main',
      icon: <ErrorRoundedIcon sx={{ fontSize: 14 }} />,
      label: 'MSW 未注册',
    };
  })();

  return (
    <Box
      data-testid="msw-status-badge"
      sx={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 1.5,
        bgcolor: bg,
        color,
        fontSize: 11,
        fontWeight: 600,
        pointerEvents: 'none',
      }}
    >
      {icon}
      <Typography component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'inherit' }}>
        {label}
      </Typography>
    </Box>
  );
}
