'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded';
import DoNotDisturbRoundedIcon from '@mui/icons-material/DoNotDisturbRounded';
import { useApp } from '@/contexts/AppContext';
import type { CurrentUser } from '@/beans/account';
import { updateUser, upload } from '@/apis/account';
import { sendSmsCode, verifySmsCode } from '@/apis/user';
import { formatApiError } from '@/lib/api/client';
import { LoginGate } from '@/components/auth/LoginGate';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { currentUser } = useApp();
  const [tab, setTab] = useState(0);
  const [formValues, setFormValues] = useState({
    name: currentUser?.name || '',
    nickname: currentUser?.nickname || '',
    info: currentUser?.info || '',
    avatar: currentUser?.avatar || '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [wechatOpen, setWechatOpen] = useState(false);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await upload(formData);
      showMessage('头像上传成功');
    } catch (err) {
      showMessage(formatApiError(err) ||'上传失败', 'error');
    }
  };

  const handleSubmit = async () => {
    try {
      await updateUser(formValues);
      showMessage('保存成功');
    } catch (err) {
      showMessage(formatApiError(err) ||'保存失败', 'error');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ height: '100dvh', overflow: 'auto', overscrollBehavior: 'contain', px: { xs: 1.5, md: 3 } }}>
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 3 }}>设置</Typography>
        <LoginGate mode="replace" message="登录后查看设置">
        <Card>
          <CardContent>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 3 }}>
              <Tab label="基本设置" />
              <Tab label="安全设置" />
              <Tab label="账号绑定" />
              <Tab label="通知设置" />
            </Tabs>

            <TabPanel value={tab} index={0}>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box sx={{ flex: 1, maxWidth: { xs: '100%', md: 500 } }}>
                  <Box sx={{ mb: 3 }}>
                    <TextField
                      fullWidth
                      label="用户名"
                      value={formValues.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      helperText="用户名长度3-20位"
                    />
                  </Box>
                  <Box sx={{ mb: 3 }}>
                    <TextField
                      fullWidth
                      label="昵称"
                      value={formValues.nickname}
                      onChange={(e) => handleChange('nickname', e.target.value)}
                    />
                  </Box>
                  <Box sx={{ mb: 3 }}>
                    <TextField
                      fullWidth
                      label="个人简介"
                      multiline
                      rows={3}
                      value={formValues.info}
                      onChange={(e) => handleChange('info', e.target.value)}
                    />
                  </Box>
                  <Button variant="contained" onClick={handleSubmit}>
                    保存
                  </Button>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>头像</Typography>
                  <Avatar
                    src={currentUser?.avatar || '/no_avatar.webp'}
                    sx={{ width: 100, height: 100, mb: 2 }}
                  />
                  <Button variant="outlined" component="label">
                    上传头像
                    <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={tab} index={1}>
              <Box sx={{ maxWidth: { xs: '100%', md: 500 } }}>
                <Typography variant="h6" sx={{ mb: 2 }}>安全设置</Typography>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2">修改密码</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    定期修改密码可以提高账号安全性
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 1 }} onClick={() => setPasswordOpen(true)}>
                    修改密码
                  </Button>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2">绑定手机</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    已绑定: {currentUser?.phone || currentUser?.mobile || '未绑定'}
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 1 }} onClick={() => setPhoneOpen(true)}>
                    {currentUser?.phone || currentUser?.mobile ? '更换手机' : '绑定手机'}
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={tab} index={2}>
              <Box sx={{ maxWidth: { xs: '100%', md: 500 } }}>
                <Typography variant="h6" sx={{ mb: 2 }}>账号绑定</Typography>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2">微信</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    绑定微信后可快速登录
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 1 }} onClick={() => setWechatOpen(true)}>
                    绑定微信
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={tab} index={3}>
              <NotificationSettingsPanel onSaved={(msg, severity) => showMessage(msg, severity ?? 'success')} />
            </TabPanel>
          </CardContent>
        </Card>
        </LoginGate>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <PasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onSaved={(msg, severity) => showMessage(msg, severity ?? 'success')}
      />
      <PhoneDialog
        key={phoneOpen ? 'open' : 'closed'}
        open={phoneOpen}
        onClose={() => setPhoneOpen(false)}
        currentUser={currentUser}
        onSaved={(msg, severity) => showMessage(msg, severity ?? 'success')}
      />
      <WechatDialog
        open={wechatOpen}
        onClose={() => setWechatOpen(false)}
        onSaved={(msg, severity) => showMessage(msg, severity ?? 'success')}
      />
    </Container>
  );
}

