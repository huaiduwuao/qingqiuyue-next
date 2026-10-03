'use client';


import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { LoginGate } from '@/components/auth/LoginGate';
import { toEntityId } from '@/lib/id';
import {
  getEarningHistory,
  getTips,
  getMyPaidContents,
  getMyPurchases,
  setPaidContent,
  type Earning,
  type Tip,
  type PaidContent,
  type Purchase,
} from '@/apis/social-monetize';
import { WALLET_HREF, diamondsToYuan } from '@/apis/wallet';

// 收益和提现在个人中心的钱包;这里只留打赏、订阅、付费内容的明细
function WalletEntry() {
  return (
    <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography sx={{ flex: 1, fontSize: 13, color: 'text.secondary' }}>
        打赏、订阅、付费内容的收入实时进入钱包。余额、全部收益和提现都在个人中心的钱包里。
      </Typography>
      <Button component={Link} href={WALLET_HREF} size="small" variant="outlined" sx={{ textTransform: 'none', borderRadius: 999, flexShrink: 0 }}>
        去钱包 ›
      </Button>
    </Paper>
  );
}

// 收益类型说明
function EarningsBreakdown() {
  const items = [
    { type: '打赏', icon: '💰', desc: '粉丝对你的内容打赏' },
    { type: '订阅', icon: '⭐', desc: '粉丝订阅你的月度/年度内容' },
    { type: '付费内容', icon: '📚', desc: '设置内容为付费阅读' },
  ];

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        收益来源
      </Typography>
      <Stack spacing={1.5}>
        {items.map(item => (
          <Box
            key={item.type}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
            }}
          >
            <Typography sx={{ fontSize: 24 }}>{item.icon}</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{item.type}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{item.desc}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 2 }}>
        平台收取 10% 服务费用于运营支持
      </Typography>
    </Paper>
  );
}

