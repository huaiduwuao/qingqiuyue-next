'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import { alpha } from '@mui/material/styles';
import { getHotBounties, getRewardCategories, type Bounty } from '@/apis/dashboard';
import { gradient2 } from '@/constants/gradients';
import BountyDetailDialog from '../_components/dashboard/BountyDetailDialog';

// 与后端 handler/reward_extra.go rewardCategoryMeta 对齐
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
  video: '#FE2C55',
  image: '#FFB400',
  novel: '#8B5CF6',
  art: '#EC4899',
  music: '#25F4EE',
  film: '#F59E0B',
  script: '#FFB400',
  live: '#06B6D4',
  voice: '#10B981',
};

const ORDERS = [
  { id: 'reward', label: '赏金最高' },
  { id: 'deadline', label: '即将截止' },
  { id: 'hot', label: '最热门' },
  { id: 'newest', label: '最新发布' },
];

const PAGE_SIZE = 12;

export default function BountiesAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 同步: ?category=video&q=端午&order=reward&page=2
  const initialCategory = searchParams.get('category') ?? '';
  const initialQuery = searchParams.get('q') ?? '';
  const initialOrder = searchParams.get('order') ?? 'reward';
  const initialPage = Number(searchParams.get('page') ?? '1') || 1;

  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [order, setOrder] = useState(initialOrder);
  const [page, setPage] = useState(initialPage);
  const [detailId, setDetailId] = useState<string | null>(null);

  // 分类列表(后端 /reward/categories)
  const catQuery = useQuery({
    queryKey: ['reward-categories-page'],
    queryFn: () => getRewardCategories(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });
  const categories = ((catQuery.data?.records ?? catQuery.data?.list ?? []) as Array<{ code: string; label: string; count: number; color: string; icon: string }>);
  const totalCountAll = categories.reduce((a, b) => a + (b.count ?? 0), 0);

  // 悬赏列表
  const listQuery = useQuery({
    queryKey: ['reward-bounty-all', { category, query, order, page }],
    queryFn: () =>
      getHotBounties({
        page,
        size: PAGE_SIZE,
        category: category || undefined,
        keyword: query || undefined,
        order: order as any,
      }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });

  const list: Bounty[] = (listQuery.data?.records ?? listQuery.data?.list ?? []) as Bounty[];
  const total = (listQuery.data?.total as number) ?? list.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 同步 URL(无副作用,只 push 一次)
  const syncUrl = (next: Partial<{ category: string; query: string; order: string; page: number }>) => {
    const params = new URLSearchParams();
    const c = next.category ?? category;
    const q = next.query ?? query;
    const o = next.order ?? order;
    const p = next.page ?? page;
    if (c) params.set('category', c);
    if (q) params.set('q', q);
    if (o && o !== 'reward') params.set('order', o);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    router.replace('/account/reward/bounties' + (qs ? '?' + qs : ''), { scroll: false });
  };

  const onSelectCategory = (code: string) => {
    setCategory(code);
    setPage(1);
    syncUrl({ category: code, page: 1 });
  };
  const onChangeQuery = (v: string) => {
    setQuery(v);
    setPage(1);
    syncUrl({ query: v, page: 1 });
  };
  const onChangeOrder = (v: string) => {
    setOrder(v);
    setPage(1);
    syncUrl({ order: v, page: 1 });
  };
  const onChangePage = (p: number) => {
    setPage(p);
    syncUrl({ page: p });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 顶部栏 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <IconButton onClick={() => router.push('/account/reward')} aria-label='返回' size='small'>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>全部悬赏</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
            {category ? `分类:${CATEGORY_LABEL[category] ?? category}` : '全部分类'} · 共 {total} 个悬赏
          </Typography>
        </Box>
      </Box>

      {/* 分类 chip 横条 */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={`全部 (${totalCountAll})`}
            onClick={() => onSelectCategory('')}
            color={category === '' ? 'primary' : 'default'}
            variant={category === '' ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600 }}
          />
          {(catQuery.isLoading ? Array.from({ length: 9 }).map((_, i) => ({ code: 'l' + i, label: '...', count: 0 })) : categories).map((c) => (
            <Chip
              key={c.code}
              label={`${c.label}${c.count > 0 ? ' (' + c.count + ')' : ''}`}
              onClick={() => onSelectCategory(c.code)}
              color={category === c.code ? 'primary' : 'default'}
              variant={category === c.code ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                ...(category === c.code && c.color
                  ? {
                      bgcolor: c.color + '22',
                      color: c.color,
                      borderColor: c.color,
                    }
                  : {}),
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* 搜索 + 排序 */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1.5,
          alignItems: { md: 'center' },
        }}
      >
        <TextField
          size='small'
          placeholder='搜索悬赏关键词…'
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position='start'>
                  <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1, minWidth: { md: 240 } }}
        />
        <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          {ORDERS.map((o) => (
            <Chip
              key={o.id}
              label={o.label}
              size='small'
              onClick={() => onChangeOrder(o.id)}
              color={order === o.id ? 'primary' : 'default'}
              variant={order === o.id ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>
      </Box>

      {/* 列表区 */}
      {listQuery.isLoading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Skeleton key={i} variant='rounded' height={210} />
          ))}
        </Box>
      ) : listQuery.isError ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.disabled' }}>悬赏加载失败</Typography>
        </Box>
      ) : list.length === 0 ? (
        <Box
          sx={{
            py: 6,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography sx={{ color: 'text.disabled', fontSize: 14 }}>
            当前筛选条件下暂无悬赏
          </Typography>
          <Button size='small' sx={{ mt: 1, textTransform: 'none' }} onClick={() => { onChangeQuery(''); onSelectCategory(''); }}>
            清空筛选
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {list.map((b) => (
            <BountyCard key={b.id} bounty={b} onClick={() => setDetailId(String(b.id))} />
          ))}
        </Box>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <Stack direction='row' spacing={0.5} alignItems='center'>
            <Button size='small' disabled={page <= 1} onClick={() => onChangePage(page - 1)}>
              上一页
            </Button>
            <Typography sx={{ px: 1, fontSize: 13, color: 'text.secondary' }}>
              第 {page} / {totalPages} 页 · 共 {total} 条
            </Typography>
            <Button size='small' disabled={page >= totalPages} onClick={() => onChangePage(page + 1)}>
              下一页
            </Button>
          </Stack>
        </Box>
      )}

      <BountyDetailDialog open={!!detailId} bountyId={detailId} onClose={() => setDetailId(null)} />
    </Box>
  );
}

// 卡片(简化版,保留 hot grid 视觉)
function BountyCard({ bounty, onClick }: { bounty: Bounty; onClick: () => void }) {
  const cover = bounty.cover;
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
          boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: 120,
          background: cover ? `url(${cover}) center/cover` : (bounty.gradient || gradient2('#FE2C55', '#8B5CF6')),
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.5))',
          }}
        />
        <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 0.5 }}>
          <Chip
            size='small'
            label={CATEGORY_LABEL[bounty.category] ?? bounty.category}
            sx={{
              height: 20,
              fontSize: 10,
              fontWeight: 600,
              bgcolor: alpha('#fff', 0.9),
              color: CATEGORY_COLOR[bounty.category] ?? 'text.primary',
            }}
          />
        </Box>
        <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: alpha('#FE2C55', 0.95),
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ¥{(bounty.reward / 100).toLocaleString('zh-CN')}
          </Box>
        </Box>
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Typography
          sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', lineHeight: 1.4 }}
        >
          {bounty.title}
        </Typography>
        <Stack direction='row' sx={{ mt: 1, gap: 1, color: 'text.secondary', fontSize: 11 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <GroupIcon sx={{ fontSize: 12 }} />
            <span>{bounty.applicants}</span>
          </Box>
          <Divider orientation='vertical' flexItem />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <AccessTimeIcon sx={{ fontSize: 12 }} />
            <span>{bounty.daysLeft} 天</span>
          </Box>
          <Box sx={{ flex: 1 }} />
          <span>{bounty.sponsor}</span>
        </Stack>
      </Box>
    </Box>
  );
}
