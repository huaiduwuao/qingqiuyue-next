'use client';

/**
 * ContentRepairPanel —— 内容修复(多源聚合)。
 *
 * 与补全面板的分工:
 *   补全(content_backfill)  按策略补「缺」的内容,不判断已有内容对不对
 *   修复(本面板)            判断已有内容对不对 + 从多个源交叉验证,补缺 + 纠错
 *
 * 典型场景:一本书的正文从某个源抓回来,但那个源给了错误内容(2026-09 的 bqg616
 * 污染事故 —— 元数据对、正文是别站文章)。单源无从判断对错,必须多源比对:
 * 两个源给出同一章就能互相印证,只有一个源有就标「无法验证」,内容不一致就标冲突。
 *
 * 交互刻意做成两步:先「诊断」(dry-run,只读),看清哪几章缺/错/冲突,再「应用」。
 * 默认只应用有多源印证或单源但干净的章节;冲突和可疑的要人工勾选才动。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import {
  listRepairSources,
  pollRepair,
  startRepair,
  REPAIR_PHASE_LABELS,
  type RepairChapterDiff,
  type RepairProgress,
  type RepairReport,
} from '@/apis/spider';
import { myPage, getById, type ModuleContentItem } from '@/apis/module-content';
import { useSessionState } from './useSessionState';

// 裁决结果的展示元数据。文案要说人话 —— 运营不该去猜 "only_one_source" 是什么意思。
const VERDICT_META: Record<string, { label: string; color: 'default' | 'success' | 'warning' | 'error' | 'info'; hint: string }> = {
  ok: { label: '多源印证', color: 'success', hint: '两个以上源给出同一章且内容一致,可信度最高' },
  only_one_source: { label: '仅一源', color: 'info', hint: '只有一个源有这章,没有交叉验证' },
  conflict: { label: '源间冲突', color: 'error', hint: '多个源给出的内容明显不同,已取质量最高的那份,建议人工确认' },
  suspect: { label: '内容可疑', color: 'warning', hint: '质量分过低(残章/水印/乱码),默认不写入' },
  missing: { label: '所有源都缺', color: 'default', hint: '参与比对的源都没有这一章' },
};

const ACTION_LABEL: Record<string, string> = {
  keep: '保持不变',
  fill: '补上正文',
  replace: '替换现有',
  skip: '跳过',
};

/** 当前跟踪的修复任务。存 sessionStorage:切菜单回来按 taskId 接着轮询 / 取报告。 */
type RepairRun = { taskId: number; dryRun: boolean };

