'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
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

interface VipTier {
  key: string;
  name: string;
  price: { monthly: number; yearly: number };
  color: string;
  badge?: string;
  features: string[];
  notIncluded?: string[];
}

const TIERS: VipTier[] = [
  {
    key: 'silver',
    name: '白银会员',
    price: { monthly: 1280, yearly: 12800 },
    color: '#94A3B8',
    features: ['1080P 高清画质', '免广告', '专属弹幕颜色', '每月 100 钻赠送'],
    notIncluded: ['4K 蓝光画质', '影院提前观看', '专属客服'],
  },
  {
    key: 'gold',
    name: '黄金会员',
    price: { monthly: 1980, yearly: 19800 },
    color: '#FFB400',
    badge: '推荐',
    features: ['全部白银权益', '4K 蓝光画质', '新片提前 7 天观看', '每月 300 钻赠送', '专属客服'],
  },
  {
    key: 'diamond',
    name: '钻石会员',
    price: { monthly: 2980, yearly: 29800 },
    color: '#FE2C55',
    features: ['全部黄金权益', '8K 超清画质', '新片提前 30 天观看', '每月 800 钻赠送', '线下活动优先', '1 对 1 专属管家'],
  },
];

const TASKS = [
  { key: 'dailySign', title: '每日签到', desc: '+ 5 成长值', progress: 0, target: 1, reward: 5, completed: false, type: '每日' },
  { key: 'share', title: '分享内容', desc: '分享 1 条内容到外部,+ 10 成长值', progress: 0, target: 3, reward: 30, completed: false, type: '每周' },
  { key: 'comment', title: '发布评论', desc: '+ 2 成长值 / 条', progress: 0, target: 5, reward: 10, completed: false, type: '每周' },
  { key: 'recharge', title: '充值钻石', desc: '充值任意金额 + 50 成长值', progress: 1, target: 1, reward: 50, completed: true, type: '一次性' },
  { key: 'invite', title: '邀请好友', desc: '+ 100 成长值 / 人', progress: 2, target: 5, reward: 500, completed: false, type: '永久' },
];

const BENEFITS = [
  { icon: <FlashOnRoundedIcon />, title: '4K 蓝光画质', desc: '影院级视听享受', color: '#FE2C55' },
  { icon: <TheaterComedyRoundedIcon />, title: '新片提前看', desc: '比普通用户早 7-30 天', color: '#FFB400' },
  { icon: <VolumeOffRoundedIcon />, title: '免广告', desc: '全程无打扰', color: '#5DDB96' },
  { icon: <PaletteRoundedIcon />, title: '专属弹幕', desc: '多彩气泡 + 优先显示', color: '#8B5CF6' },
  { icon: <HeadsetMicRoundedIcon />, title: '专属客服', desc: '7×24 小时 1 对 1', color: '#5B8DEF' },
  { icon: <CardGiftcardRoundedIcon />, title: '钻石月赠送', desc: '每月最高 800 钻', color: '#FF6B8A' },
  { icon: <DownloadRoundedIcon />, title: '离线下载', desc: '无限次下载', color: '#06B6D4' },
  { icon: <LiveTvRoundedIcon />, title: '直播专属', desc: 'VIP 直播标识 + 礼物折扣', color: '#FFD566' },
];

const RENEWAL_HISTORY = [
  { id: 'VIP20260604001', tier: '黄金会员', period: '年付', amount: 19800, startedAt: '2026-06-04', expiresAt: '2027-06-04', status: 'active' },
  { id: 'VIP20250530001', tier: '白银会员', period: '月付', amount: 1280, startedAt: '2025-05-30', expiresAt: '2025-06-30', status: 'expired' },
  { id: 'VIP20240515002', tier: '黄金会员', period: '年付', amount: 19800, startedAt: '2024-05-15', expiresAt: '2025-05-15', status: 'expired' },
];

const ICON_FOR_TASK: Record<string, React.ReactNode> = {
  dailySign: <LoginRoundedIcon sx={{ fontSize: 18 }} />,
  share: <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />,
  comment: <CommentRoundedIcon sx={{ fontSize: 18 }} />,
  recharge: <CardGiftcardRoundedIcon sx={{ fontSize: 18 }} />,
  invite: <FavoriteRoundedIcon sx={{ fontSize: 18 }} />,
};

export default function VipPage() {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [snack, setSnack] = useState<string | null>(null);

  const currentTier = TIERS[1];
  const currentExp = 2480;
  const nextTier = TIERS[2];
  const nextTarget = 5000;
  const expPercent = (currentExp / nextTarget) * 100;
  const daysLeft = 358;

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>会员中心</Typography>
          <Button size="small" component={Link} href="/account/orders" sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
            续费记录
          </Button>
        </Box>

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
                onClick={() => setSnack(`已选择 ${t.name} · 跳转支付`)}
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
          {TASKS.map((t) => {
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
                    <Box sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary', fontSize: 9 }}>{t.type}</Box>
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
                  onClick={() => setSnack(t.completed ? '任务已完成' : `已领取 +${t.reward} 成长值`)}
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
      </Container>
    </Box>
  );
}
