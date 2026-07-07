'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useQuery } from '@tanstack/react-query';
import { AsyncState } from '@/components/common/AsyncState';
import { getCreatorMonetizeSummary } from '@/apis/creator';

const SOURCE_LABELS: Record<string, string> = {
  recharge: '充值',
  consume: '消费',
  reward: '打赏',
  refund: '退款',
};

export default function MonetizePage() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ['account', 'monetize', 'summary'],
    queryFn: () => getCreatorMonetizeSummary(),
  });

  return (
    <AsyncState query={query} skeletonCount={1} skeletonHeight={420}>
      {(data) => {
        const total = Object.values(data.byType || {}).reduce((a, b) => a + Math.abs(b), 0);
        const sources = Object.entries(data.byType || {})
          .map(([key, value]) => ({
            id: key,
            label: SOURCE_LABELS[key] || key,
            value: Math.abs(value) / 100,
            raw: value,
            color: key === 'reward' ? 'primary.main' : key === 'recharge' ? 'secondary.main' : key === 'consume' ? 'warning.main' : '#8B5CF6',
            icon: key === 'reward' ? <StarBorderIcon sx={{ fontSize: 18 }} /> : key === 'recharge' ? <LiveTvOutlinedIcon sx={{ fontSize: 18 }} /> : key === 'consume' ? <StorefrontOutlinedIcon sx={{ fontSize: 18 }} /> : <RedeemOutlinedIcon sx={{ fontSize: 18 }} />,
          }))
          .sort((a, b) => b.value - a.value);

        return (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            }}
          >
            <Box
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                p: 3,
                border: '1px solid',
                borderColor: 'divider',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', flex: 1 }}>收益总览</Typography>
                <Box
                  onClick={() => router.push('/account/orders')}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <Typography sx={{ fontSize: 11 }}>查看账单</Typography>
                  <ArrowForwardIosIcon sx={{ fontSize: 9 }} />
                </Box>
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>钱包余额与流水汇总</Typography>

              <Box
                sx={{
                  background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.12) 0%, rgba(37, 244, 238, 0.05) 100%)',
                  borderRadius: 1.5,
                  p: 2,
                  mb: 2,
                  border: '1px solid',
                  borderColor: 'rgba(254, 44, 85, 0.3)',
                }}
              >
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>当前余额 (元)</Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                  <Typography
                    sx={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: 'text.primary',
                      fontFamily: 'monospace',
                      lineHeight: 1.2,
                    }}
                  >
                    ¥{(data.balance / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ color: 'secondary.main' }}>
                      <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 9, color: 'text.disabled', lineHeight: 1.2 }}>累计入账</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', fontFamily: 'monospace' }}>
                        ¥{(data.totalIncome / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ color: 'warning.main' }}>
                      <PaidOutlinedIcon sx={{ fontSize: 16 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 9, color: 'text.disabled', lineHeight: 1.2 }}>累计支出</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', fontFamily: 'monospace' }}>
                        ¥{(data.totalExpense / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>按类型分布</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
                {sources.length === 0 && (
                  <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>暂无流水记录</Typography>
                )}
                {sources.map((s) => {
                  const percent = total > 0 ? (s.value / (total / 100)) * 100 : 0;
                  return (
                    <Box key={s.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            borderRadius: 0.75,
                            bgcolor: `${s.color}1F`,
                            color: s.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {s.icon}
                        </Box>
                        <Typography sx={{ fontSize: 12, color: 'text.tertiary', flex: 1 }}>{s.label}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', fontFamily: 'monospace' }}>
                          {s.raw > 0 ? '+' : ''}¥{s.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.disabled', fontFamily: 'monospace', minWidth: 36, textAlign: 'right' }}>
                          {percent.toFixed(1)}%
                        </Typography>
                      </Box>
                      <Box sx={{ height: 4, bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1E2030' : 'action.hover'), borderRadius: 1, overflow: 'hidden' }}>
                        <Box
                          sx={{
                            width: `${percent}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${s.color} 0%, ${s.color}AA 100%)`,
                            borderRadius: 1,
                            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Box
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                p: 3,
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                近 30 天净流水
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>近 30 天钱包净流入/出</Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: data.recent30Days >= 0 ? 'success.main' : 'primary.main',
                    fontFamily: 'monospace',
                  }}
                >
                  {data.recent30Days >= 0 ? '+' : ''}¥{(Math.abs(data.recent30Days) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    px: 0.5,
                    py: 0.125,
                    borderRadius: 0.5,
                    bgcolor: data.recent30Days >= 0 ? 'rgba(93, 219, 150, 0.15)' : 'rgba(254, 44, 85, 0.12)',
                    color: data.recent30Days >= 0 ? 'success.main' : 'primary.main',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 10 }} />
                  <span>{data.recent30Days >= 0 ? '流入' : '流出'}</span>
                </Box>
              </Box>

              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                说明:仅统计 wallet_tx 流水,未扣除平台手续费。真实提现功能待支付网关接入。
              </Typography>
            </Box>
          </Box>
        );
      }}
    </AsyncState>
  );
}
