'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { homeClient } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { useContentNavigate } from '@/lib/contentRoute';
import { IMAGE_OVERLAY, MEDAL, SECTION_TINT, gradient2 } from '@/constants/gradients';
import { useScrollToBottom } from '@/hooks/useInfiniteScroll';

type LiveStatus = 'all' | 'live' | 'offline';
type LiveSort = 'hot' | 'new';
type LiveCategory = 'all' | 'knowledge' | 'game' | 'music' | 'outdoor' | 'anime';

type Room = {
  id: number;
  hostId: number;
  hostName: string;
  hostAvatar: string;
  title: string;
  cover: string;
  viewers: number;
  category: string;
  region: string;
  startedAt: number;
  isLive: boolean;
  isTop: boolean;
  hotRank: number;
};

type Resp = { list: Room[]; total: number };

const STATUSES: { key: LiveStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'live', label: '直播中' },
  { key: 'offline', label: '已下播' },
];

const SORTS: { key: LiveSort; label: string; icon: React.ReactNode }[] = [
  { key: 'hot', label: '人气榜', icon: <WhatshotIcon sx={{ fontSize: 14 }} /> },
  { key: 'new', label: '最新开播', icon: <AccessTimeRoundedIcon sx={{ fontSize: 14 }} /> },
];

const CATEGORIES: { key: LiveCategory; label: string; gradient: string }[] = [
  { key: 'all', label: '全部分类', gradient: gradient2('#FE2C55', '#FFB400') },
  { key: 'knowledge', label: '知识', gradient: gradient2('#FFB400', '#FFD566') },
  { key: 'game', label: '游戏', gradient: gradient2('#8B5CF6', '#C4B5FD') },
  { key: 'music', label: '音乐', gradient: gradient2('#06B6D4', '#5DF7F2') },
  { key: 'outdoor', label: '户外', gradient: gradient2('#5DDB96', '#25F4EE') },
  { key: 'anime', label: '二次元', gradient: gradient2('#FF8A3D', '#FFB400') },
];

const CAT_COLOR: Record<string, string> = {
  情感: 'primary.main',
  游戏: '#8B5CF6',
  音乐: 'secondary.main',
  户外: 'success.main',
  二次元: '#FF8A3D',
  知识: 'warning.main',
};

