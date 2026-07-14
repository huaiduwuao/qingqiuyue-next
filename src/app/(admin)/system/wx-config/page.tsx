'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
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
import { wxClient } from '@/lib/api/client';

interface WxConfig {
  id: number;
  appId: string;
  appName: string;
  appSecret: string;
  token: string;
  status: 'active' | 'inactive';
  bindTime: string;
  fans: number;
}

const LIST_KEY = ['wx-config', 'list'];

export default function WxConfigPage() {
  const qc = useQueryClient();
  const { data: configs = [] } = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => wxClient<{ data?: { list?: WxConfig[]; total?: number } }>('/wxConfig/list', {
      params: { page: 1, pageSize: 20 },
    }).then((r) => r?.data?.data?.list || []),
  });
  const [selected, setSelectedState] = useState<WxConfig | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [formValues, setFormValues] = useState<Partial<WxConfig>>({});
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const setSelected = (c: WxConfig | null) => {
    setSelectedState(c);
    if (c) {
      setFormValues({
        appName: c.appName,
        appId: c.appId,
        appSecret: c.appSecret,
        token: c.token,
      });
    } else {
      setFormValues({});
    }
  };

  const filteredConfigs = useMemo(() => {
    if (!nameFilter) return configs;
    const k = nameFilter.toLowerCase();
    return configs.filter(
      (c) => c.appName?.toLowerCase().includes(k) || c.appId?.toLowerCase().includes(k),
    );
  }, [configs, nameFilter]);

  const updateMutation = useMutation({
    mutationFn: (vals: Partial<WxConfig> & { id: number }) => wxClient('/wxConfig/updateById', {
      method: 'POST',
      data: vals,
    }),
    onSuccess: () => {
      showMessage('保存成功');
      invalidate();
    },
    onError: (err: unknown) => showMessage(err instanceof Error ? err.message : '保存失败', 'error'),
  });

  const handleFormChange = (field: keyof WxConfig, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      appName: formValues.appName ?? selected.appName,
      appId: formValues.appId ?? selected.appId,
      appSecret: formValues.appSecret ?? selected.appSecret,
      token: formValues.token ?? selected.token,
    });
  };

  const handleToggleStatus = () => {
    if (!selected) return;
    const nextStatus = selected.status === 'active' ? 'inactive' : 'active';
    updateMutation.mutate({
      id: selected.id,
      status: nextStatus,
    }, {
      onSuccess: () => {
        showMessage(nextStatus === 'active' ? '已启用' : '已停用');
        setSelectedState((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      },
    });
  };

  const handleReauthorize = () => {
    setAuthDialogOpen(true);
  };

  const confirmReauthorize = () => {
    const callback = encodeURIComponent(window.location.href);
    window.open(`/api/core/wxConfig/authorize?callback=${callback}`, '_blank', 'noopener,noreferrer');
    setAuthDialogOpen(false);
  };

  const handleCopy = (value: string) => {
    navigator.clipboard?.writeText(value).then(() => showMessage('已复制到剪贴板'));
  };

  const isSubmitting = updateMutation.isPending;

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        <ChatIcon sx={{ color: 'success.main', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
          微信配置
        </Typography>
        <Chip label="服务号" size="small" sx={{ bgcolor: '#5DDB9620', color: 'success.main' }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Box sx={{ width: 320, flexShrink: 0, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              size="small"
              placeholder="搜索公众号名称 / AppID"
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
              <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', py: 2 }}>
                暂无匹配的公众号
              </Typography>
            )}
            {filteredConfigs.map((c) => {
              const isSel = selected?.id === c.id;
              return (
                <Box
                  key={c.id}
                  onClick={() => setSelected(c)}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: `1px solid ${isSel ? 'success.main' : 'divider'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: '#5DDB9680' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: '#5DDB9620',
                        color: 'success.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ChatIcon />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }} noWrap>
                        {c.appName}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }} noWrap>
                        {c.appId}
                      </Typography>
                    </Box>
                    {c.status === 'active' ? (
                      <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                    ) : (
                      <ErrorIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>粉丝</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'success.main' }}>
                      {c.fans.toLocaleString()}
                    </Typography>
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
                {selected.appName}
              </Typography>
              <Chip
                label={selected.status === 'active' ? '已启用' : '已停用'}
                size="small"
                sx={{
                  bgcolor: selected.status === 'active' ? '#5DDB9620' : '#5A5E7220',
                  color: selected.status === 'active' ? 'success.main' : 'text.secondary',
                  fontWeight: 600,
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'AppID', field: 'appId' as const, copy: true },
                { label: 'AppSecret', field: 'appSecret' as const, copy: true },
                { label: 'Token', field: 'token' as const, copy: true },
                { label: '绑定时间', field: 'bindTime' as const, copy: false, disabled: true },
                { label: '粉丝数', field: 'fans' as const, copy: false, disabled: true, format: (v: number) => v.toLocaleString() },
              ].map((f) => (
                <Box key={f.label}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{f.label}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {f.disabled ? (
                      <Box
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: 'background.default',
                          border: '1px solid', borderColor: 'divider',
                          fontFamily: 'monospace',
                          fontSize: 13,
                          color: 'text.tertiary',
                        }}
                      >
                        {f.format ? f.format(selected[f.field] as number) : selected[f.field]}
                      </Box>
                    ) : (
                      <TextField
                        size="small"
                        fullWidth
                        value={formValues[f.field] ?? selected[f.field]}
                        onChange={(e) => handleFormChange(f.field, e.target.value)}
                        type={f.field === 'appSecret' || f.field === 'token' ? 'password' : 'text'}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            fontFamily: 'monospace',
                            fontSize: 13,
                            bgcolor: 'background.default',
                          },
                        }}
                      />
                    )}
                    {f.copy && (
                      <Button
                        size="small"
                        onClick={() => handleCopy(String(formValues[f.field] ?? selected[f.field]))}
                        sx={{ minWidth: 60, textTransform: 'none', color: 'success.main' }}
                      >
                        复制
                      </Button>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>

            <Divider sx={{ borderColor: 'divider', my: 3 }} />

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                disabled={isSubmitting}
                onClick={handleSave}
                sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: '#4FC986' }, textTransform: 'none' }}
              >
                保存修改
              </Button>
              <Button
                variant="outlined"
                onClick={handleReauthorize}
                sx={{ borderColor: 'divider', color: 'text.tertiary', textTransform: 'none' }}
              >
                重新授权
              </Button>
              <Button
                variant="outlined"
                disabled={isSubmitting}
                onClick={handleToggleStatus}
                sx={{ borderColor: 'divider', color: 'primary.main', textTransform: 'none' }}
              >
                {selected.status === 'active' ? '停用' : '启用'}
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <Dialog open={authDialogOpen} onClose={() => setAuthDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>重新授权微信公众号</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', pt: 1 }}>
            重新授权将跳转到微信开放平台授权页，授权完成后会自动返回当前页面。是否继续？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuthDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={confirmReauthorize}>
            去授权
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
