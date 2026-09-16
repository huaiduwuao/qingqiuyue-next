'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputBase from '@mui/material/InputBase';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTopics, type CommunityTopic } from '@/apis/community';
import { TopicFollowButton } from './TopicFollowButton';
import { compactCount, topicGradient, topicHref } from './format';

/** 首页「专题」页签:我关注的 / 热门话题 / 精选合集 */
export function TopicHub() {
  const { isAuthenticated } = useAuth();
  const [q, setQ] = useState('');
  const [keyword, setKeyword] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setKeyword(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const mine = useQuery({
    queryKey: ['community', 'topics', 'mine'],
    queryFn: () => fetchTopics({ following: true, size: 30 }),
    enabled: isAuthenticated && !keyword,
  });
  const hot = useQuery({
    queryKey: ['community', 'topics', 'hot', keyword],
    queryFn: () => fetchTopics({ kind: 'topic', sort: 'hot', keyword, size: 12 }),
  });
  const collections = useInfiniteQuery({
    queryKey: ['community', 'topics', 'collections', keyword],
    queryFn: ({ pageParam }) => fetchTopics({ kind: 'collection', sort: 'hot', keyword, page: pageParam, size: 12 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const collectionList = collections.data?.pages.flatMap((p) => p.list) ?? [];

  return (
    <Box sx={{ px: { xs: 1.5, md: 3 }, py: 2, maxWidth: 'var(--page-max)', mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, background: 'linear-gradient(135deg, #FF8A3D 0%, #FE2C55 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CollectionsRoundedIcon sx={{ fontSize: 19, color: '#fff' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>专题</Typography>
          <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>按主题聚合的好内容,和一起聊它们的人</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, borderRadius: 999, width: { xs: '100%', sm: 260 }, bgcolor: 'var(--bg-input, rgba(255,255,255,0.06))' }}>
          <SearchRoundedIcon sx={{ fontSize: 17, color: 'var(--text-muted, rgba(255,255,255,0.45))' }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索专题或话题" sx={{ flex: 1, fontSize: 13, color: 'var(--text-primary, #fff)' }} />
        </Box>
      </Box>

      {!keyword && (mine.data?.list.length ?? 0) > 0 && (
        <Section title="我关注的">
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {mine.data!.list.map((t) => (
              <Box key={String(t.id)} component={Link} href={topicHref(t.id)} sx={pillSx}>
                {t.kind === 'topic' ? `#${t.title}` : t.title}
              </Box>
            ))}
          </Box>
        </Section>
      )}

      <Section title="热门话题" hint="写 #话题名# 发帖即可参与,没有的话题会自动创建">
        {hot.isLoading ? (
          <Grid min={220}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={76} />)}</Grid>
        ) : (hot.data?.list.length ?? 0) === 0 ? (
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>没有找到相关话题</Typography>
        ) : (
          <Grid min={220}>
            {hot.data!.list.map((t, i) => <TopicTile key={String(t.id)} topic={t} rank={keyword ? undefined : i + 1} />)}
          </Grid>
        )}
      </Section>

      <Section title="精选合集">
        {collections.isLoading ? (
          <Grid min={240}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={190} />)}</Grid>
        ) : collectionList.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>没有找到相关合集</Typography>
        ) : (
          <>
            <Grid min={240}>{collectionList.map((t) => <CollectionCard key={String(t.id)} topic={t} />)}</Grid>
            {collections.hasNextPage && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button size="small" disabled={collections.isFetchingNextPage} onClick={() => collections.fetchNextPage()}>加载更多</Button>
              </Box>
            )}
          </>
        )}
      </Section>
    </Box>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}</Typography>
        {hint && <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>{hint}</Typography>}
      </Box>
      {children}
    </Box>
  );
}

function Grid({ min, children }: { min: number; children: React.ReactNode }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`, gap: 1.5 }}>{children}</Box>;
}

function TopicTile({ topic, rank }: { topic: CommunityTopic; rank?: number }) {
  return (
    <Box component={Link} href={topicHref(topic.id)} sx={{ ...cardSx, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.25, textDecoration: 'none' }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 1.5, flexShrink: 0, background: topic.cover ? `center/cover url(${topic.cover})` : topicGradient(topic.title), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>
        {topic.cover ? null : '#'}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {rank && <Box component="span" sx={{ color: rank <= 3 ? 'var(--brand-color, #FE2C55)' : 'inherit', mr: 0.5 }}>{rank}.</Box>}#{topic.title}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {topic.subtitle || `${compactCount(topic.postCount)} 讨论 · ${compactCount(topic.followerCount)} 关注`}
        </Typography>
      </Box>
      <TopicFollowButton topicId={topic.id} following={topic.isFollowing} />
    </Box>
  );
}

function CollectionCard({ topic }: { topic: CommunityTopic }) {
  return (
    <Box component={Link} href={topicHref(topic.id)} sx={{ ...cardSx, overflow: 'hidden', textDecoration: 'none', transition: 'transform .2s', '&:hover': { transform: 'translateY(-2px)' } }}>
      <Box sx={{ height: 110, position: 'relative', background: topic.cover ? `center/cover url(${topic.cover})` : topicGradient(topic.title) }}>
        {!topic.cover && (
          <Typography sx={{ position: 'absolute', left: 14, bottom: 10, right: 14, fontSize: 20, fontWeight: 900, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>{topic.title}</Typography>
        )}
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topic.title}</Typography>
          {topic.official && <VerifiedRoundedIcon sx={{ fontSize: 14, color: '#5B8DEF' }} />}
        </Box>
        <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, rgba(255,255,255,0.6))', mt: 0.25, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {topic.subtitle || topic.description || ' '}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))', flex: 1 }}>
            {compactCount(topic.followerCount)} 关注 · {compactCount(topic.postCount)} 讨论
          </Typography>
          <TopicFollowButton topicId={topic.id} following={topic.isFollowing} />
        </Box>
      </Box>
    </Box>
  );
}

const cardSx = {
  borderRadius: 2,
  bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
  border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
};

const pillSx = {
  px: 1.5,
  py: 0.5,
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
  color: 'var(--text-primary, #fff)',
  bgcolor: 'var(--bg-card, rgba(255,255,255,0.06))',
  border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
  '&:hover': { borderColor: 'var(--brand-color, #FE2C55)' },
};
