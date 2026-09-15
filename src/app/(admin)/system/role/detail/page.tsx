'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import {
  addMembers,
  assignDataPermissions,
  assignMenus,
  assignPermissions,
  get as getRole,
  getDataPermissions,
  getMenus,
  getPermissions,
  listAllDataPermissions,
  listAllMenus,
  listAllPermissions,
  listMembers,
  removeMembers,
  suggestUsers,
} from '@/apis/system-role';
import type { DataPermissionRecord, MemberRecord, MenuRecord, PermissionRecord } from '@/apis/system-role';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';

type Notify = (message: string, severity?: 'success' | 'error') => void;

interface TabProps {
  roleId: number;
  editable: boolean;
  notify: Notify;
}

const errMsg = (err: any, fallback: string) => err?.message || fallback;

function sameSet(a: Set<number>, b: Set<number>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** 已选集合 + 与服务端值比对的「是否改动」;服务端值变化(保存成功后重新拉取)时同步。 */
function useSelection(serverIds: number[] | undefined) {
  const initial = useMemo(() => new Set(serverIds ?? []), [serverIds]);
  const [selected, setSelected] = useState<Set<number>>(initial);
  useEffect(() => setSelected(new Set(initial)), [initial]);
  const toggle = (ids: number[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  return { selected, setSelected, toggle, dirty: !sameSet(selected, initial), reset: () => setSelected(new Set(initial)) };
}

function SaveBar({ editable, dirty, pending, onSave, onReset, count }: {
  editable: boolean; dirty: boolean; pending: boolean; onSave: () => void; onReset: () => void; count: number;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, position: 'sticky', bottom: 0, py: 1.5, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>已选 {count} 项{dirty ? ' · 有未保存的修改' : ''}</Typography>
      <Button size="small" onClick={onReset} disabled={!dirty || pending}>撤销修改</Button>
      <Button size="small" variant="contained" onClick={onSave} disabled={!editable || !dirty || pending}>
        {pending ? '保存中…' : '保存'}
      </Button>
    </Box>
  );
}

// ==================== 功能权限 ====================

function PermissionsTab({ roleId, editable, notify }: TabProps) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const all = useQuery({ queryKey: ['system', 'permission', 'all'], queryFn: async () => (await listAllPermissions()).data ?? [] });
  const current = useQuery({ queryKey: ['system', 'role', roleId, 'permissions'], queryFn: async () => (await getPermissions(roleId)).data ?? [] });
  const serverIds = useMemo(() => current.data?.map((p) => p.id), [current.data]);
  const { selected, toggle, dirty, reset } = useSelection(serverIds);

  const save = useMutation({
    mutationFn: () => assignPermissions(roleId, [...selected]),
    onSuccess: () => { notify('功能权限已保存'); qc.invalidateQueries({ queryKey: ['system', 'role', roleId, 'permissions'] }); },
    onError: (err) => notify(errMsg(err, '保存失败'), 'error'),
  });

  // 按编码的前两段分组:system:role:list → system:role
  const groups = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const map = new Map<string, PermissionRecord[]>();
    for (const p of all.data ?? []) {
      if (kw && !p.name.toLowerCase().includes(kw) && !p.code.toLowerCase().includes(kw)) continue;
      const key = p.code.split(':').slice(0, 2).join(':') || '其他';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [all.data, q]);

  if (all.isLoading || current.isLoading) return <CircularProgress size={24} />;
  if (all.isError || current.isError) return <Alert severity="error">加载失败:{errMsg(all.error ?? current.error, '')}</Alert>;

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        功能权限决定能调用哪些后台接口、看到哪些按钮;后端逐个请求实时校验,保存后立即生效,无需重新登录。
      </Alert>
      <TextField size="small" placeholder="按名称或编码筛选" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 2, width: 320, maxWidth: '100%' }} />
      {groups.map(([group, perms]) => {
        const ids = perms.map((p) => p.id);
        const n = ids.filter((id) => selected.has(id)).length;
        return (
          <Paper key={group} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={n === ids.length}
                  indeterminate={n > 0 && n < ids.length}
                  disabled={!editable}
                  onChange={(e) => toggle(ids, e.target.checked)}
                />
              }
              label={<Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{group} <Typography component="span" variant="caption" color="text.secondary">({n}/{ids.length})</Typography></Typography>}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', pl: 3 }}>
              {perms.map((p) => (
                <FormControlLabel
                  key={p.id}
                  control={<Checkbox size="small" checked={selected.has(p.id)} disabled={!editable} onChange={(e) => toggle([p.id], e.target.checked)} />}
                  label={
                    <Box>
                      <Typography variant="body2">{p.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{p.code}</Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
          </Paper>
        );
      })}
      {groups.length === 0 && <Typography color="text.secondary">没有匹配的权限</Typography>}
      <SaveBar editable={editable} dirty={dirty} pending={save.isPending} onSave={() => save.mutate()} onReset={reset} count={selected.size} />
    </Box>
  );
}

// ==================== 数据权限 ====================

const DATA_TYPE_LABEL: Record<string, string> = {
  all: '全部数据',
  self: '本人数据',
  field: '字段范围',
  content_scope: '受限内容可见',
};

function DataPermissionsTab({ roleId, editable, notify }: TabProps) {
  const qc = useQueryClient();
  const all = useQuery({ queryKey: ['system', 'data-permission', 'all'], queryFn: async () => (await listAllDataPermissions()).data ?? [] });
  const current = useQuery({ queryKey: ['system', 'role', roleId, 'data-permissions'], queryFn: async () => (await getDataPermissions(roleId)).data ?? [] });
  const serverIds = useMemo(() => current.data?.map((p) => p.id), [current.data]);
  const { selected, toggle, dirty, reset } = useSelection(serverIds);

  const save = useMutation({
    mutationFn: () => assignDataPermissions(roleId, [...selected]),
    onSuccess: () => { notify('数据权限已保存'); qc.invalidateQueries({ queryKey: ['system', 'role', roleId, 'data-permissions'] }); },
    onError: (err) => notify(errMsg(err, '保存失败'), 'error'),
  });

  if (all.isLoading || current.isLoading) return <CircularProgress size={24} />;
  if (all.isError || current.isError) return <Alert severity="error">加载失败:{errMsg(all.error ?? current.error, '')}</Alert>;

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        数据权限决定成员在「内容管理」列表里能看到哪些数据:<b>全部数据</b>不限制;<b>本人数据</b>只看自己的;
        <b>字段范围</b>按模块/分类/类型/来源限定。一个人有多个角色时取并集;一个都没配时只看自己的。
        <b>受限内容可见</b>另外决定能否看到标记为受限的内容(全部数据不包含受限内容)。
      </Alert>
      {(all.data ?? []).map((dp: DataPermissionRecord) => {
        const effective = !!dp.type && dp.type in DATA_TYPE_LABEL;
        return (
          <Paper key={dp.id} variant="outlined" sx={{ px: 1.5, py: 0.5, mb: 1, opacity: effective ? 1 : 0.7 }}>
            <FormControlLabel
              sx={{ width: '100%' }}
              control={<Checkbox size="small" checked={selected.has(dp.id)} disabled={!editable} onChange={(e) => toggle([dp.id], e.target.checked)} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2">{dp.name}</Typography>
                  <Chip size="small" label={dp.code} sx={{ fontFamily: 'monospace' }} />
                  {effective
                    ? <Chip size="small" variant="outlined" label={DATA_TYPE_LABEL[dp.type!]} />
                    : (
                      <Tooltip title="历史遗留的代码,当前数据权限引擎不识别,绑定后不产生任何效果">
                        <Chip size="small" color="warning" variant="outlined" label="不生效" />
                      </Tooltip>
                    )}
                  {dp.info && <Typography variant="caption" color="text.secondary">{dp.info}</Typography>}
                </Box>
              }
            />
          </Paper>
        );
      })}
      <SaveBar editable={editable} dirty={dirty} pending={save.isPending} onSave={() => save.mutate()} onReset={reset} count={selected.size} />
    </Box>
  );
}

// ==================== 菜单 ====================

function MenusTab({ roleId, editable, notify }: TabProps) {
  const qc = useQueryClient();
  const all = useQuery({ queryKey: ['system', 'menu', 'all'], queryFn: async () => (await listAllMenus()).data ?? [] });
  const current = useQuery({ queryKey: ['system', 'role', roleId, 'menus'], queryFn: async () => (await getMenus(roleId)).data ?? [] });
  const serverIds = useMemo(() => current.data?.map((m) => m.id), [current.data]);
  const { selected, setSelected, dirty, reset } = useSelection(serverIds);

  const save = useMutation({
    mutationFn: () => assignMenus(roleId, [...selected]),
    onSuccess: () => { notify('菜单已保存,成员刷新页面后侧边栏生效'); qc.invalidateQueries({ queryKey: ['system', 'role', roleId, 'menus'] }); },
    onError: (err) => notify(errMsg(err, '保存失败'), 'error'),
  });

  const { roots, children, parent } = useMemo(() => {
    const list = all.data ?? [];
    const ids = new Set(list.map((m) => m.id));
    const children = new Map<number, MenuRecord[]>();
    const parent = new Map<number, number>();
    const roots: MenuRecord[] = [];
    for (const m of list) {
      if (m.pid && ids.has(m.pid)) {
        children.set(m.pid, [...(children.get(m.pid) ?? []), m]);
        parent.set(m.id, m.pid);
      } else {
        roots.push(m);
      }
    }
    return { roots, children, parent };
  }, [all.data]);

  const descendants = (id: number): number[] =>
    (children.get(id) ?? []).flatMap((c) => [c.id, ...descendants(c.id)]);

  // 勾子菜单时连带勾上所有上级(否则侧边栏挂不上);取消父菜单时连带取消全部下级。
  const setChecked = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) {
        for (let cur: number | undefined = id; cur !== undefined; cur = parent.get(cur)) next.add(cur);
      } else {
        [id, ...descendants(id)].forEach((d) => next.delete(d));
      }
      return next;
    });

  const renderNode = (m: MenuRecord, depth: number): React.ReactNode => (
    <Box key={m.id}>
      <FormControlLabel
        sx={{ pl: depth * 3 }}
        control={<Checkbox size="small" checked={selected.has(m.id)} disabled={!editable} onChange={(e) => setChecked(m.id, e.target.checked)} />}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">{m.name}</Typography>
            {m.path && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{m.path}</Typography>}
            {m.display === 0 && <Chip size="small" variant="outlined" label="隐藏" />}
          </Box>
        }
      />
      {(children.get(m.id) ?? []).map((c) => renderNode(c, depth + 1))}
    </Box>
  );

  if (all.isLoading || current.isLoading) return <CircularProgress size={24} />;
  if (all.isError || current.isError) return <Alert severity="error">加载失败:{errMsg(all.error ?? current.error, '')}</Alert>;

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>菜单决定成员侧边栏里出现哪些入口;能不能真正操作由功能权限决定。</Alert>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        {roots.map((m) => renderNode(m, 0))}
        {roots.length === 0 && <Typography color="text.secondary">还没有菜单</Typography>}
      </Paper>
      <SaveBar editable={editable} dirty={dirty} pending={save.isPending} onSave={() => save.mutate()} onReset={reset} count={selected.size} />
    </Box>
  );
}

