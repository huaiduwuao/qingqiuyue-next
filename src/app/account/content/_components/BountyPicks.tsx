'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { getHotBounties } from '@/apis/dashboard';
import { coverBackground } from '@/lib/media';
import { fallbackCoverDataUri } from '@/lib/bountyCover';
import { gradient2 } from '@/constants/gradients';
import { MobileSection } from '@/components/mobile/MobileSection';
import BountyDetailDialog from '@/app/account/reward/_components/dashboard/BountyDetailDialog';
import { formatDiamonds } from '@/apis/wallet';

const LABEL: Record<string, string> = {
  video: '短视频', image: '图文', novel: '小说', art: '画作', music: '音乐',
  film: '短剧', script: '剧本', live: '直播', voice: '配音',
};

const left = (d: number | null | undefined) => (d == null ? '长期' : d === 0 ? '今天截止' : `剩 ${d} 天`);

/**
 * 创作中心里的「接个悬赏」:创作者和悬赏以前是两个互不相通的中心 —— 在工作台里看不到任何
 * 「有人在花钱找人做内容」。这里拉赏金最高的几条开放悬赏,点开就是赏金广场同一个详情弹层
 * (能直接认领任务),认领后在任务里「去创作交付」回到发布页。
 */
export default function BountyPicks({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const router = useRouter();
  const [detailId, setDetailId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['creator', 'bounty-picks'],
    queryFn: () => getHotBounties({ page: 1, pageSize: 4, order: 'reward' }),
    staleTime: 60_000,
  });
  const items = (q.data?.list ?? []).slice(0, 4);
  const goSquare = () => router.push('/account/reward?tab=square');

  if (!q.isLoading && items.length === 0) return null;

  const dialog = <BountyDetailDialog open={!!detailId} bountyId={detailId} onClose={() => setDetailId(null)} />;

  if (variant === 'mobile') {
    return (
      <MobileSection title="接个悬赏" extra="有人在花钱找人创作" onMore={goSquare} moreLabel="赏金广场" flush>
        {q.isLoading ? (
          <Box sx={{ px: 1.75, pb: 1.5 }}><Skeleton variant="rounded" height={56} /></Box>
        ) : (
          items.map((b, i) => (
            <Box
              key={b.id}
              onClick={() => setDetailId(String(b.id))}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.1, cursor: 'pointer',
                borderTop: i > 0 ? '1px solid' : 0, borderColor: 'divider',
                WebkitTapHighlightColor: 'transparent', '&:active': { bgcolor: 'action.hover' },
              }}
            >
              <Typography sx={{ width: 52, flexShrink: 0, fontSize: 15, fontWeight: 800, color: 'primary.main', fontFamily: 'monospace' }}>
                {formatDiamonds(b.rewardDiamonds)}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>{b.title}</Typography>
                <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {LABEL[b.category] ?? b.category} · {left(b.daysLeft)} · {b.applicants ?? 0} 人参与
                </Typography>
              </Box>
              <ChevronRightRoundedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
            </Box>
          ))
        )}
        {dialog}
      </MobileSection>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 2.5, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 600, flex: 1 }}>
          适合你的悬赏
          <Box component="span" sx={{ ml: 1, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>
            认领任务 → 在这里创作 → 用作品交付拿赏金
          </Box>
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={goSquare}
          sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', fontSize: 12, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
        >
          去赏金广场
          <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {q.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={140} />)
          : items.map((b) => (
              <Box
                key={b.id}
                onClick={() => setDetailId(String(b.id))}
                sx={{
                  borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider', cursor: 'pointer',
                  transition: 'border-color .2s, transform .2s', '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                }}
              >
                <Box
                  sx={{
                    position: 'relative', height: 72,
                    background: coverBackground(b.cover || fallbackCoverDataUri(b.title, b.category), b.gradient || gradient2('#FE2C55', '#FF6B8A')),
                  }}
                >
                  <Box component="span" sx={{ position: 'absolute', left: 8, top: 8, px: 0.75, borderRadius: 0.75, fontSize: 11, fontWeight: 600, color: '#fff', bgcolor: 'rgba(0,0,0,0.45)' }}>
                    {LABEL[b.category] ?? b.category}
                  </Box>
                  <Box component="span" sx={{ position: 'absolute', right: 8, bottom: 8, px: 0.75, borderRadius: 0.75, fontSize: 13, fontWeight: 800, color: '#fff', bgcolor: 'primary.main', fontFamily: 'monospace' }}>
                    {formatDiamonds(b.rewardDiamonds)}
                  </Box>
                </Box>
                <Box sx={{ p: 1.25 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, minHeight: 36, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {b.title}
                  </Typography>
                  <Box sx={{ mt: 0.75, display: 'flex', gap: 1.5, color: 'text.secondary', fontSize: 11 }}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}><AccessTimeRoundedIcon sx={{ fontSize: 13 }} />{left(b.daysLeft)}</Box>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}><GroupRoundedIcon sx={{ fontSize: 13 }} />{b.applicants ?? 0}</Box>
                  </Box>
                </Box>
              </Box>
            ))}
      </Box>
      {dialog}
    </Box>
  );
}
