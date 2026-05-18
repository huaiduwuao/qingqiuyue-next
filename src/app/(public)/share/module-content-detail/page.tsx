'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetailApi } from '@/apis/system-module-content';
import ModuleContentDetail from '@/components/ModuleContentDetail';

function ShareModuleContentDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [contentDetail, setContentDetail] = useState<any>(null);
  const [payUrl, setPayUrl] = useState<string>('');
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (id) {
      fetchContentDetail();
    }
  }, [id]);

  const fetchContentDetail = async () => {
    try {
      const res = await contentDetailApi({ id: Number(id) });
      const result = res.data;
      setContentDetail(result);

      if (result?.needPay && result?.shareType === 'pay') {
        setVisible(true);
      } else if (result?.shareType === 'password') {
        setVisible(true);
      }
    } catch (err) {
      console.error('Failed to fetch content:', err);
    }
  };

  const handlePasswordUnlock = () => {
    if (password === '123456') {
      setVisible(false);
    }
  };

  const renderUnlockModal = () => (
    <Modal open={visible} onClose={() => {}}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
          解锁内容
        </Typography>

        {contentDetail?.shareType === 'pay' && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography>扫码支付后查看</Typography>
            <Box sx={{ mt: 2 }}>
              <Typography color="text.secondary">支付金额: ¥{contentDetail?.shareContent?.pay}</Typography>
            </Box>
          </Box>
        )}

        {contentDetail?.shareType === 'password' && (
          <Box>
            <TextField
              fullWidth
              type="password"
              placeholder="输入口令"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordUnlock()}
              sx={{ mb: 2 }}
            />
            <Button fullWidth variant="contained" onClick={handlePasswordUnlock}>
              解锁
            </Button>
          </Box>
        )}
      </Box>
    </Modal>
  );

  if (!id) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">缺少参数</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {contentDetail && contentDetail.id ? (
          <ModuleContentDetail detail={contentDetail} />
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">加载中...</Typography>
          </Box>
        )}
      </Box>
      {renderUnlockModal()}
    </Container>
  );
}

export default function ShareModuleContentDetailPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}>
      <ShareModuleContentDetailContent />
    </Suspense>
  );
}
