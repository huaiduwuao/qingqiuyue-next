'use client';

// 部署管理 —— Steward 控制面的操作台(仅超管)。
// 所有变更都是一条 operation:谁发起、为什么、风险级别、审批、每一步的日志。
// T0/T1 提交即执行;T2(部署新 release)/T3 进入待审批,由超级管理员批准后才生效。

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
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import * as st from '@/apis/steward';

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const KIND_LABEL: Record<st.OpKind, string> = {
  build: '构建',
  adopt: '接管基线',
  restart_service: '重启服务',
  deploy_release: '部署',
  rollback: '回滚',
  detach: '脱离管控',
};

const STATUS: Record<st.OpStatus, { label: string; color: ChipColor }> = {
  awaiting_approval: { label: '待审批', color: 'warning' },
  queued: { label: '排队中', color: 'info' },
  running: { label: '执行中', color: 'info' },
  verifying: { label: '验证中', color: 'secondary' },
  succeeded: { label: '成功', color: 'success' },
  failed: { label: '失败', color: 'error' },
  rejected: { label: '已驳回', color: 'default' },
  rolled_back: { label: '已回滚', color: 'error' },
  superseded: { label: '已被取代', color: 'default' },
};

const TIER_COLOR: ChipColor[] = ['default', 'success', 'warning', 'error'];
const ACTIVE: st.OpStatus[] = ['awaiting_approval', 'queued', 'running', 'verifying'];

const short = (s?: string, n = 12) => (s ? s.slice(0, n) : '—');
const fmtTime = (s?: string | null) => (s ? new Date(s).toLocaleString('zh-CN', { hour12: false }) : '—');
const errStatus = (e: unknown) => (e as { status?: number } | null)?.status;
const errMsg = (e: unknown) => (e as { message?: string } | null)?.message || '请求失败';

type ActionKind = 'build' | 'deploy_release' | 'rollback' | 'adopt' | 'detach';

const ACTION_HINT: Record<ActionKind, string> = {
  build: '拉取两个仓库的最新提交,只重建受影响的服务。只产出镜像,不切换线上。(T1,提交即执行)',
  deploy_release: '把节点切到所选 release。失败或 10 分钟验证窗口内出问题会自动回滚。(T2,需超级管理员批准)',
  rollback: '切回所选 release。回到已验证过的版本为 T1,直接执行;否则按 T2 等待批准。',
  adopt: '把节点上当前在跑的镜像登记为一个已验证 release,作为回滚基线。不改动任何容器。(T1)',
  detach: '清空节点期望状态:agent 只观测、不再变更,可回到手动 make compose-up。(T1)',
};

// DataGridTable 的 fetchData 是单次拉取(无内置 refetchInterval),
// 这里通过一个递增的 tick 当 extraParams 喂进去,周期性触发 refetch。
function useAutoRefresh(intervalMs: number): number {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return tick;
}