export function LivePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const urlStatus = (searchParams.get('liveStatus') as LiveStatus) || 'all';
  const urlSort = (searchParams.get('sort') as LiveSort) || 'hot';
  const urlCategory = (searchParams.get('category') as LiveCategory) || 'all';
  const [status, setStatusState] = useState<LiveStatus>(urlStatus);
  const [sort, setSortState] = useState<LiveSort>(urlSort);
  const [category, setCategoryState] = useState<LiveCategory>(urlCategory);

  useEffect(() => { setStatusState(urlStatus); }, [urlStatus]);
  useEffect(() => { setSortState(urlSort); }, [urlSort]);
  useEffect(() => { setCategoryState(urlCategory); }, [urlCategory]);

  const updateParam = (next: { liveStatus?: LiveStatus; sort?: LiveSort; category?: LiveCategory }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.liveStatus !== undefined) {
      if (next.liveStatus === 'all') params.delete('liveStatus');
      else params.set('liveStatus', next.liveStatus);
    }
    if (next.sort !== undefined) {
      if (next.sort === 'hot') params.delete('sort');
      else params.set('sort', next.sort);
    }
    if (next.category !== undefined) {
      if (next.category === 'all') params.delete('category');
      else params.set('category', next.category);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const setStatus = (s: LiveStatus) => { setStatusState(s); updateParam({ liveStatus: s }); };
  const setSort = (s: LiveSort) => { setSortState(s); updateParam({ sort: s }); };
  const setCategory = (c: LiveCategory) => { setCategoryState(c); updateParam({ category: c }); };

  // 分页状态
  const PAGE_SIZE = 12;
  const [livePage, setLivePage] = useState(1);
  const [liveList, setLiveList] = useState<Room[]>([]);
  const [liveHasMore, setLiveHasMore] = useState(true);

  // 切换筛选时重置分页
  useEffect(() => {
    setLivePage(1);
    setLiveList([]);
    setLiveHasMore(true);
  }, [status, sort, category]);

  const query = useQuery({
    queryKey: ['home', 'live', 'rooms', status, sort, category, livePage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(livePage), size: String(PAGE_SIZE) });
      if (status !== 'all') params.set('status', status);
      if (sort !== 'hot') params.set('sort', sort);
      if (category !== 'all') params.set('category', category);
      const resp = await homeClient.get<Resp>(`/live/rooms?${params.toString()}`).then((r) => r.data);
      const records = resp?.list || [];
      const total = resp?.total || 0;

      console.log('[LivePanel] page:', livePage, 'records:', records.length, 'total:', total, 'hasMore:', records.length === PAGE_SIZE && (livePage * PAGE_SIZE) < total);

      setLiveList(prev => livePage === 1 ? records : [...prev, ...records]);
      setLiveHasMore(records.length === PAGE_SIZE && (livePage * PAGE_SIZE) < total);

      return resp;
    },
  });

  // 无限滚动 - 自动查找可滚动祖先容器
  const scroll = useScrollToBottom({
    enabled: !query.isLoading && liveHasMore,
  });

  useEffect(() => {
    console.log('[LivePanel] scroll.isNearBottom:', scroll.isNearBottom, 'liveHasMore:', liveHasMore, 'query.isLoading:', query.isLoading);
    if (scroll.isNearBottom && liveHasMore && !query.isLoading) {
      console.log('[LivePanel] triggering page load...');
      setLivePage(p => p + 1);
    }
  }, [scroll.isNearBottom, liveHasMore, query.isLoading]);

  const topQuery = useQuery({
    queryKey: ['home', 'live', 'top', category],
    queryFn: () => homeClient.get<Resp & { updatedAt: number }>(`/live/top${category !== 'all' ? '?category=' + category : ''}`).then((r) => r.data),
  });

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      {/* Hero */}
      <Box
        sx={{
          position: 'relative',
          mb: 3,
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          background: SECTION_TINT.RED_YELLOW_PURPLE,
          border: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', right: -20, top: -20, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(254,44,85,0.18), transparent 70%)' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, background: gradient2('#FE2C55', '#FFB400'), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(254,44,85,0.32)' }}>
            <LiveTvRoundedIcon sx={{ fontSize: 20, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 800, color: 'var(--text-primary, #ffffff)', letterSpacing: 0.5 }}>直播</Typography>
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', mt: 0.25 }}>实时热门榜 · 在线主播 · 24h 全天候</Typography>
          </Box>
        </Box>
      </Box>

      {/* TOP 10 人气榜 (领奖台) */}
      <AsyncState query={topQuery} skeletonCount={0} isEmpty={() => false}>
        {(data) => <LiveTop10 list={data.list} onSelect={(r) => navigate('LIVE', r.id)} />}
      </AsyncState>

      {/* Categories (gradient chips) */}
      <Box sx={{ mt: 4, mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 48, flexShrink: 0 }}>分类</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <Box
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  sx={{
                    px: 1.5,
                    py: 0.625,
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#fff' : 'var(--text-secondary, rgba(255,255,255,0.7))',
                    background: active ? c.gradient : 'var(--bg-input, rgba(255,255,255,0.04))',
                    border: '1px solid',
                    borderColor: active ? 'transparent' : 'var(--border-color, rgba(255,255,255,0.08))',
                    boxShadow: active ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                    transition: 'all 0.15s',
                    '&:hover': { transform: 'translateY(-1px)' },
                  }}
                >
                  {c.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Filters: status + sort */}
      <Box
        sx={{
          mb: 2,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'var(--bg-input, rgba(255,255,255,0.03))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 36, flexShrink: 0 }}>状态</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <FilterChip key={s.key} active={status === s.key} label={s.label} onClick={() => setStatus(s.key)} />
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 36, flexShrink: 0 }}>排序</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {SORTS.map((s) => {
              const active = sort === s.key;
              return (
                <Box
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.4,
                    borderRadius: 1,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? 'primary.main' : 'var(--text-secondary, rgba(255,255,255,0.6))',
                    bgcolor: active ? 'rgba(254,44,85,0.12)' : 'transparent',
                    border: '1px solid',
                    borderColor: active ? 'rgba(254,44,85,0.4)' : 'transparent',
                  }}
                >
                  {s.icon}
                  {s.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* List header */}
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
          {category === 'all' ? '全部' : CATEGORIES.find((c) => c.key === category)?.label}直播间
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          共 {query.data?.list?.length ?? 0} 间
        </Typography>
      </Box>

      {/* 直播间网格 - 不使用内部滚动容器，让内容流入外部可滚动的 MAIN */}
      <AsyncState
        query={query}
        skeletonCount={6}
        skeletonHeight={320}
        isEmpty={(d) => d.list.length === 0}
        emptyText="该筛选下暂无直播间"
        emptyHint="尝试切回全部分类或调整状态"
      >
        {(data) => (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
              {liveList.map((room) => (
                <RoomCard key={room.id} room={room} onClick={() => navigate('LIVE', room.id)} />
              ))}
            </Box>

            {/* 滚动触发器 - 放在可滚动的 MAIN 底部 */}
            <Box ref={scroll.sentinelRef} sx={{ height: 1 }} />

            {/* Loading more */}
            {query.isFetching && !query.isLoading && (
              <Typography sx={{ textAlign: 'center', py: 2, color: 'text.secondary', fontSize: 12 }}>加载中...</Typography>
            )}

            {/* No more */}
            {!query.isFetching && liveList.length > 0 && !liveHasMore && (
              <Typography sx={{ textAlign: 'center', py: 3, color: 'text.disabled', fontSize: 12 }}>- 没有更多了 -</Typography>
            )}
          </Box>
        )}
      </AsyncState>
    </Box>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.25,
        py: 0.4,
        borderRadius: 1.5,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, rgba(255,255,255,0.65))',
        bgcolor: active ? 'var(--brand-color, #FE2C55)' : 'var(--bg-input, rgba(255,255,255,0.04))',
        border: active ? 'none' : '1px solid var(--border-color, rgba(255,255,255,0.06))',
        transition: 'all 0.15s',
        '&:hover': { bgcolor: active ? 'var(--brand-color, #FE2C55)' : 'var(--bg-active, rgba(255,255,255,0.08))' },
      }}
    >
      {label}
    </Box>
  );
}

