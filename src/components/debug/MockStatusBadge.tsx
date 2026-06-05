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
 */
export function MockStatusBadge() {
  const [state, setState] = useState<State>('pending');

  useEffect(() => {
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
  }, []);

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
