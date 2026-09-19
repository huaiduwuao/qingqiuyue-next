'use client';

/**
 * 微信应用配置(wx_config)。
 *
 * 这页原来是照「服务号」写的:列表里渲染 appName / fans / bindTime,状态按 'active' 字符串比,
 * 还有个「重新授权」按钮打 /api/core/wxConfig/authorize —— 后端这三样东西一个都没有:
 * 接口返回的是 appId / type / status(数字) / notifyUrl,那条 authorize 路由也不存在。
 * 结果只要表里有一行,渲染 `c.fans.toLocaleString()` 就直接抛异常,整页打不开。
 *
 * 现在按后端真实字段来,并且能按平台建行:微信登录要按平台选应用(网站应用和移动应用的
 * AppID 不通用),type 就是那个平台键 —— pc 是网页/兜底,windows/macos/android/ios 各自一行。
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ChatIcon from '@mui/icons-material/Chat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { wxClient } from '@/lib/api/client';

interface WxConfig {
  id: number;
  appId: string;
  appSecret: string;
  type: string;
  token: string;
  aesKey: string;
  notifyUrl: string;
  /** 1 = 启用,其余为停用。查配置那条路是 WHERE type = ? AND status = 1 */
  status: number;
}

/** type 就是 OauthPlatforms 里的平台键,'pc' 是网页/找不到平台行时的兜底。 */
const PLATFORMS: { value: string; label: string; hint: string }[] = [
  { value: 'pc', label: '网页 / 兜底', hint: '开放平台「网站应用」,扫码登录;没有配某个平台时也用它' },
  { value: 'windows', label: 'Windows 客户端', hint: '不配就沿用「网页 / 兜底」那一行' },
  { value: 'macos', label: 'macOS 客户端', hint: '不配就沿用「网页 / 兜底」那一行' },
  { value: 'android', label: 'Android 客户端', hint: '开放平台「移动应用」;注意它只能走 App SDK,不能用于扫码' },
  { value: 'ios', label: 'iOS 客户端', hint: '不配就沿用「网页 / 兜底」那一行' },
  { value: 'mp', label: '公众号', hint: 'oauthType=wechat_mp 才会用到' },
];

const platformLabel = (type: string) => PLATFORMS.find((p) => p.value === type)?.label || type || '(未设置)';

const LIST_KEY = ['wx-config', 'list'];

const EDITABLE = [
  { label: 'AppID', field: 'appId' as const, secret: false },
  { label: 'AppSecret', field: 'appSecret' as const, secret: true },
  { label: 'Token', field: 'token' as const, secret: true },
  { label: '回调地址(notifyUrl)', field: 'notifyUrl' as const, secret: false },
];

