'use client';

/**
 * 全网内容源搜集 + 一键入库
 *
 * 链路:发现(DDG 搜索 + 已知站友情链接扩散 + CMS 指纹打分)→ 候选清单 → 批量起草(套模板/LLM + 试跑)→
 * 草稿(试跑通过)→ 多选一键入库(apply-batch 写 module_source + module_template)。
 * 发现和起草都是后台任务(一批要跑几分钟到几十分钟),页面轮询 /source-setup/job 看进度。
 * 后端:internal/crawler/source_discovery.go / source_draft_batch.go / source_jobs.go。
 */

import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  discoverSites,
  listCandidates,
  draftBatch,
  listSourceDrafts,
  applyDraftsBatch,
  discardSourceDraft,
  getSourceJob,
  type SourceJob,
} from '@/apis/spider';
import { errMessage } from '@/lib/errMessage';

const CAND_KEY = ['spider', 'source-candidates'];
const DRAFT_KEY = ['spider', 'source-drafts'];

const CONTENT_TYPES = ['NOVEL', 'FILM', 'TELEPLAY', 'ANIMATION', 'MUSIC', 'COMICS', 'WALLPAPER', 'ARTICLE', 'NEWS'];

const CAND_STATUS: Record<string, { label: string; color: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  new: { label: '待起草', color: 'info' },
  drafted: { label: '已起草', color: 'success' },
  skipped: { label: '已跳过', color: 'default' },
  existing: { label: '已接入', color: 'warning' },
};

