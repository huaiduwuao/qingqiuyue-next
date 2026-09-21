'use client';

// 通用内容补全面板 —— /account/spider/quick 的第三个 tab。
//
// 后端 content_backfill 框架:任意已收录内容 (module_content.id) 都能补。
// 按 content_type 自动选抓取方式 —— NOVEL 抓章节正文、MUSIC 存音频、
// COMICS 抓页面、FILM/VIDEO 只嗅探播放直链(不下载)。调用方不关心类型。

import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SyncProblemRoundedIcon from '@mui/icons-material/SyncProblemRounded';
import { CoverImage } from '@/components/common/CoverImage';
import {
  startContentBackfill,
  getContentBackfillStatus,
  listContentBackfillRecent,
  type ContentBackfillRecentItem,
} from '@/apis/spider';
import { myPage, type ModuleContentItem } from '@/apis/module-content';
import { formatApiError } from '@/lib/api/client';

const STATUS_META: Record<string, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  pending: { label: '排队中', color: 'default' },
  running: { label: '运行中', color: 'info' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  stalled: { label: '停滞', color: 'warning' },
  skipped: { label: '跳过', color: 'warning' },
};

const STRATEGY_OPTIONS = [
  { value: 'revisit', label: '重抓已有源(revisit)' },
  { value: 'discover', label: '跨源搜索(discover)' },
];

