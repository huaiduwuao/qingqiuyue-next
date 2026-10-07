'use client';

// 算力节点 —— 管理出图出片用的 GPU 机器(仅管理员)。
// 每台机器(AutoDL 实例)跑一个 comfy-gateway,这里登记它的公网 HTTPS 地址和令牌;
// gen-api 先按负载和模型挑机器,机器上的网关再挑卡。选中一个节点,下方展示它的卡/实例/日志/派单(NodeDetail)。

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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import NetworkCheckRoundedIcon from '@mui/icons-material/NetworkCheckRounded';
import * as gw from '@/apis/comfyGateway';
import { NodeDetail, ELLIPSIS, errMsg, errStatus } from './NodeDetail';

type Editing = { id?: number; name: string; baseUrl: string; token: string; enabled: boolean; note: string; tokenSet?: boolean };

function NodeCard({ n, selected, onSelect, onEdit, onToggle, onDelete }: {
  n: gw.GpuNode; selected: boolean; onSelect: () => void; onEdit: () => void; onToggle: (v: boolean) => void; onDelete: () => void;
}) {
  const dot = !n.enabled ? 'text.disabled' : n.online ? 'success.main' : 'error.main';
  return (
    <Card variant="outlined" onClick={onSelect}
      sx={{ p: 1.75, flex: '1 1 300px', minWidth: 0, cursor: 'pointer', borderColor: selected ? 'primary.main' : undefined, borderWidth: selected ? 2 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: dot, flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }} noWrap>{n.name}</Typography>
        {n.legacy && <Chip size="small" variant="outlined" label="环境变量" />}
        {!n.enabled && <Chip size="small" label="已停用" />}
        <Box sx={{ flex: 1 }} />
        {!n.legacy && (
          <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={n.enabled ? '停用(不再派新任务)' : '启用'}>
              <Switch size="small" checked={n.enabled} onChange={(e) => onToggle(e.target.checked)} />
            </Tooltip>
            <Tooltip title="编辑"><IconButton size="small" onClick={onEdit}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="删除"><IconButton size="small" onClick={onDelete}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        )}
      </Box>
      <Box sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace', mt: 0.5, ...ELLIPSIS }}>{n.baseUrl}</Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 1, fontSize: 13, flexWrap: 'wrap' }}>
        {n.online ? (
          <>
            <span>卡 {n.running}/{n.instances}</span>
            <span>任务 {n.queue}</span>
            {n.version && <Box component="span" sx={{ color: 'text.secondary' }}>网关 {n.version}</Box>}
          </>
        ) : (
          <Box component="span" sx={{ color: 'error.main', ...ELLIPSIS }}>{n.error || '离线'}</Box>
        )}
      </Box>
      {n.note && <Box sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5, ...ELLIPSIS }}>{n.note}</Box>}
    </Card>
  );
}

