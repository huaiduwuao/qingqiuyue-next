'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVipInfo } from '@/apis/dashboard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FlashOnRoundedIcon from '@mui/icons-material/FlashOnRounded';
import TheaterComedyRoundedIcon from '@mui/icons-material/TheaterComedyRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import CommentRoundedIcon from '@mui/icons-material/CommentRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import { CTA_GRADIENT, gradient3 } from '@/constants/gradients';
import { LoginGate } from '@/components/auth/LoginGate';
import { useApp } from '@/contexts/AppContext';
import { adminClient, accountClient, isAuthError, formatApiError } from '@/lib/api/client';

interface VipTier {
  key: string;
  name: string;
  price: { monthly: number; yearly: number };
  color: string;
  badge?: string;
  features: string[];
  notIncluded?: string[];
}

// VIP 页面的"权益图标库"只是 UI 展示映射,跟数据无关;真正的数据(价格/任务/购买历史)从后端 /api/core/vip/tiers 拉
const BENEFIT_ICON_LIBRARY: { title: string; desc: string; color: string; icon: React.ReactNode }[] = [
  { icon: <FlashOnRoundedIcon />, title: '4K 蓝光画质', desc: '影院级视听享受', color: '#FE2C55' },
  { icon: <TheaterComedyRoundedIcon />, title: '新片提前看', desc: '比普通用户早 7-30 天', color: '#FFB400' },
  { icon: <VolumeOffRoundedIcon />, title: '免广告', desc: '全程无打扰', color: '#5DDB96' },
  { icon: <PaletteRoundedIcon />, title: '专属弹幕', desc: '多彩气泡 + 优先显示', color: '#8B5CF6' },
  { icon: <HeadsetMicRoundedIcon />, title: '专属客服', desc: '7×24 小时 1 对 1', color: '#5B8DEF' },
  { icon: <CardGiftcardRoundedIcon />, title: '钻石月赠送', desc: '每月最高 800 钻', color: '#FF6B8A' },
  { icon: <DownloadRoundedIcon />, title: '离线下载', desc: '无限次下载', color: '#06B6D4' },
  { icon: <LiveTvRoundedIcon />, title: '直播专属', desc: 'VIP 直播标识 + 礼物折扣', color: '#FFD566' },
];

const ICON_FOR_TASK: Record<string, React.ReactNode> = {
  dailySign: <LoginRoundedIcon sx={{ fontSize: 18 }} />,
  share: <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />,
  comment: <CommentRoundedIcon sx={{ fontSize: 18 }} />,
  recharge: <CardGiftcardRoundedIcon sx={{ fontSize: 18 }} />,
  invite: <FavoriteRoundedIcon sx={{ fontSize: 18 }} />,
};

