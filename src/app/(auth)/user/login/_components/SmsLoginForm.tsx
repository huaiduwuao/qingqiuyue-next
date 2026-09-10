'use client';

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { mobileLogin } from '@/apis/auth';
import { formatApiError } from '@/lib/api/client';
import { AuthTextField, SmsCodeField, SubmitButton } from './AuthFields';
import { mobileError, smsCodeError } from './validation';

/** 手机号 + 验证码登录;未注册的手机号自动注册。 */
export function SmsLoginForm({ onSession }: { onSession: (sessionId: string) => Promise<void> }) {
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = mobileError(mobile) ?? smsCodeError(code);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await mobileLogin({ mobile, code });
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
        label="手机号"
        value={mobile}
        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))}
        autoComplete="tel"
        slotProps={{ htmlInput: { inputMode: 'tel', maxLength: 11 } }}
      />
      <SmsCodeField mobile={mobile} type="login" value={code} onChange={setCode} onError={setError} />
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>未注册的手机号验证后将自动注册</Typography>
      <SubmitButton loading={loading} disabled={!mobile || !code}>
        登 录
      </SubmitButton>
    </Box>
  );
}
