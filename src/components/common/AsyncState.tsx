'use client';

import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import RefreshIcon from '@mui/icons-material/Refresh';
import SentimentDissatisfiedOutlinedIcon from '@mui/icons-material/SentimentDissatisfiedOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

type EmptyVariant = 'inbox' | 'sad';

function describeError(err: unknown): string {
  if (!err) return '未知错误';
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as { message?: string; status?: number; code?: string };
    if (e.message) return e.message;
    if (e.status) return `HTTP ${e.status}`;
    if (e.code) return `code ${e.code}`;
  }
  return '未知错误';
}

// 支持 isFetching 的类型
type AsyncQuery<T> = {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
  data: T | undefined;
  error?: unknown;
};

export function AsyncState<T>({
  query,
  isEmpty,
  emptyText = '暂无内容',
  emptyHint,
  emptyVariant = 'inbox',
  skeletonCount = 6,
  skeletonHeight = 80,
  errorHint,
  children,
}: {
  query: AsyncQuery<T>;
  isEmpty?: (data: T) => boolean;
  emptyText?: string;
  emptyHint?: string;
  emptyVariant?: EmptyVariant;
  skeletonCount?: number;
  skeletonHeight?: number;
  errorHint?: string;
  children: (data: T) => ReactNode;
}) {
  // 初始加载骨架屏
  if (query.isLoading) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={skeletonHeight}
            sx={{ bgcolor: 'action.hover' }}
          />
        ))}
      </Box>
    );
  }

  // 错误状态
  if (query.isError) {
    const msg = describeError(query.error);
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          variant="outlined"
          action={
            <Button
              size="small"
              variant="contained"
              startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
              onClick={() => query.refetch()}
              sx={{
                bgcolor: 'rgba(254, 44, 85, 0.18)',
                color: 'primary.main',
                boxShadow: 'none',
                '&:hover': { bgcolor: 'rgba(254, 44, 85, 0.28)', boxShadow: 'none' },
              }}
            >
              重试
            </Button>
          }
          sx={{
            bgcolor: 'rgba(254, 44, 85, 0.06)',
            border: '1px solid rgba(254, 44, 85, 0.3)',
            color: 'text.primary',
            '& .MuiAlert-icon': { color: 'primary.main' },
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
              {errorHint ?? '加载失败，请稍后重试'}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, fontFamily: 'monospace' }}>
              {msg}
            </Typography>
          </Box>
        </Alert>
      </Box>
    );
  }

  // 有数据：加载更多时保留旧数据
  if (query.data) {
    // 空状态检查
    if (isEmpty?.(query.data)) {
      return <EmptyState text={emptyText} hint={emptyHint} variant={emptyVariant} />;
    }
    // 渲染数据（加载更多时也保留显示）
    return <>{children(query.data)}</>;
  }

  // 无数据且无加载
  return <EmptyState text={emptyText} hint={emptyHint} variant={emptyVariant} />;
}

export function EmptyState({
  text = '暂无内容',
  hint,
  variant = 'inbox',
}: {
  text?: string;
  hint?: string;
  variant?: EmptyVariant;
}) {
  const Icon = variant === 'sad' ? SentimentDissatisfiedOutlinedIcon : InboxOutlinedIcon;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 88,
          height: 88,
          borderRadius: 2.5,
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sx={{ fontSize: 44, color: 'text.disabled' }} />
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
        {text}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
