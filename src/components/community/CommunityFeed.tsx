'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { fetchFeed, fetchFeedItem, type FeedItem, type FeedTab, type Id, type TopicBrief } from '@/apis/community';
import { FeedCard, FeedCardSkeleton, type Notify } from './FeedCard';
import { PostComposer } from './PostComposer';

const PAGE_SIZE = 15;

type Sort = 'hot' | 'new';

/**
 * 动态流。三种用法:
 *  - 默认:广场 / 关注 两个页签(社区首页)
 *  - topic:某个话题/专题下的讨论,发帖框预选该话题
 *  - userId:某个人的动态
 */
export function CommunityFeed({ topic, userId, focusFeedId }: { topic?: TopicBrief; userId?: Id; focusFeedId?: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<'square' | 'following'>('square');
  const [sort, setSort] = useState<Sort>(topic ? 'new' : 'hot');
  // 刚发出的帖子插在列表顶部;按列表 key 记,切换页签/排序后自然失效
  const [freshByKey, setFreshByKey] = useState<{ key: string; items: FeedItem[] }>({ key: '', items: [] });
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const notify: Notify = (msg, severity = 'success') => setSnack({ msg, severity });

  const mode: FeedTab = topic ? 'topic' : userId ? 'user' : tab;
  const queryKey = ['community', 'feed', mode, sort, String(topic?.id ?? ''), String(userId ?? '')];
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchFeed({ tab: mode, sort, topicId: topic?.id, userId, page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const listKey = queryKey.join('|');
  const fresh = freshByKey.key === listKey ? freshByKey.items : [];
  const addFresh = (it: FeedItem) => setFreshByKey({ key: listKey, items: [it, ...fresh] });

  const focus = useQuery({
    queryKey: ['community', 'feed-one', focusFeedId],
    queryFn: () => fetchFeedItem(focusFeedId as string),
    enabled: !!focusFeedId && !topic && !userId,
    retry: false,
  });

  const items = useMemo(() => {
    const seen = new Set<string>(removed);
    if (focus.data) seen.add(String(focus.data.id));
    const out: FeedItem[] = [];
    for (const it of [...fresh, ...(data?.pages.flatMap((p) => p.list) ?? [])]) {
      const k = String(it.id);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, [data, fresh, removed, focus.data]);
  const needLogin = data?.pages[0]?.needLogin;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '300px' },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const onDeleted = (id: Id) => setRemoved((s) => new Set(s).add(String(id)));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {!userId && <PostComposer presetTopic={topic} notify={notify} onPosted={addFresh} />}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {!topic && !userId && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            {(['square', 'following'] as const).map((t) => (
              <Typography
                key={t}
                component="button"
                onClick={() => setTab(t)}
                sx={{
                  p: 0,
                  border: 0,
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: tab === t ? 800 : 500,
                  color: tab === t ? 'var(--text-primary, #fff)' : 'var(--text-secondary, rgba(255,255,255,0.55))',
                  borderBottom: tab === t ? '2px solid var(--brand-color, #FE2C55)' : '2px solid transparent',
                  pb: 0.25,
                }}
              >
                {t === 'square' ? '广场' : '关注'}
              </Typography>
            ))}
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        {(['hot', 'new'] as const).map((s) => (
          <Box
            key={s}
            onClick={() => setSort(s)}
            sx={{
              px: 1.25,
              py: 0.25,
              borderRadius: 999,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: sort === s ? 700 : 500,
              color: sort === s ? '#fff' : 'var(--text-secondary, rgba(255,255,255,0.6))',
              bgcolor: sort === s ? 'var(--brand-color, #FE2C55)' : 'transparent',
              border: '1px solid',
              borderColor: sort === s ? 'transparent' : 'var(--border-color, rgba(255,255,255,0.1))',
            }}
          >
            {s === 'hot' ? '热门' : '最新'}
          </Box>
        ))}
      </Box>

      {focus.data && <FeedCard key={`focus-${focus.data.id}`} item={focus.data} notify={notify} onDeleted={onDeleted} defaultOpenComments />}

      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <FeedCardSkeleton key={i} />)
      ) : isError ? (
        <Empty title="动态加载失败" hint="网络不太好,稍后再试">
          <Button size="small" onClick={() => refetch()}>重试</Button>
        </Empty>
      ) : needLogin ? (
        <Empty title="登录后查看关注动态" hint="你关注的人和话题的新动态会出现在这里">
          <Button size="small" variant="contained" onClick={() => router.push('/user/login')} sx={{ borderRadius: 999, bgcolor: 'var(--brand-color, #FE2C55)' }}>登录</Button>
        </Empty>
      ) : items.length === 0 ? (
        mode === 'following' ? (
          <Empty title="还没有关注动态" hint="关注感兴趣的人和话题,他们的新动态会出现在这里">
            <Button size="small" onClick={() => router.push('/home/recommend?tab=topic')}>去逛逛话题</Button>
          </Empty>
        ) : (
          <Empty title={topic ? '这里还没有讨论' : '还没有人发帖'} hint="来发第一条吧" />
        )
      ) : (
        items.map((it) => <FeedCard key={String(it.id)} item={it} notify={notify} onDeleted={onDeleted} />)
      )}

      {isFetchingNextPage && <FeedCardSkeleton />}
      <Box ref={sentinel} sx={{ height: 1 }} />
      {!isLoading && items.length > 0 && !hasNextPage && (
        <Typography sx={{ textAlign: 'center', py: 2, fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.35))' }}>- 没有更多了 -</Typography>
      )}

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snack?.severity ?? 'success'} variant="filled" sx={{ width: '100%' }}>{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

function Empty({ title, hint, children }: { title: string; hint: string; children?: React.ReactNode }) {
  return (
    <Box sx={{ py: 6, textAlign: 'center', borderRadius: 2, border: '1px dashed var(--border-color, rgba(255,255,255,0.1))' }}>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{title}</Typography>
      <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.45))', mt: 0.5, mb: children ? 1.5 : 0 }}>{hint}</Typography>
      {children}
    </Box>
  );
}
