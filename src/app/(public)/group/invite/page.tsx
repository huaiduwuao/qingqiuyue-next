'use client';

// 群组邀请接受页 /group/invite?token=...
//
// 流程:被邀请人点链接 -> 登录(没登录跳登录页) -> 调 acceptGroupInvite
// 后端通过 token 把当前用户加入群,然后跳到 /group?id=... 看聊天。

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import PublicTopBar from '@/components/layout/PublicTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { acceptGroupInvite } from '@/apis/group';

export default function GroupInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get('token') || '';
  const { currentUser } = useAuth();
  const user = currentUser;
  const [acceptedId, setAcceptedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptM = useMutation({
    mutationFn: () => acceptGroupInvite(token),
    onSuccess: (g: any) => {
      setAcceptedId(g.id);
    },
    onError: (e: any) => setError(e?.message || '接受邀请失败'),
  });

  React.useEffect(() => {
    if (!token) {
      setError('邀请链接无效');
      return;
    }
    if (!user) {
      // 未登录:跳到登录页带 token 回跳
      router.replace(loginHref(`/group/invite?token=${encodeURIComponent(token)}`));
      return;
    }
    if (!acceptM.isPending && acceptedId === null && !error) {
      acceptM.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <PublicTopBar />
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
        <Box
          sx={{
            p: 4,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          {acceptM.isPending ? (
            <>
              <CircularProgress size={32} sx={{ mb: 2 }} />
              <Typography sx={{ fontSize: 15, color: 'text.primary' }}>
                正在加入群组…
              </Typography>
            </>
          ) : error ? (
            <>
              <ErrorOutlineRoundedIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
              <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 1 }}>无法加入</Typography>
              <Alert severity="error" sx={{ mb: 3, fontSize: 13 }}>
                {error}
              </Alert>
              <Button onClick={() => router.push('/account/group')} variant="outlined" sx={{ textTransform: 'none' }}>
                返回我的群组
              </Button>
            </>
          ) : acceptedId ? (
            <>
              <CheckCircleRoundedIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
              <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 1 }}>已加入群组</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3 }}>
                欢迎加入,正在打开群聊…
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  onClick={() => router.replace(`/group?id=${acceptedId}`)}
                  sx={{
                    textTransform: 'none',
                    background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                    '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
                  }}
                >
                  立即进入
                </Button>
                <Button onClick={() => router.push('/account/group')} sx={{ textTransform: 'none' }}>
                  稍后
                </Button>
              </Box>
            </>
          ) : (
            <>
              <GroupAddRoundedIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
              <Typography sx={{ fontSize: 16, fontWeight: 600 }}>准备加入…</Typography>
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
}
