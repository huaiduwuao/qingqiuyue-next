'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { get, permissionAdd, dataPermissionAdd, getPermissions, getDataPermissions } from '@/apis/system-role';
import { listPermissions } from '@/apis/system-permission';
import { list, assign, getMenus as getRoleMenus } from '@/apis/menu';
import { listDataPermissions } from '@/apis/system-data-permission';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function RoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const roleId = Number(params.id);

  const [tab, setTab] = useState(0);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [selectedMenus, setSelectedMenus] = useState<number[]>([]);
  const [selectedDataPermissions, setSelectedDataPermissions] = useState<number[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // 获取角色信息
  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ['system', 'role', roleId],
    queryFn: () => get(roleId),
  });

  // 获取所有权限列表
  const { data: permissionsData, isLoading: permsLoading } = useQuery({
    queryKey: ['system', 'permissions', 'all'],
    queryFn: () => listPermissions({ pageSize: 1000 }),
  });

  // 获取角色已有权限
  const { data: rolePermissionsData } = useQuery({
    queryKey: ['system', 'role', roleId, 'role-permissions'],
    queryFn: () => getPermissions(roleId),
    enabled: roleId > 0,
  });

  // 获取所有菜单列表
  const { data: menusData, isLoading: menusLoading } = useQuery({
    queryKey: ['system', 'menus', 'all'],
    queryFn: () => list({ pageSize: 1000 }),
  });

  // 获取角色已有菜单
  const { data: roleMenusData } = useQuery({
    queryKey: ['system', 'role', roleId, 'role-menus'],
    queryFn: () => getRoleMenus(roleId),
    enabled: roleId > 0,
  });

  // 获取所有数据权限列表
  const { data: dataPermsData, isLoading: dataPermsLoading } = useQuery({
    queryKey: ['system', 'data-permissions', 'all'],
    queryFn: () => listDataPermissions({ pageSize: 1000 }),
  });

  // 获取角色已有数据权限
  const { data: roleDataPermsData } = useQuery({
    queryKey: ['system', 'role', roleId, 'role-data-permissions'],
    queryFn: () => getDataPermissions(roleId),
    enabled: roleId > 0,
  });

  // 分配权限
  const assignPermsMutation = useMutation({
    mutationFn: (permissionIds: number[]) => permissionAdd({ id: roleId, permissionIds } as any),
    onSuccess: () => {
      showMessage('权限分配成功');
      qc.invalidateQueries({ queryKey: ['system', 'role', roleId, 'role-permissions'] });
    },
    onError: (err: any) => showMessage(err.message || '权限分配失败', 'error'),
  });

  // 分配菜单
  const assignMenusMutation = useMutation({
    mutationFn: (menuIds: number[]) => assign(roleId, menuIds),
    onSuccess: () => {
      showMessage('菜单分配成功');
      qc.invalidateQueries({ queryKey: ['system', 'role', roleId, 'role-menus'] });
    },
    onError: (err: any) => showMessage(err.message || '菜单分配失败', 'error'),
  });

  // 分配数据权限
  const assignDataPermsMutation = useMutation({
    mutationFn: (permissionIds: number[]) => dataPermissionAdd({ id: roleId, permissionIds } as any),
    onSuccess: () => {
      showMessage('数据权限分配成功');
      qc.invalidateQueries({ queryKey: ['system', 'role', roleId, 'role-data-permissions'] });
    },
    onError: (err: any) => showMessage(err.message || '数据权限分配失败', 'error'),
  });

  // 加载角色已有数据
  useEffect(() => {
    if (rolePermissionsData?.data) {
      const ids = (rolePermissionsData.data as any[]).map((p: any) => p.id);
      setSelectedPermissions(ids);
    }
  }, [rolePermissionsData]);

  useEffect(() => {
    if (roleMenusData?.data) {
      const ids = (roleMenusData.data as any[]).map((m: any) => m.id);
      setSelectedMenus(ids);
    }
  }, [roleMenusData]);

  useEffect(() => {
    if (roleDataPermsData?.data) {
      const ids = (roleDataPermsData.data as any[]).map((d: any) => d.id);
      setSelectedDataPermissions(ids);
    }
  }, [roleDataPermsData]);

  const handlePermissionChange = (permId: number) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(id => id !== permId)
        : [...prev, permId]
    );
  };

  const handleMenuChange = (menuId: number) => {
    setSelectedMenus(prev =>
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleDataPermChange = (permId: number) => {
    setSelectedDataPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(id => id !== permId)
        : [...prev, permId]
    );
  };

  const handleSavePermissions = () => {
    assignPermsMutation.mutate(selectedPermissions);
  };

  const handleSaveMenus = () => {
    assignMenusMutation.mutate(selectedMenus);
  };

  const handleSaveDataPermissions = () => {
    assignDataPermsMutation.mutate(selectedDataPermissions);
  };

  const isLoading = roleLoading || permsLoading || menusLoading || dataPermsLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const permissions = permissionsData?.data?.records || permissionsData?.data?.list || [];
  const menus = menusData?.data?.records || menusData?.data?.list || menusData?.data || [];
  const dataPermissions = dataPermsData?.data?.records || dataPermsData?.data?.list || [];

  return (
    <Box sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
      {/* 顶部标题栏 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/system/role')}
          sx={{ color: 'text.secondary' }}
        >
          返回
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          角色配置：{role?.data?.name || '加载中...'}
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            角色信息
          </Typography>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">名称</Typography>
              <Typography variant="body1">{role?.data?.name}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">代码</Typography>
              <Typography variant="body1">{role?.data?.code || '-'}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">描述</Typography>
              <Typography variant="body1">{role?.data?.info || '-'}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="功能权限" />
            <Tab label="菜单权限" />
            <Tab label="数据权限" />
          </Tabs>
        </Box>

        {/* 功能权限 Tab */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2">
                勾选该角色拥有的功能权限
              </Typography>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSavePermissions}
                disabled={assignPermsMutation.isPending}
              >
                保存权限
              </Button>
            </Box>
            <FormGroup>
              {permissions.length > 0 ? (
                permissions.map((perm: any) => (
                  <FormControlLabel
                    key={perm.id}
                    control={
                      <Checkbox
                        checked={selectedPermissions.includes(perm.id)}
                        onChange={() => handlePermissionChange(perm.id)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{perm.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{perm.code}</Typography>
                      </Box>
                    }
                    sx={{ mb: 1, mr: 3 }}
                  />
                ))
              ) : (
                <Typography color="text.secondary">暂无可分配的权限</Typography>
              )}
            </FormGroup>
          </Box>
        </TabPanel>

        {/* 菜单权限 Tab */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2">
                勾选该角色可访问的菜单
              </Typography>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveMenus}
                disabled={assignMenusMutation.isPending}
              >
                保存菜单
              </Button>
            </Box>
            <FormGroup>
              {menus.length > 0 ? (
                menus.map((menu: any) => (
                  <FormControlLabel
                    key={menu.id}
                    control={
                      <Checkbox
                        checked={selectedMenus.includes(menu.id)}
                        onChange={() => handleMenuChange(menu.id)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{menu.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{menu.path}</Typography>
                      </Box>
                    }
                    sx={{ mb: 1, mr: 3 }}
                  />
                ))
              ) : (
                <Typography color="text.secondary">暂无可分配的菜单</Typography>
              )}
            </FormGroup>
          </Box>
        </TabPanel>

        {/* 数据权限 Tab */}
        <TabPanel value={tab} index={2}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2">
                勾选该角色的数据权限规则
              </Typography>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveDataPermissions}
                disabled={assignDataPermsMutation.isPending}
              >
                保存数据权限
              </Button>
            </Box>
            <FormGroup>
              {dataPermissions.length > 0 ? (
                dataPermissions.map((dp: any) => (
                  <FormControlLabel
                    key={dp.id}
                    control={
                      <Checkbox
                        checked={selectedDataPermissions.includes(dp.id)}
                        onChange={() => handleDataPermChange(dp.id)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{dp.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          类型: {dp.type} | {dp.info}
                        </Typography>
                      </Box>
                    }
                    sx={{ mb: 1, mr: 3 }}
                  />
                ))
              ) : (
                <Typography color="text.secondary">暂无可分配的数据权限</Typography>
              )}
            </FormGroup>
          </Box>
        </TabPanel>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
