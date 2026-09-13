'use client';

/**
 * 会员福利页面
 * 有效会员(user_membership)每月自动发放钻石到钱包;这里展示本月发放状态和历史记录。
 */

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import DiamondIcon from '@mui/icons-material/Diamond';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import { alpha } from '@mui/material/styles';
import { useApp } from '@/contexts/AppContext';
import { getMonthlyBenefitStatus, getMonthlyBenefitRecords } from '@/apis/reward-center';

/** 分 → "¥1.00" */
const yuan = (cents?: number) => `¥${((cents ?? 0) / 100).toFixed(2)}`;

/** Unix 秒 → "2026/9/13" */
const dateOf = (sec?: number) => (sec ? new Date(sec * 1000).toLocaleDateString('zh-CN') : '');

export default function MonthlyBenefitPage() {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id ?? 0;

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['reward-center', 'monthly-benefit-status', currentUserId],
    queryFn: () => getMonthlyBenefitStatus(),
    enabled: !!currentUserId,
  });

  const { data: records = [] } = useQuery({
    queryKey: ['reward-center', 'monthly-benefit-records', currentUserId],
    queryFn: () => getMonthlyBenefitRecords(),
    enabled: !!currentUserId,
  });

  if (!currentUserId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>请先登录后查看福利</Typography>
      </Box>
    );
  }

  if (statusLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isVip = status?.isVip ?? false;
  const granted = status?.status === 'granted';
  const list = Array.isArray(records) ? records : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 会员状态卡片 */}
      <Card sx={{
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.warning.main, 0.3),
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <DiamondIcon sx={{ fontSize: 32, color: 'warning.main' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {isVip ? '会员月度福利' : '月度福利'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {isVip
                  ? `${status?.planName || '会员'} · 有效期至 ${dateOf(status?.expiresAt)}`
                  : `开通会员后,每月自动发放 ${yuan(status?.monthlyReward)} 钻石到钱包`}
              </Typography>
            </Box>
          </Box>

          {isVip ? (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{
                flex: 1,
                p: 2,
                borderRadius: 2,
                bgcolor: alpha('#FFD700', 0.1),
                textAlign: 'center',
              }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  {yuan(status?.monthlyReward)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  每月发放到钱包
                </Typography>
              </Box>
              <Box sx={{
                flex: 1,
                p: 2,
                borderRadius: 2,
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}>
                {granted ? (
                  <>
                    <CheckCircleIcon sx={{ color: 'success.main' }} />
                    <Box>
                      <Typography sx={{ fontWeight: 600, color: 'success.main' }}>
                        本月已发放
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {yuan(status?.diamondCount)} · {dateOf(status?.grantTime)}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <>
                    <PendingIcon sx={{ color: 'warning.main' }} />
                    <Box>
                      <Typography sx={{ fontWeight: 600, color: 'warning.main' }}>
                        本月待发放
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        开通后一小时内到账,之后每月初自动发放
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Button component={Link} href="/account/vip" variant="contained" color="warning" sx={{ fontWeight: 600 }}>
                开通会员
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 发放记录 */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CardGiftcardIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              发放记录
            </Typography>
          </Box>

          {list.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {list.map((record) => {
                const ok = record.status === 'granted';
                return (
                  <Box key={record.id} sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                  }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 500, fontSize: 14 }}>
                        {record.yearMonth} 月度福利
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {record.vipLevel || '会员'}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 600, color: 'success.main' }}>
                      +{yuan(record.diamondCount)}
                    </Typography>
                    <Chip
                      icon={ok ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <PendingIcon sx={{ fontSize: 14 }} />}
                      label={ok ? '已发放' : '发放失败'}
                      size="small"
                      sx={{
                        bgcolor: ok ? alpha('#4CAF50', 0.15) : alpha('#FF9800', 0.15),
                        color: ok ? '#4CAF50' : '#FF9800',
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ color: 'text.secondary' }}>
                暂无发放记录
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
