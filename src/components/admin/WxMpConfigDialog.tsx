'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { formatApiError } from '@/lib/api/client';
import { getWxMpConfig, saveWxMpConfig, type WxAppKind } from '@/apis/wx-mp';

/**
 * 公众号 / 小程序的接入配置(wx_config 里 type = mp / ma 的那一行)。
 * 密钥只进不出:已保存的 AppSecret / Token / EncodingAESKey 不回显,留空表示不改。
 */
export function WxMpConfigDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<WxAppKind>('mp');
  const [form, setForm] = useState({ appId: '', appSecret: '', token: '', aesKey: '' });
  const q = useQuery({ queryKey: ['wx-mp-config'], queryFn: getWxMpConfig, enabled: open });
  const cur = q.data?.[kind];

  useEffect(() => {
    setForm({ appId: cur?.appId ?? '', appSecret: '', token: '', aesKey: '' });
  }, [kind, cur?.appId, open]);

  const save = useMutation({
    mutationFn: () => saveWxMpConfig({ type: kind, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wx-mp-config'] });
      qc.invalidateQueries({ queryKey: ['wx-mp-status'] });
      setForm((f) => ({ ...f, appSecret: '', token: '', aesKey: '' }));
    },
  });

  const secretHint = (has?: boolean) => (has ? '已保存,留空表示不修改' : '尚未填写');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>微信接入配置</DialogTitle>
      <DialogContent>
        <Tabs value={kind} onChange={(_, v) => setKind(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="mp" label="公众号(服务号)" />
          <Tab value="ma" label="小程序" />
        </Tabs>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="AppID" size="small" value={form.appId} onChange={(e) => setForm({ ...form, appId: e.target.value })} placeholder="wx 开头的 18 位" />
          <TextField
            label="AppSecret"
            size="small"
            type="password"
            autoComplete="new-password"
            value={form.appSecret}
            onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
            helperText={secretHint(cur?.hasSecret)}
          />
          {kind === 'mp' && (
            <>
              <TextField
                label="Token(令牌)"
                size="small"
                type="password"
                autoComplete="new-password"
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                helperText={`与公众号后台「服务器配置」里填的一致 · ${secretHint(cur?.hasToken)}`}
              />
              <TextField
                label="EncodingAESKey(可选,43 位)"
                size="small"
                type="password"
                autoComplete="new-password"
                value={form.aesKey}
                onChange={(e) => setForm({ ...form, aesKey: e.target.value })}
                helperText={`填了才能用「安全模式」;明文模式不需要 · ${secretHint(cur?.hasAesKey)}`}
              />
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                公众号后台「设置与开发 → 基本配置 → 服务器配置」的 URL 填:<code>{origin}/api/core/wx/mp/callback</code>;
                同一页的「IP 白名单」要加上服务器的出口 IP,否则换不到 access_token。
              </Typography>
            </>
          )}
          {kind === 'ma' && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              小程序要和公众号、网站应用绑定到同一个微信开放平台账号,三个入口的 unionid 才相同 ——
              否则同一个微信在小程序里登录会变成一个新的站内账号。
            </Typography>
          )}
          {save.isError && <Alert severity="error">{formatApiError(save.error)}</Alert>}
          {save.isSuccess && <Alert severity="success">已保存</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>关闭</Button>
        <Button variant="contained" disabled={!form.appId.trim() || save.isPending} onClick={() => save.mutate()}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

export default WxMpConfigDialog;
