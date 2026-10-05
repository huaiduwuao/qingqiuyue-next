'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Avatar from '@mui/material/Avatar';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { adminClient } from '@/lib/api/client';

// ─── 子组件:编辑资料 Drawer ───
// 地区选项:从 system-area 接口拉,无网络时兜底显示空(不再硬编码 10 个国家)
export const REGION_FALLBACK: string[] = [];

export function EditProfileDrawer({
  open, onClose, profile, onSave, saving, onAccountPrivateChange, accountPrivateSaving,
}: {
  open: boolean;
  onClose: () => void;
  profile: any;
  onSave: (payload: Record<string, any>) => void;
  saving: boolean;
  onAccountPrivateChange: (next: boolean) => void;
  accountPrivateSaving: boolean;
}) {
  const initial = profile?.user;
  const [nickname, setNickname] = useState('');
  const [douyinId, setDouyinId] = useState('');
  const [bio, setBio] = useState('');
  const [region, setRegion] = useState('');
  const [age, setAge] = useState<string>('');
  const [avatar, setAvatar] = useState('');
  const [showRegionMenu, setShowRegionMenu] = useState(false);

  // 地区选项:真接口(system-area) → fallback 空
  const regionQ = useQuery({
    queryKey: ['home', 'me', 'region-presets'],
    queryFn: () =>
      adminClient.get<any>('/system/address/provinces').then((r) => {
        const list = r?.list || r || [];
        return Array.isArray(list) ? list.map((x: any) => x.name || x.label || String(x)) : [];
      }),
    enabled: open,
    staleTime: 10 * 60_000,
  });
  const REGION_PRESETS: string[] = (regionQ.data && regionQ.data.length > 0) ? regionQ.data : REGION_FALLBACK;

  useEffect(() => {
    if (!open) return;
    setNickname(initial?.nickname || '');
    setDouyinId(initial?.douyinId || '');
    setBio(initial?.bio || '');
    setRegion(initial?.region || '');
    setAge(initial?.age != null ? String(initial.age) : '');
    setAvatar(initial?.avatar || '');
  }, [open, initial?.nickname, initial?.douyinId, initial?.bio, initial?.region, initial?.age, initial?.avatar]);

  // 之前:使用 picsum.photos + Math.random() 拼一个外部样图作默认头像。
  // 改:头像应走系统上传或后端默认头像接口;此处不伪造 URL,清空让用户上传。
  const handleRandomAvatar = () => {
    setAvatar('');
  };

  const handleSubmit = () => {
    const payload: Record<string, any> = {};
    if (nickname.trim()) payload.nickname = nickname.trim();
    if (douyinId.trim()) payload.douyinId = douyinId.trim();
    if (bio.trim()) payload.bio = bio.trim();
    if (region) payload.region = region;
    if (age && !isNaN(Number(age))) payload.age = Number(age);
    if (avatar) payload.avatar = avatar;
    onSave(payload);
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'var(--bg-hover, transparent)',
      color: 'text.primary',
      fontSize: 13,
      borderRadius: 1.5,
      '& fieldset': { borderColor: 'var(--border-color, transparent)' },
      '&:hover fieldset': { borderColor: 'var(--border-strong, transparent)' },
      '&.Mui-focused fieldset': { borderColor: 'primary.main' },
    },
    '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: 13 },
    '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      // --bg-surface 是半透明的(浅色 0.7),整页铺满时底下的「我的」全透出来;抽屉要实底。
      // 手机上全屏:高度跟 --app-height(键盘弹起时跟着缩,保存按钮不被顶走),
      // 客户端里上下让出状态栏/手势条(--sat/--sab 见 globals.css)
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 420 },
            height: { xs: 'var(--app-height, 100%)', sm: '100%' },
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            pt: 'var(--sat, 0px)',
            pb: 'var(--sab, 0px)',
            boxSizing: 'border-box',
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>编辑资料</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 1 }}>
            <Avatar src={avatar} sx={{ width: 80, height: 80, border: 2, borderColor: 'warning.main' }}>
              {(nickname || '我')[0]}
            </Avatar>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={handleRandomAvatar} sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5 }}>
                随机头像
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => setAvatar('')}
                sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, color: 'text.secondary' }}
              >
                移除
              </Button>
            </Stack>
          </Box>

          <Divider sx={{ borderColor: 'var(--border-color, transparent)' }} />

          <TextField
            label="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 20))}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 20 }, formHelperText: { sx: { fontSize: 10, color: 'text.muted' } } }}
            helperText={`${nickname.length}/20`}
            sx={fieldSx}
          />

          <TextField
            label="抖音号"
            value={douyinId}
            onChange={(e) => setDouyinId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20))}
            fullWidth
            sx={fieldSx}
          />

          <Box>
            <TextField
              label="个人简介"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 80))}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              slotProps={{ htmlInput: { maxLength: 80 }, formHelperText: { sx: { fontSize: 10, color: 'text.muted' } } }}
              helperText={`${bio.length}/80`}
              sx={fieldSx}
            />
          </Box>

          <Stack direction="row" spacing={1.5}>
            <TextField
              label="年龄"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              sx={{ ...fieldSx, width: 120 }}
              slotProps={{ htmlInput: { min: 0, max: 120 } }}
            />
            <Box sx={{ flex: 1, position: 'relative' }}>
              <TextField
                label="地区"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                onFocus={() => setShowRegionMenu(true)}
                onBlur={() => setTimeout(() => setShowRegionMenu(false), 150)}
                fullWidth
                sx={fieldSx}
              />
              {showRegionMenu && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    mt: 0.5,
                    zIndex: 10,
                    bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.98))',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    boxShadow: 3,
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  {REGION_PRESETS.map((r) => (
                    <Box
                      key={r}
                      onMouseDown={() => { setRegion(r); setShowRegionMenu(false); }}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        fontSize: 12,
                        cursor: 'pointer',
                        bgcolor: region === r ? 'var(--bg-hover, transparent)' : 'transparent',
                        '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
                      }}
                    >
                      {r}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Stack>

          <Divider sx={{ borderColor: 'var(--border-color, transparent)' }} />

          {/* 账号级隐私开关。作品级的「设为私密」在作品卡片上,两者互不影响 ——
              以前作品卡片上那个开关改的其实就是这里,用户根本看不出来。
              开关即时生效,不跟着下面的「保存」走。 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>私密账号</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
                开启后,别人访问你的主页看不到任何作品(整个账号,不是单个作品)
              </Typography>
            </Box>
            <Switch
              size="small"
              checked={!!profile?.user?.isPrivate}
              disabled={accountPrivateSaving}
              onChange={(e) => onAccountPrivateChange(e.target.checked)}
              slotProps={{ input: { 'aria-label': '私密账号' } }}
            />
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: 2, py: 1.5, flexShrink: 0, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5 }}>
        <Button fullWidth variant="outlined" onClick={onClose} sx={{ borderRadius: 2, textTransform: 'none' }}>
          取消
        </Button>
        <Button
          fullWidth
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          {saving ? '保存中…' : '保存'}
        </Button>
      </Box>
    </Drawer>
  );
}
