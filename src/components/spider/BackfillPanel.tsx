'use client';

// 通用内容补全面板 —— /system/spider/backfill 与 /account/spider/quick 的第三个 tab。
//
// 后端 content_backfill 框架:任意已收录内容 (module_content.id) 都能补。
// 按 content_type 自动选抓取方式 —— NOVEL 抓章节正文、MUSIC 存音频、
// COMICS 抓页面、FILM/VIDEO 只嗅探播放直链(不下载)。调用方不关心类型。
//
// ── 为什么不用 Autocomplete ──────────────────────────────────────────────
//
// 这里原本是一个 Autocomplete(下拉联想)。它的两个特性和这个页面的用途相冲:
//   1. 下拉面板宽度受限,塞不下"类型 + 入库状态"这些决定性的列;
//   2. 选中即收起,用户失去"同名的还有哪些"的视野。
//
// 而运营遇到的真实情况恰恰是:搜「求魔」命中 44 条,其中 41 条是最近抓的有声书
// 章节、只有 2 条是要补的小说 —— 在一个只显示标题的下拉里,这 2 条根本认不出来。
// 所以改成常驻结果列表,把"类型"和"入库状态"摆成列。
//
// ── 顺带说明两个后端配合点 ─────────────────────────────────────────────
//   - 搜索带 orderBy=relevance:后端按标题相关性(精确 > 前缀 > 其余)排,
//     否则默认的 id DESC("最新抓的在前")会让刚抓的几十条同名条目压住正主。
//   - 入库状态来自 /content/backfill/item-stats,它实时从内容库算
//     readyItems/totalItems,不读 module_content.chapter_count(那一列是脏的)。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SyncProblemRoundedIcon from '@mui/icons-material/SyncProblemRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { CoverImage } from '@/components/common/CoverImage';
import AvailabilityBadge from '@/components/common/AvailabilityBadge';
import {
  startContentBackfill,
  getContentBackfillStatus,
  listContentBackfillRecent,
  getContentItemStats,
  listContentBackfillCandidates,
  confirmContentBackfillCandidate,
  rejectContentBackfillCandidate,
  type ContentBackfillRecentItem,
  type ContentItemStats,
  type ContentBackfillCandidate,
} from '@/apis/spider';
import { myPage, getById, type ModuleContentItem } from '@/apis/module-content';
import { TYPE_LABEL } from '@/lib/contentRoute';
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

/** 类型的中文名。生成物里没有的类型(如爬虫内部的 PERSON)退回原始值。 */
function typeLabel(t: string): string {
  return TYPE_LABEL[t as keyof typeof TYPE_LABEL] || t;
}

/**
 * 类型 → 彩色 Chip 的配色。
 *
 * 用色块而不是纯文本,是因为密集列表里「小说」和「音乐」两个词扫读效率太低 ——
 * 这次事故的核心就是"2 本小说淹没在 41 首歌里",颜色是最快的分流信号。
 */
function typeChipColor(t: string): 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'default' {
  switch (t.toUpperCase()) {
    case 'NOVEL':
      return 'primary';
    case 'COMICS':
      return 'secondary';
    case 'MUSIC':
      return 'default';
    case 'ANIMATION':
    case 'FILM':
    case 'VIDEO':
    case 'TELEPLAY':
    case 'SHORT_DRAMA':
      return 'info';
    case 'ARTICLE':
    case 'NEWS':
      return 'success';
    default:
      return 'default';
  }
}

