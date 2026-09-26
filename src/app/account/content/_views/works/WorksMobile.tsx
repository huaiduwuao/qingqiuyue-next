'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Fab from '@mui/material/Fab';
import Button from '@mui/material/Button';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { getCreatorWorks, type WorksItem } from '@/apis/creator';
import { CoverImage } from '@/components/common/CoverImage';
import { getDetailRoute } from '@/lib/contentRoute';
import { TYPE_LABEL as CONTENT_TYPE_LABEL } from '@/lib/contentType.gen';
import { MobileSection, MobileListRow, MoreLink } from '@/components/mobile/MobileSection';
import { useActiveTab } from '../../ActiveTabContext';
import MobileFilterBar, { MOBILE_FAB_SX } from './MobileFilterBar';

const PAGE_SIZE = 20;

const fmt = (n?: number) => {
  const v = Number(n) || 0;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}w`;
  return v.toLocaleString();
};

const fmtTime = (s?: string) =>
  s ? new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * 手机上的作品管理:只有作品列表。
 * 电脑版顶上的数据中心三块(总览、优质作品榜、内容分布)是「数据中心」页的内容,手机上不重复堆,
 * 在计数行右侧给一个「数据中心 ›」;DataGrid 换成单列作品行,点行进作品详情。
 */
const STATUS_TEXT: Record<string, string> = {
  UN_PUBLISH: '已下架',
  REVIEWING: '审核中',
  REJECTED: '未通过',
  SCHEDULED: '定时发布',
  DRAFT: '草稿',
  PRIVATE: '私密',
};

export default function WorksMobile({
  type,
  setType,
  status,
  setStatus,
  typeOptions,
  statusOptions,
}: {
  type: string;
  setType: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  typeOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const { setActiveTab } = useActiveTab();
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);

  const listQ = useInfiniteQuery({
    queryKey: ['account', 'works', 'mobile', { type, status }],
    queryFn: ({ pageParam }) =>
      getCreatorWorks({
        contentType: type || undefined,
        status: status || undefined,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((s, p) => s + (p.list?.length ?? 0), 0);
      return (last.list?.length ?? 0) >= PAGE_SIZE && loaded < (last.total ?? 0) ? all.length + 1 : undefined;
    },
    staleTime: 30_000,
  });
  const items = (listQ.data?.pages.flatMap((p) => p.list ?? []) ?? []) as WorksItem[];
  const total = listQ.data?.pages[0]?.total ?? items.length;

  // 滚到底自动加载下一页
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listQ;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '300px' },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const statusLabel = statusOptions.find((o) => o.value === status)?.label;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 8 }}>
      <MobileFilterBar
        first
        chips={typeOptions.map((o) => ({ id: o.value, label: o.value ? o.label : '全部' }))}
        value={type}
        onChange={setType}
        actions={
          <>
            <IconButton
              size="small"
              aria-label="按状态筛选"
              onClick={(e) => setStatusAnchor(e.currentTarget)}
              sx={{ color: status ? 'primary.main' : 'text.secondary' }}
            >
              <FilterListRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Menu anchorEl={statusAnchor} open={!!statusAnchor} onClose={() => setStatusAnchor(null)}>
              {statusOptions.map((o) => (
                <MenuItem
                  key={o.value || 'all'}
                  selected={o.value === status}
                  onClick={() => {
                    setStatus(o.value);
                    setStatusAnchor(null);
                  }}
                  sx={{ fontSize: 14 }}
                >
                  {o.label}
                </MenuItem>
              ))}
            </Menu>
            <IconButton size="small" aria-label="刷新" onClick={() => listQ.refetch()} sx={{ color: 'text.secondary' }}>
              <RefreshRoundedIcon sx={{ fontSize: 20, ...(listQ.isRefetching && { animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }) }} />
            </IconButton>
          </>
        }
        footer={
          <>
            <Box component="span" sx={{ flex: 1 }}>
              共 {total} 件作品{status ? ` · ${statusLabel}` : ''}
            </Box>
            <MoreLink label="数据中心" onClick={() => setActiveTab('data')} />
          </>
        }
      />

      <MobileSection flush>
        {listQ.isLoading ? (
          <Box sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </Box>
        ) : listQ.isError ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>作品加载失败</Typography>
            <Button variant="text" size="small" onClick={() => listQ.refetch()} sx={{ mt: 0.5 }}>
              重试
            </Button>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>
              {type || status ? '当前筛选下没有作品' : '还没有作品'}
            </Typography>
          </Box>
        ) : (
          items.map((w, i) => {
            const route = getDetailRoute(w.contentType, w.id);
            // module_content.status 是大写枚举,另有一批老数据是小写 active(等同已发布)
            const live = w.status === 'PUBLISH' || w.status === 'active';
            const st = live ? '已发布' : (STATUS_TEXT[w.status] ?? w.status);
            return (
              <MobileListRow
                key={`${String(w.id)}-${i}`}
                divider={i > 0}
                onClick={route ? () => router.push(route) : undefined}
                leading={
                  <Box sx={{ width: 48, height: 48, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0, bgcolor: 'action.hover' }}>
                    {w.coverUrl && <CoverImage src={w.coverUrl} sx={{ width: 48, height: 48, objectFit: 'cover' }} />}
                  </Box>
                }
                title={w.title || '未命名作品'}
                subtitle={
                  <>
                    <Box component="span" sx={{ color: live ? 'success.main' : 'text.secondary' }}>
                      {st}
                    </Box>
                    {' · '}
                    {CONTENT_TYPE_LABEL[w.contentType] || w.contentType}
                    {` · 阅读 ${fmt(w.readNum)} · 赞 ${fmt(w.agreeNum)} · 评 ${fmt(w.commentNum)}`}
                    {w.publishTime ? ` · ${fmtTime(w.publishTime)}` : ''}
                  </>
                }
              />
            );
          })
        )}
        <Box ref={sentinel} sx={{ height: '1px' }} />
        {isFetchingNextPage && (
          <Box sx={{ px: 1.75, pb: 1.5 }}>
            <Skeleton variant="rounded" height={48} />
          </Box>
        )}
        {!hasNextPage && items.length > 0 && (
          <Typography sx={{ textAlign: 'center', py: 1.5, fontSize: 12, color: 'text.disabled', borderTop: '1px solid', borderColor: 'divider' }}>
            没有更多了
          </Typography>
        )}
      </MobileSection>

      <Fab variant="extended" color="primary" onClick={() => setActiveTab('hd-publish')} sx={MOBILE_FAB_SX}>
        <AddRoundedIcon sx={{ mr: 0.5 }} />
        发布作品
      </Fab>
    </Box>
  );
}
