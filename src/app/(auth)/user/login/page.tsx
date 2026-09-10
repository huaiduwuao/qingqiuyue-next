'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { getAuthOptions, type AuthOptions } from '@/apis/auth';
import { useAuth } from '@/contexts/AuthContext';
import { consumeRedirect, rememberRedirect, safeRedirectPath, DEFAULT_AFTER_LOGIN } from '@/lib/auth/redirect';
import { PasswordLoginForm } from './_components/PasswordLoginForm';
import { SmsLoginForm } from './_components/SmsLoginForm';
import { RegisterForm } from './_components/RegisterForm';
import { ForgotPasswordDialog } from './_components/ForgotPasswordDialog';

type Mode = 'password' | 'sms' | 'register';

/** 后端 /auth/options 不可达时的保守默认:只展示一定可用的账号密码与注册。 */
const FALLBACK_OPTIONS: AuthOptions = { password: true, register: true, sms: false, wechat: false };

/**
 * 登录 / 注册页。
 *
 * 只展示后端声明可用的方式(短信通道未接入时不出现"验证码登录"与"找回密码");
 * 成功后回到进入登录页之前的页面(见 lib/auth/redirect)。
 */
export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const optionsQuery = useQuery({
    queryKey: ['auth-options'],
    queryFn: () => getAuthOptions().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const options = optionsQuery.data ?? FALLBACK_OPTIONS;

  // 已登录(包括刚登录成功)→ 回到来源页。
  useEffect(() => {
    if (status === 'authenticated') router.replace(consumeRedirect());
  }, [status, router]);

  const onSession = useCallback((sessionId: string) => login(sessionId), [login]);

  const loginWithWechat = () => {
    // 微信回调会带 from 回到前端;这里给它登录后真正要去的页面,而不是登录页自己。
    const target = safeRedirectPath(new URLSearchParams(window.location.search).get('redirect')) ?? DEFAULT_AFTER_LOGIN;
    rememberRedirect(target);
    window.location.href = `/api/core/oauth/login/wechat?from=${encodeURIComponent(target)}`;
  };

  const tabs: { value: Mode; label: string }[] = [
    { value: 'password', label: '账号登录' },
    ...(options.sms ? [{ value: 'sms' as const, label: '验证码登录' }] : []),
    ...(options.register ? [{ value: 'register' as const, label: '注册' }] : []),
  ];

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        background: (t) =>
          t.palette.mode === 'dark'
            ? 'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139,92,246,0.22), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 5%, rgba(254,44,85,0.14), transparent 60%)'
            : 'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139,92,246,0.10), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 5%, rgba(254,44,85,0.06), transparent 60%)',
        px: 2,
      }}
    >
      <Box
        component="main"
        sx={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ textAlign: 'center', pt: 4, pb: 1 }}>
          <Typography
            component="h1"
            sx={{ fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif', fontSize: 28, letterSpacing: 4 }}
          >
            清秋月
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', letterSpacing: 2, mt: 0.5 }}>十年清秋 · 问心明月</Typography>
        </Box>

        <Tabs
          value={tabs.some((t) => t.value === mode) ? mode : 'password'}
          onChange={(_, v: Mode) => {
            setMode(v);
            setNotice(null);
          }}
          variant="fullWidth"
          sx={{ px: 3, minHeight: 40, '& .MuiTab-root': { minHeight: 40, fontSize: 13, textTransform: 'none' } }}
        >
          {tabs.map((t) => (
            <Tab key={t.value} value={t.value} label={t.label} />
          ))}
        </Tabs>

        <Box sx={{ px: 3, pt: 2.5, pb: 3 }}>
          {notice && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
              {notice}
            </Alert>
          )}
          {mode === 'password' && (
            <PasswordLoginForm onSession={onSession} onForgot={options.sms ? () => setForgotOpen(true) : undefined} />
          )}
          {mode === 'sms' && <SmsLoginForm onSession={onSession} />}
          {mode === 'register' && <RegisterForm onSession={onSession} />}

          {options.wechat && (
            <>
              <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 3, mb: 1 }}>
                其他登录方式
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={loginWithWechat}
                sx={{ textTransform: 'none', borderColor: '#07C160', color: '#07C160', borderRadius: 2 }}
              >
                微信登录
              </Button>
            </>
          )}
        </Box>

        <Typography
          sx={{ py: 1.5, fontSize: 11, color: 'text.disabled', textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}
        >
          {mode === 'register' ? '注册' : '登录'}即代表同意《用户协议》与《隐私政策》
        </Typography>
      </Box>

      <ForgotPasswordDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        onDone={() => {
          setForgotOpen(false);
          setMode('password');
          setNotice('密码已重置,请用新密码登录');
        }}
      />
    </Box>
  );
}
