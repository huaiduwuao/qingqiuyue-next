'use client';

// 首页「直播」频道 —— 跨平台直播目录。
//
// 平台不转播直播:这里收录虎牙 / 斗鱼 / B站 上的直播间,帮人决定看什么,想看就去原站。
// 页面从上到下按「挑直播」的顺序组织:
//   1. 头部:此刻多少间在播、各平台在播数(切平台)
//   2. 分区条:按统一分区筛选(游戏/娱乐/音乐/…,附在播数)
//   3. 焦点:此刻人气 No.1 大卡 + No.2–5,右侧人气榜(此刻/今日/本周)
//   4. 分区热播:每个分区此刻最热的房间(只在「全部分区」时出现)
//   5. 往期高光:已结束场次按峰值人气排
//   6. 全部直播间:状态 + 排序 + 无限滚动
// 数据说明见 panels/live/liveApi.ts。

import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import { useContentNavigate } from '@/lib/contentRoute';
import { SECTION_TINT } from '@/constants/gradients';
import {
  type ClassicRange,
  type LiveClassic,
  type LiveFilters,
  type LiveRoom,
  type LiveSort,
  type LiveStatus,
  fetchClassics,
  fetchOverview,
  fetchRank,
  fetchRooms,
  formatAgo,
  formatDay,
} from './live/liveApi';
import { CoverSkeleton, EmptyNote, LiveDot, PlatformBadge, SectionHeader, Segmented } from './live/LiveBits';
import { CategoryCard, ClassicCard, RoomCard, RunnerUpCard, SpotlightCard } from './live/LiveCards';
import { LiveRankBoard } from './live/LiveRankBoard';
import { ListLayout, ListLayoutSwitch } from '@/components/common/ListLayout';

const PAGE_SIZE = 16;

const STATUSES: { key: LiveStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'live', label: '直播中' },
  { key: 'offline', label: '未开播' },
];

const SORTS: { key: LiveSort; label: string }[] = [
  { key: 'hot', label: '人气最高' },
  { key: 'new', label: '刚刚开播' },
];

const RANGES: { key: ClassicRange; label: string }[] = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '全部' },
];

// 只给加载骨架用;列表本身走 ListLayout
const ROOM_GRID = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(1, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' },
  gap: { xs: 2, md: 2.5 },
} as const;

