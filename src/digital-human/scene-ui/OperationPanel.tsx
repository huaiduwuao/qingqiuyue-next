'use client';

/**
 * 部署操作卡片 —— 数字人调 ui_show_operation 时弹出。
 *
 * 数据用「当前看卡片的人」的会话直接向 Steward 取;批准 / 驳回也是这个人点的,
 * 不经过 agent。agent 手里没有批准工具,这张卡是 T2 操作在对话里唯一的批准入口。
 * 决定之后把结果作为一句话回灌给数字人,让它接着跟进执行情况。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import * as st from '@/apis/steward';

const ACCENT = '#25F4EE';
const TEXT = 'rgba(255,255,255,0.92)';
const SUBTEXT = 'rgba(255,255,255,0.55)';

const KIND: Record<st.OpKind, string> = {
  build: '构建', adopt: '接管基线', restart_service: '重启服务',
  deploy_release: '部署', rollback: '回滚', detach: '脱离管控',
};
const STATUS: Record<st.OpStatus, { label: string; color: string }> = {
  awaiting_approval: { label: '待审批', color: '#FFB547' },
  queued: { label: '排队中', color: ACCENT },
  running: { label: '执行中', color: ACCENT },
  verifying: { label: '验证中', color: '#A78BFA' },
  succeeded: { label: '成功', color: '#4ADE80' },
  failed: { label: '失败', color: '#F87171' },
  rejected: { label: '已驳回', color: SUBTEXT },
  rolled_back: { label: '已回滚', color: '#F87171' },
};
const TIER_COLOR = [SUBTEXT, '#4ADE80', '#FFB547', '#F87171'];
const ACTIVE: st.OpStatus[] = ['awaiting_approval', 'queued', 'running', 'verifying'];

function errText(e: unknown): string {
  const status = (e as { status?: number } | null)?.status;
  if (status === 401 || status === 403) return '只有超级管理员能查看和批准部署操作。';
  return (e as { message?: string } | null)?.message || '加载失败';
}

export default function OperationPanel({ operationId, onSend }: { operationId: string; onSend: (t: string) => void }) {
  const [op, setOp] = React.useState<st.OperationDetail | null>(null);
  const [error, setError] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // 每次 +1 触发一次重新拉取;取消标记保证卡片换了操作或关掉后,迟到的响应不会写回来
  const [refresh, setRefresh] = React.useState(0);
  const reload = () => setRefresh((n) => n + 1);

  React.useEffect(() => {
    let cancelled = false;
    st.operation(operationId)
      .then((d) => { if (!cancelled) { setOp(d); setError(''); } })
      .catch((e) => { if (!cancelled) setError(errText(e)); });
    return () => { cancelled = true; };
  }, [operationId, refresh]);

  const status = op?.status;
  React.useEffect(() => {
    if (!status || !ACTIVE.includes(status)) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [status]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      await (approve ? st.approve(operationId, comment) : st.reject(operationId, comment));
      reload();
      onSend(approve
        ? `我已批准操作 ${operationId},请跟进执行情况`
        : `我驳回了操作 ${operationId}${comment.trim() ? `,原因:${comment.trim()}` : ''}`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !op) return <Typography sx={{ color: '#FFB547', fontSize: 14 }}>{error}</Typography>;
  if (!op) return <LinearProgress sx={{ '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />;

  const s = STATUS[op.status] ?? { label: op.status, color: SUBTEXT };
  const events = op.events.slice(-5);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, color: TEXT }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label={`T${op.tier}`} variant="outlined"
          sx={{ color: TIER_COLOR[op.tier] ?? SUBTEXT, borderColor: TIER_COLOR[op.tier] ?? SUBTEXT, fontFamily: 'monospace' }} />
        <Chip size="small" label={s.label} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: s.color, fontWeight: 600 }} />
        <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{KIND[op.kind] ?? op.kind}</Typography>
        {op.target_release_id && (
          <Typography sx={{ fontSize: 12.5, fontFamily: 'monospace', color: SUBTEXT }}>{op.target_release_id}</Typography>
        )}
      </Box>

      {op.reason && <Typography sx={{ fontSize: 14 }}>{op.reason}</Typography>}
      <Typography sx={{ fontSize: 12, color: SUBTEXT }}>
        {op.requester_type === 'system' ? 'Steward(自动)' : op.requester_name} 发起 · {op.id}
      </Typography>
      {op.message && <Typography sx={{ fontSize: 13.5, color: s.color }}>{op.message}</Typography>}
      {ACTIVE.includes(op.status) && op.status !== 'awaiting_approval' && (
        <LinearProgress sx={{ bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
      )}

      {events.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)' }}>
          {events.map((e) => (
            <Typography key={e.id} sx={{ fontSize: 12, color: e.level === 'error' ? '#F87171' : e.level === 'warn' ? '#FFB547' : SUBTEXT }}>
              {new Date(e.created_at).toLocaleTimeString('zh-CN', { hour12: false })} {e.service ? `${e.service}:` : ''}{e.message.split('\n')[0]}
            </Typography>
          ))}
        </Box>
      )}

      {op.status === 'awaiting_approval' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            id={`op-card-comment-${op.id}`}
            size="small"
            placeholder="审批意见(可选)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: TEXT, bgcolor: 'rgba(255,255,255,0.06)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button fullWidth variant="contained" disabled={busy} onClick={() => decide(true)}
              sx={{ bgcolor: '#4ADE80', color: '#04121a', fontWeight: 600, '&:hover': { bgcolor: '#6ee7a0' } }}>
              批准
            </Button>
            <Button fullWidth variant="outlined" disabled={busy} onClick={() => decide(false)}
              sx={{ color: '#F87171', borderColor: 'rgba(248,113,113,0.6)' }}>
              驳回
            </Button>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: SUBTEXT }}>
            批准由你本人执行,AI 助手没有批准权限。失败或验证窗口内出问题会自动回滚。
          </Typography>
        </Box>
      )}

      {error && <Typography sx={{ color: '#FFB547', fontSize: 13 }}>{error}</Typography>}
      <Typography component="a" href="/system/deployment" sx={{ fontSize: 12.5, color: ACCENT, textDecoration: 'none' }}>
        在部署管理里查看完整日志 →
      </Typography>
    </Box>
  );
}
