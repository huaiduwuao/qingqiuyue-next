'use client';

/**
 * 实现 —— 验收通过的交付。
 *
 * 一条实现只由验收动作产生(需求方在任务上点"通过"的那一刻),所以这里没有"新建实现":
 * 想要一条实现,去赏金广场认领任务、交付、等验收。结账后这里会写上分到的金额。
 *
 * 取代的是模板生成的「实现」页:那一页是一张可以随手新建、和需求与钱都不相干的表。
 */

import React, { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useApp } from '@/contexts/AppContext';
import RealizationList from '@/components/reward/RealizationList';
import { listRealizations, myTeams } from '@/apis/team';

const PAGE_SIZE = 12;

export default function RealizationPage() {
  const { currentUser } = useApp();
  const me = Number(currentUser?.id ?? 0);
  /** 'me' = 我交付的;数字 = 某支我所在的团队 */
  const [scope, setScope] = useState<string>('me');

  const teams = useQuery({
    queryKey: ['team', 'mine', 'active'],
    queryFn: () => myTeams().then((r) => (r.list || []).filter((t) => t.myStatus === 'active')),
    enabled: me > 0,
  });

  // 无限滚动:滚到底自动翻页
  const list = useInfiniteQuery({
    queryKey: ['realization', scope, me],
    queryFn: ({ pageParam }) => listRealizations({ ...(scope === 'me' ? { userId: me } : { teamId: Number(scope) }), page: pageParam, pageSize: PAGE_SIZE })
      .then((r) => ({ ...r, page: pageParam as number })),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * PAGE_SIZE < (last.total ?? 0) ? last.page + 1 : undefined),
    enabled: me > 0,
  });
  const items = list.data?.pages.flatMap((p) => p.list) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;

  // 滚动到底自动加载下一页
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  React.useEffect(() => {
    const el = sentinelRef.current;
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700 }}>实现</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            验收通过的交付。带作品的交付会同时出现在需求所在的意境里;需求结账后这里显示分到的金额。
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          sx={{ minWidth: 180 }}
          slotProps={{ htmlInput: { 'aria-label': '范围' } }}
        >
          <MenuItem value="me">我交付的</MenuItem>
          {(teams.data || []).map((t) => (
            <MenuItem key={t.id} value={String(t.id)}>
              团队 · {t.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {me ? (
        <RealizationList
          items={items}
          empty={list.isFetching ? '加载中…' : scope === 'me' ? '还没有验收通过的交付。去赏金广场认领一个任务试试。' : '这支团队还没有验收通过的交付'}
        />
      ) : (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>登录后查看</Typography>
      )}

      <Box ref={sentinelRef} sx={{ height: 1 }} />
      {list.isFetchingNextPage && (
        <Typography sx={{ textAlign: 'center', py: 2, fontSize: 12, color: 'text.secondary' }}>加载中…</Typography>
      )}
      {!hasNextPage && items.length > 0 && (
        <Typography sx={{ textAlign: 'center', py: 2, fontSize: 12, color: 'text.disabled' }}>- 没有更多了 -</Typography>
      )}
    </Box>
  );
}
