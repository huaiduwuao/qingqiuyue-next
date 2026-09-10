'use client';

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { register } from '@/apis/auth';
import { formatApiError } from '@/lib/api/client';
import { AuthTextField, PasswordField, SubmitButton } from './AuthFields';
import { PASSWORD_MIN, passwordError, usernameError } from './validation';

/** 用户名 + 密码注册,成功即登录。 */
export function RegisterForm({ onSession }: { onSession: (sessionId: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = usernameError(name) ?? passwordError(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await register({ name: name.trim(), password, nickname: nickname.trim() || undefined });
      await onSession(res.data.session_id);
    } catch (err) {
      setError(formatApiError(err));
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <AuthTextField
        label="用户名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="username"
        helperText="4-20 位字母、数字或下划线,以字母开头"
      />
      <AuthTextField
        label="昵称(选填)"
        value={nickname}
        onChange={(e) => setNickname(e.target.value.slice(0, 20))}
        autoComplete="nickname"
      />
      <PasswordField
        label="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        helperText={`至少 ${PASSWORD_MIN} 位`}
      />
      <PasswordField
        label="确认密码"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
      />
      <SubmitButton loading={loading} disabled={!name || !password || !confirm}>
        注册并登录
      </SubmitButton>
    </Box>
  );
}
