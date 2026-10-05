'use client';

// 合集广场 /collections:用户公开的合集 + 付费合集 + 平台编排的歌单,不需要登录。
// 最热 = 买断人数 + 最近在更新(后端 /my-list/square?type=all&sort=hot);最新 = 最近更新。
// 滚到底自动加载下一页。

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import PublicTopBar from '@/components/layout/PublicTopBar';
import { CollectionGrid, COLLECTION_PAGE_SIZE } from '@/components/collection/CollectionGrid';
import { getPublicLists } from '@/apis/my-list';

type Sort = 'hot' | 'new';
type PaidFilter = 'all' | 'paid' | 'free';

const SORTS: { v: Sort; label: string }[] = [
  { v: 'hot', label: '最热' },
  { v: 'new', label: '最新' },
];
const FILTERS: { v: PaidFilter; label: string }[] = [
  { v: 'all', label: '全部' },
  { v: 'paid', label: '付费' },
  { v: 'free', label: '免费' },
];

export default function CollectionSquarePage() {
  const [sort, setSort] = useState<Sort>('hot');
  const [paid, setPaid] = useState<PaidFilter>('all');

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <PublicTopBar title="合集广场" maxWidth="lg" />
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
          创作者整理的作品合集。付费合集可先看前几个作品,买断后看全部,并一并解锁作者本人的付费作品。
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup size="small" exclusive value={sort} onChange={(_, v: Sort | null) => v && setSort(v)} aria-label="排序">
            {SORTS.map((s) => (
              <ToggleButton key={s.v} value={s.v} sx={{ px: 2, textTransform: 'none' }}>
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ToggleButtonGroup size="small" exclusive value={paid} onChange={(_, v: PaidFilter | null) => v && setPaid(v)} aria-label="筛选">
            {FILTERS.map((f) => (
              <ToggleButton key={f.v} value={f.v} sx={{ px: 2, textTransform: 'none' }}>
                {f.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <CollectionGrid
          queryKey={['collection-square', sort, paid]}
          fetchPage={(page) =>
            getPublicLists({
              type: 'all',
              sort,
              paid: paid === 'all' ? undefined : paid === 'paid',
              page,
              size: COLLECTION_PAGE_SIZE,
            })
          }
          emptyText="还没有合集"
        />
      </Box>
    </Box>
  );
}