export default function ContentRepairPanel({ compact = false }: { compact?: boolean }) {
  const [keyword, setKeyword] = useState('');
  // 选中的书、源、上限、正在跑的任务都存 sessionStorage —— 后台切菜单会卸载本面板,
  // 以前这些全在组件 state 里,切回来任务在后端照跑,面板却是空的,看着像丢了。
  const [picked, setPicked] = useSessionState<ModuleContentItem | null>('spider:repair:picked', null);
  const [domains, setDomains] = useSessionState<string[]>('spider:repair:domains', []);
  // 默认全书:进度现在看得见,不必再靠"先抓 200 章试试"来避免界面干等。
  const [maxChapters, setMaxChapters] = useSessionState('spider:repair:max', '0');
  const [run, setRun] = useSessionState<RepairRun | null>('spider:repair:run', null);
  const [progress, setProgress] = useState<{ p: RepairProgress; taskId: number } | null>(null);
  const [report, setReport] = useState<RepairReport | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // 允许写入的裁决类型(默认只信多源印证 + 单源)
  const [allowConflict, setAllowConflict] = useState(false);
  const [starting, setStarting] = useState<'diagnose' | 'apply' | null>(null);
  const [polling, setPolling] = useState(false);

  const trimmed = keyword.trim();
  const asId = /^\d+$/.test(trimmed) && trimmed.length <= 15 ? Number(trimmed) : null;

  const searchQuery = useQuery({
    queryKey: ['repair-content-search', trimmed],
    queryFn: () => myPage({ title: trimmed, orderBy: 'relevance', page: 1, pageSize: 50 }),
    enabled: trimmed.length >= 2 && asId === null,
    staleTime: 30_000,
  });
  const idQuery = useQuery({
    queryKey: ['repair-content-byid', asId],
    queryFn: () => getById(asId!),
    enabled: asId !== null,
    staleTime: 30_000,
  });

  const options: ModuleContentItem[] = useMemo(() => {
    if (asId !== null) {
      const d = idQuery.data as any;
      const item = d?.data ?? d;
      return item?.id ? [item] : [];
    }
    const d = searchQuery.data as any;
    return d?.list || d?.records || [];
  }, [asId, idQuery.data, searchQuery.data]);

  const sourcesQuery = useQuery({
    queryKey: ['repair-sources'],
    queryFn: listRepairSources,
    staleTime: 5 * 60_000,
  });
  const sourceOptions = useMemo(
    // 不过滤:渲染型和直出型都能参与比对(直出型快得多,优先选它)。
    // 以前这里只留 has_js_extract,直出站全被滤掉 —— 下拉里常常一个源都没有。
    () => (sourcesQuery.data?.list || []).filter((s) => s.category === 'NOVEL'),
    [sourcesQuery.data],
  );

  // 跟踪任务:run 一变(新发起,或回到页面从 sessionStorage 读回)就接着轮询。
  // 跑完的任务第一次查就拿到报告(后端报告存在 crawl_job.progress,重启也在)。
  // 卸载时 abort,不再在后台空转。
  useEffect(() => {
    if (!run) return;
    const ac = new AbortController();
    setPolling(true);
    setErrMsg(null);
    pollRepair(run.taskId, {
      signal: ac.signal,
      onProgress: (p, taskId) => setProgress({ p, taskId }),
    })
      .then((r) => setReport(r))
      .catch((e: any) => {
        if (ac.signal.aborted) return;
        setErrMsg(e?.message || (run.dryRun ? '诊断失败' : '应用失败'));
        if (run.dryRun) setReport(null);
        // 任务已失败 / 过期:不再记着它,免得每次回来都报同一个错
        setRun(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setPolling(false);
      });
    return () => ac.abort();
    // setRun 稳定;只在换任务时重来
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.taskId]);

  const launch = async (dryRun: boolean) => {
    if (!picked) return;
    setStarting(dryRun ? 'diagnose' : 'apply');
    setProgress(null);
    setErrMsg(null);
    try {
      const taskId = await startRepair({
        contentId: String(picked.id),
        domains,
        dryRun,
        maxChapters: Number(maxChapters) || 0,
        // 应用:真正写库。
        applyVerdicts: dryRun
          ? undefined
          : allowConflict
            ? ['ok', 'only_one_source', 'conflict']
            : ['ok', 'only_one_source'],
      });
      if (dryRun) setReport(null);
      setRun({ taskId, dryRun });
    } catch (e: any) {
      setErrMsg(e?.message || (dryRun ? '诊断失败' : '应用失败'));
    } finally {
      setStarting(null);
    }
  };

  const busy = starting !== null || polling;
  const diagnosing = starting === 'diagnose' || (polling && !!run?.dryRun);
  const applying = starting === 'apply' || (polling && run?.dryRun === false);

  // 换书 / 清空:不再跟踪旧任务(后端照跑完,任务列表里能看到)
  const clearPicked = () => {
    setPicked(null);
    setRun(null);
    setReport(null);
    setProgress(null);
    setErrMsg(null);
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={<BuildRoundedIcon />}>
        从多个源比对同一本书的章节,找出<b>缺失</b>和<b>可能有错</b>的章节并修复。
        两个源给出同一章就能互相印证;只有一个源有时标「仅一源」,没有交叉验证。
        先诊断(dry-run,不写库),看清结果再点应用。
      </Alert>

      {/* 第一步:选内容 */}
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>1. 选择要修复的内容</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <TextField
            label="按标题搜索 / 粘贴内容 id"
            size="small"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); if (picked) clearPicked(); }}
            disabled={busy}
            sx={{ flex: 1, minWidth: 260 }}
            placeholder="求魔"
          />
          {picked && (
            <Chip
              color="primary"
              label={`已选:${picked.title}`}
              onDelete={busy ? undefined : clearPicked}
            />
          )}
        </Stack>
        {!picked && options.length > 0 && (
          <Box sx={{ mt: 1.5, maxHeight: 200, overflow: 'auto' }}>
            {options.slice(0, 20).map((o) => (
              <Box
                key={String(o.id)}
                onClick={() => { setPicked(o); setRun(null); setReport(null); setErrMsg(null); }}
                sx={{
                  px: 1.5, py: 0.75, cursor: 'pointer', borderRadius: 1,
                  display: 'flex', gap: 1.5, alignItems: 'center',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>{o.title}</Typography>
                <Typography variant="caption" color="text.secondary">{o.author || '-'}</Typography>
                <Chip size="small" variant="outlined" label={o.contentType || '-'} />
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  {String(o.id)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* 第二步:选源 + 跑诊断 */}
      {picked && (
        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>2. 选参与比对的源,然后诊断</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'flex-start' }}>
            <TextField
              select
              label="参与比对的源"
              size="small"
              value={domains}
              onChange={(e) => {
                const v = e.target.value;
                setDomains(Array.isArray(v) ? v : v.split(','));
              }}
              slotProps={{ select: { multiple: true } }}
              sx={{ minWidth: 300 }}
              helperText={
                sourceOptions.length === 0
                  ? '还没有配好取数模板的小说源'
                  : domains.length === 0
                    ? '不选 = 全部正文源:每个源用站内搜索定位这本书,搜不到的跳过'
                    : '选 2 个以上才有交叉验证'
              }
            >
              {sourceOptions.map((s) => (
                <MenuItem key={s.domain} value={s.domain}>
                  {s.name} · {s.domain} · {s.mode === 'static' ? '直出(快)' : '渲染'}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="每源最多抓"
              size="small"
              type="number"
              value={maxChapters}
              onChange={(e) => setMaxChapters(e.target.value)}
              sx={{ width: 140 }}
              helperText="0 = 全书(慢)"
            />
            <Button
              variant="contained"
              onClick={() => launch(true)}
              disabled={busy}
              startIcon={diagnosing ? <CircularProgress size={14} color="inherit" /> : <FactCheckRoundedIcon />}
              sx={{ textTransform: 'none', mt: 0.25 }}
            >
              {diagnosing ? '诊断中…' : '诊断(不写库)'}
            </Button>
          </Stack>
          {busy && <RepairProgressView progress={progress?.p} taskId={progress?.taskId ?? run?.taskId} applying={applying} />}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            诊断会实时抓取所选源的章节做比对,选得多/章节多时较慢。
          </Typography>
        </Paper>
      )}

      {errMsg && <Alert severity="error">{errMsg}</Alert>}

      {/* 第三步:看报告 */}
      {report && (
        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            3. 诊断结果{report.dry_run ? '(未写库)' : '(已应用)'}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            <Chip size="small" variant="outlined" label={`现有 ${report.existing} 章(有正文 ${report.existing_ready})`} />
            <Chip size="small" variant="outlined" label={`聚合 ${report.aggregated} 章`} />
            {Object.entries(report.by_verdict || {}).map(([k, v]) => (
              <Tooltip key={k} title={VERDICT_META[k]?.hint || ''}>
                <Chip size="small" color={VERDICT_META[k]?.color || 'default'} label={`${VERDICT_META[k]?.label || k} ${v}`} />
              </Tooltip>
            ))}
          </Stack>

          {Object.keys(report.coverage || {}).length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              各源贡献:{Object.entries(report.coverage).map(([d, n]) => `${d} ${n} 章`).join(' · ')}
            </Typography>
          )}

          {report.errors && report.errors.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {report.errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
              {report.errors.length > 5 && <div>…共 {report.errors.length} 条</div>}
            </Alert>
          )}

          {report.applied && (
            <Alert severity={report.applied.failed > 0 ? 'warning' : 'success'} sx={{ mb: 1.5 }}>
              已应用:补上 <b>{report.applied.filled}</b> 章,替换 <b>{report.applied.updated}</b> 章,
              跳过 <b>{report.applied.skipped}</b> 章,失败 <b>{report.applied.failed}</b> 章
            </Alert>
          )}

          {report.diffs.length === 0 ? (
            <Alert severity="success">没有需要修复的:所有章的裁决都是「多源印证」且库里已有正文。</Alert>
          ) : (
            <>
              <DiffTable diffs={report.diffs} />
              {report.dry_run && (
                <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      // 应用会原地改写线上正文,不可撤销:点之前把要动多少章说清楚
                      const n = report.diffs.filter((d) => d.action === 'fill' || d.action === 'replace').length;
                      if (window.confirm(`将按报告写入最多 ${n} 章(补空章 + 替换正文),直接改动线上内容,确定应用?`)) {
                        launch(false);
                      }
                    }}
                    disabled={busy}
                    startIcon={applying ? <CircularProgress size={14} color="inherit" /> : <BuildRoundedIcon />}
                    sx={{ textTransform: 'none' }}
                  >
                    {applying ? '应用中…' : '应用修复'}
                  </Button>
                  <FormControlLabel
                    control={<Checkbox checked={allowConflict} onChange={(e) => setAllowConflict(e.target.checked)} />}
                    label={<Typography variant="caption">同时应用「源间冲突」的章节(默认不动,建议先人工看过)</Typography>}
                  />
                </Stack>
              )}
            </>
          )}
        </Paper>
      )}
    </Stack>
  );
}

/** 逐章差异表。只展示需要关注的章(缺/要补/要换/冲突/可疑)。 */
function DiffTable({ diffs }: { diffs: RepairChapterDiff[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <Box sx={{ maxHeight: 520, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      {diffs.map((d) => {
        const meta = VERDICT_META[d.verdict] || { label: d.verdict, color: 'default' as const, hint: '' };
        const open = expanded === d.chapter_no;
        return (
          <Box key={d.chapter_no} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Box
              onClick={() => setExpanded(open ? null : d.chapter_no)}
              sx={{
                px: 1.5, py: 1, display: 'flex', gap: 1.5, alignItems: 'center',
                cursor: d.rivals?.length ? 'pointer' : 'default',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography variant="caption" sx={{ fontFamily: 'monospace', minWidth: 48, color: 'text.secondary' }}>
                #{d.chapter_no}
              </Typography>
              <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.title || '(无标题)'}
              </Typography>
              <Tooltip title={meta.hint}>
                <Chip size="small" color={meta.color} label={meta.label} />
              </Tooltip>
              <Chip size="small" variant="outlined" label={ACTION_LABEL[d.action] || d.action} />
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90, textAlign: 'right' }}>
                {d.before_len} → {d.after_len}
              </Typography>
            </Box>
            {open && d.rivals && d.rivals.length > 0 && (
              <Box sx={{ px: 1.5, pb: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">
                  采信:{d.source || '-'} ({d.after_len} 字节)。落败候选:
                </Typography>
                {d.rivals.map((r, i) => (
                  <Box key={i} sx={{ mt: 0.75, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {r.source} · {r.len} 字节
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                      {r.head}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
            {d.note && (
              <Typography variant="caption" sx={{ display: 'block', px: 1.5, pb: 1, color: 'text.secondary' }}>
                {d.note}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** 运行中的修复任务进度:阶段 / 百分比 / 当前在抓哪一章 / 已取章数 / 耗时。 */
function RepairProgressView({ progress, taskId, applying }: { progress?: RepairProgress; taskId?: number; applying: boolean }) {
  if (!progress) {
    return (
      <Box sx={{ mt: 2 }}>
        <LinearProgress />
        <Typography variant="caption" color="text.secondary">
          {applying ? '应用任务已提交,等待开始…' : '诊断任务已提交,等待开始…'}
        </Typography>
      </Box>
    );
  }
  const pct = progress.percent;
  const elapsed = progress.startedAt ? Math.round((Date.now() - new Date(progress.startedAt).getTime()) / 1000) : progress.elapsedSec;
  const fmt = (s?: number) => (s == null ? '-' : s >= 60 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${s} 秒`);
  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
        <Chip size="small" color="primary" variant="outlined" label={REPAIR_PHASE_LABELS[progress.phase] || progress.phase} />
        <Typography variant="body2">{pct >= 0 ? `${pct}%` : '估算中'}</Typography>
        {progress.itemsFound ? <Typography variant="caption" color="text.secondary">已取 {progress.itemsFound} 章</Typography> : null}
        <Typography variant="caption" color="text.secondary">耗时 {fmt(elapsed)}</Typography>
        {taskId ? <Typography variant="caption" color="text.secondary">任务 #{taskId}(任务列表里也能看)</Typography> : null}
      </Stack>
      <LinearProgress variant={pct >= 0 ? 'determinate' : 'indeterminate'} value={Math.max(0, pct)} sx={{ height: 8, borderRadius: 4 }} />
      {progress.currentUrl && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all' }}>
          {progress.currentUrl}
        </Typography>
      )}
      {(progress.error_list?.length ?? 0) > 0 && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {progress.error_list!.slice(-3).map((e, i) => <div key={i}>{e}</div>)}
        </Alert>
      )}
    </Box>
  );
}
