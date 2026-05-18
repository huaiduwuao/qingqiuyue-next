'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PhoneIcon from '@mui/icons-material/Phone';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { accountLogin, mobileLogin, getLoginCaptcha } from '@/apis/user';

export default function LoginPage() {
  const [tab, setTab] = useState(0);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();
  const { login } = useAuth();

  const handleAccountLogin = async () => {
    if (!name || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await accountLogin({ name, password });
      login(res.data.token);
      router.push('/home/recommend');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGetCaptcha = async () => {
    if (!mobile || !/^1\d{10}$/.test(mobile)) {
      setError('请输入正确的手机号');
      return;
    }
    setCaptchaLoading(true);
    try {
      await getLoginCaptcha({ mobile });
      setCountdown(299);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || '获取验证码失败');
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleMobileLogin = async () => {
    if (!mobile || !captcha) {
      setError('请输入手机号和验证码');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await mobileLogin({ mobile, captcha });
      login(res.data.token);
      router.push('/home/recommend');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage:
          "url('https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/V-_oS6r-i7wAAAAAAAAAAAAAFl94AQBr')",
        backgroundSize: '100% 100%',
      }}
    >
      <Container maxWidth="xs">
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
              <LockOutlinedIcon />
            </Avatar>
            <Typography component="h1" variant="h5">
              清秋月
            </Typography>
          </Box>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} centered sx={{ mt: 2 }}>
            <Tab label="账户密码登录" />
            <Tab label="手机号登录" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {tab === 0 && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="用户名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                margin="normal"
                autoComplete="username"
              />
              <TextField
                fullWidth
                label="密码"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                autoComplete="current-password"
              />
              <FormControlLabel
                control={
                  <Checkbox checked={autoLogin} onChange={(e) => setAutoLogin(e.target.checked)} />
                }
                label="自动登录"
                sx={{ mt: 1 }}
              />
              <Button
                fullWidth
                variant="contained"
                onClick={handleAccountLogin}
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </Box>
          )}

          {tab === 1 && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="手机号"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                margin="normal"
                autoComplete="tel"
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="验证码"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  margin="normal"
                />
                <Button
                  variant="outlined"
                  onClick={handleGetCaptcha}
                  disabled={captchaLoading || countdown > 0}
                  sx={{ mt: 1, minWidth: 120 }}
                >
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </Button>
              </Box>
              <Button
                fullWidth
                variant="contained"
                onClick={handleMobileLogin}
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