export default function DeploymentPage() {
  const qc = useQueryClient();
  const [openOp, setOpenOp] = React.useState<string>('');
  const [action, setAction] = React.useState<ActionKind | null>(null);
  const [snack, setSnack] = React.useState<{ msg: string; sev: 'success' | 'error' } | null>(null);
  const toast = (msg: string, sev: 'success' | 'error' = 'success') => setSnack({ msg, sev });

  const fleetQ = useQuery({ queryKey: ['steward', 'fleet'], queryFn: st.fleet, refetchInterval: 5000, retry: false });
  const opsQ = useQuery({ queryKey: ['steward', 'ops'], queryFn: () => st.operations(50), refetchInterval: 5000, retry: false });
  const relQ = useQuery({ queryKey: ['steward', 'releases'], queryFn: () => st.releases(20), refetchInterval: 15000, retry: false });
  const autoQ = useQuery({ queryKey: ['steward', 'automation'], queryFn: st.automation, refetchInterval: 15000, retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ['steward'] });

  // 表格内部轮询(refetchInterval 行为):
  const opTick = useAutoRefresh(5000);
  const relTick = useAutoRefresh(15000);

  if (errStatus(fleetQ.error) === 403) {
    return (
      <Container maxWidth="lg"><Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>部署管理</Typography>
        <Alert severity="warning">部署控制面仅超级管理员可访问。</Alert>
      </Box></Container>
    );
  }

  const node = fleetQ.data?.[0];
  const ops = opsQ.data ?? [];
  const rels = relQ.data ?? [];
  const pending = ops.filter((o) => o.status === 'awaiting_approval');
  const busy = ops.some((o) => o.status === 'running' || o.status === 'queued' || o.status === 'verifying');
  const desired = rels.find((r) => r.id === node?.desired_release_id);

  const submit = async (req: st.CreateOperation) => {
    try {
      const op = await st.createOperation(req);
      toast(op.status === 'awaiting_approval' ? '已提交,等待超级管理员批准' : `${KIND_LABEL[op.kind]}已开始`);
      setOpenOp(op.id);
      refresh();
      return true;
    } catch (e) {
      toast(errMsg(e), 'error');
      return false;
    }
  };

  const releaseColumns: GridColDef[] = [
    { field: 'id', headerName: 'Release', width: 240, renderCell: (p) => {
      const r = p.row as st.Release;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id}</Box>
          {r.id === node?.current_release_id && <Chip size="small" label="当前" color="primary" />}
        </Box>
      );
    } },
    { field: 'source', headerName: '来源', width: 90, valueFormatter: (v) => v === 'adopt' ? '接管' : '构建' },
    { field: 'commits', headerName: '提交(go / next)', width: 220, sortable: false,
      valueGetter: (_, row) => `${short((row as st.Release).go_commit, 7)} / ${short((row as st.Release).next_commit, 7)}`,
      renderCell: (p) => <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.value}</Box> },
    { field: 'items', headerName: '服务', type: 'number', width: 80, align: 'right', headerAlign: 'right',
      valueGetter: (_, row) => (row as st.Release).items.length },
    { field: 'verified_at', headerName: '状态', width: 110,
      renderCell: (p) => <Chip size="small" variant="outlined"
        color={p.value ? 'success' : 'default'}
        label={p.value ? '已验证' : '未验证'} /> },
    { field: 'created_at', headerName: '创建时间', width: 170, sortable: false,
      valueFormatter: (v) => v ? fmtTime(v as string) : '—' },
  ];

  const opsColumns: GridColDef[] = [
    { field: 'kind', headerName: '操作', width: 130, sortable: false,
      renderCell: (p) => {
        const o = p.row as st.Operation;
        return (
          <Box sx={{ fontSize: 12.5 }}>
            {KIND_LABEL[o.kind] ?? o.kind}
            {o.target_release_id && <Box component="span" sx={{ ml: 1, fontFamily: 'monospace', fontSize: 11.5, color: 'text.secondary' }}>{o.target_release_id}</Box>}
          </Box>
        );
      } },
    { field: 'tier', headerName: '风险', width: 80, sortable: false,
      renderCell: (p) => <TierChip tier={p.value as st.Tier} /> },
    { field: 'status', headerName: '状态', width: 200, sortable: false,
      renderCell: (p) => {
        const o = p.row as st.Operation;
        return (
          <Box sx={{ whiteSpace: 'nowrap' }}>
            <StatusChip status={o.status} />
            {o.older_than_live && <StaleChip why={o.older_than_live} />}
          </Box>
        );
      } },
    { field: 'requester', headerName: '发起人', width: 130, sortable: false,
      valueGetter: (_, row) => {
        const o = row as st.Operation;
        return o.requester_type === 'system' ? 'Steward(自动)' : o.requester_name;
      } },
    { field: 'note', headerName: '说明', flex: 1.5, minWidth: 200, sortable: false,
      valueGetter: (_, row) => {
        const o = row as st.Operation;
        return o.message || o.reason || '—';
      },
      renderCell: (p) => <Box sx={{ fontSize: 12.5, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.value}</Box> },
    { field: 'created_at', headerName: '时间', width: 170, sortable: false,
      valueFormatter: (v) => v ? fmtTime(v as string) : '—' },
  ];

  // fetchData 通过下标 allList 实现(全量切片);extraParams 用 tick 触发 refetch。
  const releasesAll = React.useRef<st.Release[]>([]);
  const fetchReleases = React.useCallback(async (params: { pageNumber: number; pageSize: number }) => {
    releasesAll.current = await st.releases(20);
    const start = (params.pageNumber - 1) * params.pageSize;
    return { records: releasesAll.current.slice(start, start + params.pageSize), totalRow: releasesAll.current.length };
  }, []);

  const opsAll = React.useRef<st.Operation[]>([]);
  const fetchOps = React.useCallback(async (params: { pageNumber: number; pageSize: number }) => {
    opsAll.current = await st.operations(50);
    const start = (params.pageNumber - 1) * params.pageSize;
    return { records: opsAll.current.slice(start, start + params.pageSize), totalRow: opsAll.current.length };
  }, []);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: { xs: 2, md: 4 }, display: 'grid', gap: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4">部署管理</Typography>
            <Typography variant="body2" color="text.secondary">
              Steward 控制面:每次变更都是一条可审计的操作;部署需超级管理员批准,失败自动回滚。
            </Typography>
          </Box>
          <Tooltip title="刷新"><IconButton onClick={refresh}><RefreshRoundedIcon /></IconButton></Tooltip>
        </Box>

        {fleetQ.error && errStatus(fleetQ.error) !== 403 && (
          <Alert severity="error">控制面不可达:{errMsg(fleetQ.error)}</Alert>
        )}

        {/* ── 节点 ── */}
        {node ? <NodeCard node={node} desired={desired} /> : !fleetQ.isLoading && (
          <Alert severity="info">还没有节点接入。在节点上执行 steward token 签发 token 并启动 steward-agent。</Alert>
        )}

        {/* ── 操作按钮 ── */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={() => setAction('build')}>构建最新代码</Button>
          <Button variant="outlined" onClick={() => setAction('deploy_release')} disabled={!rels.length}>部署 release…</Button>
          <Button variant="outlined" onClick={() => setAction('rollback')} disabled={!rels.some((r) => r.verified_at)}>回滚…</Button>
          <Button onClick={() => setAction('adopt')}>接管基线</Button>
          <Button color="warning" onClick={() => setAction('detach')} disabled={!node?.desired_release_id}>脱离管控</Button>
        </Box>
        <AutomationBar state={autoQ.data} onToggle={async (paused) => {
          try {
            await st.setAutomation(paused, paused ? '面板上手动暂停' : '');
            toast(paused ? '已暂停自动化:AI 助手的操作都会等人批准' : '已恢复自动化');
            refresh();
          } catch (e) {
            toast(errMsg(e), 'error');
          }
        }} />
        {busy && <LinearProgress />}

        {/* ── 待审批 ── */}
        {pending.length > 0 && (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Typography variant="h6">待审批 · {pending.length}</Typography>
            {pending.map((o) => (
              <ApprovalCard key={o.id} op={o} onOpen={() => setOpenOp(o.id)} onDone={(msg, sev) => { toast(msg, sev); refresh(); }} />
            ))}
          </Box>
        )}

        {/* ── 服务 ── */}
        {node?.report && (
          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>服务</Typography>
            <ServicesTable report={node.report} desired={desired}
              onRestart={(service) => submit({ kind: 'restart_service', params: { service }, reason: '面板手动重启' })} />
          </Box>
        )}

        {/* ── Release ── */}
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>Release</Typography>
          <DataGridTable
            columns={releaseColumns}
            fetchData={fetchReleases}
            extraParams={{ tick: relTick }}
          />
        </Box>

        {/* ── 操作记录 ── */}
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>操作记录</Typography>
          <DataGridTable
            columns={opsColumns}
            fetchData={fetchOps}
            extraParams={{ tick: opTick }}
            customActions={[{
              label: '查看',
              color: 'primary',
              onClick: (row) => setOpenOp((row as st.Operation).id),
            }]}
          />
        </Box>
      </Box>

      {action && (
        <ActionDialog kind={action} releases={rels} currentReleaseId={node?.current_release_id ?? ''}
          onClose={() => setAction(null)}
          onSubmit={async (req) => { if (await submit(req)) setAction(null); }} />
      )}
      {openOp && <OperationDialog id={openOp} onClose={() => setOpenOp('')} />}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.sev ?? 'success'} onClose={() => setSnack(null)}>{snack?.msg}</Alert>
      </Snackbar>
    </Container>
  );
}

