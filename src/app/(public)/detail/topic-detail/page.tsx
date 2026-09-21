'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { fetchTopic, fetchTopicContents, fetchTopicInsights, type CommunityTopic, type TopicContentItem } from '@/apis/community';
import { isApiError } from '@/lib/api/client';
import { getDetailRoute } from '@/lib/contentRoute';
import { CoverImage } from '@/components/common/CoverImage';
import DetailHeader from '@/components/detail/DetailHeader';
import { ListLayout, LIST_ROW } from '@/components/common/ListLayout';
import { CommunityFeed } from '@/components/community/CommunityFeed';
import { TopicFollowButton } from '@/components/community/TopicFollowButton';
import { TopicInsightSection } from '@/components/community/topic';
import RealmCollab, { type RealmCollabTab } from '@/components/reward/RealmCollab';
import { CONTENT_TYPE_LABEL, TOPIC_KIND_LABEL, compactCount, topicGradient } from '@/components/community/format';
import ShareButtons from '@/components/share/ShareButtons';
import { useAuth, useAuthority } from '@/contexts/AuthContext';

export default function TopicDetailPage() {
  return (
    <Suspense fallback={null}>
      <TopicDetail />
    </Suspense>
  );
}

function TopicDetail() {
  const router = useRouter();
  const id = useSearchParams().get('id');
  const { user } = useAuth();
  const { isAdmin, roles } = useAuthority();
  const isStaff = isAdmin || roles.includes('OPERATOR') || roles.includes('AUDITOR');
  const { data: topic, isLoading, isError, error } = useQuery({ queryKey: ['community', 'topic', id], queryFn: () => fetchTopic(id as string), enabled: !!id, retry: false });
  // 专题的结构化洞察(lineups / versionHistory)。空数组时 TopicInsightSection 内部 return null,
  // 非 TFT 专题完全不渲染。staleTime 5min:tft.composition 子分类更新频率不高,刷新一次够用。
  const { data: insightsData } = useQuery({
    queryKey: ['community', 'topic-insights', id],
    queryFn: () => fetchTopicInsights(id as string),
    enabled: !!id && !isLoading,
    staleTime: 5 * 60_000,
    retry: false,
  });
  // 合集默认看作品,话题默认看讨论;用户切过页签/点过关注后以用户操作为准
  const [tabChoice, setTab] = useState<'contents' | 'posts' | RealmCollabTab | null>(null);
  const [followersOverride, setFollowers] = useState<number | null>(null);
  const tab = tabChoice ?? (topic?.kind === 'collection' && topic.hasContents ? 'contents' : 'posts');
  const followers = followersOverride ?? topic?.followerCount ?? 0;
  // 展现形式模板:聚合流(5-tab)可被关闭。templates 为空/未定义 → 默认开启(存量零回归);
  // 非空则按是否含 aggregateFeed 决定渲染 Tabs。叙事/卡片等板块由 TopicInsightSection 渲染。
  const templates = topic?.templates;
  const showAggregateFeed = !templates || templates.length === 0 || templates.includes('aggregateFeed');

  const back = () => (window.history.length > 1 ? router.back() : router.push('/home/recommend?tab=topic'));

  // IntersectionObserver 监听 Hero 末尾的 sentinel:滚出 Hero 后,顶部条由 transparent 切到玻璃态
  // 默认 heroVisible=true(transparent),与今天 Hero 内嵌返回按钮的视觉一致;水合后 IO 接管
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  useEffect(() => {
    const el = heroSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: '-1px 0px 0px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Skeleton variant="rounded" height={200} />
        <Skeleton variant="text" width="40%" sx={{ mt: 2 }} />
      </Container>
    );
  }
  if (!id || isError || !topic) {
    // 私密意境走的是 403(存在,但只有管理员可见),和「不存在」分开显示:
    // 从需求、团队、动态等引用点进来的用户不该以为自己点了个被删的意境。
    const forbidden = isApiError(error) && error.status === 403;
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          {forbidden ? '这个意境仅管理员可见' : '意境不存在或已停用'}
        </Typography>
        {forbidden && (
          <Typography sx={{ fontSize: 13, opacity: 0.7, mb: 2 }}>
            它已被设为私密合集,当前账号没有查看权限。
          </Typography>
        )}
        <Button variant="contained" onClick={() => router.push('/home/recommend?tab=topic')}>去看看其他意境</Button>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'var(--bg-body, transparent)', color: 'var(--text-primary, inherit)', pb: 6 }}>
      <DetailHeader
        variant="transparent"
        forceSolid={!heroVisible}
        title={topic.title}
        onBack={back}
      />
      <Hero topic={topic} followers={followers} onFollowChange={setFollowers} canManage={isStaff || !!(user?.id && topic.owner && String(topic.owner.id) === String(user.id))} />
      {/* 1px sentinel:位于 Hero 末尾,IntersectionObserver 用它判断 Hero 是否仍在视口内 */}
      <div ref={heroSentinelRef} style={{ height: 1 }} aria-hidden />
      <Container maxWidth="md" sx={{ mt: 1 }}>
        {showAggregateFeed && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
            {topic.hasContents && <Tab value="contents" label="作品" />}
            <Tab value="posts" label={`讨论 ${topic.postCount ? compactCount(topic.postCount) : ''}`} />
            {/* 意境和交易、和人群的接口:发在这里的悬赏、验收通过的交付、把这里当主场的团队 */}
            <Tab value="demands" label="需求" />
            <Tab value="realizations" label="实现" />
            <Tab value="teams" label="团队" />
          </Tabs>
        )}
        {/* 专题洞察 / 展现形式板块:lineups / versionHistory / narrativeWorld / cardArchive。
            放在 Tabs 之后、tab 内容上方;聚合流关闭时,这里是 Hero 之下唯一的内容区。
            insightsData 空数组 → TopicInsightSection 内部 null,非 TFT 专题无视觉噪音。 */}
        {(insightsData?.insights ?? []).length > 0 && (
          <Box sx={{ mb: 2 }}>
            {insightsData!.insights.map((ins) => (
              <TopicInsightSection key={ins.kind} insight={ins} />
            ))}
          </Box>
        )}
        {showAggregateFeed && (
          tab === 'demands' || tab === 'realizations' || tab === 'teams' ? (
            <RealmCollab topicId={Number(topic.id)} tab={tab} />
          ) : tab === 'contents' && topic.hasContents ? (
            <TopicContents topicId={topic.id} />
          ) : (
            <CommunityFeed topic={{ id: topic.id, title: topic.title, kind: topic.kind }} />
          )
        )}
      </Container>
    </Box>
  );
}

