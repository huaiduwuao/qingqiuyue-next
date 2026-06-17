'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Snackbar from '@mui/material/Snackbar';
import DiamondIcon from '@mui/icons-material/Diamond';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { ACCENT } from '@/constants/accents';
import { gradient3 } from '@/constants/gradients';

// 钱包域占位:后端 `/api/core/wallet/*` 就绪后,以下数据替换为 API 调用
const DIAMOND_BALANCE = 0;
interface DiamondRecord {
  id: number;
  type: 'recharge' | 'consume' | 'reward' | 'gift';
  amount: number;
  balance: number;
  description: string;
  payMethod?: 'wechat' | 'alipay' | 'apple' | 'card';
  createTime: string;
}
const DIAMOND_RECORDS: DiamondRecord[] = [];

const TYPE_META: Record<string, { text: string; color: string; sign: 1 | -1 }> = {
  recharge: { text: '充值', color: '#5DDB96', sign: 1 },
  consume: { text: '消费', color: '#FF6B8A', sign: -1 },
  reward: { text: '奖励', color: '#FFB400', sign: 1 },
  gift: { text: '赠送', color: ACCENT.cyan.main, sign: 1 },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WalletPage() {
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState<string | null>(null);

  const filtered = tab === 0 ? DIAMOND_RECORDS : tab === 1 ? DIAMOND_RECORDS.filter((r) => r.amount > 0) : DIAMOND_RECORDS.filter((r) => r.amount < 0);

  const monthIn = DIAMOND_RECORDS.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const monthOut = DIAMOND_RECORDS.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>我的钱包</Typography>
          <Button size="small" startIcon={<HistoryRoundedIcon sx={{ fontSize: 14 }} />} component={Link} href="/account/orders" sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
            订单记录
          </Button>
        </Box>

      {/* 余额卡 */}
      <Box
        sx={{
          position: 'relative',
          p: { xs: 3, md: 4 },
          borderRadius: 3.5,
          background: gradient3('#FFB400', '#FE2C55', '#8B5CF6', 50),
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(254, 44, 85, 0.2)',
          mb: 3,
        }}
      >
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.25), transparent 50%)' }} />
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <DiamondIcon sx={{ fontSize: 18, color: '#fff' }} />
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
              My Diamond
            </Typography>
            <Box sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => setHidden((h) => !h)} sx={{ color: '#fff' }} aria-label={hidden ? '显示余额' : '隐藏余额'}>
              {hidden ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2.5 }}>
            <Typography sx={{ fontSize: { xs: 44, md: 56 }, fontWeight: 800, color: '#fff', lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
              {hidden ? '****' : DIAMOND_BALANCE}
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>钻</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 2, borderTop: '1px solid rgba(255,255,255,0.2)', mb: 2 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
              ≈ ¥ {hidden ? '**. **' : (DIAMOND_BALANCE * 0.01).toFixed(2)} · 永不过期
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              component={Link}
              href="/recharge"
              sx={{
                background: 'rgba(255,255,255,0.25)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontWeight: 700,
                textTransform: 'none',
                py: 1.25,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.3)',
                '&:hover': { background: 'rgba(255,255,255,0.35)' },
              }}
            >
              充值
            </Button>
            <Button
              fullWidth
              onClick={() => setSnack('提现功能即将开放')}
              sx={{
                background: 'rgba(0,0,0,0.25)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontWeight: 700,
                textTransform: 'none',
                py: 1.25,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.15)',
                '&:hover': { background: 'rgba(0,0,0,0.4)' },
              }}
            >
              提现
            </Button>
          </Box>
        </Box>
      </Box>

      {/* 月度统计 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 3 }}>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <TrendingUpRoundedIcon sx={{ fontSize: 14, color: '#5DDB96' }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>本月收入</Typography>
          </Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#5DDB96' }}>+{monthIn} 钻</Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <TrendingDownRoundedIcon sx={{ fontSize: 14, color: '#FF6B8A' }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>本月支出</Typography>
          </Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#FF6B8A' }}>-{monthOut} 钻</Typography>
        </Box>
      </Box>

      {/* 流水过滤 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>交易流水</Typography>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, fontSize: 12, py: 0.5, textTransform: 'none' } }}
        >
          <Tab label="全部" />
          <Tab label="收入" />
          <Tab label="支出" />
        </Tabs>
      </Box>

      <Box sx={{ borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, color: 'text.disabled' }}>
            <Typography sx={{ fontSize: 13 }}>暂无交易记录</Typography>
          </Box>
        ) : (
          filtered.map((r) => {
            const meta = TYPE_META[r.type] ?? TYPE_META.consume;
            return (
              <Box
                key={r.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.02))' },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    bgcolor: `${meta.color}1A`,
                    color: meta.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {r.type === 'recharge' ? <DiamondIcon sx={{ fontSize: 18 }} /> : r.type === 'reward' ? <CardGiftcardRoundedIcon sx={{ fontSize: 18 }} /> : <SwapHorizRoundedIcon sx={{ fontSize: 18 }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary', mb: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.description}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    {formatTime(r.createTime)}
                    {!hidden && ` · 余额 ${r.balance} 钻`}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: meta.color, fontVariantNumeric: 'tabular-nums' }}>
                    {meta.sign > 0 ? '+' : ''}{r.amount}
                  </Typography>
                  <Typography sx={{ fontSize: 9, color: 'text.disabled', mt: 0.25 }}>钻</Typography>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      </Container>
    </Box>
  );
}