function AutomationBar({ state, onToggle }: { state?: st.Automation; onToggle: (paused: boolean) => void }) {
  if (!state) return null;
  return (
    <Alert
      severity={state.paused ? 'warning' : 'info'}
      variant="outlined"
      action={
        <Button color="inherit" size="small" onClick={() => onToggle(!state.paused)}>
          {state.paused ? '恢复自动化' : '暂停自动化'}
        </Button>
      }
    >
      {state.paused
        ? `自动化已暂停${state.reason ? `(${state.reason})` : ''}:AI 助手发起的操作一律等人批准。失败后的自动回滚不受影响。`
        : 'AI 助手可以自主执行 T1(重启、构建、回滚到已验证版本),每个目标每小时最多 3 次,连续失败两次自动熔断;部署新版本始终要人批准。'}
    </Alert>
  );
}

function StatusChip({ status }: { status: st.OpStatus }) {
  const s = STATUS[status] ?? { label: status, color: 'default' as ChipColor };
  return <Chip size="small" color={s.color} label={s.label} />;
}

// 待执行的部署目标不比线上新:批准它就是把线上退回旧代码(2026-09-17 事故)。
function StaleChip({ why }: { why: string }) {
  return (
    <Tooltip title={why}>
      <Chip size="small" color="error" variant="outlined" label="比线上旧" sx={{ ml: 0.5 }} />
    </Tooltip>
  );
}

