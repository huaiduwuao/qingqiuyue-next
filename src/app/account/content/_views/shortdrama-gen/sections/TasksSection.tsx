'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { useQuery } from '@tanstack/react-query';
import { AGENT_LABELS, dramaAPI, isTaskTerminal, type Task } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { Empty, TaskStatusChip, fmtTime } from '../common';
import { qk, useTasks } from '../useProject';

export default function TasksSection({ projectId }: SectionProps) {
  const tasks = useTasks(projectId);
  const revisions = useQuery({ queryKey: qk.revisions(projectId), queryFn: () => dramaAPI.revisions(projectId) });
  const [open, setOpen] = useState<number | null>(null);

  if (tasks.isLoading) return <Skeleton variant="rounded" height={320} />;
  const list = tasks.data?.list ?? [];

  return (
    <Stack spacing={2}>
      <Typography variant="h6">任务({list.length})</Typography>
      {list.length === 0 ? (
        <Empty title="还没有任务" hint="每次调度数字员工都会在这里留下记录与日志。" />
      ) : (
        <Stack spacing={1}>
          {list.map((t) => (
            <TaskRow key={t.id} task={t} expanded={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
          ))}
        </Stack>
      )}

      <Typography variant="h6" sx={{ mt: 2 }}>
        修改记录({revisions.data?.length ?? 0})
      </Typography>
      {(revisions.data ?? []).length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          在右侧活动面板提交的修改意见和反馈优化员工的处理计划会记录在这里。
        </Typography>
      ) : (
        <Stack spacing={1}>
          {revisions.data!.map((r) => {
            const plan = r.plan as { understanding?: string; reply?: string; rerun?: { step: string }[]; entity_updates?: unknown[] };
            return (
              <Paper key={r.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
                  <Chip size="small" variant="outlined" label={`${r.target_type}#${r.target_id}`} />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {r.instruction}
                  </Typography>
                  <Chip size="small" label={r.status} color={r.status === 'applied' ? 'success' : r.status === 'failed' ? 'error' : 'default'} />
                  <Typography variant="caption" color="text.secondary">
                    {fmtTime(r.created_at)}
                  </Typography>
                </Stack>
                {plan?.understanding && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    理解:{plan.understanding}
                    {plan.entity_updates?.length ? ` · 改 ${plan.entity_updates.length} 处` : ''}
                    {plan.rerun?.length ? ` · 重跑 ${plan.rerun.map((x) => x.step).join(' → ')}` : ''}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

function TaskRow({ task: t, expanded, onToggle }: { task: Task; expanded: boolean; onToggle: () => void }) {
  const busy = !isTaskTerminal(t.status);
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
        <Chip size="small" label={AGENT_LABELS[t.agent] ?? t.agent} />
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>
          {t.title}
        </Typography>
        <TaskStatusChip status={t.status} />
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {fmtTime(t.created_at)}
          {t.finished_at && t.started_at ? ` · ${Math.round((new Date(t.finished_at).getTime() - new Date(t.started_at).getTime()) / 1000)}s` : ''}
        </Typography>
        {busy && (
          <IconButton size="small" color="error" onClick={() => dramaAPI.cancelTask(t.id)} aria-label="取消">
            <StopRoundedIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton size="small" onClick={onToggle} sx={{ transform: expanded ? 'rotate(180deg)' : 'none' }} aria-label="展开日志">
          <ExpandMoreRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
      {busy && <LinearProgress variant={t.progress > 0 ? 'determinate' : 'indeterminate'} value={t.progress} sx={{ mt: 1, borderRadius: 1 }} />}
      {t.error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {t.error}
        </Typography>
      )}
      <Collapse in={expanded}>
        <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, maxHeight: 320, overflow: 'auto' }}>
          {(t.logs ?? []).length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              没有日志
            </Typography>
          ) : (
            (t.logs ?? []).map((l, i) => (
              <Typography key={i} variant="caption" sx={{ display: 'block', whiteSpace: 'pre-wrap', color: l.level === 'error' ? 'error.main' : l.level === 'warn' ? 'warning.main' : 'text.secondary' }}>
                {fmtTime(l.ts).slice(-8)} {l.text}
              </Typography>
            ))
          )}
          {Object.keys(t.input ?? {}).length > 0 && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: 'monospace' }}>
              input: {JSON.stringify(t.input)}
            </Typography>
          )}
          {Object.keys(t.output ?? {}).length > 0 && (
            <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              output: {JSON.stringify(t.output).slice(0, 600)}
            </Typography>
          )}
        </Box>
      </Collapse>
      {!expanded && (t.logs ?? []).length > 0 && (
        <Button size="small" onClick={onToggle} sx={{ mt: 0.5 }}>
          {(t.logs ?? []).length} 条日志
        </Button>
      )}
    </Paper>
  );
}
