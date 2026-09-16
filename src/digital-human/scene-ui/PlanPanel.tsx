'use client';

/**
 * 任务板 —— 数字人调 ui_show_plan 时挂在身边,列出多步任务的步骤和状态。
 * 同一个 id 再调一次就原地刷新(scenePanelFromToolCall 用 args.id 当面板 id)。
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import type { ScenePlanStep, ScenePlanStepStatus } from './types';

const ICON: Record<ScenePlanStepStatus, string> = {
  pending: '○',
  running: '◐',
  done: '●',
  failed: '✕',
  skipped: '–',
};

const COLOR: Record<ScenePlanStepStatus, string> = {
  pending: 'text.disabled',
  running: 'warning.main',
  done: 'success.main',
  failed: 'error.main',
  skipped: 'text.disabled',
};

export function planProgress(steps: ScenePlanStep[]): { done: number; total: number; percent: number } {
  const total = steps.length;
  const done = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export default function PlanPanel({ steps }: { steps: ScenePlanStep[] }) {
  const { done, total, percent } = planProgress(steps);
  const failed = steps.some((s) => s.status === 'failed');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinearProgress
          variant="determinate"
          value={percent}
          color={failed ? 'error' : 'primary'}
          sx={{ flex: 1, height: 6, borderRadius: 3 }}
          aria-label="任务进度"
        />
        <Typography variant="caption" color="text.secondary">{done}/{total}</Typography>
      </Box>
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {steps.map((s) => (
          <Box component="li" key={s.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Typography component="span" sx={{ color: COLOR[s.status], width: 16, textAlign: 'center', flexShrink: 0 }} aria-label={s.status}>
              {ICON[s.status]}
            </Typography>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: s.status === 'running' ? 600 : 400, textDecoration: s.status === 'skipped' ? 'line-through' : 'none' }}
              >
                {s.title}
              </Typography>
              {s.detail && (
                <Typography variant="caption" color={s.status === 'failed' ? 'error' : 'text.secondary'} sx={{ display: 'block' }}>
                  {s.detail}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
