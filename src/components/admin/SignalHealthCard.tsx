'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { adminClient } from '@/lib/api/client';

interface SignalHealth {
  events24h: { human: number; bot: number; anon: number };
  /** 近 7 天有行为的作品数 */
  items7d: number;
  /** 其中能在作品库里找到的 */
  linked7d: number;
  joinRate: number;
  lastEventAt?: string | null;
  /** 最近一次阅读数回写更新了多少件作品 */
  readsSynced: number;
  ok: boolean;
  problems: string[];
}

/**
 * 行为信号体检。热度、榜单、画像、阅读数都来自行为事件(后端 internal/signal)。
 * 关键是「关联率」:近 7 天有行为的作品里,能在作品库里找到的比例。2026-09 它掉到过 0 ——
 * 行为还在记,但和内容对不上,所有热榜安静地退化成按 id 排序,没有任何报错。所以这里把它摆出来。
 */
export function SignalHealthCard() {
  const q = useQuery({
    queryKey: ['admin', 'signals', 'health'],
    queryFn: () => adminClient<SignalHealth>('/admin/signals/health', { method: 'GET' }),
    staleTime: 60_000,
    retry: false,
  });
  const h = q.data;
  if (q.isError || !h) return null;

  const cells: [string, string][] = [
    ['24 小时事件', `真人 ${h.events24h.human} · 匿名 ${h.events24h.anon} · AI ${h.events24h.bot}`],
    ['关联率(7 天)', `${Math.round(h.joinRate * 100)}% · ${h.linked7d}/${h.items7d} 件作品`],
    ['最后一条事件', h.lastEventAt ? String(h.lastEventAt).replace('T', ' ').slice(0, 16) : '—'],
    ['阅读数回写', `上一轮更新 ${h.readsSynced} 件`],
  ];

  return (
    <Alert severity={h.ok ? 'success' : 'error'} sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>{h.ok ? '行为信号正常' : '行为信号异常:热度与榜单可能正在失效'}</Typography>
      {h.problems.map((p) => (
        <Typography key={p} sx={{ fontSize: 13 }}>
          {p}
        </Typography>
      ))}
      <Box sx={{ display: 'grid', gap: 1, mt: 0.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
        {cells.map(([k, v]) => (
          <Box key={k}>
            <Typography sx={{ fontSize: 11.5, opacity: 0.75 }}>{k}</Typography>
            <Typography sx={{ fontSize: 13 }}>{v}</Typography>
          </Box>
        ))}
      </Box>
    </Alert>
  );
}
