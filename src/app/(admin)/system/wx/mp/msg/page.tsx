'use client';

import React, { useMemo, useState } from 'react';
import type { GridColDef } from '@mui/x-data-grid';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminCrudPage, formatDateTime, type CrudFormField } from '@/components/admin/AdminCrudPage';
import { WxMpStatusBar } from '@/components/admin/WxMpStatusBar';
import { formatApiError } from '@/lib/api/client';
import { replyWxMsg } from '@/apis/wx-mp';
import * as api from '@/apis/wx-mp-msg';

const DIRECTION: Record<string, string> = { receive: '收到', reply: '已回复' };

const fields: CrudFormField[] = [
  { key: 'repType', label: '消息类型' },
  { key: 'wxUserId', label: '用户' },
  { key: 'repEvent', label: '类型' },
];

/** 公众号消息:上行消息由微信回调写入(internal/wxmp),这里可以在 48 小时内用客服消息回复。 */
export default function WxMpMsgPage() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const reply = useMutation({
    mutationFn: () => replyWxMsg(target as string, text.trim()),
    onSuccess: () => {
      setToast('已发送');
      setTarget(null);
      setText('');
      qc.invalidateQueries();
    },
    onError: (e) => setToast(formatApiError(e) || '发送失败'),
  });

  const columns = useMemo<GridColDef[]>(
    () => [
      { field: 'type', headerName: '方向', width: 90, valueFormatter: (v) => DIRECTION[String(v)] ?? v },
      { field: 'repType', headerName: '消息类型', width: 100 },
      { field: 'repContent', headerName: '内容', flex: 1, minWidth: 260 },
      { field: 'wxUserId', headerName: '用户 OpenID', width: 220 },
      { field: 'createTime', headerName: '时间', width: 180, valueFormatter: (value) => formatDateTime(value) },
      {
        field: '__reply',
        headerName: '',
        width: 90,
        sortable: false,
        renderCell: (p) =>
          p.row.type === 'receive' && p.row.wxUserId ? (
            <Button size="small" onClick={() => setTarget(p.row.wxUserId)}>回复</Button>
          ) : null,
      },
    ],
    [],
  );

  return (
    <>
      <WxMpStatusBar />
      <AdminCrudPage title="微信消息" entity="消息" api={api} columns={columns} fields={fields} />
      <Dialog open={!!target} onClose={() => setTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>回复公众号消息</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            sx={{ mt: 1 }}
            label="回复内容"
            value={text}
            onChange={(e) => setText(e.target.value)}
            helperText="微信只允许在对方最近一次互动后的 48 小时内回复"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)}>取消</Button>
          <Button variant="contained" disabled={!text.trim() || reply.isPending} onClick={() => reply.mutate()}>发送</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast} />
    </>
  );
}
