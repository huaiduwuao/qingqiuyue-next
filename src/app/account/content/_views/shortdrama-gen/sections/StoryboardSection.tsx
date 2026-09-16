'use client';

/**
 * 分镜分区:某一集的镜头板 + 节奏张力曲线 + 质检结论。
 * 每个镜头卡片可编辑、单独重出、标记通过、提意见;整集可发起分镜 / 节奏 / 出图 / 出片 / 质检。
 */

import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { ANGLES, BEATS, CAMERA_MOVES, SHOT_TYPES, dramaAPI, type QCIssue, type Shot } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { Empty, EntityStatusChip, MediaThumb, ShotStatusChip, UploadImageButton } from '../common';
import { useCapabilities, useEpisode, useInvalidate, useOverview, useStartTask } from '../useProject';

export default function StoryboardSection({ projectId, episodeId, setEpisodeId, setSection, setFeedbackTarget }: SectionProps) {
  const ov = useOverview(projectId);
  const caps = useCapabilities();
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const episodes = ov.data?.episodes ?? [];
  const current = episodes.find((e) => e.id === episodeId) ?? episodes[0];
  const ep = useEpisode(current?.id ?? 0);
  const [editing, setEditing] = useState<Shot | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'all' | 'flagged' | 'missing'>('all');

  const running = !!ov.data?.running;
  const c = caps.data?.capabilities;
  const canRender = !!(c?.t2i.available || c?.i2i.available);
  const canVideo = !!c?.i2v.available;

  const shots = useMemo(() => {
    const all = ep.data?.shots ?? [];
    if (filter === 'flagged') return all.filter((s) => s.status === 'qc_flagged' || s.status === 'failed');
    if (filter === 'missing') return all.filter((s) => !s.frame_url);
    return all;
  }, [ep.data, filter]);

  if (ov.isLoading) return <Skeleton variant="rounded" height={320} />;
  if (episodes.length === 0) {
    return <Empty title="还没有分集" hint="先在「剧本」里让编剧搭框架。" action={<Button variant="contained" onClick={() => setSection('script')}>去剧本</Button>} />;
  }
  const e = ep.data?.episode ?? current!;
  const all = ep.data?.shots ?? [];
  const byId = {
    scene: (id: number) => ov.data?.scenes.find((x) => x.id === id),
    char: (id: number) => ov.data?.characters.find((x) => x.id === id),
    prop: (id: number) => ov.data?.props.find((x) => x.id === id),
  };
  const runEp = (step: 'storyboard' | 'pacing' | 'visual_gen' | 'qc', extra: Record<string, unknown> = {}) =>
    start.mutate({ step, input: { episode_id: e.id, episode_no: e.no, ...extra } });
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
  const total = all.reduce((a, s) => a + (s.duration_sec || 0), 0);
  const qcIssues: QCIssue[] = (e.qc?.issues as QCIssue[] | undefined) ?? [];

  return (
    <Stack spacing={2}>
      <Tabs value={e.id} onChange={(_, v) => setEpisodeId(v)} variant="scrollable" scrollButtons="auto">
        {episodes.map((x) => (
          <Tab key={x.id} value={x.id} label={`第 ${x.no} 集`} />
        ))}
      </Tabs>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack sx={{ alignItems: 'center', flexWrap: 'wrap' }} direction="row" spacing={1} useFlexGap>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
              <Typography variant="h6">
                第 {e.no} 集 · {e.title || '未命名'}
              </Typography>
              <EntityStatusChip status={e.status} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {all.length} 镜 · {Math.round(total)}s · 已出图 {all.filter((s) => s.frame_url).length} · 待修 {all.filter((s) => s.status === 'qc_flagged' || s.status === 'failed').length}
              {typeof e.qc?.score === 'number' && e.qc.score > 0 ? ` · 质检 ${e.qc.score} 分` : ''}
            </Typography>
          </Box>
          <Stack sx={{ flexWrap: 'wrap' }} direction="row" spacing={0.5} useFlexGap>
            <Button size="small" variant="outlined" disabled={running || !e.script_text} onClick={() => runEp('storyboard')}>
              {all.length ? '重新分镜' : '分镜'}
            </Button>
            <Button size="small" variant="outlined" disabled={running || all.length === 0} onClick={() => runEp('pacing')}>
              节奏
            </Button>
            <Tooltip title={canRender ? '只补没出的镜头' : '没有启用出图工作流'}>
              <span>
                <Button size="small" variant="contained" disabled={running || all.length === 0 || !canRender} onClick={() => runEp('visual_gen')}>
                  出图
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={canVideo ? '出图后再图生视频' : '没有启用图生视频工作流'}>
              <span>
                <Button size="small" variant="outlined" disabled={running || all.length === 0 || !canVideo} onClick={() => runEp('visual_gen', { video: true, force: true })}>
                  出图+出片
                </Button>
              </span>
            </Tooltip>
            <Button size="small" variant="outlined" disabled={running || all.length === 0} onClick={() => runEp('qc')}>
              质检
            </Button>
            <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setCreating(true)}>
              加镜头
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
        {e.pacing?.notes && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            节奏控制:{e.pacing.notes}
          </Typography>
        )}
        {e.qc?.summary && (
          <Alert severity={(e.qc.score ?? 0) >= 80 ? 'success' : 'warning'} sx={{ mt: 1 }}>
            质检 {e.qc.score} 分:{e.qc.summary}
            {qcIssues.length > 0 ? `(${qcIssues.length} 条问题,已标注到镜头)` : ''}
          </Alert>
        )}
      </Paper>

      {all.length === 0 ? (
        <Empty title="这一集还没有镜头" hint={e.script_text ? '点「分镜」让分镜师把剧本拆成镜头。' : '先写剧本再分镜。'} />
      ) : (
        <>
          <Stack direction="row" spacing={0.5}>
            {(['all', 'flagged', 'missing'] as const).map((f) => (
              <Chip key={f} size="small" label={f === 'all' ? `全部 ${all.length}` : f === 'flagged' ? '待修' : '未出图'} color={filter === f ? 'primary' : 'default'} onClick={() => setFilter(f)} />
            ))}
          </Stack>
          <Grid container spacing={1.5}>
            {shots.map((s) => (
              <Grid key={s.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card variant="outlined" sx={{ height: '100%', borderColor: s.status === 'qc_flagged' ? 'warning.main' : s.status === 'failed' ? 'error.main' : undefined }}>
                  <Box sx={{ display: 'flex', gap: 1.5, p: 1.5 }}>
                    <Box>
                      <MediaThumb src={s.frame_url} video={s.video_url} height={190} ratio={ov.data?.project.aspect === '16:9' ? '16 / 9' : '9 / 16'} />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.25 }}>
                        v{s.version} · {s.duration_sec}s
                      </Typography>
                    </Box>
                    <CardContent sx={{ p: 0, flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 700 }} variant="subtitle2">
                          #{s.no}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                          {byId.scene(s.scene_id)?.name ?? '未绑定场景'}
                        </Typography>
                        <ShotStatusChip status={s.status} />
                      </Stack>
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                        <Chip size="small" variant="outlined" label={SHOT_TYPES[s.shot_type] ?? s.shot_type} />
                        <Chip size="small" variant="outlined" label={CAMERA_MOVES[s.camera_move] ?? s.camera_move} />
                        {s.angle && s.angle !== 'eye_level' && <Chip size="small" variant="outlined" label={ANGLES[s.angle] ?? s.angle} />}
                        {s.beat_type && <Chip size="small" color={s.beat_type === 'payoff' ? 'secondary' : 'default'} label={`${BEATS[s.beat_type] ?? s.beat_type} ${s.tension || ''}`} />}
                      </Stack>
                      <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {s.action}
                      </Typography>
                      {s.dialogue && (
                        <Typography variant="body2" color="primary" sx={{ mt: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          “{s.dialogue}”
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {s.character_ids.map((id) => byId.char(id)?.name).filter(Boolean).join(' / ')}
                        {s.emotion ? ` · ${s.emotion}` : ''}
                      </Typography>
                      {s.gen_error && (
                        <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                          {s.gen_error}
                        </Typography>
                      )}
                      {s.qc_issues?.length > 0 && (
                        <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                          {s.qc_issues.slice(0, 3).map((it, i) => (
                            <Typography key={i} variant="caption" color={it.severity === 'high' ? 'error.main' : it.severity === 'medium' ? 'warning.main' : 'text.secondary'}>
                              [{it.type}] {it.message}
                              {it.suggestion ? ` → ${it.suggestion}` : ''}
                            </Typography>
                          ))}
                          {s.qc_issues.length > 3 && (
                            <Typography variant="caption" color="text.secondary">
                              还有 {s.qc_issues.length - 3} 条…
                            </Typography>
                          )}
                        </Stack>
                      )}
                      <Stack direction="row" sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                        <Tooltip title="编辑">
                          <IconButton size="small" onClick={() => setEditing(s)}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={canRender ? '重出此镜' : '没有启用出图工作流'}>
                          <span>
                            <IconButton size="small" disabled={running || !canRender} onClick={() => start.mutate({ step: 'visual_gen', input: { episode_id: e.id, episode_no: e.no, shot_ids: [s.id], force: true } })}>
                              <ReplayRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={s.status === 'approved' ? '取消通过' : '标记通过'}>
                          <IconButton size="small" color={s.status === 'approved' ? 'success' : 'default'} onClick={() => guard(() => dramaAPI.updateShot(s.id, { status: s.status === 'approved' ? (s.frame_url ? 'done' : 'draft') : 'approved' }))}>
                            <CheckCircleOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => move(s, -1)} disabled={s.no <= 1}>
                          <ArrowUpwardRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => move(s, 1)} disabled={s.no >= all.length}>
                          <ArrowDownwardRoundedIcon fontSize="small" />
                        </IconButton>
                        <UploadImageButton label="上传画面" onUploaded={(url) => guard(() => dramaAPI.updateShot(s.id, { frame_url: url, status: 'done' }))} />
                        <Button size="small" onClick={() => setFeedbackTarget({ type: 'shot', id: s.id, label: `第 ${e.no} 集 #${s.no} 镜` })}>
                          提意见
                        </Button>
                        <IconButton size="small" color="error" onClick={() => window.confirm(`删除 #${s.no} 镜?`) && guard(() => dramaAPI.deleteShot(s.id))}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      <ShotDialog
        open={!!editing || creating}
        shot={editing}
        scenes={ov.data?.scenes ?? []}
        characters={ov.data?.characters ?? []}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSave={async (fields) => {
          if (editing) await guard(() => dramaAPI.updateShot(editing.id, fields));
          else await guard(() => dramaAPI.createShot(e.id, fields));
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
  scenes,
  characters,
  onClose,
  onSave,
}: {
  open: boolean;
  shot: Shot | null;
  scenes: { id: number; name: string }[];
  characters: { id: number; name: string }[];
  onClose: () => void;
  onSave: (f: Partial<Shot>) => Promise<void>;
}) {
  const [f, setF] = useState<Partial<Shot>>({});
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    setF(shot ? { ...shot } : { shot_type: 'medium', camera_move: 'static', angle: 'eye_level', duration_sec: 3, character_ids: [], prop_ids: [] });
  }, [shot, open]);
  const set = <K extends keyof Shot>(k: K, v: Shot[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{shot ? `编辑 #${shot.no} 镜` : '新增镜头'}</DialogTitle>
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
          <TextField size="small" label="画面内容" multiline minRows={2} value={f.action ?? ''} onChange={(e) => set('action', e.target.value)} />
          <TextField size="small" label="台词" multiline value={f.dialogue ?? ''} onChange={(e) => set('dialogue', e.target.value)} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <SelectField label="景别" value={f.shot_type ?? 'medium'} options={SHOT_TYPES} onChange={(v) => set('shot_type', v)} />
            <SelectField label="运镜" value={f.camera_move ?? 'static'} options={CAMERA_MOVES} onChange={(v) => set('camera_move', v)} />
            <SelectField label="角度" value={f.angle ?? 'eye_level'} options={ANGLES} onChange={(v) => set('angle', v)} />
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
