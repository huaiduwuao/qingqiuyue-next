'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import DiamondIcon from '@mui/icons-material/Diamond';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { LoginGate } from '@/components/auth/LoginGate';
import { accountClient, isNetworkError, isBusinessError, isAuthError, formatApiError } from '@/lib/api/client';

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

const INITIAL_ORDERS: Order[] = [
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
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [dialogMode, setDialogMode] = useState<'pay' | 'refund' | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState<Order['payMethod']>('wechat');
  const [refundReason, setRefundReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const openPayDialog = (order: Order) => {
    setActiveOrder(order);
    setPayMethod(order.payMethod);
    setDialogMode('pay');
  };

  const openRefundDialog = (order: Order) => {
    setActiveOrder(order);
    setRefundReason('');
    setDialogMode('refund');
  };

  const openDetailDrawer = (order: Order) => {
    setDetailOrder(order);
  };

  const handlePayConfirm = useCallback(async () => {
    if (!activeOrder) return;
    setProcessing(true);
    const orderId = activeOrder.id;
    const method = payMethod;
    try {
      try {
        // 真实网络请求:支付订单
        await accountClient.post(`/account/orders/${orderId}/pay`, { payMethod: method });
      } catch (err) {
        // 仅对网络错误做 mock 回退,业务失败(余额不足等)需提示给用户
        if (isNetworkError(err)) {
          // 网络层失败 → 回退到 mock,但保留本地状态变更
          await new Promise((resolve) => setTimeout(resolve, 600));
        } else {
          // 业务失败 / 鉴权失败 → 抛给外层 catch 统一提示
          throw err;
        }
      }
      const now = formatTime(Date.now());
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: 'paid' as OrderStatus, subtitle: `支付成功 · ${now}`, payMethod: method }
            : o
        )
      );
      setProcessing(false);
      setDialogMode(null);
      setActiveOrder(null);
      setSnack('支付成功');
    } catch (err) {
      setProcessing(false);
      if (isAuthError(err)) {
        setSnack('登录已过期,请重新登录');
      } else if (isBusinessError(err)) {
        setSnack(formatApiError(err) || '支付失败,请检查账户余额');
      } else {
        setSnack(formatApiError(err));
      }
    }
  }, [activeOrder, payMethod]);

  const handleRefundSubmit = useCallback(async () => {
    if (!activeOrder) return;
    if (!refundReason.trim()) {
      setSnack('请填写退款原因');
      return;
    }
    setProcessing(true);
    const orderId = activeOrder.id;
    const reason = refundReason.trim();
    try {
      try {
        // 真实网络请求:申请退款
        await accountClient.post(`/account/orders/${orderId}/refund`, { reason });
      } catch (err) {
        if (isNetworkError(err)) {
          // 网络失败 → 回退到 mock,保留本地状态变更
          await new Promise((resolve) => setTimeout(resolve, 600));
        } else {
          throw err;
        }
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: 'refunded' as OrderStatus } : o
        )
      );
      setProcessing(false);
      setDialogMode(null);
      setActiveOrder(null);
      setSnack('退款申请已提交');
    } catch (err) {
      setProcessing(false);
      if (isAuthError(err)) {
        setSnack('登录已过期,请重新登录');
      } else if (isBusinessError(err)) {
        setSnack(formatApiError(err) || '退款失败');
      } else {
        setSnack(formatApiError(err));
      }
    }
  }, [activeOrder, refundReason]);

  const filtered = useMemo(() => {
    if (tab === 0) return orders;
    if (tab === 1) return orders.filter((o) => o.type === 'recharge');
    if (tab === 2) return orders.filter((o) => o.type === 'vip');
    if (tab === 3) return orders.filter((o) => o.status === 'pending');
    return orders;
  }, [tab, orders]);

  const totalSpent = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0);

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>我的订单</Typography>

      <LoginGate mode="replace" message="登录后查看我的订单">

      {/* 概览 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>累计订单</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{orders.length}</Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>累计消费(钻)</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'primary.main' }}>{totalSpent}</Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>待支付</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#FFB400' }}>{orders.filter((o) => o.status === 'pending').length}</Typography>
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
                    <Button size="small" variant="contained" onClick={() => openPayDialog(o)} sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5 }}>
                      继续支付
                    </Button>
                  )}
                  {o.status === 'paid' && (
                    <Button size="small" variant="outlined" onClick={() => openRefundDialog(o)} sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5 }}>
                      申请退款
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => openDetailDrawer(o)}
                    sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5 }}
                  >
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

      <Dialog
        open={!!dialogMode}
        onClose={() => !processing && setDialogMode(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{dialogMode === 'pay' ? '继续支付' : '申请退款'}</DialogTitle>
        <DialogContent>
          {dialogMode === 'pay' && activeOrder && (
            <Box sx={{ pt: 1 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
                {activeOrder.title}
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2 }}>
                {activeOrder.amount} 钻
              </Typography>
              <FormControl fullWidth>
                <InputLabel>支付方式</InputLabel>
                <Select
                  value={payMethod}
                  label="支付方式"
                  onChange={(e) => setPayMethod(e.target.value as Order['payMethod'])}
                >
                  <MenuItem value="wechat">微信支付</MenuItem>
                  <MenuItem value="alipay">支付宝</MenuItem>
                  <MenuItem value="apple">Apple Pay</MenuItem>
                  <MenuItem value="card">银行卡</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
          {dialogMode === 'refund' && activeOrder && (
            <Box sx={{ pt: 1 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
                {activeOrder.title}
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="退款原因"
                placeholder="请简要说明退款原因"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogMode(null)} disabled={processing}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={dialogMode === 'pay' ? handlePayConfirm : handleRefundSubmit}
            disabled={processing}
            startIcon={processing ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {dialogMode === 'pay' ? '确认支付' : '提交申请'}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 420 },
              p: 3,
            },
          },
        }}
      >
        {detailOrder && (
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              订单详情
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>订单号</Typography>
                <Typography sx={{ fontSize: 13, fontFamily: 'monospace' }}>{detailOrder.id}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>商品</Typography>
                <Typography sx={{ fontSize: 13, maxWidth: 240, textAlign: 'right' }}>{detailOrder.title}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>金额</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{detailOrder.amount} 钻</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>状态</Typography>
                <Typography sx={{ fontSize: 13, color: STATUS_META[detailOrder.status].color }}>{STATUS_META[detailOrder.status].label}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>支付方式</Typography>
                <Typography sx={{ fontSize: 13 }}>{detailOrder.payMethod}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>下单时间</Typography>
                <Typography sx={{ fontSize: 13 }}>{formatTime(detailOrder.createdAt)}</Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }}></Divider>
            <Button
              fullWidth
              variant="contained"
              onClick={() => setDetailOrder(null)}
              sx={{ textTransform: 'none', borderRadius: 1.5 }}
            >
              关闭
            </Button>
          </Box>
        )}
      </Drawer>
      </LoginGate>
      </Container>
    </Box>
  );
}
