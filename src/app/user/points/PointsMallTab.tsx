'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Dialog from '@mui/material/Dialog';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import StarsIcon from '@mui/icons-material/Stars';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import InventoryRoundedIcon from '@mui/icons-material/InventoryRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import { getUserPoint } from '@/apis/system-user-point';

type Category = 'all' | 'virtual' | 'privilege' | 'physical' | 'limited';

interface MallItem {
  id: number;
  name: string;
  desc: string;
  category: Exclude<Category, 'all'>;
  emoji: string;
  gradient: string;
  points: number;
  originalPoints?: number;
  stock: number;
  totalRedeemed: number;
  tag?: 'HOT' | 'NEW' | '限时' | '独家';
}

interface RedemptionRecord {
  id: number;
  itemId: number;
  itemName: string;
  emoji: string;
  gradient: string;
  points: number;
  status: 'pending' | 'shipped' | 'completed';
  redeemedAt: string;
  serial?: string;
}

const MALL_ITEMS: MallItem[] = [
  { id: 101, name: '1 个月会员', desc: '全场 4K 蓝光 + 每月 300 钻赠送', category: 'virtual', emoji: '👑', gradient: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)', points: 5000, originalPoints: 6800, stock: -1, totalRedeemed: 8420, tag: 'HOT' },
  { id: 102, name: '周卡免广告', desc: '7 天全程无打扰观看', category: 'virtual', emoji: '🚫', gradient: 'linear-gradient(135deg, #5DDB96 0%, #25F4EE 100%)', points: 200, originalPoints: 380, stock: -1, totalRedeemed: 24180, tag: '限时' },
  { id: 103, name: '彩色昵称 30 天', desc: '专属彩色昵称,人群中一眼找到你', category: 'virtual', emoji: '🌈', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', points: 300, stock: -1, totalRedeemed: 18420 },
  { id: 104, name: '专属弹幕 30 天', desc: '多彩气泡 + 优先显示 + 防刷屏', category: 'virtual', emoji: '💬', gradient: 'linear-gradient(135deg, #5B8DEF 0%, #8B5CF6 100%)', points: 800, stock: -1, totalRedeemed: 6200 },
  { id: 105, name: '表情包月卡', desc: '畅用 2000+ 付费表情包', category: 'virtual', emoji: '😎', gradient: 'linear-gradient(135deg, #FFB400 0%, #FF6B8A 100%)', points: 400, originalPoints: 600, stock: -1, totalRedeemed: 12900, tag: '限时' },
  { id: 106, name: '1GB 流量包', desc: '移动/联通/电信均可,72 小时内到账', category: 'virtual', emoji: '📶', gradient: 'linear-gradient(135deg, #06B6D4 0%, #5B8DEF 100%)', points: 600, stock: 4820, totalRedeemed: 24180 },
  { id: 201, name: '优先审核 1 次', desc: '创作者投稿 30 分钟内优先审核', category: 'privilege', emoji: '⚡', gradient: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)', points: 1500, stock: -1, totalRedeemed: 890 },
  { id: 202, name: '专属客服 1 次', desc: '7×24 人工通道,5 分钟内接入', category: 'privilege', emoji: '🎧', gradient: 'linear-gradient(135deg, #5DDB96 0%, #5B8DEF 100%)', points: 800, stock: -1, totalRedeemed: 2240 },
  { id: 203, name: '创作者认证月标', desc: '30 天创作者认证角标 + 推荐加权', category: 'privilege', emoji: '🏅', gradient: 'linear-gradient(135deg, #FFB400 0%, #FF6B8A 100%)', points: 3000, stock: 120, totalRedeemed: 480, tag: 'HOT' },
  { id: 204, name: '直播间专属入场', desc: '主播开播 30 秒前优先提醒', category: 'privilege', emoji: '🔔', gradient: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)', points: 500, stock: -1, totalRedeemed: 3680 },
  { id: 301, name: '平台纪念马克杯', desc: '清秋月十周年限定陶瓷杯', category: 'physical', emoji: '☕', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #FE2C55 100%)', points: 12000, stock: 480, totalRedeemed: 1280, tag: 'NEW' },
  { id: 302, name: '清秋月限定抱枕', desc: '40cm 绒毛抱枕,含 logo 刺绣', category: 'physical', emoji: '🛋️', gradient: 'linear-gradient(135deg, #FFB400 0%, #FF6B8A 100%)', points: 18000, stock: 320, totalRedeemed: 920 },
  { id: 303, name: '真无线蓝牙耳机', desc: '主动降噪,30h 续航,一年保修', category: 'physical', emoji: '🎧', gradient: 'linear-gradient(135deg, #25F4EE 0%, #5B8DEF 100%)', points: 45000, stock: 50, totalRedeemed: 142, tag: '独家' },
  { id: 304, name: '10000mAh 充电宝', desc: 'PD 22.5W 快充,轻薄便携', category: 'physical', emoji: '🔋', gradient: 'linear-gradient(135deg, #5DDB96 0%, #06B6D4 100%)', points: 22000, stock: 180, totalRedeemed: 460 },
  { id: 401, name: '限定头像框', desc: '清秋月典藏版头像框,限时 30 天', category: 'limited', emoji: '🖼️', gradient: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 50%, #25F4EE 100%)', points: 600, originalPoints: 1200, stock: 5000, totalRedeemed: 8420, tag: '限时' },
  { id: 402, name: '平台纪念数字徽章', desc: '链上存证,永久珍藏,可在主页展示', category: 'limited', emoji: '🎖️', gradient: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)', points: 2500, stock: 1000, totalRedeemed: 1820, tag: 'HOT' },
  { id: 403, name: '月度限定背景图', desc: '本月主推创作者手绘背景,4K 高清', category: 'limited', emoji: '🎨', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', points: 1000, stock: 2000, totalRedeemed: 3120, tag: 'NEW' },
  { id: 404, name: '创作者认证铭牌', desc: '实物金属铭牌,刻用户名 + 编号', category: 'limited', emoji: '🏆', gradient: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)', points: 8800, stock: 200, totalRedeemed: 380 },
];

const REDEMPTION_RECORDS: RedemptionRecord[] = [
  { id: 1, itemId: 103, itemName: '彩色昵称 30 天', emoji: '🌈', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', points: 300, status: 'completed', redeemedAt: '2026-05-28 14:23', serial: 'NICK-202605-7XQ9' },
  { id: 2, itemId: 105, itemName: '表情包月卡', emoji: '😎', gradient: 'linear-gradient(135deg, #FFB400 0%, #FF6B8A 100%)', points: 400, status: 'completed', redeemedAt: '2026-05-21 09:15', serial: 'EMOJI-202605-A4F2' },
  { id: 3, itemId: 402, itemName: '平台纪念数字徽章', emoji: '🎖️', gradient: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)', points: 2500, status: 'shipped', redeemedAt: '2026-06-03 16:42', serial: 'BADGE-202606-K9M1' },
  { id: 4, itemId: 301, itemName: '平台纪念马克杯', emoji: '☕', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #FE2C55 100%)', points: 12000, status: 'pending', redeemedAt: '2026-06-05 11:08' },
  { id: 5, itemId: 106, itemName: '1GB 流量包', emoji: '📶', gradient: 'linear-gradient(135deg, #06B6D4 0%, #5B8DEF 100%)', points: 600, status: 'completed', redeemedAt: '2026-05-15 20:31', serial: 'FLOW-202515-0P3X' },
];

const FLASH_SALE_IDS = [401, 102, 105];

const CATEGORY_META: Record<Category, { label: string }> = {
  all: { label: '全部' },
  virtual: { label: '虚拟权益' },
  privilege: { label: '平台特权' },
  physical: { label: '实物礼品' },
  limited: { label: '限定收藏' },
};

const STATUS_META: Record<RedemptionRecord['status'], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '待处理', color: '#FFB400', icon: <AccessTimeRoundedIcon sx={{ fontSize: 12 }} /> },
  shipped: { label: '已发货', color: '#5B8DEF', icon: <LocalShippingRoundedIcon sx={{ fontSize: 12 }} /> },
  completed: { label: '已完成', color: '#5DDB96', icon: <CheckCircleRoundedIcon sx={{ fontSize: 12 }} /> },
};

const USER_ID = 1001;

function formatStock(stock: number): { text: string; tone: 'unlimited' | 'plenty' | 'low' | 'gone' } {
  if (stock < 0) return { text: '充足', tone: 'unlimited' };
  if (stock === 0) return { text: '已兑完', tone: 'gone' };
  if (stock < 100) return { text: `仅剩 ${stock}`, tone: 'low' };
  if (stock < 1000) return { text: `剩 ${stock}`, tone: 'plenty' };
  return { text: '充足', tone: 'plenty' };
}

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s, expired: diff === 0 };
}

const FLASH_END = (() => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
})();

interface Props {
  initialPoints: number;
}

export function PointsMallTab({ initialPoints }: Props) {
  const [tab, setTab] = useState<'items' | 'orders'>('items');
  const [cat, setCat] = useState<Category>('all');
  const [confirmItem, setConfirmItem] = useState<MallItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();
  const countdown = useCountdown(FLASH_END);

  const pointQuery = useQuery({
    queryKey: ['user-point', USER_ID],
    queryFn: () => getUserPoint(USER_ID).then((r: any) => r.data || { userId: USER_ID, points: initialPoints }),
    placeholderData: { userId: USER_ID, points: initialPoints },
  });
  const currentPoints = pointQuery.data?.points ?? initialPoints;

  const [records, setRecords] = useState<RedemptionRecord[]>(REDEMPTION_RECORDS);

  const filtered = useMemo(
    () => (cat === 'all' ? MALL_ITEMS : MALL_ITEMS.filter((i) => i.category === cat)),
    [cat]
  );

  const flashItems = MALL_ITEMS.filter((i) => FLASH_SALE_IDS.includes(i.id));

  const handleRedeem = (item: MallItem) => {
    if (item.stock === 0) {
      setToast('该商品已兑完');
      return;
    }
    if (currentPoints < item.points) {
      setToast('积分不足,先去赚点积分吧');
      return;
    }
    setConfirmItem(item);
  };

  const confirmRedeem = () => {
    if (!confirmItem) return;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const newRecord: RedemptionRecord = {
      id: Date.now(),
      itemId: confirmItem.id,
      itemName: confirmItem.name,
      emoji: confirmItem.emoji,
      gradient: confirmItem.gradient,
      points: confirmItem.points,
      status: confirmItem.category === 'physical' ? 'pending' : 'completed',
      redeemedAt: ts,
      serial: ['virtual', 'limited'].includes(confirmItem.category)
        ? `SERIAL-${now.getFullYear()}${pad(now.getMonth() + 1)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        : undefined,
    };
    setRecords((r) => [newRecord, ...r]);

    qc.setQueryData(['user-point', USER_ID], (old: any) => ({
      ...(old || { userId: USER_ID }),
      points: Math.max(0, (old?.points ?? currentPoints) - confirmItem.points),
    }));

    setConfirmItem(null);
    setToast(`兑换成功 · 消耗 ${confirmItem.points.toLocaleString()} 积分`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 余额卡 */}
      <Box
        sx={{
          position: 'relative',
          p: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
          color: 'text.primary',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(254, 44, 85, 0.18)',
        }}
      >
        <Box
          aria-hidden
          sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 0%, rgba(255,255,255,0.25), transparent 50%)' }}
        />
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, opacity: 0.9 }}>
                Points Mall
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: { xs: 36, md: 44 }, fontWeight: 800, lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>
                {currentPoints.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600, opacity: 0.85 }}>可用积分</Typography>
            </Box>
            <Typography sx={{ fontSize: 12, opacity: 0.85 }}>
              可兑换 {MALL_ITEMS.filter((i) => i.points <= currentPoints).length} 件商品 · 历史累计 28,420
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 限时秒杀 */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'rgba(255, 180, 0, 0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(255, 180, 0, 0.08) 0%, transparent 50%)',
            pointerEvents: 'none',
          }}
        />
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LocalFireDepartmentRoundedIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'warning.main' }}>
              限时秒杀
            </Typography>
            <Chip
              label="今日 24:00 截止"
              size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255, 180, 0, 0.2)', color: 'warning.main' }}
            />
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeRoundedIcon sx={{ fontSize: 14, color: 'warning.main' }} />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[countdown.h, countdown.m, countdown.s].map((n, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Box sx={{ minWidth: 26, px: 0.75, py: 0.25, borderRadius: 0.75, bgcolor: '#1a1a1f', color: 'warning.main', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', textAlign: 'center' }}>
                      {n.toString().padStart(2, '0')}
                    </Box>
                    {i < 2 && <Typography sx={{ fontSize: 12, color: 'warning.main', fontWeight: 700 }}>:</Typography>}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1.5,
            }}
          >
            {flashItems.map((it) => {
              const stock = formatStock(it.stock);
              const canAfford = currentPoints >= it.points;
              return (
                <Box
                  key={it.id}
                  sx={{
                    position: 'relative',
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 180, 0, 0.06)',
                    border: '1px solid rgba(255, 180, 0, 0.18)',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'warning.main', transform: 'translateY(-2px)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 1.5,
                        background: it.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 32,
                        flexShrink: 0,
                      }}
                    >
                      {it.emoji}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary', mb: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.75 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25, color: 'warning.main' }}>
                          <StarsIcon sx={{ fontSize: 12 }} />
                          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{it.points.toLocaleString()}</Typography>
                        </Box>
                        {it.originalPoints && (
                          <Typography sx={{ fontSize: 11, color: 'text.disabled', textDecoration: 'line-through' }}>
                            {it.originalPoints.toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        disabled={stock.tone === 'gone' || !canAfford}
                        onClick={() => handleRedeem(it)}
                        sx={{
                          bgcolor: 'warning.main',
                          color: '#1a1a1a',
                          fontWeight: 700,
                          fontSize: 11,
                          py: 0.5,
                          minHeight: 28,
                          textTransform: 'none',
                          boxShadow: 'none',
                          '&:hover': { bgcolor: '#FFC233', boxShadow: 'none' },
                          '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.disabled' },
                        }}
                      >
                        {stock.tone === 'gone' ? '已兑完' : !canAfford ? '积分不足' : '立即抢购'}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Tab + 分类切换 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, py: 0.5, textTransform: 'none', fontSize: 13, fontWeight: 600, color: 'text.secondary' },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
          }}
        >
          <Tab value="items" label="全部商品" />
          <Tab
            value="orders"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                我的兑换
                {records.length > 0 && (
                  <Chip
                    label={records.length}
                    size="small"
                    sx={{ height: 18, minWidth: 18, fontSize: 10, bgcolor: 'rgba(254, 44, 85, 0.15)', color: 'primary.main', fontWeight: 700 }}
                  />
                )}
              </Box>
            }
          />
        </Tabs>

        {tab === 'items' && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
              <Chip
                key={c}
                label={CATEGORY_META[c].label}
                onClick={() => setCat(c)}
                variant={cat === c ? 'filled' : 'outlined'}
                sx={{
                  borderRadius: 1.5,
                  fontSize: 12,
                  fontWeight: cat === c ? 700 : 400,
                  bgcolor: cat === c ? 'primary.main' : 'transparent',
                  color: cat === c ? 'text.primary' : 'text.secondary',
                  borderColor: 'divider',
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* 商品网格 */}
      {tab === 'items' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {filtered.map((it) => {
            const stock = formatStock(it.stock);
            const canAfford = currentPoints >= it.points;
            const isGone = stock.tone === 'gone';
            const isLow = stock.tone === 'low';
            return (
              <Box
                key={it.id}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: isLow ? 'warning.main' : 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                  transition: 'all 0.15s',
                  opacity: isGone ? 0.6 : 1,
                  '&:hover': { borderColor: isLow ? 'warning.main' : 'primary.main', transform: isGone ? 'none' : 'translateY(-2px)' },
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 1.5,
                    background: it.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 56,
                  }}
                >
                  {it.emoji}
                  {it.tag && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                        bgcolor: it.tag === 'HOT' ? 'primary.main' : it.tag === 'NEW' ? 'success.main' : it.tag === '独家' ? 'warning.main' : '#FE2C55',
                        color: it.tag === '独家' ? '#1a1a1a' : 'text.primary',
                      }}
                    >
                      {it.tag}
                    </Box>
                  )}
                  {isLow && !isGone && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontSize: 9,
                        fontWeight: 800,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'warning.main',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      🔥 即将售罄
                    </Box>
                  )}
                  {isGone && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.5)',
                        borderRadius: 1.5,
                        backdropFilter: 'blur(2px)',
                      }}
                    >
                      <Typography sx={{ fontSize: 18, fontWeight: 800, color: 'text.primary' }}>已兑完</Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {it.name}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 30 }}>
                    {it.desc}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, color: 'warning.main' }}>
                    <StarsIcon sx={{ fontSize: 12 }} />
                    <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{it.points.toLocaleString()}</Typography>
                    {it.originalPoints && (
                      <Typography sx={{ fontSize: 10, color: 'text.disabled', textDecoration: 'line-through' }}>
                        {it.originalPoints.toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 10, color: isLow ? 'warning.main' : 'text.disabled', fontWeight: isLow ? 700 : 400 }}>
                    {stock.text}
                  </Typography>
                </Box>
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  disabled={isGone || !canAfford}
                  onClick={() => handleRedeem(it)}
                  startIcon={<RedeemRoundedIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    bgcolor: isGone || !canAfford ? 'rgba(255,255,255,0.08)' : 'primary.main',
                    color: isGone || !canAfford ? 'text.disabled' : 'text.primary',
                    fontSize: 12,
                    fontWeight: 700,
                    py: 0.75,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: isGone || !canAfford ? 'rgba(255,255,255,0.08)' : '#E0264B', boxShadow: 'none' },
                  }}
                >
                  {isGone ? '已兑完' : !canAfford ? '积分不足' : '立即兑换'}
                </Button>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 我的兑换 */}
      {tab === 'orders' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {records.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <InventoryRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>还没有兑换记录</Typography>
            </Box>
          ) : (
            records.map((r) => {
              const s = STATUS_META[r.status];
              return (
                <Box
                  key={r.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 1.5,
                      background: r.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      flexShrink: 0,
                    }}
                  >
                    {r.emoji}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', flex: 1 }} noWrap>
                        {r.itemName}
                      </Typography>
                      <Chip
                        icon={s.icon as any}
                        label={s.label}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: `${s.color}1A`,
                          color: s.color,
                          '& .MuiChip-icon': { color: s.color, fontSize: 12, ml: 0.5 },
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 11, color: 'text.secondary', flexWrap: 'wrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'warning.main' }}>
                        <StarsIcon sx={{ fontSize: 11 }} />
                        <Typography sx={{ fontSize: 11, color: 'warning.main', fontWeight: 700 }}>{r.points.toLocaleString()}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>·</Typography>
                      <Typography sx={{ fontSize: 11 }}>{r.redeemedAt}</Typography>
                      {r.serial && (
                        <>
                          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>·</Typography>
                          <Box
                            onClick={() => {
                              navigator.clipboard?.writeText(r.serial!);
                              setToast('序列号已复制');
                            }}
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                          >
                            <Typography sx={{ fontSize: 11, fontFamily: 'monospace' }}>{r.serial}</Typography>
                            <ContentCopyRoundedIcon sx={{ fontSize: 10 }} />
                          </Box>
                        </>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      )}

      {/* 底部说明 */}
      {tab === 'items' && (
        <Box sx={{ pt: 1, pb: 2, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
            共 {filtered.length} 件商品 · 实物礼品兑换后 3-5 个工作日内发货
          </Typography>
          <Box
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, mt: 1, fontSize: 11, color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
          >
            查看兑换规则
            <ArrowForwardIosRoundedIcon sx={{ fontSize: 9 }} />
          </Box>
        </Box>
      )}

      {/* 兑换确认弹窗 */}
      <Dialog
        open={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              background: 'linear-gradient(180deg, #15171F 0%, #0A0B14 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
            },
          },
        }}
      >
        {confirmItem && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>确认兑换</Typography>
              <IconButton size="small" onClick={() => setConfirmItem(null)} aria-label="关闭">
                <CloseRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            <Box sx={{ p: 3 }}>
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '1.4',
                  borderRadius: 2,
                  background: confirmItem.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 72,
                  mb: 2,
                }}
              >
                {confirmItem.emoji}
              </Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                {confirmItem.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
                {confirmItem.desc}
              </Typography>
              <Divider sx={{ borderColor: 'divider', my: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>所需积分</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                    <StarsIcon sx={{ fontSize: 13 }} />
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{confirmItem.points.toLocaleString()}</Typography>
                    {confirmItem.originalPoints && (
                      <Typography sx={{ fontSize: 11, color: 'text.disabled', textDecoration: 'line-through' }}>
                        {confirmItem.originalPoints.toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>当前余额</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <StarsIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>{currentPoints.toLocaleString()}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>兑换后余额</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'success.main' }}>
                    {(currentPoints - confirmItem.points).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setConfirmItem(null)}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  取消
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={confirmRedeem}
                  startIcon={<CheckRoundedIcon />}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                    '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
                  }}
                >
                  确认兑换
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={2200}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
