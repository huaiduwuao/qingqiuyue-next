'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Fab from '@mui/material/Fab';
import LinearProgress from '@mui/material/LinearProgress';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { userPointMe } from '@/apis/global';
import { getMyStats, getHotBounties, type MyStats } from '@/apis/dashboard';
import { coverBackground } from '@/lib/media';
import { fallbackCoverDataUri } from '@/lib/bountyCover';
import { gradient2 } from '@/constants/gradients';
import { MobileSection, MobileStatRow, MobileListRow } from '@/components/mobile/MobileSection';
import BountyDetailDialog from './BountyDetailDialog';
import RankingListDialog from './RankingListDialog';
import { formatDiamonds, formatDiamondsShort } from '@/apis/wallet';

const CATEGORIES: { code: string; label: string }[] = [
  { code: '', label: '全部' },
  { code: 'video', label: '短视频' },
  { code: 'image', label: '图文' },
  { code: 'novel', label: '小说' },
  { code: 'art', label: '画作' },
  { code: 'music', label: '音乐' },
  { code: 'film', label: '短剧' },
  { code: 'script', label: '剧本' },
  { code: 'live', label: '直播' },
  { code: 'voice', label: '配音' },
];
const LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.filter((c) => c.code).map((c) => [c.code, c.label]));
const ORDERS = [
  { id: 'reward', label: '赏金最高' },
  { id: 'deadline', label: '即将截止' },
  { id: 'hot', label: '最热门' },
  { id: 'newest', label: '最新发布' },
] as const;
type Order = (typeof ORDERS)[number]['id'];
const PAGE_SIZE = 12;

/**
 * 手机上的赏金广场。电脑版是 猎人卡 + 九宫格分类 + 带搜索/分类/排序三行筛选的卡片网格 + 右栏达人榜/动态,
 * 手机上堆成七屏,而且分类出现两遍。这里:
 *   一张紧凑的猎人卡(点进我的工作台)→ 达人榜一行 → 吸顶的「分类横滑 + 排序 + 搜索」一行 → 单列悬赏行
 *   → 右下角「发悬赏」。
 */
