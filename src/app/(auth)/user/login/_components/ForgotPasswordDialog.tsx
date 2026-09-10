'use client';

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { resetPassword } from '@/apis/auth';
import { formatApiError } from '@/lib/api/client';
import { AuthTextField, PasswordField, SmsCodeField, SubmitButton } from './AuthFields';
import { mobileError, passwordError, smsCodeError } from './validation';

/**
 * 手机号验证码重置密码。此前这里调用一个不存在的接口,网络失败时还提示"重置链接已发送(离线模式)"。
 */
export function ForgotPasswordDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = mobileError(mobile) ?? smsCodeError(code) ?? passwordError(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword({ mobile, code, password });
      onDone();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>找回密码</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={submit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <AuthTextField
            label="注册手机号"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))}
            autoComplete="tel"
            slotProps={{ htmlInput: { inputMode: 'tel', maxLength: 11 } }}
          />
          <SmsCodeField mobile={mobile} type="reset" value={code} onChange={setCode} onError={setError} />
          <PasswordField label="新密码" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <PasswordField label="确认新密码" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          <SubmitButton loading={loading}>重置密码</SubmitButton>
          <Button onClick={onClose} sx={{ textTransform: 'none' }}>
            取消
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