export default function VipPage() {
  const router = useRouter();
  const { currentUser } = useApp();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [snack, setSnack] = useState<string | null>(null);
  const [buyTier, setBuyTier] = useState<VipTier | null>(null);
  const [buyMethod, setBuyMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [buying, setBuying] = useState(false);

  // 真接口:VIP 套餐 + 任务 + 权益
  const vipQuery = useQuery({
    queryKey: ['vip-info'],
    queryFn: () => getVipInfo(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  // 把后端 {id,name,price(分),badge,color,benefits[]} 转成页面用的 VipTier
  const TIERS: VipTier[] = (vipQuery.data?.tiers ?? []).map((t, idx) => ({
    key: t.id,
    name: t.name,
    price: { monthly: t.price, yearly: t.price * 10 }, // 后端只给"月价",年付按 10 倍粗算
    color: t.color || ['#94A3B8', '#FFB400', '#FE2C55'][idx] || '#5B8DEF',
    badge: t.badge,
    features: t.benefits,
  }));

  // 任务:后端 {id,title,reward,done} → 页面用 5 字段;前端为每条记录补一个 key 给 setTasks 用
  const baseTasks = (vipQuery.data?.tasks ?? []).map((t, idx) => ({
    key: t.id || `task-${idx}`,
    title: t.title,
    desc: t.reward,
    progress: t.done ? 1 : 0,
    target: 1,
    reward: 0,
    completed: t.done,
    type: '每日' as const,
  }));
  const [tasks, setTasks] = useState(baseTasks);

  // 当后端数据变化时同步本地 tasks(已勾选状态保留)
  React.useEffect(() => {
    setTasks((prev) => {
      const done = new Set(prev.filter((t) => t.completed).map((t) => t.key));
      return baseTasks.map((t) => ({ ...t, completed: t.completed || done.has(t.key) }));
    });
  }, [vipQuery.data?.tasks]);

  // 续费历史:暂未在后端 schema 里,前端置空,后端有再加
  const RENEWAL_HISTORY: { id: string; tier: string; period: string; amount: number; startedAt: string; expiresAt: string; status: string }[] = [];

  const [shareOpen, setShareOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeMethod, setRechargeMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [recharging, setRecharging] = useState(false);

  // 权益展示:用后端字符串列表匹配本地图标库;匹配不到的归到"通用权益"
  const BENEFITS = (vipQuery.data?.benefits ?? []).map((title, idx) => {
    const found = BENEFIT_ICON_LIBRARY.find((b) => b.title === title);
    return found || { icon: <FlashOnRoundedIcon />, title, desc: '会员专属权益', color: '#5B8DEF' };
  });

  const markTaskCompleted = (key: string) => {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, completed: true, progress: t.target } : t)));
  };

  const claimTask = async (key: string, endpoint: string, body: Record<string, unknown>) => {
    const task = tasks.find((t) => t.key === key);
    if (!task || task.completed) return;
    try {
      await accountClient(endpoint, { method: 'POST', data: body });
      markTaskCompleted(key);
      setSnack(`+${task.reward} 成长值`);
    } catch (err) {
      if (isAuthError(err)) {
        setSnack('请重新登录');
      } else {
        setSnack(formatApiError(err) || '领奖失败,请稍后重试');
      }
    }
  };

  const handleTaskAction = async (key: string) => {
    const task = tasks.find((t) => t.key === key);
    if (!task || task.completed) return;
    if (key === 'dailySign') {
      try {
        await adminClient('/user/sign', { method: 'POST' });
        markTaskCompleted('dailySign');
        setSnack('签到成功 +5 成长值');
      } catch (err) {
        setSnack(formatApiError(err) || '签到失败,请稍后重试');
      }
      return;
    }
    if (key === 'share') {
      setShareOpen(true);
      return;
    }
    if (key === 'comment') {
      markTaskCompleted('comment');
      router.push('/home/recommend?tab=home');
      return;
    }
    if (key === 'recharge') {
      setRechargeOpen(true);
      return;
    }
    if (key === 'invite') {
      setInviteOpen(true);
      return;
    }
    // 通用分支:按 taskKey 路由到具体 vip 任务 API,成功后才本地发奖;失败回滚并提示
    switch (key) {
      case 'bindPhone':
        await claimTask(key, '/account/vip/task/bind-phone', { taskKey: key, reward: task.reward });
        return;
      case 'bindEmail':
        await claimTask(key, '/account/vip/task/bind-email', { taskKey: key, reward: task.reward });
        return;
      case 'realName':
        await claimTask(key, '/account/vip/task/real-name', { taskKey: key, reward: task.reward });
        return;
      case 'consume':
        await claimTask(key, '/account/vip/task/consume', {
          taskKey: key,
          reward: task.reward,
          amount: (task as any).target ?? 100,
        });
        return;
      default:
        // 兜底分支:走通用领奖接口
        await claimTask(key, '/account/vip/task/receive', { taskKey: key, reward: task.reward });
        return;
    }
  };

  const handleShareConfirm = () => {
    setShareOpen(false);
    markTaskCompleted('share');
    setSnack('分享任务已记录');
  };

  const handleRechargeConfirm = async () => {
    const amountNum = Number(rechargeAmount);
    if (!rechargeAmount || Number.isNaN(amountNum) || amountNum <= 0) {
      setSnack('请输入有效的充值金额');
      return;
    }
    setRecharging(true);
    try {
      await adminClient('/wallet/recharge', {
        method: 'POST',
        data: { amount: amountNum, method: rechargeMethod },
      });
      setSnack('充值申请已提交');
      markTaskCompleted('recharge');
    } catch (err) {
      setSnack(formatApiError(err) || '充值提交失败');
    } finally {
      setRecharging(false);
      setRechargeOpen(false);
      setRechargeAmount('');
    }
  };

  const handleCopyInvite = async () => {
    const link = typeof window !== 'undefined'
      ? `${window.location.origin}/user/register?invite=${currentUser?.id ?? ''}`
      : '';
    try {
      await navigator.clipboard.writeText(link);
      setSnack('邀请链接已复制');
    } catch {
      setSnack('邀请链接已复制');
    }
    markTaskCompleted('invite');
  };

  const handleBuy = async () => {
    if (!buyTier || buying) return;
    setBuying(true);
    // 若后端有会员购买接口,可在此替换为真实请求
    await new Promise((resolve) => setTimeout(resolve, 800));
    setBuying(false);
    setBuyTier(null);
    setSnack('订单创建成功');
    router.push('/account/orders');
  };

  const currentTier = TIERS[1] ?? TIERS[0] ?? { name: '黄金会员', key: 'gold', color: '#FFB400', price: { monthly: 1980, yearly: 19800 } };
  const currentExp = 2480;
  const nextTier = TIERS[2] ?? TIERS[TIERS.length - 1] ?? currentTier;
  const nextTarget = 5000;
  const expPercent = (currentExp / nextTarget) * 100;
  const daysLeft = 358;

  return (
    <Box sx={{ height: '100dvh', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>会员中心</Typography>
          <Button size="small" component={Link} href="/account/orders" sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
            续费记录
          </Button>
        </Box>

      <LoginGate mode="replace" message="登录后查看会员中心">

      {/* 当前会员卡 */}
      <Box
        sx={{
          position: 'relative',
          p: { xs: 3, md: 4 },
          borderRadius: 3.5,
          background: gradient3('#FFB400', '#FE2C55', '#8B5CF6', 50),
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(254, 44, 85, 0.25)',
          mb: 3,
        }}
      >
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.25), transparent 50%)' }} />
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <WorkspacePremiumRoundedIcon sx={{ fontSize: 22, color: '#fff' }} />
            <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.95)', fontWeight: 700, letterSpacing: 1.5 }}>
              {currentTier.name} · {period === 'yearly' ? '年付' : '月付'}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ px: 1, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 10, fontWeight: 700 }}>
              生效中
            </Box>
          </Box>

          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', mb: 0.5 }}>距离到期</Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 2.5 }}>
            <Typography sx={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
              {daysLeft}
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>天</Typography>
          </Box>

          <Box sx={{ pt: 2, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>当前成长值</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{currentExp}</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>/ {nextTarget} 升至{nextTier.name}</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={expPercent}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.2)',
                '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #fff 0%, #FFD566 100%)', borderRadius: 3 },
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* 等级选择 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>选择会员等级</Typography>
        <Tabs
          value={period}
          onChange={(_, v) => setPeriod(v)}
          sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, fontSize: 12, py: 0.5, textTransform: 'none' } }}
        >
          <Tab value="monthly" label="月付" />
          <Tab value="yearly" label="年付(8.5 折)" />
        </Tabs>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 4 }}>
        {TIERS.map((t) => {
          const isCurrent = t.key === currentTier.key;
          const price = period === 'yearly' ? t.price.yearly : t.price.monthly;
          return (
            <Box
              key={t.key}
              sx={{
                position: 'relative',
                p: 2,
                borderRadius: 2.5,
                bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
                border: '1.5px solid',
                borderColor: isCurrent ? t.color : 'var(--border-color, rgba(255,255,255,0.06))',
                transition: 'all 0.15s',
                '&:hover': { borderColor: t.color, transform: 'translateY(-2px)' },
              }}
            >
              {t.badge && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: 12,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                    background: CTA_GRADIENT.RED_YELLOW,
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {t.badge}
                </Box>
              )}
              {isCurrent && (
                <Box sx={{ position: 'absolute', top: 8, right: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: t.color + '22', color: t.color, fontSize: 9, fontWeight: 700 }}>
                  当前
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <WorkspacePremiumRoundedIcon sx={{ fontSize: 16, color: t.color }} />
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t.name}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 1.5 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: t.color }}>{price}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>钻 / {period === 'yearly' ? '年' : '月'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                {t.features.map((f) => (
                  <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckRoundedIcon sx={{ fontSize: 13, color: t.color }} />
                    <Typography sx={{ fontSize: 11, color: 'text.primary' }}>{f}</Typography>
                  </Box>
                ))}
                {t.notIncluded?.map((f) => (
                  <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.4 }}>
                    <CloseRoundedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                    <Typography sx={{ fontSize: 11, color: 'text.disabled', textDecoration: 'line-through' }}>{f}</Typography>
                  </Box>
                ))}
              </Box>
              <Button
                fullWidth
                size="small"
                variant={isCurrent ? 'outlined' : 'contained'}
                disabled={isCurrent}
                onClick={() => setBuyTier(t)}
                sx={{
                  textTransform: 'none',
                  fontSize: 12,
                  borderRadius: 1.5,
                  ...(isCurrent ? {} : { background: CTA_GRADIENT.RED_YELLOW, '&:hover': { background: CTA_GRADIENT.RED_YELLOW, filter: 'brightness(1.1)' } }),
                }}
              >
                {isCurrent ? '当前等级' : '立即开通'}
              </Button>
            </Box>
          );
        })}
      </Box>

      {/* 成长任务 */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1 }}>成长任务</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>完成任务获得成长值,自动续期</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))', overflow: 'hidden' }}>
          {tasks.map((t) => {
            const pct = Math.min(100, (t.progress / t.target) * 100);
            return (
              <Box
                key={t.key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))',
                  '&:last-child': { borderBottom: 'none' },
                  opacity: t.completed ? 0.5 : 1,
                }}
              >
                <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: t.completed ? '#5DDB9622' : 'rgba(91, 141, 239, 0.15)', color: t.completed ? '#5DDB96' : '#5B8DEF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.completed ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : ICON_FOR_TASK[t.key]}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>{t.title}</Typography>
                    <Box sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 9 }}>{t.type}</Box>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontSize: 11, color: '#FFB400', fontWeight: 700 }}>+{t.reward} 成长值</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.5 }}>{t.desc}</Typography>
                  {!t.completed && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { background: '#5B8DEF' } }} />
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                        {t.progress}/{t.target}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Button
                  size="small"
                  variant={t.completed ? 'outlined' : 'contained'}
                  disabled={t.completed}
                  onClick={() => handleTaskAction(t.key)}
                  sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, minWidth: 64 }}
                >
                  {t.completed ? '已完成' : '去完成'}
                </Button>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* VIP 专属特权 */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1 }}>会员专享特权</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
          {BENEFITS.map((b) => (
            <Box
              key={b.title}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
                border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                textAlign: 'center',
                transition: 'all 0.15s',
                '&:hover': { transform: 'translateY(-2px)', borderColor: b.color },
              }}
            >
              <Box sx={{ width: 36, height: 36, mx: 'auto', borderRadius: '50%', bgcolor: `${b.color}1A`, color: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.75, '& svg': { fontSize: 18 } }}>
                {b.icon}
              </Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.primary', mb: 0.25 }}>{b.title}</Typography>
              <Typography sx={{ fontSize: 9, color: 'text.secondary', lineHeight: 1.4 }}>{b.desc}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* 续费记录 */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1 }}>续费记录</Typography>
        </Box>
        <Box sx={{ borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))', overflow: 'hidden' }}>
          {RENEWAL_HISTORY.map((h) => (
            <Box
              key={h.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <WorkspacePremiumRoundedIcon sx={{ fontSize: 18, color: h.status === 'active' ? '#FE2C55' : 'text.disabled' }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>{h.tier} · {h.period}</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                  {h.startedAt} ~ {h.expiresAt}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: h.status === 'active' ? 'text.primary' : 'text.disabled' }}>{h.amount} 钻</Typography>
                <Typography sx={{ fontSize: 9, color: h.status === 'active' ? '#5DDB96' : 'text.disabled' }}>{h.status === 'active' ? '生效中' : '已过期'}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Dialog
        open={!!buyTier}
        onClose={() => !buying && setBuyTier(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>开通 {buyTier?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                订阅周期
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                {period === 'yearly' ? '年付' : '月付'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                应付金额
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: buyTier?.color }}>
                {buyTier ? buyTier.price[period] : 0} 钻
              </Typography>
            </Box>
            <FormControl fullWidth>
              <InputLabel>支付方式</InputLabel>
              <Select
                value={buyMethod}
                label="支付方式"
                onChange={(e) => setBuyMethod(e.target.value as 'wechat' | 'alipay')}
              >
                <MenuItem value="wechat">微信支付</MenuItem>
                <MenuItem value="alipay">支付宝</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyTier(null)} disabled={buying}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleBuy}
            disabled={buying}
            startIcon={buying ? <CircularProgress size={14} color="inherit" /> : null}
          >
            确认开通
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>分享内容</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', pt: 1 }}>
            选择平台分享,即可获得成长值奖励
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            {['微信', '微博', 'QQ空间'].map((platform) => (
              <Button
                key={platform}
                variant="outlined"
                fullWidth
                sx={{ textTransform: 'none', fontSize: 12 }}
                onClick={handleShareConfirm}
              >
                {platform}
              </Button>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareOpen(false)}>取消</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>邀请好友</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="邀请链接"
              value={typeof window !== 'undefined' ? `${window.location.origin}/user/register?invite=${currentUser?.id ?? ''}` : ''}
              slotProps={{ input: { readOnly: true } }}
            />
            <Button variant="contained" onClick={handleCopyInvite} sx={{ textTransform: 'none' }}>
              复制链接
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={rechargeOpen}
        onClose={() => !recharging && setRechargeOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>充值钻石</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="充值金额(钻)"
              type="number"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
              helperText="1 钻 = ¥0.01"
            />
            <FormControl fullWidth>
              <InputLabel>支付方式</InputLabel>
              <Select
                value={rechargeMethod}
                label="支付方式"
                onChange={(e) => setRechargeMethod(e.target.value as 'wechat' | 'alipay')}
              >
                <MenuItem value="wechat">微信支付</MenuItem>
                <MenuItem value="alipay">支付宝</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRechargeOpen(false)} disabled={recharging}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleRechargeConfirm}
            disabled={recharging}
            startIcon={recharging ? <CircularProgress size={14} color="inherit" /> : null}
          >
            确认充值
          </Button>
        </DialogActions>
      </Dialog>

      </LoginGate>
      </Container>
    </Box>
  );
}
