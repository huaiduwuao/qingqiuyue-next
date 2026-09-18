'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import TextField from '@mui/material/TextField';
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
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import MenuItem from '@mui/material/MenuItem';
import { getUserPoint } from '@/apis/system-user-point';
import { getWalletSummary } from '@/apis/reward-center';
import { getAddresses, addressText } from '@/apis/growth';
import { useApp } from '@/contexts/AppContext';
import { ListLayout, ListLayoutSwitch, LIST_ROW } from '@/components/common/ListLayout';
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
  tag?: string;
  deliverType?: ApiMallItem['deliverType'];
  currency: 'point' | 'diamond';
  priceCents: number;
  cosmeticValue?: string;
  durationDays?: number;
}

// 1 钻 = 10 分(与钱包页一致)
const toDiamonds = (cents: number) => Math.floor(cents / 10);
/** 商品标价:积分商品是积分数,钻石商品是钻石数 */
const costOf = (it: { currency: 'point' | 'diamond'; points: number; priceCents: number }) =>
  it.currency === 'diamond' ? toDiamonds(it.priceCents) : it.points;
const unitOf = (it: { currency: 'point' | 'diamond' }) => (it.currency === 'diamond' ? '钻石' : '积分');
const isCosmetic = (it: { deliverType?: string }) => !!it.deliverType && it.deliverType !== 'physical';

interface RedemptionRecord {
  id: number;
  itemId: number;
  itemName: string;
  emoji: string;
  gradient: string;
  points: number;
  currency: 'point' | 'diamond';
  priceCents: number;
  status: 'pending' | 'shipped' | 'completed';
  redeemedAt: string;
  serial?: string;
  tracking?: string;
}


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


function formatStock(stock: number): { text: string; tone: 'unlimited' | 'plenty' | 'low' | 'gone' } {
  if (stock < 0) return { text: '充足', tone: 'unlimited' };
  if (stock === 0) return { text: '已兑完', tone: 'gone' };
  if (stock < 100) return { text: `仅剩 ${stock}`, tone: 'low' };
  if (stock < 1000) return { text: `剩 ${stock}`, tone: 'plenty' };
  return { text: '充足', tone: 'plenty' };
}

interface Props {
  initialPoints: number;
}