export default function RewardSquareMobile({ onOpenTab }: { onOpenTab?: (tab: string) => void }) {
  const [category, setCategory] = useState('');
  const [order, setOrder] = useState<Order>('reward');
  const [keyword, setKeyword] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [orderAnchor, setOrderAnchor] = useState<HTMLElement | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rankOpen, setRankOpen] = useState(false);

  // 与电脑版同 queryKey,共用缓存
  const pointQ = useQuery({
    queryKey: ['user-point', 'me', 'reward'],
    queryFn: () => userPointMe({ type: 'reward' }).then((r: any) => r || {}),
    placeholderData: {},
  });
  const statsQ = useQuery({
    queryKey: ['reward', 'my-stats', 'dashboard'],
    queryFn: () => getMyStats(),
    placeholderData: {} as MyStats,
    staleTime: 30_000,
  });
  const pt: any = pointQ.data || {};
  const st: Partial<MyStats> = statsQ.data || {};
  const need = Number(pt.needPoint);
  const hasNext = Number.isFinite(need) && need > 0;
  const total = Number(pt.totalPoint) || 0;

  const listQ = useInfiniteQuery({
    queryKey: ['reward-bounty-grid', 'all', { search: keyword, order, filter: category }],
    queryFn: ({ pageParam }) =>
      getHotBounties({ page: pageParam, pageSize: PAGE_SIZE, keyword: keyword || undefined, category: category || undefined, order: order as any }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 30_000,
  });
  const items = (listQ.data?.pages.flatMap((p) => p.list) ?? []) as any[];
  const count = (listQ.data?.pages[0]?.total as number) ?? items.length;

  // 滚到底自动加载下一页
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listQ;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: '300px' });
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const orderLabel = ORDERS.find((o) => o.id === order)?.label;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 8 }}>
      {/* 猎人卡:等级 + 灵气进度 + 四个数,点进我的工作台 */}
      <MobileSection>
        <Box onClick={() => onOpenTab?.('workspace')} sx={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 1.75 }}>
            <Box component="span" sx={{ px: 0.75, py: 0.125, borderRadius: 1, fontSize: 11, fontWeight: 700, color: '#fff', background: gradient2('#FE2C55', '#FFB400') }}>
              Lv{pt.level ?? 0}
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{pt.levelName || '赏金猎人'}</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography component="span" sx={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, color: 'text.secondary' }}>
              我的工作台
              <ChevronRightRoundedIcon sx={{ fontSize: 16, mr: -0.5 }} />
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1.5 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }}>灵气 {total.toLocaleString()}</Typography>
            {/* 后端没给下一级门槛时不画进度条(否则 Lv0 也会写成「已满级」) */}
            {hasNext && (
              <>
                <LinearProgress
                  variant="determinate"
                  value={(total / (total + need)) * 100}
                  sx={{ flex: 1, height: 5, borderRadius: 3, bgcolor: 'action.hover' }}
                />
                <Typography sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0 }}>
                  还差 {need.toLocaleString()} 升级
                </Typography>
              </>
            )}
          </Box>
          <MobileStatRow
            items={[
              { label: '已采纳', value: st.adoptedCount ?? 0 },
              { label: '排名', value: st.rankingPosition ? `#${st.rankingPosition}` : '—' },
              { label: '赏金收入', value: formatDiamondsShort(st.totalIncomeDiamonds) },
            ]}
          />
        </Box>
      </MobileSection>

      {/* 达人榜:电脑版在右栏,手机上收成一行 */}
      <MobileSection flush>
        <MobileListRow
          divider={false}
          onClick={() => setRankOpen(true)}
          leading={
            <Box sx={{ width: 32, height: 32, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: gradient2('#FFB400', '#FF6B3D'), flexShrink: 0 }}>
              <EmojiEventsRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          }
          title="悬赏达人榜"
          subtitle="本周接单最多、赏金最高的猎人"
        />
      </MobileSection>

      {/* 吸顶筛选:分类横滑 + 排序 + 搜索,一行搞定(电脑版是三行 + 上面还有一遍九宫格分类) */}
      <Box
        sx={{
          position: 'sticky',
          top: -12,
          zIndex: 5,
          mx: -1.5,
          px: 1.5,
          pt: 1.5,
          pb: 0.75,
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
            {CATEGORIES.map((c) => {
              const on = c.code === category;
              return (
                <Box
                  key={c.code || 'all'}
                  component="button"
                  type="button"
                  onClick={() => setCategory(c.code)}
                  sx={{
                    all: 'unset',
                    flexShrink: 0,
                    cursor: 'pointer',
                    px: 1.5,
                    py: 0.6,
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: on ? 700 : 500,
                    color: on ? '#fff' : 'text.secondary',
                    bgcolor: on ? 'primary.main' : 'background.paper',
                    border: '1px solid',
                    borderColor: on ? 'primary.main' : 'divider',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {c.label}
                </Box>
              );
            })}
          </Box>
          <IconButton size="small" aria-label="搜索悬赏" onClick={() => setSearchOpen((o) => !o)} sx={{ color: searchOpen || keyword ? 'primary.main' : 'text.secondary' }}>
            <SearchRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        {(searchOpen || keyword) && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderRadius: 999, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            <InputBase autoFocus={!keyword} placeholder="搜索悬赏关键词" value={keyword} onChange={(e) => setKeyword(e.target.value)} sx={{ flex: 1, fontSize: 14 }} />
            {keyword && (
              <IconButton size="small" aria-label="清空" onClick={() => setKeyword('')} sx={{ p: 0.25 }}>
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', flex: 1 }}>共 {count} 个悬赏</Typography>
          <Box
            component="button"
            type="button"
            onClick={(e) => setOrderAnchor(e.currentTarget)}
            sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', fontSize: 12, color: 'text.primary', fontWeight: 600 }}
          >
            {orderLabel}
            <ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
          <Menu anchorEl={orderAnchor} open={!!orderAnchor} onClose={() => setOrderAnchor(null)}>
            {ORDERS.map((o) => (
              <MenuItem
                key={o.id}
                selected={o.id === order}
                onClick={() => {
                  setOrder(o.id);
                  setOrderAnchor(null);
                }}
                sx={{ fontSize: 14 }}
              >
                {o.label}
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>

      {/* 单列悬赏行:左缩略图,右标题 + 赏金 / 截止 / 人数 */}
      <MobileSection flush>
        {listQ.isLoading ? (
          <Box sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={68} />
            ))}
          </Box>
        ) : items.length === 0 ? (
          <Typography sx={{ py: 5, textAlign: 'center', fontSize: 13, color: 'text.disabled' }}>
            {keyword || category ? '当前筛选下暂无悬赏' : '暂无悬赏'}
          </Typography>
        ) : (
          items.map((b, i) => {
            const left = b.daysLeft == null ? '长期' : b.daysLeft === 0 ? '已截止' : `剩 ${b.daysLeft} 天`;
            return (
              <Box
                key={b.id}
                onClick={() => setDetailId(String(b.id))}
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  px: 1.75,
                  py: 1.25,
                  cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid' : 0,
                  borderColor: 'divider',
                  WebkitTapHighlightColor: 'transparent',
                  '&:active': { bgcolor: 'action.hover' },
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: 96,
                    height: 68,
                    flexShrink: 0,
                    borderRadius: 2,
                    overflow: 'hidden',
                    background: coverBackground(b.cover || fallbackCoverDataUri(b.title, b.category), b.gradient || gradient2('#FE2C55', '#FF6B8A')),
                  }}
                >
                  <Box component="span" sx={{ position: 'absolute', left: 4, top: 4, px: 0.5, borderRadius: 0.75, fontSize: 10, fontWeight: 600, color: '#fff', bgcolor: 'rgba(0,0,0,0.45)' }}>
                    {LABEL[b.category] ?? b.category}
                  </Box>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {b.title}
                  </Typography>
                  <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 1.25, color: 'text.secondary' }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: 'primary.main', fontFamily: 'monospace', flexShrink: 0 }}>
                      {formatDiamonds(b.rewardDiamonds)}
                    </Typography>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <AccessTimeRoundedIcon sx={{ fontSize: 13 }} />
                      {left}
                    </Box>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <GroupRoundedIcon sx={{ fontSize: 13 }} />
                      {b.applicants ?? 0}
                    </Box>
                    <Typography noWrap sx={{ ml: 'auto', fontSize: 11, color: 'text.disabled', minWidth: 0 }}>
                      {b.sponsor}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
        <Box ref={sentinel} sx={{ height: '1px' }} />
        {isFetchingNextPage && (
          <Box sx={{ px: 1.75, pb: 1.5 }}>
            <Skeleton variant="rounded" height={68} />
          </Box>
        )}
        {!hasNextPage && items.length > 0 && (
          <Typography sx={{ textAlign: 'center', py: 1.5, fontSize: 12, color: 'text.disabled', borderTop: '1px solid', borderColor: 'divider' }}>
            没有更多了
          </Typography>
        )}
      </MobileSection>

      {/* 发悬赏:进「我的需求」发布 */}
      {onOpenTab && (
        <Fab
          variant="extended"
          color="primary"
          onClick={() => onOpenTab('demands')}
          sx={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(16px + var(--bottom-nav-inset, 0px) + var(--player-inset, 0px))',
            zIndex: 10,
            fontWeight: 700,
            boxShadow: '0 8px 20px rgba(254,44,85,0.35)',
          }}
        >
          <AddRoundedIcon sx={{ mr: 0.5 }} />
          发悬赏
        </Fab>
      )}

      <BountyDetailDialog open={!!detailId} bountyId={detailId} onClose={() => setDetailId(null)} />
      <RankingListDialog open={rankOpen} onClose={() => setRankOpen(false)} />
    </Box>
  );
}