// ==================== 成员 ====================

function MembersTab({ roleId, editable, notify }: TabProps) {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [picked, setPicked] = useState<MemberRecord[]>([]);
  const membersKey = ['system', 'role', roleId, 'users'];
  const members = useQuery({ queryKey: membersKey, queryFn: async () => (await listMembers(roleId)).data ?? [] });
  const options = useQuery({
    queryKey: ['system', 'user', 'suggest', keyword],
    queryFn: async () => (await suggestUsers(keyword)).data ?? [],
    enabled: keyword.trim().length > 0,
    staleTime: 10_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: membersKey });
    qc.invalidateQueries({ queryKey: ['system', 'role'] });
  };
  const add = useMutation({
    mutationFn: () => addMembers(roleId, picked.map((u) => u.id)),
    onSuccess: () => { notify(`已添加 ${picked.length} 人`); setPicked([]); refresh(); },
    onError: (err) => notify(errMsg(err, '添加失败'), 'error'),
  });
  const del = useMutation({
    mutationFn: (userId: number) => removeMembers(roleId, [userId]),
    onSuccess: () => { notify('已移除'); refresh(); },
    onError: (err) => notify(errMsg(err, '移除失败'), 'error'),
  });

  const memberIds = new Set((members.data ?? []).map((u) => u.id));
  const label = (u: MemberRecord) => (u.nickname && u.nickname !== u.name ? `${u.nickname}(${u.name})` : u.name);

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>成员变化立即生效,在线的成员不需要重新登录。</Alert>
      {editable && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Autocomplete
            multiple
            size="small"
            sx={{ flex: 1, minWidth: 260 }}
            options={(options.data ?? []).filter((u) => !memberIds.has(u.id))}
            value={picked}
            onChange={(_, v) => setPicked(v)}
            onInputChange={(_, v, reason) => { if (reason === 'input') setKeyword(v); }}
            getOptionLabel={label}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(x) => x}
            loading={options.isFetching}
            noOptionsText={keyword ? '没有匹配的用户' : '输入用户名或昵称搜索'}
            renderInput={(params) => <TextField {...params} placeholder="搜索用户" />}
          />
          <Button variant="contained" onClick={() => add.mutate()} disabled={picked.length === 0 || add.isPending}>添加</Button>
        </Box>
      )}
      {members.isLoading && <CircularProgress size={24} />}
      {members.isError && <Alert severity="error">加载失败:{errMsg(members.error, '')}</Alert>}
      <Paper variant="outlined">
        {(members.data ?? []).map((u, i) => (
          <React.Fragment key={u.id}>
            {i > 0 && <Divider />}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1 }}>
              <Avatar src={u.avatar} sx={{ width: 28, height: 28 }}>{(u.nickname || u.name || '?').slice(0, 1)}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2">{label(u)}</Typography>
                {u.mobile && <Typography variant="caption" color="text.secondary">{u.mobile}</Typography>}
              </Box>
              {editable && (
                <Tooltip title="移出角色">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={del.isPending}
                      onClick={() => { if (confirm(`把 ${label(u)} 移出这个角色?`)) del.mutate(u.id); }}
                    >
                      <PersonRemoveIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          </React.Fragment>
        ))}
        {!members.isLoading && (members.data ?? []).length === 0 && (
          <Typography color="text.secondary" sx={{ p: 2 }}>这个角色还没有成员</Typography>
        )}
      </Paper>
    </Box>
  );
}

