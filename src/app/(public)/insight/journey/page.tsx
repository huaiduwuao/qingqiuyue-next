'use client';

// 人生感悟 · 回廊(?key=)。专题的互动影像形式:给一个处境,一路做选择,
// 每一步揭出的是主题下按字面命中的作品,走到结局拿到一段编者按。
// 舞台见 components/journey/JourneyStage.tsx,剧本见 qingqiuyue-go internal/journey。
//
// 静态导出不能用 [key] 动态段,所以用 ?key=,且 useSearchParams 必须包在 Suspense 里。

import React, { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import DetailHeader from '@/components/detail/DetailHeader';
import { EmptyState } from '@/components/common/AsyncState';
import JourneyStage from '@/components/journey/JourneyStage';
import { script as fetchScript } from '@/apis/journey';
import { overview } from '@/apis/insight';
import { useAuth } from '@/contexts/AuthContext';

function JourneyInner() {
  const key = useSearchParams().get('key') || '';
  const { status } = useAuth();
  // 登录态定下来再取:带着身份取才有「我上次走到哪」
  const q = useQuery({
    queryKey: ['journey-script', key, status === 'authenticated'],
    queryFn: () => fetchScript(key),
    enabled: !!key && status !== 'loading',
    staleTime: 5 * 60_000,
    retry: false,
  });
  const ov = useQuery({ queryKey: ['insight', 'overview'], queryFn: overview, staleTime: 60 * 60_000 });

  if (!key || q.isError) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <DetailHeader title="回廊" />
        <EmptyState text="没有找到这条回廊" />
      </Box>
    );
  }
  if (!q.data) return <Box sx={{ minHeight: '100dvh', bgcolor: '#0c0c10' }} />;

  const theme = q.data.script.theme;
  const group = ov.data?.groups.find((g) => g.themes.some((t) => t.key === theme))?.key;
  return <JourneyStage key={key} script={q.data.script} mine={q.data.mine} group={group} />;
}

export default function InsightJourneyPage() {
  return (
    <Suspense fallback={null}>
      <JourneyInner />
    </Suspense>
  );
}
