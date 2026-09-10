'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';

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

/**
 * 登录门禁。登录态还在确认中(status=loading)时不下结论:replace 模式显示加载占位,
 * overlay 模式先照常渲染 —— 避免已登录用户每次刷新都先看到一闪而过的锁。
 */
export function LoginGate({ children, mode = 'overlay', message = '登录后查看', icon, overlayOpacity = 0.5 }: LoginGateProps) {
  const { status } = useAuth();
  const router = useRouter();

  if (status === 'authenticated') {
    return <>{children}</>;
  }
  if (status === 'loading') {
    return mode === 'replace' ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
        <CircularProgress size={28} />
      </Box>
    ) : (
      <>{children}</>
    );
  }

  const goLogin = () => router.push(loginHref());

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
      <Box sx={{ opacity: overlayOpacity, pointerEvents: 'none', filter: 'blur(1px)' }} aria-hidden>
        {children}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={goLogin}
        aria-label={message}
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          cursor: 'pointer',
          border: 0,
          bgcolor: 'transparent',
          color: 'inherit',
          font: 'inherit',
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
