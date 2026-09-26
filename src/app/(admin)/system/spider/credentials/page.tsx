'use client';

/**
 * 爬虫登录凭据 —— 抖音、小红书这类要登录才给数据的平台,在这里录入 Cookie。
 *
 * 只写不读:保存后只显示末 4 位,任何接口都取不回原值(后端 AES-GCM 加密存储)。
 * 模板里用 "credential_id": <id> 引用;抓取时只有请求目标属于凭据绑定的域名才会带上。
 * 凭据不经过数字人对话 —— 接入助手只按 id 引用它。
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import {
  listCredentials, createCredential, updateCredential, deleteCredential,
  type CrawlCredential, type CredentialWrite,
} from '@/apis/sourceSetup';

const LIST_KEY = ['spider', 'credentials'];
const EMPTY: CredentialWrite = { name: '', domain: '', value: '', note: '' };

function fmtTime(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false });
}

export default function SpiderCredentialsPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: LIST_KEY, queryFn: () => listCredentials() });
  const [editing, setEditing] = useState<CrawlCredential | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CredentialWrite>(EMPTY);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const showMsg = (message: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, message, severity });
  const refresh = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const save = useMutation({
    mutationFn: () => (editing ? updateCredential(editing.id, form) : createCredential(form)),
    onSuccess: () => {
      showMsg(editing ? '已更新' : '已保存(只显示末 4 位,原值无法再查看)');
      setOpen(false);
      setForm(EMPTY);
      refresh();
    },
    onError: (e: Error) => showMsg(e.message || '保存失败', 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteCredential(id),
    onSuccess: () => { showMsg('已删除'); refresh(); },
    onError: (e: Error) => showMsg(e.message || '删除失败', 'error'),
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c: CrawlCredential) => {
    setEditing(c);
    setForm({ name: c.name, domain: c.domain, value: '', note: c.note });
    setOpen(true);
  };
  const submit = () => {
    if (!form.domain.trim()) return showMsg('域名必填', 'error');
    if (!editing && !form.value.trim()) return showMsg('Cookie 必填', 'error');
    save.mutate();
  };

  const rows = query.data?.list ?? [];
  const enabled = query.data?.enabled !== false;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="h6">登录凭据</Typography>
          <Typography variant="body2" color="text.secondary">
            要登录才给数据的平台(如抖音、小红书)在这里录入 Cookie。保存后只显示末 4 位;模板里写 credential_id 引用,
            只有请求目标属于绑定域名时才会带上。数字人接入助手只按编号引用,不要把 Cookie 发在对话里。
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={!enabled}>新增凭据</Button>
      </Box>

      {!enabled && (
        <Alert severity="warning">
          服务端未配置加密密钥(CRAWLER_SECRET_KEY),暂不能录入凭据。
        </Alert>
      )}
      {query.error && <Alert severity="error">{(query.error as Error).message}</Alert>}

      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>编号</TableCell>
              <TableCell>名称</TableCell>
              <TableCell>域名</TableCell>
              <TableCell>值</TableCell>
              <TableCell>备注</TableCell>
              <TableCell>最近使用</TableCell>
              <TableCell>更新时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                  {query.isLoading ? '加载中…' : '还没有凭据'}
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontFamily: 'monospace' }}>{c.id}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{c.domain}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{c.has_value ? c.hint : '—'}</TableCell>
                <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.note || '—'}</TableCell>
                <TableCell>{fmtTime(c.last_used_at)}</TableCell>
                <TableCell>{fmtTime(c.update_time)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="编辑(Cookie 留空不修改)">
                    <IconButton size="small" onClick={() => openEdit(c)} disabled={!enabled}><EditOutlinedIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton size="small" color="error" onClick={() => { if (window.confirm(`删除凭据「${c.name}」?引用它的模板会抓取失败。`)) remove.mutate(c.id); }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? `编辑凭据 #${editing.id}` : '新增凭据'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField id="cred-name" label="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如:抖音运营号" />
          <TextField id="cred-domain" label="域名" required value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
            placeholder="douyin.com" helperText="只有请求目标属于这个域名(含子域)时才会带上 Cookie" />
          <TextField id="cred-value" label="Cookie" type="password" required={!editing} value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder={editing ? `已保存 ${editing.hint},留空不修改` : '浏览器开发者工具 → 网络 → 请求头 Cookie 的整行值'}
            helperText="保存后无法再查看原值;平台登录态过期后在这里更新" autoComplete="off" />
          <TextField id="cred-note" label="备注" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={submit} disabled={save.isPending}>保存</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
