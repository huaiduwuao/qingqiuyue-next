'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { sendSmsCode, type SmsType } from '@/apis/auth';
import { formatApiError } from '@/lib/api/client';
import { SMS_CODE_LENGTH, mobileError } from './validation';

const BRAND_GRADIENT = 'linear-gradient(135deg, #FE2C55 0%, #FF4D77 100%)';

/** 登录页统一输入框样式(深浅色两套)。 */
export function AuthTextField({ slotProps, sx, ...props }: TextFieldProps) {
  return (
    <TextField
      fullWidth
      variant="outlined"
      {...props}
      slotProps={{
        ...slotProps,
        inputLabel: { sx: { fontSize: 13 }, ...(slotProps?.inputLabel as object) },
        htmlInput: { sx: { fontSize: 14 }, ...(slotProps?.htmlInput as object) },
      }}
      sx={[
        {
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
            '&.Mui-focused': { bgcolor: 'rgba(254, 44, 85, 0.05)' },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}

/** 带显示/隐藏切换的密码框(切换按钮是真按钮,键盘可达)。 */
export function PasswordField(props: TextFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <AuthTextField
      {...props}
      type={visible ? 'text' : 'password'}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                size="small"
                aria-label={visible ? '隐藏密码' : '显示密码'}
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

/** 表单提交按钮:type="submit",回车即可提交。 */
export function SubmitButton({ loading, disabled, children }: { loading?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button
      type="submit"
      fullWidth
      variant="contained"
      disabled={disabled || loading}
      sx={{
        mt: 1,
        height: 44,
        borderRadius: 2,
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 2,
        color: '#fff',
        background: BRAND_GRADIENT,
        boxShadow: '0 4px 16px rgba(254, 44, 85, 0.35)',
        '&:hover': { background: BRAND_GRADIENT, boxShadow: '0 6px 20px rgba(254, 44, 85, 0.5)' },
        '&.Mui-disabled': { background: 'rgba(254, 44, 85, 0.3)', color: 'rgba(255,255,255,0.8)' },
      }}
    >
      {loading ? '请稍候…' : children}
    </Button>
  );
}

const RESEND_SECONDS = 60;

/** 手机号验证码输入 + 发送按钮(带重发倒计时)。发送失败通过 onError 抛给表单。 */
export function SmsCodeField({
  mobile,
  type,
  value,
  onChange,
  onError,
}: {
  mobile: string;
  type: SmsType;
  value: string;
  onChange: (code: string) => void;
  onError: (message: string | null) => void;
}) {
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const send = async () => {
    const err = mobileError(mobile);
    if (err) {
      onError(err);
      return;
    }
    setSending(true);
    onError(null);
    try {
      await sendSmsCode({ mobile, type });
      setCountdown(RESEND_SECONDS);
    } catch (e) {
      onError(formatApiError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <AuthTextField
        label="验证码"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, SMS_CODE_LENGTH))}
        autoComplete="one-time-code"
        slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: SMS_CODE_LENGTH } }}
      />
      <Button
        variant="outlined"
        onClick={send}
        disabled={countdown > 0 || sending}
        sx={{ flexShrink: 0, width: 120, borderRadius: 1.5, textTransform: 'none' }}
      >
        {countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中…' : '获取验证码'}
      </Button>
    </Box>
  );
}
