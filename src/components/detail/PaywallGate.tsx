'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { formatYuan, isLocked, unlockContent, type Paywall } from '@/apis/paywall';
import { getWalletBalance } from '@/apis/wallet';
import { formatApiError } from '@/lib/api/client';
import { loginHref } from '@/lib/auth/redirect';
import { useAuth } from '@/contexts/AuthContext';

interface PaywallGateProps {
  contentId: string | number;
  paywall: Paywall | null | undefined;
  /** 解锁成功后调用,一般是重新拉取详情(服务端这时才会下发全文)。 */
  onUnlocked: () => void;
  /** 文字类(小说/文章)说"试读",音视频类说"试看"。 */
  kind?: 'read' | 'watch';
}

/**
 * 付费内容的解锁卡片,放在试看/试读内容之后。免费或已解锁时不渲染。
 * 全文是否下发由服务端决定,这里只负责说明价格并发起购买。
 */
export function PaywallGate({ contentId, paywall, onUnlocked, kind = 'read' }: PaywallGateProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [confirming, setConfirming] = useState(false);

  const balance = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: getWalletBalance,
    enabled: confirming && isAuthenticated,
  });
  const unlock = useMutation({
    mutationFn: () => unlockContent(contentId),
    onSuccess: () => {
      setConfirming(false);
      onUnlocked();
    },
  });

  if (!isLocked(paywall)) return null;

  const trial = kind === 'read' ? '试读' : '试看';
  const unit = kind === 'read' ? '章' : '集';
  const balanceCents: number | undefined = balance.data?.balance;
  const insufficient = balanceCents !== undefined && balanceCents < paywall.price;

  const start = () => {
    if (!isAuthenticated) {
      router.push(loginHref());
      return;
    }
    unlock.reset();
    setConfirming(true);
  };

  return (
    <Box
      role="region"
      aria-label="付费内容"
      sx={{
        my: 3,
        p: 3,
        borderRadius: 2,
        textAlign: 'center',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <LockOutlinedIcon sx={{ fontSize: 32, color: 'primary.main' }} />
      <Typography sx={{ fontSize: 16, fontWeight: 700, mt: 1 }}>付费内容 · {trial}已结束</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
        {paywall.freeItems > 0 ? `前 ${paywall.freeItems} ${unit}免费,` : ''}
        解锁后可{kind === 'read' ? '阅读' : '观看'}全部内容
      </Typography>
      <Button variant="contained" onClick={start} sx={{ mt: 2, borderRadius: 999, px: 4, textTransform: 'none' }}>
        ¥{formatYuan(paywall.price)} 解锁完整内容
      </Button>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>确认解锁</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>
            将从钱包扣除 <b>¥{formatYuan(paywall.price)}</b>({paywall.price} 钻石),解锁后永久可看。
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
            钱包余额:{balanceCents === undefined ? '…' : `¥${formatYuan(balanceCents)}`}
          </Typography>
          {insufficient && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              余额不足,<Link href={`/recharge?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}>去充值</Link>
            </Alert>
          )}
          {unlock.isError && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {formatApiError(unlock.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>取消</Button>
          <Button variant="contained" disabled={insufficient || unlock.isPending} onClick={() => unlock.mutate()}>
            {unlock.isPending ? '处理中…' : '确认解锁'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PaywallGate;
