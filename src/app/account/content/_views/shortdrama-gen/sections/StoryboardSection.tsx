'use client';

/**
 * 分镜:一集拆成「镜头」(剧本里连续的一小段)→ 每个镜头若干「分镜」,像有戏那样一张分镜表。
 * 每个分镜列出场景、景别、构图、运镜、光影、分镜描述、音效、对白、时长;景别 / 构图 / 运镜直接在表里改,
 * 其余点「编辑」。人物、场景、道具在描述里写成 @[名字],高亮显示。点一行在右栏单独重画或出视频。
 * 旧分镜(没有分组)每个分镜自成一组。
 */

import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { ANGLES, BEATS, CAMERA_MOVES, COMPOSITIONS, SHOT_TYPES, dramaAPI, shotLabel, type Episode, type Overview, type QCIssue, type Shot } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { Empty, EntityStatusChip, ShotStatusChip } from '../common';
import { useEpisode, useInvalidate, useOverview, useStartTask } from '../useProject';

/** 一组:同一个「镜头」下的分镜 */
interface Group {
  key: string;
  beat: number;
  text: string;
  shots: Shot[];
}

/** 按镜头号把连续的分镜归组;旧数据(beat=0)每个分镜自成一组 */
export function groupShots(shots: Shot[]): Group[] {
  const out: Group[] = [];
  for (const s of shots) {
    const last = out[out.length - 1];
    if (s.beat && last && last.beat === s.beat) {
      last.shots.push(s);
      continue;
    }
    out.push({ key: s.beat ? `b${s.beat}-${s.id}` : `s${s.id}`, beat: s.beat || 0, text: s.beat ? s.beat_text || s.action : s.action, shots: [s] });
  }
  return out;
}

const MENTION = /@\[([^\]\n]+)\]/g;

