'use client';

// 集群监控面板 /system/dashboard/monitor
//
// C2:展示多节点集群视图。后端 steward 走 /ops/overview 返回 nodes[],
// 每节点带 Report(节点 CPU/内存、GPU、Doris 占用、容器状态)。
// 每个节点是一张卡片,卡片下展开容器列表。

import React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import CircleRoundedIcon from '@mui/icons-material/CircleRounded';
import * as ops from '@/apis/ops';

// ── 容器条目(后端 steward ContainerStatus) ──
type Container = {
  id: string; names: string[]; image: string; state: string; status: string;
  cpuPerc: number; memMB: number; memPerc: number;
};

// ── GPU 状态 ──
type GpuStat = {
  index: number;
  name: string;
  utilPct: number;
  memUsedMB: number;
  memTotalMB: number;
  tempC: number;
};

// ── 节点报告 ──
type NodeReport = {
  cpuPct: number;
  memPct: number;
  gpus?: GpuStat[];
  dorisUsedPct?: number;
  containers?: Container[];
};

// ── 集群节点 ──
type Node = {
  id: number;
  name: string;
  host: string;
  online?: boolean;
  lastSeen?: string;
  report?: NodeReport;
};

export default function DashboardMonitorPage() {
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});
  const [busy, setBusy] = React.useState<string>('');
  const [logId, setLogId] = React.useState<string>('');
  const [logText, setLogText] = React.useState<string>('');
  const [snack, setSnack] = React.useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' });
  const [forbidden, setForbidden] = React.useState(false);

  const toast = (msg: string, sev: 'success' | 'error' = 'success') => setSnack({ open: true, msg, sev });

  const refresh = React.useCallback(async () => {
    try {
      const res = await ops.overview();
      setNodes(res.nodes || []);
      setForbidden(false);
    } catch (e: any) {
      if (e?.code === 403) setForbidden(true);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const act = async (id: string, action: 'start' | 'stop' | 'restart') => {
    setBusy(id);
    try {
      if (action === 'start') await ops.startContainer(id);
      else if (action === 'stop') await ops.stopContainer(id);
      else await ops.restartContainer(id);
      toast(`${action} 已执行`);
      await refresh();
    } catch (e: any) {
      toast(e?.message || `${action} 失败`, 'error');
    } finally {
      setBusy('');
    }
  };

  const showLogs = async (id: string) => {
    setLogId(id);
    setLogText('加载中…');
    try {
      const res = await ops.containerLogs(id, 300);
      setLogText(res?.logs || '(空)');
    } catch (e: any) {
      setLogText('日志获取失败: ' + (e?.message || e));
    }
  };

  if (forbidden) {
    return (
      <Container maxWidth="lg"><Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>集群监控</Typography>
        <Alert severity="warning">运维控制台仅超级管理员可访问。</Alert>
      </Box></Container>
    );
  }

  // 集群聚合
  const totalContainers = nodes.reduce(
    (s, n) => s + (n.report?.containers?.length || 0), 0,
  );
  const runningContainers = nodes.reduce(
    (s, n) => s + (n.report?.containers?.filter((c) => c.state === 'running').length || 0), 0,
  );
  const avgCpu = nodes.length
    ? Math.round(nodes.reduce((s, n) => s + (n.report?.cpuPct || 0), 0) / nodes.length)
    : 0;
  const avgMem = nodes.length
    ? Math.round(nodes.reduce((s, n) => s + (n.report?.memPct || 0), 0) / nodes.length)
    : 0;
  const totalGpus = nodes.reduce((s, n) => s + (n.report?.gpus?.length || 0), 0);

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Typography variant="h4">集群监控</Typography>
          <Chip
            size="small"
            color={nodes.length > 0 && nodes.every((n) => n.online) ? 'success' : 'warning'}
            label={`${nodes.filter((n) => n.online).length}/${nodes.length} 在线`}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          18 个微服务容器 · NVMe 磁盘 · Doris 存储 · CPU/内存 · GPU 显存
        </Typography>

        {/* 集群总览 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 1.5, mb: 3 }}>
          <SummaryCard label="节点" value={`${nodes.length}`} hint={`在线 ${nodes.filter((n) => n.online).length}`} color="#5DDB96" />
          <SummaryCard label="容器运行" value={`${runningContainers}/${totalContainers}`} hint="running/total" color="#25F4EE" />
          <SummaryCard label="平均 CPU" value={`${avgCpu}%`} hint="所有节点" color="#FE2C55" />
          <SummaryCard label="平均内存" value={`${avgMem}%`} hint="所有节点" color="#FFB400" />
          <SummaryCard label="GPU 卡数" value={`${totalGpus}`} hint="nvidia-smi" color="#A855F7" />
        </Box>

        {/* 节点卡片网格 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2 }}>
          {nodes.map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              expanded={!!expanded[n.id]}
              onToggle={() => setExpanded((s) => ({ ...s, [n.id]: !s[n.id] }))}
              busy={busy}
              onAct={act}
              onShowLogs={showLogs}
            />
          ))}
          {nodes.length === 0 && (
            <Card variant="outlined" sx={{ p: 4, gridColumn: '1 / -1', textAlign: 'center' }}>
              <Typography color="text.secondary">暂无节点数据(steward agent 未上报)</Typography>
            </Card>
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Button size="small" onClick={refresh}>刷新</Button>
        </Box>
      </Box>

      {/* 日志弹窗 */}
      <Dialog open={!!logId} onClose={() => setLogId('')} maxWidth="md" fullWidth>
        <DialogTitle>容器日志 · {logId}</DialogTitle>
        <DialogContent dividers>
          <Box component="pre" sx={{ m: 0, fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 480, overflow: 'auto' }}>{logText}</Box>
        </DialogContent>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Container>
  );
}

// ─── 总览小卡 ───
function SummaryCard({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <Card variant="outlined" sx={{ p: 1.5 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color, mt: 0.5, lineHeight: 1.2 }}>{value}</Typography>
      <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.5 }}>{hint}</Typography>
    </Card>
  );
}