function TierChip({ tier }: { tier: st.Tier }) {
  return <Chip size="small" variant="outlined" color={TIER_COLOR[tier] ?? 'default'} label={`T${tier}`} sx={{ fontFamily: 'monospace' }} />;
}

function Pct({ label, value, warn, crit }: { label: string; value: number; warn: number; crit: number }) {
  const color: ChipColor = value < 0 ? 'default' : value >= crit ? 'error' : value >= warn ? 'warning' : 'success';
  return <Chip size="small" variant="outlined" color={color} label={`${label} ${value < 0 ? '?' : `${value}%`}`} />;
}

function NodeCard({ node, desired }: { node: st.StewardNode; desired?: st.Release }) {
  const rep = node.report;
  const managed = !!node.desired_release_id;
  return (
    <Card variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700 }}>{node.id}</Typography>
        <Typography variant="body2" color="text.secondary">{rep?.hostname}</Typography>
        <Chip size="small" color={node.online ? 'success' : 'error'} label={node.online ? '在线' : '离线'} />
        <Chip size="small" variant="outlined" color={managed ? 'primary' : 'default'} label={managed ? 'Steward 管控中' : '只观测(未接管)'} />
        {rep && <Pct label="根盘" value={rep.root_disk_pct} warn={80} crit={90} />}
        {rep && <Pct label="/tmp 内存" value={rep.tmpfs_pct} warn={50} crit={80} />}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1, fontSize: 13 }}>
        <Field label="当前 release" value={node.current_release_id || '—'} mono />
        <Field label="期望 release" value={desired?.id || node.desired_release_id || '无(不做变更)'} mono={!!node.desired_release_id} />
        <Field label="agent / 最近签到" value={`${node.agent_version || '?'} · ${fmtTime(node.last_seen)}`} />
      </Box>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  );
}

