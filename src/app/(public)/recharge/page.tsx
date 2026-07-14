'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DiamondIcon from '@mui/icons-material/Diamond';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import TheatersIcon from '@mui/icons-material/Theaters';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import HistoryIcon from '@mui/icons-material/History';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/styles/theme';
import { ACCENT } from '@/constants/accents';
import { CTA_GRADIENT, gradient2, gradient3 } from '@/constants/gradients';
import { accountClient, isNetworkError, isAuthError, formatApiError } from '@/lib/api/client';
import { getWalletBalance, getWalletTransactions, createRechargeOrder, confirmRecharge, type WalletTransaction } from '@/apis/wallet';
import {
  getDiamondPackages,
  getDiamondBenefits,
  getDiamondActivity,
  type DiamondPackage as ApiDiamondPackage,
  type DiamondBenefit as ApiDiamondBenefit,
  type DiamondActivity as ApiDiamondActivity,
} from '@/apis/dashboard';

type PayMethod = 'wechat' | 'alipay' | 'apple' | 'card';
interface DiamondPackage {
  id: string;
  diamonds: number;
  bonus?: number;
  price: number;
  originalPrice?: number;
  badge?: 'recommend' | 'hot' | 'bonus' | 'first';
  desc: string;
  perDiamond: string;
}
interface DiamondRecord {
  id: number;
  type: 'recharge' | 'consume' | 'reward' | 'gift';
  amount: number;
  balance: number;
  description: string;
  payMethod?: PayMethod;
  createTime: string;
}
interface DiamondBenefit {
  icon: 'crown' | 'flash' | 'gift' | 'badge' | 'support' | 'theater';
  title: string;
  desc: string;
}
interface DiamondActivity {
  title: string;
  subtitle: string;
  endsAt: string;
  rules: string[];
}
const PAY_METHODS: Array<{ key: PayMethod; label: string; sub: string; iconKey: 'wechat' | 'alipay' | 'apple' | 'card'; recommended?: boolean }> = [
  { key: 'wechat', label: '微信支付', sub: '推荐', iconKey: 'wechat', recommended: true },
  { key: 'alipay', label: '支付宝', sub: '快捷', iconKey: 'alipay' },
  { key: 'apple', label: 'Apple Pay', sub: 'iOS 用户', iconKey: 'apple' },
  { key: 'card', label: '银行卡', sub: '储蓄卡/信用卡', iconKey: 'card' },
];

const BENEFIT_ICON_MAP: Record<string, React.ComponentType<{ sx?: any }>> = {
  crown: EmojiEventsIcon,
  flash: FlashOnIcon,
  gift: CardGiftcardIcon,
  badge: LocalFireDepartmentIcon,
  support: SupportAgentIcon,
  theater: TheatersIcon,
};

const PAY_ICON: Record<string, { color: string; bg: string; label: string }> = {
  wechat: { color: '#07C160', bg: 'rgba(7, 193, 96, 0.12)', label: '微' },
  alipay: { color: '#1677FF', bg: 'rgba(22, 119, 255, 0.12)', label: '支' },
  apple: { color: '#fff', bg: 'rgba(255,255,255,0.1)', label: '' },
  card: { color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)', label: '卡' },
};

const RECORD_TYPE_LABEL: Record<DiamondRecord['type'], { text: string; color: string }> = {
  recharge: { text: '充值', color: '#5DDB96' },
  consume: { text: '消费', color: '#FF6B8A' },
  reward: { text: '奖励', color: '#FFB400' },
  gift: { text: '赠送', color: ACCENT.cyan.main },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    const diff = Math.max(0, new Date(target).getTime() - now);
    const day = Math.floor(diff / 86_400_000);
    const hr = Math.floor((diff % 86_400_000) / 3_600_000);
    const mn = Math.floor((diff % 3_600_000) / 60_000);
    const sc = Math.floor((diff % 60_000) / 1000);
    return { day, hr, mn, sc };
  }, [now, target]);
}

