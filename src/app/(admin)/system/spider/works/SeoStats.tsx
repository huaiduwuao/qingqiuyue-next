'use client';

/**
 * 搜索引擎抓取 / 推送的每日计数(后端 internal/seo 记在 Redis,spider-api /workcat/seo 读出)。
 * 不在站长平台验证网站时,这是唯一能看到「搜索引擎来了没有」的地方。
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

interface SeoDay {
  day: string;
  crawl: Record<string, number>;
  push: Record<string, number>;
}

const ENGINE_LABEL: Record<string, string> = {
  baidu: '百度', google: '谷歌', bing: '必应', sogou: '搜狗', so360: '360', bytedance: '头条',
  shenma: '神马', yandex: 'Yandex', duckduckgo: 'DuckDuckGo', petal: '花瓣', apple: 'Apple',
};

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

export function SeoStats() {
  const query = useQuery({
    queryKey: ['spider', 'workcat', 'seo'],
    queryFn: () => spiderClient('/workcat/seo') as Promise<{ list: SeoDay[] }>,
  });
  const rows = query.data?.list ?? [];
  const engines = Array.from(new Set(rows.flatMap((r) => Object.keys(r.crawl)))).sort(
    (a, b) => rows.reduce((s, r) => s + (r.crawl[b] || 0), 0) - rows.reduce((s, r) => s + (r.crawl[a] || 0), 0),
  );
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 600 }}>搜索引擎抓取</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        各搜索引擎每天抓取了多少个直出页面(/w、/hot、/c、站点地图、robots),以及主动推送了多少网址(IndexNow;配了百度令牌时含百度)。
      </Typography>
      {rows.every((r) => sum(r.crawl) + sum(r.push) === 0) ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {query.isLoading ? '加载中…' : '还没有搜索引擎来抓,新站通常要几天到几周'}
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>日期</TableCell>
                <TableCell align="right">抓取合计</TableCell>
                {engines.map((e) => <TableCell key={e} align="right">{ENGINE_LABEL[e] ?? e}</TableCell>)}
                <TableCell align="right">推送</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.day}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{r.day}</TableCell>
                  <TableCell align="right">{sum(r.crawl).toLocaleString()}</TableCell>
                  {engines.map((e) => <TableCell key={e} align="right">{(r.crawl[e] || 0).toLocaleString()}</TableCell>)}
                  <TableCell align="right">{sum(r.push).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
