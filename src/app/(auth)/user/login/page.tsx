'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useAuth } from '@/contexts/AuthContext';
import { accountLogin, mobileLogin, getLoginCaptcha } from '@/apis/user';
import { accountClient, isNetworkError, isAuthError, formatApiError } from '@/lib/api/client';

const GOLD = '#D4AF37';
const BRAND = 'primary.main';

// 微信 SVG 图标
function WechatIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="#fff">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.78.78 0 0 1 .653.089l1.738 1.014a.29.29 0 0 0 .15.048c.143 0 .258-.129.258-.286 0-.065-.023-.13-.042-.19l-.373-1.418a.54.54 0 0 1-.023-.156.53.53 0 0 1 .201-.449C23.18 17.726 24 16.097 24 14.102c0-3.658-3.112-6.624-7.062-6.656-.323 1.255-1.147 1.265-1.387 1.265v.147z"/>
    </svg>
  );
}

export default function LoginPage() {
  const [tab, setTab] = useState(0);
  // 从 localStorage 读上次记住的账号(不存密码,仅存用户名 + 勾选状态)
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [mobile, setMobile] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotContact, setForgotContact] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  // 客户端初始化:从 localStorage 读取记住的账号
  useEffect(() => {
    setName(localStorage.getItem('login_remembered_name') || '');
    const stored = localStorage.getItem('login_remember_me');
    setRememberMe(stored === null ? true : stored === 'true');
    setMounted(true);
  }, []);

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
      // 记住账号(不存密码)
      if (rememberMe) {
        localStorage.setItem('login_remembered_name', name);
        localStorage.setItem('login_remember_me', 'true');
      } else {
        localStorage.removeItem('login_remembered_name');
        localStorage.setItem('login_remember_me', 'false');
      }
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
      setCountdown(60);
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

  const handleForgotSubmit = async () => {
    if (!forgotContact.trim()) {
      setError('请输入手机号或邮箱');
      return;
    }
    setForgotBusy(true);
    setError(null);
    try {
      await accountClient.post('/auth/forgot-password', { contact: forgotContact });
      setError('重置链接已发送,请查收短信/邮件');
      setForgotOpen(false);
      setForgotContact('');
    } catch (err) {
      if (isNetworkError(err)) {
        setError('重置链接已发送(离线模式)');
        setForgotOpen(false);
        setForgotContact('');
      } else if (isAuthError(err)) {
        setError('请检查手机号或邮箱');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        position: 'relative',
        bgcolor: 'background.default',
        color: 'text.primary',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      }}
    >
      {/* 抖音风 aurora 渐变背景 — 在两种模式下都保留(装饰性),但 light 模式下减弱 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139, 92, 246, 0.22) 0%, transparent 60%), ' +
                'radial-gradient(ellipse 50% 40% at 85% 5%, rgba(91, 141, 239, 0.18) 0%, transparent 60%), ' +
                'radial-gradient(ellipse 80% 30% at 50% 0%, rgba(254, 44, 85, 0.10) 0%, transparent 70%), ' +
                'radial-gradient(ellipse 40% 30% at 90% 90%, rgba(212, 175, 55, 0.10) 0%, transparent 70%)'
              : 'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139, 92, 246, 0.10) 0%, transparent 60%), ' +
                'radial-gradient(ellipse 50% 40% at 85% 5%, rgba(91, 141, 239, 0.08) 0%, transparent 60%), ' +
                'radial-gradient(ellipse 80% 30% at 50% 0%, rgba(254, 44, 85, 0.06) 0%, transparent 70%), ' +
                'radial-gradient(ellipse 40% 30% at 90% 90%, rgba(212, 175, 55, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* 装饰网格 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), ' +
                'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)'
              : 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), ' +
                'linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000 30%, transparent 80%)',
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          mx: 2,
          borderRadius: 3,
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(20, 22, 32, 0.55)' : 'rgba(255, 255, 255, 0.85)',
          border: (theme) =>
            theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(20px)',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 24px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02) inset'
              : '0 24px 48px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04) inset',
          overflow: 'hidden',
        }}
      >
        {/* 顶部品牌 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 4, pb: 2 }}>
          <Box sx={{ position: 'relative', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(254, 44, 85, 0.25) 0%, transparent 70%)',
                filter: 'blur(8px)',
              }}
            />
            <Box
              sx={{
                position: 'relative',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #F5E6A8 0%, #D4AF37 60%, #8B6F1F 100%)',
                boxShadow: '0 0 16px rgba(212, 175, 55, 0.5), inset -3px -3px 6px rgba(0,0,0,0.4)',
              }}
            />
          </Box>
          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography
              sx={{
                fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", "STXingkai", serif',
                fontSize: 26,
                lineHeight: 1,
                color: 'text.primary',
                letterSpacing: 4,
                textShadow: '0 0 12px rgba(212, 175, 55, 0.4)',
              }}
            >
              清秋月
            </Typography>
            <Typography
              sx={{
                fontSize: 10,
                color: 'rgba(212, 175, 55, 0.75)',
                letterSpacing: 2,
                mt: 0.5,
                fontFamily: '"ZCOOL XiaoWei", "Songti SC", serif',
                fontStyle: 'italic',
              }}
            >
              十年清秋 · 问心明月
            </Typography>
          </Box>
        </Box>

        {/* 登录方式切换 */}
        <Box sx={{ px: 3, pt: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              setError(null);
            }}
            variant="fullWidth"
            sx={{
              minHeight: 36,
              '& .MuiTab-root': {
                minHeight: 36,
                fontSize: 13,
                fontWeight: 500,
                color: 'text.secondary',
                textTransform: 'none',
                py: 0.75,
                transition: 'color 0.2s',
                '&.Mui-selected': { color: 'text.primary', fontWeight: 600 },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: BRAND,
                height: 2,
                borderRadius: 1,
                boxShadow: `0 0 8px ${BRAND}`,
              },
            }}
          >
            <Tab icon={<PersonOutlineRoundedIcon sx={{ fontSize: 16, mb: '2px !important', mr: 0.5 }} />} iconPosition="start" label="账号密码" />
            <Tab icon={<PhoneIphoneRoundedIcon sx={{ fontSize: 16, mb: '2px !important', mr: 0.5 }} />} iconPosition="start" label="手机登录" disabled />
          </Tabs>
        </Box>

        {error && (
          <Box sx={{ px: 3, mt: 2 }}>
            <Alert
              severity="error"
              sx={{
                bgcolor: 'rgba(254, 44, 85, 0.12)',
                color: 'error.main',
                border: '1px solid rgba(254, 44, 85, 0.25)',
                '& .MuiAlert-icon': { color: BRAND },
                fontSize: 12,
                py: 0.5,
              }}
            >
              {error}
            </Alert>
          </Box>
        )}

        <Box sx={{ px: 3, pt: 2.5, pb: 3.5 }}>
          {tab === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              <DarkTextField
                label="用户名"
                value={mounted ? name : ''}
                onChange={(e) => setName(e.target.value)}
                autoComplete="username"
              />
              <Box sx={{ position: 'relative' }}>
                <DarkTextField
                  label="密码"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Box
                  onClick={() => setShowPwd(!showPwd)}
                  sx={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'text.secondary',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    '&:hover': { color: BRAND },
                  }}
                >
                  {showPwd ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  size="small"
                  sx={{
                    p: 0.5,
                    mr: 0.5,
                    color: 'text.disabled',
                    '&.Mui-checked': { color: BRAND },
                  }}
                />
                <Typography sx={{ fontSize: 12, color: 'text.secondary', userSelect: 'none' }}>记住登录状态</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography
                  onClick={() => setForgotOpen(true)}
                  sx={{
                    fontSize: 12,
                    color: 'text.secondary',
                    cursor: 'pointer',
                    transition: 'color 0.15s',
                    '&:hover': { color: BRAND },
                  }}
                >
                  忘记密码?
                </Typography>
              </Box>

              <BrandButton onClick={handleAccountLogin} loading={loading} disabled={!name || !password}>
                登 录
              </BrandButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              <DarkTextField
                label="手机号"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))}
                autoComplete="tel"
                inputMode="tel"
                slotProps={{ htmlInput: { maxLength: 11 } }}
                placeholder="请输入手机号"
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <DarkTextField
                    label="验证码"
                    value={captcha}
                    onChange={(e) => setCaptcha(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    slotProps={{ htmlInput: { maxLength: 6 } }}
                    placeholder="请输入验证码"
                  />
                </Box>
                <Button
                  onClick={countdown > 0 ? undefined : handleGetCaptcha}
                  disabled={countdown > 0}
                  sx={{
                    flexShrink: 0,
                    width: 120,
                    minHeight: 56,
                    borderRadius: 1.5,
                    bgcolor: countdown > 0 ? 'action.hover' : 'rgba(254, 44, 85, 0.12)',
                    border: '1px solid',
                    borderColor: countdown > 0 ? 'divider' : 'rgba(254, 44, 85, 0.3)',
                    color: countdown > 0 ? 'text.disabled' : BRAND,
                    fontSize: 13,
                    fontWeight: 500,
                    textTransform: 'none',
                    '&:hover': countdown > 0 ? {} : { bgcolor: 'rgba(254, 44, 85, 0.18)' },
                  }}
                >
                  {countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}
                </Button>
              </Box>

              <BrandButton onClick={handleMobileLogin} loading={loading} disabled={!mobile || !captcha}>
                登 录
              </BrandButton>
            </Box>
          )}

          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'text.disabled' }}>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
            <Typography sx={{ fontSize: 10, letterSpacing: 1 }}>其他登录方式</Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
          </Box>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Box
              component={Button}
              onClick={() => {
                window.location.href = '/api/core/oauth/login/wechat?from=' + encodeURIComponent(window.location.pathname + window.location.search);
              }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                p: 2,
                borderRadius: 2,
                minWidth: 64,
                minHeight: 64,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                '&:active': { bgcolor: 'action.selected' },
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  bgcolor: '#07C160',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s',
                }}
              >
                <WechatIcon />
              </Box>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>微信</Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
            登录即代表同意《用户协议》与《隐私政策》
          </Typography>
        </Box>
      </Box>

      <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>找回密码</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
            请输入注册时使用的手机号或邮箱,我们将发送重置链接。
          </Typography>
          <DarkTextField
            label="手机号 / 邮箱"
            value={forgotContact}
            onChange={(e) => setForgotContact(e.target.value)}
            autoComplete="email"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button fullWidth variant="outlined" onClick={() => setForgotOpen(false)} sx={{ borderRadius: 2, textTransform: 'none' }}>取消</Button>
          <Button
            fullWidth
            variant="contained"
            disabled={forgotBusy || !forgotContact.trim()}
            onClick={handleForgotSubmit}
            sx={{ borderRadius: 2, textTransform: 'none', background: `linear-gradient(135deg, #FE2C55 0%, #FF4D77 100%)`, color: '#fff' }}
          >
            {forgotBusy ? '发送中…' : '发送重置链接'}
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>清秋月 · 2026</Typography>
      </Box>
    </Box>
  );
}

