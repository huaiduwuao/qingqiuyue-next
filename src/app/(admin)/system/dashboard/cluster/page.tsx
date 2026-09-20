'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import DeveloperBoardRoundedIcon from '@mui/icons-material/DeveloperBoardRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import { fleet, type StewardNode, type NodeReport } from '@/apis/steward';

/** 进度条颜色:越接近 100% 越红。 */
function meterColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 90) return 'error';
  if (pct >= 70) return 'warning';
  return 'success';
}

function Meter({ label, pct, extra }: { label: string; pct: number; extra?: string }) {
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>{extra ?? `${pct}%`}</Typography>
      </Box>
      <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, pct))} color={meterColor(pct)} sx={{ height: 6, borderRadius: 1 }} />
    </Box>
  );
}

function NodeCard({ node }: { node: StewardNode }) {
  const r: NodeReport | null = node.report;
  const running = r?.containers?.filter((c) => c.running).length ?? 0;
  const total = r?.containers?.length ?? 0;
  const unhealthy = r?.containers?.filter((c) => c.health === 'unhealthy').length ?? 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DnsRoundedIcon sx={{ color: node.online ? 'success.main' : 'text.disabled' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }} noWrap>{r?.hostname || node.id}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{node.id} · agent {node.agent_version || r?.agent_version || '-'}</Typography>
        </Box>
        <Chip size="small" label={node.online ? '在线' : '离线'} color={node.online ? 'success' : 'default'} variant={node.online ? 'filled' : 'outlined'} />
      </Box>

      {r ? (
        <>
          <Meter label="CPU" pct={r.cpu_pct ?? 0} />
          <Meter label="内存" pct={r.mem_pct ?? 0} />
          <Meter label="系统盘" pct={r.root_disk_pct ?? 0} />
          {r.doris_used_pct != null && r.doris_used_pct > 0 && <Meter label="Doris 存储" pct={r.doris_used_pct} />}

          {/* GPU */}
          {r.gpus && r.gpus.length > 0 && (
            <Box>
              {r.gpus.map((g) => (
                <Box key={g.index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <DeveloperBoardRoundedIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                  <Typography variant="caption" sx={{ flex: 1 }} noWrap>GPU{g.index} {g.name}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {g.util_pct}% · {Math.round((g.mem_used_mb ?? 0) / 1024)}/{Math.round((g.mem_total_mb ?? 0) / 1024)}GB
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* 容器汇总 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
            <MemoryRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              容器 {running}/{total} 运行{unhealthy > 0 ? ` · ${unhealthy} 异常` : ''}
            </Typography>
          </Box>
        </>
      ) : (
        <Typography variant="caption" color="text.secondary">暂无上报数据</Typography>
      )}
    </Paper>
  );
}

/** 服务器与集群监控:多节点聚合视图,容器状态 + CPU/内存/GPU/Doris 占用。 */
export default function ClusterMonitorPage() {
  const q = useQuery({ queryKey: ['admin', 'cluster', 'fleet'], queryFn: fleet, refetchInterval: 10_000 });

  const nodes = q.data ?? [];
  const online = nodes.filter((n) => n.online).length;
  const totalContainers = nodes.reduce((s, n) => s + (n.report?.containers?.length ?? 0), 0);
  const runningContainers = nodes.reduce((s, n) => s + (n.report?.containers?.filter((c) => c.running).length ?? 0), 0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>服务器与集群监控</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {nodes.length} 个节点 · {online} 在线 · 容器 {runningContainers}/{totalContainers} 运行中(每 10s 刷新)
      </Typography>

      {q.isLoading ? (
        <Typography color="text.secondary">加载中...</Typography>
      ) : nodes.length === 0 ? (
        <Typography color="text.secondary">暂无节点接入 steward</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
          {nodes.map((n) => <NodeCard key={n.id} node={n} />)}
        </Box>
      )}

      {/* 容器明细表(全部节点铺开) */}
      {nodes.some((n) => (n.report?.containers?.length ?? 0) > 0) && (
        <TableContainer component={Paper} sx={{ mt: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>节点</TableCell>
                <TableCell>服务</TableCell>
                <TableCell>容器</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>健康</TableCell>
                <TableCell align="right">CPU%</TableCell>
                <TableCell align="right">内存(MB)</TableCell>
                <TableCell align="right">重启</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nodes.flatMap((n) =>
                (n.report?.containers ?? []).map((c) => (
                  <TableRow key={`${n.id}-${c.container}`} hover>
                    <TableCell>{n.report?.hostname || n.id}</TableCell>
                    <TableCell>{c.service}</TableCell>
                    <TableCell>{c.container}</TableCell>
                    <TableCell>
                      <Chip size="small" label={c.running ? '运行' : '停止'} color={c.running ? 'success' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {c.health ? (
                        <Chip size="small" label={c.health} color={c.health === 'healthy' ? 'success' : c.health === 'unhealthy' ? 'error' : 'warning'} variant="outlined" />
                      ) : '-'}
                    </TableCell>
                    <TableCell align="right">{c.cpu_perc != null ? c.cpu_perc.toFixed(1) : '-'}</TableCell>
                    <TableCell align="right">{c.mem_usage_mb != null ? c.mem_usage_mb.toFixed(0) : '-'}</TableCell>
                    <TableCell align="right">{c.restarts}</TableCell>
                  </TableRow>
                )),
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
