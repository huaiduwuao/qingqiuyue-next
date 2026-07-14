'use client';

export const dynamic = "force-dynamic";

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import DiamondIcon from '@mui/icons-material/Diamond';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { LoginGate } from '@/components/auth/LoginGate';
import { adminClient, formatApiError } from '@/lib/api/client';

// 积分商城商品类型
export interface MallItem {
  id: number;
  name: string;
  description: string;
  price: number;       // 所需积分
  originalPrice: number; // 原价
  type: 'diamond' | 'vip' | 'physical'; // 钻石/会员/实物
  image: string;
  stock: number;       // 库存 -1表示无限
  tag?: string;        // 标签: 新品/热卖/限时
  vipLevel?: string;   // 会员等级
  duration?: string;   // 有效期: 1个月/1年
}

// 模拟商城数据(实际应从后端API获取)
const MALL_ITEMS: MallItem[] = [
  {
    id: 1,
    name: '100 钻石',
    description: '可用于打赏、解锁付费内容、兑换实物',
    price: 1000,
    originalPrice: 1000,
    type: 'diamond',
    image: '/icons/diamond.svg',
    stock: -1,
    tag: '热卖',
  },
  {
    id: 2,
    name: '500 钻石',
    description: '充值更划算，额外赠送 50 钻石',
    price: 4500,
    originalPrice: 5000,
    type: 'diamond',
    image: '/icons/diamond.svg',
    stock: -1,
    tag: '超值',
  },
  {
    id: 3,
    name: '1000 钻石',
    description: '大额充值，额外赠送 200 钻石',
    price: 8000,
    originalPrice: 10000,
    type: 'diamond',
    image: '/icons/diamond.svg',
    stock: -1,
    tag: 'VIP',
  },
  {
    id: 4,
    name: '月卡会员',
    description: '一个月黄金会员特权，免广告、专属弹幕',
    price: 5000,
    originalPrice: 6000,
    type: 'vip',
    image: '/icons/vip.svg',
    stock: -1,
    vipLevel: '黄金',
    duration: '1个月',
  },
  {
    id: 5,
    name: '年卡会员',
    description: '一年黄金会员，特价优惠中',
    price: 50000,
    originalPrice: 72000,
    type: 'vip',
    image: '/icons/vip.svg',
    stock: -1,
    vipLevel: '黄金',
    duration: '1年',
    tag: '限时',
  },
  {
    id: 6,
    name: '定制周边礼包',
    description: '鼠标垫+钥匙扣+贴纸套装',
    price: 20000,
    originalPrice: 25000,
    type: 'physical',
    image: '/icons/gift.svg',
    stock: 50,
    tag: '新品',
  },
  {
    id: 7,
    name: '限量版手办',
    description: '限定数字人手办，全球限量100个',
    price: 100000,
    originalPrice: 150000,
    type: 'physical',
    image: '/icons/figure.svg',
    stock: 23,
    tag: '限量',
  },
  {
    id: 8,
    name: 'T恤+帽子套装',
    description: '品牌联名款，舒适面料',
    price: 15000,
    originalPrice: 18000,
    type: 'physical',
    image: '/icons/clothing.svg',
    stock: 100,
  },
];

const TYPE_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  diamond: { icon: <DiamondIcon />, label: '钻石', color: '#5DDB96' },
  vip: { icon: <WorkspacePremiumRoundedIcon />, label: '会员', color: '#FFB400' },
  physical: { icon: <CardGiftcardRoundedIcon />, label: '实物', color: '#8B5CF6' },
};

