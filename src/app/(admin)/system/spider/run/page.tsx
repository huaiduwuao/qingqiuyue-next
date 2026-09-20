'use client';

/**
 * 运行通用爬虫 —— 站点无关入口。
 *
 * 页面布局:
 *   - 顶栏:已注册源的快速下拉,直接跳到 RunCrawlerDialog(已固定 source_domain)
 *   - 主体:RunCrawlerDialog 全模式(用户自由填域名)
 *   - 底部:启动后批量任务实时进度链接
 *
 * 设计原则:无任何平台名字面量;新增 / 删除 module_source 都不影响页面。
 * 入口路由 /admin/system/spider/run(可被 B5 dashboard shortcut 引用)
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { listSources } from '@/apis/spider';
import { RunCrawlerDialog } from '@/components/spider/RunCrawlerDialog';

const LIST_KEY = ['spider', 'run', 'sources'];

export default function SpiderRunPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fixedDomain, setFixedDomain] = useState<string | undefined>();

  const sourcesQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => listSources({ page: 1, pageSize: 100 }),
    staleTime: 30 * 1000,
  });

  const openFree = () => {
    setFixedDomain(undefined);
    setDialogOpen(true);
  };

  const openForDomain = (domain: string) => {
    setFixedDomain(domain);
    setDialogOpen(true);
  };

  const onSuccess = (batchId: number) => {
    // 跳到批量任务实时进度页(由该页订阅 WebSocket)
    router.push(`/system/spider/batch/${batchId}/stats`);
  };

  const sources = (sourcesQuery.data?.list ?? []) as Array<{
    id: number;
    name: string;
    domain: string;
    category: string;
    status: number;
    itemCount?: number;
    lastCrawlAt?: string;
  }>;

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5">运行通用爬虫</Typography>
          <Typography variant="body2" color="text.secondary">
            站点无关入口:从 module_source 里任选一条或多条站点,启动 RuleEngine 全站爬取。
            站点特征化配置(列表/详情选择器、browser.enabled、Cloudflare / INITIAL_STATE 等)都在 module_template.content 里,此处不感知。
          </Typography>
        </Box>
        <Button variant="outlined" onClick={openFree}>自由输入域名</Button>
      </Stack>

      <Alert severity="info">
        启动后会创建 batch_job 并在任务管理页生成实时进度;点击列表里任意源右侧的播放按钮,
        直接以该源为预设站点启动。
      </Alert>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>已注册的模块源</Typography>
        {sourcesQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">加载中…</Typography>
        ) : sourcesQuery.isError ? (
          <Alert severity="error">加载源列表失败:{(sourcesQuery.error as any)?.message}</Alert>
        ) : sources.length === 0 ? (
          <Alert severity="warning">
            还没有任何已注册的模块源。请通过 源管理 页面添加,或在 sql/postgresql/seed_sources.sql 里追加 INSERT。
          </Alert>
        ) : (
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {sources.map((src) => (
              <Paper
                key={src.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  opacity: src.status === 0 ? 0.5 : 1,
                }}
              >
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">{src.name}</Typography>
                  <Chip
                    size="small"
                    label={src.status === 1 ? 'active' : 'disabled'}
                    color={src.status === 1 ? 'success' : 'default'}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">{src.domain}</Typography>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Chip size="small" variant="outlined" label={src.category || '-'} />
                    {typeof src.itemCount === 'number' && (
                      <Typography component="span" variant="caption" sx={{ ml: 1 }} color="text.secondary">
                        {src.itemCount} 条内容
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    color="primary"
                    disabled={src.status === 0}
                    onClick={() => openForDomain(src.domain)}
                    title="以该源启动批量任务"
                  >
                    <PlayArrowIcon />
                  </IconButton>
                </Stack>
                {src.lastCrawlAt && (
                  <Typography variant="caption" color="text.secondary">
                    最近抓取:{src.lastCrawlAt}
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      <RunCrawlerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fixedSourceDomain={fixedDomain}
        onSuccess={onSuccess}
      />
    </Box>
  );
}
