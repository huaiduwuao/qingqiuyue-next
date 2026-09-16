'use client';

/**
 * 后台运行卡片 —— 数字人调 ui_show_run 时弹出。
 *
 * 事件流用「当前看卡片的人」的会话读(断线按 seq 续传);批准 / 驳回也是这个人点的,
 * 不经过 agent。运行结束时把结果作为一句话回灌给数字人,让它接着汇报。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import {
  runsAPI,
  streamRunEvents,
  isTerminal,
  type Approval,
  type Run,
  type RunEvent,
  type RunStatus,
} from '@/lib/agentmanager/runs/api';
import { toTimeline } from '@/lib/agentmanager/runs/timeline';

const ACCENT = '#25F4EE';
const TEXT = 'rgba(255,255,255,0.92)';
const SUBTEXT = 'rgba(255,255,255,0.55)';

const STATUS: Record<RunStatus, { label: string; color: string }> = {
  queued: { label: '排队中', color: SUBTEXT },
  running: { label: '执行中', color: ACCENT },
  awaiting_approval: { label: '等你确认', color: '#FFB547' },
  succeeded: { label: '已完成', color: '#4ADE80' },
  failed: { label: '失败', color: '#F87171' },
  cancelled: { label: '已取消', color: SUBTEXT },
};
const TONE: Record<string, string> = { info: SUBTEXT, warning: '#FFB547', error: '#F87171', success: '#4ADE80' };

function errText(e: unknown): string {
  return (e as { message?: string } | null)?.message || '加载失败';
}

function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default function RunPanel({ runId, onSend }: { runId: string; onSend: (t: string) => void }) {
  const [run, setRun] = React.useState<Run | null>(null);
  const [approvals, setApprovals] = React.useState<Approval[]>([]);
  const [events, setEvents] = React.useState<RunEvent[]>([]);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const notified = React.useRef(false);

  const refresh = React.useCallback(async () => {
    const [r, a] = await Promise.all([runsAPI.get(null, runId), runsAPI.approvals(null, runId)]);
    setRun(r);
    setApprovals(a);
    return r;
  }, [runId]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    notified.current = false;
    setEvents([]);
    refresh().catch((e) => setError(errText(e)));
    streamRunEvents(
      runId,
      null,
      (e) => {
        setEvents((prev) => [...prev, e]);
        if (e.t.startsWith('approval.') || e.t.startsWith('run.')) {
          refresh()
            .then((r) => {
              // 结束时把结果回灌给数字人,由它来汇报;只发一次
              if (r && isTerminal(r.status) && !notified.current) {
                notified.current = true;
                if (r.status === 'succeeded') {
                  onSend(`后台运行 ${runId} 已经完成,结果是:\n${clip(r.output || '(没有输出)', 1500)}\n请把结果告诉我`);
                } else if (r.status === 'failed') {
                  onSend(`后台运行 ${runId} 失败了:${clip(r.error || '未知错误', 300)}。请如实告诉我,并说说可以怎么办`);
                }
              }
            })
            .catch(() => {});
        }
      },
      ctrl.signal,
    ).catch((e) => setError(errText(e)));
    return () => ctrl.abort();
  }, [runId, refresh, onSend]);

  const timeline = React.useMemo(() => toTimeline(events), [events]);
  const pending = approvals.filter((a) => a.status === 'pending');

  const decide = async (a: Approval, approve: boolean) => {
    setBusy(true);
    try {
      await runsAPI.decide(null, runId, a.id, approve ? 'approve' : 'reject');
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await runsAPI.cancel(null, runId);
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !run) return <Typography sx={{ color: '#FFB547', fontSize: 14 }}>{error}</Typography>;
  if (!run) return <LinearProgress sx={{ '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />;

  const s = STATUS[run.status] ?? { label: run.status, color: SUBTEXT };
  const live = !isTerminal(run.status);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, color: TEXT }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label={s.label} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: s.color, fontWeight: 600 }} />
        <Typography sx={{ fontSize: 12.5, fontFamily: 'monospace', color: SUBTEXT }}>{run.agent}</Typography>
        <Box sx={{ flex: 1 }} />
        {live && (
          <Button size="small" disabled={busy} onClick={cancel} sx={{ color: '#F87171', fontSize: 12 }}>
            取消
          </Button>
        )}
      </Box>

      <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{run.input}</Typography>
      {live && run.status !== 'awaiting_approval' && (
        <LinearProgress sx={{ bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
      )}

      {pending.map((a) => (
        <Box key={a.id} sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid rgba(255,181,71,0.5)', bgcolor: 'rgba(255,181,71,0.08)', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#FFB547' }}>数字员工要执行「{a.tool}」,需要你确认</Typography>
          <Box component="pre" sx={{ m: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: SUBTEXT }}>
            {prettyJSON(a.args)}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button fullWidth variant="contained" disabled={busy} onClick={() => decide(a, true)}
              sx={{ bgcolor: '#4ADE80', color: '#04121a', fontWeight: 600, '&:hover': { bgcolor: '#6ee7a0' } }}>
              批准执行
            </Button>
            <Button fullWidth variant="outlined" disabled={busy} onClick={() => decide(a, false)}
              sx={{ color: '#F87171', borderColor: 'rgba(248,113,113,0.6)' }}>
              驳回
            </Button>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: SUBTEXT }}>批准由你本人执行,数字人没有批准权限。驳回后这一步不会执行。</Typography>
        </Box>
      ))}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', maxHeight: 300, overflowY: 'auto' }}>
        {timeline.length === 0 && <Typography sx={{ fontSize: 12, color: SUBTEXT }}>{live ? '等待开始…' : '没有过程记录'}</Typography>}
        {timeline.map((it, i) => {
          if (it.kind === 'text') {
            return <Typography key={i} sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{it.text}</Typography>;
          }
          if (it.kind === 'tool') {
            return (
              <Box key={i}>
                <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: it.isError ? '#F87171' : ACCENT }}>
                  {it.done ? (it.isError ? '✗' : '✓') : '…'} {it.name}
                </Typography>
                {it.result && (
                  <Typography sx={{ fontSize: 11.5, color: SUBTEXT, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {clip(it.result, 400)}
                  </Typography>
                )}
              </Box>
            );
          }
          return <Typography key={i} sx={{ fontSize: 12, color: TONE[it.tone] ?? SUBTEXT }}>— {it.text}</Typography>;
        })}
      </Box>

      {run.status === 'succeeded' && run.output && (
        <Typography sx={{ fontSize: 13.5, color: '#4ADE80', whiteSpace: 'pre-wrap' }}>{clip(run.output, 1200)}</Typography>
      )}
      {run.status === 'failed' && run.error && <Typography sx={{ fontSize: 13.5, color: '#F87171' }}>{run.error}</Typography>}
      {error && <Typography sx={{ color: '#FFB547', fontSize: 13 }}>{error}</Typography>}
      <Typography component="a" href="/system/runs" sx={{ fontSize: 12.5, color: ACCENT, textDecoration: 'none' }}>
        在「后台运行」里查看完整过程 →
      </Typography>
    </Box>
  );
}

function prettyJSON(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
