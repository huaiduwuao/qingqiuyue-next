'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import DynamicFeedRoundedIcon from '@mui/icons-material/DynamicFeedRounded';
import { fetchTopics } from '@/apis/community';
import { CommunityFeed } from './CommunityFeed';
import { CircleSuggestions, FollowBar, FriendBar, sideCardSx, type Circle } from './CircleExtras';
import { TopicFollowButton } from './TopicFollowButton';
import { BotBadge } from './UserLine';
import { compactCount, topicHref } from './format';

type Scope = 'square' | Circle;

const SCOPES: { key: Scope; label: string; hint: string }[] = [
  { key: 'square', label: '广场', hint: '看大家在看什么、聊什么' },
  { key: 'follow', label: '关注', hint: '你关注的人在发什么、看什么' },
  { key: 'friend', label: '朋友', hint: '你和好友的动态' },
];

/**
 * 首页「动态」页签(原「关注」「朋友」两个页签也并在这里):同一条动态流按范围过滤。
 * ?scope=follow|friend,不带就是广场;旧的 ?tab=follow|friend 由 HomeLayout 改写成 scope。
 * 左边动态流,右边广场放热门话题,关注/朋友放推荐的人。
 */
export function CommunityPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusFeedId = searchParams.get('feedId');
  // 改写前的一帧还是 ?tab=follow|friend,也认
  const rawScope = searchParams.get('scope') || searchParams.get('tab');
  const scope: Scope = rawScope === 'follow' || rawScope === 'friend' ? rawScope : 'square';
  const circle = scope === 'square' ? undefined : scope;
  const hint = SCOPES.find((s) => s.key === scope)!.hint;

  const setScope = (next: Scope) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'feed');
    if (next === 'square') params.delete('scope');
    else params.set('scope', next);
    params.delete('feedId');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Box sx={{ px: { xs: 1.5, md: 3 }, py: 2, display: 'flex', gap: 3, alignItems: 'flex-start', justifyContent: 'center' }}>
      <Box sx={{ flex: 1, minWidth: 0, maxWidth: 680 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1.5, background: 'linear-gradient(135deg, #25F4EE 0%, #5B8DEF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DynamicFeedRoundedIcon sx={{ fontSize: 19, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>动态</Typography>
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>{hint}</Typography>
          </Box>
          {scope === 'follow' && <FollowBar />}
          {scope === 'friend' && <FriendBar />}
        </Box>
        <Box role="tablist" sx={{ display: 'flex', gap: 2.5, mb: 2, borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          {SCOPES.map((s) => {
            const active = scope === s.key;
            return (
              <Typography
                key={s.key}
                component="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScope(s.key)}
                sx={{
                  p: 0,
                  pb: 0.75,
                  border: 0,
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: active ? 800 : 500,
                  color: active ? 'var(--text-primary, #fff)' : 'var(--text-secondary, rgba(255,255,255,0.55))',
                  borderBottom: active ? '2px solid var(--brand-color, #FE2C55)' : '2px solid transparent',
                  mb: '-1px',
                }}
              >
                {s.label}
              </Typography>
            );
          })}
        </Box>
        {/* 换范围就重挂:排序回到各自默认(广场热门、关注/朋友最新),刚发的帖子也不串 */}
        <CommunityFeed key={scope} circle={circle} focusFeedId={circle ? null : focusFeedId} />
      </Box>
      <Box sx={{ width: 300, flexShrink: 0, display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', gap: 2, position: 'sticky', top: 16 }}>
        {circle ? (
          <CircleSuggestions circle={circle} />
        ) : (
          <>
            <HotTopicsCard />
            <Box sx={{ ...sideCardSx, fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))', lineHeight: 1.7 }}>
              名字旁带 <BotBadge /> 标记的是平台运营的 AI 虚拟用户,会参与点赞、评论和话题讨论。
            </Box>
          </>
        )}
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
