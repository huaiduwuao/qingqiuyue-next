'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import { alpha } from '@mui/material/styles';
import { getHotBounties, type Bounty } from '@/apis/dashboard';
import BountyDetailDialog from './BountyDetailDialog';

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

const PAGE_SIZE = 12;

/**
 * 「全部悬赏」弹层 —— 完整列表(吸收原 /account/reward/bounties 路由的全部功能)。
 *
 * 设计原则:悬赏中心是纯客户端 tab 体系,任何子模块都不应跳转真实路由。
 * 弹层内部用本地 state 管筛选/分页/详情,不写 URL,关弹即丢弃。
 * 父组件 dashboard 通过 open 受控显示,关闭后 URL 永远保持在 /account/reward。
 */
export default function BountyListDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // 弹层内独立 state(原 bounties/page.tsx 的功能完全吸收到此)
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('reward');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['reward-bounty-dialog', { search, order, category, page }],
    queryFn: () =>
      getHotBounties({
        page,
        size: PAGE_SIZE,
        keyword: search || undefined,
        category: category || undefined,
        order: order as any,
      }),
    staleTime: 30 * 1000,
    enabled: open,
  });

  const list: Bounty[] = (listQuery.data?.records ?? listQuery.data?.list ?? []) as Bounty[];
  const total = (listQuery.data?.total as number) ?? list.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 关闭弹层(对外)
  const handleClose = () => {
    onClose();
  };
  // 注:弹层内部 page 在 onSearch/onCategory/onOrder 回调里已各自 setPage(1),
  // 关闭重开由父组件控制;此处刻意不写 useEffect 重置 page,以避免触发
  // react-hooks/set-state-in-effect 警告(开/关由父级 open prop 切换足够)。

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='md'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2, bgcolor: 'background.paper', maxHeight: '90vh' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5 }}>
        <WhatshotIcon sx={{ fontSize: 18, color: 'primary.main', mr: 0.75 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>全部悬赏</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {category ? `分类:${CATEGORY_LABEL[category] ?? category}` : '全部分类'} · 共 {total} 个悬赏
          </Typography>
        </Box>
        <IconButton size='small' onClick={handleClose} sx={{ color: 'text.secondary' }} aria-label='关闭'>
          <CloseIcon fontSize='small' />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 1.5 }}>
        {/* 搜索 + 分类 + 排序 */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, alignItems: { md: 'center' }, mb: 2 }}>
          <TextField
            size='small'
            placeholder='搜索悬赏关键词…'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
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
                setCategory('');
                setPage(1);
              }}
              color={category === '' ? 'primary' : 'default'}
              variant={category === '' ? 'filled' : 'outlined'}
            />
            {(Object.keys(CATEGORY_LABEL)).map((code) => (
              <Chip
                key={code}
                size='small'
                label={CATEGORY_LABEL[code]}
                onClick={() => {
                  setCategory(code);
                  setPage(1);
                }}
                color={category === code ? 'primary' : 'default'}
                variant={category === code ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>排序:</Typography>
          {[
            { id: 'reward', label: '赏金最高' },
            { id: 'deadline', label: '即将截止' },
            { id: 'hot', label: '最热门' },
            { id: 'newest', label: '最新发布' },
          ].map((o) => (
            <Chip
              key={o.id}
              size='small'
              label={o.label}
              onClick={() => {
                setOrder(o.id);
                setPage(1);
              }}
              color={order === o.id ? 'primary' : 'default'}
              variant={order === o.id ? 'filled' : 'outlined'}
              sx={{ fontSize: 11 }}
            />
          ))}
        </Box>

        {/* 列表区 */}
        {listQuery.isLoading ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 1.5,
            }}
          >
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <Skeleton key={i} variant='rounded' height={170} />
            ))}
          </Box>
        ) : listQuery.isError ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.disabled' }}>悬赏加载失败</Typography>
          </Box>
        ) : list.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.disabled', fontSize: 14 }}>当前筛选条件下暂无悬赏</Typography>
            <Button
              size='small'
              sx={{ mt: 1, textTransform: 'none' }}
              onClick={() => {
                setSearch('');
                setCategory('');
                setPage(1);
              }}
            >
              清空筛选
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 1.5,
            }}
          >
            {list.map((b) => (
              <DialogBountyCard key={b.id} bounty={b} onClick={() => setDetailId(String(b.id))} />
            ))}
          </Box>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
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
      </DialogContent>

      <BountyDetailDialog open={!!detailId} bountyId={detailId} onClose={() => setDetailId(null)} />
    </Dialog>
  );
}

// 弹层内紧凑卡片
function DialogBountyCard({ bounty, onClick }: { bounty: Bounty; onClick: () => void }) {
  const cover = bounty.cover;
  const categoryLabel = CATEGORY_LABEL[bounty.category as string] ?? bounty.category;
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
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
          boxShadow: (theme) => `0 6px 16px ${alpha(theme.palette.primary.main, 0.12)}`,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: 88,
          background: cover ? `url(${cover}) center/cover` : bounty.gradient,
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.45))' }} />
        {categoryLabel && (
          <Chip
            size='small'
            label={categoryLabel}
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              height: 18,
              fontSize: 9,
              fontWeight: 600,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)',
            }}
          />
        )}
        <Box
          sx={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            px: 0.75,
            py: 0.125,
            borderRadius: 0.5,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.95),
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'monospace',
          }}
        >
          ¥{(bounty.reward / 100).toLocaleString('zh-CN')}
        </Box>
      </Box>
      <Box sx={{ p: 1.25 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: 'text.primary',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 32,
          }}
        >
          {bounty.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, color: 'text.secondary', fontSize: 10 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <GroupIcon sx={{ fontSize: 11 }} />
            <span>{bounty.applicants}</span>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <AccessTimeIcon sx={{ fontSize: 11 }} />
            <span>{bounty.daysLeft} 天</span>
          </Box>
          <Box sx={{ flex: 1 }} />
          <span>{bounty.sponsor}</span>
        </Box>
      </Box>
    </Box>
  );
}