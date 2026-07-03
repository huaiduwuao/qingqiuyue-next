'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import StarOutlineIcon from '@mui/icons-material/StarBorder';

import { useActiveTab } from '../ActiveTabContext';

const SUMMARY = {
  total: 8420.5,
  cashable: 3120.8,
  settled: 5299.7,
  monthlyDelta: 28.4,
};

const SOURCES = [
  {
    id: 'live',
    label: '直播打赏',
    value: 3280.5,
    percent: 39.0,
    color: 'primary.main',
    icon: <LiveTvOutlinedIcon sx={{ fontSize: 18 }} />,
  },
  {
    id: 'store',
    label: '短视频带货',
    value: 2480.2,
    percent: 29.5,
    color: 'secondary.main',
    icon: <StorefrontOutlinedIcon sx={{ fontSize: 18 }} />,
  },
  {
    id: 'reward',
    label: '创作激励',
    value: 1643.8,
    percent: 19.5,
    color: 'warning.main',
    icon: <StarOutlineIcon sx={{ fontSize: 18 }} />,
  },
  {
    id: 'other',
    label: '其他',
    value: 1016.0,
    percent: 12.0,
    color: '#8B5CF6',
    icon: <RedeemOutlinedIcon sx={{ fontSize: 18 }} />,
  },
];

export default function EarningsOverview() {
  const { setActiveTab } = useActiveTab();
  const total = SOURCES.reduce((a, b) => a + b.value, 0);

  return (
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
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          收益总览
        </Typography>
        <Box
          onClick={() => setActiveTab('monetize')}
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
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>本月预估收益</Typography>

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
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>本月总收益 (元)</Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: 32, fontWeight: 700, color: 'text.primary', fontFamily: 'monospace', lineHeight: 1.2 }}>
            {SUMMARY.total.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              px: 0.5,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: 'rgba(93, 219, 150, 0.15)',
              color: 'success.main',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            <TrendingUpIcon sx={{ fontSize: 10 }} />
            <span>+{SUMMARY.monthlyDelta}%</span>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ color: 'secondary.main' }}>
              <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 9, color: 'text.disabled', lineHeight: 1.2 }}>可提现</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', fontFamily: 'monospace' }}>
                ¥{SUMMARY.cashable.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ color: 'warning.main' }}>
              <PaidOutlinedIcon sx={{ fontSize: 16 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 9, color: 'text.disabled', lineHeight: 1.2 }}>已结算</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', fontFamily: 'monospace' }}>
                ¥{SUMMARY.settled.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>收益来源</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
        {SOURCES.map((s) => {
          const percent = total > 0 ? (s.value / total) * 100 : 0;
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
                <Typography sx={{ fontSize: 12, color: 'text.tertiary', flex: 1 }}>
                  {s.label}
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', fontFamily: 'monospace' }}>
                  ¥{s.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
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
  );
}
