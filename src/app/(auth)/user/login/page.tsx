'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useAuth } from '@/contexts/AuthContext';
import { accountLogin, mobileLogin, getLoginCaptcha } from '@/apis/user';

const GOLD = '#D4AF37';
const BRAND = 'primary.main';

export default function LoginPage() {
  const [tab, setTab] = useState(0);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
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
      {/* 抖音风 aurora 渐变背景 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139, 92, 246, 0.22) 0%, transparent 60%), ' +
            'radial-gradient(ellipse 50% 40% at 85% 5%, rgba(91, 141, 239, 0.18) 0%, transparent 60%), ' +
            'radial-gradient(ellipse 80% 30% at 50% 0%, rgba(254, 44, 85, 0.10) 0%, transparent 70%), ' +
            'radial-gradient(ellipse 40% 30% at 90% 90%, rgba(212, 175, 55, 0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* 装饰网格 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
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
          bgcolor: 'rgba(20, 22, 32, 0.55)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02) inset',
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
                color: 'rgba(255,255,255,0.5)',
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
            <Tab icon={<PhoneIphoneRoundedIcon sx={{ fontSize: 16, mb: '2px !important', mr: 0.5 }} />} iconPosition="start" label="手机号登录" />
          </Tabs>
        </Box>

        {error && (
          <Box sx={{ px: 3, mt: 2 }}>
            <Alert
              severity="error"
              sx={{
                bgcolor: 'rgba(254, 44, 85, 0.12)',
                color: '#FFB4C0',
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
                value={name}
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
                    color: 'rgba(255,255,255,0.4)',
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
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                  size="small"
                  sx={{
                    p: 0.5,
                    mr: 0.5,
                    color: 'rgba(255,255,255,0.3)',
                    '&.Mui-checked': { color: BRAND },
                  }}
                />
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', userSelect: 'none' }}>记住登录状态</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography
                  sx={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.4)',
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
                onChange={(e) => setMobile(e.target.value)}
                autoComplete="tel"
                inputMode="numeric"
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <DarkTextField
                    label="验证码"
                    value={captcha}
                    onChange={(e) => setCaptcha(e.target.value)}
                    inputMode="numeric"
                  />
                </Box>
                <Box
                  onClick={countdown > 0 ? undefined : handleGetCaptcha}
                  sx={{
                    flexShrink: 0,
                    width: 120,
                    height: 56,
                    borderRadius: 1.5,
                    bgcolor: countdown > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(254, 44, 85, 0.12)',
                    border: '1px solid',
                    borderColor: countdown > 0 ? 'rgba(255,255,255,0.06)' : 'rgba(254, 44, 85, 0.3)',
                    color: countdown > 0 ? 'rgba(255,255,255,0.3)' : BRAND,
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': countdown > 0 ? {} : { bgcolor: 'rgba(254, 44, 85, 0.18)' },
                  }}
                >
                  {countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}
                </Box>
              </Box>

              <BrandButton onClick={handleMobileLogin} loading={loading} disabled={!mobile || !captcha}>
                登 录
              </BrandButton>
            </Box>
          )}

          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.3)' }}>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
            <Typography sx={{ fontSize: 10, letterSpacing: 1 }}>其他登录方式</Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
          </Box>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 3 }}>
            {[
              { name: '微信', bg: '#07C160' },
              { name: 'QQ', bg: '#1296DB' },
              { name: '微博', bg: '#E6162D' },
            ].map((s) => (
              <Box key={s.name} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: s.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    transition: 'transform 0.15s',
                    '&:hover': { transform: 'scale(1.1)' },
                  }}
                >
                  {s.name[0]}
                </Box>
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{s.name}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ py: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            登录即代表同意《用户协议》与《隐私政策》
          </Typography>
        </Box>
      </Box>

      <Box sx={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>清秋月 · 2026</Typography>
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
        inputLabel: { sx: { color: 'rgba(255,255,255,0.5)', fontSize: 13 } },
        htmlInput: { sx: { color: 'text.primary', fontSize: 14, padding: '14px 14px' } },
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 1.5,
          bgcolor: 'rgba(255,255,255,0.03)',
          transition: 'all 0.2s',
          '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
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
