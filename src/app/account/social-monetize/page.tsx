'use client';

export const dynamic = "force-dynamic";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { LoginGate } from '@/components/auth/LoginGate';
import {
  getEarnings,
  getEarningHistory,
  getTips,
  getMyPaidContents,
  getMyPurchases,
  applyWithdraw,
  formatMoney,
  type EarningsStats,
  type Earning,
  type Tip,
  type PaidContent,
  type Purchase,
} from '@/apis/social-monetize';

// 图标
const IconMoney = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93V18c0-.55-.45-1-1-1s-1 .45-1 1v1.93C7.06 19.64 4 16.17 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8c0 4.17-3.06 7.64-7 7.93zM12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/>
  </svg>
);

// 收益概览卡片
function EarningsOverview({ stats }: { stats: EarningsStats }) {
  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        收益概览
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'rgba(93, 219, 150, 0.1)', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#5DDB96' }}>
            ¥{formatMoney(stats.availableAmount)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            可提现
          </Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'rgba(255, 180, 0, 0.1)', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#FFB400' }}>
            ¥{formatMoney(stats.totalEarnings)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            累计收益
          </Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'rgba(91, 141, 239, 0.1)', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#5B8DEF' }}>
            ¥{formatMoney(stats.todayEarnings)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            今日收益
          </Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'rgba(254, 44, 85, 0.1)', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#FE2C55' }}>
            ¥{formatMoney(stats.withdrawnAmount)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            已提现
          </Typography>
        </Box>
      </Box>
      <Button
        variant="contained"
        fullWidth
        sx={{
          mt: 2,
          bgcolor: 'linear-gradient(90deg, #5DDB96 0%, #25F4EE 100%)',
          color: '#0a0a0f',
          fontWeight: 700,
          '&:hover': { filter: 'brightness(1.1)' },
        }}
        disabled={stats.availableAmount < 100}
      >
        申请提现
      </Button>
    </Paper>
  );
}

// 收益类型说明
function EarningsBreakdown() {
  const items = [
    { type: '打赏', icon: '💰', desc: '粉丝对你的内容打赏' },
    { type: '订阅', icon: '⭐', desc: '粉丝订阅你的月度/年度内容' },
    { type: '付费内容', icon: '📚', desc: '设置内容为付费阅读' },
  ];

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        收益来源
      </Typography>
      <Stack spacing={1.5}>
        {items.map(item => (
          <Box
            key={item.type}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
            }}
          >
            <Typography sx={{ fontSize: 24 }}>{item.icon}</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{item.type}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{item.desc}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 2 }}>
        平台收取 10% 服务费用于运营支持
      </Typography>
    </Paper>
  );
}

// 打赏记录
function TipsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['social-tips'],
    queryFn: () => getTips({ page: 1, pageSize: 50 }),
  });

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        打赏记录
      </Typography>
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>加载中...</Box>
      ) : (
        <Stack spacing={1}>
          {data?.list?.map((tip: Tip) => (
            <Box
              key={tip.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: '#5DDB9620',
                  color: '#5DDB96',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                +{formatMoney(tip.amount)}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 500, fontSize: 13 }}>
                  粉丝 #{tip.fanId}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {tip.message || '支持一下~'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {new Date(tip.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          ))}
          {(!data?.list || data.list.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              暂无打赏记录
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

// 收益明细
function EarningsHistoryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['social-earnings-history'],
    queryFn: () => getEarningHistory({ page: 1, pageSize: 50 }),
  });

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      tip: '打赏',
      subscription: '订阅',
      paid_content: '付费内容',
      commission: '佣金',
    };
    return map[type] || type;
  };

  const getTypeColor = (type: string) => {
    const map: Record<string, string> = {
      tip: '#5DDB96',
      subscription: '#FFB400',
      paid_content: '#5B8DEF',
      commission: '#8B5CF6',
    };
    return map[type] || '#5DDB96';
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        收益明细
      </Typography>
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>加载中...</Box>
      ) : (
        <Stack spacing={1}>
          {data?.list?.map((e: Earning) => (
            <Box
              key={e.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: getTypeColor(e.type) + '20',
                  color: getTypeColor(e.type),
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {getTypeLabel(e.type)}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 500, fontSize: 13 }}>
                  +¥{formatMoney(e.netAmount)}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  手续费: ¥{formatMoney(e.platformFee)}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={e.status === 'available' ? '可提现' : e.status}
                sx={{ fontSize: 10 }}
              />
            </Box>
          ))}
          {(!data?.list || data.list.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              暂无收益记录
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

// 付费内容管理
function PaidContentsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['social-paid-contents'],
    queryFn: () => getMyPaidContents({ page: 1, pageSize: 50 }),
  });

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          我的付费内容
        </Typography>
        <Button size="small" variant="outlined">
          设置付费
        </Button>
      </Box>
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>加载中...</Box>
      ) : (
        <Stack spacing={1}>
          {data?.list?.map((content: PaidContent) => (
            <Box
              key={content.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                  bgcolor: 'primary.main',
                  opacity: 0.1,
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 500, fontSize: 13 }}>{content.title}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  销量: {content.salesCount} | 收入: ¥{formatMoney(content.revenue)}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`¥${formatMoney(content.price)}`}
                sx={{ bgcolor: '#5DDB9620', color: '#5DDB96' }}
              />
            </Box>
          ))}
          {(!data?.list || data.list.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              暂无付费内容
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

// 购买记录
function PurchasesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['social-purchases'],
    queryFn: () => getMyPurchases({ page: 1, pageSize: 50 }),
  });

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        我的购买
      </Typography>
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>加载中...</Box>
      ) : (
        <Stack spacing={1}>
          {data?.list?.map((p: Purchase) => (
            <Box
              key={p.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: '#FFB40020',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                📚
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 500, fontSize: 13 }}>
                  付费内容 #{p.paidContentId}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  创作者 #{p.creatorId}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 600, color: '#FE2C55' }}>
                -¥{formatMoney(p.amount)}
              </Typography>
            </Box>
          ))}
          {(!data?.list || data.list.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              暂无购买记录
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

export default function SocialMonetizePage() {
  const [tab, setTab] = useState(0);

  const { data: earnings, isLoading } = useQuery({
    queryKey: ['social-earnings'],
    queryFn: getEarnings,
    staleTime: 30 * 1000,
  });

  return (
    <Box
      sx={{
        height: 'calc(100dvh - var(--appbar-h, 66px))',
        overflow: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <LoginGate mode="replace" message="登录后查看收益中心">
          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>加载中...</Box>
          ) : earnings ? (
            <>
              <EarningsOverview stats={earnings} />
              <EarningsBreakdown />

              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{ mb: 2, '& .MuiTab-root': { minWidth: 'auto', px: 2 } }}
              >
                <Tab label="打赏" />
                <Tab label="收益" />
                <Tab label="付费内容" />
                <Tab label="购买" />
              </Tabs>

              {tab === 0 && <TipsTab />}
              {tab === 1 && <EarningsHistoryTab />}
              {tab === 2 && <PaidContentsTab />}
              {tab === 3 && <PurchasesTab />}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              暂无数据
            </Box>
          )}
        </LoginGate>
      </Box>
    </Box>
  );
}
