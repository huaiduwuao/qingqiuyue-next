'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { formatApiError } from '@/lib/api/client';
import { getWxMpStatus, syncWxFollowers } from '@/apis/wx-mp';
import { WxMpConfigDialog } from './WxMpConfigDialog';

/**
 * 公众号四页(菜单 / 自动回复 / 消息 / 用户)顶部的接入状态。
 * 这四页的数据全部来自微信服务器的回调:没接通之前页面是空的并不是 bug,这里直接告诉运营还差哪一步。
 */
export function WxMpStatusBar({ showSync, invalidateKey }: { showSync?: boolean; invalidateKey?: unknown[] }) {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const q = useQuery({ queryKey: ['wx-mp-status'], queryFn: getWxMpStatus, staleTime: 60_000 });
  const sync = useMutation({
    mutationFn: syncWxFollowers,
    onSuccess: (r) => {
      setToast(`已同步 ${r?.synced ?? 0} 位关注者`);
      qc.invalidateQueries({ queryKey: ['wx-mp-status'] });
      if (invalidateKey) qc.invalidateQueries({ queryKey: invalidateKey });
      else qc.invalidateQueries();
    },
    onError: (e) => setToast(formatApiError(e) || '同步失败'),
  });
  const s = q.data;
  if (!s) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  let severity: 'success' | 'warning' | 'info' = 'success';
  let text: React.ReactNode;
  if (!s.configured) {
    severity = 'info';
    text = (
      <>
        还没有接入公众号。点右侧「接入配置」填写服务号的 AppID、AppSecret、Token(可选 EncodingAESKey),小程序在同一个对话框里配。
      </>
    );
  } else if (!s.tokenOK || !s.hasToken) {
    severity = 'warning';
    text = (
      <>
        {s.message || '微信配置里缺少 Token,服务器回调的验签会失败。'}
        {!s.hasToken && s.tokenOK && ' 请在「接入配置」里填写与公众号后台一致的 Token。'}
      </>
    );
  } else {
    text = (
      <>
        已接入公众号 <b>{s.appId}</b>
        {s.safeMode ? '(安全模式)' : '(明文模式)'} · 关注者 {s.followers ?? 0} 人
        {s.miniAppId ? <> · 小程序 <b>{s.miniAppId}</b></> : ' · 小程序未配置'}
        <Typography component="div" sx={{ fontSize: 12, mt: 0.5, opacity: 0.85 }}>
          公众号后台「服务器配置」的 URL 填:<code>{origin}{s.callbackPath}</code>
        </Typography>
      </>
    );
  }

  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 2 }}>
      <Alert
        severity={severity}
        action={
          <>
            {showSync && s.configured && s.tokenOK && (
              <Button variant="text" color="inherit" size="small" startIcon={<SyncRoundedIcon />} disabled={sync.isPending} onClick={() => sync.mutate()}>
                {sync.isPending ? '同步中…' : '同步关注者'}
              </Button>
            )}
            <Button variant="text" color="inherit" size="small" onClick={() => setConfigOpen(true)}>接入配置</Button>
          </>
        }
      >
        {text}
      </Alert>
      <WxMpConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}

export default WxMpStatusBar;
