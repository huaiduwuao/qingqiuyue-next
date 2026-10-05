'use client';

/**
 * 创作者中心 · 平台账号(C 端自绑定)
 *
 *   - 用本人抖音/快手/小红书开放平台 client_key / client_secret 接入清秋月
 *   - YouTube / TikTok:清秋月配了平台应用时「一键绑定」(POST /share/account/bind)直接跳授权,不用自备应用
 *   - OAuth 授权:点击「去授权」→ 调 genAuthUrl → window.open 三方页 → 完成后三方回跳
 *     /api/core/socialshare/callback/:platform?code=...&state=...,后端再 302 回
 *     /account/content?tab=accounts&auth=ok/fail&platform=...,本页面读 searchParams
 *     弹 toast。
 *   - 视频素材:用户在三方创作者中心先上传后回填 video_id,清秋月只发 /video/create/
 *
 *  设计:
 *   - 平台分组卡片(每平台一卡片,卡片内列表)
 *   - secret 不回显,只显示「已配置 / 未配置」
 *   - 新建/编辑用 Dialog 收集表单
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import Fab from '@mui/material/Fab';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileSection, MobileListRow, MoreLink } from '@/components/mobile/MobileSection';
import {
  PLATFORMS,
  platformLabel,
  AUTH_STATUS_META,
  page as listAccounts,
  create as createAccount,
  update as updateAccount,
  remove as removeAccounts,
  genAuthUrl,
  refreshAuth,
  bind as bindAccount,
  platforms as listPlatforms,
  isIntlPlatform,
  type ShareAccount,
  type SharePlatformInfo,
} from '@/apis/share-account';
import { errMessage } from '@/lib/errMessage';

interface FormState {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: ShareAccount;
}

const emptyForm: FormState = { open: false, mode: 'create' };

export default function AccountsPage() {
  const params = useSearchParams();
  const queryClient = useQueryClient();

  // 一次性 toast:三方回调回跳 ?auth=ok/fail&platform=...
  const [toast, setToast] = useState<{ open: boolean; severity: 'success' | 'error'; msg: string }>({
    open: false,
    severity: 'success',
    msg: '',
  });
  useEffect(() => {
    const auth = params.get('auth');
    const platform = params.get('platform');
    const msg = params.get('msg');
    if (auth === 'ok' && platform) {
      setToast({ open: true, severity: 'success', msg: `已授权 ${platformLabel(platform)}` });
    } else if (auth === 'fail') {
      setToast({ open: true, severity: 'error', msg: `授权失败:${msg || ''}` });
    }
  }, [params]);

  // 列表
  const { data, isLoading } = useQuery({
    queryKey: ['share-accounts', { page: 1, pageSize: 100 }],
    queryFn: () => listAccounts({ page: 1, pageSize: 100 }),
  });
  const accounts: ShareAccount[] = useMemo(() => data?.list || [], [data]);
  // 各平台:有没有清秋月平台应用、是否只能私享(旧后端没有这个接口时当作都没有)
  const { data: platformInfos } = useQuery({
    queryKey: ['share-platforms'],
    queryFn: async () => {
      try {
        return (await listPlatforms()) ?? [];
      } catch {
        return [] as SharePlatformInfo[];
      }
    },
    staleTime: 5 * 60_000,
  });
  const infoOf = (platform: string) => (platformInfos ?? []).find((x) => x.platform === platform);

  // 按平台分组(目前只展示抖音 / 快手 / 小红书;视频号/B 站预留无 UI)
  const grouped = useMemo(() => {
    const m = new Map<string, ShareAccount[]>();
    for (const a of accounts) {
      if (!m.has(a.platform)) m.set(a.platform, []);
      m.get(a.platform)!.push(a);
    }
    return m;
  }, [accounts]);

  // 表单弹窗
  const [form, setForm] = useState<FormState>(emptyForm);

  // 手机版:行尾「⋮」菜单 + 说明弹窗
  const { isMobile } = useResponsive();
  const [rowMenu, setRowMenu] = useState<{ el: HTMLElement; account: ShareAccount } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // mutations
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['share-accounts'] });

  const doCreate = useMutation({
    mutationFn: (payload: Parameters<typeof createAccount>[0]) => createAccount(payload),
    onSuccess: () => {
      setToast({ open: true, severity: 'success', msg: '已新建账号,记得去授权' });
      invalidate();
      setForm(emptyForm);
    },
    onError: (e: unknown) => setToast({ open: true, severity: 'error', msg: errMessage(e) || '新建失败' }),
  });

  const doUpdate = useMutation({
    mutationFn: (payload: Parameters<typeof updateAccount>[0]) => updateAccount(payload),
    onSuccess: () => {
      setToast({ open: true, severity: 'success', msg: '已更新' });
      invalidate();
      setForm(emptyForm);
    },
    onError: (e: unknown) => setToast({ open: true, severity: 'error', msg: errMessage(e) || '更新失败' }),
  });

  const doRemove = useMutation({
    mutationFn: (ids: number[]) => removeAccounts(ids),
    onSuccess: () => {
      setToast({ open: true, severity: 'success', msg: '已删除' });
      invalidate();
    },
    onError: (e: unknown) => setToast({ open: true, severity: 'error', msg: errMessage(e) || '删除失败' }),
  });

  const doAuth = useMutation({
    mutationFn: (id: number) => genAuthUrl(id),
    onSuccess: (res: { url: string }) => {
      // 新标签页打开三方授权页
      window.open(res.url, '_blank', 'width=600,height=800,noopener,noreferrer');
    },
    onError: (e: unknown) => setToast({ open: true, severity: 'error', msg: errMessage(e) || '获取授权链接失败' }),
  });

  const doBind = useMutation({
    mutationFn: (platform: string) => bindAccount(platform),
    onSuccess: (res: { url: string }) => {
      invalidate();
      window.open(res.url, '_blank', 'width=600,height=800,noopener,noreferrer');
    },
    onError: (e: unknown) => setToast({ open: true, severity: 'error', msg: errMessage(e) || '绑定失败' }),
  });

  const doRefresh = useMutation({
    mutationFn: (id: number) => refreshAuth(id),
    onSuccess: () => {
      setToast({ open: true, severity: 'success', msg: '已刷新授权' });
      invalidate();
    },
    onError: (e: unknown) => setToast({ open: true, severity: 'error', msg: errMessage(e) || '刷新失败' }),
  });

  const overlays = (
    <>
        <AccountFormDialog
          state={form}
          infoOf={infoOf}
          onClose={() => setForm(emptyForm)}
          onSubmit={(payload) => {
            if (form.mode === 'create') doCreate.mutate(payload as Parameters<typeof createAccount>[0]);
            else if (form.initial) doUpdate.mutate({ id: form.initial.id, ...payload } as Parameters<typeof updateAccount>[0]);
          }}
        />

        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
            {toast.msg}
          </Alert>
        </Snackbar>
    </>
  );

  const confirmDelete = (id: number) => {
    if (window.confirm('确认删除该账号?进行中的发布任务会拒绝删除。')) {
      doRemove.mutate([id]);
    }
  };

  if (isMobile) {
    const platforms = PLATFORMS;
    const closeMenu = () => setRowMenu(null);
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {/* 长说明 + 提示折成一行,细节在「说明」弹窗里 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
          <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 12, color: 'text.secondary' }}>
            绑定你自己的开放平台账号,一键把作品发出去
          </Typography>
          <MoreLink label="说明" onClick={() => setHelpOpen(true)} />
        </Box>

        {isLoading ? (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 0.5 }}>加载中…</Typography>
        ) : (
          platforms.map((p) => {
            const list = grouped.get(p.value) || [];
            return (
              <MobileSection
                key={p.value}
                flush
                title={
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                    <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
                    {p.label}
                  </Box>
                }
                extra={`${list.length} 个账号`}
              >
                {infoOf(p.value)?.builtinApp && (
                  <Box sx={{ px: 1.75, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button size="small" variant="outlined" disabled={doBind.isPending} onClick={() => doBind.mutate(p.value)}>
                      一键绑定{p.label}
                    </Button>
                    {infoOf(p.value)?.privateOnly && (
                      <Typography sx={{ fontSize: 11, color: 'warning.main' }}>应用审核中,只能私享发布</Typography>
                    )}
                  </Box>
                )}
                {list.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: 'text.disabled', px: 1.75, pb: 1.5 }}>
                    暂无账号,点右下「新建账号」添加
                  </Typography>
                ) : (
                  list.map((a, i) => {
                    const meta = AUTH_STATUS_META[a.authStatus] ?? AUTH_STATUS_META[0];
                    return (
                      <MobileListRow
                        key={a.id}
                        divider={i > 0}
                        title={a.accountName}
                        subtitle={
                          <>
                            <Box
                              component="span"
                              sx={{ color: meta.color === 'default' ? 'text.secondary' : `${meta.color}.main`, fontWeight: 600 }}
                            >
                              {meta.label}
                            </Box>
                            {a.platformUserNickname ? ` · ${a.platformUserNickname}` : ''}
                            {a.usesBuiltinApp
                              ? ` · 清秋月平台应用 · token ${a.hasAccessToken ? '已缓存' : '无'}`
                              : ` · secret ${a.hasClientSecret ? '已配置' : '未配置'} · token ${a.hasAccessToken ? '已缓存' : '无'}`}
                          </>
                        }
                        trailing={
                          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <Button size="small" variant="text" onClick={() => doAuth.mutate(a.id)} sx={{ minWidth: 0, px: 1 }}>
                              授权
                            </Button>
                            <IconButton
                              size="small"
                              aria-label="更多操作"
                              onClick={(e) => setRowMenu({ el: e.currentTarget, account: a })}
                            >
                              <MoreVertRoundedIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                      />
                    );
                  })
                )}
              </MobileSection>
            );
          })
        )}

        <Menu anchorEl={rowMenu?.el} open={!!rowMenu} onClose={closeMenu}>
          <MenuItem
            onClick={() => {
              if (rowMenu) doRefresh.mutate(rowMenu.account.id);
              closeMenu();
            }}
          >
            <ListItemIcon>
              <RefreshRoundedIcon fontSize="small" />
            </ListItemIcon>
            刷新 token
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (rowMenu) setForm({ open: true, mode: 'edit', initial: rowMenu.account });
              closeMenu();
            }}
          >
            <ListItemIcon>
              <EditRoundedIcon fontSize="small" />
            </ListItemIcon>
            编辑
          </MenuItem>
          <MenuItem
            onClick={() => {
              const id = rowMenu?.account.id;
              closeMenu();
              if (id != null) confirmDelete(id);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteRoundedIcon fontSize="small" color="error" />
            </ListItemIcon>
            删除
          </MenuItem>
        </Menu>

        <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>平台账号说明</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              绑定你自己的抖音 / 快手 / 小红书开放平台账号,或一键绑定 YouTube / TikTok;清秋月用你的账号一键把站内作品发布出去。
              作品归属清秋月平台;视频素材请先在抖音创作者中心 / 快手 App 上传,粘贴返回的 video_id。
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              在抖音/快手开放平台创建「网站应用」类应用,把 client_key / client_secret 填进来。授权回调域名必须为清秋月部署域名。
            </Typography>
            {platforms.map((p) => (
              <Typography key={p.value} sx={{ fontSize: 12, color: 'text.secondary' }}>
                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {p.label}:
                </Box>
                {p.hint}
              </Typography>
            ))}
          </DialogContent>
          <DialogActions>
            <Button variant="text" onClick={() => setHelpOpen(false)}>
              知道了
            </Button>
          </DialogActions>
        </Dialog>

        <Fab
          variant="extended"
          color="primary"
          onClick={() => setForm({ open: true, mode: 'create' })}
          sx={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(16px + var(--bottom-nav-inset, 0px) + var(--player-inset, 0px))',
            zIndex: 10,
          }}
        >
          <AddRoundedIcon sx={{ mr: 0.5 }} />
          新建账号
        </Fab>

        {overlays}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction="row"
        sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          平台账号
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setForm({ open: true, mode: 'create' })}
        >
          新建账号
        </Button>
      </Stack>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
        绑定你自己的抖音 / 快手 / 小红书开放平台账号,或一键绑定 YouTube / TikTok;清秋月用你的账号一键把站内作品发布出去。
        作品归属清秋月平台;视频素材请先在抖音创作者中心 / 快手 App 上传,粘贴返回的 video_id。
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        在抖音/快手开放平台创建「网站应用」类应用,把 client_key / client_secret 填到下方。授权回调域名必须为清秋月部署域名(本地 <code>localhost:3000</code>)。
      </Alert>

      {isLoading ? (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>加载中…</Typography>
      ) : (
        <Stack spacing={2}>
          {PLATFORMS.map((p) => (
            <PlatformCard
              key={p.value}
              platform={p.value}
              label={p.label}
              color={p.color}
              hint={p.hint}
              accounts={grouped.get(p.value) || []}
              info={infoOf(p.value)}
              binding={doBind.isPending}
              onBind={() => doBind.mutate(p.value)}
              onAuth={(id) => doAuth.mutate(id)}
              onRefresh={(id) => doRefresh.mutate(id)}
              onEdit={(a) => setForm({ open: true, mode: 'edit', initial: a })}
              onDelete={confirmDelete}
            />
          ))}
        </Stack>
      )}

      {overlays}
    </Box>
  );
}

function PlatformCard(props: {
  platform: string;
  label: string;
  color: string;
  hint: string;
  accounts: ShareAccount[];
  info?: SharePlatformInfo;
  binding: boolean;
  onBind: () => void;
  onAuth: (id: number) => void;
  onRefresh: (id: number) => void;
  onEdit: (a: ShareAccount) => void;
  onDelete: (id: number) => void;
}) {
  const { label, color, hint, accounts, info, binding, onBind, onAuth, onRefresh, onEdit, onDelete } = props;
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        backgroundColor: 'background.paper',
      }}
    >
      <Stack direction="row" sx={{ mb: 1, alignItems: 'center', spacing: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
        <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
        <Chip size="small" label={`${accounts.length} 个账号`} variant="outlined" />
        {info?.builtinApp && info.privateOnly && (
          <Chip size="small" color="warning" variant="outlined" label="应用审核中,只能私享发布" sx={{ ml: 1 }} />
        )}
        {info?.builtinApp && (
          <Button size="small" variant="contained" sx={{ ml: 'auto' }} disabled={binding} onClick={onBind}>
            一键绑定{label}
          </Button>
        )}
      </Stack>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>{hint}</Typography>

      {accounts.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>暂无账号,点右上「新建账号」开始。</Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={1}>
          {accounts.map((a) => {
            const meta = AUTH_STATUS_META[a.authStatus] ?? AUTH_STATUS_META[0];
            return (
              <Stack
                key={a.id}
                direction="row"
                sx={{ py: 0.5, alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" sx={{ alignItems: 'center', spacing: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{a.accountName}</Typography>
                    {a.platformUserNickname && (
                      <Chip size="small" variant="outlined" label={a.platformUserNickname} sx={{ height: 18, fontSize: 10 }} />
                    )}
                    <Chip size="small" color={meta.color} label={meta.label} sx={{ height: 18, fontSize: 10 }} />
                    {!a.hasClientSecret && !a.usesBuiltinApp && (
                      <Chip size="small" color="warning" label="无 secret" sx={{ height: 18, fontSize: 10 }} />
                    )}
                  </Stack>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                    {a.usesBuiltinApp ? (
                      <>清秋月平台应用 · </>
                    ) : (
                      <>
                        client_key: <code>{a.clientKey}</code> · secret {a.hasClientSecret ? '已配置' : '未配置'} ·{' '}
                      </>
                    )}
                    token{' '}
                    {a.hasAccessToken ? '已缓存' : '无'}
                  </Typography>
                </Box>
                <Stack direction="row" sx={{ alignItems: 'center', spacing: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LaunchRoundedIcon />}
                    onClick={() => onAuth(a.id)}
                  >
                    去授权
                  </Button>
                  <IconButton size="small" title="刷新 token" onClick={() => onRefresh(a.id)}>
                    <RefreshRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" title="编辑" onClick={() => onEdit(a)}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" title="删除" onClick={() => onDelete(a.id)}>
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

function AccountFormDialog(props: {
  state: FormState;
  infoOf: (platform: string) => SharePlatformInfo | undefined;
  onClose: () => void;
  onSubmit: (payload: {
    platform: string;
    accountName: string;
    clientKey: string;
    clientSecret: string;
    redirectUri?: string;
    scope?: string;
    remark?: string;
  }) => void;
}) {
  const { state, infoOf, onClose, onSubmit } = props;
  const isEdit = state.mode === 'edit';
  const [platform, setPlatform] = useState<string>('');
  const [accountName, setAccountName] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [scope, setScope] = useState('');
  const [remark, setRemark] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!state.open) return;
    setErr(null);
    if (state.mode === 'edit' && state.initial) {
      setPlatform(state.initial.platform);
      setAccountName(state.initial.accountName);
      setClientKey(state.initial.clientKey);
      setClientSecret(''); // 编辑时 secret 留空=不改
      setRedirectUri(state.initial.redirectUri);
      setScope(state.initial.scope);
      setRemark(state.initial.remark);
    } else {
      setPlatform('douyin');
      setAccountName('');
      setClientKey('');
      setClientSecret('');
      setRedirectUri('');
      setScope('');
      setRemark('');
    }
  }, [state]);

  const handleSubmit = () => {
    // YouTube / TikTok 在清秋月配了平台应用时 clientKey / secret 都可以不填
    const builtin = isIntlPlatform(platform) && !!infoOf(platform)?.builtinApp && !clientKey.trim();
    if (!platform || !accountName.trim() || (!builtin && !clientKey.trim())) {
      setErr('平台 / 账号昵称 / clientKey 必填');
      return;
    }
    if (!isEdit && !builtin && !clientSecret.trim()) {
      setErr('新建账号时 clientSecret 必填');
      return;
    }
    onSubmit({
      platform,
      accountName: accountName.trim(),
      clientKey: clientKey.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: redirectUri.trim() || undefined,
      scope: scope.trim() || undefined,
      remark: remark.trim() || undefined,
    });
  };

  return (
    <Dialog open={state.open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? '编辑账号' : '新建账号'}</DialogTitle>
      <DialogContent>
        {err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            size="small"
            label="平台"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            disabled={isEdit}
          >
            {PLATFORMS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="账号昵称(展示用,可后续被三方账号昵称覆盖)"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
          <TextField
            size="small"
            label={isIntlPlatform(platform) && infoOf(platform)?.builtinApp ? 'client_key(可空,空 = 用清秋月平台应用)' : 'client_key(client_id / AppID)'}
            value={clientKey}
            onChange={(e) => setClientKey(e.target.value)}
          />
          <TextField
            size="small"
            type="password"
            label={`client_secret${isEdit ? '(留空=不改)' : ''}`}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            helperText="明文存储在数据库;前端列表永远不回显"
          />
          <TextField
            size="small"
            label="redirect_uri(可选,默认由后端按 host 拼)"
            placeholder={infoOf(platform)?.redirectUri}
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
          />
          <TextField
            size="small"
            label="scope(可选)"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            helperText="如 user_info,video.create,video.upload;空 = 后端按平台默认填"
          />
          <TextField
            size="small"
            label="备注"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit}>
          {isEdit ? '保存' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}