export default function BackfillPanel() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<ModuleContentItem | null>(null);
  const [authorHint, setAuthorHint] = useState('');
  const [strategy, setStrategy] = useState('revisit');
  const [taskId, setTaskId] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // 按标题搜内容 —— myPage 是公开浏览列表,不受数据权限限制(搜得全库)
  const searchQuery = useQuery({
    queryKey: ['backfill-content-search', title],
    queryFn: () => myPage({ title: title.trim(), page: 1, pageSize: 20 }),
    enabled: title.trim().length >= 2,
    staleTime: 30_000,
  });
  const options = searchQuery.data?.list ?? [];

  const startM = useMutation({
    mutationFn: () =>
      startContentBackfill({
        contentId: String(picked!.id),
        strategies: [strategy],
        authorHint: authorHint.trim() || undefined,
      }),
    onSuccess: (res) => {
      setTaskId(res.task_id);
      setErrMsg(null);
      qc.invalidateQueries({ queryKey: ['backfill-recent'] });
    },
    onError: (e) => setErrMsg(formatApiError(e) || '发起失败'),
  });

  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={<SyncProblemRoundedIcon />}>
        选中一条已收录内容,系统会按它的类型自动补抓缺失部分:
        小说补章节正文、音乐补音频、漫画补页面、影视只嗅探播放直链(不下载文件)。
      </Alert>

      {/* 选内容:按标题搜 */}
      <Autocomplete
        size="small"
        options={options}
        loading={searchQuery.isFetching}
        value={picked}
        onChange={(_, v) => setPicked(v)}
        getOptionLabel={(o) => o.title || `#${o.id}`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText={title.trim().length < 2 ? '输入至少 2 个字开始搜索' : '没搜到匹配的内容'}
        renderInput={(params) => (
          <TextField
            {...params}
            label="搜索内容(按标题)"
            placeholder="例如:求魔"
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
        renderOption={(props, o) => (
          <Box component="li" {...props} key={o.id}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%', minWidth: 0 }}>
              <CoverImage
                src={o.coverUrl || o.cover}
                alt={o.title}
                sx={{ width: 32, height: 44, borderRadius: 0.5, flexShrink: 0 }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" noWrap>
                  {o.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {o.contentType}
                  {o.author ? ` · ${o.author}` : ''} · #{o.id}
                </Typography>
              </Box>
            </Stack>
          </Box>
        )}
      />

      {picked && (
        <Typography variant="caption" color="text.secondary">
          将补全:<strong>{picked.title}</strong> · 类型 {picked.contentType} · ID {picked.id}
        </Typography>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          select
          label="策略"
          size="small"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {STRATEGY_OPTIONS.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="作者提示(可选)"
          size="small"
          value={authorHint}
          onChange={(e) => setAuthorHint(e.target.value)}
          sx={{ minWidth: 160 }}
          helperText="discover 策略按它缩小搜索范围"
        />
      </Stack>

      <Box>
        <Button
          variant="contained"
          onClick={() => startM.mutate()}
          disabled={!picked || startM.isPending}
          startIcon={startM.isPending ? <CircularProgress size={14} color="inherit" /> : <SyncProblemRoundedIcon />}
          sx={{ textTransform: 'none' }}
        >
          {startM.isPending ? '发起中…' : '开始补全'}
        </Button>
      </Box>

      {errMsg && <Alert severity="error">{errMsg}</Alert>}
      {taskId && (
        <BackfillTaskCard
          taskId={taskId}
          onDone={() => qc.invalidateQueries({ queryKey: ['backfill-recent'] })}
        />
      )}

      <Divider sx={{ my: 1 }} />
      <RecentBackfillList />
    </Stack>
  );
}

/** 单次补全任务的状态卡:运行中每 3s 轮询,跑完停。 */
function BackfillTaskCard({ taskId, onDone }: { taskId: number; onDone?: () => void }) {
  const q = useQuery({
    queryKey: ['backfill-status', taskId],
    queryFn: () => getContentBackfillStatus(taskId),
    refetchInterval: (query) => {
      const s = (query.state.data as any)?.status;
      return s === 'running' || s === 'pending' ? 3000 : false;
    },
  });

  const data = q.data as any;
  const status = data?.status as string | undefined;
  const meta = status ? STATUS_META[status] : undefined;
  const stats = parseStats(data?.progress);

  // 跑完通知父组件刷新"最近任务"(只通知一次)
  const doneRef = useRef(false);
  useEffect(() => {
    if (!status) return;
    if (status !== 'running' && status !== 'pending' && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [status, onDone]);

  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip size="small" label={`任务 #${taskId}`} />
          {meta && <Chip size="small" color={meta.color} label={meta.label} />}
        </Stack>
        {(status === 'running' || status === 'pending') && <LinearProgress />}
        {stats && (
          <Typography variant="body2" color="text.secondary">
            {statsText(stats)}
          </Typography>
        )}
        {data?.error_msg && (
          <Typography variant="caption" color="error.main" sx={{ whiteSpace: 'pre-wrap' }}>
            {data.error_msg}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

/** 最近补全任务列表(运营看历史)。 */
function RecentBackfillList() {
  const [expanded, setExpanded] = useState(false);
  const q = useQuery({
    queryKey: ['backfill-recent', expanded],
    queryFn: () => listContentBackfillRecent({ page: 1, pageSize: expanded ? 20 : 5 }),
    refetchInterval: 15_000,
  });
  const list = q.data?.list ?? [];

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle2">最近补全任务</Typography>
        {q.isFetching && <CircularProgress size={12} />}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => setExpanded((v) => !v)} sx={{ textTransform: 'none' }}>
          {expanded ? '收起' : '查看全部'}
        </Button>
      </Stack>

      {list.length === 0 ? (
        <Typography variant="caption" color="text.disabled">
          暂无补全任务
        </Typography>
      ) : (
        list.map((it) => <BackfillRecentRow key={it.task_id} item={it} />)
      )}
    </Stack>
  );
}

function BackfillRecentRow({ item }: { item: ContentBackfillRecentItem }) {
  const meta = STATUS_META[item.status];
  const stats = item.stats?.stats;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        minWidth: 0,
      }}
    >
      <Chip size="small" color={meta?.color ?? 'default'} label={meta?.label ?? item.status} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap>
          {item.source_name || `任务 #${item.task_id}`}
        </Typography>
        {stats && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {statsText(stats)}
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
        #{item.task_id}
      </Typography>
    </Box>
  );
}

/** crawl_job.progress → { stats: {found, inserted, updated, failed, sources_used} } */
function parseStats(progress: unknown): Record<string, number> | null {
  if (!progress) return null;
  if (typeof progress === 'object') return (progress as any).stats ?? null;
  if (typeof progress === 'string') {
    try {
      return JSON.parse(progress)?.stats ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

function statsText(s: Record<string, number>): string {
  const parts = [
    s.found !== undefined && `发现 ${s.found}`,
    s.inserted !== undefined && `新增 ${s.inserted}`,
    s.updated !== undefined && `更新 ${s.updated}`,
    s.failed !== undefined && s.failed > 0 && `失败 ${s.failed}`,
    s.sources_used !== undefined && `源 ${s.sources_used}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '无统计';
}