function Hero({ topic, followers, onFollowChange, canManage }: { topic: CommunityTopic; followers: number; onFollowChange: (n: number) => void; canManage: boolean }) {
  const router = useRouter();
  const bg = topic.cover ? `linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.75)), center/cover url(${topic.cover})` : topicGradient(topic.title);
  return (
    <Box sx={{ background: bg, color: '#fff' }}>
      {/* 这块彩色头图是页面第一个元素,客户端里会铺到状态栏下面,所以顶部要加安全区 */}
      <Container maxWidth="md" sx={{ pt: 'calc(16px + var(--sat, 0px))', pb: 3 }}>
        {/* 返回按钮已搬到页面顶部的 DetailHeader(Hero 内不再重复),滚动到任意位置都能一键返回 */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, flexWrap: 'wrap' }}>
              <Chip size="small" label={TOPIC_KIND_LABEL[topic.kind] || '意境'} sx={{ height: 20, fontSize: 11, color: '#fff', bgcolor: 'rgba(255,255,255,0.2)' }} />
              {topic.official ? (
                <Chip size="small" icon={<VerifiedRoundedIcon sx={{ fontSize: 13, color: '#fff !important' }} />} label="官方" sx={{ height: 20, fontSize: 11, color: '#fff', bgcolor: 'rgba(91,141,239,0.55)' }} />
              ) : topic.owner ? (
                <Typography sx={{ fontSize: 11, opacity: 0.85 }}>由 {topic.owner.name} 主理</Typography>
              ) : null}
              {canManage && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => router.push(`/account/realm/${topic.id}/manage`)}
                  sx={{ height: 22, fontSize: 11, color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
                >
                  管理
                </Button>
              )}
            </Box>
            <Typography sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 900, lineHeight: 1.2 }}>
              {topic.kind === 'topic' ? `#${topic.title}#` : topic.title}
            </Typography>
            {topic.subtitle && <Typography sx={{ fontSize: 14, opacity: 0.9, mt: 0.75 }}>{topic.subtitle}</Typography>}
            {topic.description && <Typography sx={{ fontSize: 13, opacity: 0.8, mt: 1, whiteSpace: 'pre-wrap', maxWidth: 560 }}>{topic.description}</Typography>}
            <Typography sx={{ fontSize: 12, opacity: 0.85, mt: 1.25 }}>
              {compactCount(followers)} 关注 · {compactCount(topic.postCount)} 讨论 · {compactCount(topic.viewCount)} 浏览
            </Typography>
          </Box>
          <TopicFollowButton topicId={topic.id} following={topic.isFollowing} size="medium" onChange={(_, n) => onFollowChange(n)} />
          <ShareButtons
            contentType="topic"
            contentId={Number(topic.id)}
            title={topic.title}
            url={typeof window !== 'undefined' ? window.location.href : ''}
            cover={topic.cover}
            desc={topic.description || topic.subtitle}
            subtitle={topic.subtitle}
            topicId={String(topic.id)}
          />
        </Box>
      </Container>
    </Box>
  );
}

