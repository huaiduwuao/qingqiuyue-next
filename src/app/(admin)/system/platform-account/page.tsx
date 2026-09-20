'use client';

/**
 * 自媒体平台账号管理(social_account)。
 *
 * 设计要点:
 *   - 左列右详:左侧展示账号列表,右侧展示详情 + 编辑表单
 *   - secret 字段不回显:用 hasClientSecret / hasAccessToken 标记,允许重新填
 *   - 新增 / 编辑走弹窗(Modal),右侧详情仅做查看 + 关键状态切换
 *   - OAuth 授权按钮(Phase 2 接通):调用 genAuthUrl 后跳转三方
 */

import React, { useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import HubRoundedIcon from '@mui/icons-material/Hub';
import {
  PLATFORMS,
  platformLabel,
  AUTH_STATUS_META,
  type PlatformAccount,
  page as listAccounts,
  create as createAccount,
  update as updateAccount,
  remove as removeAccounts,
  genAuthUrl,
  refreshAuth,
} from '@/apis/system-platform-account';

const LIST_KEY = ['platform-account', 'list'];

type EditFormState = {
  id?: number;
  platform: string;
  accountName: string;
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  boundUserId: number;
  status: number;
  remark: string;
};

const emptyForm: EditFormState = {
  platform: 'douyin',
  accountName: '',
  clientKey: '',
  clientSecret: '',
  redirectUri: '',
  scope: '',
  boundUserId: 0,
  status: 1,
  remark: '',
};

export default function PlatformAccountPage() {
  const qc = useQueryClient();
  const [platformFilter, setPlatformFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<PlatformAccount | null>(null);
  const [editing, setEditing] = useState<EditFormState | null>(null);
  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    msg: '',
    severity: 'info',
  });

  const { data: listResp, isLoading } = useQuery({
    queryKey: LIST_KEY,
    queryFn: () =>
      listAccounts({
        page: 1,
        pageSize: 100,
        platform: platformFilter || undefined,
        keyword: keyword || undefined,
      }),
  });
  const accounts: PlatformAccount[] = (listResp as any)?.list || [];

  const createMut = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      setEditing(null);
      setToast({ open: true, msg: '已新建账号', severity: 'success' });
    },
    onError: (e: any) => setToast({ open: true, msg: e?.message || '新建失败', severity: 'error' }),
  });

  const updateMut = useMutation({
    mutationFn: updateAccount,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      if (data) setSelected(data);
      setEditing(null);
      setToast({ open: true, msg: '已保存', severity: 'success' });
    },
    onError: (e: any) => setToast({ open: true, msg: e?.message || '保存失败', severity: 'error' }),
  });

  const removeMut = useMutation({
    mutationFn: removeAccounts,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      setSelected(null);
      setToast({ open: true, msg: '已删除', severity: 'success' });
    },
    onError: (e: any) => setToast({ open: true, msg: e?.message || '删除失败', severity: 'error' }),
  });

  const authMut = useMutation({
    mutationFn: genAuthUrl,
    onSuccess: (data: any) => {
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (e: any) => setToast({ open: true, msg: e?.message || '生成授权链接失败', severity: 'error' }),
  });

  const refreshMut = useMutation({
    mutationFn: refreshAuth,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      if (data) setSelected(data);
      setToast({ open: true, msg: '已刷新授权', severity: 'success' });
    },
    onError: (e: any) => setToast({ open: true, msg: e?.message || '刷新失败,请先填写 clientSecret 并完成 OAuth', severity: 'error' }),
  });

  const platformColor = (p: string) => PLATFORMS.find((x) => x.value === p)?.color || 'primary.main';

  const handleNew = () => {
    setEditing({ ...emptyForm });
  };

  const handleEdit = (acc: PlatformAccount) => {
    setEditing({
      id: acc.id,
      platform: acc.platform,
      accountName: acc.accountName,
      clientKey: acc.clientKey,
      clientSecret: '', // 不回显,留空表示不改
      redirectUri: acc.redirectUri,
      scope: acc.scope,
      boundUserId: acc.boundUserId,
      status: acc.status,
      remark: acc.remark,
    });
  };

  const handleSave = () => {
    if (!editing) return;
    if (!editing.accountName.trim() || !editing.clientKey.trim()) {
      setToast({ open: true, msg: '账号名和 clientKey 必填', severity: 'error' });
      return;
    }
    if (editing.id) {
      const payload: any = { ...editing };
      // clientSecret 留空 → 后端不修改
      if (!editing.clientSecret) delete payload.clientSecret;
      updateMut.mutate(payload);
    } else {
      if (!editing.clientSecret.trim()) {
        setToast({ open: true, msg: '新建时必须填写 clientSecret', severity: 'error' });
        return;
      }
      createMut.mutate(editing);
    }
  };

  const copyText = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setToast({ open: true, msg: '已复制', severity: 'success' }),
        () => setToast({ open: true, msg: '复制失败', severity: 'error' }),
      );
    }
  };

  const authMeta = (s: number) => AUTH_STATUS_META[s] || AUTH_STATUS_META[0];

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            自媒体平台账号
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            维护抖音 / 快手 / 小红书等平台的应用凭据;OAuth 授权后可一键把站内内容分发到第三方账号。
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleNew}>
          新增账号
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* 左列:列表 */}
        <Box sx={{ width: 360, display: 'flex', flexDirection: 'column', gap: 1.5, flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder="搜索账号名 / clientKey / 平台昵称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
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
          <TextField
            select
            size="small"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
          >
            <MenuItem value="">全部平台</MenuItem>
            {PLATFORMS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {isLoading && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary', p: 2 }}>加载中…</Typography>
            )}
            {!isLoading && accounts.length === 0 && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary', p: 4, textAlign: 'center' }}>
                还没有账号。点右上角「新增账号」。
              </Typography>
            )}
            {accounts.map((acc) => {
              const active = selected?.id === acc.id;
              const am = authMeta(acc.authStatus);
              return (
                <Box
                  key={acc.id}
                  onClick={() => setSelected(acc)}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: active ? 'primary.main' : 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HubRoundedIcon sx={{ fontSize: 18, color: platformColor(acc.platform) }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }} noWrap>
                        {acc.accountName}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }} noWrap>
                        {platformLabel(acc.platform)} · {acc.clientKey}
                      </Typography>
                    </Box>
                    <Chip
                      label={am.label}
                      size="small"
                      color={am.color}
                      variant={am.color === 'default' ? 'outlined' : 'filled'}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* 右侧:详情 + 操作 */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            p: 3,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            overflowY: 'auto',
          }}
        >
          {!selected && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                选中左侧账号查看详情
              </Typography>
            </Box>
          )}

          {selected && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <HubRoundedIcon sx={{ fontSize: 28, color: platformColor(selected.platform) }} />
                  <Box>
                    <Typography variant="h6" sx={{ color: 'text.primary' }}>
                      {selected.accountName}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {platformLabel(selected.platform)} · ID {selected.id}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label={authMeta(selected.authStatus).label}
                    color={authMeta(selected.authStatus).color}
                    size="small"
                  />
                  <Chip
                    label={selected.status === 1 ? '已启用' : '已停用'}
                    size="small"
                    color={selected.status === 1 ? 'success' : 'default'}
                    variant={selected.status === 1 ? 'filled' : 'outlined'}
                  />
                </Box>
              </Box>

              {PLATFORMS.find((p) => p.value === selected.platform)?.hint && (
                <Alert severity="info" sx={{ fontSize: 13 }}>
                  {PLATFORMS.find((p) => p.value === selected.platform)!.hint}
                </Alert>
              )}

              <DetailField label="clientKey" value={selected.clientKey} onCopy={copyText} />
              <SecretField label="clientSecret" has={selected.hasClientSecret} onCopy={copyText} />
              <DetailField label="redirectUri" value={selected.redirectUri || '(未设置)'} />
              <DetailField label="scope" value={selected.scope || '(未设置)'} />
              <Box sx={{ display: 'flex', gap: 4 }}>
                <SecretExpireField
                  label="access_token"
                  has={selected.hasAccessToken}
                  expireAt={selected.expiresAt}
                />
                <SecretExpireField
                  label="refresh_token"
                  has={selected.hasRefreshToken}
                  expireAt={selected.refreshExpiresAt}
                />
              </Box>
              <DetailField
                label="平台账号信息"
                value={selected.platformUserNickname ? `${selected.platformUserNickname} (${selected.platformUserId || '-'})` : '(未授权)'}
              />
              {selected.boundUserId > 0 && (
                <DetailField label="绑定站内用户 ID" value={String(selected.boundUserId)} />
              )}
              {selected.remark && <DetailField label="备注" value={selected.remark} />}

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<LaunchRoundedIcon />}
                  onClick={() => authMut.mutate(selected.id)}
                  disabled={!selected.hasClientSecret || authMut.isPending}
                >
                  去授权
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={() => refreshMut.mutate(selected.id)}
                  disabled={!selected.hasRefreshToken || refreshMut.isPending}
                >
                  刷新 token
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditRoundedIcon />}
                  onClick={() => handleEdit(selected)}
                >
                  编辑
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteRoundedIcon />}
                  onClick={() => {
                    if (confirm(`确认删除账号「${selected.accountName}」?`)) {
                      removeMut.mutate([selected.id]);
                    }
                  }}
                >
                  删除
                </Button>
              </Box>
              {!selected.hasClientSecret && (
                <Typography sx={{ fontSize: 12, color: 'warning.main' }}>
                  还没填写 clientSecret,无法授权。先点「编辑」补齐。
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* 新建 / 编辑弹窗 */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing?.id ? '编辑账号' : '新增账号'}</DialogTitle>
        <DialogContent>
          {editing && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>平台</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={editing.platform}
                  onChange={(e) => setEditing({ ...editing, platform: e.target.value })}
                >
                  {PLATFORMS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      {p.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                  {PLATFORMS.find((p) => p.value === editing.platform)?.hint}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>账号昵称</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={editing.accountName}
                  onChange={(e) => setEditing({ ...editing, accountName: e.target.value })}
                  placeholder="如 抖音-官方号"
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>clientKey / AppID</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={editing.clientKey}
                  onChange={(e) => setEditing({ ...editing, clientKey: e.target.value })}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                  clientSecret / AppSecret {editing.id && '(留空不修改)'}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  value={editing.clientSecret}
                  onChange={(e) => setEditing({ ...editing, clientSecret: e.target.value })}
                  placeholder={editing.id ? '保持原值不修改' : '必填,密钥不回显'}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>redirectUri(回调地址)</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={editing.redirectUri}
                  onChange={(e) => setEditing({ ...editing, redirectUri: e.target.value })}
                  placeholder="https://your-domain/api/core/socialshare/callback/<platform>"
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>scope(权限项)</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={editing.scope}
                  onChange={(e) => setEditing({ ...editing, scope: e.target.value })}
                  placeholder="如 video.create,user_info"
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                  绑定站内用户 ID(创作者用,留空表示平台账号不挂具体用户)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={editing.boundUserId || ''}
                  onChange={(e) => setEditing({ ...editing, boundUserId: parseInt(e.target.value, 10) || 0 })}
                />
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={editing.status === 1}
                    onChange={(e) => setEditing({ ...editing, status: e.target.checked ? 1 : 0 })}
                  />
                }
                label="启用"
              />
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>备注</Typography>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={editing.remark}
                  onChange={(e) => setEditing({ ...editing, remark: e.target.value })}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={createMut.isPending || updateMut.isPending}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function DetailField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: (v: string) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 13, color: 'text.primary', flex: 1 }}>{value}</Typography>
        {onCopy && value && value !== '(未设置)' && (
          <IconButton size="small" onClick={() => onCopy(value)}>
            <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

function SecretField({
  label,
  has,
  onCopy,
}: {
  label: string;
  has: boolean;
  onCopy?: (v: string) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={has ? '已配置(不回显)' : '未配置'}
          size="small"
          color={has ? 'success' : 'warning'}
          variant={has ? 'filled' : 'outlined'}
        />
        {has && onCopy && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            密钥不回显。如需更换,点「编辑」重新填。
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function SecretExpireField({
  label,
  has,
  expireAt,
}: {
  label: string;
  has: boolean;
  expireAt?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const isExpired = !!expireAt && expireAt < now;
  return (
    <Box sx={{ flex: 1 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={has ? '已配置' : '未配置'}
          size="small"
          color={has ? 'success' : 'warning'}
          variant={has ? 'filled' : 'outlined'}
        />
        {has && expireAt && (
          <Typography sx={{ fontSize: 12, color: isExpired ? 'error.main' : 'text.secondary' }}>
            {isExpired ? '已过期' : '到期'} {new Date(expireAt * 1000).toLocaleString('zh-CN')}
          </Typography>
        )}
      </Box>
    </Box>
  );
}