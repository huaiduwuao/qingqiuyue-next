'use client';

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import IconButton from '@mui/material/IconButton';
import { STEP_LABELS, dramaAPI } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { EntityStatusChip, MediaThumb, TextEditDialog } from '../common';
import { useAgents, useCapabilities, useInvalidate, useOverview, useStartTask } from '../useProject';

const STAGES = [
  { id: 'intent', label: '意图' },
  { id: 'script', label: '剧本' },
  { id: 'visual', label: '视觉设定' },
  { id: 'storyboard', label: '分镜' },
  { id: 'pacing', label: '节奏' },
  { id: 'render', label: '出图' },
  { id: 'qc', label: '质检' },
];

export default function OverviewSection({ projectId, setSection, setFeedbackTarget }: SectionProps) {
  const ov = useOverview(projectId);
  const caps = useCapabilities();
  const agents = useAgents();
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const [edit, setEdit] = useState<null | 'logline' | 'synopsis' | 'intent'>(null);

  if (ov.isLoading || !ov.data) return <Skeleton variant="rounded" height={320} />;
  const { project: p, characters, scenes, props, episodes, shot_stats: stats, running } = ov.data;
  const stageIdx = Math.max(0, STAGES.findIndex((s) => s.id === p.stage));
  const c = caps.data?.capabilities;

  const save = (field: 'logline' | 'synopsis' | 'intent') => async (v: string) => {
    await dramaAPI.updateProject(projectId, { [field]: v });
    invalidate();
  };

  return (
    <Stack spacing={2.5}>
      <Stepper activeStep={stageIdx} alternativeLabel sx={{ overflowX: 'auto' }}>
        {STAGES.map((s) => (
          <Step key={s.id} completed={STAGES.findIndex((x) => x.id === p.stage) > STAGES.findIndex((x) => x.id === s.id) || p.status === 'done'}>
            <StepLabel>{s.label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {caps.data && c && !c.t2i.available && !c.i2i.available && (
        <Alert severity="info">没有启用的出图工作流,出图/出片环节会跳过;其余环节不受影响。管理员可在「设置」里启用。</Alert>
      )}

      <Card variant="outlined">
        <Box sx={{ display: 'flex', gap: 2, p: 2, flexWrap: 'wrap' }}>
          <MediaThumb src={p.cover_url} height={180} ratio={p.aspect === '16:9' ? '16 / 9' : p.aspect === '1:1' ? '1 / 1' : '9 / 16'} />
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Field label="故事意图" value={p.intent} onEdit={() => setEdit('intent')} />
            <Field label="一句话故事" value={p.logline || '(编剧还没写,运行「剧本框架」)'} onEdit={() => setEdit('logline')} />
            <Field label="梗概" value={p.synopsis || '—'} onEdit={() => setEdit('synopsis')} clamp={4} />
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
              {p.genre && <Chip size="small" label={p.genre} />}
              <Chip size="small" variant="outlined" label={p.style} />
              {p.tone && <Chip size="small" variant="outlined" label={p.tone} />}
              {p.audience && <Chip size="small" variant="outlined" label={`受众:${p.audience}`} />}
            </Stack>
          </Box>
        </Box>
      </Card>

      <Grid container spacing={1.5}>
        {[
          { label: '角色', n: characters.length, hint: `${characters.filter((x) => x.ref_image_url).length} 已定妆`, go: 'characters' as const },
          { label: '场景', n: scenes.length, hint: `${scenes.filter((x) => x.visual_prompt).length} 已设定`, go: 'scenes' as const },
          { label: '道具', n: props.length, hint: `${props.filter((x) => x.visual_prompt).length} 已设定`, go: 'props' as const },
          { label: '镜头', n: stats.total ?? 0, hint: `${stats.done ?? 0} 已出图 · ${stats.qc_flagged ?? 0} 待修`, go: 'storyboard' as const },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 6, md: 3 }}>
            <Card variant="outlined">
              <CardActionArea onClick={() => setSection(k.go)}>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {k.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }} variant="h5">
                    {k.n}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {k.hint}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box>
        <Stack direction="row" sx={{ mb: 1, alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
            分集
          </Typography>
          <Button size="small" onClick={() => setSection('script')}>
            查看剧本
          </Button>
        </Stack>
        {episodes.length === 0 ? (
          <Alert
            severity="info"
            action={
              <Button size="small" disabled={!!running || start.isPending} onClick={() => start.mutate({ step: 'screenwriter' })}>
                运行剧本框架
              </Button>
            }
          >
            还没有分集。编剧会根据意图产出角色、场景、道具和分集大纲。
          </Alert>
        ) : (
          <Grid container spacing={1.5}>
            {episodes.map((ep) => (
              <Grid key={ep.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardActionArea onClick={() => setSection('storyboard', { episodeId: ep.id })} sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack direction="row" spacing={1} sx={{ mb: 0.5, alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ flex: 1 }} noWrap>
                          第 {ep.no} 集 · {ep.title || '未命名'}
                        </Typography>
                        <EntityStatusChip status={ep.status} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ep.synopsis || '—'}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                        {ep.duration_sec > 0 && <Chip size="small" variant="outlined" label={`${ep.duration_sec}s`} />}
                        {typeof ep.qc?.score === 'number' && ep.qc.score > 0 && <Chip size="small" variant="outlined" color={ep.qc.score >= 80 ? 'success' : 'warning'} label={`质检 ${ep.qc.score}`} />}
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          数字员工
        </Typography>
        <Grid container spacing={1.5}>
          {(agents.data?.agents ?? []).map((a) => (
            <Grid key={a.agentId} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
                    <Typography variant="subtitle2" sx={{ flex: 1 }}>
                      {a.name}
                    </Typography>
                    {running?.agent === a.agentId && <Chip size="small" color="primary" label="工作中" />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {a.description}
                  </Typography>
                  <Stack sx={{ flexWrap: 'wrap' }} direction="row" spacing={0.5} useFlexGap>
                    {a.steps.map((s) => (
                      <Chip
                        key={s}
                        size="small"
                        variant="outlined"
                        label={STEP_LABELS[s] ?? s}
                        clickable={s === 'screenwriter' || s === 'visual_design'}
                        onClick={s === 'screenwriter' || s === 'visual_design' ? () => start.mutate({ step: s }) : undefined}
                      />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          按集运行的环节(分场剧本 / 分镜 / 节奏 / 出图 / 质检)在「剧本」「分镜」分区里按集发起;修改意见在右侧活动面板提交给反馈优化员工。
          <Button size="small" sx={{ ml: 1 }} onClick={() => setFeedbackTarget({ type: 'project', id: projectId, label: '整个项目' })}>
            对整体提意见
          </Button>
        </Typography>
      </Box>

      <TextEditDialog open={edit === 'intent'} title="故事意图" value={p.intent} onClose={() => setEdit(null)} onSave={save('intent')} />
      <TextEditDialog open={edit === 'logline'} title="一句话故事" value={p.logline} onClose={() => setEdit(null)} onSave={save('logline')} />
      <TextEditDialog open={edit === 'synopsis'} title="梗概" value={p.synopsis} onClose={() => setEdit(null)} onSave={save('synopsis')} />
    </Stack>
  );
}

function Field({ label, value, onEdit, clamp = 2 }: { label: string; value: string; onEdit: () => void; clamp?: number }) {
  return (
    <Box sx={{ mb: 1 }}>
      <Stack sx={{ alignItems: 'center' }} direction="row" spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <IconButton size="small" onClick={onEdit} aria-label={`编辑${label}`}>
          <EditRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Stack>
      <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: clamp, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>
        {value}
      </Typography>
    </Box>
  );
}
