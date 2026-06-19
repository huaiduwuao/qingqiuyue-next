'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '@/contexts/AuthContext';

// 微信扫码登录回调落地页:从 URL 拿 ?token=&from=,写 token 后跳 from。
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
    const token = sp?.get('token') || '';
    const from = sp?.get('from') || '/home/recommend';
    const err = sp?.get('error') || '';
    if (err) {
      setErrMsg(err);
      return;
    }
    if (!token) {
      setErrMsg('缺少 token,请重新登录');
      return;
    }
    doneRef.current = true;
    login(token);
    // 用 replace 避免回退到此页
    router.replace(from);
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