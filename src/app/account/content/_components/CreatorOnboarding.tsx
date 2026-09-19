'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { accountClient } from '@/lib/api/client';
import { getMyPaidContents } from '@/apis/social-monetize';
import { getInviteStats } from '@/apis/reward-center';
import { useApp } from '@/contexts/AppContext';
import { useActiveTab } from '../ActiveTabContext';
import { buildOnboardingSteps, onboardingProgress, type OnboardingStep } from './onboarding';

const dismissKey = (uid: number) => `creator_onboarding_dismissed_${uid}`;

/**
 * 创作者新手指引:资料 → 首个作品 → 首个付费作品 → 邀请好友。每一步的完成状态来自
 * 真实数据;全部完成后自动消失,也可以手动隐藏(按用户记在本地)。
 */
export default function CreatorOnboarding() {
  const router = useRouter();
  const { setActiveTab } = useActiveTab();
  const { currentUser } = useApp();
  const uid = currentUser?.id;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    try {
      setDismissed(localStorage.getItem(dismissKey(uid)) === '1');
    } catch {
      /* ignore */
    }
  }, [uid]);

  const stats = useQuery({
    queryKey: ['account', 'creator', 'stats'],
    queryFn: () => accountClient.get<{ totalWorks?: number }>('/creator/stats'),
    enabled: !!uid,
  });
  const paid = useQuery({
    queryKey: ['social', 'my-paid-contents', 'count'],
    queryFn: () => getMyPaidContents({ page: 1, pageSize: 1 }).then((r) => r.total),
    enabled: !!uid,
  });
  const invite = useQuery({
    queryKey: ['invite', 'stats'],
    queryFn: getInviteStats,
    enabled: !!uid,
  });

  if (!uid || dismissed || stats.isLoading || paid.isLoading || invite.isLoading) return null;

  const steps = buildOnboardingSteps({
    hasAvatar: !!currentUser?.avatar,
    hasNickname: !!currentUser?.nickname,
    totalWorks: stats.data?.totalWorks,
    paidWorks: paid.data,
    invited: invite.data?.inviteCount,
  });
  const progress = onboardingProgress(steps);
  if (progress.complete) return null;

  const act = (step: OnboardingStep) => {
    if (step.action.tab) setActiveTab(step.action.tab);
    else if (step.action.href) router.push(step.action.href);
  };
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(uid), '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <Box
      component="section"
      aria-label="新手指引"
      sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, flex: 1 }}>
          新手指引 · 从第一个作品到第一笔收入
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {progress.done} / {progress.total} 已完成
        </Typography>
        <IconButton size="small" onClick={dismiss} aria-label="隐藏新手指引">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
      <LinearProgress
        variant="determinate"
        value={(progress.done / progress.total) * 100}
        sx={{ height: 6, borderRadius: 3, mb: 2 }}
      />
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' } }}>
        {steps.map((step, i) => (
          <Box
            key={step.id}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: step.done ? 'success.main' : 'divider',
              opacity: step.done ? 0.7 : 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {step.done ? (
                <CheckCircleRoundedIcon sx={{ fontSize: 20, color: 'success.main' }} />
              ) : (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: 'action.hover',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i + 1}
                </Box>
              )}
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{step.title}</Typography>
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', flex: 1 }}>{step.description}</Typography>
            <Button
              size="small"
              variant={step.done ? 'text' : 'contained'}
              disabled={step.done}
              onClick={() => act(step)}
              sx={{ alignSelf: 'flex-start', textTransform: 'none', borderRadius: 999 }}
            >
              {step.done ? '已完成' : step.action.label}
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
