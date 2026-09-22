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

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { listRepairSources, repairChapters, type RepairChapterDiff, type RepairReport } from '@/apis/spider';
import { myPage, getById, type ModuleContentItem } from '@/apis/module-content';

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

export default function ContentRepairPanel({ compact = false }: { compact?: boolean }) {
  const [keyword, setKeyword] = useState('');
  const [picked, setPicked] = useState<ModuleContentItem | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [maxChapters, setMaxChapters] = useState('200');
  const [report, setReport] = useState<RepairReport | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // 允许写入的裁决类型(默认只信多源印证 + 单源)
  const [allowConflict, setAllowConflict] = useState(false);

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

  // 诊断:dry-run,只读。修复要抓几十上百章,给足超时。
  const diagnoseM = useMutation({
    mutationFn: () =>
      repairChapters({
        contentId: String(picked!.id),
        domains,
        dryRun: true,
        maxChapters: Number(maxChapters) || 0,
      }),
    onSuccess: (r) => { setReport(r); setErrMsg(null); },
    onError: (e: any) => { setReport(null); setErrMsg(e?.message || '诊断失败'); },
  });

  // 应用:真正写库。
  const applyM = useMutation({
    mutationFn: () =>
      repairChapters({
        contentId: String(picked!.id),
        domains,
        dryRun: false,
        maxChapters: Number(maxChapters) || 0,
        applyVerdicts: allowConflict
          ? ['ok', 'only_one_source', 'conflict']
          : ['ok', 'only_one_source'],
      }),
    onSuccess: (r) => { setReport(r); setErrMsg(null); },
    onError: (e: any) => setErrMsg(e?.message || '应用失败'),
  });

  const busy = diagnoseM.isPending || applyM.isPending;

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
            onChange={(e) => { setKeyword(e.target.value); setPicked(null); setReport(null); }}
            sx={{ flex: 1, minWidth: 260 }}
            placeholder="求魔"
          />
          {picked && (
            <Chip
              color="primary"
              label={`已选:${picked.title}`}
              onDelete={() => { setPicked(null); setReport(null); }}
            />
          )}
        </Stack>
        {!picked && options.length > 0 && (
          <Box sx={{ mt: 1.5, maxHeight: 200, overflow: 'auto' }}>
            {options.slice(0, 20).map((o) => (
              <Box
                key={String(o.id)}
                onClick={() => { setPicked(o); setReport(null); }}
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
                  : sourceOptions.length < 2
                    ? '只有一个源,拿不到交叉验证 —— 建议再配一个,否则每一章都只会是「仅一源」'
                    : '至少选 2 个才有交叉验证'
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
              onClick={() => diagnoseM.mutate()}
              disabled={busy || domains.length === 0}
              startIcon={diagnoseM.isPending ? <CircularProgress size={14} color="inherit" /> : <FactCheckRoundedIcon />}
              sx={{ textTransform: 'none', mt: 0.25 }}
            >
              {diagnoseM.isPending ? '诊断中…' : '诊断(不写库)'}
            </Button>
          </Stack>
          {diagnoseM.isPending && <LinearProgress sx={{ mt: 2 }} />}
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
                    onClick={() => applyM.mutate()}
                    disabled={busy}
                    startIcon={applyM.isPending ? <CircularProgress size={14} color="inherit" /> : <BuildRoundedIcon />}
                    sx={{ textTransform: 'none' }}
                  >
                    {applyM.isPending ? '应用中…' : '应用修复'}
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