export default function SourceSetupPage() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [seedType, setSeedType] = useState('NOVEL');
  const [selCands, setSelCands] = useState<Set<string>>(new Set());
  const [selDrafts, setSelDrafts] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });

  const show = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnackbar({ open: true, message, severity });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: CAND_KEY });
    qc.invalidateQueries({ queryKey: DRAFT_KEY });
  };

  const cands = useQuery({ queryKey: CAND_KEY, queryFn: () => listCandidates({ limit: 200 }) });
  const drafts = useQuery({ queryKey: DRAFT_KEY, queryFn: () => listSourceDrafts({ limit: 200 }) });

  // 后台任务进度:在跑时 2 秒一轮,跑完停。跑的过程中候选 / 草稿也跟着刷新,逐条看到结果。
  const jobPoll = (q: { state: { data?: SourceJob | null } }) => (q.state.data?.running ? 2000 : false);
  const discoverJob = useQuery({ queryKey: ['spider', 'source-job', 'discover'], queryFn: () => getSourceJob('discover'), refetchInterval: jobPoll });
  const draftJob = useQuery({ queryKey: ['spider', 'source-job', 'draft'], queryFn: () => getSourceJob('draft'), refetchInterval: jobPoll });
  const discovering = !!discoverJob.data?.running;
  const drafting = !!draftJob.data?.running;

  // 任务从「在跑」变成「跑完」时报一次结果
  const wasRunning = useRef({ discover: false, draft: false });
  useEffect(() => {
    const dj = discoverJob.data;
    const finished = wasRunning.current.discover && !!dj && !dj.running;
    if (finished) {
      const r = dj.stats;
      show(r ? `搜集完成:评估 ${r.found} 个站(友链扩散 ${r.expanded ?? 0} 个站),新入库 ${r.new} 个,已接入 ${r.existing} 个,被拦 ${r.blocked} 个` : '搜集结束');
    }
    if (dj?.running || finished) refresh();
    wasRunning.current.discover = !!dj?.running;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoverJob.data]);
  useEffect(() => {
    const dj = draftJob.data;
    const finished = wasRunning.current.draft && !!dj && !dj.running;
    if (finished) {
      const r = dj.stats;
      show(r ? `起草完成:${r.picked} 个,试跑通过 ${r.drafted} 个,失败 ${r.failed} 个(失败原因见候选「说明」)` : '起草结束', r && r.drafted === 0 && r.picked > 0 ? 'info' : 'success');
    }
    if (dj?.running || finished) refresh();
    wasRunning.current.draft = !!dj?.running;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftJob.data]);

  const discoverMut = useMutation({
    mutationFn: () =>
      discoverSites(keyword.trim() ? { seeds: [{ keyword: keyword.trim(), type: seedType }], max_per_seed: 10 } : { max_per_seed: 8 }),
    onSuccess: (r) => {
      show(r.started ? '已开始搜集,在后台跑,进度见下方' : '已有搜集任务在跑,等它跑完', 'info');
      qc.setQueryData(['spider', 'source-job', 'discover'], r.job);
    },
    onError: (e: unknown) => show(errMessage(e) || '发现失败', 'error'),
  });

  // ids 为空 = 全部待起草。id 按字符串传:雪花 id 超过 2^53,Number() 会丢精度。
  const draftMut = useMutation({
    mutationFn: (ids: string[]) => draftBatch({ candidate_ids: ids }),
    onSuccess: (r) => {
      show(r.started ? '已开始起草,在后台逐个起草并试跑' : '已有起草任务在跑,等它跑完', 'info');
      setSelCands(new Set());
      qc.setQueryData(['spider', 'source-job', 'draft'], r.job);
    },
    onError: (e: unknown) => show(errMessage(e) || '起草失败', 'error'),
  });

  const applyMut = useMutation({
    mutationFn: () => applyDraftsBatch([...selDrafts]),
    onSuccess: (r) => {
      show(`入库完成:成功 ${r.applied} 个,失败 ${r.failed} 个`);
      setSelDrafts(new Set());
      refresh();
    },
    onError: (e: unknown) => show(errMessage(e) || '入库失败', 'error'),
  });

  const discardMut = useMutation({
    mutationFn: (id: string) => discardSourceDraft(id),
    onSuccess: () => { show('已丢弃'); refresh(); },
    onError: (e: unknown) => show(errMessage(e) || '丢弃失败', 'error'),
  });

  const candList = cands.data?.list || [];
  const draftList = drafts.data?.list || [];
  const newCands = candList.filter((c) => c.status === 'new' && !c.blocked);
  // 「已跳过」= 上次起草失败,可以再选中重新起草
  const canDraft = (c: { status: string; blocked: boolean }) => (c.status === 'new' || c.status === 'skipped') && !c.blocked;
  const applicableDrafts = draftList.filter((d) => d.ok && d.status === 'draft');

  const toggleSet = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const heroSx = {
    p: 3, mb: 3, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2,
    background: 'var(--bg)', border: '1px solid var(--border)',
  } as const;
  const iconBlockSx = {
    width: 48, height: 48, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #5B8DEF 0%, #7c3aed 100%)', color: '#fff', flexShrink: 0,
  } as const;
  const sectionSx = { p: 2.5, mb: 3, borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--border)' } as const;

  return (
    <Box>
      {/* Hero */}
      <Paper elevation={0} sx={heroSx}>
        <Box sx={iconBlockSx}><TravelExploreIcon /></Box>
        <Box>
          <Typography variant="h6" sx={{ color: 'var(--text)', fontWeight: 600 }}>全网内容源搜集</Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary, var(--text))', opacity: 0.7 }}>
            全网发现候选源 → 批量起草并试跑 → 多选一键入库。试跑通过的源才会入库生效。
          </Typography>
        </Box>
      </Paper>

      {/* 发现区 */}
      <Paper elevation={0} sx={sectionSx}>
        <Typography variant="subtitle1" sx={{ color: 'var(--text)', fontWeight: 600, mb: 2 }}>1. 发现候选源</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" label="种子关键词(留空跑默认一批)" value={keyword}
            onChange={(e) => setKeyword(e.target.value)} sx={{ minWidth: 280 }}
            placeholder="如:在线小说 免费阅读"
          />
          <TextField select size="small" label="内容类型" value={seedType} onChange={(e) => setSeedType(e.target.value)} sx={{ minWidth: 140 }}>
            {CONTENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <Button
            variant="contained" startIcon={discoverMut.isPending || discovering ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
            onClick={() => discoverMut.mutate()} disabled={discoverMut.isPending || discovering}
          >
            {discovering ? '搜集中…' : '开始搜集'}
          </Button>
        </Box>
        <JobProgress job={discoverJob.data} />
        <Typography variant="caption" sx={{ color: 'var(--text)', opacity: 0.6, display: 'block', mt: 1.5 }}>
          DDG 全网搜 + 从已接入源和已有候选首页的友情链接扩散,抓首页按 CMS 指纹 / 苹果CMS 接口 / 搜索表单打分。
          robots 禁或人机验证的站自动排除。在后台跑,关掉页面也不影响。
        </Typography>
      </Paper>

      {/* 候选清单 */}
      <Paper elevation={0} sx={sectionSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ color: 'var(--text)', fontWeight: 600 }}>
            2. 候选清单({newCands.length} 个待起草)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined" color="secondary"
              disabled={newCands.length === 0 || draftMut.isPending || drafting}
              onClick={() => draftMut.mutate([])}
            >
              全部待起草({newCands.length})
            </Button>
            <Button
              variant="contained" color="secondary"
              startIcon={draftMut.isPending || drafting ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              disabled={selCands.size === 0 || draftMut.isPending || drafting}
              onClick={() => draftMut.mutate([...selCands])}
            >
              {drafting ? '起草中…' : `批量起草(${selCands.size})`}
            </Button>
          </Box>
        </Box>
        <JobProgress job={draftJob.data} />
        {candList.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'var(--text)', opacity: 0.6 }}>暂无候选,先点「开始搜集」。</Typography>
        ) : (
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { py: 1, px: 1, borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, textAlign: 'left' } }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>域名</th><th>类型</th><th>CMS 指纹</th><th>分数</th><th>状态</th><th>说明</th>
              </tr>
            </thead>
            <tbody>
              {candList.map((c) => {
                const selectable = canDraft(c) && !drafting;
                return (
                  <tr key={c.id} style={{ opacity: c.blocked ? 0.5 : 1 }}>
                    <td>
                      <Checkbox size="small" disabled={!selectable} checked={selCands.has(c.id)} onChange={() => toggleSet(selCands, c.id, setSelCands)} />
                    </td>
                    <td>
                      <Box component="span" sx={{ fontWeight: 500 }}>{c.domain}</Box>
                      {c.has_cms_api && <Chip label="苹果CMS" size="small" color="success" sx={{ ml: 1, height: 18, fontSize: 11 }} />}
                      {c.blocked && <Chip label="被拦" size="small" color="error" sx={{ ml: 1, height: 18, fontSize: 11 }} />}
                    </td>
                    <td>{c.category}</td>
                    <td>{c.cms_hint || '—'}</td>
                    <td>{c.score}</td>
                    <td><Chip label={CAND_STATUS[c.status]?.label || c.status} color={CAND_STATUS[c.status]?.color || 'default'} size="small" /></td>
                    <td title={c.reason || ''} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.reason || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </Box>
        )}
      </Paper>

      {/* 草稿列表 */}
      <Paper elevation={0} sx={sectionSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ color: 'var(--text)', fontWeight: 600 }}>
            3. 草稿({applicableDrafts.length} 个可入库)
          </Typography>
          <Button
            variant="contained" color="success"
            startIcon={applyMut.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveAltIcon />}
            disabled={selDrafts.size === 0 || applyMut.isPending}
            onClick={() => applyMut.mutate()}
          >
            {applyMut.isPending ? '入库中…' : `一键入库(${selDrafts.size})`}
          </Button>
        </Box>
        {draftList.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'var(--text)', opacity: 0.6 }}>暂无草稿,起草后这里会列出试跑结果。</Typography>
        ) : (
          draftList.map((d) => {
            const applicable = d.ok && d.status === 'draft';
            const isOpen = expanded === d.id;
            return (
              <Box key={d.id} sx={{ border: '1px solid var(--border)', borderRadius: 2, mb: 1.5, overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5 }}>
                  <Checkbox size="small" disabled={!applicable} checked={selDrafts.has(d.id)} onChange={() => toggleSet(selDrafts, d.id, setSelDrafts)} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ color: 'var(--text)', fontWeight: 600 }}>{d.domain}</Typography>
                      <Chip label={d.category} size="small" variant="outlined" />
                      <Chip label={d.kind === 'video' ? '片源' : '书'} size="small" variant="outlined" />
                      <Chip label={d.ok ? '试跑通过' : '试跑未过'} color={d.ok ? 'success' : 'error'} size="small" />
                      <Chip label={d.status === 'draft' ? '待入库' : d.status === 'applied' ? '已入库' : '已丢弃'}
                        color={d.status === 'applied' ? 'success' : d.status === 'draft' ? 'info' : 'default'} size="small" />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'var(--text)', opacity: 0.6 }}>
                      样本:{d.sample_title || '—'}
                      {d.status === 'applied' && d.source_id ? ` · 源 #${d.source_id}` : ''}
                    </Typography>
                  </Box>
                  {d.status === 'draft' && (
                    <Tooltip title="丢弃"><IconButton size="small" color="error" onClick={() => discardMut.mutate(d.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  )}
                  <IconButton size="small" onClick={() => setExpanded(isOpen ? null : d.id)}>
                    {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={isOpen}>
                  <Divider />
                  <Box sx={{ p: 2, background: 'rgba(0,0,0,0.15)' }}>
                    <DraftReport report={d.report} kind={d.kind} />
                  </Box>
                </Collapse>
              </Box>
            );
          })
        )}
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

