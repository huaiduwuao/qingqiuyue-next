'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
import { useApp } from '@/contexts/AppContext';
import {
  getPointMallItems,
  getPointMallHistory,
  redeemPointMallItem,
  type PointMallItem as ApiMallItem,
  type PointMallRecord as ApiRecord,
} from '@/apis/dashboard';

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

const FLASH_SALE_IDS: number[] = [401, 102, 105]; // 后端可在 /user/point/mall/items 上用 tag='限时' 或 isFlash 字段控制,此处保留兜底

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

const USER_ID = 0; // 0 = 走 context 里的 currentUser,这里只是兼容旧 fallback;正式路径用 useApp().currentUser?.id

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
  const { currentUser } = useApp();
  const [tab, setTab] = useState<'items' | 'orders'>('items');
  const [cat, setCat] = useState<Category>('all');
  const [confirmItem, setConfirmItem] = useState<MallItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();
  const countdown = useCountdown(FLASH_END);

  // 当前用户积分(优先 context,fallback 0 → 由 initialPoints 兜底)
  const userId = currentUser?.id ?? USER_ID;
  const pointQuery = useQuery({
    queryKey: ['user-point', userId],
    queryFn: () => getUserPoint(userId).then((r: any) => r.data || { userId, points: initialPoints }),
    placeholderData: { userId, points: initialPoints },
  });
  const currentPoints = pointQuery.data?.points ?? initialPoints;

  // 积分商城商品 — 真接口
  const itemsQuery = useQuery({
    queryKey: ['point-mall-items'],
    queryFn: () => getPointMallItems().then((r) => r.list || []),
    placeholderData: [],
  });
  const MALL_ITEMS: MallItem[] = (itemsQuery.data ?? []).map((it: ApiMallItem) => ({
    id: it.id,
    name: it.name,
    desc: it.desc,
    category: it.category,
    emoji: it.emoji,
    gradient: it.gradient,
    points: it.points,
    originalPoints: it.originalPoints,
    stock: it.stock,
    totalRedeemed: it.totalRedeemed,
    tag: it.tag,
  }));

  // 我的兑换历史 — 真接口
  const historyQuery = useQuery({
    queryKey: ['point-mall-history', userId],
    queryFn: () => getPointMallHistory().then((r) => ({ list: r.list || [], lifetime: r.lifetime || 0 })),
    placeholderData: { list: [], lifetime: 0 },
  });
  const records: RedemptionRecord[] = (historyQuery.data?.list ?? []).map((r: ApiRecord) => ({
    id: r.id,
    itemId: r.itemId,
    itemName: r.itemName,
    emoji: r.emoji,
    gradient: r.gradient,
    points: r.points,
    status: r.status,
    redeemedAt: r.redeemedAt,
    serial: r.serial,
  }));
  const lifetimePoints = historyQuery.data?.lifetime ?? 0;

  const filtered = useMemo(
    () => (cat === 'all' ? MALL_ITEMS : MALL_ITEMS.filter((i) => i.category === cat)),
    [cat, MALL_ITEMS]
  );

  // 限时秒杀:tag 含 '限时' 的;若后端没标记,fallback 到 FLASH_SALE_IDS 兜底
  const flashItems = useMemo(() => {
    const tagged = MALL_ITEMS.filter((i) => i.tag === '限时');
    return tagged.length > 0 ? tagged : MALL_ITEMS.filter((i) => FLASH_SALE_IDS.includes(i.id));
  }, [MALL_ITEMS]);

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

  const redeemMutation = useMutation({
    mutationFn: (itemId: number) => redeemPointMallItem(itemId),
    onSuccess: (resp) => {
      // 服务端返回新记录 + 最新余额,直接用真实数据
      const data = (resp as any)?.data ?? resp;
      if (data?.record) {
        qc.invalidateQueries({ queryKey: ['point-mall-history', userId] });
      }
      if (typeof data?.balance === 'number') {
        qc.setQueryData(['user-point', userId], (old: any) => ({
          ...(old || { userId }),
          points: data.balance,
        }));
      } else {
        // 兜底:服务端没返回余额,本地减一下
        qc.setQueryData(['user-point', userId], (old: any) => ({
          ...(old || { userId }),
          points: Math.max(0, (old?.points ?? currentPoints) - (confirmItem?.points ?? 0)),
        }));
      }
      setConfirmItem(null);
      setToast(`兑换成功 · 消耗 ${confirmItem?.points.toLocaleString() ?? 0} 积分`);
    },
    onError: (err: any) => {
      setToast(err?.message || '兑换失败,请重试');
    },
  });

  const confirmRedeem = () => {
    if (!confirmItem) return;
    redeemMutation.mutate(confirmItem.id);
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
              可兑换 {MALL_ITEMS.filter((i) => i.points <= currentPoints).length} 件商品 · 历史累计 {lifetimePoints.toLocaleString()}
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
