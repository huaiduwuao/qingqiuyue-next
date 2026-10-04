'use client';

/**
 * 归并待审:算法拿不准的(一条没年份的收录,同标题下有几部不同年份 / 不同类型的作品都可能是它)
 * 交给人判断 —— 「并到这一部」或「都不是」。结论在下一轮归并生效(后端 internal/workcat/review.go)。
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import Pagination from '@mui/material/Pagination';
import Link from '@mui/material/Link';
import { spiderClient } from '@/lib/api/client';
import { getDetailRoute } from '@/lib/contentRoute';

interface ReviewRecord {
  contentId: string;
  title: string;
  type: string;
  year: number;
  source: string;
  label: string;
  cover: string;
  members?: number;
}

interface Review {
  id: number;
  status: string;
  subject: ReviewRecord;
  candidates: ReviewRecord[];
  targetContentId: string;
  decidedAt?: string;
}

const TYPE_LABEL: Record<string, string> = {
  FILM: '电影', TELEPLAY: '剧集', ANIMATION: '动画', DOCUMENTARY: '纪录片', VSHOW: '综艺', SHORT_DRAMA: '短剧',
};

const STATUS_TABS = [
  { v: 'pending', label: '待审' },
  { v: 'merged', label: '已并' },
  { v: 'kept', label: '保持独立' },
  { v: 'auto', label: '已自动解决' },
];

function Rec({ r, highlight }: { r: ReviewRecord; highlight?: boolean }) {
  const href = getDetailRoute(r.type, r.contentId);
  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', minWidth: 0, p: 1, borderRadius: 1, bgcolor: highlight ? 'action.selected' : 'transparent' }}>
      {r.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.cover} alt="" width={36} height={50} style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
      ) : (
        <Box sx={{ width: 36, height: 50, borderRadius: 1, bgcolor: 'action.hover', flexShrink: 0 }} />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
          {href ? <Link href={href} target="_blank" underline="hover" color="inherit">{r.title}</Link> : r.title}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
          {TYPE_LABEL[r.type] ?? r.type} · {r.year || '年份未知'} · {r.label || r.source}
          {r.members && r.members > 1 ? ` · 已含 ${r.members} 条收录` : ''}
        </Typography>
      </Box>
    </Box>
  );
}

export function ReviewQueue() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const key = ['spider', 'workcat', 'reviews', status, page];
  const query = useQuery({
    queryKey: key,
    queryFn: () => spiderClient('/workcat/reviews', { params: { status, page } }) as Promise<{ list: Review[]; total: number }>,
  });
  const decide = useMutation({
    mutationFn: (v: { id: number; action: 'merge' | 'keep'; targetContentId?: string }) =>
      spiderClient(`/workcat/reviews/${v.id}`, { method: 'POST', data: { action: v.action, targetContentId: v.targetContentId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spider', 'workcat', 'reviews'] }),
  });

  const list = query.data?.list ?? [];
  const total = query.data?.total ?? 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Typography sx={{ fontWeight: 600 }}>归并待审</Typography>
        <Typography variant="body2" color="text.secondary">
          算法拿不准的:一条没写年份的收录,同标题下有几部作品都可能是它。选「并到这一部」或「都不是」,下一轮归并生效。
        </Typography>
      </Box>
      <Tabs value={status} onChange={(_, v) => { setStatus(v); setPage(1); }} sx={{ minHeight: 36 }}>
        {STATUS_TABS.map((t) => <Tab key={t.v} value={t.v} label={t.label} sx={{ minHeight: 36, py: 0 }} />)}
      </Tabs>
      {query.error && <Alert severity="error">{(query.error as Error).message}</Alert>}
      {decide.error && <Alert severity="error">{(decide.error as Error).message}</Alert>}
      {!query.isLoading && list.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>没有记录</Typography>
      )}
      {list.map((r) => (
        <Paper key={r.id} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' }, gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>这条收录</Typography>
              <Rec r={r.subject} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>可能是哪一部</Typography>
              {r.candidates.map((cand) => (
                <Box key={cand.contentId} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Rec r={cand} highlight={r.status === 'merged' && r.targetContentId === cand.contentId} />
                  </Box>
                  {r.status === 'pending' && (
                    <Button size="small" variant="outlined" disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: r.id, action: 'merge', targetContentId: cand.contentId })}>
                      并到这一部
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
          {r.status === 'pending' && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" color="inherit" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, action: 'keep' })}>
                都不是,保持独立
              </Button>
            </Box>
          )}
        </Paper>
      ))}
      {total > 20 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination count={Math.ceil(total / 20)} page={page} onChange={(_, p) => setPage(p)} size="small" />
        </Box>
      )}
    </Paper>
  );
}
