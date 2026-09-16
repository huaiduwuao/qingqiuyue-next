'use client';

/**
 * 数字人全屏页的登录门禁。会话、对话记录、数字员工接口都要求登录,
 * 未登录时直接进页面只会得到一串 401(新建会话失败、提问失败、会话列表为空),
 * 所以在加载 3D 舞台之前先挡住,给出登录入口。
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, CircularProgress, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';

export function DigitalHumanLoginGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  if (status === 'authenticated') return <>{children}</>;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        background: 'radial-gradient(circle at 50% 35%, #12203a 0%, #05060B 70%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <IconButton
        onClick={() => router.back()}
        aria-label="退出"
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          color: 'rgba(255,255,255,0.85)',
          bgcolor: 'rgba(0,0,0,0.4)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
        }}
      >
        <CloseRoundedIcon />
      </IconButton>

      {status === 'loading' ? (
        <CircularProgress size={32} sx={{ color: '#25F4EE' }} />
      ) : (
        <Box
          role="dialog"
          aria-labelledby="dh-login-title"
          sx={{
            width: '100%',
            maxWidth: 360,
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <SmartToyOutlinedIcon sx={{ fontSize: 52, color: '#25F4EE', mb: 1.5 }} />
          <Typography id="dh-login-title" sx={{ fontSize: 18, fontWeight: 600, color: '#fff', mb: 1 }}>
            登录后与数字人对话
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', mb: 3, lineHeight: 1.7 }}>
            会话和聊天记录跟随账号保存,登录后才能新建会话、提问和查看历史会话。
          </Typography>
          <Button
            fullWidth
            variant="contained"
            onClick={() => router.push(loginHref())}
            sx={{
              borderRadius: 999,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#25F4EE',
              color: '#05060B',
              '&:hover': { bgcolor: '#1fd9d4' },
            }}
          >
            立即登录
          </Button>
        </Box>
      )}
    </Box>
  );
}
