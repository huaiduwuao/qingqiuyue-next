'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import { getGiftList, type GiftItem } from '@/apis/dashboard';
import { FEN_PER_DIAMOND, getWalletBalance } from '@/apis/wallet';
import { accountClient, formatApiError } from '@/lib/api/client';
import { loginHref } from '@/lib/auth/redirect';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';

const COUNTS = [1, 5, 10, 66];
// 送一个扣的钻石数:以后端下发的 diamondPrice 为准,老接口没有时按 1 钻 = 10 分向上折算
const giftDiamonds = (g: GiftItem) => g.diamondPrice ?? Math.ceil(g.price / FEN_PER_DIAMOND);

interface GiftButtonProps {
  /** 创作者用户 id。站外收录的内容没有站内创作者(为 0/空),此时不展示。 */
  creatorId?: number | string | null;
  contentId: string | number;
  creatorName?: string;
}

/**
 * 给作品的创作者送礼:从钱包余额扣钻石,平台抽成后入创作者钱包并记入收益明细。
 * 收礼人由服务端按作品的主人确定;创作者达到 Lv3 才能收礼,没到时服务端会说明原因。
 */
export function GiftButton({ creatorId, contentId, creatorName }: GiftButtonProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [gift, setGift] = useState<GiftItem | null>(null);
  const [count, setCount] = useState(1);
  const [done, setDone] = useState<string | null>(null);

  const gifts = useQuery({ queryKey: ['gifts'], queryFn: () => getGiftList().then((r) => r.list ?? []), enabled: open, staleTime: 5 * 60_000 });
  const balance = useQuery({ queryKey: ['wallet', 'balance'], queryFn: getWalletBalance, enabled: open && isAuthenticated });
  const send = useMutation({
    mutationFn: () => accountClient.post('/account/gift/send', { contentId: String(contentId), giftId: gift?.id, count }),
    onSuccess: () => {
      setDone(`已送出 ${gift?.icon ?? ''} ${gift?.name ?? ''} ×${count}`);
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  const targetId = Number(creatorId);
  if (!targetId || targetId <= 0 || targetId === currentUser?.id) return null;

  // 钱包余额与扣费都是钻石
  const total = (gift ? giftDiamonds(gift) : 0) * count;
  const balanceDiamonds: number | undefined = balance.data?.balance;
  const insufficient = balanceDiamonds !== undefined && total > balanceDiamonds;

  const openDialog = () => {
    if (!isAuthenticated) {
      router.push(loginHref());
      return;
    }
    setDone(null);
    send.reset();
    setOpen(true);
  };

  return (
    <>
      <Button variant="outlined" size="small" startIcon={<CardGiftcardRoundedIcon />} onClick={openDialog} sx={{ borderRadius: 999, textTransform: 'none' }}>
        送礼
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>送礼给{creatorName ? ` ${creatorName}` : '创作者'}</DialogTitle>
        <DialogContent>
          {done ? (
            <Alert severity="success">{done},感谢你对创作者的支持!</Alert>
          ) : (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2 }}>
                {(gifts.data ?? []).map((g) => (
                  <Box
                    key={g.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setGift(g); if (!g.combo) setCount(1); }}
                    onKeyDown={(e) => e.key === 'Enter' && setGift(g)}
                    sx={{
                      p: 1, borderRadius: 2, textAlign: 'center', cursor: 'pointer', border: '1px solid',
                      borderColor: gift?.id === g.id ? 'primary.main' : 'divider',
                      bgcolor: gift?.id === g.id ? 'action.selected' : 'transparent',
                    }}
                  >
                    <Typography sx={{ fontSize: 26, lineHeight: 1.2 }}>{g.icon}</Typography>
                    <Typography sx={{ fontSize: 11 }} noWrap>{g.name}</Typography>
                    <Typography sx={{ fontSize: 10, color: 'warning.main', fontWeight: 700 }}>{giftDiamonds(g)} 钻</Typography>
                  </Box>
                ))}
              </Box>
              {gifts.isSuccess && gifts.data.length === 0 && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>暂时没有可送的礼物。</Typography>}
              {gift?.combo && (
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  {COUNTS.map((n) => (
                    <Button key={n} size="small" variant={count === n ? 'contained' : 'outlined'} onClick={() => setCount(n)} sx={{ minWidth: 0, flex: 1 }}>
                      ×{n}
                    </Button>
                  ))}
                </Box>
              )}
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                钱包余额:{balanceDiamonds === undefined ? '…' : `${balanceDiamonds.toLocaleString()} 钻`}
                {insufficient && (
                  <>
                    {' · 余额不足,'}
                    <Link href="/recharge">去充值</Link>
                  </>
                )}
              </Typography>
              {send.isError && <Alert severity="error" sx={{ mt: 1.5 }}>{formatApiError(send.error)}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" onClick={() => setOpen(false)}>{done ? '关闭' : '取消'}</Button>
          {!done && (
            <Button variant="contained" disabled={!gift || insufficient || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? '处理中…' : gift ? `送出 ${total.toLocaleString()} 钻` : '选择礼物'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

export default GiftButton;
