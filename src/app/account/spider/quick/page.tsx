'use client';

// 通用爬虫快速入口 /account/spider/quick
//
// G2:
//   - 小说"搜索即匹配正文源并批量回补章节"
//   - 影视"输入任意小影视站 URL → 嗅探 → .m3u8/.mp4 直链"
//
// 给运营/编辑用的轻量入口,后台源配置页配置好后即可用。

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import { CoverImage } from '@/components/common/CoverImage';
import PublicTopBar from '@/components/layout/PublicTopBar';
import {
  searchAndCrawlNovel,
  resolveStream,
  type SearchAndCrawlResult,
  type ResolveStreamResult,
} from '@/apis/spider';

export default function QuickSpiderPage() {
  const [tab, setTab] = useState<'novel' | 'stream'>('novel');

  return (
    <Box>
      <PublicTopBar />
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
          通用爬虫快速入口
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          小说按书名在已配置源里自动匹配并批量回补章节正文;
          影视输入任意小影视站 URL,用无头浏览器嗅探 .m3u8/.mp4 直链。
        </Typography>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab value="novel" label="小说搜索回补" icon={<AutoStoriesRoundedIcon />} iconPosition="start" />
            <Tab value="stream" label="影视直链嗅探" icon={<MovieRoundedIcon />} iconPosition="start" />
          </Tabs>

          {tab === 'novel' && <NovelPanel />}
          {tab === 'stream' && <StreamPanel />}
        </Card>
      </Container>
    </Box>
  );
}

// ─── 小说 ───
function NovelPanel() {
  const [keyword, setKeyword] = useState('');
  const [author, setAuthor] = useState('');
  const [maxChapters, setMaxChapters] = useState('100');
  const [result, setResult] = useState<SearchAndCrawlResult | null>(null);

  const m = useMutation({
    mutationFn: () =>
      searchAndCrawlNovel({
        keyword: keyword.trim(),
        author: author.trim() || undefined,
        maxChapters: Number(maxChapters) || 100,
      }),
    onSuccess: (res) => setResult(res as SearchAndCrawlResult),
  });

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          label="书名(必填)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          fullWidth
          size="small"
          required
        />
        <TextField
          label="作者(可选)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          size="small"
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="最多章数"
          type="number"
          value={maxChapters}
          onChange={(e) => setMaxChapters(e.target.value)}
          size="small"
          sx={{ minWidth: 100 }}
        />
      </Stack>
      <Box>
        <Button
          variant="contained"
          onClick={() => m.mutate()}
          disabled={!keyword.trim() || m.isPending}
          startIcon={m.isPending ? <CircularProgress size={14} color="inherit" /> : <AutoStoriesRoundedIcon />}
          sx={{ textTransform: 'none' }}
        >
          {m.isPending ? '匹配并抓取中…' : '搜即抓'}
        </Button>
      </Box>

      {result && <NovelResultView result={result} />}
    </Stack>
  );
}

function NovelResultView({ result }: { result: SearchAndCrawlResult }) {
  if (!result.success) {
    return <Alert severity={result.error?.includes('未找到') ? 'info' : 'warning'}>{result.error || '抓取失败'}</Alert>;
  }
  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1.5 }}>
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip size="small" color="success" label="成功" />
          {result.matchedSource && <Chip size="small" label={result.matchedSource} />}
          {result.chaptersAdded !== undefined && (
            <Chip size="small" color="primary" label={`已回补 ${result.chaptersAdded} 章`} />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          关键词:{result.keyword} · 匹配源:{result.matchedSource || '—'} · 耗时:{result.elapsedSeconds?.toFixed(1)}s
        </Typography>
        {result.novelId && (
          <Typography variant="caption" color="text.disabled">
            小说 ID:{result.novelId} · 详情页:{result.bookURL}
          </Typography>
        )}
        {result.skipped?.map((s, i) => (
          <Typography key={i} variant="caption" color="warning.main">{s}</Typography>
        ))}
      </Stack>
    </Box>
  );
}

// ─── 影视 ───
function StreamPanel() {
  const [url, setUrl] = useState('');
  const [extraWait, setExtraWait] = useState('');
  const [result, setResult] = useState<ResolveStreamResult | null>(null);

  const m = useMutation({
    mutationFn: () =>
      resolveStream({
        url: url.trim(),
        extraWaitMs: extraWait ? Number(extraWait) : undefined,
      }),
    onSuccess: (res) => setResult(res as ResolveStreamResult),
  });

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          label="任意小影视站/分享页/短链 URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          fullWidth
          size="small"
          required
          placeholder="https://..."
        />
        <TextField
          label="额外等待 ms"
          type="number"
          value={extraWait}
          onChange={(e) => setExtraWait(e.target.value)}
          size="small"
          sx={{ minWidth: 140 }}
        />
      </Stack>
      <Box>
        <Button
          variant="contained"
          onClick={() => m.mutate()}
          disabled={!url.trim() || m.isPending}
          startIcon={m.isPending ? <CircularProgress size={14} color="inherit" /> : <LinkRoundedIcon />}
          sx={{ textTransform: 'none' }}
        >
          {m.isPending ? '嗅探中…' : '嗅探直链'}
        </Button>
      </Box>

      {result && <StreamResultView result={result} />}
    </Stack>
  );
}

function StreamResultView({ result }: { result: ResolveStreamResult }) {
  if (!result.success) {
    return (
      <Alert severity="warning">
        {result.error || '嗅探失败'}
        {result.method && (
          <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
            方法:{result.method} · 耗时:{result.elapsedMs}ms
          </Typography>
        )}
      </Alert>
    );
  }
  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1.5 }}>
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" color="success" label="嗅探成功" />
          <Chip size="small" variant="outlined" label={result.method || 'browser_parse'} />
        </Box>
        {result.title && (
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{result.title}</Typography>
        )}
        {result.author && (
          <Typography variant="body2" color="text.secondary">作者:{result.author}</Typography>
        )}
        <Divider />
        <Typography variant="caption" color="text.disabled">播放直链</Typography>
        <TextField
          value={result.playUrl || result.realUrl || ''}
          size="small"
          fullWidth
          slotProps={{ input: { readOnly: true } }}
          sx={{ '& textarea': { fontSize: 11, fontFamily: 'monospace' } }}
        />
        {result.coverUrl && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.disabled">封面</Typography>
            <CoverImage src={result.coverUrl} alt="cover" sx={{ maxWidth: 200, borderRadius: 1, mt: 0.5 }} />
          </Box>
        )}
        {(result.width || result.height) && (
          <Typography variant="caption" color="text.disabled">
            {result.width}×{result.height} · 时长 {Math.round((result.durationSec || 0) * 10) / 10}s · 耗时 {result.elapsedMs}ms
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
