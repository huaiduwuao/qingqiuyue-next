'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import CircularProgress from '@mui/material/CircularProgress';
import DiamondIcon from '@mui/icons-material/Diamond';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { LoginGate } from '@/components/auth/LoginGate';
import { isAuthError, formatApiError } from '@/lib/api/client';
import { getOrderList, cancelOrder, refundOrder, type PaymentOrder } from '@/apis/payment';

/**
 * 我的订单 —— 读 paymentapp 的 payment_order(GET /payment/orders)。
 * 到账只来自支付网关验签回调,这里不做「确认支付」;待支付订单可以取消,或回到下单页重新下单。
 */

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string; reorder: string }> = {
  diamond: { icon: <DiamondIcon sx={{ fontSize: 18 }} />, color: '#FFB400', label: '钻石充值', reorder: '/recharge' },
  membership: { icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 18 }} />, color: '#FE2C55', label: '会员', reorder: '/account/vip' },
};
const OTHER_TYPE = { icon: <ReceiptLongRoundedIcon sx={{ fontSize: 18 }} />, color: '#5B8DEF', label: '其他', reorder: '' };

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: '已支付', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  pending: { label: '待支付', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  refunding: { label: '退款中', color: '#5B8DEF', bg: 'rgba(91, 141, 239, 0.12)' },
  refunded: { label: '已退款', color: 'text.secondary', bg: 'action.hover' },
  cancelled: { label: '已取消', color: 'text.secondary', bg: 'action.hover' },
};
const statusMeta = (s: string) => STATUS_META[s] ?? { label: s, color: 'text.secondary', bg: 'action.hover' };

const CHANNEL_LABEL: Record<string, string> = { wechat: '微信支付', alipay: '支付宝' };

