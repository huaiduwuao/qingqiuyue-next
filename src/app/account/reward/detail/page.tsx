'use client';

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import { alpha } from '@mui/material/styles';
import { getHotBounties, type Bounty } from '@/apis/dashboard';

/**
 * 悬赏详情页 —— /account/reward/detail?id=b2
 * 来源:RewardHotGrid (src/app/account/reward/_components/dashboard/RewardHotGrid.tsx:155)
 *   onClick={() => router.push(`/account/reward/detail?id=${b.id}`)}
 * 之前路由不存在 → 404;现在按 query id 拉一次 hot bounty 列表过滤,做卡片视图。
 * 后续可换后端单条 GET /reward/bounty/:id,目前 dashboard 没有那个 endpoint。
 */
export default function RewardDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id') || '';
  const backHref = '/account/reward';

  // 拉一次 hot 列表,按 id 过滤 —— 复用 dashboard 既有 endpoint,不另起一条
  const hotQuery = useQuery({
    queryKey: ['reward', 'bounty', 'hot', { id }],
    queryFn: () => getHotBounties({ limit: 50 }),
    staleTime: 30 * 1000,
  });
  const bounty: Bounty[] = (hotQuery.data?.records ?? hotQuery.data?.list ?? []) as Bounty[];

  if (hotQuery.isLoading) {
    return (
      <Box sx={{ maxWidth: 920, mx: 'auto', py: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push(backHref)} sx={{ mb: 2 }}>
          返回悬赏中心
        </Button>
        <LinearProgress sx={{ borderRadius: 1 }} />
        <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 13 }}>正在加载悬赏详情…</Typography>
      </Box>
    );
  }

  // bounty 是数组;空数组是 truthy,!bounty 是 false → 必须额外查 length 才算「找到了」
  const found = id ? bounty.find((b) => b.id === id) : undefined;
  if (!id || !found) {
    return (
      <Box sx={{ maxWidth: 920, mx: 'auto', py: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push(backHref)} sx={{ mb: 2 }}>
          返回悬赏中心
        </Button>
        <Typography variant="h5" sx={{ mb: 1 }}>未找到该悬赏</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
          id: {id || '（空）'} · 可能已被下架或还未到上线时间。
        </Typography>
      </Box>
    );
  }

  const rewardYuan = (found.reward / 100).toLocaleString('zh-CN');

  return (
    <Box sx={{ maxWidth: 920, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5, py: 2 }}>
      {/* 返回 */}
      <Button
        startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
        onClick={() => router.push(backHref)}
        sx={{
          alignSelf: 'flex-start',
          color: 'text.secondary',
          textTransform: 'none',
          fontSize: 13,
        }}
      >
        返回悬赏中心
      </Button>

      {/* 顶部 Hero:封面 + 标题 + 元信息 */}
      <Box
        sx={{
          position: 'relative',
          borderRadius: 2,
          overflow: 'hidden',
          p: { xs: 2.5, md: 4 },
          background: found.gradient || `linear-gradient(135deg, ${alpha('#FE2C55', 0.18)}, ${alpha('#8B5CF6', 0.18)})`,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <WhatshotIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Chip
                size="small"
                label={`#${found.id}`}
                sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: 'action.hover', color: 'text.secondary' }}
              />
              {found.category && (
                <Chip
                  size="small"
                  label={found.category.toUpperCase()}
                  sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: 'action.hover', color: 'text.secondary' }}
                />
              )}
            </Box>
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
              {found.title}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
              主办方:{found.sponsor}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 三张数据卡 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CardGiftcardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>总赏金</Typography>
          </Box>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'text.primary', mt: 1, fontFamily: 'monospace' }}>
            ¥{rewardYuan}
          </Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>已接悬赏</Typography>
          </Box>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'text.primary', mt: 1, fontFamily: 'monospace' }}>
            {found.applicants}
          </Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon sx={{ fontSize: 18, color: 'warning.main' }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>剩余天数</Typography>
          </Box>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'text.primary', mt: 1, fontFamily: 'monospace' }}>
            {found.daysLeft} 天
          </Typography>
        </Box>
      </Box>

      {/* 占位说明:后续接入详情富文本 */}
      <Box sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', mb: 1 }}>任务说明</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.7 }}>
          本条目由 <code>/api/core/reward/bounty/hot</code> 提供,dashboard 后台运营可见编辑界面。
          完整任务说明 / 提交流程由后续接入富文本或 link 到具体任务模块。当前页保证 id 路径可达 + 关键数据可见。
        </Typography>
      </Box>

      {/* 底部操作 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button variant="outlined" onClick={() => router.push(backHref)} sx={{ textTransform: 'none' }}>
          返回列表
        </Button>
        <Button variant="contained" disabled sx={{ textTransform: 'none' }}>
          接下悬赏（暂未开放）
        </Button>
      </Box>
    </Box>
  );
}
