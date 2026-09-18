'use client';

import React, { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import { accountLogin } from '@/apis/user';
import { formatApiError } from '@/lib/api/client';
import { AuthTextField, PasswordField, SubmitButton } from './AuthFields';

const REMEMBERED_NAME_KEY = 'login_remembered_name';

/** 账号密码登录。"记住账号"只记用户名,不存密码。 */
export function PasswordLoginForm({
  onSession,
  onForgot,
}: {
  onSession: (sessionId: string) => Promise<void>;
  /** 找回密码入口;短信服务未开通时不传,改为提示联系客服。 */
  onForgot?: () => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_NAME_KEY);
      if (saved) setName(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await accountLogin({ name: name.trim(), password });
      try {
        if (remember) localStorage.setItem(REMEMBERED_NAME_KEY, name.trim());
        else localStorage.removeItem(REMEMBERED_NAME_KEY);
      } catch {
        /* ignore */
      }
      await onSession(res.session_id);
    } catch (err) {
      setError(formatApiError(err));
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <AuthTextField label="用户名" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" />
      <PasswordField
        label="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <FormControlLabel
          control={<Checkbox size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
          label="记住账号"
          slotProps={{ typography: { sx: { fontSize: 12, color: 'text.secondary' } } }}
        />
        {onForgot ? (
          <Link component="button" type="button" underline="hover" onClick={onForgot} sx={{ fontSize: 12 }}>
            忘记密码?
          </Link>
        ) : (
          <Link href="/kf-chat" underline="hover" sx={{ fontSize: 12 }}>
            忘记密码?联系客服
          </Link>
        )}
      </Box>
      <SubmitButton loading={loading} disabled={!name || !password}>
        登 录
      </SubmitButton>
    </Box>
  );
}
