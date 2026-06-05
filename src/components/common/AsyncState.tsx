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

export function AsyncState<T>({
  query,
  isEmpty,
  emptyText = '暂无内容',
  emptyHint,
  emptyVariant = 'inbox',
  skeletonCount = 6,
  skeletonHeight = 80,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; refetch: () => void; data: T | undefined };
  isEmpty?: (data: T) => boolean;
  emptyText?: string;
  emptyHint?: string;
  emptyVariant?: EmptyVariant;
  skeletonCount?: number;
  skeletonHeight?: number;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={skeletonHeight}
            sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
          />
        ))}
      </Box>
    );
  }

  if (query.isError) {
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
          }}
        >
          加载失败,请检查网络后重试
        </Alert>
      </Box>
    );
  }

  if (isEmpty && query.data && isEmpty(query.data)) {
    return <EmptyState text={emptyText} hint={emptyHint} variant={emptyVariant} />;
  }

  if (!query.data) return null;

  return <>{children(query.data)}</>;
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
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sx={{ fontSize: 44, color: 'rgba(255,255,255,0.25)' }} />
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
        {text}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