export function PointsMallTab({ initialPoints }: Props) {
  const { currentUser } = useApp();
  const [tab, setTab] = useState<'items' | 'orders'>('items');
  const [cat, setCat] = useState<Category>('all');
  const [confirmItem, setConfirmItem] = useState<MallItem | null>(null);
  const [address, setAddress] = useState('');
  const [addressId, setAddressId] = useState<number | 'new'>('new');
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();

  // 当前用户积分(优先 context,fallback 0 → 由 initialPoints 兜底)
  const userId = currentUser?.id ?? 0;
  // 积分余额(后端按登录用户返回 user_point,没有积分账户时为 null)
  const pointQuery = useQuery({
    queryKey: ['user-point', userId],
    queryFn: () => getUserPoint().then((r: any) => r?.data ?? null),
    enabled: !!userId,
  });
  const currentPoints: number = pointQuery.data?.point ?? initialPoints;
  // 钻石余额(钻石标价的实物商品用)
  const walletQuery = useQuery({
    queryKey: ['wallet-summary', userId],
    queryFn: () => getWalletSummary(),
    enabled: !!userId,
  });
  const currentDiamonds = toDiamonds(walletQuery.data?.balance ?? 0);
  const balanceFor = (it: { currency: 'point' | 'diamond' }) => (it.currency === 'diamond' ? currentDiamonds : currentPoints);
  const canAffordItem = (it: MallItem) => balanceFor(it) >= costOf(it);
  // 地址簿
  const addressQuery = useQuery({
    queryKey: ['user-address', userId],
    queryFn: () => getAddresses(),
    enabled: !!userId,
  });
  const addresses = addressQuery.data ?? [];

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
    originalPoints: it.originalPoints || undefined, // 0 表示没有原价,避免渲染出一个 "0"
    stock: it.stock,
    totalRedeemed: it.totalRedeemed,
    tag: it.tag,
    deliverType: it.deliverType,
    currency: it.currency === 'diamond' ? 'diamond' : 'point',
    priceCents: it.priceCents ?? 0,
    cosmeticValue: it.cosmeticValue,
    durationDays: it.durationDays,
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
    currency: r.currency === 'diamond' ? 'diamond' : 'point',
    priceCents: r.amountCents ?? 0,
    status: r.status,
    redeemedAt: r.redeemedAt,
    serial: r.serial,
    tracking: r.tracking,
  }));
  const lifetimePoints = historyQuery.data?.lifetime ?? 0;

  const filtered = useMemo(
    () => (cat === 'all' ? MALL_ITEMS : MALL_ITEMS.filter((i) => i.category === cat)),
    [cat, MALL_ITEMS]
  );

  // 限时商品:运营在后台打了「限时」标签的商品
  const flashItems = useMemo(() => MALL_ITEMS.filter((i) => i.tag === '限时'), [MALL_ITEMS]);

  const handleRedeem = (item: MallItem) => {
    if (item.stock === 0) {
      setToast('该商品已兑完');
      return;
    }
    if (!canAffordItem(item)) {
      setToast(item.currency === 'diamond' ? '钻石不足,请先充值' : '积分不足,先去赚点积分吧');
      return;
    }
    const def = addresses.find((a) => a.isDefault) ?? addresses[0];
    setAddressId(def?.id ?? 'new');
    setConfirmItem(item);
  };

  const redeemMutation = useMutation({
    mutationFn: (vars: { itemId: number; address?: string; addressId?: number }) =>
      redeemPointMallItem(vars.itemId, vars.address, vars.addressId),
    onSuccess: () => {
      // 余额、库存、兑换记录都以服务端为准,全部重新拉取
      qc.invalidateQueries({ queryKey: ['user-point', userId] });
      qc.invalidateQueries({ queryKey: ['point-mall-history', userId] });
      qc.invalidateQueries({ queryKey: ['point-mall-items'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary', userId] });
      qc.invalidateQueries({ queryKey: ['my-cosmetics'] });
      setAddress('');
      setConfirmItem(null);
      setToast(
        confirmItem
          ? `${isCosmetic(confirmItem) ? '兑换成功,已自动佩戴' : '下单成功,等待发货'} · 消耗 ${costOf(confirmItem).toLocaleString()} ${unitOf(confirmItem)}`
          : '兑换成功',
      );
    },
    onError: (err: any) => {
      setToast(err?.message || '兑换失败,请重试');
    },
  });

  const confirmRedeem = () => {
    if (!confirmItem) return;
    const physical = confirmItem.deliverType === 'physical';
    if (physical && addressId === 'new' && !address.trim()) {
      setToast('请选择收货地址,或填写收货人、手机号和详细地址');
      return;
    }
    redeemMutation.mutate({
      itemId: confirmItem.id,
      address: physical && addressId === 'new' ? address.trim() : undefined,
      addressId: physical && addressId !== 'new' ? addressId : undefined,
    });
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
              可兑换 {MALL_ITEMS.filter(canAffordItem).length} 件商品 · 钻石 {currentDiamonds.toLocaleString()} · 历史累计 {lifetimePoints.toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 限时兑换:运营给商品打「限时」标签,没有就不展示 */}
      {flashItems.length > 0 && (
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
              限时兑换
            </Typography>
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
              const canAfford = canAffordItem(it);
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
                          {it.currency === 'diamond' ? <DiamondRoundedIcon sx={{ fontSize: 12 }} /> : <StarsIcon sx={{ fontSize: 12 }} />}
                          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{costOf(it).toLocaleString()}</Typography>
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
                          '&.Mui-disabled': { bgcolor: 'action.hover', color: 'text.disabled' },
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
      )}

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
            <ListLayoutSwitch sx={{ ml: 'auto', alignSelf: 'center' }} />
          </Box>
        )}
      </Box>

      {/* 商品网格 */}
      {tab === 'items' && (
        <ListLayout minColumnWidth={200} minColumns={2} gap={16}>
          {filtered.map((it) => {
            const stock = formatStock(it.stock);
            const canAfford = canAffordItem(it);
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
                  // 列表样式:左图,右侧文字/价格/按钮三行
                  [LIST_ROW]: { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center', columnGap: 1.5 },
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
                    [LIST_ROW]: { width: { xs: 72, sm: 96 }, flexShrink: 0, gridRow: 'span 3', alignSelf: 'start', fontSize: 36 },
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
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, [LIST_ROW]: { minWidth: 0, justifyContent: 'center' } }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {it.name}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 30 }}>
                    {it.desc}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, color: 'warning.main' }}>
                    {it.currency === 'diamond' ? <DiamondRoundedIcon sx={{ fontSize: 12 }} /> : <StarsIcon sx={{ fontSize: 12 }} />}
                    <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{costOf(it).toLocaleString()}</Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{unitOf(it)}</Typography>
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
        </ListLayout>
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
                        {r.currency === 'diamond' ? <DiamondRoundedIcon sx={{ fontSize: 11 }} /> : <StarsIcon sx={{ fontSize: 11 }} />}
                        <Typography sx={{ fontSize: 11, color: 'warning.main', fontWeight: 700 }}>{costOf(r).toLocaleString()} {unitOf(r)}</Typography>
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
              background: 'background.paper',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
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
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>所需{unitOf(confirmItem)}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                    {confirmItem.currency === 'diamond' ? <DiamondRoundedIcon sx={{ fontSize: 13 }} /> : <StarsIcon sx={{ fontSize: 13 }} />}
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{costOf(confirmItem).toLocaleString()}</Typography>
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
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>{balanceFor(confirmItem).toLocaleString()}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>兑换后余额</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'success.main' }}>
                    {(balanceFor(confirmItem) - costOf(confirmItem)).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              {isCosmetic(confirmItem) && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 2 }}>
                  兑换后立即到账并自动佩戴{confirmItem.durationDays ? `,有效期 ${confirmItem.durationDays} 天` : ',永久有效'}。可在「我的装扮」里更换。
                </Typography>
              )}
              {confirmItem.deliverType === 'physical' && addresses.length > 0 && (
                <TextField
                  select
                  label="收货地址"
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value === 'new' ? 'new' : Number(e.target.value))}
                  fullWidth
                  size="small"
                  sx={{ mt: 2 }}
                >
                  {addresses.map((a) => (
                    <MenuItem key={a.id} value={a.id} sx={{ fontSize: 13, whiteSpace: 'normal' }}>
                      {addressText(a)}
                    </MenuItem>
                  ))}
                  <MenuItem value="new" sx={{ fontSize: 13 }}>使用其他地址…</MenuItem>
                </TextField>
              )}
              {confirmItem.deliverType === 'physical' && addressId === 'new' && (
                <TextField
                  label="收货信息"
                  placeholder="收货人、手机号、详细地址"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  sx={{ mt: 2 }}
                />
              )}
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