export default function BackfillPanel({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [picked, setPicked] = useState<ModuleContentItem | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [authorHint, setAuthorHint] = useState('');
  const [strategy, setStrategy] = useState('revisit');
  const [taskId, setTaskId] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const trimmed = keyword.trim();
  // 纯数字且不超 2^53 视为精确 id 查询(运营常从别处复制到 id)。
  const asId = /^\d+$/.test(trimmed) && trimmed.length <= 15 ? Number(trimmed) : null;

  // 按标题搜内容 —— myPage 是公开浏览列表,不受数据权限限制(搜得全库)。
  // orderBy=relevance 是这里的重点:不带它的话默认 id DESC 会把一批批新抓的
  // 同名条目排在正主前面,要补的那条根本进不了窗口。
  const searchQuery = useQuery({
    queryKey: ['backfill-content-search', trimmed],
    queryFn: () => myPage({ title: trimmed, orderBy: 'relevance', page: 1, pageSize: 50 }),
    enabled: trimmed.length >= 2 && asId === null,
    staleTime: 30_000,
  });

  // 粘贴 id 时走精确查询,不依赖标题匹配。
  const idQuery = useQuery({
    queryKey: ['backfill-content-byid', asId],
    queryFn: () => getById(asId!),
    enabled: asId !== null,
    staleTime: 30_000,
  });

  const options = useMemo(() => {
    if (asId !== null) {
      const d = idQuery.data as any;
      const item = d?.data ?? d;
      return item && item.id ? [item as ModuleContentItem] : [];
    }
    return searchQuery.data?.list ?? [];
  }, [asId, idQuery.data, searchQuery.data]);

  const loading = asId !== null ? idQuery.isFetching : searchQuery.isFetching;

  // 类型筛选的选项从当前结果集动态生成 —— 只列真的出现了的类型,
  // 运营一眼能看到"小说只有 2 条"。
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of options) m.set(o.contentType, (m.get(o.contentType) ?? 0) + 1);
    return m;
  }, [options]);

  const visible = useMemo(
    () => (typeFilter ? options.filter((o) => o.contentType === typeFilter) : options),
    [options, typeFilter],
  );

  // 入库状态:批量拉当前列表的章节统计(只对正文类有结果)。
  const statIds = useMemo(() => visible.map((o) => String(o.id)).sort(), [visible]);
  const statsQuery = useQuery({
    queryKey: ['backfill-item-stats', statIds.join(',')],
    queryFn: () => getContentItemStats(statIds),
    enabled: statIds.length > 0,
    staleTime: 60_000,
  });
  const stats = statsQuery.data ?? {};

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

  const pickedStats: ContentItemStats | undefined = picked ? stats[String(picked.id)] : undefined;

  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={<SyncProblemRoundedIcon />}>
        选中一条已收录内容,系统会按它的类型自动补抓缺失部分:
        小说补章节正文、音乐补音频、漫画补页面、影视只嗅探播放直链(不下载文件)。
        搜索结果里的「入库状态」列会告诉你这条还缺多少。
      </Alert>

      {/* 搜索 + 类型筛选 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          size="small"
          fullWidth
          label="搜索内容(按标题,或直接粘贴内容 id)"
          placeholder="例如:求魔"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setTypeFilter('');
          }}
          slotProps={{
            input: {
              endAdornment: loading ? <CircularProgress size={16} /> : null,
            },
          }}
        />
        {typeCounts.size > 1 && (
          <TextField
            select
            size="small"
            label="类型"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            sx={{ minWidth: compact ? 140 : 180 }}
          >
            <MenuItem value="">全部({options.length})</MenuItem>
            {Array.from(typeCounts.entries()).map(([t, n]) => (
              <MenuItem key={t} value={t}>
                {typeLabel(t)}({n})
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      {/* 结果计数徽标 —— 让运营确认"小说就这么多,不是我漏看了" */}
      {trimmed.length >= 2 && (
        <Typography variant="caption" color="text.secondary">
          {loading
            ? '搜索中…'
            : options.length === 0
              ? '没搜到匹配的内容'
              : `${options.length} 条结果` +
                (typeCounts.size > 1
                  ? ' · ' +
                    Array.from(typeCounts.entries())
                      .map(([t, n]) => `${typeLabel(t)} ${n}`)
                      .join(' · ')
                  : '')}
          {options.length > 0 && statsQuery.isFetching && ' · 读取入库状态…'}
        </Typography>
      )}

      {/* 常驻结果列表 */}
      {visible.length > 0 && (
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            maxHeight: compact ? 360 : 480,
            overflowY: 'auto',
          }}
        >
          {visible.map((o) => (
            <ResultRow
              key={o.id}
              item={o}
              stat={stats[String(o.id)]}
              picked={picked?.id === o.id}
              onPick={() => setPicked(o)}
            />
          ))}
        </Box>
      )}

      {/* 选中条:先看清楚缺什么,再决定补不补 */}
      {picked && (
        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1.5 }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="subtitle2">{picked.title}</Typography>
              <Chip size="small" color={typeChipColor(picked.contentType)} label={typeLabel(picked.contentType)} />
              {picked.sourceLabel && (
                <Typography variant="caption" color="text.secondary">
                  来源「{picked.sourceLabel}」
                </Typography>
              )}
              <Typography variant="caption" color="text.disabled">
                #{picked.id}
              </Typography>
              <CopyIdButton id={String(picked.id)} />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {pickedStats
                ? `目录 ${pickedStats.totalItems} 章 · 站内正文 ${pickedStats.readyItems} 章`
                : '该类型不走章节补全,直接按源补音频/页面/直链'}
            </Typography>
            {pickedStats && <GapHint stat={pickedStats} />}
          </Stack>
        </Box>
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
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['backfill-recent'] });
            qc.invalidateQueries({ queryKey: ['backfill-candidates', String(picked?.id)] });
          }}
        />
      )}

      {picked && (
        <>
          <Divider sx={{ my: 1 }} />
          <CandidateList contentId={String(picked.id)} compact={compact} />
        </>
      )}

      <Divider sx={{ my: 1 }} />
      <RecentBackfillList />
    </Stack>
  );
}

