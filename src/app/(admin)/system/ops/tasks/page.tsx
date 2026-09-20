'use client';

/**
 * 数据迁移任务管理页(/system/ops/tasks)
 *
 * 通用后台任务(internal/opstask)的管理界面:
 *   - 列表:最近 50 条运行记录,按时间倒序;
 *   - 启动:点"启动任务" → 选 kind(下拉来自 /ops/task/kinds) → 填 payload JSON → 启动;
 *   - 详情:点行可看完整 task_run + 进度条(轮询 2s,直到终态);
 *   - 取消:对未终态的任务点"取消"。
 *
 * 模板参照 sandbox/tasks/page.tsx;为简洁省略镜像管理。
 *
 * 权限:菜单入口挂 SYSTEM_OPS_TASK.VIEW,启动/取消按钮分别挂 CREATE / CANCEL。
 * 三个码后端都真守着(internal/opstask/handler.go),这里藏按钮只是少让人白点。
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import {
  listOpsTasks,
  getOpsTask,
  startOpsTask,
  cancelOpsTask,
  listOpsTaskKinds,
} from '@/apis/opstask';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';
import {
  OPS_TASK_STATUS_COLORS,
  OPS_TASK_STATUS_LABELS,
  type OpsTaskRun,
  type OpsTaskStartReq,
  type OpsTaskStatus,
} from '@/beans/opstask';

const POLL_INTERVAL_MS = 2000;
const LIST_POLL_INTERVAL_MS = 5000; // 列表弱实时,5s 够用;详情 2s 才及时

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export default function OpsTasksPage() {
  const qc = useQueryClient();
  const { can } = useAuthority();
  const canCreate = can(PERMISSIONS.SYSTEM_OPS_TASK.CREATE);
  const canCancel = can(PERMISSIONS.SYSTEM_OPS_TASK.CANCEL);
  const [refreshToken, setRefreshToken] = useState(0);
  const [snack, setSnack] = useState<{ open: boolean; severity: 'success' | 'error'; msg: string }>(
    { open: false, severity: 'success', msg: '' },
  );

  // ===== 列表 =====
  const list = useQuery({
    queryKey: ['opstask', 'list', refreshToken],
    queryFn: () => listOpsTasks({ limit: 50 }),
    refetchInterval: LIST_POLL_INTERVAL_MS,
  });

  const refresh = () => setRefreshToken((n) => n + 1);

  // ===== 启动对话框 =====
  const [startOpen, setStartOpen] = useState(false);
  const kinds = useQuery({ queryKey: ['opstask', 'kinds'], queryFn: listOpsTaskKinds, enabled: startOpen });
  const [pickedKind, setPickedKind] = useState('');
  const [payloadText, setPayloadText] = useState('{}');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!pickedKind && kinds.data && kinds.data.length > 0) {
      setPickedKind(kinds.data[0]);
    }
  }, [kinds.data, pickedKind]);

  const handleStart = async () => {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadText || '{}');
    } catch {
      setSnack({ open: true, severity: 'error', msg: 'payload 不是合法 JSON' });
      return;
    }
    setSubmitting(true);
    try {
      const req: OpsTaskStartReq = { kind: pickedKind, payload };
      const resp = await startOpsTask(req);
      setSnack({ open: true, severity: 'success', msg: `已启动任务 #${resp.taskId}` });
      setStartOpen(false);
      setPayloadText('{}');
      // 启动后立刻刷一次列表,不等 5s 轮询。
      qc.invalidateQueries({ queryKey: ['opstask', 'list'] });
      refresh();
    } catch (err: any) {
      setSnack({ open: true, severity: 'error', msg: `启动失败: ${err?.message || err}` });
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 详情对话框(轮询) =====
  const [detailId, setDetailId] = useState<number | null>(null);
  const detail = useQuery({
    queryKey: ['opstask', 'detail', detailId],
    queryFn: () => getOpsTask(detailId!),
    enabled: detailId !== null,
    refetchInterval: (q) => {
      const s = (q.state.data as OpsTaskRun | undefined)?.status;
      // pending / running 时轮询,终态停。
      return s === 'pending' || s === 'running' ? POLL_INTERVAL_MS : false;
    },
  });

  // ===== 取消 =====
  const handleCancel = async (id: number) => {
    if (!window.confirm(`确认取消任务 #${id}?`)) return;
    try {
      await cancelOpsTask(id);
      setSnack({ open: true, severity: 'success', msg: `已发送取消信号 #${id}` });
      qc.invalidateQueries({ queryKey: ['opstask', 'list'] });
      if (detailId === id) qc.invalidateQueries({ queryKey: ['opstask', 'detail', id] });
    } catch (err: any) {
      setSnack({ open: true, severity: 'error', msg: `取消失败: ${err?.message || err}` });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h5">数据迁移任务</Typography>
        <Box sx={{ flex: 1 }} />
        {canCreate && (
          <Button variant="contained" onClick={() => setStartOpen(true)}>
            启动任务
          </Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        通用后台任务(internal/opstask):数据迁移 / backfill / 重算。任务在 content-api 进程内执行,
        进度每 1s 落库,前端 2s 轮询。失败的行被 Janitor 兜底标 failed。
      </Typography>

      {/* 列表 */}
      <Paper variant="outlined">
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2">最近运行(最多 50 条)</Typography>
        </Box>
        {(list.data ?? []).length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">暂无任务记录</Typography>
          </Box>
        ) : (
          <Box>
            {(list.data ?? []).map((r) => (
              <Row
                key={r.id}
                run={r}
                canCancel={canCancel}
                onOpen={() => setDetailId(r.id)}
                onCancel={() => handleCancel(r.id)}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* 启动对话框 */}
      <Dialog open={startOpen} onClose={() => setStartOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>启动后台任务</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              select
              label="任务类型 (kind)"
              value={pickedKind}
              onChange={(e) => setPickedKind(e.target.value)}
              fullWidth
              disabled={kinds.isLoading}
              helperText={kinds.data ? `已注册: ${kinds.data.join(', ')}` : '加载中…'}
            >
              {(kinds.data ?? []).map((k) => (
                <MenuItem key={k} value={k}>{k}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="payload (JSON 对象)"
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              fullWidth
              multiline
              minRows={6}
              placeholder='{"dry_run": true}'
              helperText="例如 topic-rule-backfill 接受 {dry_run, batch}"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartOpen(false)} disabled={submitting}>取消</Button>
          <Button variant="contained" onClick={handleStart} disabled={submitting || !pickedKind}>
            启动
          </Button>
        </DialogActions>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailId !== null} onClose={() => setDetailId(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          任务详情 #{detailId}
          {detail.data && (
            <Chip
              size="small"
              sx={{ ml: 1 }}
              label={OPS_TASK_STATUS_LABELS[detail.data.status as OpsTaskStatus]}
              color={OPS_TASK_STATUS_COLORS[detail.data.status as OpsTaskStatus]}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {detail.data && <DetailView run={detail.data} />}
          {detail.isLoading && <Typography>加载中…</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => detail.refetch()}>刷新</Button>
          {canCancel && detail.data && (detail.data.status === 'pending' || detail.data.status === 'running') && (
            <Button color="error" onClick={() => detailId && handleCancel(detailId)}>
              取消任务
            </Button>
          )}
          <Button onClick={() => setDetailId(null)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
      >
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ===== 行 =====
function Row({
  run,
  canCancel,
  onOpen,
  onCancel,
}: {
  run: OpsTaskRun;
  canCancel: boolean;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const total = run.total || 0;
  const processed = run.processed || 0;
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const finished = ['completed', 'failed', 'cancelled'].includes(run.status);

  return (
    <Box
      sx={{
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        '&:last-child': { borderBottom: 0 },
      }}
    >
      <Box sx={{ width: 60 }}>
        <Typography variant="body2" color="text.secondary">#{run.id}</Typography>
      </Box>
      <Box sx={{ width: 200 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{run.kind}</Typography>
      </Box>
      <Box sx={{ width: 90 }}>
        <Chip
          size="small"
          label={OPS_TASK_STATUS_LABELS[run.status]}
          color={OPS_TASK_STATUS_COLORS[run.status]}
        />
      </Box>
      <Box sx={{ width: 160 }}>
        <Typography variant="caption" color="text.secondary">
          {new Date(run.startedAt).toLocaleString('zh-CN')}
        </Typography>
      </Box>
      <Box sx={{ width: 100 }}>
        <Typography variant="caption">{formatDuration(run.durationMs)}</Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 160 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant={total > 0 ? 'determinate' : 'indeterminate'}
              value={total > 0 ? percent : undefined}
            />
          </Box>
          <Typography variant="caption" sx={{ width: 80, textAlign: 'right' }}>
            {processed}{total > 0 ? `/${total}` : ''}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" onClick={onOpen}>详情</Button>
        {!finished && canCancel && (
          <Button size="small" color="error" onClick={onCancel}>取消</Button>
        )}
      </Box>
    </Box>
  );
}

// ===== 详情视图 =====
function DetailView({ run }: { run: OpsTaskRun }) {
  const total = run.total || 0;
  const processed = run.processed || 0;
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
      <KV label="kind" value={run.kind} />
      <KV label="status" value={run.status} />
      <KV label="triggered_by" value={String(run.triggeredBy)} />
      <KV label="started_at" value={new Date(run.startedAt).toLocaleString('zh-CN')} />
      {run.finishedAt && <KV label="finished_at" value={new Date(run.finishedAt).toLocaleString('zh-CN')} />}
      <KV label="duration" value={formatDuration(run.durationMs)} />
      <Box>
        <Typography variant="caption" color="text.secondary">progress</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant={total > 0 ? 'determinate' : 'indeterminate'}
              value={total > 0 ? percent : undefined}
            />
          </Box>
          <Typography variant="caption" sx={{ width: 100, textAlign: 'right' }}>
            {processed} / {total} (failed: {run.failed})
          </Typography>
        </Box>
      </Box>
      {run.error && <KV label="error" value={run.error} />}
      {run.resultSummary && <KV label="result_summary" value={run.resultSummary} />}
      <KV label="payload" value={run.payload} multiline />
    </Box>
  );
}

function KV({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography
        variant="body2"
        sx={{ fontFamily: multiline ? 'monospace' : undefined, whiteSpace: multiline ? 'pre-wrap' : undefined }}
      >
        {value || '-'}
      </Typography>
    </Box>
  );
}