// ─── 修改密码对话框 ───
function PasswordDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (msg: string, severity?: 'success' | 'error') => void;
}) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!oldPassword) {
      onSaved('请输入原密码', 'error');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      onSaved('新密码至少 6 位', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      onSaved('两次输入的新密码不一致', 'error');
      return;
    }
    setLoading(true);
    try {
      await updateUser({ oldPassword, password: newPassword });
      onSaved('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      onSaved(formatApiError(err) ||'密码修改失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>修改密码</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            fullWidth
            type="password"
            label="原密码"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <TextField
            fullWidth
            type="password"
            label="新密码"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="至少 6 位"
          />
          <TextField
            fullWidth
            type="password"
            label="确认新密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>取消</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── 绑定/更换手机对话框 ───
function PhoneDialog({
  open,
  onClose,
  currentUser,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  currentUser: CurrentUser | null;
  onSaved: (msg: string, severity?: 'success' | 'error') => void;
}) {
  const [phone, setPhone] = useState(currentUser?.mobile || currentUser?.phone || '');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      onSaved('请输入正确的手机号', 'error');
      return;
    }
    setSending(true);
    try {
      await sendSmsCode({ mobile: phone, type: 'bind' });
      setCountdown(60);
      onSaved('验证码已发送');
    } catch (err) {
      onSaved(formatApiError(err) ||'验证码发送失败', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      onSaved('请输入正确的手机号', 'error');
      return;
    }
    if (!/^\d{4,6}$/.test(code)) {
      onSaved('请输入有效的验证码', 'error');
      return;
    }
    setLoading(true);
    try {
      await verifySmsCode({ mobile: phone, code, type: 'bind' });
      await updateUser({ mobile: phone });
      onSaved('手机号绑定成功');
      setCode('');
      onClose();
    } catch (err) {
      onSaved(formatApiError(err) ||'手机号绑定失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{currentUser?.mobile || currentUser?.phone ? '更换手机' : '绑定手机'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            fullWidth
            label="手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
            helperText="请输入 11 位手机号"
          />
          <TextField
            fullWidth
            label="验证码"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      size="small"
                      onClick={handleSendCode}
                      disabled={sending || countdown > 0}
                    >
                      {countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码'}
                    </Button>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>取消</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
        >
          确认
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── 绑定微信对话框 ───
function WechatDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (msg: string, severity?: 'success' | 'error') => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleBind = async () => {
    setLoading(true);
    try {
      await updateUser({ wechatOpenid: `wx_${Date.now()}` } as Record<string, unknown>);
      onSaved('微信绑定成功');
      onClose();
    } catch (err) {
      onSaved(formatApiError(err) ||'微信绑定失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>绑定微信</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, textAlign: 'center' }}>
          <Box
            sx={{
              width: 180,
              height: 180,
              mx: 'auto',
              mb: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed',
              borderColor: 'divider',
            }}
          >
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              微信扫码授权占位
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            请在微信中完成授权后点击下方按钮
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>取消</Button>
        <Button
          variant="contained"
          onClick={handleBind}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
        >
          我已完成授权
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── 通知设置面板 ───
const NOTIF_TYPES: { key: string; label: string; description: string; icon: React.ReactNode }[] = [
  { key: 'mention', label: '@ 我的', description: '有人 @ 你或回复你时会通知', icon: <AlternateEmailRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'comment', label: '评论与回复', description: '你发布的作品有新评论时通知', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'like', label: '点赞', description: '你发布的作品被点赞时通知', icon: <FavoriteBorderRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'follow', label: '新增粉丝', description: '有人关注你时通知', icon: <PersonAddRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'live', label: '直播开播', description: '你关注的主播开播时通知', icon: <LiveTvRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'update', label: '作者更新', description: '你关注的内容更新时通知', icon: <VideoLibraryRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'system', label: '系统通知', description: '平台公告与安全提醒', icon: <CampaignRoundedIcon sx={{ fontSize: 18 }} /> },
];

const DEFAULT_NOTIF_CHANNELS = { push: true, email: false, inApp: true };
const DEFAULT_NOTIF_TYPES = {
  mention: true, comment: true, like: false, follow: true, live: true, update: false, system: true,
};

function NotificationSettingsPanel({
  onSaved,
}: {
  onSaved: (msg: string, severity?: 'success' | 'error') => void;
}) {
  const STORAGE_KEY = 'account-notif-settings';
  const [channels, setChannels] = useState(DEFAULT_NOTIF_CHANNELS);
  const [types, setTypes] = useState<Record<string, boolean>>(DEFAULT_NOTIF_TYPES);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndFrom, setDndFrom] = useState('22:00');
  const [dndTo, setDndTo] = useState('08:00');
  const [loaded, setLoaded] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const data = JSON.parse(raw);
        if (data.channels) setChannels(data.channels);
        if (data.types) setTypes((prev) => ({ ...prev, ...data.types }));
        if (typeof data.dndEnabled === 'boolean') setDndEnabled(data.dndEnabled);
        if (typeof data.dndFrom === 'string') setDndFrom(data.dndFrom);
        if (typeof data.dndTo === 'string') setDndTo(data.dndTo);
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleType = (key: string) => setTypes((p) => ({ ...p, [key]: !p[key] }));
  const toggleChannel = (key: 'push' | 'email' | 'inApp') => setChannels((p) => ({ ...p, [key]: !p[key] }));

  const persist = async (payload: {
    channels: typeof DEFAULT_NOTIF_CHANNELS;
    types: Record<string, boolean>;
    dndEnabled: boolean;
    dndFrom: string;
    dndTo: string;
  }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      onSaved('本地保存失败,请重试', 'error');
      return;
    }
    try {
      await updateUser({ notificationSettings: payload } as Record<string, unknown>);
      onSaved('通知偏好已保存');
    } catch (err) {
      onSaved(formatApiError(err) ||'通知设置同步失败', 'error');
    }
  };

  const handleSave = () => {
    persist({ channels, types, dndEnabled, dndFrom, dndTo });
  };

  const handleReset = () => {
    setChannels(DEFAULT_NOTIF_CHANNELS);
    setTypes(DEFAULT_NOTIF_TYPES);
    setDndEnabled(false);
    setDndFrom('22:00');
    setDndTo('08:00');
    persist({
      channels: DEFAULT_NOTIF_CHANNELS,
      types: DEFAULT_NOTIF_TYPES,
      dndEnabled: false,
      dndFrom: '22:00',
      dndTo: '08:00',
    });
  };

  if (!loaded) return null;

  return (
    <Box sx={{ maxWidth: { xs: '100%', md: 640 } }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>通知设置</Typography>
      <Typography color="text.secondary" sx={{ fontSize: 13, mb: 3 }}>
        选择你关心的通知类型与接收方式
      </Typography>

      <Box sx={{ p: 2, mb: 2, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
          <NotificationsRoundedIcon color="primary" sx={{ fontSize: 18 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>通知渠道</Typography>
        </Stack>
        <Stack spacing={0.5}>
          <FormControlLabel
            control={<Switch checked={channels.push} onChange={() => toggleChannel('push')} />}
            label={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <PhoneIphoneRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Box>
                  <Typography sx={{ fontSize: 13 }}>手机推送</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>通过 App 推送通知</Typography>
                </Box>
              </Stack>
            }
            sx={{ m: 0, justifyContent: 'space-between', width: '100%' }}
            labelPlacement="start"
          />
          <FormControlLabel
            control={<Switch checked={channels.email} onChange={() => toggleChannel('email')} />}
            label={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <EmailRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Box>
                  <Typography sx={{ fontSize: 13 }}>邮件通知</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>发送至你的注册邮箱</Typography>
                </Box>
              </Stack>
            }
            sx={{ m: 0, justifyContent: 'space-between', width: '100%' }}
            labelPlacement="start"
          />
          <FormControlLabel
            control={<Switch checked={channels.inApp} onChange={() => toggleChannel('inApp')} />}
            label={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <NotificationsRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Box>
                  <Typography sx={{ fontSize: 13 }}>站内消息</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>在 App 内显示小红点</Typography>
                </Box>
              </Stack>
            }
            sx={{ m: 0, justifyContent: 'space-between', width: '100%' }}
            labelPlacement="start"
          />
        </Stack>
      </Box>

      <Box sx={{ p: 2, mb: 2, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>通知类型</Typography>
        <Stack divider={<Divider flexItem />}>
          {NOTIF_TYPES.map((t) => (
            <Box key={t.key} sx={{ display: 'flex', alignItems: 'center', py: 1.25, gap: 1.5 }}>
              <Box sx={{ color: 'primary.main', display: 'flex' }}>{t.icon}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{t.label}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t.description}</Typography>
              </Box>
              <Switch checked={!!types[t.key]} onChange={() => toggleType(t.key)} />
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ p: 2, mb: 2, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
          <DoNotDisturbRoundedIcon color="primary" sx={{ fontSize: 18 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>免打扰时段</Typography>
          <Box sx={{ flex: 1 }} />
          <Switch checked={dndEnabled} onChange={(_, v) => setDndEnabled(v)} />
        </Stack>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
          开启后,所选时段内的非紧急通知将不再提醒
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', opacity: dndEnabled ? 1 : 0.4, pointerEvents: dndEnabled ? 'auto' : 'none' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>从</Typography>
            <Select size="small" value={dndFrom} onChange={(e) => setDndFrom(e.target.value)} sx={{ fontSize: 13, minWidth: 100 }}>
              {['20:00', '21:00', '22:00', '23:00', '00:00'].map((t) => (
                <MenuItem key={t} value={t} sx={{ fontSize: 13 }}>{t}</MenuItem>
              ))}
            </Select>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>到</Typography>
            <Select size="small" value={dndTo} onChange={(e) => setDndTo(e.target.value)} sx={{ fontSize: 13, minWidth: 100 }}>
              {['06:00', '07:00', '08:00', '09:00', '10:00'].map((t) => (
                <MenuItem key={t} value={t} sx={{ fontSize: 13 }}>{t}</MenuItem>
              ))}
            </Select>
          </Box>
          <Chip size="small" label="紧急通知不受影响" variant="outlined" sx={{ fontSize: 10 }} />
        </Stack>
      </Box>

      <Stack direction="row" spacing={1.5}>
        <Button variant="outlined" onClick={handleReset}>
          恢复默认
        </Button>
        <Button variant="contained" onClick={handleSave}>
          保存设置
        </Button>
      </Stack>
    </Box>
  );
}
