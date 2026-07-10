'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import CircularProgress from '@mui/material/CircularProgress';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { useRouter, useSearchParams } from 'next/navigation';
import { detail as contentDetailApi } from '@/apis/system-module-content';
import { contentPasswordUnlock, contentPayUnlock } from '@/apis/global';
import { formatApiError } from '@/lib/api/client';
import ModuleContentDetail from '@/components/ModuleContentDetail';

function ShareModuleContentDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [unlockDismissed, setUnlockDismissed] = useState(false);
  const [password, setPassword] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [payInfo, setPayInfo] = useState<{ qrCode?: string; payUrl?: string; amount?: number } | null>(null);

  const contentQuery = useQuery({
    queryKey: ['share-module-content-detail', id],
    queryFn: async () => {
      const res = await contentDetailApi({ id: Number(id) });
      return res.data;
    },
    enabled: !!id,
  });

  const contentDetail: any = contentQuery.data;

  const shouldShowUnlock =
    !!contentDetail?.shareType &&
    (contentDetail.shareType === 'password' ||
      (contentDetail.needPay && contentDetail.shareType === 'pay'));
  const visible = shouldShowUnlock && !unlockDismissed;

  useEffect(() => {
    if (!visible || contentDetail?.shareType !== 'pay' || !id) return;
    let cancelled = false;
    contentPayUnlock({ contentId: Number(id) })
      .then((res: any) => {
        if (cancelled) return;
        setPayInfo({
          qrCode: res?.data?.qrCode || res?.data?.qrUrl,
          payUrl: res?.data?.payUrl,
          amount: res?.data?.amount ?? contentDetail?.shareContent?.pay,
        });
      })
      .catch(() => {
        // 后端未就绪时使用内容价格兜底展示
      });
    return () => { cancelled = true; };
  }, [visible, contentDetail?.shareType, contentDetail?.shareContent?.pay, id]);

  const handlePasswordUnlock = async () => {
    if (!password.trim() || !id) return;
    setUnlockBusy(true);
    setUnlockError('');
    try {
      await contentPasswordUnlock({ contentId: Number(id), password: password.trim() });
      setUnlockDismissed(true);
    } catch (err) {
      setUnlockError(formatApiError(err));
    } finally {
      setUnlockBusy(false);
    }
  };

  const renderUnlockModal = () => (
    <Modal
      open={visible}
      onClose={() => setUnlockDismissed(true)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: { xs: '90%', sm: 400 },
          bgcolor: 'background.paper',
          borderRadius: 3,
          p: 3,
          outline: 'none',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            mx: 'auto',
            mb: 2,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FE2C55 0%, #FF6B8A 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.primary',
          }}
        >
          {contentDetail?.shareType === 'pay' ? <QrCode2Icon sx={{ fontSize: 28 }} /> : <LockOutlinedIcon sx={{ fontSize: 28 }} />}
        </Box>
        <Typography variant="h6" sx={{ mb: 0.5, textAlign: 'center', fontWeight: 700 }}>
          {contentDetail?.shareType === 'pay' ? '扫码支付解锁' : '输入口令解锁'}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', mb: 3 }}>
          {contentDetail?.shareType === 'pay' ? '请使用微信/支付宝扫码支付' : '请输入分享者提供的 6 位口令'}
        </Typography>

        {contentDetail?.shareType === 'pay' && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Box
              sx={{
                width: 180,
                height: 180,
                mx: 'auto',
                borderRadius: 2,
                bgcolor: 'action.hover',
                border: '1px dashed',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
                overflow: 'hidden',
              }}
            >
              {payInfo?.qrCode ? (
                <Box component="img" src={payInfo.qrCode} alt="支付二维码" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>二维码加载中…</Typography>
              )}
            </Box>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'primary.main', fontFamily: 'monospace' }}>
              ¥{payInfo?.amount ?? contentDetail?.shareContent?.pay ?? 9.9}
            </Typography>
          </Box>
        )}

        {contentDetail?.shareType === 'password' && (
          <Box>
            <TextField
              fullWidth
              type="password"
              placeholder="请输入 6 位口令"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordUnlock()}
              disabled={unlockBusy}
              sx={{ mb: 2 }}
              slotProps={{
                input: {
                  sx: { textAlign: 'center', letterSpacing: 4, fontSize: 16, fontWeight: 600 },
                },
              }}
            />
            {unlockError && (
              <Typography sx={{ fontSize: 12, color: 'error.main', textAlign: 'center', mb: 1.5 }}>{unlockError}</Typography>
            )}
            <Button
              fullWidth
              variant="contained"
              disabled={unlockBusy || !password.trim()}
              onClick={handlePasswordUnlock}
              sx={{
                borderRadius: 4,
                py: 1.25,
                background: 'linear-gradient(135deg, #FE2C55 0%, #FF6B8A 100%)',
              }}
            >
              {unlockBusy ? '验证中…' : '解锁内容'}
            </Button>
          </Box>
        )}
      </Box>
    </Modal>
  );

  if (!id) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 2, md: 4 }, textAlign: 'center' }}>
          <Typography color="text.secondary">缺少参数</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 1, md: 2 } }}>
          {contentQuery.isLoading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={32} sx={{ color: 'primary.main' }} />
              <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 13 }}>
                内容加载中...
              </Typography>
            </Box>
          ) : contentDetail && contentDetail.id ? (
            <ModuleContentDetail detail={contentDetail} />
          ) : (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={32} sx={{ color: 'primary.main' }} />
              <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 13 }}>
                内容加载中...
              </Typography>
            </Box>
          )}
        </Box>
      </Container>
      {renderUnlockModal()}
    </Box>
  );
}

export default function ShareModuleContentDetailPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}>
      <ShareModuleContentDetailContent />
    </Suspense>
  );
}
