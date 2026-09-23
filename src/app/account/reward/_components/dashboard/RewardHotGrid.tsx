'use client';

import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import SearchIcon from '@mui/icons-material/Search';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import { gradient2 } from '@/constants/gradients';
import { coverBackground } from '@/lib/media';
import { fallbackCoverDataUri } from '@/lib/bountyCover';
import { alpha } from '@mui/material/styles';
import { getHotBounties, type Bounty } from '@/apis/dashboard';
import { ListLayout, ListLayoutSwitch, LIST_ROW } from '@/components/common/ListLayout';
import BountyDetailDialog from './BountyDetailDialog';

const CATEGORY_LABEL: Record<string, string> = {
  video: '短视频',
  image: '图文',
  novel: '小说',
  art: '画作',
  music: '音乐',
  film: '短剧',
  script: '剧本',
  live: '直播',
  voice: '配音',
};

const CATEGORY_COLOR: Record<string, string> = {
  video: 'primary.main',
  image: 'warning.main',
  novel: 'secondary.main',
  art: '#8B5CF6',
  music: 'success.main',
  film: '#F59E0B',
  script: '#FFB400',
  live: '#06B6D4',
  voice: '#EC4899',
};

const ORDERS = [
  { id: 'reward', label: '赏金最高' },
  { id: 'deadline', label: '即将截止' },
  { id: 'hot', label: '最热门' },
  { id: 'newest', label: '最新发布' },
];

const PAGE_SIZE = 12;

/**
 * 悬赏列表组件。两种模式:
 * - mode='hot':赏金广场右侧?/侧栏小卡,只拉前 6 张,带 HOT 角标
 * - mode='all':赏金广场左侧主区,完整列表(分页 + 搜索 + 分类 + 排序)
 *
 * 两种模式都不跳转路由,详情走 BountyDetailDialog 页内弹层。
 */
