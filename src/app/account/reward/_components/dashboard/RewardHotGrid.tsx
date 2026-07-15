'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { alpha } from '@mui/material/styles';
import { getHotBounties, type Bounty } from '@/apis/dashboard';
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

  // 分页 state(只在 all 模式生效)
  const [page, setPage] = useState(1);
  const [localSearch, setLocalSearch] = useState('');
  const [localFilter, setLocalFilter] = useState('');
  const [localOrder, setLocalOrder] = useState('reward');
  // 外部 prop 优先级:父组件传入时仍生效;否则用内部 state
  const effectiveSearch = search || localSearch;
  const effectiveFilter = filter || localFilter;
  const effectiveOrder = order || localOrder;

  // 真接口:热门/全部悬赏(支持 keyword 搜索 + category 过滤 + order 排序 + page 分页)
  const query = useQuery({
    queryKey: ['reward-bounty-grid', mode, { search: effectiveSearch, order: effectiveOrder, filter: effectiveFilter, page }],
    queryFn: () =>
      getHotBounties({
        page: isAll ? page : 1,
        pageSize: isAll ? PAGE_SIZE : 6,
        keyword: effectiveSearch || undefined,
        category: effectiveFilter || undefined,
        order: effectiveOrder as any,
      }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  const list: Bounty[] = ((query.data?.list ?? []) as any[]).map((b) => ({
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
  const total = (query.data?.total as number) ?? list.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetLocal = () => {
    setLocalSearch('');
    setLocalFilter('');
    setLocalOrder('reward');
    setPage(1);
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
              setPage(1);
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
              onClick={() => {
                if (!filter) setLocalFilter('');
                setPage(1);
              }}
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
                  setPage(1);
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
                setPage(1);
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
          {list.map((b) => (
            <BountyCard key={b.id} bounty={b} onClick={() => setDetailId(b.id)} />
          ))}
        </Box>
      )}

      {/* 分页(仅 all 模式) */}
      {isAll && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Stack direction='row' spacing={0.5} sx={{ alignItems: 'center' }}>
            <Button size='small' disabled={page <= 1} onClick={() => setPage(page - 1)}>
              上一页
            </Button>
            <Typography sx={{ px: 1, fontSize: 12, color: 'text.secondary' }}>
              第 {page} / {totalPages} 页 · 共 {total} 条
            </Typography>
            <Button size='small' disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              下一页
            </Button>
          </Stack>
        </Box>
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
          background: bounty.cover ? `url(${bounty.cover}) center / cover no-repeat` : bounty.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.primary',
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

      <Box sx={{ p: 1.5 }}>
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
            <Typography sx={{ fontSize: 11 }}>剩 {bounty.daysLeft} 天</Typography>
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