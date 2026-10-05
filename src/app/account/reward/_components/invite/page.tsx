'use client';

/**
 * 邀请奖励页面
 * 展示邀请码、邀请统计和邀请记录
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PeopleIcon from '@mui/icons-material/People';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { alpha } from '@mui/material/styles';
import { useApp } from '@/contexts/AppContext';
import { getInviteStats, createInviteCode, bindInviteCode, getInviteRecords } from '@/apis/reward-center';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Snackbar from '@mui/material/Snackbar';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileListRow, MobileSection, MobileStatRow } from '@/components/mobile/MobileSection';
import { MobileEmpty, StatusTag } from '../personal/mobileKit';

export default function InvitePage() {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id ?? 0;
  const qc = useQueryClient();
  const { isMobile } = useResponsive();
  // 手机版的复制 / 分享反馈(电脑版复制没有任何提示)
  const [tip, setTip] = useState('');

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
  // 别人分享的邀请链接带 ?code=:登录后落在这一页,绑定框直接填好
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('code');
    if (c) setBindCode(c.toUpperCase());
  }, []);
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
  // 以前是 /invite/<code>,站里没有这个路由(静态导出也不能有动态段),分享出去是 404。
  // 现在落到邀请页本身,并带上 code 让对方的绑定框自动填好(未登录会先被引导登录再回来)。
  const inviteUrl = hasCode ? `${window.location.origin}/account/reward?tab=invite&code=${encodeURIComponent(stats.myCode)}` : '';

  // 手机:邀请码 + 两个数放一张卡,绑定收成一行,记录是单列行
  if (isMobile) {
    const copy = (text: string, label: string) =>
      navigator.clipboard.writeText(text).then(
        () => setTip(`${label}已复制`),
        () => setTip('复制失败,请长按手动复制'),
      );
    const share = async () => {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: '邀请你加入', text: `我的邀请码 ${stats?.myCode}`, url: inviteUrl });
          return;
        } catch {
          // 用户取消或不支持:退回复制
        }
      }
      copy(inviteUrl, '邀请链接');
    };
    const records = recordsData?.list || [];
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <MobileSection title="我的邀请码">
          {hasCode ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography sx={{ flex: 1, fontSize: 24, fontWeight: 700, letterSpacing: 3, fontFamily: 'monospace', color: 'info.main' }}>
                  {stats.myCode}
                </Typography>
                <IconButton size="small" aria-label="复制邀请码" onClick={() => copy(stats.myCode, '邀请码')}>
                  <ContentCopyIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
              <Button fullWidth variant="contained" startIcon={<ShareRoundedIcon />} onClick={share} sx={{ mt: 1.25, borderRadius: 999, fontWeight: 700 }}>
                分享邀请链接
              </Button>
            </>
          ) : (
            <Button fullWidth variant="contained" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} sx={{ borderRadius: 999, fontWeight: 700 }}>
              {createMutation.isPending ? '生成中...' : '生成邀请码'}
            </Button>
          )}
          <Box sx={{ mt: 1.75 }}>
            <MobileStatRow
              items={[
                { label: '已邀请', value: stats?.inviteCount ?? 0 },
                { label: '累计积分', value: <Box component="span" sx={{ color: 'success.main' }}>+{stats?.totalReward ?? 0}</Box> },
              ]}
            />
          </Box>
        </MobileSection>

        <MobileSection title="绑定邀请码" extra="双方都得积分">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1.5, pr: 0.5, py: 0.25, borderRadius: 999, bgcolor: 'action.hover' }}>
            <InputBase
              placeholder="输入朋友的邀请码"
              value={bindCode}
              onChange={(e) => setBindCode(e.target.value.toUpperCase())}
              sx={{ flex: 1, fontSize: 14 }}
            />
            <Button
              size="small"
              variant="text"
              onClick={() => bindCode && bindMutation.mutate(bindCode)}
              disabled={!bindCode || bindMutation.isPending}
              sx={{ minWidth: 0, fontWeight: 700 }}
            >
              {bindMutation.isPending ? '绑定中' : '绑定'}
            </Button>
          </Box>
        </MobileSection>

        <MobileSection title="邀请记录" extra={records.length > 0 ? `${records.length} 人` : undefined} flush>
          {records.length === 0 ? (
            <MobileEmpty>暂无邀请记录</MobileEmpty>
          ) : (
            records.map((record, i) => {
              const issued = record.rewardStatus === 'issued';
              return (
                <MobileListRow
                  key={record.id}
                  divider={i > 0}
                  leading={
                    <Box sx={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
                      {record.inviteeName?.charAt(0) || '?'}
                    </Box>
                  }
                  title={record.inviteeName || '用户'}
                  subtitle={`绑定于 ${record.createTime}`}
                  trailing={
                    <StatusTag
                      label={issued ? '已发放' : '待发放'}
                      color={issued ? '#4CAF50' : '#FF9800'}
                      bg={alpha(issued ? '#4CAF50' : '#FF9800', 0.15)}
                    />
                  }
                />
              );
            })
          )}
        </MobileSection>

        <Snackbar open={!!tip} autoHideDuration={2000} onClose={() => setTip('')} message={tip} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} />
      </Box>
    );
  }

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