export default function RewardHotGrid({
  mode = 'hot',
  search = '',
  order = 'reward',
  filter = '',
}: {
  /** hot = 热门 6 张;all = 完整列表(分页) */
  mode?: 'hot' | 'all';
  search?: string;
  order?: 'reward' | 'deadline' | 'hot' | 'newest';
  /** 分类 code('' = 全部);中文 label 由后端兼容,前端统一传 code */
  filter?: string;
} = {}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const isAll = mode === 'all';

  // 搜索/筛选/排序 state(all 模式就地,不写 URL)
  const [localSearch, setLocalSearch] = useState('');
  const [localFilter, setLocalFilter] = useState('');
  const [localOrder, setLocalOrder] = useState('reward');
  // 外部 prop 优先级:父组件传入时仍生效;否则用内部 state
  const effectiveSearch = search || localSearch;
  const effectiveFilter = filter || localFilter;
  const effectiveOrder = order || localOrder;

  // 真接口:热门(前 6 张)/全部悬赏(无限滚动,滚到底自动加载下一页)
  const query = useInfiniteQuery({
    queryKey: ['reward-bounty-grid', mode, { search: effectiveSearch, order: effectiveOrder, filter: effectiveFilter }],
    queryFn: ({ pageParam }) =>
      getHotBounties({
        page: pageParam,
        pageSize: isAll ? PAGE_SIZE : 6,
        keyword: effectiveSearch || undefined,
        category: effectiveFilter || undefined,
        order: effectiveOrder as any,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  const allItems = query.data?.pages.flatMap((p) => p.list) ?? [];
  const list: Bounty[] = (allItems as any[]).map((b) => ({
    id: b.id,
    title: b.title,
    category: (b.category as Bounty['category']) ?? 'video',
    reward: b.reward / 100,
    applicants: b.applicants,
    daysLeft: b.daysLeft,
    sponsor: b.sponsor,
    gradient: b.gradient || gradient2('#FE2C55', '#FF6B8A'),
    cover: b.cover || undefined,
  }));
  const total = (query.data?.pages[0]?.total as number) ?? list.length;

  // 滚动到底自动加载下一页(all 模式):列表尾部哨兵,IntersectionObserver 触发
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  React.useEffect(() => {
    if (!isAll) return;
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
  }, [isAll, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const resetLocal = () => {
    setLocalSearch('');
    setLocalFilter('');
    setLocalOrder('reward');
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* 标题行 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
          <WhatshotIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
            {isAll ? '全部悬赏' : '热门悬赏'}
          </Typography>
          {!isAll && (
            <Box
              sx={{
                px: 0.75,
                py: 0.125,
                borderRadius: 0.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                color: 'primary.main',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              HOT
            </Box>
          )}
          {isAll && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>共 {total} 个</Typography>
          )}
        </Box>
        <ListLayoutSwitch />
      </Box>

      {/* all 模式:搜索 + 分类 + 排序(就地 state,不写 URL) */}
      {isAll && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, alignItems: { md: 'center' }, mb: 2 }}>
          <TextField
            size='small'
            placeholder='搜索悬赏关键词…'
            value={effectiveSearch}
            onChange={(e) => {
              if (!search) setLocalSearch(e.target.value);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position='start'>
                    <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ flex: 1, minWidth: { md: 200 } }}
          />
          <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            <Chip
              size='small'
              label='全部'
              // 「全部」:父组件没传 filter 时,允许点击清空当前分类。原先的写法是
              // setLocalFilter('') —— 已经清空的状态再 set 一遍,React 不会重渲染,
              // 视觉上像没反应;改成 toggle,只有当前不在「全部」时才生效。
              onClick={() => { if (!filter && effectiveFilter !== '') setLocalFilter(''); }}
              color={effectiveFilter === '' ? 'primary' : 'default'}
              variant={effectiveFilter === '' ? 'filled' : 'outlined'}
            />
            {Object.keys(CATEGORY_LABEL).map((code) => (
              <Chip
                key={code}
                size='small'
                label={CATEGORY_LABEL[code]}
                onClick={() => {
                  if (!filter) setLocalFilter(code);
                }}
                color={effectiveFilter === code ? 'primary' : 'default'}
                variant={effectiveFilter === code ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </Box>
      )}

      {isAll && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>排序:</Typography>
          {ORDERS.map((o) => (
            <Chip
              key={o.id}
              size='small'
              label={o.label}
              onClick={() => {
                if (!order) setLocalOrder(o.id);
              }}
              color={effectiveOrder === o.id ? 'primary' : 'default'}
              variant={effectiveOrder === o.id ? 'filled' : 'outlined'}
              sx={{ fontSize: 11 }}
            />
          ))}
        </Box>
      )}

      {/* 列表区 */}
      {query.isLoading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 1.5,
          }}
        >
          {Array.from({ length: isAll ? PAGE_SIZE : 6 }).map((_, i) => (
            <Skeleton key={i} variant='rounded' height={160} sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : list.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled' }}>
          <Typography sx={{ fontSize: 12 }}>
            {effectiveSearch || effectiveFilter ? '当前筛选条件下暂无悬赏' : isAll ? '暂无悬赏' : '暂无热门悬赏'}
          </Typography>
          {isAll && (effectiveSearch || effectiveFilter) && (
            <Button size='small' sx={{ mt: 1, textTransform: 'none' }} onClick={resetLocal}>
              清空筛选
            </Button>
          )}
        </Box>
      ) : (
        <ListLayout minColumnWidth={240} gap={12}>
          {list.map((b) => (
            <BountyCard key={b.id} bounty={b} onClick={() => setDetailId(b.id)} />
          ))}
        </ListLayout>
      )}

      {/* 无限滚动哨兵 + 加载中/到底提示(仅 all 模式) */}
      {isAll && (
        <>
          <Box ref={sentinelRef} sx={{ height: '1px' }} />
          {query.isFetchingNextPage && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1.5, mt: 1.5 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant='rounded' height={160} sx={{ bgcolor: 'action.hover' }} />
              ))}
            </Box>
          )}
          {!query.hasNextPage && list.length > 0 && (
            <Typography sx={{ textAlign: 'center', py: 2, fontSize: 12, color: 'text.disabled' }}>
              - 没有更多了 · 共 {total} 条 -
            </Typography>
          )}
        </>
      )}

      <BountyDetailDialog
        open={!!detailId}
        bountyId={detailId}
        onClose={() => setDetailId(null)}
      />
    </Box>
  );
}

// 卡片(原 HotGrid 内部样式,移到外面共享)
function BountyCard({ bounty, onClick }: { bounty: Bounty; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'all 0.25s',
        [LIST_ROW]: { display: 'flex', alignItems: 'stretch' },
        '&:hover': {
          transform: 'translateY(-3px)',
          borderColor: 'primary.main',
          boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16 / 9',
          // 没封面时用确定性生成的 SVG(同一条永远是同一张),而不是一片纯渐变 ——
          // 存量机器人悬赏全都是空 cover,纯渐变会让整屏卡片长得一模一样。
          background: coverBackground(bounty.cover || fallbackCoverDataUri(bounty.title, bounty.category), bounty.gradient),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.primary',
          [LIST_ROW]: { width: { xs: 120, sm: 200 }, flexShrink: 0 },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 50%)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            color: 'text.primary',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          <WhatshotIcon sx={{ fontSize: 12 }} />
          {CATEGORY_LABEL[bounty.category as string] ?? bounty.category}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.9),
            backdropFilter: 'blur(4px)',
            color: (theme) => theme.palette.primary.contrastText,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'monospace',
          }}
        >
          ¥{bounty.reward.toLocaleString('zh-CN')}
        </Box>
      </Box>

      <Box sx={{ p: 1.5, [LIST_ROW]: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
        <Typography
          sx={{
            fontSize: 13,
            color: 'text.primary',
            fontWeight: 500,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 36,
          }}
        >
          {bounty.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, color: 'text.secondary' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <GroupIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: 11 }}>{bounty.applicants}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <AccessTimeIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: 11 }}>
              {bounty.daysLeft == null ? '长期' : bounty.daysLeft === 0 ? '已截止' : `剩 ${bounty.daysLeft} 天`}
            </Typography>
          </Box>
          <Box
            sx={{
              ml: 'auto',
              px: 0.75,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: `${CATEGORY_COLOR[bounty.category as string] ?? '#8B5CF6'}1F`,
              color: CATEGORY_COLOR[bounty.category as string] ?? '#8B5CF6',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {bounty.sponsor}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}