/** 当前时间(unix 秒),每分钟走一次,用于「已播 N 小时」「N 分钟前更新」。 */
function useNowSeconds() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function LivePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const now = useNowSeconds();
  const listRef = useRef<HTMLDivElement>(null);

  const platform = searchParams.get('platform') || 'all';
  const category = searchParams.get('category') || 'all';
  const status = (searchParams.get('liveStatus') as LiveStatus) || 'all';
  const sort = (searchParams.get('sort') as LiveSort) || 'hot';
  const filters: LiveFilters = { platform, category };

  const setParams = (next: Record<string, string>, defaults: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === defaults[k]) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const DEFAULTS = { platform: 'all', category: 'all', liveStatus: 'all', sort: 'hot' };
  const setPlatform = (v: string) => setParams({ platform: v }, DEFAULTS);
  const setCategory = (v: string) => setParams({ category: v }, DEFAULTS);
  const setStatus = (v: LiveStatus) => setParams({ liveStatus: v }, DEFAULTS);
  const setSort = (v: LiveSort) => setParams({ sort: v }, DEFAULTS);

  const openRoom = (id: LiveRoom['id']) => navigate('LIVE', id);

  const overview = useQuery({
    queryKey: ['home', 'live', 'overview', platform],
    queryFn: () => fetchOverview(platform),
    staleTime: 60_000,
  });

  const spotlight = useQuery({
    // 与人气榜「此刻」同一个查询(同 key 同参数),只请求一次。
    queryKey: ['home', 'live', 'rank', 'now', platform, category],
    queryFn: () => fetchRank('now', filters, 10),
    staleTime: 60_000,
  });

  // 还没有人气数据时(新抓取未到 / 源站不给在线数),焦点区退回展示正在直播的房间,不排名。
  const spotlightEmpty = spotlight.isSuccess && (spotlight.data?.list?.length ?? 0) === 0;
  const liveNow = useQuery({
    queryKey: ['home', 'live', 'rooms', 'live-now', platform, category],
    queryFn: () => fetchRooms({ ...filters, status: 'live', sort: 'hot' }, 1, 5),
    enabled: spotlightEmpty,
    staleTime: 60_000,
  });

  const [range, setRange] = useState<ClassicRange>('month');
  const classics = useQuery({
    queryKey: ['home', 'live', 'classics', range, platform, category],
    queryFn: () => fetchClassics(range, filters, 12),
    staleTime: 5 * 60_000,
  });

  const rooms = useInfiniteQuery({
    queryKey: ['home', 'live', 'rooms', platform, category, status, sort],
    queryFn: ({ pageParam }) => fetchRooms({ ...filters, status, sort }, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < (last?.total ?? 0) && (last?.list?.length ?? 0) > 0 ? pages.length + 1 : undefined),
  });
  const roomList = rooms.data?.pages.flatMap((p) => p?.list ?? []) ?? [];
  const roomTotal = rooms.data?.pages[0]?.total ?? 0;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = rooms;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const ov = overview.data;
  const categories = ov?.categories ?? [];
  const activeCategory = categories.find((c) => c.key === category);
  const platformLive = new Map((ov?.platforms ?? []).map((p) => [p.key, p.live]));
  const livePlatformsTotal = (ov?.platforms ?? []).reduce((s, p) => s + p.live, 0);

  const pickCategory = (key: string) => {
    setCategory(key);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const ranked = (spotlight.data?.list?.length ?? 0) > 0;
  const spot = ranked ? spotlight.data!.list : liveNow.data?.list ?? [];
  const showcase = categories.filter((c) => c.live > 0);

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 1.5, md: 2.5 }, maxWidth: 1600, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
      {/* 1. 头部 */}
      <Box
        component="header"
        sx={{
          mb: 2,
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          background: SECTION_TINT.RED_YELLOW_PURPLE,
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.5, flexShrink: 0, background: 'linear-gradient(135deg, #FE2C55, #FF8A3D)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(254,44,85,0.3)' }}>
            <LiveTvRoundedIcon sx={{ fontSize: 24, color: '#fff' }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              直播
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {ov ? (
                <>
                  <LiveDot label={`${ov.live} 间正在直播`} />
                  <span>· 收录 {ov.total} 间</span>
                  {ov.updatedAt > 0 && <span>· {formatAgo(ov.updatedAt, now)}更新</span>}
                </>
              ) : (
                <Skeleton width={220} />
              )}
            </Box>
            <Typography sx={{ fontSize: 11.5, color: 'var(--text-muted)', mt: 0.25 }}>汇集虎牙、斗鱼、B站的直播间,点进详情可跳转原平台观看</Typography>
          </Box>
        </Box>
        <Segmented
          ariaLabel="直播平台"
          value={platform}
          onChange={setPlatform}
          options={[
            { key: 'all', label: <span>全部平台{ov ? ` ${livePlatformsTotal}` : ''}</span> },
            ...(ov?.platforms ?? []).map((p) => ({
              key: p.key,
              label: (
                <Box component="span" sx={{ display: 'inline-flex', gap: 0.5 }}>
                  <PlatformBadge platform={p.key} label={p.label} />
                  <Box component="span" sx={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{platformLive.get(p.key) ?? 0}</Box>
                </Box>
              ),
            })),
          ]}
        />
      </Box>

      {/* 2. 分区条 */}
      <Box
        role="tablist"
        aria-label="直播分区"
        sx={{
          display: 'flex',
          gap: 1,
          mb: 2.5,
          overflowX: 'auto',
          pb: 0.5,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {[{ key: 'all', label: '全部分区', live: ov?.live ?? 0 }, ...categories].map((c) => {
          const active = c.key === category;
          return (
            <Box
              key={c.key}
              component="button"
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(c.key)}
              sx={{
                all: 'unset',
                boxSizing: 'border-box',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.75,
                py: 0.75,
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                color: active ? '#fff' : 'var(--text-secondary)',
                bgcolor: active ? 'var(--brand-color, #FE2C55)' : 'var(--bg-input)',
                border: '1px solid',
                borderColor: active ? 'transparent' : 'var(--border-color)',
                transition: 'background-color .15s, color .15s',
                '&:hover': { color: active ? '#fff' : 'var(--text-primary)', bgcolor: active ? 'var(--brand-color, #FE2C55)' : 'var(--bg-active)' },
                '&:focus-visible': { boxShadow: '0 0 0 2px var(--brand-color, #FE2C55)' },
              }}
            >
              {c.label}
              {ov && (
                <Box component="span" sx={{ fontSize: 11.5, fontWeight: 600, opacity: active ? 0.85 : 0.6, fontVariantNumeric: 'tabular-nums' }}>
                  {c.live}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* 3. 焦点 + 人气榜 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.75fr) minmax(320px, 1fr)' }, gap: 2.5, mb: 4 }}>
        <Box component="section" aria-label="此刻最热" sx={{ minWidth: 0 }}>
          {spotlight.isLoading || (spotlightEmpty && liveNow.isLoading) ? (
            <>
              <CoverSkeleton />
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1.5, mt: 1.5 }}>
                {Array.from({ length: 4 }).map((_, i) => <CoverSkeleton key={i} />)}
              </Box>
            </>
          ) : spot.length === 0 ? (
            <EmptyNote minHeight={280}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', mb: 0.5 }}>
                {activeCategory ? `${activeCategory.label}分区` : '这里'}此刻没有正在直播的房间
              </Typography>
              直播状态每小时随各平台抓取更新;可以在下方「往期高光」和「全部直播间」里看看。
            </EmptyNote>
          ) : (
            <>
              <SpotlightCard room={spot[0]} now={now} ranked={ranked} onOpen={() => openRoom(spot[0].id)} />
              {spot.length > 1 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5, mt: 1.5 }}>
                  {spot.slice(1, 5).map((r) => (
                    <RunnerUpCard key={String(r.id)} room={r} onOpen={() => openRoom(r.id)} />
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
        <LiveRankBoard filters={filters} onOpen={(r) => openRoom(r.id)} />
      </Box>

      {/* 4. 分区热播 */}
      {category === 'all' && showcase.length > 1 && (
        <Box component="section" sx={{ mb: 4 }}>
          <SectionHeader
            title="分区热播"
            icon={<CategoryRoundedIcon sx={{ fontSize: 20, color: '#8B5CF6' }} />}
            hint="每个分区此刻人气最高的直播间"
          />
          <ListLayout minColumnWidth={180} minColumns={2} gap={12}>
            {showcase.map((c) => (
              <CategoryCard key={c.key} facet={c} active={false} onSelect={() => pickCategory(c.key)} />
            ))}
          </ListLayout>
        </Box>
      )}

      {/* 5. 往期高光 */}
      <Box component="section" sx={{ mb: 4 }}>
        <SectionHeader
          title="往期高光"
          icon={<HistoryRoundedIcon sx={{ fontSize: 20, color: '#FFB400' }} />}
          hint="已结束的直播,按当场最高人气排序"
          action={<Segmented ariaLabel="往期范围" size="sm" value={range} options={RANGES} onChange={setRange} />}
        />
        <ClassicsRow
          loading={classics.isLoading}
          list={classics.data?.list ?? []}
          since={classics.data?.since ?? 0}
          onOpen={(c) => openRoom(c.contentId)}
        />
      </Box>

      {/* 6. 全部直播间 */}
      <Box component="section" ref={listRef} sx={{ scrollMarginTop: 16 }}>
        <SectionHeader
          title={`${activeCategory ? activeCategory.label : '全部'}直播间`}
          icon={<GridViewRoundedIcon sx={{ fontSize: 20, color: '#06B6D4' }} />}
          hint={rooms.isLoading ? '' : `共 ${roomTotal} 间`}
          action={
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Segmented
                ariaLabel="开播状态"
                size="sm"
                value={sort === 'new' ? 'live' : status}
                onChange={setStatus}
                options={STATUSES.map((s) => ({ ...s, disabled: sort === 'new' && s.key !== 'live' }))}
              />
              <Segmented
                ariaLabel="排序"
                size="sm"
                value={sort}
                onChange={setSort}
                options={SORTS.map((s) => ({ ...s, label: s.key === 'hot' ? <><WhatshotRoundedIcon sx={{ fontSize: 13, verticalAlign: '-2px', mr: 0.25 }} />{s.label}</> : s.label }))}
              />
              <ListLayoutSwitch />
            </Box>
          }
        />
        {rooms.isLoading ? (
          <Box sx={ROOM_GRID}>
            {Array.from({ length: 8 }).map((_, i) => <CoverSkeleton key={i} />)}
          </Box>
        ) : rooms.isError ? (
          <EmptyNote>
            直播间加载失败,
            <Box component="button" type="button" onClick={() => rooms.refetch()} sx={{ all: 'unset', cursor: 'pointer', color: 'var(--brand-color)', fontWeight: 600 }}>
              重试
            </Box>
          </EmptyNote>
        ) : roomList.length === 0 ? (
          <EmptyNote>
            {sort === 'new' ? '开播时间从今天开始记录,暂时没有刚开播的房间。' : '这个筛选下暂时没有直播间,换个分区或平台看看。'}
          </EmptyNote>
        ) : (
          <ListLayout minColumnWidth={260} gap={16}>
            {roomList.map((r) => (
              <RoomCard key={String(r.id)} room={r} now={now} onOpen={() => openRoom(r.id)} />
            ))}
          </ListLayout>
        )}
        {isFetchingNextPage && (
          <Typography sx={{ textAlign: 'center', py: 2, color: 'var(--text-muted)', fontSize: 12 }}>加载中…</Typography>
        )}
        {!rooms.isLoading && !hasNextPage && roomList.length > 0 && (
          <Typography sx={{ textAlign: 'center', py: 3, color: 'var(--text-disabled)', fontSize: 12 }}>已经到底了</Typography>
        )}
        <Box ref={sentinelRef} sx={{ height: 1 }} />
      </Box>
    </Box>
  );
}

function ClassicsRow({ loading, list, since, onOpen }: { loading: boolean; list: LiveClassic[]; since: number; onOpen: (c: LiveClassic) => void }) {
  const row = {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: { xs: '78%', sm: '42%', md: '30%', xl: '22%' },
    gap: 2,
    overflowX: 'auto',
    pb: 1,
    scrollSnapType: 'x mandatory',
    '& > *': { scrollSnapAlign: 'start' },
  } as const;
  if (loading) {
    return (
      <Box sx={row}>
        {Array.from({ length: 4 }).map((_, i) => <CoverSkeleton key={i} />)}
      </Box>
    );
  }
  if (list.length === 0) {
    return (
      <EmptyNote>
        {since
          ? `从 ${formatDay(since)} 开始记录直播场次,这个范围里还没有结束的场次。`
          : '直播场次从今天开始记录:主播下播后,这一场的开播时间、时长和最高人气会出现在这里。'}
      </EmptyNote>
    );
  }
  return (
    <Box sx={row}>
      {list.map((c) => (
        <ClassicCard key={String(c.id)} item={c} onOpen={() => onOpen(c)} />
      ))}
    </Box>
  );
}