export default function WxConfigPage() {
  const qc = useQueryClient();
  const { data: configs = [] } = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => wxClient<{ list?: WxConfig[]; total?: number }>('/wxConfig/list', {
      params: { page: 1, pageSize: 50 },
    }).then((r) => r?.list || []),
  });
  const [selected, setSelectedState] = useState<WxConfig | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [formValues, setFormValues] = useState<Partial<WxConfig>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<Partial<WxConfig>>({ type: 'pc' });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const setSelected = (c: WxConfig | null) => {
    setSelectedState(c);
    setFormValues(c ? { appId: c.appId, appSecret: c.appSecret, token: c.token, notifyUrl: c.notifyUrl, type: c.type } : {});
  };

  const filteredConfigs = useMemo(() => {
    if (!nameFilter) return configs;
    const k = nameFilter.toLowerCase();
    return configs.filter(
      (c) => c.appId?.toLowerCase().includes(k) || c.type?.toLowerCase().includes(k) || platformLabel(c.type).includes(nameFilter),
    );
  }, [configs, nameFilter]);

  const updateMutation = useMutation({
    mutationFn: (vals: Partial<WxConfig> & { id: number }) => wxClient('/wxConfig/updateById', { method: 'PUT', data: vals }),
    onSuccess: () => {
      showMessage('保存成功');
      invalidate();
    },
    onError: (err: unknown) => showMessage(err instanceof Error ? err.message : '保存失败', 'error'),
  });

  const createMutation = useMutation({
    mutationFn: (vals: Partial<WxConfig>) => wxClient('/wxConfig', { method: 'POST', data: vals }),
    onSuccess: () => {
      showMessage('已新增');
      setCreateOpen(false);
      setCreateValues({ type: 'pc' });
      invalidate();
    },
    onError: (err: unknown) => showMessage(err instanceof Error ? err.message : '新增失败', 'error'),
  });

  const handleFormChange = (field: keyof WxConfig, value: string) => setFormValues((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      appId: formValues.appId ?? selected.appId,
      appSecret: formValues.appSecret ?? selected.appSecret,
      token: formValues.token ?? selected.token,
      notifyUrl: formValues.notifyUrl ?? selected.notifyUrl,
      type: formValues.type ?? selected.type,
    });
  };

  const handleToggleStatus = () => {
    if (!selected) return;
    const nextStatus = selected.status === 1 ? 2 : 1;
    updateMutation.mutate(
      { id: selected.id, status: nextStatus },
      {
        onSuccess: () => {
          showMessage(nextStatus === 1 ? '已启用' : '已停用');
          setSelectedState((prev) => (prev ? { ...prev, status: nextStatus } : prev));
          invalidate();
        },
      },
    );
  };

  const handleCopy = (value: string) => {
    navigator.clipboard?.writeText(value).then(() => showMessage('已复制到剪贴板'));
  };

  const isSubmitting = updateMutation.isPending || createMutation.isPending;

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        <ChatIcon sx={{ color: 'success.main', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
          微信应用配置
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="text" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
          新增应用
        </Button>
      </Box>

      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: -2 }}>
        微信登录按平台挑应用:先找 type 等于该平台的一行,没有就回落到「网页 / 兜底」(pc)。
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Box sx={{ width: 320, flexShrink: 0, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              size="small"
              placeholder="搜索平台 / AppID"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {filteredConfigs.length === 0 && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 1, py: 3, textAlign: 'center' }}>
                还没有配置。点右上角「新增应用」。
              </Typography>
            )}
            {filteredConfigs.map((c) => {
              const active = selected?.id === c.id;
              return (
                <Box
                  key={c.id}
                  onClick={() => setSelected(c)}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: active ? 'primary.main' : 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }} noWrap>
                        {platformLabel(c.type)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }} noWrap>
                        {c.appId || '(未填 AppID)'}
                      </Typography>
                    </Box>
                    {c.status === 1 ? (
                      <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                    ) : (
                      <ErrorIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {selected && (
          <Box sx={{ flex: 1, minWidth: 0, p: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6" sx={{ color: 'text.primary' }}>
                {platformLabel(selected.type)}
              </Typography>
              <Chip
                label={selected.status === 1 ? '已启用' : '已停用'}
                size="small"
                sx={{
                  bgcolor: selected.status === 1 ? '#5DDB9620' : '#5A5E7220',
                  color: selected.status === 1 ? 'success.main' : 'text.secondary',
                  fontWeight: 600,
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>平台(type)</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={formValues.type ?? selected.type ?? 'pc'}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                >
                  {PLATFORMS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      {p.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                  {PLATFORMS.find((p) => p.value === (formValues.type ?? selected.type))?.hint || ''}
                </Typography>
              </Box>

              {EDITABLE.map((f) => (
                <Box key={f.field}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{f.label}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      type={f.secret ? 'password' : 'text'}
                      value={(formValues[f.field] as string | undefined) ?? (selected[f.field] as string | undefined) ?? ''}
                      onChange={(e) => handleFormChange(f.field, e.target.value)}
                    />
                    <Button variant="text" size="small" onClick={() => handleCopy(String(selected[f.field] ?? ''))}>
                      复制
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
              <Button variant="contained" onClick={handleSave} disabled={isSubmitting}>
                保存
              </Button>
              <Button variant="text" onClick={handleToggleStatus} disabled={isSubmitting}>
                {selected.status === 1 ? '停用' : '启用'}
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新增微信应用</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              select
              label="平台(type)"
              size="small"
              value={createValues.type ?? 'pc'}
              onChange={(e) => setCreateValues((v) => ({ ...v, type: e.target.value }))}
              helperText={PLATFORMS.find((p) => p.value === (createValues.type ?? 'pc'))?.hint}
            >
              {PLATFORMS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="AppID"
              size="small"
              value={createValues.appId ?? ''}
              onChange={(e) => setCreateValues((v) => ({ ...v, appId: e.target.value }))}
            />
            <TextField
              label="AppSecret"
              size="small"
              type="password"
              value={createValues.appSecret ?? ''}
              onChange={(e) => setCreateValues((v) => ({ ...v, appSecret: e.target.value }))}
            />
            <TextField
              label="回调地址(notifyUrl,可留空)"
              size="small"
              value={createValues.notifyUrl ?? ''}
              onChange={(e) => setCreateValues((v) => ({ ...v, notifyUrl: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>取消</Button>
          <Button
            variant="contained"
            disabled={isSubmitting || !createValues.appId || !createValues.appSecret}
            onClick={() => createMutation.mutate({ ...createValues, status: 1 })}
          >
            新增
          </Button>
        </DialogActions>
      </Dialog>

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
    </Box>
  );
}
