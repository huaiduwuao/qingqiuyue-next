'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import Box from '@mui/material/Box';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export interface LoginGateProps {
  children: React.ReactNode;
  /** 'overlay' = 半透明覆盖 children(用于按钮 / 输入框),'replace' = 完全替换 children(用于整页内容) */
  mode?: 'overlay' | 'replace';
  /** 显示在锁图标下方的提示文字 */
  message?: string;
  /** 'replace' 模式时,可选提供 icon 渲染在中间 */
  icon?: React.ReactNode;
  /** 'overlay' 模式时,opacity (0-1) */
  overlayOpacity?: number;
}

export function LoginGate({ children, mode = 'overlay', message = '登录后查看', icon, overlayOpacity = 0.5 }: LoginGateProps) {
  const { currentUser } = useApp();
  const router = useRouter();
  const loggedIn = !!currentUser;

  if (loggedIn) {
    return <>{children}</>;
  }

  const goLogin = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('login_redirect', window.location.pathname + window.location.search);
    }
    router.push('/user/login');
  };

  if (mode === 'replace') {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: 8,
        px: 2,
        textAlign: 'center',
        color: 'text.secondary',
        minHeight: 240,
      }}>
        {icon ?? <LockOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
        <Typography sx={{ fontSize: 15, fontWeight: 500, color: 'text.primary' }}>
          {message}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          登录后可使用该功能
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={goLogin}
          sx={{ mt: 1, textTransform: 'none', minWidth: 120, borderRadius: 999 }}
        >
          立即登录
        </Button>
      </Box>
    );
  }

  // overlay mode
  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ opacity: overlayOpacity, pointerEvents: 'none', filter: 'blur(1px)' }}>
        {children}
      </Box>
      <Box
        onClick={goLogin}
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          cursor: 'pointer',
          bgcolor: 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
          transition: 'background 0.15s',
        }}
      >
        <LockOutlinedIcon sx={{ fontSize: 24, color: 'primary.main' }} />
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'text.primary' }}>
          {message}
        </Typography>
      </Box>
    </Box>
  );
}

export default LoginGate;