/** 把 @[名字] 高亮成「@名字」 */
function Mentioned({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Box key={m.index} component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
        @{m[1]}
      </Box>,
    );
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/** 对白「名字:台词」逐行显示,说话人高亮 */
function Dialogue({ text }: { text: string }) {
  if (!text.trim()) return <>-</>;
  return (
    <>
      {text.split('\n').map((ln, i) => {
        const m = ln.match(/^\s*([^:：]{1,12})\s*[:：]\s*(.*)$/);
        return (
          <Box key={i}>
            {m ? (
              <>
                <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  @{m[1]}
                </Box>
                :{m[2]}
              </>
            ) : (
              ln
            )}
          </Box>
        );
      })}
    </>
  );
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 导出分镜表(CSV,带 BOM,Excel 直接打开不乱码) */
function exportCSV(ep: Episode, shots: Shot[], ov: Overview) {
  const scene = (id: number) => ov.scenes.find((x) => x.id === id)?.name ?? '';
  const chars = (ids: number[]) => ids.map((id) => ov.characters.find((c) => c.id === id)?.name).filter(Boolean).join('、');
  const strip = (s: string) => (s ?? '').replace(MENTION, '$1');
  const head = ['镜头', '分镜号', '镜头原文', '场景', '角色', '景别', '构图', '运镜', '机位', '光影', '分镜描述', '音效', '对白', '时长(秒)', '画面提示词', '视频提示词'];
  const rows = groupShots(shots).flatMap((g, gi) =>
    g.shots.map((s, si) => [
      gi + 1,
      `${gi + 1}-${si + 1}`,
      strip(g.text),
      scene(s.scene_id),
      chars(s.character_ids),
      SHOT_TYPES[s.shot_type] ?? s.shot_type,
      COMPOSITIONS[s.composition ?? ''] ?? s.composition ?? '',
      CAMERA_MOVES[s.camera_move] ?? s.camera_move,
      ANGLES[s.angle] ?? s.angle,
      s.lighting ?? '',
      strip(s.action),
      s.sfx ?? '',
      s.dialogue,
      s.duration_sec,
      s.image_prompt,
      s.video_prompt,
    ]),
  );
  const text = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `第${ep.no}集分镜表.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 表里直接改的下拉(景别 / 构图 / 运镜) */
function InlineSelect({ value, options, onChange }: { value: string; options: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <Select
      variant="standard"
      disableUnderline
      value={options[value] ? value : ''}
      displayEmpty
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      renderValue={(v) => options[v as string] ?? '—'}
      sx={{ fontSize: 13, '& .MuiSelect-select': { py: 0.25 } }}
    >
      {Object.entries(options).map(([k, v]) => (
        <MenuItem key={k} value={k} sx={{ fontSize: 13 }}>
          {v}
        </MenuItem>
      ))}
    </Select>
  );
}

const COLS: { label: string; w: number }[] = [
  { label: '分镜号', w: 60 },
  { label: '场景', w: 104 },
  { label: '景别', w: 72 },
  { label: '构图', w: 92 },
  { label: '运镜', w: 72 },
  { label: '光影', w: 150 },
  { label: '分镜描述', w: 280 },
  { label: '音效', w: 100 },
  { label: '对白', w: 210 },
  { label: '时长', w: 52 },
  { label: '操作', w: 120 },
];

export default function StoryboardSection({ projectId, episodeId, setEpisodeId, setSection, setFeedbackTarget, episodeRail, selected, select }: SectionProps) {
  const ov = useOverview(projectId);
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const episodes = ov.data?.episodes ?? [];
  const current = episodes.find((e) => e.id === episodeId) ?? episodes[0];
  const ep = useEpisode(current?.id ?? 0);
  const [editing, setEditing] = useState<Shot | null>(null);
  const [creating, setCreating] = useState<Partial<Shot> | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');

  const all = useMemo(() => ep.data?.shots ?? [], [ep.data]);
  const groups = useMemo(() => groupShots(all), [all]);

  if (ov.isLoading || !ov.data) return <Skeleton variant="rounded" height={320} />;
  if (episodes.length === 0) {
    return <Empty title="还没有分集" hint="先在「剧本」里让编剧搭框架。" action={<Button variant="contained" onClick={() => setSection('script')}>去剧本</Button>} />;
  }
  const data = ov.data;
  const e = ep.data?.episode ?? current!;
  const running = !!data.running;
  const sceneName = (id: number) => data.scenes.find((x) => x.id === id)?.name;
  const runEp = (step: 'storyboard' | 'pacing' | 'qc', extra: Record<string, unknown> = {}) => start.mutate({ step, input: { episode_id: e.id, episode_no: e.no, ...extra } });
  const guard = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      invalidate(e.id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '操作失败');
    }
  };
  const move = (s: Shot, dir: -1 | 1) => {
    const ids = all.map((x) => x.id);
    const i = ids.indexOf(s.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    guard(() => dramaAPI.reorderShots(e.id, ids));
  };
  const addToGroup = (g: Group) => {
    const last = g.shots[g.shots.length - 1];
    setCreating({
      beat: g.beat || undefined,
      beat_text: g.beat ? g.text : undefined,
      sub_no: g.beat ? Math.max(...g.shots.map((s) => s.sub_no ?? 0)) + 1 : undefined,
      no: last.no + 1,
      scene_id: last.scene_id,
      character_ids: [...last.character_ids],
      prop_ids: [],
      shot_type: 'medium',
      composition: 'thirds',
      camera_move: 'static',
      angle: 'eye_level',
      duration_sec: 3,
    });
  };
  const removeGroup = (g: Group, label: string) => {
    if (!window.confirm(`删除${label}及其 ${g.shots.length} 个分镜?`)) return;
    guard(() => Promise.all(g.shots.map((s) => dramaAPI.deleteShot(s.id))));
  };
  const total = all.reduce((a, s) => a + (s.duration_sec || 0), 0);
  const qcIssues: QCIssue[] = (e.qc?.issues as QCIssue[] | undefined) ?? [];
  const grouped = all.some((s) => s.beat);

  return (
    <Stack spacing={2}>
      {!episodeRail && (
        <Tabs value={e.id} onChange={(_, v) => setEpisodeId(v)} variant="scrollable" scrollButtons="auto">
          {episodes.map((x) => (
            <Tab key={x.id} value={x.id} label={`第 ${x.no} 集`} />
          ))}
        </Tabs>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack sx={{ alignItems: 'center', flexWrap: 'wrap' }} direction="row" spacing={1} useFlexGap>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
              <Typography variant="h6">智能分镜 · 第 {e.no} 集</Typography>
              <EntityStatusChip status={e.status} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {grouped ? `${groups.length} 个镜头 · ` : ''}
              {all.length} 个分镜 · {Math.round(total)}s · 已出图 {all.filter((s) => s.frame_url).length}
              {typeof e.qc?.score === 'number' && e.qc.score > 0 ? ` · 质检 ${e.qc.score} 分` : ''}
            </Typography>
          </Box>
          <Stack sx={{ flexWrap: 'wrap' }} direction="row" spacing={0.5} useFlexGap>
            <Tooltip title="分镜师按剧本逐段拆:每个镜头 1~4 个分镜,场景、景别、构图、运镜、光影、音效、对白都填齐,不合格自动退回重写">
              <span>
                <Button size="small" variant="outlined" disabled={running || !e.script_text} onClick={() => (all.length === 0 || window.confirm('重新分镜会替换本集所有分镜(已出的画面也会清掉),继续?')) && runEp('storyboard')}>
                  {all.length ? '重新分镜' : '智能分镜'}
                </Button>
              </span>
            </Tooltip>
            <Button size="small" variant="outlined" disabled={running || all.length === 0} onClick={() => runEp('pacing')}>
              节奏
            </Button>
            <Button size="small" variant="outlined" disabled={running || all.length === 0} onClick={() => runEp('qc')}>
              质检
            </Button>
            <Button size="small" startIcon={<DownloadRoundedIcon />} disabled={all.length === 0} onClick={() => exportCSV(e, all, data)}>
              导出分镜表
            </Button>
            <Button size="small" onClick={() => setFeedbackTarget({ type: 'episode', id: e.id, label: `第 ${e.no} 集分镜` })}>
              提意见
            </Button>
          </Stack>
        </Stack>
        {err && (
          <Alert severity="error" sx={{ mt: 1 }} onClose={() => setErr('')}>
            {err}
          </Alert>
        )}
        {all.length > 0 && <TensionCurve shots={all} payoffs={(e.pacing?.payoffs ?? []).map((p) => p.shot_no)} />}
        {e.qc?.summary && (
          <Alert severity={(e.qc.score ?? 0) >= 80 ? 'success' : 'warning'} sx={{ mt: 1 }}>
            质检 {e.qc.score} 分:{e.qc.summary}
            {qcIssues.length > 0 ? `(${qcIssues.length} 条问题,已标注到分镜)` : ''}
          </Alert>
        )}
        {all.length > 0 && !grouped && (
          <Alert severity="info" sx={{ mt: 1 }}>
            这一集是旧版分镜,没有按剧本段落分组、也没有构图 / 光影 / 音效。点「重新分镜」按新规则重拆。
          </Alert>
        )}
      </Paper>

      {all.length === 0 ? (
        <Empty
          title="这一集还没有分镜"
          hint={e.script_text ? '点「智能分镜」:分镜师把剧本逐段拆成镜头,每个镜头再拆成带完整参数的分镜。' : '先写剧本再分镜。'}
          action={
            e.script_text ? (
              <Button variant="contained" disabled={running} onClick={() => runEp('storyboard')}>
                智能分镜
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Stack spacing={1.5}>
          {groups.map((g, gi) => {
            const label = `镜头${gi + 1}`;
            const open = !collapsed[g.key];
            return (
              <Paper key={g.key} variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', px: 1.5, py: 1, bgcolor: 'action.hover', cursor: 'pointer' }} onClick={() => setCollapsed((c) => ({ ...c, [g.key]: open }))}>
                  <ExpandMoreRoundedIcon fontSize="small" sx={{ mt: 0.25, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', flexShrink: 0 }}>
                    {label}
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0, ...(open ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>
                    <Mentioned text={g.text} />
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mt: 0.25 }}>
                    {g.shots.length} 分镜 · {g.shots.reduce((a, s) => a + (s.duration_sec || 0), 0)}s
                  </Typography>
                  <Tooltip title="删除这个镜头">
                    <IconButton size="small" onClick={(ev) => (ev.stopPropagation(), removeGroup(g, label))}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Collapse in={open} unmountOnExit>
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ tableLayout: 'fixed', minWidth: COLS.reduce((a, c) => a + c.w, 0), '& td, & th': { fontSize: 13, verticalAlign: 'top', py: 0.75 } }}>
                      <TableHead>
                        <TableRow>
                          {COLS.map((c) => (
                            <TableCell key={c.label} sx={{ width: c.w, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                              {c.label}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {g.shots.map((s, si) => {
                          const on = selected?.type === 'shot' && selected.id === s.id;
                          const no = g.beat ? `${gi + 1}-${si + 1}` : `${gi + 1}`;
                          const flagged = s.status === 'qc_flagged' || s.status === 'failed';
                          return (
                            <TableRow
                              key={s.id}
                              hover
                              selected={on}
                              onClick={() => select?.({ type: 'shot', id: s.id, label: `第 ${e.no} 集 分镜 ${no}` })}
                              sx={{ cursor: 'pointer', ...(flagged ? { bgcolor: 'rgba(255,152,0,.06)' } : {}) }}
                            >
                              <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{no}</TableCell>
                              <TableCell>{sceneName(s.scene_id) ? <Mentioned text={`@[${sceneName(s.scene_id)}]`} /> : <Box sx={{ color: 'warning.main' }}>未绑定</Box>}</TableCell>
                              <TableCell>
                                <InlineSelect value={s.shot_type} options={SHOT_TYPES} onChange={(v) => guard(() => dramaAPI.updateShot(s.id, { shot_type: v }))} />
                              </TableCell>
                              <TableCell>
                                <InlineSelect value={s.composition ?? ''} options={COMPOSITIONS} onChange={(v) => guard(() => dramaAPI.updateShot(s.id, { composition: v }))} />
                              </TableCell>
                              <TableCell>
                                <InlineSelect value={s.camera_move} options={CAMERA_MOVES} onChange={(v) => guard(() => dramaAPI.updateShot(s.id, { camera_move: v }))} />
                              </TableCell>
                              <TableCell sx={{ color: 'text.secondary' }}>{s.lighting || '-'}</TableCell>
                              <TableCell>
                                <Mentioned text={s.action} />
                                {s.qc_issues?.length > 0 && (
                                  <Box sx={{ mt: 0.5 }}>
                                    {s.qc_issues.slice(0, 2).map((it, i) => (
                                      <Typography key={i} variant="caption" sx={{ display: 'block' }} color={it.severity === 'high' ? 'error.main' : 'warning.main'}>
                                        [{it.type}] {it.message}
                                      </Typography>
                                    ))}
                                  </Box>
                                )}
                                {s.gen_error && (
                                  <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                                    {s.gen_error}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ color: 'text.secondary' }}>{s.sfx || '-'}</TableCell>
                              <TableCell>
                                <Dialogue text={s.dialogue} />
                              </TableCell>
                              <TableCell>{s.duration_sec}s</TableCell>
                              <TableCell onClick={(ev) => ev.stopPropagation()} sx={{ whiteSpace: 'nowrap' }}>
                                <IconButton size="small" aria-label="编辑" onClick={() => setEditing(s)}>
                                  <EditRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                <IconButton size="small" aria-label="上移" disabled={s.no <= 1} onClick={() => move(s, -1)}>
                                  <ArrowUpwardRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                <IconButton size="small" aria-label="下移" disabled={s.no >= all.length} onClick={() => move(s, 1)}>
                                  <ArrowDownwardRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                <IconButton size="small" aria-label="删除" onClick={() => window.confirm(`删除分镜 ${no}?`) && guard(() => dramaAPI.deleteShot(s.id))}>
                                  <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                {s.status !== 'draft' && (
                                  <Box sx={{ mt: 0.25 }}>
                                    <ShotStatusChip status={s.status} />
                                  </Box>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                  <Button fullWidth size="small" variant="text" startIcon={<AddRoundedIcon />} onClick={() => addToGroup(g)} sx={{ borderRadius: 0, color: 'text.secondary' }}>
                    添加分镜
                  </Button>
                </Collapse>
              </Paper>
            );
          })}
        </Stack>
      )}

      <ShotDialog
        open={!!editing || !!creating}
        shot={editing}
        label={editing ? shotLabel(editing, all) : undefined}
        initial={creating}
        scenes={data.scenes}
        characters={data.characters}
        onClose={() => {
          setEditing(null);
          setCreating(null);
        }}
        onSave={async (fields) => {
          if (editing) await guard(() => dramaAPI.updateShot(editing.id, fields));
          else await guard(() => dramaAPI.createShot(e.id, { ...creating, ...fields }));
        }}
      />
    </Stack>
  );
}

/** 张力曲线:x = 镜头序号,y = tension;爽点镜头标红。 */
function TensionCurve({ shots, payoffs }: { shots: Shot[]; payoffs: number[] }) {
  const w = Math.max(320, shots.length * 28);
  const h = 72;
  const pts = shots.map((s, i) => [12 + (i * (w - 24)) / Math.max(1, shots.length - 1), h - 8 - ((s.tension || 0) / 100) * (h - 20)] as const);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const hasTension = shots.some((s) => s.tension > 0);
  return (
    <Box sx={{ overflowX: 'auto', mt: 1 }}>
      <svg width={w} height={h} role="img" aria-label="张力曲线">
        <line x1={12} y1={h - 8} x2={w - 12} y2={h - 8} stroke="currentColor" strokeOpacity={0.2} />
        {hasTension && <path d={path} fill="none" stroke="currentColor" strokeOpacity={0.7} strokeWidth={1.5} />}
        {pts.map((p, i) => {
          const s = shots[i];
          const payoff = s.beat_type === 'payoff' || payoffs.includes(s.no);
          const cliff = s.beat_type === 'cliffhanger';
          return (
            <g key={s.id}>
              <circle cx={p[0]} cy={hasTension ? p[1] : h - 8} r={payoff ? 4 : 2.5} fill={payoff ? '#FE2C55' : cliff ? '#25F4EE' : 'currentColor'} fillOpacity={payoff || cliff ? 1 : 0.5} />
              <text x={p[0]} y={h} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
                {s.no}
              </text>
            </g>
          );
        })}
      </svg>
      {!hasTension && (
        <Typography variant="caption" color="text.secondary">
          运行「节奏」后这里显示张力曲线与爽点分布。
        </Typography>
      )}
    </Box>
  );
}

function ShotDialog({
  open,
  shot,
  label,
  initial,
  scenes,
  characters,
  onClose,
  onSave,
}: {
  open: boolean;
  shot: Shot | null;
  /** 显示名(分镜 3-2),按当前顺序现排 */
  label?: string;
  /** 新建时的默认值(加在哪个镜头下、沿用上一分镜的场景和角色) */
  initial?: Partial<Shot> | null;
  scenes: { id: number; name: string }[];
  characters: { id: number; name: string }[];
  onClose: () => void;
  onSave: (f: Partial<Shot>) => Promise<void>;
}) {
  const [f, setF] = useState<Partial<Shot>>({});
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    setF(shot ? { ...shot } : { shot_type: 'medium', composition: 'thirds', camera_move: 'static', angle: 'eye_level', duration_sec: 3, character_ids: [], prop_ids: [], ...initial });
  }, [shot, initial, open]);
  const set = <K extends keyof Shot>(k: K, v: Shot[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{shot ? `编辑${label ?? '分镜'}` : '添加分镜'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <FormControl fullWidth size="small">
              <InputLabel>场景</InputLabel>
              <Select label="场景" value={f.scene_id ?? 0} onChange={(e) => set('scene_id', Number(e.target.value))}>
                <MenuItem value={0}>未绑定</MenuItem>
                {scenes.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>出场角色</InputLabel>
              <Select multiple label="出场角色" value={f.character_ids ?? []} onChange={(e) => set('character_ids', e.target.value as number[])} renderValue={(v) => (v as number[]).map((id) => characters.find((c) => c.id === id)?.name).join('、')}>
                {characters.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <TextField size="small" label="分镜描述(谁在哪、做什么、表情;人物写成 @[名字])" multiline minRows={2} value={f.action ?? ''} onChange={(e) => set('action', e.target.value)} />
          <TextField size="small" label="对白(每句一行:角色名:台词)" multiline value={f.dialogue ?? ''} onChange={(e) => set('dialogue', e.target.value)} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField size="small" fullWidth label="光影" placeholder="光源方向、明暗、色调" value={f.lighting ?? ''} onChange={(e) => set('lighting', e.target.value)} />
            <TextField size="small" fullWidth label="音效" value={f.sfx ?? ''} onChange={(e) => set('sfx', e.target.value)} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <SelectField label="景别" value={f.shot_type ?? 'medium'} options={SHOT_TYPES} onChange={(v) => set('shot_type', v)} />
            <SelectField label="构图" value={f.composition ?? 'thirds'} options={COMPOSITIONS} onChange={(v) => set('composition', v)} />
            <SelectField label="运镜" value={f.camera_move ?? 'static'} options={CAMERA_MOVES} onChange={(v) => set('camera_move', v)} />
            <SelectField label="机位" value={f.angle ?? 'eye_level'} options={ANGLES} onChange={(v) => set('angle', v)} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField size="small" label="时长(秒)" type="number" value={f.duration_sec ?? 3} onChange={(e) => set('duration_sec', Number(e.target.value) || 3)} fullWidth />
            <SelectField label="节拍" value={f.beat_type ?? ''} options={{ '': '—', ...BEATS }} onChange={(v) => set('beat_type', v)} />
            <TextField size="small" label="张力 0-100" type="number" value={f.tension ?? 0} onChange={(e) => set('tension', Number(e.target.value) || 0)} fullWidth />
            <TextField size="small" label="情绪" value={f.emotion ?? ''} onChange={(e) => set('emotion', e.target.value)} fullWidth />
          </Stack>
          <TextField size="small" label="画面提示词(英文,只写这一镜)" multiline minRows={2} value={f.image_prompt ?? ''} onChange={(e) => set('image_prompt', e.target.value)} />
          <TextField size="small" label="动态提示词(英文)" multiline value={f.video_prompt ?? ''} onChange={(e) => set('video_prompt', e.target.value)} />
          <TextField size="small" label="种子" type="number" value={f.seed ?? 0} onChange={(e) => set('seed', Number(e.target.value) || 0)} />
          {shot?.final_prompt && (
            <TextField size="small" label="上次实际提交的完整提示词(只读)" multiline value={shot.final_prompt} slotProps={{ input: { readOnly: true } }} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const rest: Partial<Shot> = { ...f };
              delete rest.id;
              delete rest.project_id;
              delete rest.episode_id;
              delete rest.status;
              await onSave(rest);
              onClose();
            } finally {
              setSaving(false);
            }
          }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([k, v]) => (
          <MenuItem key={k} value={k}>
            {v}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