// ----- TOP 10 人气榜 (领奖台) -----
function LiveTop10({ list, onSelect }: { list: Room[]; onSelect: (r: Room) => void }) {
  if (list.length === 0) return null;
  const ordered = [...list].sort((a, b) => (a.hotRank || 99) - (b.hotRank || 99)).slice(0, 10);

  return (
    <Box
      sx={{
        position: 'relative',
        mb: 1,
        p: 2.5,
        borderRadius: 2.5,
        background: SECTION_TINT.RED_YELLOW_PURPLE,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'absolute', top: 12, right: 16, display: 'flex', alignItems: 'center', gap: 0.75, color: 'warning.main' }}>
        <LocalFireDepartmentIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>TOP 10 人气榜</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WhatshotIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>本周人气最高</Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))', ml: 1 }}>按在线观看人数</Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          gap: 1.25,
        }}
      >
        {ordered.map((r) => (
          <RankCard key={r.id} room={r} onClick={() => onSelect(r)} />
        ))}
      </Box>
    </Box>
  );
}

function RankCard({ room, onClick }: { room: Room; onClick: () => void }) {
  const rank = room.hotRank || 0;
  const isTop3 = rank >= 1 && rank <= 3;
  const medal = isTop3 ? MEDAL[rank] : null;
  const badgeBg = isTop3
    ? medal!.badge
    : 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)';
  const badgeColor = isTop3 ? medal!.txt : 'var(--text-primary, #fff)';
  const cardBg = isTop3 ? medal!.bg : 'var(--bg-surface, rgba(20, 22, 32, 0.6))';
  const cardBorder = isTop3 ? medal!.border : '1px solid var(--border-color, rgba(255,255,255,0.06))';

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        background: cardBg,
        border: cardBorder,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgba(0,0,0,0.3)' },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '3/4' }}>
        <CoverImage src={room.cover} alt={room.title} sx={{ width: '100%', height: '100%' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.HEAVY }} />
        <Box sx={{ position: 'absolute', top: 6, left: 6, minWidth: 24, height: 24, borderRadius: '50%', background: badgeBg, color: badgeColor, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', backdropFilter: isTop3 ? 'none' : 'blur(4px)', border: isTop3 ? 'none' : '1px solid rgba(255,255,255,0.2)', boxShadow: isTop3 ? '0 2px 6px rgba(0,0,0,0.4)' : 'none', zIndex: 1, fontVariantNumeric: 'tabular-nums' }}>
          {rank}
        </Box>
        {room.isLive && (
          <Box sx={{ position: 'absolute', top: 6, right: 6, display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'primary.main', color: '#fff', fontSize: 9, fontWeight: 700 }}>
            <LiveTvRoundedIcon sx={{ fontSize: 10, color: '#fff !important' }} />
            LIVE
          </Box>
        )}
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1, background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2, mb: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {room.title}
          </Typography>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
            {room.category} · {formatViewers(room.viewers)} 人气
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}


function RoomCard({ room, onClick }: { room: Room; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        aspectRatio: '3/4',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' },
      }}
    >
      <img src={room.cover || undefined} alt={room.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.HEAVY }} />

      {room.hotRank > 0 && (
        <Chip
          label={`TOP ${room.hotRank}`}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            height: 18,
            bgcolor: 'warning.main',
            color: '#1a1a1a',
            fontSize: 9,
            fontWeight: 800,
          }}
        />
      )}

      {room.isLive ? (
        <Chip
          icon={<LiveTvRoundedIcon sx={{ fontSize: 11, color: '#ffffff !important' }} />}
          label="LIVE"
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            height: 18,
            bgcolor: 'primary.main',
            color: 'var(--text-primary, #ffffff)',
            fontSize: 10,
            fontWeight: 700,
            '& .MuiChip-icon': { color: 'var(--text-primary, #ffffff)' },
          }}
        />
      ) : (
        <Chip
          label="已下播"
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            height: 18,
            bgcolor: 'rgba(0,0,0,0.5)',
            color: 'var(--text-secondary, rgba(255,255,255,0.7))',
            fontSize: 10,
          }}
        />
      )}

      <Box sx={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #ffffff)', mb: 0.5, lineHeight: 1.3 }}>
          {room.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: room.hostAvatar || 'var(--bg-hover, rgba(255,255,255,0.1))',
              border: '1px solid var(--border-strong, rgba(255,255,255,0.3))',
              fontSize: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary, #ffffff)',
              fontWeight: 600,
            }}
          >
            {(room.hostName || '?')[0]}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'var(--text-primary, rgba(255,255,255,0.85))', flex: 1 }}>
            {room.hostName}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'var(--text-primary, #ffffff)' }}>
            <VisibilityRoundedIcon sx={{ fontSize: 11 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{formatViewers(room.viewers)}</Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 0.75, display: 'flex', gap: 0.5 }}>
          <Chip
            label={room.category}
            size="small"
            sx={{
              height: 16,
              bgcolor: 'var(--border-strong, rgba(255,255,255,0.12))',
              color: CAT_COLOR[room.category] || 'var(--text-primary, #fff)',
              fontSize: 9,
              fontWeight: 600,
            }}
          />
          <Chip
            label={room.region}
            size="small"
            sx={{
              height: 16,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              fontSize: 9,
              fontWeight: 500,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

function formatViewers(n?: number | null): string {
  const num = Number(n) || 0;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}