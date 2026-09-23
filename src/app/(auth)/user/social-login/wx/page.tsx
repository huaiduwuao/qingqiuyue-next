'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '@/contexts/AuthContext';
import { consumeRedirect, safeRedirectPath } from '@/lib/auth/redirect';
import { consumeOauthState } from '@/lib/auth/oauthState';
import { exchangeWechatCode } from '@/apis/auth';
import { formatApiError } from '@/lib/api/client';

// 微信扫码登录回调落地页:校验 state 后用 ?code= 换会话(老后端直接给 ?session_id=),登录后跳 from。
// 后端 OAuth callback 已 302 到这里(/api/core/oauth/wechat/callback → /user/social-login/wx)。
// Next.js 16 要求 useSearchParams() 包在 <Suspense> 里,否则静态导出时报 "should be wrapped in a suspense boundary"。
export default function SocialLoginWxPage() {
  return (
    <Suspense fallback={<SocialLoginWxLoading />}>
      <SocialLoginWxContent />
    </Suspense>
  );
}

function SocialLoginWxLoading() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={28} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>微信登录中…</Typography>
      </Box>
    </Container>
  );
}

function SocialLoginWxContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const { login } = useAuth();
  const [errMsg, setErrMsg] = useState<string>('');
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    const err = sp?.get('error') || '';
    if (err) {
      setErrMsg(err);
      return;
    }
    const code = sp?.get('code') || '';
    const legacySessionId = sp?.get('session_id') || '';
    if (!code && !legacySessionId) {
      setErrMsg('缺少登录凭据,请重新登录');
      return;
    }
    doneRef.current = true;
    // 只认本浏览器发起的这一次登录:state 对不上就是别人塞过来的链接(登录 CSRF)。
    // 新后端回跳 ?code=&state=;老后端只带 session_id、不回传 state,此时要求本浏览器确实发起过登录。
    const state = sp?.get('state') ?? null;
    if (!consumeOauthState(code ? (state ?? '') : state)) {
      setErrMsg('登录请求已失效或不是从本页面发起的,请重新登录');
      return;
    }
    // 凭据别留在地址栏 / 历史记录里
    window.history.replaceState(null, '', window.location.pathname);
    // 先完成登录(拉取当前用户)再跳转;from 只接受站内路径,防开放跳转。
    const target = safeRedirectPath(sp?.get('from')) ?? consumeRedirect();
    const session = code ? exchangeWechatCode({ code, state: state ?? '' }) : Promise.resolve(legacySessionId);
    void session
      .then((sessionId) => {
        if (!sessionId) throw new Error('登录失败,请重新登录');
        return login(sessionId);
      })
      .then(() => router.replace(target))
      .catch((e: unknown) => setErrMsg(formatApiError(e)));
  }, [sp, login, router]);

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {errMsg ? (
          <>
            <Alert severity="error" sx={{ width: '100%' }}>
              {errMsg}
            </Alert>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', cursor: 'pointer' }} onClick={() => router.replace('/user/login')}>
              返回登录
            </Typography>
          </>
        ) : (
          <>
            <CircularProgress size={28} />
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>微信登录成功,正在进入…</Typography>
          </>
        )}
      </Box>
    </Container>
  );
}