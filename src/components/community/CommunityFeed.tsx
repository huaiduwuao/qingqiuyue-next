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
import { ListLayout, ListLayoutSwitch } from '@/components/common/ListLayout';

const PAGE_SIZE = 15;

type Sort = 'hot' | 'new';

/**
 * 动态流。四种用法:
 *  - 默认:广场(所有人)
 *  - topic:某个话题/专题下的讨论,发帖框预选该话题
 *  - userId:某个人的动态
 *  - circle:首页「动态」的「关注」「朋友」范围,只看关注的人 / 好友和自己的动态(发帖、发布作品、评论、点赞…)
 * 广场/关注/朋友的切换在 CommunityPanel 上;切换时换 key 重挂,排序回到各自的默认值。
 */
export function CommunityFeed({ topic, userId, focusFeedId, circle }: { topic?: TopicBrief; userId?: Id; focusFeedId?: string | null; circle?: 'follow' | 'friend' }) {
  const router = useRouter();
  const [sort, setSort] = useState<Sort>(topic || circle ? 'new' : 'hot');
  // 刚发出的帖子插在列表顶部;按列表 key 记,切换页签/排序后自然失效
  const [freshByKey, setFreshByKey] = useState<{ key: string; items: FeedItem[] }>({ key: '', items: [] });
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const notify: Notify = (msg, severity = 'success') => setSnack({ msg, severity });

  const mode: FeedTab = circle ?? (topic ? 'topic' : userId ? 'user' : 'square');
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
    enabled: !!focusFeedId && !topic && !userId && !circle,
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
      {/* 「关注」范围不含自己,发了也看不到,所以不放发帖框;「朋友」含自己 */}
      {!userId && circle !== 'follow' && !needLogin && <PostComposer presetTopic={topic} notify={notify} onPosted={addFresh} />}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ListLayoutSwitch />
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
        <Empty
          title={circle === 'friend' ? '登录后查看好友动态' : '登录后查看关注动态'}
          hint={circle === 'friend' ? '好友和你自己的新动态会出现在这里' : '你关注的人的新动态会出现在这里'}
        >
          <Button size="small" variant="contained" onClick={() => router.push('/user/login')} sx={{ borderRadius: 999, bgcolor: 'var(--brand-color, #FE2C55)' }}>登录</Button>
        </Empty>
      ) : items.length === 0 ? (
        circle === 'follow' ? (
          <Empty title="还没有关注动态" hint="你关注的人发帖、发布作品、评论和点赞,都会出现在这里" />
        ) : circle === 'friend' ? (
          <Empty title="朋友圈还没有动态" hint="你和好友发帖、发布作品、评论和点赞,都会出现在这里" />
        ) : (
          <Empty title={topic ? '这里还没有讨论' : '还没有人发帖'} hint="来发第一条吧" />
        )
      ) : (
        <ListLayout minColumnWidth={340}>
          {items.map((it) => <FeedCard key={String(it.id)} item={it} notify={notify} onDeleted={onDeleted} />)}
        </ListLayout>
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