function RechargePageContent() {
  const router = useRouter();
  const [selectedPkg, setSelectedPkg] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat');
  const [paying, setPaying] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [order, setOrder] = useState<{ id: string; amount: number; diamonds: number; method: PayMethod; qrUrl?: string } | null>(null);
  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'info' }>({ open: false, msg: '', severity: 'success' });

  // 真接口:充值包 / 权益 / 活动
  const pkgQ = useQuery({
    queryKey: ['recharge-packages'],
    queryFn: () => getDiamondPackages().then((r) => r.list || []),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
  const benefitQ = useQuery({
    queryKey: ['recharge-benefits'],
    queryFn: () => getDiamondBenefits().then((r) => r.list || []),
    staleTime: 10 * 60 * 1000,
  });
  const activityQ = useQuery({
    queryKey: ['recharge-activity'],
    queryFn: () => getDiamondActivity(),
    staleTime: 60 * 1000,
  });

  const DIAMOND_PACKAGES: DiamondPackage[] = (pkgQ.data ?? []).map((p: ApiDiamondPackage) => ({
    id: p.id,
    diamonds: p.diamonds,
    bonus: p.bonus,
    price: p.price,
    originalPrice: p.originalPrice,
    badge: p.badge,
    desc: p.desc,
    perDiamond: p.perDiamond,
  }));
  const DIAMOND_BENEFITS: DiamondBenefit[] = (benefitQ.data ?? []).map((b: ApiDiamondBenefit) => ({
    icon: b.icon,
    title: b.title,
    desc: b.desc,
  }));
  const DIAMOND_ACTIVITY: DiamondActivity = activityQ.data ?? {
    title: '',
    subtitle: '',
    endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    rules: [],
  };

  // 选中默认值:首次加载完后默认选 recommend
  useEffect(() => {
    if (!selectedPkg && DIAMOND_PACKAGES.length > 0) {
      const recommended = DIAMOND_PACKAGES.find((p) => p.badge === 'recommend') ?? DIAMOND_PACKAGES[0];
      setSelectedPkg(recommended.id);
    }
  }, [DIAMOND_PACKAGES, selectedPkg]);

  const countdown = useCountdown(DIAMOND_ACTIVITY.endsAt);

  // 真接口:当前钱包余额
  const walletQ = useQuery({
    queryKey: ['wallet'],
    queryFn: () => getWalletBalance(),
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const balanceDiamonds = Math.floor((walletQ.data?.balance ?? 0) / 10); // 1 钻 = 1 分,余额(分) → 钻

  // 真接口:钱包流水
  const txQ = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => getWalletTransactions({ page: 1, size: 30 }),
    refetchOnMount: 'always',
    staleTime: 0,
  });
  // 把 wallet_tx 转成页面用的 DiamondRecord 形态
  const records: DiamondRecord[] = (txQ.data?.data?.list ?? []).map((t: WalletTransaction, idx: number) => {
    const diamonds = Math.floor(Math.abs(t.amount) / 10);
    const isRecharge = t.type === 'recharge' || t.amount > 0;
    return {
      id: t.id ?? idx,
      type: isRecharge ? 'recharge' : (t.type as any) || 'consume',
      amount: diamonds,
      balance: Math.floor((t.balanceAfter ?? 0) / 10),
      description: t.remark || (isRecharge ? `充值入账 +${diamonds} 钻` : `${t.type} -${diamonds} 钻`),
      payMethod: undefined,
      createTime: t.createTime,
    };
  });

  const pkg = DIAMOND_PACKAGES.find((p) => p.id === selectedPkg);
  const totalDiamonds = pkg ? pkg.diamonds + (pkg.bonus ?? 0) : 0;

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/home/recommend');
    }
  };

  const handlePay = async () => {
    if (!pkg || paying) return;
    setPaying(true);
    const amountYuan = pkg.price; // 元
    const amountFen = Math.round(amountYuan * 100); // 分
    const diamonds = pkg.diamonds + (pkg.bonus ?? 0);
    try {
      // 真接口:钱包充值订单(后端 walletapp 已实现)
      let res: { orderNo?: string; amount?: number; payTip?: string } = {};
      try {
        res = await createRechargeOrder({
          amount: amountFen,
          channel: payMethod === 'wechat' ? 'wechat' : payMethod === 'alipay' ? 'alipay' : 'mock',
        });
      } catch (err) {
        // 网络层失败 → 回退到本地 mock 二维码(保留 UX,网络好了会自动恢复)
        if (isNetworkError(err)) {
          const orderId = `ORD${Date.now()}`;
          const qrData = JSON.stringify({ orderId, amount: amountYuan, method: payMethod, diamonds });
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData)}`;
          setOrder({ id: orderId, amount: amountYuan, diamonds, method: payMethod, qrUrl });
          setPayDialogOpen(true);
          setToast({ open: true, msg: '网络异常,已切换到本地二维码演示', severity: 'info' });
          return;
        }
        throw err;
      }
      // 把 orderNo + 支付方式显示到弹窗;payTip 字段是后端的 mock 提示
      const orderId = res.orderNo || `ORD${Date.now()}`;
      const qrData = JSON.stringify({ orderNo: orderId, amount: res.amount, method: payMethod });
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData)}`;
      setOrder({ id: res.orderNo || `ORD${Date.now()}`, amount: amountYuan, diamonds, method: payMethod, qrUrl });
      setPayDialogOpen(true);
    } catch (err) {
      if (isAuthError(err)) {
        setToast({ open: true, msg: '登录已过期,请重新登录', severity: 'info' });
      } else {
        setToast({ open: true, msg: formatApiError(err) || '创建订单失败', severity: 'info' });
      }
    } finally {
      setPaying(false);
    }
  };

  const handlePaySuccess = async () => {
    if (!order || !pkg) return;
    const orderId = order.id;
    const gained = order.diamonds;
    try {
      // 真接口:确认支付 → 后端 walletapp 标记已付 + 入账,前端只刷新缓存
      try {
        await confirmRecharge({ orderNo: orderId });
      } catch (err) {
        if (isNetworkError(err)) {
          setPayDialogOpen(false);
          setOrder(null);
          setToast({ open: true, msg: `网络异常,稍后到账 +${gained} 钻`, severity: 'success' });
          return;
        }
        throw err;
      }
      // 触发余额 + 流水刷新
      await Promise.all([walletQ.refetch(), txQ.refetch()]);
      setPayDialogOpen(false);
      setOrder(null);
      setToast({ open: true, msg: `充值成功!+${gained} 钻`, severity: 'success' });
    } catch (err) {
      if (isAuthError(err)) {
        setToast({ open: true, msg: '登录已过期,请重新登录', severity: 'info' });
      } else {
        setToast({ open: true, msg: formatApiError(err) || '确认支付失败', severity: 'info' });
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: '#0a0a0f',
        color: 'rgba(255,255,255,0.92)',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* 顶部固定栏 */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          height: 60,
          px: { xs: 2, md: 4 },
          bgcolor: 'rgba(10, 10, 15, 0.7)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <IconButton onClick={handleBack} size="small" aria-label="返回" sx={{ color: 'rgba(255,255,255,0.75)' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
          充值中心
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          component={Link}
          href="/home/recommend"
          size="small"
          sx={{
            textTransform: 'none',
            fontSize: 12,
            color: 'rgba(255,255,255,0.6)',
            '&:hover': { color: 'rgba(255,255,255,0.95)', bgcolor: 'rgba(255,255,255,0.06)' },
          }}
        >
          回到首页
        </Button>
      </Box>

      {/* Hero 余额区 */}
      <Box
        sx={{
          position: 'relative',
          pt: { xs: 4, md: 6 },
          pb: { xs: 4, md: 6 },
          px: { xs: 2, md: 4 },
          overflow: 'hidden',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(255, 180, 0, 0.18) 0%, transparent 60%), ' +
              'radial-gradient(ellipse 50% 40% at 80% 20%, rgba(139, 92, 246, 0.18) 0%, transparent 60%), ' +
              'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(254, 44, 85, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), ' +
              'linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            maxWidth: 1200,
            mx: 'auto',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
            gap: { xs: 4, md: 5 },
            alignItems: 'center',
          }}
        >
          <Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#FFB400',
                  boxShadow: '0 0 12px #FFB400',
                  animation: 'dot-pulse 1.6s ease-in-out infinite',
                  '@keyframes dot-pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                  },
                }}
              />
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: 2, textTransform: 'uppercase' }}>
                Diamond Center · 钻石充值
              </Typography>
            </Box>

            <Typography
              sx={{
                fontSize: { xs: 32, md: 48 },
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -1,
                background: 'linear-gradient(135deg, #fff 0%, #FFD566 60%, #FE2C55 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                mb: 2,
              }}
            >
              充值钻石 ·<br />
              畅享清秋月
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: 14, md: 15 },
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.7,
                mb: 3,
                maxWidth: 520,
              }}
            >
              钻石用于解锁付费内容、打赏创作者、开通画质会员等多项权益,1 钻 = 1 分钱,永不过期。
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label="1 钻 = 1 分"
                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600, height: 24, '& .MuiChip-label': { px: 1.25 } }}
              />
              <Chip
                size="small"
                label="充值即开发票"
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 500, height: 24, '& .MuiChip-label': { px: 1.25 } }}
              />
              <Chip
                size="small"
                icon={<CheckCircleIcon sx={{ fontSize: 12, color: '#5DDB96 !important' }} />}
                label="支付安全"
                sx={{ bgcolor: 'rgba(93, 219, 150, 0.12)', color: '#5DDB96', fontSize: 11, fontWeight: 600, height: 24, border: '1px solid rgba(93, 219, 150, 0.3)', '& .MuiChip-label': { px: 0.5 } }}
              />
            </Box>
          </Box>

          {/* 余额卡 */}
          <Box
            sx={{
              position: 'relative',
              p: { xs: 3, md: 4 },
              borderRadius: 3.5,
              background: gradient3('#FFB400', '#FE2C55', '#8B5CF6', 50),
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(254, 44, 85, 0.25)',
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.25), transparent 50%)',
              }}
            />
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <DiamondIcon sx={{ fontSize: 18, color: '#fff' }} />
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
                  Current Balance
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2.5 }}>
                <Typography sx={{ fontSize: { xs: 44, md: 56 }, fontWeight: 800, color: '#fff', lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                  {walletQ.isLoading ? '—' : balanceDiamonds}
                </Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                  钻
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 2, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                  ≈ ¥ {(balanceDiamonds * 0.01).toFixed(2)} · 永不过期
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box
                  component={Link}
                  href="#records"
                  sx={{ fontSize: 11, color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                >
                  <HistoryIcon sx={{ fontSize: 12 }} />
                  充值记录
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 活动 banner */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 2 }}>
        <Box
          sx={{
            position: 'relative',
            maxWidth: 1200,
            mx: 'auto',
            p: { xs: 2, md: 2.5 },
            borderRadius: 2.5,
            bgcolor: 'rgba(255, 180, 0, 0.08)',
            border: '1px solid rgba(255, 180, 0, 0.25)',
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 20,
              }}
            >
              <LocalFireDepartmentIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#FFD566' }}>
                  {DIAMOND_ACTIVITY.title}
                </Typography>
                <Chip
                  size="small"
                  label="限时"
                  sx={{ bgcolor: 'rgba(255, 180, 0, 0.2)', color: '#FFD566', fontSize: 9, fontWeight: 700, height: 18, '& .MuiChip-label': { px: 0.75 } }}
                />
              </Box>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                {DIAMOND_ACTIVITY.subtitle}
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              bgcolor: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255, 180, 0, 0.2)',
            }}
          >
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>
              距结束
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              {[
                { v: countdown.day, l: '天' },
                { v: countdown.hr, l: '时' },
                { v: countdown.mn, l: '分' },
                { v: countdown.sc, l: '秒' },
              ].map((c, i) => (
                <Box key={c.l} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  {i > 0 && <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>:</Typography>}
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#FFD566', fontVariantNumeric: 'tabular-nums', minWidth: 18, textAlign: 'center' }}>
                    {c.v.toString().padStart(2, '0')}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 套餐 + 支付 + 记录 三栏 */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
        <Box
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' },
            gap: 3,
          }}
        >
          {/* 左:套餐 + 支付方式 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* 套餐 */}
            <Box
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(20, 22, 32, 0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <Box
                  sx={{
                    width: 4,
                    height: 18,
                    borderRadius: 2,
                    background: CTA_GRADIENT.YELLOW_RED,
                    boxShadow: '0 0 8px rgba(255, 180, 0, 0.5)',
                  }}
                />
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  选择充值档位
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  1 钻 = 1 分钱 · 充值越多越划算
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                  gap: 1.5,
                }}
              >
                {DIAMOND_PACKAGES.map((p) => {
                  const isSelected = selectedPkg === p.id;
                  return <PackageCard key={p.id} pkg={p} selected={isSelected} onClick={() => setSelectedPkg(p.id)} />;
                })}
              </Box>
            </Box>

            {/* 支付方式 */}
            <Box
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(20, 22, 32, 0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box
                  sx={{
                    width: 4,
                    height: 18,
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, #06B6D4 0%, #5B8DEF 100%)',
                  }}
                />
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  支付方式
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,0.4)' }}>
                  <LockOutlinedIcon sx={{ fontSize: 11 }} />
                  <Typography sx={{ fontSize: 10 }}>支付链路加密</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                {PAY_METHODS.map((m) => {
                  const isSelected = payMethod === m.key;
                  const meta = PAY_ICON[m.iconKey];
                  return (
                    <Box
                      key={m.key}
                      onClick={() => setPayMethod(m.key)}
                      sx={{
                        position: 'relative',
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: isSelected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid',
                        borderColor: isSelected ? ACCENT.cyan.border30 : 'rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: isSelected ? ACCENT.cyan.border30 : 'rgba(255,255,255,0.15)' },
                      }}
                    >
                      {m.recommended && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -6,
                            right: 8,
                            px: 0.5,
                            py: 0.1,
                            borderRadius: 0.5,
                            bgcolor: ACCENT.cyan.main,
                            color: '#0a0a0f',
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: 0.3,
                          }}
                        >
                          推荐
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1.5,
                            bgcolor: meta.bg,
                            color: meta.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 800,
                            border: m.iconKey === 'apple' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                            flexShrink: 0,
                          }}
                        >
                          {m.iconKey === 'apple' ? '' : meta.label}
                          {m.iconKey === 'apple' && (
                            <Box
                              component="svg"
                              viewBox="0 0 24 24"
                              sx={{ width: 16, height: 16, fill: '#fff' }}
                            >
                              <path d="M17.05 20.28c-.98.95-2.05.86-3.08.42-1.09-.45-2.09-.46-3.24 0-1.44.62-2.2.44-3.06-.42C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                            </Box>
                          )}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                            {m.label}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                            {m.sub}
                          </Typography>
                        </Box>
                      </Box>
                      {isSelected && (
                        <CheckCircleIcon
                          sx={{ position: 'absolute', top: 6, right: 6, fontSize: 14, color: ACCENT.cyan.main }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>

          {/* 右:确认支付 + 权益 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* 确认支付卡 */}
            <Box
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 3,
                bgcolor: 'rgba(20, 22, 32, 0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(8px)',
                position: { lg: 'sticky' },
                top: { lg: 80 },
              }}
            >
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, mb: 1.5 }}>
                Order Summary
              </Typography>
              {pkg && (
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#FFD566' }}>
                        {pkg.diamonds}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>钻</Typography>
                      {pkg.bonus ? (
                        <Box
                          sx={{
                            ml: 1,
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 0.75,
                            background: gradient2('#FE2C55', '#FFB400'),
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          + {pkg.bonus}
                        </Box>
                      ) : null}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                        ¥ {pkg.price}
                      </Typography>
                      {pkg.originalPrice && (
                        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>
                          ¥ {pkg.originalPrice}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                    {pkg.desc} · 单价 ¥{pkg.perDiamond} / 钻
                  </Typography>
                  {pkg.bonus ? (
                    <Typography sx={{ fontSize: 11, color: '#5DDB96', fontWeight: 600, mt: 0.5 }}>
                      合计 {totalDiamonds} 钻 · 多送 {pkg.bonus} 钻
                    </Typography>
                  ) : null}
                </Box>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
                <Row k="充值钻石" v={`${pkg?.diamonds ?? 0} 钻`} />
                {pkg?.bonus ? <Row k="活动赠送" v={`+${pkg.bonus} 钻`} highlight /> : null}
                <Row k="支付方式" v={PAY_METHODS.find((m) => m.key === payMethod)?.label ?? ''} />
                <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.06)' }} />
                <Row k="实付金额" v={pkg ? `¥ ${pkg.price}` : '—'} bold />
              </Box>

              <Button
                fullWidth
                size="large"
                onClick={handlePay}
                disabled={!pkg || paying}
                startIcon={
                  paying ? (
                    <Box
                      component="span"
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        animation: 'spin 0.8s linear infinite',
                        '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
                      }}
                    />
                  ) : (
                    <CheckCircleIcon sx={{ fontSize: 18 }} />
                  )
                }
                sx={{
                  background: CTA_GRADIENT.RED_YELLOW,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  textTransform: 'none',
                  py: 1.5,
                  borderRadius: 2,
                  boxShadow: '0 8px 20px rgba(254, 44, 85, 0.3)',
                  '&:hover': { background: CTA_GRADIENT.RED_YELLOW, filter: 'brightness(1.1)' },
                  '&.Mui-disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' },
                }}
              >
                {paying ? '正在支付…' : pkg ? `确认支付 ¥ ${pkg.price}` : '请选择档位'}
              </Button>

              <Typography
                sx={{
                  mt: 1.5,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.35)',
                  textAlign: 'center',
                  lineHeight: 1.6,
                }}
              >
                点击支付即视为同意《清秋月虚拟货币服务协议》
              </Typography>
            </Box>

            {/* 权益 */}
            <Box
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 3,
                bgcolor: 'rgba(20, 22, 32, 0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box
                  sx={{
                    width: 4,
                    height: 18,
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, #8B5CF6 0%, #FE2C55 100%)',
                  }}
                />
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  钻石专享权益
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {DIAMOND_BENEFITS.map((b) => {
                  const Icon = BENEFIT_ICON_MAP[b.icon] ?? CardGiftcardIcon;
                  return (
                    <Box
                      key={b.title}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <Icon sx={{ fontSize: 14, color: '#FFD566' }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                          {b.title}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                        {b.desc}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 充值记录 */}
      <Box id="records" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Box
              sx={{
                width: 4,
                height: 18,
                borderRadius: 2,
                background: 'linear-gradient(180deg, #5DDB96 0%, #06B6D4 100%)',
              }}
            />
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              充值与流水记录
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              仅显示近 30 天
            </Typography>
          </Box>

          <Box
            sx={{
              borderRadius: 3,
              bgcolor: 'rgba(20, 22, 32, 0.6)',
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* 表头 */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr 1fr', sm: '2fr 1fr 1fr 1.5fr' },
                gap: 2,
                px: 2.5,
                py: 1.5,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                说明
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: { xs: 'none', sm: 'block' } }}>
                类型
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right' }}>
                变动
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                余额 / 时间
              </Typography>
            </Box>

            {txQ.isLoading ? (
              <Box sx={{ px: 2.5, py: 6, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>记录加载中…</Typography>
              </Box>
            ) : records.length === 0 ? (
              <Box sx={{ px: 2.5, py: 6, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>暂无充值或流水记录</Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', mt: 0.5 }}>完成第一笔充值后会显示在这里</Typography>
              </Box>
            ) : (
              records.map((r) => {
                const typeMeta = RECORD_TYPE_LABEL[r.type];
                const payMeta = r.payMethod ? PAY_METHODS.find((m) => m.key === r.payMethod) : null;
                const isPositive = r.amount > 0;
                return (
                  <Box
                    key={r.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr 1fr 1fr', sm: '2fr 1fr 1fr 1.5fr' },
                      gap: 2,
                      px: 2.5,
                      py: 1.5,
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      '&:last-child': { borderBorder: 'none' },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: 13,
                          color: '#fff',
                          lineHeight: 1.4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.description}
                      </Typography>
                      {payMeta && (
                        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', mt: 0.25 }}>
                          {payMeta.label}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 0.75,
                          bgcolor: `${typeMeta.color}1A`,
                          color: typeMeta.color,
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {typeMeta.text}
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        sx={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: isPositive ? '#5DDB96' : '#FF6B8A',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {isPositive ? '+' : ''}{r.amount}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>
                        {r.balance} 钻
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                        {formatTime(r.createTime)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* 活动规则 */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
              活动规则
            </Typography>
          </Box>
          <Box component="ul" sx={{ pl: 2.5, m: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.8 }}>
            {DIAMOND_ACTIVITY.rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      <Box sx={{ py: 4, px: { xs: 2, md: 4 }, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          © 2026 清秋月 · 钻石为虚拟货币,一经充值不退 · 客服 9:00 - 23:00
        </Typography>
      </Box>

      <Dialog
        open={payDialogOpen}
        onClose={() => setPayDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(20, 22, 32, 0.98)',
              backgroundImage: 'none',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3,
              color: '#fff',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>
          订单支付
        </DialogTitle>
        <DialogContent>
          {order && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 1 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>支付金额</Typography>
                <Typography sx={{ fontSize: 32, fontWeight: 800, color: '#FFD566' }}>¥ {order.amount}</Typography>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>获得 {order.diamonds} 钻 · 订单号 {order.id}</Typography>
              </Box>
              {order.method === 'wechat' || order.method === 'alipay' ? (
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    component="img"
                    src={order.qrUrl}
                    alt="支付二维码"
                    sx={{ width: 180, height: 180, borderRadius: 2, bgcolor: '#fff', p: 1 }}
                  />
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mt: 1 }}>请使用{PAY_METHODS.find((m) => m.key === order.method)?.label}扫码支付</Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>请在对应 App 或网银完成支付</Typography>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mt: 0.5 }}>{PAY_METHODS.find((m) => m.key === order.method)?.label}</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setPayDialogOpen(false)}
            sx={{ borderRadius: 2, textTransform: 'none', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}
          >
            取消支付
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handlePaySuccess}
            sx={{ borderRadius: 2, textTransform: 'none', background: CTA_GRADIENT.RED_YELLOW, color: '#fff' }}
          >
            已完成支付
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={2400}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          icon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
          sx={{ bgcolor: 'rgba(20, 22, 32, 0.95)', color: '#fff', border: '1px solid rgba(93, 219, 150, 0.4)' }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function RechargePage() {
  return (
    <ThemeProvider theme={darkTheme}>
      <RechargePageContent />
    </ThemeProvider>
  );
}

function PackageCard({ pkg, selected, onClick }: { pkg: DiamondPackage; selected: boolean; onClick: () => void }) {
  const isFirst = pkg.badge === 'first';
  const isHot = pkg.badge === 'hot';
  const isRecommend = pkg.badge === 'recommend';
  const isBonus = pkg.badge === 'bonus' && !isFirst && !isHot && !isRecommend;

  const badgeColor = isRecommend
    ? { bg: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', text: '#fff' }
    : isHot
    ? { bg: 'linear-gradient(90deg, #FE2C55 0%, #FF6B8A 100%)', text: '#fff' }
    : isFirst
    ? { bg: 'linear-gradient(90deg, #5B8DEF 0%, #8B5CF6 100%)', text: '#fff' }
    : isBonus
    ? { bg: 'linear-gradient(90deg, #5DDB96 0%, #06B6D4 100%)', text: '#fff' }
    : null;

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        p: 2,
        borderRadius: 2.5,
        cursor: 'pointer',
        bgcolor: selected ? 'rgba(255, 180, 0, 0.06)' : 'rgba(255,255,255,0.02)',
        border: '1.5px solid',
        borderColor: selected ? '#FFB400' : 'rgba(255,255,255,0.08)',
        transition: 'all 0.15s',
        overflow: 'hidden',
        '&:hover': {
          borderColor: selected ? '#FFB400' : 'rgba(255,255,255,0.2)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      {badgeColor && pkg.badge && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            px: 1,
            py: 0.25,
            background: badgeColor.bg,
            color: badgeColor.text,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.5,
            borderBottomLeftRadius: 6,
            textTransform: 'uppercase',
          }}
        >
          {pkg.badge === 'recommend' ? '推荐' : pkg.badge === 'hot' ? '热卖' : pkg.badge === 'first' ? '首充' : '加赠'}
        </Box>
      )}
      {selected && (
        <CheckCircleIcon
          sx={{ position: 'absolute', top: 6, left: 6, fontSize: 16, color: '#FFB400' }}
        />
      )}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5, mt: pkg.badge ? 0.5 : 0 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 800, color: selected ? '#FFD566' : '#fff', lineHeight: 1 }}>
          {pkg.diamonds}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>钻</Typography>
        {pkg.bonus ? (
          <Box
            sx={{
              ml: 0.5,
              px: 0.5,
              py: 0.1,
              borderRadius: 0.5,
              background: gradient2('#FE2C55', '#FFB400'),
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
            }}
          >
            +{pkg.bonus}
          </Box>
        ) : null}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: selected ? '#FFB400' : '#FFD566' }}>
          ¥ {pkg.price}
        </Typography>
        {pkg.originalPrice && pkg.originalPrice > pkg.price && (
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>
            ¥ {pkg.originalPrice}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
        {pkg.desc}
      </Typography>
    </Box>
  );
}

function Row({ k, v, bold, highlight }: { k: string; v: string; bold?: boolean; highlight?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{k}</Typography>
      <Typography
        sx={{
          fontSize: bold ? 15 : 12,
          fontWeight: bold ? 700 : 500,
          color: highlight ? '#5DDB96' : '#fff',
        }}
      >
        {v}
      </Typography>
    </Box>
  );
}