/** 结果行:封面 / 标题+作者来源 / 类型 / 入库状态。 */
function ResultRow({
  item,
  stat,
  picked,
  onPick,
}: {
  item: ModuleContentItem;
  stat?: ContentItemStats;
  picked: boolean;
  onPick: () => void;
}) {
  return (
    <Box
      onClick={onPick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1,
        cursor: 'pointer',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: picked ? 'action.selected' : 'transparent',
        '&:last-of-type': { borderBottom: 0 },
        '&:hover': { bgcolor: picked ? 'action.selected' : 'action.hover' },
      }}
    >
      <CoverImage
        src={item.coverUrl || item.cover}
        alt={item.title}
        sx={{ width: 40, height: 54, borderRadius: 0.5, flexShrink: 0 }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap title={item.title}>
          {item.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {item.author || '未知作者'}
          {item.sourceLabel ? ` · ${item.sourceLabel}` : ''} · #{item.id}
        </Typography>
      </Box>
      <Chip
        size="small"
        color={typeChipColor(item.contentType)}
        label={typeLabel(item.contentType)}
        sx={{ flexShrink: 0 }}
      />
      {/* 状态列固定宽度:有的行有角标、有的没有(音乐等非正文类),
          不占位的话右边缘会参差不齐。 */}
      <Box sx={{ width: 110, flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
        {stat ? (
          <AvailabilityBadge
            status={stat.status}
            readyItems={stat.readyItems}
            totalItems={stat.totalItems}
            variant="inline"
          />
        ) : (
          <Typography variant="caption" color="text.disabled">
            —
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** 复制内容 id —— 运营要拿它去库里核对。 */
function CopyIdButton({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tooltip title={done ? '已复制' : '复制 id'}>
      <IconButton
        size="small"
        onClick={() => {
          navigator.clipboard?.writeText(id).then(
            () => {
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            },
            () => {},
          );
        }}
      >
        <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
  );
}

/**
 * 缺口提示:这条到底缺什么、还差多少章。
 *
 * 措辞比站内角标更直接 —— 这一页是运营视角,他要的是"该不该点补全",
 * 不是"用户会看到什么"。
 */
function GapHint({ stat }: { stat: ContentItemStats }) {
  const gap = Math.max(0, stat.totalItems - stat.readyItems);
  switch (stat.status) {
    case 'readable':
      return (
        <Typography variant="caption" color="text.secondary">
          站内 {stat.totalItems} 章已全部入库,通常不需要补全
        </Typography>
      );
    case 'partial_text':
      return (
        <Typography variant="caption" color="warning.main">
          还缺 {gap} 章(已有 {stat.readyItems}/{stat.totalItems})——可以补全
        </Typography>
      );
    case 'catalog_only':
      return (
        <Typography variant="caption" color="error.main">
          仅抓到目录,正文 0 章 —— 需要补全
        </Typography>
      );
    case 'external_only':
      return (
        <Typography variant="caption" color="error.main">
          连目录都没有,需要先补目录再补正文
        </Typography>
      );
    default:
      return null;
  }
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

// ─────────── 候选源面板 ───────────
//
// 后端 content_backfill 跑完后,discover 搜出的"这本书在别家源站也有"会写到
// module_content_backfill_candidate —— 这里给运营一个折叠面板,
// 默认收起(只有当前选中的书有候选时才展开,平时不打扰)。
//
// 行为:
//   - 默认折叠,只在 list.length > 0 时自动展开(让运营第一时间看到新增的待确认项)
//   - confirm / reject 后乐观更新 + invalidate,失败回滚
//   - score 越低越靠后;applied 状态的行只读(终态,运营不再操作)
//
// 这块视觉密度比"最近补全任务"高(一行:provider/score/page_url/操作),
// 折叠默认收起是因为大部分书没有候选 —— 避免在"求魔"以外的书上长期占用版面。

const CANDIDATE_STATUS_META: Record<
  ContentBackfillCandidate['status'],
  { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }
> = {
  pending: { label: '待确认', color: 'warning' },
  confirmed: { label: '已确认', color: 'info' },
  rejected: { label: '已拒绝', color: 'default' },
  applied: { label: '已应用', color: 'success' },
};

function CandidateList({ contentId, compact }: { contentId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const [actionErr, setActionErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['backfill-candidates', contentId],
    queryFn: () => listContentBackfillCandidates({ contentId }),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const list = q.data?.list ?? [];

  // 默认展开;用户手动折叠后由 toggle 控制,不再自动展开。
  const hasOpen = list.some((c) => c.status === 'pending' || c.status === 'confirmed');
  const [expanded, setExpanded] = useState(true);
  const handleToggle = () => setExpanded((v) => !v);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['backfill-candidates', contentId] });
  };

  const confirmM = useMutation({
    mutationFn: (id: number) => confirmContentBackfillCandidate(id),
    onSuccess: invalidate,
    onError: (e) => setActionErr(formatApiError(e) || '确认失败'),
  });
  const rejectM = useMutation({
    mutationFn: (id: number) => rejectContentBackfillCandidate(id),
    onSuccess: invalidate,
    onError: (e) => setActionErr(formatApiError(e) || '拒绝失败'),
  });

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', cursor: 'pointer' }}
        onClick={handleToggle}
      >
        <ExpandMoreRoundedIcon
          sx={{
            fontSize: 18,
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s',
            color: 'text.secondary',
          }}
        />
        <Typography variant="subtitle2">候选源(discover)</Typography>
        <Chip size="small" label={list.length} />
        {hasOpen && (
          <Chip size="small" color="warning" label={`待处理 ${list.filter((c) => c.status === 'pending').length}`} />
        )}
        <Box sx={{ flex: 1 }} />
        {q.isFetching && <CircularProgress size={12} />}
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        {actionErr && (
          <Alert severity="error" onClose={() => setActionErr(null)} sx={{ mb: 1 }}>
            {actionErr}
          </Alert>
        )}
        {q.isLoading ? (
          <Typography variant="caption" color="text.disabled">
            读取中…
          </Typography>
        ) : list.length === 0 ? (
          <Typography variant="caption" color="text.disabled">
            暂无候选 —— 跑一次带 discover 策略的补全后,这里会出现其他源站的同本书
          </Typography>
        ) : (
          <Stack
            spacing={0.5}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              maxHeight: compact ? 240 : 320,
              overflowY: 'auto',
            }}
          >
            {list.map((c) => (
              <CandidateRow
                key={c.id}
                c={c}
                busy={confirmM.isPending || rejectM.isPending}
                onConfirm={() => {
                  setActionErr(null);
                  confirmM.mutate(c.id);
                }}
                onReject={() => {
                  setActionErr(null);
                  rejectM.mutate(c.id);
                }}
              />
            ))}
          </Stack>
        )}
      </Collapse>
    </Stack>
  );
}

function CandidateRow({
  c,
  busy,
  onConfirm,
  onReject,
}: {
  c: ContentBackfillCandidate;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const meta = CANDIDATE_STATUS_META[c.status] ?? CANDIDATE_STATUS_META.pending;
  const editable = c.status === 'pending' || c.status === 'confirmed';
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: 'center',
        px: 1.5,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" noWrap title={c.label}>
            {c.label || c.provider}
          </Typography>
          <Chip size="small" color={meta.color} label={meta.label} />
          <Tooltip title={c.page_url}>
            <Chip
              size="small"
              variant="outlined"
              label={
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ fontFamily: 'monospace', maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}
                >
                  {c.page_url}
                </Typography>
              }
            />
          </Tooltip>
          <Typography variant="caption" color="text.disabled" title={`score=${c.score}/100,越大越像正主`}>
            {c.score}/100
          </Typography>
        </Stack>
        {c.author && (
          <Typography variant="caption" color="text.secondary" noWrap>
            作者:{c.author}
          </Typography>
        )}
      </Box>
      {editable ? (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="确认 → cron 会建源并触发新补全">
            <span>
              <IconButton size="small" color="success" onClick={onConfirm} disabled={busy}>
                <CheckRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="拒绝">
            <span>
              <IconButton size="small" onClick={onReject} disabled={busy}>
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ) : (
        <Typography variant="caption" color="text.disabled">
          —
        </Typography>
      )}
    </Stack>
  );
}