/** 后台任务进度条:在跑时显示「第几个 / 共几个 · 当前站」,没在跑时不占位。 */
function JobProgress({ job }: { job: SourceJob | null | undefined }) {
  if (!job?.running) return null;
  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  return (
    <Box sx={{ mt: 1.5, mb: 1 }}>
      <LinearProgress variant={job.total > 0 ? 'determinate' : 'indeterminate'} value={pct} />
      <Typography variant="caption" sx={{ color: 'var(--text)', opacity: 0.7, display: 'block', mt: 0.5 }}>
        {job.total > 0 ? `${job.done} / ${job.total}` : '准备中'}
        {job.current ? ` · ${job.current}` : ''}
      </Typography>
    </Box>
  );
}

/** 试跑报告分步展示:book 走 search/resolved/catalog/chapter,video 走 search/resolved/episodes。 */
function DraftReport({ report, kind }: { report: Record<string, unknown> | null | undefined; kind: string }) {
  if (!report) return <Typography variant="caption" sx={{ color: 'var(--text)', opacity: 0.6 }}>无试跑报告</Typography>;
  const step = (label: string, node: unknown) => {
    if (!node) return null;
    return (
      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ color: 'var(--text)', fontWeight: 600 }}>{label}</Typography>
        <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, borderRadius: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflow: 'auto' }}>
          {JSON.stringify(node, null, 2)}
        </Box>
      </Box>
    );
  };
  return (
    <Box>
      {step('搜索', report.search)}
      {step('定位', report.resolved || report.resolve_error)}
      {kind === 'video' ? step('分集', report.episodes) : (<>{step('目录', report.catalog)}{step('正文', report.chapter)}</>)}
    </Box>
  );
}
