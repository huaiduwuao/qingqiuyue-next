'use client';

/**
 * 「内容权威能看」每日指标(后端 internal/workcat/daily.go,每轮归并写当天一行)。
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Box from '@mui/material/Box';
import { spiderClient } from '@/lib/api/client';

interface DailyRow {
  day: string;
  works: number;
  watchableWorks: number;
  mergedWorks: number;
  withAuthority: number;
  hot500: number;
  hot500Watchable: number;
  playOk7d: number;
  playFail7d: number;
  searchTotal: number;
  searchFirstUsable: number;
  realWorks?: number;
  realWatchable?: number;
}

function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${((n / d) * 100).toFixed(1)}%`;
}

export function DailyTrend() {
  const query = useQuery({
    queryKey: ['spider', 'workcat', 'daily'],
    queryFn: () => spiderClient('/workcat/daily', { params: { days: 30 } }) as Promise<{ list: DailyRow[] }>,
  });
  const rows = query.data?.list ?? [];
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 600 }}>每日指标</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        每轮归并结束记一次当天的数(同一天以最后一次为准)。搜索首条能看率 = 搜索第一页的第一条结果站内能看 / 能读的比例。
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {query.isLoading ? '加载中…' : '还没有记录,下一轮归并后出现'}
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>日期</TableCell>
                <TableCell align="right">真人点开作品能看率</TableCell>
                <TableCell align="right">搜索首条能看率</TableCell>
                <TableCell align="right">近 7 天播放成功率</TableCell>
                <TableCell align="right">能看的作品</TableCell>
                <TableCell align="right">有权威出处</TableCell>
                <TableCell align="right">归并作品</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.day}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{r.day}</TableCell>
                  <TableCell align="right">
                    {pct(r.realWatchable ?? 0, r.realWorks ?? 0)}
                    {(r.realWorks ?? 0) > 0 && <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}> ({r.realWorks} 部)</Box>}
                  </TableCell>
                  <TableCell align="right">
                    {pct(r.searchFirstUsable, r.searchTotal)}
                    {r.searchTotal > 0 && <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}> ({r.searchTotal} 次)</Box>}
                  </TableCell>
                  <TableCell align="right">{pct(r.playOk7d, r.playOk7d + r.playFail7d)}</TableCell>
                  <TableCell align="right">{r.watchableWorks.toLocaleString()}</TableCell>
                  <TableCell align="right">{r.withAuthority.toLocaleString()}</TableCell>
                  <TableCell align="right">{r.mergedWorks.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