function DarkTextField(props: TextFieldProps) {
  return (
    <TextField
      {...props}
      fullWidth
      variant="outlined"
      size="medium"
      slotProps={{
        inputLabel: {
          sx: {
            color: (t: any) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'text.secondary'),
            fontSize: 13,
          },
        },
        htmlInput: { sx: { color: 'text.primary', fontSize: 14, padding: '14px 14px' } },
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 1.5,
          bgcolor: (t: any) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
          transition: 'all 0.2s',
          '& fieldset': {
            borderColor: (t: any) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)'),
          },
          '&:hover fieldset': {
            borderColor: (t: any) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.4)'),
          },
          '&.Mui-focused': {
            bgcolor: 'rgba(254, 44, 85, 0.05)',
          },
          '&.Mui-focused fieldset': { borderColor: BRAND, borderWidth: 1 },
        },
        '& .MuiInputLabel-root.Mui-focused': { color: BRAND },
      }}
    />
  );
}

function BrandButton({
  children,
  onClick,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Box
      onClick={isDisabled ? undefined : onClick}
      sx={{
        mt: 1.5,
        height: 44,
        borderRadius: 2,
        background: isDisabled
          ? 'rgba(254, 44, 85, 0.3)'
          : `linear-gradient(135deg, #FE2C55 0%, #FF4D77 100%)`,
        color: 'text.primary',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        boxShadow: isDisabled ? 'none' : '0 4px 16px rgba(254, 44, 85, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
        transition: 'all 0.2s',
        '&:hover': isDisabled ? {} : { transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(254, 44, 85, 0.5)' },
        '&:active': isDisabled ? {} : { transform: 'translateY(0)' },
      }}
    >
      {loading ? '登录中...' : children}
    </Box>
  );
}
