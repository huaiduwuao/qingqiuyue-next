'use client';

// 算力节点 —— comfy-gateway 的运维台(仅管理员)。
// 网关跑在 GPU 机器上:每张卡一个 ComfyUI 子进程,崩溃自动重启;出图任务按负载分到各张卡。
// 这里看各卡的显存/利用率、各实例的状态与日志、最近的派单记录,并可启停/重启单个实例。

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded';
import * as gw from '@/apis/comfyGateway';

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const STATE: Record<gw.InstanceState, { label: string; color: ChipColor }> = {
  running: { label: '运行中', color: 'success' },
  starting: { label: '启动中', color: 'info' },
  crashed: { label: '已崩溃', color: 'error' },
  stopped: { label: '已停止', color: 'default' },
  down: { label: '不可达', color: 'error' },
};

const PROMPT: Record<gw.PromptStatus, { label: string; color: ChipColor }> = {
  pending: { label: '网关排队', color: 'default' },
  queued: { label: '排队', color: 'info' },
  running: { label: '运行', color: 'secondary' },
  success: { label: '成功', color: 'success' },
  error: { label: '出错', color: 'error' },
  lost: { label: '丢失', color: 'warning' },
  canceled: { label: '已取消', color: 'default' },
};

const ELLIPSIS = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
const errMsg = (e: unknown) => (e as { message?: string } | null)?.message || '请求失败';
const errStatus = (e: unknown) => (e as { status?: number } | null)?.status;
const valid = (s?: string) => !!s && !s.startsWith('0001-');
const fmtTime = (s?: string) => (valid(s) ? new Date(s as string).toLocaleTimeString('zh-CN', { hour12: false }) : '—');

function fmtDur(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分 ${s % 60} 秒`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} 小时 ${m % 60} 分`;
  return `${Math.floor(h / 24)} 天 ${h % 24} 小时`;
}

const since = (s?: string) => (valid(s) ? fmtDur(Date.now() - new Date(s as string).getTime()) : '—');
const between = (a?: string, b?: string) =>
  valid(a) && valid(b) ? fmtDur(new Date(b as string).getTime() - new Date(a as string).getTime()) : '—';

function Meter({ label, value, max, unit, warnAt = 0.9 }: { label: string; value: number; max: number; unit: string; warnAt?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'text.secondary', mb: 0.5 }}>
        <span>{label}</span>
        <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()} / {max.toLocaleString()} {unit}</Box>
      </Box>
      <LinearProgress variant="determinate" value={pct} color={pct / 100 >= warnAt ? 'warning' : 'primary'}
        sx={{ height: 8, borderRadius: 4 }} />
    </Box>
  );
}

