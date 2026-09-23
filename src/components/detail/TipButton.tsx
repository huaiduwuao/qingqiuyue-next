'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import VolunteerActivismOutlinedIcon from '@mui/icons-material/VolunteerActivismOutlined';
import { diamondsToYuan, getWalletBalance, tipCreator } from '@/apis/wallet';
import { formatApiError } from '@/lib/api/client';
import { loginHref } from '@/lib/auth/redirect';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';

/** 预设打赏钻石数(钱包按钻石记账,1 钻 = ¥0.1)。 */
const PRESETS = [10, 52, 100, 500];
/** 后端 walletapp.MinTipAmount */
const MIN_TIP = 1;
const MAX_REMARK = 50;

interface TipButtonProps {
  /** 创作者用户 id。爬虫内容没有站内创作者(为 0/空),此时不展示打赏。 */
  creatorId?: number | string | null;
  contentId: string | number;
  creatorName?: string;
}

/** 打赏创作者:从钱包余额扣款,平台抽成后入创作者钱包。 */
export function TipButton({ creatorId, contentId, creatorName }: TipButtonProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(PRESETS[1]);
  const [custom, setCustom] = useState('');
  const [remark, setRemark] = useState('');
  const [done, setDone] = useState(false);

  const targetId = Number(creatorId);
  const balance = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: getWalletBalance,
    enabled: open && isAuthenticated,
  });
  const tip = useMutation({
    mutationFn: (diamonds: number) =>
      tipCreator({ targetUserId: targetId, contentId: String(contentId), amount: diamonds, remark: remark.trim() || undefined }),
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  if (!targetId || targetId <= 0 || targetId === currentUser?.id) return null;

  const diamonds = custom ? Number(custom) : amount;
  const balanceDiamonds: number | undefined = balance.data?.balance;
  const insufficient = balanceDiamonds !== undefined && diamonds > balanceDiamonds;
  const invalid = !Number.isInteger(diamonds) || diamonds < MIN_TIP;

  const openDialog = () => {
    if (!isAuthenticated) {
      router.push(loginHref());
      return;
    }
    setDone(false);
    tip.reset();
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<VolunteerActivismOutlinedIcon />}
        onClick={openDialog}
        sx={{ borderRadius: 999, textTransform: 'none' }}
      >
        打赏
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>
          打赏{creatorName ? ` ${creatorName}` : '创作者'}
        </DialogTitle>
        <DialogContent>
          {done ? (
            <Alert severity="success">打赏成功,感谢你对创作者的支持!</Alert>
          ) : (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2 }}>
                {PRESETS.map((p) => (
                  <Button
                    key={p}
                    variant={!custom && amount === p ? 'contained' : 'outlined'}
                    onClick={() => {
                      setAmount(p);
                      setCustom('');
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    💎 {p}
                  </Button>
                ))}
              </Box>
              <TextField
                fullWidth
                size="small"
                label="自定义钻石数"
                inputMode="numeric"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
                helperText={custom && Number(custom) > 0 ? `≈ ¥${diamondsToYuan(Number(custom))}` : '1 钻 = ¥0.1'}
                sx={{ mb: 1.5 }}
              />
              <TextField
                fullWidth
                size="small"
                label="留言(选填)"
                value={remark}
                onChange={(e) => setRemark(e.target.value.slice(0, MAX_REMARK))}
              />
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1.5 }}>
                钱包余额:{balanceDiamonds === undefined ? '…' : `💎 ${balanceDiamonds}`}
                {insufficient && (
                  <>
                    {' · 余额不足,'}
                    <Link href="/recharge">去充值</Link>
                  </>
                )}
              </Typography>
              {tip.isError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {formatApiError(tip.error)}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>{done ? '关闭' : '取消'}</Button>
          {!done && (
            <Button
              variant="contained"
              disabled={invalid || insufficient || tip.isPending}
              onClick={() => tip.mutate(diamonds)}
            >
              {tip.isPending ? '处理中…' : invalid ? `最低 ${MIN_TIP} 钻` : `打赏 💎 ${diamonds}`}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

export default TipButton;
