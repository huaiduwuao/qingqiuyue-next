'use client';

/**
 * 月度福利页面
 * 展示VIP会员月度福利领取状态和历史记录
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import DiamondIcon from '@mui/icons-material/Diamond';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import { alpha } from '@mui/material/styles';
import { useApp } from '@/contexts/AppContext';
import { getMonthlyBenefitStatus, getMonthlyBenefitRecords } from '@/apis/reward-center';

// VIP等级名称映射
const VIP_LEVEL_NAMES: Record<number, string> = {
  0: '普通会员',
  1: '青铜会员',
  2: '白银会员',
  3: '黄金会员',
  4: '铂金会员',
  5: '钻石会员',
};

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
  const vipLevelName = VIP_LEVEL_NAMES[status?.vipLevel ?? 0] || '普通会员';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* VIP状态卡片 */}
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
                {isVip ? 'VIP 会员福利' : '月度福利'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {isVip ? `${vipLevelName} · 每月可领取专属福利` : '升级VIP解锁月度福利'}
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
                  +{status?.monthlyReward ?? 0}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  本月可领积分
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
                {status?.currentStatus === 'sent' ? (
                  <>
                    <CheckCircleIcon sx={{ color: 'success.main' }} />
                    <Box>
                      <Typography sx={{ fontWeight: 600, color: 'success.main' }}>
                        本月已领取
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        +{status?.lastBenefitAmount ?? 0} 积分
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <>
                    <PendingIcon sx={{ color: 'warning.main' }} />
                    <Box>
                      <Typography sx={{ fontWeight: 600, color: 'warning.main' }}>
                        本月待领取
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        次月1日自动发放
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography sx={{ color: 'text.secondary', mb: 1 }}>
                成为VIP会员后,每月可领取专属积分福利
              </Typography>
              <Chip
                label="升级VIP"
                sx={{
                  bgcolor: alpha('#FFD700', 0.2),
                  color: 'warning.main',
                  fontWeight: 600,
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* VIP等级说明 */}
      {isVip && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              VIP 等级权益
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {[1, 2, 3, 4, 5].map((level) => (
                <Chip
                  key={level}
                  label={`${VIP_LEVEL_NAMES[level]} · ${level * 100}+/月`}
                  size="small"
                  variant={status?.vipLevel ?? 0 >= level ? 'filled' : 'outlined'}
                  sx={{
                    bgcolor: status?.vipLevel ?? 0 >= level ? alpha('#FFD700', 0.2) : 'transparent',
                    borderColor: 'divider',
                    color: status?.vipLevel ?? 0 >= level ? 'warning.main' : 'text.secondary',
                  }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 历史记录 */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CardGiftcardIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              领取记录
            </Typography>
          </Box>

          {records.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {records.map((record) => (
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
                      {VIP_LEVEL_NAMES[record.vipLevel] || '普通会员'}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 600, color: 'success.main' }}>
                    +{record.diamondReward}
                  </Typography>
                  <Chip
                    icon={record.status === 'sent' ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <PendingIcon sx={{ fontSize: 14 }} />}
                    label={record.status === 'sent' ? '已发放' : '待发放'}
                    size="small"
                    sx={{
                      bgcolor: record.status === 'sent' ? alpha('#4CAF50', 0.15) : alpha('#FF9800', 0.15),
                      color: record.status === 'sent' ? '#4CAF50' : '#FF9800',
                    }}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ color: 'text.secondary' }}>
                暂无领取记录
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