function yuan(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

function formatTime(iso?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

const TABS = [
  { label: '全部', match: (_: PaymentOrder) => true },
  { label: '充值', match: (o: PaymentOrder) => o.orderType === 'diamond' },
  { label: '会员', match: (o: PaymentOrder) => o.orderType === 'membership' },
  { label: '待支付', match: (o: PaymentOrder) => o.status === 'pending' },
];

export default function OrdersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<PaymentOrder | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [detail, setDetail] = useState<PaymentOrder | null>(null);
  const [processing, setProcessing] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ['payment-orders'],
    queryFn: () => getOrderList({ page: 1, pageSize: 100 }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  const orders: PaymentOrder[] = (ordersQuery.data?.list ?? []) as PaymentOrder[];
  const filtered = useMemo(() => orders.filter(TABS[tab].match), [orders, tab]);
  const paidCents = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amountCents, 0);

  const report = (err: unknown, fallback: string) =>
    setSnack(isAuthError(err) ? '登录已过期,请重新登录' : formatApiError(err) || fallback);

  const handleCancel = async (o: PaymentOrder) => {
    if (!window.confirm(`确定取消订单 ${o.orderNo}?`)) return;
    try {
      await cancelOrder(o.orderNo);
      setSnack('订单已取消');
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
    } catch (err) {
      report(err, '取消失败');
    }
  };

  const handleRefundSubmit = async () => {
    if (!refundTarget) return;
    if (!refundReason.trim()) {
      setSnack('请填写退款原因');
      return;
    }
    setProcessing(true);
    try {
      await refundOrder(refundTarget.orderNo, refundReason.trim());
      setSnack('退款申请已提交');
      setRefundTarget(null);
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
    } catch (err) {
      report(err, '退款申请失败');
    } finally {
      setProcessing(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => setSnack('订单号已复制'));

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>我的订单</Typography>

        <LoginGate mode="replace" message="登录后查看我的订单">
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
            <Summary label="累计订单" value={String(orders.length)} />
            <Summary label="已支付金额" value={yuan(paidCents)} color="primary.main" />
            <Summary label="待支付" value={String(orders.filter((o) => o.status === 'pending').length)} color="#FFB400" />
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontSize: 13, minHeight: 40 } }}
          >
            {TABS.map((t) => (
              <Tab key={t.label} label={t.label} />
            ))}
          </Tabs>

          {ordersQuery.isLoading ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>
          ) : ordersQuery.isError ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>订单加载失败</Typography>
              <Button size="small" onClick={() => ordersQuery.refetch()}>重试</Button>
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography sx={{ fontSize: 13, color: 'text.disabled', mb: 1.5 }}>暂无订单</Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button size="small" variant="outlined" component={Link} href="/recharge">充值钻石</Button>
                <Button size="small" variant="outlined" component={Link} href="/account/vip">开通会员</Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {filtered.map((o) => {
                const tm = TYPE_META[o.orderType] ?? OTHER_TYPE;
                const sm = statusMeta(o.status);
                return (
                  <Box
                    key={o.orderNo}
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
                          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{o.productName || tm.label}</Typography>
                          <Tag text={tm.label} color={tm.color} bg={`${tm.color}22`} />
                          <Tag text={sm.label} color={sm.color} bg={sm.bg} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography
                            sx={{ fontSize: 10, color: 'text.disabled', fontFamily: 'monospace', cursor: 'pointer' }}
                            onClick={() => copy(o.orderNo)}
                          >
                            {o.orderNo}
                          </Typography>
                          <ContentCopyRoundedIcon sx={{ fontSize: 11, color: 'text.disabled', cursor: 'pointer' }} onClick={() => copy(o.orderNo)} />
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>· {formatTime(o.createdAt)}</Typography>
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {yuan(o.amountCents)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                      {o.status === 'pending' && (
                        <>
                          <Button size="small" variant="outlined" onClick={() => handleCancel(o)} sx={{ textTransform: 'none', fontSize: 11 }}>
                            取消订单
                          </Button>
                          {tm.reorder && (
                            <Button size="small" variant="contained" component={Link} href={tm.reorder} sx={{ textTransform: 'none', fontSize: 11 }}>
                              重新下单
                            </Button>
                          )}
                        </>
                      )}
                      {o.status === 'paid' && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setRefundTarget(o);
                            setRefundReason('');
                          }}
                          sx={{ textTransform: 'none', fontSize: 11 }}
                        >
                          申请退款
                        </Button>
                      )}
                      <Button size="small" variant="outlined" onClick={() => setDetail(o)} sx={{ textTransform: 'none', fontSize: 11 }}>
                        订单详情
                      </Button>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          <Dialog open={!!refundTarget} onClose={() => !processing && setRefundTarget(null)} maxWidth="xs" fullWidth>
            <DialogTitle>申请退款</DialogTitle>
            <DialogContent>
              {refundTarget && (
                <Box sx={{ pt: 1 }}>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
                    {refundTarget.productName} · {yuan(refundTarget.amountCents)}
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
              <Button onClick={() => setRefundTarget(null)} disabled={processing}>取消</Button>
              <Button
                variant="contained"
                onClick={handleRefundSubmit}
                disabled={processing}
                startIcon={processing ? <CircularProgress size={14} color="inherit" /> : null}
              >
                提交申请
              </Button>
            </DialogActions>
          </Dialog>

          <Drawer anchor="right" open={!!detail} onClose={() => setDetail(null)} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 }, p: 3 } } }}>
            {detail && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>订单详情</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Row label="订单号" value={detail.orderNo} mono />
                  <Row label="商品" value={detail.productName || (TYPE_META[detail.orderType] ?? OTHER_TYPE).label} />
                  <Row label="金额" value={yuan(detail.amountCents)} />
                  <Row label="状态" value={statusMeta(detail.status).label} />
                  <Row label="支付方式" value={CHANNEL_LABEL[detail.channel] ?? (detail.channel || '-')} />
                  <Row label="下单时间" value={formatTime(detail.createdAt)} />
                  <Row label="支付时间" value={formatTime(detail.paidAt)} />
                </Box>
                <Divider sx={{ my: 2 }} />
                <Button fullWidth variant="contained" onClick={() => setDetail(null)} sx={{ textTransform: 'none' }}>
                  关闭
                </Button>
              </Box>
            )}
          </Drawer>
        </LoginGate>

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

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700, color }}>{value}</Typography>
    </Box>
  );
}

function Tag({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: bg, color, fontSize: 9, fontWeight: 700 }}>{text}</Box>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, textAlign: 'right', fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  );
}
