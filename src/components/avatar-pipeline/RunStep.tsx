'use client';

import {
  Box, Typography, Button, LinearProgress, Chip,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import LogTail from './LogTail';
import { STAGE_LABELS, STAGE_ORDER } from './usePipelineJob';
import type { PipelineStage, JobSnapshot } from '@/lib/avatar-pipeline/types';

export interface RunStepProps {
  job: JobSnapshot | null;
  stage: PipelineStage | null;
  pct: number;
  logs: { stream: 'stdout' | 'stderr'; line: string; t: number }[];
  status: string;
  connection: string;
  onCancel: () => void;
  onContinue: () => void;
}

export default function RunStep({
  job, stage, pct, logs, status, connection, onCancel, onContinue,
}: RunStepProps) {
  const isRunning = status === 'running';
  const isFailed = status === 'failed' || status === 'cancelled';
  const jobDone = status === 'completed';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>第 3 步:实时进度</Typography>
        {isRunning && (
          <Chip
            size="small"
            label={connection === 'open' ? '● 已连接' : '○ ' + connection}
            color={connection === 'open' ? 'success' : 'default'}
            sx={{ height: 20, fontSize: 10 }}
          />
        )}
      </Box>

      {/* 阶段列表 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {STAGE_ORDER.map((s) => {
          const idx = STAGE_ORDER.indexOf(s);
          const currentIdx = stage ? STAGE_ORDER.indexOf(stage) : -1;
          const stageDone = jobDone || (currentIdx >= 0 && idx < currentIdx);
          const isCurrent = !stageDone && s === stage && isRunning;
          const isSkipped = s === 'train_3dgs' && job?.config?.skip3dgs;
          return (
            <Box
              key={s}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: isCurrent
                  ? (t) => `${t.palette.primary.main}15`
                  : 'transparent',
              }}
            >
              {isSkipped ? (
                <Chip size="small" label="跳过" sx={{ height: 18, fontSize: 9 }} />
              ) : stageDone ? (
                <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
              ) : isCurrent ? (
                <PlayArrowRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              ) : isFailed ? (
                <ErrorRoundedIcon sx={{ fontSize: 18, color: 'error.main' }} />
              ) : (
                <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              )}
              <Typography sx={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, flex: 1 }}>
                {STAGE_LABELS[s]}
              </Typography>
              {isCurrent && (
                <Typography sx={{ fontSize: 11, color: 'primary.main' }}>
                  {pct}%
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      {isRunning && (
        <Box>
          <LinearProgress
            variant={stage ? 'determinate' : 'indeterminate'}
            value={pct}
          />
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
            总进度 {pct}%
            {job?.durationMs && ` · 已用 ${Math.floor(job.durationMs / 60_000)} 分 ${Math.floor((job.durationMs % 60_000) / 1000)} 秒`}
          </Typography>
        </Box>
      )}

      {isFailed && job?.error && (
        <Box sx={{
          p: 1.5,
          borderRadius: 1,
          bgcolor: (t) => `${t.palette.error.main}10`,
          border: '1px solid',
          borderColor: 'error.main',
        }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'error.main' }}>
            失败: {job.error.stage}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
            {job.error.message}
          </Typography>
        </Box>
      )}

      <Typography sx={{ fontSize: 12, fontWeight: 600, mt: 1 }}>实时日志</Typography>
      <LogTail logs={logs} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
        <Button
          color="error"
          disabled={!isRunning}
          onClick={onCancel}
        >
          取消
        </Button>
        <Button
          variant="contained"
          disabled={!jobDone && !isFailed}
          onClick={onContinue}
        >
          {jobDone ? '查看产物 →' : isFailed ? '查看错误 / 重试' : '等待中…'}
        </Button>
      </Box>
    </Box>
  );
}
