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
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Aurora from '@/components/reactbits/Aurora';
import SplitText from '@/components/reactbits/SplitText';
import BlurText from '@/components/reactbits/BlurText';
import GradientText from '@/components/reactbits/GradientText';
import FadeContent from '@/components/reactbits/FadeContent';
import { getAuthOptions, type AuthOptions } from '@/apis/auth';
import { useAuth } from '@/contexts/AuthContext';
import { consumeRedirect, rememberRedirect, safeRedirectPath, DEFAULT_AFTER_LOGIN } from '@/lib/auth/redirect';
import { inWechatBrowser, startWechatLoginInBrowser, wechatLoginUrl } from '@/lib/clientAuth';
import { createOauthState } from '@/lib/auth/oauthState';
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
    queryFn: () => getAuthOptions().then((r) => r),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const options = optionsQuery.data ?? FALLBACK_OPTIONS;

  // 已登录(包括刚登录成功)→ 回到来源页。
  useEffect(() => {
    if (status === 'authenticated') router.replace(consumeRedirect());
  }, [status, router]);

  const onSession = useCallback((sessionId: string) => login(sessionId), [login]);

  // 手机上微信登录只有网站应用的扫码页(qrconnect):二维码就显示在要扫它的那台手机上。
  // 真正的手机登录要客户端接微信 SDK(移动应用)或微信内用公众号网页授权,都还没有;
  // 在那之前,跳过去之前先说清楚在手机上怎么扫。
  const [wechatTipOpen, setWechatTipOpen] = useState(false);
  const inWechat = inWechatBrowser();
  // 微信里 + 后台配好了服务号:走服务号网页授权,点一下「允许」就登录,不用扫码
  const viaMp = inWechat && !!options.wechatMp;
  const onWechatClick = () => {
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
    if (touch && !viaMp) setWechatTipOpen(true);
    else void loginWithWechat();
  };

  const loginWithWechat = async () => {
    // 微信回调会带 from 回到前端;这里给它登录后真正要去的页面,而不是登录页自己。
    const target = safeRedirectPath(new URLSearchParams(window.location.search).get('redirect')) ?? DEFAULT_AFTER_LOGIN;
    rememberRedirect(target);
    // 客户端里必须把授权丢给系统浏览器:微信不认应用内 WebView,而且相对地址
    // 在 tauri.localhost 下根本到不了网关。走完之后 qingqiuyue:// 回跳,见 DeepLinkBridge。
    // 回调页只认本浏览器发起的这一次登录(见 lib/auth/oauthState)
    const state = createOauthState();
    if (!viaMp && (await startWechatLoginInBrowser(target, state))) return;
    window.location.href = wechatLoginUrl(target, state, viaMp ? 'wechat_mp' : 'wechat');
  };

  const tabs: { value: Mode; label: string }[] = [
    { value: 'password', label: '账号登录' },
    ...(options.sms ? [{ value: 'sms' as const, label: '验证码登录' }] : []),
    ...(options.register ? [{ value: 'register' as const, label: '注册' }] : []),
  ];

  return (
    <Box
      sx={{
        minHeight: 'var(--app-height, 100vh)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        background: (t) =>
          t.palette.mode === 'dark'
            ? 'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139,92,246,0.22), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 5%, rgba(254,44,85,0.14), transparent 60%)'
            : 'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139,92,246,0.10), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 5%, rgba(254,44,85,0.06), transparent 60%)',
        px: 2,
        py: 'max(var(--sat, 0px), 16px)',
      }}
    >
      {/* React Bits Aurora:桌面端 WebGL 极光,触屏退化为静态渐变 */}
      <Aurora
        colorStops={['#FE2C55', '#8B5CF6', '#25F4EE']}
        amplitude={1.2}
        blend={0.6}
        sx={{ opacity: (t) => (t.palette.mode === 'dark' ? 0.55 : 0.32) }}
      />
      <FadeContent
        component="main"
        distance={24}
        blur={6}
        duration={700}
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 420,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(12px)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ textAlign: 'center', pt: 4, pb: 1 }}>
          <Typography
            component="h1"
            sx={{ fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif', fontSize: 30, letterSpacing: 4, lineHeight: 1.2 }}
          >
            <GradientText colors={['#F5E6A8', '#D4AF37', '#FE2C55', '#8B5CF6', '#F5E6A8']} animationSpeed={9}>
              <SplitText text="清秋月" delay={110} onView={false} from={{ opacity: 0, y: 18 }} to={{ opacity: 1, y: 0 }} />
            </GradientText>
          </Typography>
          <Typography component="div" sx={{ fontSize: 11, color: 'text.secondary', letterSpacing: 2, mt: 0.5 }}>
            <BlurText text="十年清秋 · 问心明月" delay={45} />
          </Typography>
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
                onClick={onWechatClick}
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
      </FadeContent>

      <Dialog open={wechatTipOpen} onClose={() => setWechatTipOpen(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>在手机上用微信登录</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 13, color: 'text.secondary', lineHeight: 1.7 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.7 }}>
            下一页会显示一个微信登录二维码,手机没法扫自己屏幕上的码:
          </Typography>
          {inWechat ? (
            <Typography component="div" sx={{ fontSize: 13, color: 'text.primary', lineHeight: 1.8 }}>
              长按二维码,选「识别图中的二维码」即可。
            </Typography>
          ) : (
            <Typography component="div" sx={{ fontSize: 13, color: 'text.primary', lineHeight: 1.8 }}>
              1. 截屏保存这个二维码
              <br />
              2. 打开微信 → 扫一扫 → 右上角「相册」选这张截图
              <br />
              3. 在微信里确认登录后,回到这里即可
            </Typography>
          )}
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>也可以用账号密码{options.sms ? '或短信验证码' : ''}登录,或在电脑上扫码。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWechatTipOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={() => {
              setWechatTipOpen(false);
              void loginWithWechat();
            }}
            sx={{ bgcolor: '#07C160', '&:hover': { bgcolor: '#06AD56' } }}
          >
            打开二维码
          </Button>
        </DialogActions>
      </Dialog>

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
