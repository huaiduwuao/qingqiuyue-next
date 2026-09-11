'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import { CTA_GRADIENT, gradient3 } from '@/constants/gradients';
import { LoginGate } from '@/components/auth/LoginGate';
import { isAuthError, formatApiError } from '@/lib/api/client';
import {
  createOrder,
  getMembershipPlans,
  getMembershipStatus,
  getOrderList,
  type MembershipPlan,
  type PaymentOrder,
} from '@/apis/payment';

/**
 * 会员中心 —— 套餐来自 membership_plan(GET /payment/membership-plans),
 * 会员状态来自 user_membership(GET /payment/membership),开通走真实支付订单,
 * 到账由支付网关验签回调写入;续费记录是已支付的会员订单。
 */

type Period = 'monthly' | 'yearly';
const PERIOD_LABEL: Record<Period, string> = { monthly: '月付', yearly: '年付' };
const PLAN_COLORS = ['#FFB400', '#FE2C55', '#8B5CF6', '#5B8DEF'];

function yuan(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

function planFeatures(p: MembershipPlan): string[] {
  const out: string[] = [];
  if (p.dailyVideoQuota) out.push(`每日视频生成 ${p.dailyVideoQuota} 次`);
  if (p.dailyChatQuota) out.push(`每日 AI 对话 ${p.dailyChatQuota} 次`);
  if (p.description) out.push(...p.description.split(/[\n;；]/).map((s) => s.trim()).filter(Boolean));
  return out;
}

export default function VipPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('monthly');
  const [buyPlan, setBuyPlan] = useState<MembershipPlan | null>(null);
  const [channel, setChannel] = useState<'wechat' | 'alipay'>('wechat');
  const [buying, setBuying] = useState(false);
  const [payment, setPayment] = useState<{ orderNo: string; codeUrl?: string } | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const plansQ = useQuery({ queryKey: ['membership-plans'], queryFn: getMembershipPlans, staleTime: 5 * 60 * 1000 });
  const statusQ = useQuery({ queryKey: ['membership-status'], queryFn: getMembershipStatus, refetchOnMount: 'always' });
  const ordersQ = useQuery({
    queryKey: ['payment-orders'],
    queryFn: () => getOrderList({ page: 1, pageSize: 100 }),
    refetchOnMount: 'always',
  });

  const plans = plansQ.data ?? [];
  const periods = useMemo(
    () => (['monthly', 'yearly'] as Period[]).filter((p) => plans.some((plan) => plan.period === p)),
    [plans],
  );
  const activePeriod = periods.includes(period) ? period : periods[0] ?? 'monthly';
  const visiblePlans = plans.filter((p) => p.period === activePeriod);
  const membership = statusQ.data;
  const isActive = membership?.status === 'active';
  const history = ((ordersQ.data?.list ?? []) as PaymentOrder[]).filter((o) => o.orderType === 'membership');

  const handleBuy = async () => {
    if (!buyPlan || buying) return;
    setBuying(true);
    try {
      const res = await createOrder({ orderType: 'membership', productId: buyPlan.id, channel });
      if (!res?.orderNo) {
        setSnack('下单失败:支付服务没有返回订单号');
        return;
      }
      const params = res.payParams as { code_url?: string; codeUrl?: string } | undefined;
      setPayment({ orderNo: res.orderNo, codeUrl: params?.code_url ?? params?.codeUrl });
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
    } catch (err) {
      setSnack(isAuthError(err) ? '登录已过期,请重新登录' : formatApiError(err) || '下单失败');
    } finally {
      setBuying(false);
    }
  };

  // 「我已完成支付」只重新拉取会员状态;开通只可能来自支付网关的验签回调。
  const handlePaid = async () => {
    const [status] = await Promise.all([statusQ.refetch(), ordersQ.refetch()]);
    setPayment(null);
    setBuyPlan(null);
    setSnack(status.data?.status === 'active' ? '会员已开通' : '尚未收到支付结果,到账后会自动开通,可在「我的订单」查看');
  };

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <LoginGate mode="replace" message="登录后开通会员">
          {/* 当前会员状态 */}
          <Box
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 3,
              color: '#fff',
              background: gradient3('#2A1B3D', '#44318D', '#FE2C55'),
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <WorkspacePremiumRoundedIcon sx={{ fontSize: 44, color: '#FFD566' }} />
            <Box sx={{ flex: 1, minWidth: 200 }}>
              {statusQ.isLoading ? (
                <CircularProgress size={20} sx={{ color: '#fff' }} />
              ) : isActive ? (
                <>
                  <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{membership?.planName || '会员'}</Typography>
                  <Typography sx={{ fontSize: 13, opacity: 0.85 }}>
                    有效期至 {membership?.expiresAt ? new Date(membership.expiresAt).toLocaleDateString('zh-CN') : '-'}
                  </Typography>
                </>
              ) : (
                <>
                  <Typography sx={{ fontSize: 20, fontWeight: 800 }}>
                    {membership?.status === 'expired' ? '会员已过期' : '尚未开通会员'}
                  </Typography>
                  <Typography sx={{ fontSize: 13, opacity: 0.85 }}>选择下方套餐开通,支付成功后立即生效</Typography>
                </>
              )}
            </Box>
          </Box>

          {/* 套餐 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, flex: 1 }}>{isActive ? '续费 / 升级' : '选择套餐'}</Typography>
            {periods.length > 1 && (
              <ToggleButtonGroup size="small" exclusive value={activePeriod} onChange={(_, v) => v && setPeriod(v)}>
                {periods.map((p) => (
                  <ToggleButton key={p} value={p} sx={{ px: 2, fontSize: 12 }}>
                    {PERIOD_LABEL[p]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </Box>

          {plansQ.isLoading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : plansQ.isError ? (
            <Alert severity="error" action={<Button onClick={() => plansQ.refetch()}>重试</Button>}>套餐加载失败</Alert>
          ) : visiblePlans.length === 0 ? (
            <Alert severity="info">暂未上架会员套餐</Alert>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(220px, 1fr))' }, gap: 2, mb: 4 }}>
              {visiblePlans.map((p, idx) => {
                const color = PLAN_COLORS[idx % PLAN_COLORS.length];
                const current = isActive && membership?.planId === p.id;
                return (
                  <Box
                    key={p.id}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: current ? color : 'divider',
                      bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color }}>{p.name}</Typography>
                      {current && (
                        <Box sx={{ px: 0.75, borderRadius: 0.5, bgcolor: `${color}22`, color, fontSize: 10, fontWeight: 700 }}>当前套餐</Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography sx={{ fontSize: 28, fontWeight: 800 }}>{yuan(p.priceCents)}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>/ {p.period === 'yearly' ? '年' : '月'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
                      {planFeatures(p).map((f) => (
                        <Box key={f} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                          <CheckRoundedIcon sx={{ fontSize: 16, color, mt: '1px' }} />
                          <Typography sx={{ fontSize: 13 }}>{f}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Button
                      variant="contained"
                      onClick={() => {
                        setBuyPlan(p);
                        setPayment(null);
                      }}
                      sx={{ background: CTA_GRADIENT, textTransform: 'none', fontWeight: 700 }}
                    >
                      {current ? '续费' : '立即开通'}
                    </Button>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* 成长任务与会员福利在奖励中心 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 4 }}>
            <EntryCard
              icon={<TaskAltRoundedIcon />}
              title="每日任务"
              desc="签到、互动、创作,完成任务领取积分"
              href="/account/reward?tab=tasks"
            />
            <EntryCard
              icon={<CardGiftcardRoundedIcon />}
              title="会员月度福利"
              desc="会员每月领取钻石福利"
              href="/account/reward?tab=benefit"
            />
          </Box>

          {/* 续费记录 */}
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>开通记录</Typography>
          {history.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>还没有会员订单</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {history.map((o) => (
                <Box
                  key={o.orderNo}
                  sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{o.productName}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {new Date(o.paidAt || o.createdAt).toLocaleString('zh-CN', { hour12: false })} · {o.orderNo}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 12, color: o.status === 'paid' ? 'success.main' : 'text.secondary' }}>
                    {o.status === 'paid' ? '已支付' : o.status === 'pending' ? '待支付' : o.status}
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{yuan(o.amountCents)}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </LoginGate>

        {/* 下单与支付 */}
        <Dialog open={!!buyPlan} onClose={() => !buying && setBuyPlan(null)} maxWidth="xs" fullWidth>
          <DialogTitle>开通 {buyPlan?.name}</DialogTitle>
          <DialogContent>
            {buyPlan && !payment && (
              <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800 }}>
                  {yuan(buyPlan.priceCents)}
                  <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', ml: 0.5 }}>
                    / {buyPlan.period === 'yearly' ? '年' : '月'}
                  </Typography>
                </Typography>
                <ToggleButtonGroup exclusive fullWidth size="small" value={channel} onChange={(_, v) => v && setChannel(v)}>
                  <ToggleButton value="wechat">微信支付</ToggleButton>
                  <ToggleButton value="alipay">支付宝</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
            {payment && (
              <Box sx={{ pt: 1, textAlign: 'center' }}>
                {payment.codeUrl ? (
                  <>
                    <Box
                      component="img"
                      alt="支付二维码"
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payment.codeUrl)}`}
                      sx={{ width: 220, height: 220, borderRadius: 1, bgcolor: '#fff', p: 1 }}
                    />
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
                      请使用{channel === 'wechat' ? '微信' : '支付宝'}扫码支付
                    </Typography>
                  </>
                ) : (
                  <Alert severity="warning" sx={{ textAlign: 'left' }}>
                    订单 {payment.orderNo} 已创建,但支付服务没有返回扫码链接,暂时无法在此支付。可在「我的订单」中取消后重试。
                  </Alert>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setBuyPlan(null); setPayment(null); }} disabled={buying}>关闭</Button>
            {payment ? (
              <Button variant="contained" onClick={handlePaid}>我已完成支付</Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleBuy}
                disabled={buying}
                startIcon={buying ? <CircularProgress size={14} color="inherit" /> : null}
              >
                去支付
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
      </Container>
    </Box>
  );
}

function EntryCard({ icon, title, desc, href }: { icon: React.ReactNode; title: string; desc: string; href: string }) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        color: 'text.primary',
        textDecoration: 'none',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{desc}</Typography>
      </Box>
    </Box>
  );
}