function NodeEditor({ value, onClose, onSaved }: { value: Editing; onClose: () => void; onSaved: (n: gw.GpuNode) => void }) {
  const [v, setV] = React.useState<Editing>(value);
  const [busy, setBusy] = React.useState(false);
  const [probe, setProbe] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [err, setErr] = React.useState('');
  const set = (patch: Partial<Editing>) => setV((old) => ({ ...old, ...patch }));

  const test = async () => {
    setBusy(true);
    setProbe(null);
    try {
      const r = await gw.probeNode({ baseUrl: v.baseUrl, token: v.token || undefined, id: v.id });
      const n = r.node;
      setProbe(n.online
        ? { ok: true, msg: `连通,${r.latencyMs}ms;${n.gateway ? `网关 ${n.version},卡 ${n.running}/${n.instances} 在线` : '普通 ComfyUI(没有网关管理接口)'}` }
        : { ok: false, msg: n.error || '连不上' });
    } catch (e) {
      setProbe({ ok: false, msg: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const body: gw.GpuNodeInput = { name: v.name, baseUrl: v.baseUrl, enabled: v.enabled, note: v.note };
      if (v.token) body.token = v.token;
      onSaved(v.id ? await gw.updateNode(v.id, body) : await gw.createNode(body));
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{v.id ? `编辑 ${value.name}` : '添加算力节点'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField label="名称" value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="如 AutoDL 西部 双 5090 #1" fullWidth size="small" />
        <TextField label="地址" value={v.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} fullWidth size="small"
          placeholder="https://xxxx.westd.seetacloud.com:8443"
          helperText="AutoDL 控制台 → 实例的「自定义服务」里 6006 端口的地址(网关监听 6006)" />
        <TextField label="令牌" type="password" value={v.token} onChange={(e) => set({ token: e.target.value })} fullWidth size="small"
          placeholder={v.tokenSet ? '已设置,留空不改' : '网关的 CGW_TOKEN'}
          helperText="机器上 /root/comfy-gateway/gateway.env 里的 CGW_TOKEN;只存在服务端,保存后不再显示" />
        <TextField label="备注" value={v.note} onChange={(e) => set({ note: e.target.value })} fullWidth size="small" placeholder="租期、价格、卡型…" />
        <FormControlLabel control={<Switch checked={v.enabled} onChange={(e) => set({ enabled: e.target.checked })} />} label="启用(参与派单)" />
        {probe && <Alert severity={probe.ok ? 'success' : 'error'}>{probe.msg}</Alert>}
        {err && <Alert severity="error">{err}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button startIcon={<NetworkCheckRoundedIcon />} onClick={test} disabled={busy || !v.baseUrl.trim()}>测试连接</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={busy}>取消</Button>
        <Button variant="contained" onClick={save} disabled={busy || !v.name.trim() || !v.baseUrl.trim()}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ComfyGatewayPage() {
  const qc = useQueryClient();
  const nodesQ = useQuery({ queryKey: ['comfy-gateway', 'nodes'], queryFn: gw.listNodes, refetchInterval: 5000, retry: false });
  const [picked, setPicked] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [deleting, setDeleting] = React.useState<gw.GpuNode | null>(null);
  const [snack, setSnack] = React.useState<{ msg: string; sev: 'success' | 'error' } | null>(null);
  const nodes = nodesQ.data ?? [];
  const reload = () => qc.invalidateQueries({ queryKey: ['comfy-gateway', 'nodes'] });

  // 没点过就默认第一个在线的网关节点;点过的节点被删了也回到默认
  const fallback = nodes.find((n) => n.online && n.gateway) ?? nodes[0];
  const current = nodes.find((n) => n.id === picked) ?? fallback;

  const toggle = async (n: gw.GpuNode, enabled: boolean) => {
    try {
      await gw.updateNode(n.id, { enabled });
      setSnack({ msg: `${n.name} 已${enabled ? '启用' : '停用'}`, sev: 'success' });
      reload();
    } catch (e) {
      setSnack({ msg: errMsg(e), sev: 'error' });
    }
  };
  const remove = async () => {
    if (!deleting) return;
    try {
      await gw.deleteNode(deleting.id);
      setSnack({ msg: `已删除 ${deleting.name}`, sev: 'success' });
      setDeleting(null);
      reload();
    } catch (e) {
      setSnack({ msg: errMsg(e), sev: 'error' });
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>算力节点</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            每台 GPU 机器一个节点;出图出片先按负载和模型挑机器,机器上的网关再挑卡
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<AddRoundedIcon />}
            onClick={() => setEditing({ name: '', baseUrl: '', token: '', enabled: true, note: '' })}>添加节点</Button>
        </Box>
        {nodesQ.error && <Alert severity={errStatus(nodesQ.error) === 403 ? 'warning' : 'error'} sx={{ my: 2 }}>{errMsg(nodesQ.error)}</Alert>}
        {nodesQ.isLoading && <LinearProgress sx={{ my: 2 }} />}
        {nodes.some((n) => n.legacy) && (
          <Alert severity="info" sx={{ my: 1.5 }}>
            还没有启用的节点,正在用环境变量 COMFYUI_URL。添加并启用节点后改用这里的节点派单。
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', my: 2 }}>
          {nodes.map((n) => (
            <NodeCard key={n.id} n={n} selected={n.id === current?.id} onSelect={() => setPicked(n.id)}
              onEdit={() => setEditing({ id: n.id, name: n.name, baseUrl: n.baseUrl, token: '', enabled: n.enabled, note: n.note, tokenSet: n.tokenSet })}
              onToggle={(v) => toggle(n, v)} onDelete={() => setDeleting(n)} />
          ))}
        </Box>

        {current && (current.gateway || !current.online
          ? <NodeDetail key={current.id} nodeId={current.id} />
          : <Alert severity="info">「{current.name}」是普通 ComfyUI,可以派单,但没有网关的卡/实例/日志管理接口。</Alert>)}
      </Box>

      {editing && (
        <NodeEditor value={editing} onClose={() => setEditing(null)}
          onSaved={(n) => {
            setEditing(null);
            setPicked(n.id);
            setSnack({ msg: `已保存 ${n.name}${n.online ? ',连通' : ',但现在连不上'}`, sev: n.online ? 'success' : 'error' });
            reload();
          }} />
      )}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogTitle>删除节点 {deleting?.name}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>只删 qingqiuyue 里的记录,不影响那台机器。上面还有没跑完的任务时删不掉,先停用、等任务跑完。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={remove}>删除</Button>
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
