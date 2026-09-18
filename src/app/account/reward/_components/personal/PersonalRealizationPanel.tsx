'use client';

/** 我的工作台 · 我的实现:我交付并通过验收的任务,以及结账后分到的赏金。 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import HandshakeIcon from '@mui/icons-material/Handshake';
import RealizationList from '@/components/reward/RealizationList';
import { listRealizations } from '@/apis/team';

interface Props {
  currentUserId: number;
  onOpenTab?: () => void;
}

export default function PersonalRealizationPanel({ currentUserId, onOpenTab }: Props) {
  const query = useQuery({
    queryKey: ['realization', 'me', 'recent', currentUserId],
    queryFn: () => listRealizations({ userId: Number(currentUserId), pageSize: 5 }),
    enabled: !!currentUserId,
  });

  return (
    <Box sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        <HandshakeIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>我的实现</Typography>
        {onOpenTab && (query.data?.total ?? 0) > 0 && (
          <Button size="small" variant="text" sx={{ textTransform: 'none' }} onClick={onOpenTab}>
            全部 {query.data?.total}
          </Button>
        )}
      </Box>
      <RealizationList
        items={query.data?.list || []}
        empty={query.isFetching ? '加载中…' : '还没有验收通过的交付。去赏金广场认领一个任务,交付通过后会出现在这里。'}
      />
    </Box>
  );
}
