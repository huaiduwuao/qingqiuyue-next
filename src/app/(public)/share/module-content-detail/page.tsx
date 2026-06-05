'use client';

import React, { useState, Suspense } from 'react';
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
import ModuleContentDetail from '@/components/ModuleContentDetail';

function ShareModuleContentDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [unlockDismissed, setUnlockDismissed] = useState(false);
  const [password, setPassword] = useState('');

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

  const handlePasswordUnlock = () => {
    if (password === '123456') {
      setUnlockDismissed(true);
    }
  };

  const renderUnlockModal = () => (
    <Modal
      open={visible}
      onClose={() => {}}
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
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)',
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
                bgcolor: '#F5F5F5',
                border: '1px dashed',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>二维码占位</Typography>
            </Box>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'primary.main', fontFamily: 'monospace' }}>
              ¥{contentDetail?.shareContent?.pay}
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
              sx={{ mb: 2 }}
              slotProps={{
                input: {
                  sx: { textAlign: 'center', letterSpacing: 4, fontSize: 16, fontWeight: 600 },
                },
              }}
            />
            <Button
              fullWidth
              variant="contained"
              onClick={handlePasswordUnlock}
              sx={{
                borderRadius: 4,
                py: 1.25,
                background: 'linear-gradient(135deg, #FE2C55 0%, #FF6B8A 100%)',
              }}
            >
              解锁内容
            </Button>
            <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 1.5 }}>
              提示：演示口令为 123456
            </Typography>
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
