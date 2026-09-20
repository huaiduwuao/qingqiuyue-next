'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import LocalAtmRoundedIcon from '@mui/icons-material/LocalAtmRounded';
import { listRealmDemands, type RealmDemand } from '@/apis/team';

/**
 * 社区悬赏动态。首页右栏的常驻卡片,也可给首屏引导复用(见 components/onboarding/FirstRunGuide)。
 *
 * 为什么放首页:平台的主线是「意境 → 需求 → 团队 → 实现」,但首页原来只有推荐流,
 * 一个新来的人看不到"这里有人在花钱找人做事"这件事,自然也不会想参与。
 *
 * 数据走 /realm/demands(teamapp,公开只读),不登录也能看 —— 这张卡片的意义就在于
 * 让还没注册的人先看见,所以它不能要登录态。
 */

/** 悬赏动态的 react-query 配置,卡片和引导弹窗共用同一份缓存。 */
export function bountyPulseQuery(limit: number) {
  return {
    queryKey: ['realm', 'demands', 'pulse', limit] as const,
    queryFn: () => listRealmDemands({ pageSize: limit }),
    staleTime: 60_000,
  };
}

export function useBountyPulse(limit = 6) {
  return useQuery(bountyPulseQuery(limit));
}

/**
 * 一条悬赏。compact 用在引导弹窗的窄栏里,省掉发布者名字。
 * onNavigate 给指引用:从这里点走也算引导结束,别等他回来再弹一次。
 */
export function BountyRow({
  demand,
  compact,
  onNavigate,
}: {
  demand: RealmDemand;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const open = demand.status === 'PUBLISHED' && demand.openTaskCount > 0;
  return (
    <Box
      component={Link}
      onClick={onNavigate}
      href={open ? `/account/reward?tab=board&demand=${demand.id}` : `/detail/topic-detail?id=${demand.topicId}`}
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        p: 1,
        borderRadius: 1.5,
        textDecoration: 'none',
        color: 'inherit',
        minWidth: 0,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {demand.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, minWidth: 0 }}>
          {demand.topicTitle && (
            <Chip
              size="small"
              variant="outlined"
              label={demand.topicTitle}
              sx={{ height: 17, fontSize: 10, maxWidth: 110, '& .MuiChip-label': { px: 0.6 } }}
            />
          )}
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {compact ? null : `${demand.username} · `}
            {demand.openTaskCount > 0 ? `${demand.openTaskCount} 个待认领` : '已有人接'}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 800, color: 'warning.main', flexShrink: 0 }}>
        ¥{demand.pay}
      </Typography>
    </Box>
  );
}

/** 首页右栏的「社区悬赏」卡片。一条都没有时整张卡不渲染,不占位。 */
export default function BountyPulse({ limit = 6 }: { limit?: number }) {
  const { data, isLoading } = useBountyPulse(limit);
  const items = data?.list ?? [];

  if (isLoading) {
    return (
      <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
        <Skeleton width={96} height={20} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={38} />
        ))}
      </Box>
    );
  }
  if (items.length === 0) return null;

  return (
    <Box sx={{ borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, pt: 1.25, pb: 0.5 }}>
        <LocalAtmRoundedIcon sx={{ fontSize: 18, color: 'warning.main' }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>社区悬赏</Typography>
        <Typography
          component={Link}
          href="/account/reward?tab=board"
          sx={{ fontSize: 12, color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
        >
          全部
        </Typography>
      </Box>
      <Box sx={{ px: 0.5, pb: 1 }}>
        {items.map((d) => (
          <BountyRow key={d.id} demand={d} />
        ))}
      </Box>
    </Box>
  );
}