// ─── 节点卡片 ───
function NodeCard({
  node, expanded, onToggle, busy, onAct, onShowLogs,
}: {
  node: Node;
  expanded: boolean;
  onToggle: () => void;
  busy: string;
  onAct: (id: string, action: 'start' | 'stop' | 'restart') => void;
  onShowLogs: (id: string) => void;
}) {
  const r = node.report;
  const containers = r?.containers ?? [];
  const gpus = r?.gpus ?? [];
  const doris = r?.dorisUsedPct ?? 0;
  const cpu = r?.cpuPct ?? 0;
  const mem = r?.memPct ?? 0;

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden' }}>
      {/* 头部:节点名 + 在线状态 */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircleRoundedIcon sx={{ fontSize: 12, color: node.online ? '#5DDB96' : '#F87171' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{node.name}</Typography>
          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{node.host}</Typography>
        </Box>
        <Chip
          size="small"
          label={`${containers.filter((c) => c.state === 'running').length}/${containers.length} 容器`}
          color={containers.length > 0 && containers.every((c) => c.state === 'running') ? 'success' : 'warning'}
          variant="outlined"
          sx={{ height: 20, fontSize: 10 }}
        />
      </Box>

      {/* 资源条 */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <BarRow icon="🔥" label="CPU" pct={cpu} color="#FE2C55" />
        <BarRow icon="🧠" label="内存" pct={mem} color="#FFB400" />
        {doris > 0 && (
          <BarRow
            icon={<StorageRoundedIcon sx={{ fontSize: 12 }} />}
            label="Doris 存储"
            pct={doris}
            color="#5DDB96"
          />
        )}
      </Box>

      {/* GPU */}
      {gpus.length > 0 && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MemoryRoundedIcon sx={{ fontSize: 12 }} /> GPU · {gpus.length} 卡
          </Typography>
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            {gpus.map((g) => (
              <Box key={g.index} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 10 }}>
                <Typography sx={{ width: 36, color: 'text.disabled' }}>GPU{g.index}</Typography>
                <LinearProgress
                  variant="determinate"
                  value={g.utilPct}
                  sx={{
                    flex: 1, height: 4, borderRadius: 0.5,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': { bgcolor: '#A855F7' },
                  }}
                />
                <Typography sx={{ width: 36, textAlign: 'right' }}>{g.utilPct}%</Typography>
                <Typography sx={{ width: 60, textAlign: 'right', color: 'text.disabled' }}>
                  {(g.memUsedMB / 1024).toFixed(1)}/{(g.memTotalMB / 1024).toFixed(0)}G
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* 容器展开按钮 */}
      <Box
        onClick={onToggle}
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontSize: 12,
          color: 'text.secondary',
          '&:hover': { opacity: 0.85 },
        }}
      >
        容器列表 ({containers.length})
        {expanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
      </Box>

      {expanded && (
        <Table size="small">
          <TableHead>
            <TableRow>
              {['容器', '状态', 'CPU', '内存', '操作'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {containers.map((c) => {
              const running = c.state === 'running';
              return (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontSize: 11 }}>{c.names?.[0] || c.id}</TableCell>
                  <TableCell>
                    <Chip size="small" color={running ? 'success' : 'default'} label={c.state} sx={{ height: 16, fontSize: 9 }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{running ? `${(c.cpuPerc ?? 0).toFixed(1)}%` : '-'}</TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{running ? `${(c.memMB ?? 0).toFixed(0)}MB` : '-'}</TableCell>
                  <TableCell>
                    <Tooltip title="日志">
                      <IconButton size="small" onClick={() => onShowLogs(c.id)}>
                        <ArticleRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    {running ? (
                      <>
                        <Tooltip title="重启">
                          <IconButton size="small" disabled={busy === c.id} onClick={() => onAct(c.id, 'restart')}>
                            <RestartAltRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="停止">
                          <IconButton size="small" color="error" disabled={busy === c.id} onClick={() => onAct(c.id, 'stop')}>
                            <StopRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <Tooltip title="启动">
                        <IconButton size="small" color="success" disabled={busy === c.id} onClick={() => onAct(c.id, 'start')}>
                          <PlayArrowRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {containers.length === 0 && (
              <TableRow><TableCell colSpan={5} sx={{ color: 'text.disabled', fontSize: 11, textAlign: 'center' }}>无容器</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function BarRow({
  icon, label, pct, color,
}: {
  icon: React.ReactNode;
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      <Typography sx={{ width: 76, fontSize: 11, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {icon} {label}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, pct)}
        sx={{
          flex: 1,
          height: 6,
          borderRadius: 0.5,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 0.5 },
        }}
      />
      <Typography sx={{ width: 36, textAlign: 'right', fontSize: 11 }}>{pct}%</Typography>
    </Box>
  );
}