// ==================== 页面 ====================

function RoleDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleId = Number(searchParams.get('id'));
  const { can, isSuperAdmin } = useAuthority();
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const notify: Notify = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const roleQ = useQuery({
    queryKey: ['system', 'role', roleId, 'detail'],
    queryFn: async () => (await getRole(roleId)).data,
    enabled: roleId > 0,
  });
  const role = roleQ.data;

  if (!(roleId > 0)) return <Alert severity="error" sx={{ m: 3 }}>缺少角色 ID</Alert>;
  if (roleQ.isLoading) return <Box sx={{ p: 3 }}><CircularProgress size={24} /></Box>;
  if (roleQ.isError || !role) return <Alert severity="error" sx={{ m: 3 }}>角色不存在或无权查看:{errMsg(roleQ.error, '')}</Alert>;

  // 内置角色(超级管理员)只有超级管理员能改;后端同样校验。
  const editable = can(PERMISSIONS.SYSTEM_ROLE.UPDATE) && (!role.system || isSuperAdmin);
  const tabProps = { roleId, editable, notify };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <IconButton size="small" onClick={() => router.push('/system/role')}><ArrowBackIcon /></IconButton>
        <Typography variant="h6">{role.name}</Typography>
        {role.code && <Chip size="small" label={role.code} sx={{ fontFamily: 'monospace' }} />}
        {role.system && <Chip size="small" color="warning" label="内置" />}
        {role.info && <Typography variant="body2" color="text.secondary">{role.info}</Typography>}
      </Box>
      {role.system && (
        <Alert severity="warning">内置角色拥有全部功能权限,这里的功能权限勾选不影响它;只有超级管理员能修改它的成员。</Alert>
      )}
      {!editable && !role.system && <Alert severity="info">只读:你没有修改角色的权限(system:role:update)。</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
        <Tab label="功能权限" />
        <Tab label="数据权限" />
        <Tab label="菜单" />
        <Tab label="成员" />
      </Tabs>
      <Box>
        {tab === 0 && <PermissionsTab {...tabProps} />}
        {tab === 1 && <DataPermissionsTab {...tabProps} />}
        {tab === 2 && <MenusTab {...tabProps} />}
        {tab === 3 && <MembersTab {...tabProps} />}
      </Box>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function RoleDetailPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    }>
      <RoleDetailContent />
    </Suspense>
  );
}
