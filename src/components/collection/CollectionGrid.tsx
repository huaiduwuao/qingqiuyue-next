'use client';

// 合集卡片网格:合集广场(/collections)和用户主页的「合集」共用。
// 分页滚到底自动加载(useAutoLoad),不放「加载更多」按钮;加载失败时停住给「重试」,
// 否则仍在可视区的哨兵会无限重试。

import React from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import { CoverImage } from '@/components/common/CoverImage';
import { useAutoLoad } from '@/hooks/useAutoLoad';
import { collectionHref, type MyListItem, type MyListPageResponse } from '@/apis/my-list';

export const COLLECTION_PAGE_SIZE = 24;

type PageResult = MyListPageResponse & { page: number; size: number };

/** 合集卡片:封面、价格 / 已解锁角标、名称、作者与条目数 */
export function CollectionCard({ item, showOwner = true }: { item: MyListItem; showOwner?: boolean }) {
  const cover = item.coverUrl || item.covers?.[0] || '';
  const paid = (item.price ?? 0) > 0;
  return (
    <Box
      component={Link}
      href={collectionHref(item.id)}
      sx={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'border-color 0.15s',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: 'action.hover' }}>
        {cover && <CoverImage src={cover} alt={item.name} sx={{ width: '100%', height: '100%' }} />}
        {paid && (
          <Box
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              bgcolor: item.unlocked ? 'rgba(0,0,0,0.6)' : 'rgba(254, 44, 85, 0.9)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {item.unlocked ? (
              <>
                <LockOpenRoundedIcon sx={{ fontSize: 11 }} />
                已解锁
              </>
            ) : (
              <>
                <DiamondRoundedIcon sx={{ fontSize: 11 }} />
                {item.price} 钻
              </>
            )}
          </Box>
        )}
        <Box
          sx={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            px: 0.75,
            py: 0.25,
            borderRadius: 0.75,
            bgcolor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {item.itemCount ?? 0} 个作品
        </Box>
      </Box>
      <Box sx={{ p: 1 }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
          {item.name}
        </Typography>
        <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
          {item.official ? '平台精选' : showOwner && item.ownerName ? item.ownerName : item.description || ' '}
          {paid && (item.unlockCount ?? 0) > 0 ? ` · ${item.unlockCount} 人已买` : ''}
        </Typography>
      </Box>
    </Box>
  );
}

interface GridProps {
  queryKey: readonly unknown[];
  fetchPage: (page: number) => Promise<PageResult>;
  emptyText: string;
  showOwner?: boolean;
  /** 列表为空时整块不渲染(主页上没合集就不占位) */
  hideWhenEmpty?: boolean;
  /** 总数变化时通知外层(主页标题上显示合集数) */
  onTotal?: (total: number) => void;
}

/** 分页合集网格:useInfiniteQuery + 滚到底自动加载 */
export function CollectionGrid({ queryKey, fetchPage, emptyText, showOwner = true, hideWhenEmpty, onTotal }: GridProps) {
  const q = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const size = last.size || COLLECTION_PAGE_SIZE;
      return last.page * size < last.total ? last.page + 1 : undefined;
    },
  });
  const items = q.data?.pages.flatMap((p) => p.list ?? []) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  // 拉下一页失败时停住,等用户点重试
  const failed = q.isFetchNextPageError;
  const sentinel = useAutoLoad(!!q.hasNextPage && !failed, q.isFetchingNextPage, () => q.fetchNextPage());

  React.useEffect(() => {
    if (q.isSuccess) onTotal?.(total);
  }, [q.isSuccess, total, onTotal]);

  if (q.isLoading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={150} />
        ))}
      </Box>
    );
  }
  if (q.isError && items.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 13, color: 'text.disabled', mb: 1 }}>合集加载失败</Typography>
        <Button size="small" onClick={() => q.refetch()} sx={{ textTransform: 'none' }}>
          重试
        </Button>
      </Box>
    );
  }
  if (items.length === 0) {
    if (hideWhenEmpty) return null;
    return <Typography sx={{ fontSize: 13, color: 'text.disabled', py: 4, textAlign: 'center' }}>{emptyText}</Typography>;
  }
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
        {items.map((it) => (
          <CollectionCard key={String(it.id)} item={it} showOwner={showOwner} />
        ))}
      </Box>
      <Box ref={sentinel} sx={{ height: '1px' }} />
      {q.isFetchingNextPage && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <CircularProgress size={18} />
        </Box>
      )}
      {failed && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Button size="small" onClick={() => q.fetchNextPage()} sx={{ textTransform: 'none' }}>
            加载失败,重试
          </Button>
        </Box>
      )}
    </>
  );
}
