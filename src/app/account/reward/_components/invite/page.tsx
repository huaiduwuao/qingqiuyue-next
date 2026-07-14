'use client';

/**
 * 邀请奖励页面
 * 展示邀请码、邀请统计和邀请记录
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PeopleIcon from '@mui/icons-material/People';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { alpha } from '@mui/material/styles';
import { useApp } from '@/contexts/AppContext';
import { getInviteStats, createInviteCode, bindInviteCode, getInviteRecords } from '@/apis/reward-center';

export default function InvitePage() {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id ?? 0;
  const qc = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['reward-center', 'invite-stats', currentUserId],
    queryFn: () => getInviteStats(),
    enabled: !!currentUserId,
  });

  const { data: recordsData } = useQuery({
    queryKey: ['reward-center', 'invite-records', currentUserId],
    queryFn: () => getInviteRecords({ page: 1, size: 20 }),
    enabled: !!currentUserId,
  });

  const createMutation = useMutation({
    mutationFn: () => createInviteCode(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reward-center', 'invite-stats'] }),
  });

  const [bindCode, setBindCode] = useState('');
  const bindMutation = useMutation({
    mutationFn: (code: string) => bindInviteCode(code),
    onSuccess: () => {
      setBindCode('');
      qc.invalidateQueries({ queryKey: ['reward-center', 'invite-records'] });
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      // 简单提示，实际可用 Snackbar
    });
  };

  if (!currentUserId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>请先登录后查看邀请信息</Typography>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const hasCode = stats?.myCode;
  const inviteUrl = hasCode ? `${window.location.origin}/invite/${stats.myCode}` : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 邀请码卡片 */}
      <Card sx={{
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.info.main, 0.3),
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <PeopleIcon sx={{ fontSize: 28, color: 'info.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              我的邀请码
            </Typography>
          </Box>

          {hasCode ? (
            <Box>
              <Box sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'action.hover',
                textAlign: 'center',
                mb: 2,
              }}>
                <Typography variant="h4" sx={{
                  fontWeight: 700,
                  letterSpacing: 4,
                  fontFamily: 'monospace',
                  color: 'info.main',
                }}>
                  {stats.myCode}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => copyCode(stats.myCode)}
                  sx={{ flex: 1 }}
                >
                  复制邀请码
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => copyCode(inviteUrl)}
                  sx={{ flex: 1 }}
                >
                  复制邀请链接
                </Button>
              </Box>
            </Box>
          ) : (
            <Button
              variant="contained"
              size="large"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              fullWidth
              sx={{ py: 1.5 }}
            >
              {createMutation.isPending ? '生成中...' : '生成邀请码'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center' }}>
            <PeopleIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {stats?.inviteCount ?? 0}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              已邀请人数
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center' }}>
            <CardGiftcardIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
              +{stats?.totalReward ?? 0}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              累计获得积分
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 绑定邀请码 */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            绑定邀请码
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              placeholder="输入邀请码"
              value={bindCode}
              onChange={(e) => setBindCode(e.target.value.toUpperCase())}
              fullWidth
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              onClick={() => bindCode && bindMutation.mutate(bindCode)}
              disabled={!bindCode || bindMutation.isPending}
            >
              {bindMutation.isPending ? '绑定中...' : '绑定'}
            </Button>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
            输入朋友分享的邀请码，双方都可获得积分奖励
          </Typography>
        </CardContent>
      </Card>

      {/* 邀请记录 */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            邀请记录
          </Typography>

          {recordsData?.list && recordsData.list.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {recordsData.list.map((record) => (
                <Box key={record.id} sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'primary.contrastText',
                    fontSize: 14,
                    fontWeight: 600,
                  }}>
                    {record.inviteeName?.charAt(0) || '?'}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 500, fontSize: 14 }}>
                      {record.inviteeName || '用户'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      绑定时间: {record.createTime}
                    </Typography>
                  </Box>
                  <Chip
                    icon={record.rewardStatus === 'issued' ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <HourglassEmptyIcon sx={{ fontSize: 14 }} />}
                    label={record.rewardStatus === 'issued' ? '已发放' : '待发放'}
                    size="small"
                    sx={{
                      bgcolor: record.rewardStatus === 'issued' ? alpha('#4CAF50', 0.15) : alpha('#FF9800', 0.15),
                      color: record.rewardStatus === 'issued' ? '#4CAF50' : '#FF9800',
                    }}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ color: 'text.secondary' }}>
                暂无邀请记录
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                分享邀请码给朋友,双方都能获得积分奖励
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
