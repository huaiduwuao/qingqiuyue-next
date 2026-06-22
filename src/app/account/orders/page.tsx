'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Snackbar from '@mui/material/Snackbar';
import DiamondIcon from '@mui/icons-material/Diamond';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { LoginGate } from '@/components/auth/LoginGate';

type OrderStatus = 'paid' | 'pending' | 'refunded' | 'cancelled';
type OrderType = 'recharge' | 'vip' | 'content' | 'gift';

interface Order {
  id: string;
  type: OrderType;
  title: string;
  subtitle: string;
  amount: number;
  status: OrderStatus;
  createdAt: number;
  payMethod: 'wechat' | 'alipay' | 'apple' | 'card';
}

const ORDERS: Order[] = [
  { id: 'OD20260605001', type: 'recharge', title: '钻石充值 100 钻', subtitle: '微信支付 · 2026-06-05 10:23', amount: 100, status: 'paid', createdAt: Date.now() - 1000 * 60 * 30, payMethod: 'wechat' },
  { id: 'OD20260604022', type: 'vip', title: '年度会员', subtitle: '微信支付 · 2026-06-04 22:15', amount: 16800, status: 'paid', createdAt: Date.now() - 1000 * 60 * 60 * 18, payMethod: 'wechat' },
  { id: 'OD20260603018', type: 'recharge', title: '钻石充值 500 钻 (加赠 50)', subtitle: '支付宝 · 2026-06-03 14:08', amount: 550, status: 'paid', createdAt: Date.now() - 1000 * 60 * 60 * 50, payMethod: 'alipay' },
  { id: 'OD20260602014', type: 'content', title: '解锁付费剧《长安十二时辰》第 12 集', subtitle: '抖音支付 · 2026-06-02 19:30', amount: 60, status: 'paid', createdAt: Date.now() - 1000 * 60 * 60 * 72, payMethod: 'apple' },
  { id: 'OD20260601009', type: 'gift', title: '打赏作者「旅行的猫」', subtitle: '抖音支付 · 2026-06-01 09:45', amount: 200, status: 'paid', createdAt: Date.now() - 1000 * 60 * 60 * 100, payMethod: 'apple' },
  { id: 'OD20260531005', type: 'recharge', title: '钻石充值 1280 钻 (加赠 200)', subtitle: '微信支付 · 2026-05-31 21:12', amount: 1480, status: 'pending', createdAt: Date.now() - 1000 * 60 * 60 * 130, payMethod: 'wechat' },
  { id: 'OD20260530001', type: 'vip', title: '月度会员', subtitle: '支付宝 · 2026-05-30 11:30', amount: 1800, status: 'refunded', createdAt: Date.now() - 1000 * 60 * 60 * 150, payMethod: 'alipay' },
  { id: 'OD20260528019', type: 'content', title: '订阅创作者「摄影师Leo」', subtitle: '微信支付 · 2026-05-28 16:48', amount: 300, status: 'paid', createdAt: Date.now() - 1000 * 60 * 60 * 200, payMethod: 'wechat' },
];

const TYPE_META: Record<OrderType, { icon: React.ReactNode; color: string; label: string }> = {
  recharge: { icon: <DiamondIcon sx={{ fontSize: 18 }} />, color: '#FFB400', label: '充值' },
  vip: { icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 18 }} />, color: '#FE2C55', label: 'VIP' },
  content: { icon: <MovieFilterRoundedIcon sx={{ fontSize: 18 }} />, color: '#5B8DEF', label: '内容' },
  gift: { icon: <CardGiftcardRoundedIcon sx={{ fontSize: 18 }} />, color: '#8B5CF6', label: '打赏' },
};

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  paid: { label: '已完成', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  pending: { label: '待支付', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  refunded: { label: '已退款', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)' },
  cancelled: { label: '已取消', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OrdersPage() {
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (tab === 0) return ORDERS;
    if (tab === 1) return ORDERS.filter((o) => o.type === 'recharge');
    if (tab === 2) return ORDERS.filter((o) => o.type === 'vip');
    if (tab === 3) return ORDERS.filter((o) => o.status === 'pending');
    return ORDERS;
  }, [tab]);

  const totalSpent = ORDERS.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0);

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>我的订单</Typography>

      <LoginGate mode="replace" message="登录后查看我的订单">

      {/* 概览 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>累计订单</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{ORDERS.length}</Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>累计消费(钻)</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'primary.main' }}>{totalSpent}</Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>待支付</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#FFB400' }}>{ORDERS.filter((o) => o.status === 'pending').length}</Typography>
        </Box>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontSize: 13, minHeight: 40 } }}
      >
        <Tab label="全部" />
        <Tab label="充值" />
        <Tab label="VIP" />
        <Tab label="待支付" />
      </Tabs>

      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box sx={{ fontSize: 48, opacity: 0.3, mb: 1 }}>📋</Box>
          <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>暂无订单</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filtered.map((o) => {
            const tm = TYPE_META[o.type];
            const sm = STATUS_META[o.status];
            return (
              <Box
                key={o.id}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      bgcolor: `${tm.color}1A`,
                      color: tm.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {tm.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{o.title}</Typography>
                      <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: tm.color + '22', color: tm.color, fontSize: 9, fontWeight: 700 }}>
                        {tm.label}
                      </Box>
                      <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: sm.bg, color: sm.color, fontSize: 9, fontWeight: 700 }}>
                        {sm.label}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        sx={{ fontSize: 10, color: 'text.disabled', fontFamily: 'monospace', cursor: 'pointer' }}
                        onClick={() => {
                          navigator.clipboard?.writeText(o.id).then(() => setSnack('订单号已复制'));
                        }}
                      >
                        {o.id}
                      </Typography>
                      <ContentCopyRoundedIcon sx={{ fontSize: 11, color: 'text.disabled', cursor: 'pointer' }} onClick={() => { navigator.clipboard?.writeText(o.id).then(() => setSnack('订单号已复制')); }} />
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>· {o.subtitle}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                      {o.amount} 钻
                    </Typography>
                    <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>≈ ¥ {(o.amount * 0.01).toFixed(2)}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                  {o.status === 'pending' && (
                    <Button size="small" variant="contained" onClick={() => setSnack('已唤起支付')} sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5 }}>
                      继续支付
                    </Button>
                  )}
                  {o.status === 'paid' && (
                    <Button size="small" variant="outlined" onClick={() => setSnack('已发起退款申请')} sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5 }}>
                      申请退款
                    </Button>
                  )}
                  <Button size="small" variant="outlined" component={Link} href="/account/center" sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5 }}>
                    订单详情
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      </LoginGate>
      </Container>
    </Box>
  );
}