function GpuCard({ g, instances }: { g: gw.GPUStat; instances: gw.GatewayInstance[] }) {
  const owners = instances.filter((i) => i.managed && i.gpu === g.index);
  return (
    <Card variant="outlined" sx={{ p: 2, flex: '1 1 280px', minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MemoryRoundedIcon fontSize="small" color="primary" />
        <Typography sx={{ fontWeight: 600, fontSize: 14.5 }} noWrap>GPU {g.index} · {g.name}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 0.75, fontSize: 12.5, color: 'text.secondary', flexWrap: 'wrap' }}>
        <span>{g.tempC} °C</span>
        <span>{g.powerW} W</span>
        {owners.map((o) => <span key={o.id}>{o.name}:{STATE[o.state]?.label ?? o.state}</span>)}
      </Box>
      <Meter label="利用率" value={g.utilPercent} max={100} unit="%" warnAt={1.01} />
      <Meter label="显存" value={g.memUsedMiB} max={g.memTotalMiB} unit="MiB" />
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <Box sx={{ minWidth: 88 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    </Box>
  );
}

function LogsDialog({ inst, onClose }: { inst: gw.GatewayInstance | null; onClose: () => void }) {
  const ref = React.useRef<HTMLPreElement>(null);
  const q = useQuery({
    queryKey: ['comfy-gateway', 'logs', inst?.id],
    queryFn: () => gw.instanceLogs(inst!.id, 500),
    enabled: !!inst,
    refetchInterval: 3000,
    retry: false,
  });
  const lines = q.data ?? [];
  React.useEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <Dialog open={!!inst} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{inst?.name} 日志(最近 500 行,每 3 秒刷新)</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {q.error ? <Alert severity="error" sx={{ m: 2 }}>{errMsg(q.error)}</Alert> : (
          <Box component="pre" ref={ref} sx={{
            m: 0, p: 2, height: '65vh', overflow: 'auto', fontSize: 12, lineHeight: 1.5,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            bgcolor: 'background.default',
          }}>
            {lines.length ? lines.join('\n') : (q.isLoading ? '加载中…' : '(暂无日志)')}
          </Box>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>关闭</Button></DialogActions>
    </Dialog>
  );
}

export default function ComfyGatewayPage() {
  const qc = useQueryClient();
  const [logsOf, setLogsOf] = React.useState<gw.GatewayInstance | null>(null);
  const [confirm, setConfirm] = React.useState<{ inst: gw.GatewayInstance; action: gw.InstanceAction } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [snack, setSnack] = React.useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const statusQ = useQuery({ queryKey: ['comfy-gateway', 'status'], queryFn: gw.gatewayStatus, refetchInterval: 3000, retry: false });
  const promptsQ = useQuery({ queryKey: ['comfy-gateway', 'prompts'], queryFn: () => gw.gatewayPrompts(100), refetchInterval: 5000, retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ['comfy-gateway'] });

  const s = statusQ.data;
  const instances = s?.instances ?? [];
  const prompts = promptsQ.data ?? [];

  const runAction = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await gw.instanceAction(confirm.inst.id, confirm.action);
      setSnack({ msg: `${confirm.inst.name} 已${ACTION_LABEL[confirm.action]}`, sev: 'success' });
      setConfirm(null);
      refresh();
    } catch (e) {
      setSnack({ msg: errMsg(e), sev: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>算力节点</Typography>
          {s && <Chip size="small" variant="outlined" label={`网关 ${s.version} · 已运行 ${since(s.startedAt)}`} />}
          {s?.s3 && <Chip size="small" variant="outlined" color="success" label="任务结果上传 S3" />}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="刷新"><IconButton onClick={refresh}><RefreshRoundedIcon /></IconButton></Tooltip>
        </Box>

        {statusQ.error && (
          <Alert severity={errStatus(statusQ.error) === 403 ? 'warning' : 'error'} sx={{ mb: 2 }}>
            {errMsg(statusQ.error)}
          </Alert>
        )}
        {statusQ.isLoading && <LinearProgress sx={{ mb: 2 }} />}

        {s && (
          <>
            <Card variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', gap: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
              <Stat label="在线实例" value={`${instances.filter((i) => i.state === 'running').length} / ${instances.length}`} />
              <Stat label="正在运行" value={s.queue.running} />
              <Stat label="排队中" value={s.queue.pending} />
              <Stat label="网关排队" value={s.queue.gateway ?? 0} color={s.queue.gateway ? 'warning.main' : undefined} />
              <Stat label="完成" value={s.prompts.success} color="success.main" />
              <Stat label="出错" value={s.prompts.error} color={s.prompts.error ? 'error.main' : undefined} />
              <Stat label="丢失" value={s.prompts.lost} color={s.prompts.lost ? 'warning.main' : undefined} />
              <Stat label="换卡重派" value={s.prompts.retried ?? 0} />
            </Card>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              {(s.gpus ?? []).map((g) => <GpuCard key={g.index} g={g} instances={instances} />)}
              {!s.gpus?.length && <Alert severity="info" sx={{ flex: 1 }}>网关所在机器没有读到 nvidia-smi(只接入了外部实例?)</Alert>}
            </Box>

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>ComfyUI 实例</Typography>
            <Card variant="outlined" sx={{ mb: 3, overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>实例</TableCell>
                    <TableCell>状态</TableCell>
                    <TableCell align="right">运行 / 排队</TableCell>
                    <TableCell>已运行</TableCell>
                    <TableCell align="right">重启</TableCell>
                    <TableCell align="right">节点类型</TableCell>
                    <TableCell>最近模型</TableCell>
                    <TableCell align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {instances.map((i) => (
                    <TableRow key={i.id} hover>
                      <TableCell>
                        <Box sx={{ fontWeight: 600 }}>{i.name}</Box>
                        <Box sx={{ fontSize: 11.5, color: 'text.secondary', fontFamily: 'monospace' }}>
                          {i.managed ? `GPU ${i.gpu} · ` : '外部 · '}{i.url}{i.pid ? ` · pid ${i.pid}` : ''}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={STATE[i.state]?.color ?? 'default'} label={STATE[i.state]?.label ?? i.state} />
                        {i.lastError && (
                          <Tooltip title={i.lastError}>
                            <Box sx={{ fontSize: 11.5, color: 'error.main', maxWidth: 220, mt: 0.5, ...ELLIPSIS }} component="div">{i.lastError}</Box>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{i.queueRunning} / {i.queuePending}</TableCell>
                      <TableCell>{i.state === 'running' ? since(i.readyAt) : '—'}</TableCell>
                      <TableCell align="right">{i.restarts}</TableCell>
                      <TableCell align="right">{i.nodeTypes ? i.nodeTypes.toLocaleString() : '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Box sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary', ...ELLIPSIS }}>
                          {(i.recentModels ?? []).join('、') || '—'}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="日志"><IconButton size="small" onClick={() => setLogsOf(i)}><ArticleRoundedIcon fontSize="small" /></IconButton></Tooltip>
                        {i.managed && (
                          <>
                            <Tooltip title="重启"><IconButton size="small" onClick={() => setConfirm({ inst: i, action: 'restart' })}><RestartAltRoundedIcon fontSize="small" /></IconButton></Tooltip>
                            {i.state === 'stopped'
                              ? <Tooltip title="启动"><IconButton size="small" color="success" onClick={() => setConfirm({ inst: i, action: 'start' })}><PlayArrowRoundedIcon fontSize="small" /></IconButton></Tooltip>
                              : <Tooltip title="停止"><IconButton size="small" color="error" onClick={() => setConfirm({ inst: i, action: 'stop' })}><StopRoundedIcon fontSize="small" /></IconButton></Tooltip>}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}

        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>最近派单</Typography>
        {promptsQ.error && !statusQ.error && <Alert severity="error" sx={{ mb: 2 }}>{errMsg(promptsQ.error)}</Alert>}
        <Card variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 880 }}>
            <TableHead>
              <TableRow>
                <TableCell>提交</TableCell>
                <TableCell>任务</TableCell>
                <TableCell>实例</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>排队</TableCell>
                <TableCell>运行</TableCell>
                <TableCell align="right">派发</TableCell>
                <TableCell>模型</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prompts.length === 0 && (
                <TableRow><TableCell colSpan={8} sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                  {promptsQ.isLoading ? '加载中…' : '网关启动以来还没有派过单'}
                </TableCell></TableRow>
              )}
              {prompts.map((p) => (
                <TableRow key={p.promptId} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtTime(p.submittedAt)}</TableCell>
                  <TableCell>
                    <Tooltip title={`${p.promptId}${p.clientId ? `\nclient ${p.clientId}` : ''}`}>
                      <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.promptId.slice(0, 8)} · {p.nodes} 节点{p.source === 'api' && <Chip size="small" variant="outlined" label="API" sx={{ ml: 0.75, height: 18, fontSize: 11 }} />}</Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{p.instanceName || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" color={PROMPT[p.status]?.color ?? 'default'} label={PROMPT[p.status]?.label ?? p.status} />
                    {p.error && (
                      <Tooltip title={p.error}>
                        <Box sx={{ fontSize: 11.5, color: 'error.main', maxWidth: 240, mt: 0.5, ...ELLIPSIS }} component="div">{p.error}</Box>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{between(p.submittedAt, p.startedAt)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {p.status === 'running' ? since(p.startedAt) : between(p.startedAt, p.finishedAt)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={p.attempts > 1 ? `换过卡:先后在实例 ${[...(p.tried ?? []), p.instance].join(' → ')}` : ''}>
                      <Box component="span" sx={{ color: p.attempts > 1 ? 'warning.main' : 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                        {p.attempts || 0}{s ? ` / ${s.maxAttempts}` : ''}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Box sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary', ...ELLIPSIS }}>{(p.models ?? []).join('、') || '—'}</Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Box>

      <LogsDialog inst={logsOf} onClose={() => setLogsOf(null)} />

      <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)}>
        <DialogTitle>{confirm && `${ACTION_LABEL[confirm.action]} ${confirm.inst.name}?`}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>
            {confirm?.action === 'stop' && '停止后这张卡不再接任务,正在跑的任务会中断;网关不会自动把它拉起来,直到手动启动。'}
            {confirm?.action === 'restart' && '正在这张卡上跑的任务会中断(调用方会收到失败),重启后显存里的模型需要重新加载。'}
            {confirm?.action === 'start' && '拉起这张卡上的 ComfyUI,通常 30 秒到 3 分钟后就绪。'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={busy}>取消</Button>
          <Button variant="contained" color={confirm?.action === 'start' ? 'primary' : 'error'} onClick={runAction} disabled={busy}>
            {confirm && ACTION_LABEL[confirm.action]}
          </Button>
        </DialogActions>
      </Dialog>

      {snack && (
        <Snackbar open autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snack.sev} onClose={() => setSnack(null)}>{snack.msg}</Alert>
        </Snackbar>
      )}
    </Container>
  );
}

const ACTION_LABEL: Record<gw.InstanceAction, string> = { start: '启动', stop: '停止', restart: '重启' };