// 打赏记录
function TipsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['social-tips'],
    queryFn: () => getTips({ page: 1, pageSize: 50 }),
  });

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        打赏记录
      </Typography>
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>加载中...</Box>
      ) : (
        <Stack spacing={1}>
          {data?.list?.map((tip: Tip) => (
            <Box
              key={tip.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: '#5DDB9620',
                  color: '#5DDB96',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                +{tip.amount}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 500, fontSize: 13 }}>
                  粉丝 #{tip.fanId}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {tip.message || '支持一下~'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {new Date(tip.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          ))}
          {(!data?.list || data.list.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              暂无打赏记录
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

// 收益明细
function EarningsHistoryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['social-earnings-history'],
    queryFn: () => getEarningHistory({ page: 1, pageSize: 50 }),
  });

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      tip: '打赏',
      subscription: '订阅',
      paid_content: '付费内容',
      commission: '佣金',
    };
    return map[type] || type;
  };

  const getTypeColor = (type: string) => {
    const map: Record<string, string> = {
      tip: '#5DDB96',
      subscription: '#FFB400',
      paid_content: '#5B8DEF',
      commission: '#8B5CF6',
    };
    return map[type] || '#5DDB96';
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        收益明细
      </Typography>
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>加载中...</Box>
      ) : (
        <Stack spacing={1}>
          {data?.list?.map((e: Earning) => (
            <Box
              key={e.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: getTypeColor(e.type) + '20',
                  color: getTypeColor(e.type),
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {getTypeLabel(e.type)}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 500, fontSize: 13 }}>
                  +💎 {e.netAmount}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  手续费: 💎 {e.platformFee}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={e.status === 'available' ? '可提现' : e.status}
                sx={{ fontSize: 10 }}
              />
            </Box>
          ))}
          {(!data?.list || data.list.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              暂无收益记录
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

// 付费内容管理
function PaidContentsTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['social-paid-contents'],
    queryFn: () => getMyPaidContents({ page: 1, pageSize: 50 }),
  });

  const [open, setOpen] = useState(false);
  const [contentId, setContentId] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 价格按钻(整数,1 ~ 10000)
  // 内容 id 超 2^53,parseInt 会截成另一条内容(永远「内容不存在」);toEntityId 超范围时保留字符串
  const entityId = toEntityId(contentId.trim());
  const priceDiamonds = Number(price) || 0;
  const canSubmit =
    entityId !== null && Number.isInteger(priceDiamonds) && priceDiamonds >= 1 && priceDiamonds <= 10000 && !submitting;

  const submit = async () => {
    if (!canSubmit || entityId === null) return;
    setSubmitting(true);
    setError('');
    try {
      await setPaidContent({ contentId: entityId, price: priceDiamonds });
      setOpen(false);
      setContentId('');
      setPrice('');
      refetch();
    } catch (e: any) {
      setError(e?.message || '设置失败,请确认内容 ID 正确且属于你');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          我的付费内容
        </Typography>
        <Button size="small" variant="outlined" onClick={() => setOpen(true)}>
          设置付费
        </Button>
      </Box>
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>加载中...</Box>
      ) : (
        <Stack spacing={1}>
          {data?.list?.map((content: PaidContent) => (
            <Box
              key={content.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                  bgcolor: 'primary.main',
                  opacity: 0.1,
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 500, fontSize: 13 }}>{content.title}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  销量: {content.salesCount} | 收入: 💎 {content.revenue}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`💎 ${content.price}`}
                sx={{ bgcolor: '#5DDB9620', color: '#5DDB96' }}
              />
            </Box>
          ))}
          {(!data?.list || data.list.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              暂无付费内容
            </Box>
          )}
        </Stack>
      )}

      {/* 设置付费弹窗 */}
      <Dialog open={open} onClose={() => !submitting && setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>设置付费内容</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            label="内容 ID"
            placeholder="要设为付费的内容 ID"
            value={contentId}
            onChange={(e) => setContentId(e.target.value)}
            fullWidth
            size="small"
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            helperText="在「内容管理」里查看你的内容 ID"
          />
          <TextField
            label="价格(钻)"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            fullWidth
            size="small"
            slotProps={{
              htmlInput: { min: 1, max: 10000, step: 1 },
              input: { startAdornment: <InputAdornment position="start">💎</InputAdornment> },
            }}
            helperText={priceDiamonds > 0 ? `≈ ¥${diamondsToYuan(priceDiamonds)} · 最高 10000 钻` : '1 ~ 10000 钻(1 钻 = ¥0.1)'}
          />
          {error && (
            <Typography sx={{ fontSize: 12, color: 'error.main' }}>{error}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={submitting}>取消</Button>
          <Button onClick={submit} variant="contained" disabled={!canSubmit}>
            {submitting ? '提交中...' : '确认设置'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
// 购买记录
function PurchasesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['social-purchases'],
    queryFn: () => getMyPurchases({ page: 1, pageSize: 50 }),
  });

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        我的购买
      </Typography>
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>加载中...</Box>
      ) : (
        <Stack spacing={1}>
          {data?.list?.map((p: Purchase) => (
            <Box
              key={p.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: '#FFB40020',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                📚
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 500, fontSize: 13 }}>
                  付费内容 #{p.paidContentId}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  创作者 #{p.creatorId}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 600, color: '#FE2C55' }}>
                -💎 {p.amount}
              </Typography>
            </Box>
          ))}
          {(!data?.list || data.list.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              暂无购买记录
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

export default function SocialMonetizePage() {
  const [tab, setTab] = useState(0);

  return (
    <Box
      sx={{
        height: 'calc(100dvh - var(--appbar-h, 66px))',
        overflow: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <LoginGate mode="replace" message="登录后查看打赏与订阅明细">
          <>
            <WalletEntry />
            <EarningsBreakdown />

            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{ mb: 2, '& .MuiTab-root': { minWidth: 'auto', px: 2 } }}
            >
              <Tab label="打赏" />
              <Tab label="收益" />
              <Tab label="付费内容" />
              <Tab label="购买" />
            </Tabs>

            {tab === 0 && <TipsTab />}
            {tab === 1 && <EarningsHistoryTab />}
            {tab === 2 && <PaidContentsTab />}
            {tab === 3 && <PurchasesTab />}
          </>
        </LoginGate>
      </Box>
    </Box>
  );
}
