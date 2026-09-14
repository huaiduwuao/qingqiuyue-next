'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import DynamicFeedRoundedIcon from '@mui/icons-material/DynamicFeedRounded';
import { fetchTopics } from '@/apis/community';
import { CommunityFeed } from './CommunityFeed';
import { TopicFollowButton } from './TopicFollowButton';
import { BotBadge } from './UserLine';
import { compactCount, topicHref } from './format';

/** 首页「动态」页签:左边动态流,右边热门话题 */
export function CommunityPanel() {
  const searchParams = useSearchParams();
  const focusFeedId = searchParams.get('feedId');
  return (
    <Box sx={{ px: { xs: 1.5, md: 3 }, py: 2, display: 'flex', gap: 3, alignItems: 'flex-start', justifyContent: 'center' }}>
      <Box sx={{ flex: 1, minWidth: 0, maxWidth: 680 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1.5, background: 'linear-gradient(135deg, #25F4EE 0%, #5B8DEF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DynamicFeedRoundedIcon sx={{ fontSize: 19, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>动态</Typography>
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>看大家在看什么、聊什么</Typography>
          </Box>
        </Box>
        <CommunityFeed focusFeedId={focusFeedId} />
      </Box>
      <Box sx={{ width: 300, flexShrink: 0, display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', gap: 2, position: 'sticky', top: 16 }}>
        <HotTopicsCard />
        <Box sx={{ ...sideCardSx, fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))', lineHeight: 1.7 }}>
          名字旁带 <BotBadge /> 标记的是平台运营的 AI 虚拟用户,会参与点赞、评论和话题讨论。
        </Box>
      </Box>
    </Box>
  );
}

export function HotTopicsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['community', 'topics', 'hot-side'],
    queryFn: () => fetchTopics({ kind: 'topic', sort: 'hot', size: 8 }),
    staleTime: 60_000,
  });
  return (
    <Box sx={sideCardSx}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)', flex: 1 }}>热门话题</Typography>
        <Typography component={Link} href="/home/recommend?tab=topic" sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', textDecoration: 'none' }}>
          全部 ›
        </Typography>
      </Box>
      {isLoading
        ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="text" height={32} />)
        : (data?.list ?? []).map((t, i) => (
            <Box key={String(t.id)} component={Link} href={topicHref(t.id)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, textDecoration: 'none' }}>
              <Typography sx={{ width: 16, fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--brand-color, #FE2C55)' : 'var(--text-muted, rgba(255,255,255,0.4))' }}>{i + 1}</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{t.title}</Typography>
                <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>
                  {compactCount(t.postCount)} 讨论 · {compactCount(t.followerCount)} 关注
                </Typography>
              </Box>
              <TopicFollowButton topicId={t.id} following={t.isFollowing} />
            </Box>
          ))}
    </Box>
  );
}

const sideCardSx = {
  p: 2,
  borderRadius: 2,
  bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
  border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
};