function TopicContents({ topicId }: { topicId: string | number }) {
  const router = useRouter();
  const q = useInfiniteQuery({
    queryKey: ['community', 'topic-contents', String(topicId)],
    queryFn: ({ pageParam }) => fetchTopicContents(topicId, pageParam, 24),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const list: TopicContentItem[] = q.data?.pages.flatMap((p) => p.list) ?? [];
  if (q.isLoading) {
    return (
      <Box sx={gridSx}>
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="rounded" height={170} />)}
      </Box>
    );
  }
  if (list.length === 0) {
    return <Typography sx={{ py: 6, textAlign: 'center', fontSize: 13, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>这个合集还没有作品</Typography>;
  }
  return (
    <>
      <ListLayout minColumnWidth={170} gap={12} listMaxWidth="none">
        {list.map((c) => (
          <Box
            key={String(c.id)}
            onClick={() => {
              const r = getDetailRoute(c.contentType, c.id);
              if (r) router.push(r);
            }}
            sx={{ cursor: 'pointer', borderRadius: 2, overflow: 'hidden', bgcolor: 'var(--bg-card, rgba(20,22,32,0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))', transition: 'transform .2s', '&:hover': { transform: 'translateY(-2px)' }, [LIST_ROW]: { display: 'flex', alignItems: 'stretch' } }}
          >
            <Box sx={{ position: 'relative', aspectRatio: '16/10', [LIST_ROW]: { width: { xs: 120, sm: 200 }, flexShrink: 0 } }}>
              <CoverImage src={c.cover} alt={c.title} sx={{ width: '100%', height: '100%' }} />
              {c.pinned && <Chip size="small" label="精选" sx={{ position: 'absolute', top: 6, left: 6, height: 18, fontSize: 10, fontWeight: 700, color: '#fff', bgcolor: 'var(--brand-color, #FE2C55)' }} />}
            </Box>
            <Box sx={{ p: 1.25, [LIST_ROW]: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #fff)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 36, [LIST_ROW]: { fontSize: 14, minHeight: 0 } }}>{c.title}</Typography>
              <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))', mt: 0.5 }}>
                {CONTENT_TYPE_LABEL[c.contentType] || c.contentType} · {compactCount(c.views)} 播放
              </Typography>
            </Box>
          </Box>
        ))}
      </ListLayout>
      {q.hasNextPage && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button size="small" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>加载更多</Button>
        </Box>
      )}
    </>
  );
}

const gridSx = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(170px, 100%), 1fr))', gap: 1.5 };