// ServicesTable 保留裸 MUI Table —— 它嵌在 NodeCard 里,每行有 IconButton 重启按钮 + 健康检查 chip,
// 形态过于定制,DataGridTable 内嵌卡片视觉不协调,且重按钮需要在 hover 时显示。
function ServicesTable({ report, desired, onRestart }: {
  report: st.NodeReport; desired?: st.Release; onRestart: (service: string) => void;
}) {
  const want = new Map((desired?.items ?? []).map((i) => [i.service, i]));
  return (
    <Card variant="outlined" sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead><TableRow>
          {['服务', '镜像', '健康', '重启', '期望', ''].map((h, i) => (
            <TableCell key={i} sx={{ fontWeight: 700, fontSize: 12.5 }}>{h}</TableCell>
          ))}
        </TableRow></TableHead>
        <TableBody>
          {report.containers.map((c) => {
            const w = want.get(c.service);
            const onTarget = !w || w.image_id === c.image_id;
            const health: { label: string; color: ChipColor } = c.inspect_error ? { label: '状态未知', color: 'warning' }
              : !c.exists ? { label: '不存在', color: 'error' }
              : !c.running ? { label: '已停止', color: 'error' }
              : c.health === 'unhealthy' ? { label: '不健康', color: 'error' }
              : c.health === 'starting' ? { label: '启动中', color: 'info' }
              : { label: '运行中', color: 'success' };
            return (
              <TableRow key={c.service} hover>
                <TableCell sx={{ fontSize: 12.5, fontWeight: 600 }}>{c.service}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{short(c.image_id)}</TableCell>
                <TableCell><Chip size="small" color={health.color} label={health.label} /></TableCell>
                <TableCell sx={{ fontSize: 12.5 }}>{c.restarts}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>
                  {w ? (onTarget ? <Chip size="small" variant="outlined" color="success" label="一致" />
                    : <Tooltip title={w.image_tag}><Chip size="small" variant="outlined" color="warning" label={`待切换 → ${short(w.image_id)}`} /></Tooltip>)
                    : <Typography variant="caption" color="text.secondary">—</Typography>}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="重启(T1)">
                    <span><IconButton size="small" disabled={!c.exists} onClick={() => onRestart(c.service)}><RestartAltRoundedIcon fontSize="small" /></IconButton></span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function ApprovalCard({ op, onOpen, onDone }: {
  op: st.Operation; onOpen: () => void; onDone: (msg: string, sev: 'success' | 'error') => void;
}) {
  const [comment, setComment] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const stale = op.older_than_live;
  const decide = async (approve: boolean) => {
    if (approve && stale && !window.confirm(`这个部署的目标${stale}。\n批准会把线上退回旧代码,确定要回退吗?`)) return;
    setBusy(true);
    try {
      await (approve ? st.approve(op.id, comment, !!stale) : st.reject(op.id, comment));
      onDone(approve ? (stale ? '已强制批准回退,开始执行' : '已批准,开始执行') : '已驳回', 'success');
    } catch (e) {
      onDone(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card variant="outlined" sx={{ p: 2, display: 'grid', gap: 1, borderColor: stale ? 'error.main' : 'warning.main' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <TierChip tier={op.tier} />
        {stale && <StaleChip why={stale} />}
        <Typography sx={{ fontWeight: 700 }}>{KIND_LABEL[op.kind] ?? op.kind}</Typography>
        {op.target_release_id && <Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>{op.target_release_id}</Typography>}
        <Typography variant="body2" color="text.secondary">· {op.requester_name} · {fmtTime(op.created_at)}</Typography>
        <Button size="small" onClick={onOpen} sx={{ ml: 'auto' }}>查看详情</Button>
      </Box>
      {op.reason && <Typography variant="body2">{op.reason}</Typography>}
      {stale && (
        <Alert severity="error">目标{stale}。批准会把线上退回旧代码,通常应驳回;确需回退才「强制回退」。</Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField id={`approve-comment-${op.id}`} size="small" placeholder="审批意见(可选)" value={comment}
          onChange={(e) => setComment(e.target.value)} sx={{ flex: '1 1 240px' }} />
        {stale ? (
          <>
            <Button variant="contained" color="error" disabled={busy} onClick={() => decide(false)}>驳回</Button>
            <Button variant="outlined" color="warning" disabled={busy} onClick={() => decide(true)}>强制回退…</Button>
          </>
        ) : (
          <>
            <Button variant="contained" color="success" disabled={busy} onClick={() => decide(true)}>批准</Button>
            <Button variant="outlined" color="error" disabled={busy} onClick={() => decide(false)}>驳回</Button>
          </>
        )}
      </Box>
    </Card>
  );
}

function ActionDialog({ kind, releases, currentReleaseId, onClose, onSubmit }: {
  kind: ActionKind; releases: st.Release[]; currentReleaseId: string;
  onClose: () => void; onSubmit: (req: st.CreateOperation) => Promise<void>;
}) {
  const choices = kind === 'rollback'
    ? releases.filter((r) => r.verified_at && r.id !== currentReleaseId)
    : releases.filter((r) => r.id !== currentReleaseId);
  const [releaseId, setReleaseId] = React.useState(choices[0]?.id ?? '');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const needsRelease = kind === 'deploy_release' || kind === 'rollback';

  const go = async () => {
    setBusy(true);
    await onSubmit({ kind, reason, params: needsRelease ? { release_id: releaseId } : {} });
    setBusy(false);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{KIND_LABEL[kind]}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <Alert severity={kind === 'deploy_release' ? 'warning' : 'info'}>{ACTION_HINT[kind]}</Alert>
        {needsRelease && (
          <TextField id="action-release" select label="目标 release" value={releaseId} onChange={(e) => setReleaseId(e.target.value)}
            helperText={choices.length ? undefined : '没有可选的 release'}>
            {choices.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 13 }}>{r.id}</Box>
                <Box component="span" sx={{ ml: 1, color: 'text.secondary', fontSize: 12 }}>{r.verified_at ? '已验证' : '未验证'}</Box>
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField id="action-reason" label="原因" placeholder="写给审批人和日后排查的人看" value={reason}
          onChange={(e) => setReason(e.target.value)} multiline minRows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={busy || (needsRelease && !releaseId)} onClick={go}>
          {kind === 'deploy_release' ? '提交审批' : '执行'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function OperationDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['steward', 'op', id],
    queryFn: () => st.operation(id),
    refetchInterval: (query) => (query.state.data && !ACTIVE.includes(query.state.data.status) ? false : 3000),
  });
  const op = q.data;
  const levelColor: Record<string, ChipColor> = { info: 'default', warn: 'warning', error: 'error' };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {op ? KIND_LABEL[op.kind] ?? op.kind : '操作'}
        {op && <TierChip tier={op.tier} />}
        {op && <StatusChip status={op.status} />}
        {op?.older_than_live && <StaleChip why={op.older_than_live} />}
        <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>{id}</Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'grid', gap: 1.5 }}>
        {q.error && <Alert severity="error">{errMsg(q.error)}</Alert>}
        {op && (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
              <Field label="发起人" value={op.requester_type === 'system' ? 'Steward(自动)' : op.requester_name} />
              <Field label="目标 release" value={op.target_release_id || '—'} mono={!!op.target_release_id} />
              <Field label="验证截止" value={fmtTime(op.verify_until)} />
            </Box>
            {op.reason && <Typography variant="body2">原因:{op.reason}</Typography>}
            {op.message && (
              <Alert severity={op.status === 'succeeded' ? 'success' : op.status === 'failed' || op.status === 'rolled_back' ? 'error' : 'info'}>
                {op.message}
              </Alert>
            )}
            {op.approvals.map((a, i) => (
              <Typography key={i} variant="body2" color="text.secondary">
                {a.approver_name} {a.decision === 'approved' ? '批准' : '驳回'} · {fmtTime(a.created_at)}{a.comment ? `:${a.comment}` : ''}
              </Typography>
            ))}
            {ACTIVE.includes(op.status) && <LinearProgress />}
            <Box sx={{ display: 'grid', gap: 0.5 }}>
              {op.events.map((e) => (
                <Box key={e.id} sx={{ display: 'grid', gridTemplateColumns: '72px 56px 120px 1fr', gap: 1, alignItems: 'start', fontSize: 12.5 }}>
                  <Box sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{new Date(e.created_at).toLocaleTimeString('zh-CN', { hour12: false })}</Box>
                  <Box><Chip size="small" variant="outlined" color={levelColor[e.level] ?? 'default'} label={e.level} /></Box>
                  <Box sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.service || '—'}</Box>
                  <Box sx={{ fontFamily: e.message.includes('\n') ? 'monospace' : undefined, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{e.message}</Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>关闭</Button></DialogActions>
    </Dialog>
  );
}