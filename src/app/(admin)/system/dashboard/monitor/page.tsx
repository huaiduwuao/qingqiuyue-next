'use client';

import React from 'react';
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
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import * as ops from '@/apis/ops';

type Container = {
  id: string; names: string[]; image: string; state: string; status: string;
  cpuPerc: number; memMB: number; memPerc: number;
};
type Middleware = { name: string; kind: string; addr: string; up: boolean; latency: number; detail: string };

export default function DashboardMonitorPage() {
  const [podmanUp, setPodmanUp] = React.useState(true);
  const [list, setList] = React.useState<Container[]>([]);
  const [mws, setMws] = React.useState<Middleware[]>([]);
  const [busy, setBusy] = React.useState<string>(''); // 正在操作的容器 id
  const [logId, setLogId] = React.useState<string>('');
  const [logText, setLogText] = React.useState<string>('');
  const [snack, setSnack] = React.useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' });
  const [forbidden, setForbidden] = React.useState(false);

  const toast = (msg: string, sev: 'success' | 'error' = 'success') => setSnack({ open: true, msg, sev });

  const refresh = React.useCallback(async () => {
    try {
      const res: any = await ops.overview();
      const d = res?.data ?? res;
      setPodmanUp(!!d.podmanUp);
      setList(d.containers || []);
      setMws(d.middlewares || []);
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
      const res: any = await ops.containerLogs(id, 300);
      setLogText((res?.data ?? res)?.logs || '(空)');
    } catch (e: any) {
      setLogText('日志获取失败: ' + (e?.message || e));
    }
  };

  if (forbidden) {
    return (
      <Container maxWidth="lg"><Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>监控</Typography>
        <Alert severity="warning">运维控制台仅超级管理员可访问。</Alert>
      </Box></Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" gutterBottom>监控</Typography>

        {/* ── 中间件健康 ── */}
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>中间件</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          {mws.map((m) => (
            <Card key={m.name} variant="outlined" sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 700 }}>{m.name}</Typography>
                <Chip size="small" color={m.up ? 'success' : 'error'} label={m.up ? '正常' : '离线'} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{m.addr}</Typography>
              <Typography variant="caption" color="text.secondary">{m.latency}ms{m.detail ? ` · ${m.detail}` : ''}</Typography>
            </Card>
          ))}
          {!mws.length && <Typography variant="body2" color="text.secondary">无中间件探测数据</Typography>}
        </Box>

        {/* ── 容器 ── */}
        <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>容器</Typography>
        {!podmanUp && <Alert severity="info" sx={{ mb: 1 }}>podman 不可达:检查是否已把 podman.sock 挂进 core-api,并 `systemctl enable --now podman.socket`。</Alert>}
        <Card variant="outlined">
          <Table size="small">
            <TableHead><TableRow>
              {['容器', '镜像', '状态', 'CPU', '内存', '操作'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12.5 }}>{h}</TableCell>
              ))}
            </TableRow></TableHead>
            <TableBody>
              {list.map((c) => {
                const running = c.state === 'running';
                return (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontSize: 12.5 }}>{c.names?.[0] || c.id}</TableCell>
                    <TableCell sx={{ fontSize: 11.5, color: 'text.secondary', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.image}</TableCell>
                    <TableCell><Chip size="small" color={running ? 'success' : 'default'} label={c.state} /></TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{running ? `${(c.cpuPerc ?? 0).toFixed(1)}%` : '-'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{running ? `${(c.memMB ?? 0).toFixed(0)}MB` : '-'}</TableCell>
                    <TableCell>
                      <Tooltip title="日志"><IconButton size="small" onClick={() => showLogs(c.id)}><ArticleRoundedIcon fontSize="small" /></IconButton></Tooltip>
                      {running ? (
                        <>
                          <Tooltip title="重启"><span><IconButton size="small" disabled={busy === c.id} onClick={() => act(c.id, 'restart')}><RestartAltRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title="停止"><span><IconButton size="small" color="error" disabled={busy === c.id} onClick={() => act(c.id, 'stop')}><StopRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
                        </>
                      ) : (
                        <Tooltip title="启动"><span><IconButton size="small" color="success" disabled={busy === c.id} onClick={() => act(c.id, 'start')}><PlayArrowRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!list.length && (
                <TableRow><TableCell colSpan={6} sx={{ color: 'text.secondary', fontSize: 12.5 }}>{podmanUp ? '无容器' : 'podman 不可达'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

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