export default function PointsMallPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState<string | null>(null);
  const [exchangeItem, setExchangeItem] = useState<MallItem | null>(null);
  const [exchanging, setExchanging] = useState(false);

  // 获取用户积分余额
  const balanceQuery = useQuery({
    queryKey: ['mall-balance'],
    queryFn: async () => {
      const r: any = await adminClient('/wallet');
      // 积分 = balance / 10 (分转积分)
      return r?.data?.data ?? r?.data ?? r;
    },
    staleTime: 10 * 1000,
    refetchOnMount: 'always',
  });
  const userPoints = Math.floor((balanceQuery.data?.balance ?? 0) / 10);

  // 过滤商品
  const typeMap = ['all', 'diamond', 'vip', 'physical'];
  const filteredItems = tab === 0
    ? MALL_ITEMS
    : MALL_ITEMS.filter(item => item.type === typeMap[tab]);

  const handleExchange = async () => {
    if (!exchangeItem || exchanging) return;
    setExchanging(true);
    try {
      // 调用消费接口 POST /api/core/wallet/consume
      // 注意: 这里的积分需要转换为分 (1积分 = 10分)
      await adminClient('/wallet/consume', {
        method: 'POST',
        data: {
          amount: exchangeItem.price * 10, // 积分转分
          refId: `mall_exchange_${exchangeItem.id}_${Date.now()}`,
          remark: `积分商城兑换: ${exchangeItem.name}`,
        },
      });
      setSnack(`恭喜! 已成功兑换 ${exchangeItem.name}`);
      qc.invalidateQueries({ queryKey: ['mall-balance'] });
    } catch (err) {
      setSnack(formatApiError(err) || '兑换失败，请稍后重试');
    } finally {
      setExchanging(false);
      setExchangeItem(null);
    }
  };

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>积分商城</Typography>
        </Box>

        <LoginGate mode="replace" message="登录后访问积分商城">

        {/* 积分余额卡片 */}
        <Box
          sx={{
            position: 'relative',
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            overflow: 'hidden',
            mb: 3,
            boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
          }}
        >
          <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.2), transparent 50%)' }} />
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <RedeemRoundedIcon sx={{ fontSize: 18, color: '#fff' }} />
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
                My Points
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: { xs: 40, md: 48 }, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {userPoints.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>积分</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
              积分可兑换钻石、会员特权及精美实物礼品
            </Typography>
          </Box>
        </Box>

        {/* 分类标签 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              minHeight: 36,
              '& .MuiTab-root': { minHeight: 36, fontSize: 13, textTransform: 'none', py: 0.5, px: 1.5 }
            }}
          >
            <Tab label="全部" />
            <Tab label="钻石" />
            <Tab label="会员" />
            <Tab label="实物" />
          </Tabs>
        </Box>

        {/* 商品列表 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
          {filteredItems.map((item) => {
            const meta = TYPE_META[item.type];
            const discount = item.originalPrice > item.price
              ? Math.round((1 - item.price / item.originalPrice) * 100)
              : 0;
            return (
              <Card
                key={item.id}
                sx={{
                  borderRadius: 2,
                  bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    borderColor: meta.color,
                  },
                }}
              >
                <Box sx={{ position: 'relative', height: 140, bgcolor: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ fontSize: 48, color: meta.color, opacity: 0.3 }}>
                    {meta.icon}
                  </Box>
                  {item.tag && (
                    <Chip
                      label={item.tag}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        bgcolor: meta.color,
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        height: 20,
                      }}
                    />
                  )}
                  {discount > 0 && (
                    <Chip
                      label={`${discount}折`}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: '#FE2C55',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        height: 20,
                      }}
                    />
                  )}
                </Box>
                <CardContent sx={{ p: 2, pb: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 0.5 }}>
                    {item.name}
                  </Typography>
                  {item.duration && (
                    <Typography sx={{ fontSize: 11, color: meta.color, mb: 0.5 }}>
                      {item.duration}
                    </Typography>
                  )}
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: 'text.secondary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.description}
                  </Typography>
                  {item.stock > 0 && item.stock < 100 && (
                    <Typography sx={{ fontSize: 10, color: '#FE2C55', mt: 0.5 }}>
                      仅剩 {item.stock} 件
                    </Typography>
                  )}
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: meta.color }}>
                      {item.price.toLocaleString()}
                    </Typography>
                    {discount > 0 && (
                      <Typography sx={{ fontSize: 10, color: 'text.disabled', textDecoration: 'line-through' }}>
                        {item.originalPrice.toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={item.stock === 0 || userPoints < item.price}
                    onClick={() => setExchangeItem(item)}
                    sx={{
                      textTransform: 'none',
                      fontSize: 12,
                      borderRadius: 1.5,
                      bgcolor: meta.color,
                      '&:hover': { bgcolor: meta.color, filter: 'brightness(1.1)' },
                    }}
                  >
                    {userPoints < item.price ? '积分不足' : item.stock === 0 ? '已售罄' : '立即兑换'}
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Box>

        {filteredItems.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
            <Typography>该分类暂无商品</Typography>
          </Box>
        )}

        {/* 兑换确认对话框 */}
        <Dialog open={!!exchangeItem} onClose={() => !exchanging && setExchangeItem(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleRoundedIcon sx={{ color: 'success.main' }} />
            确认兑换
          </DialogTitle>
          <DialogContent>
            {exchangeItem && (
              <Box>
                <Typography sx={{ mb: 2 }}>
                  确定要兑换 <strong>{exchangeItem.name}</strong> 吗？
                </Typography>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>商品名称</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{exchangeItem.name}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>所需积分</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: TYPE_META[exchangeItem.type].color }}>
                      {exchangeItem.price.toLocaleString()} 积分
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>当前余额</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                      {userPoints.toLocaleString()} 积分
                    </Typography>
                  </Box>
                </Box>
                {userPoints < exchangeItem.price && (
                  <Typography sx={{ fontSize: 12, color: 'error.main' }}>
                    积分不足，兑换后剩余 {(userPoints - exchangeItem.price).toLocaleString()} 积分
                  </Typography>
                )}
                {exchangeItem.type === 'physical' && (
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
                    实物商品需填写收货地址，兑换后请联系客服
                  </Typography>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExchangeItem(null)} disabled={exchanging}>
              取消
            </Button>
            <Button
              variant="contained"
              onClick={handleExchange}
              disabled={exchanging}
              startIcon={exchanging ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {exchanging ? '兑换中...' : '确认兑换'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!snack}
          autoHideDuration={3000}
          onClose={() => setSnack(null)}
          message={snack}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />

        </LoginGate>
      </Container>
    </Box>
  );
}
